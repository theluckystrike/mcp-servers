#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createLicenseGate, withFileLock } from "@theluckystrike/mcp-license";
import { extractPrice, normalizeNumber, currencyFrom } from "./extract.js";
import { fetchPage, FetchError } from "./fetch.js";
import {
  canonicalUrl, dataDir, dbPath, findWatch, latest, load, newId, nowIso, pctChange, previous, save,
  type Observation, type Watch,
} from "./store.js";
import { join } from "node:path";

/**
 * Advisory lock held across the load-mutate-save cycle. Network fetches stay
 * outside it: two processes on one data dir otherwise discard each other's
 * writes (see docs/AUDIT.md). Read-only tools stay unlocked.
 */
const LOCK = join(dataDir(), ".lock");

const FREE_WATCH_LIMIT = 3;
const FREE_HISTORY_LIMIT = 10;
const DROP_ALERT_PCT = 5;

const gate = createLicenseGate({ product: "price-tracker" });

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
const text = (t: string): ToolResult => ({ content: [{ type: "text", text: t }] });
const fail = (t: string): ToolResult => ({ content: [{ type: "text", text: `Error: ${t}` }], isError: true });

function money(price: string, currency: string | null): string {
  return currency ? `${price} ${currency}` : price;
}

function visibleHistory(w: Watch): Observation[] {
  return gate.isPro() ? w.observations : w.observations.slice(-FREE_HISTORY_LIMIT);
}

function stats(obs: Observation[]) {
  const nums = obs.map((o) => Number(o.price)).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

async function observe(url: string): Promise<Observation & { title: string | null; finalUrl: string }> {
  const page = await fetchPage(url);
  const found = extractPrice(page.html, page.finalUrl);
  if (!found) {
    throw new FetchError(
      `no price found on ${page.finalUrl}. The page loaded but carries no machine-readable price. ` +
      `Record it yourself with price_add_manual {url, price, currency}, or point at the product page rather than a listing page.`
    );
  }
  return {
    ts: nowIso(),
    price: found.price,
    currency: found.currency,
    source: found.source,
    title: found.title,
    finalUrl: page.finalUrl,
  };
}

function watchRow(w: Watch): Record<string, unknown> {
  const obs = visibleHistory(w);
  const last = latest(w);
  const prev = previous(w);
  const s = stats(obs);
  const change = last && prev ? pctChange(prev.price, last.price) : null;
  const targetHit = !!(w.target_price && last && Number(last.price) <= Number(w.target_price));
  return {
    id: w.id,
    label: w.label,
    url: w.url,
    current: last ? money(last.price, last.currency ?? w.currency) : null,
    previous: prev ? money(prev.price, prev.currency ?? w.currency) : null,
    min: s ? fmt(s.min) : null,
    max: s ? fmt(s.max) : null,
    change_pct: change === null ? null : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
    target: w.target_price ? money(w.target_price, w.currency) : null,
    target_hit: targetHit,
    observations: w.observations.length,
    last_checked: last?.ts ?? null,
  };
}

const server = new McpServer({ name: "price-tracker", version: "0.1.0" });

/* ---------------- price_check ---------------- */
server.registerTool(
  "price_check",
  {
    title: "Check a price now",
    description:
      "Fetch a product page right now and report its price, currency and title, plus the change against the last price stored for that URL. Does not create a watch.",
    inputSchema: { url: z.string().describe("Product page URL, including https://") },
  },
  async ({ url }): Promise<ToolResult> => {
    try {
      const o = await observe(url);
      const db = load();
      const w = findWatch(db, url);
      const last = w ? latest(w) : undefined;
      const lines = [
        `Title: ${o.title ?? "(unknown)"}`,
        `Price: ${money(o.price, o.currency)}`,
        `Source: ${o.source}`,
        `URL: ${o.finalUrl}`,
        `Checked: ${o.ts}`,
      ];
      if (last) {
        const ch = pctChange(last.price, o.price);
        const dir = Number(o.price) < Number(last.price) ? "down" : Number(o.price) > Number(last.price) ? "up" : "unchanged";
        lines.push(
          `Last stored: ${money(last.price, last.currency)} at ${last.ts}`,
          `Change: ${dir}${ch === null ? "" : ` ${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%`}`
        );
      } else {
        lines.push("Change: no earlier observation stored for this URL. Use watch_add to start tracking it.");
      }
      return text(lines.join("\n"));
    } catch (e) {
      return fail(e instanceof FetchError ? e.message : String((e as Error)?.message ?? e));
    }
  }
);

/* ---------------- watch_add ---------------- */
server.registerTool(
  "watch_add",
  {
    title: "Watch a price",
    description:
      "Start tracking a product page. Fetches it once and stores the first observation. Optionally set a target price to be alerted about.",
    inputSchema: {
      url: z.string().describe("Product page URL"),
      label: z.string().optional().describe("Short name for this item"),
      target_price: z.union([z.string(), z.number()]).optional().describe("Alert when the price is at or below this (positive number)"),
      currency: z.string().optional().describe("ISO code such as USD or EUR, if the page does not say"),
    },
  },
  async ({ url, label, target_price, currency }): Promise<ToolResult> => {
    const db = load();
    const existing = findWatch(db, url);
    if (existing) return text(`Already watching that URL as ${existing.id}${existing.label ? ` (${existing.label})` : ""}. Use watch_refresh to update it.`);
    if (!gate.isPro() && db.watches.length >= FREE_WATCH_LIMIT) {
      return text(
        `The free tier tracks ${FREE_WATCH_LIMIT} items at a time and you already have ${db.watches.length}. ` +
        `Remove one with watch_remove, or unlock unlimited watches.\n\n${gate.upgradeText("unlimited watches")}`
      );
    }
    let target: string | null = null;
    if (target_price !== undefined) {
      target = normalizeNumber(String(target_price));
      if (!target || !(Number(target) > 0) || /[eE]/.test(String(target_price))) return fail(`could not read "${target_price}" as a price. Use a plain positive number such as 199.99`);
    }
    try {
      const o = await observe(url);
      // observe() awaits the network, so the db read above is stale: another
      // in-flight watch_add would be overwritten and the free limit bypassed.
      // Re-read and re-check both conditions against the current file.
      // The re-read, the limit check and the write all happen under the lock so
      // another process cannot interleave between them.
      return await withFileLock(LOCK, async (): Promise<ToolResult> => {
      const fresh = load();
      const raced = findWatch(fresh, url) ?? findWatch(fresh, canonicalUrl(o.finalUrl));
      if (raced) return text(`Already watching that URL as ${raced.id}${raced.label ? ` (${raced.label})` : ""}. Use watch_refresh to update it.`);
      if (!gate.isPro() && fresh.watches.length >= FREE_WATCH_LIMIT) {
        return text(
          `The free tier tracks ${FREE_WATCH_LIMIT} items at a time and you already have ${fresh.watches.length}. ` +
          `Remove one with watch_remove, or unlock unlimited watches.\n\n${gate.upgradeText("unlimited watches")}`
        );
      }
      db.watches = fresh.watches;
      const w: Watch = {
        id: newId(),
        url: canonicalUrl(o.finalUrl),
        label: label?.trim() || o.title || null,
        target_price: target,
        currency: currencyFrom(currency ?? null) ?? o.currency ?? null,
        created_at: nowIso(),
        observations: [{ ts: o.ts, price: o.price, currency: o.currency, source: o.source }],
      };
      db.watches.push(w);
      save(db);
      const hit = target && Number(o.price) <= Number(target);
      return text(
        [
          `Watching ${w.label ?? w.url} as ${w.id}.`,
          `Price now: ${money(o.price, o.currency)} (via ${o.source})`,
          target ? `Target: ${money(target, w.currency)}${hit ? " - already at or below target." : ""}` : "No target price set.",
          `Stored in ${dbPath()}`,
        ].join("\n")
      );
      });
    } catch (e) {
      return fail(e instanceof FetchError ? e.message : String((e as Error)?.message ?? e));
    }
  }
);

/* ---------------- watch_list ---------------- */
server.registerTool(
  "watch_list",
  {
    title: "List watches",
    description: "Show every tracked item with its current price, target and last check time.",
    inputSchema: {},
  },
  async (): Promise<ToolResult> => {
    const db = load();
    if (!db.watches.length) return text("No watches yet. Add one with watch_add {url}.");
    const rows = db.watches.map(watchRow);
    const tier = gate.isPro() ? "pro" : `free (${db.watches.length}/${FREE_WATCH_LIMIT} watches used)`;
    return text(`Tier: ${tier}\n\n${JSON.stringify(rows, null, 2)}`);
  }
);

/* ---------------- watch_remove ---------------- */
server.registerTool(
  "watch_remove",
  {
    title: "Remove a watch",
    description: "Stop tracking an item, by watch id or by URL. Its history is deleted.",
    inputSchema: {
      id: z.string().optional().describe("Watch id from watch_list"),
      url: z.string().optional().describe("URL of the watch, if you do not have the id"),
    },
  },
  async ({ id, url }): Promise<ToolResult> => {
    const key = (id ?? url ?? "").trim();
    if (!key) return fail("give either id or url");
    return withFileLock(LOCK, (): ToolResult => {
    const db = load();
    const w = findWatch(db, key);
    if (!w) return fail(`no watch matches "${key}". Run watch_list to see ids.`);
    db.watches = db.watches.filter((x) => x.id !== w.id);
    save(db);
    return text(`Removed ${w.id}${w.label ? ` (${w.label})` : ""} and its ${w.observations.length} observation(s).`);
    });
  }
);

/* ---------------- watch_refresh ---------------- */
server.registerTool(
  "watch_refresh",
  {
    title: "Refresh prices",
    description:
      "Re-fetch one watch or every watch, append the new observations and show current, previous, min, max, change % and target hits.",
    inputSchema: {
      id: z.string().optional().describe("Watch id or URL. Omit and set all=true to refresh everything."),
      all: z.boolean().optional().describe("Refresh every watch (Pro)"),
    },
  },
  async ({ id, all }): Promise<ToolResult> => {
    const db = load();
    if (!db.watches.length) return text("No watches yet. Add one with watch_add {url}.");
    let targets: Watch[];
    if (all || !id) {
      if (!gate.isPro()) {
        if (db.watches.length === 1) targets = db.watches;
        else return text(`Refreshing every watch in one call is a Pro feature. On free, pass an id: ${db.watches.map((w) => w.id).join(", ")}.\n\n${gate.upgradeText("watch_refresh all")}`);
      } else targets = db.watches;
    } else {
      const w = findWatch(db, id);
      if (!w) return fail(`no watch matches "${id}". Run watch_list to see ids.`);
      targets = [w];
    }

    const errors: string[] = [];
    for (const w of targets) {
      try {
        const o = await observe(w.url);
        w.observations.push({ ts: o.ts, price: o.price, currency: o.currency, source: o.source });
        if (!w.currency && o.currency) w.currency = o.currency;
      } catch (e) {
        errors.push(`${w.id}: ${e instanceof FetchError ? e.message : String((e as Error)?.message ?? e)}`);
      }
    }
    // The loop above awaited the network. Merge the refreshed watches into the
    // current file instead of writing back a snapshot taken before the fetches,
    // so a watch added meanwhile is not dropped.
    await withFileLock(LOCK, () => {
      const current = load();
      const byId = new Map(targets.map((w) => [w.id, w]));
      db.watches = current.watches.map((w) => byId.get(w.id) ?? w);
      save(db);
    });
    const rows = targets.map(watchRow);
    const hits = rows.filter((r) => r.target_hit).map((r) => r.id);
    const out = [JSON.stringify(rows, null, 2)];
    if (hits.length) out.push(`Target hit: ${hits.join(", ")}`);
    if (errors.length) out.push(`Could not refresh:\n- ${errors.join("\n- ")}`);
    return text(out.join("\n\n"));
  }
);

/* ---------------- price_history ---------------- */
server.registerTool(
  "price_history",
  {
    title: "Price history",
    description: "List the stored observations for one watch, newest last. Free shows the last 10.",
    inputSchema: {
      id: z.string().optional().describe("Watch id"),
      url: z.string().optional().describe("Watch URL"),
      limit: z.number().int().positive().optional().describe("Maximum observations to return"),
    },
  },
  async ({ id, url, limit }): Promise<ToolResult> => {
    const key = (id ?? url ?? "").trim();
    if (!key) return fail("give either id or url");
    const db = load();
    const w = findWatch(db, key);
    if (!w) return fail(`no watch matches "${key}". Run watch_list to see ids.`);
    let obs = visibleHistory(w);
    const truncated = !gate.isPro() && w.observations.length > obs.length;
    if (limit) obs = obs.slice(-limit);
    const s = stats(obs);
    const lines = [
      `${w.label ?? w.url} (${w.id}) - ${obs.length} of ${w.observations.length} observation(s)`,
      s ? `min ${fmt(s.min)} / max ${fmt(s.max)}${w.currency ? ` ${w.currency}` : ""}` : "",
      JSON.stringify(obs, null, 2),
      truncated ? `\nFree shows the last ${FREE_HISTORY_LIMIT} observations; ${w.observations.length - FREE_HISTORY_LIMIT} older one(s) are stored but hidden.\n\n${gate.upgradeText("full price history")}` : "",
    ].filter(Boolean);
    return text(lines.join("\n"));
  }
);

/* ---------------- price_add_manual ---------------- */
server.registerTool(
  "price_add_manual",
  {
    title: "Record a price by hand",
    description:
      "Store a price you read yourself, for shops that block automated requests. Creates the watch if it does not exist yet.",
    inputSchema: {
      url: z.string().describe("Product page URL"),
      price: z.union([z.string(), z.number()]).describe("Price as shown, for example 1299.00 or 1.299,00"),
      currency: z.string().optional().describe("ISO code such as USD or EUR"),
      label: z.string().optional().describe("Short name for this item"),
    },
  },
  async ({ url, price, currency, label }): Promise<ToolResult> => {
    if (/[eE]/.test(String(price)) || !/^[\s\d.,'\u00a0-]*[A-Za-z$\u20ac\u00a3\u00a5]*[\s\d.,'\u00a0]*$/.test(String(price).trim())) return fail(`could not read "${price}" as a price. Use plain digits such as 1299.00 or 1.299,00`);
    const p = normalizeNumber(String(price));
    if (!p || !(Number(p) > 0) || Number(p) > 1e12) return fail(`could not read "${price}" as a price. Try 1299.00 or 1.299,00`);
    const cur = currencyFrom(currency ?? null, url) ?? (currency ? currency.trim().toUpperCase() : null);
    return withFileLock(LOCK, (): ToolResult => {
    const db = load();
    let w = findWatch(db, url);
    if (!w) {
      if (!gate.isPro() && db.watches.length >= FREE_WATCH_LIMIT) {
        return text(
          `The free tier tracks ${FREE_WATCH_LIMIT} items at a time and you already have ${db.watches.length}.\n\n${gate.upgradeText("unlimited watches")}`
        );
      }
      w = {
        id: newId(), url: canonicalUrl(url), label: label?.trim() || null,
        target_price: null, currency: cur, created_at: nowIso(), observations: [],
      };
      db.watches.push(w);
    } else if (label?.trim()) w.label = label.trim();
    if (!w.currency && cur) w.currency = cur;
    const o: Observation = { ts: nowIso(), price: p, currency: cur ?? w.currency, source: "manual" };
    w.observations.push(o);
    save(db);
    return text(
      `Recorded ${money(o.price, o.currency)} for ${w.label ?? w.url} (${w.id}) at ${o.ts}. ${w.observations.length} observation(s) stored.`
    );
    });
  }
);

/* ---------------- alerts_pending ---------------- */
server.registerTool(
  "alerts_pending",
  {
    title: "Pending alerts",
    description:
      `Show watches whose latest price is at or below the target, or which dropped ${DROP_ALERT_PCT}% or more against the previous observation.`,
    inputSchema: {},
  },
  async (): Promise<ToolResult> => {
    if (!gate.isPro()) return text(gate.upgradeText("alerts_pending"));
    const db = load();
    const alerts: Record<string, unknown>[] = [];
    for (const w of db.watches) {
      const last = latest(w);
      const prev = previous(w);
      if (!last) continue;
      const ch = prev ? pctChange(prev.price, last.price) : null;
      const targetHit = !!(w.target_price && Number(last.price) <= Number(w.target_price));
      const dropped = ch !== null && ch <= -DROP_ALERT_PCT;
      if (!targetHit && !dropped) continue;
      alerts.push({
        id: w.id, label: w.label, url: w.url,
        current: money(last.price, last.currency ?? w.currency),
        previous: prev ? money(prev.price, prev.currency ?? w.currency) : null,
        change_pct: ch === null ? null : `${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%`,
        target: w.target_price ? money(w.target_price, w.currency) : null,
        reason: [targetHit ? "target hit" : null, dropped ? `dropped ${Math.abs(ch!).toFixed(2)}%` : null].filter(Boolean).join(" and "),
        at: last.ts,
      });
    }
    if (!alerts.length) return text("No pending alerts. Run watch_refresh first if the prices are stale.");
    return text(JSON.stringify(alerts, null, 2));
  }
);

/* ---------------- resource ---------------- */
server.registerResource(
  "watches",
  "prices://watches",
  { title: "Tracked prices", description: "Every watch with its latest price, target and history size.", mimeType: "application/json" },
  async (uri) => {
    const db = load();
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({ generated_at: nowIso(), tier: gate.isPro() ? "pro" : "free", watches: db.watches.map(watchRow) }, null, 2),
      }],
    };
  }
);

gate.registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`price-tracker ready (${gate.isPro() ? "pro" : "free"}), data in ${dbPath()}\n`);
