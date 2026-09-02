/**
 * Enough of node:fs, backed by the per-request in-memory map in ctx(), for the
 * stdio servers' store modules to run unchanged on Workers. Everything the
 * request writes is flushed to KV by the worker after the response is built.
 *
 * Values in the map are strings. A binary file (an xlsx workbook) is stored as
 * BIN + base64, so the whole virtual filesystem stays JSON-serialisable for KV.
 *
 * An atomic write (tmp + rename) that lands on a path the request context wants
 * published becomes a one-hour download link; the worker substitutes the URL for
 * the virtual path in the response body.
 */
import { Buffer } from "node:buffer";
import { ctx } from "./ctx.js";

/** Marks a base64-encoded binary value. A real text file never starts with NUL. */
export const BIN = "\u0000b64\u0000";

const MIME: Record<string, string> = {
  csv: "text/csv; charset=utf-8",
  tsv: "text/tab-separated-values; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  json: "application/json; charset=utf-8",
  html: "text/html; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  pdf: "application/pdf",
};

function enoent(p: string): NodeJS.ErrnoException {
  const e = new Error(`ENOENT: no such file or directory, open '${p}'`) as NodeJS.ErrnoException;
  e.code = "ENOENT";
  return e;
}

function isBin(v: string): boolean { return v.startsWith(BIN); }

/** Byte length of a stored value, without materialising the bytes for text. */
export function byteLen(v: string): number {
  if (isBin(v)) {
    const b64 = v.slice(BIN.length);
    const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
    return Math.floor((b64.length * 3) / 4) - pad;
  }
  return new TextEncoder().encode(v).length;
}

function randHex(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Turn a finished file into a KV-backed download; returns the URL. */
export function publishFile(p: string): string | null {
  const c = ctx();
  const v = c.files.get(p);
  if (v === undefined) return null;
  const existing = c.published.get(p);
  if (existing) return existing;
  const ext = (/\.([A-Za-z0-9]+)$/.exec(p)?.[1] ?? "").toLowerCase();
  const token = randHex();
  c.downloads.push({
    token,
    mime: MIME[ext] ?? "application/octet-stream",
    body: isBin(v) ? v.slice(BIN.length) : v,
    filename: p.split("/").pop() || "download",
    encoding: isBin(v) ? "base64" : undefined,
  });
  const url = `${c.baseUrl}/mcp/download/${token}`;
  c.published.set(p, url);
  return url;
}

export function existsSync(p: string): boolean {
  const c = ctx();
  return c.files.has(p) || c.dirs.has(p);
}

export function mkdirSync(p: string, _opts?: unknown): void { ctx().dirs.add(p); }

export function readFileSync(p: string, enc?: unknown): any {
  const v = ctx().files.get(p);
  if (v === undefined) throw enoent(p);
  const wantsText = typeof enc === "string" || (!!enc && typeof enc === "object" && !!(enc as any).encoding);
  if (isBin(v)) {
    const buf = Buffer.from(v.slice(BIN.length), "base64");
    return wantsText ? buf.toString("utf8") : buf;
  }
  return wantsText ? v : Buffer.from(v, "utf8");
}

export const TMP_RE = /\.tmp(-.*)?$|\.[0-9]*\.tmp$/;

/**
 * Bytes this tenant would keep after the write of `writing` completes. Scratch files
 * are ignored, and the file a scratch file is about to replace is counted once, so an
 * atomic tmp+rename is not charged twice.
 */
export function totalBytes(files: Map<string, string>, writing?: string): number {
  const replaced = writing && TMP_RE.test(writing) ? writing.replace(TMP_RE, "") : undefined;
  let n = 0;
  for (const [k, v] of files) {
    if (k !== writing && TMP_RE.test(k)) continue;
    if (replaced !== undefined && k === replaced) continue;
    n += k.length + byteLen(v);
  }
  return n;
}

export function writeFileSync(p: string, data: string | Uint8Array, _opts?: unknown): void {
  const c = ctx();
  const prev = c.files.get(p);
  c.files.set(p, typeof data === "string" ? data : BIN + Buffer.from(data).toString("base64"));
  const cap = c.maxBytes;
  if (cap !== undefined && totalBytes(c.files, p) > cap) {
    if (prev === undefined) c.files.delete(p); else c.files.set(p, prev);
    throw new Error(
      `the data stored for your token on the hosted ${c.server} endpoint would go over the ${Math.round(cap / 1024)} KB cap. ` +
      `Nothing was written and nothing already stored was changed. ` +
      `Export what you need to keep (expense_export, export_csv or sheet_convert give you a download link), ` +
      `delete what you no longer need (expense_delete, watch_remove, entry_delete or sheet_unload), ` +
      `or run this server locally over stdio, where there is no cap.`);
  }
}

export function appendFileSync(p: string, data: string): void {
  const c = ctx();
  c.files.set(p, (c.files.get(p) ?? "") + data);
}

export function renameSync(from: string, to: string): void {
  const c = ctx();
  const v = c.files.get(from);
  if (v === undefined) throw enoent(from);
  c.files.set(to, v);
  c.files.delete(from);
  if (c.publish && c.publish(to)) publishFile(to);
}

export function unlinkSync(p: string): void { ctx().files.delete(p); }
export function rmdirSync(p: string): void { ctx().dirs.delete(p); }
export function chmodSync(_p: string, _m: number): void { /* no permissions here */ }

export interface VStat { mtimeMs: number; size: number; isFile(): boolean; isDirectory(): boolean }

export function statSync(p: string): VStat {
  const c = ctx();
  const v = c.files.get(p);
  if (v === undefined) {
    if (c.dirs.has(p)) return { mtimeMs: Date.now(), size: 0, isFile: () => false, isDirectory: () => true };
    throw enoent(p);
  }
  return { mtimeMs: Date.now(), size: byteLen(v), isFile: () => true, isDirectory: () => false };
}

export default {
  existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync,
  renameSync, unlinkSync, rmdirSync, chmodSync, statSync,
};
