import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "../../shims/fs.js";
import { homedir } from "../../shims/os.js";
import { join } from "node:path";

/** 1 EUR = rate units of the currency. EUR itself is never stored; it is 1 by definition. */
export type RateMap = Record<string, number>;

export interface DailyCache {
  version: 1;
  /** When this process last fetched the file, ISO timestamp. */
  fetched_at: string;
  /** The ECB reference date the rates belong to, YYYY-MM-DD. */
  date: string;
  rates: RateMap;
}

export interface HistoryCache {
  version: 1;
  fetched_at: string;
  /** date -> rates on that date. ECB publishes one entry per TARGET business day. */
  days: Record<string, RateMap>;
}

export function dataDir(): string { return "/currency"; }

export function dailyPath(): string { return join(dataDir(), "daily.json"); }
export function historyPath(): string { return join(dataDir(), "history.json"); }
export function lockPath(): string { return join(dataDir(), ".lock"); }

/**
 * A read or JSON.parse failure must never be reported as "no cache": the next refresh
 * would then overwrite a cache that is still on disk, and an offline machine would lose
 * the only rates it has. Only ENOENT means empty. A parse failure quarantines the file
 * byte-for-byte as <file>.corrupt-<timestamp>, writes a marker so every later call keeps
 * failing until a human resolves it, and throws.
 */
export class CorruptDataError extends Error {
  /** The `<file>.corrupt-<timestamp>` copy holding the original bytes. */
  quarantined?: string;
  /** True only when this very call did the moving, so the caller can be told it just happened. */
  justQuarantined = false;
}

export function markerPath(file: string): string { return `${file}.corrupt`; }

function corruptStamp(): string { return new Date().toISOString().replace(/[:.]/g, "-"); }

function blocked(file: string, moved: string, justQuarantined = false): CorruptDataError {
  const e = new CorruptDataError(
    `the cache file is corrupt; moved to ${moved}; nothing was written. ` +
    `Delete ${markerPath(file)} to let the next call re-download it from the ECB.`,
  );
  e.quarantined = moved;
  e.justQuarantined = justQuarantined;
  return e;
}

export function markerBody(quarantined: string): string {
  return JSON.stringify({
    quarantined,
    at: new Date().toISOString(),
    hint: "the rate cache failed to parse; it was moved, nothing was overwritten; delete this marker and the next call re-downloads the ECB file",
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

/** Returns undefined when the file does not exist. Throws CorruptDataError on anything else. */
export function readJsonFile<T>(file: string): T | undefined {
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
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    {
      const err = new CorruptDataError(`cannot read the cache file ${file}: ${(e as Error).message}; nothing was written.`);
      throw err;
    }
  }
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    const moved = `${file}.corrupt-${corruptStamp()}`;
    try { renameSync(file, moved); writeFileSync(marker, markerBody(moved)); } catch { /* keep the parse error */ }
    process.stderr.write(`${file} is not valid JSON (${(e as Error).message}); moved to ${moved}\n`);
    throw blocked(file, moved, true);
  }
}

/** tmp + rename, so a crash mid-write, or two processes refreshing at once, never leaves a half file. */
export function writeJsonFile(file: string, value: unknown): void {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value));
  renameSync(tmp, file);
}

export function loadDaily(): DailyCache | undefined {
  const c = readJsonFile<Partial<DailyCache>>(dailyPath());
  if (!c || typeof c.date !== "string" || !c.rates || typeof c.rates !== "object") return undefined;
  return { version: 1, fetched_at: String(c.fetched_at ?? ""), date: c.date, rates: c.rates as RateMap };
}

export function loadHistory(): HistoryCache | undefined {
  const c = readJsonFile<Partial<HistoryCache>>(historyPath());
  if (!c || !c.days || typeof c.days !== "object") return undefined;
  return { version: 1, fetched_at: String(c.fetched_at ?? ""), days: c.days as Record<string, RateMap> };
}
