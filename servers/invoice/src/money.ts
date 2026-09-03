/**
 * Money is handled in integer minor units (cents) everywhere inside this server.
 *
 * Rounding contract (documented, tested in test/money.test.mjs):
 *  1. The unit price is rounded into minor units FIRST, and the line is computed from
 *     that stored value, never from the unrounded input (D-R24):
 *       unit_i  = roundHalfUp(unit_price_i * 10^d)
 *       gross_i = roundHalfUp(quantity_i * unit_i)
 *     so unit_price_minor x quantity always equals gross_minor for a whole quantity, and
 *     the arithmetic printed on the invoice reproduces exactly: 10420 x 6 = 62520.
 *     The cost of this basis is that a converted line can sit one minor unit away from
 *     the mathematically exact conversion; the invoice adding up is worth more.
 *  2. An invoice level discount_percent is applied per line and rounded per line:
 *     discount_i = roundHalfUp(gross_i * p / 100); net_i = gross_i - discount_i.
 *  3. Tax is computed per line and rounded per line: tax_i = roundHalfUp(net_i * rate_i / 100),
 *     then summed into one tax line per distinct rate.
 *  4. Totals are plain integer sums of the already-rounded line values.
 * "Round per line, then sum" means a total can never drift from the printed lines by
 * more than the rounding already visible on those lines.
 */

/**
 * ISO 4217 minor units. Anything not listed uses 2 decimals.
 * Kept byte-identical in servers/expense-tracker/src/money.ts: the two servers exchange
 * amounts, so a currency that is 3-decimal in one and 2-decimal in the other
 * silently rescales money by 10x.
 * HUF and ISK: ISO 4217 gives HUF 2 minor digits (it is only *quoted* without
 * them) and ISK 0, so HUF is deliberately absent from the zero list.
 */
// A Map, not an object literal: a currency string of "constructor" must miss, not return a function.
const MINOR_UNITS = new Map<string, number>(Object.entries({
  // 0 decimals
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, MGA: 0,
  PYG: 0, RWF: 0, UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  // 3 decimals
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
  // 4 decimals
  CLF: 4, UYW: 4,
}));

export function currencyDecimals(currency: string): number {
  const d = MINOR_UNITS.get(currency.toUpperCase());
  return d === undefined ? 2 : d;
}

/** Half-up rounding that is stable against binary floating point representation error. */
export function roundHalfUp(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  return sign * Math.floor(abs + 0.5 + 1e-9);
}

/** Convert a major-unit amount (e.g. 90.5 EUR) into integer minor units. */
export function toMinor(amount: number, currency: string): number {
  const f = Math.pow(10, currencyDecimals(currency));
  return roundHalfUp(amount * f);
}

/** Render integer minor units as "EUR 1080.00" / "JPY 1080". */
export function formatMoney(minor: number, currency: string): string {
  const code = currency.toUpperCase();
  const d = currencyDecimals(code);
  const f = Math.pow(10, d);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  if (d === 0) return `${code} ${sign}${abs}`;
  const whole = Math.floor(abs / f);
  const frac = String(abs % f).padStart(d, "0");
  return `${code} ${sign}${whole}.${frac}`;
}

/** Render minor units without the currency code, for table columns. */
export function formatAmount(minor: number, currency: string): string {
  return formatMoney(minor, currency).slice(currency.length + 1);
}

export interface InputItem {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  // D-R46: when unit_price carries more precision than the currency's minor unit
  // (typically because it was converted with fx_rates before being passed in), the
  // default basis (round the unit to a whole cent, then multiply) can drift a line
  // away from the exact converted amount. round_total asks for the OTHER basis: round
  // the exact quantity x unit_price product once, so the line gross matches the exact
  // conversion to the cent; unit_price_minor is then reported as gross_minor / quantity
  // (rounded to the nearest cent for the label) rather than being what the gross was
  // computed from.
  round_total?: boolean;
}

export interface ComputedLine {
  description: string;
  quantity: number;
  unit_price_minor: number;
  tax_rate: number;
  gross_minor: number;
  discount_minor: number;
  net_minor: number;
  tax_minor: number;
  // D-R46: gross_minor for this line as it would be under the OTHER basis than the one
  // actually used (round-unit-then-multiply vs round-the-exact-total-once). Equal to
  // gross_minor when the two bases agree (no drift), e.g. whole unit prices.
  exact_gross_minor: number;
  round_total: boolean;
}

export interface TaxLine { rate: number; base_minor: number; tax_minor: number }

export interface Totals {
  currency: string;
  decimals: number;
  lines: ComputedLine[];
  subtotal_minor: number;       // sum of line gross, before discount and tax
  discount_percent: number;
  discount_minor: number;       // sum of per-line discounts
  net_minor: number;            // subtotal - discount, the taxable base
  tax_lines: TaxLine[];
  tax_minor: number;
  total_minor: number;
  // D-R46: sum of (exact_gross_minor - gross_minor) over lines that did NOT ask for
  // round_total. Zero when every unit price is a whole number of cents, or every line
  // that isn't already asked round_total: true.
  rounding_drift_minor: number;
}

export function computeTotals(
  items: InputItem[],
  currency: string,
  discountPercent = 0,
  defaultTaxRate = 0,
): Totals {
  const code = currency.toUpperCase();
  const d = currencyDecimals(code);
  const f = Math.pow(10, d);
  const p = Number.isFinite(discountPercent) ? discountPercent : 0;

  const lines: ComputedLine[] = items.map((it) => {
    const rate = it.tax_rate === undefined || it.tax_rate === null ? defaultTaxRate : it.tax_rate;
    // D-R24: by default the line is computed from the unit price AS STORED AND PRINTED,
    // never from the unrounded input. Round the unit price into minor units first, then
    // multiply by the quantity, then discount, then tax. 104.202 x 6 prints "104.20" and
    // "625.20", and 10420 x 6 = 62520 reproduces on a client's calculator.
    const unitRoundedFirst = roundHalfUp(it.unit_price * f);
    const grossRoundedFirst = roundHalfUp(it.quantity * unitRoundedFirst);
    // D-R46: the OTHER basis - round the exact product once. This is the exact converted
    // total to the cent; grossRoundedFirst can drift from it when unit_price carries more
    // precision than the currency's minor unit (typically an fx conversion).
    const exactGross = roundHalfUp(it.quantity * it.unit_price * f);
    const useExact = it.round_total === true;
    const unit = useExact ? roundHalfUp(exactGross / it.quantity) : unitRoundedFirst;
    const gross = useExact ? exactGross : grossRoundedFirst;
    const discount = p ? roundHalfUp(gross * p / 100) : 0;
    const net = gross - discount;
    const tax = rate ? roundHalfUp(net * rate / 100) : 0;
    return {
      description: it.description,
      quantity: it.quantity,
      unit_price_minor: unit,
      tax_rate: rate,
      gross_minor: gross,
      discount_minor: discount,
      net_minor: net,
      tax_minor: tax,
      exact_gross_minor: exactGross,
      round_total: useExact,
    };
  });

  const subtotal = lines.reduce((a, l) => a + l.gross_minor, 0);
  const discount = lines.reduce((a, l) => a + l.discount_minor, 0);
  const net = subtotal - discount;

  const byRate = new Map<number, TaxLine>();
  for (const l of lines) {
    const cur = byRate.get(l.tax_rate) ?? { rate: l.tax_rate, base_minor: 0, tax_minor: 0 };
    cur.base_minor += l.net_minor;
    cur.tax_minor += l.tax_minor;
    byRate.set(l.tax_rate, cur);
  }
  const taxLines = [...byRate.values()].sort((a, b) => a.rate - b.rate);
  const tax = taxLines.reduce((a, t) => a + t.tax_minor, 0);
  const roundingDrift = lines.reduce(
    (a, l) => a + (l.round_total ? 0 : l.gross_minor - l.exact_gross_minor), 0,
  );

  return {
    currency: code, decimals: d, lines,
    subtotal_minor: subtotal,
    discount_percent: p,
    discount_minor: discount,
    net_minor: net,
    tax_lines: taxLines,
    tax_minor: tax,
    total_minor: net + tax,
    rounding_drift_minor: roundingDrift,
  };
}

/**
 * ISO date helpers. All dates stored and returned as YYYY-MM-DD.
 *
 * D-R15: this is the LOCAL calendar date, matching time-tracker's dayKey() and
 * expense-tracker's localDay(). It used to be `d.toISOString().slice(0,10)` (UTC), so in
 * UTC+7 an invoice issued at 06:36 local was stamped with the previous day while the
 * expense logged in the same conversation was stamped with the current one.
 */
export function isoDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso + "T00:00:00Z");
  const b = Date.parse(toIso + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}
