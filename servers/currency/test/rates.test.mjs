import test from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = (f) => join(here, "..", "dist", f);
const { parseEcbXml, assertComplete } = await import(dist("ecb.js"));
const { convertAmount, resolveDate, series, stats, perEur, codesOf } = await import(dist("rates.js"));
const { currencyDecimals, formatMoney, crossRate } = await import(dist("money.js"));

/* The ECB daily file, byte-shaped as the real one: gesmes envelope, single quotes,
   one outer Cube, one dated Cube, one self-closing Cube per currency. */
const DAILY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
<gesmes:subject>Reference rates</gesmes:subject>
<gesmes:Sender><gesmes:name>European Central Bank</gesmes:name></gesmes:Sender>
<Cube><Cube time='2026-09-02'>
<Cube currency='USD' rate='1.0812'/>
<Cube currency='JPY' rate='172.53'/>
<Cube currency='GBP' rate='0.85023'/>
<Cube currency='PLN' rate='4.2650'/>
<Cube currency='CHF' rate='0.9385'/>
</Cube></Cube>
</gesmes:Envelope>`;

/* The historical file: newest first, and a currency that was not quoted on a day
   carries rate='N/A', which must be dropped rather than parsed as NaN.
   2026-08-29 and 2026-08-30 are a Saturday and a Sunday: the ECB publishes nothing. */
const HIST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
<Cube>
<Cube time='2026-09-02'><Cube currency='USD' rate='1.0812'/><Cube currency='PLN' rate='4.2650'/><Cube currency='ROL' rate='N/A'/></Cube>
<Cube time='2026-09-01'><Cube currency='USD' rate='1.0790'/><Cube currency='PLN' rate='4.2710'/></Cube>
<Cube time='2026-08-31'><Cube currency='USD' rate='1.0755'/><Cube currency='PLN' rate='4.2800'/></Cube>
<Cube time='2026-08-28'><Cube currency='USD' rate='1.0731'/><Cube currency='PLN' rate='4.2890'/></Cube>
</Cube>
</gesmes:Envelope>`;

const daily = parseEcbXml(DAILY_XML);
const hist = parseEcbXml(HIST_XML);
const RATES = daily[0].rates;
const DAYS = Object.fromEntries(hist.map((d) => [d.date, d.rates]));

test("parse: the daily file yields one dated block with every quoted currency", () => {
  assert.equal(daily.length, 1);
  assert.equal(daily[0].date, "2026-09-02");
  assert.deepEqual(Object.keys(RATES).sort(), ["CHF", "GBP", "JPY", "PLN", "USD"]);
  assert.equal(RATES.USD, 1.0812);
  assert.equal(perEur(RATES, "EUR"), 1, "EUR is never in the file; it is 1 by definition");
  assert.equal(perEur(RATES, "XXX"), undefined);
  assert.equal(codesOf(RATES).length, 6);
});

test("parse: the history file yields one block per business day and drops N/A", () => {
  assert.equal(hist.length, 4);
  assert.deepEqual(hist.map((d) => d.date), ["2026-09-02", "2026-09-01", "2026-08-31", "2026-08-28"]);
  assert.equal(hist[0].rates.ROL, undefined, "rate='N/A' must not become NaN");
  assert.equal(hist[3].rates.USD, 1.0731);
});

test("parse: a truncated download is an error, not an empty rate set", () => {
  assert.throws(() => parseEcbXml("<html>maintenance</html>"), /no dated rate block/);
});

test("cross rate USD -> PLN: displayed to 6 decimals, computed at full precision", () => {
  // 4.2650 PLN per EUR / 1.0812 USD per EUR = 3.944691 PLN per USD
  assert.equal(crossRate(RATES.USD, RATES.PLN), 3.944691);
  const c = convertAmount(RATES, 100, "USD", "PLN");
  assert.equal(c.rate, 3.944691, "display value");
  assert.equal(c.rate_exact, RATES.PLN / RATES.USD, "multiplier");
  assert.equal(c.result_minor, 39447, "394.4691 rounds half-up to 394.47");
  assert.equal(c.result, "PLN 394.47");
  assert.equal(c.result_number, 394.47);
});

test("the printed rate is close enough to reproduce the printed result for a near-1 pair", () => {
  const c = convertAmount(RATES, 100, "USD", "PLN");
  assert.equal(Math.round(c.amount * c.rate * 100) / 100, c.result_number);
  assert.equal(Math.round(c.amount * c.rate_exact * 100) / 100, c.result_number);
});

test("the euro leg is an identity, in both directions", () => {
  assert.equal(convertAmount(RATES, 250, "EUR", "EUR").rate, 1);
  assert.equal(convertAmount(RATES, 250, "EUR", "EUR").result, "EUR 250.00");
  assert.equal(convertAmount(RATES, 1, "EUR", "USD").rate, 1.0812);
  assert.equal(convertAmount(RATES, 1, "USD", "EUR").rate, 0.924898);
});

test("JPY is rounded to zero decimals, not two", () => {
  assert.equal(currencyDecimals("JPY"), 0);
  const c = convertAmount(RATES, 10, "EUR", "JPY");
  assert.equal(c.rate, 172.53);
  assert.equal(c.result_minor, 1725, "1725.3 rounds to 1725 whole yen");
  assert.equal(c.result, "JPY 1725");
  assert.equal(formatMoney(1725, "JPY"), "JPY 1725");
  // half-up at the boundary, not banker's rounding
  assert.equal(convertAmount(RATES, 10.0029, "EUR", "JPY").result_minor, 1726);
});

test("an unknown code names the set instead of guessing", () => {
  const c = convertAmount(RATES, 10, "USD", "XYZ");
  assert.match(c.error, /"XYZ" is not in the ECB reference set/);
  assert.match(c.error, /CHF, EUR, GBP, JPY, PLN, USD/);
});

test("nearest previous business day: a Sunday takes Friday's rate", () => {
  const r = resolveDate(DAYS, "2026-08-30");
  assert.equal(r.date, "2026-08-28", "Sat 29 and Sun 30 have no rate; Fri 28 is the last published one");
  assert.equal(r.exact, false);
  assert.equal(r.asked, "2026-08-30");
  assert.equal(r.rates.USD, 1.0731);
});

test("nearest previous business day: an exact hit is exact", () => {
  const r = resolveDate(DAYS, "2026-09-01");
  assert.equal(r.date, "2026-09-01");
  assert.equal(r.exact, true);
});

test("a date before the first published rate is refused, not extrapolated", () => {
  // DAYS is a four-row fixture, so the honest answer names the cache's own earliest date,
  // not 1999-01-04 (see A-C3): claiming 1999 over a partial cache contradicts itself.
  const r = resolveDate(DAYS, "1998-12-31");
  assert.match(r.error, /earliest rate in the local cache \(2026-08-28\)/);
  assert.match(r.error, /cache is incomplete/);
});

test("series and stats over a window", () => {
  const pts = series(DAYS, "USD", "PLN", "2026-08-28", "2026-09-02");
  assert.equal(pts.length, 4);
  assert.deepEqual(pts.map((p) => p.date), ["2026-08-28", "2026-08-31", "2026-09-01", "2026-09-02"]);
  const s = stats(pts);
  assert.equal(s.first.date, "2026-08-28");
  assert.equal(s.last.date, "2026-09-02");
  assert.equal(s.min.rate <= s.avg && s.avg <= s.max.rate, true);
  assert.equal(s.max.rate, Math.max(...pts.map((p) => p.rate)));
  const expected = Number((((s.last.rate - s.first.rate) / s.first.rate) * 100).toFixed(2));
  assert.equal(s.change_pct, expected);
});

test("a window with no published day is an error, not an empty table", () => {
  const r = series(DAYS, "USD", "PLN", "2026-08-29", "2026-08-30");
  assert.match(r.error, /no ECB rate for USD\/PLN/);
});

/* ------------------------------------------- audit regressions (docs/CURRENCY_AUDIT.md) */

test("A-C1: an amount too large to hold in minor units is refused, never formatted as Infinity", () => {
  const rates = { USD: 1.0812, JPY: 172.53 };
  const big = convertAmount(rates, 1e308, "EUR", "JPY");
  assert.ok("error" in big, "1e308 must not produce a Conversion");
  assert.match(big.error, /too large to convert exactly/);
  // the boundary still converts
  const ok = convertAmount(rates, 1000000, "EUR", "JPY");
  assert.equal("error" in ok, false);
  assert.equal(Number.isFinite(ok.result_number), true);
  assert.doesNotMatch(ok.result, /Infinity|NaN/);
});

test("A-C2: assertComplete rejects a body with no closing Envelope tag", () => {
  const head = `<?xml version="1.0"?><gesmes:Envelope><Cube>`;
  const body = head + `<Cube time='2026-09-02'><Cube currency='USD' rate='1.08'/></Cube>`;
  assert.throws(() => assertComplete(body), /truncated in transit/);
  assert.doesNotThrow(() => assertComplete(body + `</Cube></gesmes:Envelope>`));
  assert.doesNotThrow(() => assertComplete(body + `</Cube></Envelope>\n`));
  // a truncated body still parses, which is exactly why the tag has to be checked
  assert.equal(parseEcbXml(body).length, 1);
});

test("A-C3: resolveDate does not claim 1999 as the start of an incomplete cache", () => {
  const partial = { "2026-09-01": { USD: 1.08 }, "2026-09-02": { USD: 1.09 } };
  const r = resolveDate(partial, "2026-08-04");
  assert.ok("error" in r);
  assert.match(r.error, /earliest rate in the local cache \(2026-09-01\)/);
  assert.match(r.error, /cache is incomplete/);
  const full = { "1999-01-04": { USD: 1.17 }, "2026-09-02": { USD: 1.09 } };
  const r2 = resolveDate(full, "1998-06-01");
  assert.ok("error" in r2);
  assert.match(r2.error, /The series starts on 1999-01-04/);
  assert.doesNotMatch(r2.error, /cache is incomplete/);
});
