import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { readJsonFile } from "@theluckystrike/mcp-timezone/lib";
import type { ChasedInvoice } from "./engine.js";

/**
 * The chase register lives in this server's OWN data directory,
 * `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/dunning-letters/`, in `invoices.json` and
 * `counter.json`. Nothing else is written anywhere: the letters this server renders are
 * handed back as text for the user to send, and are never stored or transmitted from here.
 *
 * Reads go through the timezone engine's `readJsonFile`, so a store that is not JSON is
 * quarantined byte-for-byte as `<file>.corrupt-<timestamp>` with a `.corrupt` marker beside
 * it, and every later call fails loudly instead of reporting an empty register over a file
 * that is still on disk.
 */

/**
 * Create the data directory and any missing ancestors, without mkdirSync's recursive mode.
 *
 * mkdirSync(recursive) never returns on a pseudo-filesystem: on Linux, mkdir under /proc
 * answers ENOENT, Node reads that as a missing parent and retries forever. The ancestors
 * are walked here under a hard bound and each level is created non-recursively, so a
 * repeated ENOENT terminates on the first one.
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
  const dir = join(base, "mcp-servers", "dunning-letters");
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
  const tmp = `${p}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, p);
}

export function getInvoices(): ChasedInvoice[] { return read<ChasedInvoice[]>("invoices.json", []); }
export function setInvoices(v: ChasedInvoice[]): void { write("invoices.json", v); }

/**
 * Allocate the next id in the series: `DUN-<YYYY>-<NNNN>`. The counter is written BEFORE
 * the record is stored, so a crash burns a number rather than reusing one. Ids already in
 * the store are also scanned, so a restored or hand-edited store cannot reissue a number.
 */
export function nextId(year: string, existing: string[]): string {
  const counters = read<Record<string, number>>("counter.json", {});
  const key = `DUN-${year}`;
  let n = counters[key] ?? 0;
  const used = new Set(existing);
  do { n += 1; } while (used.has(`${key}-${String(n).padStart(4, "0")}`));
  counters[key] = n;
  write("counter.json", counters);
  return `${key}-${String(n).padStart(4, "0")}`;
}

/**
 * Resolve an invoice by exact id (case-insensitive), then by exact reference. More than
 * one invoice can share a client name, so the client alone never resolves; a reference
 * that matches more than one is refused with the list rather than silently picking one.
 */
export function resolveInvoice(list: ChasedInvoice[], ref: string): ChasedInvoice {
  const needle = String(ref).trim().toLowerCase();
  if (!needle) throw new Error("which invoice? Pass its id (DUN-2026-0001) or its invoice reference.");
  const byId = list.find((i) => i.id.toLowerCase() === needle);
  if (byId) return byId;
  const byRef = list.filter((i) => i.reference.toLowerCase() === needle);
  if (byRef.length === 1) return byRef[0];
  if (byRef.length > 1) {
    throw new Error(`"${ref}" is the reference of more than one invoice: ${byRef.map((i) => `${i.id} (${i.client})`).join(", ")}. Pass the id.`);
  }
  throw new Error(`no invoice matches "${ref}". Known: ${list.map((i) => `${i.id} (${i.client}, ${i.reference})`).join(", ") || "none"}.`);
}
