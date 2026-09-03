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

function listInfo(inner: string, fmts?: NumFormats): { list: boolean; ordered: boolean; numId: string; level: number } {
  const numPr = /<w:numPr[\s>]/.test(inner);
  const style = /<w:pStyle[^>]*w:val="(ListParagraph|ListBullet|ListNumber)"/i.exec(inner);
  const id = /<w:numId[^>]*w:val="(\d+)"/.exec(inner);
  const numId = id ? id[1] : "";
  let ordered = /<w:pStyle[^>]*w:val="ListNumber"/i.test(inner);
  if (numId && fmts?.has(numId)) ordered = fmts.get(numId) !== "bullet";
  const ilvl = /<w:ilvl[^>]*w:val="(\d+)"/.exec(inner);
  return { list: numPr || !!style, ordered, numId, level: ilvl ? Math.min(8, Number(ilvl[1])) : 0 };
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
    let p = xml.indexOf("<w:p", i);
    while (p >= 0 && !/^<w:p[\s/>]/.test(xml.slice(p, p + 5))) p = xml.indexOf("<w:p", p + 4);
    const t = xml.indexOf("<w:tbl", i);
    const pOk = p >= 0;
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
      if (prev && prev.type === "bullets" && prev.ordered === li.ordered && lastNumId === li.numId) {
        prev.items.push(text.trim());
        prev.levels!.push(li.level);
      } else out.push({ type: "bullets", items: [text.trim()], ordered: li.ordered, levels: [li.level] });
      lastNumId = li.numId;
      continue;
    }
    lastNumId = "";
    out.push({ type: "para", text });
  }
  return out;
}

/**
 * Refuse anything that is a ZIP but not a Word package. Without this, doc_fill_template
 * happily rewrites an arbitrary .zip and hands back a "-filled.docx" that Word cannot open.
 */
export function assertDocx(buf: Buffer, path: string): void {
  const entries = readZip(buf);
  if (!entries.some((e) => e.name === "word/document.xml")) {
    throw new Error(
      `${path} is a ZIP but has no word/document.xml, so it is not a Word .docx; nothing was written.`,
    );
  }
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

/**
 * XML 1.0 allows only TAB, LF, CR and #x20 upward. A NUL or a stray 0x1B inside a
 * placeholder value is well-formed after escaping but makes Word refuse the file, so
 * every string that reaches document.xml passes through here first.
 */
export function stripInvalidXml(s: string): { text: string; removed: number } {
  let out = "";
  let removed = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x09 || c === 0x0a || c === 0x0d) { out += s[i]; continue; }
    if (c < 0x20) { removed++; continue; }
    if (c === 0xfffe || c === 0xffff) { removed++; continue; }
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) { out += s[i] + s[i + 1]; i++; continue; }
      removed++; continue;                       // unpaired high surrogate
    }
    if (c >= 0xdc00 && c <= 0xdfff) { removed++; continue; }   // unpaired low surrogate
    out += s[i];
  }
  return { text: out, removed };
}

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

/** One replacement, expressed as a half-open character span of the joined paragraph text. */
interface Edit { start: number; end: number; value: string }

/**
 * A piece of a paragraph that contributes characters to the joined text: a `<w:t>` (whose
 * content can be rewritten) or a `<w:tab/>`, `<w:br/>`, `<w:cr/>` (which cannot).
 */
interface TextNode { at: number; len: number; attrs: string; text: string; from: number; to: number; editable: boolean }

const NODE = /<w:t(\s[^>]*?)?\/>|<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>|<w:cr\s*\/>/g;

function textNodes(inner: string): TextNode[] {
  const nodes: TextNode[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  NODE.lastIndex = 0;
  while ((m = NODE.exec(inner))) {
    let text: string;
    let editable = true;
    let attrs = "";
    if (m[3] !== undefined) { text = unescapeXml(m[3]); attrs = m[2] ?? ""; }
    else if (m[0].startsWith("<w:t/") || m[0].startsWith("<w:t ")) { text = ""; attrs = m[1] ?? ""; }
    else { editable = false; text = m[0].startsWith("<w:tab") ? "\t" : "\n"; }
    nodes.push({ at: m.index, len: m[0].length, attrs, text, from: cursor, to: cursor + text.length, editable });
    cursor += text.length;
  }
  return nodes;
}

/** The visible text of one `<w:p>` body. */
export function paragraphText(inner: string): string {
  return textNodes(inner).map((n) => n.text).join("");
}

/**
 * Apply character-span edits to the runs that actually hold those characters. Every other
 * run keeps its text, its `<w:rPr>` and its position, so bold runs and `<w:hyperlink>`
 * wrappers elsewhere in the paragraph survive a fill untouched. Returns null when an edit
 * would cross a `<w:tab/>` or `<w:br/>`, which no run can hold.
 */
function applyEdits(inner: string, edits: Edit[]): string | null {
  const nodes = textNodes(inner);
  if (!nodes.some((n) => n.editable)) return null;
  for (const e of edits) {
    if (nodes.some((n) => !n.editable && e.start < n.to && e.end > n.from)) return null;
  }
  let out = "";
  let copied = 0;
  for (const n of nodes) {
    if (!n.editable) continue;
    const hits = edits.filter((e) => e.start < n.to && e.end > n.from);
    if (!hits.length) continue;
    let text = "";
    for (let i = n.from; i < n.to; i++) {
      for (const e of hits) if (e.start === i) text += e.value;   // insert where the placeholder began
      if (hits.some((e) => i >= e.start && i < e.end)) continue;  // drop the placeholder characters
      text += n.text[i - n.from];
    }
    if (text === n.text) continue;
    const a = n.attrs.replace(/\s*xml:space="[^"]*"/, "");
    out += inner.slice(copied, n.at) + `<w:t${a} xml:space="preserve">${escapeXml(text)}</w:t>`;
    copied = n.at + n.len;
  }
  return out + inner.slice(copied);
}

function forEachParagraph(xml: string, fn: (joined: string) => Edit[] | null): string {
  let out = "";
  let i = 0;        // everything before this index is already copied to `out`
  let search = 0;
  while (search < xml.length) {
    const at = xml.indexOf("<w:p", search);
    if (at < 0) break;
    // <w:pgSz>, <w:permStart>, <w:proofErr> all start "<w:p": skip them, never stop the scan,
    // or every placeholder after one of them is silently left unfilled.
    if (!/^<w:p[\s/>]/.test(xml.slice(at, at + 5))) { search = at + 4; continue; }
    const el = element(xml, "p", at);
    if (!el) { search = at + 4; continue; }
    const openLen = xml.slice(at, el.end).indexOf(">") + 1;
    const inner = el.inner;
    const joined = paragraphText(inner);
    const edits = fn(joined);
    out += xml.slice(i, at + openLen);
    let rewritten: string | null = null;
    if (edits && edits.length) rewritten = applyEdits(inner, edits);
    out += rewritten ?? inner;
    out += xml.slice(at + openLen + inner.length, el.end);
    i = el.end;
    search = el.end;
  }
  return out + xml.slice(i);
}

export interface FillResult { buffer: Buffer; replaced: string[]; unfilled: string[]; sanitized: string[] }

/** Replace {{key}} placeholders across document, headers and footers; everything else is byte-identical. */
export function fillDocx(buf: Buffer, values: Record<string, string>): FillResult {
  const entries = readZip(buf);
  const replaced = new Set<string>();
  const unfilled = new Set<string>();
  const sanitized = new Set<string>();
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    const s = stripInvalidXml(String(v));
    if (s.removed) sanitized.add(k);
    clean[k] = s.text;
  }
  const out = entries.map((e) => {
    if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(e.name)) return e;
    const xml = e.data.toString("utf8");
    const next = forEachParagraph(xml, (joined) => {
      if (!joined.includes("{{")) return null;
      const edits: Edit[] = [];
      PLACEHOLDER.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = PLACEHOLDER.exec(joined))) {
        const key = m[1];
        if (!Object.prototype.hasOwnProperty.call(clean, key)) { unfilled.add(key); continue; }
        replaced.add(key);
        edits.push({ start: m.index, end: m.index + m[0].length, value: clean[key] });
      }
      return edits;
    });
    return { name: e.name, data: Buffer.from(next, "utf8") };
  });
  return { buffer: writeZip(out), replaced: [...replaced], unfilled: [...unfilled], sanitized: [...sanitized] };
}
