/**
 * Enough of node:fs, backed by the per-request in-memory map in ctx(), for the
 * stdio servers' store modules to run unchanged on Workers. Everything the
 * request writes is flushed to KV by the worker after the response is built.
 */
import { ctx } from "./ctx.js";

function enoent(p: string): NodeJS.ErrnoException {
  const e = new Error(`ENOENT: no such file or directory, open '${p}'`) as NodeJS.ErrnoException;
  e.code = "ENOENT";
  return e;
}

export function existsSync(p: string): boolean {
  const c = ctx();
  return c.files.has(p) || c.dirs.has(p);
}

export function mkdirSync(p: string, _opts?: unknown): void { ctx().dirs.add(p); }

export function readFileSync(p: string, _enc?: unknown): string {
  const v = ctx().files.get(p);
  if (v === undefined) throw enoent(p);
  return v;
}

export function writeFileSync(p: string, data: string | Uint8Array, _opts?: unknown): void {
  ctx().files.set(p, typeof data === "string" ? data : new TextDecoder().decode(data));
}

export function renameSync(from: string, to: string): void {
  const c = ctx();
  const v = c.files.get(from);
  if (v === undefined) throw enoent(from);
  c.files.set(to, v);
  c.files.delete(from);
}

export function unlinkSync(p: string): void { ctx().files.delete(p); }
export function rmdirSync(p: string): void { ctx().dirs.delete(p); }
export function chmodSync(_p: string, _m: number): void { /* no permissions here */ }
export function statSync(p: string): { mtimeMs: number } {
  if (!existsSync(p)) throw enoent(p);
  return { mtimeMs: Date.now() };
}
export default { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, rmdirSync, chmodSync, statSync };
