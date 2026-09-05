#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, EMAIL_PLACEHOLDER, readSharedProfile, withFileLock, writeSharedProfile } from "@theluckystrike/mcp-license";
import { z } from "zod";
import { blockText, type Block } from "./blocks.js";
import { buildDocx, toHtml, type DocStyle } from "./build.js";
import { parseMarkdown } from "./md.js";
import {
  addDoc, dataDir, docsInMonth, getBusiness, getDocs, hasBusiness, nextNumber,
  setBusiness, updateDoc, type Business, type DocKind, type DocRecord,
} from "./store.js";
import { assertDocx, fillDocx, placeholdersIn, readDocx, stripInvalidXml } from "./wordxml.js";
import { VERSION } from "./version.js";

const FREE_AGREEMENTS_PER_MONTH = 3;
const FREE_TEMPLATE_PLACEHOLDERS = 10;
const BUSINESS_FIELDS = [
  "name", "address", "email", "phone", "timezone", "vat_id", "iban", "bank", "logo_path", "brand_color",
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
  "Run business_set {name, address, email, vat_id}, then proposal_update {reference} to rewrite this document " +
  "in place - creating it again would burn a second reference and a second free-tier document.";

function businessMissing(): boolean { return !hasBusiness() || !getBusiness().name.trim(); }
function issuer(): Business {
  const b = getBusiness();
  return b.name.trim() ? b : { ...b, name: PLACEHOLDER_ISSUER };
}

/**
 * D-R40. The letterhead prints an email only when the shared profile carries one. When it
 * does not, the document shows "[add: email]" and the answer says so, so nobody has to
 * invent an address to make the page look finished.
 */
function emailNote(): string {
  return getBusiness().email
    ? ""
    : `\n\nNo email address is stored, so the letterhead shows "${EMAIL_PLACEHOLDER}". ` +
      `Set it with business_set {email} once the user has given you the address; do not supply one yourself.`;
}

function isoDate(d = new Date()): string { return d.toISOString().slice(0, 10); }

/** A leading `<scheme>://` means the caller has a URL, not a local path. Checked BEFORE
 * any resolution, so a URL is never joined against the server's cwd and the refusal
 * never has a path in it, let alone one that leaks the cwd. */
const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

// D-R83: a URL handed to `path` used to be silently resolved as a relative filesystem
// path, producing a "no file at" error that leaked the server's own cwd. Refused by
// name instead.
function expandPath(p: string): string {
  if (URL_SCHEME_RE.test(p)) {
    throw new Error(
      `"${p}" is a URL, not a file path; this tool reads local files. On the hosted route, ` +
      `use the url argument of doc_upload. Locally, download it first and pass the path it was saved to.`,
    );
  }
  const s = p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
  return isAbsolute(s) ? s : resolvePath(process.cwd(), s);
}

function slug(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "document";
}

function outputPath(out: string | undefined, fallbackName: string, ext: string, overwrite = false): string {
  const p = expandPath(out ?? join(dataDir(), "documents", fallbackName));
  const withExt = p.toLowerCase().endsWith(ext) ? p : `${p}${ext}`;
  mkdirSync(dirname(withExt), { recursive: true });
  // A path this server derived itself (no out_path given) must never land on an earlier
  // document: two proposals with the same title get -2, -3, ... instead of one file.
  if (out === undefined && !overwrite) {
    const stem = withExt.slice(0, withExt.length - ext.length);
    for (let n = 1; n < 1000; n++) {
      const candidate = n === 1 ? withExt : `${stem}-${n}${ext}`;
      try {
        closeSync(openSync(candidate, "wx"));
        return candidate;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      }
    }
    throw new Error(`${withExt} and 999 numbered variants already exist; pass out_path.`);
  }
  // Reserve the path with an exclusive create, not an existence check: two processes
  // writing the same out_path with overwrite:false would otherwise both pass the check
  // and the second would clobber the first.
  if (!overwrite) {
    try {
      closeSync(openSync(withExt, "wx"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      throw new Error(
        `${withExt} already exists and nothing was written. ` +
        `Pass overwrite: true to replace it, or give a different out_path.`,
      );
    }
  }
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
function record(kind: DocKind, title: string, path: string, client?: string, number?: string, data?: unknown): string {
  try {
    addDoc({ id: randomBytes(4).toString("hex"), kind, title, client, number, path, data, created: new Date().toISOString() });
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
  { name: "mcp-docx", version: VERSION },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

/* ------------------------------------------------------------------ business */

server.registerTool("business_set", {
  title: "Set your business details",
  description: "The sender profile printed on every proposal, contract and letter. The SAME profile invoice's business_set writes: it goes to the shared profile, so it also sets your invoice issuer and default VAT.",
  inputSchema: z.object({
    name: z.string().describe("Your business or freelancer name, printed on the letterhead of every proposal, contract and letter"),
    address: z.string().optional().describe("Postal address, newlines allowed"),
    email: z.string().optional().describe("Your own email address, printed on every letterhead. Leave it out unless the user gave it: a document that shows an address nobody supplied is worse than one that shows [add: email]"),
    phone: z.string().optional().describe("Your own phone number. Same rule as email: only if the user gave it"),
    timezone: z.string().optional().describe("IANA zone you work in, e.g. Europe/Warsaw. Shared with time-tracker and timezone as your home zone"),
    vat_id: z.string().optional().describe("VAT / tax registration id"),
    iban: z.string().optional().describe("IBAN or account number for payment"),
    bank: z.string().optional().describe("Bank name / BIC"),
    logo_path: z.string().optional().describe("Path to a PNG or JPG logo for the letterhead (Pro)"),
    brand_color: z.string().optional().describe("Letterhead colour as a hex code, e.g. 1F3864 (Pro)"),
    default_currency: z.string().regex(/^[A-Za-z]{3}$/, "must be a 3-letter ISO code such as EUR").optional().describe("ISO code, e.g. EUR, USD. Default EUR"),
    default_tax_rate: z.number().optional().describe("Default VAT percent, quoted on proposals"),
    payment_terms_days: z.number().optional().describe("Default days until payment is due. Default 14"),
    invoice_prefix: z.string().optional().describe("Reference prefix used by mcp-invoice; this profile has the same field shape as mcp-invoice, so one profile serves both"),
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
          gate.upgradeText("custom letterhead colours and your logo", "business_set");
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
      if (a.phone || a.timezone) writeSharedProfile({ phone: a.phone, timezone: a.timezone });
      const shared = readSharedProfile();
      return ok(`Business profile saved to ${dataDir()} and to the shared profile every server in the suite reads ` +
        `(invoice issuer, expense-tracker default VAT, time-tracker and timezone home zone).\n\n` +
        `${JSON.stringify({ ...biz, phone: shared.phone, timezone: shared.timezone }, null, 2)}${note}${warn}`);
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

/**
 * XML 1.0 has no way to carry a NUL or most other C0 controls, and Word refuses a file
 * that contains one. Everything user-supplied is cleaned before it reaches document.xml
 * and the count of removed code points is reported back in the tool's answer.
 */
/**
 * A client that escaped its own JSON sends the two characters backslash-n where it meant a
 * line break, and the escape used to reach the printed page. Turn those into real breaks and
 * collapse stray whitespace before anything is rendered.
 */
export function normalizeText(s: string): string {
  return s
    .replace(/\\r\\n|\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanForXml<T>(value: T, count: { removed: number }): T {
  if (typeof value === "string") {
    const r = stripInvalidXml(normalizeText(value));
    count.removed += r.removed;
    return r.text as unknown as T;
  }
  if (Array.isArray(value)) return value.map((v) => cleanForXml(v, count)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = cleanForXml(v, count);
    return out as unknown as T;
  }
  return value;
}

function removedNote(removed: number): string {
  return removed
    ? `\n\nRemoved ${removed} character${removed > 1 ? "s" : ""} that XML 1.0 cannot carry ` +
      `(control codes or unpaired surrogates). Word would have refused the file with them in it.`
    : "";
}

async function writeDoc(
  title: string, blocks: Block[], style: DocStyle, out: string | undefined,
  kind: DocKind,
  opts: {
    client?: string; number?: string; date?: string; overwrite?: boolean;
    data?: unknown; replaceId?: string;
  } = {},
): Promise<{ path: string; note: string }> {
  const count = { removed: 0 };
  const clean = cleanForXml({ title, blocks, business: issuer(), date: opts.date, recipient: opts.client }, count);
  // A blank line inside one paragraph argument is a paragraph break, not a line break.
  const split: Block[] = [];
  for (const b of clean.blocks) {
    if (b.type === "para" && /\n\n/.test(b.text)) {
      for (const part of b.text.split(/\n{2,}/)) if (part.trim()) split.push({ type: "para", text: part });
    } else split.push(b);
  }
  const path = outputPath(out, `${slug(title)}.docx`, ".docx", opts.overwrite === true);
  const buf = await buildDocx({
    title: clean.title, blocks: split, style, business: clean.business, pro: gate.isPro(),
    date: clean.date, recipient: clean.recipient,
  });
  writeFileSync(path, buf);
  const stored = opts.replaceId
    ? (updateDoc(opts.replaceId, { title, client: opts.client, path, data: opts.data }) ? "" :
       `\n\nThe file was written, but reference ${opts.number ?? ""} is no longer in the document history.`)
    : record(kind, title, path, opts.client, opts.number, opts.data);
  return { path, note: stored + removedNote(count.removed) };
}

server.registerTool("doc_create", {
  title: "Create a Word document",
  description: "Call this tool to write a real .docx file from structured sections. Returns the file path, the number of blocks written and the layout used. Free and unlimited.",
  inputSchema: {
    title: z.string().describe("Document title, used as the top heading and the file name"),
    sections: z.array(sectionSchema).describe("Sections in order. Each one may carry a heading, paragraphs, a bullet or numbered list and a table"),
    out_path: z.string().optional().describe("Where to write the .docx. Defaults to the data directory"),
    style: z.enum(["plain", "letter", "proposal"]).optional().describe("Layout, default plain. plain is the title and the body; letter adds a sender block top right, a date and the addressee; proposal adds a letterhead band and a cover title"),
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
  description: "Call this tool to turn markdown into a .docx. Returns the file path and a count of the blocks written, by type. Free and unlimited.",
  inputSchema: {
    markdown: z.string().describe("The markdown source. ATX headings, paragraphs, bullet and numbered lists, GFM pipe tables and fenced code blocks as monospace are honoured, as are **bold**, *italic* and `code` inline"),
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
  description: "Call this tool to extract the text of an existing .docx. Returns an outline of the headings and the full text in document order, or the block structure. Free and unlimited.",
  inputSchema: {
    path: z.string().describe("Path to the .docx file. Files produced by Word, Google Docs or this server all work; legacy .doc and .rtf do not"),
    format: z.enum(["text", "json"]).optional().describe("text (default) returns the readable text, json returns the block structure: headings with their levels, paragraphs, list items and tables, in document order"),
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
  description: "Call this tool to convert a .docx to semantic HTML you can open in a browser and print to PDF. Returns the path of the .html file. This is the supported PDF route; no PDF is rendered here. Free and unlimited.",
  inputSchema: {
    path: z.string().describe("Path to the .docx file to convert"),
    out_path: z.string().optional().describe("Where to write the .html. Defaults next to the source file. Open the result and print it to PDF; direct PDF output is not offered here"),
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
      `Direct PDF output is deliberately not offered: every pure-JS Word-to-PDF path needs a native ` +
      `dependency or a headless browser, and this server stays install-free, so printing the HTML is ` +
      `the supported route. This server has no native dependency, so it does not render PDF bytes itself.`);
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("doc_fill_template", {
  title: "Fill a Word template",
  description: "Call this tool to replace {{placeholders}} in an existing .docx and write a new file. Returns the new path and which placeholders were replaced, unfilled or ignored. Call with no values to list a template's placeholders.",
  inputSchema: {
    template_path: z.string().describe("Path to the .docx template containing {{placeholders}}. Every style, table, header, footer and image of the original is kept. Placeholders split across runs by Word's editor are handled, because the substitution runs on the joined text of each paragraph"),
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
        `${FREE_TEMPLATE_PLACEHOLDERS}.\n\n${gate.upgradeText("templates of any size", "doc_fill_template")}`);
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
      (unused.length ? `\n\nNot present in the template, ignored: ${unused.join(", ")}` : "") +
      (res.sanitized.length
        ? `\n\nCharacters XML 1.0 cannot carry (control codes or unpaired surrogates) were removed from: ` +
          `${res.sanitized.map((k) => `{{${k}}}`).join(", ")}`
        : ""),
    );
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ---------------------------------------------------------------- proposals */

interface ProposalInput {
  client: string;
  project_title: string;
  summary?: string;
  scope?: string[];
  deliverables?: string[];
  timeline?: { phase: string; duration: string }[];
  price: { amount: number; currency?: string; terms?: string };
  valid_until?: string;
}

/**
 * D-R47: summary, scope, deliverables and timeline are all optional. A section that is
 * missing, or present but empty, is OMITTED from the document rather than invented, and
 * the caller of proposalBody gets back which sections it left out so the response can
 * say so and the model can ask for them instead of guessing.
 */
function proposalBody(a: ProposalInput): { blocks: Block[]; total: string; terms: string; omitted: string[] } {
  const biz = issuer();
  const currency = (a.price.currency ?? biz.default_currency).toUpperCase();
  const total = money(a.price.amount, currency);
  const terms = a.price.terms ?? `Payable within ${biz.payment_terms_days} days of invoice.`;
  const blocks: Block[] = [];
  const omitted: string[] = [];

  if (a.summary) {
    blocks.push({ type: "heading", level: 2, text: "Summary" }, { type: "para", text: a.summary });
  } else omitted.push("summary");

  if (a.scope && a.scope.length) {
    blocks.push({ type: "heading", level: 2, text: "Scope of work" }, { type: "bullets", items: a.scope, ordered: false });
  } else omitted.push("scope");

  if (a.deliverables && a.deliverables.length) {
    blocks.push({ type: "heading", level: 2, text: "Deliverables" }, { type: "bullets", items: a.deliverables, ordered: false });
  } else omitted.push("deliverables");

  if (a.timeline && a.timeline.length) {
    blocks.push({ type: "heading", level: 2, text: "Timeline" });
    blocks.push({ type: "table", headers: ["Phase", "Duration"], rows: a.timeline.map((t) => [t.phase, t.duration]) });
  } else omitted.push("timeline");

  blocks.push({ type: "heading", level: 2, text: "Investment" });
  blocks.push({ type: "table", headers: ["Item", "Amount"], rows: [[a.project_title, total]] });
  blocks.push({ type: "para", text: `Total: **${total}**` });
  blocks.push({ type: "para", text: `Payment terms: ${terms}` });
  if (biz.default_tax_rate) blocks.push({ type: "para", text: `All amounts exclude VAT at ${biz.default_tax_rate}%.` });
  blocks.push({ type: "heading", level: 2, text: "Acceptance" });
  blocks.push({ type: "para", text:
    `This proposal is valid until ${a.valid_until ?? "the date agreed in writing"}. ` +
    `To accept, reply in writing or sign below.` });
  blocks.push({ type: "para", text: `Signed for ${a.client}: ______________________ Date: ____________` });
  blocks.push({ type: "para", text: `Signed for ${biz.name}: ______________________ Date: ____________` });
  return { blocks, total, terms, omitted };
}

server.registerTool("proposal_create", {
  title: "Create a proposal",
  description: "Call this tool to produce a client-ready .docx proposal from summary, scope, deliverables, timeline, price and terms. Returns the reference, the total and the file path. Free tier: 3 proposals or contracts per month.",
  inputSchema: {
    client: z.string().describe("Client name, printed as 'Prepared for'. The letterhead comes from your business_set profile"),
    project_title: z.string().describe("Project title"),
    // D-R47: each of these is optional. A section that is missing (or an empty array)
    // is omitted from the document rather than invented; the response lists what was
    // left out so the model can ask for it instead of guessing a scope or a timeline.
    summary: z.string().optional().describe("One or two paragraphs on the problem and the approach. Omitted from the document if not given"),
    scope: z.array(z.string()).optional().describe("What is in scope, one bullet each. Omitted from the document if not given or empty"),
    deliverables: z.array(z.string()).optional().describe("What the client receives, one bullet each. Omitted from the document if not given or empty"),
    timeline: z.array(z.object({
      phase: z.string(),
      duration: z.string().describe("e.g. '2 weeks'"),
    })).optional().describe("Phases and their durations, rendered as a table. Omitted from the document if not given or empty"),
    price: z.object({
      amount: z.number().finite().describe("Total price in major units, e.g. 4500"),
      currency: z.string().regex(/^[A-Za-z]{3}$/, "must be a 3-letter ISO code such as EUR").optional(),
      terms: z.string().optional().describe("e.g. '50% on signature, 50% on delivery'"),
    }),
    valid_until: z.string().optional().describe("YYYY-MM-DD, the date the quote expires"),
    out_path: z.string().optional().describe("Where to write the .docx. Defaults to the data directory"),
    overwrite: z.boolean().optional().describe("Replace out_path if a file is already there. Default false: an existing file is never overwritten"),
  },
}, async (a) => {
  try {
    // D-R32: both refusals happen BEFORE nextNumber() and before any file is written, so a
    // refused call consumes no reference and none of the free tier's monthly documents.
    const gated = agreementLimit();
    if (gated) return ok(gated);
    if (businessMissing()) return fail(NO_BUSINESS_NOTE + " Nothing was written and no reference was used.");
    const { blocks, total, terms, omitted } = proposalBody(a);

    const out = await locked(async () => {
      const number = nextNumber("PROP", isoDate().slice(0, 4));
      const w = await writeDoc(
        a.project_title, blocks, "proposal", a.out_path, "proposal",
        { client: a.client, number, date: `${isoDate()} | Ref ${number}`, overwrite: a.overwrite, data: a },
      );
      return { path: w.path, note: w.note, number };
    });
    // D-R47: a missing section is omitted from the document, never invented. Say which
    // ones so the model can ask for them rather than the document silently being thinner
    // than the client expects.
    const omittedNote = omitted.length
      ? `\n\nOmitted from the document, not invented: ${omitted.join(", ")}. Call proposal_update ` +
        `{reference: "${out.number}", ...} with any of those to add them.`
      : "";
    return ok(
      `Created proposal ${out.number} for ${a.client}. The letterhead came from your business_set profile, ` +
      `and reference ${out.number} is never reused. To revise this proposal later, call proposal_update ` +
      `with the reference rather than creating a second one.\n\n` +
      JSON.stringify({
        reference: out.number, client: a.client, project: a.project_title,
        total, terms, valid_until: a.valid_until, phases: a.timeline?.length ?? 0, file: out.path,
        omitted_sections: omitted,
      }, null, 2) + out.note + omittedNote +
      `${emailNote()}${brandingNote()}`,
    );
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("proposal_update", {
  title: "Update a proposal",
  description: "Rewrite an existing proposal in place from its reference. Only the fields you pass change; the rest comes from the data stored at creation. Returns the fields that changed and the file path.",
  inputSchema: {
    reference: z.string().describe("The proposal reference, e.g. PROP-2026-0001. The same file and the same reference number are kept, so no second document is burned against the free-tier monthly count"),
    client: z.string().optional(),
    project_title: z.string().optional(),
    summary: z.string().optional(),
    scope: z.array(z.string()).optional(),
    deliverables: z.array(z.string()).optional(),
    timeline: z.array(z.object({ phase: z.string(), duration: z.string() })).optional(),
    price: z.object({
      amount: z.number().finite(),
      currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
      terms: z.string().optional(),
    }).optional(),
    valid_until: z.string().optional(),
  },
}, async (a) => {
  try {
    const ref = a.reference.trim().toUpperCase();
    const rec = getDocs().find((d: DocRecord) => d.kind === "proposal" && d.number === ref);
    if (!rec) return fail(`no proposal ${ref} in the document history. The docs://recent resource lists the references.`);
    if (!rec.data) {
      return fail(
        `proposal ${ref} was created before proposals were stored as structured data, so it cannot be ` +
        `rewritten. Create a new one with proposal_create.`,
      );
    }
    const patch: Partial<ProposalInput> = {};
    for (const k of ["client", "project_title", "summary", "scope", "deliverables", "timeline", "price", "valid_until"] as const) {
      const v = (a as Record<string, unknown>)[k];
      if (v !== undefined) (patch as Record<string, unknown>)[k] = v;
    }
    const merged = { ...(rec.data as ProposalInput), ...patch };
    const { blocks, total, terms, omitted } = proposalBody(merged);
    const omittedNote = omitted.length
      ? `\n\nOmitted from the document, not invented: ${omitted.join(", ")}.`
      : "";
    const out = await locked(() => writeDoc(
      merged.project_title, blocks, "proposal", rec.path, "proposal",
      {
        client: merged.client, number: ref, date: `${isoDate()} | Ref ${ref}`,
        overwrite: true, data: merged, replaceId: rec.id,
      },
    ));
    return ok(
      `Updated proposal ${ref} in place; the reference and the file are unchanged. Every field you did not ` +
      `pass was taken from the data stored when the proposal was created, and no second document was burned ` +
      `against the free-tier monthly count.\n\n` +
      JSON.stringify({
        reference: ref, client: merged.client, project: merged.project_title,
        total, terms, valid_until: merged.valid_until, phases: merged.timeline?.length ?? 0,
        changed: Object.keys(patch), omitted_sections: omitted, file: out.path,
      }, null, 2) + out.note + omittedNote + brandingNote(),
    );
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("contract_create", {
  title: "Create a service agreement",
  description: "Call this tool to produce a freelance service agreement .docx. Returns the reference, the fee and the file path. It is a template skeleton for a lawyer to review, not legal advice. Free tier: 3 agreements per month.",
  inputSchema: {
    client: z.string().describe("The client's legal name"),
    services: z.string().describe("What you will do, one or two sentences. The document adds parties, term, fee and schedule, plus standard clauses on intellectual property, confidentiality, independent contractor status, liability, termination and governing law"),
    start_date: z.string().describe("YYYY-MM-DD"),
    end_date: z.string().optional().describe("YYYY-MM-DD, omit for an open-ended engagement"),
    fee: z.object({
      amount: z.number().finite(),
      currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
      schedule: z.string().describe("e.g. 'monthly in arrears' or '50% up front'"),
    }),
    governing_law: z.string().optional().describe("e.g. 'the laws of Poland'"),
    clauses: z.array(z.string()).optional().describe("Extra clauses to append, one paragraph each"),
    out_path: z.string().optional().describe("Where to write the .docx. Defaults to the data directory"),
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
        { client: a.client, number, date: `${isoDate()} | Ref ${number}`, overwrite: a.overwrite, data: a },
      );
      return { path: w.path, note: w.note, number };
    });
    return ok(
      `Created service agreement ${out.number} for ${a.client}.\n\n` +
      JSON.stringify({ reference: out.number, client: a.client, fee, schedule: a.fee.schedule, start_date: a.start_date, end_date: a.end_date, governing_law: law, file: out.path }, null, 2) + out.note +
      `\n\nThis is a template skeleton with labelled placeholders, not legal advice. Have a lawyer review every clause and complete every [BRACKETED PLACEHOLDER] before anyone signs. The free tier allows 3 proposals or contracts per calendar month, combined.` +
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
