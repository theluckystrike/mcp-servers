import { inflateRawSync, inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFName, PDFRawStream, PDFStream } from "pdf-lib";

/**
 * Best-effort text extraction, on purpose and with no hidden dependency.
 *
 * A PDF does not store text; it stores drawing operators. This module decompresses
 * each page's FlateDecode content stream with node:zlib and reads the four
 * text-showing operators - Tj, TJ, ' and " - plus the positioning operators that
 * end a line. What comes out is the bytes the page hands its font. When the font
 * uses a standard encoding (every PDF written with a built-in font, and most
 * exports from word processors) those bytes are the text. When the font ships a
 * custom or CID encoding - most scanned, subset-embedded or CJK documents - they
 * are glyph indices, and the answer says so instead of pretending otherwise.
 *
 * There is no OCR here: a scanned page carries an image and no text operators at
 * all, so it comes back empty and is reported as empty.
 */

export interface PageText {
  page: number;
  text: string;
  /** Why a page produced nothing, when it produced nothing. */
  note?: string;
}

function decodeStream(stream: PDFStream): { bytes: Buffer | null; filter: string } {
  if (!(stream instanceof PDFRawStream)) return { bytes: null, filter: "not a raw stream" };
  const raw = Buffer.from(stream.contents);
  const f = stream.dict.lookup(PDFName.of("Filter"));
  const names: string[] = [];
  if (f instanceof PDFName) names.push(f.asString());
  else if (f instanceof PDFArray) {
    for (let i = 0; i < f.size(); i++) {
      const n = f.lookup(i);
      if (n instanceof PDFName) names.push(n.asString());
    }
  }
  if (!names.length) return { bytes: raw, filter: "none" };
  if (names.length === 1 && (names[0] === "/FlateDecode" || names[0] === "/Fl")) {
    try { return { bytes: inflateSync(raw), filter: "FlateDecode" }; } catch { /* try raw deflate */ }
    try { return { bytes: inflateRawSync(raw), filter: "FlateDecode (headerless)" }; } catch { /* corrupt */ }
    return { bytes: null, filter: "FlateDecode (could not inflate)" };
  }
  return { bytes: null, filter: names.join(" + ") };
}

function pageStreams(doc: PDFDocument, pageIndex: number): PDFStream[] {
  const page = doc.getPage(pageIndex);
  const contents = page.node.Contents();
  const out: PDFStream[] = [];
  if (!contents) return out;
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) {
      const s = contents.lookup(i);
      if (s instanceof PDFStream) out.push(s);
    }
  } else if (contents instanceof PDFStream) {
    out.push(contents);
  } else {
    const s = doc.context.lookupMaybe(contents as never, PDFStream);
    if (s) out.push(s);
  }
  return out;
}

/** PDF string bytes -> text. UTF-16BE when the BOM says so, otherwise byte-per-character. */
function decodeString(bytes: number[]): string {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let s = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    return s;
  }
  return Buffer.from(bytes).toString("latin1");
}

const DELIM = new Set(["(", ")", "<", ">", "[", "]", "{", "}", "/", "%"]);
const isSpace = (c: string) => c === " " || c === "\n" || c === "\r" || c === "\t" || c === "\f" || c === "\0";

type Operand = { kind: "string"; value: string } | { kind: "number"; value: number } | { kind: "mark" } | { kind: "other" };

/** Read the text-showing operators out of one decompressed content stream. */
export function textFromContentStream(content: Buffer): string {
  const s = content.toString("latin1");
  let i = 0;
  let out = "";
  let stack: Operand[] = [];
  const push = (o: Operand) => { stack.push(o); if (stack.length > 4096) stack = stack.slice(-64); };
  const emit = (t: string) => { if (t) out += t; };
  const newline = () => { if (out && !out.endsWith("\n")) out += "\n"; };

  while (i < s.length) {
    const c = s[i];
    if (isSpace(c)) { i++; continue; }
    if (c === "%") { while (i < s.length && s[i] !== "\n" && s[i] !== "\r") i++; continue; }
    if (c === "(") {
      i++;
      let depth = 1;
      const bytes: number[] = [];
      while (i < s.length) {
        const ch = s[i];
        if (ch === "\\") {
          const n = s[i + 1];
          i += 2;
          if (n === "n") bytes.push(10);
          else if (n === "r") bytes.push(13);
          else if (n === "t") bytes.push(9);
          else if (n === "b") bytes.push(8);
          else if (n === "f") bytes.push(12);
          else if (n === "\n") { /* line continuation */ }
          else if (n === "\r") { if (s[i] === "\n") i++; }
          else if (n >= "0" && n <= "7") {
            let oct = n;
            while (oct.length < 3 && s[i] >= "0" && s[i] <= "7") { oct += s[i]; i++; }
            bytes.push(parseInt(oct, 8) & 0xff);
          } else bytes.push(n.charCodeAt(0));
          continue;
        }
        if (ch === "(") { depth++; bytes.push(40); i++; continue; }
        if (ch === ")") { depth--; i++; if (depth === 0) break; bytes.push(41); continue; }
        bytes.push(ch.charCodeAt(0) & 0xff);
        i++;
      }
      push({ kind: "string", value: decodeString(bytes) });
      continue;
    }
    if (c === "<") {
      if (s[i + 1] === "<") { i += 2; push({ kind: "other" }); continue; }
      i++;
      let hex = "";
      while (i < s.length && s[i] !== ">") { if (!isSpace(s[i])) hex += s[i]; i++; }
      i++;
      if (hex.length % 2 === 1) hex += "0";
      const bytes: number[] = [];
      for (let k = 0; k + 1 < hex.length + 1; k += 2) {
        const b = parseInt(hex.slice(k, k + 2), 16);
        if (Number.isFinite(b)) bytes.push(b);
      }
      push({ kind: "string", value: decodeString(bytes) });
      continue;
    }
    if (c === ">") { i += s[i + 1] === ">" ? 2 : 1; continue; }
    if (c === "[") { i++; push({ kind: "mark" }); continue; }
    if (c === "]") {
      i++;
      // Collect the array that was just closed and remember it as one string operand,
      // which is what TJ then shows.
      const parts: string[] = [];
      let j = stack.length - 1;
      for (; j >= 0; j--) {
        const o = stack[j];
        if (o.kind === "mark") break;
        if (o.kind === "string") parts.unshift(o.value);
        // A large negative kern in a TJ array is how a PDF writes a word space.
        else if (o.kind === "number" && o.value <= -100) parts.unshift(" ");
      }
      stack = stack.slice(0, Math.max(0, j));
      push({ kind: "string", value: parts.join("") });
      continue;
    }
    if (c === "/") {
      i++;
      while (i < s.length && !isSpace(s[i]) && !DELIM.has(s[i])) i++;
      push({ kind: "other" });
      continue;
    }
    if (c === "{" || c === "}" || c === ")") { i++; continue; }
    // A regular token: a number or an operator keyword.
    let tok = "";
    while (i < s.length && !isSpace(s[i]) && !DELIM.has(s[i])) { tok += s[i]; i++; }
    if (!tok.length) { i++; continue; }
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(tok)) { push({ kind: "number", value: Number(tok) }); continue; }
    const last = stack[stack.length - 1];
    switch (tok) {
      case "Tj":
      case "TJ":
        if (last && last.kind === "string") emit(last.value);
        break;
      case "'":
        newline();
        if (last && last.kind === "string") emit(last.value);
        break;
      case '"':
        newline();
        if (last && last.kind === "string") emit(last.value);
        break;
      case "Td":
      case "TD":
      case "T*":
      case "Tm":
      case "BT":
      case "ET":
        newline();
        break;
      default:
        break;
    }
    stack = [];
  }
  return out;
}

export interface ExtractResult {
  pages: PageText[];
  /** Pages whose bytes were not text-shaped: encoding notes, unsupported filters, image-only pages. */
  warnings: string[];
}

export function extractText(doc: PDFDocument, pageIndexes: number[]): ExtractResult {
  const pages: PageText[] = [];
  const warnings: string[] = [];
  for (const idx of pageIndexes) {
    const streams = pageStreams(doc, idx);
    if (!streams.length) {
      pages.push({ page: idx + 1, text: "", note: "the page has no content stream" });
      continue;
    }
    let buf = Buffer.alloc(0);
    let skipped: string[] = [];
    for (const st of streams) {
      const d = decodeStream(st);
      if (d.bytes) buf = Buffer.concat([buf, d.bytes, Buffer.from("\n")]);
      else skipped.push(d.filter);
    }
    if (skipped.length) {
      warnings.push(`page ${idx + 1}: skipped ${skipped.length} content stream(s) with filter ${skipped.join(", ")} (only FlateDecode and uncompressed streams are read)`);
    }
    let text = "";
    try {
      text = textFromContentStream(buf);
    } catch (e) {
      warnings.push(`page ${idx + 1}: content stream could not be walked (${String((e as Error).message ?? e)})`);
    }
    text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    const note = text
      ? undefined
      : (skipped.length ? "the content streams use a filter this server does not read" : "no text operators on the page (it is probably a scan or a pure image; there is no OCR here)");
    pages.push({ page: idx + 1, text, note });
  }
  const garbled = pages.filter((p) => p.text && !/[A-Za-z0-9]/.test(p.text));
  if (garbled.length) {
    warnings.push(
      `page${garbled.length > 1 ? "s" : ""} ${garbled.map((p) => p.page).join(", ")}: the operators produced no readable ` +
      `characters, which means the font uses a custom or CID encoding and the bytes are glyph indices, not text`,
    );
  }
  return { pages, warnings };
}
