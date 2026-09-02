import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

export interface Observation {
  /** ISO 8601 UTC */
  ts: string;
  /** decimal string, major unit, "." decimal separator */
  price: string;
  currency: string | null;
  source: string;
}

export interface Watch {
  id: string;
  url: string;
  label: string | null;
  /** decimal string or null */
  target_price: string | null;
  currency: string | null;
  created_at: string;
  observations: Observation[];
}

export interface DB { version: 1; watches: Watch[] }

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(base, "mcp-servers", "price-tracker");
}

export function dbPath(): string { return join(dataDir(), "watches.json"); }

export function load(): DB {
  try {
    const raw = readFileSync(dbPath(), "utf8");
    const db = JSON.parse(raw) as DB;
    if (!db || !Array.isArray(db.watches)) return { version: 1, watches: [] };
    return { version: 1, watches: db.watches };
  } catch { return { version: 1, watches: [] }; }
}

export function save(db: DB): void {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const p = dbPath();
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, p);
}

export function newId(): string { return randomBytes(4).toString("hex"); }

export function nowIso(): string { return new Date().toISOString(); }

/** Canonical form used to match URLs: scheme+host+path+query, no hash, no trailing slash. */
export function canonicalUrl(u: string): string {
  try {
    const url = new URL(u.trim());
    url.hash = "";
    let s = url.toString();
    if (s.endsWith("/") && url.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch { return u.trim(); }
}

export function findWatch(db: DB, key: string): Watch | undefined {
  const k = key.trim();
  const byId = db.watches.find((w) => w.id === k);
  if (byId) return byId;
  const c = canonicalUrl(k);
  return db.watches.find((w) => canonicalUrl(w.url) === c);
}

export function latest(w: Watch): Observation | undefined {
  return w.observations.length ? w.observations[w.observations.length - 1] : undefined;
}

export function previous(w: Watch): Observation | undefined {
  return w.observations.length > 1 ? w.observations[w.observations.length - 2] : undefined;
}

export function pctChange(from: string, to: string): number | null {
  const a = Number(from), b = Number(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / a) * 100;
}
