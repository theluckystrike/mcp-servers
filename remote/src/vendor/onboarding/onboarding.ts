/**
 * The onboarding engine: hires, role templates, and per-hire task instances.
 *
 * Two rules decide the shape of everything here.
 *
 * A HIRE SNAPSHOTS ITS TEMPLATE. When a template is applied to a hire, the template's tasks
 * are COPIED into the hire, text and owner and due offset and all, with the template's version
 * recorded beside them. If somebody later edits the template, every hire already onboarded
 * keeps the plan it started with. That is not a caching convenience: a day-one checklist a
 * manager is working from has to be the list they were given. A hire that read its tasks live
 * from the template would mean a day-ninety review that suddenly grew a task the manager never
 * saw, and no field in the record would show that it had happened.
 *
 * The second rule follows from the first: NOTHING DERIVED IS STORED. Progress, the percent
 * complete, what is overdue and what is outstanding are computed on every call from the hire's
 * own task instances. A stored "complete" flag is a fact about the afternoon somebody last
 * looked.
 */

export const TASK_STATUSES = ["todo", "done", "skipped"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const OWNERS = ["hr", "manager", "it"] as const;
export type Owner = (typeof OWNERS)[number];

export const MAX_TASKS = 500;
export const MAX_TEMPLATES = 500;
export const MAX_HIRES = 500;
export const MAX_ROWS = 500;
export const MAX_TEXT = 2000;

export interface TemplateTask {
  id: string;               // K01, K02, ...
  text: string;
  owner: Owner;             // who owns the task: hr, manager or it
  due_offset: number;       // days from the hire's start date
}

export interface Template {
  id: string;               // T-0001
  role: string;             // the role this template is for, e.g. engineer
  name: string;
  description?: string;
  tasks: TemplateTask[];
  version: number;          // bumped on every change to the tasks
  created: string;
  updated: string;
}

export interface HireTask {
  id: string;               // the template task's id, carried over
  text: string;             // COPIED at apply; the template may change afterwards
  owner: Owner;
  due_offset: number;       // days from the hire's start date
  status: TaskStatus;
  completed_date?: string;  // YYYY-MM-DD when it was done or skipped
}

export interface Hire {
  id: string;               // H-0001
  name: string;
  role: string;
  start_date: string;       // YYYY-MM-DD
  template?: string;        // the template id it came from, if any
  template_name?: string;   // the name AT THE TIME, so a renamed template does not rewrite history
  template_version?: number;
  tasks: HireTask[];
  created: string;
  updated: string;
}

export function normaliseText(s: string): string { return String(s ?? "").trim().replace(/\s+/g, " "); }

/** A role is a grouping key, not prose: lower-cased, hyphenated, and capped. */
export function slugRole(s: string | undefined): string {
  const v = normaliseText(s ?? "general").toLowerCase().replace(/\s+/g, "-") || "general";
  return v.length > 60 ? v.slice(0, 60) : v;
}

/** The date a task is due, given the hire's start date and the task's due offset. */
export function dueDate(startDate: string, offset: number): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export interface Progress {
  tasks: number;
  todo: number; done: number; skipped: number;
  percent_complete: number;      // 0..100, one decimal; done counts, skipped does not
  overdue: number;               // todo tasks whose due date is before today
  outstanding: { id: string; text: string; owner: Owner; due: string }[];
}

/**
 * A hire's progress, derived every time.
 *
 * `done` counts toward completion; `skipped` is a deliberate dismissal and never counts as
 * done. A task is overdue when it is still `todo` and its due date is before today.
 */
export function progress(h: Hire, todayIso: string): Progress {
  const count = (s: TaskStatus) => h.tasks.filter((t) => t.status === s).length;
  const done = count("done");
  const outstanding = h.tasks
    .filter((t) => t.status === "todo")
    .map((t) => ({ id: t.id, text: t.text, owner: t.owner, due: dueDate(h.start_date, t.due_offset) }));
  const overdue = outstanding.filter((o) => o.due < todayIso).length;
  return {
    tasks: h.tasks.length,
    todo: count("todo"), done, skipped: count("skipped"),
    percent_complete: h.tasks.length ? Number(((done / h.tasks.length) * 100).toFixed(1)) : 0,
    overdue,
    outstanding,
  };
}
