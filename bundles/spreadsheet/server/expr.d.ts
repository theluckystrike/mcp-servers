/**
 * Tiny safe expression language for sheet_query (where) and sheet_add_column (formula).
 * No eval, no Function. Grammar:
 *   or        := and ( ("OR"|"||") and )*
 *   and       := not ( ("AND"|"&&") not )*
 *   not       := ("NOT"|"!") not | cmp
 *   cmp       := add ( ("="|"=="|"!="|"<>"|">"|">="|"<"|"<="|"contains"|"startswith"|"endswith") add )?
 *   add       := mul ( ("+"|"-") mul )*
 *   mul       := unary ( ("*"|"/"|"%") unary )*
 *   unary     := "-" unary | primary
 *   primary   := number | string | "[" name "]" | bareword | "(" or ")"
 * Column names: [With Spaces] or bareword. Strings: 'single' or "double", doubled quote escapes.
 */
export type Row = Record<string, unknown>;
type Tok = {
    t: "num";
    v: number;
} | {
    t: "str";
    v: string;
} | {
    t: "col";
    v: string;
} | {
    t: "op";
    v: string;
} | {
    t: "word";
    v: string;
} | {
    t: "end";
};
export declare class ExprError extends Error {
}
export declare function tokenize(src: string): Tok[];
export type Node = {
    k: "lit";
    v: unknown;
} | {
    k: "col";
    name: string;
} | {
    k: "bin";
    op: string;
    l: Node;
    r: Node;
} | {
    k: "un";
    op: string;
    e: Node;
};
export declare function parse(src: string): Node;
export declare function truthy(v: unknown): boolean;
export declare function evaluate(node: Node, row: Row): unknown;
/** Compile once, run per row. Returns a predicate/value function. */
export declare function compile(src: string): (row: Row) => unknown;
export declare function compilePredicate(src: string): (row: Row) => boolean;
/** Column names referenced by an expression (for error messages). */
export declare function columnsUsed(node: Node, acc?: Set<string>): Set<string>;
export {};
