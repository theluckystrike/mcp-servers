/**
 * The goods-receipt engine, as a stable public API for other servers in this repo.
 *
 * `src/index.ts` is the MCP server (tools, licensing, tool copy). What is re-exported here
 * is the domain types, the integer quantity arithmetic and the over/under tolerance test,
 * so a sibling server can read the same `PO-0001` and `GRN-0001` series in the same data
 * directory under the same lock without a second copy of the code, and without a second
 * opinion about whether a PO is fully received.
 *
 * Money is never involved: a GRN counts whole units, not their price. Quantities are
 * integers end to end (`ordered`, `received`, `damaged`), and every comparison is done in
 * integers; a shortage is `ordered - received` capped at zero.
 *
 * Tolerance is a percentage applied to the whole POSITIVE ordered quantity in integer terms:
 * a line that orders 100 units with a 10% over tolerance may receive up to 110 and may be
 * short by up to 10 before the store calls it a discrepancy. The checks live here so both
 * the tool handler (which refuses) and a report (which flags) agree on the numbers.
 *
 * Nothing here touches the network or the licence store at import time.
 *
 * Stability: the names below are the contract. `@theluckystrike/mcp-goods-receipt/dist/*.js`
 * deep imports are not.
 */

export type PurchaseOrderStatus = "open" | "closed";

export interface PoLine {
  id: string;            // PO-0001-L1
  sku: string;
  description: string;
  ordered: number;       // whole units, > 0
}

export interface PurchaseOrder {
  id: string;            // PO-0001
  reference: string;     // buyer's own purchase-order number
  supplier: string;
  overTolerancePct: number;  // whole % allowed above ordered
  underTolerancePct: number; // whole % allowed below ordered
  lines: PoLine[];
  status: PurchaseOrderStatus;
  createdAt: string;     // ISO date
}

export type GrnLineStatus = "open" | "closed";

export interface GrnLine {
  id: string;            // GRN-0001-L1
  line: string;          // points at the PO line id
  received: number;      // whole units good stock taken
  damaged: number;       // whole units received but damaged
  shortage: number;      // whole units short (ordered - received, capped >= 0)
  damageNote?: string;
  shortageNote?: string;
  status: GrnLineStatus;
}

export interface GoodsReceiptNote {
  id: string;            // GRN-0001
  po: string;            // PO id this GRN is receiving against
  receivedAt: string;    // ISO date of the physical receipt
  carrier?: string;      // delivered by
  note?: string;         // memo on the whole GRN
  lines: GrnLine[];
  status: GrnLineStatus;
  createdAt: string;
}

export interface GrnCell {
  line: string;
  received?: number;
  damaged?: number;
  shortage?: number;
  damageNote?: string;
  shortageNote?: string;
}

/* Domain limits (hard rules estate-wide: MAX_* refuse, never silently clamp). */
export const MAX_POS = 2000;          // distinct purchase orders ever created
export const MAX_GRNS = 5000;         // goods-receipt notes ever created
export const MAX_LINES = 200;         // lines on one PO
export const MAX_GRN_LINES = 200;     // lines on one GRN
export const MAX_REF = 60;            // PO reference / supplier name
export const MAX_SKU = 40;            // a line's sku/model
export const MAX_DESC = 160;          // a line's description
export const MAX_NOTE = 400;          // a damage / shortage / GRN note
export const MAX_QTY = 1_000_000;     // ordered / received / damaged per line
export const MAX_TOLERANCE = 100;     // % over/under tolerance (whole percent)
export const DEFAULT_OVER_TOLERANCE = 10;
export const DEFAULT_UNDER_TOLERANCE = 10;

export function isIsoDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime());
}

/**
 * Over-tolerance: how many whole units may be received beyond ordered? Integer ceil so a
 * line of 5 units at 10% may take 1 extra (0.5 rounds up), never a fractional unit.
 */
export function overAllowance(ordered: number, overTolerancePct: number): number {
  if (ordered <= 0) return 0;
  return Math.floor((ordered * overTolerancePct) / 100);
}

/**
 * Under-tolerance: how many whole units may go short before a line is flagged? Integer
 * floor, so an order of 9 units at 10% allows a shortage of 0 units and a full short line
 * is a discrepancy.
 */
export function underAllowance(ordered: number, underTolerancePct: number): number {
  if (ordered <= 0) return 0;
  return Math.floor((ordered * underTolerancePct) / 100);
}

export type Tol = "ok" | "over" | "short";

/**
 * Classify a received quantity for one line against ordered and its tolerances. Pure,
 * integer-only. overAllowance/underAllowance are the candidate bands; anything beyond is
 * over or short.
 */
export function tolerance(received: number, ordered: number, overTolerancePct: number, underTolerancePct: number): Tol {
  if (ordered <= 0) return received === 0 ? "ok" : "over";
  const hi = ordered + overAllowance(ordered, overTolerancePct);
  const lo = ordered - underAllowance(ordered, underTolerancePct);
  if (received > hi) return "over";
  if (received < lo) return "short";
  return "ok";
}

export function normaliseText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function skuNo(sku: string): string {
  return normaliseText(sku).toUpperCase();
}

export function lineId(owner: string, n: number): string {
  return `${owner}-L${String(n).padStart(2, "0")}`;
}