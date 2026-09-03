#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, withFileLock } from "@theluckystrike/mcp-license";
import { z } from "zod";
import { blockText, type Block } from "./blocks.js";
import { buildDocx, toHtml, type DocStyle } from "./build.js";
import { parseMarkdown } from "./md.js";
import {
  addDoc, dataDir, docsInMonth, getBusiness, getDocs, hasBusiness, nextNumber,
  setBusiness, type Business, type DocKind,
} from "./store.js";
import { assertDocx, fillDocx, placeholdersIn, readDocx } from "./wordxml.js";

const FREE_AGREEMENTS_PER_MONTH = 3;
const FREE_TEMPLATE_PLACEHOLDERS = 10;
const BUSINESS_FIELDS = [
  "name", "address", "email", "vat_id", "iban", "bank", "logo_path", "brand_color",
  "default_currency", "default_tax_rate", "payment_terms_days", "invoice_prefix",
  "tax_rate", "vat_rate", "vat",
];
const gate = createLicenseGate({ product: "docx" });

/** Serialise every read-modify-write cycle on the data dir across processes. */
function locked<T>(fn: () => T | Promise<T>): Promise<T> {
  return withFileLock(join(dataDir(), ".lock"), fn);
}

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true as const });
const json = (v: unknown) => ok(JSON.stringify(v, null, 2));

const PLACEHOLDER_ISSUER = "Your business";
const NO_BUSINESS_NOTE =
  "No business profile yet: the document shows a placeholder sender. " +
  "Run business_set {name, address, email, vat_id} and create it again.";

function businessMissing(): boolean { return !hasBusiness() || !getBusiness().name.trim(); }
function issuer(): Business {
  const b = getBusiness();
  return b.name.trim() ? b : { ...b, name: PLACEHOLDER_ISSUER };
}

function isoDate(d = new Date()): string { return d.toISOString().slice(0, 10); }

function expandPath(p: string): string {
  const s = p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
  return isAbsolute(s) ? s : resolvePath(process.cwd(), s);
}

function slug(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "document";
}

function outputPath(out: string | undefined, fallbackName: string, ext: string, overwrite = false): string {
  const p = expandPath(out ?? join(dataDir(), "documents", fallbackName));
  const withExt = p.toLowerCase().endsWith(ext) ? p : `${p}${ext}`;
  if (!overwrite && existsSync(withExt)) {
    throw new Error(
      `${withExt} already exists and nothing was written. ` +
      `Pass overwrite: true to replace it, or give a different out_path.`,
    );
  }
  mkdirSync(dirname(withExt), { recursive: true });
  return withExt;
}

/** Amounts on a proposal or contract always carry the currency code, never a bare number. */
function money(amount: number, currency: string): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const s = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency.toUpperCase()} ${s}`;
}

/**
 * Recording is best-effort on purpose: the .docx is already on disk by the time the
 * history is touched, so a corrupt store must not be reported as "nothing was written".
 * The reason is returned and appended to the tool's own answer instead.
 */
function record(kind: DocKind, title: string, path: string, client?: string, number?: string): string {
  try {
    addDoc({ id: randomBytes(4).toString("hex"), kind, title, client, number, path, created: new Date().toISOString() });
    return "";
  } catch (e) {
    return `\n\nThe file was written, but it could not be added to the document history: ` +
      `${String((e as Error).message ?? e)}`;
  }
}

function agreementLimit(): string | null {
  if (gate.isPro()) return null;
  const month = new Date().toISOString().slice(0, 7);
  const used = docsInMonth(month, ["proposal", "contract"]).length;
  if (used < FREE_AGREEMENTS_PER_MONTH) return null;
  return `You have already created ${used} proposals or contracts in ${month}. ` +
    `The free tier allows ${FREE_AGREEMENTS_PER_MONTH} proposals or contracts per calendar month; ` +
    `doc_create, doc_from_markdown, doc_read and doc_to_html stay unlimited.\n\n` +
    gate.upgradeText("unlimited proposals and contracts");
}

function brandingNote(): string {
  return gate.isPro() ? "" :
    `\n\nFree tier: the footer carries "Generated with mcp-docx by theluckystrike" and the letterhead uses ` +
    `the default colour with no logo. ${gate.upgradeText("unbranded documents with your own letterhead")}`;
}

const server = new McpServer(
  { name: "mcp-docx", version: "0.3.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

/* ------------------------------------------------------------------ business */

server.registerTool("business_set", {
  title: "Set your business details",
  description: "Store the sender profile printed on every proposal, contract and letter: your name, address, email, VAT id, bank details and defaults (currency, payment terms). Same profile shape as mcp-invoice. Call this once before creating documents.",
  inputSchema: z.object({
    name: z.string().describe("Your business or freelancer name"),
    address: z.string().optional().describe("Postal address, newlines allowed"),
    email: z.string().optional(),
    vat_id: z.string().optional().describe("VAT / tax registration id"),
    iban: z.string().optional().describe("IBAN or account number for payment"),
    bank: z.string().optional().describe("Bank name / BIC"),
    logo_path: z.string().optional().describe("Path to a PNG or JPG logo for the letterhead (Pro)"),
    brand_color: z.string().optional().describe("Letterhead colour as a hex code, e.g. 1F3864 (Pro)"),
    default_currency: z.string().regex(/^[A-Za-z]{3}$/, "must be a 3-letter ISO code such as EUR").optional().describe("ISO code, e.g. EUR, USD. Default EUR"),
    default_tax_rate: z.number().optional().describe("Default VAT percent, quoted on proposals"),
    payment_terms_days: z.number().optional().describe("Default days until payment is due. Default 14"),
    invoice_prefix: z.string().optional().describe("Reference prefix used by mcp-invoice; kept here so one profile serves both"),
    tax_rate: z.number().optional().describe("Alias for default_tax_rate"),
    vat_rate: z.number().optional().describe("Alias for default_tax_rate"),
    vat: z.number().optional().describe("Alias for default_tax_rate"),
  }).passthrough(),
}, async (a: Record<string, any>) => {
  try {
    return await locked(() => {
      const prev = getBusiness();
      const aliasKey = (["tax_rate", "vat_rate", "vat"] as const).find((k) => typeof a[k] === "number");
      const taxRate = a.default_tax_rate ?? (aliasKey ? (a[aliasKey] as number) : undefined);
      const unknown = Object.keys(a).filter((k) => !BUSINESS_FIELDS.includes(k));
      let warn = "";
      if (aliasKey) warn += `\n\nRead ${aliasKey}: ${a[aliasKey]} as default_tax_rate: ${taxRate}.`;
      if (unknown.length) {
        warn += `\n\nWarning: ignored unknown field${unknown.length > 1 ? "s" : ""} ${unknown.join(", ")}. ` +
          `Accepted fields: ${BUSINESS_FIELDS.join(", ")}.`;
      }
      let note = "";
      let color = a.brand_color ?? prev.brand_color;
      if (a.brand_color && !gate.isPro()) {
        note = `\n\nNote: a custom letterhead colour is a Pro feature; it is stored but the free tier renders the default. ` +
          gate.upgradeText("custom letterhead colours and your logo");
      }
      const biz: Business = {
        name: a.name,
        address: a.address ?? prev.address,
        email: a.email ?? prev.email,
        vat_id: a.vat_id ?? prev.vat_id,
        iban: a.iban ?? prev.iban,
        bank: a.bank ?? prev.bank,
        logo_path: a.logo_path ?? prev.logo_path,
        brand_color: color,
        default_currency: (a.default_currency ?? prev.default_currency).toUpperCase(),
        default_tax_rate: taxRate ?? prev.default_tax_rate,
        payment_terms_days: a.payment_terms_days ?? prev.payment_terms_days,
        invoice_prefix: (a.invoice_prefix ?? prev.invoice_prefix).replace(/[^A-Za-z0-9_-]/g, "") || "INV",
      };
      setBusiness(biz);
      return ok(`Business profile saved to ${dataDir()}.\n\n${JSON.stringify(biz, null, 2)}${note}${warn}`);
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ----------------------------------------------------------------- documents */

const sectionSchema = z.object({
  heading: z.string().optional().describe("Section heading"),
  level: z.number().int().min(1).max(6).optional().describe("Heading level, default 2"),
  paragraphs: z.array(z.string()).optional().describe("Body paragraphs. **bold**, *italic* and `code` are honoured"),
  bullets: z.array(z.string()).optional().describe("Bullet list items"),
  numbered: z.array(z.string()).optional().describe("Numbered list items"),
  table: z.object({
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }).optional().describe("A table: one header row plus rows of cells"),
});

function sectionBlocks(sections: z.infer<typeof sectionSchema>[]): Block[] {
  const blocks: Block[] = [];
  for (const s of sections) {
    if (s.heading) blocks.push({ type: "heading", level: s.level ?? 2, text: s.heading });
    for (const p of s.paragraphs ?? []) blocks.push({ type: "para", text: p });
    if (s.bullets?.length) blocks.push({ type: "bullets", items: s.bullets, ordered: false });
    if (s.numbered?.length) blocks.push({ type: "bullets", items: s.numbered, ordered: true });
    if (s.table) blocks.push({ type: "table", headers: s.table.headers, rows: s.table.rows });
  }
  return blocks;
}

async function writeDoc(
  title: string, blocks: Block[], style: DocStyle, out: string | undefined,
  kind: DocKind, opts: { client?: string; number?: string; date?: string; overwrite?: boolean } = {},
): Promise<{ path: string; note: string }> {
  const path = outputPath(out, `${slug(title)}.docx`, ".docx", opts.overwrite === true);
  const buf = await buildDocx({
    title, blocks, style, business: issuer(), pro: gate.isPro(),
    date: opts.date, recipient: opts.client,
  });
  writeFileSync(path, buf);
  const note = record(kind, title, path, opts.client, opts.number);
  return { path, note };
}

server.registerTool("doc_create", {
  title: "Create a Word document",
  description: "Write a real .docx file from structured sections: headings, paragraphs, bullet or numbered lists and tables. Choose plain, letter (sender block top right, date, addressee) or proposal (letterhead band and cover title) layout. Returns the file path. Free and unlimited.",
  inputSchema: {
    title: z.string().describe("Document title, used as the top heading and the file name"),
    sections: z.array(sectionSchema).describe("Sections in order"),
    out_path: z.string().optional().describe("Where to write the .docx. Defaults to the data directory"),
    style: z.enum(["plain", "letter", "proposal"]).optional().describe("Layout, default plain"),
    recipient: z.string().optional().describe("Addressee block for the letter layout"),
    date: z.string().optional().describe("Date line for the letter layout, default today"),
    overwrite: z.boolean().optional().describe("Replace out_path if a file is already there. Default false: an existing file is never overwritten"),
  },
}, async (a) => {
  try {
    const blocks = sectionBlocks(a.sections);
    if (!blocks.length) return fail("a document needs at least one section with a heading, paragraphs, bullets or a table.");
    const style = (a.style ?? "plain") as DocStyle;
    const res = await locked(() => writeDoc(a.title, blocks, style, a.out_path, "document", {
      client: a.recipient, date: style === "letter" ? (a.date ?? isoDate()) : a.date, overwrite: a.overwrite,
    }));
    return ok(`Wrote Word document ${res.path}\n\n${blocks.length} blocks, style ${style}.${res.note}` +
      `${businessMissing() && style !== "plain" ? `\n\n${NO_BUSINESS_NOTE}` : ""}${brandingNote()}`);
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("doc_from_markdown", {
  title: "Markdown to Word",
  description: "Turn markdown into a .docx: ATX headings, paragraphs, bullet and numbered lists, GFM pipe tables, fenced code blocks as monospace, and **bold** / *italic* / `code` inline. Returns the file path. Free and unlimited.",
  inputSchema: {
    markdown: z.string().describe("The markdown source"),
    out_path: z.string().optional().describe("Where to write the .docx. Defaults to the data directory"),
    title: z.string().optional().describe("Document title; defaults to the first heading in the markdown"),
    style: z.enum(["plain", "letter", "proposal"]).optional(),
    overwrite: z.boolean().optional().describe("Replace out_path if a file is already there. Default false: an existing file is never overwritten"),
  },
}, async (a) => {
  try {
    const blocks = parseMarkdown(a.markdown);
    if (!blocks.length) return fail("the markdown is empty.");
    let title = a.title;
    let body = blocks;
    if (!title) {
      const first = blocks[0];
      if (first.type === "heading" && first.level === 1) { title = first.text; body = blocks.slice(1); }
      else title = "Document";
    }
    const res = await locked(() => writeDoc(title!, body, (a.style ?? "plain") as DocStyle, a.out_path, "markdown", { overwrite: a.overwrite }));
    const counts = body.reduce<Record<string, number>>((acc, b) => { acc[b.type] = (acc[b.type] ?? 0) + 1; return acc; }, {});
    return ok(`Wrote Word document ${res.path}\n\n${JSON.stringify({ title, blocks: counts }, null, 2)}${res.note}${brandingNote()}`);
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("doc_read", {
  title: "Read a Word document",
  description: "Extract the text of an existing .docx: headings with their levels, paragraphs, list items and tables, in document order. Works on files Word, Google Docs or this server produced. Free and unlimited.",
  inputSchema: {
    path: z.string().describe("Path to the .docx file"),
    format: z.enum(["text", "json"]).optional().describe("text (default) returns the readable text, json returns the block structure"),
  },
}, async (a) => {
  try {
    const p = expandPath(a.path);
    if (!existsSync(p)) return fail(`no file at ${p}.`);
    if (!/\.docx$/i.test(p)) return fail(`${p} is not a .docx file. Legacy .doc and .rtf are not readable here.`);
    const blocks = readDocx(readFileSync(p));
    if (a.format === "json") return json({ path: p, blocks });
    const headings = blocks.filter((b): b is Extract<Block, { type: "heading" }> => b.type === "heading")
      .map((b) => `${"  ".repeat(b.level - 1)}${b.text}`);
    const text = blocks.map(blockText).join("\n\n");
    return ok(
      `${basename(p)}: ${blocks.length} blocks, ${text.length} characters.\n\n` +
      `OUTLINE\n${headings.length ? headings.join("\n") : "(no headings)"}\n\nTEXT\n${text}`,
    );
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("doc_to_html", {
  title: "Word document to HTML",
  description: "Convert a .docx to semantic HTML you can open in a browser and print to PDF. Direct PDF output is deliberately not offered: every pure-JS Word-to-PDF path needs a native dependency or a headless browser, and this server stays install-free, so printing the HTML is the supported route. Free and unlimited.",
  inputSchema: {
    path: z.string().describe("Path to the .docx file"),
    out_path: z.string().optional().describe("Where to write the .html. Defaults next to the source file"),
    overwrite: z.boolean().optional().describe("Replace out_path if a file is already there. Default false: an existing file is never overwritten"),
  },
}, async (a) => {
  try {
    const p = expandPath(a.path);
    if (!existsSync(p)) return fail(`no file at ${p}.`);
    const blocks = readDocx(readFileSync(p));
    const title = blocks.find((b) => b.type === "heading")?.text ?? basename(p).replace(/\.docx$/i, "");
    const out = outputPath(a.out_path ?? p.replace(/\.docx$/i, ".html"), `${slug(title)}.html`, ".html", a.overwrite === true);
    writeFileSync(out, toHtml(title, blocks), "utf8");
    const note = record("html", title, out);
    return ok(`Wrote ${out}${note}\n\nOpen it in a browser and use File > Print > Save as PDF. ` +
      `This server has no native dependency, so it does not render PDF bytes itself.`);
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("doc_fill_template", {
  title: "Fill a Word template",
  description: "Replace {{placeholders}} in an existing .docx and write a new file, keeping every style, table, header, footer and image of the original. Placeholders split across runs by Word's editor are handled, because the substitution runs on the joined text of each paragraph. Call with no values to list the placeholders a template contains.",
  inputSchema: {
    template_path: z.string().describe("Path to the .docx template containing {{placeholders}}"),
    values: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
      .describe("Placeholder name to value, e.g. {client: \"Acme\", fee: \"EUR 4,500.00\"}"),
    out_path: z.string().optional().describe("Where to write the filled .docx. Defaults to <template>-filled.docx"),
    overwrite: z.boolean().optional().describe("Replace out_path if a file is already there. Default false: an existing file is never overwritten"),
  },
}, async (a) => {
  try {
    const tpl = expandPath(a.template_path);
    if (!existsSync(tpl)) return fail(`no template at ${tpl}.`);
    const buf = readFileSync(tpl);
    assertDocx(buf, tpl);
    const found = placeholdersIn(buf);
    if (!a.values || !Object.keys(a.values).length) {
      return ok(found.length
        ? `${basename(tpl)} contains ${found.length} placeholder${found.length > 1 ? "s" : ""}:\n\n` +
          found.map((f) => `- {{${f}}}`).join("\n") + `\n\nCall doc_fill_template again with values for them.`
        : `${basename(tpl)} contains no {{placeholders}}. Add them to the template in Word first.`);
    }
    if (!gate.isPro() && found.length > FREE_TEMPLATE_PLACEHOLDERS) {
      return ok(`This template has ${found.length} placeholders. The free tier fills templates with up to ` +
        `${FREE_TEMPLATE_PLACEHOLDERS}.\n\n${gate.upgradeText("templates of any size")}`);
    }
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(a.values)) values[k] = String(v);
    const res = fillDocx(buf, values);
    const out = outputPath(a.out_path ?? tpl.replace(/\.docx$/i, "-filled.docx"), `${slug(basename(tpl))}-filled.docx`, ".docx", a.overwrite === true);
    writeFileSync(out, res.buffer);
    const note = await locked(() => record("template", basename(out), out));
    const unused = Object.keys(values).filter((k) => !res.replaced.includes(k));
    return ok(
      `Wrote ${out}${note}\n\nReplaced ${res.replaced.length}: ${res.replaced.map((k) => `{{${k}}}`).join(", ") || "(none)"}` +
      (res.unfilled.length ? `\n\nStill unfilled, no value was given: ${res.unfilled.map((k) => `{{${k}}}`).join(", ")}` : "") +
      (unused.length ? `\n\nNot present in the template, ignored: ${unused.join(", ")}` : ""),
    );
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ---------------------------------------------------------------- proposals */

server.registerTool("proposal_create", {
  title: "Create a proposal",
  description: "Produce a client-ready .docx proposal from the parts you already know: summary, scope, deliverables, a timeline table, price and terms. Uses your business_set profile for the letterhead and allocates a reference number that is never reused. Free tier: 3 proposals or contracts per calendar month.",
  inputSchema: {
    client: z.string().describe("Client name, printed as 'Prepared for'"),
    project_title: z.string().describe("Project title"),
    summary: z.string().describe("One or two paragraphs on the problem and the approach"),
    scope: z.array(z.string()).describe("What is in scope, one bullet each"),
    deliverables: z.array(z.string()).describe("What the client receives, one bullet each"),
    timeline: z.array(z.object({
      phase: z.string(),
      duration: z.string().describe("e.g. '2 weeks'"),
    })).describe("Phases and their durations, rendered as a table"),
    price: z.object({
      amount: z.number().finite().describe("Total price in major units, e.g. 4500"),
      currency: z.string().regex(/^[A-Za-z]{3}$/, "must be a 3-letter ISO code such as EUR").optional(),
      terms: z.string().optional().describe("e.g. '50% on signature, 50% on delivery'"),
    }),
    valid_until: z.string().optional().describe("YYYY-MM-DD, the date the quote expires"),
    out_path: z.string().optional(),
    overwrite: z.boolean().optional().describe("Replace out_path if a file is already there. Default false: an existing file is never overwritten"),
  },
}, async (a) => {
  try {
    const gated = agreementLimit();
    if (gated) return ok(gated);
    const biz = issuer();
    const currency = (a.price.currency ?? biz.default_currency).toUpperCase();
    const total = money(a.price.amount, currency);
    const terms = a.price.terms ?? `Payable within ${biz.payment_terms_days} days of invoice.`;
    const blocks: Block[] = [
      { type: "heading", level: 2, text: "Summary" },
      { type: "para", text: a.summary },
      { type: "heading", level: 2, text: "Scope of work" },
      { type: "bullets", items: a.scope, ordered: false },
      { type: "heading", level: 2, text: "Deliverables" },
      { type: "bullets", items: a.deliverables, ordered: false },
    ];
    if (a.timeline.length) {
      blocks.push({ type: "heading", level: 2, text: "Timeline" });
      blocks.push({ type: "table", headers: ["Phase", "Duration"], rows: a.timeline.map((t) => [t.phase, t.duration]) });
    }
    blocks.push({ type: "heading", level: 2, text: "Investment" });
    blocks.push({ type: "table", headers: ["Item", "Amount"], rows: [[a.project_title, total]] });
    blocks.push({ type: "para", text: `Total: **${total}**` });
    blocks.push({ type: "para", text: `Payment terms: ${terms}` });
    if (biz.default_tax_rate) blocks.push({ type: "para", text: `All amounts exclude VAT at ${biz.default_tax_rate}%.` });
    blocks.push({ type: "heading", level: 2, text: "Acceptance" });
    blocks.push({ type: "para", text:
      `This proposal is valid until ${a.valid_until ?? "the date agreed in writing"}. ` +
      `To accept, reply in writing or sign below.` });
    blocks.push({ type: "para", text: `Signed for ${a.client}: ______________________    Date: ____________` });
    blocks.push({ type: "para", text: `Signed for ${biz.name}: ______________________    Date: ____________` });

    const out = await locked(async () => {
      const number = nextNumber("PROP", isoDate().slice(0, 4));
      const w = await writeDoc(
        a.project_title, blocks, "proposal", a.out_path, "proposal",
        { client: a.client, number, date: `${isoDate()}   |   Ref ${number}`, overwrite: a.overwrite },
      );
      return { path: w.path, note: w.note, number };
    });
    return ok(
      `Created proposal ${out.number} for ${a.client}.\n\n` +
      JSON.stringify({
        reference: out.number, client: a.client, project: a.project_title,
        total, terms, valid_until: a.valid_until, phases: a.timeline.length, file: out.path,
      }, null, 2) + out.note +
      `${businessMissing() ? `\n\n${NO_BUSINESS_NOTE}` : ""}${brandingNote()}`,
    );
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("contract_create", {
  title: "Create a service agreement",
  description: "Produce a plain freelance service agreement .docx: parties, services, term, fee and schedule, plus standard clauses on intellectual property, confidentiality, independent contractor status, liability and termination. This is a template skeleton with labelled placeholders for a lawyer to review, not legal advice. Free tier: 3 proposals or contracts per calendar month.",
  inputSchema: {
    client: z.string().describe("The client's legal name"),
    services: z.string().describe("What you will do, one or two sentences"),
    start_date: z.string().describe("YYYY-MM-DD"),
    end_date: z.string().optional().describe("YYYY-MM-DD, omit for an open-ended engagement"),
    fee: z.object({
      amount: z.number().finite(),
      currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
      schedule: z.string().describe("e.g. 'monthly in arrears' or '50% up front'"),
    }),
    governing_law: z.string().optional().describe("e.g. 'the laws of Poland'"),
    clauses: z.array(z.string()).optional().describe("Extra clauses to append, one paragraph each"),
    out_path: z.string().optional(),
    overwrite: z.boolean().optional().describe("Replace out_path if a file is already there. Default false: an existing file is never overwritten"),
  },
}, async (a) => {
  try {
    const gated = agreementLimit();
    if (gated) return ok(gated);
    const biz = issuer();
    const currency = (a.fee.currency ?? biz.default_currency).toUpperCase();
    const fee = money(a.fee.amount, currency);
    const law = a.governing_law ?? "[GOVERNING LAW - to be completed]";
    const term = a.end_date
      ? `This Agreement starts on ${a.start_date} and ends on ${a.end_date}, unless extended in writing.`
      : `This Agreement starts on ${a.start_date} and continues until either party terminates it under clause 8.`;
    const blocks: Block[] = [
      { type: "para", text: "**TEMPLATE - NOT LEGAL ADVICE.** This document is a drafting skeleton. Every clause and every [BRACKETED PLACEHOLDER] must be reviewed by a qualified lawyer in the relevant jurisdiction before it is signed." },
      { type: "heading", level: 2, text: "1. Parties" },
      { type: "para", text: `This Service Agreement is made between ${biz.name}${biz.address ? `, ${biz.address.replace(/\n/g, ", ")}` : ""} (the "Contractor") and ${a.client}, [CLIENT REGISTERED ADDRESS] (the "Client").` },
      { type: "heading", level: 2, text: "2. Services" },
      { type: "para", text: a.services },
      { type: "para", text: "Any work outside this description is a change request and is quoted separately before it starts." },
      { type: "heading", level: 2, text: "3. Term" },
      { type: "para", text: term },
      { type: "heading", level: 2, text: "4. Fee and payment" },
      { type: "table", headers: ["Fee", "Schedule", "Terms"], rows: [[fee, a.fee.schedule, `Invoices are due within ${biz.payment_terms_days} days.`]] },
      { type: "para", text: `The Client pays the Contractor ${fee}, ${a.fee.schedule}. Late payment carries statutory interest. All amounts are exclusive of VAT unless stated otherwise.` },
      { type: "heading", level: 2, text: "5. Intellectual property" },
      { type: "para", text: "On full payment, the Contractor assigns to the Client the intellectual property rights in the deliverables produced under this Agreement. The Contractor keeps ownership of pre-existing tools, libraries and know-how, and grants the Client a non-exclusive licence to use them as embedded in the deliverables. [CONFIRM SCOPE OF ASSIGNMENT]" },
      { type: "heading", level: 2, text: "6. Confidentiality" },
      { type: "para", text: "Each party keeps the other's non-public information confidential and uses it only to perform this Agreement. This obligation survives termination for [NUMBER] years." },
      { type: "heading", level: 2, text: "7. Independent contractor" },
      { type: "para", text: "The Contractor is an independent contractor, not an employee, and is responsible for their own taxes, insurance and social contributions. Nothing in this Agreement creates a partnership, joint venture or employment relationship." },
      { type: "heading", level: 2, text: "8. Termination" },
      { type: "para", text: "Either party may terminate this Agreement with [NUMBER] days' written notice. The Client pays for all work performed up to the termination date. Either party may terminate immediately for material breach that is not remedied within 14 days of written notice." },
      { type: "heading", level: 2, text: "9. Liability" },
      { type: "para", text: "Neither party is liable for indirect or consequential loss. The Contractor's total liability under this Agreement is limited to the fees paid in the [NUMBER] months before the claim. Nothing limits liability that cannot be limited by law. [REVIEW CAP]" },
      { type: "heading", level: 2, text: "10. Governing law" },
      { type: "para", text: `This Agreement is governed by ${law}, and the courts of [JURISDICTION] have exclusive jurisdiction.` },
    ];
    let n = 11;
    for (const c of a.clauses ?? []) {
      blocks.push({ type: "heading", level: 2, text: `${n}. Additional terms` });
      blocks.push({ type: "para", text: c });
      n++;
    }
    blocks.push({ type: "heading", level: 2, text: "Signatures" });
    blocks.push({ type: "table", headers: ["Contractor", "Client"], rows: [
      [`${biz.name}\n\nName: ____________________\nSignature: ________________\nDate: ____________`,
       `${a.client}\n\nName: ____________________\nSignature: ________________\nDate: ____________`],
    ] });
    blocks.push({ type: "para", text: "*Template produced by mcp-docx. It is not legal advice and no lawyer has reviewed it.*" });

    const out = await locked(async () => {
      const number = nextNumber("AGR", (a.start_date.slice(0, 4).match(/^\d{4}$/) ? a.start_date.slice(0, 4) : isoDate().slice(0, 4)));
      const w = await writeDoc(
        `Service Agreement - ${a.client}`, blocks, "proposal", a.out_path, "contract",
        { client: a.client, number, date: `${isoDate()}   |   Ref ${number}`, overwrite: a.overwrite },
      );
      return { path: w.path, note: w.note, number };
    });
    return ok(
      `Created service agreement ${out.number} for ${a.client}.\n\n` +
      JSON.stringify({ reference: out.number, client: a.client, fee, schedule: a.fee.schedule, start_date: a.start_date, end_date: a.end_date, governing_law: law, file: out.path }, null, 2) + out.note +
      `\n\nThis is a template, not legal advice. Have a lawyer review every clause and complete every [BRACKETED PLACEHOLDER] before anyone signs.` +
      `${businessMissing() ? `\n\n${NO_BUSINESS_NOTE}` : ""}${brandingNote()}`,
    );
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ----------------------------------------------------------------- resources */

server.registerResource("recent-documents", "docs://recent", {
  title: "Recent documents",
  description: "The documents this server has written, newest first, with their kind, client, reference and path.",
  mimeType: "application/json",
}, async (uri) => ({
  contents: [{
    uri: uri.href, mimeType: "application/json",
    text: JSON.stringify(getDocs().slice(-25).reverse(), null, 2),
  }],
}));

/* ------------------------------------------------------------------- prompts */

server.registerPrompt("write_proposal_from_hours", {
  title: "Write a proposal from tracked hours",
  description: "Turn tracked time or an invoice summary into a priced proposal for the next engagement.",
  argsSchema: {
    client: z.string().describe("Who the proposal is for"),
    project: z.string().optional().describe("Working title of the project"),
    hours: z.string().optional().describe("Hours from time-tracker or invoice_summary, e.g. '38.5'"),
    rate: z.string().optional().describe("Hourly rate, e.g. '90 EUR'"),
  },
}, ({ client, project, hours, rate }: { client: string; project?: string; hours?: string; rate?: string }) => {
  const biz = getBusiness();
  const text =
    `Write a proposal for ${client}${project ? ` for "${project}"` : ""}.\n\n` +
    (hours || rate
      ? `Basis: ${hours ?? "the hours"} hours at ${rate ?? `my usual rate`}. Compute the total and state it once.\n\n`
      : `First get the hours: call the time-tracker server's invoice_summary (or report) for this client, ` +
        `and use the hours and rate it returns as the basis for the price.\n\n`) +
    `Then call proposal_create with:\n` +
    `- client: "${client}"\n` +
    `- project_title: a specific outcome, not a job title\n` +
    `- summary: two short paragraphs, the problem in the client's words then the approach\n` +
    `- scope: 4-6 bullets of what is included, each one a deliverable boundary\n` +
    `- deliverables: what they actually receive, files and access included\n` +
    `- timeline: 3-4 phases with realistic durations\n` +
    `- price: {amount, currency: "${biz.default_currency}", terms: e.g. "50% on signature, 50% on delivery"}\n` +
    `- valid_until: 30 days from today\n\n` +
    `Rules: no adjectives that cannot be checked, no filler, no emoji. State assumptions as a bullet list ` +
    `under scope rather than hiding them. If the hours are unknown, ask one question instead of guessing.`;
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
});

gate.registerTools(server as unknown as { registerTool: Function });

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`mcp-docx ready (${gate.isPro() ? "pro" : "free"}), data in ${dataDir()}\n`);
