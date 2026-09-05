// What a wrong, hostile or impossible input does. Every case here is a refusal that
// names the problem and writes nothing, or a defensible answer stated in words.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, cleanup, proKey, storeDir, WORKED } from "./_client.mjs";
import {
  buildSchedule, repayEarly, scheduleIsExact, validateTerms, effectiveAnnualRate, periodicRate,
} from "../dist/lib.js";

function open(t, opts = {}) {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

const terms = (over = {}) => ({
  principal_minor: 1000000, currency: "EUR", rate_bps: 1200, compounding: "monthly",
  payment_frequency: "monthly", term_periods: 12, method: "annuity",
  start_date: "2026-01-15", fees_minor: 0, balloon_minor: 0, ...over,
});

test("a term of zero periods is refused, in the engine and at the tool", async (t) => {
  assert.throws(() => validateTerms(terms({ term_periods: 0 })), /term must be at least 1 period/);
  const { c } = open(t);
  await c.init();
  const r = await c.call("loan_create", { ...WORKED, term_periods: 0 });
  assert.equal(r.isError, true);
  const { c: c2 } = open(t);
  await c2.init();
  assert.equal((await c2.json("loan_list", {})).count, 0, "nothing was written");
});

test("a negative or zero principal is refused and never stored", async (t) => {
  assert.throws(() => validateTerms(terms({ principal_minor: -1 })), /principal must be a whole number of minor units above zero/);
  assert.throws(() => validateTerms(terms({ principal_minor: 0 })), /above zero/);
  assert.throws(() => validateTerms(terms({ principal_minor: 100.5 })), /whole number/);
  const { box, c } = open(t);
  await c.init();
  assert.equal((await c.call("loan_create", { ...WORKED, principal_minor: -1000 })).isError, true);
  assert.equal((await c.json("loan_list", {})).count, 0);
  assert.equal(existsSync(join(storeDir(box.dataHome), "loans.json")), false, "no register file was even created");
});

test("a rate over 100 percent is a real rate, not an error, and it is charged as one", async (t) => {
  // 12,000 basis points is 120 percent nominal, compounded monthly: 10 percent a month.
  // Its effective annual rate is 1.1^12 - 1 = 213.84 percent, and that gap is the point.
  const { c } = open(t);
  await c.init();
  const r = await c.json("loan_create", { ...WORKED, rate_bps: 12000, name: "Payday" });
  assert.equal(r.created.effective_annual_rate_pct, "213.84");
  assert.equal(r.periodic_rate_pct, "10.000000");
  const s = await c.json("loan_schedule", { loan: r.created.id });
  assert.equal(s.rows[0].interest_minor, 100000);
  assert.equal(s.rows[11].closing_minor, 0);
  assert.ok(s.total_interest_minor > 0);
  // And the ceiling above it still refuses: 1,000,001 basis points is a typo, not a loan.
  assert.equal((await c.call("loan_create", { ...WORKED, rate_bps: 100000000 })).isError, true);
});

test("a balloon that is the whole principal, and fees that are the whole principal, are refused", async (t) => {
  assert.throws(() => validateTerms(terms({ balloon_minor: 1000000 })), /balloon 1000000 is not less than the principal/);
  assert.throws(() => validateTerms(terms({ fees_minor: 1000000 })), /fees 1000000 are not less than the principal/);
  const { c } = open(t);
  await c.init();
  const r = await c.call("loan_create", { ...WORKED, balloon_minor: 1000000 });
  assert.equal(r.isError, true);
  assert.match(r.text, /amortises nothing/);
});

test("repaying after the end of the loan is refused by name", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const made = await c.json("loan_create", WORKED);
  const r = await c.call("loan_repay_early", { loan: made.created.id, as_of_period: 13 });
  assert.equal(r.isError, true);
  assert.match(r.text, /past the end of a 12 period loan/);
  // The last period is allowed: settling at period 12 owes nothing and saves nothing.
  const last = await c.json("loan_repay_early", { loan: made.created.id, as_of_period: 12 });
  assert.equal(last.outstanding_minor, 0);
  assert.equal(last.interest_saved_minor, 0);
  assert.equal(last.periods_cancelled, 0);
});

test("a date that is not a date, and a month that is not a month, are refused", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  for (const bad of ["2026-02-30", "yesterday", "15-01-2026", ""]) {
    const r = await c.call("loan_create", { ...WORKED, start_date: bad });
    assert.equal(r.isError, true, `start_date ${JSON.stringify(bad)} was accepted`);
  }
  const made = await c.json("loan_create", WORKED);
  const m = await c.call("loan_journal", { loan: made.created.id, month: "2026-13" });
  assert.equal(m.isError, true);
  assert.match(m.text, /is not a month in YYYY-MM form/);
});

test("a journal asked for both a period and a month, or for neither, is refused", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  const made = await c.json("loan_create", WORKED);
  for (const args of [{}, { period: 1, month: "2026-02" }]) {
    const r = await c.call("loan_journal", { loan: made.created.id, ...args });
    assert.equal(r.isError, true);
    assert.match(r.text, /exactly one of period or month/);
  }
});

test("an unreadable register is never read as an empty one", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  await c.init();
  await c.call("loan_create", WORKED);
  c.close();
  const file = join(storeDir(box.dataHome), "loans.json");
  writeFileSync(file, "{ this is not json");
  const c2 = client({ dataHome: box.dataHome, key: proKey() });
  t.after(() => c2.close());
  await c2.init();
  for (const [tool, args] of [["loan_list", {}], ["loan_schedule", { loan: "LOAN-2026-0001" }], ["loans_report", {}]]) {
    const r = await c2.call(tool, args);
    assert.equal(r.isError, true, `${tool} answered over a corrupt register`);
  }
  const quarantined = readdirSync(storeDir(box.dataHome)).filter((f) => f.includes("corrupt"));
  assert.ok(quarantined.length >= 1, `nothing was quarantined: ${quarantined.join(", ")}`);
  assert.equal(readFileSync(join(storeDir(box.dataHome), quarantined.find((f) => !f.endsWith(".corrupt"))), "utf8"), "{ this is not json",
    "the corrupt bytes are kept verbatim");
});

test("the free tier holds three loans, and every schedule stays free", async (t) => {
  const { c } = open(t);
  await c.init();
  for (let n = 1; n <= 3; n++) {
    const r = await c.call("loan_create", { ...WORKED, name: `Loan ${n}` });
    assert.equal(r.isError, false, `loan ${n} was refused`);
  }
  const fourth = await c.call("loan_create", { ...WORKED, name: "Loan 4" });
  assert.equal(fourth.isError, true);
  assert.match(fourth.text, /the free tier holds 3 loans/);
  assert.match(fourth.text, /Pro is a one-time \$\d+ for this server/);
  assert.equal((await c.json("loan_list", {})).count, 3, "the refused loan was not written");
  // Schedules are never metered: three loans, six schedule calls, no refusal.
  for (const id of ["LOAN-2026-0001", "LOAN-2026-0002", "LOAN-2026-0003"]) {
    assert.equal((await c.call("loan_schedule", { loan: id })).isError, false);
    assert.equal((await c.call("loan_schedule", { loan: id })).isError, false);
  }
});

test("a Pro key signed for another product unlocks nothing here", async (t) => {
  const { c } = open(t, { key: proKey("deposits") });
  await c.init();
  await c.call("loan_create", WORKED);
  const r = await c.call("loans_report", {});
  assert.equal(r.isError, true);
  assert.match(r.text, /loans_report is Pro/);
});

test("an ambiguous name is refused with the candidates rather than resolved to the first", async (t) => {
  const { c } = open(t);
  await c.init();
  await c.call("loan_create", { ...WORKED, name: "Van finance A" });
  await c.call("loan_create", { ...WORKED, name: "Van finance B" });
  const r = await c.call("loan_schedule", { loan: "Van finance" });
  assert.equal(r.isError, true);
  assert.match(r.text, /matches more than one loan/);
  assert.match(r.text, /LOAN-2026-0001/);
  assert.equal((await c.call("loan_schedule", { loan: "Van finance A" })).isError, false);
});

test("a loan that does not exist is refused and never invented", async (t) => {
  const { c } = open(t);
  await c.init();
  const r = await c.call("loan_schedule", { loan: "LOAN-1999-0001" });
  assert.equal(r.isError, true);
  assert.match(r.text, /no loan matches "LOAN-1999-0001"/);
});

test("every schedule the engine can build closes exactly on its balloon", () => {
  // A sweep, not an example: 6 rates x 5 terms x 2 methods x 3 balloons x 4 frequencies.
  let built = 0;
  for (const rate_bps of [0, 1, 250, 1200, 4999, 12000]) {
    for (const term_periods of [1, 2, 7, 60, 360]) {
      for (const method of ["annuity", "straight-principal"]) {
        for (const balloon_minor of [0, 1, 333333]) {
          for (const payment_frequency of ["weekly", "monthly", "quarterly", "annual"]) {
            const t = terms({ rate_bps, term_periods, method, balloon_minor, payment_frequency });
            const s = buildSchedule(t);
            built++;
            assert.equal(scheduleIsExact(t, s), true,
              `${method} ${rate_bps}bps x${term_periods} ${payment_frequency} balloon ${balloon_minor} does not close`);
            assert.ok(s.rows.length >= 1 && s.rows.length <= term_periods, `${s.rows.length} rows for a ${term_periods} period term`);
            assert.ok(s.rows.every((r) => r.interest_minor >= 0), "an interest charge is never negative");
          }
        }
      }
    }
  }
  assert.equal(built, 6 * 5 * 2 * 3 * 4);
});

test("an early settlement of every period of every schedule reconciles with the schedule itself", () => {
  const t = terms();
  const s = buildSchedule(t);
  for (let p = 1; p <= 12; p++) {
    const r = repayEarly(t, s, p, { penalty_minor: 0 });
    assert.equal(r.interest_paid_minor + r.interest_saved_minor, s.total_interest_minor, `period ${p}`);
    assert.equal(r.outstanding_minor, s.rows[p - 1].closing_minor);
  }
  assert.throws(() => repayEarly(t, s, 0), /as_of_period must be a whole period of 1 or more/);
  assert.throws(() => repayEarly(t, s, 3, { penalty_minor: -1 }), /penalty must be a whole number/);
});

test("the rate arithmetic on the edges", () => {
  assert.equal(effectiveAnnualRate(0, "monthly"), 0);
  assert.equal(periodicRate(0, "monthly", "annual"), 0);
  // Compounding and payment on the same clock is a plain division, with no float detour.
  assert.equal(periodicRate(1200, "monthly", "monthly"), 0.01);
  // Annual compounding, monthly payments: the twelfth root, not a twelfth.
  const m = periodicRate(1200, "annual", "monthly");
  assert.ok(m < 0.01, `monthly equivalent of an annual 12 percent must be under 1 percent, got ${m}`);
  assert.equal(Math.round(Math.pow(1 + m, 12) * 1e10), Math.round(1.12 * 1e10));
});
