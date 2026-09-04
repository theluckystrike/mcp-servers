// End-to-end over the real stdio transport: the quote lifecycle, the handoff into the
// invoice server's store, and the free/Pro switch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { client, REPO, shiftDays } from "./harness.mjs";

const PRO = execFileSync(process.execPath, [join(REPO, "scripts", "sign-license.mjs"), "quotes"], { encoding: "utf8" }).trim();

const ITEMS = [
  { description: "API work", quantity: 12, unit_price_minor: 9000, tax_rate: 23 },
  { description: "Setup fee", quantity: 1, unit_price_minor: 30000, tax_rate: 23 },
];

test("initialize and tools/list", async (t) => {
  const c = client();
  t.after(() => c.close());
  const info = await c.init();
  assert.equal(info.serverInfo.name, "mcp-quotes");
  // The announced version is the generated one, so it cannot drift from package.json.
  assert.equal(info.serverInfo.version, JSON.parse(readFileSync(join(REPO, "servers", "quotes", "package.json"), "utf8")).version);
  const names = (await c.tools()).map((x) => x.name).sort();
  assert.deepEqual(names, [
    "license_activate", "license_status", "quote_accept", "quote_create", "quote_decline",
    "quote_get", "quote_list", "quote_pdf", "quote_report", "quote_send_text", "quote_update",
  ]);
});

test("create, revise, text-export and accept a quote; the invoice carries the same numbers", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();

  const created = (await c.json("quote_create", {
    client: "Acme", items: ITEMS, currency: "EUR", validity_days: 14, notes: "Scope: one API, no hosting.",
  })).created;
  // 12 x 90.00 = 1080.00, + 300.00 = 1380.00; 23% of 1380.00 = 317.40; total 1697.40.
  assert.match(created.id, /^Q-\d{4}-0001$/);
  assert.equal(created.state, "open");
  assert.equal(created.subtotal, "EUR 1380.00");
  assert.equal(created.tax[0], "23% on EUR 1380.00 = EUR 317.40");
  assert.equal(created.total, "EUR 1697.40");
  assert.equal(created.total_minor, 169740);
  assert.equal(created.days_left, 14);
  assert.equal(created.valid_until, shiftDays(created.issue_date, 14));

  const listed = await c.json("quote_list", { state: "open" });
  assert.equal(listed.count, 1);
  assert.equal(listed.quotes[0].id, created.id);

  // A revision recomputes the totals and keeps the id: 20 x 90.00 = 1800.00 + 23%.
  const updated = (await c.json("quote_update", {
    id: created.id,
    items: [{ description: "API work", quantity: 20, unit_price_minor: 9000, tax_rate: 23 }],
    validity_days: 30,
  })).updated;
  assert.equal(updated.id, created.id);
  assert.equal(updated.total, "EUR 2214.00");
  assert.equal(updated.days_left, 30);

  const text = (await c.call("quote_send_text", { id: created.id })).text;
  assert.match(text, /Hello Acme,/);
  assert.match(text, /EUR 2214\.00/);
  assert.match(text, /valid until/);
  // Every money value in the pasteable text carries its currency code: strip the
  // amounts that do, and no decimal amount is left behind.
  assert.equal(/\d+\.\d{2}/.test(text.replace(/[A-Z]{3} -?\d[\d.]*/g, "")), false, text);

  const accepted = await c.json("quote_accept", { id: created.id, create_invoice: "always", due_days: 14 });
  assert.match(accepted.invoice_number, /^INV-\d{4}-0001$/);
  assert.equal(accepted.totals_check.quote_total, accepted.totals_check.invoice_total);

  // The invoice really is in the INVOICE server's store, under its own number series.
  const invoices = JSON.parse(readFileSync(join(c.home, "data", "mcp-servers", "invoice", "invoices.json"), "utf8"));
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0].number, accepted.invoice_number);
  assert.equal(invoices[0].total_minor, 221400);
  assert.equal(invoices[0].currency, "EUR");
  assert.equal(invoices[0].status, "unpaid");
  assert.match(invoices[0].notes, new RegExp(`accepted quote ${created.id}`));
  // The lines are the quote's lines, not a recomputation.
  assert.deepEqual(invoices[0].lines, JSON.parse(readFileSync(join(c.home, "data", "mcp-servers", "quotes", "quotes.json"), "utf8"))[0].lines);
});

test("accept with no invoice store hands back invoice_create-ready items", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();
  const q = (await c.json("quote_create", { client: "Beta", items: ITEMS, currency: "EUR" })).created;
  const r = await c.json("quote_accept", { id: q.id });
  assert.equal(r.invoice_number, undefined);
  assert.equal(existsSync(join(c.home, "data", "mcp-servers", "invoice", "invoices.json")), false);
  assert.deepEqual(r.invoice_create_args.items, [
    { description: "API work", quantity: 12, unit_price: 90, tax_rate: 23 },
    { description: "Setup fee", quantity: 1, unit_price: 300, tax_rate: 23 },
  ]);
  assert.equal(r.invoice_create_args.currency, "EUR");
});

test("decline, report and win rate", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();
  const a = (await c.json("quote_create", { client: "Won", items: ITEMS, currency: "EUR" })).created;
  const b = (await c.json("quote_create", { client: "Lost", items: ITEMS, currency: "EUR" })).created;
  const jpy = (await c.json("quote_create", {
    client: "Tokyo", currency: "JPY", items: [{ description: "Workshop", quantity: 2, unit_price_minor: 150000 }],
  })).created;
  // JPY has no minor unit: 150000 minor IS 150,000 yen, and 2 of them is 300,000.
  assert.equal(jpy.total, "JPY 300000");

  await c.json("quote_accept", { id: a.id, create_invoice: "never" });
  const d = await c.json("quote_decline", { id: b.id, reason: "price" });
  assert.equal(d.reason, "price");

  const rep = await c.json("quote_report", {});
  assert.equal(rep.counts.accepted, 1);
  assert.equal(rep.counts.declined, 1);
  assert.equal(rep.counts.open, 1);
  assert.equal(rep.win_rate_percent, 50);
  const eur = rep.by_currency.find((x) => x.currency === "EUR");
  const yen = rep.by_currency.find((x) => x.currency === "JPY");
  assert.equal(eur.accepted.total, "EUR 1697.40");
  assert.equal(eur.declined.total, "EUR 1697.40");
  assert.equal(yen.open.total, "JPY 300000");
});

test("free tier: 5 open quotes and the text export, no PDF and no report", async (t) => {
  const c = client();
  t.after(() => c.close());
  await c.init();
  const ids = [];
  for (let i = 0; i < 5; i++) {
    ids.push((await c.json("quote_create", { client: `C${i}`, items: ITEMS, currency: "EUR" })).created.id);
  }
  const sixth = await c.call("quote_create", { client: "C5", items: ITEMS, currency: "EUR" });
  assert.equal(sixth.isError, true);
  assert.match(sixth.text, /keeps 5 quotes open/);
  assert.match(sixth.text, /https:\/\/mcp\.zovo\.one\/buy\/quotes/);

  // The text export is free, on every quote.
  const text = await c.call("quote_send_text", { id: ids[0] });
  assert.equal(text.isError, false);
  assert.match(text.text, /EUR 1697\.40/);

  // Closing one frees the slot: the cap counts OPEN quotes, not quotes.
  await c.json("quote_decline", { id: ids[0] });
  const now = await c.call("quote_create", { client: "C5", items: ITEMS, currency: "EUR" });
  assert.equal(now.isError, false, now.text);

  for (const tool of ["quote_pdf", "quote_report"]) {
    const r = await c.call(tool, { id: ids[1] });
    assert.equal(r.isError, true, `${tool} must be Pro`);
    assert.match(r.text, /Pro feature/);
  }
});

test("Pro renders an A4 PDF", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();
  const q = (await c.json("quote_create", { client: "Acme", items: ITEMS, currency: "EUR" })).created;
  const r = await c.json("quote_pdf", { id: q.id });
  assert.equal(r.document, "PDF quote");
  assert.ok(existsSync(r.path), r.path);
  assert.ok(statSync(r.path).size > 1000, `PDF is ${statSync(r.path).size} bytes`);
  assert.equal(readFileSync(r.path).subarray(0, 5).toString(), "%PDF-");
  const body = readFileSync(r.path, "latin1");
  assert.equal(/Generated with mcp-quotes/.test(body), false, "a Pro PDF carries no footer credit");
});
