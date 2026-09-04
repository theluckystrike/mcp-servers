import * as XLSX from "xlsx";
export declare const MAX_FILE_BYTES: number;
export declare const FREE_MAX_ROWS = 5000;
export declare const FREE_MAX_BYTES: number;
export declare const FREE_WRITE_ROWS = 500;
export declare class UserError extends Error {
}
export declare function expandPath(p: string): string;
export declare function requireExisting(p: string): string;
export type Cell = string | number | boolean | Date | null;
/**
 * v3 #17: an xlsx date cell stays a Date through the internal model so a conversion back
 * to xlsx writes a date cell, not text. Rendered as ISO, with the time only when the cell
 * actually carries one.
 */
export declare function formatCellDate(d: Date): string;
/** Text form of a cell for tables, CSV output and JSON output. */
export declare function cellText(c: Cell): string;
/** JSON-safe form of a cell: Dates become ISO strings, everything else is unchanged. */
export declare function jsonCell(c: Cell): string | number | boolean | null;
export interface LoadedSheet {
    name: string;
    matrix: Cell[][];
    truncated: boolean;
    totalRowsSeen: number;
    /** true when parsing stopped at rowBudget, so totalRowsSeen is not the file's row count */
    partial?: boolean;
}
export interface Workbook {
    path: string;
    kind: "csv" | "xlsx";
    bytes: number;
    sheetNames: string[];
    delimiter?: string;
    /** the parsed xlsx workbook, so a write can replace one sheet and keep the rest (v3 #16) */
    raw?: XLSX.WorkBook;
    get(sheet?: string): LoadedSheet;
}
export interface LoadOpts {
    maxRows?: number;
    /**
     * v3 #6: the most data rows any caller can possibly need. When set, a CSV is read and
     * parsed only up to that many rows instead of reading, parsing and coercing the whole
     * file to then slice 100 rows off the front.
     */
    rowBudget?: number;
}
export interface RecentOpen {
    path: string;
    opened: string;
}
export declare function recentOpened(): RecentOpen[];
export declare function loadWorkbook(pathIn: string, opts?: LoadOpts): Workbook;
/** Guess which row holds the headers. Returns index into matrix, or -1 if none. */
export declare function guessHeaderRow(m: Cell[][]): number;
export declare function headerNames(m: Cell[][], headerRow: number): string[];
/**
 * Coerce a cell to a number for aggregation: accepts real numbers and text such as
 * "1,250.00", "$1,250.00", "EUR 1 250,00", "(300)" and "12.5%". Returns null when there is no number.
 * v3 #4: the separator rules live in src/num.ts and are shared with CSV coercion and the
 * expression language, so "12,99" is 12.99 in every code path rather than 1299 in one.
 */
export declare function toNumber(v: unknown): number | null;
/**
 * v3 #14: Math.min(...nums) / Math.max(...nums) throw "too many arguments" on a column of
 * roughly 150,000 numbers. One pass, no spread.
 */
export declare function minMax(nums: number[]): {
    min: number;
    max: number;
} | null;
export declare function colLetter(i: number): string;
export interface Table {
    headers: string[];
    rows: Cell[][];
    headerRow: number;
    records(): Record<string, Cell>[];
}
export declare function toTable(ls: LoadedSheet): Table;
export declare function inferType(values: Cell[]): string;
/** Parse an A1-style range like "A1:C10" or "B2". Returns 0-based inclusive bounds. */
export declare function parseRange(range: string): {
    r0: number;
    c0: number;
    r1: number;
    c1: number;
};
export declare function outputPath(input: string, outPath: string | undefined, suffix: string, ext?: string): string;
export declare function renderTable(headers: string[], rows: Cell[][], maxWidth?: number): string;
