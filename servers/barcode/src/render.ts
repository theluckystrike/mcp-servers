import { existsSync, mkdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import { Jimp } from "jimp";
import { SANS_8_BLACK, SANS_16_BLACK, SANS_32_BLACK } from "jimp/fonts";
import { loadFont, measureText } from "jimp";
import type { Encoded } from "./symbology.js";

export type Format = "svg" | "png";

/** Largest PNG this server will paint, in pixels on a side. Beyond this the file is a wall. */
export const MAX_PX = 4000;
/** Smallest PNG that still scans: below this a QR module is under one printed dot. */
export const MIN_PX = 32;

/** A leading `<scheme>://` means the caller has a URL, not a local path. Checked BEFORE
 * any resolution, so a URL is never joined against the server's cwd and the refusal
 * never has a path in it, let alone one that leaks the cwd. */
const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

// D-R83: a URL handed to `out_path` used to be silently resolved as a relative
// filesystem path, producing an error that leaked the server's own cwd. Refused by
// name instead. There is no upload/fetch step here to point at: out_path only ever
// names where this tool writes, so the fix is to give it a local path.
export function expandPath(p: string): string {
  let s = String(p ?? "").trim();
  if (URL_SCHEME_RE.test(s)) {
    throw new Error(
      `"${s}" is a URL, not a file path; this tool writes local files. Give a local path to write to.`,
    );
  }
  if (s.startsWith("~/") || s === "~") s = s.replace("~", homedir());
  return isAbsolute(s) ? resolve(s) : resolve(process.cwd(), s);
}

/**
 * Everything known about an out_path before a single byte is written.
 *
 * The three failures worth naming separately are a directory (writing there throws EISDIR
 * from deep inside the encoder, which reads as a crash), a missing parent directory
 * (ENOENT, which reads as "the tool is broken"), and an existing file (silently replacing
 * someone's file is the expensive one). Path traversal is NOT rejected: out_path is the
 * caller's own filesystem and "../../x.png" is a legal relative path, the same rule
 * quotes and expense-tracker use. What is guaranteed is that the refusal is a sentence
 * and the target is untouched.
 */
export function checkOutPath(out: string, format: Format, overwrite: boolean): string {
  const p = expandPath(out);
  if (p === "" || p === "/") throw new Error(`out_path ${JSON.stringify(out)} is not a file path.`);
  // The directory check runs on the path AS GIVEN, before an extension is appended: a
  // directory named "labels" would otherwise become "labels.svg", a new file beside it,
  // and the caller would never learn that out_path was not the file they meant.
  let raw: ReturnType<typeof statSync> | null = null;
  try { raw = statSync(p); } catch { raw = null; }
  if (raw?.isDirectory()) {
    throw new Error(`out_path ${p} is a directory, not a file. Give it a file name, for example ${p}/code.${format}. Nothing was written.`);
  }
  const ext = extname(p).toLowerCase();
  const want = `.${format}`;
  const withExt = ext === want ? p : (ext === "" ? p + want : p);
  if (ext !== "" && ext !== want) {
    throw new Error(
      `out_path ends in "${ext}" but the requested format is ${format}. ` +
      `Rename it to ${want} or pass format: "${ext.slice(1)}" if that format is supported. Nothing was written.`,
    );
  }
  let st: ReturnType<typeof statSync> | null = null;
  try { st = statSync(withExt); } catch { st = null; }
  if (st?.isDirectory()) {
    throw new Error(`out_path ${withExt} is a directory, not a file. Give it a file name, for example ${withExt.replace(/\/$/, "")}/code${want}. Nothing was written.`);
  }
  if (st && !overwrite) {
    throw new Error(`${withExt} already exists (${st.size} bytes). Pass overwrite: true to replace it, or give a different out_path. Nothing was written.`);
  }
  const parent = dirname(withExt);
  if (!existsSync(parent)) {
    throw new Error(`the directory ${parent} does not exist, so ${withExt} cannot be written. Create it first, or give an out_path under a directory that exists. Nothing was written.`);
  }
  let pst: ReturnType<typeof statSync> | null = null;
  try { pst = statSync(parent); } catch { pst = null; }
  if (pst && !pst.isDirectory()) throw new Error(`${parent} is a file, not a directory, so ${withExt} cannot be written. Nothing was written.`);
  return withExt;
}

/** tmp + rename, so a half-written image never appears at out_path. */
export function writeAtomic(path: string, bytes: Buffer | string): number {
  const tmp = `${path}.${process.pid}.${Math.random().toString(16).slice(2, 8)}.tmp`;
  try {
    writeFileSync(tmp, bytes);
    renameSync(tmp, path);
  } catch (e) {
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* best effort */ }
    throw e;
  }
  return typeof bytes === "string" ? Buffer.byteLength(bytes) : bytes.length;
}

export function ensureDir(dir: string): void { mkdirSync(dir, { recursive: true }); }

/* ------------------------------------------------------------------ linear */

export interface LinearOptions {
  /** Pixels (PNG) or user units (SVG) per narrow module. */
  moduleWidth: number;
  /** Height of the bars, same units. */
  height: number;
  /** Print the digits under the bars. */
  text: boolean;
}

export const LINEAR_DEFAULTS: LinearOptions = { moduleWidth: 2, height: 80, text: true };

function runs(modules: boolean[]): { start: number; len: number }[] {
  const out: { start: number; len: number }[] = [];
  let i = 0;
  while (i < modules.length) {
    if (!modules[i]) { i++; continue; }
    let j = i;
    while (j < modules.length && modules[j]) j++;
    out.push({ start: i, len: j - i });
    i = j;
  }
  return out;
}

function layout(enc: Encoded, o: LinearOptions) {
  const textH = o.text && enc.human ? Math.max(8, Math.round(o.moduleWidth * 5)) : 0;
  const guardDrop = enc.guards.length && o.text ? Math.round(textH * 0.6) : 0;
  const w = (enc.modules.length + enc.quiet * 2) * o.moduleWidth;
  const h = o.height + textH;
  return { textH, guardDrop, w, h };
}

export function linearSvg(enc: Encoded, o: LinearOptions): string {
  const { textH, guardDrop, w, h } = layout(enc, o);
  const guard = new Set(enc.guards);
  const rects = runs(enc.modules).map((r) => {
    const isGuard = guard.has(r.start);
    const bh = o.height + (isGuard ? guardDrop : 0);
    const x = (r.start + enc.quiet) * o.moduleWidth;
    return `<rect x="${x}" y="0" width="${r.len * o.moduleWidth}" height="${bh}"/>`;
  }).join("");
  const label = textH
    ? `<text x="${w / 2}" y="${h - 1}" font-family="monospace" font-size="${textH}" text-anchor="middle" fill="#000000">${escapeXml(enc.human)}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">` +
    `<rect width="${w}" height="${h}" fill="#ffffff"/><g fill="#000000">${rects}</g>${label}</svg>\n`;
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string));
}

export async function linearPng(enc: Encoded, o: LinearOptions): Promise<Buffer> {
  const { textH, guardDrop, w, h } = layout(enc, o);
  const img = new Jimp({ width: w, height: h, color: 0xffffffff });
  const guard = new Set(enc.guards);
  for (const r of runs(enc.modules)) {
    const bh = o.height + (guard.has(r.start) ? guardDrop : 0);
    const x0 = (r.start + enc.quiet) * o.moduleWidth;
    for (let x = x0; x < x0 + r.len * o.moduleWidth; x++) {
      for (let y = 0; y < bh; y++) img.setPixelColor(0x000000ff, x, y);
    }
  }
  if (textH && enc.human) {
    const font = await loadFont(textH >= 28 ? SANS_32_BLACK : textH >= 14 ? SANS_16_BLACK : SANS_8_BLACK);
    const tw = measureText(font, enc.human);
    img.print({ font, x: Math.max(0, Math.round((w - tw) / 2)), y: Math.max(0, h - textH - 1), text: enc.human });
  }
  return Buffer.from(await img.getBuffer("image/png"));
}
