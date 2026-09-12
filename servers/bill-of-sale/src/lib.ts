/**
 * Money and date primitives local to this server, so the only dependencies are the SDK,
 * zod and the license gate. Every amount is an integer number of minor units: a price is
 * never a float, because 0.1 + 0.2 is not 0.3 and a bill of sale is a legal record.
 */

/** Currencies with no minor unit, per ISO 4217. */
const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX",
  "VND", "VUV", "XAF", "XOF", "XPF",
]);
/** Currencies with three minor units, per ISO 4217. */
const THREE_DECIMAL = new Set(["BHD", "JOD", "KWD", "LYD", "OMR", "TND"]);

export function currencyDecimals(currency: string): number {
  const c = currency.toUpperCase();
  if (ZERO_DECIMAL.has(c)) return 0;
  if (THREE_DECIMAL.has(c)) return 3;
  return 2;
}

/** Deterministic "1,234.56 USD" formatting; toLocaleString depends on the host locale. */
export function formatMoney(minor: number, currency: string): string {
  const d = currencyDecimals(currency);
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 10 ** d);
  const frac = d === 0 ? "" : `.${String(abs % 10 ** d).padStart(d, "0")}`;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${grouped}${frac} ${currency.toUpperCase()}`;
}

/** A real calendar date in YYYY-MM-DD form, not a string that merely looks like one. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** Today in UTC, YYYY-MM-DD. A sale date is a calendar date, not an instant. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface IdentifierNote { field: string; note: string }

/**
 * Soft checks on the identifiers a buyer most often misreads: a VIN is 17 characters and
 * never contains I, O or Q; an IMEI is 15 digits. These warn, they never refuse, because
 * pre-1981 vehicles and non-phone equipment carry other schemes and the document must
 * still be writable.
 */
export function identifierNotes(ids: { vin?: string; serial?: string; imei?: string }): IdentifierNote[] {
  const notes: IdentifierNote[] = [];
  if (ids.vin !== undefined) {
    const v = ids.vin.trim().toUpperCase();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) {
      notes.push({
        field: "vin",
        note: `The VIN "${ids.vin}" is not 17 characters of the allowed set (no I, O or Q). It was stored as given; modern vehicles use 17, older ones may not. Check it against the plate before signing.`,
      });
    }
  }
  if (ids.imei !== undefined) {
    if (!/^\d{15}$/.test(ids.imei.trim())) {
      notes.push({
        field: "imei",
        note: `The IMEI "${ids.imei}" is not 15 digits. It was stored as given; check it against the device (dial *#06#) before signing.`,
      });
    }
  }
  return notes;
}
