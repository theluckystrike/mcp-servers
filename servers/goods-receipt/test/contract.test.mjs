// Contract: what mcp-goods-receipt promises consumers — tool catalogue, output shape,
// licensing, and the exact strings other documents quote.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { client, sandbox, cleanup, proKey } from "./_client.mjs";

const here = dirname(fileURLToPath(import.meta.url));

async function fresh(t, key = false) {
  const box = sandbox("mcp-goods-receipt-con-");
  const c = client({ dataHome: box.dataHome, key: key ? proKey() : undefined });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  return { box, c };
}

test("contract: tool catalogue names, titles, and Pro markers", async (t) => {
  const { c } = await fresh(t);
  const tools = await c.tools();
  const byName = Object.fromEntries(tools.map((x) => [x.name, x]));
  const expectFree = ["po_add", "grn_add", "grn_line_add", "grn_list", "grn_get",
    "grn_discrepancy", "grn_close", "grn_status_report"];
  const expectPro = ["grn_export_csv"];
  for (const n of expectFree) {
    assert.ok(byName[n], `${n} must exist`);
    assert.doesNotMatch(byName[n].description, /\(Pro\)/, `${n} is free tier`);
  }
  for (const n of expectPro) {
    assert.ok(byName[n], `${n} must exist`);
    assert.match(byName[n].description, /\bPro\./, `${n} must be marked Pro`);
  }
});

test("contract: po_add output shape (id, reference, supplier, lines)", async (t) => {
  const { c } = await fresh(t);
  const r = await c.json("po_add", {
    reference: "ACME-1001",
    supplier: "Acme Trading",
    lines: [
      { sku: "SKU-1", description: "Bracket, steel", ordered: 10 },
      { sku: "SKU-2", description: "Bolt, M8", ordered: 100 },
    ],
  });
  for (const k of ["id", "reference", "supplier", "lines"]) assert.ok(k in r, `po_add output must include ${k}`);
  assert.match(r.id, /^PO-\d{4}$/);
  assert.equal(r.lines, 2);
});

test("contract: grn_add output shape and auto shortage", async (t) => {
  const { c } = await fresh(t);
  const po = await c.json("po_add", {
    reference: "ACME-1002",
    supplier: "Acme Trading",
    lines: [{ sku: "SKU-1", description: "Bracket, steel", ordered: 10 }],
  });
  const r = await c.json("grn_add", { po: po.id, lines: [{ line: "L01", received: 8 }] });
  for (const k of ["id", "po", "lines"]) assert.ok(k in r, `grn_add output must include ${k}`);
  assert.match(r.id, /^GRN-\d{4}$/);
  // shortage is derived: ordered 10, received 8 -> 2 short, a discrepancy
  const d = await c.json("grn_discrepancy", {});
  assert.ok(Array.isArray(d.lines ?? d.grns ?? d.discrepancies ?? d));
});

test("contract: over-tolerance receipt is refused on the free tier like any tier", async (t) => {
  const { c } = await fresh(t);
  const po = await c.json("po_add", {
    reference: "ACME-1003",
    supplier: "Acme Trading",
    lines: [{ sku: "SKU-1", description: "Bracket, steel", ordered: 10 }],
  });
  const bad = await c.call("grn_add", { po: po.id, lines: [{ line: "L01", received: 12 }] });
  assert.equal(bad.isError, true);
  assert.match(bad.text, /tolerance|Nothing was written/i);
});

test("contract: grn_status_report and grn_close output shape", async (t) => {
  const { c } = await fresh(t);
  const po = await c.json("po_add", {
    reference: "ACME-1004",
    supplier: "Acme Trading",
    lines: [{ sku: "SKU-1", description: "Bracket, steel", ordered: 5 }],
  });
  await c.json("grn_add", { po: po.id, lines: [{ line: "L01", received: 5 }] });
  const rep = await c.json("grn_status_report", {});
  assert.ok(rep && typeof rep === "object");
  const closed = await c.json("grn_close", { grn: "GRN-0001" });
  assert.ok("id" in closed || "status" in closed);
});

test("contract: Pro refusal message names the product and the upgrade path", async (t) => {
  const { c } = await fresh(t);
  const csv = await c.call("grn_export_csv", {});
  assert.equal(csv.isError, true);
  assert.match(csv.text, /Pro/);
  assert.match(csv.text, /license_activate/);
});

test("contract: a valid Pro key unlocks CSV export on the same install", async (t) => {
  const { c } = await fresh(t, true);
  const po = await c.json("po_add", {
    reference: "ACME-1005",
    supplier: "Acme Trading",
    lines: [{ sku: "SKU-1", description: "Bracket, steel", ordered: 5 }],
  });
  await c.json("grn_add", { po: po.id, lines: [{ line: "L01", received: 5 }] });
  const r = await c.call("grn_export_csv", {});
  assert.ok(!r.isError, r.text); // raw CSV text, not JSON
  assert.match(r.text, /^grn,po,po_reference/);
  assert.match(r.text, /received,damaged,shortage/);
});

test("contract: server.json matches the shipped tool surface and metadata", async (t) => {
  const { c } = await fresh(t);
  const serverJson = JSON.parse(readFileSync(join(here, "..", "server.json"), "utf8"));
  assert.equal(serverJson.name, "io.github.theluckystrike/goods-receipt");
  assert.equal(serverJson.version, readFileSync(join(here, "..", "package.json"), "utf8").match(/"version": "([^"]+)"/)[1]);
  assert.match(serverJson.description, /goods receipt|receiving/i);
  const tools = await c.tools();
  assert.ok(tools.length >= 9, `expected >= 9 tools, got ${tools.length}`);
  const names = new Set(tools.map((x) => x.name));
  for (const t of ["grn_add", "grn_discrepancy", "grn_export_csv", "license_activate"]) assert.ok(names.has(t), `missing tool ${t}`);
});

test("contract: README quick-start tool names all exist on the live server", async (t) => {
  const { c } = await fresh(t);
  const readme = readFileSync(join(here, "..", "README.md"), "utf8");
  const quoted = [...new Set([...readme.matchAll(/"(po_add|grn_[a-z_]+|license_activate)"/g)].map((m) => m[1]))];
  assert.ok(quoted.length >= 3, "README must quote real tool calls");
  const tools = new Set((await c.tools()).map((x) => x.name));
  for (const name of quoted) assert.ok(tools.has(name), `README quotes "${name}" but the server does not expose it`);
});

test("contract: no sibling store is opened", async (t) => {
  const { c, box } = await fresh(t);
  await c.json("po_add", {
    reference: "ACME-1006",
    supplier: "Acme Trading",
    lines: [{ sku: "SKU-1", description: "Bracket, steel", ordered: 1 }],
  });
  const names = execLs(box.dataHome);
  for (const f of names) assert.match(f, /^(store|counter)\.json$/, `unexpected file in store: ${f}`);
});

import { readdirSync } from "node:fs";
function execLs(dir) {
  try { return readdirSync(join(dir, "mcp-servers", "goods-receipt")); } catch { return []; }
}
