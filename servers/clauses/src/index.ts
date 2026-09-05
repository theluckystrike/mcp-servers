#!/usr/bin/env node
/**
 * mcp-clauses: a personal library of reusable contract and proposal clauses, assembled
 * into a real .docx through the docx server's engine.
 *
 * Nothing here is legal advice. Every starter clause carries that note, and every assembled
 * document opens with it.
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, EMAIL_PLACEHOLDER, readSharedProfile, withFileLock } from "@theluckystrike/mcp-license";
import { buildDocx, letterhead, stripInvalidXml, type Block } from "@theluckystrike/mcp-docx/lib";
import { z } from "zod";
import {
  CATEGORY_ORDER, categoryRank, dataDir, load, lockPath, save, STARTER_NOTE, type Clause,
} from "./store.js";
import {
  DISCLAIMER, clauseVariables, makeId, orderByCategory, parseClauseJson, parseMarkdown,
  promptFor, search, toClauseJson, toMarkdown, variablesFor,
} from "./library.js";
import { assemble, variableReport } from "./assemble.js";
import { VERSION } from "./version.js";

const FREE_OWN_CLAUSES = 10;
const FREE_ASSEMBLE_CLAUSES = 8;

const gate = createLicenseGate({ product: "clauses" });

/** Serialise every read-modify-write cycle on the data dir across processes. */
function locked<T>(fn: () => T | Promise<T>): Promise<T> {
  return withFileLock(lockPath(), fn);
}

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true as const });
const json = (v: unknown) => ok(JSON.stringify(v, null, 2));

/** A leading `<scheme>://` means the caller has a URL, not a local path. Checked BEFORE
 * any resolution, so a URL is never joined against the server's cwd and the refusal
 * never has a path in it, let alone one that leaks the cwd. */
const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

// D-R83: a URL handed to `path` used to be silently resolved as a relative filesystem
// path, producing an error that leaked the server's own cwd. Refused by name instead.
function expandPath(p: string): string {
  if (URL_SCHEME_RE.test(p)) {
    throw new Error(
      `"${p}" is a URL, not a file path; this tool reads local files. On the hosted route, ` +
      `paste the clauses' text directly. Locally, download it first and pass the path it was saved to.`,
    );
  }
  const s = p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
  return isAbsolute(s) ? s : resolvePath(process.cwd(), s);
}

/**
 * Reserve the output path with an exclusive create, never with an existence check: two
 * processes writing a derived path would both pass the check and the second would clobber
 * the first. A path this server derived itself gets -2, -3, ... instead.
 */
function outputPath(out: string | undefined, fallbackName: string, ext: string, overwrite = false): string {
  const p = expandPath(out ?? join(dataDir(), "documents", fallbackName));
  const withExt = p.toLowerCase().endsWith(ext) ? p : `${p}${ext}`;
  mkdirSync(dirname(withExt), { recursive: true });
  if (out !== undefined) {
    // An explicit path is still reserved with an exclusive create: a second contract
    // written to a path a signed document already occupies would otherwise destroy it
    // with no warning anywhere in the answer.
    if (overwrite) return withExt;
    try { closeSync(openSync(withExt, "wx")); return withExt; } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      throw new Error(`${withExt} already exists and nothing was written. Pass overwrite: true to replace it, or give a different out_path.`);
    }
  }
  const stem = withExt.slice(0, withExt.length - ext.length);
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? withExt : `${stem}-${n}${ext}`;
    try { closeSync(openSync(candidate, "wx")); return candidate; } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
  }
  throw new Error(`${withExt} and 999 numbered variants already exist; pass out_path.`);
}

/** Every string that reaches document.xml passes through the docx engine's XML sanitiser. */
function clean(s: string): string { return stripInvalidXml(s).text; }

function cleanBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    if (b.type === "bullets") return { ...b, items: b.items.map(clean) };
    if (b.type === "table") return { ...b, headers: b.headers.map(clean), rows: b.rows.map((r) => r.map(clean)) };
    return { ...b, text: clean(b.text) };
  });
}

const MAX_CATEGORY = 40;

/**
 * A category is a grouping key, printed in every list and in clauses://categories. A 10 000
 * character one is not a grouping, it is a paste accident, and it was previously stored
 * verbatim and echoed back in every listing.
 */
function slugCategory(s: string | undefined): string {
  const v = (s ?? "general").toLowerCase().trim().replace(/\s+/g, "-") || "general";
  return v.length > MAX_CATEGORY ? v.slice(0, MAX_CATEGORY) : v;
}

function view(c: Clause) {
  return {
    id: c.id, title: c.title, category: c.category, tags: c.tags,
    variables: clauseVariables(c), jurisdiction: c.jurisdiction, language: c.language,
    starter: c.starter, note: c.note, body: c.body,
    created: c.created, updated: c.updated, versions: c.history.length,
  };
}

function summary(c: Clause) {
  return { id: c.id, title: c.title, category: c.category, tags: c.tags, variables: clauseVariables(c), starter: c.starter };
}

/**
 * Resolve a clause by id, then by exact title, then -- only if nothing exact matched --
 * by partial title. An exact id or title match always wins outright, with no ambiguity
 * check: it is a precise reference. The partial-title fallback is not: "Payment Terms"
 * is also a substring of "Payment Terms (Retainer)", so more than one candidate there is
 * refused with the candidate list instead of silently picking whichever is first in
 * storage order (Review V5 P2), which could otherwise point clause_update/clause_delete/
 * contract_assemble at the wrong clause with no warning.
 */
function findClause(clauses: Clause[], ref: string): Clause | undefined {
  const t = ref.trim().toLowerCase();
  const byId = clauses.find((c) => c.id.toLowerCase() === t);
  if (byId) return byId;
  const byTitle = clauses.find((c) => c.title.toLowerCase() === t);
  if (byTitle) return byTitle;
  const partial = clauses.filter((c) => c.title.toLowerCase().includes(t));
  if (partial.length > 1) {
    throw new Error(
      `"${ref}" matches more than one clause: ${partial.map((c) => `${c.id} (${c.title})`).join(", ")}. ` +
      `Pass the exact id or the exact title.`,
    );
  }
  return partial[0];
}

/**
 * D-R31/D-R40. The contract letterhead is the user's own identity, read from the shared
 * business profile that invoice's and docx's business_set write. When no email is stored
 * the letterhead shows a bracketed prompt rather than an address nobody supplied.
 */
function contractLetterhead() {
  const p = readSharedProfile();
  return letterhead({
    name: p.name ?? "",
    address: p.address,
    email: p.email ?? EMAIL_PLACEHOLDER,
  });
}

function letterheadNote(): string {
  const p = readSharedProfile();
  if (!p.name) return " No business profile is stored, so the letterhead is blank: run business_set (invoice or docx) once and assemble again.";
  return p.email ? "" : ` No email is stored, so the letterhead shows "${EMAIL_PLACEHOLDER}". Set it with business_set {email}; do not supply one yourself.`;
}

const server = new McpServer({ name: "mcp-clauses", version: VERSION });

/* -------------------------------------------------------------------- CRUD */

server.registerTool("clause_add", {
  title: "Add a clause",
  description: "Save a reusable contract or proposal clause to the library. Returns the stored clause id, title, category, tags and the variables detected in its body, plus how many clauses of your own the library now holds.",
  inputSchema: {
    title: z.string().min(1).describe("Clause heading, for example 'Late Payment'"),
    body: z.string().min(1).describe("The clause text. Use {{variable}} placeholders for the facts that change per client, for example {{client}}, {{fee}} or {{late_fee_percent}}; contract_assemble fills them at assembly time. Free tier: 10 clauses of your own on top of the 25 starters"),
    category: z.string().describe(`Grouping. The known ones, in assembly order, are ${CATEGORY_ORDER.join(", ")} -- reuse one of these; any other name is accepted but sorts last in a category-based assembly`),
    tags: z.array(z.string()).optional(),
    variables: z.array(z.string()).optional().describe("Declared variable names. Anything {{...}} in the body is detected anyway"),
    jurisdiction: z.string().optional().describe("Where the clause is meant to apply, for example 'PL' or 'England and Wales'"),
    language: z.string().optional().describe("ISO language code, default en"),
  },
}, async (a) => {
  try {
    return await locked(() => {
      const db = load();
      const own = db.clauses.filter((c) => !c.starter).length;
      if (!gate.isPro() && own >= FREE_OWN_CLAUSES) {
        return ok(`The free tier holds ${FREE_OWN_CLAUSES} of your own clauses on top of the 25 starter clauses, and you have ${own}. ` +
          gate.upgradeText("an unlimited clause library", "clause_add"));
      }
      // D-R80. The 25 starter clauses ship with this server and occupy the obvious titles
      // ("Payment Terms", "Limitation of Liability"). The old error said only that the title
      // "already exists" and offered clause_update, which reads as "you wrote this before" -
      // so a model spent four extra calls searching for a clause of the caller's that was
      // never there. Which library the collision is in is the whole answer, and the server
      // knew it. Measured in round 15.
      const clash = db.clauses.find((c) => c.title.trim().toLowerCase() === a.title.trim().toLowerCase());
      if (clash) {
        return fail(clash.starter
          ? `"${a.title}" is the title of a STARTER clause (${clash.id}) that ships with this server, not one you wrote - you have not saved a clause by this name. Give yours a distinguishing title (for example "${a.title} (${a.jurisdiction ?? "yours"})") and both stay in the library, or call clause_update {id: "${clash.id}"} to overwrite the starter text with yours.`
          : `a clause titled "${a.title}" already exists and it is one of yours (${clash.id}); use clause_update {id: "${clash.id}"}, or give a different title`);
      }
      const now = new Date().toISOString();
      const c: Clause = {
        id: makeId(a.title, new Set(db.clauses.map((x) => x.id))),
        title: a.title.trim(), body: a.body,
        category: slugCategory(a.category),
        tags: a.tags ?? [], variables: a.variables ?? [],
        jurisdiction: a.jurisdiction, language: a.language ?? "en",
        starter: false, created: now, updated: now, history: [],
      };
      db.clauses.push(c);
      save(db);
      return json({
        added: summary(c), own_clauses: own + 1,
        note: gate.isPro() ? undefined : `The free tier holds ${FREE_OWN_CLAUSES} clauses of your own on top of the 25 starter clauses; ${own + 1} of ${FREE_OWN_CLAUSES} used.`,
      });
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("clause_get", {
  title: "Read one clause",
  description: "Return a clause in full by id or by title, with its variables and, in Pro, its revision count.",
  inputSchema: {
    id: z.string().optional().describe("Clause id, for example late-fees"),
    title: z.string().optional().describe("Clause title; a partial title matches too"),
  },
}, async (a) => {
  try {
    if (!a.id && !a.title) return fail("pass id or title");
    const c = findClause(load().clauses, (a.id ?? a.title) as string);
    return c ? json(view(c)) : fail(`no clause matches "${a.id ?? a.title}"`);
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("clause_update", {
  title: "Update a clause",
  description: "Change the text, category, tags, variables or jurisdiction of a clause. In Pro the previous text is kept as a version; in the free tier the change is applied without history.",
  inputSchema: {
    id: z.string().describe("Clause id or exact title"),
    title: z.string().optional(),
    body: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    variables: z.array(z.string()).optional(),
    jurisdiction: z.string().optional(),
    language: z.string().optional(),
  },
}, async (a) => {
  try {
    return await locked(() => {
      const db = load();
      const c = findClause(db.clauses, a.id);
      if (!c) return fail(`no clause matches "${a.id}"`);
      const pro = gate.isPro();
      const changedText = (a.body !== undefined && a.body !== c.body) || (a.title !== undefined && a.title !== c.title);
      if (pro && changedText) c.history.push({ at: c.updated, title: c.title, body: c.body });
      if (a.title !== undefined) c.title = a.title.trim();
      if (a.body !== undefined) c.body = a.body;
      if (a.category !== undefined) c.category = slugCategory(a.category);
      if (a.tags !== undefined) c.tags = a.tags;
      if (a.variables !== undefined) c.variables = a.variables;
      if (a.jurisdiction !== undefined) c.jurisdiction = a.jurisdiction;
      if (a.language !== undefined) c.language = a.language;
      c.updated = new Date().toISOString();
      save(db);
      return json({
        updated: summary(c),
        versions_kept: c.history.length,
        note: pro ? undefined : "the free tier does not keep clause versions; " + gate.upgradeText("clause version history", "clause_update").replace(/^\s+/, ""),
      });
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("clause_delete", {
  title: "Delete a clause",
  description: "Remove a clause from the library. A deleted starter clause is not re-seeded on the next call.",
  inputSchema: { id: z.string().describe("Clause id or exact title") },
}, async (a) => {
  try {
    return await locked(() => {
      const db = load();
      const c = findClause(db.clauses, a.id);
      if (!c) return fail(`no clause matches "${a.id}"`);
      db.clauses = db.clauses.filter((x) => x.id !== c.id);
      save(db);
      return ok(`Deleted ${c.id} (${c.title}). ${db.clauses.length} clauses left.`);
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("clause_list", {
  title: "List clauses",
  description: "List every clause, newest categories first, optionally narrowed to one category.",
  inputSchema: { category: z.string().optional() },
}, async (a) => {
  try {
    const db = load();
    const cat = a.category ? slugCategory(a.category) : undefined;
    const list = orderByCategory(cat ? db.clauses.filter((c) => c.category === cat) : db.clauses);
    return json({ count: list.length, own: list.filter((c) => !c.starter).length, clauses: list.map(summary) });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("clause_search", {
  title: "Search clauses",
  description: "Ranked search over clause titles, tags, categories and bodies. Title and tag matches outrank body matches. Jurisdiction filtering is free; the tag filter is Pro and is skipped rather than refusing the search.",
  inputSchema: {
    query: z.string().describe("Words to look for, for example 'late payment interest'"),
    category: z.string().optional(),
    tags: z.array(z.string()).optional().describe("Pro: every tag listed must be present. On free the search still runs, without this filter"),
    jurisdiction: z.string().optional().describe("Exact jurisdiction match. Free"),
  },
}, async (a) => {
  try {
    const pro = gate.isPro();
    // D-R55: the jurisdiction filter is a correctness check - a clause from the wrong
    // jurisdiction assembled into a contract is the error the caller makes by hand - so it
    // is free. Tag filtering is convenience and stays Pro, but it never costs the caller
    // the search itself: the query runs without it and the response says so in one line.
    const tagsGated = !pro && !!a.tags?.length;
    const hits = search(load().clauses, a.query, {
      category: a.category ? slugCategory(a.category) : undefined,
      tags: tagsGated ? undefined : a.tags,
      jurisdiction: a.jurisdiction,
    });
    return json({
      query: a.query, count: hits.length,
      jurisdiction: a.jurisdiction,
      free_tier_note: tagsGated
        ? `Free tier filters by query, category and jurisdiction; the tag filter (${a.tags!.join(", ")}) was not applied. ${gate.upgradeText("tag filters in search", "clause_search")}`
        : undefined,
      results: hits.slice(0, 25).map((h) => ({ score: h.score, ...summary(h.clause) })),
    });
  } catch (e) { return fail((e as Error).message); }
});

/* ------------------------------------------------------------ import/export */

server.registerTool("clause_import", {
  title: "Import clauses",
  description: "Call this tool to bulk-load clauses into the library from a markdown or JSON file. Returns how many clauses were added, replaced, skipped and blocked by the free clause cap, plus the new library total.",
  inputSchema: {
    path: z.string().describe("Path to a .md or .json file. Markdown form: '## Title', then optional 'category:' / 'tags:' / 'variables:' lines, a blank line, then the body. JSON form: an array of clauses. JSON import is a Pro feature; markdown import works in the free tier, within the free clause cap"),
    overwrite: z.boolean().optional().describe("Replace clauses whose title already exists instead of skipping them"),
  },
}, async (a) => {
  try {
    const file = expandPath(a.path);
    if (!existsSync(file)) return fail(`no such file: ${file}`);
    const isJson = file.toLowerCase().endsWith(".json");
    if (isJson && !gate.isPro()) {
      return ok("JSON import and export are Pro features. Markdown import works in the free tier. " + gate.upgradeText("JSON import and export", "clause_import"));
    }
    const raw = readFileSync(file, "utf8");
    const parsed = isJson ? parseClauseJson(raw) : parseMarkdown(raw);
    if (!parsed.length) return fail(`no clauses found in ${file}`);
    return await locked(() => {
      const db = load();
      const pro = gate.isPro();
      let added = 0, replaced = 0, skipped = 0, capped = 0;
      for (const p of parsed) {
        const existing = db.clauses.find((c) => c.title.trim().toLowerCase() === p.title.trim().toLowerCase());
        const now = new Date().toISOString();
        if (existing) {
          if (!a.overwrite) { skipped++; continue; }
          if (pro && existing.body !== p.body) existing.history.push({ at: existing.updated, title: existing.title, body: existing.body });
          existing.body = p.body; existing.category = slugCategory(p.category); existing.tags = p.tags;
          existing.variables = p.variables; existing.jurisdiction = p.jurisdiction; existing.language = p.language;
          existing.updated = now;
          replaced++;
          continue;
        }
        if (!pro && db.clauses.filter((c) => !c.starter).length >= FREE_OWN_CLAUSES) { capped++; continue; }
        db.clauses.push({
          id: makeId(p.title, new Set(db.clauses.map((x) => x.id))),
          title: p.title.trim(), body: p.body, category: slugCategory(p.category),
          tags: p.tags, variables: p.variables, jurisdiction: p.jurisdiction, language: p.language,
          starter: false, note: p.note, created: now, updated: now, history: [],
        });
        added++;
      }
      save(db);
      return json({
        file, format: isJson ? "json" : "markdown",
        added, replaced, skipped, blocked_by_free_cap: capped,
        total: db.clauses.length,
        note: capped ? `${capped} clauses were not imported: ` + gate.upgradeText("an unlimited clause library", "clause_import") : undefined,
      });
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("clause_export", {
  title: "Export clauses",
  description: "Call this tool to write the whole clause library out to one file. Returns the destination path, the format used and how many clauses were written.",
  inputSchema: {
    path: z.string().describe("Destination file path. The clauses are written in assembly order, categories first"),
    format: z.enum(["json", "markdown"]).describe("json (a Pro feature) or markdown (works in the free tier)"),
    overwrite: z.boolean().optional().describe("Replace the destination if a file is already there. Without it an existing file is never touched"),
  },
}, async (a) => {
  try {
    if (a.format === "json" && !gate.isPro()) {
      return ok("JSON export is a Pro feature. Markdown export works in the free tier. " + gate.upgradeText("JSON import and export", "clause_export"));
    }
    const db = load();
    const list = orderByCategory(db.clauses);
    const file = expandPath(a.path);
    mkdirSync(dirname(file), { recursive: true });
    if (a.overwrite !== true) {
      try { closeSync(openSync(file, "wx")); } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        return fail(`${file} already exists and nothing was written. Pass overwrite: true to replace it, or give a different path.`);
      }
    }
    writeFileSync(file, a.format === "json" ? toClauseJson(list) : toMarkdown(list));
    return ok(`Exported ${list.length} clauses to ${file} as ${a.format}.`);
  } catch (e) { return fail((e as Error).message); }
});

/* ----------------------------------------------------------------- assembly */

function selectClauses(all: Clause[], ids: string[] | undefined, categories: string[] | undefined): { picked?: Clause[]; error?: string } {
  if (ids?.length) {
    const picked: Clause[] = [];
    for (const ref of ids) {
      const c = findClause(all, ref);
      if (!c) return { error: `no clause matches "${ref}"` };
      if (!picked.some((p) => p.id === c.id)) picked.push(c);
    }
    return { picked };                       // the caller's order is the document order
  }
  if (categories?.length) {
    const want = categories.map(slugCategory);
    const picked = orderByCategory(all.filter((c) => want.includes(c.category)));
    if (!picked.length) return { error: `no clauses in ${want.join(", ")}` };
    return { picked };
  }
  return { error: "pass clause_ids or categories" };
}

function assembleNote(pro: boolean, unfilled: number, missing: { clause: string; refers_to: string }[] = []): string {
  const parts = [`The document opens with the not-legal-advice line: ${DISCLAIMER}`];
  if (unfilled) parts.push(`${unfilled} fact(s) had no value and are left in the document as bracketed prompts; fill them before sending.`);
  if (missing.length) {
    parts.push(
      `${missing.length} cross-reference(s) were DROPPED because the clause they point at is not in this document ` +
      `(${missing.map((m) => `${m.clause} -> ${m.refers_to}`).join(", ")}). The document cites nothing it does not contain. ` +
      `Add ${missing.map((m) => m.refers_to).join(", ")} to clause_ids and assemble again to keep the reference.`,
    );
  }
  if (!pro) parts.push(`The free tier assembles up to ${FREE_ASSEMBLE_CLAUSES} clauses per document.`);
  return parts.join(" ");
}

server.registerTool("contract_assemble", {
  title: "Assemble a contract",
  description: "Call this tool to build a contract or proposal document from library clauses. Returns the path written, the clauses used in document order, which variables were filled, and the facts still missing as bracketed prompts.",
  inputSchema: {
    title: z.string().describe("Document title, for example 'Service Agreement - Beta Corp'"),
    clause_ids: z.array(z.string()).optional().describe("Clause ids in the order they should appear; this is the document order. Free tier: up to 8 clauses per document"),
    categories: z.array(z.string()).optional().describe("Instead of ids: every clause in these categories, ordered by category. Free tier: up to 8 clauses per document"),
    values: z.record(z.string()).optional().describe("Values for the {{variables}} in the chosen clauses, for example {\"fee\":\"4500\",\"late_fee_percent\":\"2\"}. Any variable you leave out stays in the document as a bracketed prompt such as [late fee percent], never as an invented value"),
    client: z.string().optional().describe("Client name; also fills the {{client}} variable"),
    out_path: z.string().optional().describe("Where to write the file. Default: the server data directory, under a name built from the client and the title"),
    format: z.enum(["docx", "markdown"]).optional().describe("docx (default) or markdown; the document opens with the not-legal-advice line either way"),
    overwrite: z.boolean().optional().describe("Replace out_path if a file is already there. Without it an existing file is never touched"),
  },
}, async (a) => {
  try {
    const db = load();
    const { picked, error } = selectClauses(db.clauses, a.clause_ids, a.categories);
    if (error || !picked) return fail(error ?? "no clauses selected");
    const pro = gate.isPro();
    if (!pro && picked.length > FREE_ASSEMBLE_CLAUSES) {
      return ok(`The free tier assembles up to ${FREE_ASSEMBLE_CLAUSES} clauses per document and this selection has ${picked.length}. ` +
        gate.upgradeText("unlimited clauses per document", "contract_assemble"));
    }
    const format = a.format ?? "docx";
    const result = assemble({ title: a.title, clauses: picked, values: a.values ?? {}, client: a.client });
    const stem = (a.client ? `${a.client}-` : "") + a.title;
    const name = stem.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "contract";
    if (format === "markdown") {
      const file = outputPath(a.out_path, `${name}.md`, ".md", a.overwrite === true);
      writeFileSync(file, result.markdown);
      return json({
        path: file, format, clauses: picked.map((c) => c.id),
        filled: result.filled, unfilled: result.unfilled,
        unfilled_prompts: result.unfilled.map(promptFor),
        resolved_references: result.resolved_references,
        missing_references: result.missing_references,
        disclaimer: DISCLAIMER,
        note: assembleNote(pro, result.unfilled.length, result.missing_references),
      });
    }
    const file = outputPath(a.out_path, `${name}.docx`, ".docx", a.overwrite === true);
    const buf = await buildDocx({
      title: clean(a.title),
      blocks: cleanBlocks(result.blocks),
      style: "plain",
      // D-R31/D-R40: the letterhead is the AUTHOR of the contract, not its recipient, and
      // its name and email come from the shared business profile or from nowhere.
      business: contractLetterhead(),
      pro,
    });
    writeFileSync(file, buf);
    return json({
      path: file, format, clauses: picked.map((c) => c.id),
      filled: result.filled, unfilled: result.unfilled,
      unfilled_prompts: result.unfilled.map(promptFor),
      resolved_references: result.resolved_references,
      missing_references: result.missing_references,
      disclaimer: DISCLAIMER,
      note: assembleNote(pro, result.unfilled.length, result.missing_references) + letterheadNote(),
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("variables_list", {
  title: "List the variables a selection needs",
  description: "Given a set of clauses, list every {{variable}} they use and which clause uses it, so nothing is missed before assembling.",
  inputSchema: { clause_ids: z.array(z.string()).min(1).describe("Clause ids or titles") },
}, async (a) => {
  try {
    const db = load();
    const { picked, error } = selectClauses(db.clauses, a.clause_ids, undefined);
    if (error || !picked) return fail(error ?? "no clauses selected");
    return json({
      clauses: picked.map((c) => c.id),
      variables: variablesFor(picked),
      detail: variableReport(picked, {}).map((r) => ({ variable: r.variable, used_by: r.clauses })),
    });
  } catch (e) { return fail((e as Error).message); }
});

/* --------------------------------------------------------- resource, prompt */

server.registerResource("categories", "clauses://categories", {
  title: "Clause categories",
  description: "Every category in the library with its clause count, in assembly order.",
  mimeType: "application/json",
}, async (uri) => {
  const db = load();
  const counts = new Map<string, number>();
  for (const c of db.clauses) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  const rows = [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.category.localeCompare(b.category));
  return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ total: db.clauses.length, categories: rows }, null, 2) }] };
});

server.registerPrompt("draft_contract", {
  title: "Draft a contract from the library",
  description: "Pick the clauses that fit an engagement, assemble them, and report the facts still missing.",
  argsSchema: {
    intent: z.string().describe("What the contract is for, for example 'website redesign for a startup, fixed fee, 3 milestones'"),
    client: z.string().optional(),
  },
}, ({ intent, client }) => ({
  messages: [{
    role: "user",
    content: {
      type: "text",
      text: [
        `Draft a contract for this engagement: ${intent}`,
        client ? `The client is ${client}.` : "",
        "",
        "Work in this order:",
        "1. Call clause_search once per theme in the engagement (scope, payment, IP, confidentiality, termination, liability, and anything the intent names specifically) and read clauses://categories to see what the library holds.",
        "2. Choose the clauses that fit. Prefer library clauses over writing new text; only call clause_add if a needed clause genuinely does not exist.",
        "3. Call variables_list with the chosen clause ids to see every fact the document needs.",
        "4. Ask the user only for the values you cannot infer from the conversation. Do not invent a fee, a jurisdiction, a percentage or a date.",
        "5. Call contract_assemble with the chosen clause ids in a sensible order and the values you have. Anything still missing comes out as a bracketed prompt like [fee] -- list those back to the user as open items.",
        "",
        `Say plainly in your answer that this is a ${STARTER_NOTE} and that a qualified lawyer should review it before signing.`,
      ].filter(Boolean).join("\n"),
    },
  }],
}));

gate.registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`mcp-clauses ${VERSION} ready (${gate.isPro() ? "pro" : "free"})\n`);
