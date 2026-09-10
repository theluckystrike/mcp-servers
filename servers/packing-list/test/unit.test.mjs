// The arithmetic, against the worked shipment in _client.mjs. Every number here was
// computed by hand in that file's header before the code was written.
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, sandbox, writeProfile, cleanup, seed, proKey, C01, C02, SHIPMENT, REFERENCE } from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  writeProfile(box.dataHome);
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

test("a carton's net, gross, volume and volumetric weight are all derived", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  const r = await c.json("carton_report", { packing_list: id });
  const [a, b] = r.cartons;
  assert.equal(a.id, "C01");
  assert.equal(a.tare_grams, C01.tare);
  assert.equal(a.net_grams, C01.net);
  assert.equal(a.gross_grams, C01.gross);
  assert.equal(a.volume_cm3, 40 * 30 * 25);
  assert.equal(a.volumetric_grams, C01.volumetric5000);
  assert.equal(a.chargeable_grams, C01.chargeable5000);
  assert.equal(a.chargeable_basis, "actual");
  assert.equal(a.net_complete, true);
  assert.equal(b.id, "C02");
  assert.equal(b.net_grams, C02.net);
  assert.equal(b.gross_grams, C02.gross);
  assert.equal(b.volumetric_grams, C02.volumetric5000);
  assert.equal(b.chargeable_grams, C02.chargeable5000);
});

test("the shipment totals sum the cartons and print kilograms to three places", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  const r = await c.json("carton_report", { packing_list: id });
  assert.equal(r.totals.tare_grams, SHIPMENT.tare);
  assert.equal(r.totals.net_grams, SHIPMENT.net);
  assert.equal(r.totals.gross_grams, SHIPMENT.gross);
  assert.equal(r.totals.volumetric_grams, SHIPMENT.volumetric5000);
  assert.equal(r.totals.chargeable_grams, SHIPMENT.chargeable5000);
  assert.equal(r.totals.gross_kg, "20.000 kg");
  assert.equal(r.totals.cartons, 2);
  assert.equal(r.totals.units, 8 + 24 + 4 + 1);
  assert.equal(r.totals.lines, 4);
});

test("the divisor changes the chargeable weight and only the chargeable weight", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  const five = await c.json("carton_report", { packing_list: id, divisor: 5000 });
  const four = await c.json("carton_report", { packing_list: id, divisor: 4000 });
  assert.equal(four.totals.gross_grams, five.totals.gross_grams);
  assert.equal(four.totals.chargeable_grams, SHIPMENT.chargeable4000);
  assert.equal(four.cartons[1].chargeable_basis, "volumetric");
  assert.equal(five.cartons[1].chargeable_basis, "actual");
  const six = await c.call("carton_report", { packing_list: id, divisor: 5500 });
  assert.ok(six.isError, six.text);
});

test("an unweighed line makes every gross figure a lower bound, and says so", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  const r = await c.json("carton_report", { packing_list: id });
  assert.equal(r.totals.net_complete, false);
  assert.equal(r.totals.unweighed_lines, 1);
  assert.match(r.weight_caveat, /LOWER BOUND/);
  assert.equal(r.cartons[0].net_complete, true);
  assert.equal(r.cartons[1].net_complete, false);
  const show = await c.json("packing_list_show", { packing_list: id });
  assert.equal(show.gross_is_lower_bound, true);
});

test("a carton with no dimensions makes the shipment chargeable weight null, not a guess", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  await c.json("carton_add", { packing_list: id, label: "Loose bundle", tare_grams: 0 });
  const r = await c.json("carton_report", { packing_list: id });
  assert.equal(r.totals.chargeable_grams, null);
  assert.equal(r.totals.volumetric_grams, null);
  assert.equal(r.totals.cartons_without_dimensions, 1);
  assert.match(r.chargeable_caveat, /no dimensions/);
  assert.equal(r.cartons[2].chargeable_grams, null);
  assert.equal(r.cartons[2].chargeable_basis, null);
});

test("the shortfall matches on SKU where there is one and on the description where there is not", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  const r = await c.json("packing_shortfall", { packing_list: id });
  assert.equal(r.short, 0);
  assert.equal(r.over, 0);
  assert.equal(r.not_on_order, 0);
  assert.equal(r.complete, 3);
  assert.equal(r.ready_to_ship, true);
  const oak = r.rows.find((x) => x.sku === "OAK-900");
  assert.equal(oak.expected, 12);
  assert.equal(oak.packed, 12);          // 8 in C01 plus 4 in C02, one row not two
  assert.deepEqual(oak.cartons, ["C01", "C02"]);
  const fixing = r.rows.find((x) => x.sku === null);
  assert.equal(fixing.key, "desc:fixing pack");
});

test("short, over and not-on-order are three different states and all three are reported", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  await c.json("unpack_item", { packing_list: id, line: "L03" });         // 4 oak shelves back out
  await c.json("pack_item", { packing_list: id, carton: "C01", sku: "BRK-STL", description: "Steel bracket", quantity: 6, unit_grams: 150 });
  await c.json("pack_item", { packing_list: id, carton: "C01", description: "Free sample mug", quantity: 2, unit_grams: 400 });
  const r = await c.json("packing_shortfall", { packing_list: id });
  const oak = r.rows.find((x) => x.sku === "OAK-900");
  const brk = r.rows.find((x) => x.sku === "BRK-STL");
  const mug = r.rows.find((x) => x.description === "Free sample mug");
  assert.equal(oak.state, "short");
  assert.equal(oak.outstanding, 4);
  assert.equal(brk.state, "over");
  assert.equal(brk.outstanding, -6);
  assert.equal(mug.state, "not_on_order");
  assert.equal(mug.expected, 0);
  assert.equal(r.ready_to_ship, false);
  assert.equal(r.not_ready_because.length, 3);
});

test("ids run PL-YYYY-NNNN, C01, E01 and L01 and never repeat inside one record", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  assert.equal(id, "PL-2026-0001");
  const p = await c.json("packing_list_show", { packing_list: id });
  assert.deepEqual(p.cartons_detail.map((x) => x.id), ["C01", "C02"]);
  assert.deepEqual(p.expected.map((x) => x.id), ["E01", "E02", "E03"]);
  assert.deepEqual(p.cartons_detail.flatMap((x) => x.contents.map((l) => l.id)), ["L01", "L02", "L03", "L04"]);
  // A removed line's id is not handed out again while its siblings still hold higher ones.
  await c.json("unpack_item", { packing_list: id, line: "L02" });
  const after = await c.json("pack_item", { packing_list: id, carton: "C01", description: "Spare", quantity: 1, unit_grams: 10 });
  assert.equal(after.packed.id, "L05");
});

test("draft to packed to shipped, and a shipped list is frozen", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  const packed = await c.json("packing_list_status", { packing_list: id, status: "packed", date: "2026-04-03" });
  assert.equal(packed.packing_list.status, "packed");
  const shipped = await c.json("packing_list_status", { packing_list: id, status: "shipped", date: "2026-04-04", carrier: "DPD", tracking: "1Z-77-4412" });
  assert.equal(shipped.packing_list.status, "shipped");
  assert.deepEqual(shipped.history.map((h) => h.status), ["draft", "packed", "shipped"]);
  const show = await c.json("packing_list_show", { packing_list: id });
  assert.equal(show.carrier, "DPD");
  assert.equal(show.tracking, "1Z-77-4412");
  assert.equal(show.shipped_date, "2026-04-04");
  for (const bad of [["draft"], ["packed"], ["cancelled"]]) {
    const r = await c.call("packing_list_status", { packing_list: id, status: bad[0] });
    assert.ok(r.isError, `${bad[0]} should be refused on a shipped list`);
  }
  const edit = await c.call("pack_item", { packing_list: id, carton: "C01", description: "Late addition", quantity: 1 });
  assert.ok(edit.isError, edit.text);
  assert.match(edit.text, /shipped and cannot be edited/);
});

test("shipping short is refused, and force ships it with the exceptions on the record", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  await c.json("unpack_item", { packing_list: id, line: "L03" });
  await c.json("packing_list_status", { packing_list: id, status: "packed" });
  const refused = await c.call("packing_list_status", { packing_list: id, status: "shipped" });
  assert.ok(refused.isError, refused.text);
  assert.match(refused.text, /still short/);
  const forced = await c.json("packing_list_status", { packing_list: id, status: "shipped", force: true });
  assert.equal(forced.packing_list.status, "shipped");
  assert.equal(forced.shipped_with_exceptions.length, 1);
  assert.match(forced.shipped_with_exceptions[0], /still short/);
});

test("the slip carries the goods, the weights and no price anywhere", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  const r = await c.json("packing_slip", { packing_list: id });
  assert.equal(r.written, false);
  const s = r.slip;
  assert.match(s, /Nova Studio/);
  assert.match(s, /PACKING SLIP {2}PL-2026-0001/);
  assert.match(s, /12 Dock Road, Bristol/);
  assert.match(s, /OAK-900 {2}Oak shelf 900mm/);
  assert.match(s, /gross 14\.400 kg/);
  assert.match(s, /gross 5\.600 kg \(at least\)/);
  assert.match(s, /Chargeable 20\.000 kg at divisor 5000/);
  assert.match(s, /carries no prices and is not an invoice/);
  assert.match(s, /Received in good order by/);
  // No money symbol and no price-shaped decimal anywhere in the document.
  assert.equal(/[$€£]/.test(s), false, "the slip must not carry a currency symbol");
});

test("the running order view groups every list on one reference", async (t) => {
  const { c } = open(t);
  await c.init();
  const first = await seed(c);
  await c.json("packing_list_status", { packing_list: first, status: "packed" });
  await c.json("packing_list_status", { packing_list: first, status: "shipped", force: true });
  const second = await c.json("packing_list_create", { reference: REFERENCE, consignee: "Harbour Cafe", date: "2026-04-10" });
  const show = await c.json("packing_list_show", { packing_list: second.created.id });
  assert.deepEqual(show.other_lists_on_this_order.map((x) => x.id), [first]);
  const listed = await c.json("packing_list_list", { reference: REFERENCE });
  assert.equal(listed.total, 2);
});

test("the free tier holds three open lists and closing one gives the slot back", async (t) => {
  const { c } = open(t);
  await c.init();
  const ids = [];
  for (let i = 1; i <= 3; i++) {
    const r = await c.json("packing_list_create", { reference: `PO-${i}`, consignee: "Harbour Cafe" });
    ids.push(r.created.id);
  }
  const fourth = await c.call("packing_list_create", { reference: "PO-4", consignee: "Harbour Cafe" });
  assert.ok(fourth.isError, fourth.text);
  assert.match(fourth.text, /free tier holds 3 open packing lists/);
  assert.match(fourth.text, /mcp\.zovo\.one\/buy\/packing-list\?src=packing-list\.packing_list_create/);
  await c.json("packing_list_status", { packing_list: ids[0], status: "cancelled" });
  const ok = await c.json("packing_list_create", { reference: "PO-4", consignee: "Harbour Cafe" });
  assert.equal(ok.created.status, "draft");
});

test("pro lifts the open-list cap and writes the slip to a file", async (t) => {
  const { box, c } = open(t, { key: proKey() });
  await c.init();
  for (let i = 1; i <= 5; i++) {
    const r = await c.call("packing_list_create", { reference: `PO-${i}`, consignee: "Harbour Cafe" });
    assert.ok(!r.isError, r.text);
  }
  const id = await seed(c, { reference: "PO-99" });
  const out = `${box.dir}/slips/one.txt`;
  const w = await c.json("packing_slip", { packing_list: id, out_path: out });
  assert.equal(w.written, true);
  assert.equal(w.path, out);
  const { readFileSync } = await import("node:fs");
  assert.match(readFileSync(out, "utf8"), /PACKING SLIP/);
});
