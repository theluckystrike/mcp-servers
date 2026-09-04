import { Buffer } from "node:buffer";
import { existsSync, mkdirSync, writeFileSync } from "../../shims/fs.js";
import { publishFile } from "../../shims/fs.js";
import { homedir } from "../../shims/os.js";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import { Jimp } from "../../../../node_modules/jimp/dist/esm/index.js";
import type { Encoded } from "./symbology.js";

export type Format = "svg" | "png";

/** Largest PNG this server will paint, in pixels on a side. Beyond this the file is a wall. */
export const MAX_PX = 4000;
/** Smallest PNG that still scans: below this a QR module is under one printed dot. */
export const MIN_PX = 32;

export const OUT_ROOT = "/out/";

/** The bare name a hosted out_path has to be, or a caller-facing refusal. */
export function expandPath(p: string): string {
  const raw = String(p ?? "").trim();
  const b = (raw.replace(/^~\/?/, "").split(/[\\/]/).pop() ?? "");
  const m = /^([A-Za-z0-9_-]{1,64})(\.[A-Za-z0-9]{1,8})?$/.exec(b);
  if (!m) {
    throw new Error(
      `${JSON.stringify(p)} is not a usable file name. On this hosted endpoint out_path is not a ` +
      `path: it is only the name the downloaded file carries, 1-64 characters of letters, digits, ` +
      `underscore or dash, optionally with a .svg or .png extension.`);
  }
  return `${OUT_ROOT}${m[1]}${(m[2] ?? "").toLowerCase()}`;
}

/**
 * Everything known about an out_path before a byte is written, hosted shape.
 *
 * There is no disk, so a directory, a missing parent and someone else's file are not
 * failures that can happen. The one check worth keeping is a name whose extension
 * disagrees with the requested format, which would otherwise publish a .png that is an
 * SVG and a caller would only find out in an image viewer.
 */
export function checkOutPath(out: string, format: Format, overwrite: boolean): string {
  const p = expandPath(out);
  const ext = (/\.[A-Za-z0-9]+$/.exec(p)?.[0] ?? "").toLowerCase();
  const want = `.${format}`;
  if (ext !== "" && ext !== want) {
    throw new Error(
      `out_path ends in "${ext}" but the requested format is ${format}. ` +
      `Rename it to ${want} or pass format: "${ext.slice(1)}" if that format is supported. Nothing was written.`);
  }
  const withExt = ext === want ? p : p + want;
  if (existsSync(withExt) && !overwrite) {
    throw new Error(`a file named ${withExt.slice(OUT_ROOT.length)} was already produced in this request. ` +
      `Pass overwrite: true to replace it, or give a different out_path. Nothing was written.`);
  }
  return withExt;
}

/** One write into the published root; publishFile turns it into a one-hour download link. */
export function writeAtomic(path: string, bytes: Buffer | string): number {
  writeFileSync(path, bytes as unknown as Uint8Array);
  publishFile(path);
  return typeof bytes === "string" ? Buffer.byteLength(bytes) : bytes.length;
}

export function ensureDir(dir: string): void { mkdirSync(dir, { recursive: true }); }

/** The modules of a QR code, painted with jimp: qrcode's own PNG renderer streams
 *  through pngjs's async deflate, and jimp is the encoder every other image on this
 *  worker already goes through. */
export async function qrPng(modules: { size: number; data: ArrayLike<number> }, width: number, margin: number): Promise<Buffer> {
  const n = modules.size;
  const total = n + margin * 2;
  const scale = Math.max(1, Math.floor(width / total));
  const px = total * scale;
  const img = new Jimp({ width: px, height: px, color: 0xffffffff });
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!modules.data[y * n + x]) continue;
      const x0 = (x + margin) * scale;
      const y0 = (y + margin) * scale;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) img.setPixelColor(0x000000ff, x0 + dx, y0 + dy);
    }
  }
  return Buffer.from(await img.getBuffer("image/png"));
}

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
  // The human-readable line is dropped in PNG: jimp's bitmap fonts are files on a disk
  // this endpoint does not have. The SVG renderer draws its own <text> and still carries it.
  return Buffer.from(await img.getBuffer("image/png"));
}
