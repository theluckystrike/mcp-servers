/** RFC 4180 CSV parser with delimiter sniffing. No dependencies. */

export const DELIMITERS = [",", ";", "\t", "|"] as const;

/** Sniff the delimiter by counting occurrences outside quotes across the first lines. */
export function sniffDelimiter(text: string, sample = 64): string {
  const counts: Record<string, number[]> = {};
  for (const d of DELIMITERS) counts[d] = [];
  let inQ = false, line = 0;
  const cur: Record<string, number> = {};
  for (const d of DELIMITERS) cur[d] = 0;
  for (let i = 0; i < text.length && line < sample; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') i++; else inQ = false; }
      continue;
    }
    if (c === '"') { inQ = true; continue; }
    if (c === "\n") {
      for (const d of DELIMITERS) { counts[d].push(cur[d]); cur[d] = 0; }
      line++; continue;
    }
    if (c === "\r") continue;
    if (c in cur) cur[c]++;
  }
  for (const d of DELIMITERS) counts[d].push(cur[d]);
  let best = ",", bestScore = -1;
  for (const d of DELIMITERS) {
    const rows = counts[d].filter((n, idx) => idx === 0 || n > 0 || counts[d][0] > 0);
    const nonZero = counts[d].filter((n) => n > 0).length;
    if (nonZero === 0) continue;
    const first = counts[d][0];
    const consistent = counts[d].filter((n) => n === first && n > 0).length;
    const score = consistent * 1000 + first;
    if (score > bestScore) { bestScore = score; best = d; }
    void rows;
  }
  return best;
}

/** Parse CSV text into a matrix of strings. Handles CRLF, quoted delimiters and embedded newlines. */
export function parseCsv(text: string, delimiter?: string): { rows: string[][]; delimiter: string } {
  let src = text;
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
  const d = delimiter ?? sniffDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  let started = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") { inQ = true; started = true; continue; }
    if (c === d) { row.push(field); field = ""; started = true; continue; }
    if (c === "\r") { if (src[i + 1] === "\n") i++; row.push(field); rows.push(row); row = []; field = ""; started = false; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; started = false; continue; }
    field += c;
    started = true;
  }
  if (started || field !== "" || row.length) { row.push(field); rows.push(row); }
  return { rows, delimiter: d };
}

/**
 * Plain ASCII decimal: optional sign, no thousands separators, no leading zeros on a
 * multi-digit integer part (so an identifier like "007" or "0123" stays text), optional
 * fraction, optional exponent. ".5" and "0.5" are numbers; "00.5" is not.
 */
const PLAIN_DECIMAL = /^[+-]?(?:0|[1-9]\d*)?(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

/**
 * Comma thousands separators, only in the one unambiguous shape: 1-3 leading digits then
 * one or more groups of exactly three, then an optional dot fraction. "1,250.00" matches;
 * "1.250,00" (European) and "1,250,00" do not, and stay text.
 */
const GROUPED_DECIMAL = /^[+-]?[1-9]\d{0,2}(?:,\d{3})+(?:\.\d+)?$/;

/**
 * Coerce a CSV string cell to number/boolean when unambiguous.
 *
 * D-R12: this used to accept a number only when `String(n).length >= s.length - 1`, a
 * string-LENGTH test. Any money value ending in ".00" lost more than one character when
 * rendered back ("403.00" -> "403"), so it was written out as TEXT and Excel's own
 * SUM skipped it silently. The decision is now by PATTERN only; trailing zeros and
 * thousands separators are both fine, and length never enters into it.
 */
export function coerce(v: string): string | number | boolean {
  const s = v.trim();
  if (s === "") return "";
  // A bare sign, a bare dot, or "" after the sign must not become 0.
  if (/\d/.test(s)) {
    if (PLAIN_DECIMAL.test(s)) {
      const n = Number(s);
      if (Number.isFinite(n)) return n;
    } else if (GROUPED_DECIMAL.test(s)) {
      const n = Number(s.replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  if (s === "true" || s === "TRUE") return true;
  if (s === "false" || s === "FALSE") return false;
  return v;
}

export function csvEscape(v: unknown, delimiter = ","): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  if (s.includes('"') || s.includes(delimiter) || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function toCsv(rows: unknown[][], delimiter = ","): string {
  return rows.map((r) => r.map((c) => csvEscape(c, delimiter)).join(delimiter)).join("\n");
}
