/**
 * Pure board logic: ids, slugs, project resolution, column handling, overdue and
 * estimate arithmetic. Kept out of index.ts so test/board.test.mjs can import it
 * without booting a stdio server (the same split time-tracker uses for day.ts).
 */

export const DEFAULT_COLUMNS = ["backlog", "todo", "doing", "review", "done"];

/**
 * D-K1/D-K3/D-K8. Every free-text field and every number a caller can set is bounded, so a
 * 1 MB title or a 1e9 estimate cannot reach the store, the table renderer or the model's
 * context. The caps are generous for real use and small enough that the worst case is a
 * readable error rather than a 430 KB tool result.
 */
export const MAX_TITLE = 300;
export const MAX_NOTES = 5000;
export const MAX_PROJECT = 100;
export const MAX_ID = 64;
export const MAX_COLUMN_NAME = 40;
export const MAX_COLUMNS = 12;
export const MAX_TAGS = 30;
export const MAX_TAG = 60;
export const MAX_QUERY = 200;
/** 100,000 minutes is about 69 days: past that a number is a typo, not an estimate. */
export const MAX_MINUTES = 100_000;
/** D-K9: rows returned by one listing tool before it truncates and says so. */
export const DEFAULT_ROW_LIMIT = 200;
export const MAX_ROW_LIMIT = 2000;

export type Priority = "low" | "normal" | "high" | "urgent";
export const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];

export interface TimerLink { at: string; project: string; task: string }

export interface Task {
  id: string;
  project: string;
  title: string;
  notes?: string;
  tags: string[];
  due?: string;                 // YYYY-MM-DD, local calendar day
  estimate_minutes?: number;
  actual_minutes?: number;
  priority: Priority;
  column: string;
  created: string;
  updated: string;
  done_at?: string;             // ISO instant, set when the task lands in the done column
  timer_links?: TimerLink[];
}

export interface Board {
  name: string;
  slug: string;
  columns: string[];
  counter: number;              // monotonic per board; ids are base36 of it
}

export interface DB {
  version: 1;
  boards: Record<string, Board>;   // key: project name lowercased
  tasks: Task[];
}

export const EMPTY_DB: DB = { version: 1, boards: {}, tasks: [] };

/** "Nova Site" -> "NOVA". Letters and digits only, at most 4, never empty. */
export function slugFor(project: string, taken: Iterable<string> = []): string {
  const words = String(project).toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  let base = "";
  if (words.length >= 2) base = words.map(w => w[0]).join("").slice(0, 4);
  if (base.length < 2) base = (words[0] ?? "").slice(0, 4);
  if (!base) base = "TASK";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) {
    const cand = `${base}${i}`;
    if (!used.has(cand)) return cand;
  }
}

/** Base36 of the board counter: NOVA-1, NOVA-A, NOVA-12. Stable once handed out. */
export function makeId(slug: string, counter: number): string {
  return `${slug}-${counter.toString(36).toUpperCase()}`;
}

export function normColumn(s: string): string { return String(s).trim().toLowerCase(); }

/** The column a finished task belongs in: "done" if the board has it, else the last column. */
export function doneColumn(columns: string[]): string {
  return columns.includes("done") ? "done" : columns[columns.length - 1];
}

export function isDone(t: Task, columns: string[]): boolean {
  return t.column === doneColumn(columns) || typeof t.done_at === "string";
}

/* ------------------------------------------------------- project matching */

export type Resolved =
  | { kind: "use"; project: string; note?: string }
  | { kind: "ambiguous"; candidates: string[] };

/**
 * Same rule as time-tracker (D-7): exact case-insensitive match wins; otherwise a
 * prefix or containment match is used only when exactly one existing project matches,
 * so "nova" lands on "Nova Site" instead of quietly creating a second board.
 */
export function resolveProject(known: string[], input: string): Resolved {
  const given = String(input).trim();
  const q = given.toLowerCase();
  const exact = known.find(p => p.toLowerCase() === q);
  if (exact) return { kind: "use", project: exact, note: exact === given ? undefined : `Matched the existing project "${exact}".` };
  if (!q) return { kind: "use", project: given };
  const near = known.filter(p => {
    const k = p.toLowerCase();
    // D-K2: an empty (or whitespace-only) stored name is a prefix of EVERY input, so one
    // blank board would silently swallow every later project. Never match on it.
    if (!k) return false;
    return k.startsWith(q) || q.startsWith(k) || k.includes(q) || q.includes(k);
  });
  if (near.length === 1) return { kind: "use", project: near[0], note: `Used the existing project "${near[0]}" (you said "${given}").` };
  if (near.length > 1) return { kind: "ambiguous", candidates: near.sort() };
  return { kind: "use", project: given };
}

export function ambiguousText(given: string, candidates: string[]): string {
  return `"${given}" matches ${candidates.length} existing projects: ${candidates.map(c => `"${c}"`).join(", ")}. ` +
    `Nothing was written or reported. Repeat the request with the exact project name you mean.`;
}

/* --------------------------------------------------------------- overdue */

/**
 * A task is overdue when its due DAY is strictly before the local day it is measured
 * against. Comparing instants instead of day keys made a task due today read as overdue
 * from 00:00 local; both sides are day keys here, so the boundary is midnight exactly.
 */
export function isOverdue(t: Task, todayKey: string, columns: string[]): boolean {
  if (!t.due || isDone(t, columns)) return false;
  return t.due < todayKey;
}

export function isDueOn(t: Task, dayKeyStr: string, columns: string[]): boolean {
  return !!t.due && !isDone(t, columns) && t.due === dayKeyStr;
}

/** Minutes summed over a task list; tasks with no estimate contribute nothing. */
export function totalEstimate(tasks: Task[]): number {
  return tasks.reduce((s, t) => s + (typeof t.estimate_minutes === "number" ? t.estimate_minutes : 0), 0);
}
export function totalActual(tasks: Task[]): number {
  return tasks.reduce((s, t) => s + (typeof t.actual_minutes === "number" ? t.actual_minutes : 0), 0);
}

/** "90m" -> "1h 30m"; 0 -> "-". */
export function hm(minutes: number): string {
  if (!minutes) return "-";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => (r[i] ?? "").length)));
  const line = (cells: string[]) => cells.map((c, i) => (c ?? "").padEnd(widths[i])).join("  ").trimEnd();
  return [line(headers), line(widths.map(w => "-".repeat(w))), ...rows.map(line)].join("\n");
}
