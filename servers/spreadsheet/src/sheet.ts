import { existsSync, statSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, extname, dirname, basename, join } from "node:path";
import * as XLSX from "xlsx";
import { parseCsv, coerce } from "./csv.js";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const FREE_MAX_ROWS = 5000;
export const FREE_MAX_BYTES = 5 * 1024 * 1024;
export const FREE_WRITE_ROWS = 500;

export class UserError extends Error {}

export function expandPath(p: string): string {
  if (typeof p !== "string" || p.trim() === "") throw new UserError("path is required");
  let s = p.trim();
  if (s === "~") s = homedir();
  else if (s.startsWith("~/")) s = join(homedir(), s.slice(2));
  return resolve(s);
}

export function requireExisting(p: string): string {
  const full = expandPath(p);
  if (!existsSync(full)) throw new UserError(`file not found: ${full}`);
  const st = statSync(full);
  if (st.isDirectory()) throw new UserError(`${full} is a directory, not a spreadsheet file`);
  if (st.size > MAX_FILE_BYTES) {
    throw new UserError(`file is ${(st.size / 1048576).toFixed(1)} MB which is over the 50 MB limit this server can open safely. Split the file or export the sheet you need.`);
  }
  return full;
}

export type Cell = string | number | boolean | null;

export interface LoadedSheet {
  name: string;
  matrix: Cell[][];       // raw rows, exactly as stored
  truncated: boolean;     // free-tier row cap hit
  totalRowsSeen: number;
}

export interface Workbook {
  path: string;
  kind: "csv" | "xlsx";
  bytes: number;
  sheetNames: string[];
  delimiter?: string;
  get(sheet?: string): LoadedSheet;
}

function normMatrix(rows: unknown[][]): Cell[][] {
  return rows.map((r) => r.map((c) => {
    if (c === undefined || c === null || c === "") return null;
    if (typeof c === "number" || typeof c === "boolean" || typeof c === "string") return c;
    if (c instanceof Date) return c.toISOString().slice(0, 10);
    return String(c);
  }));
}

function trimTrailing(m: Cell[][]): Cell[][] {
  let end = m.length;
  while (end > 0 && m[end - 1].every((c) => c === null)) end--;
  return m.slice(0, end);
}

export interface LoadOpts { maxRows?: number }

export function loadWorkbook(pathIn: string, opts: LoadOpts = {}): Workbook {
  const full = requireExisting(pathIn);
  const bytes = statSync(full).size;
  const ext = extname(full).toLowerCase();
  const maxRows = opts.maxRows ?? Infinity;

  if (ext === ".csv" || ext === ".tsv" || ext === ".txt") {
    const text = readFileSync(full, "utf8");
    const parsed = parseCsv(text, ext === ".tsv" ? "\t" : undefined);
    const all = trimTrailing(normMatrix(parsed.rows.map((r) => r.map((c) => coerce(c)))));
    const name = basename(full);
    return {
      path: full, kind: "csv", bytes, sheetNames: [name], delimiter: parsed.delimiter,
      get(sheet?: string): LoadedSheet {
        if (sheet && sheet !== name && sheet !== "0") throw new UserError(`${name} is a CSV file; it has one sheet named ${JSON.stringify(name)}`);
        const body = all.length > 1 ? all.slice(0, Math.max(1, Math.min(all.length, maxRows + 1))) : all;
        return { name, matrix: body, truncated: body.length < all.length, totalRowsSeen: all.length };
      },
    };
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(readFileSync(full), { type: "buffer", cellDates: true, cellNF: false, cellText: false });
  } catch (e) {
    throw new UserError(`could not open ${full} as a spreadsheet (${(e as Error).message}). Supported: .xlsx .xlsm .xlsb .xls .ods .csv .tsv`);
  }
  const sheetNames = wb.SheetNames.slice();
  return {
    path: full, kind: "xlsx", bytes, sheetNames,
    get(sheet?: string): LoadedSheet {
      const name = sheet ?? sheetNames[0];
      if (!sheetNames.includes(name)) throw new UserError(`sheet ${JSON.stringify(name)} not found. Sheets: ${sheetNames.map((s) => JSON.stringify(s)).join(", ")}`);
      const ws = wb.Sheets[name];
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false, raw: true }) as unknown[][];
      const all = trimTrailing(normMatrix(raw));
      const body = all.length > 1 ? all.slice(0, Math.max(1, Math.min(all.length, maxRows + 1))) : all;
      return { name, matrix: body, truncated: body.length < all.length, totalRowsSeen: all.length };
    },
  };
}

/** Guess which row holds the headers. Returns index into matrix, or -1 if none. */
export function guessHeaderRow(m: Cell[][]): number {
  const limit = Math.min(m.length, 12);
  for (let i = 0; i < limit; i++) {
    const row = m[i];
    const filled = row.filter((c) => c !== null && String(c).trim() !== "");
    if (filled.length < 2 && row.length > 1) continue;
    if (filled.length === 0) continue;
    const allText = filled.every((c) => typeof c === "string" && String(c).trim() !== "");
    const uniq = new Set(filled.map((c) => String(c).trim().toLowerCase())).size === filled.length;
    if (!allText || !uniq) continue;
    const next = m[i + 1];
    if (!next) return i;
    const nextFilled = next.filter((c) => c !== null);
    if (nextFilled.length === 0) continue;
    return i;
  }
  return m.length && m[0].some((c) => typeof c === "string") ? 0 : -1;
}

export function headerNames(m: Cell[][], headerRow: number): string[] {
  const width = m.reduce((w, r) => Math.max(w, r.length), 0);
  const names: string[] = [];
  const seen = new Map<string, number>();
  for (let c = 0; c < width; c++) {
    let n = headerRow >= 0 ? String(m[headerRow]?.[c] ?? "").trim() : "";
    if (n === "") n = colLetter(c);
    const prev = seen.get(n.toLowerCase());
    if (prev !== undefined) { seen.set(n.toLowerCase(), prev + 1); n = `${n}_${prev + 1}`; }
    else seen.set(n.toLowerCase(), 0);
    names.push(n);
  }
  return names;
}

/**
 * Coerce a cell to a number for aggregation: accepts real numbers and text such as
 * "1,250.00", "$1,250.00", "EUR 1 250,00", "(300)" and "12.5%". Returns null when there is no number.
 */
export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null || v === undefined) return null;
  let s = String(v).trim();
  if (s === "") return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1).trim(); }
  const pct = s.endsWith("%");
  if (pct) s = s.slice(0, -1).trim();
  s = s.replace(/[^0-9.,+\-eE]/g, "").trim();
  s = s.replace(/(^|[^0-9])[eE]/g, "$1"); // drop currency letters, keep 1e3 exponents
  // 1.250,00 (European) vs 1,250.00 (English)
  if (/,\d{1,2}$/.test(s) && /[.\s]/.test(s.slice(0, s.lastIndexOf(",")))) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  if (s === "" || s === "-" || s === "+") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return sign * (pct ? n / 100 : n);
}

export function colLetter(i: number): string {
  let s = "";
  let n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

export interface Table { headers: string[]; rows: Cell[][]; headerRow: number; records(): Record<string, Cell>[] }

export function toTable(ls: LoadedSheet): Table {
  const hr = guessHeaderRow(ls.matrix);
  const headers = headerNames(ls.matrix, hr);
  const rows = ls.matrix.slice(hr + 1);
  const width = headers.length;
  const padded = rows.map((r) => { const out = r.slice(0, width); while (out.length < width) out.push(null); return out; });
  return {
    headers, headerRow: hr, rows: padded,
    records() { return padded.map((r) => { const o: Record<string, Cell> = {}; headers.forEach((h, i) => { o[h] = r[i] ?? null; }); return o; }); },
  };
}

export function inferType(values: Cell[]): string {
  let n = 0, b = 0, d = 0, s = 0, empty = 0;
  const dateRe = /^\d{4}-\d{2}-\d{2}([T ]|$)|^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
  for (const v of values) {
    if (v === null || String(v).trim() === "") { empty++; continue; }
    if (typeof v === "number") { n++; continue; }
    if (typeof v === "boolean") { b++; continue; }
    const t = String(v).trim();
    if (dateRe.test(t)) { d++; continue; }
    if (/^-?[$€£]?[\d,]*\.?\d+%?$/.test(t) && /\d/.test(t)) { n++; continue; }
    s++;
  }
  const total = n + b + d + s;
  if (total === 0) return "empty";
  if (s === 0 && d > 0 && d >= n) return "date";
  if (s === 0 && n > 0 && n >= d) return "number";
  if (s === 0 && b > 0) return "boolean";
  return "text";
}

/** Parse an A1-style range like "A1:C10" or "B2". Returns 0-based inclusive bounds. */
export function parseRange(range: string): { r0: number; c0: number; r1: number; c1: number } {
  const m = /^([A-Za-z]+)(\d+)(?::([A-Za-z]+)(\d+))?$/.exec(range.trim());
  if (!m) throw new UserError(`range ${JSON.stringify(range)} is not A1 notation (examples: A1:D50, B2)`);
  const col = (s: string) => { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const r0 = Number(m[2]) - 1, c0 = col(m[1]);
  const r1 = m[4] ? Number(m[4]) - 1 : r0, c1 = m[3] ? col(m[3]) : c0;
  return { r0: Math.min(r0, r1), c0: Math.min(c0, c1), r1: Math.max(r0, r1), c1: Math.max(c0, c1) };
}

export function outputPath(input: string, outPath: string | undefined, suffix: string, ext?: string): string {
  if (outPath) return expandPath(outPath);
  const dir = dirname(input);
  const base = basename(input, extname(input));
  const e = ext ?? (extname(input) || ".csv");
  return join(dir, `${base}${suffix}${e}`);
}

export function renderTable(headers: string[], rows: Cell[][], maxWidth = 40): string {
  const cells = [headers, ...rows.map((r) => r.map((c) => (c === null ? "" : String(c))))];
  const widths = headers.map((_, i) => Math.min(maxWidth, cells.reduce((w, r) => Math.max(w, String(r[i] ?? "").length), 0)));
  const line = (r: (string | Cell)[]) => "| " + widths.map((w, i) => {
    let s = String(r[i] ?? "");
    if (s.length > w) s = s.slice(0, w - 1) + "…";
    return s.padEnd(w);
  }).join(" | ") + " |";
  const sep = "|" + widths.map((w) => "-".repeat(w + 2)).join("|") + "|";
  return [line(headers), sep, ...rows.map((r) => line(r.map((c) => (c === null ? "" : String(c)))))].join("\n");
}
