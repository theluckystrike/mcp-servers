#!/usr/bin/env node
import { homedir } from "node:os";
import { isAbsolute, join, resolve as resolvePath } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, readSharedProfile, withFileLock } from "@theluckystrike/mcp-license";
import { currencyDecimals, formatMoney, type Business } from "@theluckystrike/mcp-invoice/lib";
import { renderDocPdf } from "@theluckystrike/mcp-billing-docs/lib";
import { isIsoDate, today } from "@theluckystrike/mcp-quotes/lib";
import { z } from "zod";
import { VERSION } from "./version.js";
import {
  DEFAULT_TIER, MAX_HOURS, MAX_LINES, MAX_MINOR, MAX_PRICE_ROWS, MAX_QUANTITY, MAX_RATE_ROWS,
  MAX_ROWS, MAX_VAT, ROLE_PATTERN, SKU_PATTERN,
  invoiceItems, lineValueMinor, major, normaliseCurrency, normaliseRole, normaliseSku,
  normaliseText, normaliseTier, pairsOf, priceAsOf, priceRowKey, productKey, quoteItems,
  rateAsOf, rateRowKey, resolutionTotals, rowKey, sortRows, supersededBy,
  type PriceRow, type RateCard, type RateRow, type ResolvedLine, type Sku, type UsageRow,
} from "./catalogue.js";
import {
  dataDir, getRates, getRegister, getSkus, lockPath, nextResolutionId, resolveRate,
  resolveSku, setRates, setRegister, setSkus,
} from "./store.js";

/**
 * Free tier: TWENTY-FIVE SKUs, and every text answer.
 *
 * What is metered is the SIZE of the catalogue and the tier machinery, not the ability to
 * price a line. A price list that withheld `lines_resolve` would withhold the one thing
 * the invoice and quote servers came here for, and a catalogue nobody can read is not a
 * catalogue. Deleting an unused SKU is free on every tier, so the cap is one you can get
 * back under without a key (docs/RECOVERABLE_SLOTS_RESULT.md).
 */
const FREE_SKUS = 25;
const MAX_NAME = 200;
const MAX_TEXT = 2000;

const gate = createLicenseGate({ product: "catalogue" });

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true as const });
const json = (v: unknown) => ok(JSON.stringify(v, null, 2));

const str = (field: string, max: number) => z.string().max(max, `${field} must be ${max} characters or fewer`);

/** Only this server's own store is written, so there is one lock and it is this one. */
function locked<T>(fn: () => T | Promise<T>): Promise<T> {
  return withFileLock(lockPath(), fn, { timeoutMs: 20000 });
}

function checkDate(value: string, field: string): string {
  if (!isIsoDate(value)) throw new Error(`cannot read a date: ${field} "${value}" is not a real date in YYYY-MM-DD form. Nothing was written.`);
  return value;
}

function requirePro(feature: string, toolName: string): void {
  if (!gate.isPro()) throw new Error(`${feature} is Pro. Nothing was written. ${gate.upgradeText(feature, toolName)}`);
}

/**
 * A tier other than the default is Pro. One price list is the free product; a second
 * column of prices for one product is the thing a business with trade customers pays for.
 */
function checkTier(tier: string, toolName: string): string {
  if (tier !== DEFAULT_TIER && !gate.isPro()) {
    throw new Error(
      `tier "${tier}" is a second price for the same product, and price tiers are Pro. The free tier keeps one price list, "${DEFAULT_TIER}". ` +
      `Nothing was written. ${gate.upgradeText("price tiers", toolName)}`,
    );
  }
  return tier;
}

function expandPath(p: string): string {
  const s = p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
  return isAbsolute(s) ? s : resolvePath(process.cwd(), s);
}

const money = (minor: number, currency: string) => formatMoney(minor, currency);

const BASIS =
  "No current price is stored. A SKU holds its price ROWS with the day each came into force, and the price on a date is the latest valid_from at or before it, worked out on the call. " +
  "Prices are held in whole minor units because the two sibling servers take them in different scales: invoice_create takes unit_price in MAJOR units and quote_create takes unit_price_minor in MINOR units.";

/* ---------------------------------------------------------- shared profile */

const profileCurrency = (): string => (readSharedProfile().default_currency ?? "EUR").toUpperCase();

/** VAT for a line with no rate of its own. The profile's rate, or zero when it carries none. */
function profileTaxRate(): { rate: number; source: "shared profile" | "none" } {
  const r = readSharedProfile().default_tax_rate;
  return typeof r === "number" && Number.isFinite(r) ? { rate: r, source: "shared profile" } : { rate: 0, source: "none" };
}

const PLACEHOLDER_ISSUER = "Your business";

/**
 * The name and address at the top of the price list.
 *
 * Built from the SHARED profile, not from the invoice server's own `getBusiness()`, on
 * purpose: `getBusiness` calls the invoice store's `dataDir()`, which CREATES
 * `mcp-servers/invoice/` as a side effect of a read. A catalogue that prints a price list
 * should not bring another server's directory into existence, and `contract.test.mjs`
 * asserts that the only sibling path this process touches is the shared profile file.
 */
function issuer(): Business {
  const p = readSharedProfile();
  return {
    name: p.name?.trim() ? p.name : PLACEHOLDER_ISSUER,
    address: p.address, email: p.email, vat_id: p.vat_id,
    iban: p.iban, bank: p.bank, logo_path: p.logo_path,
    default_currency: (p.default_currency ?? "EUR").toUpperCase(),
    default_tax_rate: typeof p.default_tax_rate === "number" ? p.default_tax_rate : 0,
    payment_terms_days: p.payment_terms_days ?? 14,
    invoice_prefix: p.invoice_prefix ?? "INV",
  };
}

const businessMissing = (): boolean => !readSharedProfile().name?.trim();

/* ------------------------------------------------------------------ shaping */

function rowJson(r: PriceRow) {
  return {
    currency: r.currency, tier: r.tier, valid_from: r.valid_from,
    price: money(r.amount_minor, r.currency), price_minor: r.amount_minor,
  };
}

function skuSummary(s: Sku, date: string, currency?: string, tier?: string) {
  const cur = currency ?? profileCurrency();
  const t = tier ?? DEFAULT_TIER;
  const row = priceAsOf(s, cur, t, date);
  return {
    sku: s.sku, name: s.name, unit: s.unit, vat_rate: s.vat_rate,
    rows: s.prices.length,
    currencies: [...new Set(s.prices.map((r) => r.currency))].sort(),
    tiers: [...new Set(s.prices.map((r) => r.tier))].sort(),
    in_force: row ? rowJson(row) : null,
    in_force_on: date,
    no_price: row ? undefined : `no ${cur} price at tier ${t} on ${date}`,
  };
}

function skuDetail(s: Sku, date: string) {
  return {
    ...skuSummary(s, date),
    note: s.note ?? null,
    price_rows: sortRows(s.prices).map(rowJson),
    pairs: pairsOf(s),
    created: s.created, updated: s.updated,
  };
}

function rateJson(c: RateCard, date: string, currency?: string) {
  const cur = currency ?? profileCurrency();
  const row = rateAsOf(c, cur, date);
  return {
    role: c.role, sku: c.sku, note: c.note ?? null,
    rows: c.rates.length,
    currencies: [...new Set(c.rates.map((r) => r.currency))].sort(),
    in_force: row ? { currency: row.currency, valid_from: row.valid_from, hourly: money(row.hourly_minor, row.currency), hourly_minor: row.hourly_minor } : null,
    in_force_on: date,
    rate_rows: sortRows(c.rates.map((r) => ({ ...r, tier: "" }))).map((r) => ({
      currency: r.currency, valid_from: r.valid_from,
      hourly: money(r.hourly_minor, r.currency), hourly_minor: r.hourly_minor,
    })),
    created: c.created, updated: c.updated,
  };
}

/* ------------------------------------------------------------------- server */

const server = new McpServer(
  { name: "mcp-catalogue", version: VERSION },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

const skuArg = str("sku", MAX_NAME).describe("The SKU code, e.g. WEB-AUDIT, or the product name when only one product carries it");
const currencyArg = z.string().regex(/^[A-Za-z]{3}$/, "currency must be a 3-letter ISO code such as EUR");

server.registerTool("sku_set", {
  title: "Add or reprice a SKU",
  description: "Add a catalogue line or reprice one: a code, a name, a unit, an optional VAT rate, and a price in minor units for one currency, tier and valid-from date. Free tier: 25 SKUs.",
  inputSchema: {
    sku: str("sku", 64).describe("The code, e.g. WEB-AUDIT. Upper case, no spaces. This is what an invoice line is filed under"),
    name: str("name", MAX_NAME).describe("What it is on the customer's document, e.g. Website audit"),
    unit: str("unit", 40).optional().describe("What one of it is: each, hour, month, 1000 words. Default each. Required the first time"),
    currency: currencyArg.optional().describe("ISO code this price is in. Defaults to the shared business profile's currency"),
    price_minor: z.number().int().min(0).max(MAX_MINOR).describe("The price of ONE, in whole minor units. 45000 is EUR 450.00. Never a decimal"),
    tier: str("tier", 40).optional().describe(`Price tier, e.g. trade or list. Default ${DEFAULT_TIER}. A second tier is Pro`),
    valid_from: str("valid_from", 10).optional().describe("The first day this price applies, YYYY-MM-DD. Default today"),
    vat_rate: z.number().finite().min(0).max(MAX_VAT).optional().describe("VAT percent for this product, overriding the shared profile's default on a resolved line"),
    note: str("note", MAX_TEXT).optional(),
    duplicate_ok: z.boolean().optional().describe("Add it even though another code already carries the same product at the same price. Default false"),
  },
}, async (a) => {
  try {
    const code = normaliseSku(a.sku);
    if (!SKU_PATTERN.test(code)) {
      throw new Error(`"${a.sku}" is not a SKU code. A code is up to 64 characters of A-Z, 0-9, dot, dash, slash or underscore, e.g. WEB-AUDIT. Nothing was written.`);
    }
    const name = normaliseText(a.name);
    if (!name) throw new Error("name is empty. A catalogue line an invoice cannot describe is a line the customer will query. Nothing was written.");
    const currency = normaliseCurrency(a.currency ?? profileCurrency());
    const tier = checkTier(normaliseTier(a.tier), "sku_set");
    if (!tier) throw new Error("tier is empty. Nothing was written.");
    const validFrom = a.valid_from ? checkDate(a.valid_from, "valid_from") : today();
    const unit = a.unit ? normaliseText(a.unit) : undefined;

    const out = await locked(() => {
      const list = getSkus();
      const now = new Date().toISOString();
      const existing = list.find((s) => s.sku === code);
      const row: PriceRow = { currency, tier, valid_from: validFrom, amount_minor: a.price_minor, created: now };

      if (existing) {
        // A call that changes nothing is refused BY NAME rather than rewriting `updated`
        // and reporting a repricing that did not happen.
        const same = existing.prices.find((r) => priceRowKey(r) === priceRowKey(row));
        const identical = same && same.amount_minor === row.amount_minor
          && existing.name === name
          && (unit === undefined || existing.unit === unit)
          && (a.vat_rate === undefined || existing.vat_rate === a.vat_rate)
          && (a.note === undefined || existing.note === a.note);
        if (identical) {
          throw new Error(
            `${existing.sku} already says exactly that: ${existing.name}, per ${existing.unit}, ${money(same!.amount_minor, currency)} at tier ${tier} from ${validFrom}. ` +
            `Nothing was written. Change the price, the date or the tier, or leave it as it is.`,
          );
        }
        if (existing.prices.length >= MAX_PRICE_ROWS && !same) {
          throw new Error(`${existing.sku} already carries ${MAX_PRICE_ROWS} price rows, which is the ceiling. Nothing was written.`);
        }
        // An update REPLACES the row for that currency, tier and valid_from. Two rows on
        // one key would make "the price on that day" a coin toss.
        const kept = existing.prices.filter((r) => priceRowKey(r) !== priceRowKey(row));
        const replaced = existing.prices.length !== kept.length ? existing.prices.find((r) => priceRowKey(r) === priceRowKey(row))! : null;
        existing.prices = sortRows([...kept, row]);
        existing.name = name;
        if (unit !== undefined) existing.unit = unit;
        if (a.vat_rate !== undefined) existing.vat_rate = a.vat_rate;
        if (a.note !== undefined) existing.note = a.note;
        existing.updated = now;
        setSkus(list);
        return { s: existing, created: false, replaced, twin: null as Sku | null, count: list.length };
      }

      // A NEW code. Duplicate BEFORE the cap: the refusal names a code rather than
      // selling an upgrade, and burns neither a slot nor a place in the price list.
      const key = productKey(name, unit ?? "each", row);
      const twin = list.find((s) => s.prices.some((r) => productKey(s.name, s.unit, r) === key)) ?? null;
      if (twin && !a.duplicate_ok) {
        throw new Error(
          `${twin.sku} is already this product: ${twin.name}, per ${twin.unit}, ${money(a.price_minor, currency)} at tier ${tier}. ` +
          `Nothing was written. Reprice ${twin.sku} instead, or pass duplicate_ok true if this really is a second product with the same name and price.`,
        );
      }
      if (!gate.isPro() && list.length >= FREE_SKUS) {
        throw new Error(
          `the free tier holds ${FREE_SKUS} SKUs and the catalogue already has ${list.length}. ` +
          `Deleting one that has never priced a line is free on every tier (sku_delete). Nothing was written. ` +
          gate.upgradeText("an unlimited catalogue", "sku_set"),
        );
      }
      const s: Sku = {
        sku: code, name, unit: unit ?? "each",
        vat_rate: a.vat_rate ?? null,
        prices: [row], note: a.note, created: now, updated: now,
      };
      list.push(s);
      setSkus(list);
      return { s, created: true, replaced: null as PriceRow | null, twin, count: list.length };
    });

    const notes: string[] = [];
    if (out.replaced) {
      notes.push(`The ${currency} ${tier} row from ${validFrom} was replaced: ${money(out.replaced.amount_minor, currency)} became ${money(a.price_minor, currency)}. One row per currency, tier and valid_from, or the price on that day would be a coin toss.`);
    }
    if (out.twin) notes.push(`${out.twin.sku} carries the same product at the same price and was allowed through because duplicate_ok was passed.`);
    const future = out.s.prices.filter((r) => r.valid_from > today());
    if (future.length) notes.push(`${future.length} row(s) on this SKU are dated in the future and are not in force yet: ${future.map((r) => `${r.currency} ${r.tier} from ${r.valid_from}`).join(", ")}.`);
    if (!gate.isPro()) notes.push(`Free tier: ${out.count} of ${FREE_SKUS} SKUs. Price tiers, price_list_pdf and catalogue_report are Pro.`);
    return json({
      [out.created ? "created" : "updated"]: skuDetail(out.s, today()),
      next: "Price a customer's lines with lines_resolve, which hands back invoice_create-ready and quote_create-ready items.",
      notes, basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("sku_get", {
  title: "The price of one SKU on a date",
  description: "Show the price of one SKU as of a date, in one currency and tier: the row picked is the latest valid_from at or before that date, and the answer names the row and any later one already booked. Free.",
  inputSchema: {
    sku: skuArg,
    date: str("date", 10).optional().describe("The day the price is wanted for, YYYY-MM-DD. Default today"),
    currency: currencyArg.optional().describe("Defaults to the shared business profile's currency"),
    tier: str("tier", 40).optional().describe(`Price tier. Default ${DEFAULT_TIER}`),
  },
}, async (a) => {
  try {
    const date = a.date ? checkDate(a.date, "date") : today();
    const currency = normaliseCurrency(a.currency ?? profileCurrency());
    const tier = checkTier(normaliseTier(a.tier), "sku_get");
    const s = resolveSku(getSkus(), a.sku);
    const row = priceAsOf(s, currency, tier, date);
    const all = s.prices.filter((r) => r.currency === currency && r.tier === tier);
    if (!row) {
      const earliest = all.length ? sortRows(all)[0] : null;
      throw new Error(
        `${s.sku} has no ${currency} price at tier ${tier} on ${date}. ` +
        (earliest
          ? `Its earliest ${currency} ${tier} row starts ${earliest.valid_from}, and a price that did not exist yet is not a price, so nothing was priced. Ask for a date on or after ${earliest.valid_from}, or run sku_set with an earlier valid_from.`
          : `It carries no ${currency} ${tier} row at all: ${s.prices.length ? pairsOf(s).map((p) => `${p.currency} ${p.tier}`).join(", ") : "no rows"}. Nothing was priced and no price was invented.`),
      );
    }
    const next = supersededBy(s, row);
    return json({
      sku: s.sku, name: s.name, unit: s.unit,
      date, currency, tier,
      price: money(row.amount_minor, currency), price_minor: row.amount_minor,
      vat_rate: s.vat_rate,
      from_row: { valid_from: row.valid_from, currency: row.currency, tier: row.tier, price_minor: row.amount_minor },
      why: `${s.sku} carries ${all.length} ${currency} row(s) at tier ${tier}; the latest valid_from at or before ${date} is ${row.valid_from}.`,
      superseded_by: next ? { valid_from: next.valid_from, price: money(next.amount_minor, currency), price_minor: next.amount_minor } : null,
      rows_considered: sortRows(all).map(rowJson),
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("sku_list", {
  title: "List the catalogue",
  description: "List catalogue lines with the price in force today, filtered by code prefix, by currency and by tier. A SKU with no price in that currency and tier is listed and said to have none. Free.",
  inputSchema: {
    prefix: str("prefix", 64).optional().describe("Only codes starting with this, e.g. HOST- for every hosting line"),
    currency: currencyArg.optional().describe("The currency the price in force is shown in. Defaults to the profile's"),
    tier: str("tier", 40).optional().describe(`Price tier. Default ${DEFAULT_TIER}`),
    date: str("date", 10).optional().describe("Show the price in force on this day instead of today, YYYY-MM-DD"),
    limit: z.number().int().min(1).max(MAX_ROWS).optional().describe(`Maximum rows returned, default and ceiling ${MAX_ROWS}`),
  },
}, async (a) => {
  try {
    const date = a.date ? checkDate(a.date, "date") : today();
    const currency = normaliseCurrency(a.currency ?? profileCurrency());
    const tier = checkTier(normaliseTier(a.tier), "sku_list");
    const prefix = a.prefix ? normaliseSku(a.prefix) : null;
    let list = getSkus();
    if (prefix) list = list.filter((s) => s.sku.startsWith(prefix));
    const sorted = [...list].sort((x, y) => x.sku.localeCompare(y.sku));
    const limit = a.limit ?? MAX_ROWS;
    const priced = sorted.filter((s) => priceAsOf(s, currency, tier, date));
    return json({
      count: sorted.length,
      truncated: sorted.length > limit,
      date, currency, tier,
      priced: priced.length,
      without_price: sorted.length - priced.length,
      skus: sorted.slice(0, limit).map((s) => skuSummary(s, date, currency, tier)),
      free_tier_sku_limit: gate.isPro() ? null : FREE_SKUS,
      note: "Prices are never converted. This server holds no exchange rate, so a EUR row shown under a PLN heading would be an invented price.",
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("sku_delete", {
  title: "Delete an unused SKU",
  description: "Delete a catalogue line no rate card points at and that never priced a resolved line, freeing a free-tier slot. Otherwise it is refused, naming what depends on it: reprice it to withdraw it instead.",
  inputSchema: { sku: skuArg },
}, async (a) => {
  try {
    const out = await locked(() => {
      const list = getSkus();
      const s = resolveSku(list, a.sku);
      const cards = getRates().filter((c) => c.sku === s.sku);
      if (cards.length) {
        throw new Error(
          `${s.sku} is the SKU on ${cards.length} rate card(s) (${cards.map((c) => c.role).join(", ")}) and cannot be deleted. ` +
          `Point those cards at another SKU with rate_set first, or leave this one in the catalogue. Nothing was written.`,
        );
      }
      const used = getRegister().find((u) => u.kind === "sku" && u.ref === s.sku);
      if (used) {
        throw new Error(
          `${s.sku} has priced ${used.times} resolved line(s), the last on ${used.last_used} under ${used.last_resolution}, and cannot be deleted. ` +
          `A code that is printed on a document somebody sent is a fact about that document. Reprice it to withdraw it from sale; the history stays true. Nothing was written.`,
        );
      }
      const rest = list.filter((x) => x.sku !== s.sku);
      setSkus(rest);
      return { s, rest };
    });
    return json({
      deleted: { sku: out.s.sku, name: out.s.name, unit: out.s.unit, rows: out.s.prices.length },
      skus: out.rest.length,
      free_tier_sku_limit: gate.isPro() ? null : FREE_SKUS,
      note: "Deleting is free on every tier. A way back under the cap that only a Pro key can reach is not a way back.",
    });
  } catch (e) { return fail((e as Error).message); }
});

/* -------------------------------------------------------------- rate cards */

server.registerTool("rate_set", {
  title: "Set a labour rate",
  description: "Set the hourly charge-out rate on a labour card: role, currency, hourly_minor in whole MINOR units and the day it starts. The same role, currency and date REPLACES that row rather than adding one. Free.",
  inputSchema: {
    role: str("role", 64).describe("The role charged for, e.g. senior developer. Lower case, this is what an hours line is priced from"),
    currency: currencyArg.optional().describe("ISO code this rate is in. Defaults to the shared business profile's currency"),
    hourly_minor: z.number().int().min(0).max(MAX_MINOR).describe("The hourly rate in whole minor units. 8500 is EUR 85.00 an hour. Never a decimal"),
    valid_from: str("valid_from", 10).optional().describe("The first day this rate applies, YYYY-MM-DD. Default today"),
    sku: str("sku", 64).optional().describe("A catalogue code this role bills under, so a resolved hours line carries the SKU's name and VAT rate"),
    note: str("note", MAX_TEXT).optional(),
  },
}, async (a) => {
  try {
    const role = normaliseRole(a.role);
    if (!ROLE_PATTERN.test(role)) {
      throw new Error(`"${a.role}" is not a role name. A role is up to 64 characters of letters, digits, spaces, dot, dash, slash or underscore, e.g. senior developer. Nothing was written.`);
    }
    const currency = normaliseCurrency(a.currency ?? profileCurrency());
    const validFrom = a.valid_from ? checkDate(a.valid_from, "valid_from") : today();
    const out = await locked(() => {
      const skus = getSkus();
      let linked: string | null = null;
      if (a.sku !== undefined) linked = resolveSku(skus, a.sku).sku;
      const list = getRates();
      const now = new Date().toISOString();
      const row: RateRow = { currency, valid_from: validFrom, hourly_minor: a.hourly_minor, created: now };
      const existing = list.find((c) => c.role === role);
      if (existing) {
        const same = existing.rates.find((r) => rateRowKey(r) === rateRowKey(row));
        if (same && same.hourly_minor === row.hourly_minor && (a.sku === undefined || existing.sku === linked) && (a.note === undefined || existing.note === a.note)) {
          throw new Error(
            `the ${existing.role} rate card already says exactly that: ${money(same.hourly_minor, currency)} an hour from ${validFrom}. Nothing was written.`,
          );
        }
        if (existing.rates.length >= MAX_RATE_ROWS && !same) {
          throw new Error(`the ${existing.role} rate card already carries ${MAX_RATE_ROWS} rows, which is the ceiling. Nothing was written.`);
        }
        const kept = existing.rates.filter((r) => rateRowKey(r) !== rateRowKey(row));
        const replaced = existing.rates.length !== kept.length ? existing.rates.find((r) => rateRowKey(r) === rateRowKey(row))! : null;
        existing.rates = [...kept, row].sort((x, y) => x.currency.localeCompare(y.currency) || x.valid_from.localeCompare(y.valid_from));
        if (a.sku !== undefined) existing.sku = linked;
        if (a.note !== undefined) existing.note = a.note;
        existing.updated = now;
        setRates(list);
        return { c: existing, created: false, replaced };
      }
      const c: RateCard = { role, sku: linked, rates: [row], note: a.note, created: now, updated: now };
      list.push(c);
      setRates(list);
      return { c, created: true, replaced: null as RateRow | null };
    });
    const notes: string[] = [];
    if (out.replaced) notes.push(`The ${currency} row from ${validFrom} was replaced: ${money(out.replaced.hourly_minor, currency)} became ${money(a.hourly_minor, currency)} an hour.`);
    if (out.c.sku) notes.push(`Hours resolved for ${out.c.role} will be described with SKU ${out.c.sku} and take its VAT rate. sku_delete will refuse that code while this card points at it.`);
    return json({ [out.created ? "created" : "updated"]: rateJson(out.c, today(), currency), notes, basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("rate_get", {
  title: "The hourly rate on a date",
  description: "Show the hourly rate for a role as of a date and currency: the row picked is the latest valid_from at or before that date, and the answer names it. With no role given, lists every card. Free.",
  inputSchema: {
    role: str("role", 64).optional().describe("The role, e.g. senior developer. Omit to list every rate card"),
    date: str("date", 10).optional().describe("The day the rate is wanted for, YYYY-MM-DD. Default today"),
    currency: currencyArg.optional().describe("Defaults to the shared business profile's currency"),
  },
}, async (a) => {
  try {
    const date = a.date ? checkDate(a.date, "date") : today();
    const currency = normaliseCurrency(a.currency ?? profileCurrency());
    const list = getRates();
    if (a.role === undefined) {
      return json({
        count: list.length, date, currency,
        rate_cards: [...list].sort((x, y) => x.role.localeCompare(y.role)).map((c) => rateJson(c, date, currency)),
        basis: BASIS,
      });
    }
    const c = resolveRate(list, a.role);
    const row = rateAsOf(c, currency, date);
    if (!row) {
      const rows = c.rates.filter((r) => r.currency === currency);
      const earliest = rows.length ? rows.reduce((x, y) => (y.valid_from < x.valid_from ? y : x)) : null;
      throw new Error(
        `the ${c.role} rate card has no ${currency} rate on ${date}. ` +
        (earliest
          ? `Its earliest ${currency} row starts ${earliest.valid_from}, and a rate that did not exist yet is not a rate, so nothing was priced.`
          : `It carries no ${currency} row at all (${[...new Set(c.rates.map((r) => r.currency))].join(", ") || "no rows"}). Nothing was priced and no rate was invented.`),
      );
    }
    return json({
      role: c.role, sku: c.sku, date, currency,
      hourly: money(row.hourly_minor, currency), hourly_minor: row.hourly_minor,
      from_row: { valid_from: row.valid_from, currency: row.currency, hourly_minor: row.hourly_minor },
      why: `${c.role} carries ${c.rates.filter((r) => r.currency === currency).length} ${currency} row(s); the latest valid_from at or before ${date} is ${row.valid_from}.`,
      rate_rows: rateJson(c, date, currency).rate_rows,
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

/* ------------------------------------------------------------ line resolution */

const lineSchema = z.object({
  sku: str("sku", MAX_NAME).optional().describe("A catalogue code or product name. One of sku or role, never both"),
  role: str("role", 64).optional().describe("A rate card role. One of sku or role, never both"),
  quantity: z.number().finite().positive().max(MAX_QUANTITY).optional().describe("How many, for a sku line"),
  hours: z.number().finite().positive().max(MAX_HOURS).optional().describe("Hours worked, for a role line"),
  currency: currencyArg.optional().describe("Overrides the call's currency for this line. Every line on one payload must agree"),
  date: str("date", 10).optional().describe("The day this line is priced as of, YYYY-MM-DD. Overrides the call's date"),
  tier: str("tier", 40).optional().describe("Price tier for this line. Overrides the call's tier"),
  description: str("description", MAX_TEXT).optional().describe("Override the catalogue name on the customer's document"),
});

server.registerTool("lines_resolve", {
  title: "Price lines from the catalogue",
  description: "Turn a list of sku or role lines into invoice_create-ready and quote_create-ready items priced from the catalogue as of each line's date. An unknown code is refused by name and never priced. Free.",
  inputSchema: {
    lines: z.array(lineSchema).min(1, "a resolution needs at least one line").max(MAX_LINES).describe("The lines to price, each a sku with a quantity or a role with hours"),
    client: str("client", MAX_NAME).optional().describe("Client name or id, copied into both payloads. invoice_create and quote_create both need one"),
    currency: currencyArg.optional().describe("The currency for every line. Defaults to the shared business profile's"),
    date: str("date", 10).optional().describe("The day the whole list is priced as of, YYYY-MM-DD. Default today"),
    tier: str("tier", 40).optional().describe(`Price tier for every line. Default ${DEFAULT_TIER}`),
    tax_rate: z.number().finite().min(0).max(MAX_VAT).optional().describe("VAT percent for lines whose SKU carries no rate of its own, overriding the shared profile"),
  },
}, async (a) => {
  try {
    const date = a.date ? checkDate(a.date, "date") : today();
    const currency = normaliseCurrency(a.currency ?? profileCurrency());
    const tier = checkTier(normaliseTier(a.tier), "lines_resolve");
    const profile = profileTaxRate();
    const fallbackRate = a.tax_rate ?? profile.rate;
    const rateSource = a.tax_rate === undefined ? profile.source : "call";

    for (const l of a.lines) {
      if (l.currency && normaliseCurrency(l.currency) !== currency) {
        throw new Error(
          `line "${l.sku ?? l.role}" is in ${normaliseCurrency(l.currency)} and the resolution is in ${currency}. One payload carries one currency and nothing here converts on its own. ` +
          `Resolve one currency at a time. Nothing was priced.`,
        );
      }
      if (l.date) checkDate(l.date, "date");
      if (l.tier) checkTier(normaliseTier(l.tier), "lines_resolve");
    }

    const out = await locked(() => {
      const skus = getSkus();
      const cards = getRates();
      const resolved: ResolvedLine[] = [];
      for (const l of a.lines) {
        const lineDate = l.date ?? date;
        const lineTier = normaliseTier(l.tier ?? tier);
        const both = l.sku !== undefined && l.role !== undefined;
        const neither = l.sku === undefined && l.role === undefined;
        if (both) throw new Error(`a line carries both sku "${l.sku}" and role "${l.role}". One line is one thing: a product with a quantity, or a role with hours. Nothing was priced.`);
        if (neither) throw new Error("a line carries neither sku nor role. Nothing was priced.");
        if (l.sku !== undefined) {
          if (l.quantity === undefined) throw new Error(`the line for sku "${l.sku}" needs quantity. Nothing was priced.`);
          if (l.hours !== undefined) throw new Error(`the line for sku "${l.sku}" carries hours; hours belong to a role line. Nothing was priced.`);
          const s = resolveSku(skus, l.sku);
          const row = priceAsOf(s, currency, lineTier, lineDate);
          if (!row) {
            const has = pairsOf(s).map((p) => `${p.currency} ${p.tier}`).join(", ") || "no rows";
            throw new Error(
              `${s.sku} has no ${currency} price at tier ${lineTier} on ${lineDate} (it carries ${has}). Nothing was priced and no price was invented for it.`,
            );
          }
          resolved.push({
            kind: "sku", ref: s.sku,
            description: l.description ? normaliseText(l.description) : s.name,
            unit: s.unit, quantity: l.quantity,
            unit_price_minor: row.amount_minor,
            tax_rate: s.vat_rate ?? fallbackRate,
            from: { currency: row.currency, tier: row.tier, valid_from: row.valid_from },
            value_minor: lineValueMinor({ quantity: l.quantity, unit_price_minor: row.amount_minor }),
          });
        } else {
          const role = String(l.role);
          if (l.hours === undefined) throw new Error(`the line for role "${role}" needs hours. Nothing was priced.`);
          if (l.quantity !== undefined) throw new Error(`the line for role "${role}" carries quantity; a role line is priced by hours. Nothing was priced.`);
          const c = resolveRate(cards, role);
          const row = rateAsOf(c, currency, lineDate);
          if (!row) {
            throw new Error(
              `the ${c.role} rate card has no ${currency} rate on ${lineDate} (it carries ${[...new Set(c.rates.map((r) => r.currency))].join(", ") || "no rows"}). Nothing was priced and no rate was invented.`,
            );
          }
          const linked = c.sku ? skus.find((s) => s.sku === c.sku) : undefined;
          resolved.push({
            kind: "role", ref: c.role,
            description: l.description ? normaliseText(l.description) : (linked ? linked.name : `${c.role} (${major(row.hourly_minor, currency)} ${currency}/h)`),
            unit: "hour", quantity: l.hours,
            unit_price_minor: row.hourly_minor,
            tax_rate: linked?.vat_rate ?? fallbackRate,
            from: { currency: row.currency, tier: "rate card", valid_from: row.valid_from },
            value_minor: lineValueMinor({ quantity: l.hours, unit_price_minor: row.hourly_minor }),
          });
        }
      }
      // Everything priced. Only now is the register touched, so a refusal writes nothing.
      const id = nextResolutionId(date.slice(0, 4));
      const reg = getRegister();
      const now = new Date().toISOString();
      for (const r of resolved) {
        const found = reg.find((u) => u.kind === r.kind && u.ref === r.ref);
        if (found) { found.times += 1; found.last_used = date; found.last_resolution = id; }
        else reg.push({ kind: r.kind, ref: r.ref, times: 1, first_used: date, last_used: date, last_resolution: id, created: now } as UsageRow & { created: string });
      }
      setRegister(reg);
      return { id, resolved };
    });

    const totals = resolutionTotals(out.resolved, currency);
    const items = invoiceItems(out.resolved, currency).map((i) => ({
      description: i.description, quantity: i.quantity, unit_price: i.unit_price, tax_rate: i.tax_rate,
    }));
    const notes: string[] = [];
    if (rateSource === "none") notes.push("The shared business profile carries no default_tax_rate and no SKU carried its own, so VAT is 0% on those lines. Run business_set {default_tax_rate} in the invoice server, or pass tax_rate.");
    if (a.client === undefined) notes.push("No client was given. Both invoice_create and quote_create need one; add it to the arguments before calling either.");

    return json({
      resolution: out.id, date, currency, tier,
      vat_rate_fallback: fallbackRate, vat_rate_source: rateSource,
      lines: out.resolved.map((l) => ({
        kind: l.kind, ref: l.ref, description: l.description, unit: l.unit,
        quantity: l.quantity,
        unit_price: money(l.unit_price_minor, currency), unit_price_minor: l.unit_price_minor,
        tax_rate: l.tax_rate,
        priced_from: l.from,
        value: money(l.value_minor, currency), value_minor: l.value_minor,
      })),
      invoice_create: {
        tool: "invoice_create", server: "invoice",
        arguments: { ...(a.client === undefined ? {} : { client: a.client }), currency, items },
        unit: "MAJOR units, which is what invoice_create's unit_price takes",
      },
      quote_create: {
        tool: "quote_create", server: "quotes",
        arguments: { ...(a.client === undefined ? {} : { client: a.client }), currency, items: quoteItems(out.resolved, currency) },
        unit: "MINOR units, which is what quote_create's unit_price_minor takes",
      },
      totals: {
        subtotal: money(totals.subtotal_minor, currency), subtotal_minor: totals.subtotal_minor,
        net: money(totals.net_minor, currency), net_minor: totals.net_minor,
        tax_lines: totals.tax_lines,
        vat: money(totals.tax_minor, currency), vat_minor: totals.tax_minor,
        total: money(totals.total_minor, currency), total_minor: totals.total_minor,
        rounding_drift_minor: totals.rounding_drift_minor,
      },
      posted: false,
      note: "Nothing was invoiced and nothing was quoted. Call invoice_create in the invoice server, or quote_create in the quotes server, with the matching arguments above.",
      basis:
        "The same price appears twice above in two scales because the two tools take two scales: invoice_create's unit_price is in MAJOR units and quote_create's unit_price_minor is in MINOR units. " +
        "Passing one into the other misprices a 2-decimal line by 100x. Every catalogue price is a whole minor unit, so computeTotals rounds it straight back and rounding_drift_minor is zero.",
      notes,
    });
  } catch (e) { return fail((e as Error).message); }
});

/* ------------------------------------------------------------- the price list */

function listRows(date: string, currency: string, tier: string): { s: Sku; row: PriceRow }[] {
  return getSkus()
    .map((s) => ({ s, row: priceAsOf(s, currency, tier, date) }))
    .filter((x): x is { s: Sku; row: PriceRow } => x.row !== null)
    .sort((a, b) => a.s.sku.localeCompare(b.s.sku));
}

function priceListText(date: string, currency: string, tiers: string[]): string {
  const biz = issuer();
  const out: string[] = [];
  out.push("PRICE LIST");
  out.push(`in force ${date}`);
  out.push("");
  out.push(biz.name);
  if (biz.address) out.push(biz.address);
  for (const tier of tiers) {
    const rows = listRows(date, currency, tier);
    out.push("");
    out.push(`${currency}, tier ${tier}`);
    if (!rows.length) out.push("  no priced lines");
    for (const { s, row } of rows) {
      const next = supersededBy(s, row);
      out.push(
        `  ${s.sku.padEnd(16)} ${s.name}  ${money(row.amount_minor, currency)} per ${s.unit}` +
        `  from ${row.valid_from}` +
        (s.vat_rate === null ? "" : `  VAT ${s.vat_rate}%`) +
        (next ? `  (${money(next.amount_minor, currency)} from ${next.valid_from})` : ""),
      );
    }
  }
  const cards = getRates();
  out.push("");
  out.push(`LABOUR RATES, ${currency}`);
  if (!cards.length) out.push("  no rate cards");
  for (const c of [...cards].sort((x, y) => x.role.localeCompare(y.role))) {
    const row = rateAsOf(c, currency, date);
    out.push(`  ${c.role.padEnd(16)} ${row ? `${money(row.hourly_minor, currency)} an hour  from ${row.valid_from}` : `no ${currency} rate on ${date}`}`);
  }
  out.push("");
  out.push("Prices are per unit and exclude VAT unless a rate is shown against the line.");
  out.push("A price is the row in force on the date at the top; a later row already booked is shown in brackets.");
  return out.join("\n");
}

server.registerTool("price_list_text", {
  title: "The price list as plain text",
  description: "Print the price list as plain text: every SKU with its unit, the price in force on a date and any later price booked, then the labour rate cards, under your business name. Free; price_list_pdf writes the A4 page.",
  inputSchema: {
    date: str("date", 10).optional().describe("The day the list is in force, YYYY-MM-DD. Default today"),
    currency: currencyArg.optional().describe("Defaults to the shared business profile's currency"),
    tier: str("tier", 40).optional().describe(`One tier, or omit for ${DEFAULT_TIER}. Pass all for every tier, which is Pro`),
  },
}, async (a) => {
  try {
    const date = a.date ? checkDate(a.date, "date") : today();
    const currency = normaliseCurrency(a.currency ?? profileCurrency());
    const wantAll = a.tier !== undefined && normaliseTier(a.tier) === "all";
    if (wantAll) requirePro("every price tier on one list", "price_list_text");
    const tiers = wantAll
      ? [...new Set(getSkus().flatMap((s) => s.prices.filter((r) => r.currency === currency).map((r) => r.tier)))].sort()
      : [checkTier(normaliseTier(a.tier), "price_list_text")];
    const body = priceListText(date, currency, tiers.length ? tiers : [DEFAULT_TIER]);
    const notes: string[] = [];
    if (businessMissing()) notes.push(`No business profile yet, so the list is headed "${PLACEHOLDER_ISSUER}". Run business_set {name, address} in the invoice server once.`);
    return ok(`${body}\n\n${notes.length ? `${notes.join("\n")}\n\n` : ""}${JSON.stringify({
      date, currency, tiers: tiers.length ? tiers : [DEFAULT_TIER],
      skus: getSkus().length, rate_cards: getRates().length,
    }, null, 2)}`);
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("price_list_pdf", {
  title: "The price list as a PDF",
  description: "Call this tool to write the A4 price list for one currency and tier and return the file path: every SKU with its unit, its price in force and the day that price started. Pro.",
  inputSchema: {
    date: str("date", 10).optional().describe("The day the list is in force, YYYY-MM-DD. Default today"),
    currency: currencyArg.optional().describe("Defaults to the shared business profile's currency"),
    tier: str("tier", 40).optional().describe(`One tier. Default ${DEFAULT_TIER}`),
    out_path: z.string().max(1000).optional().describe("Where to write the file. Defaults to the catalogue data directory under pdf/"),
  },
}, async (a) => {
  try {
    requirePro("the price list PDF", "price_list_pdf");
    const date = a.date ? checkDate(a.date, "date") : today();
    const currency = normaliseCurrency(a.currency ?? profileCurrency());
    const tier = normaliseTier(a.tier);
    const rows = listRows(date, currency, tier);
    if (!rows.length) throw new Error(`no SKU carries a ${currency} price at tier ${tier} on ${date}, so the price list would be blank. Nothing was written.`);
    const resolved: ResolvedLine[] = rows.map(({ s, row }) => {
      const next = supersededBy(s, row);
      return {
      kind: "sku", ref: s.sku,
      description: `${s.sku}  ${s.name}  (per ${s.unit}, from ${row.valid_from}` +
        (next ? `; ${money(next.amount_minor, currency)} from ${next.valid_from}` : "") + ")",
      unit: s.unit, quantity: 1,
      unit_price_minor: row.amount_minor,
      tax_rate: s.vat_rate ?? 0,
      from: { currency: row.currency, tier: row.tier, valid_from: row.valid_from },
      value_minor: row.amount_minor,
      };
    });
    const totals = resolutionTotals(resolved, currency);
    const cards = getRates();
    const out = a.out_path ? expandPath(a.out_path) : join(dataDir(), "pdf", `price-list-${currency}-${tier}-${date}.pdf`);
    const biz = issuer();
    await renderDocPdf({
      title: "PRICE LIST",
      number: `${currency} ${tier}`,
      reference: `in force ${date}`,
      party_label: "",
      party: { name: biz.name, address: biz.address, email: biz.email, vat_id: biz.vat_id },
      meta: [
        ["In force", date],
        ["Currency", currency],
        ["Tier", tier],
        ["Lines", String(rows.length)],
      ],
      currency,
      lines: totals.lines,
      subtotal_minor: totals.subtotal_minor,
      discount_percent: totals.discount_percent,
      discount_minor: totals.discount_minor,
      net_minor: totals.net_minor,
      tax_lines: totals.tax_lines,
      total_minor: totals.total_minor,
      footer_label: "LABOUR RATES",
      footer_lines: [
        ...cards.map((c) => {
          const r = rateAsOf(c, currency, date);
          return `${c.role}: ${r ? `${money(r.hourly_minor, currency)} an hour from ${r.valid_from}` : `no ${currency} rate on ${date}`}`;
        }),
        "Every quantity above is one, so the figures below are the sum of one of each line. This is a price list, not a quotation.",
      ],
      notes: "A price is the row in force on the date shown; a later price already booked is printed after it in the line. Prices exclude VAT unless a rate is printed against the line.",
      product: "mcp-catalogue",
    }, biz, out, { branded: !gate.isPro(), logo: gate.isPro() });
    return json({
      path: out,
      document: /\.html?$/i.test(out) ? "HTML price list (print to PDF)" : "PDF price list",
      date, currency, tier, lines: rows.length,
      booked_later: rows.flatMap(({ s, row }) => {
        const next = supersededBy(s, row);
        return next ? [{ sku: s.sku, price: money(next.amount_minor, currency), from: next.valid_from }] : [];
      }),
      sum_of_one_of_each: money(totals.net_minor, currency),
      note: "Every line is a quantity of one, so the total on the page is the sum of one of each and is labelled as such. A price list has no total of its own.",
      notes: businessMissing() ? [`No business profile yet, so the list is headed "${PLACEHOLDER_ISSUER}". Run business_set in the invoice server.`] : undefined,
    });
  } catch (e) { return fail((e as Error).message); }
});

/* ------------------------------------------------------------------- report */

server.registerTool("catalogue_report", {
  title: "Report the catalogue",
  description: "Report the catalogue: how many SKUs there are, how many price rows are in force today, which rows a later row already replaces, and which SKUs carry no price in the profile's default currency. Pro.",
  inputSchema: {
    date: str("date", 10).optional().describe("The day the report is in force, YYYY-MM-DD. Default today"),
    limit: z.number().int().min(1).max(MAX_ROWS).optional().describe(`Maximum rows listed in each section, default and ceiling ${MAX_ROWS}`),
  },
}, async (a) => {
  try {
    requirePro("the catalogue report", "catalogue_report");
    const date = a.date ? checkDate(a.date, "date") : today();
    const limit = a.limit ?? MAX_ROWS;
    const skus = getSkus();
    const cards = getRates();
    const register = getRegister();
    const defaultCurrency = profileCurrency();

    const inForce: { sku: string; currency: string; tier: string; valid_from: string; price_minor: number }[] = [];
    const expiring: { sku: string; currency: string; tier: string; price_minor: number; replaced_on: string; new_price_minor: number }[] = [];
    for (const s of skus) {
      for (const p of pairsOf(s)) {
        const row = priceAsOf(s, p.currency, p.tier, date);
        if (!row) continue;
        inForce.push({ sku: s.sku, currency: row.currency, tier: row.tier, valid_from: row.valid_from, price_minor: row.amount_minor });
        const next = supersededBy(s, row);
        if (next) {
          expiring.push({
            sku: s.sku, currency: row.currency, tier: row.tier, price_minor: row.amount_minor,
            replaced_on: next.valid_from, new_price_minor: next.amount_minor,
          });
        }
      }
    }
    const noDefault = skus
      .filter((s) => !s.prices.some((r) => r.currency === defaultCurrency))
      .map((s) => ({ sku: s.sku, name: s.name, currencies: [...new Set(s.prices.map((r) => r.currency))].sort() }));

    return json({
      date,
      default_currency: defaultCurrency,
      default_currency_source: readSharedProfile().default_currency ? "shared profile" : "none, so EUR is assumed",
      skus: skus.length,
      free_tier_sku_limit: gate.isPro() ? null : FREE_SKUS,
      price_rows: skus.reduce((n, s) => n + s.prices.length, 0),
      rows_in_force: inForce.length,
      rows_in_force_detail: inForce.slice(0, limit),
      rows_expiring: expiring.length,
      rows_expiring_detail: expiring.sort((x, y) => x.replaced_on.localeCompare(y.replaced_on)).slice(0, limit)
        .map((e) => ({ ...e, price: money(e.price_minor, e.currency), new_price: money(e.new_price_minor, e.currency) })),
      skus_without_default_currency: noDefault.length,
      skus_without_default_currency_detail: noDefault.slice(0, limit),
      rate_cards: cards.length,
      rate_cards_without_default_currency: cards.filter((c) => !c.rates.some((r) => r.currency === defaultCurrency)).map((c) => c.role),
      register_rows: register.length,
      register: register.slice(0, limit).map((u) => ({ kind: u.kind, ref: u.ref, times: u.times, first_used: u.first_used, last_used: u.last_used, last_resolution: u.last_resolution })),
      truncated: inForce.length > limit || expiring.length > limit || noDefault.length > limit || register.length > limit,
      note:
        "A row that is expiring is not a problem: it is a price change already booked, listed so it is not a surprise on the day. " +
        "A SKU with no price in the default currency is the one that stops a resolution dead, because nothing here converts.",
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

gate.registerTools(server);

/* ------------------------------------------------------- resource and prompt */

server.registerResource("catalogue", "catalogue://price-list", {
  title: "The price ladder, the free tier and where this server writes",
  description: "How a price is chosen on a date, the two payload scales, the free-tier limits and the one directory this server writes.",
  mimeType: "application/json",
}, async () => ({
  contents: [{
    uri: "catalogue://price-list", mimeType: "application/json",
    text: JSON.stringify({
      price_on_a_date: "the latest valid_from at or before the date, for that currency and tier; a date before every row has no price and is refused",
      row_key: "one row per currency, tier and valid_from; setting the same key again replaces that row",
      default_tier: DEFAULT_TIER,
      payload_scales: {
        invoice_create: "unit_price in MAJOR units",
        quote_create: "unit_price_minor in MINOR units",
        stored: "MINOR units, the only lossless form",
      },
      free_tier: {
        skus: FREE_SKUS,
        free_tools: ["sku_set", "sku_get", "sku_list", "sku_delete", "rate_set", "rate_get", "lines_resolve", "price_list_text"],
        pro_tools: ["price_list_pdf", "catalogue_report"],
        pro_features: ["price tiers other than " + DEFAULT_TIER, "every tier on one price list"],
      },
      writes: [{ store: "catalogue", dir: dataDir(), files: ["skus.json", "rates.json", "register.json", "counter.json", "pdf/"] }],
      reads: [{ store: "profile", file: "business.json", why: "the default currency, the default VAT rate and the name on the price list", writes: false }],
      creates_invoices: false,
      creates_quotes: false,
      today: today(),
    }, null, 2),
  }],
}));

server.registerPrompt("price_the_job", {
  title: "Price a job from the catalogue",
  description: "Price a list of products and hours from the catalogue and hand the result to the invoice or the quotes server.",
  argsSchema: { client: z.string().describe("The client the lines are for") },
}, ({ client }) => ({
  messages: [{
    role: "user" as const,
    content: {
      type: "text" as const,
      text: `Price the lines for ${client} from the catalogue.\n\n` +
        `1. Call sku_list to see the codes and the prices in force, and rate_get for the labour rates.\n` +
        `2. Call lines_resolve with one entry per line: a sku with a quantity, or a role with hours. Pass the date the work is priced as of if it is not today; the catalogue picks the row in force on that date.\n` +
        `3. Take invoice_create.arguments to the invoice server, or quote_create.arguments to the quotes server. Do not retype or rescale a single figure: the invoice payload is in MAJOR units and the quote payload is in MINOR units, and swapping them misprices the job by 100x.\n` +
        `4. If a code comes back unknown, add it with sku_set. Never invent a price; nothing here does.`,
    },
  }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`mcp-catalogue ${VERSION} ready; store at ${dataDir()}\n`);
