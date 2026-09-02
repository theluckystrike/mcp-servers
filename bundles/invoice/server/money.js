/**
 * Money is handled in integer minor units (cents) everywhere inside this server.
 *
 * Rounding contract (documented, tested in test/money.test.mjs):
 *  1. Every line is rounded on its own, first: gross_i = roundHalfUp(quantity_i * unit_price_i * 10^d).
 *  2. An invoice level discount_percent is applied per line and rounded per line:
 *     discount_i = roundHalfUp(gross_i * p / 100); net_i = gross_i - discount_i.
 *  3. Tax is computed per line and rounded per line: tax_i = roundHalfUp(net_i * rate_i / 100),
 *     then summed into one tax line per distinct rate.
 *  4. Totals are plain integer sums of the already-rounded line values.
 * "Round per line, then sum" means a total can never drift from the printed lines by
 * more than the rounding already visible on those lines.
 */
/** Decimal places for a currency's minor unit. Zero-decimal currencies are listed explicitly. */
const ZERO_DECIMAL = new Set([
    "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG",
    "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);
export function currencyDecimals(currency) {
    return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
}
/** Half-up rounding that is stable against binary floating point representation error. */
export function roundHalfUp(value) {
    const sign = value < 0 ? -1 : 1;
    const abs = Math.abs(value);
    return sign * Math.floor(abs + 0.5 + 1e-9);
}
/** Convert a major-unit amount (e.g. 90.5 EUR) into integer minor units. */
export function toMinor(amount, currency) {
    const f = Math.pow(10, currencyDecimals(currency));
    return roundHalfUp(amount * f);
}
/** Render integer minor units as "EUR 1080.00" / "JPY 1080". */
export function formatMoney(minor, currency) {
    const code = currency.toUpperCase();
    const d = currencyDecimals(code);
    const f = Math.pow(10, d);
    const sign = minor < 0 ? "-" : "";
    const abs = Math.abs(minor);
    if (d === 0)
        return `${code} ${sign}${abs}`;
    const whole = Math.floor(abs / f);
    const frac = String(abs % f).padStart(d, "0");
    return `${code} ${sign}${whole}.${frac}`;
}
/** Render minor units without the currency code, for table columns. */
export function formatAmount(minor, currency) {
    return formatMoney(minor, currency).slice(currency.length + 1);
}
export function computeTotals(items, currency, discountPercent = 0, defaultTaxRate = 0) {
    const code = currency.toUpperCase();
    const d = currencyDecimals(code);
    const f = Math.pow(10, d);
    const p = Number.isFinite(discountPercent) ? discountPercent : 0;
    const lines = items.map((it) => {
        const rate = it.tax_rate === undefined || it.tax_rate === null ? defaultTaxRate : it.tax_rate;
        const gross = roundHalfUp(it.quantity * it.unit_price * f);
        const discount = p ? roundHalfUp(gross * p / 100) : 0;
        const net = gross - discount;
        const tax = rate ? roundHalfUp(net * rate / 100) : 0;
        return {
            description: it.description,
            quantity: it.quantity,
            unit_price_minor: roundHalfUp(it.unit_price * f),
            tax_rate: rate,
            gross_minor: gross,
            discount_minor: discount,
            net_minor: net,
            tax_minor: tax,
        };
    });
    const subtotal = lines.reduce((a, l) => a + l.gross_minor, 0);
    const discount = lines.reduce((a, l) => a + l.discount_minor, 0);
    const net = subtotal - discount;
    const byRate = new Map();
    for (const l of lines) {
        const cur = byRate.get(l.tax_rate) ?? { rate: l.tax_rate, base_minor: 0, tax_minor: 0 };
        cur.base_minor += l.net_minor;
        cur.tax_minor += l.tax_minor;
        byRate.set(l.tax_rate, cur);
    }
    const taxLines = [...byRate.values()].sort((a, b) => a.rate - b.rate);
    const tax = taxLines.reduce((a, t) => a + t.tax_minor, 0);
    return {
        currency: code, decimals: d, lines,
        subtotal_minor: subtotal,
        discount_percent: p,
        discount_minor: discount,
        net_minor: net,
        tax_lines: taxLines,
        tax_minor: tax,
        total_minor: net + tax,
    };
}
/** ISO date helpers. All dates stored and returned as YYYY-MM-DD. */
export function isoDate(d = new Date()) {
    return d.toISOString().slice(0, 10);
}
export function addDays(iso, days) {
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
export function daysBetween(fromIso, toIso) {
    const a = Date.parse(fromIso + "T00:00:00Z");
    const b = Date.parse(toIso + "T00:00:00Z");
    return Math.round((b - a) / 86400000);
}
