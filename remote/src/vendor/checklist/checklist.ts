/**
 * The checklist engine: templates, runs, and the progress arithmetic.
 *
 * One rule decides the shape of everything here.
 *
 * A RUN SNAPSHOTS ITS TEMPLATE. When a run is started, the template's items are COPIED into
 * it, text and all, with the template's version number recorded beside them. If somebody
 * later edits the template, adds a step or deletes one, every run already in progress keeps
 * the list it started with. That is not a caching convenience: a checklist somebody ticked
 * and signed has to be the list they actually saw. A run that read its items live from the
 * template would mean a signed handover certificate for eleven checks when the person
 * signing it saw ten, and no field in the record would show that it had happened.
 *
 * The second rule follows from the first: NOTHING DERIVED IS STORED. Progress, the pass and
 * fail counts, what is outstanding and whether a run can be signed off are computed on every
 * call from the run's own items. A stored "complete" flag is a fact about the afternoon
 * somebody last looked.
 */

export const ITEM_STATES = ["pending", "pass", "fail", "na"] as const;
export type ItemState = (typeof ITEM_STATES)[number];

export const RUN_STATUSES = ["open", "complete", "signed_off", "abandoned"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** open and complete are live; signed_off and abandoned are closed and cannot be edited. */
export const OPEN_RUN_STATUSES: readonly RunStatus[] = ["open", "complete"];
export const CLOSED_RUN_STATUSES: readonly RunStatus[] = ["signed_off", "abandoned"];

/**
 * The only transitions that exist. A signed-off run is terminal: the point of a signature is
 * that what was signed cannot move afterwards. `complete` is a reading rather than a claim,
 * so a run can go back to `open` when an item is re-opened.
 */
export const RUN_TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  open: ["complete", "abandoned"],
  complete: ["signed_off", "open", "abandoned"],
  signed_off: [],
  abandoned: [],
};

export const MAX_ITEMS = 500;
export const MAX_TEMPLATES = 500;
export const MAX_ROWS = 500;
export const MAX_SECTION = 60;

export interface TemplateItem {
  id: string;               // I01, I02, ...
  text: string;
  section: string | null;
  required: boolean;
  note?: string;
}

export interface Template {
  id: string;               // CL-0001
  name: string;
  category: string;
  description?: string;
  items: TemplateItem[];
  version: number;          // bumped on every change to the items
  created: string;
  updated: string;
}

export interface RunItem {
  id: string;               // the template item's id, carried over
  text: string;             // COPIED at start; the template may change afterwards
  section: string | null;
  required: boolean;
  state: ItemState;
  by?: string;
  at?: string;
  note?: string;
}

export interface RunEvent { status: RunStatus; date: string; note?: string }

export interface Run {
  id: string;               // RUN-YYYY-NNNN
  template: string;         // the template id it came from
  template_name: string;    // the name AT THE TIME, so a renamed template does not rewrite history
  template_version: number; // the version the items were copied from
  title: string;
  reference?: string;       // the job, order or asset this run is against
  date: string;
  status: RunStatus;
  items: RunItem[];
  signed_by?: string;
  signed_date?: string;
  signed_note?: string;
  note?: string;
  history: RunEvent[];
  created: string;
  updated: string;
}

export function normaliseText(s: string): string { return String(s ?? "").trim().replace(/\s+/g, " "); }

/** A category is a grouping key, not prose: lower-cased, hyphenated, and capped. */
export function slugCategory(s: string | undefined): string {
  const v = normaliseText(s ?? "general").toLowerCase().replace(/\s+/g, "-") || "general";
  return v.length > MAX_SECTION ? v.slice(0, MAX_SECTION) : v;
}

/** A section is a heading within one checklist. Same discipline, but the case is kept. */
export function normaliseSection(s: string | undefined): string | null {
  const v = normaliseText(s ?? "");
  if (!v) return null;
  return v.length > MAX_SECTION ? v.slice(0, MAX_SECTION) : v;
}

export function isOpenRun(r: Run): boolean { return (OPEN_RUN_STATUSES as readonly string[]).includes(r.status); }

/** "an open run", "a complete run". Hand-written because a wrong article reads as a bug. */
const article = (s: string): string => (/^[aeiou]/.test(s) ? "an" : "a");

export function runTransitionError(from: RunStatus, to: RunStatus): string | null {
  if (from === to) return `the run is already ${to}.`;
  const allowed = RUN_TRANSITIONS[from];
  if (allowed.includes(to)) return null;
  if (!allowed.length) return `${article(from)} ${from} run cannot change status. A signature is the point at which a run stops moving.`;
  return `${article(from)} ${from} run cannot go straight to ${to}. From ${from} the next step is ${allowed.join(" or ")}.`;
}

export interface Progress {
  items: number;
  pending: number; pass: number; fail: number; na: number;
  required: number; required_pending: number; required_fail: number;
  answered: number;
  percent_answered: number;      // 0..100, one decimal
  outstanding: { id: string; text: string; section: string | null; required: boolean }[];
  failures: { id: string; text: string; section: string | null; by: string | null; at: string | null; note: string | null }[];
}

/**
 * A run's progress, derived every time.
 *
 * `na` counts as ANSWERED and never as passed. A step that did not apply was looked at and
 * dismissed, which is a different fact from a step that passed, and merging the two is how a
 * checklist reports 100 percent for a job where half the steps were skipped.
 */
export function progress(r: Run): Progress {
  const count = (s: ItemState) => r.items.filter((i) => i.state === s).length;
  const required = r.items.filter((i) => i.required);
  const answered = r.items.filter((i) => i.state !== "pending").length;
  return {
    items: r.items.length,
    pending: count("pending"), pass: count("pass"), fail: count("fail"), na: count("na"),
    required: required.length,
    required_pending: required.filter((i) => i.state === "pending").length,
    required_fail: required.filter((i) => i.state === "fail").length,
    answered,
    percent_answered: r.items.length ? Number(((answered / r.items.length) * 100).toFixed(1)) : 0,
    outstanding: r.items.filter((i) => i.state === "pending").map((i) => ({ id: i.id, text: i.text, section: i.section, required: i.required })),
    failures: r.items.filter((i) => i.state === "fail").map((i) => ({ id: i.id, text: i.text, section: i.section, by: i.by ?? null, at: i.at ?? null, note: i.note ?? null })),
  };
}

/**
 * Whether a run can be signed off, and why not.
 *
 * A failed REQUIRED item blocks a signature and an optional one does not, which is the whole
 * reason `required` exists on an item. Both are reported either way, so a signature taken
 * with `force` still carries the exceptions on the record rather than losing them.
 */
export function signable(r: Run): { ready: boolean; reasons: string[] } {
  const p = progress(r);
  const reasons: string[] = [];
  if (!r.items.length) reasons.push("the run has no items");
  if (p.required_pending) reasons.push(`${p.required_pending} required item(s) not answered: ${p.outstanding.filter((o) => o.required).slice(0, 5).map((o) => `${o.id} ${o.text}`).join("; ")}`);
  if (p.required_fail) reasons.push(`${p.required_fail} required item(s) failed: ${p.failures.slice(0, 5).map((f) => `${f.id} ${f.text}`).join("; ")}`);
  if (p.pending && !p.required_pending) reasons.push(`${p.pending} optional item(s) not answered`);
  return { ready: reasons.length === 0, reasons };
}

/** The sections in template order, each with the items under it. Ungrouped items come last. */
export function bySection<T extends { section: string | null }>(items: T[]): { section: string | null; items: T[] }[] {
  const out: { section: string | null; items: T[] }[] = [];
  for (const i of items) {
    const last = out.find((g) => g.section === i.section);
    if (last) last.items.push(i);
    else out.push({ section: i.section, items: [i] });
  }
  return out.sort((a, b) => (a.section === null ? 1 : 0) - (b.section === null ? 1 : 0));
}

const MARK: Record<ItemState, string> = { pending: "[ ]", pass: "[x]", fail: "[!]", na: "[-]" };

/**
 * The run as a plain-text report, which is the thing that gets pasted into an email or
 * signed. The exceptions are printed in the body and not only returned as a field, because
 * a caveat that lives only in the JSON does not travel with the document.
 */
export function runReport(r: Run, issuer: string): string {
  const p = progress(r);
  const sign = signable(r);
  const L: string[] = [];
  L.push(issuer);
  L.push("");
  L.push(`CHECKLIST  ${r.id}`);
  L.push(`Checklist   : ${r.template_name} (v${r.template_version})`);
  L.push(`Title       : ${r.title}`);
  if (r.reference) L.push(`Against     : ${r.reference}`);
  L.push(`Date        : ${r.date}`);
  L.push(`Status      : ${r.status}`);
  L.push("");
  for (const g of bySection(r.items)) {
    if (g.section) { L.push(g.section); }
    for (const i of g.items) {
      const who = i.by ? `  ${i.by}${i.at ? ` ${i.at}` : ""}` : "";
      L.push(`  ${MARK[i.state]} ${i.id} ${i.text}${i.required ? "" : "  (optional)"}${who}`);
      if (i.note) L.push(`        note: ${i.note}`);
    }
    L.push("");
  }
  L.push(`Items ${p.items}   passed ${p.pass}   failed ${p.fail}   not applicable ${p.na}   outstanding ${p.pending}`);
  L.push(`Answered ${p.percent_answered} percent. Not applicable counts as answered and never as passed.`);
  if (!sign.ready) {
    L.push("");
    L.push("Not ready for sign-off:");
    for (const why of sign.reasons) L.push(`  - ${why}`);
  }
  if (r.status === "signed_off") {
    L.push("");
    L.push(`Signed off by ${r.signed_by ?? "(unnamed)"} on ${r.signed_date ?? "(no date)"}`);
    if (r.signed_note) L.push(`  ${r.signed_note}`);
    const exceptions = signable(r).reasons;
    if (exceptions.length) {
      L.push("  Signed with exceptions:");
      for (const why of exceptions) L.push(`    - ${why}`);
    }
  } else {
    L.push("");
    L.push("Signed off by ......................................  date ..............");
  }
  if (r.note) { L.push(""); L.push(r.note); }
  return L.join("\n");
}

/** The template as plain text, for printing a blank one. */
export function templateText(t: Template, issuer: string): string {
  const L: string[] = [issuer, "", `CHECKLIST  ${t.name}  (${t.category}, v${t.version})`];
  if (t.description) { L.push(""); L.push(t.description); }
  L.push("");
  for (const g of bySection(t.items)) {
    if (g.section) L.push(g.section);
    for (const i of g.items) L.push(`  [ ] ${i.id} ${i.text}${i.required ? "" : "  (optional)"}${i.note ? `  -- ${i.note}` : ""}`);
    L.push("");
  }
  L.push(`${t.items.length} item(s), ${t.items.filter((i) => i.required).length} required.`);
  return L.join("\n");
}
