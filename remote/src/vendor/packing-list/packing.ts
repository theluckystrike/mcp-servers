/**
 * The packing engine: the record shapes, the pack arithmetic and the shortfall.
 *
 * Two rules decide everything in this file.
 *
 * 1. A PACKING SLIP CARRIES NO PRICES. That is not a simplification, it is what the
 *    document is for: it travels with the goods, and the consignee's warehouse is not the
 *    party that sees what the goods cost. So there is no money type anywhere here, no
 *    currency, and no import of the invoice engine. The invoice is a different document
 *    against the same reference.
 * 2. NOTHING DERIVED IS STORED. A carton holds its tare and its packed lines; the net
 *    weight, the gross weight, the volumetric weight and the chargeable weight are
 *    computed on every call. A stored gross weight is a second copy of what the lines
 *    already decide, and it is the copy that gets believed after somebody unpacks a line.
 *
 * Mass is in WHOLE GRAMS everywhere, for the same reason money is in minor units: a
 * kilogram expressed as a float accumulates error over a hundred lines and then disagrees
 * with the carrier's scale. Dimensions are in whole centimetres.
 */

export const STATUSES = ["draft", "packed", "shipped", "cancelled"] as const;
export type Status = (typeof STATUSES)[number];

/** draft and packed are open; shipped and cancelled are closed and free a free-tier slot. */
export const OPEN_STATUSES: readonly Status[] = ["draft", "packed"];
export const CLOSED_STATUSES: readonly Status[] = ["shipped", "cancelled"];

/**
 * The only transitions that exist. A shipped list is not editable and not re-openable:
 * the goods have left, and a packing slip that changed after the van did is a document
 * nobody can reconcile against what arrived.
 */
export const TRANSITIONS: Record<Status, readonly Status[]> = {
  draft: ["packed", "cancelled"],
  packed: ["shipped", "draft", "cancelled"],
  shipped: [],
  cancelled: [],
};

export const REFERENCE_KINDS = ["quote", "work_order", "invoice", "order"] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

export const MAX_QUANTITY = 1_000_000;
export const MAX_GRAMS = 100_000_000;      // 100 tonnes; a packing list is not a ship manifest
export const MAX_CM = 2_000;               // 20 m in any one dimension
export const MAX_CARTONS = 500;
export const MAX_LINES = 2_000;
export const MAX_ROWS = 500;               // the widest listing any tool will return

/**
 * IATA/courier volumetric divisor, in cm^3 per kilogram. 5000 is the courier air default
 * (DHL, UPS, FedEx all publish it); 6000 is the older IATA air figure and 4000 appears on
 * some domestic road tariffs. It is a PARAMETER here and never a constant in a formula,
 * because a chargeable weight computed against the wrong divisor is a wrong invoice from
 * the carrier that nobody catches until the account is reconciled.
 */
export const DEFAULT_DIVISOR = 5000;
export const DIVISORS = [4000, 5000, 6000] as const;

export interface Carton {
  id: string;                    // C01, C02, ...
  label: string;                 // what is written on the box
  tare_grams: number;            // the empty box, including its packaging
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  note?: string;
}

export interface PackedLine {
  id: string;                    // L01, L02, ...
  carton: string;                // a Carton id
  sku: string | null;
  description: string;
  quantity: number;
  unit_grams: number | null;     // null = not weighed; the carton gross is then partial
  note?: string;
}

/** What the order says should ship. Declared, never inferred, so a shortfall is real. */
export interface ExpectedLine {
  id: string;                    // E01, E02, ...
  sku: string | null;
  description: string;
  quantity: number;
}

export interface StatusEvent { status: Status; date: string; note?: string }

export interface PackingList {
  id: string;                    // PL-YYYY-NNNN
  reference: string;
  reference_kind: ReferenceKind;
  consignee: string;
  ship_to?: string;
  date: string;
  status: Status;
  carrier?: string;
  tracking?: string;
  shipped_date?: string;
  cartons: Carton[];
  expected: ExpectedLine[];
  packed: PackedLine[];
  note?: string;
  history: StatusEvent[];
  created: string;
  updated: string;
}

export function normaliseText(s: string): string { return String(s ?? "").trim().replace(/\s+/g, " "); }

/** References are compared case-insensitively but stored as the caller typed them. */
export function normaliseReference(s: string): string { return normaliseText(s); }
export function referenceKey(s: string): string { return normaliseReference(s).toLowerCase(); }

/** A SKU is a machine key: upper-cased, spaces removed, empty becomes null. */
export function normaliseSku(s: string | undefined): string | null {
  const v = String(s ?? "").trim().toUpperCase().replace(/\s+/g, "");
  return v ? v : null;
}

/**
 * WO-... is a work order, INV-... an invoice, Q-... a quote, anything else a plain order.
 * Inferred only when the caller does not say; the caller's own answer always wins.
 */
export function inferReferenceKind(ref: string): ReferenceKind {
  const r = normaliseReference(ref).toUpperCase();
  if (/^WO[-\s]/.test(r)) return "work_order";
  if (/^INV[-\s]/.test(r)) return "invoice";
  if (/^Q[-\s]/.test(r)) return "quote";
  return "order";
}

export function isOpen(p: PackingList): boolean { return (OPEN_STATUSES as readonly string[]).includes(p.status); }

export function transitionError(from: Status, to: Status): string | null {
  if (from === to) return `the packing list is already ${to}.`;
  const allowed = TRANSITIONS[from];
  if (allowed.includes(to)) return null;
  if (!allowed.length) return `a ${from} packing list cannot change status. The goods have gone; raise a new list for a further shipment.`;
  return `a ${from} packing list cannot go straight to ${to}. From ${from} the next step is ${allowed.join(" or ")}.`;
}

/** The identity two lines are matched on when a packed line is set against an expected one. */
export function matchKey(sku: string | null, description: string): string {
  return sku ? `sku:${sku}` : `desc:${normaliseText(description).toLowerCase()}`;
}

export function linesIn(p: PackingList, cartonId: string): PackedLine[] {
  return p.packed.filter((l) => l.carton === cartonId);
}

/** Grams of goods in a carton, and whether every line in it was weighed. */
export function netGrams(p: PackingList, cartonId: string): { grams: number; complete: boolean; unweighed: number } {
  let grams = 0, unweighed = 0;
  for (const l of linesIn(p, cartonId)) {
    if (l.unit_grams === null) { unweighed += 1; continue; }
    grams += l.unit_grams * l.quantity;
  }
  return { grams, complete: unweighed === 0, unweighed };
}

export function volumeCm3(c: Carton): number | null {
  if (c.length_cm === undefined || c.width_cm === undefined || c.height_cm === undefined) return null;
  return c.length_cm * c.width_cm * c.height_cm;
}

/**
 * Volumetric grams, rounded UP to the gram. Carriers round the chargeable figure up, never
 * down, and rounding it down here would under-state a freight cost that the carrier will
 * charge in full.
 */
export function volumetricGrams(c: Carton, divisor: number): number | null {
  const v = volumeCm3(c);
  if (v === null) return null;
  return Math.ceil((v / divisor) * 1000);
}

export interface CartonReport {
  id: string; label: string;
  lines: number; units: number;
  tare_grams: number;
  net_grams: number; net_complete: boolean; unweighed_lines: number;
  gross_grams: number;
  dimensions_cm: { length: number; width: number; height: number } | null;
  volume_cm3: number | null;
  volumetric_grams: number | null;
  chargeable_grams: number | null;
  chargeable_basis: "actual" | "volumetric" | null;
}

/**
 * One carton, fully derived. `chargeable_grams` is the greater of gross and volumetric, the
 * rule every courier applies; it is null when the box has no dimensions, because a guess
 * there is a freight quote that turns out wrong at the counter. When any line in the carton
 * was not weighed, `net_complete` is false and the gross is a LOWER BOUND, which every
 * caller of this is expected to say out loud rather than print as if it were the weight.
 */
export function cartonReport(p: PackingList, c: Carton, divisor: number): CartonReport {
  const lines = linesIn(p, c.id);
  const net = netGrams(p, c.id);
  const gross = c.tare_grams + net.grams;
  const vol = volumeCm3(c);
  const volg = volumetricGrams(c, divisor);
  const chargeable = volg === null ? null : Math.max(gross, volg);
  return {
    id: c.id, label: c.label,
    lines: lines.length,
    units: lines.reduce((n, l) => n + l.quantity, 0),
    tare_grams: c.tare_grams,
    net_grams: net.grams, net_complete: net.complete, unweighed_lines: net.unweighed,
    gross_grams: gross,
    dimensions_cm: vol === null ? null : { length: c.length_cm!, width: c.width_cm!, height: c.height_cm! },
    volume_cm3: vol,
    volumetric_grams: volg,
    chargeable_grams: chargeable,
    chargeable_basis: chargeable === null ? null : (chargeable === gross && gross >= (volg ?? 0) ? "actual" : "volumetric"),
  };
}

export interface ShipmentTotals {
  cartons: number; lines: number; units: number;
  tare_grams: number; net_grams: number; gross_grams: number;
  net_complete: boolean; unweighed_lines: number;
  volumetric_grams: number | null; chargeable_grams: number | null;
  cartons_without_dimensions: number;
  divisor: number;
}

/**
 * The shipment, summed over its cartons. The volumetric and chargeable totals are null when
 * ANY carton lacks dimensions: a total that silently skipped three unmeasured boxes reads
 * like a complete figure and is not one.
 */
export function shipmentTotals(p: PackingList, divisor: number): ShipmentTotals {
  const reports = p.cartons.map((c) => cartonReport(p, c, divisor));
  const missing = reports.filter((r) => r.volumetric_grams === null).length;
  const sum = (f: (r: CartonReport) => number) => reports.reduce((n, r) => n + f(r), 0);
  return {
    cartons: reports.length,
    lines: sum((r) => r.lines),
    units: sum((r) => r.units),
    tare_grams: sum((r) => r.tare_grams),
    net_grams: sum((r) => r.net_grams),
    gross_grams: sum((r) => r.gross_grams),
    net_complete: reports.every((r) => r.net_complete),
    unweighed_lines: sum((r) => r.unweighed_lines),
    volumetric_grams: missing ? null : sum((r) => r.volumetric_grams ?? 0),
    chargeable_grams: missing ? null : sum((r) => r.chargeable_grams ?? 0),
    cartons_without_dimensions: missing,
    divisor,
  };
}

export interface ShortfallRow {
  key: string; sku: string | null; description: string;
  expected: number; packed: number; outstanding: number;
  state: "short" | "complete" | "over" | "not_on_order";
  cartons: string[];
}

/**
 * Expected against packed, matched on SKU when there is one and on the normalised
 * description when there is not.
 *
 * A line that was packed and is not on the order comes back as `not_on_order` rather than
 * being dropped. Dropping it is how a wrong item ships: the shortfall report reads clean,
 * the box is heavier than the order, and nobody looks again until the consignee calls.
 */
export function shortfall(p: PackingList): ShortfallRow[] {
  const rows = new Map<string, ShortfallRow>();
  for (const e of p.expected) {
    const k = matchKey(e.sku, e.description);
    const r = rows.get(k) ?? { key: k, sku: e.sku, description: e.description, expected: 0, packed: 0, outstanding: 0, state: "short" as const, cartons: [] };
    r.expected += e.quantity;
    rows.set(k, r);
  }
  for (const l of p.packed) {
    const k = matchKey(l.sku, l.description);
    const r = rows.get(k) ?? { key: k, sku: l.sku, description: l.description, expected: 0, packed: 0, outstanding: 0, state: "short" as const, cartons: [] };
    r.packed += l.quantity;
    if (!r.cartons.includes(l.carton)) r.cartons.push(l.carton);
    rows.set(k, r);
  }
  const out: ShortfallRow[] = [];
  for (const r of rows.values()) {
    r.outstanding = r.expected - r.packed;
    r.state = r.expected === 0 ? "not_on_order" : r.outstanding > 0 ? "short" : r.outstanding < 0 ? "over" : "complete";
    r.cartons.sort();
    out.push(r);
  }
  const order: Record<ShortfallRow["state"], number> = { short: 0, over: 1, not_on_order: 2, complete: 3 };
  return out.sort((a, b) => order[a.state] - order[b.state] || (b.expected - b.packed) - (a.expected - a.packed) || a.description.localeCompare(b.description));
}

/** True when every expected line is packed in full and nothing unordered was packed. */
export function readyToShip(p: PackingList): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!p.cartons.length) reasons.push("no carton has been added");
  if (!p.packed.length) reasons.push("nothing has been packed");
  const rows = shortfall(p);
  const short = rows.filter((r) => r.state === "short");
  const over = rows.filter((r) => r.state === "over");
  const extra = rows.filter((r) => r.state === "not_on_order");
  if (short.length) reasons.push(`${short.length} line(s) still short: ${short.slice(0, 5).map((r) => `${r.description} (${r.outstanding} outstanding)`).join(", ")}`);
  if (over.length) reasons.push(`${over.length} line(s) over-packed: ${over.slice(0, 5).map((r) => `${r.description} (${-r.outstanding} extra)`).join(", ")}`);
  if (extra.length) reasons.push(`${extra.length} packed line(s) are not on the order: ${extra.slice(0, 5).map((r) => r.description).join(", ")}`);
  const empty = p.cartons.filter((c) => !linesIn(p, c.id).length);
  if (empty.length) reasons.push(`${empty.length} empty carton(s): ${empty.map((c) => c.id).join(", ")}`);
  return { ready: reasons.length === 0, reasons };
}

export const kg = (grams: number): string => `${(grams / 1000).toFixed(3)} kg`;

/**
 * The packing slip, as plain text. No prices, by design; see the file header.
 *
 * The unweighed-line caveat is printed in the body rather than only returned as a field,
 * because this text is the thing that gets pasted into an email and a caveat that lives
 * only in the JSON does not travel with it.
 */
export function slipText(p: PackingList, issuer: string, divisor: number): string {
  const t = shipmentTotals(p, divisor);
  const L: string[] = [];
  L.push(issuer);
  L.push("");
  L.push(`PACKING SLIP  ${p.id}`);
  L.push(`Date        : ${p.date}`);
  L.push(`Against     : ${p.reference} (${p.reference_kind.replace("_", " ")})`);
  L.push(`Consignee   : ${p.consignee}`);
  if (p.ship_to) L.push(`Ship to     : ${p.ship_to}`);
  if (p.carrier) L.push(`Carrier     : ${p.carrier}${p.tracking ? ` / ${p.tracking}` : ""}`);
  L.push(`Status      : ${p.status}${p.shipped_date ? ` on ${p.shipped_date}` : ""}`);
  L.push("");
  L.push("This document lists goods only. It carries no prices and is not an invoice.");
  L.push("");
  for (const c of p.cartons) {
    const r = cartonReport(p, c, divisor);
    const dims = r.dimensions_cm ? `  ${r.dimensions_cm.length}x${r.dimensions_cm.width}x${r.dimensions_cm.height} cm` : "";
    L.push(`${c.id}  ${c.label}${dims}`);
    const lines = linesIn(p, c.id);
    if (!lines.length) L.push("      (empty)");
    for (const l of lines) {
      L.push(`      ${String(l.quantity).padStart(6)} x  ${l.sku ? `${l.sku}  ` : ""}${l.description}${l.note ? `  (${l.note})` : ""}`);
    }
    L.push(`      tare ${kg(r.tare_grams)}   net ${kg(r.net_grams)}${r.net_complete ? "" : " (at least)"}   gross ${kg(r.gross_grams)}${r.net_complete ? "" : " (at least)"}`);
    L.push("");
  }
  L.push(`Cartons ${t.cartons}   lines ${t.lines}   units ${t.units}`);
  L.push(`Gross ${kg(t.gross_grams)}${t.net_complete ? "" : " (at least: " + t.unweighed_lines + " line(s) not weighed)"}`);
  if (t.chargeable_grams !== null) L.push(`Chargeable ${kg(t.chargeable_grams)} at divisor ${t.divisor}`);
  else L.push(`Chargeable weight not computed: ${t.cartons_without_dimensions} carton(s) have no dimensions.`);
  if (p.note) { L.push(""); L.push(p.note); }
  L.push("");
  L.push("Received in good order by ......................................  date ..............");
  return L.join("\n");
}
