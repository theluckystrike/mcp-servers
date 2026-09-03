import test from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = (f) => join(here, "..", "dist", f);
const { convertAmount } = await import(dist("rates.js"));
const { crossRate, exactCrossRate } = await import(dist("money.js"));

/* Rates per 1 EUR, the only shape the ECB publishes. VND and KWD are the pair that breaks a
   6-decimal cross rate: the true rate is 0.0000116666..., which rounds to 0.000012. */
const RATES = { USD: 1.0812, PLN: 4.2673, VND: 30000, KWD: 0.35, JPY: 172.53 };

test("convert at full precision: 1,000,000 VND is KWD 11.667, not KWD 12.000", () => {
  const c = convertAmount(RATES, 1_000_000, "VND", "KWD");
  assert.equal(c.result, "KWD 11.667");
  assert.equal(c.result_minor, 11667, "3 minor units: KWD is a 3-decimal currency");
  assert.equal(c.result_number, 11.667);
  // The displayed rate is reported separately and is NOT the multiplier.
  assert.equal(c.rate, 0.000012, "6-decimal display rate");
  assert.equal(c.rate_exact, 0.35 / 30000, "the multiplier is the unrounded ratio");
  assert.equal(
    Math.round(1_000_000 * c.rate * 1000),
    12000,
    "computing from the displayed rate gives KWD 12.000 - which is why it is display only",
  );
});

test("the displayed rate is the exact rate rounded to 6 decimals, and is reported separately", () => {
  const c = convertAmount(RATES, 100, "USD", "PLN");
  assert.equal(c.rate_exact, exactCrossRate(RATES.USD, RATES.PLN));
  assert.equal(c.rate, crossRate(RATES.USD, RATES.PLN));
  assert.equal(c.rate, Number(c.rate_exact.toFixed(6)));
  assert.notEqual(c.rate, c.rate_exact);
});

test("EUR -> USD -> PLN equals EUR -> PLN directly", () => {
  const direct = convertAmount(RATES, 100, "EUR", "PLN");
  const leg1 = convertAmount(RATES, 100, "EUR", "USD");
  const leg2 = convertAmount(RATES, leg1.result_number, "USD", "PLN");
  assert.equal(leg1.result, "USD 108.12");
  assert.equal(direct.result, "PLN 426.73");
  assert.equal(leg2.result, direct.result, "the chain and the direct conversion agree to the minor unit");
  assert.equal(leg2.result_minor, direct.result_minor);
  // The rates themselves compose exactly, because none of them was rounded first.
  assert.ok(
    Math.abs(leg1.rate_exact * leg2.rate_exact - direct.rate_exact) < 1e-12,
    "rate(EUR,USD) * rate(USD,PLN) == rate(EUR,PLN)",
  );
});

test("a chain through a rounding-hostile leg still lands on the direct answer", () => {
  // EUR -> VND -> KWD. The VND leg is 30000 per EUR, the KWD leg 0.35: the 6-decimal cross
  // rate VND/KWD is wrong by 2.9%, so this only holds if every leg is exact.
  const direct = convertAmount(RATES, 1000, "EUR", "KWD");
  const leg1 = convertAmount(RATES, 1000, "EUR", "VND");
  const leg2 = convertAmount(RATES, leg1.result_number, "VND", "KWD");
  assert.equal(leg1.result, "VND 30000000");
  assert.equal(direct.result, "KWD 350.000");
  assert.equal(leg2.result, direct.result);
});

test("zero-decimal targets still round once, at the end", () => {
  const c = convertAmount(RATES, 12.34, "USD", "JPY");
  assert.equal(c.result, `JPY ${Math.round(12.34 * (172.53 / 1.0812))}`);
  assert.equal(c.rate_exact, 172.53 / 1.0812);
});
