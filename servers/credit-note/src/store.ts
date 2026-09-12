import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { readJsonFile } from "./jsonstore.js";
import type { CreditNote } from "./note.js";

/**
 * Credit notes live in this server's OWN data directory,
 * `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/credit-note/`, in `notes.json` and
 * `counter.json`. Nothing else is written anywhere: the Markdown and HTML renders are
 * returned as text and are never written to a file from here.
 */

/**
 * Create a directory and any missing ancestors, without mkdirSync's recursive mode:
 * recursive mode livelocks forever under /proc, /sys and /dev when a caller-supplied
 * path points there. The ancestors are walked here under a hard bound and each level
 * is created non-recursively, so a bad path fails fast instead.
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

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "credit-note");
  ensureDirBounded(dir);
  return dir;
}

export function lockPath(): string { return join(dataDir(), ".lock"); }

function read<T>(file: string, empty: T): T {
  return readJsonFile<T>(join(dataDir(), file), empty);
}

/** Atomic: per-process temp name, then rename over the target. */
function write(file: string, value: unknown): void {
  const p = join(dataDir(), file);
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, p);
}

export function getNotes(): CreditNote[] { return read<CreditNote[]>("notes.json", []); }
export function setNotes(v: CreditNote[]): void { write("notes.json", v); }

/**
 * Allocate the next id in a series: `<PREFIX>-<YYYY>-<NNNN>`.
 *
 * The counter is per prefix and per year and is written BEFORE the record is stored, so
 * a crash burns a number rather than reusing one. Ids already in the store are also
 * scanned, so a restored or hand-edited store cannot reissue a number that is already
 * written on a credit note a client has.
 */
export function nextId(prefix: "CN" | "CN-DRAFT", year: string, existing: string[]): string {
  const counters = read<Record<string, number>>("counter.json", {});
  const key = `${prefix}-${year}`;
  let n = counters[key] ?? 0;
  const used = new Set(existing);
  do { n += 1; } while (used.has(`${key}-${String(n).padStart(4, "0")}`));
  counters[key] = n;
  write("counter.json", counters);
  return `${key}-${String(n).padStart(4, "0")}`;
}
