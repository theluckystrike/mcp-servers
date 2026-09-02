// Regressions for the hostile-input probes in docs/EXPENSE_AUDIT.md.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(here, "..", "dist", "index.js");
const M = await import(join(here, "..", "dist", "money.js"));

function client(env = {}) {
  const home = mkdtempSync(join(tmpdir(), "mcp-expense-adv-"));
  const child = spawn(process.execPath, [ENTRY], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, XDG_DATA_HOME: join(home, "data"), XDG_CONFIG_HOME: join(home, "config"), MCP_LICENSE_KEY: "", ...env },
  });
  child.stderr.resume();
  let buf = "";
  const pending = new Map();
  const nonJson = [];
  child.stdout.on("data", (d) => {
    buf += d.toString();
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { nonJson.push(line); continue; }
      if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id).resolve(msg); pending.delete(msg.id); }
    }
  });
  let id = 0;
  const send = (method, params) => new Promise((resolve, reject) => {
    const myId = ++id;
    pending.set(myId, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: myId, method, params }) + "\n");
    const to = setTimeout(() => { if (pending.has(myId)) { pending.delete(myId); reject(new Error(`timeout on ${method} ${JSON.stringify(params)}`)); } }, 10000);
    to.unref();
  });
  return {
    home, nonJson, send,
    call: async (name, args) => {
      const r = await send("tools/call", { name, arguments: args ?? {} });
      if (r.error) return { text: r.error.message, isError: true };
      return { text: r.result.content.map((c) => c.text).join("\n"), isError: !!r.result.isError };
    },
    close: () => child.kill(),
  };
}

async function init(c) {
  await c.send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "adv", version: "0" } });
  c.send && null;
}

const today = new Date().toISOString().slice(0, 10);

test("regex safety: a catastrophic pattern is refused and never runs", () => {
  assert.equal(M.isSafeRegexSource("(a+)+$"), false);
  assert.equal(M.isSafeRegexSource("(a|a)*$"), false);
  assert.equal(M.isSafeRegexSource("x".repeat(101)), false);
  assert.equal(M.isSafeRegexSource("uber|bolt"), true);
  assert.equal(M.hasRegexMetacharacters("Uber"), false);
  assert.equal(M.hasRegexMetacharacters("uber|bolt"), true);
});

test("ISO 4217: real codes accepted, made-up codes rejected", () => {
  for (const c of ["EUR", "pln", "JPY", "GBP", "USD"]) assert.equal(M.isKnownCurrency(c), true, c);
  for (const c of ["XYZ", "ABC", "EU"]) assert.equal(M.isKnownCurrency(c), false, c);
});

test("hostile inputs: bounded, refused, and stdout stays JSON-RPC", async (t) => {
  const c = client();
  t.after(() => c.close());
  await init(c);

  // 1 MB free text is refused at the schema, not stored.
  const big = "M".repeat(1024 * 1024);
  assert.ok((await c.call("expense_add", { amount: 10, merchant: big })).isError);

  // Negative, non-finite and unrepresentable amounts.
  assert.ok((await c.call("expense_add", { amount: -5 })).isError);
  assert.ok((await c.call("expense_add", { amount: 1e308 })).isError);
  assert.ok((await c.call("expense_add", { amount: "12.34" })).isError);
  assert.ok((await c.call("expense_add", {})).isError);

  // Made-up currency and impossible date.
  assert.match((await c.call("expense_add", { amount: 10, currency: "XYZ" })).text, /ISO 4217/);
  assert.match((await c.call("expense_add", { amount: 10, date: "2026-13-45" })).text, /real calendar date/);

  // Receipts.
  assert.match((await c.call("expense_add", { amount: 10, receipt_path: "/nope/x.pdf" })).text, /not found/);
  assert.ok((await c.call("receipt_attach", { id: "nope", path: "/etc/passwd" })).isError);

  // An evil rule is refused, and a rule matching a long merchant returns promptly.
  const evil = await c.call("category_rules", { rules: [{ match: "(a+)+$", category: "Evil" }] });
  assert.ok(evil.isError);
  assert.match(evil.text, /not a safe regular expression/);
  await c.call("category_rules", { rules: [{ match: "uber|bolt", category: "Travel" }] });
  const t0 = Date.now();
  const long = await c.call("expense_add", { amount: 1, merchant: "a".repeat(400) + "!" });
  assert.ok(Date.now() - t0 < 3000, "rule matching must not backtrack");
  assert.ok(!long.isError);
  const hit = await c.call("expense_add", { amount: 1, merchant: "Bolt" });
  assert.match(hit.text, /Travel, from a category rule/);

  // Currency change that would rescale the minor units is refused.
  const added = await c.call("expense_add", { amount: 12.34, currency: "EUR" });
  const id = added.text.match(/Saved ([0-9a-f]+)/)[1];
  assert.match((await c.call("expense_update", { id, currency: "JPY" })).text, /decimals/);
  assert.ok(!(await c.call("expense_update", { id, currency: "JPY", amount: 1200 })).isError);

  // Export to an unwritable path fails cleanly and leaves nothing behind.
  const bad = await c.call("expense_export", { from: "2020-01-01", to: "2030-01-01", format: "csv", path: "/etc/passwd" });
  assert.ok(bad.isError);
  assert.ok(!existsSync("/etc/passwd.tmp"));

  assert.deepEqual(c.nonJson, [], "stdout carried a non-JSON line");
});

test("mixed currencies rebill as separate groups, never summed", async (t) => {
  const c = client();
  t.after(() => c.close());
  await init(c);
  await c.call("expense_add", { amount: 61.5, currency: "EUR", vat_rate: 23, project: "Acme", billable: true, merchant: "Media Markt" });
  await c.call("expense_add", { amount: 23, currency: "PLN", vat_rate: 23, project: "Acme", billable: true, merchant: "Bolt" });
  const r = await c.call("expense_to_invoice", { project: "Acme", from: today, to: today });
  const out = JSON.parse(r.text);
  assert.deepEqual(out.currencies.sort(), ["EUR", "PLN"]);
  assert.equal(out.line_items_per_currency.length, 2);
  const eur = out.line_items_per_currency.find((g) => g.currency === "EUR");
  assert.equal(eur.items[0].unit_price, 50);   // 61.50 gross at 23% = 50.00 net
  assert.equal(eur.items[0].tax_rate, 23);
  assert.equal(eur.total_net, "EUR 50.00");
});

test("free export cap writes no partial file", async (t) => {
  const c = client();
  t.after(() => c.close());
  await init(c);
  const home = mkdtempSync(join(tmpdir(), "mcp-expense-out-"));
  const out = join(home, "x.csv");
  for (let i = 0; i < 3; i++) await c.call("expense_add", { amount: 1, currency: "EUR" });
  const okr = await c.call("expense_export", { from: "2000-01-01", to: "2100-01-01", format: "csv", path: out });
  assert.ok(!okr.isError);
  assert.ok(existsSync(out));
  const xlsx = join(home, "y.xlsx");
  const gatedR = await c.call("expense_export", { from: "2000-01-01", to: "2100-01-01", format: "xlsx", path: xlsx });
  assert.ok(!gatedR.isError, "a limit is information, not a transport error");
  assert.equal(existsSync(xlsx), false, "no partial file on a gated export");
});

test("expense_settings: an opted-in default VAT rate splits an expense that names no rate", async (t) => {
  const c = client();
  t.after(() => c.close());
  await init(c);
  const none = JSON.parse((await c.call("expense_settings", {})).text);
  assert.equal(none.default_vat_rate, null);
  const bare = await c.call("expense_add", { amount: 61.5, currency: "EUR", merchant: "Media Markt" });
  assert.match(bare.text, /No VAT rate was given/);
  await c.call("expense_settings", { default_vat_rate: 23 });
  const split = await c.call("expense_add", { amount: 61.5, currency: "EUR", merchant: "Media Markt" });
  assert.match(split.text, /Net EUR 50\.00, VAT EUR 11\.50 at 23% \(your default rate\)/);
  const explicit = await c.call("expense_add", { amount: 61.5, currency: "EUR", vat_rate: 0 });
  assert.match(explicit.text, /No VAT rate was given/);
  assert.ok((await c.call("expense_settings", { default_currency: "XYZ" })).isError);
});

test("markup rebill is free and keeps the tax_rate on the net line", async (t) => {
  const c = client();
  t.after(() => c.close());
  await init(c);
  await c.call("expense_settings", { default_vat_rate: 23 });
  await c.call("expense_add", { amount: 61.5, currency: "EUR", project: "Acme", billable: true, merchant: "Media Markt" });
  const r = await c.call("expense_to_invoice", { project: "Acme", from: today, to: today, markup_percent: 10 });
  assert.ok(!r.isError, r.text);
  const out = JSON.parse(r.text);
  const item = out.line_items_per_currency[0].items[0];
  assert.equal(item.unit_price, 55);      // net 50.00 + 10% markup
  assert.equal(item.tax_rate, 23);        // the invoice recomputes the VAT, never on the gross
  assert.equal(out.markup_percent, 10);
  assert.equal(out.marked_rebilled, true);
});
