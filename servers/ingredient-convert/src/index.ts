#!/usr/bin/env node
/**
 * ingredient-convert MCP server.
 *
 * Converts cooking ingredient amounts between cups, tablespoons, teaspoons,
 * millilitres, fluid ounces, grams and ounces using a real per-ingredient
 * density table (see lib.ts for sources). Deterministic: no network, no
 * clock, no randomness.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  COMMON_CONVERSIONS, INGREDIENTS, convertBulk, convertIngredient, decimalToFraction,
  findIngredient, parseFractionString, scaleRecipe,
} from "./lib.js";
import { VERSION } from "./version.js";

const VERSION_STR = VERSION;

/** Every tool returns structured JSON AND a one-line human summary. */
function ok(payload: unknown, summary: string) {
  // Contract: single text block so JSON-RPC clients can JSON.parse it directly;
  // the one-line human summary rides inside the payload as "summary".
  const body = (payload && typeof payload === "object" && !Array.isArray(payload))
    ? { summary, ...payload as Record<string, unknown> }
    : { summary, payload };
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(body, null, 2) },
    ],
  };
}
function err(text: string) {
  return { content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true };
}
function guard<A>(fn: (a: A) => ReturnType<typeof ok> | ReturnType<typeof err>) {
  return async (a: A) => {
    try { return fn(a); }
    catch (e) { return err(e instanceof Error ? e.message : String(e)); }
  };
}

const server = new McpServer({ name: "ingredient-convert", version: VERSION_STR });

const unitSchema = z.string().min(1).max(20)
  .describe("Unit: cups, tablespoons (tbsp), teaspoons (tsp), milliliters (ml), fluid ounces (floz), grams (g), ounces (oz)");

server.registerTool("convert_ingredient", {
  description: "Convert a cooking amount between cups, tbsp, tsp, ml, fl oz, g and oz via per-ingredient density.",
  inputSchema: {
    ingredient: z.string().min(1).max(60).describe("Ingredient name, e.g. 'all-purpose flour', 'butter', 'honey'"),
    amount: z.number().finite().describe("Amount to convert from"),
    unit: unitSchema.describe("Unit the amount is in"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, guard((a: { ingredient: string; amount: number; unit: string }) => {
  const r = convertIngredient(a.ingredient, a.amount, a.unit);
  const byUnit = Object.fromEntries(r.results.map((x) => [x.unit, x.amount]));
  return ok(r, `${a.amount} ${a.unit} of ${r.ingredient} = ${byUnit["grams"]} g (${byUnit["cups"]} cups, ${byUnit["tablespoons"]} tbsp).`);
}));

server.registerTool("list_ingredients", {
  description: "List the full ingredient density table (grams per US cup) with sources and aliases.",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, guard(() => {
  const table = INGREDIENTS.map((i) => ({ name: i.name, aliases: i.aliases, grams_per_cup: i.gramsPerCup, category: i.category, source: i.source }));
  return ok({ count: table.length, ingredients: table }, `${table.length} ingredients in the density table; call convert_ingredient with any name or alias.`);
}));

server.registerTool("scale_recipe", {
  description: "Scale recipe amounts by a factor (double, halve, 1.5x). Output in friendly fractions like 1 1/2 c.",
  inputSchema: {
    items: z.array(z.object({
      ingredient: z.string().min(1).max(60),
      amount: z.union([z.number().finite(), z.string().min(1).max(20)]).describe("Number or fraction string like '1 1/2'"),
      unit: z.string().min(1).max(20).optional(),
    })).min(1).max(50).describe("Recipe lines to scale"),
    factor: z.number().finite().positive().describe("Scale factor, e.g. 2 to double, 0.5 to halve"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, guard((a: { items: { ingredient: string; amount: number | string; unit?: string }[]; factor: number }) => {
  const r = scaleRecipe(a.items, a.factor);
  const line = r.items.map((i) => `${i.original} -> ${i.scaled}`).join("; ");
  return ok(r, `Scaled by ${a.factor}x: ${line.slice(0, 200)}${line.length > 200 ? "..." : ""}`);
}));

server.registerTool("convert_bulk", {
  description: "Convert many ingredient amounts at once. Unknown items are reported per item instead of failing.",
  inputSchema: {
    items: z.array(z.object({
      ingredient: z.string().min(1).max(60),
      amount: z.number().finite(),
      unit: z.string().min(1).max(20),
    })).min(1).max(100).describe("Each entry: ingredient, amount, unit"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, guard((a: { items: { ingredient: string; amount: number; unit: string }[] }) => {
  const r = convertBulk(a.items);
  const failed = r.filter((x) => x.error).length;
  return ok({ results: r, failures: failed }, `Bulk conversion: ${r.length - failed}/${r.length} converted${failed ? `, ${failed} failed (see results[].error)` : ""}.`);
}));

server.registerTool("decimal_to_fraction", {
  description: "Convert a decimal to a cooking fraction (0.5 -> 1/2, 1.75 -> 1 3/4) with a denominator cap.",
  inputSchema: {
    value: z.number().finite(),
    max_denominator: z.number().int().min(1).max(64).optional().describe("Largest denominator allowed (default 8)"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, guard((a: { value: number; max_denominator?: number }) => {
  const r = decimalToFraction(a.value, a.max_denominator ?? 8);
  return ok(r, `${a.value} = ${r.text}`);
}));

server.registerTool("fraction_to_decimal", {
  description: "Convert a recipe fraction string ('1/2', '1 1/2', '3/4') or plain number into a decimal amount.",
  inputSchema: {
    value: z.string().min(1).max(20).describe("Fraction string like '1/2' or '1 1/2', or a plain number"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, guard((a: { value: string }) => {
  const n = parseFractionString(a.value);
  return ok({ value: a.value, decimal: n }, `${a.value} = ${n}`);
}));

server.registerTool("common_conversions", {
  description: "Free lookup of top cooking conversions (1 cup flour in grams, 1 tbsp butter in grams...).",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, guard(() => {
  const q = COMMON_CONVERSIONS.map((c) => `${c.conversion} = ${c.value}`).join("; ");
  return ok({ count: COMMON_CONVERSIONS.length, conversions: COMMON_CONVERSIONS }, `${COMMON_CONVERSIONS.length} common conversions: ${q.slice(0, 180)}...`);
}));

// Validate at startup that every table entry resolves (fail fast, deterministically).
for (const i of INGREDIENTS) findIngredient(i.name);

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error(`ingredient-convert v${VERSION_STR} ready (${INGREDIENTS.length} ingredients)`);
});
