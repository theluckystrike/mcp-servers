/**
 * The clause library on disk.
 *
 * One JSON file holds every clause, starter and own. A read or JSON.parse failure is never
 * reported as "empty library": the next mutation would overwrite a history that is still on
 * disk. Only ENOENT means empty. A parse failure quarantines the file byte-for-byte as
 * <file>.corrupt-<timestamp>, writes a marker so every later call keeps failing until a human
 * resolves it, and throws. Same contract as servers/expense-tracker/src/store.ts.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { STARTER_CLAUSES } from "./starter.js";

/** One revision of a clause, kept by clause_update in Pro mode. */
export interface Version { at: string; title: string; body: string }

export interface Clause {
  id: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
  /** Declared variables. The effective set is this union whatever {{...}} the body contains. */
  variables: string[];
  /**
   * D-R37. Clause ids this clause's text points at. contract_assemble resolves each one
   * against the clauses actually included: a resolved reference becomes "see clause N",
   * an unresolved one is dropped from the document and reported as a missing reference.
   */
  references?: string[];
  jurisdiction?: string;
  language: string;
  /** True for the 25 clauses shipped with the server. Starters do not count against the free cap. */
  starter: boolean;
  /** Present on every starter clause. */
  note?: string;
  created: string;
  updated: string;
  history: Version[];
}

export interface DB { version: 1; clauses: Clause[]; seeded: boolean }

export const EMPTY: DB = { version: 1, clauses: [], seeded: false };

/** Assembly order when clauses come from `categories`, and the order of clauses://categories. */
export const CATEGORY_ORDER = [
  "parties", "scope", "payment", "expenses", "ip", "confidentiality",
  "data", "term", "liability", "warranty", "disputes", "general",
];

export function categoryRank(c: string): number {
  const i = CATEGORY_ORDER.indexOf(c);
  return i < 0 ? CATEGORY_ORDER.length : i;
}

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(base, "mcp-servers", "clauses");
}

export function dbPath(): string { return join(dataDir(), "data.json"); }
export function lockPath(): string { return join(dataDir(), ".lock"); }

export class CorruptDataError extends Error {}

export function markerPath(file: string): string { return `${file}.corrupt`; }

function corruptStamp(): string { return new Date().toISOString().replace(/[:.]/g, "-"); }

function blocked(file: string, moved: string): CorruptDataError {
  return new CorruptDataError(
    `data file is corrupt; moved to ${moved}; nothing was written. ` +
    `Restore a good copy to ${file}, then delete ${markerPath(file)} to continue.`,
  );
}

export function markerBody(quarantined: string): string {
  return JSON.stringify({
    quarantined,
    at: new Date().toISOString(),
    hint: "the original data file failed to parse; it was moved, nothing was overwritten; restore it manually or delete this marker to start fresh",
  }) + "\n";
}

function markerQuarantinePath(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  try {
    const parsed = JSON.parse(t) as { quarantined?: unknown };
    if (typeof parsed.quarantined === "string" && parsed.quarantined) return parsed.quarantined;
    return undefined;
  } catch { return t; }
}

export function readJsonFile<T>(file: string, empty: T): T {
  const marker = markerPath(file);
  if (existsSync(marker)) {
    let moved = `${file}.corrupt-*`;
    try { moved = markerQuarantinePath(readFileSync(marker, "utf8")) ?? moved; } catch { /* marker unreadable */ }
    throw blocked(file, moved);
  }
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return empty;
    throw new CorruptDataError(`cannot read the data file ${file}: ${(e as Error).message}; nothing was written.`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    const moved = `${file}.corrupt-${corruptStamp()}`;
    try { renameSync(file, moved); writeFileSync(marker, markerBody(moved)); } catch { /* keep the parse error */ }
    process.stderr.write(`${file} is not valid JSON (${(e as Error).message}); moved to ${moved}\n`);
    throw blocked(file, moved);
  }
}

function normalize(c: Partial<Clause>): Clause | undefined {
  if (!c || typeof c.id !== "string" || typeof c.title !== "string" || typeof c.body !== "string") return undefined;
  const now = new Date().toISOString();
  return {
    id: c.id,
    title: c.title,
    body: c.body,
    category: typeof c.category === "string" && c.category ? c.category : "general",
    tags: Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === "string") : [],
    variables: Array.isArray(c.variables) ? c.variables.filter((t): t is string => typeof t === "string") : [],
    jurisdiction: typeof c.jurisdiction === "string" ? c.jurisdiction : undefined,
    language: typeof c.language === "string" && c.language ? c.language : "en",
    starter: c.starter === true,
    note: typeof c.note === "string" ? c.note : undefined,
    created: typeof c.created === "string" ? c.created : now,
    updated: typeof c.updated === "string" ? c.updated : now,
    history: Array.isArray(c.history)
      ? c.history.filter((h): h is Version => !!h && typeof h.at === "string" && typeof h.body === "string")
      : [],
  };
}

/**
 * The starter set is seeded once, on the first load, and marked with `seeded`. A user who
 * deletes a starter clause does not get it back on the next call -- re-seeding every load
 * would make clause_delete silently useless.
 */
export function load(): DB {
  const raw = readJsonFile<Partial<DB>>(dbPath(), { ...EMPTY, clauses: [] });
  const clauses = (Array.isArray(raw.clauses) ? raw.clauses : [])
    .map((c) => normalize(c as Partial<Clause>))
    .filter((c): c is Clause => !!c);
  if (raw.seeded === true) return { version: 1, clauses, seeded: true };
  const now = new Date().toISOString();
  const have = new Set(clauses.map((c) => c.id));
  const seeded = STARTER_CLAUSES
    .filter((s) => !have.has(s.id))
    .map((s): Clause => ({
      ...s, tags: [...s.tags], variables: [...s.variables],
      starter: true, note: STARTER_NOTE, language: "en",
      created: now, updated: now, history: [],
    }));
  return { version: 1, clauses: [...clauses, ...seeded], seeded: true };
}

export const STARTER_NOTE = "generic template, not legal advice";

/** tmp + rename, so a crash mid-write never leaves a half file. */
export function save(db: DB): void {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const p = dbPath();
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, p);
}
