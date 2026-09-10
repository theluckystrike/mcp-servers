#!/usr/bin/env node
/**
 * mcp-checklist: reusable checklists, and the dated runs of them that somebody signs.
 *
 * The central rule is in src/checklist.ts: a run COPIES its template's items when it starts.
 * Editing a checklist afterwards never rewrites a run already in progress, because a list
 * somebody ticked and signed has to be the list they actually saw.
 */
import { closeSync, existsSync, mkdirSync, openSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, readSharedProfile, withFileLock } from "@theluckystrike/mcp-license";
import { isIsoDate, today } from "@theluckystrike/mcp-quotes/lib";
import { z } from "zod";
import { VERSION } from "./version.js";
import {
  CLOSED_RUN_STATUSES, ITEM_STATES, MAX_ITEMS, MAX_ROWS, MAX_TEMPLATES, OPEN_RUN_STATUSES,
  RUN_STATUSES, RUN_TRANSITIONS,
  bySection, isOpenRun, normaliseSection, normaliseText, progress, runReport, runTransitionError,
  signable, slugCategory, templateText,
  type ItemState, type Run, type RunItem, type RunStatus, type Template, type TemplateItem,
} from "./checklist.js";
import {
  dataDir, getRuns, getTemplates, lockPath, nextId, nextItemId, resolveRun, resolveTemplate,
  setRuns, setTemplates,
} from "./store.js";

/**
 * Free tier: THREE checklists, and unlimited runs of them.
 *
 * What is metered is how many DIFFERENT checklists you keep, not how many jobs you check.
 * A trade with one pre-delivery check, one handover sheet and one snag list runs its whole
 * year inside the free tier; a firm that wants twenty different ones is a firm that gets
 * value from twenty. Runs are never capped, because capping the running of a checklist would
 * cap the only thing the checklist is for, and every read, every progress figure and the
 * report TEXT are free on every tier.
 *
 * What Pro adds is more checklists, and writing a report to a FILE with out_path.
 */
const FREE_TEMPLATES = 3;
const MAX_NAME = 200;
const MAX_TEXT = 2000;

const gate = createLicenseGate({ product: "checklist" });

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true as const });
const json = (v: unknown) => ok(JSON.stringify(v, null, 2));

const str = (field: string, max: number) => z.string().max(max, `${field} must be ${max} characters or fewer`);

/** Only this server's own store is written, so there is one lock and it is this one. */
function locked<T>(fn: () => T | Promise<T>): Promise<T> {
  return withFileLock(lockPath(), fn, { timeoutMs: 20000 });
}

function checkDate(value: string, field: string): string {
  if (!isIsoDate(value)) throw new Error(`cannot read a date: ${field} "${value}" is not a real date in YYYY-MM-DD form. Nothing was written.`);
  return value;
}

function requirePro(feature: string, toolName: string): void {
  if (!gate.isPro()) throw new Error(`${feature} is Pro. Nothing was written. ${gate.upgradeText(feature, toolName)}`);
}

/* ------------------------------------------------------------------- paths */

/** A leading `<scheme>://` means the caller has a URL, not a local path. Checked BEFORE any
 * resolution, so a URL is never joined against the server's cwd and the refusal never has a
 * path in it, let alone one that leaks the cwd. */
const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

function expandPath(p: string): string {
  if (URL_SCHEME_RE.test(p)) {
    throw new Error(`"${p}" is a URL, not a file path; out_path writes a local file. Omit out_path to get the report back as text.`);
  }
  const s = p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
  return isAbsolute(s) ? s : resolvePath(process.cwd(), s);
}

/**
 * Create a directory and any missing ancestors, without mkdirSync's recursive mode.
 *
 * mkdirSync(recursive) never returns on a pseudo-filesystem: measured on Linux in a
 * node:22-alpine container, mkdir("/proc/nope") answers ENOENT in 0 ms, Node reads that as a
 * missing parent and retries forever, and the call had not returned after 25 seconds. Any
 * caller-supplied output path under /proc, /sys or /dev hung the server permanently. The
 * ancestors are walked here under a hard bound and each level is created non-recursively, so
 * a repeated ENOENT terminates on the first one. Verified on Linux: /proc throws ENOENT and
 * /sys throws EROFS, both in 0 ms, while a normal nested path still succeeds.
 */
function ensureDirBounded(dir: string): void {
  if (existsSync(dir)) return;
  const missing: string[] = [];
  let cur = dir;
  for (let i = 0; i < 64 && !existsSync(cur); i++) {
    missing.push(cur);
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  if (!existsSync(cur)) throw new Error(`cannot create ${dir}: no existing ancestor directory`);
  for (const d of missing.reverse()) mkdirSync(d);
}

/**
 * Reserve the output path with an exclusive create, never with an existence check: two
 * processes writing a derived path would both pass the check and the second would clobber the
 * first. A path this server derived itself gets -2, -3, ... instead; a path the CALLER gave
 * is refused rather than renamed, because silently writing beside the name a caller asked for
 * is how a signed report ends up in a directory nobody looks in.
 */
function outputPath(out: string | undefined, fallbackName: string, ext: string, overwrite: boolean): string {
  const p = expandPath(out ?? join(dataDir(), "documents", fallbackName));
  const withExt = p.toLowerCase().endsWith(ext) ? p : `${p}${ext}`;
  ensureDirBounded(dirname(withExt));
  if (out !== undefined) {
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

/** tmp + rename, so a reader never sees half a report. */
function writeAtomic(path: string, body: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, body);
  renameSync(tmp, path);
}

/* ---------------------------------------------------------- shared profile */

const PLACEHOLDER_ISSUER = "Your business";

/** The name at the top of a printed report. From the SHARED profile; no sibling store. */
function issuerName(): string {
  const p = readSharedProfile();
  const name = p.name?.trim() ? p.name : PLACEHOLDER_ISSUER;
  const addr = p.address?.trim();
  return addr ? `${name}\n${addr}` : name;
}
const businessMissing = (): boolean => !readSharedProfile().name?.trim();

const BASIS =
  "A run COPIES its checklist's items when it starts. Editing the checklist afterwards never changes a run already under way, because a list somebody ticked and signed has to be the list they actually saw. " +
  "No progress figure is stored: the counts, what is outstanding and whether a run can be signed off are derived on every call. " +
  "not_applicable counts as ANSWERED and never as passed; a step that was dismissed is a different fact from a step that passed.";

/* ------------------------------------------------------------------ shaping */

function templateSummary(t: Template) {
  return {
    id: t.id, name: t.name, category: t.category, version: t.version,
    items: t.items.length, required: t.items.filter((i) => i.required).length,
    sections: bySection(t.items).map((g) => g.section).filter((s) => s !== null).length,
    updated: t.updated,
  };
}

function templateDetail(t: Template) {
  return {
    ...templateSummary(t),
    description: t.description ?? null,
    sections_detail: bySection(t.items),
    runs: getRuns().filter((r) => r.template === t.id).length,
    created: t.created,
  };
}

function runSummary(r: Run) {
  const p = progress(r);
  return {
    id: r.id, status: r.status, open: isOpenRun(r),
    checklist: r.template, checklist_name: r.template_name, checklist_version: r.template_version,
    title: r.title, reference: r.reference ?? null, date: r.date,
    items: p.items, pass: p.pass, fail: p.fail, na: p.na, pending: p.pending,
    percent_answered: p.percent_answered,
    signed_by: r.signed_by ?? null, signed_date: r.signed_date ?? null,
  };
}

function runDetail(r: Run) {
  const s = signable(r);
  return {
    ...runSummary(r),
    progress: progress(r),
    sections_detail: bySection(r.items),
    ready_to_sign_off: s.ready, not_ready_because: s.reasons,
    ...(r.status === "signed_off" && s.reasons.length ? { signed_with_exceptions: s.reasons } : {}),
    signed_note: r.signed_note ?? null,
    note: r.note ?? null,
    history: r.history,
    created: r.created, updated: r.updated,
  };
}

function mutableRun(r: Run): void {
  if (!isOpenRun(r)) throw new Error(`${r.id} is ${r.status} and cannot be edited. A signature is the point at which a run stops moving; start a fresh run instead. Nothing was written.`);
}

/* ------------------------------------------------------------------- server */

const server = new McpServer(
  { name: "mcp-checklist", version: VERSION },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

const checklistArg = str("checklist", MAX_NAME).describe("The checklist id, e.g. CL-0001, or its name when only one carries it");
const runArg = str("run", MAX_NAME).describe("The run id, e.g. RUN-2026-0001, or its title when only one carries it");

server.registerTool("checklist_create", {
  title: "Create a checklist",
  description: "Create a reusable checklist and return its CL-NNNN id: a name, a category and an optional description. Add the steps with checklist_item_add. Free tier: 3 checklists, and unlimited runs of them.",
  inputSchema: {
    name: str("name", MAX_NAME).describe("What the checklist is, e.g. Pre-delivery vehicle check or Site handover"),
    category: str("category", 60).optional().describe("A grouping key, lower-cased and hyphenated, e.g. handover or safety. Default general"),
    description: str("description", MAX_TEXT).optional().describe("What this checklist is for and when to run it, printed at the top of a blank copy"),
  },
}, async (a) => {
  try {
    const name = normaliseText(a.name);
    if (!name) throw new Error("name is empty. A checklist nobody can name is a checklist nobody will find. Nothing was written.");
    const rec = await locked(() => {
      const list = getTemplates();
      if (list.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
        throw new Error(`a checklist named "${name}" already exists. Use it, or give this one a different name. Nothing was written.`);
      }
      if (!gate.isPro() && list.length >= FREE_TEMPLATES) {
        throw new Error(`the free tier holds ${FREE_TEMPLATES} checklists and you have ${list.length}. Runs are never capped. ${gate.upgradeText("More than 3 checklists", "checklist_create")}`);
      }
      if (list.length >= MAX_TEMPLATES) throw new Error(`${MAX_TEMPLATES} checklists is the maximum. Nothing was written.`);
      const now = new Date().toISOString();
      const t: Template = {
        id: nextId("CL", 4, list.map((x) => x.id)), name, category: slugCategory(a.category),
        ...(a.description ? { description: normaliseText(a.description) } : {}),
        items: [], version: 1, created: now, updated: now,
      };
      setTemplates([...list, t]);
      return t;
    });
    return json({ created: templateSummary(rec), next: "add the steps with checklist_item_add, then start a run with run_start", basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("checklist_item_add", {
  title: "Add a step to a checklist",
  description: "Add one step to a checklist and return its I01-style id: the text, an optional section heading, and whether it is required. A required step that is unanswered or failed blocks sign-off; an optional one does not.",
  inputSchema: {
    checklist: checklistArg,
    text: str("text", MAX_TEXT).describe("The step, as the person doing it will read it, e.g. Tyre pressures checked and recorded"),
    section: str("section", 60).optional().describe("A heading to group this step under, e.g. Exterior. Steps keep the order they were added within a section"),
    required: z.boolean().optional().describe("Whether sign-off is blocked while this step is unanswered or failed. Default true"),
    note: str("note", MAX_TEXT).optional().describe("Guidance printed under the step, e.g. the tolerance or the standard it is checked against"),
    position: z.number().int().min(1).max(MAX_ITEMS).optional().describe("Insert at this 1-based position instead of at the end. Existing steps keep their ids"),
  },
}, async (a) => {
  try {
    const text = normaliseText(a.text);
    if (!text) throw new Error("text is empty. Nothing was written.");
    const rec = await locked(() => {
      const list = getTemplates();
      const t = resolveTemplate(list, a.checklist);
      if (t.items.length >= MAX_ITEMS) throw new Error(`${t.id} already has ${MAX_ITEMS} steps, the maximum. Nothing was written.`);
      const item: TemplateItem = {
        id: nextItemId(t.items.map((i) => i.id)), text,
        section: normaliseSection(a.section), required: a.required ?? true,
        ...(a.note ? { note: normaliseText(a.note) } : {}),
      };
      if (a.position !== undefined && a.position <= t.items.length) t.items.splice(a.position - 1, 0, item);
      else t.items.push(item);
      t.version += 1;
      t.updated = new Date().toISOString();
      setTemplates(list);
      return { t, item };
    });
    return json({ checklist: templateSummary(rec.t), added: rec.item, note_on_versions: "runs already under way keep the steps they started with; this change applies to runs started from now on", basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("checklist_item_remove", {
  title: "Remove a step from a checklist",
  description: "Remove one step from a checklist by its I01-style id and bump the checklist version. Runs already under way keep the step they started with, so nothing anybody already ticked is rewritten.",
  inputSchema: {
    checklist: checklistArg,
    item: str("item", 16).describe("The step id, e.g. I03, as shown by checklist_show"),
  },
}, async (a) => {
  try {
    const rec = await locked(() => {
      const list = getTemplates();
      const t = resolveTemplate(list, a.checklist);
      const needle = normaliseText(a.item).toLowerCase();
      const i = t.items.findIndex((x) => x.id.toLowerCase() === needle);
      if (i < 0) throw new Error(`${t.id} has no step "${a.item}". Steps: ${t.items.map((x) => `${x.id} (${x.text})`).join(", ") || "none"}. Nothing was written.`);
      const [removed] = t.items.splice(i, 1);
      t.version += 1;
      t.updated = new Date().toISOString();
      setTemplates(list);
      return { t, removed };
    });
    return json({ checklist: templateSummary(rec.t), removed: rec.removed, basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("checklist_show", {
  title: "Show one checklist",
  description: "One checklist with its steps in order, grouped by section, plus how many are required and how many runs have been started from it. Pass as_text for a blank printable copy with a box against each step.",
  inputSchema: {
    checklist: checklistArg,
    as_text: z.boolean().optional().describe("Return a blank printable copy as plain text as well as the structured view. Default false"),
  },
}, async (a) => {
  try {
    const t = resolveTemplate(getTemplates(), a.checklist);
    return json({
      checklist: templateDetail(t),
      ...(a.as_text ? { blank_copy: templateText(t, issuerName()), business_profile_missing: businessMissing() } : {}),
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("checklist_list", {
  title: "List checklists",
  description: "Every checklist with its category, version, step count and how many runs came from it. Filter by category or by a word in the name. Returns at most 500 rows, newest change first.",
  inputSchema: {
    category: str("category", 60).optional().describe("Only checklists in this category, matched after the same lower-case hyphenation applied on create"),
    contains: str("contains", MAX_NAME).optional().describe("Only checklists whose name contains this text, matched case-insensitively"),
  },
}, async (a) => {
  try {
    let rows = getTemplates();
    if (a.category) { const cat = slugCategory(a.category); rows = rows.filter((t) => t.category === cat); }
    if (a.contains) { const n = normaliseText(a.contains).toLowerCase(); rows = rows.filter((t) => t.name.toLowerCase().includes(n)); }
    rows = [...rows].sort((x, y) => y.updated.localeCompare(x.updated));
    const total = rows.length;
    rows = rows.slice(0, MAX_ROWS);
    const runs = getRuns();
    return json({
      checklists: rows.map((t) => ({ ...templateSummary(t), runs: runs.filter((r) => r.template === t.id).length })),
      returned: rows.length, total,
      ...(total > rows.length ? { truncated: `showing ${MAX_ROWS} of ${total}; narrow with category or contains` } : {}),
      free_tier_checklist_limit: gate.isPro() ? null : FREE_TEMPLATES,
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("checklist_delete", {
  title: "Delete a checklist",
  description: "Delete a checklist and its steps for good. Runs already started from it are untouched and stay readable: a run carries its own copy of the steps, so deleting the checklist does not erase what anybody signed.",
  inputSchema: {
    checklist: checklistArg,
    confirm: z.literal(true).describe("Must be true. There is no undo and nothing is copied anywhere first"),
  },
}, async (a) => {
  try {
    const rec = await locked(() => {
      const list = getTemplates();
      const t = resolveTemplate(list, a.checklist);
      setTemplates(list.filter((x) => x.id !== t.id));
      return t;
    });
    return json({ deleted: rec.id, name: rec.name, steps: rec.items.length, runs_kept: getRuns().filter((r) => r.template === rec.id).length, checklists: getTemplates().length });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("run_start", {
  title: "Start a run of a checklist",
  description: "Start a dated run of a checklist and return its RUN-YYYY-NNNN id. The steps are COPIED into the run, so editing the checklist afterwards never changes a run already under way. Runs are free and never capped.",
  inputSchema: {
    checklist: checklistArg,
    title: str("title", MAX_NAME).describe("What this run is against, e.g. Van BX21 KLM, February service"),
    reference: str("reference", 64).optional().describe("The job, order or asset id this run belongs to, e.g. WO-2026-0044. Named only; no sibling store is opened"),
    date: str("date", 10).optional().describe("The day the run happened, YYYY-MM-DD. Default today"),
    note: str("note", MAX_TEXT).optional(),
  },
}, async (a) => {
  try {
    const date = a.date ? checkDate(a.date, "date") : today();
    const title = normaliseText(a.title);
    if (!title) throw new Error("title is empty. A run nobody can point at is a run nobody will find again. Nothing was written.");
    const rec = await locked(() => {
      const t = resolveTemplate(getTemplates(), a.checklist);
      if (!t.items.length) throw new Error(`${t.id} (${t.name}) has no steps yet. Add them with checklist_item_add before starting a run. Nothing was written.`);
      const runs = getRuns();
      const now = new Date().toISOString();
      const r: Run = {
        id: nextId(`RUN-${date.slice(0, 4)}`, 4, runs.map((x) => x.id)),
        template: t.id, template_name: t.name, template_version: t.version,
        title, ...(a.reference ? { reference: normaliseText(a.reference) } : {}),
        date, status: "open",
        items: t.items.map((i): RunItem => ({ id: i.id, text: i.text, section: i.section, required: i.required, state: "pending", ...(i.note ? { note: i.note } : {}) })),
        ...(a.note ? { note: normaliseText(a.note) } : {}),
        history: [{ status: "open", date }], created: now, updated: now,
      };
      setRuns([...runs, r]);
      return r;
    });
    return json({ started: runSummary(rec), steps: rec.items.map((i) => ({ id: i.id, section: i.section, text: i.text, required: i.required })), basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("run_check", {
  title: "Answer a step in a run",
  description: "Mark one step pass, fail or na, with who did it and when. na means the step did not apply; it counts as answered and never as passed. A step can be answered again while the run is open, and the last answer stands.",
  inputSchema: {
    run: runArg,
    item: str("item", 16).describe("The step id, e.g. I03, as shown by run_show"),
    state: z.enum(ITEM_STATES).describe("pass, fail, na for did not apply, or pending to put the step back to unanswered"),
    by: str("by", MAX_NAME).optional().describe("Who answered it. Printed against the step on the report"),
    at: str("at", 10).optional().describe("The day it was answered, YYYY-MM-DD. Default the run's own date"),
    note: str("note", MAX_TEXT).optional().describe("What was found. Say why on a fail: the report prints this under the step"),
  },
}, async (a) => {
  try {
    const rec = await locked(() => {
      const runs = getRuns();
      const r = resolveRun(runs, a.run);
      mutableRun(r);
      const needle = normaliseText(a.item).toLowerCase();
      const item = r.items.find((i) => i.id.toLowerCase() === needle);
      if (!item) throw new Error(`${r.id} has no step "${a.item}". Steps: ${r.items.map((i) => i.id).join(", ")}. Nothing was written.`);
      const at = a.at ? checkDate(a.at, "at") : r.date;
      item.state = a.state as ItemState;
      if (a.state === "pending") { delete item.by; delete item.at; }
      else {
        if (a.by) item.by = normaliseText(a.by);
        item.at = at;
      }
      if (a.note !== undefined) { const n = normaliseText(a.note); if (n) item.note = n; else delete item.note; }
      // `complete` is a reading, not a claim: it is recomputed here rather than set by hand.
      const p = progress(r);
      const nextStatus: RunStatus = p.pending === 0 ? "complete" : "open";
      if (r.status !== nextStatus) {
        r.status = nextStatus;
        r.history.push({ status: nextStatus, date: at });
      }
      r.updated = new Date().toISOString();
      setRuns(runs);
      return { r, item };
    });
    return json({ run: runSummary(rec.r), answered: rec.item, ready_to_sign_off: signable(rec.r).ready, not_ready_because: signable(rec.r).reasons, basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("run_show", {
  title: "Show one run",
  description: "The whole run: every step with its answer, who answered it and when, grouped by section, plus the pass, fail and outstanding counts, the failures in full, and whether it can be signed off and why not.",
  inputSchema: { run: runArg },
}, async (a) => {
  try {
    const r = resolveRun(getRuns(), a.run);
    return json({ ...runDetail(r), basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("run_list", {
  title: "List runs",
  description: "Runs newest first, with their checklist, progress and sign-off state. Filter by checklist, by status, by reference or to open runs only. Returns at most 500 rows.",
  inputSchema: {
    checklist: str("checklist", MAX_NAME).optional().describe("Only runs of this checklist, by id or name"),
    status: z.enum(RUN_STATUSES).optional().describe("Only runs in this status"),
    open_only: z.boolean().optional().describe("Only open and complete runs, the ones still editable. Default false"),
    reference: str("reference", 64).optional().describe("Only runs against this job, order or asset id, matched case-insensitively"),
    with_failures: z.boolean().optional().describe("Only runs that have at least one failed step. Default false"),
  },
}, async (a) => {
  try {
    let rows = getRuns();
    if (a.checklist) { const t = resolveTemplate(getTemplates(), a.checklist); rows = rows.filter((r) => r.template === t.id); }
    if (a.status) rows = rows.filter((r) => r.status === a.status);
    if (a.open_only) rows = rows.filter((r) => isOpenRun(r));
    if (a.reference) { const n = normaliseText(a.reference).toLowerCase(); rows = rows.filter((r) => (r.reference ?? "").toLowerCase().includes(n)); }
    if (a.with_failures) rows = rows.filter((r) => progress(r).fail > 0);
    rows = [...rows].sort((x, y) => y.date.localeCompare(x.date) || y.id.localeCompare(x.id));
    const total = rows.length;
    rows = rows.slice(0, MAX_ROWS);
    return json({
      runs: rows.map(runSummary), returned: rows.length, total,
      ...(total > rows.length ? { truncated: `showing the newest ${MAX_ROWS} of ${total}; narrow with checklist, status or reference` } : {}),
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("run_sign_off", {
  title: "Sign off a run",
  description: "Sign off a completed run with a name and a date, which freezes it. Refused while a required step is unanswered or failed, unless force is true, and either way the exceptions stay on the record and print on the report.",
  inputSchema: {
    run: runArg,
    by: str("by", MAX_NAME).describe("Who is signing it off, as it should read on the document"),
    date: str("date", 10).optional().describe("The day it was signed, YYYY-MM-DD. Default today"),
    note: str("note", MAX_TEXT).optional().describe("What the signature covers, or the exception being accepted"),
    force: z.boolean().optional().describe("Sign off even though required steps are unanswered or failed. Default false; the reasons come back either way"),
  },
}, async (a) => {
  try {
    const date = a.date ? checkDate(a.date, "date") : today();
    const by = normaliseText(a.by);
    if (!by) throw new Error("by is empty. An unsigned signature is not a signature. Nothing was written.");
    const rec = await locked(() => {
      const runs = getRuns();
      const r = resolveRun(runs, a.run);
      // A CLOSED run is refused on the status machine. An OPEN one is refused on the
      // reasons, not on the machine: "an open run cannot go straight to signed_off" is
      // true and useless, and the caller needs to know WHICH steps are outstanding. The two
      // cannot disagree, because signable() is only ready when nothing is pending, and a
      // run with nothing pending is already complete.
      if ((CLOSED_RUN_STATUSES as readonly string[]).includes(r.status)) {
        throw new Error(`${r.id}: ${runTransitionError(r.status, "signed_off")} Nothing was written.`);
      }
      const s = signable(r);
      if (!s.ready && !a.force) throw new Error(`${r.id} is not ready for sign-off: ${s.reasons.join("; ")}. Answer them, or pass force: true to sign with the exceptions on the record. Nothing was written.`);
      r.status = "signed_off";
      r.signed_by = by;
      r.signed_date = date;
      if (a.note) r.signed_note = normaliseText(a.note);
      r.history.push({ status: "signed_off", date, ...(a.note ? { note: normaliseText(a.note) } : {}) });
      r.updated = new Date().toISOString();
      setRuns(runs);
      return r;
    });
    return json({ run: runSummary(rec), signed_with_exceptions: signable(rec).reasons, history: rec.history, basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("run_status", {
  title: "Reopen or abandon a run",
  description: "Move a run back to open so a step can be answered again, or abandon it when the job did not happen. A signed-off run is refused: a signature is the point at which a run stops moving.",
  inputSchema: {
    run: runArg,
    status: z.enum(["open", "abandoned"]).describe("open puts a complete run back into edit; abandoned closes it without a signature"),
    date: str("date", 10).optional().describe("The day the step happened, YYYY-MM-DD. Default today"),
    note: str("note", MAX_TEXT).optional().describe("Why. Kept on the run's history and printed nowhere else"),
  },
}, async (a) => {
  try {
    const date = a.date ? checkDate(a.date, "date") : today();
    const rec = await locked(() => {
      const runs = getRuns();
      const r = resolveRun(runs, a.run);
      const err = runTransitionError(r.status, a.status as RunStatus);
      if (err) throw new Error(`${r.id}: ${err} Nothing was written.`);
      r.status = a.status as RunStatus;
      r.history.push({ status: r.status, date, ...(a.note ? { note: normaliseText(a.note) } : {}) });
      r.updated = new Date().toISOString();
      setRuns(runs);
      return r;
    });
    return json({ run: runSummary(rec), history: rec.history, basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("run_report", {
  title: "Produce the run report",
  description: "The run as plain text on every tier: every step with its mark, who answered it, the notes, the counts and a signature block or the recorded signature. Pro also writes it to out_path as a .txt file.",
  inputSchema: {
    run: runArg,
    out_path: str("out_path", 1000).optional().describe("Where to write the .txt file. Pro only. Omit to get the report back as text, which every tier can do"),
    overwrite: z.boolean().optional().describe("Replace out_path if a file is already there. Default false, and an existing file is refused with nothing written"),
  },
}, async (a) => {
  try {
    const r = resolveRun(getRuns(), a.run);
    const text = runReport(r, issuerName());
    if (a.out_path === undefined) {
      return json({
        run: r.id, report: text, written: false,
        business_profile_missing: businessMissing(),
        ...(gate.isPro() ? {} : { pro_note: `Pass out_path to write this to a .txt file. ${gate.upgradeText("Writing the run report to a file", "run_report")}` }),
        basis: BASIS,
      });
    }
    requirePro("Writing the run report to a file", "run_report");
    const path = outputPath(a.out_path, `${r.id}.txt`, ".txt", a.overwrite === true);
    writeAtomic(path, `${text}\n`);
    return json({ run: r.id, written: true, path, bytes: Buffer.byteLength(text) + 1, business_profile_missing: businessMissing(), basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("run_delete", {
  title: "Delete a run",
  description: "Delete a run for good, with every answer on it. A signed-off run is refused: it is the record of what somebody put their name to. Abandon a run you no longer want instead of deleting a signed one.",
  inputSchema: {
    run: runArg,
    confirm: z.literal(true).describe("Must be true. There is no undo and nothing is copied anywhere first"),
  },
}, async (a) => {
  try {
    const rec = await locked(() => {
      const runs = getRuns();
      const r = resolveRun(runs, a.run);
      if (r.status === "signed_off") throw new Error(`${r.id} was signed off by ${r.signed_by ?? "someone"} on ${r.signed_date ?? "an earlier date"} and cannot be deleted. It is the record of what they put their name to. Nothing was written.`);
      setRuns(runs.filter((x) => x.id !== r.id));
      return r;
    });
    return json({ deleted: rec.id, was: rec.status, checklist: rec.template_name, steps: rec.items.length, runs: getRuns().length });
  } catch (e) { return fail((e as Error).message); }
});

server.registerResource("contract", "checklist://contract", {
  title: "The snapshot rule, the run status machine, the free tier and where this server writes",
  description: "Why a run copies its checklist, the four item states and what na means, the run status machine, what blocks a sign-off, the free-tier limits and the one directory this server writes.",
  mimeType: "application/json",
}, async () => ({
  contents: [{
    uri: "checklist://contract", mimeType: "application/json",
    text: JSON.stringify({
      snapshot_rule: "a run copies its checklist's items when it starts, with the checklist version recorded; editing the checklist afterwards never changes a run already under way",
      item_states: ITEM_STATES,
      na_means: "the step did not apply. It counts as ANSWERED and never as passed",
      run_statuses: RUN_STATUSES,
      open_run_statuses: OPEN_RUN_STATUSES,
      closed_run_statuses: CLOSED_RUN_STATUSES,
      run_transitions: RUN_TRANSITIONS,
      complete_is_derived: "a run becomes complete when its last step is answered and goes back to open when a step is set back to pending; it is never set by hand",
      blocks_sign_off: ["a required step that is unanswered", "a required step that failed", "any unanswered optional step", "a run with no items"],
      force_sign_off: "allowed, and the exceptions stay on the record and print on the report",
      free_tier: {
        checklists: FREE_TEMPLATES,
        runs: "unlimited on every tier",
        free_tools: ["checklist_create", "checklist_item_add", "checklist_item_remove", "checklist_show", "checklist_list", "checklist_delete", "run_start", "run_check", "run_show", "run_list", "run_sign_off", "run_status", "run_delete"],
        pro_tools: ["run_report with out_path"],
        note: "the run report TEXT is free on every tier; only writing it to a file is Pro",
      },
      writes: [{ store: "checklist", dir: dataDir(), files: ["templates.json", "runs.json", "counter.json"] }],
      reads: [{ store: "profile", file: "business.json", why: "the business name and address at the top of a printed report", writes: false }],
      opens_sibling_stores: false,
      today: today(),
      version: VERSION,
    }, null, 2),
  }],
}));

server.registerPrompt("run_the_checklist", {
  title: "Run a checklist against a job and get it signed off",
  description: "Pick or build the checklist, start a dated run against a job, answer every step with who and when, and sign it off with the exceptions on the record.",
  argsSchema: { job: z.string().describe("What the run is against, e.g. Van BX21 KLM February service, or WO-2026-0044") },
}, ({ job }) => ({
  messages: [{
    role: "user" as const,
    content: {
      type: "text" as const,
      text: `Run a checklist against ${job} and get it signed off.\n\n` +
        `1. Call checklist_list. If a suitable checklist exists, use it. Only call checklist_create and checklist_item_add if none does; the free tier holds 3 checklists and runs of them are never capped, so reusing one is nearly always right.\n` +
        `2. Call run_start with that checklist and a title that names ${job}, plus reference if there is a job or order id. The steps are copied into the run at this point: editing the checklist afterwards will not change this run.\n` +
        `3. Call run_check once per step with pass, fail or na, the person's name in by, and a note on every fail saying what was found. na means the step did not apply; do not use it for a step that was simply not done, because na counts as answered.\n` +
        `4. Call run_show. It tells you what is outstanding and whether the run can be signed off.\n` +
        `5. Call run_sign_off with the name of whoever is signing. If it refuses, read the reasons back to the user and let them decide; only pass force after they say to, and tell them the exceptions will print on the report.\n` +
        `6. Call run_report for the document.`,
    },
  }],
}));

gate.registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`mcp-checklist ${VERSION} ready; store at ${dataDir()}\n`);
