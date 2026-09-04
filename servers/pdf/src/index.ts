#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, readSharedProfile, withFileLock } from "@theluckystrike/mcp-license";
import { PDFDocument, PDFFont, StandardFonts, degrees, rgb } from "pdf-lib";
import { z } from "zod";
import {
  MAX_BYTES, expandPath, humanBytes, loadPdf, looksEncrypted, parsePageList, parseRanges, pdfaClaim,
  releaseReservations, reserveOutput, type Reservation,
} from "./pdfio.js";
import { extractText } from "./text.js";
import { addOp, dataDir, getOps } from "./store.js";
import { VERSION } from "./version.js";

const FREE_MAX_MERGE_FILES = 5;
const FREE_MAX_PAGES = 30;
/** Larger than any page this server writes; a stamp bigger than this is a typo, not a choice. */
const MAX_FONT_SIZE = 1600;
/** pdf_text is read into one chat message, so the whole answer is capped, not just each page. */
const MAX_TEXT_CHARS = 200_000;
const STAMP_PRESETS: Record<string, { color: string; note: string }> = {
  PAID: { color: "#1b7f3b", note: "green" },
  DRAFT: { color: "#b02020", note: "red" },
};

const gate = createLicenseGate({ product: "pdf" });

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true as const });

/** Serialise the operation register across processes, the way the rest of the suite does. */
function locked<T>(fn: () => T | Promise<T>): Promise<T> {
  return withFileLock(join(dataDir(), ".lock"), fn);
}

/**
 * Recording is best-effort: the PDF is already on disk when the register is touched,
 * so a corrupt register must never be reported as "nothing was written".
 */
async function record(op: string, inputs: string[], outputs: string[], pages?: number): Promise<string> {
  try {
    await locked(() => addOp({
      id: randomBytes(4).toString("hex"), op, inputs, outputs, pages, created: new Date().toISOString(),
    }));
    return "";
  } catch (e) {
    return `\n\nThe file was written, but it could not be added to the operation history: ${String((e as Error).message ?? e)}`;
  }
}

const COLORS: Record<string, [number, number, number]> = {
  red: [0.69, 0.13, 0.13], green: [0.11, 0.5, 0.23], blue: [0.12, 0.22, 0.39],
  black: [0, 0, 0], gray: [0.45, 0.45, 0.45], grey: [0.45, 0.45, 0.45],
  orange: [0.85, 0.45, 0.05], purple: [0.4, 0.15, 0.55], white: [1, 1, 1],
};

function parseColor(input: string): [number, number, number] {
  const s = input.trim().toLowerCase();
  if (COLORS[s]) return COLORS[s];
  const hex = s.startsWith("#") ? s.slice(1) : s;
  if (/^[0-9a-f]{6}$/.test(hex)) {
    return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255];
  }
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return [parseInt(hex[0] + hex[0], 16) / 255, parseInt(hex[1] + hex[1], 16) / 255, parseInt(hex[2] + hex[2], 16) / 255];
  }
  throw new Error(`cannot read "${input}" as a colour. Use a hex code such as #1b7f3b or one of: ${Object.keys(COLORS).join(", ")}.`);
}

/**
 * The built-in fonts of a PDF carry WinAnsi, which has 256 code points and no way to
 * hold an em dash typed as U+2014 or any CJK character. Text that reaches a stamp is
 * cleaned first and the count of removed characters is reported, rather than handing
 * back a file that failed to write halfway.
 */
export function sanitizeStampText(s: string): { text: string; removed: number; transliterated: number } {
  const map: Record<string, string> = {
    "‘": "'", "’": "'", "“": '"', "”": '"',
    "–": "-", "—": "-", "…": "...", " ": " ",
  };
  // Letters outside WinAnsi that have an obvious Latin body: dropping the character
  // turns OPŁACONE into OPACONE, a different word that still looks like a word.
  // Transliterating gives OPLACONE, which is legible and visibly not the original.
  const translit: Record<string, string> = {
    "Ł": "L", "ł": "l", "Đ": "D", "đ": "d", "Ħ": "H", "ħ": "h",
    "ı": "i", "Ĳ": "IJ", "ĳ": "ij", "Ŀ": "L", "ŀ": "l", "ŉ": "'n",
    "Ŋ": "N", "ŋ": "n", "Œ": "OE", "œ": "oe", "Ŧ": "T", "ŧ": "t",
    "ſ": "s", "ƀ": "b", "Ƅ": "b", "Ƈ": "C", "Ɨ": "I", "ƚ": "l",
    "ȷ": "j", "Ђ": "D", "‐": "-", "‑": "-", "‒": "-", "―": "-",
    "•": "-", "→": "->", "€": "EUR", "⁄": "/",
  };
  let removed = 0;
  let transliterated = 0;
  let out = "";
  const pre = s.replace(/[‘’“”–—… ]/g, (c) => map[c] ?? c);
  for (const raw of pre) {
    // Any whitespace control (newline, tab, form feed) is a word separator, never a
    // deletion: dropping it ran "PAID\nIN FULL" together as "PAIDIN FULL".
    if (/\s/.test(raw)) { out += " "; continue; }
    let ch = raw;
    let cp = ch.codePointAt(0)!;
    if (cp > 255) {
      const t = translit[ch] ?? ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (t && t !== ch && /^[\x20-\xff]+$/.test(t)) { out += t; transliterated++; continue; }
      removed++;
      continue;
    }
    if (cp < 32 || cp === 127) { removed++; continue; }
    out += ch;
  }
  return { text: out.replace(/\s+/g, " ").trim(), removed, transliterated };
}

const POSITIONS = [
  "center", "top-left", "top-center", "top-right",
  "middle-left", "middle-right", "bottom-left", "bottom-center", "bottom-right",
] as const;
type Position = (typeof POSITIONS)[number];

function place(position: Position, w: number, h: number, textWidth: number, textHeight: number): { x: number; y: number; rotate: number } {
  const m = 36; // half an inch
  const cx = (w - textWidth) / 2;
  const cy = (h - textHeight) / 2;
  switch (position) {
    case "center": {
      // A centred stamp is drawn on the diagonal, which is what a stamp looks like and
      // keeps a long word inside the page.
      const rad = Math.PI / 4;
      const dx = (textWidth * Math.cos(rad)) / 2;
      const dy = (textWidth * Math.sin(rad)) / 2;
      return { x: w / 2 - dx, y: h / 2 - dy - textHeight / 4, rotate: 45 };
    }
    case "top-left": return { x: m, y: h - m - textHeight, rotate: 0 };
    case "top-center": return { x: cx, y: h - m - textHeight, rotate: 0 };
    case "top-right": return { x: w - m - textWidth, y: h - m - textHeight, rotate: 0 };
    case "middle-left": return { x: m, y: cy, rotate: 0 };
    case "middle-right": return { x: w - m - textWidth, y: cy, rotate: 0 };
    case "bottom-left": return { x: m, y: m, rotate: 0 };
    case "bottom-center": return { x: cx, y: m, rotate: 0 };
    case "bottom-right": return { x: w - m - textWidth, y: m, rotate: 0 };
  }
}

function mm(pt: number): number { return Math.round((pt * 25.4) / 72 * 10) / 10; }

function paperName(w: number, h: number): string {
  const near = (a: number, b: number) => Math.abs(a - b) <= 3;
  const pairs: [string, number, number][] = [
    ["A4", 595.28, 841.89], ["A3", 841.89, 1190.55], ["A5", 419.53, 595.28],
    ["Letter", 612, 792], ["Legal", 612, 1008], ["Tabloid", 792, 1224],
  ];
  for (const [name, pw, ph] of pairs) {
    if ((near(w, pw) && near(h, ph))) return name;
    if ((near(w, ph) && near(h, pw))) return `${name} landscape`;
  }
  return "custom";
}

async function savePdf(doc: PDFDocument, path: string): Promise<number> {
  const bytes = await doc.save({ useObjectStreams: false });
  writeFileSync(path, bytes);
  return bytes.length;
}

/** Free tier refusals are answers, not protocol errors: the model has to relay the upgrade line. */
function freeLimit(text: string): ReturnType<typeof ok> { return ok(text); }

const server = new McpServer(
  { name: "mcp-pdf", version: VERSION },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

/* --------------------------------------------------------------------- info */

server.registerTool("pdf_info", {
  title: "Inspect a PDF",
  description: "Call this tool to inspect a PDF: page count, page sizes in points/mm, paper name, metadata (title, author, producer, dates) and whether it is encrypted. Read-only, never modifies the file. Free tier: unlimited.",
  inputSchema: {
    path: z.string().describe("Path to the PDF file. ~ is expanded; a relative path is resolved against the working directory"),
  },
}, async ({ path }) => {
  try {
    let f;
    try {
      f = await loadPdf(path);
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      if (/encrypted/.test(msg)) {
        return ok(JSON.stringify({ file: expandPath(path), encrypted: true, pages: null, note: msg }, null, 2));
      }
      throw e;
    }
    const sizes = f.doc.getPages().map((p, i) => {
      const { width, height } = p.getSize();
      return {
        page: i + 1,
        width_pt: Math.round(width * 100) / 100, height_pt: Math.round(height * 100) / 100,
        width_mm: mm(width), height_mm: mm(height),
        paper: paperName(width, height), rotation: p.getRotation().angle,
      };
    });
    const distinct = [...new Set(sizes.map((s) => `${s.width_pt}x${s.height_pt}`))];
    const meta = {
      title: f.doc.getTitle() ?? null, author: f.doc.getAuthor() ?? null, subject: f.doc.getSubject() ?? null,
      keywords: f.doc.getKeywords() ?? null, creator: f.doc.getCreator() ?? null, producer: f.doc.getProducer() ?? null,
      created: f.doc.getCreationDate()?.toISOString() ?? null, modified: f.doc.getModificationDate()?.toISOString() ?? null,
    };
    return ok(JSON.stringify({
      file: f.path, size: humanBytes(f.size), size_bytes: f.size, pages: f.pageCount,
      encrypted: looksEncrypted(f.bytes), pdfa_claim: f.pdfa, distinct_page_sizes: distinct.length,
      page_sizes: sizes.length > 20 ? sizes.slice(0, 20) : sizes,
      page_sizes_truncated: sizes.length > 20 ? `showing 20 of ${sizes.length}` : undefined,
      metadata: meta,
    }, null, 2));
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("pdf_count", {
  title: "Count pages in several PDFs",
  description: "Page count per file plus the total, for any number of PDFs. Read-only. A file that cannot be read is reported per file; the others still count. Free tier: unlimited.",
  inputSchema: {
    paths: z.array(z.string()).min(1).describe("Paths to the PDF files"),
  },
}, async ({ paths }) => {
  const rows: { file: string; pages: number | null; error?: string }[] = [];
  for (const p of paths) {
    try {
      const f = await loadPdf(p);
      rows.push({ file: f.path, pages: f.pageCount });
    } catch (e) {
      rows.push({ file: expandPath(p), pages: null, error: String((e as Error).message ?? e) });
    }
  }
  const total = rows.reduce((n, r) => n + (r.pages ?? 0), 0);
  const failed = rows.filter((r) => r.pages === null).length;
  return ok(JSON.stringify({
    files: rows.length, readable: rows.length - failed, unreadable: failed, total_pages: total, per_file: rows,
  }, null, 2));
});

/* -------------------------------------------------------------------- merge */

server.registerTool("pdf_merge", {
  title: "Merge PDFs into one file",
  description: "Call this tool to join several PDFs into one, in the order given. Page sizes are kept as-is, so a merged file may have mixed sizes, and the answer says so. Inputs are never modified. Free tier: up to 5 files per merge.",
  inputSchema: {
    paths: z.array(z.string()).min(2).describe("The PDFs to join, in the order they should appear"),
    out_path: z.string().describe("Where to write the merged PDF"),
    overwrite: z.boolean().optional().describe("Replace out_path if a file is already there. Default false: an existing file is never overwritten"),
  },
}, async ({ paths, out_path, overwrite }) => {
  let reservation: Reservation | null = null;
  try {
    if (!gate.isPro() && paths.length > FREE_MAX_MERGE_FILES) {
      return freeLimit(
        `You asked to merge ${paths.length} files. The free tier merges up to ${FREE_MAX_MERGE_FILES} files in one call ` +
        `and nothing was written. Merge in batches of ${FREE_MAX_MERGE_FILES}, or unlock unlimited merging.\n\n` +
        gate.upgradeText("merging more than 5 files at once", "pdf_merge"),
      );
    }
    const loaded = [];
    for (const p of paths) loaded.push(await loadPdf(p));
    reservation = reserveOutput(out_path, overwrite ?? false, paths);
    const out = await PDFDocument.create();
    const sizes = new Set<string>();
    const per: { file: string; pages: number }[] = [];
    for (const f of loaded) {
      const copied = await out.copyPages(f.doc, f.doc.getPageIndices());
      for (const page of copied) {
        const { width, height } = page.getSize();
        sizes.add(`${Math.round(width)}x${Math.round(height)}`);
        out.addPage(page);
      }
      per.push({ file: f.path, pages: f.pageCount });
    }
    out.setProducer("mcp-pdf");
    out.setCreator("mcp-pdf by theluckystrike");
    const bytes = await savePdf(out, reservation.path);
    reservation = null;
    const note = await record("pdf_merge", loaded.map((f) => f.path), [expandPath(out_path)], out.getPageCount());
    return ok(
      `Merged ${loaded.length} files into ${out.getPageCount()} pages.\n\n` +
      JSON.stringify({ out: reserveNameOnly(out_path), pages: out.getPageCount(), size: humanBytes(bytes), sources: per }, null, 2) +
      (loaded.some((x) => x.pdfa) ? `\n\n${loaded.filter((x) => x.pdfa).map((x) => `${x.path} claims ${x.pdfa}`).join("; ")}. The merged file is a new document and carries neither that claim nor the source output intents, so it is not ${loaded.find((x) => x.pdfa)!.pdfa}. Nothing was silently kept.` : "") +
      (sizes.size > 1 ? `\n\nThe sources do not all use the same page size (${[...sizes].join(", ")} in points), so the merged file has mixed page sizes. Nothing was scaled.` : "") +
      note,
    );
  } catch (e) {
    if (reservation) releaseReservations([reservation]);
    return fail(String((e as Error).message ?? e));
  }
});

/** Every tool that builds a NEW document loses the source PDF/A identity; say so once. */
function pdfaLostNote(f: { path: string; pdfa: string | null }): string {
  return f.pdfa
    ? `\n\n${f.path} claims ${f.pdfa}. The output is a new document without the source output intents and metadata, so it is not ${f.pdfa}.`
    : "";
}

function reserveNameOnly(p: string): string {
  const full = expandPath(p);
  return full.toLowerCase().endsWith(".pdf") ? full : `${full}.pdf`;
}

/* -------------------------------------------------------------------- split */

server.registerTool("pdf_split", {
  title: "Split a PDF into several files",
  description: "Call this tool to write one new PDF per range. Ranges are 1-based and may be open-ended: \"1-3,5,7-\" gives pages 1-3, page 5, and 7 to the end. The input is never modified. Free tier: files up to 30 pages.",
  inputSchema: {
    path: z.string().describe("The PDF to split"),
    ranges: z.string().describe("Comma-separated 1-based page ranges, e.g. \"1-3,5,7-\". An open-ended range runs to the last page"),
    out_path_pattern: z.string().describe("Output path with a placeholder: {n} is the part number (1, 2, 3...), {range} is the range itself (e.g. 1-3), {name} is the input file name without .pdf. Example: ~/out/{name}-{range}.pdf"),
    overwrite: z.boolean().optional().describe("Replace existing outputs. Default false: nothing is overwritten and nothing is written at all if any target exists"),
  },
}, async ({ path, ranges, out_path_pattern, overwrite }) => {
  const reserved: Reservation[] = [];
  try {
    const f = await loadPdf(path);
    if (!gate.isPro() && f.pageCount > FREE_MAX_PAGES) {
      return freeLimit(freePageText("pdf_split", f.pageCount));
    }
    const parts = parseRanges(ranges, f.pageCount);
    if (!/\{n\}|\{range\}/.test(out_path_pattern) && parts.length > 1) {
      throw new Error(
        `out_path_pattern "${out_path_pattern}" has no {n} or {range} placeholder, so all ${parts.length} parts would ` +
        `be written to the same file. Add {n} or {range}, e.g. ${out_path_pattern.replace(/\.pdf$/i, "")}-{range}.pdf`,
      );
    }
    const stem = basename(expandPath(path)).replace(/\.pdf$/i, "");
    const targets = parts.map((r, i) => out_path_pattern
      .replace(/\{n\}/g, String(i + 1))
      .replace(/\{range\}/g, r.label)
      .replace(/\{name\}/g, stem));
    const seen = new Set<string>();
    for (const t of targets) {
      const full = reserveNameOnly(t);
      if (seen.has(full)) throw new Error(`the pattern produces the path ${full} twice; nothing was written.`);
      seen.add(full);
    }
    // Reserve every target before writing anything, so a collision on part 3 does not
    // leave parts 1 and 2 behind as a half-done split.
    for (const t of targets) reserved.push(reserveOutput(t, overwrite ?? false, [path]));
    const written: { file: string; range: string; pages: number }[] = [];
    for (let i = 0; i < parts.length; i++) {
      const r = parts[i];
      const out = await PDFDocument.create();
      const idx = [];
      for (let p = r.from; p <= r.to; p++) idx.push(p - 1);
      const copied = await out.copyPages(f.doc, idx);
      for (const pg of copied) out.addPage(pg);
      out.setProducer("mcp-pdf");
      await savePdf(out, reserved[i].path);
      reserved[i].created = false;
      written.push({ file: reserved[i].path, range: r.label, pages: idx.length });
    }
    reserved.length = 0;
    const note = await record("pdf_split", [f.path], written.map((w) => w.file), f.pageCount);
    const covered = new Set<number>();
    for (const r of parts) for (let p = r.from; p <= r.to; p++) covered.add(p);
    const missing = f.pageCount - covered.size;
    return ok(
      `Split ${f.path} (${f.pageCount} pages) into ${written.length} file${written.length === 1 ? "" : "s"}.\n\n` +
      JSON.stringify({ source: f.path, source_pages: f.pageCount, parts: written }, null, 2) +
      pdfaLostNote(f) +
      (missing > 0 ? `\n\n${missing} page${missing === 1 ? "" : "s"} of the source are in no range and are in none of the output files. The source is unchanged.` : "") +
      note,
    );
  } catch (e) {
    releaseReservations(reserved);
    return fail(String((e as Error).message ?? e));
  }
});

function freePageText(tool: string, pageCount: number): string {
  return `The file has ${pageCount} pages. On the free tier ${tool} works on files up to ${FREE_MAX_PAGES} pages, ` +
    `and nothing was written. pdf_info, pdf_count, pdf_text and merging up to 5 files stay unlimited.\n\n` +
    gate.upgradeText(`${tool} on files longer than ${FREE_MAX_PAGES} pages`);
}

/* -------------------------------------------------------------------- pages */

server.registerTool("pdf_pages", {
  title: "Extract pages into a new PDF",
  description: "Call this tool to pull selected pages into one new PDF, in the order written: \"2,4-6\" gives four pages. Asking for a page twice copies it twice. The input is never modified. Free tier: files up to 30 pages.",
  inputSchema: {
    path: z.string().describe("The source PDF"),
    pages: z.string().describe("1-based pages and ranges to keep, in output order, e.g. \"2,4-6\" or \"5,1,1\""),
    out_path: z.string().describe("Where to write the extracted PDF"),
    overwrite: z.boolean().optional().describe("Replace out_path if it exists. Default false"),
  },
}, async ({ path, pages, out_path, overwrite }) => {
  let reservation: Reservation | null = null;
  try {
    const f = await loadPdf(path);
    if (!gate.isPro() && f.pageCount > FREE_MAX_PAGES) return freeLimit(freePageText("pdf_pages", f.pageCount));
    const idx = parsePageList(pages, f.pageCount);
    reservation = reserveOutput(out_path, overwrite ?? false, [path]);
    const out = await PDFDocument.create();
    const copied = await out.copyPages(f.doc, idx);
    for (const pg of copied) out.addPage(pg);
    out.setProducer("mcp-pdf");
    const bytes = await savePdf(out, reservation.path);
    const written = reservation.path;
    reservation = null;
    const note = await record("pdf_pages", [f.path], [written], idx.length);
    const dupes = idx.length - new Set(idx).size;
    return ok(
      `Extracted ${idx.length} page${idx.length === 1 ? "" : "s"} from ${f.path}.\n\n` +
      JSON.stringify({ source: f.path, source_pages: f.pageCount, kept: idx.map((i) => i + 1), out: written, size: humanBytes(bytes) }, null, 2) +
      pdfaLostNote(f) +
      (dupes > 0 ? `\n\n${dupes} page${dupes === 1 ? " was" : "s were"} asked for more than once and copied more than once, in the order you wrote.` : "") +
      note,
    );
  } catch (e) {
    if (reservation) releaseReservations([reservation]);
    return fail(String((e as Error).message ?? e));
  }
});

/* ------------------------------------------------------------------- rotate */

server.registerTool("pdf_rotate", {
  title: "Rotate pages",
  description: "Call this tool to turn pages by a multiple of 90 degrees, clockwise for positive. Rotation is added to whatever the page already had, for a sideways scan. Writes a new file. Free tier: files up to 30 pages.",
  inputSchema: {
    path: z.string().describe("The source PDF"),
    degrees: z.number().int().describe("90, 180, 270 or -90. Positive turns clockwise. Added to the page's existing rotation"),
    pages: z.string().optional().describe("Which pages to turn, e.g. \"1\" or \"2,4-6\". Omit for every page"),
    out_path: z.string().describe("Where to write the rotated PDF"),
    overwrite: z.boolean().optional().describe("Replace out_path if it exists. Default false"),
  },
}, async (a) => {
  let reservation: Reservation | null = null;
  try {
    if (a.degrees % 90 !== 0) {
      throw new Error(`a PDF can only record rotation in multiples of 90 degrees; ${a.degrees} is not one. Nothing was written.`);
    }
    const f = await loadPdf(a.path);
    if (!gate.isPro() && f.pageCount > FREE_MAX_PAGES) return freeLimit(freePageText("pdf_rotate", f.pageCount));
    const idx = a.pages ? parsePageList(a.pages, f.pageCount) : f.doc.getPageIndices();
    reservation = reserveOutput(a.out_path, a.overwrite ?? false, [a.path]);
    const changed: { page: number; from: number; to: number }[] = [];
    for (const i of new Set(idx)) {
      const page = f.doc.getPage(i);
      const from = page.getRotation().angle;
      const to = ((from + a.degrees) % 360 + 360) % 360;
      page.setRotation(degrees(to));
      changed.push({ page: i + 1, from, to });
    }
    const bytes = await savePdf(f.doc, reservation.path);
    const written = reservation.path;
    reservation = null;
    const note = await record("pdf_rotate", [f.path], [written], changed.length);
    return ok(
      `Rotated ${changed.length} page${changed.length === 1 ? "" : "s"} by ${a.degrees} degrees.\n\n` +
      JSON.stringify({ source: f.path, out: written, pages: changed.slice(0, 30), size: humanBytes(bytes) }, null, 2) +
      (changed.length && changed.every((c) => c.from === c.to)
        ? `\n\n${a.degrees} degrees is a whole number of turns, so every page came out at the rotation it already had and the output is a copy of the input with nothing turned.`
        : "") +
      (Math.abs(a.degrees) >= 360 && a.degrees % 360 !== 0
        ? `\n\n${a.degrees} degrees is the same as ${((a.degrees % 360) + 360) % 360} degrees; a PDF stores one angle per page, not a number of turns.`
        : "") +
      `\n\nRotation is metadata on the page, not a redraw: the text and images are untouched and any reader shows the page turned.` +
      note,
    );
  } catch (e) {
    if (reservation) releaseReservations([reservation]);
    return fail(String((e as Error).message ?? e));
  }
});

/* -------------------------------------------------------------------- stamp */

interface StampArgs {
  path: string; text: string; position?: Position; opacity?: number; color?: string;
  font_size?: number; pages?: string; out_path: string; overwrite?: boolean;
}

async function stamp(a: StampArgs, businessFooter: boolean): Promise<ReturnType<typeof ok>> {
  let reservation: Reservation | null = null;
  try {
    const preset = STAMP_PRESETS[a.text.trim().toUpperCase()];
    if (!gate.isPro()) {
      if (!preset) {
        return freeLimit(
          `The free tier stamps the two presets PAID and DRAFT, and nothing was written. You asked for "${a.text}". ` +
          `Stamp PAID or DRAFT, or unlock any stamp text.\n\n${gate.upgradeText("custom stamp text")}`,
        );
      }
      if (a.color) {
        return freeLimit(
          `A custom stamp colour is a Pro feature and nothing was written. The PAID preset is ${STAMP_PRESETS.PAID.note} ` +
          `and DRAFT is ${STAMP_PRESETS.DRAFT.note}; call the tool again without color to use the preset.\n\n` +
          gate.upgradeText("custom stamp colours"),
        );
      }
    }
    if (a.font_size !== undefined && (!Number.isFinite(a.font_size) || a.font_size <= 0 || a.font_size > MAX_FONT_SIZE)) {
      throw new Error(
        `font_size must be greater than 0 and at most ${MAX_FONT_SIZE} points; got ${a.font_size}. ` +
        `A negative or zero size draws nothing and a huge one puts the glyphs off the page. Nothing was written.`,
      );
    }
    const clean = sanitizeStampText(a.text);
    if (!clean.text) throw new Error(`the stamp text is empty after removing characters a built-in PDF font cannot carry. Nothing was written.`);
    const f = await loadPdf(a.path);
    const idx = a.pages ? parsePageList(a.pages, f.pageCount) : f.doc.getPageIndices();
    const colour = parseColor(a.color ?? preset?.color ?? "#b02020");
    const opacity = a.opacity ?? (a.position === "center" || !a.position ? 0.35 : 0.85);
    if (opacity <= 0 || opacity > 1) throw new Error(`opacity must be greater than 0 and at most 1; got ${opacity}.`);
    reservation = reserveOutput(a.out_path, a.overwrite ?? false, [a.path]);
    const font = await f.doc.embedFont(StandardFonts.HelveticaBold);
    const position: Position = a.position ?? "center";
    const stamped: number[] = [];
    const overflow: { page: number; text_pt: number; page_pt: number; size: number }[] = [];
    for (const i of new Set(idx)) {
      const page = f.doc.getPage(i);
      const { width, height } = page.getSize();
      const size = a.font_size ?? autoSize(clean.text, width, position, font);
      const tw = font.widthOfTextAtSize(clean.text, size);
      const th = font.heightAtSize(size);
      const at = place(position, width, height, tw, th);
      // A stamp wider than the page is drawn off the edge and simply is not there when
      // the file is opened. autoSize stops at 6 pt, so a long line can still overflow.
      const budget = position === "center" ? Math.hypot(width, height) : width;
      if (tw > budget) overflow.push({ page: i + 1, text_pt: Math.round(tw), page_pt: Math.round(budget), size });
      page.drawText(clean.text, {
        x: at.x, y: at.y, size, font, color: rgb(colour[0], colour[1], colour[2]),
        opacity, rotate: degrees(at.rotate),
      });
      stamped.push(i + 1);
    }
    const bytes = await savePdf(f.doc, reservation.path);
    const written = reservation.path;
    reservation = null;
    const note = await record(businessFooter ? "pdf_watermark_business" : "pdf_stamp", [f.path], [written], stamped.length);
    return ok(
      `Stamped "${clean.text}" on ${stamped.length} page${stamped.length === 1 ? "" : "s"}.\n\n` +
      JSON.stringify({
        source: f.path, out: written, text: clean.text, position, opacity,
        color: a.color ?? preset?.color ?? "#b02020", pages: stamped.slice(0, 30), size: humanBytes(bytes),
      }, null, 2) +
      (clean.removed ? `\n\n${clean.removed} character${clean.removed === 1 ? " was" : "s were"} removed from the stamp text because a built-in PDF font (WinAnsi, 256 code points) cannot carry them.` : "") +
      (clean.transliterated ? `\n\n${clean.transliterated} character${clean.transliterated === 1 ? " was" : "s were"} replaced with the nearest Latin form (for example L for the Polish l with stroke), because a built-in PDF font cannot carry them. The stamp reads "${clean.text}", not what you typed.` : "") +
      (overflow.length ? `\n\nThe text is wider than the page and part of it is drawn off the edge on ${overflow.length} page${overflow.length === 1 ? "" : "s"} (page ${overflow[0].page}: ${overflow[0].text_pt} pt of text at ${overflow[0].size} pt in ${overflow[0].page_pt} pt of room, the smallest size this server will use). Stamp a shorter line, or split it over several calls with different positions.` : "") +
      (f.pdfa ? `\n\n${f.path} claims ${f.pdfa} conformance. The stamped copy still carries that claim in its metadata but is no longer guaranteed to meet it: the stamp uses a standard font that is not embedded. Validate the output before archiving it as ${f.pdfa}.` : "") +
      `\n\nThe stamp is drawn text on top of the page, not a flattened image, so it can be selected and searched. The input file is unchanged.` +
      note,
    );
  } catch (e) {
    if (reservation) releaseReservations([reservation]);
    return fail(String((e as Error).message ?? e));
  }
}

/** A stamp that would run off the page is scaled down until it fits, rather than being clipped. */
function autoSize(text: string, pageWidth: number, position: Position, font: PDFFont): number {
  const budget = position === "center" ? pageWidth * 0.95 : pageWidth - 96;
  let size = position === "center" ? 72 : 24;
  while (size > 6 && font.widthOfTextAtSize(text, size) > budget) size -= 2;
  return size;
}

server.registerTool("pdf_stamp", {
  title: "Stamp text on a PDF",
  description: "Call this tool to draw a word such as PAID or DRAFT across the pages, in a colour and position you choose. Writes a new file; input untouched. Free tier: the PAID and DRAFT presets in their preset colours.",
  inputSchema: {
    path: z.string().describe("The source PDF"),
    text: z.string().min(1).describe("What to stamp. PAID and DRAFT are presets with their own colour; any other text is Pro"),
    position: z.enum(POSITIONS).optional().describe("Where on the page. Default center, which is drawn on the 45-degree diagonal like a real stamp"),
    opacity: z.number().optional().describe("0 to 1. Default 0.35 in the centre, 0.85 in a corner"),
    color: z.string().optional().describe("Hex code such as #1b7f3b, or a name: red, green, blue, black, gray, orange, purple. Pro"),
    font_size: z.number().optional().describe("Point size. By default the stamp is sized to fit the page width"),
    pages: z.string().optional().describe("Which pages to stamp, e.g. \"1\" or \"2,4-6\". Omit for every page"),
    out_path: z.string().describe("Where to write the stamped PDF"),
    overwrite: z.boolean().optional().describe("Replace out_path if it exists. Default false"),
  },
}, async (a) => stamp(a as StampArgs, false));

server.registerTool("pdf_watermark_business", {
  title: "Stamp your business details in the footer",
  description: "Call this tool to put your business name and VAT id in the footer of every page, from the shared profile mcp-invoice and mcp-docx write. Use it before sending a document out. Pro.",
  inputSchema: {
    path: z.string().describe("The source PDF"),
    out_path: z.string().describe("Where to write the footed PDF"),
    overwrite: z.boolean().optional().describe("Replace out_path if it exists. Default false"),
    pages: z.string().optional().describe("Which pages, e.g. \"1\". Omit for every page"),
  },
}, async (a) => {
  try {
    if (!gate.isPro()) {
      return freeLimit(
        `The business footer is a Pro feature and nothing was written. On the free tier, pdf_stamp with the PAID or ` +
        `DRAFT preset still works on any file.\n\n${gate.upgradeText("stamping your business name and VAT id in the footer", "pdf_watermark_business")}`,
      );
    }
    const profile = readSharedProfile();
    const name = (profile.name ?? "").trim();
    if (!name) {
      return fail(
        `no business name is stored, so there is nothing to put in the footer and nothing was written. ` +
        `Run business_set {name, vat_id} in mcp-invoice or mcp-docx once - the profile is shared ` +
        `(${join(process.env.XDG_DATA_HOME || "~/.local/share", "mcp-servers", "profile", "business.json")}) - then call this tool again.`,
      );
    }
    const parts = [name];
    if (profile.vat_id) parts.push(`VAT ${profile.vat_id}`);
    const line = parts.join("  -  ");
    const res = await stamp({
      path: a.path, out_path: a.out_path, overwrite: a.overwrite, pages: a.pages,
      text: line, position: "bottom-center", opacity: 0.75, color: "#3a3a3a", font_size: 9,
    }, true);
    if (!profile.vat_id) {
      res.content.push({ type: "text", text: `No VAT id is stored, so the footer carries the name only. Add it once with business_set {vat_id}.` });
    }
    return res;
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ------------------------------------------------------------------ reorder */

server.registerTool("pdf_reorder", {
  title: "Reorder the pages of a PDF",
  description: "Call this tool to write a new PDF with pages in the order you give. The order must name every page exactly once, so nothing drops by accident; use pdf_pages for a subset. Pro.",
  inputSchema: {
    path: z.string().describe("The source PDF"),
    order: z.array(z.number().int().positive()).min(1).describe("The 1-based page numbers in their new order, e.g. [3,1,2] for a three-page file. Every page must appear exactly once"),
    out_path: z.string().describe("Where to write the reordered PDF"),
    overwrite: z.boolean().optional().describe("Replace out_path if it exists. Default false"),
  },
}, async (a) => {
  let reservation: Reservation | null = null;
  try {
    if (!gate.isPro()) {
      return freeLimit(
        `Reordering pages is a Pro feature and nothing was written. On the free tier, pdf_pages extracts pages in any ` +
        `order you name, which covers most of the same work on files up to ${FREE_MAX_PAGES} pages.\n\n` +
        gate.upgradeText("reordering pages", "pdf_reorder"),
      );
    }
    const f = await loadPdf(a.path);
    const seen = new Map<number, number>();
    for (const n of a.order) {
      if (n > f.pageCount) throw new Error(`page ${n} does not exist: the file has ${f.pageCount} pages. Nothing was written.`);
      seen.set(n, (seen.get(n) ?? 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, c]) => c > 1).map(([n]) => n);
    const missing = [];
    for (let n = 1; n <= f.pageCount; n++) if (!seen.has(n)) missing.push(n);
    if (dupes.length || missing.length) {
      throw new Error(
        `the order must name each of the ${f.pageCount} pages exactly once and nothing was written. ` +
        (missing.length ? `Missing: ${missing.join(", ")}. ` : "") +
        (dupes.length ? `Repeated: ${dupes.join(", ")}. ` : "") +
        `Use pdf_pages if you want a subset or a repeat.`,
      );
    }
    reservation = reserveOutput(a.out_path, a.overwrite ?? false, [a.path]);
    const out = await PDFDocument.create();
    const copied = await out.copyPages(f.doc, a.order.map((n) => n - 1));
    for (const pg of copied) out.addPage(pg);
    out.setProducer("mcp-pdf");
    const bytes = await savePdf(out, reservation.path);
    const written = reservation.path;
    reservation = null;
    const note = await record("pdf_reorder", [f.path], [written], f.pageCount);
    return ok(
      `Reordered ${f.pageCount} pages.\n\n` +
      JSON.stringify({ source: f.path, out: written, order: a.order, size: humanBytes(bytes) }, null, 2) + pdfaLostNote(f) + note,
    );
  } catch (e) {
    if (reservation) releaseReservations([reservation]);
    return fail(String((e as Error).message ?? e));
  }
});

/* --------------------------------------------------------------------- text */

server.registerTool("pdf_text", {
  title: "Read the text of a PDF",
  description: "Call this tool for best-effort text extraction from standard-font PDFs. Returns nothing for a scan (no OCR), or glyph indices for a custom-encoded font, and says which case applies. Read-only. Free tier: unlimited.",
  inputSchema: {
    path: z.string().describe("The PDF to read"),
    pages: z.string().optional().describe("Which pages, e.g. \"1\" or \"2,4-6\". Omit for every page"),
  },
}, async ({ path, pages }) => {
  try {
    const f = await loadPdf(path);
    const idx = pages ? [...new Set(parsePageList(pages, f.pageCount))].sort((x, y) => x - y) : f.doc.getPageIndices();
    const r = extractText(f.doc, idx);
    const withText = r.pages.filter((p) => p.text).length;
    // One answer is one chat message. A 2000-page report returns megabytes of text and
    // the client either truncates it silently or drops the turn, so the cut is made here
    // and named, with the argument that avoids it.
    const blocks = r.pages.map((p) => `--- page ${p.page} ---\n${p.text || `(no text extracted: ${p.note})`}`);
    let used = 0;
    let shown = 0;
    for (const b of blocks) { if (used + b.length > MAX_TEXT_CHARS && shown > 0) break; used += b.length + 2; shown++; }
    const body = blocks.slice(0, shown).join("\n\n");
    const cut = shown < blocks.length
      ? `\n\nStopped after page ${r.pages[shown - 1].page} of ${blocks.length} requested pages: the text passed the ` +
        `${MAX_TEXT_CHARS.toLocaleString("en-US")}-character limit for one answer. Nothing is missing from the file - ` +
        `call pdf_text again with pages: "${r.pages[shown].page}-" to continue from where this stopped.`
      : "";
    const fields = formFields(f.doc);
    const header =
      `${f.path}: text from ${withText} of ${idx.length} page${idx.length === 1 ? "" : "s"} ` +
      `(best effort; see the caveats below).`;
    const caveats = r.warnings.length ? `\n\nNotes:\n- ${r.warnings.join("\n- ")}` : "";
    const truth =
      `\n\nHow this was read: each page's FlateDecode content stream was decompressed with node:zlib and the Tj, TJ, ' ` +
      `and " operators were read. No OCR, no layout reconstruction, no column detection - reading order follows the ` +
      `drawing order, which is usually but not always the reading order. Word spaces are recovered from large negative ` +
      `kerns in TJ arrays; a PDF that positions every word separately can come back with words run together.`;
    return ok(`${header}\n\n${body}${cut}${fields}${caveats}${truth}`);
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/**
 * A filled form keeps its values in the field objects and in each widget's appearance
 * stream, not in the page content stream, so the content-stream walk above reads the
 * blank form and nothing else. Reading them back explicitly is the difference between
 * "this page says Application form" and the two values the user actually typed.
 */
function formFields(doc: PDFDocument): string {
  let fields;
  try { fields = doc.getForm().getFields(); } catch { return ""; }
  if (!fields.length) return "";
  const rows: string[] = [];
  for (const fl of fields) {
    const name = fl.getName();
    let value = "";
    const anyF = fl as unknown as { getText?: () => string | undefined; isChecked?: () => boolean; getSelected?: () => string[] };
    try {
      if (typeof anyF.getText === "function") value = anyF.getText() ?? "";
      else if (typeof anyF.isChecked === "function") value = anyF.isChecked() ? "checked" : "unchecked";
      else if (typeof anyF.getSelected === "function") value = (anyF.getSelected() ?? []).join(", ");
    } catch { value = "(could not be read)"; }
    rows.push(`- ${name}: ${value === "" ? "(empty)" : value}`);
  }
  return `\n\nThis PDF is a form with ${fields.length} field${fields.length === 1 ? "" : "s"}. Their values are stored in the ` +
    `form fields, not in the page content, so they are not part of the page text above:\n${rows.join("\n")}`;
}

/* ----------------------------------------------------------------- resource */

server.registerResource("recent-operations", "pdf://recent", {
  title: "Recent PDF operations",
  description: "What this server has done, newest first: the operation, the input files, the files written and when.",
  mimeType: "application/json",
}, async (uri) => {
  let ops: unknown;
  try { ops = getOps().slice(-25).reverse(); } catch (e) { ops = { error: String((e as Error).message ?? e) }; }
  return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(ops, null, 2) }] };
});

/* ------------------------------------------------------------------- prompt */

server.registerPrompt("mark_invoice_paid", {
  title: "Mark an invoice PDF as PAID",
  description: "Find an invoice, stamp PAID across it and save the stamped copy beside the original.",
  argsSchema: {
    reference: z.string().describe("The invoice reference, e.g. INV-2026-0007"),
    path: z.string().optional().describe("The invoice PDF, if you already know where it is"),
  },
}, ({ reference, path }: { reference: string; path?: string }) => {
  const out = path ? join(dirname(expandPath(path)), `${basename(expandPath(path), extname(expandPath(path)))}-paid.pdf`) : "<same folder>/<same name>-paid.pdf";
  const text =
    `Mark invoice ${reference} as paid.\n\n` +
    (path
      ? `The file is ${expandPath(path)}.\n\n`
      : `First call the mcp-invoice server's invoice_get {reference: "${reference}"} to get the invoice and the path ` +
        `of the PDF or HTML it wrote. If invoice_get returns an HTML file rather than a PDF, say so and stop: this ` +
        `server stamps PDFs, and printing the HTML to PDF is a step the user has to take. Do not invent a path.\n\n`) +
    `Then call pdf_stamp with:\n` +
    `- path: the invoice PDF\n` +
    `- text: "PAID"\n` +
    `- position: "center"\n` +
    `- out_path: ${out}\n\n` +
    `Rules: never pass overwrite: true unless the user asked for the original to be replaced - the stamped copy is a ` +
    `new file beside it. Report the reference, the amount if invoice_get gave one, and the path that was written. ` +
    `Then, if the invoice server has a tool for it, record the payment there too, so the register and the file agree.`;
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
});

gate.registerTools(server as unknown as { registerTool: Function });

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`mcp-pdf ready (${gate.isPro() ? "pro" : "free"}), data in ${dataDir()}, max input ${humanBytes(MAX_BYTES)}\n`);
