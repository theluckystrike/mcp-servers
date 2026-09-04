/** RFC 4180 CSV parser with delimiter sniffing. No dependencies. */
export declare class CsvError extends Error {
}
export declare const DELIMITERS: readonly [",", ";", "\t", "|"];
/** Sniff the delimiter by counting occurrences outside quotes across the first lines. */
export declare function sniffDelimiter(text: string, sample?: number): string;
export interface ParseCsvOpts {
    /** stop after this many rows have been completed (v3 #6: limit/offset must not parse the whole file) */
    maxRows?: number;
    /** the text is a prefix of a larger file, so an open quote at the end is not an error */
    partial?: boolean;
}
export interface ParsedCsv {
    rows: string[][];
    delimiter: string;
    /** characters of `text` actually consumed (index just past the last completed row) */
    consumed: number;
    /** false when parsing stopped early because maxRows was reached */
    complete: boolean;
}
/** Parse CSV text into a matrix of strings. Handles CRLF, quoted delimiters and embedded newlines. */
export declare function parseCsv(text: string, delimiter?: string, opts?: ParseCsvOpts): ParsedCsv;
/**
 * Coerce a CSV string cell to number/boolean when unambiguous.
 *
 * D-R12: the decision is by PATTERN, never by string length, so "403.00" stays a number
 * and Excel's own SUM does not skip it. v3 #4/#5: the pattern rules now live in
 * src/num.ts and are shared with aggregation and expression comparison, so locale
 * numbers and unsafe integers are judged the same way everywhere.
 */
export declare function coerce(v: string): string | number | boolean;
export declare function csvEscape(v: unknown, delimiter?: string): string;
export declare function toCsv(rows: unknown[][], delimiter?: string): string;
