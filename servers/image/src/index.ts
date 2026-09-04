#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, readSharedProfile, withFileLock } from "@theluckystrike/mcp-license";
import { Jimp, intToRGBA, loadFont, measureText, measureTextHeight } from "jimp";
import { SANS_8_WHITE, SANS_16_WHITE, SANS_32_WHITE, SANS_64_WHITE, SANS_128_WHITE } from "jimp/fonts";
import { z } from "zod";
import {
  EXT, MAX_BYTES, MAX_DIM, expandPath, formatFromExt, humanBytes, loadImage, megapixels,
  releaseReservations, reserveOutput, type Fmt, type Img, type LoadedImage, type Reservation,
} from "./imageio.js";
import { addOp, dataDir, getOps } from "./store.js";

/** The free tier writes files up to this many pixels. Reporting is never capped. */
const FREE_MAX_PIXELS = 4_000_000;
/** The free tier processes this many files in one batch call. */
const FREE_MAX_BATCH = 5;

const gate = createLicenseGate({ product: "image" });

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true as const });
/** A tier limit is an answer, not a protocol error: the model has to relay the upgrade line. */
const freeLimit = (text: string) => ok(text);

function locked<T>(fn: () => T | Promise<T>): Promise<T> {
  return withFileLock(join(dataDir(), ".lock"), fn);
}

/**
 * Recording is best-effort: the image is already on disk when the register is touched,
 * so a corrupt register must never be reported as "nothing was written".
 */
async function record(op: string, inputs: string[], outputs: string[], detail?: string): Promise<string> {
  try {
    await locked(() => addOp({
      id: randomBytes(4).toString("hex"), op, inputs, outputs, detail, created: new Date().toISOString(),
    }));
    return "";
  } catch (e) {
    return `\n\nThe file was written, but it could not be added to the operation history: ${String((e as Error).message ?? e)}`;
  }
}

/**
 * Encode to bytes. Quality is a JPEG parameter and nothing else: PNG, BMP, GIF and TIFF
 * are lossless containers here, so the number is reported as ignored rather than applied
 * to a knob that does not exist.
 */
async function encode(img: Img, fmt: Fmt, quality?: number): Promise<Buffer> {
  switch (fmt) {
    case "jpeg": return Buffer.from(await img.getBuffer("image/jpeg", { quality: quality ?? 80 }));
    case "png": return Buffer.from(await img.getBuffer("image/png"));
    case "bmp": return Buffer.from(await img.getBuffer("image/bmp"));
    case "gif": return Buffer.from(await img.getBuffer("image/gif"));
    case "tiff": return Buffer.from(await img.getBuffer("image/tiff"));
  }
}

/** The output format follows out_path's extension, and falls back to the input's format. */
function outFormat(outPath: string, input: Fmt): { fmt: Fmt; fromExt: boolean } {
  const byExt = formatFromExt(outPath);
  return byExt ? { fmt: byExt, fromExt: true } : { fmt: input, fromExt: false };
}

function proSizeCheck(src: LoadedImage, feature: string): string | null {
  if (gate.isPro()) return null;
  const px = src.width * src.height;
  if (px <= FREE_MAX_PIXELS) return null;
  return `${basename(src.path)} is ${src.width}x${src.height} (${megapixels(src.width, src.height)} MP). ` +
    `The free tier writes images up to ${FREE_MAX_PIXELS / 1_000_000} MP; Pro has no size limit. ` +
    `Nothing was written.\n\n${gate.upgradeText(feature)}`;
}

function proBatchCheck(n: number, feature: string): string | null {
  if (gate.isPro() || n <= FREE_MAX_BATCH) return null;
  return `${n} files were given. The free tier processes up to ${FREE_MAX_BATCH} files per call; ` +
    `Pro has no batch limit. Nothing was written.\n\n${gate.upgradeText(feature)}`;
}

/* -------------------------------------------------------------------- tools */

const server = new McpServer(
  { name: "mcp-image", version: "0.6.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

const pathArg = z.string().describe("Path to the image file. ~ is expanded; a relative path is resolved against the working directory");
const outArg = z.string().describe("Path of the file to write. The extension decides the output format; without a known one the input's format is kept");
const overwriteArg = z.boolean().optional().describe("Replace out_path if it already exists. Default false. Never allows an output to be one of the inputs");

server.registerTool("image_info", {
  title: "Inspect an image",
  description: "Format, pixel dimensions, megapixels, file size in bytes and whether the image carries an alpha channel. Read-only: the file is never modified. Free tier: unlimited, at any size.",
  inputSchema: { path: pathArg },
}, async ({ path }) => {
  try {
    const src = await loadImage(path);
    return ok(JSON.stringify({
      file: src.path,
      format: src.format,
      width: src.width,
      height: src.height,
      megapixels: megapixels(src.width, src.height),
      aspect_ratio: Math.round((src.width / src.height) * 1000) / 1000,
      size: humanBytes(src.size),
      size_bytes: src.size,
      has_alpha: src.hasAlpha,
      bytes_per_pixel_stored: Math.round((src.size / (src.width * src.height)) * 100) / 100,
    }, null, 2));
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("image_resize", {
  title: "Resize an image",
  description: "Write a resized copy. fit: \"inside\" scales to fit the box and keeps the aspect ratio; \"cover\" fills the box and crops the overflow; \"exact\" stretches to the given width and height. With only one of width or height, the other follows the aspect ratio. The input is never modified. Free tier: sources up to 4 MP.",
  inputSchema: {
    path: pathArg,
    width: z.number().int().min(1).max(MAX_DIM).optional().describe("Target width in pixels"),
    height: z.number().int().min(1).max(MAX_DIM).optional().describe("Target height in pixels"),
    fit: z.enum(["inside", "cover", "exact"]).default("inside").describe("inside = fit within the box, cover = fill and crop, exact = stretch"),
    out_path: outArg,
    overwrite: overwriteArg,
  },
}, async ({ path, width, height, fit, out_path, overwrite }) => {
  const reservations: Reservation[] = [];
  try {
    if (!width && !height) return fail("give width, height, or both. Nothing was written.");
    if (fit !== "inside" && (!width || !height)) {
      return fail(`fit: "${fit}" needs both width and height; "inside" is the mode that takes one of them. Nothing was written.`);
    }
    const src = await loadImage(path);
    const limit = proSizeCheck(src, "resizing an image over 4 MP");
    if (limit) return freeLimit(limit);
    const res = reserveOutput(out_path, overwrite === true, [src.path]);
    reservations.push(res);
    const img = src.image;
    if (fit === "exact") img.resize({ w: width!, h: height! });
    else if (fit === "cover") img.cover({ w: width!, h: height! });
    else if (width && height) img.scaleToFit({ w: width, h: height });
    else img.resize(width ? { w: width } : { h: height! });
    const { fmt, fromExt } = outFormat(res.path, src.format);
    const bytes = await encode(img, fmt);
    writeFileSync(res.path, bytes);
    const note = await record("image_resize", [src.path], [res.path], `${src.width}x${src.height} -> ${img.width}x${img.height}`);
    return ok(
      `Resized ${src.width}x${src.height} to ${img.width}x${img.height} (fit: ${fit})\n` +
      `-> ${res.path}, ${humanBytes(bytes.length)}, ${fmt.toUpperCase()}${fromExt && fmt !== src.format ? " (from the out_path extension)" : ""}\n` +
      `The source ${src.path} is unchanged.${note}`,
    );
  } catch (e) { releaseReservations(reservations); return fail(String((e as Error).message ?? e)); }
});

server.registerTool("image_convert", {
  title: "Convert an image to another format",
  description: "Re-encode an image as PNG, JPEG, BMP, GIF or TIFF. quality is a JPEG parameter only and is reported as ignored for the lossless formats. Converting an image with transparency to JPEG flattens it onto white, and the answer says so. Free tier: sources up to 4 MP.",
  inputSchema: {
    path: pathArg,
    format: z.enum(["png", "jpeg", "bmp", "gif", "tiff"]).describe("The output format"),
    quality: z.number().int().min(1).max(100).optional().describe("JPEG quality 1-100, default 80. Ignored for the other formats"),
    out_path: outArg,
    overwrite: overwriteArg,
  },
}, async ({ path, format, quality, out_path, overwrite }) => {
  const reservations: Reservation[] = [];
  try {
    const src = await loadImage(path);
    const limit = proSizeCheck(src, "converting an image over 4 MP");
    if (limit) return freeLimit(limit);
    const fmt = format as Fmt;
    // An out_path that already names this format keeps its own spelling: ".tiff" must not
    // become "file.tiff.tif" just because the canonical extension here is the short one.
    const needExt = formatFromExt(out_path) === fmt ? "" : EXT[fmt];
    const res = reserveOutput(out_path, overwrite === true, [src.path], needExt);
    reservations.push(res);
    let flattened = false;
    if (fmt === "jpeg" && src.hasAlpha) {
      // A JPEG has no alpha channel. Compositing the image over white is what a viewer
      // would show anyway; doing it here means the answer can say that it happened.
      const white = new Jimp({ width: src.width, height: src.height, color: 0xffffffff });
      white.composite(src.image, 0, 0);
      src.image.bitmap = white.bitmap;
      flattened = true;
    }
    const bytes = await encode(src.image, fmt, quality);
    writeFileSync(res.path, bytes);
    const note = await record("image_convert", [src.path], [res.path], `${src.format} -> ${fmt}`);
    const qLine = fmt === "jpeg"
      ? `Quality ${quality ?? 80}.`
      : quality !== undefined
        ? `quality: ${quality} was ignored - ${fmt.toUpperCase()} here is a lossless container with no quality knob.`
        : "";
    return ok(
      `Converted ${src.format.toUpperCase()} to ${fmt.toUpperCase()}\n` +
      `-> ${res.path}, ${humanBytes(src.size)} -> ${humanBytes(bytes.length)}, ${src.width}x${src.height}\n` +
      (flattened ? "The source had transparency and JPEG has no alpha channel, so it was flattened onto white.\n" : "") +
      (qLine ? `${qLine}\n` : "") +
      `The source ${src.path} is unchanged.${note}`,
    );
  } catch (e) { releaseReservations(reservations); return fail(String((e as Error).message ?? e)); }
});

server.registerTool("image_compress", {
  title: "Compress an image",
  description: "Re-encode an image smaller and report the byte count before and after. quality (default 80) applies when the output is a JPEG; for a PNG output only max_width reduces bytes, and the answer says which of the two did the work. Free tier: sources up to 4 MP.",
  inputSchema: {
    path: pathArg,
    quality: z.number().int().min(1).max(100).default(80).describe("JPEG quality 1-100, default 80"),
    max_width: z.number().int().min(1).max(MAX_DIM).optional().describe("Scale down so the width is at most this, keeping the aspect ratio. Never scales up"),
    out_path: outArg,
    overwrite: overwriteArg,
  },
}, async ({ path, quality, max_width, out_path, overwrite }) => {
  const reservations: Reservation[] = [];
  try {
    const src = await loadImage(path);
    const limit = proSizeCheck(src, "compressing an image over 4 MP");
    if (limit) return freeLimit(limit);
    const res = reserveOutput(out_path, overwrite === true, [src.path]);
    reservations.push(res);
    const { fmt } = outFormat(res.path, src.format);
    let scaled = false;
    if (max_width && src.image.width > max_width) { src.image.resize({ w: max_width }); scaled = true; }
    const bytes = await encode(src.image, fmt, quality);
    writeFileSync(res.path, bytes);
    const delta = src.size - bytes.length;
    const pct = Math.round((delta / src.size) * 1000) / 10;
    const note = await record("image_compress", [src.path], [res.path], `${src.size} -> ${bytes.length} bytes`);
    const how = fmt === "jpeg"
      ? `JPEG quality ${quality}${scaled ? ` and a resize to ${src.image.width} px wide` : ""}`
      : scaled
        ? `a resize to ${src.image.width} px wide. Quality ${quality} does not apply: a ${fmt.toUpperCase()} output here is lossless`
        : `a re-encode only. Quality ${quality} does not apply to a ${fmt.toUpperCase()} output, and without max_width there is nothing else to remove - write to a .jpg out_path, or pass max_width, to make this smaller`;
    return ok(
      `${humanBytes(src.size)} -> ${humanBytes(bytes.length)} (${src.size} -> ${bytes.length} bytes, ` +
      `${delta >= 0 ? "-" : "+"}${Math.abs(pct)}%)\n` +
      `Method: ${how}\n` +
      `-> ${res.path}, ${src.image.width}x${src.image.height}, ${fmt.toUpperCase()}\n` +
      (delta <= 0 ? "The output is not smaller than the input. Re-encoding an already-compressed file can grow it; keep the original.\n" : "") +
      `The source ${src.path} is unchanged.${note}`,
    );
  } catch (e) { releaseReservations(reservations); return fail(String((e as Error).message ?? e)); }
});

server.registerTool("image_crop", {
  title: "Crop an image",
  description: "Cut a rectangle out of an image. x and y are the top-left corner in pixels, counted from the top-left of the image. A rectangle that runs past an edge is refused with the image's real size, never silently clamped. Free tier: sources up to 4 MP.",
  inputSchema: {
    path: pathArg,
    x: z.number().int().min(0).describe("Left edge of the crop, in pixels from the left of the image"),
    y: z.number().int().min(0).describe("Top edge of the crop, in pixels from the top of the image"),
    width: z.number().int().min(1).describe("Width of the crop in pixels"),
    height: z.number().int().min(1).describe("Height of the crop in pixels"),
    out_path: outArg,
    overwrite: overwriteArg,
  },
}, async ({ path, x, y, width, height, out_path, overwrite }) => {
  const reservations: Reservation[] = [];
  try {
    const src = await loadImage(path);
    if (x + width > src.width || y + height > src.height) {
      return fail(
        `the crop ${width}x${height} at (${x}, ${y}) runs past the edge of a ${src.width}x${src.height} image ` +
        `(it would need ${x + width}x${y + height}). Nothing was written. A crop is not clamped here: a silently ` +
        `smaller rectangle is worse than an answer.`,
      );
    }
    const limit = proSizeCheck(src, "cropping an image over 4 MP");
    if (limit) return freeLimit(limit);
    const res = reserveOutput(out_path, overwrite === true, [src.path]);
    reservations.push(res);
    src.image.crop({ x, y, w: width, h: height });
    const { fmt } = outFormat(res.path, src.format);
    const bytes = await encode(src.image, fmt);
    writeFileSync(res.path, bytes);
    const note = await record("image_crop", [src.path], [res.path], `${width}x${height} at ${x},${y}`);
    return ok(
      `Cropped ${width}x${height} from (${x}, ${y}) of a ${src.width}x${src.height} image\n` +
      `-> ${res.path}, ${humanBytes(bytes.length)}, ${fmt.toUpperCase()}\n` +
      `The source ${src.path} is unchanged.${note}`,
    );
  } catch (e) { releaseReservations(reservations); return fail(String((e as Error).message ?? e)); }
});

server.registerTool("image_thumbnails", {
  title: "Make thumbnails",
  description: "One thumbnail per input, written into out_dir as <name>-thumb.<ext>. Each thumbnail fits inside size by size and keeps its aspect ratio, so a wide photo stays wide. Every output path is reserved before any file is written, so a collision does not leave a half-done batch. Free tier: up to 5 files per call and sources up to 4 MP.",
  inputSchema: {
    paths: z.array(z.string()).min(1).describe("The image files to make thumbnails of"),
    size: z.number().int().min(8).max(MAX_DIM).default(256).describe("Longest side of the thumbnail in pixels, default 256"),
    out_dir: z.string().describe("Directory to write the thumbnails into. It is created if missing"),
    overwrite: overwriteArg,
  },
}, async ({ paths, size, out_dir, overwrite }) => {
  const reservations: Reservation[] = [];
  try {
    const batch = proBatchCheck(paths.length, "thumbnails of more than 5 files");
    if (batch) return freeLimit(batch);
    const srcs: LoadedImage[] = [];
    for (const p of paths) srcs.push(await loadImage(p));
    for (const s of srcs) {
      const limit = proSizeCheck(s, "thumbnails of an image over 4 MP");
      if (limit) return freeLimit(limit);
    }
    const inputs = srcs.map((s) => s.path);
    for (const s of srcs) {
      const ext = extname(s.path) || EXT[s.format];
      const out = join(expandPath(out_dir), `${basename(s.path, extname(s.path))}-thumb${ext}`);
      reservations.push(reserveOutput(out, overwrite === true, inputs));
    }
    const rows: string[] = [];
    for (let i = 0; i < srcs.length; i++) {
      const s = srcs[i];
      s.image.scaleToFit({ w: size, h: size });
      const { fmt } = outFormat(reservations[i].path, s.format);
      const bytes = await encode(s.image, fmt, 82);
      writeFileSync(reservations[i].path, bytes);
      rows.push(`- ${basename(reservations[i].path)}: ${s.width}x${s.height} -> ${s.image.width}x${s.image.height}, ${humanBytes(bytes.length)}`);
    }
    const note = await record("image_thumbnails", inputs, reservations.map((r) => r.path), `size ${size}`);
    return ok(
      `${srcs.length} thumbnail${srcs.length === 1 ? "" : "s"} at most ${size} px on the longest side, in ${expandPath(out_dir)}\n` +
      `${rows.join("\n")}\nEvery source is unchanged.${note}`,
    );
  } catch (e) { releaseReservations(reservations); return fail(String((e as Error).message ?? e)); }
});

const POSITIONS = ["bottom-right", "bottom-left", "bottom-center", "top-right", "top-left", "top-center", "center"] as const;

const FONTS: [number, string][] = [
  [128, SANS_128_WHITE], [64, SANS_64_WHITE], [32, SANS_32_WHITE], [16, SANS_16_WHITE], [8, SANS_8_WHITE],
];

server.registerTool("image_watermark", {
  title: "Watermark an image with text",
  description: "Draw text over an image at a chosen corner and opacity. With no text the shared business profile name is used, the same profile mcp-invoice and mcp-docx write. The text is drawn white on a translucent dark plate so it stays legible on a light photo. Free tier: the profile name; Pro: any text you pass.",
  inputSchema: {
    path: pathArg,
    text: z.string().optional().describe("The watermark text. Default: the business name from the shared profile. Custom text is Pro"),
    position: z.enum(POSITIONS).default("bottom-right").describe("Where to draw it"),
    opacity: z.number().min(0.05).max(1).default(0.5).describe("0.05 to 1, default 0.5"),
    out_path: outArg,
    overwrite: overwriteArg,
  },
}, async ({ path, text, position, opacity, out_path, overwrite }) => {
  const reservations: Reservation[] = [];
  try {
    const custom = typeof text === "string" && text.trim().length > 0;
    if (custom && !gate.isPro()) {
      return freeLimit(
        "Custom watermark text is a Pro feature. On the free tier this tool draws the business name from the " +
        `shared profile: call it without "text". Nothing was written.\n\n${gate.upgradeText("a custom watermark text")}`,
      );
    }
    let line = custom ? text!.trim() : (readSharedProfile().name ?? "").trim();
    if (!line) {
      return fail(
        "no text was given and no business name is stored, so there is nothing to draw and nothing was written. " +
        "Run business_set {name} in mcp-invoice or mcp-docx once - the profile is shared " +
        `(${join(process.env.XDG_DATA_HOME || "~/.local/share", "mcp-servers", "profile", "business.json")}) - ` +
        "or pass text, which is a Pro feature.",
      );
    }
    line = line.replace(/\s+/g, " ").slice(0, 200);
    const src = await loadImage(path);
    const limit = proSizeCheck(src, "watermarking an image over 4 MP");
    if (limit) return freeLimit(limit);
    const res = reserveOutput(out_path, overwrite === true, [src.path]);
    reservations.push(res);

    // The largest bundled font whose rendered line still fits with a margin. The list runs
    // large to small and keeps the last one tried, so a tiny image still gets the 8 px face
    // rather than no text at all.
    let font = await loadFont(FONTS[FONTS.length - 1][1]);
    let size = 8;
    for (const [px, file] of FONTS) {
      const f = await loadFont(file);
      const w = measureText(f, line);
      const h = measureTextHeight(f, line, src.width);
      font = f;
      size = px;
      if (w <= src.width * 0.8 && h <= src.height * 0.25) break;
    }
    const tw = Math.min(measureText(font, line), src.width);
    const th = measureTextHeight(font, line, src.width);
    const margin = Math.max(6, Math.round(Math.min(src.width, src.height) * 0.03));
    const x = position.endsWith("left") ? margin
      : position.endsWith("right") ? Math.max(0, src.width - tw - margin)
        : Math.max(0, Math.round((src.width - tw) / 2));
    const y = position.startsWith("top") ? margin
      : position === "center" ? Math.max(0, Math.round((src.height - th) / 2))
        : Math.max(0, src.height - th - margin);

    // The text is drawn on its own transparent layer, so opacity applies to the text and
    // the plate rather than fading the photo underneath.
    const layer = new Jimp({ width: src.width, height: src.height, color: 0x00000000 });
    const plateW = Math.max(1, Math.min(src.width, tw + margin));
    const plateH = Math.max(1, Math.min(src.height, th + Math.round(margin / 2)));
    const plate = new Jimp({ width: plateW, height: plateH, color: 0x000000b0 });
    layer.composite(plate, Math.max(0, x - Math.round(margin / 2)), Math.max(0, y - Math.round(margin / 4)));
    layer.print({ font, x, y, text: line });
    layer.opacity(opacity);
    src.image.composite(layer, 0, 0);

    const { fmt } = outFormat(res.path, src.format);
    const bytes = await encode(src.image, fmt, 90);
    writeFileSync(res.path, bytes);
    const note = await record("image_watermark", [src.path], [res.path], line);
    return ok(
      `Watermarked "${line}" at ${position}, opacity ${opacity}, ${size} px type\n` +
      `-> ${res.path}, ${humanBytes(bytes.length)}, ${src.width}x${src.height}, ${fmt.toUpperCase()}\n` +
      `${custom ? "Custom text (Pro)." : "Text taken from the shared business profile."} ` +
      `The source ${src.path} is unchanged.${note}`,
    );
  } catch (e) { releaseReservations(reservations); return fail(String((e as Error).message ?? e)); }
});

server.registerTool("image_strip_metadata", {
  title: "Strip metadata from an image",
  description: "Write a copy carrying pixels and nothing else. It works by decoding the image and re-encoding it from the raw pixels: EXIF, GPS coordinates, the camera and lens, the capture time, XMP and colour-profile blocks are not carried across, because the encoder writes only what it is given. The pixels are the same; the bytes are not. Free tier: sources up to 4 MP.",
  inputSchema: { path: pathArg, out_path: outArg, overwrite: overwriteArg },
}, async ({ path, out_path, overwrite }) => {
  const reservations: Reservation[] = [];
  try {
    const src = await loadImage(path);
    const limit = proSizeCheck(src, "stripping metadata from an image over 4 MP");
    if (limit) return freeLimit(limit);
    const res = reserveOutput(out_path, overwrite === true, [src.path]);
    reservations.push(res);
    const { fmt } = outFormat(res.path, src.format);
    const bytes = await encode(src.image, fmt, 92);
    writeFileSync(res.path, bytes);
    const raw = readFileSync(src.path);
    const hadExif = raw.includes(Buffer.from("Exif\0\0", "latin1")) || raw.includes(Buffer.from("http://ns.adobe.com/xap", "latin1"));
    const note = await record("image_strip_metadata", [src.path], [res.path]);
    return ok(
      "Re-encoded from raw pixels; no metadata was carried across.\n" +
      `-> ${res.path}, ${humanBytes(src.size)} -> ${humanBytes(bytes.length)}, ${src.width}x${src.height}, ${fmt.toUpperCase()}\n` +
      (hadExif ? "The source carried an EXIF or XMP block (camera, capture time and any GPS coordinates live there); the copy does not.\n" : "") +
      "This is a re-encode, not a byte-level edit: the pixels go through the encoder again, so a JPEG copy is not " +
      "bit-identical to the original even though it looks the same. Keep the original if that matters.\n" +
      `The source ${src.path} is unchanged.${note}`,
    );
  } catch (e) { releaseReservations(reservations); return fail(String((e as Error).message ?? e)); }
});

server.registerTool("image_batch_resize", {
  title: "Resize several images at once",
  description: "Resize every image into out_dir, keeping each one's aspect ratio, named <name>-<W>x<H>.<ext>. With one of width or height the other follows; with both, each image is scaled to fit inside that box. Free tier: up to 5 files per call and sources up to 4 MP.",
  inputSchema: {
    paths: z.array(z.string()).min(1).describe("The image files to resize"),
    width: z.number().int().min(1).max(MAX_DIM).optional().describe("Target width in pixels"),
    height: z.number().int().min(1).max(MAX_DIM).optional().describe("Target height in pixels"),
    out_dir: z.string().describe("Directory to write into. It is created if missing"),
    overwrite: overwriteArg,
  },
}, async ({ paths, width, height, out_dir, overwrite }) => {
  const reservations: Reservation[] = [];
  try {
    if (!width && !height) return fail("give width, height, or both. Nothing was written.");
    const batch = proBatchCheck(paths.length, "resizing more than 5 files at once");
    if (batch) return freeLimit(batch);
    const srcs: LoadedImage[] = [];
    for (const p of paths) srcs.push(await loadImage(p));
    for (const s of srcs) {
      const limit = proSizeCheck(s, "resizing an image over 4 MP");
      if (limit) return freeLimit(limit);
    }
    const inputs = srcs.map((s) => s.path);
    const targets: { src: LoadedImage; out: string }[] = [];
    for (const s of srcs) {
      const img = s.image;
      if (width && height) img.scaleToFit({ w: width, h: height });
      else img.resize(width ? { w: width } : { h: height! });
      const ext = extname(s.path) || EXT[s.format];
      const out = join(expandPath(out_dir), `${basename(s.path, extname(s.path))}-${img.width}x${img.height}${ext}`);
      targets.push({ src: s, out });
    }
    for (const t of targets) reservations.push(reserveOutput(t.out, overwrite === true, inputs));
    const rows: string[] = [];
    for (let i = 0; i < targets.length; i++) {
      const { src } = targets[i];
      const { fmt } = outFormat(reservations[i].path, src.format);
      const bytes = await encode(src.image, fmt, 85);
      writeFileSync(reservations[i].path, bytes);
      rows.push(`- ${basename(reservations[i].path)}: ${src.width}x${src.height} -> ${src.image.width}x${src.image.height}, ${humanBytes(bytes.length)}`);
    }
    const note = await record("image_batch_resize", inputs, reservations.map((r) => r.path));
    return ok(
      `Resized ${targets.length} image${targets.length === 1 ? "" : "s"} into ${expandPath(out_dir)}\n` +
      `${rows.join("\n")}\nEvery source is unchanged.${note}`,
    );
  } catch (e) { releaseReservations(reservations); return fail(String((e as Error).message ?? e)); }
});

server.registerTool("image_dominant_colors", {
  title: "Read the dominant colours of an image",
  description: "The colours that cover most of an image, as hex codes with the share of pixels each one covers, for picking a background or a brand palette. Read-only. Pro only.",
  inputSchema: {
    path: pathArg,
    count: z.number().int().min(1).max(16).default(5).describe("How many colours to report, default 5"),
  },
}, async ({ path, count }) => {
  try {
    if (!gate.isPro()) {
      return freeLimit(`Dominant colours are a Pro feature.\n\n${gate.upgradeText("dominant colours")}`);
    }
    const src = await loadImage(path);
    // Sampled on a copy scaled to at most 200 px on the longest side: the colour histogram
    // of an image does not change with resolution, and this keeps a 10,000 px input to a
    // fixed cost. Channels are bucketed to 5 bits, so near-identical shades count together.
    const small = src.image.clone();
    small.scaleToFit({ w: 200, h: 200 });
    const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
    let opaque = 0;
    for (let yy = 0; yy < small.height; yy++) {
      for (let xx = 0; xx < small.width; xx++) {
        const { r, g, b, a } = intToRGBA(small.getPixelColor(xx, yy));
        if (a < 128) continue;
        opaque++;
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        const e = counts.get(key);
        if (e) { e.n++; e.r += r; e.g += g; e.b += b; }
        else counts.set(key, { n: 1, r, g, b });
      }
    }
    if (!opaque) return ok(JSON.stringify({ file: src.path, colors: [], note: "every pixel is transparent" }, null, 2));
    const hex = (n: number) => n.toString(16).padStart(2, "0");
    const top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, count).map((e) => {
      const r = Math.round(e.r / e.n), g = Math.round(e.g / e.n), b = Math.round(e.b / e.n);
      return { hex: `#${hex(r)}${hex(g)}${hex(b)}`, rgb: [r, g, b], share_percent: Math.round((e.n / opaque) * 1000) / 10 };
    });
    return ok(JSON.stringify({
      file: src.path, sampled: `${small.width}x${small.height}`, opaque_pixels_sampled: opaque,
      distinct_buckets: counts.size, colors: top,
    }, null, 2));
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ----------------------------------------------------------------- resource */

server.registerResource("recent-operations", "image://recent", {
  title: "Recent image operations",
  description: "What this server has done, newest first: the operation, the input files, the files written and when.",
  mimeType: "application/json",
}, async (uri) => {
  let ops: unknown;
  try { ops = getOps().slice(-25).reverse(); } catch (e) { ops = { error: String((e as Error).message ?? e) }; }
  return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(ops, null, 2) }] };
});

/* ------------------------------------------------------------------- prompt */

server.registerPrompt("prepare_for_web", {
  title: "Prepare an image for the web",
  description: "Take a camera-sized image down to a page-sized JPEG, drop the metadata that came with it, and report the bytes saved.",
  argsSchema: {
    path: z.string().describe("The image to prepare"),
    max_width: z.string().optional().describe("Longest width to allow, default 1600"),
  },
}, ({ path, max_width }: { path: string; max_width?: string }) => {
  const p = expandPath(path);
  const w = max_width && /^\d+$/.test(max_width) ? Number(max_width) : 1600;
  const base = basename(p, extname(p));
  const text =
    `Prepare ${p} for the web.\n\n` +
    `1. Call image_info {path: "${p}"} and report the format, the dimensions and the file size.\n` +
    `2. Call image_compress {path: "${p}", max_width: ${w}, quality: 80, out_path: "<same folder>/${base}-web.jpg"}. ` +
    `The .jpg extension is what makes quality apply - a PNG out_path is lossless and quality would do nothing there.\n` +
    `3. If the source is a photo from a camera or a phone, say that the JPEG re-encode also drops the EXIF block, ` +
    `including any GPS coordinates. If the user wants the metadata gone but the format kept, call ` +
    `image_strip_metadata instead.\n` +
    `4. Report the before and after byte counts and the percentage saved exactly as the tool returned them. ` +
    `Do not estimate a number the tool did not give you.\n\n` +
    `Rules: never pass overwrite: true unless the user asked for the original to be replaced, and never write the ` +
    `output over the input - the tool refuses that anyway. The original stays where it is.`;
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
});

gate.registerTools(server as unknown as { registerTool: Function });

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(
  `mcp-image ready (${gate.isPro() ? "pro" : "free"}), data in ${dataDir()}, ` +
  `max input ${humanBytes(MAX_BYTES)}, max ${MAX_DIM} px per side\n`,
);
