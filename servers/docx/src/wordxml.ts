import type { Block } from "./blocks.js";
import { readZip, writeZip } from "./zip.js";

/**
 * A small WordprocessingML walk. Enough to read text, headings, lists and tables back
 * out of any .docx, and to substitute {{placeholders}} in one without touching the rest
 * of the package - so formatting, styles, headers and images survive a template fill.
 * No XML library: the shapes we need are regular, and an extra dependency is not worth it.
 */

export function unescapeXml(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Find the element `<w:NAME ...>...</w:NAME>` (or a self-closing one) that starts at `from`. */
function element(xml: string, name: string, from: number): { inner: string; end: number } | null {
  const open = new RegExp(`<w:${name}(\\s[^>]*)?(/)?>`, "g");
  open.lastIndex = from;
  const m = open.exec(xml);
  if (!m || m.index !== from) return null;
  if (m[2]) return { inner: "", end: from + m[0].length };
  const openTag = new RegExp(`<w:${name}(?:\\s[^>]*)?>`, "g");
  const closeTag = `</w:${name}>`;
  let depth = 1;
  let i = from + m[0].length;
  const start = i;
  while (depth > 0) {
    const close = xml.indexOf(closeTag, i);
    if (close < 0) return { inner: xml.slice(start), end: xml.length };
    openTag.lastIndex = i;
    let nested: RegExpExecArray | null;
    let nextOpen = -1;
    while ((nested = openTag.exec(xml))) { if (nested.index < close) { nextOpen = nested.index; break; } else break; }
    if (nextOpen >= 0 && nextOpen < close) { depth++; i = nextOpen + 1; continue; }
    depth--;
    i = close + closeTag.length;
    if (depth === 0) return { inner: xml.slice(start, close), end: i };
  }
  return null;
}

/** The visible text of one `<w:p>` body. */
export function paragraphText(inner: string): string {
  let out = "";
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t\s*\/>|<w:tab\s*\/>|<w:br\s*\/>|<w:cr\s*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner))) {
    if (m[1] !== undefined) out += unescapeXml(m[1]);
    else if (m[0].startsWith("<w:tab")) out += "\t";
    else if (m[0].startsWith("<w:br") || m[0].startsWith("<w:cr")) out += "\n";
  }
  return out;
}

function headingLevel(inner: string): number | null {
  const m = /<w:pStyle[^>]*w:val="([^"]*)"/.exec(inner);
  if (!m) return null;
  const v = m[1].replace(/\s+/g, "").toLowerCase();
  if (v === "title") return 1;
  const h = /^heading(\d)$/.exec(v);
  return h ? Math.min(6, Number(h[1])) : null;
}

/**
 * numId -> "bullet" | "decimal" | ... , read from word/numbering.xml. Without it every
 * numbered list reads back as a bullet list, because in WordprocessingML the only
 * difference between the two is the numbering definition the paragraph points at.
 */
export type NumFormats = Map<string, string>;

export function numberingFormats(numberingXml: string): NumFormats {
  const abstract = new Map<string, string>();
  const absRe = /<w:abstractNum[^>]*w:abstractNumId="(\d+)"([\s\S]*?)<\/w:abstractNum>/g;
  let m: RegExpExecArray | null;
  while ((m = absRe.exec(numberingXml))) {
    const lvl = /<w:lvl[^>]*w:ilvl="0"[\s\S]*?<w:numFmt[^>]*w:val="([^"]+)"/.exec(m[2]);
    abstract.set(m[1], lvl ? lvl[1] : "bullet");
  }
  const out: NumFormats = new Map();
  const numRe = /<w:num[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g;
  while ((m = numRe.exec(numberingXml))) {
    const a = /<w:abstractNumId[^>]*w:val="(\d+)"/.exec(m[2]);
    out.set(m[1], (a && abstract.get(a[1])) || "bullet");
  }
  return out;
}

function listInfo(inner: string, fmts?: NumFormats): { list: boolean; ordered: boolean; numId: string } {
  const numPr = /<w:numPr[\s>]/.test(inner);
  const style = /<w:pStyle[^>]*w:val="(ListParagraph|ListBullet|ListNumber)"/i.exec(inner);
  const id = /<w:numId[^>]*w:val="(\d+)"/.exec(inner);
  const numId = id ? id[1] : "";
  let ordered = /<w:pStyle[^>]*w:val="ListNumber"/i.test(inner);
  if (numId && fmts?.has(numId)) ordered = fmts.get(numId) !== "bullet";
  return { list: numPr || !!style, ordered, numId };
}

function tableBlock(inner: string): Block | null {
  const rows: string[][] = [];
  let i = 0;
  while (i < inner.length) {
    const at = inner.indexOf("<w:tr", i);
    if (at < 0) break;
    const tr = element(inner, "tr", at);
    if (!tr) break;
    const cells: string[] = [];
    let j = 0;
    while (j < tr.inner.length) {
      const ct = tr.inner.indexOf("<w:tc", j);
      if (ct < 0) break;
      const tc = element(tr.inner, "tc", ct);
      if (!tc) break;
      cells.push(blocksOf(tc.inner).map((b) => (b.type === "para" || b.type === "heading" ? b.text : "")).join(" ").trim());
      j = tc.end;
    }
    rows.push(cells);
    i = tr.end;
  }
  if (!rows.length) return null;
  return { type: "table", headers: rows[0], rows: rows.slice(1) };
}

/** Walk a WordprocessingML fragment into blocks, in document order. */
export function blocksOf(xml: string, fmts?: NumFormats): Block[] {
  const out: Block[] = [];
  let lastNumId = "";
  let i = 0;
  while (i < xml.length) {
    const p = xml.indexOf("<w:p", i);
    const t = xml.indexOf("<w:tbl", i);
    const pOk = p >= 0 && /^<w:p[\s/>]/.test(xml.slice(p, p + 5));
    const next = pOk && (t < 0 || p < t) ? { at: p, kind: "p" as const } : t >= 0 ? { at: t, kind: "tbl" as const } : null;
    if (!next) break;
    if (next.kind === "tbl") {
      const el = element(xml, "tbl", next.at);
      if (!el) { i = next.at + 6; continue; }
      const tb = tableBlock(el.inner);
      if (tb) out.push(tb);
      i = el.end;
      continue;
    }
    const el = element(xml, "p", next.at);
    if (!el) { i = next.at + 4; continue; }
    i = el.end;
    const text = paragraphText(el.inner);
    if (!text.trim()) continue;
    const lvl = headingLevel(el.inner);
    if (lvl) { out.push({ type: "heading", level: lvl, text: text.trim() }); continue; }
    const li = listInfo(el.inner, fmts);
    if (li.list) {
      const prev = out[out.length - 1];
      // A new numId starts a new list even when both are bullets: Word models
      // "bullets, paragraph, more bullets" that way and merging them loses the break.
      if (prev && prev.type === "bullets" && prev.ordered === li.ordered && lastNumId === li.numId) prev.items.push(text.trim());
      else out.push({ type: "bullets", items: [text.trim()], ordered: li.ordered });
      lastNumId = li.numId;
      continue;
    }
    lastNumId = "";
    out.push({ type: "para", text });
  }
  return out;
}

export function documentXml(buf: Buffer): string {
  const entries = readZip(buf);
  const doc = entries.find((e) => e.name === "word/document.xml");
  if (!doc) throw new Error("this file has no word/document.xml, so it is not a Word .docx (a .doc or .rtf will not work).");
  return doc.data.toString("utf8");
}

export function readDocx(buf: Buffer): Block[] {
  const entries = readZip(buf);
  const doc = entries.find((e) => e.name === "word/document.xml");
  if (!doc) throw new Error("this file has no word/document.xml, so it is not a Word .docx (a .doc or .rtf will not work).");
  const num = entries.find((e) => e.name === "word/numbering.xml");
  const fmts = num ? numberingFormats(num.data.toString("utf8")) : undefined;
  const xml = doc.data.toString("utf8");
  const body = /<w:body(?:\s[^>]*)?>([\s\S]*)<\/w:body>/.exec(xml);
  return blocksOf(body ? body[1] : xml, fmts);
}

const PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** Every distinct {{placeholder}} in a .docx, in first-seen order. */
export function placeholdersIn(buf: Buffer): string[] {
  const seen: string[] = [];
  for (const e of readZip(buf)) {
    if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(e.name)) continue;
    forEachParagraph(e.data.toString("utf8"), (joined) => {
      let m: RegExpExecArray | null;
      PLACEHOLDER.lastIndex = 0;
      while ((m = PLACEHOLDER.exec(joined))) if (!seen.includes(m[1])) seen.push(m[1]);
      return null;
    });
  }
  return seen;
}

function forEachParagraph(xml: string, fn: (joined: string) => string | null): string {
  let out = "";
  let i = 0;
  while (i < xml.length) {
    const at = xml.indexOf("<w:p", i);
    if (at < 0 || !/^<w:p[\s/>]/.test(xml.slice(at, at + 5))) break;
    const el = element(xml, "p", at);
    if (!el) break;
    const openLen = xml.slice(at, el.end).indexOf(">") + 1;
    const inner = el.inner;
    const joined = paragraphText(inner);
    const replaced = fn(joined);
    out += xml.slice(i, at + openLen);
    if (replaced === null || replaced === joined) out += inner;
    else out += rewriteRuns(inner, replaced);
    out += xml.slice(at + openLen + inner.length, el.end);
    i = el.end;
  }
  return out + xml.slice(i);
}

/**
 * Put the whole replaced paragraph text into the first run and blank the rest. This is
 * what makes a placeholder split across runs work: Word routinely breaks {{client}} into
 * "{{", "clie", "nt}}" after a spell-check pass, so per-run replacement silently misses it.
 * The first run's formatting is kept for the whole paragraph.
 */
function rewriteRuns(inner: string, text: string): string {
  let first = true;
  return inner.replace(/<w:t(\s[^>]*)?\/>|<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g, (whole, selfAttrs, attrs) => {
    if (!first) return `<w:t${attrs ?? selfAttrs ?? ""}></w:t>`.replace(/xml:space="[^"]*"/, "");
    first = false;
    const a = (attrs ?? selfAttrs ?? "").replace(/\s*xml:space="[^"]*"/, "");
    return `<w:t${a} xml:space="preserve">${escapeXml(text)}</w:t>`;
  });
}

export interface FillResult { buffer: Buffer; replaced: string[]; unfilled: string[] }

/** Replace {{key}} placeholders across document, headers and footers; everything else is byte-identical. */
export function fillDocx(buf: Buffer, values: Record<string, string>): FillResult {
  const entries = readZip(buf);
  const replaced = new Set<string>();
  const unfilled = new Set<string>();
  const out = entries.map((e) => {
    if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(e.name)) return e;
    const xml = e.data.toString("utf8");
    const next = forEachParagraph(xml, (joined) => {
      if (!joined.includes("{{")) return null;
      PLACEHOLDER.lastIndex = 0;
      const s = joined.replace(PLACEHOLDER, (whole, key: string) => {
        const hit = Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined;
        if (hit === undefined) { unfilled.add(key); return whole; }
        replaced.add(key);
        return String(hit);
      });
      return s === joined ? null : s;
    });
    return { name: e.name, data: Buffer.from(next, "utf8") };
  });
  return { buffer: writeZip(out), replaced: [...replaced], unfilled: [...unfilled] };
}
