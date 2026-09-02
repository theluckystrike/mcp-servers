/** RFC 4180 CSV parser with delimiter sniffing. No dependencies. */
export declare const DELIMITERS: readonly [",", ";", "\t", "|"];
/** Sniff the delimiter by counting occurrences outside quotes across the first lines. */
export declare function sniffDelimiter(text: string, sample?: number): string;
/** Parse CSV text into a matrix of strings. Handles CRLF, quoted delimiters and embedded newlines. */
export declare function parseCsv(text: string, delimiter?: string): {
    rows: string[][];
    delimiter: string;
};
/** Coerce a CSV string cell to number/boolean when unambiguous. */
export declare function coerce(v: string): string | number | boolean;
export declare function csvEscape(v: unknown, delimiter?: string): string;
export declare function toCsv(rows: unknown[][], delimiter?: string): string;
