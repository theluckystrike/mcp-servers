import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The register of operations this server performed, plus the same corrupt-file
 * discipline the rest of the suite uses: a read or parse failure is never reported
 * as "empty", because the next write would then overwrite a history still on disk.
 */
export interface OpRecord {
  id: string;
  op: string;
  inputs: string[];
  outputs: string[];
  pages?: number;
  note?: string;
  created: string;
}

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "pdf");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export class CorruptDataError extends Error {}

export function markerPath(file: string): string { return `${file}.corrupt`; }

function blocked(file: string, moved: string): CorruptDataError {
  return new CorruptDataError(
    `data file is corrupt; moved to ${moved}; nothing was written. ` +
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
    throw new CorruptDataError(`cannot read the data file ${file}: ${(e as Error).message}; nothing was written.`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    const moved = `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    try {
      renameSync(file, moved);
      writeFileSync(marker, JSON.stringify({
        quarantined: moved, at: new Date().toISOString(),
        hint: "the original data file failed to parse; it was moved, nothing was overwritten; restore it manually or delete this marker to start fresh",
      }) + "\n");
    } catch { /* keep the parse error */ }
    process.stderr.write(`${file} is not valid JSON (${(e as Error).message}); moved to ${moved}\n`);
    throw blocked(file, moved);
  }
}

function file(): string { return join(dataDir(), "operations.json"); }

export function getOps(): OpRecord[] { return readJsonFile<OpRecord[]>(file(), []); }

export function addOp(rec: OpRecord): void {
  const all = getOps();
  all.push(rec);
  const trimmed = all.slice(-500);
  const p = file();
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(trimmed, null, 2));
  renameSync(tmp, p);
}
