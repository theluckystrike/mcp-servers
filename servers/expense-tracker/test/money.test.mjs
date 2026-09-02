import test from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const M = await import(join(here, "..", "dist", "money.js"));

test("currency decimals: 2 by default, 0 for JPY", () => {
  assert.equal(M.currencyDecimals("EUR"), 2);
  assert.equal(M.currencyDecimals("pln"), 2);
  assert.equal(M.currencyDecimals("JPY"), 0);
  assert.equal(M.currencyDecimals("KRW"), 0);
});

test("toMinor and formatMoney round-trip per currency", () => {
  assert.equal(M.toMinor(12.34, "EUR"), 1234);
  assert.equal(M.toMinor(0.1 + 0.2, "EUR"), 30);       // 0.30000000000000004
  assert.equal(M.toMinor(1080, "JPY"), 1080);
  assert.equal(M.formatMoney(1234, "EUR"), "EUR 12.34");
  assert.equal(M.formatMoney(5, "EUR"), "EUR 0.05");
  assert.equal(M.formatMoney(-1234, "EUR"), "EUR -12.34");
  assert.equal(M.formatMoney(1080, "JPY"), "JPY 1080");
});

test("roundHalfUp is half-up and float-stable", () => {
  assert.equal(M.roundHalfUp(0.5), 1);
  assert.equal(M.roundHalfUp(1.5), 2);
  assert.equal(M.roundHalfUp(-0.5), -1);
  assert.equal(M.roundHalfUp(1.005 * 100), 101);      // 100.49999999999999
});

test("VAT split: net + vat is exactly the gross", () => {
  const a = M.vatSplit(12300, 23);                     // PLN 123.00 at 23%
  assert.equal(a.net_minor, 10000);
  assert.equal(a.vat_minor, 2300);
  assert.equal(a.net_minor + a.vat_minor, a.gross_minor);

  // The VAT component is what gets rounded: 999 * 20 / 120 = 166.5 -> 167, net is the rest.
  const b = M.vatSplit(999, 20);
  assert.equal(b.vat_minor, 167);
  assert.equal(b.net_minor, 832);
  assert.equal(b.net_minor + b.vat_minor, 999);

  for (const gross of [1, 7, 99, 1234, 555555]) {
    for (const rate of [0, 5, 7.5, 19, 20, 21, 23, 27]) {
      const s = M.vatSplit(gross, rate);
      assert.equal(s.net_minor + s.vat_minor, gross, `${gross}@${rate}`);
    }
  }
});

test("D-R1: a half-cent of VAT rounds up, it does not vanish", () => {
  // Rounding the net first sent these to VAT 0.
  assert.deepEqual([M.vatSplit(3, 20).net_minor, M.vatSplit(3, 20).vat_minor], [2, 1]);   // 0.5 -> 1
  assert.deepEqual([M.vatSplit(3, 23).net_minor, M.vatSplit(3, 23).vat_minor], [2, 1]);   // 0.561 -> 1
  assert.deepEqual([M.vatSplit(6, 20).net_minor, M.vatSplit(6, 20).vat_minor], [5, 1]);   // 1.0
  assert.deepEqual([M.vatSplit(999, 20).net_minor, M.vatSplit(999, 20).vat_minor], [832, 167]);
  assert.deepEqual([M.vatSplit(2, 50).net_minor, M.vatSplit(2, 50).vat_minor], [1, 1]);
  // exactness still holds across a wide sweep, including the half-cent boundary cases
  for (let gross = 1; gross <= 400; gross++) {
    for (const rate of [0, 5, 7.5, 8, 19, 20, 21, 23, 25, 27]) {
      const s = M.vatSplit(gross, rate);
      assert.equal(s.net_minor + s.vat_minor, gross, `${gross}@${rate}`);
      assert.ok(s.vat_minor >= 0 && s.net_minor >= 0, `${gross}@${rate}`);
    }
  }
});

test("D-R2: minor units follow the ISO 4217 table, not a 2-decimal guess", () => {
  assert.equal(M.currencyDecimals("KWD"), 3);
  assert.equal(M.currencyDecimals("bhd"), 3);
  assert.equal(M.currencyDecimals("JOD"), 3);
  assert.equal(M.currencyDecimals("JPY"), 0);
  assert.equal(M.currencyDecimals("ISK"), 0);
  assert.equal(M.currencyDecimals("HUF"), 2);   // ISO 4217 gives HUF 2, however it is quoted
  assert.equal(M.currencyDecimals("EUR"), 2);
  assert.equal(M.currencyDecimals("constructor"), 2);   // Map lookup, not a prototype hit
  assert.equal(M.toMinor(1.234, "KWD"), 1234);
  assert.equal(M.formatMoney(1234, "KWD"), "KWD 1.234");
  assert.equal(M.toMajor(1234, "KWD"), 1.234);
  assert.equal(M.toMinor(1080, "JPY"), 1080);
  assert.equal(M.formatMoney(1080, "JPY"), "JPY 1080");
  const k = M.vatSplit(M.toMinor(1.234, "KWD"), 5);
  assert.equal(k.net_minor + k.vat_minor, 1234);
});

test("VAT split with no rate leaves everything as net", () => {
  const s = M.vatSplit(4200, undefined);
  assert.deepEqual([s.net_minor, s.vat_minor, s.rate], [4200, 0, 0]);
});

test("mileage rate table matches the documented defaults", () => {
  assert.deepEqual(M.MILEAGE_RATES.PL, { region: "PL", unit: "km", rate: 1.15, currency: "PLN" });
  assert.deepEqual(M.MILEAGE_RATES.UK, { region: "UK", unit: "mile", rate: 0.45, currency: "GBP" });
  assert.deepEqual(M.MILEAGE_RATES.US, { region: "US", unit: "mile", rate: 0.70, currency: "USD" });
  assert.deepEqual(M.MILEAGE_RATES.EU, { region: "EU", unit: "km", rate: 0.30, currency: "EUR" });
  assert.equal(M.defaultRegion("mile"), "US");
  assert.equal(M.defaultRegion("km"), "EU");
});

test("mileage money is distance x rate in minor units", () => {
  assert.equal(M.mileageAmount(120, 1.15, "PLN"), 13800);    // PL: 120 km -> PLN 138.00
  assert.equal(M.mileageAmount(37, 0.45, "GBP"), 1665);      // UK: 37 miles -> GBP 16.65
  assert.equal(M.mileageAmount(214, 0.70, "USD"), 14980);    // US: 214 miles -> USD 149.80
  assert.equal(M.mileageAmount(83, 0.30, "EUR"), 2490);      // EU: 83 km -> EUR 24.90
  assert.equal(M.mileageAmount(3, 0.125, "EUR"), 38);        // 0.375 -> 38 minor, half-up
});

test("per-currency grouping never mixes currencies", () => {
  const rows = [
    { currency: "EUR", amount_minor: 1000, vat_rate: 0 },
    { currency: "EUR", amount_minor: 2460, vat_rate: 23 },
    { currency: "PLN", amount_minor: 12300, vat_rate: 23 },
    { currency: "JPY", amount_minor: 5000, vat_rate: 10 },
  ];
  const totals = {};
  for (const r of rows) {
    const s = M.vatSplit(r.amount_minor, r.vat_rate);
    const t = (totals[r.currency] ??= { gross: 0, net: 0, vat: 0 });
    t.gross += s.gross_minor; t.net += s.net_minor; t.vat += s.vat_minor;
  }
  assert.deepEqual(Object.keys(totals).sort(), ["EUR", "JPY", "PLN"]);
  assert.equal(M.formatMoney(totals.EUR.gross, "EUR"), "EUR 34.60");
  assert.equal(M.formatMoney(totals.EUR.vat, "EUR"), "EUR 4.60");
  assert.equal(M.formatMoney(totals.PLN.net, "PLN"), "PLN 100.00");
  assert.equal(M.formatMoney(totals.JPY.gross, "JPY"), "JPY 5000");
  assert.equal(totals.JPY.net + totals.JPY.vat, 5000);
});

test("toMajor gives a spreadsheet-safe number", () => {
  assert.equal(M.toMajor(1234, "EUR"), 12.34);
  assert.equal(M.toMajor(5, "EUR"), 0.05);
  assert.equal(M.toMajor(1080, "JPY"), 1080);
});

test("date helpers accept only real calendar dates", () => {
  assert.equal(M.isIsoDate("2026-02-28"), true);
  assert.equal(M.isIsoDate("2026-02-30"), false);
  assert.equal(M.isIsoDate("2026-13-01"), false);
  assert.equal(M.isIsoDate("26-01-01"), false);
  assert.equal(M.isIsoDate(M.isoToday()), true);
  assert.equal(M.isIsoDate(M.isoDaysAgo(30)), true);
  assert.ok(M.isoDaysAgo(30) < M.isoToday());
});
