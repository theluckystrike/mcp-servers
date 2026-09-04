// initialize + tools/list + one tools/call over stdio, plus the free/Pro switch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, client, proKey, sandbox } from "./_client.mjs";

test("initialize, tools/list and one call", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });

  const info = await c.init();
  assert.equal(info.serverInfo.name, "mcp-barcode");
  const tools = (await c.tools()).map((x) => x.name).sort();
  assert.deepEqual(tools, [
    "barcode_batch", "barcode_create", "code_list", "invoice_payment_qr",
    "license_activate", "license_status", "qr_create", "qr_payment_sepa", "qr_vcard", "qr_wifi",
  ]);

  const r = await c.call("qr_create", { text: "https://mcp.zovo.one" });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /<svg /);
  assert.match(r.text, /error correction M/);
});

test("SVG is free, PNG is Pro, and Pro writes the file", async (t) => {
  const box = sandbox();
  const free = client({ dataHome: box.dataHome });
  t.after(() => { free.close(); cleanup(box.dir); });
  await free.init();

  const refused = await free.call("qr_create", { text: "x", format: "png", out_path: join(box.dir, "a.png") });
  assert.equal(refused.isError, false, "a tier limit is an answer, not a protocol error");
  assert.match(refused.text, /Pro feature/);
  assert.equal(existsSync(join(box.dir, "a.png")), false, "nothing may be written when the tier refuses");

  const pro = client({ dataHome: join(box.dir, "pro"), key: proKey() });
  t.after(() => pro.close());
  await pro.init();
  const out = join(box.dir, "b.png");
  const w = await pro.call("qr_create", { text: "x", format: "png", out_path: out, size: 200 });
  assert.equal(w.isError, false, w.text);
  assert.match(w.text, /Wrote .*b\.png \(\d+ bytes, PNG\)/);
  const png = readFileSync(out);
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], "the file must be a real PNG");
});

test("barcode_create writes an SVG and code_list shows the allowance", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();

  const out = join(box.dir, "ean.svg");
  const r = await c.call("barcode_create", { symbology: "ean13", value: "590123412345", out_path: out });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /5901234123457/);
  assert.match(r.text, /Check digit 7 was computed/);
  assert.match(readFileSync(out, "utf8"), /^<svg /);

  const list = await c.call("code_list", {});
  assert.match(list.text, /1 of 20 free codes used/);
  assert.match(list.text, /barcode\/ean13/);
});

test("a WiFi code carries the escaped payload and a vCard opens with BEGIN:VCARD", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();

  const w = await c.call("qr_wifi", { ssid: "Cafe;Net", password: "hunter22", auth: "WPA" });
  assert.equal(w.isError, false, w.text);
  assert.match(w.text, /Network "Cafe;Net"/);

  const v = await c.call("qr_vcard", { name: "Anna Kowalska", org: "Zovo", email: "a@b.c" });
  assert.equal(v.isError, false, v.text);
  assert.match(v.text, /Contact "Anna Kowalska"/);
});

test("invoice_payment_qr reads the IBAN and name from the shared business profile", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });

  const { mkdirSync, writeFileSync } = await import("node:fs");
  const profileDir = join(box.dataHome, "mcp-servers", "profile");
  mkdirSync(profileDir, { recursive: true });
  writeFileSync(join(profileDir, "business.json"), JSON.stringify({ name: "Zovo", iban: "DE89370400440532013000" }));

  await c.init();
  const r = await c.call("invoice_payment_qr", { amount: 120.5, reference: "INV-2026-0007" });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /pay Zovo at DE89370400440532013000, EUR 120\.50/);

  // With an invoice in the sibling store, the amount comes from the invoice.
  const invDir = join(box.dataHome, "mcp-servers", "invoice");
  mkdirSync(invDir, { recursive: true });
  writeFileSync(join(invDir, "invoices.json"), JSON.stringify([{
    number: "INV-2026-0009", currency: "EUR", decimals: 2, total_minor: 45600, client: { name: "Acme Ltd" },
  }]));
  const r2 = await c.call("invoice_payment_qr", { invoice_id: "INV-2026-0009" });
  assert.equal(r2.isError, false, r2.text);
  assert.match(r2.text, /INV-2026-0009 for Acme Ltd/);
  assert.match(r2.text, /EUR 456\.00/);
});
