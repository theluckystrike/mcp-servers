// Loop 33, funnel round 1 (docs/FUNNEL_R1.md). Three properties, each of which was false
// on the live worker when this file was written:
//
//   1. The conversion counter counts people. It did not: 294 clicks on 2026-09-07 became
//      1,685 on 2026-09-10 on a property with 0 Google impressions in 99 days, because the
//      only thing the guard required of a "human" was `accept: text/html`, which every
//      crawler sends. Counting is now opt-IN on the Fetch Metadata pair.
//   2. The zero-install path the product page leads with actually works. It did not: the
//      bare `https://mcp.zovo.one/mcp/<id>` answers `initialize` and `tools/list` with 200
//      and then answers EVERY `tools/call` with HTTP 401 and a body that is not JSON-RPC.
//      Measured on 8 of 8 hosted servers on 2026-09-10.
//   3. A free-tier claim on the storefront is true of the server that enforces it.
//      `delivery-schedule` advertised "5 open schedules, 200 deliverables each" against
//      `FREE_OPEN_SCHEDULES = 3` and no per-schedule cap in the code at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker, { PRODUCTS, HOSTED_SERVERS, recordClick, clickStats, isHumanNavigation, UNATTRIBUTED_PREFIX } from "../src/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/** A KV that actually stores, so a counter can be read back and differenced. */
function countingKv() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async list({ prefix = "" } = {}) {
      return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name })), list_complete: true };
    },
  };
}
const emptyKv = () => ({ get: async () => null, put: async () => {}, list: async () => ({ keys: [] }) });
const env = (kv) => ({ STRIPE_SECRET_KEY: "sk_test_stub", REMOTE_DATA: kv, LICENSES: emptyKv() });

/** Every header a Chrome top-level navigation sends that the counter now requires. */
const HUMAN = {
  "user-agent": BROWSER_UA,
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "sec-fetch-mode": "navigate",
  "sec-fetch-dest": "document",
  "sec-fetch-site": "same-origin",
  "sec-fetch-user": "?1",
};
const req = (path, headers) => new Request(`https://mcp.zovo.one${path}`, { headers });

async function withStripeStub(fn) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init) => {
    calls.push(String(u));
    return new Response(JSON.stringify({ id: "cs_test_stub", url: "https://checkout.stripe.com/c/pay/cs_test_stub" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try { return { result: await fn(), calls }; } finally { globalThis.fetch = real; }
}

/** Drive one /buy request to completion, returning the response and the Stripe calls. */
async function buyOnce(kv, path, headers) {
  const run = [];
  const { result, calls } = await withStripeStub(() => worker.fetch(req(path, headers), env(kv), { waitUntil: (p) => run.push(p) }));
  await Promise.all(run);
  return { res: result, calls };
}

test("CONTROL: one identifiable human click moves the counter by exactly one, and nothing else does", async () => {
  const kv = countingKv();
  const SRC = "probe.funnel-r1.control";
  const stats0 = await clickStats(env(kv));
  assert.equal(stats0.total_clicks, 0, "the v2 instrument does not start at zero");

  // The one request that should count: a browser navigation from a tagged storefront link.
  await buyOnce(kv, `/buy/invoice?src=${SRC}`, HUMAN);
  const stats1 = await clickStats(env(kv));
  assert.equal(stats1.total_clicks - stats0.total_clicks, 1, "an identified human click did not move total_clicks by exactly one");
  assert.equal(stats1.by_src[SRC].total, 1);
  assert.equal(stats1.by_src[SRC].last7d, 1);

  // Everything below must leave the counter exactly where it is.
  const cases = [
    ["Googlebot with accept: text/html", { ...HUMAN, "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }],
    ["ClaudeBot with accept: text/html", { ...HUMAN, "user-agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com" }],
    ["HeadlessChrome", { ...HUMAN, "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36" }],
    ["a spoofed Chrome UA from curl, no Fetch Metadata", { "user-agent": BROWSER_UA, accept: "text/html" }],
    ["curl's own UA", { "user-agent": "curl/8.4.0", accept: "text/html" }],
    ["python-requests", { ...HUMAN, "user-agent": "python-requests/2.32.3" }],
    ["an explicit probe", { ...HUMAN, "x-mcp-probe": "1" }],
    ["sec-fetch-dest: empty (a fetch(), not a navigation)", { ...HUMAN, "sec-fetch-dest": "empty", "sec-fetch-mode": "cors" }],
  ];
  for (const [what, headers] of cases) {
    const before = (await clickStats(env(kv))).total_clicks;
    await buyOnce(kv, `/buy/invoice?src=${SRC}`, headers);
    const after = (await clickStats(env(kv))).total_clicks;
    assert.equal(after, before, `${what} was counted as a human click`);
  }
  assert.equal((await clickStats(env(kv))).total_clicks, 1, "the counter did not end where the one real click left it");
});

test("a named crawler never has a live Stripe Checkout Session created for it", async () => {
  // 2,498 Sessions in 4 days, 0 paid (docs/CONVERSION_R1.md). The anchored UA test let
  // every browser-shaped crawler UA through to createCheckout.
  for (const ua of [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  ]) {
    const { res, calls } = await buyOnce(countingKv(), "/buy/invoice?src=store.s.invoice", { ...HUMAN, "user-agent": ua });
    assert.equal(res.headers.get("x-mcp-buy"), "scripted-ua-no-session", `${ua} was not turned away`);
    assert.equal(calls.length, 0, `${ua} reached Stripe`);
  }
  // ...and a real browser still does reach Stripe. Turning a buyer away costs more.
  const ok = await buyOnce(countingKv(), "/buy/invoice?src=store.s.invoice", HUMAN);
  assert.equal(ok.res.status, 303);
  assert.match(ok.res.headers.get("location"), /^https:\/\/checkout\.stripe\.com\//);
});

test("a /buy hit with no ?src= is bucketed as unattributed and kept out of the headline totals", async () => {
  // No live page on the site emits a /buy link without a src, so this is definitionally
  // not a storefront click. 194 of the first 294 v1 clicks (66.0%) were exactly this.
  const kv = countingKv();
  await buyOnce(kv, "/buy/invoice", HUMAN);
  const stats = await clickStats(env(kv));
  assert.equal(stats.by_src[`${UNATTRIBUTED_PREFIX}invoice`].total, 1, "an untagged hit was not bucketed as unattributed");
  assert.equal(stats.total_clicks, 0, "an untagged hit was summed into total_clicks");
  assert.equal(stats.clicks_7d, 0, "an untagged hit was summed into clicks_7d");
  assert.equal(stats.unattributed_total, 1);
  assert.ok(!Object.keys(stats.by_src).some((s) => s.endsWith(".unknown")), "the old .unknown fallback is back");
});

test("v1 click counters are reported apart from v2 and never summed into it", async () => {
  const kv = countingKv();
  await kv.put("click:store.home.table.invoice:total", "999");                    // v1 contamination
  await kv.put(`click:store.home.table.invoice:${new Date().toISOString().slice(0, 10)}`, "999");
  await recordClick(env(kv), "store.s.invoice");                                  // one v2 click
  const stats = await clickStats(env(kv));
  assert.equal(stats.total_clicks, 1, "v1 counters leaked into the v2 total");
  assert.equal(stats.clicks_7d, 1);
  assert.equal(stats.legacy.total_clicks, 999, "v1 counters were dropped instead of kept for forensics");
  assert.ok(!("store.home.table.invoice" in stats.by_src), "a v1 src appeared in the v2 table");
  assert.equal(stats.instrument, 2);
  assert.ok(stats.counting_rule.includes("sec-fetch-dest: document"), "the instrument does not state its own counting rule");
});

test("isHumanNavigation is not start-anchored and cannot be defeated by forgetting a header", () => {
  const h = (o) => new Headers(o);
  assert.equal(isHumanNavigation(h(HUMAN)), true);
  // The exact bypass docs/CONVERSION_R1.md reproduced: a spoofed Chrome UA on curl.
  assert.equal(isHumanNavigation(h({ "user-agent": BROWSER_UA, accept: "text/html" })), false);
  // Start-anchoring was the defect: the bot token is in the middle of both of these.
  assert.equal(isHumanNavigation(h({ ...HUMAN, "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" })), false);
  assert.equal(isHumanNavigation(h({ ...HUMAN, "user-agent": "Mozilla/5.0 ... HeadlessChrome/120.0.0.0 Safari/537.36" })), false);
  // Opting out is still honoured, but opting IN is what the count depends on, so an agent
  // that forgets x-mcp-probe is excluded anyway rather than counted as demand.
  assert.equal(isHumanNavigation(h({ ...HUMAN, "x-mcp-probe": "1" })), false);
});

test("no page tells anyone to paste a hosted URL that answers every tool call with 401", async () => {
  // Measured live on 2026-09-10, 8 of 8 hosted servers: POST {tools/list} -> 200, POST
  // {tools/call} -> 401 with a body carrying no `jsonrpc` key at all, so an MCP client
  // surfaces a transport error and the remediation text in that body is never seen.
  for (const id of ["invoice", "time-tracker", "spreadsheet"]) {
    assert.ok(HOSTED_SERVERS.has(id));
    const res = await worker.fetch(req(`/s/${id}`, HUMAN), env(emptyKv()), { waitUntil: () => {} });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes(`https://mcp.zovo.one/mcp/${id}/t/`), `/s/${id} does not print the tokened URL shape`);
    assert.ok(!html.includes(`Paste <code>https://mcp.zovo.one/mcp/${id}</code>`), `/s/${id} still tells a visitor to paste the tokenless URL`);
    assert.ok(html.includes("401"), `/s/${id} does not say what the tokenless URL does`);
  }
  const llms = await (await worker.fetch(req("/llms.txt", HUMAN), env(emptyKv()), { waitUntil: () => {} })).text();
  for (const id of ["invoice", "time-tracker"]) {
    assert.ok(!llms.includes(`connect with no install at https://mcp.zovo.one/mcp/${id}.`), `/llms.txt still hands assistants the tokenless URL for ${id}`);
    assert.ok(llms.includes(`https://mcp.zovo.one/mcp/${id}/t/<token>`), `/llms.txt does not give assistants the tokened URL for ${id}`);
  }
  assert.ok(llms.includes("answers every tools/call with HTTP 401"), "/llms.txt does not warn assistants off the bare form");
});

test("every free-tier count the storefront advertises is the number the server enforces", () => {
  // delivery-schedule advertised "5 open schedules"; FREE_OPEN_SCHEDULES = 3. A buyer met
  // the wall 40% earlier than the page promised, and "200 deliverables each" named a cap
  // that does not exist in the code at all.
  const SKIP = /(DAYS|MONTHS|CHARS|PIXELS|BYTES|WINDOW|PLACEHOLDERS|BATCH|COLORS|PAGES|MERGE|PARTICIPANTS)/;
  const claims = (free, code) => {
    const found = [];
    for (const c of code.matchAll(/const (FREE_[A-Z_0-9]+)\s*=\s*([0-9_]+)\s*;/g)) {
      const name = c[1], val = Number(c[2].replace(/_/g, ""));
      if (SKIP.test(name)) continue;
      const noun = name.replace(/^FREE_/, "").replace(/_PER_MONTH$/, "").replace(/_LIMIT$/, "").split("_").pop().toLowerCase();
      if (noun.length < 4) continue;
      // Only assert where the noun is unambiguous in the sentence.
      if ((free.match(new RegExp(noun, "gi")) || []).length !== 1) continue;
      const m = free.match(new RegExp(String.raw`(\d[\d,]*)\s+(?:\w+\s+){0,2}` + noun, "i"));
      if (!m) continue;
      found.push({ name, val, noun, claimed: Number(m[1].replace(/,/g, "")), phrase: m[0] });
    }
    return found;
  };
  let checked = 0;
  for (const [id, p] of Object.entries(PRODUCTS)) {
    const f = join(ROOT, "servers", id, "src", "index.ts");
    if (!existsSync(f)) continue;
    for (const c of claims(p.free, readFileSync(f, "utf8"))) {
      checked++;
      assert.equal(c.claimed, c.val, `${id}: the storefront says "${c.phrase}" but ${c.name} = ${c.val}`);
    }
  }
  assert.ok(checked >= 25, `the check only found ${checked} claims to verify; it has stopped checking anything`);
  // Positive control: the checker must fail on the string it was written to catch.
  const bad = claims("Free: 5 open schedules and the late report on every tier.", "const FREE_OPEN_SCHEDULES = 3;\n");
  assert.equal(bad.length, 1);
  assert.notEqual(bad[0].claimed, bad[0].val, "the checker passes the exact defect it exists to catch");
});

test("the sitemap offers the page that mints the token", async () => {
  // /mcp/connect is now the hero destination of every /s/ page and of /llms.txt, i.e. the
  // entry point to the whole free tier, and it was the one page never offered to a crawler:
  // `curl -s https://mcp.zovo.one/sitemap.xml | grep -c 'mcp/connect'` returned 0 against
  // 154 <loc> entries on 2026-09-10. It is safe to list only because the remote worker no
  // longer mints a token for a crawler, a prefetch or a HEAD - see
  // remote/test/connect-mint.test.mjs, which holds that end.
  const xml = await (await worker.fetch(req("/sitemap.xml", HUMAN), env(emptyKv()), { waitUntil: () => {} })).text();
  assert.ok(xml.includes("<loc>https://mcp.zovo.one/mcp/connect</loc>"), "sitemap.xml does not list /mcp/connect");
  // Every other surface this pass promoted is already covered.
  for (const id of ["invoice", "time-tracker", "spreadsheet"]) {
    assert.ok(xml.includes(`<loc>https://mcp.zovo.one/s/${id}</loc>`), `sitemap.xml does not list /s/${id}`);
  }
  // robots.txt names only the private per-buyer paths; the connect page is deliberately
  // public, so it must not be swept up by a broader rule.
  const robots = await (await worker.fetch(req("/robots.txt", HUMAN), env(emptyKv()), { waitUntil: () => {} })).text();
  assert.ok(robots.includes("Allow: /"));
  for (const line of robots.split("\n").filter((l) => l.startsWith("Disallow:"))) {
    const path = line.slice("Disallow:".length).trim();
    assert.ok(!"/mcp/connect".startsWith(path), `robots.txt blocks /mcp/connect via "${line}"`);
  }
});

test("the product page keeps the price comparison above the fold", async () => {
  // The hero rewrite made the top of the page longer, and the only bundle cross-sell on an
  // /s/ page sits several thousand words down inside the generated body. The reason anyone
  // buys the set rather than one server is that $39 beats buying singly, so that argument
  // has to be reachable without scrolling.
  for (const id of ["invoice", "time-tracker"]) {
    const html = await (await worker.fetch(req(`/s/${id}`, HUMAN), env(emptyKv()), { waitUntil: () => {} })).text();
    const nav = html.slice(0, html.indexOf("Two ways to run it"));
    assert.ok(nav.includes('<a href="/bundle">'), `/s/${id} nav lost the /bundle link`);
    assert.ok(nav.includes(`$${PRODUCTS.bundle.usd}`), `/s/${id} nav does not name the bundle price`);
    assert.ok(nav.includes(`/buy/${id}?src=store.s.${id}`), `/s/${id} nav lost its own Buy Pro link`);
  }
});
