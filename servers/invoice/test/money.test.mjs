import test from "node:test";
import assert from "node:assert/strict";
import {
  computeTotals, currencyDecimals, formatMoney, roundHalfUp, toMinor, addDays, daysBetween,
} from "../dist/money.js";

test("roundHalfUp is half-up and float-stable", () => {
  assert.equal(roundHalfUp(0.5), 1);
  assert.equal(roundHalfUp(1.5), 2);
  assert.equal(roundHalfUp(2.4999), 2);
  // 1.005 * 100 is 100.49999999999999 in binary floating point; the epsilon keeps it at 101.
  assert.equal(roundHalfUp(1.005 * 100), 101);
  assert.equal(roundHalfUp(-0.5), -1);
});

test("toMinor and formatMoney respect currency decimals", () => {
  assert.equal(currencyDecimals("EUR"), 2);
  assert.equal(currencyDecimals("jpy"), 0);
  assert.equal(toMinor(90, "EUR"), 9000);
  assert.equal(toMinor(90.005, "EUR"), 9001);
  assert.equal(toMinor(1200, "JPY"), 1200);
  assert.equal(formatMoney(9000, "EUR"), "EUR 90.00");
  assert.equal(formatMoney(5, "EUR"), "EUR 0.05");
  assert.equal(formatMoney(1200, "JPY"), "JPY 1200");
  assert.equal(formatMoney(-250, "USD"), "USD -2.50");
});

test("minor units follow the ISO 4217 table, matching the expense-tracker table", () => {
  assert.equal(currencyDecimals("KWD"), 3);
  assert.equal(currencyDecimals("bhd"), 3);
  assert.equal(currencyDecimals("JPY"), 0);
  assert.equal(currencyDecimals("ISK"), 0);
  assert.equal(currencyDecimals("HUF"), 2);
  assert.equal(currencyDecimals("constructor"), 2);
  assert.equal(toMinor(1.234, "KWD"), 1234);
  assert.equal(formatMoney(1234, "KWD"), "KWD 1.234");
  const t = computeTotals([{ description: "Dev", quantity: 2, unit_price: 1.234, tax_rate: 5 }], "KWD");
  assert.equal(t.subtotal_minor, 2468);
  assert.equal(t.tax_minor, 123);
  assert.equal(formatMoney(t.total_minor, "KWD"), "KWD 2.591");
});

test("12 hours at 90 EUR with no tax", () => {
  const t = computeTotals([{ description: "Dev", quantity: 12, unit_price: 90 }], "EUR");
  assert.equal(t.subtotal_minor, 108000);
  assert.equal(t.tax_minor, 0);
  assert.equal(t.total_minor, 108000);
  assert.equal(formatMoney(t.total_minor, "EUR"), "EUR 1080.00");
});

test("multiple tax rates group into one line per rate", () => {
  const t = computeTotals([
    { description: "Consulting", quantity: 10, unit_price: 100, tax_rate: 23 },
    { description: "Hosting", quantity: 1, unit_price: 50, tax_rate: 8 },
    { description: "More consulting", quantity: 2, unit_price: 100, tax_rate: 23 },
  ], "EUR");
  assert.equal(t.subtotal_minor, 100000 + 5000 + 20000);
  assert.equal(t.tax_lines.length, 2);
  const r8 = t.tax_lines.find((x) => x.rate === 8);
  const r23 = t.tax_lines.find((x) => x.rate === 23);
  assert.equal(r8.base_minor, 5000);
  assert.equal(r8.tax_minor, 400);
  assert.equal(r23.base_minor, 120000);
  assert.equal(r23.tax_minor, 27600);
  assert.equal(t.tax_minor, 28000);
  assert.equal(t.total_minor, 125000 + 28000);
});

test("default tax rate applies only to lines without their own", () => {
  const t = computeTotals([
    { description: "A", quantity: 1, unit_price: 100 },
    { description: "B", quantity: 1, unit_price: 100, tax_rate: 0 },
  ], "EUR", 0, 20);
  assert.equal(t.lines[0].tax_rate, 20);
  assert.equal(t.lines[1].tax_rate, 0);
  assert.equal(t.tax_minor, 2000);
  assert.equal(t.total_minor, 22000);
});

test("discount is applied per line before tax", () => {
  const t = computeTotals([
    { description: "A", quantity: 3, unit_price: 33.33, tax_rate: 21 },
  ], "EUR", 10);
  // gross = round(3 * 33.33 * 100) = 9999
  assert.equal(t.subtotal_minor, 9999);
  // discount = round(9999 * 0.10) = 1000  (999.9 rounds half-up to 1000)
  assert.equal(t.discount_minor, 1000);
  assert.equal(t.net_minor, 8999);
  // tax = round(8999 * 0.21) = 1890  (1889.79)
  assert.equal(t.tax_minor, 1890);
  assert.equal(t.total_minor, 10889);
});

test("rounding is per line then summed, not on the raw total", () => {
  // Each line is 0.005 EUR and rounds up to 1 cent on its own -> 3 cents total,
  // where rounding the raw 0.015 sum would give 2 cents.
  const t = computeTotals(
    [1, 2, 3].map((n) => ({ description: `L${n}`, quantity: 1, unit_price: 0.005 })), "EUR");
  assert.deepEqual(t.lines.map((l) => l.gross_minor), [1, 1, 1]);
  assert.equal(t.subtotal_minor, 3);
});

test("JPY has zero decimals end to end", () => {
  const t = computeTotals([
    { description: "Design", quantity: 3, unit_price: 12500, tax_rate: 10 },
  ], "JPY");
  assert.equal(t.decimals, 0);
  assert.equal(t.subtotal_minor, 37500);
  assert.equal(t.tax_minor, 3750);
  assert.equal(t.total_minor, 41250);
  assert.equal(formatMoney(t.total_minor, "JPY"), "JPY 41250");
});

test("JPY discount rounds to whole yen", () => {
  const t = computeTotals([{ description: "X", quantity: 1, unit_price: 999 }], "JPY", 33);
  assert.equal(t.discount_minor, 330); // round(999 * 0.33) = round(329.67)
  assert.equal(t.total_minor, 669);
});

test("date helpers are ISO and UTC stable", () => {
  assert.equal(addDays("2026-01-30", 14), "2026-02-13");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(daysBetween("2026-01-01", "2026-03-01"), 59);
});
