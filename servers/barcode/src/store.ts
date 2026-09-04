import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The register of codes this server generated.
 *
 * It exists for two reasons: the free tier counts codes per calendar month, and a payment
 * QR code is a document ("what did I send that client?"). It is written with the same
 * discipline as every other store in this suite: tmp + rename, a cross-process lock around
 * read-modify-write, and a parse failure quarantined byte-for-byte rather than reported as
 * "no codes yet", because that report would let the next write erase a history still on disk.
 */
export interface CodeRecord {
  id: string;
  kind: string;
  symbology: string;
  /** The payload, truncated: a register is not a place to keep a WiFi password in full. */
  summary: string;
  format: string;
  out_path?: string;
  bytes?: number;
  created: string;
}

/** Codes kept in the register. Older rows are dropped, the month counter is not affected. */
export const REGISTER_MAX = 1000;
/** How much of a payload the register keeps. */
export const SUMMARY_MAX = 120;

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "barcode");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function lockPath(): string { return join(dataDir(), ".lock"); }
export function registerPath(): string { return join(dataDir(), "codes.json"); }
export function markerPath(file: string): string { return `${file}.corrupt`; }

export class CorruptDataError extends Error {}

function blocked(file: string, moved: string): CorruptDataError {
  return new CorruptDataError(
    `the code register is corrupt; it was moved to ${moved} and nothing was written. ` +
    `Restore a good copy to ${file}, then delete ${markerPath(file)} to continue.`,
  );
}

export function readJsonFile<T>(file: string, empty: T): T {
  const marker = markerPath(file);
  if (existsSync(marker)) {
    let moved = `${file}.corrupt-*`;
    try {
      const t = readFileSync(marker, "utf8").trim();
      if (t) {
        try { const j = JSON.parse(t) as { quarantined?: unknown }; moved = typeof j.quarantined === "string" && j.quarantined ? j.quarantined : t; }
        catch { moved = t; }
      }
    } catch { /* marker unreadable */ }
    throw blocked(file, moved);
  }
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return empty;
    throw new CorruptDataError(`cannot read the code register ${file}: ${(e as Error).message}; nothing was written.`);
  }
  try {
    const parsed = JSON.parse(raw) as T;
    // A JSON file that parses to the wrong shape is as unusable as one that does not parse,
    // and silently treating it as empty is the same data loss.
    if (Array.isArray(empty) && !Array.isArray(parsed)) throw new Error("expected a JSON array");
    return parsed;
  } catch (e) {
    const moved = `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    try {
      renameSync(file, moved);
      writeFileSync(marker, JSON.stringify({
        quarantined: moved, at: new Date().toISOString(),
        hint: "the code register failed to parse; it was moved, nothing was overwritten; restore it manually or delete this marker to start fresh",
      }) + "\n");
    } catch { /* keep the parse error */ }
    process.stderr.write(`${file} is not valid JSON (${(e as Error).message}); moved to ${moved}\n`);
    throw blocked(file, moved);
  }
}

export function getCodes(): CodeRecord[] { return readJsonFile<CodeRecord[]>(registerPath(), []); }

export function setCodes(rows: CodeRecord[]): void {
  const p = registerPath();
  const tmp = `${p}.${process.pid}.${Math.random().toString(16).slice(2, 8)}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(rows, null, 2));
    renameSync(tmp, p);
  } catch (e) {
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* best effort */ }
    throw e;
  }
}

/** Append inside the caller's lock. Returns the row as stored. */
export function addCode(rec: CodeRecord): CodeRecord {
  const all = getCodes();
  all.push(rec);
  setCodes(all.slice(-REGISTER_MAX));
  return rec;
}

export function summarize(text: string): string {
  const one = String(text).replace(/[\r\n]+/g, " ").trim();
  return one.length <= SUMMARY_MAX ? one : `${one.slice(0, SUMMARY_MAX - 3)}...`;
}

/** Codes recorded in the given YYYY-MM. The free cap counts calendar months, not 30 days. */
export function countInMonth(rows: CodeRecord[], month: string): number {
  return rows.filter((r) => typeof r.created === "string" && r.created.slice(0, 7) === month).length;
}
