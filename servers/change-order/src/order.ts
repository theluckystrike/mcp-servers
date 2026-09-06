import {
  computeTotals, currencyDecimals, roundHalfUp, type InputItem, type Totals,
} from "@theluckystrike/mcp-invoice/lib";

/**
 * The change order engine: the record shapes, the status machine, the delta arithmetic
 * and the two payload shapes the sibling servers take.
 *
 * Nothing here reads a file, a licence or the network, so every figure below is
 * reproducible from its arguments alone and the unit suite recomputes each one by hand.
 *
 * THE TWO SIBLING SERVERS TAKE THE SAME LINE IN DIFFERENT UNITS. `invoice_create`'s item
 * carries `unit_price` in MAJOR units (servers/invoice/src/index.ts: "Price per unit in
 * major units, e.g. 90 for 90 EUR"); `quote_create`'s item carries `unit_price_minor` in
 * MINOR units ("9000 = 90.00 EUR, 90 = JPY 90. Never a decimal"). Neither tool can tell
 * that the number it was handed was scaled for the other one, and a 2-decimal currency is
 * mispriced by exactly 100x when they are swapped. So the store holds MINOR units, the
 * only lossless form, and the two payload builders below are the only place the scale is
 * applied, each with its scale printed against it.
 *
 * NO DELTA IS STORED. A line holds its kind, its quantity and its unit price, and for a
 * changed line the quantity and price it replaces; the delta is worked out on the call.
 * A stored delta is a second copy of what the line already decides, and the copy is the
 * one that gets believed after somebody edits the line.
 */

export const MAX_MINOR = 1e12;
export const MAX_QUANTITY = 1_000_000;
export const MAX_LINES = 200;
export const MAX_ROWS = 500;
export const MAX_VAT = 1000;

export type Status = "draft" | "sent" | "approved" | "rejected" | "void";

/** The five statuses, in the order the document reports them. */
export const STATUSES: Status[] = ["draft", "sent", "approved", "rejected", "void"];

/** Open means the client has not answered yet: draft and sent. The free cap counts these. */
export const OPEN_STATUSES: Status[] = ["draft", "sent"];

/** Terminal statuses. Nothing moves out of them; a change of mind is a new change order. */
export const CLOSED_STATUSES: Status[] = ["approved", "rejected", "void"];

/**
 * The legal moves. A draft is sent or voided; a sent one is approved, rejected or voided.
 * A draft is NOT approved directly: approval is the client's answer to something they were
 * sent, and a change order approved on a day it was never sent has no date for the sending.
 */
export const TRANSITIONS: Record<Status, Status[]> = {
  draft: ["sent", "void"],
  sent: ["approved", "rejected", "void"],
  approved: [],
  rejected: [],
  void: [],
};

export type ReferenceKind = "quote" | "work_order";
export const REFERENCE_KINDS: ReferenceKind[] = ["quote", "work_order"];

export type LineKind = "added" | "removed" | "changed";
export const LINE_KINDS: LineKind[] = ["added", "removed", "changed"];

export interface Line {
  id: string;
  kind: LineKind;
  description: string;
  /** For added and removed: the quantity. For changed: the NEW quantity. */
  quantity: number;
  /** For added and removed: the unit price. For changed: the NEW unit price. MINOR units. */
  unit_price_minor: number;
  /** changed only: what the line was before. */
  was_quantity?: number;
  was_unit_price_minor?: number;
  tax_rate: number | null;
  reason: string;
  date: string;
  note?: string;
  created: string;
}

export interface StatusEvent {
  from: Status;
  to: Status;
  date: string;
  note?: string;
  at: string;
}

export interface ChangeOrder {
  id: string;
  reference: string;
  reference_kind: ReferenceKind;
  client: string;
  title: string;
  date: string;
  currency: string;
  /** The contract value before any change order, stated once per reference and inherited. */
  original_value_minor: number;
  status: Status;
  history: StatusEvent[];
  lines: Line[];
  note?: string;
  created: string;
  updated: string;
}

/* ------------------------------------------------------------- normalising */

/** Collapse whitespace so one title is one line, not three. */
export const normaliseText = (s: string): string => String(s).trim().replace(/\s+/g, " ");
export const normaliseCurrency = (s: string): string => String(s).trim().toUpperCase();
/** A reference is an id from a sibling server: upper case, no spaces. */
export const normaliseReference = (s: string): string => String(s).trim().toUpperCase().replace(/\s+/g, "");

/** A reference that looks like a work-order number is one; everything else is a quote. */
export function inferReferenceKind(reference: string): ReferenceKind {
  return /^WO-/.test(normaliseReference(reference)) ? "work_order" : "quote";
}

/* ------------------------------------------------------------------- money */

/** What one product is worth, on exactly the basis `computeTotals` uses: round the product. */
export const productMinor = (quantity: number, unitMinor: number): number => roundHalfUp(quantity * unitMinor);

/**
 * The signed delta one line makes to the contract value, in MINOR units.
 *
 * An addition is its product; a removal is the negative of its product; a change is the
 * new product less the old one. Each product is rounded on its own, which is the basis
 * `invoice_create` will use on the two items a change becomes (see `invoiceItems`).
 */
export function lineDeltaMinor(l: Line): number {
  const now = productMinor(l.quantity, l.unit_price_minor);
  if (l.kind === "added") return now;
  if (l.kind === "removed") return -now;
  return now - productMinor(l.was_quantity ?? 0, l.was_unit_price_minor ?? 0);
}

/** The net delta of a change order, before VAT. Never stored: derived from the lines. */
export const netDeltaMinor = (o: ChangeOrder): number => o.lines.reduce((a, l) => a + lineDeltaMinor(l), 0);

export const addedMinor = (o: ChangeOrder): number =>
  o.lines.reduce((a, l) => a + (l.kind === "added" ? lineDeltaMinor(l) : 0), 0);
export const removedMinor = (o: ChangeOrder): number =>
  o.lines.reduce((a, l) => a + (l.kind === "removed" ? lineDeltaMinor(l) : 0), 0);
export const changedMinor = (o: ChangeOrder): number =>
  o.lines.reduce((a, l) => a + (l.kind === "changed" ? lineDeltaMinor(l) : 0), 0);

/** Minor units as a plain major-unit decimal string. The invoice server takes majors. */
export function major(minor: number, currency: string): string {
  const d = currencyDecimals(currency);
  return (minor / 10 ** d).toFixed(d);
}

/**
 * One line as the ITEMS it becomes, in MINOR units and with the sign on the quantity.
 *
 * An addition is one item. A removal is one item with a NEGATIVE quantity at the unit
 * price it was booked at. A change is TWO items, a reversal of the old line and the new
 * line, never one net item: 3 x 450.00 becoming 5 x 420.00 is worth +750.00, but an item
 * of quantity 1 at 750.00 shows the customer nothing they can check, while -3 x 450.00
 * and 5 x 420.00 both reproduce on a calculator and sum to the same +750.00, because
 * `roundHalfUp` is symmetric in sign.
 */
export interface DeltaItem {
  line: string;
  kind: LineKind;
  part: "line" | "reversal" | "revised";
  description: string;
  quantity: number;
  unit_price_minor: number;
  tax_rate: number;
  value_minor: number;
}

export function deltaItems(o: ChangeOrder, fallbackTaxRate: number): DeltaItem[] {
  const out: DeltaItem[] = [];
  for (const l of o.lines) {
    const rate = l.tax_rate ?? fallbackTaxRate;
    if (l.kind === "added") {
      out.push({ line: l.id, kind: l.kind, part: "line", description: `${l.description} (added: ${l.reason})`, quantity: l.quantity, unit_price_minor: l.unit_price_minor, tax_rate: rate, value_minor: productMinor(l.quantity, l.unit_price_minor) });
    } else if (l.kind === "removed") {
      out.push({ line: l.id, kind: l.kind, part: "line", description: `${l.description} (removed: ${l.reason})`, quantity: -l.quantity, unit_price_minor: l.unit_price_minor, tax_rate: rate, value_minor: -productMinor(l.quantity, l.unit_price_minor) });
    } else {
      const wq = l.was_quantity ?? 0;
      const wp = l.was_unit_price_minor ?? 0;
      out.push({ line: l.id, kind: l.kind, part: "reversal", description: `${l.description} (was ${wq} x ${wp}, reversed: ${l.reason})`, quantity: -wq, unit_price_minor: wp, tax_rate: rate, value_minor: -productMinor(wq, wp) });
      out.push({ line: l.id, kind: l.kind, part: "revised", description: `${l.description} (now ${l.quantity} x ${l.unit_price_minor})`, quantity: l.quantity, unit_price_minor: l.unit_price_minor, tax_rate: rate, value_minor: productMinor(l.quantity, l.unit_price_minor) });
    }
  }
  return out;
}

/**
 * `invoice_create` items. `unit_price` is in MAJOR units and is the stored minor figure
 * expressed exactly, so `computeTotals` rounds it back to the same integer minor unit.
 * `invoice_create` accepts a negative quantity (its bound is -1e12..1e12), which is how a
 * removal and a reversal are carried.
 */
export function invoiceItems(items: DeltaItem[], currency: string): InputItem[] {
  return items.map((i) => ({
    description: i.description,
    quantity: i.quantity,
    unit_price: Number(major(i.unit_price_minor, currency)),
    tax_rate: i.tax_rate,
  }));
}

/** `quote_create` items. The SAME lines, in MINOR units, which is what that tool takes. */
export function quoteItems(items: DeltaItem[], currency: string): {
  description: string; quantity: number; unit_price_minor: number; tax_rate: number; currency: string;
}[] {
  return items.map((i) => ({
    description: i.description,
    quantity: i.quantity,
    unit_price_minor: i.unit_price_minor,
    tax_rate: i.tax_rate,
    currency,
  }));
}

/**
 * `quote_create` refuses a quantity that is not greater than zero
 * (servers/quotes/src/index.ts), so a delta with a removal or a reversal in it cannot be
 * quoted as it stands. The payload still carries the items, so the scale identity holds
 * and the caller can see what would be refused; this says whether the tool would take it.
 */
export const quoteReady = (items: DeltaItem[]): boolean => items.every((i) => i.quantity > 0);

/** The totals the invoice server will compute from those items. Same function, no copy. */
export function deltaTotals(items: DeltaItem[], currency: string): Totals {
  return computeTotals(invoiceItems(items, currency), currency, 0, 0);
}

/* ------------------------------------------------------------------ status */

export const isOpen = (o: ChangeOrder): boolean => OPEN_STATUSES.includes(o.status);

/** Why a move from `from` to `to` is refused, or null when it is legal. */
export function transitionError(from: Status, to: Status): string | null {
  if (from === to) return `is already ${from}`;
  if (CLOSED_STATUSES.includes(from)) {
    return `is ${from}, which is final. A change order that has been ${from} is a fact about what the client answered; a change of mind is a new change order against the same reference`;
  }
  if (!TRANSITIONS[from].includes(to)) {
    if (from === "draft" && (to === "approved" || to === "rejected")) {
      return `is draft and has not been sent. Approval is the client's answer to something they were sent, so move it to sent first (with the day it went out), then to ${to}`;
    }
    return `is ${from}, and from there it can only go to ${TRANSITIONS[from].join(" or ")}, not ${to}`;
  }
  return null;
}

/** The instant a change order first reached a status, or null if it never has. */
export function reachedAt(o: ChangeOrder, s: Status): StatusEvent | null {
  return o.history.find((h) => h.to === s) ?? null;
}

/* ---------------------------------------------------------------- contract */

export interface ContractValue {
  reference: string;
  reference_kind: ReferenceKind;
  currency: string;
  original_value_minor: number;
  approved_delta_minor: number;
  current_value_minor: number;
  pending_delta_minor: number;
  if_all_pending_approved_minor: number;
  rejected_delta_minor: number;
  void_delta_minor: number;
  counts: Record<Status, number>;
}

/**
 * The running value of one reference: the original plus APPROVED deltas. Pending deltas
 * (draft and sent) are a separate figure, because a change order the client has not
 * agreed to is not part of the contract, and rejected or void ones count for nothing.
 */
export function contractValue(orders: ChangeOrder[]): ContractValue {
  const first = orders[0];
  const sum = (s: Status[]): number => orders.filter((o) => s.includes(o.status)).reduce((a, o) => a + netDeltaMinor(o), 0);
  const approved = sum(["approved"]);
  const pending = sum(OPEN_STATUSES);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, orders.filter((o) => o.status === s).length])) as Record<Status, number>;
  return {
    reference: first.reference,
    reference_kind: first.reference_kind,
    currency: first.currency,
    original_value_minor: first.original_value_minor,
    approved_delta_minor: approved,
    current_value_minor: first.original_value_minor + approved,
    pending_delta_minor: pending,
    if_all_pending_approved_minor: first.original_value_minor + approved + pending,
    rejected_delta_minor: sum(["rejected"]),
    void_delta_minor: sum(["void"]),
    counts,
  };
}

/* ---------------------------------------------------------------- duplicates */

/**
 * The identity of a change order for duplicate refusal: everything a person types when
 * they raise one. Two change orders on one reference with one title, one client and one
 * currency are one variation entered twice far more often than they are two. Checked
 * BEFORE the free cap, so the refusal names an id rather than selling an upgrade, and
 * burns neither a slot nor a CO number.
 */
export function orderKey(o: { reference: string; title: string; client: string; currency: string }): string {
  return JSON.stringify([
    normaliseReference(o.reference),
    normaliseText(o.title).toLowerCase(),
    normaliseText(o.client).toLowerCase(),
    normaliseCurrency(o.currency),
  ]);
}
