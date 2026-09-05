// The worked month. Every number asserted here was recomputed by hand from the seeded
// rows, and the table it comes from is in docs/CASH_BOOK_RESULT.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, sandbox, cleanup, proKey, workedMonth, balances, seed, PERIOD } from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

async function worked(t, opts = {}) {
  const { box, c } = open(t, opts);
  workedMonth(box.dataHome);
  await c.init();
  return { box, c };
}

test("the worked month balances to the minor unit and every account carries the hand figure", async (t) => {
  const { c } = await worked(t);
  const tb = await c.json("trial_balance", PERIOD);
  assert.equal(tb.balanced, true, JSON.stringify(tb.offenders));
  assert.equal(tb.debits_minor, 1638300);
  assert.equal(tb.credits_minor, 1638300);
  assert.equal(tb.imbalance_minor, 0);
  assert.deepEqual(balances(tb), {
    cash: -1054300,
    receivables: 40000,
    revenue: -140000,
    vat_output: -23000,
    vat_input: 2300,
    "expenses:travel": 10000,
    "expenses:software": 5000,
    deposits_held: -40000,
    fixed_assets: 1200000,
    accumulated_depreciation: -15000,
    depreciation_expense: 15000,
  });
  assert.deepEqual(tb.offenders, []);
});

test("every line names the server, the document and the date it came from, and every entry balances", async (t) => {
  const { c } = await worked(t);
  const r = await c.json("ledger_lines", PERIOD);
  assert.ok(r.lines.length >= 20, `only ${r.lines.length} lines`);
  const perEntry = new Map();
  for (const l of r.lines) {
    assert.ok(l.source, `line has no source: ${JSON.stringify(l)}`);
    assert.ok(l.source_id, `line has no source id: ${JSON.stringify(l)}`);
    assert.match(l.date, /^2026-06-\d\d$/);
    assert.ok(l.debit_minor === 0 || l.credit_minor === 0, "a leg is a debit or a credit, never both");
    assert.ok(l.debit_minor !== 0 || l.credit_minor !== 0, "a zero leg was posted");
    perEntry.set(l.entry, (perEntry.get(l.entry) ?? 0) + l.debit_minor - l.credit_minor);
  }
  for (const [entry, diff] of perEntry) assert.equal(diff, 0, `${entry} does not balance`);
  assert.deepEqual([...new Set(r.lines.map((l) => l.source))].sort(),
    ["asset-register", "billing-docs", "deposits", "expense-tracker", "invoice"]);
});

test("a deposit applied to an invoice moves the liability, never cash", async (t) => {
  const { c } = await worked(t);
  const cash = await c.json("ledger_lines", { ...PERIOD, account: "cash" });
  assert.equal(cash.debits_minor, 163000, "cash came in once: the 100,000 deposit and the 63,000 payment");
  const held = await c.json("ledger_lines", { ...PERIOD, account: "deposits_held" });
  const applied = held.lines.filter((l) => l.debit_minor === 60000);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].source, "deposits");
  assert.equal(applied[0].source_id, "DEP-2026-0001");
  assert.equal(applied[0].date, "2026-06-18");
  // and the 60,000 never appears as a cash debit, which is what paying twice would look like
  assert.equal(cash.lines.filter((l) => l.debit_minor === 60000).length, 0);
});

test("the VAT on an expense comes OUT of the gross, because the expense ledger stores it VAT-inclusive", async (t) => {
  const { c } = await worked(t);
  const r = await c.json("ledger_lines", { ...PERIOD, source_id: "exp_1" });
  const by = Object.fromEntries(r.lines.map((l) => [l.account, l.debit_minor || -l.credit_minor]));
  assert.deepEqual(by, { "expenses:travel": 10000, vat_input: 2300, cash: -12300 });
});

test("depreciation is charged by the month, and an asset entering service posts fixed assets against cash", async (t) => {
  const { c } = await worked(t);
  const dep = await c.json("ledger_lines", { ...PERIOD, account: "depreciation_expense" });
  assert.equal(dep.lines.length, 1, "one month of charge, on the asset already in service");
  assert.equal(dep.lines[0].debit_minor, 15000);
  assert.equal(dep.lines[0].source_id, "ASSET-2026-0001");
  assert.equal(dep.lines[0].date, "2026-06-30");
  const fa = await c.json("ledger_lines", { ...PERIOD, account: "fixed_assets" });
  assert.equal(fa.lines.length, 1);
  assert.equal(fa.lines[0].debit_minor, 1200000);
  assert.equal(fa.lines[0].source_id, "ASSET-2026-0002");
  assert.equal(fa.lines[0].date, "2026-06-15");
});

test("the bank import is evidence and never a posting", async (t) => {
  const { c } = await worked(t);
  const r = await c.json("ledger_build", PERIOD);
  assert.deepEqual(r.bank_reconciliation, { matched: 4, bank_rows_unmatched: 1, posted_cash_without_bank_evidence: 1 });
  const lines = (await c.json("ledger_lines", PERIOD)).lines;
  assert.equal(lines.filter((l) => l.source === "bank-statement").length, 0, "a bank row was posted");
  const matched = lines.filter((l) => l.bank_ref);
  assert.deepEqual(matched.map((l) => l.bank_ref).sort(), ["tx1", "tx2", "tx3", "tx4"]);
});

test("a purchase order is a memo and is never posted", async (t) => {
  const { box, c } = await worked(t);
  seed.purchaseOrders(box.dataHome, [{
    id: "PO-2026-0001", buyer: { name: "Zovo" }, supplier: { name: "Parts Ltd" },
    issue_date: "2026-06-08", currency: "EUR", decimals: 2, lines: [],
    subtotal_minor: 90000, discount_percent: 0, discount_minor: 0, net_minor: 90000,
    tax_lines: [], tax_minor: 0, total_minor: 90000, status: "open", receipts: [],
    created: "2026-06-08T09:00:00.000Z", updated: "2026-06-08T09:00:00.000Z", branded: false,
  }]);
  const r = await c.json("ledger_build", PERIOD);
  assert.equal(r.memos, 1);
  assert.equal(r.purchase_commitments[0].amount_minor, 90000);
  assert.equal(r.balanced, true);
  assert.equal(r.debits_minor, 1638300, "the memo moved no balance");
  const lines = (await c.json("ledger_lines", PERIOD)).lines;
  assert.equal(lines.filter((l) => l.source_id === "PO-2026-0001").length, 0);
});

test("month_close lists what is unposted or inconsistent and records the trial balance snapshot", async (t) => {
  const { c } = await worked(t, { key: proKey() });
  const dry = await c.json("month_close", { month: "2026-06", dry_run: true });
  assert.equal(dry.closed, false);
  assert.deepEqual(dry.exceptions_by_kind, {
    "invoice-no-vat-rate": 1, "bank-debit-unexplained": 1, "cash-without-bank-evidence": 1,
  });
  assert.equal(dry.exceptions.find((x) => x.kind === "invoice-no-vat-rate").source_id, "INV-2026-0002");
  assert.equal(dry.exceptions.find((x) => x.kind === "bank-debit-unexplained").source_id, "tx5");
  assert.equal(dry.exceptions.find((x) => x.kind === "cash-without-bank-evidence").source_id, "exp_2");

  const closed = await c.json("month_close", { month: "2026-06" });
  assert.equal(closed.closed, true);
  assert.equal(closed.trial_balance.balanced, true);
  assert.equal(closed.trial_balance.debits_minor, 1638300);
  assert.equal(closed.snapshot_accounts, 11);
  assert.equal(closed.drift, undefined);
});

test("closing a month again after a sibling store moved reports the drift instead of hiding it", async (t) => {
  const { box, c } = await worked(t, { key: proKey() });
  await c.json("month_close", { month: "2026-06" });
  seed.expenses(box.dataHome, [
    { id: "exp_1", date: "2026-06-05", amount_minor: 12300, currency: "EUR", vat_rate: 23, category: "travel", billable: false, created: "2026-06-05T09:00:00.000Z" },
    { id: "exp_2", date: "2026-06-12", amount_minor: 5000, currency: "EUR", category: "software", billable: false, created: "2026-06-12T09:00:00.000Z" },
    { id: "exp_3", date: "2026-06-14", amount_minor: 9900, currency: "EUR", category: "travel", billable: false, created: "2026-06-14T09:00:00.000Z" },
  ]);
  const again = await c.json("month_close", { month: "2026-06", dry_run: true });
  assert.match(again.drift ?? "", /closed on .* with 1638300 minor units of debits and now derives 1648200/);
});

test("the CSV is one row per leg, quoted, with the source columns", async (t) => {
  const { c } = await worked(t, { key: proKey() });
  const r = await c.call("ledger_export_csv", PERIOD);
  assert.equal(r.isError, false, r.text);
  const rows = r.text.trim().split("\n");
  const lines = (await c.json("ledger_lines", PERIOD)).lines;
  assert.equal(rows.length, lines.length + 1);
  assert.equal(rows[0], '"date","entry","account","account_name","debit_minor","credit_minor","currency","source","source_id","bank_ref","description"');
  assert.ok(rows.every((x) => x.startsWith('"')), "every field is quoted");
  assert.match(r.text, /"invoice","INV-2026-0001"/);
});

test("ledger_report states the movement and the balance of every account, and says which side it reads as", async (t) => {
  const { c } = await worked(t, { key: proKey() });
  const r = await c.json("ledger_report", PERIOD);
  const acc = Object.fromEntries(r.accounts.map((a) => [a.account, a]));
  assert.equal(acc.receivables.debits_minor, 173000);
  assert.equal(acc.receivables.credits_minor, 133000);
  assert.equal(acc.receivables.balance_minor, 40000);
  assert.equal(acc.receivables.reads_as, "a debit balance");
  assert.equal(acc.revenue.balance_minor, -140000);
  assert.equal(acc.revenue.reads_as, "a credit balance");
  assert.equal(acc.deposits_held.reads_as, "a credit balance");
  assert.equal(r.balanced, true);
});

test("ledger_build registers the period once and says a rebuild costs nothing", async (t) => {
  const { c } = await worked(t);
  const first = await c.json("ledger_build", PERIOD);
  const second = await c.json("ledger_build", PERIOD);
  assert.equal(first.built.first_built, second.built.first_built, "a rebuild allocated a second period");
  assert.equal(second.lines, first.lines);
  assert.equal((await c.json("ledger_build", { ...PERIOD, currency: "EUR" })).built.first_built, first.built.first_built);
});

test("ledger_lines filters by account, source and document, and says a filtered set is not expected to balance", async (t) => {
  const { c } = await worked(t);
  const inv = await c.json("ledger_lines", { ...PERIOD, source: "invoice" });
  assert.ok(inv.lines.every((l) => l.source === "invoice"));
  const one = await c.json("ledger_lines", { ...PERIOD, source_id: "INV-2026-0001" });
  assert.equal(one.debits_minor, one.credits_minor, "one invoice and its payment do balance");
  const expenses = await c.json("ledger_lines", { ...PERIOD, account: "expenses" });
  assert.deepEqual([...new Set(expenses.lines.map((l) => l.account))].sort(), ["expenses:software", "expenses:travel"]);
  assert.match(expenses.note, /not expected to be equal/);
  const window = await c.json("ledger_lines", { ...PERIOD, since: "2026-06-20", until: "2026-06-25" });
  assert.ok(window.lines.every((l) => l.date >= "2026-06-20" && l.date <= "2026-06-25"));
});

test("a period with nothing in it balances at zero rather than failing", async (t) => {
  const { c } = await worked(t);
  const tb = await c.json("trial_balance", { from: "2020-01-01", to: "2020-01-31", currency: "EUR" });
  assert.equal(tb.balanced, true);
  assert.equal(tb.debits_minor, 0);
  assert.deepEqual(tb.accounts, []);
});
