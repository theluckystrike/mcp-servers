import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { PDFDocument } from "pdf-lib";

/** Nothing larger is read: a 100 MB PDF already needs more than a gigabyte of heap to rewrite. */
export const MAX_BYTES = 100 * 1024 * 1024;

/** A leading `<scheme>://` means the caller has a URL, not a local path. Checked BEFORE
 * any resolution, so a URL is never joined against the server's cwd and the refusal
 * never has a path in it, let alone one that leaks the cwd. */
const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

// D-R83: a URL handed to `path` used to be silently resolved as a relative filesystem
// path, producing a "does not exist" error that leaked the server's own cwd. Refused by
// name instead.
export function expandPath(p: string): string {
  if (URL_SCHEME_RE.test(p)) {
    throw new Error(
      `"${p}" is a URL, not a file path; this tool reads local files. On the hosted route, ` +
      `use the url argument of pdf_upload. Locally, download it first and pass the path it was saved to.`,
    );
  }
  const s = p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
  return isAbsolute(s) ? s : resolvePath(process.cwd(), s);
}

export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export interface LoadedPdf {
  path: string;
  bytes: Uint8Array;
  size: number;
  doc: PDFDocument;
  pageCount: number;
  /** The PDF/A level the file claims for itself, if any. Not validated here. */
  pdfa: string | null;
}

/**
 * Read one input file. Encryption is not "handled with a warning": pdf-lib cannot
 * decrypt, and loading with ignoreEncryption yields garbage pages that would be
 * written into the output. Such a file is refused with the reason named.
 */
export async function loadPdf(input: string): Promise<LoadedPdf> {
  const path = expandPath(input);
  if (!existsSync(path)) throw new Error(`${path} does not exist. Give the full path to an existing PDF file.`);
  const st = statSync(path);
  if (st.isDirectory()) throw new Error(`${path} is a directory, not a PDF file.`);
  if (st.size === 0) throw new Error(`${path} is empty (0 bytes); nothing to read.`);
  if (st.size > MAX_BYTES) {
    throw new Error(
      `${path} is ${humanBytes(st.size)}; this server refuses inputs over ${humanBytes(MAX_BYTES)} ` +
      `because rewriting one needs several times that in memory. Split the file with another tool first.`,
    );
  }
  const bytes = readFileSync(path);
  const head = bytes.subarray(0, 1024).toString("latin1");
  if (!head.includes("%PDF-")) {
    throw new Error(`${path} does not start with %PDF-, so it is not a PDF file. Nothing was read.`);
  }
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    if (/encrypt/i.test(msg) || /password/i.test(msg)) {
      throw new Error(
        `${path} is encrypted (password or permissions protected) and was refused. ` +
        `This server never guesses or strips a password. Remove the protection in a PDF reader ` +
        `(open with the password, then export or print to a new PDF) and try again with that file.`,
      );
    }
    throw new Error(`${path} could not be parsed as a PDF: ${msg}`);
  }
  return { path, bytes, size: st.size, doc, pageCount: doc.getPageCount(), pdfa: pdfaClaim(bytes) };
}

/** True when the trailer names an /Encrypt dictionary, used by pdf_info to report the flag. */
export function looksEncrypted(bytes: Uint8Array): boolean {
  const s = Buffer.from(bytes).toString("latin1");
  return /\/Encrypt\s+\d+\s+\d+\s+R/.test(s) || /\/Encrypt\s*<</.test(s);
}

export interface Reservation { path: string; created: boolean }

/**
 * Reserve an output path with an exclusive create, not an existence check: two
 * processes writing the same out_path with overwrite:false would both pass a check
 * and the second would clobber the first. The reservation is a real 0-byte file, so
 * it is released again if the work that follows fails.
 */
export function reserveOutput(out: string, overwrite: boolean, inputs: string[] = [], ext = ".pdf"): Reservation {
  const p = expandPath(out);
  const withExt = p.toLowerCase().endsWith(ext) ? p : `${p}${ext}`;
  // An output that is also an input destroys the source: the pages already in memory
  // are written back over the file they came from, so a 3-page file becomes the
  // 1 page that was extracted and every later operation reads the wrong document.
  // overwrite: true is consent to replace some other file, never to consume the input.
  for (const raw of inputs) {
    const inPath = expandPath(raw);
    if (inPath === withExt || sameFile(inPath, withExt)) {
      throw new Error(
        `out_path ${withExt} is also an input of this operation, so writing it would destroy the source ` +
        `(the pages are already in memory and would be written back over the file they came from). ` +
        `Nothing was written. Write beside it instead - ${withExt.replace(/\.pdf$/i, "")}-out.pdf - and, if the ` +
        `result really is meant to take the original's place, rename it yourself once you have checked it. ` +
        `overwrite: true is consent to replace some other file, never to consume an input.`,
      );
    }
  }
  mkdirSync(dirname(withExt), { recursive: true });
  if (overwrite) return { path: withExt, created: false };
  try {
    closeSync(openSync(withExt, "wx"));
    return { path: withExt, created: true };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    throw new Error(
      `${withExt} already exists and nothing was written. ` +
      `Pass overwrite: true to replace it, or give a different out_path.`,
    );
  }
}

export function releaseReservations(rs: Reservation[]): void {
  for (const r of rs) {
    if (!r.created) continue;
    try { if (statSync(r.path).size === 0) unlinkSync(r.path); } catch { /* leave it */ }
  }
}

/** Same inode, so a symlink or a second path to the same file is caught too. */
function sameFile(a: string, b: string): boolean {
  try {
    const x = statSync(a), y = statSync(b);
    return x.dev === y.dev && x.ino === y.ino;
  } catch { return false; }
}

/**
 * A file that carries an XMP pdfaid claim says it is PDF/A. Nothing here validates
 * that claim, and every write path below breaks it (a stamp adds a font that is not
 * embedded to the standard PDF/A requires; a merge builds a new document without the
 * source OutputIntents), so the claim is reported and the break is stated.
 */
export function pdfaClaim(bytes: Uint8Array): string | null {
  const s = Buffer.from(bytes).toString("latin1");
  const part = /pdfaid:part\s*[>=]\s*"?(\d)/.exec(s) ?? /<pdfaid:part>\s*(\d)/.exec(s);
  if (!part) return null;
  const conf = /pdfaid:conformance\s*[>=]\s*"?([AaBbUu])/.exec(s) ?? /<pdfaid:conformance>\s*([AaBbUu])/.exec(s);
  return `PDF/A-${part[1]}${conf ? conf[1].toLowerCase() : ""}`;
}

export interface Range { from: number; to: number; label: string }

/**
 * "1-3,5,7-" against a 9-page file -> 1-3, 5-5, 7-9. An open-ended part runs to the
 * last page. Every number is 1-based, as a person counts pages, and a number past the
 * end is an error rather than a silent clamp.
 */
export function parseRanges(spec: string, pageCount: number): Range[] {
  const out: Range[] = [];
  const parts = spec.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  if (!parts.length) throw new Error(`empty page range. Use something like "1-3,5,7-".`);
  for (const part of parts) {
    const m = /^(\d+)?\s*(-)?\s*(\d+)?$/.exec(part);
    if (!m || (!m[1] && !m[3])) throw new Error(`cannot read "${part}" as a page range. Use "1-3", "5", "7-" or "-4".`);
    const open = !!m[2];
    let from = m[1] ? Number(m[1]) : 1;
    let to = open ? (m[3] ? Number(m[3]) : pageCount) : (m[1] ? Number(m[1]) : Number(m[3]));
    if (!open && m[1] && m[3]) { from = Number(m[1]); to = Number(m[3]); }
    if (from < 1 || to < 1) throw new Error(`page numbers start at 1; "${part}" does not.`);
    if (from > pageCount || to > pageCount) {
      throw new Error(`"${part}" asks for a page past the end: the file has ${pageCount} page${pageCount === 1 ? "" : "s"}.`);
    }
    if (from > to) throw new Error(`"${part}" runs backwards; write it as ${to}-${from}.`);
    out.push({ from, to, label: from === to ? `${from}` : `${from}-${to}` });
  }
  return out;
}

/** "2,4-6" -> zero-based [1,3,4,5], in the order written. Duplicates are kept: asking for a page twice copies it twice. */
export function parsePageList(spec: string, pageCount: number): number[] {
  const idx: number[] = [];
  for (const r of parseRanges(spec, pageCount)) {
    for (let p = r.from; p <= r.to; p++) idx.push(p - 1);
  }
  return idx;
}
