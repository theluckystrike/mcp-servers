#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createLicenseGate, withFileLock } from "@theluckystrike/mcp-license";
import { extractPrice, normalizeNumber, currencyFrom } from "./extract.js";
import { fetchPage, FetchError } from "./fetch.js";
import { checkRedirect } from "./redirect.js";
import { canonicalUrl, dataDir, dbPath, findWatch, latest, load, newId, nowIso, pctChange, previous, save, StoreError, } from "./store.js";
import { join } from "node:path";
import { VERSION } from "./version.js";
/**
 * Advisory lock held across the load-mutate-save cycle. Network fetches stay
 * outside it: two processes on one data dir otherwise discard each other's
 * writes (see docs/AUDIT.md). Read-only tools stay unlocked.
 */
const LOCK = join(dataDir(), ".lock");
const FREE_WATCH_LIMIT = 3;
const FREE_HISTORY_LIMIT = 30;
const DROP_ALERT_PCT = 5;
const gate = createLicenseGate({ product: "price-tracker" });
const text = (t) => ({ content: [{ type: "text", text: t }] });
const fail = (t) => ({ content: [{ type: "text", text: `Error: ${t}` }], isError: true });
/**
 * ISO 4217 currencies with no minor unit. A price in one of these is whole by definition,
 * so padding it to two decimals would invent a subdivision that does not exist.
 */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "XAF", "XOF", "XPF", "PYG", "RWF", "UGX", "VUV", "KMF", "DJF", "GNF", "BIF"]);
/**
 * D-R70: prices are stored as decimal strings exactly as they were read, so one watch can
 * hold "49.00" scraped from a page, "38.5" typed into price_add_manual and a target of
 * "40". Printed raw, one answer carried three scales of the same currency ("min 38.50 /
 * max 49", "current": "38.5 EUR", "target": "40 EUR"). Every printed price goes through
 * here: in a currency with minor units it is padded (never rounded) to two decimals; in a
 * zero-decimal currency it stays whole; with no currency known the scale it arrived with
 * is kept, because there is no unit to pad it to. The stored string is untouched - this is
 * display only, so no comparison anywhere changes.
 */
function displayPrice(price, currency = null) {
    const m = /^(\d+)(?:\.(\d+))?$/.exec(String(price).trim());
    if (!m)
        return String(price);
    const dec = m[2] ?? "";
    const cur = currency ? currency.trim().toUpperCase() : "";
    if (cur && ZERO_DECIMAL.has(cur))
        return m[1];
    if (!cur)
        return dec ? `${m[1]}.${dec.padEnd(2, "0")}` : m[1];
    return `${m[1]}.${dec.padEnd(2, "0")}`;
}
function money(price, currency) {
    const p = displayPrice(price, currency);
    return currency ? `${p} ${currency}` : p;
}
function visibleHistory(w) {
    return gate.isPro() ? w.observations : w.observations.slice(-FREE_HISTORY_LIMIT);
}
/**
 * min and max are returned as the STORED strings of the cheapest and dearest observation,
 * not as numbers: fmt() on a number turned "49.00" into "49" and put two scales in one
 * line (D-R70). Comparison is still numeric.
 */
function stats(obs) {
    const rows = obs.filter((o) => Number.isFinite(Number(o.price)));
    if (!rows.length)
        return null;
    let lo = rows[0], hi = rows[0];
    for (const o of rows) {
        if (Number(o.price) < Number(lo.price))
            lo = o;
        if (Number(o.price) > Number(hi.price))
            hi = o;
    }
    return { min: lo.price, max: hi.price };
}
/**
 * Fetch a page and read a price off it.
 *
 * Two guards sit between the fetch and the number, both from the 2026-09-02
 * user-value audit (D-2):
 *  - the final URL must still look like the product page that was asked for,
 *    otherwise a shop that redirects a dead product to its category listing
 *    silently yields the cheapest item on that listing;
 *  - the extraction carries a confidence, so callers can refuse to store a
 *    number that came from a bare text scan of a page with no product title.
 */
async function observe(url) {
    const page = await fetchPage(url);
    const found = extractPrice(page.html, page.finalUrl);
    const verdict = checkRedirect(page.requestedUrl, page.finalUrl, found?.title ?? null);
    if (!verdict.ok)
        throw new FetchError(verdict.reason);
    if (!found) {
        throw new FetchError(`no price found on ${page.finalUrl}. The page loaded but carries no machine-readable price. ` +
            `Record it yourself with price_add_manual {url, price, currency}, or point at the product page rather than a listing page.`);
    }
    return {
        ts: nowIso(),
        price: found.price,
        currency: found.currency,
        source: found.source,
        confidence: found.confidence,
        title: found.title,
        finalUrl: page.finalUrl,
        redirected: page.redirected,
    };
}
/**
 * A low-confidence number on a page with no product title is not evidence of a
 * price. Report it, never store it.
 */
function unstorable(o) {
    if (o.confidence === "low" && !o.title) {
        return (`refusing to store a price for ${o.finalUrl}: the number ${money(o.price, o.currency)} came from a plain-text scan ` +
            `(confidence low, source ${o.source}) and the page carries no product title, so it may not be the product price. ` +
            `Read the price in your browser and record it with price_add_manual {url, price, currency}.`);
    }
    return null;
}
function confidenceLine(o) {
    return `Confidence: ${o.confidence ?? "unknown"} (source ${o.source})`;
}
function watchRow(w) {
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
        min: s ? displayPrice(s.min, w.currency) : null,
        max: s ? displayPrice(s.max, w.currency) : null,
        change_pct: change === null ? null : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
        target: w.target_price ? money(w.target_price, w.currency) : null,
        target_hit: targetHit,
        confidence: last?.confidence ?? null,
        source: last?.source ?? null,
        observations: w.observations.length,
        last_checked: last?.ts ?? null,
    };
}
const server = new McpServer({ name: "mcp-price-tracker", version: VERSION });
/**
 * Every tool goes through here so a StoreError - an unreadable or corrupt
 * database - is reported to the user as a tool error instead of crossing the
 * transport as an exception (Codex v3 item 1). Nothing is written while the
 * store is in that state.
 */
function registerTool(name, config, handler) {
    server.registerTool(name, config, (async (args) => {
        try {
            return await handler(args);
        }
        catch (e) {
            if (e instanceof StoreError)
                return fail(e.message);
            return fail(String(e?.message ?? e));
        }
    }));
}
/* ---------------- price_check ---------------- */
registerTool("price_check", {
    title: "Check a price now",
    description: "Call this tool for any product URL; fetching the page with a generic web tool returns raw HTML without the price. Returns price, currency, title, confidence and the change since the last check.",
    inputSchema: { url: z.string().describe("Product page URL, including https://") },
}, async ({ url }) => {
    try {
        const o = await observe(url);
        const db = load();
        const w = findWatch(db, url);
        const last = w ? latest(w) : undefined;
        const lines = [
            `Title: ${o.title ?? "(unknown)"}`,
            `Price: ${money(o.price, o.currency)}`,
            confidenceLine(o),
            `URL: ${o.finalUrl}`,
            `Checked: ${o.ts}`,
        ];
        const weak = unstorable(o);
        if (weak)
            lines.push(`Warning: ${weak}`);
        if (last) {
            const ch = pctChange(last.price, o.price);
            const dir = Number(o.price) < Number(last.price) ? "down" : Number(o.price) > Number(last.price) ? "up" : "unchanged";
            lines.push(`Last stored: ${money(last.price, last.currency)} at ${last.ts}`, `Change: ${dir}${ch === null ? "" : ` ${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%`}`);
        }
        else {
            lines.push("Change: no earlier observation stored for this URL. Use watch_add to start tracking it.");
        }
        return text(lines.join("\n"));
    }
    catch (e) {
        return fail(e instanceof FetchError ? e.message : String(e?.message ?? e));
    }
});
/* ---------------- watch_add ---------------- */
registerTool("watch_add", {
    title: "Watch a price",
    description: "Call this tool for any product URL; fetching the page with a generic web tool returns raw HTML without the price. Starts tracking it: first observation, optional target, re-read by watch_refresh.",
    inputSchema: {
        url: z.string().describe("Product page URL"),
        label: z.string().optional().describe("Short name for this item"),
        target_price: z.union([z.string(), z.number()]).optional().describe("Report this watch in alerts_pending when the price is at or below this (positive number)"),
        currency: z.string().optional().describe("ISO code such as USD or EUR, if the page does not say"),
    },
}, async ({ url, label, target_price, currency }) => {
    const db = load();
    const existing = findWatch(db, url);
    if (existing)
        return text(`Already watching that URL as ${existing.id}${existing.label ? ` (${existing.label})` : ""}. Use watch_refresh to update it.`);
    if (!gate.isPro() && db.watches.length >= FREE_WATCH_LIMIT) {
        return text(`The free tier tracks ${FREE_WATCH_LIMIT} items at a time and you already have ${db.watches.length}. ` +
            `Remove one with watch_remove, or unlock unlimited watches.\n\n${gate.upgradeText("unlimited watches", "watch_add")}`);
    }
    let target = null;
    if (target_price !== undefined) {
        target = normalizeNumber(String(target_price));
        if (!target || !(Number(target) > 0) || /[eE]/.test(String(target_price)))
            return fail(`could not read "${target_price}" as a price. Use a plain positive number such as 199.99`);
    }
    try {
        const o = await observe(url);
        const weak = unstorable(o);
        if (weak)
            return fail(weak);
        // observe() awaits the network, so the db read above is stale: another
        // in-flight watch_add would be overwritten and the free limit bypassed.
        // Re-read and re-check both conditions against the current file.
        // The re-read, the limit check and the write all happen under the lock so
        // another process cannot interleave between them.
        return await withFileLock(LOCK, async () => {
            const fresh = load();
            const raced = findWatch(fresh, url) ?? findWatch(fresh, canonicalUrl(o.finalUrl));
            if (raced)
                return text(`Already watching that URL as ${raced.id}${raced.label ? ` (${raced.label})` : ""}. Use watch_refresh to update it.`);
            if (!gate.isPro() && fresh.watches.length >= FREE_WATCH_LIMIT) {
                return text(`The free tier tracks ${FREE_WATCH_LIMIT} items at a time and you already have ${fresh.watches.length}. ` +
                    `Remove one with watch_remove, or unlock unlimited watches.\n\n${gate.upgradeText("unlimited watches", "watch_add")}`);
            }
            db.watches = fresh.watches;
            const w = {
                id: newId(),
                url: canonicalUrl(o.finalUrl),
                label: label?.trim() || o.title || null,
                target_price: target,
                currency: currencyFrom(currency ?? null) ?? o.currency ?? null,
                created_at: nowIso(),
                observations: [{ ts: o.ts, price: o.price, currency: o.currency, source: o.source, confidence: o.confidence }],
            };
            db.watches.push(w);
            save(db);
            const hit = target && Number(o.price) <= Number(target);
            return text([
                `Watching ${w.label ?? w.url} as ${w.id}.`,
                `Price now: ${money(o.price, o.currency)}`,
                confidenceLine(o),
                target ? `Target: ${money(target, w.currency)}${hit ? " - already at or below target." : ""}` : "No target price set.",
                `Checks run when you ask: there is no background job and nothing polls this page. ` +
                    `Say "refresh my watches" (watch_refresh) at the start of a session, then alerts_pending lists the drops and target hits.`,
                `Stored in ${dbPath()}`,
            ].join("\n"));
        });
    }
    catch (e) {
        return fail(e instanceof FetchError ? e.message : String(e?.message ?? e));
    }
});
/* ---------------- watch_list ---------------- */
registerTool("watch_list", {
    title: "List watches",
    description: "Show every tracked item with its current price, previous price, min, max, change %, target, extraction confidence and last check time. Prices are as of the last watch_refresh, not live.",
    inputSchema: {},
}, async () => {
    const db = load();
    if (!db.watches.length)
        return text("No watches yet. Add one with watch_add {url}.");
    const rows = db.watches.map(watchRow);
    const tier = gate.isPro() ? "pro" : `free (${db.watches.length}/${FREE_WATCH_LIMIT} watches used)`;
    return text(`Tier: ${tier}\n\n${JSON.stringify(rows, null, 2)}`);
});
/* ---------------- watch_remove ---------------- */
registerTool("watch_remove", {
    title: "Remove a watch",
    description: "Call this tool to stop tracking an item, by watch id or by URL. Give either id or url. Its stored observation history is deleted and cannot be recovered.",
    inputSchema: {
        id: z.string().optional().describe("Watch id from watch_list"),
        url: z.string().optional().describe("URL of the watch, if you do not have the id"),
    },
}, async ({ id, url }) => {
    const key = (id ?? url ?? "").trim();
    if (!key)
        return fail("give either id or url");
    return withFileLock(LOCK, () => {
        const db = load();
        const w = findWatch(db, key);
        if (!w)
            return fail(`no watch matches "${key}". Run watch_list to see ids.`);
        db.watches = db.watches.filter((x) => x.id !== w.id);
        save(db);
        return text(`Removed ${w.id}${w.label ? ` (${w.label})` : ""} and its ${w.observations.length} observation(s).`);
    });
});
/* ---------------- watch_refresh ---------------- */
registerTool("watch_refresh", {
    title: "Refresh prices",
    description: "This is what actually checks prices: re-fetches one watch or every watch, appends the new observations and returns current, previous, min, max, change %, extraction confidence and target hits.",
    inputSchema: {
        id: z.string().optional().describe("Watch id or URL to re-fetch. Omit and set all=true to refresh everything. Nothing runs in the background, so call this whenever the user asks about prices, drops or alerts - typically once at the start of a session, then read alerts_pending."),
        all: z.boolean().optional().describe("Refresh every watch in one call (Pro; on free, refresh one id at a time)"),
    },
}, async ({ id, all }) => {
    const db = load();
    if (!db.watches.length)
        return text("No watches yet. Add one with watch_add {url}.");
    let targets;
    if (all || !id) {
        if (!gate.isPro()) {
            if (db.watches.length === 1)
                targets = db.watches;
            else
                return text(`Refreshing every watch in one call is a Pro feature. On free, pass an id: ${db.watches.map((w) => w.id).join(", ")}.\n\n${gate.upgradeText("watch_refresh all", "watch_refresh")}`);
        }
        else
            targets = db.watches;
    }
    else {
        const w = findWatch(db, id);
        if (!w)
            return fail(`no watch matches "${id}". Run watch_list to see ids.`);
        targets = [w];
    }
    const errors = [];
    for (const w of targets) {
        try {
            const o = await observe(w.url);
            const weak = unstorable(o);
            if (weak) {
                errors.push(`${w.id}: ${weak}`);
                continue;
            }
            w.observations.push({ ts: o.ts, price: o.price, currency: o.currency, source: o.source, confidence: o.confidence });
            if (!w.currency && o.currency)
                w.currency = o.currency;
        }
        catch (e) {
            errors.push(`${w.id}: ${e instanceof FetchError ? e.message : String(e?.message ?? e)}`);
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
    if (hits.length)
        out.push(`Target hit: ${hits.join(", ")}`);
    if (errors.length)
        out.push(`Could not refresh:\n- ${errors.join("\n- ")}`);
    out.push("Nothing runs in the background: these prices are only as fresh as this call. " +
        "Run watch_refresh whenever the user asks about prices, drops or alerts - typically once at the start of a session - then read alerts_pending.");
    return text(out.join("\n\n"));
});
/* ---------------- price_history ---------------- */
registerTool("price_history", {
    title: "Price history",
    description: `Call this tool to list the stored observations for one watch, newest last, each with its price, currency, source and extraction confidence. Free shows the last ${FREE_HISTORY_LIMIT}.`,
    inputSchema: {
        id: z.string().optional().describe("Watch id"),
        url: z.string().optional().describe("Watch URL"),
        limit: z.number().int().positive().optional().describe("Maximum observations to return"),
    },
}, async ({ id, url, limit }) => {
    const key = (id ?? url ?? "").trim();
    if (!key)
        return fail("give either id or url");
    const db = load();
    const w = findWatch(db, key);
    if (!w)
        return fail(`no watch matches "${key}". Run watch_list to see ids.`);
    let obs = visibleHistory(w);
    const truncated = !gate.isPro() && w.observations.length > obs.length;
    if (limit)
        obs = obs.slice(-limit);
    const s = stats(obs);
    const lines = [
        `${w.label ?? w.url} (${w.id}) - ${obs.length} of ${w.observations.length} observation(s)`,
        s ? `min ${displayPrice(s.min, w.currency)} / max ${displayPrice(s.max, w.currency)}${w.currency ? ` ${w.currency}` : ""}` : "",
        JSON.stringify(obs, null, 2),
        truncated ? `\nFree shows the last ${FREE_HISTORY_LIMIT} observations; ${w.observations.length - FREE_HISTORY_LIMIT} older one(s) are stored but hidden.\n\n${gate.upgradeText("full price history", "price_history")}` : "",
    ].filter(Boolean);
    return text(lines.join("\n"));
});
/* ---------------- price_add_manual ---------------- */
registerTool("price_add_manual", {
    title: "Record a price by hand",
    description: "Call this tool to store a price you read yourself, for shops that block automated requests. Creates the watch for that URL if it does not exist yet, and returns the stored price and the observation count.",
    inputSchema: {
        url: z.string().describe("Product page URL"),
        price: z.union([z.string(), z.number()]).describe("Price as shown, for example 1299.00 or 1.299,00"),
        currency: z.string().optional().describe("ISO code such as USD or EUR"),
        label: z.string().optional().describe("Short name for this item"),
    },
}, async ({ url, price, currency, label }) => {
    if (/[eE]/.test(String(price)) || !/^[\s\d.,'\u00a0-]*[A-Za-z$\u20ac\u00a3\u00a5]*[\s\d.,'\u00a0]*$/.test(String(price).trim()))
        return fail(`could not read "${price}" as a price. Use plain digits such as 1299.00 or 1.299,00`);
    const p = normalizeNumber(String(price));
    if (!p || !(Number(p) > 0) || Number(p) > 1e12)
        return fail(`could not read "${price}" as a price. Try 1299.00 or 1.299,00`);
    const cur = currencyFrom(currency ?? null, url) ?? (currency ? currency.trim().toUpperCase() : null);
    return withFileLock(LOCK, () => {
        const db = load();
        let w = findWatch(db, url);
        if (!w) {
            if (!gate.isPro() && db.watches.length >= FREE_WATCH_LIMIT) {
                return text(`The free tier tracks ${FREE_WATCH_LIMIT} items at a time and you already have ${db.watches.length}.\n\n${gate.upgradeText("unlimited watches", "price_add_manual")}`);
            }
            w = {
                id: newId(), url: canonicalUrl(url), label: label?.trim() || null,
                target_price: null, currency: cur, created_at: nowIso(), observations: [],
            };
            db.watches.push(w);
        }
        else if (label?.trim())
            w.label = label.trim();
        if (!w.currency && cur)
            w.currency = cur;
        const o = { ts: nowIso(), price: p, currency: cur ?? w.currency, source: "manual", confidence: "high" };
        w.observations.push(o);
        save(db);
        return text(`Recorded ${money(o.price, o.currency)} for ${w.label ?? w.url} (${w.id}) at ${o.ts}. ${w.observations.length} observation(s) stored.`);
    });
});
/* ---------------- alerts_pending ---------------- */
registerTool("alerts_pending", {
    title: "Pending alerts",
    description: `Answer "did anything I watch get cheaper?": lists every watch whose latest price is at or below its target, or which dropped ${DROP_ALERT_PCT}% or more against the previous observation, with the change % and the reading confidence.`,
    inputSchema: {},
}, async () => {
    const db = load();
    const alerts = [];
    for (const w of db.watches) {
        const last = latest(w);
        const prev = previous(w);
        if (!last)
            continue;
        const ch = prev ? pctChange(prev.price, last.price) : null;
        const targetHit = !!(w.target_price && Number(last.price) <= Number(w.target_price));
        const dropped = ch !== null && ch <= -DROP_ALERT_PCT;
        if (!targetHit && !dropped)
            continue;
        alerts.push({
            id: w.id, label: w.label, url: w.url,
            current: money(last.price, last.currency ?? w.currency),
            previous: prev ? money(prev.price, prev.currency ?? w.currency) : null,
            change_pct: ch === null ? null : `${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%`,
            target: w.target_price ? money(w.target_price, w.currency) : null,
            reason: [targetHit ? "target hit" : null, dropped ? `dropped ${Math.abs(ch).toFixed(2)}%` : null].filter(Boolean).join(" and "),
            confidence: last.confidence ?? null,
            source: last.source,
            at: last.ts,
        });
    }
    if (!db.watches.length)
        return text("No watches yet, so nothing can be alerted on. Add one with watch_add {url, target_price}.");
    if (!alerts.length)
        return text(`No pending alerts across ${db.watches.length} watch(es). Prices are only re-read when watch_refresh runs, so run that first if the last check is old.`);
    return text(`${JSON.stringify(alerts, null, 2)}\n\n` +
        `This tool is free and unlimited. It reads stored observations only: prices are re-read when watch_refresh runs, so run that first if the last check is old.`);
});
/* ---------------- resource ---------------- */
server.registerResource("watches", "prices://watches", { title: "Tracked prices", description: "Every watch with its latest price, target and history size.", mimeType: "application/json" }, async (uri) => {
    const db = load();
    return {
        contents: [{
                uri: uri.href,
                mimeType: "application/json",
                text: JSON.stringify({ generated_at: nowIso(), tier: gate.isPro() ? "pro" : "free", watches: db.watches.map(watchRow) }, null, 2),
            }],
    };
});
/* ---------------- prompt: check_prices ---------------- */
server.registerPrompt("check_prices", {
    title: "Check my prices",
    description: "Refresh every watch and summarise which items dropped and which hit their target. One command for a whole price check.",
}, () => ({
    messages: [{
            role: "user",
            content: {
                type: "text",
                text: "Check my tracked prices with the price-tracker server.\n" +
                    "1. Call watch_list to see what is tracked.\n" +
                    "2. Refresh every watch: call watch_refresh {all: true}. If that reports it is a Pro feature, call watch_refresh {id} once per watch id from step 1.\n" +
                    "3. Call alerts_pending.\n" +
                    "Then summarise in plain language: which items got cheaper and by how much, which hit their target price, " +
                    "which are unchanged, and note any watch that could not be refreshed and why. " +
                    "Give each price with its currency, and flag any reading whose confidence is not high.",
            },
        }],
}));
gate.registerTools(server);
const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`price-tracker ready (${gate.isPro() ? "pro" : "free"}), data in ${dbPath()}\n`);
