import { roundHalfUp } from "./money.js";

/**
 * The credit note domain model.
 *
 * A credit note starts as a DRAFT: editable, deletable, and with a draft id that no
 * client ever sees. credit_note_finalize burns the final CN-YYYY-NNNN number and makes
 * the note immutable: a finalized credit note is a document the client may have seen,
 * so it can neither be edited nor deleted. Because the number is only assigned at
 * finalize, the final series never has a gap from a discarded draft.
 *
 * Totals are stored on the record (subtotal_minor, tax_minor, total_minor) but are
 * always recomputed from the lines at write time; a stored note whose lines and totals
 * disagree is reported, not silently believed.
 */

export const MAX_MINOR = 1e14;
export const MAX_LINES = 100;
export const MAX_ROWS = 2000;
export const MAX_NAME = 200;
export const MAX_TEXT = 2000;

export const REASONS = ["returned_goods", "overcharge", "discount_correction", "service_issue", "other"] as const;
export type Reason = (typeof REASONS)[number];

/** The reason as it is printed on the document, not the wire token. */
export function reasonLabel(reason: Reason): string {
  switch (reason) {
    case "returned_goods": return "Returned goods";
    case "overcharge": return "Overcharge";
    case "discount_correction": return "Discount correction";
    case "service_issue": return "Service issue";
    case "other": return "Other";
  }
}

export interface LineInput {
  description: string;
  quantity: number;
  unit_price_minor: number;
  tax_rate?: number;
}

export interface CreditLine {
  description: string;
  quantity: number;
  unit_price_minor: number;
  tax_rate: number;
  gross_minor: number;
  tax_minor: number;
  total_minor: number;
}

export interface CreditNote {
  /** Draft id (CN-DRAFT-YYYY-NNNN) or, once finalized, the final number. */
  id: string;
  /** The final number CN-YYYY-NNNN, null while the note is a draft. */
  number: string | null;
  status: "draft" | "final";
  recipient: string;
  invoice_ref: string | null;
  reason: Reason;
  reason_detail: string | null;
  currency: string;
  issue_date: string; // YYYY-MM-DD
  lines: CreditLine[];
  notes: string | null;
  subtotal_minor: number;
  tax_minor: number;
  total_minor: number;
  created: string;
  updated: string;
  finalized_at: string | null;
}

/**
 * Compute the stored lines from the raw input, on the documented rounding contract:
 * gross is quantity x unit price rounded half-up once, tax is per line rounded half-up,
 * the line total is gross + tax.
 */
export function computeLines(items: LineInput[]): CreditLine[] {
  return items.map((it) => {
    const rate = it.tax_rate ?? 0;
    const gross = roundHalfUp(it.quantity * it.unit_price_minor);
    const tax = rate ? roundHalfUp(gross * rate / 100) : 0;
    return {
      description: it.description.trim(),
      quantity: it.quantity,
      unit_price_minor: it.unit_price_minor,
      tax_rate: rate,
      gross_minor: gross,
      tax_minor: tax,
      total_minor: gross + tax,
    };
  });
}

export function totalsOf(lines: CreditLine[]): { subtotal_minor: number; tax_minor: number; total_minor: number } {
  return {
    subtotal_minor: lines.reduce((a, l) => a + l.gross_minor, 0),
    tax_minor: lines.reduce((a, l) => a + l.tax_minor, 0),
    total_minor: lines.reduce((a, l) => a + l.total_minor, 0),
  };
}

export interface TaxLine { rate: number; base_minor: number; tax_minor: number }

/** One tax line per distinct rate, ascending, for the totals block on the document. */
export function taxLinesOf(lines: CreditLine[]): TaxLine[] {
  const byRate = new Map<number, TaxLine>();
  for (const l of lines) {
    const cur = byRate.get(l.tax_rate) ?? { rate: l.tax_rate, base_minor: 0, tax_minor: 0 };
    cur.base_minor += l.gross_minor;
    cur.tax_minor += l.tax_minor;
    byRate.set(l.tax_rate, cur);
  }
  return [...byRate.values()].sort((a, b) => a.rate - b.rate);
}

/**
 * Resolve a note by final number (case-insensitive), then by draft id, then -- only if
 * exactly one note's recipient matches exactly -- by recipient name. More than one
 * candidate is refused with the list rather than silently picking the first.
 */
export function findNote(list: CreditNote[], ref: string): CreditNote | undefined {
  const needle = String(ref).trim().toLowerCase();
  const byNumber = list.find((n) => n.number !== null && n.number.toLowerCase() === needle);
  if (byNumber) return byNumber;
  const byId = list.find((n) => n.id.toLowerCase() === needle);
  if (byId) return byId;
  const named = list.filter((n) => n.recipient.toLowerCase() === needle);
  if (named.length === 1) return named[0];
  if (named.length > 1) {
    throw new Error(`"${ref}" is the recipient of more than one credit note: ${named.map((n) => n.id).join(", ")}. Pass the number or id.`);
  }
  return undefined;
}

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** The LOCAL calendar date, matching the rest of this estate: an invoice issued at 06:36 local is stamped with the local day, not the UTC one. */
export function today(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
