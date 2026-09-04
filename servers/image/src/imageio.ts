import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { Jimp } from "jimp";

/** Nothing larger is read. A 50 MB JPEG already decodes to hundreds of megabytes of RGBA. */
export const MAX_BYTES = 50 * 1024 * 1024;
/**
 * A decompression bomb is small on disk and enormous in memory: a 46 KB PNG can declare
 * 64000x64000, which is 16 GB of RGBA. The declared size is read from the file header and
 * refused BEFORE any decoder touches the pixels, which is the only point at which the
 * refusal is free.
 */
export const MAX_DIM = 10_000;

export type Fmt = "png" | "jpeg" | "bmp" | "gif" | "tiff";

export const MIME: Record<Fmt, string> = {
  png: "image/png", jpeg: "image/jpeg", bmp: "image/bmp", gif: "image/gif", tiff: "image/tiff",
};

export const EXT: Record<Fmt, string> = {
  png: ".png", jpeg: ".jpg", bmp: ".bmp", gif: ".gif", tiff: ".tif",
};

const EXT_TO_FMT: Record<string, Fmt> = {
  ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".jpe": "jpeg",
  ".bmp": "bmp", ".dib": "bmp", ".gif": "gif", ".tif": "tiff", ".tiff": "tiff",
};

export function formatFromExt(path: string): Fmt | null {
  return EXT_TO_FMT[extname(path).toLowerCase()] ?? null;
}

export function expandPath(p: string): string {
  const s = p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
  return isAbsolute(s) ? s : resolvePath(process.cwd(), s);
}

export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function detectFormat(b: Uint8Array): Fmt | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return "bmp";
  if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
    (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a))) return "tiff";
  return null;
}

const be32 = (b: Uint8Array, o: number) => (b[o] * 0x1000000) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const be16 = (b: Uint8Array, o: number) => (b[o] << 8) + b[o + 1];
const le16 = (b: Uint8Array, o: number) => b[o] + (b[o + 1] << 8);
const le32 = (b: Uint8Array, o: number) => b[o] + (b[o + 1] << 8) + (b[o + 2] << 16) + (b[o + 3] * 0x1000000);

/**
 * Declared pixel dimensions read from the container header only. Returns null when the
 * header cannot be read, in which case the caller decodes and checks afterwards.
 */
export function probeDimensions(b: Uint8Array, fmt: Fmt): { width: number; height: number } | null {
  try {
    if (fmt === "png") {
      if (b.length < 24) return null;
      return { width: be32(b, 16), height: be32(b, 20) };
    }
    if (fmt === "gif") {
      if (b.length < 10) return null;
      return { width: le16(b, 6), height: le16(b, 8) };
    }
    if (fmt === "bmp") {
      if (b.length < 26) return null;
      const w = le32(b, 18), h = le32(b, 22);
      // A bottom-up BMP stores a negative height.
      return { width: Math.abs(w | 0), height: Math.abs(h | 0) };
    }
    if (fmt === "jpeg") {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const marker = b[i + 1];
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
        const len = be16(b, i + 2);
        const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isSOF) return { height: be16(b, i + 5), width: be16(b, i + 7) };
        if (len < 2) return null;
        i += 2 + len;
      }
      return null;
    }
    if (fmt === "tiff") {
      const little = b[0] === 0x49;
      const u16 = (o: number) => (little ? le16(b, o) : be16(b, o));
      const u32 = (o: number) => (little ? le32(b, o) : be32(b, o));
      const ifd = u32(4);
      if (ifd + 2 > b.length) return null;
      const n = u16(ifd);
      let width = 0, height = 0;
      for (let e = 0; e < n; e++) {
        const off = ifd + 2 + e * 12;
        if (off + 12 > b.length) break;
        const tag = u16(off);
        const type = u16(off + 2);
        const val = type === 3 ? u16(off + 8) : u32(off + 8);
        if (tag === 0x0100) width = val;
        if (tag === 0x0101) height = val;
      }
      return width && height ? { width, height } : null;
    }
  } catch { return null; }
  return null;
}

/**
 * jimp ships dual (ESM and CJS) type declarations, and `InstanceType<typeof Jimp>`
 * resolves through a different one than `Jimp.read` does, which TypeScript then reports
 * as two unrelated types with the same name. Deriving the type from `read` itself is the
 * alias that matches every value this server actually handles.
 */
export type Img = Awaited<ReturnType<typeof Jimp.read>>;

export interface LoadedImage {
  path: string;
  size: number;
  format: Fmt;
  width: number;
  height: number;
  hasAlpha: boolean;
  /** Dimensions declared in the container header, before any EXIF orientation was applied. */
  declared: { width: number; height: number } | null;
  /** Frames in the container. 1 for a still; more for an animated GIF; null when unknown. */
  frames: number | null;
  image: Img;
}

/**
 * Frames in a GIF, counted by walking the block stream. An animated GIF decodes to its
 * first frame here, and a caller who is told "1 frame" when there are 24 has lost 23 of
 * them without being told.
 */
export function gifFrameCount(b: Uint8Array): number | null {
  try {
    let i = 13;
    if (b[10] & 0x80) i += 3 * (1 << ((b[10] & 0x07) + 1));
    let frames = 0;
    const skipSub = () => { while (i < b.length && b[i] !== 0) i += 1 + b[i]; i++; };
    while (i < b.length) {
      const block = b[i];
      if (block === 0x3b) break;
      if (block === 0x21) { i += 2; skipSub(); continue; }
      if (block === 0x2c) {
        frames++;
        const flags = b[i + 9];
        i += 10;
        if (flags & 0x80) i += 3 * (1 << ((flags & 0x07) + 1));
        i++;
        skipSub();
        continue;
      }
      return frames || null;
    }
    return frames || null;
  } catch { return null; }
}

/** Read guards that run before the decoder, in the order that makes each one free. */
export function guardInput(input: string): { path: string; bytes: Buffer; size: number; format: Fmt; declared: { width: number; height: number } | null } {
  const path = expandPath(input);
  if (!existsSync(path)) throw new Error(`${path} does not exist. Give the full path to an existing image file.`);
  const st = statSync(path);
  if (st.isDirectory()) throw new Error(`${path} is a directory, not an image file.`);
  if (st.size === 0) throw new Error(`${path} is empty (0 bytes); nothing to read.`);
  if (st.size > MAX_BYTES) {
    throw new Error(
      `${path} is ${humanBytes(st.size)}; this server refuses inputs over ${humanBytes(MAX_BYTES)} ` +
      `because decoding one needs several times that in memory as raw RGBA.`,
    );
  }
  const bytes = readFileSync(path);
  const format = detectFormat(bytes);
  if (!format) {
    throw new Error(
      `${path} does not start with the magic bytes of a PNG, JPEG, BMP, GIF or TIFF, so it was not decoded. ` +
      `Nothing was read.`,
    );
  }
  const declared = probeDimensions(bytes, format);
  if (declared && (declared.width > MAX_DIM || declared.height > MAX_DIM)) {
    throw new Error(
      `${path} declares ${declared.width}x${declared.height} pixels in its ${format.toUpperCase()} header and was ` +
      `refused before decoding: this server caps a side at ${MAX_DIM} px. A small file that declares an enormous ` +
      `canvas is a decompression bomb - decoding it would allocate ${Math.round(declared.width * declared.height * 4 / (1024 * 1024))} MB of RGBA. ` +
      `Nothing was decoded.`,
    );
  }
  if (declared && (declared.width < 1 || declared.height < 1)) {
    throw new Error(`${path} declares ${declared.width}x${declared.height} pixels, which is not an image.`);
  }
  return { path, bytes, size: st.size, format, declared };
}

export async function loadImage(input: string): Promise<LoadedImage> {
  const g = guardInput(input);
  let image: Img;
  try {
    image = await Jimp.read(g.bytes);
  } catch (e) {
    throw new Error(`${g.path} could not be decoded as ${g.format.toUpperCase()}: ${String((e as Error).message ?? e)}`);
  }
  // The header probe can be missing (an unusual TIFF IFD, a JPEG with no readable SOF),
  // so the decoded size is checked too rather than trusted.
  if (image.width > MAX_DIM || image.height > MAX_DIM) {
    throw new Error(
      `${g.path} decoded to ${image.width}x${image.height} pixels; this server caps a side at ${MAX_DIM} px.`,
    );
  }
  return {
    path: g.path, size: g.size, format: g.format,
    width: image.width, height: image.height, hasAlpha: image.hasAlpha(),
    declared: g.declared, frames: g.format === "gif" ? gifFrameCount(g.bytes) : 1,
    image,
  };
}

export interface Reservation { path: string; created: boolean }

/**
 * Reserve an output path with an exclusive create, not an existence check: two processes
 * writing the same out_path with overwrite:false would both pass a check and the second
 * would clobber the first. The reservation is a real 0-byte file, so it can be released
 * again if the work that follows fails.
 */
export function reserveOutput(out: string, overwrite: boolean, inputs: string[] = [], ext = ""): Reservation {
  const p = expandPath(out);
  const withExt = !ext || p.toLowerCase().endsWith(ext) ? p : `${p}${ext}`;
  // An output that is also an input destroys the source: the pixels are already decoded
  // in memory and would be written back over the file they came from, so a 4000 px
  // original becomes the 512 px thumbnail and every later read of that path is wrong.
  // overwrite: true is consent to replace some other file, never to consume an input.
  for (const raw of inputs) {
    const inPath = expandPath(raw);
    if (inPath === withExt || sameFile(inPath, withExt)) {
      throw new Error(
        `out_path ${withExt} is also an input of this operation, so writing it would destroy the source ` +
        `(the pixels are already decoded and would be written back over the file they came from). ` +
        `Nothing was written. Write beside it instead - ${withExt.replace(/(\.[a-z0-9]+)$/i, "-out$1")} - and, if the ` +
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
export function sameFile(a: string, b: string): boolean {
  try {
    const x = statSync(a), y = statSync(b);
    return x.dev === y.dev && x.ino === y.ino;
  } catch { return false; }
}

export function megapixels(w: number, h: number): number {
  return Math.round((w * h) / 10_000) / 100;
}
