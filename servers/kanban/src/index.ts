#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createLicenseGate, withFileLock } from "@theluckystrike/mcp-license";
import { dayKey, localToday } from "./day.js";
import { readJsonFile } from "./jsonstore.js";
import {
  DEFAULT_COLUMNS, PRIORITIES, EMPTY_DB, ambiguousText, doneColumn, hm, isDone, isDueOn, isOverdue,
  makeId, normColumn, resolveProject, slugFor, table, totalActual, totalEstimate,
  DEFAULT_ROW_LIMIT, MAX_COLUMNS, MAX_COLUMN_NAME, MAX_ID, MAX_MINUTES, MAX_NOTES, MAX_PROJECT,
  MAX_QUERY, MAX_ROW_LIMIT, MAX_TAG, MAX_TAGS, MAX_TITLE,
  type Board, type DB, type Priority, type Task,
} from "./board.js";
import { VERSION } from "./version.js";

const PRODUCT = "kanban";
const FREE_PROJECTS = 3;
const FREE_OPEN_TASKS = 200;

const gate = createLicenseGate({ product: PRODUCT });

/* ---------------------------------------------------------------- storage */

function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(base, "mcp-servers", PRODUCT);
}
function dbPath(): string { return join(dataDir(), "data.json"); }
const LOCK = join(dataDir(), ".lock");

/** Only a missing file is an empty board. A corrupt one throws (see jsonstore.ts). */
function load(): DB {
  const raw = readJsonFile<Partial<DB>>(dbPath(), { ...EMPTY_DB });
  const boards: Record<string, Board> = {};
  if (raw.boards && typeof raw.boards === "object") {
    for (const [k, v] of Object.entries(raw.boards as Record<string, unknown>)) {
      const b = v as Partial<Board>;
      if (!b || typeof b !== "object" || typeof b.name !== "string") continue;   // a row of the wrong shape is ignored, not fatal
      boards[k] = {
        name: b.name,
        slug: typeof b.slug === "string" && b.slug ? b.slug : slugFor(b.name),
        columns: Array.isArray(b.columns) && b.columns.length ? b.columns.map(String) : [...DEFAULT_COLUMNS],
        counter: Number.isSafeInteger(b.counter) ? (b.counter as number) : 0,
      };
    }
  }
  const tasks = Array.isArray(raw.tasks)
    ? (raw.tasks as Task[]).filter(t => t && typeof t === "object" && typeof t.id === "string" && typeof t.project === "string")
    : [];
  return { version: 1, boards, tasks };
}

function save(db: DB): void {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const p = dbPath();
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, p);
}

/* ------------------------------------------------------------- primitives */

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const err = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true });
const gated = (feature: string, toolName?: string) => ok(gate.upgradeText(feature, toolName));

/**
 * D-K1. Bounded free text at the schema, the way expense-tracker does it, so an oversized
 * string is refused by name before it is written, rendered or handed to a model.
 */
const text = (max: number, min = 0) =>
  z.string().max(max, { message: `must be ${max} characters or fewer` }).refine(
    v => v.trim().length >= min,
    { message: min > 0 ? `must not be blank` : `` },
  );

/** D-K3. Minutes a caller may set: whole, in range, and never a silent 16,666-hour estimate. */
const minutes = (opts: { negative?: boolean } = {}) =>
  z.number().int()
    .min(opts.negative ? -MAX_MINUTES : 0, { message: `must be at least ${opts.negative ? -MAX_MINUTES : 0}` })
    .max(MAX_MINUTES, { message: `must be ${MAX_MINUTES} minutes (about 69 days) or fewer` });

/** D-K9. How many rows a listing tool prints before it truncates and says so. */
const limitArg = z.number().int().min(1).max(MAX_ROW_LIMIT).optional();

function capRows<T>(rows: T[], limit: number | undefined): { shown: T[]; note: string } {
  const n = limit ?? DEFAULT_ROW_LIMIT;
  if (rows.length <= n) return { shown: rows, note: "" };
  return {
    shown: rows.slice(0, n),
    note: `\nShowing the first ${n} of ${rows.length}. Narrow it with project/column/tag/due_before, or raise limit (max ${MAX_ROW_LIMIT}).`,
  };
}

function guard<A>(fn: (a: A) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>) {
  return async (a: A) => {
    try { return await fn(a); }
    catch (e) { return err(e instanceof Error ? e.message : String(e)); }
  };
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A due date is a local calendar DAY, never an instant: "2026-09-10" stays that day in
 * the profile's home zone, and a full timestamp is reduced to the day it falls on there.
 * "today", "tomorrow" and "+3d" are accepted because that is how the user says it.
 */
function parseDay(input: string, what = "due"): string {
  const s = String(input).trim().toLowerCase();
  if (!s) throw new Error(`${what} is empty`);
  const shift = (n: number) => {
    const [y, m, d] = localToday().split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  };
  if (s === "today") return shift(0);
  if (s === "tomorrow") return shift(1);
  if (s === "yesterday") return shift(-1);
  const rel = /^\+(\d+)\s*d(ays?)?$/.exec(s);
  if (rel) return shift(Number(rel[1]));
  /**
   * D-K6. "Friday" and "next Monday" are how a user states a due date out loud, and the
   * round-2 prompts use both. A bare weekday is the nearest one on or after today; "next"
   * (or "coming"/"this coming") is the nearest one strictly after today.
   */
  const wd = /^(next|this|this\s+coming|coming|on)?\s*(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day|sday|nesday|rsday|urday)?$/.exec(s);
  if (wd) {
    const NAMES: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
    const want = NAMES[wd[2]];
    const [y, m, d] = localToday().split("-").map(Number);
    const todayDow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const strict = wd[1] === "next" || wd[1] === "coming" || wd[1] === "this coming";
    let delta = (want - todayDow + 7) % 7;
    if (strict && delta === 0) delta = 7;
    return shift(delta);
  }
  if (DATE_ONLY.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (Number.isNaN(probe.getTime()) || probe.toISOString().slice(0, 10) !== s) throw new Error(`${what} is not a valid date: ${input}`);
    return s;
  }
  const asDate = new Date(String(input).trim());
  if (Number.isNaN(asDate.getTime())) throw new Error(`${what} is not a valid date: ${input}. Use YYYY-MM-DD, "today" or "+3d".`);
  return dayKey(asDate.toISOString());
}

function knownProjects(db: DB): string[] { return Object.values(db.boards).map(b => b.name); }

/**
 * D-K10. time-tracker resolves a project name by exact match FIRST, then by a unique
 * prefix/containment match (board.ts resolveProject, the same rule this server uses). So a
 * kanban board called "Nova" hands its timer to a time-tracker project called "Nova App"
 * and neither store says the two now disagree. Read the sibling store (same XDG data root,
 * read-only, best effort) and warn at the point of handoff, before the timer is started.
 */
function timeTrackerProjects(): string[] {
  try {
    const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
    const file = join(base, "mcp-servers", "time-tracker", "data.json");
    if (!existsSync(file)) return [];
    const raw = JSON.parse(readFileSync(file, "utf8")) as { entries?: { project?: unknown }[]; projects?: Record<string, unknown>; running?: { project?: unknown } };
    const names = new Set<string>();
    for (const e of raw.entries ?? []) if (typeof e?.project === "string" && e.project) names.add(e.project);
    for (const k of Object.keys(raw.projects ?? {})) if (k) names.add(k);
    if (typeof raw.running?.project === "string" && raw.running.project) names.add(raw.running.project);
    return [...names];
  } catch { return []; }        // a corrupt or unreadable sibling store is not this server's problem
}

type Filter = { kind: "ok"; project?: string } | { kind: "ambiguous"; text: string };
function resolveFilter(db: DB, project: string | undefined): Filter {
  if (!project) return { kind: "ok" };
  const r = resolveProject(knownProjects(db), project);
  if (r.kind === "ambiguous") return { kind: "ambiguous", text: ambiguousText(project, r.candidates) };
  return { kind: "ok", project: r.project };
}

function boardOf(db: DB, project: string): Board | undefined { return db.boards[project.toLowerCase()]; }

function columnsOf(db: DB, project: string): string[] {
  return boardOf(db, project)?.columns ?? [...DEFAULT_COLUMNS];
}

/** The one project to use when the caller named none: the only board, else the busiest. */
function defaultProject(db: DB): string | undefined {
  const names = knownProjects(db);
  if (names.length === 0) return undefined;
  if (names.length === 1) return names[0];
  const open = new Map<string, number>();
  for (const t of db.tasks) {
    if (isDone(t, columnsOf(db, t.project))) continue;
    open.set(t.project, (open.get(t.project) ?? 0) + 1);
  }
  return [...names].sort((a, b) => (open.get(b) ?? 0) - (open.get(a) ?? 0) || a.localeCompare(b))[0];
}

function openTaskCount(db: DB): number {
  return db.tasks.filter(t => !isDone(t, columnsOf(db, t.project))).length;
}

function findTask(db: DB, id: string): Task | undefined {
  const q = String(id).trim().toLowerCase();
  return db.tasks.find(t => t.id.toLowerCase() === q);
}

function taskLine(t: Task, todayKey: string, columns: string[]): string[] {
  const flag = isOverdue(t, todayKey, columns) ? " (overdue)" : "";
  return [
    t.id, t.project, t.column, t.title,
    t.priority, t.due ? `${t.due}${flag}` : "-",
    typeof t.estimate_minutes === "number" ? hm(t.estimate_minutes) : "-",
    typeof t.actual_minutes === "number" ? hm(t.actual_minutes) : "-",
    t.tags.length ? t.tags.join(",") : "-",
  ];
}
const TASK_HEADERS = ["id", "project", "column", "title", "priority", "due", "est", "actual", "tags"];

/* ------------------------------------------------------------ ISO weeks */

/** Monday-start ISO week key, "2026-W36", for a YYYY-MM-DD day. */
function weekKey(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7;                       // Monday = 0
  dt.setUTCDate(dt.getUTCDate() - dow + 3);                   // the Thursday of this week
  const isoYear = dt.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4dow = (jan4.getUTCDay() + 6) % 7;
  const week1Mon = new Date(Date.UTC(isoYear, 0, 4 - jan4dow));
  const n = Math.round((dt.getTime() - week1Mon.getTime()) / 604800000) + 1;
  return `${isoYear}-W${String(n).padStart(2, "0")}`;
}

/** First and last day (YYYY-MM-DD) of an ISO week key. */
function weekRange(key: string): { from: string; to: string } {
  const m = /^(\d{4})-?W(\d{1,2})$/i.exec(String(key).trim());
  if (!m) throw new Error(`week must look like 2026-W36, got ${JSON.stringify(key)}`);
  const isoYear = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4dow = (jan4.getUTCDay() + 6) % 7;
  const mon = new Date(Date.UTC(isoYear, 0, 4 - jan4dow + (week - 1) * 7));
  const sun = new Date(mon.getTime() + 6 * 86400000);
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
}

/* ---------------------------------------------------------------- server */

const server = new McpServer(
  { name: "mcp-kanban", version: VERSION },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

gate.registerTools(server as unknown as { registerTool: Function });

server.registerTool("task_add", {
  title: "Add task",
  description: "Add a task to a project board (todo list / kanban card). Optional column, due date, estimate, priority, tags and notes.",
  inputSchema: {
    title: text(MAX_TITLE, 1).describe("What the task is, e.g. 'Write the launch email'"),
    project: text(MAX_PROJECT).optional().describe("Project or board name. A partial name matching exactly one existing project is used as that project. Defaults to your only board."),
    column: text(MAX_COLUMN_NAME).optional().describe("Column to start in; defaults to the first column (backlog)"),
    due: text(64).optional().describe("Due date: YYYY-MM-DD, 'today', 'tomorrow', 'Friday', 'next Monday' or '+3d'"),
    estimate_minutes: minutes().optional().describe("How long you think it will take, in minutes"),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional().describe("Priority; defaults to normal"),
    tags: z.array(text(MAX_TAG)).max(MAX_TAGS).optional().describe("Free-form tags, e.g. ['writing','client']"),
    notes: text(MAX_NOTES).optional().describe("Longer notes for the task"),
  },
}, guard(async (a: { title: string; project?: string; column?: string; due?: string; estimate_minutes?: number; priority?: Priority; tags?: string[]; notes?: string }) => {
  return withFileLock(LOCK, async () => {
    const db = load();
    if (a.project !== undefined && !a.project.trim()) {
      return err(`project is blank. Give a board name, or leave project out to use your current board.`);
    }
    const wanted = a.project?.trim() || defaultProject(db) || "inbox";
    const r = resolveProject(knownProjects(db), wanted);
    if (r.kind === "ambiguous") return ok(ambiguousText(wanted, r.candidates));
    const key = r.project.toLowerCase();
    let board = db.boards[key];
    if (!board) {
      if (!gate.isPro() && Object.keys(db.boards).length >= FREE_PROJECTS) {
        return ok(`The free tier keeps ${FREE_PROJECTS} project boards (${knownProjects(db).sort().join(", ")}). ` +
          `"${r.project}" would be the ${Object.keys(db.boards).length + 1}th.\n` + gate.upgradeText("unlimited projects", "task_add"));
      }
      board = { name: r.project, slug: slugFor(r.project, Object.values(db.boards).map(b => b.slug)), columns: [...DEFAULT_COLUMNS], counter: 0 };
      db.boards[key] = board;
    }
    if (!gate.isPro() && openTaskCount(db) >= FREE_OPEN_TASKS) {
      return ok(`The free tier holds ${FREE_OPEN_TASKS} open tasks and you have ${openTaskCount(db)}. Finish or delete some, or go Pro.\n` + gate.upgradeText("unlimited tasks", "task_add"));
    }
    const column = a.column ? normColumn(a.column) : board.columns[0];
    if (!board.columns.includes(column)) return err(`"${column}" is not a column on ${board.name}. Columns: ${board.columns.join(", ")}.`);
    const now = new Date().toISOString();
    board.counter += 1;
    const t: Task = {
      id: makeId(board.slug, board.counter),
      project: board.name,
      title: String(a.title).trim(),
      tags: (a.tags ?? []).map(s => String(s).trim()).filter(Boolean),
      priority: a.priority ?? "normal",
      column,
      created: now,
      updated: now,
      ...(a.notes ? { notes: a.notes } : {}),
      ...(a.due ? { due: parseDay(a.due) } : {}),
      ...(typeof a.estimate_minutes === "number" ? { estimate_minutes: a.estimate_minutes } : {}),
    };
    if (column === doneColumn(board.columns)) t.done_at = now;
    db.tasks.push(t);
    save(db);
    const lines = [`${t.id}  ${t.title}  [${board.name} / ${t.column}]`];
    if (t.due) lines.push(`Due ${t.due}${typeof t.estimate_minutes === "number" ? `, estimate ${hm(t.estimate_minutes)}` : ""}.`);
    else if (typeof t.estimate_minutes === "number") lines.push(`Estimate ${hm(t.estimate_minutes)}.`);
    if (r.note) lines.unshift(r.note);
    return ok(lines.join("\n"));
  });
}));

server.registerTool("task_list", {
  title: "List tasks",
  description: "List tasks as a table, filtered by project, column, tag, due date or overdue.",
  inputSchema: {
    project: text(MAX_PROJECT).optional().describe("Only this project"),
    column: text(MAX_COLUMN_NAME).optional().describe("Only this column, e.g. 'doing'"),
    tag: text(MAX_TAG).optional().describe("Only tasks carrying this tag"),
    due_before: text(64).optional().describe("Only tasks due on or before this day (YYYY-MM-DD, 'today', 'Friday', '+7d')"),
    overdue: z.boolean().optional().describe("Only tasks past their due date"),
    include_done: z.boolean().optional().describe("Include finished tasks; default false"),
    limit: limitArg.describe(`Rows to print; default ${DEFAULT_ROW_LIMIT}`),
  },
}, guard(async (a: { project?: string; column?: string; tag?: string; due_before?: string; overdue?: boolean; include_done?: boolean; limit?: number }) => {
  const db = load();
  const f = resolveFilter(db, a.project);
  if (f.kind === "ambiguous") return ok(f.text);
  const today = localToday();
  const before = a.due_before ? parseDay(a.due_before, "due_before") : undefined;
  const col = a.column ? normColumn(a.column) : undefined;
  const tag = a.tag ? a.tag.trim().toLowerCase() : undefined;
  const rows = db.tasks
    .filter(t => !f.project || t.project === f.project)
    .filter(t => a.include_done || !isDone(t, columnsOf(db, t.project)))
    .filter(t => !col || t.column === col)
    .filter(t => !tag || t.tags.some(x => x.toLowerCase() === tag))
    .filter(t => !before || (t.due && t.due <= before))
    .filter(t => !a.overdue || isOverdue(t, today, columnsOf(db, t.project)))
    .sort((x, y) => (x.due ?? "9999-12-31").localeCompare(y.due ?? "9999-12-31") || x.id.localeCompare(y.id));
  if (!rows.length) return ok("No tasks match. Add one with task_add.");
  const est = totalEstimate(rows);
  const { shown, note } = capRows(rows, a.limit);
  return ok(`${table(TASK_HEADERS, shown.map(t => taskLine(t, today, columnsOf(db, t.project))))}\n\n${rows.length} task(s), estimate ${hm(est)}.${note}`);
}));

server.registerTool("task_move", {
  title: "Move task",
  description: "Move a task to another column on its board.",
  inputSchema: {
    id: text(MAX_ID, 1).describe("Task id, e.g. NOVA-12"),
    column: text(MAX_COLUMN_NAME, 1).describe("Target column, e.g. 'doing'"),
  },
}, guard(async ({ id, column }: { id: string; column: string }) => {
  return withFileLock(LOCK, async () => {
    const db = load();
    const t = findTask(db, id);
    if (!t) return err(`no task with id ${id}. Run task_list to see the ids.`);
    const cols = columnsOf(db, t.project);
    const col = normColumn(column);
    if (!cols.includes(col)) return err(`"${col}" is not a column on ${t.project}. Columns: ${cols.join(", ")}.`);
    const from = t.column;
    t.column = col;
    t.updated = new Date().toISOString();
    if (col === doneColumn(cols)) t.done_at = t.done_at ?? t.updated;
    else delete t.done_at;                 // moved back out of done: it is open again
    save(db);
    return ok(`${t.id} ${from} -> ${col}: ${t.title}`);
  });
}));

server.registerTool("task_update", {
  title: "Update task",
  description: "Change any field of a task: title, notes, due date, estimate, priority, tags or project.",
  inputSchema: {
    id: text(MAX_ID, 1).describe("Task id, e.g. NOVA-12"),
    title: text(MAX_TITLE, 1).optional(),
    notes: text(MAX_NOTES).optional(),
    due: text(64).optional().describe("New due date, or 'none' to clear it"),
    estimate_minutes: minutes().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    tags: z.array(text(MAX_TAG)).max(MAX_TAGS).optional().describe("Replaces the whole tag list"),
    column: text(MAX_COLUMN_NAME).optional(),
    project: text(MAX_PROJECT).optional().describe("Move the task to another existing project board"),
  },
}, guard(async (a: { id: string; title?: string; notes?: string; due?: string; estimate_minutes?: number; priority?: Priority; tags?: string[]; column?: string; project?: string }) => {
  return withFileLock(LOCK, async () => {
    const db = load();
    const t = findTask(db, a.id);
    if (!t) return err(`no task with id ${a.id}. Run task_list to see the ids.`);
    if (a.project) {
      const r = resolveProject(knownProjects(db), a.project);
      if (r.kind === "ambiguous") return ok(ambiguousText(a.project, r.candidates));
      if (!db.boards[r.project.toLowerCase()]) return err(`no project board "${a.project}". Create it by adding a task with task_add.`);
      t.project = r.project;
      if (!columnsOf(db, t.project).includes(t.column)) t.column = columnsOf(db, t.project)[0];
    }
    if (a.title !== undefined) t.title = String(a.title).trim();
    if (a.notes !== undefined) t.notes = a.notes;
    if (a.due !== undefined) {
      if (/^(none|clear|never)$/i.test(a.due.trim())) delete t.due;
      else t.due = parseDay(a.due);
    }
    if (a.estimate_minutes !== undefined) t.estimate_minutes = a.estimate_minutes;
    if (a.priority !== undefined) t.priority = a.priority;
    if (a.tags !== undefined) t.tags = a.tags.map(s => String(s).trim()).filter(Boolean);
    if (a.column !== undefined) {
      const cols = columnsOf(db, t.project);
      const col = normColumn(a.column);
      if (!cols.includes(col)) return err(`"${col}" is not a column on ${t.project}. Columns: ${cols.join(", ")}.`);
      t.column = col;
      if (col === doneColumn(cols)) t.done_at = t.done_at ?? new Date().toISOString();
      else delete t.done_at;
    }
    t.updated = new Date().toISOString();
    save(db);
    return ok(table(TASK_HEADERS, [taskLine(t, localToday(), columnsOf(db, t.project))]));
  });
}));

server.registerTool("task_done", {
  title: "Complete task",
  description: "Mark a task done: it moves to the done column and is stamped with the time.",
  inputSchema: { id: text(MAX_ID, 1).describe("Task id, e.g. NOVA-12") },
}, guard(async ({ id }: { id: string }) => {
  return withFileLock(LOCK, async () => {
    const db = load();
    const t = findTask(db, id);
    if (!t) return err(`no task with id ${id}. Run task_list to see the ids.`);
    const cols = columnsOf(db, t.project);
    t.column = doneColumn(cols);
    t.done_at = new Date().toISOString();
    t.updated = t.done_at;
    save(db);
    const est = typeof t.estimate_minutes === "number" ? t.estimate_minutes : undefined;
    const act = typeof t.actual_minutes === "number" ? t.actual_minutes : undefined;
    const cmp = est !== undefined && act !== undefined ? `  estimate ${hm(est)}, actual ${hm(act)}` : "";
    return ok(`Done: ${t.id} ${t.title} (${t.project}).${cmp}`);
  });
}));

server.registerTool("task_delete", {
  title: "Delete task",
  description: "Delete a task permanently.",
  inputSchema: { id: text(MAX_ID, 1).describe("Task id, e.g. NOVA-12") },
}, guard(async ({ id }: { id: string }) => {
  return withFileLock(LOCK, async () => {
    const db = load();
    const t = findTask(db, id);
    if (!t) return err(`no task with id ${id}. Run task_list to see the ids.`);
    db.tasks = db.tasks.filter(x => x !== t);
    save(db);
    /**
     * D-K7. Deleting a task that carries logged minutes throws away the only record of
     * that work on this board. Say how much, and say plainly that the time-tracker's own
     * entries are a separate store and were not touched.
     */
    const logged = typeof t.actual_minutes === "number" && t.actual_minutes > 0
      ? ` It carried ${hm(t.actual_minutes)} of logged time, which is gone from this board; any time-tracker entries for "${t.title}" are a separate store and were not touched.`
      : "";
    return ok(`Deleted ${t.id} "${t.title}" from ${t.project}. The id is not reused.${logged}`);
  });
}));

server.registerTool("task_search", {
  title: "Search tasks",
  description: "Find tasks whose title, notes, tags or id match a query.",
  inputSchema: {
    query: text(MAX_QUERY, 1).describe("Text to look for"),
    limit: limitArg.describe(`Rows to print; default ${DEFAULT_ROW_LIMIT}`),
  },
}, guard(async ({ query, limit }: { query: string; limit?: number }) => {
  const db = load();
  const q = String(query).trim().toLowerCase();
  const today = localToday();
  const rows = db.tasks.filter(t =>
    t.id.toLowerCase().includes(q) ||
    t.title.toLowerCase().includes(q) ||
    (t.notes ?? "").toLowerCase().includes(q) ||
    t.tags.some(x => x.toLowerCase().includes(q)));
  if (!rows.length) return ok(`Nothing matches "${query}".`);
  const { shown, note } = capRows(rows, limit);
  return ok(`${table(TASK_HEADERS, shown.map(t => taskLine(t, today, columnsOf(db, t.project))))}\n\n${rows.length} match(es).${note}`);
}));

server.registerTool("board", {
  title: "Show board",
  description: "Column-by-column summary of a project board: task counts and estimate totals.",
  inputSchema: { project: text(MAX_PROJECT).optional().describe("Which board; defaults to your busiest one") },
}, guard(async ({ project }: { project?: string }) => {
  const db = load();
  const f = resolveFilter(db, project);
  if (f.kind === "ambiguous") return ok(f.text);
  const name = f.project ?? defaultProject(db);
  if (!name) return ok("No boards yet. Add a task with task_add and the board is created.");
  const b = boardOf(db, name);
  if (!b) return err(`no project board "${name}".`);
  const today = localToday();
  const mine = db.tasks.filter(t => t.project === b.name);
  const rows = b.columns.map(c => {
    const inCol = mine.filter(t => t.column === c);
    const over = inCol.filter(t => isOverdue(t, today, b.columns)).length;
    return [c, String(inCol.length), hm(totalEstimate(inCol)), hm(totalActual(inCol)), over ? String(over) : "-"];
  });
  const open = mine.filter(t => !isDone(t, b.columns));
  const summary = `${b.name} (${b.slug}-)  ${mine.length} task(s), ${open.length} open, estimate ${hm(totalEstimate(open))} remaining.`;
  return ok(`${table(["column", "tasks", "estimate", "actual", "overdue"], rows)}\n\n${summary}`);
}));

server.registerTool("task_start_timer", {
  title: "Start a timer for a task",
  description: "Return the exact arguments to pass to the time-tracker server's timer_start for this task, and record the link on the task.",
  inputSchema: { id: text(MAX_ID, 1).describe("Task id, e.g. NOVA-12") },
}, guard(async ({ id }: { id: string }) => {
  return withFileLock(LOCK, async () => {
    const db = load();
    const t = findTask(db, id);
    if (!t) return err(`no task with id ${id}. Run task_list to see the ids.`);
    const args: { project: string; task: string; tags?: string[] } = { project: t.project, task: t.title };
    if (t.tags.length) args.tags = t.tags;
    const at = new Date().toISOString();
    t.timer_links = [...(t.timer_links ?? []), { at, project: args.project, task: args.task }];
    t.updated = at;
    save(db);
    const tt = timeTrackerProjects();
    const clash = resolveProject(tt, args.project);
    let warn = "";
    if (clash.kind === "ambiguous") {
      warn = `\n\nWarning: the time tracker already has ${clash.candidates.length} projects that "${args.project}" could mean ` +
        `(${clash.candidates.map(c => `"${c}"`).join(", ")}), and it will refuse the call. Rename this board, or start the timer with the exact name you mean.`;
    } else if (clash.project.toLowerCase() !== args.project.toLowerCase()) {
      warn = `\n\nWarning: the time tracker has no project called "${args.project}" but it does have "${clash.project}", ` +
        `and it matches partial names, so it will log this time under "${clash.project}" instead. ` +
        `The two stores would then disagree. Rename this board to "${clash.project}", or tell the user before you continue.`;
    }
    return ok(
      `Call the time-tracker server's timer_start with exactly these arguments:\n` +
      `${JSON.stringify(args, null, 2)}\n\n` +
      `Then stop it with timer_stop and record the minutes back here with task_log_time, id ${t.id}.${warn}`,
    );
  });
}));

server.registerTool("task_log_time", {
  title: "Log time on a task",
  description: "Add real minutes worked to a task, so estimate and actual can be compared.",
  inputSchema: {
    id: text(MAX_ID, 1).describe("Task id, e.g. NOVA-12"),
    minutes: minutes({ negative: true }).describe("Minutes to add; a negative number corrects an over-count"),
  },
}, guard(async ({ id, minutes: mins }: { id: string; minutes: number }) => {
  return withFileLock(LOCK, async () => {
    const db = load();
    const t = findTask(db, id);
    if (!t) return err(`no task with id ${id}. Run task_list to see the ids.`);
    const next = (t.actual_minutes ?? 0) + mins;
    if (next < 0) return err(`that would leave ${t.id} at ${next} minutes. Actual time cannot go below zero.`);
    if (next > MAX_MINUTES) return err(`that would leave ${t.id} at ${next} minutes, past the ${MAX_MINUTES}-minute ceiling. Nothing was logged.`);
    t.actual_minutes = next;
    t.updated = new Date().toISOString();
    save(db);
    const est = typeof t.estimate_minutes === "number"
      ? `  estimate ${hm(t.estimate_minutes)} (${next > t.estimate_minutes ? `${hm(next - t.estimate_minutes)} over` : `${hm(t.estimate_minutes - next)} left`})`
      : "";
    return ok(`${t.id} actual ${hm(next)}.${est}`);
  });
}));

server.registerTool("project_list", {
  title: "List projects",
  description: "All project boards with open task counts, remaining estimate and overdue counts.",
  inputSchema: {},
}, guard(async () => {
  const db = load();
  const names = knownProjects(db).sort();
  if (!names.length) return ok("No boards yet. Add a task with task_add and the board is created.");
  const today = localToday();
  const rows = names.map(n => {
    const b = db.boards[n.toLowerCase()];
    const mine = db.tasks.filter(t => t.project === n);
    const open = mine.filter(t => !isDone(t, b.columns));
    const over = open.filter(t => isOverdue(t, today, b.columns)).length;
    return [n, b.slug, String(open.length), String(mine.length - open.length), hm(totalEstimate(open)), over ? String(over) : "-"];
  });
  const note = gate.isPro() ? "" : `\n\nFree tier: ${names.length}/${FREE_PROJECTS} projects, ${openTaskCount(db)}/${FREE_OPEN_TASKS} open tasks.`;
  return ok(table(["project", "prefix", "open", "done", "estimate", "overdue"], rows) + note);
}));

server.registerTool("overdue", {
  title: "Overdue tasks",
  description: "Every task past its due date, across all boards.",
  inputSchema: {
    as_of: text(64).optional().describe("Measure against this day instead of today (YYYY-MM-DD, 'next Monday', '+7d')"),
    limit: limitArg.describe(`Rows to print; default ${DEFAULT_ROW_LIMIT}`),
  },
}, guard(async ({ as_of, limit }: { as_of?: string; limit?: number }) => {
  const db = load();
  const day = as_of ? parseDay(as_of, "as_of") : localToday();
  const rows = db.tasks
    .filter(t => isOverdue(t, day, columnsOf(db, t.project)))
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? "") || a.id.localeCompare(b.id));
  if (!rows.length) return ok(`Nothing is overdue as of ${day}.`);
  const { shown, note } = capRows(rows, limit);
  return ok(`${table(TASK_HEADERS, shown.map(t => taskLine(t, day, columnsOf(db, t.project))))}\n\n${rows.length} overdue as of ${day}.${note}`);
}));

server.registerTool("weekly_review", {
  title: "Weekly review",
  description: "Done versus planned for a week, with estimate against actual minutes per project.",
  inputSchema: { week: text(16).optional().describe("ISO week, e.g. '2026-W36'. Defaults to this week. Past weeks are a Pro feature.") },
}, guard(async ({ week }: { week?: string }) => {
  const db = load();
  const thisWeek = weekKey(localToday());
  const key = week ? weekKey(weekRange(week).from) : thisWeek;
  if (key !== thisWeek && !gate.isPro()) return gated("weekly review history", "weekly_review");
  const { from, to } = weekRange(key);
  const doneThisWeek = db.tasks.filter(t => t.done_at && dayKey(t.done_at) >= from && dayKey(t.done_at) <= to);
  const plannedThisWeek = db.tasks.filter(t => t.due && t.due >= from && t.due <= to);
  const projects = [...new Set([...doneThisWeek, ...plannedThisWeek].map(t => t.project))].sort();
  const rows = projects.map(p => {
    const done = doneThisWeek.filter(t => t.project === p);
    const planned = plannedThisWeek.filter(t => t.project === p);
    const plannedDone = planned.filter(t => isDone(t, columnsOf(db, p))).length;
    return [p, String(planned.length), String(plannedDone), String(done.length), hm(totalEstimate(done)), hm(totalActual(done))];
  });
  const head = `Week ${key} (${from} to ${to})`;
  if (!rows.length) return ok(`${head}\nNothing planned and nothing completed.`);
  const body = table(["project", "planned", "planned done", "completed", "estimate", "actual"], rows);
  const est = totalEstimate(doneThisWeek);
  const act = totalActual(doneThisWeek);
  const delta = est && act
    ? `\nEstimate ${hm(est)} against actual ${hm(act)}: ${act > est ? `${hm(act - est)} over` : `${hm(est - act)} under`}.`
    : "\nNo estimate/actual comparison: log minutes with task_log_time to get one.";
  const carried = plannedThisWeek.filter(t => !isDone(t, columnsOf(db, t.project))).length;
  return ok(`${head}\n${body}\n\n${doneThisWeek.length} completed, ${carried} still open from this week's plan.${delta}`);
}));

server.registerTool("columns_set", {
  title: "Set board columns",
  description: "Replace the columns of one board (Pro). Tasks sitting in a removed column move to the first column.",
  inputSchema: {
    project: text(MAX_PROJECT, 1).describe("Which board"),
    columns: z.array(text(MAX_COLUMN_NAME)).min(2).max(MAX_COLUMNS)
      .describe(`The new column names in order, at most ${MAX_COLUMNS}, e.g. ['inbox','next','doing','done']`),
  },
}, guard(async ({ project, columns }: { project: string; columns: string[] }) => {
  if (!gate.isPro()) return gated("custom columns", "columns_set");
  return withFileLock(LOCK, async () => {
    const db = load();
    const f = resolveFilter(db, project);
    if (f.kind === "ambiguous") return ok(f.text);
    const b = f.project ? boardOf(db, f.project) : undefined;
    if (!b) return err(`no project board "${project}". Create it by adding a task with task_add.`);
    /**
     * D-K4. The min(2) on the array ran BEFORE the blanks were dropped, so ["only", "   "]
     * left a one-column board: that single column is doneColumn(), so every task on the
     * board became "done" and vanished from task_list. Validate the normalised list.
     */
    const cols = columns.map(normColumn).filter(Boolean);
    if (cols.length < 2) {
      return err(`a board needs at least 2 named columns; ${columns.length - cols.length} of the ${columns.length} you gave were blank. Nothing was changed.`);
    }
    if (new Set(cols).size !== cols.length) return err(`column names must be unique: ${cols.join(", ")}`);
    const gone = b.columns.filter(c => !cols.includes(c));
    b.columns = cols;
    let moved = 0;
    for (const t of db.tasks) {
      if (t.project !== b.name || cols.includes(t.column)) continue;
      t.column = cols[0];
      t.updated = new Date().toISOString();
      moved++;
    }
    save(db);
    return ok(`${b.name} columns: ${cols.join(" -> ")}.` +
      (gone.length ? ` Removed ${gone.join(", ")}; ${moved} task(s) moved to ${cols[0]}.` : ""));
  });
}));

/* ------------------------------------------------------------- resource */

server.registerResource("today", "kanban://today", {
  title: "Due today and overdue",
  description: "Tasks due today plus everything already past its due date, across all boards.",
  mimeType: "text/plain",
}, async (uri: URL) => {
  const db = load();
  const today = localToday();
  const due = db.tasks.filter(t => isDueOn(t, today, columnsOf(db, t.project)));
  const over = db.tasks.filter(t => isOverdue(t, today, columnsOf(db, t.project)));
  const fmt = (list: Task[]) => list.length
    ? list.sort((a, b) => (a.due ?? "").localeCompare(b.due ?? "")).map(t => `- ${t.id} [${t.project}/${t.column}] ${t.title}${t.due ? ` (due ${t.due})` : ""}`).join("\n")
    : "(none)";
  const text = `Today ${today}\n\nDUE TODAY\n${fmt(due)}\n\nOVERDUE\n${fmt(over)}`;
  return { contents: [{ uri: uri.href, mimeType: "text/plain", text }] };
});

/* --------------------------------------------------------------- prompt */

server.registerPrompt("plan_week", {
  title: "Plan the week",
  description: "Turn the open board into a realistic plan for the week ahead.",
  argsSchema: { hours: z.string().optional().describe("Hours you actually have this week, e.g. '20'") },
}, ({ hours }: { hours?: string }) => {
  const db = load();
  const today = localToday();
  const open = db.tasks.filter(t => !isDone(t, columnsOf(db, t.project)));
  const lines = open
    .sort((a, b) => (a.due ?? "9999-12-31").localeCompare(b.due ?? "9999-12-31"))
    .map(t => `- ${t.id} [${t.project}/${t.column}] ${t.title} | priority ${t.priority} | due ${t.due ?? "none"}${isOverdue(t, today, columnsOf(db, t.project)) ? " (OVERDUE)" : ""} | estimate ${typeof t.estimate_minutes === "number" ? hm(t.estimate_minutes) : "none"}`)
    .join("\n") || "(no open tasks)";
  const budget = hours ? `${hours} hours` : "the hours I have";
  const text =
    `Plan my week from this board. Capacity: ${budget}. Today is ${today}.\n\n` +
    `OPEN TASKS\n${lines}\n\n` +
    `Give me: overdue items to deal with first, a day-by-day plan that fits the capacity using the estimates ` +
    `(say so plainly when the estimates exceed it and name what to drop), and the exact task_move / task_update ` +
    `calls to make the board match the plan. Under 200 words, no filler.`;
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
});

/* ------------------------------------------------------------------ boot */

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`mcp-kanban ready (${gate.isPro() ? "pro" : "free"}), data in ${dataDir()}\n`);
}

main().catch(e => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
