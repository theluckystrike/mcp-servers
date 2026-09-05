// What happens when the books are wrong, absent, unreadable or in two currencies.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  client, sandbox, cleanup, proKey, workedMonth, seed, storeDir, invoice, deposit, expense, txn, PERIOD,
} from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

function corrupt(dataHome, server, file) {
  const dir = storeDir(dataHome, server);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), "{ this is not json");
}

test("an invoice ledger on its own builds a correct ledger, and every absent store says rows 0 rather than failing", async (t) => {
  const { box, c } = open(t);
  seed.invoices(box.dataHome, [invoice({ number: "INV-2026-0001", issue_date: "2026-06-03", net_minor: 100000, tax_rate: 23 })]);
  await c.init();
  const r = await c.json("trial_balance", PERIOD);
  assert.equal(r.balanced, true);
  assert.equal(r.debits_minor, 123000);
  const bySource = Object.fromEntries(r.sources.map((s) => [s.store, s]));
  assert.equal(bySource["deposits"].read, true);
  assert.equal(bySource["deposits"].rows, 0);
  assert.equal(bySource["expense-tracker"].rows, 0);
  assert.deepEqual(r.notes, [], "an absent store is not a degraded one");
});

test("an unreadable expense ledger is never read as an empty one", async (t) => {
  const { box, c } = open(t);
  workedMonth(box.dataHome);
  corrupt(box.dataHome, "expense-tracker", "data.json");
  await c.init();
  const r = await c.json("trial_balance", PERIOD);
  const src = r.sources.find((s) => s.store === "expense-tracker");
  assert.equal(src.read, false);
  assert.match(src.error, /did not parse/);
  assert.ok(r.notes.some((n) => /expense ledger could not be read/.test(n) && /MISSING/.test(n)));
  assert.equal(r.balanced, true, "it still balances, because both legs of the missing entry are missing");
  // The two expenses carried 17,300 minor units of debits (10,000 + 2,300 + 5,000) and
  // 17,300 of credits. Both sides went, so the sum still proves nothing about the loss.
  assert.equal(r.debits_minor, 1638300 - 17300);
});

test("an unreadable invoice ledger is not fatal here, and the ledger says what it costs", async (t) => {
  const { box, c } = open(t);
  workedMonth(box.dataHome);
  corrupt(box.dataHome, "invoice", "invoices.json");
  await c.init();
  const r = await c.json("trial_balance", PERIOD);
  assert.equal(r.sources.find((s) => s.store === "invoice").read, false);
  assert.ok(r.notes.some((n) => /invoice ledger could not be read/.test(n)));
  assert.equal(r.balanced, true);
  const acc = Object.fromEntries(r.accounts.map((a) => [a.account, a.balance_minor]));
  assert.equal(acc.receivables, -10000, "no invoice was raised, so all that is left is the credit note reversing one");
  assert.equal(acc.revenue, 10000, "the same, from the other side: a credit against revenue that was never derived");
  assert.equal(acc.vat_output, undefined, "no VAT was derived at all without the invoices that carry it");
});

test("two currencies in one period are refused by name, and naming one excludes the other", async (t) => {
  const { box, c } = open(t);
  workedMonth(box.dataHome);
  seed.invoices(box.dataHome, [
    invoice({ number: "INV-2026-0001", issue_date: "2026-06-03", net_minor: 100000, tax_rate: 23, paid_minor: 123000, paid_date: "2026-06-20", payments: [{ date: "2026-06-20", amount_minor: 63000 }] }),
    invoice({ number: "INV-2026-0002", issue_date: "2026-06-10", net_minor: 50000 }),
    invoice({ number: "INV-2026-0003", issue_date: "2026-06-11", net_minor: 70000, currency: "USD" }),
  ]);
  await c.init();
  const refused = await c.call("trial_balance", PERIOD);
  assert.equal(refused.isError, true);
  assert.match(refused.text, /2 currencies \(EUR, USD\)/);
  assert.match(refused.text, /no exchange rate/);

  const eur = await c.json("trial_balance", { ...PERIOD, currency: "EUR" });
  assert.equal(eur.balanced, true);
  assert.equal(eur.debits_minor, 1638300);
  const usd = await c.json("trial_balance", { ...PERIOD, currency: "USD" });
  assert.equal(usd.debits_minor, 70000);
  assert.equal(usd.currency, "USD");
  const build = await c.json("ledger_build", { ...PERIOD, currency: "USD" });
  assert.ok(build.rows_in_other_currencies > 0, "the EUR documents were counted as excluded, not silently dropped");
});

test("an invoice paid twice, once by payment row and once by deposit, posts the cash ONCE and says the books disagree", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seed.invoices(box.dataHome, [invoice({
    number: "INV-2026-0001", issue_date: "2026-06-03", net_minor: 100000, tax_rate: 0,
    paid_minor: 100000, paid_date: "2026-06-20",
    payments: [{ date: "2026-06-20", amount_minor: 100000, method: "transfer" }],
  })]);
  seed.deposits(box.dataHome, [deposit({
    id: "DEP-2026-0001", amount_minor: 100000, received_date: "2026-06-01",
    applications: [{ date: "2026-06-18", invoice_number: "INV-2026-0001", amount_minor: 100000 }],
  })]);
  await c.init();
  const tb = await c.json("trial_balance", PERIOD);
  assert.equal(tb.balanced, true);
  const acc = Object.fromEntries(tb.accounts.map((a) => [a.account, a.balance_minor]));
  // 100,000 in as the deposit, 100,000 in as the payment; receivables clear ONCE.
  assert.equal(acc.receivables, 0, "the invoice was settled once, not twice");
  assert.equal(acc.cash, 200000);
  assert.equal(acc.deposits_held, -100000, "the deposit is still held: its application was discarded with the attribution");

  const close = await c.json("month_close", { month: "2026-06", dry_run: true, currency: "EUR" });
  assert.equal(close.isError, undefined);
  const dis = close.exceptions.find((x) => x.kind === "payment-attribution-disagrees");
  assert.ok(dis, JSON.stringify(close.exceptions_by_kind));
  assert.match(dis.message, /INV-2026-0001 records paid_minor 100000 but 200000/);
});

test("a bank row that could be either of two expenses is matched to neither", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seed.expenses(box.dataHome, [
    expense({ id: "exp_1", date: "2026-06-05", amount_minor: 5000, category: "travel" }),
    expense({ id: "exp_2", date: "2026-06-05", amount_minor: 5000, category: "software" }),
  ]);
  seed.bank(box.dataHome, [txn({ id: "tx1", date: "2026-06-05", amount_minor: -5000, description: "Card 5000" })]);
  await c.init();
  const r = await c.json("month_close", { month: "2026-06", dry_run: true, currency: "EUR" });
  const amb = r.exceptions.find((x) => x.kind === "bank-row-ambiguous");
  assert.ok(amb, JSON.stringify(r.exceptions_by_kind));
  assert.match(amb.message, /matches 2 posted cash movements \(exp_1, exp_2\)/);
  const lines = (await c.json("ledger_lines", { ...PERIOD, account: "cash" })).lines;
  assert.deepEqual(lines.map((l) => l.bank_ref), [undefined, undefined], "one bank line is one movement");
});

test("a deposit applied to an invoice that does not exist is reported and never posted", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seed.invoices(box.dataHome, []);
  seed.deposits(box.dataHome, [deposit({
    id: "DEP-2026-0001", amount_minor: 100000, received_date: "2026-06-01",
    applications: [{ date: "2026-06-18", invoice_number: "INV-2026-9999", amount_minor: 40000 }],
  })]);
  await c.init();
  const tb = await c.json("trial_balance", PERIOD);
  assert.equal(tb.balanced, true);
  const acc = Object.fromEntries(tb.accounts.map((a) => [a.account, a.balance_minor]));
  assert.equal(acc.deposits_held, -100000, "nothing was settled, so the whole deposit is still a liability");
  assert.equal(acc.receivables, undefined, "no receivable was cleared against an invoice that does not exist");
  const close = await c.json("month_close", { month: "2026-06", dry_run: true, currency: "EUR" });
  const ex = close.exceptions.find((x) => x.kind === "deposit-applied-to-unknown-invoice");
  assert.ok(ex);
  assert.match(ex.message, /INV-2026-9999/);
  assert.match(ex.message, /deposits held is 40000 minor units too high/);
});

test("a document whose own legs do not add up makes the trial balance non-zero and is named", async (t) => {
  const { box, c } = open(t);
  seed.invoices(box.dataHome, [{
    ...invoice({ number: "INV-2026-0001", issue_date: "2026-06-03", net_minor: 100000, tax_rate: 23 }),
    total_minor: 123500,
  }]);
  await c.init();
  const tb = await c.json("trial_balance", PERIOD);
  assert.equal(tb.balanced, false);
  assert.equal(tb.imbalance_minor, 500);
  assert.equal(tb.offenders.length, 1);
  assert.equal(tb.offenders[0].source_id, "INV-2026-0001");
  assert.equal(tb.offenders[0].difference_minor, 500);
  assert.match(tb.verdict, /out by 500 minor units/);
  assert.match(tb.verdict, /nothing here was adjusted to hide it/);
});

test("a period that runs backwards, and a date that is not a date, are refused by name", async (t) => {
  const { box, c } = open(t);
  workedMonth(box.dataHome);
  await c.init();
  assert.match((await c.call("trial_balance", { from: "2026-06-30", to: "2026-06-01" })).text, /runs backwards/);
  assert.match((await c.call("trial_balance", { from: "2026-02-30", to: "2026-06-01" })).text, /not a real date/);
  assert.match((await c.call("trial_balance", { from: "yesterday", to: "2026-06-01" })).text, /not a real date/);
  assert.match((await c.call("month_close", { month: "2026-13" })).text, /not a month in YYYY-MM form|Pro/);
});

test("the free tier builds three periods a month, rebuilds them free, and never meters the trial balance", async (t) => {
  const { box, c } = open(t);
  workedMonth(box.dataHome);
  await c.init();
  for (const to of ["2026-06-10", "2026-06-20", "2026-06-30"]) {
    const r = await c.call("ledger_build", { from: "2026-06-01", to, currency: "EUR" });
    assert.equal(r.isError, false, r.text);
  }
  const fourth = await c.call("ledger_build", { from: "2026-06-01", to: "2026-06-25", currency: "EUR" });
  assert.equal(fourth.isError, true);
  assert.match(fourth.text, /builds 3 periods a calendar month/);
  assert.match(fourth.text, /Pro is a one-time \$\d+ for this server/);
  assert.equal((await c.call("ledger_build", { from: "2026-06-01", to: "2026-06-30", currency: "EUR" })).isError, false, "a rebuild is free");
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await c.call("trial_balance", { from: "2026-06-01", to: `2026-06-0${i + 1}`, currency: "EUR" })).isError, false);
  }
});

test("month_close, the CSV and the report are Pro, and a key for another product unlocks nothing", async (t) => {
  const { box, c } = open(t);
  workedMonth(box.dataHome);
  await c.init();
  for (const [tool, args] of [
    ["month_close", { month: "2026-06" }],
    ["ledger_export_csv", PERIOD],
    ["ledger_report", PERIOD],
  ]) {
    const r = await c.call(tool, args);
    assert.equal(r.isError, true, `${tool} answered on the free tier`);
    assert.match(r.text, /Pro is a one-time \$\d+ for this server/);
    assert.match(r.text, /license_activate/);
  }
  const other = open(t, { key: proKey("deposits") });
  workedMonth(other.box.dataHome);
  await other.c.init();
  assert.equal((await other.c.call("ledger_report", PERIOD)).isError, true, "a key signed for another product unlocked this one");
});

test("a corrupt register of this server's own blocks building and leaves the trial balance answerable", async (t) => {
  const { box, c } = open(t);
  workedMonth(box.dataHome);
  corrupt(box.dataHome, "cash-book", "periods.json");
  await c.init();
  const build = await c.call("ledger_build", PERIOD);
  assert.equal(build.isError, true);
  assert.match(build.text, /periods\.json/);
  const tb = await c.json("trial_balance", PERIOD);
  assert.equal(tb.balanced, true, "the trial balance never touches the register");
});

test("a credit note stored with a positive total is posted as it stands and flagged, never silently flipped", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  seed.invoices(box.dataHome, [invoice({ number: "INV-2026-0001", issue_date: "2026-06-03", net_minor: 100000 })]);
  seed.creditNotes(box.dataHome, [{
    id: "CN-2026-0001", invoice_number: "INV-2026-0001", invoice_total_minor: 100000,
    invoice_issue_date: "2026-06-03", basis: "amount", client: { name: "Acme Ltd" },
    issue_date: "2026-06-20", currency: "EUR", decimals: 2, lines: [],
    subtotal_minor: 10000, discount_percent: 0, discount_minor: 0, net_minor: 10000,
    tax_lines: [], tax_minor: 0, total_minor: 10000, reason: "hand written",
    created: "2026-06-20T09:00:00.000Z", branded: false,
  }]);
  await c.init();
  const close = await c.json("month_close", { month: "2026-06", dry_run: true, currency: "EUR" });
  assert.equal(close.isError, undefined, JSON.stringify(close).slice(0, 200));
  const ex = close.exceptions.find((x) => x.kind === "credit-note-sign");
  assert.ok(ex);
  assert.match(ex.message, /stores a POSITIVE total of 10000/);
  assert.equal(close.trial_balance.balanced, true);
});
