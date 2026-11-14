// Contract suite for @theluckystrike/mcp-ingredient-convert over real stdio JSON-RPC.
// Mirrors the sibling contract suites: spawn dist/index.js, initialize, list tools,
// exercise every tool with a real case and a hostile input, assert refusals and latency.
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, cleanup } from "./_client.mjs";

const TOOL_NAMES = [
  "convert_ingredient",
  "list_ingredients",
  "scale_recipe",
  "convert_bulk",
  "decimal_to_fraction",
  "fraction_to_decimal",
  "common_conversions",
];

test("ingredient-convert announces 7 tools with short descriptions", async () => {
  const c = client();
  try {
    await c.init();
    const tools = await c.tools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [...TOOL_NAMES].sort());
    for (const t of tools) assert.ok(t.description.length < 100, `${t.name} description must be < 100 chars`);
  } finally { c.close(); cleanup(c.home); }
});

test("convert_ingredient converts 1 cup of flour to grams via the density table", async () => {
  const c = client();
  try {
    await c.init();
    const r = await c.call("convert_ingredient", { ingredient: "all-purpose flour", amount: 1, unit: "cups" });
    assert.ok(!r.isError, `expected ok, got ${r.text}`);
    assert.ok(/125/.test(r.text), `expected 125 g in ${r.text}`);
  } finally { c.close(); cleanup(c.home); }
});

test("convert_ingredient refuses an unknown ingredient with a reason, not a hang", async () => {
  const c = client();
  try {
    await c.init();
    const t0 = Date.now();
    const r = await c.call("convert_ingredient", { ingredient: "dragon scales", amount: 1, unit: "cups" });
    assert.ok(Date.now() - t0 < 5000, "must respond quickly");
    assert.ok(r.isError, `expected refusal, got ${r.text}`);
    assert.ok(r.text.length > 10, "refusal must carry a reason");
  } finally { c.close(); cleanup(c.home); }
});

test("scale_recipe doubles mixed recipe lines into friendly fractions", async () => {
  const c = client();
  try {
    await c.init();
    const r = await c.json("scale_recipe", { items: [
      { ingredient: "all-purpose flour", amount: "1 1/2", unit: "cups" },
      { ingredient: "butter", amount: 100, unit: "g" },
    ], factor: 2 });
    assert.ok(r.items, "expected scaled items");
    assert.ok(/3/.test(JSON.stringify(r.items)), "1 1/2 doubled must be 3 cups");
  } finally { c.close(); cleanup(c.home); }
});

test("convert_bulk reports unknown ingredients per item instead of failing the batch", async () => {
  const c = client();
  try {
    await c.init();
    const r = await c.json("convert_bulk", { items: [
      { ingredient: "butter", amount: 100, unit: "g" },
      { ingredient: "dragon scales", amount: 1, unit: "cups" },
    ] });
    assert.equal(r.results.length, 2);
    assert.ok(r.failures >= 1, "unknown ingredient must count as a failure");
    assert.ok(r.results[0].error === undefined || r.results[0].error === null);
  } finally { c.close(); cleanup(c.home); }
});

test("fraction helpers round-trip 1 1/2", async () => {
  const c = client();
  try {
    await c.init();
    const f = await c.json("fraction_to_decimal", { value: "1 1/2" });
    assert.equal(f.decimal, 1.5);
    const d = await c.json("decimal_to_fraction", { value: 1.5 });
    assert.ok(/1 1\/2|3\/2/.test(d.text), `expected a fraction in ${d.text}`);
  } finally { c.close(); cleanup(c.home); }
});

test("common_conversions and list_ingredients are populated", async () => {
  const c = client();
  try {
    await c.init();
    const cc = await c.json("common_conversions");
    assert.ok(cc.count > 0, "expected common conversions");
    const li = await c.json("list_ingredients");
    assert.ok(li.count >= 30, "expected the full density table");
  } finally { c.close(); cleanup(c.home); }
});
