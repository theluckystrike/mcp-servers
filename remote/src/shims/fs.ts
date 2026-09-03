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
import { ctx, type RequestCtx } from "./ctx.js";

/** Marks a base64-encoded binary value. A real text file never starts with NUL. */
export const BIN = "\u0000b64\u0000";

const MIME: Record<string, string> = {
  csv: "text/csv; charset=utf-8",
  tsv: "text/tab-separated-values; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  json: "application/json; charset=utf-8",
  html: "text/html; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ics: "text/calendar; charset=utf-8",
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

/** Hard ceiling on how many persisted files one tenant may keep per endpoint. */
export const MAX_FILES = 64;

function entrySize(k: string, v: string): number { return k.length + byteLen(v); }

/**
 * True for a path that belongs to a cross-tenant shared cache, and for the scratch file
 * of an atomic write onto one. Those bytes are not the tenant's, so they are neither
 * charged against the tenant's caps nor persisted into the tenant document.
 */
export function isShared(c: RequestCtx, p: string): boolean {
  const s = c.shared;
  if (!s || s.size === 0) return false;
  if (s.has(p)) return true;
  return TMP_RE.test(p) && s.has(p.replace(TMP_RE, ""));
}

/**
 * Persisted-byte and file counters for a hydrated map. Called once per request; every
 * later mutation adjusts the counters incrementally, so no write rescans the map.
 */
export function recount(files: Map<string, string>): { bytes: number; nfiles: number } {
  let bytes = 0, nfiles = 0;
  for (const [k, v] of files) {
    if (TMP_RE.test(k)) continue;
    bytes += entrySize(k, v);
    nfiles++;
  }
  return { bytes, nfiles };
}

/**
 * Bytes this tenant would keep after the write of `writing` completes. Scratch files
 * are ignored, and the file a scratch file is about to replace is counted once, so an
 * atomic tmp+rename is not charged twice. Kept as the reference definition of the cap;
 * the request path uses the incremental counters below, which agree with it.
 */
export function totalBytes(files: Map<string, string>, writing?: string): number {
  const replaced = writing && TMP_RE.test(writing) ? writing.replace(TMP_RE, "") : undefined;
  let n = 0;
  for (const [k, v] of files) {
    if (k !== writing && TMP_RE.test(k)) continue;
    if (replaced !== undefined && k === replaced) continue;
    n += entrySize(k, v);
  }
  return n;
}

/** Incremental equivalent of totalBytes(c.files, p) for a write of `value` to `p`. */
function projectedBytes(c: RequestCtx, p: string, value: string): number {
  let n = c.bytes;
  if (TMP_RE.test(p)) {
    const target = p.replace(TMP_RE, "");
    const cur = c.files.get(target);
    if (cur !== undefined && !TMP_RE.test(target)) n -= entrySize(target, cur);
    return n + entrySize(p, value);
  }
  const prev = c.files.get(p);
  if (prev !== undefined) n -= entrySize(p, prev);
  return n + entrySize(p, value);
}

function capError(c: RequestCtx, cap: number): Error {
  return new Error(
    `the data stored for your token on the hosted ${c.server} endpoint would go over the ${Math.round(cap / 1024)} KB cap. ` +
    `Nothing was written and nothing already stored was changed. ` +
    `Export what you need to keep (expense_export, export_csv or sheet_convert give you a download link), ` +
    `delete what you no longer need (expense_delete, watch_remove, entry_delete or sheet_unload), ` +
    `or run this server locally over stdio, where there is no cap.`);
}

function countError(c: RequestCtx): Error {
  return new Error(
    `your token already keeps ${MAX_FILES} files on the hosted ${c.server} endpoint, which is the limit. ` +
    `Nothing was written and nothing already stored was changed. ` +
    `Delete something first (sheet_unload, expense_delete, watch_remove or entry_delete), ` +
    `or run this server locally over stdio, where there is no limit.`);
}

/** Write through the counters: c.bytes and c.nfiles cover the persisted (non-scratch) files. */
function setFile(c: RequestCtx, k: string, v: string): void {
  const prev = c.files.get(k);
  if (isShared(c, k)) { c.files.set(k, v); return; }
  if (!TMP_RE.test(k)) {
    if (prev === undefined) c.nfiles++; else c.bytes -= entrySize(k, prev);
    c.bytes += entrySize(k, v);
  }
  c.files.set(k, v);
}

function delFile(c: RequestCtx, k: string): void {
  const prev = c.files.get(k);
  if (prev === undefined) return;
  if (isShared(c, k)) { c.files.delete(k); return; }
  if (!TMP_RE.test(k)) { c.bytes -= entrySize(k, prev); c.nfiles--; }
  c.files.delete(k);
}

/** Both caps, checked before the map is touched. Throws with caller-facing text. */
function checkCaps(c: RequestCtx, p: string, value: string): void {
  if (isShared(c, p)) return;   // shared cache bytes are nobody's tenant data
  const cap = c.maxBytes;
  if (cap !== undefined && projectedBytes(c, p, value) > cap) throw capError(c, cap);
  const isNew = !c.files.has(p);
  if (isNew && !TMP_RE.test(p) && c.nfiles >= MAX_FILES) throw countError(c);
  // Scratch files are not persisted, but an unbounded number of them still costs memory.
  if (isNew && c.files.size >= MAX_FILES * 2) throw countError(c);
}

export function writeFileSync(p: string, data: string | Uint8Array, _opts?: unknown): void {
  const c = ctx();
  const value = typeof data === "string" ? data : BIN + Buffer.from(data).toString("base64");
  checkCaps(c, p, value);
  setFile(c, p, value);
}

/** Same aggregate cap as writeFileSync: an append is a write of the concatenation. */
export function appendFileSync(p: string, data: string): void {
  const c = ctx();
  const value = (c.files.get(p) ?? "") + data;
  checkCaps(c, p, value);
  setFile(c, p, value);
}

export function renameSync(from: string, to: string): void {
  const c = ctx();
  const v = c.files.get(from);
  if (v === undefined) throw enoent(from);
  if (!c.files.has(to) && !isShared(c, to)) {
    if (!TMP_RE.test(to) && c.nfiles >= MAX_FILES) throw countError(c);
  }
  setFile(c, to, v);
  delFile(c, from);
  if (c.publish && c.publish(to)) publishFile(to);
}

export function unlinkSync(p: string): void { delFile(ctx(), p); }
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

// fd emulation for chunked readers (spreadsheet readCsvHead). Descriptors live in the
// request context, never in module scope, so two concurrent requests cannot see each
// other's files, and a null position advances that descriptor's own offset.
export function openSync(p: string, flags?: unknown): number {
  const c = ctx();
  if (typeof flags === "string" && flags.includes("x")) {
    if (c.files.has(p)) { const e: any = new Error(`EEXIST: file already exists, open '${p}'`); e.code = "EEXIST"; throw e; }
    writeFileSync(p, "");
  }
  const v = c.files.get(p);
  if (v === undefined) throw enoent(p);
  const buf = isBin(v) ? Buffer.from(v.slice(BIN.length), "base64") : Buffer.from(v, "utf8");
  const fd = c.nextFd++;
  c.fds.set(fd, { buf, pos: 0 });
  return fd;
}

export function readSync(fd: number, out: Uint8Array, offset: number, length: number, position?: number | null): number {
  const h = ctx().fds.get(fd);
  if (!h) throw new Error("EBADF: bad file descriptor");
  const useOffset = position === null || position === undefined;
  const pos = useOffset ? h.pos : position;
  if (pos < 0) throw new Error("EINVAL: invalid position");
  const n = Math.max(0, Math.min(length, h.buf.length - pos));
  if (n > 0) out.set(h.buf.subarray(pos, pos + n), offset);
  if (useOffset) h.pos = pos + n;
  return n;
}

export function closeSync(fd: number): void { ctx().fds.delete(fd); }
