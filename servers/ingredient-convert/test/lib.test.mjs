import test from "node:test";
import assert from "node:assert/strict";
import {
  ML_PER_CUP, convertBulk, convertIngredient, decimalToFraction, findIngredient,
  friendlyFraction, parseFractionString, scaleRecipe, INGREDIENTS,
} from "../dist/lib.js";

test("1 cup water = 236.588 g (density 1.0 at 4 C)", () => {
  const r = convertIngredient("water", 1, "cups");
  assert.equal(r.grams, 236.588);
  assert.equal(findIngredient("water").gramsPerCup, ML_PER_CUP);
});

test("1 cup all-purpose flour ~125 g", () => {
  const r = convertIngredient("all-purpose flour", 1, "cups");
  assert.equal(r.grams, 125);
  assert.equal(findIngredient("flour").gramsPerCup, 125);
});

test("1 tbsp butter = 14.1875 g (~14.2)", () => {
  const r = convertIngredient("butter", 1, "tablespoons");
  assert.ok(Math.abs(r.grams - 14.1875) < 0.01, String(r.grams));
  assert.equal(Math.round(r.grams * 10) / 10, 14.2);
});

test("1 cup granulated sugar = 200 g; alias 'sugar' resolves", () => {
  assert.equal(convertIngredient("granulated sugar", 1, "cups").grams, 200);
  assert.equal(findIngredient("sugar").name, "granulated sugar");
});

test("volume facts: 1 cup = 16 tbsp = 48 tsp = 29.5735 ml per floz", () => {
  const r = convertIngredient("water", 1, "cups").results;
  const get = (u) => r.find((x) => x.unit === u).amount;
  assert.equal(get("tablespoons"), 16);
  assert.equal(get("teaspoons"), 48);
  assert.equal(get("milliliters"), 236.588);
  assert.equal(get("fluid ounces"), 8);
});

test("mass conversions: 1 oz = 28.3495 g, grams passthrough", () => {
  const r = convertIngredient("water", 1, "ounces");
  assert.ok(Math.abs(r.grams - 28.3495) < 0.01, String(r.grams));
  assert.equal(convertIngredient("water", 100, "grams").grams, 100);
});

test("unknown ingredient gives explicit error listing valid names", () => {
  try {
    convertIngredient("unicorn tears", 1, "cups");
    assert.fail("should have thrown");
  } catch (e) {
    const m = e.message;
    assert.match(m, /Unknown ingredient "unicorn tears"/);
    assert.match(m, /all-purpose flour/);
    assert.match(m, /water/);
  }
});

test("unknown unit gives explicit error", () => {
  assert.throws(() => convertIngredient("water", 1, "pints"), /Unknown unit "pints"/);
});

test("zero amount rejected", () => {
  assert.throws(() => convertIngredient("water", 0, "cups"), /amount must be non-zero/);
});

test("negative amount rejected", () => {
  assert.throws(() => convertIngredient("water", -2, "cups"), /negative/);
});

test("very large amount rejected", () => {
  assert.throws(() => convertIngredient("water", 2e6, "cups"), /unreasonably large/);
});

test("determinism: same input, same output", () => {
  const a = convertIngredient("honey", 3, "tablespoons");
  const b = convertIngredient("honey", 3, "tablespoons");
  assert.deepEqual(a, b);
});

test("density table has at least 30 ingredients, all positive", () => {
  assert.ok(INGREDIENTS.length >= 30, `only ${INGREDIENTS.length}`);
  for (const i of INGREDIENTS) assert.ok(i.gramsPerCup > 0 && i.source.length > 0, i.name);
});

test("scale_recipe doubles and halves with friendly fractions", () => {
  const r = scaleRecipe([
    { ingredient: "flour", amount: "1 1/2", unit: "cups" },
    { ingredient: "sugar", amount: 0.75, unit: "cups" },
  ], 2);
  assert.equal(r.items[0].scaled, "3 cups");
  assert.equal(r.items[1].scaled, "1 1/2 cups");
  const h = scaleRecipe([{ ingredient: "milk", amount: 1, unit: "cups" }], 0.5);
  assert.equal(h.items[0].scaled, "1/2 cups");
});

test("scale_recipe rejects zero/negative/absurd factors", () => {
  assert.throws(() => scaleRecipe([{ ingredient: "milk", amount: 1 }], 0), /positive/);
  assert.throws(() => scaleRecipe([{ ingredient: "milk", amount: 1 }], -1), /positive/);
  assert.throws(() => scaleRecipe([{ ingredient: "milk", amount: 1 }], 5000), /unreasonably large/);
});

test("fraction_to_decimal parses mixed and simple fractions", () => {
  assert.equal(parseFractionString("1/2"), 0.5);
  assert.equal(parseFractionString("1 1/2"), 1.5);
  assert.equal(parseFractionString("3/4"), 0.75);
  assert.throws(() => parseFractionString("1/0"), /division by zero/);
});

test("decimal_to_fraction nearest friendly fraction", () => {
  assert.equal(decimalToFraction(0.5).text, "1/2");
  assert.equal(decimalToFraction(1.75).text, "1 3/4");
  assert.equal(decimalToFraction(0.125).text, "1/8");
  assert.equal(decimalToFraction(2).text, "2");
});

test("friendlyFraction coarse output", () => {
  assert.equal(friendlyFraction(2), "2");
  assert.equal(friendlyFraction(1.5), "1 1/2");
  assert.equal(friendlyFraction(0.25), "1/4");
});

test("convert_bulk mixes hits and per-item errors", () => {
  const r = convertBulk([
    { ingredient: "water", amount: 236.588, unit: "grams" },
    { ingredient: "all-purpose flour", amount: 2, unit: "cups" },
    { ingredient: "kryptonite", amount: 1, unit: "cups" },
  ]);
  assert.equal(r[0].grams, 236.588);
  assert.equal(r[0].cups, 1);
  assert.equal(r[1].grams, 250);
  assert.match(r[2].error || "", /Unknown ingredient "kryptonite"/);
});

test("honey is denser than water: same volume, more grams", () => {
  const honey = convertIngredient("honey", 1, "cups").grams;
  const water = convertIngredient("water", 1, "cups").grams;
  assert.ok(honey > water * 1.3, `${honey} vs ${water}`);
});
