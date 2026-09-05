// The worked examples, every figure recomputed by hand and asserted to the minor unit.
//
// The reference loan: 1,000,000 minor units, nominal 12 percent a year compounded
// monthly, paid monthly, 12 periods, annuity, drawn 2026-01-15.
//   i = 0.12 / 12 = 0.01 exactly.
//   payment = 1,000,000 * 0.01 / (1 - 1.01^-12) = 10,000 / 0.112550770583 = 88,848.79
//           = 88,849 minor units, rounded once.
//   total paid   = 12 * 88,849 = 1,066,188
//   total interest = 1,066,188 - 1,000,000 = 66,188
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, sandbox, cleanup, proKey, WORKED } from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

async function withLoan(t, extra = {}, opts = {}) {
  const { box, c } = open(t, opts);
  await c.init();
  const created = await c.json("loan_create", { ...WORKED, ...extra });
  assert.ok(created.created, JSON.stringify(created).slice(0, 400));
  return { box, c, created, id: created.created.id };
}

test("the 12-month annuity: payment 88,849 and total interest 66,188", async (t) => {
  const { c, created, id } = await withLoan(t);
  assert.equal(created.created.payment_minor, 88849);
  assert.equal(created.total_interest_minor, 66188);
  assert.equal(created.total_payments_minor, 1066188);
  assert.equal(created.created.id, "LOAN-2026-0001");
  assert.equal(created.first_payment_date, "2026-02-15");
  assert.equal(created.final_payment_date, "2027-01-15");

  const s = await c.json("loan_schedule", { loan: id });
  assert.equal(s.rows.length, 12);
  assert.equal(s.total_interest_minor, 66188);
  assert.equal(s.closing_balance_minor, 0);
  // Period 1, by hand: interest = round(1,000,000 * 0.01) = 10,000; principal = 78,849.
  assert.deepEqual(
    [s.rows[0].opening_minor, s.rows[0].payment_minor, s.rows[0].interest_minor, s.rows[0].principal_minor, s.rows[0].closing_minor],
    [1000000, 88849, 10000, 78849, 921151],
  );
  // Period 2: interest = round(921,151 * 0.01) = 9,212 (9,211.51 rounds up).
  assert.deepEqual(
    [s.rows[1].opening_minor, s.rows[1].interest_minor, s.rows[1].principal_minor, s.rows[1].closing_minor],
    [921151, 9212, 79637, 841514],
  );
  // Period 12 absorbs the residual: the balance left is 87,967, so the principal is
  // exactly that and the interest is the rest of the SAME level payment, 882, rather
  // than the 880 an unrounded balance would carry. The payment does not move.
  const last = s.rows[11];
  assert.deepEqual(
    [last.opening_minor, last.payment_minor, last.principal_minor, last.interest_minor, last.closing_minor],
    [87967, 88849, 87967, 882, 0],
  );
  // Every row is internally consistent and the chain closes.
  let bal = 1000000;
  let interest = 0;
  for (const r of s.rows) {
    assert.equal(r.opening_minor, bal, `period ${r.period} opening`);
    assert.equal(r.payment_minor, r.interest_minor + r.principal_minor, `period ${r.period} split`);
    assert.equal(r.closing_minor, r.opening_minor - r.principal_minor, `period ${r.period} closing`);
    bal = r.closing_minor;
    interest += r.interest_minor;
  }
  assert.equal(bal, 0);
  assert.equal(interest, 66188);
});

test("a nominal 12 percent compounded monthly is an effective 12.68 percent", async (t) => {
  const { created } = await withLoan(t);
  // (1 + 0.12/12)^12 - 1 = 1.01^12 - 1 = 0.1268250301...
  assert.equal(created.created.effective_annual_rate_bps, 1268);
  assert.equal(created.created.effective_annual_rate_pct, "12.68");
  assert.equal(created.created.nominal_annual_rate_pct, "12.00");
  assert.equal(created.periodic_rate_pct, "1.000000");
});

test("straight principal: equal principal, a falling payment, 65,000 of interest", async (t) => {
  // 1,000,000 over 12 gives 83,333 a period with the residual in the last, and the
  // interest is 1 percent of each opening balance:
  // 10,000 + 9,167 + 8,333 + 7,500 + 6,667 + 5,833 + 5,000 + 4,167 + 3,333 + 2,500
  //  + 1,667 + 833 = 65,000.
  const { c, created, id } = await withLoan(t, { method: "straight-principal", name: "Straight" });
  assert.equal(created.total_interest_minor, 65000);
  const s = await c.json("loan_schedule", { loan: id });
  assert.deepEqual(s.rows.map((r) => r.interest_minor), [10000, 9167, 8333, 7500, 6667, 5833, 5000, 4167, 3333, 2500, 1667, 833]);
  assert.deepEqual([s.rows[0].payment_minor, s.rows[0].principal_minor], [93333, 83333]);
  assert.deepEqual([s.rows[11].payment_minor, s.rows[11].principal_minor, s.rows[11].closing_minor], [84166, 83333, 0]);
  assert.equal(s.rows.reduce((a, r) => a + r.principal_minor, 0), 1000000);
  // The falling payment is the whole point of the method: the first costs 9,167 more
  // than the last, and an annuity on the same terms charges 1,188 more interest.
  assert.equal(s.rows[0].payment_minor - s.rows[11].payment_minor, 9167);
  assert.equal(66188 - s.total_interest_minor, 1188);
});

test("a balloon: the closing balance reaches the balloon exactly and is not inside the last payment", async (t) => {
  // payment = (1,000,000 - 400,000 * 1.01^-12) * 0.01 / (1 - 1.01^-12)
  //         = (1,000,000 - 354,979.69) * 0.01 / 0.112550770583 = 57,309.1 -> 57,309
  const { c, created, id } = await withLoan(t, { balloon_minor: 400000, name: "Balloon" });
  assert.equal(created.created.payment_minor, 57309);
  const s = await c.json("loan_schedule", { loan: id });
  assert.equal(s.rows[11].closing_minor, 400000);
  assert.equal(s.rows.reduce((a, r) => a + r.principal_minor, 0), 600000);
  assert.equal(s.total_interest_minor, 87708);
  assert.equal(s.total_payments_minor, 687708);
  // 600,000 of principal + 87,708 of interest = 687,708 of payments, and the 400,000
  // balloon is on top of the last row, never inside it.
  assert.equal(s.total_payments_minor, 600000 + s.total_interest_minor);
  assert.ok(s.notes.some((n) => n.includes("400000") && n.includes("NOT inside it")), JSON.stringify(s.notes));
});

test("a zero-rate loan is 12 equal payments and no interest at all", async (t) => {
  const { c, created, id } = await withLoan(t, { rate_bps: 0, name: "Interest free" });
  assert.equal(created.created.payment_minor, 83333);
  assert.equal(created.total_interest_minor, 0);
  assert.equal(created.created.effective_annual_rate_bps, 0);
  const s = await c.json("loan_schedule", { loan: id });
  assert.equal(s.rows.every((r) => r.interest_minor === 0), true);
  assert.equal(s.rows[11].payment_minor, 83337, "the last payment carries the 4 minor units 83,333 x 12 leaves short");
  assert.equal(s.rows.reduce((a, r) => a + r.payment_minor, 0), 1000000);
});

test("quarterly payments on a monthly-compounded loan use the equivalent rate, not the nominal one over four", async (t) => {
  // (1 + 0.12/12)^3 - 1 = 1.030301 - 1 = 3.0301 percent a quarter, not 3.0000 percent.
  const { c, created, id } = await withLoan(t, { payment_frequency: "quarterly", term_periods: 4, name: "Quarterly" });
  assert.equal(created.periodic_rate_pct, "3.030100");
  assert.equal(created.created.payment_minor, 269221);
  const s = await c.json("loan_schedule", { loan: id });
  assert.equal(s.rows[0].interest_minor, 30301);
  assert.equal(s.rows[3].closing_minor, 0);
  assert.deepEqual(s.rows.map((r) => r.date), ["2026-04-15", "2026-07-15", "2026-10-15", "2027-01-15"]);
  assert.ok(created.notes.some((n) => n.includes("equivalent rate")), JSON.stringify(created.notes));
});

test("early settlement: what is owed, what the penalty costs and what the interest saving is", async (t) => {
  const { c, id } = await withLoan(t, {}, { key: proKey() });
  // Settle at the end of period 6: the closing balance is 514,920. The interest already
  // charged in periods 1 to 6 is
  //   10,000 + 9,212 + 8,415 + 7,611 + 6,798 + 5,978 = 48,014,
  // so the interest still to come, and therefore saved, is 66,188 - 48,014 = 18,174
  // (5,149 + 4,312 + 3,467 + 2,613 + 1,751 + 882).
  const r = await c.json("loan_repay_early", { loan: id, as_of_period: 6, penalty_minor: 5000 });
  assert.equal(r.outstanding_minor, 514920);
  assert.equal(r.interest_paid_minor, 48014);
  assert.equal(r.interest_saved_minor, 66188 - 48014);
  assert.equal(r.interest_saved_minor, 18174);
  assert.equal(r.settlement, "in full");
  assert.equal(r.pay_now_minor, 519920);
  assert.equal(r.interest_saved_net_minor, 13174);
  assert.equal(r.worth_doing, true);
  assert.equal(r.periods_cancelled, 6);
  assert.deepEqual(r.remaining_schedule, []);

  // A penalty larger than the saving turns the whole exercise into a loss, and the
  // verdict says so rather than reporting a positive "saving".
  const bad = await c.json("loan_repay_early", { loan: id, as_of_period: 11, penalty_minor: 5000 });
  assert.equal(bad.interest_saved_minor, 882);
  assert.equal(bad.interest_saved_net_minor, -4118);
  assert.equal(bad.worth_doing, false);
  assert.match(bad.verdict, /COSTS/);
});

test("a partial overpayment re-amortises the rest and the saving is the difference in interest", async (t) => {
  const { c, id } = await withLoan(t, {}, { key: proKey() });
  const r = await c.json("loan_repay_early", { loan: id, as_of_period: 6, extra_minor: 200000 });
  assert.equal(r.settlement, "partial overpayment");
  assert.equal(r.outstanding_minor, 514920);
  assert.equal(r.pay_now_minor, 200000);
  assert.equal(r.new_term_periods, 6);
  assert.equal(r.remaining_schedule.length, 6);
  assert.equal(r.remaining_schedule[0].opening_minor, 314920);
  assert.equal(r.remaining_schedule[5].closing_minor, 0);
  assert.equal(r.remaining_schedule[0].period, 7);
  assert.ok(r.new_payment_minor < 88849, `the payment should fall, got ${r.new_payment_minor}`);
  const newInterest = r.remaining_schedule.reduce((a, x) => a + x.interest_minor, 0);
  assert.equal(r.interest_saved_minor, 18174 - newInterest);
  assert.equal(newInterest, 11114);

  // keep_payment holds the payment and shortens the term instead.
  const k = await c.json("loan_repay_early", { loan: id, as_of_period: 6, extra_minor: 200000, keep_payment: true });
  assert.ok(k.new_term_periods < 6, `the term should shorten, got ${k.new_term_periods}`);
  assert.equal(k.remaining_schedule[0].payment_minor, 88849, "the level payment is held");
  const kLast = k.remaining_schedule[k.remaining_schedule.length - 1];
  assert.ok(kLast.payment_minor < 88849, `the last payment is short, got ${kLast.payment_minor}`);
  assert.equal(kLast.closing_minor, 0);
  assert.equal(k.new_term_periods, 4, "the balance clears in 4 periods at the old payment, not 6");
  assert.equal(kLast.payment_minor, 55793);
  assert.equal(k.interest_saved_minor, 18174 - 7420);
  assert.ok(k.interest_saved_minor > r.interest_saved_minor,
    "holding the payment saves more interest than lowering it, because the balance clears sooner");
});

test("the journal debits interest and liability, credits cash, and the expense payload carries the interest alone", async (t) => {
  const { c, id } = await withLoan(t, { lender: "Nordbank" }, { key: proKey() });
  const j = await c.json("loan_journal", { loan: id, period: 1 });
  assert.deepEqual(j.lines.map((l) => [l.account, l.debit_minor, l.credit_minor]), [
    ["interest_expense", 10000, 0],
    ["loan_liability", 78849, 0],
    ["cash", 0, 88849],
  ]);
  assert.deepEqual(j.lines.map((l) => l.account_name), ["Interest expense", "Loan liability", "Cash"]);
  assert.equal(j.totals.balanced, true);
  assert.equal(j.totals.debits_minor, 88849);
  assert.equal(j.date, "2026-02-15");
  // Only the interest is an expense: 100.00, not the 888.49 that left the bank.
  assert.equal(j.expense_add.arguments.amount, 100);
  assert.equal(j.expense_add.arguments.currency, "EUR");
  assert.equal(j.expense_add.arguments.category, "interest");
  assert.equal(j.expense_add.arguments.merchant, "Nordbank");
  assert.equal(j.expense_add.tool, "expense_add");

  // By month is the same entry, found by date rather than by period number.
  const m = await c.json("loan_journal", { loan: id, month: "2026-02" });
  assert.deepEqual(m.periods, [1]);
  assert.equal(m.lines[0].debit_minor, 10000);
  // A month with no payment is refused rather than answered with a zero journal.
  const none = await c.call("loan_journal", { loan: id, month: "2026-01" });
  assert.equal(none.isError, true);
  assert.match(none.text, /no payment on LOAN-2026-0001 falls in 2026-01/);
});

test("the list and the report: outstanding, next payment date and the interest for the year", async (t) => {
  const { c, id } = await withLoan(t, {}, { key: proKey() });
  await c.call("loan_create", { ...WORKED, name: "Second", currency: "USD", principal_minor: 500000, term_periods: 6 });
  const list = await c.json("loan_list", { as_of: "2026-06-30" });
  assert.equal(list.count, 2);
  const worked = list.loans.find((x) => x.id === id);
  assert.equal(worked.periods_paid, 5);
  assert.equal(worked.outstanding_minor, 597791);
  assert.equal(worked.next_payment_date, "2026-07-15");
  assert.deepEqual(list.outstanding_by_currency.map((x) => x.currency).sort(), ["EUR", "USD"]);

  const rep = await c.json("loans_report", { as_of: "2026-06-30", year: "2026" });
  const eur = rep.outstanding_by_currency.find((x) => x.currency === "EUR");
  assert.equal(eur.outstanding_minor, 597791);
  assert.equal(eur.loans, 1);
  // 11 payments fall in 2026 (February to December); the twelfth is 2027-01-15.
  const row = rep.per_loan.find((x) => x.id === id);
  assert.equal(row.payments_this_year, 11);
  assert.equal(row.interest_this_year_minor, 66188 - 882);
  assert.equal(row.next_payment_date, "2026-07-15");
  assert.equal(rep.next_payments[0].date, "2026-07-15");
});

test("a month-end drawdown clamps and never rolls into the next month", async (t) => {
  const { c, id } = await withLoan(t, { start_date: "2026-01-31", name: "Month end" });
  const s = await c.json("loan_schedule", { loan: id });
  assert.deepEqual(s.rows.slice(0, 3).map((r) => r.date), ["2026-02-28", "2026-03-31", "2026-04-30"]);
  assert.equal(s.rows[11].date, "2027-01-31");
});
