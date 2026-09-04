import { existsSync, mkdirSync, writeFileSync } from "../../shims/fs.js";
import { publishFile, readdirSync } from "../../shims/fs.js";

/**
 * Nothing larger is read into memory. fflate builds a zip in one buffer, so the peak is
 * roughly the sum of the inputs plus the archive; half a gigabyte of input is already
 * more than a Node default heap wants to hold twice.
 */
export const MAX_INPUT_BYTES = 512 * 1024 * 1024;

export const UPLOAD_ROOT = "/uploads/";
export const OUT_ROOT = "/out/";

/** The bare name a hosted path argument has to be, or a caller-facing refusal. */
export function archiveName(p: string, what: string): { base: string; ext: string } {
  const raw = String(p ?? "").trim();
  if (!raw) throw new Error(`${what} is required: it names a file uploaded with zip_upload`);
  const b = (raw.replace(/^~\/?/, "").split(/[\\/]/).pop() ?? "");
  const m = /^([A-Za-z0-9_-]{1,64})(\.[A-Za-z0-9]{1,8})?$/.exec(b);
  if (!m) {
    throw new Error(
      `${JSON.stringify(p)} is not a usable file name. On this hosted endpoint a path is just a name - ` +
      `the one you uploaded a file under with zip_upload, or the name to give an output: 1-64 characters ` +
      `of letters, digits, underscore or dash, optionally with an extension. zip_files lists what is stored.`);
  }
  return { base: m[1], ext: (m[2] ?? "").toLowerCase() };
}

/**
 * Resolve an input name: an upload wins, then something written earlier in this request.
 * With no extension every stored file whose name matches is considered, so "reports"
 * finds reports.zip and "notes" finds notes.txt.
 */
export function expandPath(p: string): string {
  const { base, ext } = archiveName(p, "path");
  for (const root of [UPLOAD_ROOT, OUT_ROOT]) {
    if (ext) {
      if (existsSync(`${root}${base}${ext}`)) return `${root}${base}${ext}`;
      continue;
    }
    for (const n of readdirSync(root)) if (n === base || n.startsWith(`${base}.`)) return `${root}${n}`;
  }
  return `${UPLOAD_ROOT}${base}${ext || ".zip"}`;
}

export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export interface Reservation { path: string; created: boolean }

/**
 * Reserve an output name. There is no disk, so a directory, a missing parent and someone
 * else's file are not failures that can happen; the only real clash is a name this same
 * request already produced, which overwrite still decides.
 */
export function reserveOutput(out: string, overwrite: boolean, ext = ".zip"): Reservation {
  const { base, ext: given } = archiveName(out, "out_path");
  const path = `${OUT_ROOT}${base}${given === ext ? given : ext}`;
  if (existsSync(path) && !overwrite) {
    throw new Error(`a file named ${path.slice(OUT_ROOT.length)} was already produced in this request. Pass overwrite: true to replace it, or give a different out_path. Nothing was written.`);
  }
  return { path, created: false };
}

export function releaseReservation(r: Reservation | null): void {
  if (!r || !r.created) return;
  try { if (statSync(r.path).size === 0) unlinkSync(r.path); } catch { /* leave it */ }
}

/** One write into the published root; publishFile turns it into a one-hour download link. */
export function writeAtomic(path: string, bytes: Uint8Array): number {
  writeFileSync(path, bytes);
  if (path.startsWith(OUT_ROOT)) publishFile(path);
  return bytes.length;
}

export function ensureDir(dir: string): void { mkdirSync(dir, { recursive: true }); }
