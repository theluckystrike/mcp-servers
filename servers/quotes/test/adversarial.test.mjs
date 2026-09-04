// The probe matrix from docs/QUOTES_AUDIT.md Part 1, as assertions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { client, REPO, shiftDays } from "./harness.mjs";

const PRO = execFileSync(process.execPath, [join(REPO, "scripts", "sign-license.mjs"), "quotes"], { encoding: "utf8" }).trim();
const ITEM = { description: "Work", quantity: 1, unit_price_minor: 10000 };

test("bad arguments are refused by name, and nothing is stored", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();

  const cases = [
    [{}, /Required at client/],
    [{ client: "A" }, /Required at items/],
    [{ client: "A", items: [] }, /at least one line item/],
    [{ client: "A", items: [{ ...ITEM, quantity: -3 }] }, /quantity must be greater than zero/],
    [{ client: "A", items: [{ ...ITEM, quantity: 0 }] }, /quantity must be greater than zero/],
    [{ client: "A", items: [{ ...ITEM, unit_price_minor: 90.5 }] }, /whole number of minor units/],
    [{ client: "A", items: [{ ...ITEM, unit_price_minor: -1 }] }, /cannot be negative/],
    [{ client: "A", items: [{ ...ITEM, description: "" }] }, /needs a description/],
    [{ client: "A", items: [ITEM], currency: "EURO" }, /3-letter ISO code/],
    [{ client: "A", items: [ITEM], issue_date: "2026-02-30" }, /not a real date/],
    [{ client: "A", items: [ITEM], valid_until: "not-a-date" }, /not a real date/],
    [{ client: "A", items: [ITEM], issue_date: "2026-05-10", valid_until: "2026-05-09" }, /before the quote date/],
  ];
  for (const [args, re] of cases) {
    const r = await c.call("quote_create", args);
    assert.equal(r.isError, true, `should have refused ${JSON.stringify(args)}`);
    assert.match(r.text, re, r.text);
  }
  assert.equal((await c.json("quote_list", {})).count, 0, "a refused quote must not be stored");
  assert.equal(existsSync(join(c.home, "data", "mcp-servers", "quotes", "quotes.json")), false);
});

test("a total too large to represent exactly is refused before anything is written", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();
  const r = await c.call("quote_create", { client: "A", items: [{ description: "x", quantity: 1e9, unit_price_minor: 1e12 }] });
  assert.equal(r.isError, true);
  assert.match(r.text, /represented exactly|out of range/);
  assert.equal((await c.json("quote_list", {})).count, 0);
});

test("two currencies on one quote are refused, not added together", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();
  const mixed = await c.call("quote_create", {
    client: "A", items: [{ ...ITEM, currency: "EUR" }, { ...ITEM, currency: "USD" }],
  });
  assert.equal(mixed.isError, true);
  assert.match(mixed.text, /more than one currency \(EUR, USD\)/);

  const disagree = await c.call("quote_create", { client: "A", currency: "EUR", items: [{ ...ITEM, currency: "USD" }] });
  assert.equal(disagree.isError, true);
  assert.match(disagree.text, /quote currency is EUR but a line item says USD/);

  // One agreed line currency and no quote currency: that currency becomes the quote's.
  const agreed = await c.json("quote_create", { client: "A", items: [{ ...ITEM, currency: "usd" }] });
  assert.equal(agreed.created.currency, "USD");
  assert.equal(agreed.created.total, "USD 100.00");
});

test("accepting twice never issues a second invoice", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();
  const q = (await c.json("quote_create", { client: "A", items: [ITEM], currency: "EUR" })).created;
  const first = await c.json("quote_accept", { id: q.id, create_invoice: "always" });
  const again = await c.call("quote_accept", { id: q.id, create_invoice: "always" });
  assert.equal(again.isError, true);
  assert.match(again.text, /already accepted/);
  assert.match(again.text, new RegExp(first.invoice_number));
  const invoices = JSON.parse(readFileSync(join(c.home, "data", "mcp-servers", "invoice", "invoices.json"), "utf8"));
  assert.equal(invoices.length, 1, "a second accept must not create a second invoice");

  // An accepted quote is not editable and not declinable either.
  const upd = await c.call("quote_update", { id: q.id, notes: "late change" });
  assert.equal(upd.isError, true);
  assert.match(upd.text, /closed document/);
  const dec = await c.call("quote_decline", { id: q.id });
  assert.equal(dec.isError, true);
  assert.match(dec.text, /accepted on/);
});

test("an expired quote is refused until the price is re-confirmed", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();
  const today = (await c.json("quote_create", { client: "Now", items: [ITEM], currency: "EUR" })).created.issue_date;
  const past = shiftDays(today, -60);
  const q = (await c.json("quote_create", { client: "Old", items: [ITEM], currency: "EUR", issue_date: past, validity_days: 1 })).created;
  assert.equal(q.state, "expired");

  const refused = await c.call("quote_accept", { id: q.id });
  assert.equal(refused.isError, true);
  assert.match(refused.text, /lapsed by 59 day\(s\)/);
  assert.match(refused.text, /allow_expired/);

  // Extending it is the documented fix, and then it accepts.
  const extended = (await c.json("quote_update", { id: q.id, valid_until: shiftDays(today, 7) })).updated;
  assert.equal(extended.state, "open");
  const acc = await c.json("quote_accept", { id: q.id, create_invoice: "never" });
  assert.equal(acc.accepted.state, "accepted");

  // The other route: allow_expired on a quote that is still lapsed.
  const q2 = (await c.json("quote_create", { client: "Older", items: [ITEM], currency: "EUR", issue_date: past, validity_days: 1 })).created;
  const forced = await c.json("quote_accept", { id: q2.id, allow_expired: true, create_invoice: "never" });
  assert.equal(forced.accepted.state, "accepted");
});

test("an expired quote does not eat a free open slot", async (t) => {
  const c = client();
  t.after(() => c.close());
  await c.init();
  const today = (await c.json("quote_create", { client: "Live", items: [ITEM], currency: "EUR" })).created.issue_date;
  for (let i = 0; i < 6; i++) {
    const r = await c.call("quote_create", {
      client: `Old${i}`, items: [ITEM], currency: "EUR",
      issue_date: shiftDays(today, -90), validity_days: 1,
    });
    assert.equal(r.isError, false, r.text);
  }
  const rep = await c.json("quote_list", { state: "expired" });
  assert.equal(rep.count, 6);
  // 1 open + 6 expired: four open slots are still free.
  for (let i = 0; i < 4; i++) {
    const r = await c.call("quote_create", { client: `New${i}`, items: [ITEM], currency: "EUR" });
    assert.equal(r.isError, false, r.text);
  }
  const full = await c.call("quote_create", { client: "TooMany", items: [ITEM], currency: "EUR" });
  assert.equal(full.isError, true);
  assert.match(full.text, /keeps 5 quotes open/);
});

test("an ambiguous client reference is refused with the candidates", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();
  await c.json("quote_create", { client: "Acme Ltd", items: [ITEM], currency: "EUR" });
  await c.json("quote_create", { client: "Acme Digital", items: [ITEM], currency: "EUR" });
  const r = await c.call("quote_accept", { id: "Acme" });
  assert.equal(r.isError, true);
  assert.match(r.text, /matches more than one quote/);
  assert.match(r.text, /Acme Ltd/);
  assert.match(r.text, /Acme Digital/);
  const miss = await c.call("quote_get", { id: "Q-1999-0001" });
  assert.equal(miss.isError, true);
  assert.match(miss.text, /no quote matches/);
});

test("stdout carries JSON-RPC only, even on the error paths", async (t) => {
  const c = client();
  t.after(() => c.close());
  await c.init();
  await c.tools();
  await c.call("quote_create", {});
  await c.call("quote_get", { id: "nope" });
  await c.call("quote_list", {});
  await new Promise((r) => setTimeout(r, 150));
  const lines = [...c.stdoutLines, c.tail].filter((l) => l.trim() !== "");
  assert.ok(lines.length >= 4);
  for (const line of lines) {
    let m;
    try { m = JSON.parse(line); } catch { assert.fail(`non-JSON on stdout: ${line.slice(0, 200)}`); }
    assert.equal(m.jsonrpc, "2.0");
  }
});

test("a VAT rate change between quote and acceptance never moves the agreed total", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  const profileDir = join(c.home, "data", "mcp-servers", "profile");
  mkdirSync(profileDir, { recursive: true });
  const writeProfile = (rate) => writeFileSync(join(profileDir, "business.json"),
    JSON.stringify({ name: "Test Co", default_currency: "EUR", default_tax_rate: rate, payment_terms_days: 14, invoice_prefix: "INV" }));

  writeProfile(23);
  await c.init();
  // No tax_rate on the line: it takes the business default at quote time.
  const q = (await c.json("quote_create", { client: "Acme", items: [{ description: "Work", quantity: 1, unit_price_minor: 100000 }] })).created;
  assert.equal(q.total, "EUR 1230.00");

  // The rate changes before the client answers. The quote is a price they were given.
  writeProfile(8);
  const acc = await c.json("quote_accept", { id: q.id, create_invoice: "always" });
  assert.equal(acc.totals_check.invoice_total, "EUR 1230.00");
  const invoices = JSON.parse(readFileSync(join(c.home, "data", "mcp-servers", "invoice", "invoices.json"), "utf8"));
  assert.equal(invoices[0].total_minor, 123000, "the invoice must carry the quoted numbers, not a recomputation");
  assert.equal(invoices[0].tax_lines[0].rate, 23);
});

test("quote_pdf to a directory is a refusal the caller can read, and the session survives", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();
  const q = (await c.json("quote_create", { client: "A", items: [ITEM], currency: "EUR" })).created;
  const r = await c.call("quote_pdf", { id: q.id, out_path: c.home });
  assert.equal(r.isError, true);
  assert.match(r.text, /EISDIR|directory/i, r.text);
  // The stream error must not have taken the server down.
  const after = await c.json("quote_list", {});
  assert.equal(after.count, 1);
});

test("validity_days at its boundaries: 0 refused, 3650 accepted, 3651 refused", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();

  const zero = await c.call("quote_create", { client: "A", items: [ITEM], validity_days: 0 });
  assert.equal(zero.isError, true);
  assert.match(zero.text, /greater than or equal|at least/i);

  const max = await c.json("quote_create", { client: "A", items: [ITEM], validity_days: 3650 });
  assert.equal(max.created.days_left, 3650);

  const over = await c.call("quote_create", { client: "A", items: [ITEM], validity_days: 3651 });
  assert.equal(over.isError, true);
  assert.match(over.text, /less than or equal to 3650/);
});

test("a 1 MB notes field is refused by name, not stored", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();
  const big = "x".repeat(1024 * 1024);
  const r = await c.call("quote_create", { client: "A", items: [ITEM], notes: big });
  assert.equal(r.isError, true);
  assert.match(r.text, /notes must be 10000 characters or fewer/);
  assert.equal((await c.json("quote_list", {})).count, 0, "a refused quote must not be stored");

  // A notes field right at the cap is accepted; one character over is refused.
  const atCap = await c.json("quote_create", { client: "A", items: [ITEM], notes: "y".repeat(10000) });
  assert.equal(atCap.created.notes.length, 10000);
  const overCap = await c.call("quote_create", { client: "A", items: [ITEM], notes: "y".repeat(10001) });
  assert.equal(overCap.isError, true);
});

test("a 500-line line-item description and an oversized one", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();
  const lines500 = Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n"); // well over 500 characters
  const r = await c.call("quote_create", { client: "A", items: [{ ...ITEM, description: lines500 }] });
  assert.equal(r.isError, true);
  assert.match(r.text, /description must be 500 characters or fewer/);
  assert.equal((await c.json("quote_list", {})).count, 0);

  const ok = await c.json("quote_create", { client: "A", items: [{ ...ITEM, description: "x".repeat(500) }] });
  assert.match(ok.created.id, /^Q-\d{4}-\d{4}$/);
});

test("oversized client name, email, address, VAT id and decline reason are all refused by name", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();
  const cases = [
    [{ client: "n".repeat(201), items: [ITEM] }, /client must be 200 characters or fewer/],
    [{ client: "A", items: [ITEM], client_email: "e".repeat(321) }, /client_email must be 320 characters or fewer/],
    [{ client: "A", items: [ITEM], client_address: "a".repeat(2001) }, /client_address must be 2000 characters or fewer/],
    [{ client: "A", items: [ITEM], client_vat_id: "v".repeat(65) }, /client_vat_id must be 64 characters or fewer/],
  ];
  for (const [args, re] of cases) {
    const r = await c.call("quote_create", args);
    assert.equal(r.isError, true, JSON.stringify(args).slice(0, 60));
    assert.match(r.text, re, r.text);
  }
  assert.equal((await c.json("quote_list", {})).count, 0);

  const q = (await c.json("quote_create", { client: "A", items: [ITEM] })).created;
  const declineTooLong = await c.call("quote_decline", { id: q.id, reason: "r".repeat(10001) });
  assert.equal(declineTooLong.isError, true);
  assert.match(declineTooLong.text, /reason must be 10000 characters or fewer/);
});

test("accepting a quote continues the invoice server's own number series, not a fresh one", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();
  // Pre-seed the invoice store as if 3 invoices were already issued directly, with no
  // quote behind any of them, the way invoice_create in servers/invoice would leave it.
  const invoiceDir = join(c.home, "data", "mcp-servers", "invoice");
  mkdirSync(invoiceDir, { recursive: true });
  writeFileSync(join(invoiceDir, "invoices.json"), JSON.stringify([
    { number: "INV-2026-0001", total_minor: 6150, currency: "EUR" },
    { number: "INV-2026-0002", total_minor: 6150, currency: "EUR" },
    { number: "INV-2026-0003", total_minor: 6150, currency: "EUR" },
  ]));
  writeFileSync(join(invoiceDir, "counter.json"), JSON.stringify({ "INV-2026": 3 }));

  const q = (await c.json("quote_create", { client: "Nova Ltd", items: [ITEM], currency: "EUR" })).created;
  const acc = await c.json("quote_accept", { id: q.id, create_invoice: "always" });
  assert.equal(acc.invoice_number, "INV-2026-0004", "the quote's invoice must continue the existing series, not restart at 0001");
  const invoices = JSON.parse(readFileSync(join(invoiceDir, "invoices.json"), "utf8"));
  assert.equal(invoices.length, 4);
  assert.equal(invoices.at(-1).number, "INV-2026-0004");
});
