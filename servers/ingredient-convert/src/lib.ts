/**
 * ingredient-convert core: volume <-> mass conversion for cooking ingredients.
 *
 * Deterministic: pure arithmetic, no network, no clock, no randomness.
 *
 * DENSITY TABLE (grams per US legal cup, 236.588 ml). Sources cited per
 * ingredient; values are the widely published ones from USDA FoodData Central
 * per-100g densities converted to per-cup, and the King Arthur Baking
 * "Ingredient Weight Chart" where it disagrees with USDA (baking cups, not
 * measuring-cup physics, is what cooks actually use).
 *
 * Volume constants: US customary. 1 cup = 236.588 ml; 1 tbsp = 14.7868 ml;
 * 1 tsp = 4.92892 ml; 1 US fluid ounce = 29.5735 ml; 1 oz (mass) = 28.3495 g.
 */

export const ML_PER_CUP = 236.588;
export const ML_PER_TBSP = 14.7868;
export const ML_PER_TSP = 4.92892;
export const ML_PER_FLOZ = 29.5735;
export const G_PER_OZ = 28.3495;
export const TBSP_PER_CUP = 16;
export const TSP_PER_TBSP = 3;

export interface Ingredient {
  /** Canonical lookup name. */
  name: string;
  /** Aliases accepted on lookup (lowercase). */
  aliases: string[];
  /** Grams per US cup (236.588 ml). */
  gramsPerCup: number;
  /** Source of the gramsPerCup value. */
  source: string;
  /** Category, for list_ingredients grouping. */
  category: string;
}

/**
 * The table. Every value is the commonly published one for the form named;
 * where sources differ, King Arthur's baking weight is preferred because it
 * reflects how home cooks scoop.
 */
export const INGREDIENTS: Ingredient[] = [
  // Flours
  { name: "all-purpose flour", aliases: ["ap flour", "plain flour", "flour", "all purpose flour"], gramsPerCup: 125, source: "USDA/King Arthur (widely published 120-125; using 125)", category: "flours" },
  { name: "bread flour", aliases: ["strong flour"], gramsPerCup: 120, source: "King Arthur ingredient weight chart", category: "flours" },
  { name: "whole wheat flour", aliases: ["wholemeal flour", "wholewheat flour"], gramsPerCup: 113, source: "King Arthur ingredient weight chart", category: "flours" },
  { name: "cake flour", aliases: [], gramsPerCup: 100, source: "King Arthur ingredient weight chart", category: "flours" },
  { name: "almond flour", aliases: ["almond meal"], gramsPerCup: 96, source: "King Arthur ingredient weight chart", category: "flours" },
  { name: "cornstarch", aliases: ["corn starch", "cornflour"], gramsPerCup: 120, source: "USDA (143 g/cup bulk; 120 g/cup is the common baking reference)", category: "flours" },
  // Sugars & sweeteners
  { name: "granulated sugar", aliases: ["sugar", "white sugar", "caster sugar"], gramsPerCup: 200, source: "USDA (200 g/cup, standard)", category: "sugars" },
  { name: "brown sugar packed", aliases: ["brown sugar", "packed brown sugar"], gramsPerCup: 220, source: "USDA (packed)", category: "sugars" },
  { name: "powdered sugar", aliases: ["confectioners sugar", "icing sugar", "icing sugar sifted"], gramsPerCup: 120, source: "King Arthur (sifted/powdered)", category: "sugars" },
  { name: "honey", aliases: [], gramsPerCup: 340, source: "USDA (honey density ~1.42 g/ml)", category: "sugars" },
  { name: "maple syrup", aliases: [], gramsPerCup: 322, source: "USDA (maple syrup density ~1.32 g/ml)", category: "sugars" },
  // Dairy & fats
  { name: "butter", aliases: ["melted butter", "unsalted butter"], gramsPerCup: 227, source: "USDA (227 g/cup = 1/2 lb, standard)", category: "dairy & fats" },
  { name: "milk", aliases: ["whole milk"], gramsPerCup: 244, source: "USDA (milk ~1.03 g/ml)", category: "dairy & fats" },
  { name: "buttermilk", aliases: [], gramsPerCup: 242, source: "USDA", category: "dairy & fats" },
  { name: "heavy cream", aliases: ["double cream", "whipping cream"], gramsPerCup: 238, source: "USDA", category: "dairy & fats" },
  { name: "sour cream", aliases: [], gramsPerCup: 240, source: "USDA", category: "dairy & fats" },
  { name: "greek yogurt", aliases: ["greek yoghurt", "yogurt"], gramsPerCup: 245, source: "USDA (plain whole-milk yogurt ~1.04 g/ml)", category: "dairy & fats" },
  { name: "vegetable oil", aliases: ["oil", "canola oil", "sunflower oil"], gramsPerCup: 218, source: "USDA (vegetable oil ~0.92 g/ml)", category: "dairy & fats" },
  { name: "olive oil", aliases: ["extra virgin olive oil"], gramsPerCup: 216, source: "USDA (olive oil ~0.91 g/ml)", category: "dairy & fats" },
  // Liquids
  { name: "water", aliases: [], gramsPerCup: 236.588, source: "Density 1.0 g/ml at 4 C (definition)", category: "liquids" },
  // Grains & dry goods
  { name: "white rice", aliases: ["long grain rice", "rice"], gramsPerCup: 185, source: "USDA (uncooked long-grain)", category: "grains" },
  { name: "brown rice", aliases: [], gramsPerCup: 190, source: "USDA (uncooked)", category: "grains" },
  { name: "rolled oats", aliases: ["oats", "old fashioned oats"], gramsPerCup: 90, source: "King Arthur ingredient weight chart", category: "grains" },
  { name: "dry lentils", aliases: ["lentils"], gramsPerCup: 192, source: "USDA (uncooked lentils)", category: "grains" },
  // Leavening, cocoa, salt
  { name: "cocoa powder", aliases: ["unsweetened cocoa powder", "cocoa"], gramsPerCup: 100, source: "King Arthur/USDA published range 85-100; using 100", category: "baking" },
  { name: "salt", aliases: ["table salt"], gramsPerCup: 273, source: "USDA (table salt ~2.16 g/ml spooned)", category: "baking" },
  { name: "baking soda", aliases: ["bicarbonate of soda", "bicarb"], gramsPerCup: 230, source: "USDA (sodium bicarbonate ~0.97 g/ml? published cup weight ~230 g)", category: "baking" },
  // Nuts, seeds & spreads
  { name: "almonds", aliases: ["whole almonds"], gramsPerCup: 143, source: "USDA (whole almonds)", category: "nuts" },
  { name: "walnuts", aliases: ["chopped walnuts"], gramsPerCup: 117, source: "USDA (chopped)", category: "nuts" },
  { name: "peanuts", aliases: [], gramsPerCup: 146, source: "USDA", category: "nuts" },
  { name: "peanut butter", aliases: [], gramsPerCup: 258, source: "USDA", category: "nuts" },
  { name: "chocolate chips", aliases: ["chocolate chips semisweet", "semi sweet chocolate chips"], gramsPerCup: 170, source: "Nestle Toll House published 170 g/cup", category: "nuts" },
  // Fruit
  { name: "blueberries", aliases: ["fresh blueberries"], gramsPerCup: 148, source: "USDA", category: "fruit" },
  { name: "strawberries", aliases: ["sliced strawberries"], gramsPerCup: 144, source: "USDA (sliced)", category: "fruit" },
  { name: "raspberries", aliases: [], gramsPerCup: 125, source: "USDA (~123-125; using 125)", category: "fruit" },
  { name: "raisins", aliases: [], gramsPerCup: 145, source: "USDA", category: "fruit" },
  // Cheese
  { name: "shredded cheddar", aliases: ["cheddar shredded", "grated cheddar"], gramsPerCup: 113, source: "USDA (shredded cheddar ~113 g/cup)", category: "cheese" },
  { name: "grated parmesan", aliases: ["parmesan"], gramsPerCup: 100, source: "USDA/Kraft published 100 g/cup grated", category: "cheese" },
];

export type VolumeUnit = "cups" | "tablespoons" | "teaspoons" | "milliliters" | "fluid ounces" | "grams" | "ounces";
export type AnyUnit = VolumeUnit;

const UNIT_ALIASES: Record<string, VolumeUnit> = {
  cup: "cups", cups: "cups", c: "cups",
  tbsp: "tablespoons", tablespoon: "tablespoons", tablespoons: "tablespoons", tbs: "tablespoons", tbsps: "tablespoons",
  tsp: "teaspoons", teaspoon: "teaspoons", teaspoons: "teaspoons", tsps: "teaspoons",
  ml: "milliliters", milliliter: "milliliters", milliliters: "milliliters", millilitres: "milliliters",
  floz: "fluid ounces", "fl oz": "fluid ounces", "fluid ounce": "fluid ounces", "fluid ounces": "fluid ounces",
  g: "grams", gram: "grams", grams: "grams", gramme: "grams", grammes: "grams",
  oz: "ounces", ounce: "ounces", ounces: "ounces",
};

export function normalizeUnit(raw: string): VolumeUnit {
  const key = raw.trim().toLowerCase();
  const unit = UNIT_ALIASES[key];
  if (!unit) {
    throw new Error(`Unknown unit "${raw}". Valid units: cups, tablespoons, teaspoons, milliliters (ml), fluid ounces (floz), grams (g), ounces (oz).`);
  }
  return unit;
}

/** Look up an ingredient by canonical name or alias, case-insensitive. */
export function findIngredient(raw: string): Ingredient {
  const key = raw.trim().toLowerCase();
  for (const ing of INGREDIENTS) {
    if (ing.name === key || ing.aliases.includes(key)) return ing;
  }
  // tolerant fallback: singular/plural and word-boundary substring
  const singular = key.endsWith("s") ? key.slice(0, -1) : key;
  for (const ing of INGREDIENTS) {
    if (ing.name === singular) return ing;
    if (new RegExp(`\\b${escapeRe(singular)}\\b`).test(ing.name)) return ing;
  }
  throw new Error(
    `Unknown ingredient "${raw}". Call list_ingredients for the full table. Valid names include: ${INGREDIENTS.map((i) => i.name).join(", ")}.`,
  );
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** ml of the volume unit in one cup-equivalent factor. */
export function mlPerUnit(unit: VolumeUnit): number {
  switch (unit) {
    case "cups": return ML_PER_CUP;
    case "tablespoons": return ML_PER_TBSP;
    case "teaspoons": return ML_PER_TSP;
    case "milliliters": return 1;
    case "fluid ounces": return ML_PER_FLOZ;
    default: throw new Error(`${unit} is a mass unit`);
  }
}

/** Volume factor of the unit relative to cups. */
export function unitsPerCup(unit: VolumeUnit): number {
  return ML_PER_CUP / mlPerUnit(unit);
}

export interface ConversionResult {
  ingredient: string;
  from: { amount: number; unit: VolumeUnit };
  grams: number;
  results: { unit: VolumeUnit; amount: number }[];
  note: string;
}

/** Convert an amount of one unit to all supported units via grams. */
export function convertIngredient(ingredientName: string, amount: number, unitRaw: string): ConversionResult {
  const ing = findIngredient(ingredientName);
  const unit = normalizeUnit(unitRaw);
  if (!Number.isFinite(amount)) throw new Error("amount must be a finite number");
  if (amount === 0) throw new Error("amount must be non-zero; pass a real quantity (e.g. 0.5 cups of butter)");
  if (amount < 0) throw new Error("amount must be positive; negative amounts are not valid cooking quantities");
  if (amount > 1e6) throw new Error("amount is unreasonably large (>1,000,000); check your input");

  const gPerCup = ing.gramsPerCup;
  let grams: number;
  if (unit === "grams") {
    grams = amount;
  } else if (unit === "ounces") {
    grams = amount * G_PER_OZ;
  } else {
    grams = (amount / unitsPerCup(unit)) * gPerCup;
  }

  const results: ConversionResult["results"] = [
    { unit: "grams", amount: round(grams) },
    { unit: "ounces", amount: round(grams / G_PER_OZ) },
    { unit: "cups", amount: round(grams / gPerCup) },
    { unit: "tablespoons", amount: round(grams / gPerCup * TBSP_PER_CUP) },
    { unit: "teaspoons", amount: round(grams / gPerCup * TBSP_PER_CUP * TSP_PER_TBSP) },
    { unit: "milliliters", amount: round(grams / gPerCup * ML_PER_CUP) },
    { unit: "fluid ounces", amount: round(grams / gPerCup * ML_PER_CUP / ML_PER_FLOZ) },
  ];

  return {
    ingredient: ing.name,
    from: { amount, unit },
    grams: round(grams),
    results,
    note: `${ing.name}: ${ing.gramsPerCup} g per cup (${ing.source}).`,
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Friendly fraction string for recipe-scale output (coarse, max 1/8). */
export function friendlyFraction(n: number): string {
  const whole = Math.floor(n);
  let frac = n - whole;
  const denominators = [2, 3, 4, 8];
  let best = { den: 1, num: Math.round(frac), err: Math.abs(frac - Math.round(frac)) };
  for (const den of denominators) {
    const num = Math.round(frac * den);
    const err = Math.abs(frac - num / den);
    if (err < best.err) best = { den, num, err };
  }
  if (best.num >= best.den) { // e.g. 3/3 -> carry into whole
    return String(whole + Math.round(frac));
  }
  const wholePart = whole > 0 ? `${whole} ` : "";
  if (best.num === 0 || (best.num === Math.round(frac) && best.den === 1 && best.err < 0.02)) {
    return wholePart === "" ? String(Math.round(n * 100) / 100) : wholePart.trim();
  }
  return `${wholePart}${best.num}/${best.den}`.trim();
}

export interface ScaleResult {
  factor: number;
  items: { ingredient: string; original: string; scaled: string; scaledDecimal: number }[];
}

/**
 * Scale a list of {ingredient, amount, unit} entries by factor. Accepts
 * fractional string amounts like "1/2" or "1 1/2".
 */
export function scaleRecipe(entries: { ingredient: string; amount: number | string; unit?: string }[], factor: number): ScaleResult {
  if (!Number.isFinite(factor) || factor <= 0) throw new Error("factor must be a positive finite number (e.g. 2 to double, 0.5 to halve)");
  if (factor > 1000) throw new Error("factor is unreasonably large (>1000); check your input");
  const items = entries.map((e) => {
    const amt = typeof e.amount === "string" ? parseFractionString(e.amount) : e.amount;
    if (!Number.isFinite(amt) || amt < 0) throw new Error(`invalid amount for ${e.ingredient}: ${JSON.stringify(e.amount)}`);
    const scaled = amt * factor;
    const unit = e.unit ? normalizeUnit(e.unit) : "cups";
    return { ingredient: e.ingredient, original: `${e.amount} ${unit}`, scaled: `${friendlyFraction(scaled)} ${unit}`, scaledDecimal: round(scaled) };
  });
  return { factor, items };
}

/** Parse "1/2", "1 1/2", ".5", "2" into a number. */
export function parseFractionString(s: string): number {
  const t = s.trim();
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac) {
    if (Number(frac[2]) === 0) throw new Error(`invalid fraction "${s}" (division by zero)`);
    return Number(frac[1]) / Number(frac[2]);
  }
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error(`invalid amount "${s}"`);
  return n;
}

/** decimal_to_fraction: nearest fraction with the given denominator cap. */
export function decimalToFraction(value: number, maxDenominator = 8): { numerator: number; denominator: number; text: string } {
  if (!Number.isFinite(value)) throw new Error("value must be a finite number");
  let bestN = 0, bestD = 1, bestErr = Math.abs(value);
  for (let d = 1; d <= maxDenominator; d++) {
    const n = Math.round(value * d);
    const err = Math.abs(value - n / d);
    if (err < bestErr) { bestErr = err; bestN = n; bestD = d; }
  }
  let n = bestN, d = bestD;
  if (d === 1) return { numerator: n, denominator: 1, text: String(n) };
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(n, d);
  n /= g; d /= g;
  const whole = Math.floor(n / d);
  const rem = n - whole * d;
  const text = whole > 0 && rem > 0 ? `${whole} ${rem}/${d}` : rem > 0 ? `${n}/${d}` : String(whole);
  return { numerator: n, denominator: d, text };
}

/** Bulk grams <-> cups for many ingredients at once. */
export interface BulkItem {
  ingredient: string;
  unit: VolumeUnit;
  amount: number;
  grams?: number;
  cups?: number;
  error?: string;
}

export function convertBulk(items: { ingredient: string; amount: number; unit: string }[]): BulkItem[] {
  return items.map((it) => {
    try {
      const unit = normalizeUnit(it.unit);
      if (unit !== "grams" && unit !== "ounces" && unit !== "cups" && unit !== "tablespoons" && unit !== "teaspoons" && unit !== "milliliters" && unit !== "fluid ounces") {
        throw new Error("bad unit");
      }
      const r = convertIngredient(it.ingredient, it.amount, unit);
      const cupEntry = r.results.find((x) => x.unit === "cups")!;
      const out: BulkItem = { ingredient: r.ingredient, unit, amount: it.amount };
      out.grams = r.grams;
      out.cups = cupEntry.amount;
      return out;
    } catch (e) {
      return { ingredient: it.ingredient, unit: (UNIT_ALIASES[String(it.unit).toLowerCase()] ?? it.unit) as VolumeUnit, amount: it.amount, error: e instanceof Error ? e.message : String(e) };
    }
  });
}

/** The handful of conversions every cook googles, precomputed. */
export const COMMON_CONVERSIONS: { conversion: string; value: string }[] = [
  { conversion: "1 cup water to grams", value: "236.588 g" },
  { conversion: "1 cup all-purpose flour to grams", value: "125 g" },
  { conversion: "1 tablespoon all-purpose flour to grams", value: "7.8125 g" },
  { conversion: "1 cup granulated sugar to grams", value: "200 g" },
  { conversion: "1 tablespoon granulated sugar to grams", value: "12.5 g" },
  { conversion: "1 tablespoon butter to grams", value: "14.1875 g (about 14.2 g)" },
  { conversion: "1 cup butter to grams", value: "227 g (2 US sticks)" },
  { conversion: "1 stick of butter to grams", value: "113.5 g (1/2 cup)" },
  { conversion: "1 cup milk to grams", value: "244 g" },
  { conversion: "1 cup honey to grams", value: "340 g" },
  { conversion: "1 tablespoon honey to grams", value: "21.25 g" },
  { conversion: "1 cup brown sugar (packed) to grams", value: "220 g" },
  { conversion: "1 cup powdered sugar to grams", value: "120 g" },
  { conversion: "1 cup rolled oats to grams", value: "90 g" },
  { conversion: "1 cup cocoa powder to grams", value: "100 g" },
  { conversion: "1 cup chocolate chips to grams", value: "170 g" },
  { conversion: "1 cup vegetable oil to grams", value: "218 g" },
  { conversion: "1 teaspoon salt to grams", value: "5.69 g" },
  { conversion: "1 cup to tablespoons", value: "16 tablespoons" },
  { conversion: "1 tablespoon to teaspoons", value: "3 teaspoons" },
  { conversion: "1 fluid ounce to milliliters", value: "29.5735 ml" },
  { conversion: "1 ounce (mass) to grams", value: "28.3495 g" },
];
