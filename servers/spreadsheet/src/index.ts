#!/usr/bin/env node
/**
 * mcp-spreadsheet - open, inspect, query, edit and convert xlsx/csv files locally.
 * Built by theluckystrike. All data stays on this machine.
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate } from "@theluckystrike/mcp-license";
import { existsSync, mkdirSync, renameSync, writeFileSync, statSync } from "node:fs";
import { dirname, extname } from "node:path";
import * as XLSX from "xlsx";
import { z } from "zod";
import { toCsv } from "./csv.js";
import { compile, compilePredicate, truthy, ExprError } from "./expr.js";
import {
  Cell, FREE_MAX_BYTES, FREE_MAX_ROWS, FREE_WRITE_ROWS, LoadedSheet, Table, UserError,
  colLetter, expandPath, guessHeaderRow, headerNames, inferType, loadWorkbook, outputPath,
  parseRange, renderTable, toNumber, toTable,
} from "./sheet.js";

const gate = createLicenseGate({ product: "spreadsheet" });
const VERSION = "0.1.0";

function text(t: string) { return { content: [{ type: "text" as const, text: t }] }; }
function fail(t: string) { return { content: [{ type: "text" as const, text: `Error: ${t}` }], isError: true as const }; }

function guard<T extends any[]>(fn: (...a: T) => Promise<{ content: any[]; isError?: boolean }>) {
  return async (...a: T) => {
    try { return await fn(...a); }
    catch (e) {
      const msg = e instanceof UserError || e instanceof ExprError ? e.message : `${(e as Error).message}`;
      return fail(msg);
    }
  };
}

interface Opened { wb: ReturnType<typeof loadWorkbook>; ls: LoadedSheet; table: Table; notes: string[] }

function open(path: string, sheet?: string): Opened {
  const pro = gate.isPro();
  const wb = loadWorkbook(path, { maxRows: pro ? Infinity : FREE_MAX_ROWS });
  const ls = wb.get(sheet);
  const notes: string[] = [];
  if (!pro && wb.bytes > FREE_MAX_BYTES) {
    notes.push(`This file is ${(wb.bytes / 1048576).toFixed(1)} MB. Free tier reads files up to 5 MB and 5,000 rows, so the results below cover only the first ${ls.matrix.length} rows. ${gate.upgradeText("full-size files")}`);
  } else if (ls.truncated) {
    notes.push(`Only the first ${FREE_MAX_ROWS} rows were read (the sheet has ${ls.totalRowsSeen - 1} data rows). ${gate.upgradeText("files over 5,000 rows")}`);
  }
  return { wb, ls, table: toTable(ls), notes };
}

function withNotes(notes: string[], body: string) {
  return text(notes.length ? notes.join("\n") + "\n\n" + body : body);
}

/**
 * D-1: the free write cap must never produce a partial file that looks complete.
 * Over the cap we write nothing at all and return the reason plus a free workaround.
 */
function writeCapRefusal(rowCount: number, what: string, workaround: string): string | null {
  if (gate.isPro() || rowCount <= FREE_WRITE_ROWS) return null;
  return [
    `Nothing was written. ${what} would be ${rowCount} rows and the free tier writes at most ${FREE_WRITE_ROWS} rows per file.`,
    `No file was created, so you do not have a truncated file that looks complete. The source file is untouched.`,
    `Free workaround: ${workaround}`,
    gate.upgradeText(`writing more than ${FREE_WRITE_ROWS} rows`),
  ].join("\n\n");
}

function writeAtomic(file: string, data: Buffer | string) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, data as any);
  renameSync(tmp, file);
}

function writeMatrix(file: string, headers: string[], rows: Cell[][], sheetName = "Sheet1") {
  const ext = extname(file).toLowerCase();
  const aoa = [headers as unknown as Cell[], ...rows];
  if (ext === ".csv" || ext === ".txt") writeAtomic(file, toCsv(aoa, ","));
  else if (ext === ".tsv") writeAtomic(file, toCsv(aoa, "\t"));
  else if (ext === ".json") writeAtomic(file, JSON.stringify(rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null]))), null, 2));
  else {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || "Sheet1");
    writeAtomic(file, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);
  }
}

/** Normalise rows input (objects or arrays) to headers + matrix. */
function normaliseRows(rows: any[], existingHeaders?: string[]): { headers: string[]; matrix: Cell[][] } {
  if (!Array.isArray(rows) || rows.length === 0) throw new UserError("rows must be a non-empty array");
  const first = rows[0];
  if (Array.isArray(first)) {
    const matrix = rows.map((r: any[]) => r.map((c) => (c === undefined ? null : c))) as Cell[][];
    if (existingHeaders) return { headers: existingHeaders, matrix };
    const headers = matrix[0].map((c, i) => (typeof c === "string" && c.trim() !== "" ? String(c) : colLetter(i)));
    return { headers, matrix: matrix.slice(1) };
  }
  const headers = existingHeaders ? existingHeaders.slice() : [];
  for (const r of rows) for (const k of Object.keys(r ?? {})) if (!headers.includes(k)) headers.push(k);
  const matrix = rows.map((r) => headers.map((h) => {
    const v = (r ?? {})[h];
    return v === undefined ? null : (v as Cell);
  }));
  return { headers, matrix };
}

const server = new McpServer({ name: "mcp-spreadsheet", version: VERSION });
gate.registerTools(server as any);

// ---------------------------------------------------------------- sheet_info
async function infoText(path: string): Promise<string> {
  const pro = gate.isPro();
  const wb = loadWorkbook(path, { maxRows: pro ? Infinity : FREE_MAX_ROWS });
  const out: any = { file: wb.path, format: wb.kind, sizeBytes: wb.bytes, sheets: [] as any[] };
  if (wb.delimiter) out.delimiter = wb.delimiter === "\t" ? "tab" : wb.delimiter;
  for (const name of wb.sheetNames) {
    const ls = wb.get(name);
    const hr = guessHeaderRow(ls.matrix);
    const headers = headerNames(ls.matrix, hr);
    const body = ls.matrix.slice(hr + 1);
    const sample = body.slice(0, 200);
    out.sheets.push({
      name,
      dimensions: `${ls.matrix.length} rows x ${headers.length} cols`,
      rowCount: body.length,
      rowsTruncatedByFreeTier: ls.truncated || undefined,
      headerRow: hr < 0 ? null : hr + 1,
      columns: headers.map((h, i) => ({
        name: h,
        letter: colLetter(i),
        type: inferType(sample.map((r) => r[i] ?? null)),
        empty: body.filter((r) => r[i] === null || String(r[i] ?? "").trim() === "").length,
        sample: sample.map((r) => r[i]).filter((v) => v !== null && String(v).trim() !== "").slice(0, 3),
      })),
    });
  }
  return JSON.stringify(out, null, 2);
}

server.registerTool("sheet_info", {
  title: "Spreadsheet overview",
  description: "Open an excel (xlsx/xlsm/xlsb/ods) or csv/tsv file and describe it: sheet names, size, guessed header row, per-column type, sample values and empty counts. Start here before reading, querying or summing anything in a spreadsheet.",
  inputSchema: { path: z.string().describe("Path to the .xlsx/.xlsm/.xlsb/.ods/.csv/.tsv file (~ is expanded)") },
}, guard(async ({ path }: { path: string }) => text(await infoText(path))));

// ---------------------------------------------------------------- sheet_read
server.registerTool("sheet_read", {
  title: "Read rows",
  description: "Read rows from an excel or csv sheet as a text table, JSON records or CSV text. Use limit/offset to page through big files, or range for an A1 block like B2:F40. For totals or per-group sums use sheet_query with group_by instead.",
  inputSchema: {
    path: z.string(),
    sheet: z.string().optional().describe("Sheet name; defaults to the first sheet"),
    range: z.string().optional().describe("A1 range such as A1:D50; overrides limit/offset"),
    limit: z.number().int().min(1).max(100000).optional().describe("Rows to return, default 100"),
    offset: z.number().int().min(0).optional().describe("Rows to skip, default 0"),
    as: z.enum(["table", "json", "csv"]).optional().describe("Output format, default table"),
  },
}, guard(async ({ path, sheet, range, limit, offset, as }: any) => {
  const o = open(path, sheet);
  let headers = o.table.headers;
  let rows = o.table.rows;
  if (range) {
    const r = parseRange(range);
    const block = o.ls.matrix.slice(r.r0, r.r1 + 1).map((row) => row.slice(r.c0, r.c1 + 1));
    headers = Array.from({ length: r.c1 - r.c0 + 1 }, (_, i) => colLetter(r.c0 + i));
    rows = block;
  } else {
    const off = offset ?? 0;
    rows = rows.slice(off, off + (limit ?? 100));
  }
  const fmt = as ?? "table";
  const head = `${o.wb.path} [${o.ls.name}] ${o.table.rows.length} data rows, showing ${rows.length}`;
  if (fmt === "json") return withNotes(o.notes, JSON.stringify(rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null]))), null, 2));
  if (fmt === "csv") return withNotes(o.notes, toCsv([headers as unknown as Cell[], ...rows]));
  return withNotes(o.notes, `${head}\n\n${renderTable(headers, rows)}`);
}));

// --------------------------------------------------------------- sheet_query
const AGG_FNS = ["sum", "count", "avg", "min", "max"] as const;
type AggFn = typeof AGG_FNS[number];
interface AggSpec { col: string; fn: AggFn; as?: string }

function resolveCol(headers: string[], name: string): string {
  const k = headers.find((h) => h.toLowerCase().trim() === String(name).toLowerCase().trim());
  if (!k) throw new UserError(`column ${JSON.stringify(name)} not found. Columns: ${headers.join(", ")}`);
  return k;
}

function aggValue(fn: AggFn, vals: Cell[]): Cell {
  const nonEmpty = vals.filter((v) => v !== null && String(v).trim() !== "");
  if (fn === "count") return nonEmpty.length;
  const nums = nonEmpty.map((v) => toNumber(v)).filter((n): n is number => n !== null);
  if (nums.length === 0) {
    if (fn === "min" || fn === "max") {
      const strs = nonEmpty.map((v) => String(v)).sort();
      return strs.length ? (fn === "min" ? strs[0] : strs[strs.length - 1]) : null;
    }
    return fn === "sum" ? 0 : null;
  }
  const round = (n: number) => Number(n.toFixed(10));
  if (fn === "sum") return round(nums.reduce((a, b) => a + b, 0));
  if (fn === "avg") return round(nums.reduce((a, b) => a + b, 0) / nums.length);
  if (fn === "min") return round(Math.min(...nums));
  return round(Math.max(...nums));
}

/** Group records by the given columns and compute the aggregates; returns records keyed by group cols + aliases. */
function groupRecords(headers: string[], recs: Record<string, Cell>[], groupBy: string[], aggs: AggSpec[]) {
  const gcols = groupBy.map((g) => resolveCol(headers, g));
  const specs = (aggs.length ? aggs : [{ col: "*", fn: "count" as AggFn, as: "count" }]).map((a) => {
    const isStar = String(a.col).trim() === "*";
    const col = isStar ? "*" : resolveCol(headers, a.col);
    return { col, fn: a.fn, as: a.as && a.as.trim() ? a.as.trim() : (isStar ? "count" : `${a.fn}_${col}`) };
  });
  const groups = new Map<string, { key: Cell[]; rows: Record<string, Cell>[] }>();
  for (const r of recs) {
    const key = gcols.map((c) => r[c] ?? null);
    const k = key.map((v) => (v === null ? "\u0000" : String(v))).join("\u0001");
    const g = groups.get(k) ?? { key, rows: [] };
    g.rows.push(r);
    groups.set(k, g);
  }
  const out = [...groups.values()].map((g) => {
    const rec: Record<string, Cell> = {};
    gcols.forEach((c, i) => { rec[c] = g.key[i]; });
    for (const sp of specs) {
      rec[sp.as] = sp.col === "*" ? g.rows.length : aggValue(sp.fn, g.rows.map((r) => r[sp.col] ?? null));
    }
    return rec;
  });
  return { headers: [...gcols, ...specs.map((s) => s.as)], rows: out };
}

server.registerTool("sheet_query", {
  title: "Filter, group and sort rows",
  description:
    "Query an excel (xlsx) or csv file without writing any code: filter rows, group by a column, sum/count/average, sort and limit. " +
    "where uses a small safe expression language: comparisons = != > >= < <= plus contains / startswith / endswith, combined with AND, OR, NOT and parentheses. " +
    'Column names with spaces go in brackets: [Unit Price] > 10 AND [Region] contains "north". Strings use single or double quotes. ' +
    'Use group_by + aggregate for questions like "which rep sold the most units in the North region": ' +
    'where \'[Region] = "North"\', group_by ["Rep"], aggregate [{"col":"Units","fn":"sum","as":"total_units"}], sort {"col":"total_units","dir":"desc"}, limit 5. ' +
    'Aggregate functions: sum, count, avg, min, max. Numbers written as text ("1,250.00", "$1,250.00") are counted as numbers. sort may name an aggregate alias.',
  inputSchema: {
    path: z.string().describe("Path to the .xlsx or .csv file"),
    sheet: z.string().optional(),
    where: z.string().optional().describe('Filter, e.g. [Qty] >= 5 AND ([Status] = "open" OR [Status] = "new")'),
    select: z.array(z.string()).optional().describe("Column names to return; default all (with group_by, defaults to the group columns plus the aggregates)"),
    group_by: z.array(z.string()).optional().describe('Group rows by these columns before aggregating, e.g. ["Rep"] or ["Region","Rep"]'),
    aggregate: z.array(z.object({
      col: z.string().describe('Column to aggregate, or "*" to count rows'),
      fn: z.enum(AGG_FNS).describe("sum | count | avg | min | max"),
      as: z.string().optional().describe("Output name for this aggregate, e.g. total_units"),
    })).optional().describe('Aggregates per group, e.g. [{"col":"Units","fn":"sum","as":"total_units"}]. Defaults to a row count when group_by is given.'),
    sort: z.object({ col: z.string(), dir: z.enum(["asc", "desc"]).optional() }).optional().describe("Sort column; may be an aggregate alias such as total_units"),
    limit: z.number().int().min(1).max(100000).optional().describe("Default 100"),
    as: z.enum(["table", "json", "csv"]).optional(),
  },
}, guard(async ({ path, sheet, where, select, group_by, aggregate, sort, limit, as }: any) => {
  const o = open(path, sheet);
  let recs = o.table.records();
  const total = recs.length;
  if (where) {
    const pred = compilePredicate(where);
    recs = recs.filter((r) => pred(r));
  }
  const filtered = recs.length;
  let cols = o.table.headers;
  let grouped = false;
  if ((group_by && group_by.length) || (aggregate && aggregate.length)) {
    const g = groupRecords(o.table.headers, recs, group_by ?? [], (aggregate ?? []) as AggSpec[]);
    cols = g.headers;
    recs = g.rows;
    grouped = true;
  }
  if (sort) {
    const key = cols.find((h) => h.toLowerCase().trim() === String(sort.col).toLowerCase().trim());
    if (!key) throw new UserError(`sort column ${JSON.stringify(sort.col)} not found. Columns: ${cols.join(", ")}`);
    const dir = sort.dir === "desc" ? -1 : 1;
    recs = recs.slice().sort((a, b) => {
      const x = a[key], y = b[key];
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      const sx = String(x).toLowerCase(), sy = String(y).toLowerCase();
      const nx = Number(sx), ny = Number(sy);
      if (Number.isFinite(nx) && Number.isFinite(ny)) return (nx - ny) * dir;
      return (sx < sy ? -1 : sx > sy ? 1 : 0) * dir;
    });
  }
  const matched = recs.length;
  let headers = cols;
  if (select && select.length) headers = select.map((sname: string) => resolveCol(cols, sname));
  const shown = recs.slice(0, limit ?? 100);
  const rows = shown.map((r) => headers.map((h) => r[h] ?? null));
  const head = grouped
    ? `${matched} groups from ${filtered} of ${total} rows, showing ${rows.length}`
    : `${matched} of ${total} rows match, showing ${rows.length}`;
  const fmt = as ?? "table";
  if (fmt === "json") return withNotes(o.notes, JSON.stringify(shown.map((r) => Object.fromEntries(headers.map((h) => [h, r[h] ?? null]))), null, 2));
  if (fmt === "csv") return withNotes(o.notes, toCsv([headers as unknown as Cell[], ...rows]));
  return withNotes(o.notes, `${head}\n\n${rows.length ? renderTable(headers, rows) : "(no rows matched)"}`);
}));

// --------------------------------------------------------------- sheet_stats
server.registerTool("sheet_stats", {
  title: "Column statistics",
  description: "Whole-column statistics for an excel or csv sheet: count, empty count, distinct values, min, max, sum, mean and median. Numbers are parsed from currency and percent text too. For a sum per group (per rep, per region, per month) use sheet_query with group_by and aggregate.",
  inputSchema: { path: z.string(), sheet: z.string().optional(), columns: z.array(z.string()).optional().describe("Limit to these columns; default all") },
}, guard(async ({ path, sheet, columns }: any) => {
  const o = open(path, sheet);
  const wanted = columns && columns.length
    ? columns.map((s: string) => {
        const k = o.table.headers.find((h) => h.toLowerCase().trim() === s.toLowerCase().trim());
        if (!k) throw new UserError(`column ${JSON.stringify(s)} not found. Columns: ${o.table.headers.join(", ")}`);
        return k;
      })
    : o.table.headers;
  const out = wanted.map((h: string) => {
    const i = o.table.headers.indexOf(h);
    const vals = o.table.rows.map((r) => r[i] ?? null);
    const nonEmpty = vals.filter((v) => v !== null && String(v).trim() !== "");
    const nums = nonEmpty.map((v) => {
      if (typeof v === "number") return v;
      const s = String(v).trim().replace(/[$€£,\s]/g, "");
      const n = Number(s.endsWith("%") ? s.slice(0, -1) : s);
      return Number.isFinite(n) ? (s.endsWith("%") ? n / 100 : n) : NaN;
    }).filter((n) => Number.isFinite(n)) as number[];
    const res: any = {
      column: h, type: inferType(vals), count: nonEmpty.length, empty: vals.length - nonEmpty.length,
      distinct: new Set(nonEmpty.map((v) => String(v))).size,
    };
    if (nums.length && nums.length >= nonEmpty.length * 0.6) {
      const sorted = nums.slice().sort((a, b) => a - b);
      const sum = nums.reduce((a, b) => a + b, 0);
      const mid = Math.floor(sorted.length / 2);
      res.min = sorted[0];
      res.max = sorted[sorted.length - 1];
      res.sum = Number(sum.toFixed(10));
      res.mean = Number((sum / nums.length).toFixed(10));
      res.median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      res.numericValues = nums.length;
    } else {
      const freq = new Map<string, number>();
      for (const v of nonEmpty) freq.set(String(v), (freq.get(String(v)) ?? 0) + 1);
      res.top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([value, n]) => ({ value, n }));
      const lens = nonEmpty.map((v) => String(v).length);
      if (lens.length) { res.min = String(nonEmpty[lens.indexOf(Math.min(...lens))]); res.max = String(nonEmpty[lens.indexOf(Math.max(...lens))]); }
    }
    return res;
  });
  return withNotes(o.notes, JSON.stringify({ file: o.wb.path, sheet: o.ls.name, rows: o.table.rows.length, columns: out }, null, 2));
}));

// ---------------------------------------------------------------- sheet_find
server.registerTool("sheet_find", {
  title: "Find text",
  description: "Search every cell for text (case insensitive) and return cell addresses with a preview of the row it is on.",
  inputSchema: { path: z.string(), text: z.string().describe("Text to look for"), sheet: z.string().optional().describe("Sheet name; default searches every sheet") },
}, guard(async ({ path, text: needle, sheet }: any) => {
  const pro = gate.isPro();
  const wb = loadWorkbook(path, { maxRows: pro ? Infinity : FREE_MAX_ROWS });
  const q = String(needle).toLowerCase();
  const names = sheet ? [sheet] : wb.sheetNames;
  const hits: any[] = [];
  const notes: string[] = [];
  for (const n of names) {
    const ls = wb.get(n);
    if (ls.truncated) notes.push(`Sheet ${JSON.stringify(n)}: only the first ${FREE_MAX_ROWS} rows were searched. ${gate.upgradeText("searching files over 5,000 rows")}`);
    for (let r = 0; r < ls.matrix.length; r++) {
      for (let c = 0; c < ls.matrix[r].length; c++) {
        const v = ls.matrix[r][c];
        if (v === null) continue;
        if (String(v).toLowerCase().includes(q)) {
          hits.push({ sheet: n, cell: `${colLetter(c)}${r + 1}`, value: v, row: ls.matrix[r].slice(0, 12).map((x) => (x === null ? "" : x)) });
          if (hits.length >= 200) break;
        }
      }
      if (hits.length >= 200) break;
    }
    if (hits.length >= 200) break;
  }
  return withNotes(notes, JSON.stringify({ file: wb.path, query: needle, matches: hits.length, hits }, null, 2));
}));

// --------------------------------------------------------------- sheet_write
server.registerTool("sheet_write", {
  title: "Write rows",
  description:
    "Write rows to an excel (xlsx) or csv/tsv/json file. rows may be objects (keys become headers) or arrays (first array is the header row). " +
    "mode new_file writes a brand new file and refuses to clobber an existing one; append adds the rows under the existing data; overwrite replaces the file contents. " +
    "Format follows the extension of out_path (.xlsx, .csv, .tsv, .json).",
  inputSchema: {
    path: z.string().describe("Source file for append/overwrite, or the intended file for new_file"),
    sheet: z.string().optional(),
    rows: z.array(z.union([z.record(z.any()), z.array(z.any())])).describe("Array of objects, or array of arrays with a header row first"),
    mode: z.enum(["new_file", "append", "overwrite"]),
    out_path: z.string().optional().describe("Where to write; default is a new file next to the source for new_file, or the source itself for append/overwrite"),
  },
}, guard(async ({ path, sheet, rows, mode, out_path }: any) => {
  const notes: string[] = [];
  let headers: string[];
  let matrix: Cell[][];
  let target: string;
  let sheetName = sheet ?? "Sheet1";

  if (mode === "new_file") {
    const n = normaliseRows(rows);
    headers = n.headers; matrix = n.matrix;
    target = out_path ? expandPath(out_path) : expandPath(path);
    if (existsSync(target)) throw new UserError(`${target} already exists. Pass out_path for a new name, or mode "overwrite" to replace it.`);
  } else {
    const o = open(path, sheet);
    sheetName = sheet ?? o.ls.name;
    headers = o.table.headers;
    const n = normaliseRows(rows, headers);
    matrix = mode === "append" ? [...o.table.rows, ...n.matrix] : n.matrix;
    target = out_path ? expandPath(out_path) : o.wb.path;
    notes.push(...o.notes);
  }
  if (extname(target) === "") throw new UserError(`out_path ${target} has no file extension; use .xlsx, .csv, .tsv or .json`);
  const refusal = writeCapRefusal(matrix.length, "This write", `write the rows in batches of ${FREE_WRITE_ROWS} or fewer to separate files, or filter the data down first (sheet_query with a where filter) and write only the rows you need.`);
  if (refusal) return withNotes(notes, refusal);
  writeMatrix(target, headers, matrix, sheetName);
  const size = statSync(target).size;
  return withNotes(notes, `Wrote ${matrix.length} rows x ${headers.length} columns to ${target} (${size} bytes, mode ${mode}).\nColumns: ${headers.join(", ")}`);
}));

// ---------------------------------------------------------- sheet_add_column
server.registerTool("sheet_add_column", {
  title: "Add a column",
  description:
    'Add a computed column and save the result to a NEW file (the source is never modified unless out_path points at it). ' +
    'formula uses the same expression language as sheet_query over the columns of each row, e.g. "[Qty] * [Unit Price]" or \'[Country] = "PL"\'. ' +
    "Alternatively pass values, one per data row.",
  inputSchema: {
    path: z.string(),
    sheet: z.string().optional(),
    name: z.string().describe("Name of the new column"),
    formula: z.string().optional().describe('Expression over row columns, e.g. "[Qty] * [Unit Price]"'),
    values: z.array(z.any()).optional().describe("Explicit values, one per data row"),
    out_path: z.string().optional().describe("Output file; default <source>-plus-<column>.<same ext>"),
  },
}, guard(async ({ path, sheet, name, formula, values, out_path }: any) => {
  if (!formula && !values) throw new UserError("give either formula or values");
  const o = open(path, sheet);
  const notes = [...o.notes];
  const headers = [...o.table.headers];
  if (headers.some((h) => h.toLowerCase().trim() === String(name).toLowerCase().trim())) throw new UserError(`column ${JSON.stringify(name)} already exists`);
  const recs = o.table.records();
  let computed: Cell[];
  if (formula) {
    const f = compile(formula);
    computed = recs.map((r) => {
      const v = f(r);
      if (v === null || v === undefined) return null;
      if (typeof v === "boolean") return v;
      if (typeof v === "number") return Number.isFinite(v) ? Number(v.toFixed(10)) : null;
      return String(v);
    });
  } else {
    if (values.length !== recs.length) notes.push(`values has ${values.length} entries for ${recs.length} data rows; missing entries are blank.`);
    computed = recs.map((_, i) => (values[i] === undefined ? null : values[i]));
  }
  headers.push(String(name));
  const matrix = o.table.rows.map((r, i) => [...r, computed[i] ?? null]);
  const target = out_path ? expandPath(out_path) : outputPath(o.wb.path, undefined, `-plus-${String(name).replace(/[^A-Za-z0-9_-]+/g, "_")}`);
  if (!out_path && existsSync(target)) throw new UserError(`${target} already exists; pass out_path to choose another name`);
  const refusal = writeCapRefusal(matrix.length, `The file with the new column`, `narrow the sheet first with sheet_query (for example a where filter on the rows you care about, as: "csv", saved with sheet_write), then add the column to that smaller file; or use sheet_stats / sheet_query aggregates if you only need the totals rather than the whole file.`);
  if (refusal) return withNotes(notes, refusal);
  writeMatrix(target, headers, matrix, o.ls.name);
  const preview = renderTable(headers, matrix.slice(0, 5));
  return withNotes(notes, `Added column ${JSON.stringify(name)} and wrote ${matrix.length} rows to ${target}. The original file was not changed.\n\n${preview}`);
}));

// ------------------------------------------------------------- sheet_convert
server.registerTool("sheet_convert", {
  title: "Convert file",
  description: "Convert a sheet between excel (xlsx), csv and json. Writes a new file next to the source unless out_path is given; the source is never modified.",
  inputSchema: {
    path: z.string(), to: z.enum(["csv", "xlsx", "json"]),
    sheet: z.string().optional(),
    out_path: z.string().optional(),
  },
}, guard(async ({ path, to, sheet, out_path }: any) => {
  const o = open(path, sheet);
  const notes = [...o.notes];
  const target = out_path ? expandPath(out_path) : outputPath(o.wb.path, undefined, "", `.${to}`);
  if (target === o.wb.path) throw new UserError("the converted file would overwrite the source; pass out_path");
  if (!out_path && existsSync(target)) throw new UserError(`${target} already exists; pass out_path to choose another name`);
  const refusal = writeCapRefusal(o.table.rows.length, "The converted file", `filter first with sheet_query (where + limit, as: "csv") and save that subset, or convert the sheet in ${FREE_WRITE_ROWS}-row slices.`);
  if (refusal) return withNotes(notes, refusal);
  writeMatrix(target, o.table.headers, o.table.rows, o.ls.name);
  return withNotes(notes, `Converted ${o.wb.path} [${o.ls.name}] to ${target} (${o.table.rows.length} rows, ${o.table.headers.length} columns).`);
}));

// ------------------------------------------------------------------ resource
server.registerResource(
  "sheet",
  new ResourceTemplate("sheet://{path}", { list: undefined }),
  { title: "Spreadsheet overview", description: "sheet://<path> returns the sheet_info summary for a spreadsheet file", mimeType: "application/json" },
  async (uri: URL, vars: any) => {
    const raw = Array.isArray(vars.path) ? vars.path[0] : vars.path;
    try {
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: await infoText(decodeURIComponent(String(raw))) }] };
    } catch (e) {
      return { contents: [{ uri: uri.href, mimeType: "text/plain", text: `Error: ${(e as Error).message}` }] };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`mcp-spreadsheet ${VERSION} ready (${gate.isPro() ? "pro" : "free"})\n`);
}
main().catch((e) => { process.stderr.write(`fatal: ${(e as Error).stack}\n`); process.exit(1); });
