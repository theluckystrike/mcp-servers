/**
 * Calendar storage. The index lives in data.json; each calendar's raw .ics text is a
 * separate file beside it, so a 5 MB feed never has to be JSON-escaped into the index
 * and the index stays small enough to read and rewrite on every call.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJsonFile } from "@theluckystrike/mcp-timezone/lib";

export const PRODUCT = "calendar";

export interface CalendarRecord {
  name: string;
  slug: string;
  source: "file" | "url" | "text";
  ref?: string;
  imported: string;
  events: number;
  bytes: number;
  file: string;
}

export interface DB {
  version: 1;
  calendars: Record<string, CalendarRecord>;   // key: slug
}

export const EMPTY: DB = { version: 1, calendars: {} };

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(base, "mcp-servers", PRODUCT);
}
export function dbPath(): string { return join(dataDir(), "data.json"); }
export function lockPath(): string { return join(dataDir(), ".lock"); }

/** A calendar name reduced to a filename-safe key. Two names that differ only in case or punctuation are the same calendar. */
export function slugify(name: string): string {
  const s = String(name ?? "").trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return s || `cal-${Math.abs(hashName(String(name ?? ""))).toString(36)}`;
}

function hashName(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

/** Only a missing file is an empty database; a corrupt one is quarantined by the shared store. */
export function load(): DB {
  const raw = readJsonFile<Partial<DB>>(dbPath(), { ...EMPTY, calendars: {} });
  const calendars: Record<string, CalendarRecord> = {};
  if (raw.calendars && typeof raw.calendars === "object") {
    for (const [k, v] of Object.entries(raw.calendars)) {
      if (v && typeof v === "object" && typeof (v as CalendarRecord).file === "string") calendars[k] = v as CalendarRecord;
    }
  }
  return { version: 1, calendars };
}

export function save(db: DB): void {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const p = dbPath();
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, p);
}

export function icsFilePath(slug: string): string {
  return join(dataDir(), `cal-${slug}.ics`);
}

export function writeIcsText(slug: string, text: string): string {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const p = icsFilePath(slug);
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, p);
  return p;
}

export function readIcsText(rec: CalendarRecord): string {
  return readFileSync(rec.file, "utf8");
}

export function removeIcs(slug: string): void {
  try { rmSync(icsFilePath(slug), { force: true }); } catch { /* nothing to remove */ }
}

/** Stray cal-*.ics files with no index row, for the corruption path to report. */
export function orphanIcsFiles(db: DB): string[] {
  const dir = dataDir();
  if (!existsSync(dir)) return [];
  const known = new Set(Object.keys(db.calendars).map(s => `cal-${s}.ics`));
  return readdirSync(dir).filter(f => /^cal-.*\.ics$/.test(f) && !known.has(f));
}
