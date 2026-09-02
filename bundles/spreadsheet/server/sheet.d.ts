export declare const MAX_FILE_BYTES: number;
export declare const FREE_MAX_ROWS = 5000;
export declare const FREE_MAX_BYTES: number;
export declare const FREE_WRITE_ROWS = 200;
export declare class UserError extends Error {
}
export declare function expandPath(p: string): string;
export declare function requireExisting(p: string): string;
export type Cell = string | number | boolean | null;
export interface LoadedSheet {
    name: string;
    matrix: Cell[][];
    truncated: boolean;
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
export interface LoadOpts {
    maxRows?: number;
}
export declare function loadWorkbook(pathIn: string, opts?: LoadOpts): Workbook;
/** Guess which row holds the headers. Returns index into matrix, or -1 if none. */
export declare function guessHeaderRow(m: Cell[][]): number;
export declare function headerNames(m: Cell[][], headerRow: number): string[];
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
