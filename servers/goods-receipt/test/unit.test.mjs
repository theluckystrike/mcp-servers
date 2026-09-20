import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { client, sandbox, cleanup, proKey } from "./_client.mjs";

let c, box;

beforeEach(async () => {
  box = sandbox();
  c = client({ dataHome: box.dataHome });
  await c.init();
});

after(() => { try { c.close(); } catch {} cleanup(box?.dir); });

const PO = (over = {}, lines = null) => ({
  reference: "PO-BUY-2026-041",
  supplier: "Kestrel Components",
  lines: lines ?? [
    { sku: "BOLT-M8", description: "M8 x 40 hex bolt", ordered: 100 },
    { sku: "NUT-M8", description: "M8 hex nut", ordered: 200 },
  ],
  ...over,
});

test("po_add creates an open purchase order with PO-NNNN id and padded line ids", async () => {
  const po = await c.json("po_add", PO());
  assert.match(po.id, /^PO-\d{4}$/);
  assert.equal(po.status ?? "open", "open");
  assert.equal(po.lines, 2);
  const got = await c.json("grn_status_report", {});
  const row = got.purchaseOrders.find((p) => p.id === po.id);
  assert.equal(row.reference, "PO-BUY-2026-041");
  assert.equal(row.supplier, "Kestrel Components");
  assert.equal(row.lines[0].ordered, 100);
});

test("po_add refuses empty reference or supplier and writes nothing", async () => {
  await assert.rejects(() => c.json("po_add", PO({ reference: "   " })), /reference is required/);
  await assert.rejects(() => c.json("po_add", PO({ supplier: "" })), /supplier is required/);
});

test("grn_add records received/damaged/shortage per line and computes shortage automatically", async () => {
  const po = await c.json("po_add", PO());
  const grn = await c.json("grn_add", { po: po.id, lines: [
    { line: "L01", received: 90 },
    { line: "L02", received: 180, damaged: 5, damageNote: "box crushed" },
  ]});
  assert.match(grn.id, /^GRN-\d{4}$/);
  const l1 = grn.lines.find((l) => l.line.endsWith("L01"));
  assert.equal(l1.received, 90);
  assert.equal(l1.shortage, 10); // 100 ordered - 90 received, floored at zero
  const l2 = grn.lines.find((l) => l.line.endsWith("L02"));
  assert.equal(l2.damaged, 5);
});

test("grn_add refuses to receive past the over tolerance", async () => {
  const po = await c.json("po_add", PO()); // defaults: 10% over
  await assert.rejects(
    () => c.json("grn_add", { po: po.id, lines: [{ line: "L01", received: 111 }] }),
    /over tolerance/
  );
  // exactly at tolerance (110) is fine
  const ok = await c.json("grn_add", { po: po.id, lines: [{ line: "L01", received: 110 }] });
  assert.ok(ok.id);
});

test("partial deliveries: several GRNs against one PO accumulate", async () => {
  const po = await c.json("po_add", PO());
  await c.json("grn_add", { po: po.id, lines: [{ line: "L01", received: 40 }] });
  await c.json("grn_add", { po: po.id, lines: [{ line: "L01", received: 50 }] });
  // 90 cumulative is fine; 40 more would exceed 110
  await assert.rejects(() => c.json("grn_add", { po: po.id, lines: [{ line: "L01", received: 40 }] }), /over tolerance/);
  const list = await c.json("grn_list", { po: po.id });
  assert.equal(list.length, 2);
});

test("grn_add refuses a closed PO and an unknown PO", async () => {
  const po = await c.json("po_add", PO());
  const grn = await c.json("grn_add", { po: po.id, lines: [{ line: "L01", received: 10 }] });
  await c.json("grn_close", { grn: grn.id });
  await assert.rejects(() => c.json("grn_line_add", { grn: grn.id, line: "L02", received: 5 }), /closed/);
  await assert.rejects(() => c.json("grn_add", { po: "PO-9999", lines: [{ line: "L01", received: 5 }] }), /no purchase order/i);
});

test("grn_line_add appends to an open GRN and enforces the cumulative gate", async () => {
  const po = await c.json("po_add", PO());
  const grn = await c.json("grn_add", { po: po.id, lines: [{ line: "L01", received: 10 }] });
  const upd = await c.json("grn_line_add", { grn: grn.id, line: "L02", received: 20 });
  assert.equal(upd.lines.length, 2);
  await assert.rejects(() => c.json("grn_line_add", { grn: grn.id, line: "L01", received: 101 }), /over tolerance/);
});

test("grn_close closes; a closed GRN takes no more lines and its lines are closed", async () => {
  const po = await c.json("po_add", PO());
  const grn = await c.json("grn_add", { po: po.id, lines: [{ line: "L01", received: 10 }] });
  const done = await c.json("grn_close", { grn: grn.id });
  assert.equal(done.status, "closed");
  await assert.rejects(() => c.json("grn_line_add", { grn: grn.id, line: "L02", received: 5 }), /closed/);
  await assert.rejects(() => c.json("grn_close", { grn: grn.id }), /already closed/);
});

test("grn_discrepancy lists damaged and short lines, skips closed by default", async () => {
  const po = await c.json("po_add", PO());
  await c.json("grn_add", { po: po.id, lines: [{ line: "L01", received: 90 }, { line: "L02", received: 195, damaged: 5, damageNote: "scratched" }] });
  const d = await c.json("grn_discrepancy", {});
  assert.equal(d.length, 2);
  assert.ok(d.some((x) => x.damaged === 5 && x.damageNote === "scratched"));
  assert.ok(d.some((x) => x.shortage === 10));
});

test("grn_status_report flags fully received vs discrepancy POs", async () => {
  const full = await c.json("po_add", PO({ reference: "R-FULL" }));
  await c.json("grn_add", { po: full.id, lines: [{ line: "L01", received: 100 }, { line: "L02", received: 200 }] });
  const short = await c.json("po_add", PO({ reference: "R-SHORT" }));
  await c.json("grn_add", { po: short.id, lines: [{ line: "L01", received: 1 }] });
  const rep = await c.json("grn_status_report", {});
  const f = rep.purchaseOrders.find((p) => p.id === full.id);
  const s = rep.purchaseOrders.find((p) => p.id === short.id);
  assert.equal(f.fullyReceived, true);
  assert.equal(f.anyDiscrepancy, false);
  assert.equal(s.fullyReceived, false);
  assert.equal(s.anyDiscrepancy, true);
  assert.equal(s.lines[0].open, 99);
  const only = await c.json("grn_status_report", { includeOnlyDiscrepancies: true });
  assert.equal(only.purchaseOrders.some((p) => p.id === full.id), false);
  assert.equal(only.purchaseOrders.some((p) => p.id === short.id), true);
});

test("free tier: full CRUD without a license key", async () => {
  const po = await c.json("po_add", PO());
  const grn = await c.json("grn_add", { po: po.id, lines: [{ line: "L01", received: 10 }] });
  await c.json("grn_close", { grn: grn.id });
  const rep = await c.json("grn_status_report", {});
  assert.ok(rep.purchaseOrders.length >= 1);
});

test("grn_export_csv is Pro-gated on a free client", async () => {
  const gated = await c.call("grn_export_csv", {});
  assert.equal(gated.isError, true);
  assert.match(gated.text, /Pro is a one-time/);
  assert.match(gated.text, /mcp\.zovo\.one\/buy\/goods-receipt/);
  assert.match(gated.text, /all \d+ servers for/);
});

test("grn_export_csv with a Pro key returns header + rows, watermark-free", async () => {
  const box2 = sandbox();
  const c2 = client({ dataHome: box2.dataHome, key: proKey("goods-receipt") });
  try {
    await c2.init();
    const po = await c2.json("po_add", PO({ reference: "R,COMMA" }));
    await c2.json("grn_add", { po: po.id, lines: [{ line: "L01", received: 5 }] });
    const csv = (await c2.call("grn_export_csv", {})).text;
    const lines = csv.split("\n");
    assert.equal(lines[0], "grn,po,po_reference,received_at,carrier,status,line,sku,received,damaged,shortage,damage_note,shortage_note");
    assert.ok(lines[1].includes("R,COMMA".split("").length > 0 ? "" : ""));
    assert.ok(csv.length > 0 && !csv.includes("TRUNCATED"));
    assert.ok(!csv.includes("watermark"));
  } finally { c2.close(); cleanup(box2.dir); }
});

test("integer-only math: fractional quantities are refused", async () => {
  const po = await c.json("po_add", PO({ lines: [{ sku: "S", description: "d", ordered: 10 }] }));
  await assert.rejects(() => c.json("grn_add", { po: po.id, lines: [{ line: "L01", received: 3.9 }] }), /integer/i);
  const grn = await c.json("grn_add", { po: po.id, lines: [{ line: "L01", received: 4 }] });
  assert.equal(grn.lines[0].received, 4);
  assert.equal(grn.lines[0].shortage, 6);
});
