/**
 * Keyless results say what is true, and carry one offer (s1117).
 *
 * price-tracker: on the keyless free tier nothing is saved (keyless.ts), yet watch_add
 * ended with "Kept for your token on this endpoint ... held for 30 days" and
 * price_add_manual with "N observation(s) stored.", while the keyless trailer right under
 * them said nothing is saved (PRICE_TRACKER_WALL.md, "Weakness"). On a keyless call both
 * lines now say nothing was kept; on a token call they are unchanged.
 *
 * Offer: a keyless Pro refusal already carries this server's /buy/ link and the bundle
 * link, and the keyless trailer added a second Pro offer under it. The trailer now names
 * Pro only when the result has no checkout link yet, in the same single-line form as the
 * token trailer (offer-text.js successTrailer): this server's $19 first, the bundle second.
 *
 * The vendored price-tracker is booted in process (resolve hook and timezone stub as in
 * hosted-loop35.test.mjs); the page fetch is answered by a stubbed global fetch.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { keylessTrailer } from "../src/keyless.ts";

const FS_SHIM_URL = new URL("../src/shims/fs.ts", import.meta.url).href;
const TZ_STUB = "data:text/javascript," + encodeURIComponent(
  `import { readFileSync } from ${JSON.stringify(FS_SHIM_URL)};\n` +
  `export function resolveZone() { throw new Error("timezone engine stubbed in this test"); }\n` +
  `export function readJsonFile(file, empty) {\n` +
  `  let raw;\n` +
  `  try { raw = readFileSync(file, "utf8"); }\n` +
  `  catch (e) { if (e && e.code === "ENOENT") return empty; throw e; }\n` +
  `  return JSON.parse(raw);\n` +
  `}\n`);

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith("/timezone/lib.js")) return { url: TZ_STUB, shortCircuit: true };
    if (specifier.startsWith(".") && specifier.endsWith(".js") && context.parentURL) {
      const asJs = new URL(specifier, context.parentURL);
      if (!existsSync(fileURLToPath(asJs))) {
        const asTs = new URL(specifier.slice(0, -3) + ".ts", context.parentURL);
        if (existsSync(fileURLToPath(asTs))) return next(specifier.slice(0, -3) + ".ts", context);
      }
    }
    return next(specifier, context);
  },
  // Strip-only mode refuses TypeScript parameter properties, and the vendored
  // price-tracker/fetch.ts has one (FetchError). This test-only load step rewrites that
  // one constructor into plain fields; the shipped bundle is built by esbuild unchanged.
  load(url, context, next) {
    const r = next(url, context);
    if (!url.endsWith("/vendor/price-tracker/fetch.ts")) return r;
    const src = String(r.source);
    const from = "constructor(message: string, readonly status?: number, readonly blocked = false) {\n    super(message);";
    if (!src.includes(from)) throw new Error("FetchError constructor moved: update keyless-truth.test.mjs");
    return { ...r, source: src.replace(from,
      "readonly status?: number;\n  readonly blocked: boolean;\n" +
      "  constructor(message: string, status?: number, blocked = false) {\n    super(message);\n    this.status = status;\n    this.blocked = blocked;") };
  },
});

const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
const ctxMod = await import("../src/shims/ctx.ts");

const PRODUCT_HTML = `<!doctype html><html><head><title>Test Hoodie</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Test Hoodie",
"offers":{"@type":"Offer","price":"69.00","priceCurrency":"USD"}}</script></head><body><h1>Test Hoodie</h1></body></html>`;

function requestCtx(keyless) {
  const base = {
    server: "price-tracker", isPro: false,
    files: new Map(), dirs: new Set(), downloads: [], baseUrl: "https://mcp.zovo.one",
    published: new Map(), maxBytes: 512 * 1024, bytes: 0, nfiles: 0, fds: new Map(), nextFd: 100,
  };
  return keyless
    ? { ...base, tenant: "keyless", keyless: true, authVia: "none (keyless free tier)" }
    : { ...base, tenant: "anon:" + "e".repeat(32), anonToken: "anon_" + "e".repeat(32) };
}

async function withPriceTracker(keyless, fn) {
  const c = requestCtx(keyless);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(PRODUCT_HTML, { status: 200, headers: { "content-type": "text/html" } });
  try {
    return await ctxMod.STORE.run(c, async () => {
      const { createServer } = await import("../src/vendor/price-tracker/index.ts");
      const server = createServer();
      const [ct, st] = InMemoryTransport.createLinkedPair();
      const client = new Client({ name: "keyless-truth-test", version: "1" });
      await Promise.all([server.connect(st), client.connect(ct)]);
      try {
        const call = async (tool, args) => {
          const r = await client.callTool({ name: tool, arguments: args });
          return { text: (r.content ?? []).map((x) => x.text ?? "").join("\n"), isError: r.isError === true };
        };
        await fn({ call });
      } finally {
        await client.close().catch(() => {});
        await server.close().catch(() => {});
      }
    });
  } finally {
    globalThis.fetch = realFetch;
  }
}

const RETENTION = /Kept for your token|held for 30 days|refreshed for another 30/;

test("keyless watch_add does not claim the watch is kept", async () => {
  await withPriceTracker(true, async ({ call }) => {
    const r = await call("watch_add", { url: "https://shop.example.com/p/hoodie" });
    assert.equal(r.isError, false, r.text);
    assert.match(r.text, /Watching Test Hoodie/);
    assert.doesNotMatch(r.text, RETENTION, "nothing is kept on a keyless call");
    assert.match(r.text, /Not kept: this call carried no token/);
  });
});

test("keyless price_add_manual does not claim the observation is stored", async () => {
  await withPriceTracker(true, async ({ call }) => {
    const r = await call("price_add_manual", { url: "https://shop.example.com/p/hoodie", price: 59, currency: "USD" });
    assert.equal(r.isError, false, r.text);
    assert.doesNotMatch(r.text, /observation\(s\) stored/);
    assert.match(r.text, /nothing was saved, because this call carried no token/);
  });
});

test("token watch_add and price_add_manual keep their storage lines (control)", async () => {
  await withPriceTracker(false, async ({ call }) => {
    const r = await call("watch_add", { url: "https://shop.example.com/p/hoodie" });
    assert.equal(r.isError, false, r.text);
    assert.match(r.text, /Kept for your token on this endpoint/);
    assert.doesNotMatch(r.text, /Not kept/);
    const m = await call("price_add_manual", { url: "https://shop.example.com/p/hoodie", price: 59, currency: "USD" });
    assert.match(m.text, /2 observation\(s\) stored\./);
  });
});

test("build-vendor.mjs produces the keyless-aware lines, so the regenerated vendor matches", () => {
  const bv = readFileSync(new URL("../build-vendor.mjs", import.meta.url), "utf8");
  const vendor = readFileSync(new URL("../src/vendor/price-tracker/index.ts", import.meta.url), "utf8");
  for (const s of ["Not kept: this call carried no token", "nothing was saved, because this call carried no token"]) {
    assert.ok(bv.includes(s), `build-vendor.mjs carries: ${s}`);
    assert.ok(vendor.includes(s), `vendored index.ts carries: ${s}`);
  }
  assert.ok(vendor.includes('import { ctx } from "../../shims/ctx.js";'));
});

/* ------------------------------------------------ one offer per keyless answer */

const OFFER = { priceUsd: 19, bundleUsd: 39, serverCount: 49 };
const D = { ok: true, used: 2, cap: 300, resetsAt: "x" };

test("keyless trailer: one offer line, this server's $19 first, then the bundle", () => {
  const t = keylessTrailer("price-tracker", D, false, OFFER, false, false);
  const single = t.indexOf("https://mcp.zovo.one/buy/price-tracker?src=price-tracker.keyless");
  const bundle = t.indexOf("https://mcp.zovo.one/buy/bundle?src=price-tracker.keyless.bundle");
  assert.ok(single > 0 && bundle > single, t);
  assert.equal((t.match(/https:\/\/mcp\.zovo\.one\/buy\//g) ?? []).length, 2);
  assert.match(t, /one-time \$19, lifetime/);
  assert.match(t, /all 49 servers for \$39/);
  assert.ok(t.includes("https://mcp.zovo.one/mcp/connect"));
});

test("keyless trailer adds no second offer under a result that already carries a checkout link", () => {
  const t = keylessTrailer("time-tracker", D, false, OFFER, false, true);
  assert.doesNotMatch(t, /\/buy\//);
  assert.doesNotMatch(t, /\$19|\$39/);
  assert.ok(t.includes("https://mcp.zovo.one/mcp/connect"), "the free token step stays");
  const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.ok(src.includes("keylessTrailer(product, keylessDecision, wrote, KEYLESS_OFFER, unrecognized, carriesOffer(out))"));
});
