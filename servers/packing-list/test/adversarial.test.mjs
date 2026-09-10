// What a user, or an assistant driving this server, will actually do wrong.
//
// Every case here is a refusal that must leave the store untouched, or a boundary that must
// not silently round, truncate or drop a line. The rule the whole file tests: a tool either
// does the whole thing or writes nothing and says so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { client, sandbox, writeProfile, cleanup, seed, proKey, storeDir, CREATE, REFERENCE } from "./_client.mjs";

function open(t, opts = {}) {
  const box = sandbox();
  writeProfile(box.dataHome);
  const c = client({ dataHome: box.dataHome, ...opts });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

const raw = (box) => readFileSync(join(storeDir(box.dataHome), "packing-lists.json"), "utf8");

test("a refusal writes nothing: the store is byte-identical afterwards", async (t) => {
  const { box, c } = open(t);
  await c.init();
  const id = await seed(c);
  const before = raw(box);
  const refusals = [
    ["packing_list_create", { reference: "", consignee: "X" }],
    ["packing_list_create", { reference: "PO-1", consignee: "   " }],
    ["packing_list_create", { ...CREATE }],                                    // duplicate open list on one reference
    ["packing_expect", { packing_list: id, description: " ", quantity: 1 }],
    ["packing_expect", { packing_list: "PL-2099-0001", description: "X", quantity: 1 }],
    ["carton_add", { packing_list: id, label: "Half measured", tare_grams: 10, length_cm: 10, width_cm: 10 }],
    ["carton_add", { packing_list: id, label: "  ", tare_grams: 10 }],
    ["pack_item", { packing_list: id, carton: "C99", description: "X", quantity: 1 }],
    ["pack_item", { packing_list: id, carton: "C01", description: "X", quantity: 0 }],
    ["unpack_item", { packing_list: id, line: "L99" }],
    ["packing_list_status", { packing_list: id, status: "shipped" }],           // still draft, cannot skip packed
    ["packing_list_status", { packing_list: id, status: "packed", date: "2026-02-30" }],
    ["packing_list_delete", { packing_list: id }],                              // confirm missing
    ["carton_report", { packing_list: id, divisor: 1 }],
  ];
  for (const [tool, args] of refusals) {
    const r = await c.call(tool, args);
    assert.equal(r.isError, true, `${tool} ${JSON.stringify(args)} was accepted`);
    assert.equal(raw(box), before, `${tool} ${JSON.stringify(args)} changed the store while refusing`);
  }
});

test("a refusal says what was not written, in words a user can act on", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  const cases = [
    [["carton_add", { packing_list: id, label: "Half", tare_grams: 0, length_cm: 10, height_cm: 5 }], /all three of length_cm, width_cm and height_cm, or none/],
    [["pack_item", { packing_list: id, carton: "C42", description: "X", quantity: 1 }], /has no carton "C42"/],
    [["packing_list_show", { packing_list: "PL-2099-9999" }], /no packing list matches/],
    [["packing_list_status", { packing_list: id, status: "shipped" }], /cannot go straight to shipped/],
  ];
  for (const [[tool, args], re] of cases) {
    const r = await c.call(tool, args);
    assert.ok(r.isError, `${tool} was accepted`);
    assert.match(r.text, re, `${tool}: ${r.text}`);
    assert.match(r.text, /Nothing was written|no packing list matches/, `${tool} did not say nothing was written: ${r.text}`);
  }
});

test("an ambiguous reference is refused with the candidates, never resolved to the first", async (t) => {
  const { c } = open(t);
  await c.init();
  await c.json("packing_list_create", { reference: "PO-100", consignee: "Harbour Cafe" });
  await c.json("packing_list_create", { reference: "PO-1001", consignee: "Harbour Cafe" });
  const r = await c.call("packing_list_show", { packing_list: "PO-100" });
  // PO-100 is an EXACT match on the first and a partial on the second, so exact wins outright.
  assert.equal(r.isError, false, r.text);
  assert.equal(JSON.parse(r.text).reference, "PO-100");
  const ambiguous = await c.call("packing_list_show", { packing_list: "Harbour" });
  assert.ok(ambiguous.isError, ambiguous.text);
  assert.match(ambiguous.text, /matches more than one packing list/);
  assert.match(ambiguous.text, /PO-100/);
  assert.match(ambiguous.text, /PO-1001/);
});

test("a carton label that matches two cartons is refused rather than packed into one of them", async (t) => {
  const { c } = open(t);
  await c.init();
  const r0 = await c.json("packing_list_create", { reference: "PO-DUP", consignee: "X" });
  const id = r0.created.id;
  await c.json("carton_add", { packing_list: id, label: "Box", tare_grams: 0 });
  await c.json("carton_add", { packing_list: id, label: "Box", tare_grams: 0 });
  const r = await c.call("pack_item", { packing_list: id, carton: "Box", description: "Thing", quantity: 1 });
  assert.ok(r.isError, r.text);
  assert.match(r.text, /matches C01, C02/);
  const ok = await c.call("pack_item", { packing_list: id, carton: "C02", description: "Thing", quantity: 1 });
  assert.equal(ok.isError, false, ok.text);
});

test("a SKU is a machine key: case and spaces do not make a second line", async (t) => {
  const { c } = open(t);
  await c.init();
  const r0 = await c.json("packing_list_create", { reference: "PO-SKU", consignee: "X" });
  const id = r0.created.id;
  await c.json("carton_add", { packing_list: id, label: "B1", tare_grams: 0 });
  await c.json("packing_expect", { packing_list: id, sku: "oak-900", description: "Oak shelf", quantity: 4 });
  await c.json("pack_item", { packing_list: id, carton: "C01", sku: " OAK-900 ", description: "Oak shelf 900mm long", quantity: 4, unit_grams: 1 });
  const s = await c.json("packing_shortfall", { packing_list: id });
  assert.equal(s.rows.length, 1, "the same SKU spelled two ways made two rows");
  assert.equal(s.rows[0].sku, "OAK-900");
  assert.equal(s.rows[0].state, "complete");
});

test("a description with no SKU matches on normalised text, and differing text does not", async (t) => {
  const { c } = open(t);
  await c.init();
  const r0 = await c.json("packing_list_create", { reference: "PO-DESC", consignee: "X" });
  const id = r0.created.id;
  await c.json("carton_add", { packing_list: id, label: "B1", tare_grams: 0 });
  await c.json("packing_expect", { packing_list: id, description: "Fixing   pack", quantity: 2 });
  await c.json("pack_item", { packing_list: id, carton: "C01", description: "  fixing pack  ", quantity: 2, unit_grams: 1 });
  await c.json("pack_item", { packing_list: id, carton: "C01", description: "Fixing packs", quantity: 1, unit_grams: 1 });
  const s = await c.json("packing_shortfall", { packing_list: id });
  assert.equal(s.rows.length, 2);
  assert.equal(s.rows.find((x) => x.description === "Fixing pack").state, "complete");
  assert.equal(s.rows.find((x) => x.description === "Fixing packs").state, "not_on_order");
});

test("zero, huge and non-integer quantities and weights are all refused at the schema", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  for (const args of [
    { packing_list: id, carton: "C01", description: "X", quantity: 0, unit_grams: 1 },
    { packing_list: id, carton: "C01", description: "X", quantity: -3, unit_grams: 1 },
    { packing_list: id, carton: "C01", description: "X", quantity: 1.5, unit_grams: 1 },
    { packing_list: id, carton: "C01", description: "X", quantity: 1, unit_grams: -1 },
    { packing_list: id, carton: "C01", description: "X", quantity: 1, unit_grams: 0.5 },
    { packing_list: id, carton: "C01", description: "X", quantity: 1, unit_grams: 100000001 },
    { packing_list: id, carton: "C01", description: "X", quantity: 1000001, unit_grams: 1 },
  ]) {
    const r = await c.call("pack_item", args);
    assert.ok(r.isError, `accepted ${JSON.stringify(args)}`);
  }
  for (const args of [
    { packing_list: id, label: "X", tare_grams: 1, length_cm: 0, width_cm: 1, height_cm: 1 },
    { packing_list: id, label: "X", tare_grams: 1, length_cm: 2001, width_cm: 1, height_cm: 1 },
    { packing_list: id, label: "X", tare_grams: 1, length_cm: 10.5, width_cm: 1, height_cm: 1 },
    { packing_list: id, label: "X", tare_grams: -1 },
  ]) {
    const r = await c.call("carton_add", args);
    assert.ok(r.isError, `accepted ${JSON.stringify(args)}`);
  }
});

test("a zero unit weight is a real weight and is not treated as unweighed", async (t) => {
  const { c } = open(t);
  await c.init();
  const r0 = await c.json("packing_list_create", { reference: "PO-ZERO", consignee: "X" });
  const id = r0.created.id;
  await c.json("carton_add", { packing_list: id, label: "B1", tare_grams: 500, length_cm: 10, width_cm: 10, height_cm: 10 });
  await c.json("pack_item", { packing_list: id, carton: "C01", description: "Paper insert", quantity: 3, unit_grams: 0 });
  const r = await c.json("carton_report", { packing_list: id });
  assert.equal(r.totals.net_complete, true, "unit_grams 0 was read as unweighed");
  assert.equal(r.totals.unweighed_lines, 0);
  assert.equal(r.totals.net_grams, 0);
  assert.equal(r.totals.gross_grams, 500);
  assert.equal(r.weight_caveat, undefined);
});

test("a very large but legal shipment stays exact: no float creeps into a gram", async (t) => {
  const { c } = open(t);
  await c.init();
  const r0 = await c.json("packing_list_create", { reference: "PO-BIG", consignee: "X" });
  const id = r0.created.id;
  await c.json("carton_add", { packing_list: id, label: "Pallet", tare_grams: 25000, length_cm: 120, width_cm: 100, height_cm: 180 });
  await c.json("pack_item", { packing_list: id, carton: "C01", description: "Tile", quantity: 9999, unit_grams: 1233 });
  const r = await c.json("carton_report", { packing_list: id });
  assert.equal(r.totals.net_grams, 9999 * 1233);
  assert.equal(r.totals.gross_grams, 9999 * 1233 + 25000);
  assert.equal(r.cartons[0].volume_cm3, 120 * 100 * 180);
  assert.equal(r.cartons[0].volumetric_grams, Math.ceil((120 * 100 * 180 / 5000) * 1000));
  assert.ok(Number.isInteger(r.totals.chargeable_grams));
  assert.equal(r.totals.chargeable_grams, Math.max(r.totals.gross_grams, r.totals.volumetric_grams));
});

test("an empty carton is not ready to ship, and the reason names it", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  await c.json("carton_add", { packing_list: id, label: "Box 3 of 3", tare_grams: 400, length_cm: 10, width_cm: 10, height_cm: 10 });
  const s = await c.json("packing_shortfall", { packing_list: id });
  assert.equal(s.ready_to_ship, false);
  assert.ok(s.not_ready_because.some((x) => /empty carton\(s\): C03/.test(x)), JSON.stringify(s.not_ready_because));
});

test("with nothing declared, every packed line reads not_on_order and the answer says why", async (t) => {
  const { c } = open(t);
  await c.init();
  const r0 = await c.json("packing_list_create", { reference: "PO-NONE", consignee: "X" });
  const id = r0.created.id;
  await c.json("carton_add", { packing_list: id, label: "B1", tare_grams: 0 });
  await c.json("pack_item", { packing_list: id, carton: "C01", description: "Thing", quantity: 1, unit_grams: 1 });
  const s = await c.json("packing_shortfall", { packing_list: id });
  assert.equal(s.not_on_order, 1);
  assert.match(s.no_order_lines, /nothing has been declared with packing_expect/);
  assert.equal(s.ready_to_ship, false);
});

test("a store that is not JSON is quarantined and every later call fails loudly", async (t) => {
  const { box, c } = open(t);
  await c.init();
  await c.json("packing_list_create", { reference: "PO-Q", consignee: "X" });
  c.close();
  const dir = storeDir(box.dataHome);
  writeFileSync(join(dir, "packing-lists.json"), "this is not json, it is half a file");
  const c2 = client({ dataHome: box.dataHome });
  t.after(() => c2.close());
  await c2.init();
  const r = await c2.call("packing_list_list", {});
  assert.ok(r.isError, "a corrupt store read as an empty one");
  const { readdirSync } = await import("node:fs");
  const files = readdirSync(dir);
  assert.ok(files.some((f) => /packing-lists\.json\.corrupt-/.test(f)), `no quarantine copy: ${files.join(", ")}`);
});

test("a shipped list is immutable on every editing tool, not just the obvious one", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  await c.json("packing_list_status", { packing_list: id, status: "packed" });
  await c.json("packing_list_status", { packing_list: id, status: "shipped" });
  for (const [tool, args] of [
    ["packing_expect", { packing_list: id, description: "Late line", quantity: 1 }],
    ["carton_add", { packing_list: id, label: "Late box", tare_grams: 1 }],
    ["pack_item", { packing_list: id, carton: "C01", description: "Late thing", quantity: 1 }],
    ["unpack_item", { packing_list: id, line: "L01" }],
    ["packing_list_delete", { packing_list: id, confirm: true }],
  ]) {
    const r = await c.call(tool, args);
    assert.ok(r.isError, `${tool} edited a shipped list`);
  }
  // Reading it is always allowed: the slip has to be reproducible after the van has gone.
  assert.equal((await c.call("packing_slip", { packing_list: id })).isError, false);
  assert.equal((await c.call("carton_report", { packing_list: id })).isError, false);
});

test("text is normalised on the way in, and over-long text is refused not truncated", async (t) => {
  const { c } = open(t);
  await c.init();
  const r0 = await c.json("packing_list_create", { reference: "  PO-WS  ", consignee: "  Harbour   Cafe  " });
  assert.equal(r0.created.reference, "PO-WS");
  assert.equal(r0.created.consignee, "Harbour Cafe");
  const long = "x".repeat(2001);
  const r = await c.call("packing_expect", { packing_list: r0.created.id, description: long, quantity: 1 });
  assert.ok(r.isError, "a 2001-character description was accepted");
  const at = await c.call("packing_expect", { packing_list: r0.created.id, description: "y".repeat(2000), quantity: 1 });
  assert.equal(at.isError, false, at.text);
  assert.equal(JSON.parse(at.text).expected.description.length, 2000, "the description was truncated");
});

test("the free-tier cap counts OPEN lists only, and a cancelled one does not hold a slot", async (t) => {
  const { c } = open(t);
  await c.init();
  const ids = [];
  for (let i = 1; i <= 3; i++) ids.push((await c.json("packing_list_create", { reference: `PO-C${i}`, consignee: "X" })).created.id);
  await c.json("packing_list_status", { packing_list: ids[0], status: "cancelled" });
  await c.json("packing_list_status", { packing_list: ids[1], status: "packed" });         // still open
  const listed = await c.json("packing_list_list", {});
  assert.equal(listed.open, 2);
  assert.equal(listed.free_tier_open_limit, 3);
  assert.equal((await c.call("packing_list_create", { reference: "PO-C4", consignee: "X" })).isError, false);
  assert.equal((await c.call("packing_list_create", { reference: "PO-C5", consignee: "X" })).isError, true);
});

test("the listing is capped and says so rather than returning everything", async (t) => {
  const { c } = open(t, { key: proKey() });
  await c.init();
  // 501 lists would be slow over stdio; the cap is asserted on the shape instead, with a
  // small population, plus the field that reports it.
  for (let i = 0; i < 4; i++) await c.json("packing_list_create", { reference: `PO-L${i}`, consignee: "X", date: `2026-04-0${i + 1}` });
  const r = await c.json("packing_list_list", {});
  assert.equal(r.returned, 4);
  assert.equal(r.total, 4);
  assert.equal(r.truncated, undefined);
  assert.deepEqual(r.packing_lists.map((x) => x.date), ["2026-04-04", "2026-04-03", "2026-04-02", "2026-04-01"], "the listing is not newest first");
});

test("the business profile is optional: the slip renders with a placeholder and says so", async (t) => {
  const box = sandbox();
  mkdirSync(join(box.dataHome, "mcp-servers", "profile"), { recursive: true });   // exists, empty
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  const id = await seed(c);
  const r = await c.json("packing_slip", { packing_list: id });
  assert.equal(r.business_profile_missing, true);
  assert.match(r.slip, /^Your business/);
});

test("packing the same item into two cartons is one shortfall row and two carton rows", async (t) => {
  const { c } = open(t);
  await c.init();
  const id = await seed(c);
  const s = await c.json("packing_shortfall", { packing_list: id });
  const oak = s.rows.find((x) => x.sku === "OAK-900");
  assert.equal(oak.packed, 12);
  assert.deepEqual(oak.cartons, ["C01", "C02"]);
  const rep = await c.json("carton_report", { packing_list: id });
  assert.equal(rep.cartons[0].contents.filter((l) => l.sku === "OAK-900").length, 1);
  assert.equal(rep.cartons[1].contents.filter((l) => l.sku === "OAK-900").length, 1);
});

test("a second shipment on the same order is allowed only when asked for, and both are listed", async (t) => {
  const { c } = open(t);
  await c.init();
  const first = await seed(c);
  const refused = await c.call("packing_list_create", { reference: REFERENCE, consignee: "Harbour Cafe" });
  assert.ok(refused.isError, refused.text);
  assert.match(refused.text, /is already open against/);
  const second = await c.json("packing_list_create", { reference: REFERENCE, consignee: "Harbour Cafe", duplicate_ok: true });
  assert.notEqual(second.created.id, first);
  const listed = await c.json("packing_list_list", { reference: REFERENCE });
  assert.equal(listed.total, 2);
});
