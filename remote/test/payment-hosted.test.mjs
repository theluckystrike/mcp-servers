/**
 * The hosted half of the agent-payment surface (docs/AGENT_PAYMENTS_R1.md).
 *
 * On the hosted endpoints an assistant that meets a cap has no config file to fall back on
 * and no way to leave the session, so this is where the pricing resource, the upgrade
 * prompt and the machine-readable descriptor go first. Three things are asserted here that
 * the stdio suite cannot reach:
 *
 *   1. the licence-gate shim registers `pricing://<product>` and `upgrade_to_pro`,
 *   2. the checkout URL in the descriptor carries the caller's own anonymous token, so a
 *      purchase binds Pro to this connection with no key to paste,
 *   3. the worker's 429 body carries the descriptor for a free caller and NOT for a Pro
 *      caller, who is over an hourly ceiling rather than being asked for money.
 *
* The shim imports its siblings as "./ctx.js" while the file on disk is ctx.ts - the
 * convention the Workers bundler resolves and plain Node does not - so a resolve hook
 * (node:module registerHooks) maps a relative ".js" specifier onto the ".ts" file beside
 * it when, and only when, no ".js" is there. That runs the shim's real source, with no
 * build step and no dependency on a bundler that may or may not be installed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Resolve "./ctx.js" to ctx.ts, the way the Workers bundler does. Scoped as tightly as
 * possible: relative specifiers only, ".js" only, and only when the ".js" is absent and
 * the ".ts" is present, so nothing that resolves normally is touched.
 */
const TZ_STUB = "data:text/javascript," + encodeURIComponent(
  "export function resolveZone(){throw new Error('timezone engine stubbed in this test');}");

registerHooks({
  resolve(specifier, context, next) {
    // The shim pulls the vendored timezone engine in only for inferTimezoneFromAddress,
    // which nothing here calls, and that engine uses TypeScript parameter properties -
    // syntax Node's strip-only mode refuses. Stubbing it keeps this suite on the licence
    // gate, which is what it is about.
    if (specifier.endsWith("/vendor/timezone/lib.js")) return { url: TZ_STUB, shortCircuit: true };
    if (specifier.startsWith(".") && specifier.endsWith(".js") && context.parentURL) {
      const asJs = new URL(specifier, context.parentURL);
      if (!existsSync(fileURLToPath(asJs))) {
        const asTs = new URL(specifier.slice(0, -3) + ".ts", context.parentURL);
        if (existsSync(fileURLToPath(asTs))) return next(specifier.slice(0, -3) + ".ts", context);
      }
    }
    return next(specifier, context);
  },
});

const shim = await import("../src/shims/license.ts");
const ctxMod = await import("../src/shims/ctx.ts");

/** A request context shaped like the one remote/src/index.ts builds per request. */
function requestCtx(over = {}) {
  return {
    tenant: "anon:" + "a".repeat(32), server: "invoice", isPro: false,
    anonToken: "anon_" + "a".repeat(32),
    files: new Map(), dirs: new Set(), downloads: [], baseUrl: "https://mcp.zovo.one",
    published: new Map(), bytes: 0, nfiles: 0, fds: new Map(), nextFd: 100,
    ...over,
  };
}

/** Run fn inside a request context, the way the worker does. */
function inRequest(over, fn) {
  return ctxMod.STORE.run(requestCtx(over), fn);
}

/** A stand-in McpServer that records what the gate registers on it. */
function recorder() {
  const tools = new Map(), resources = new Map(), prompts = new Map();
  return {
    tools, resources, prompts,
    registerTool: (name, meta, handler) => tools.set(name, { meta, handler }),
    registerResource: (name, uri, meta, handler) => resources.set(name, { uri, meta, handler }),
    registerPrompt: (name, meta, handler) => prompts.set(name, { meta, handler }),
  };
}

test("the hosted gate registers pricing://<product> and upgrade_to_pro, and renames no tool", () => {
  inRequest({}, () => {
    const s = recorder();
    shim.createLicenseGate({ product: "invoice" }).registerTools(s);
    assert.deepEqual([...s.tools.keys()].sort(), ["license_activate", "license_status"]);
    assert.deepEqual([...s.resources.keys()], ["pricing"]);
    assert.equal(s.resources.get("pricing").uri, "pricing://invoice");
    assert.equal(s.resources.get("pricing").meta.mimeType, "application/json");
    assert.deepEqual([...s.prompts.keys()], ["upgrade_to_pro"]);
  });
});

test("a host that only implements registerTool is skipped, not thrown at", () => {
  inRequest({}, () => {
    const tools = new Map();
    assert.doesNotThrow(() => shim.createLicenseGate({ product: "invoice" })
      .registerTools({ registerTool: (n, m, h) => tools.set(n, { m, h }) }));
    assert.equal(tools.size, 2);
  });
});

test("reading the pricing resource returns the descriptor, token-bound to this connection", async () => {
  await inRequest({}, async () => {
    const s = recorder();
    shim.createLicenseGate({ product: "invoice" }).registerTools(s);
    const out = await s.resources.get("pricing").handler({ href: "pricing://invoice" });
    const d = JSON.parse(out.contents[0].text);
    assert.equal(d.schema, "zovo.one/mcp-payment-descriptor/1");
    assert.equal(d.product, "invoice");
    assert.equal(d.agent_settleable, false);
    assert.equal(d.rails.x402.supported, false);
    assert.equal(d.price.amount, "19.00");
    // The whole point of the hosted path: the link carries the caller's own token.
    assert.match(d.price.url, /\/buy\/invoice\?tenant=anon_a{32}&src=invoice\.status$/);
    assert.match(d.alternative.url, /\/buy\/bundle\?tenant=anon_a{32}&src=invoice\.status\.bundle$/);
    assert.match(d.after_payment, /same connection/);
    assert.doesNotMatch(d.after_payment, /license_activate/, "a bound purchase has no key to paste");
  });
});

test("a licence-key caller has no token to carry and is told so", () => {
  inRequest({ anonToken: undefined, isPro: true, tenant: "lic:abc" }, () => {
    const d = shim.createLicenseGate({ product: "invoice" }).payment("status");
    assert.equal(d.tier, "pro");
    assert.equal(d.status, "paid");
    assert.doesNotMatch(d.price.url, /tenant=/);
    assert.match(d.after_payment, /license_activate/);
  });
});

test("license_status carries the descriptor without losing a field it already had", async () => {
  await inRequest({}, async () => {
    const st = shim.createLicenseGate({ product: "invoice" }).status();
    for (const k of ["product", "tier", "transport", "tenant", "source", "upgradeUrl", "bundleUrl", "price_usd", "limits", "guide"]) {
      assert.ok(k in st, `license_status lost the ${k} field`);
    }
    assert.equal(st.payment.agent_settleable, false);
    assert.equal(st.payment.product, "invoice");
  });
});

test("the upgrade prompt points at the resource and forbids inventing a price", () => {
  inRequest({}, () => {
    const s = recorder();
    shim.createLicenseGate({ product: "invoice" }).registerTools(s);
    const text = s.prompts.get("upgrade_to_pro").handler({ feature: "PDF export" }).messages[0].content.text;
    assert.match(text, /pricing:\/\/invoice/);
    assert.match(text, /price\.amount/);
    assert.match(text, /human_step/);
    assert.match(text, /agent_settleable is false/);
    assert.match(text, /Do not invent a price/);
    const bare = s.prompts.get("upgrade_to_pro").handler({}).messages[0].content.text;
    assert.doesNotMatch(bare, /undefined/);
  });
});

/* ---------------------------------------------------- the worker's 429 rate-limit body */

test("the worker attaches the descriptor to a free 429 and withholds it from a Pro 429", () => {
  const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  const i = src.indexOf("error: \"rate_limited\"");
  assert.ok(i > 0, "the rate-limit body moved; re-read rateLimit() in remote/src/index.ts");
  const body = src.slice(i, src.indexOf("}, 429,", i));
  assert.ok(body.includes("payment: auth.isPro ? undefined : paymentDescriptor({"),
    "the 429 body must carry paymentDescriptor() for a free caller and undefined for a Pro one");
  assert.ok(body.includes('reason: "rate_limit"'));
  assert.ok(body.includes("tokenBound: Boolean(auth.anonToken)"));
  // The fields that were already there must survive: nothing renamed, only added.
  for (const k of ["limit:", "window:", "resets_at:", "retry_after_seconds:", "note:", "upgradeUrl:", "bundleUrl:", "guide:"]) {
    assert.ok(body.includes(k), `the 429 body lost ${k}`);
  }
});

test("the two copies of payment.ts have not drifted", () => {
  const a = readFileSync(new URL("../src/payment.ts", import.meta.url));
  const b = readFileSync(new URL("../../packages/mcp-license/src/payment.ts", import.meta.url));
  assert.deepEqual(a, b, "remote/src/payment.ts and packages/mcp-license/src/payment.ts must stay byte-identical");
  assert.ok(a.length > 2000, "payment.ts looks truncated");
});
