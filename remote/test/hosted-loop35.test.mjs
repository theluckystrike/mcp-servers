/**
 * Hosted wiring for the four servers wired in loop 35 wave C: supplier-list,
 * service-agreement, maintenance-log and mileage-log. Each vendored createServer is
 * booted in process over the SDK's linked in-memory transports and driven through the
 * same moves the live validation makes against a deployed worker: initialize, tools/list
 * with the exact tool names the stdio build carries (the license pair included), a real
 * mutating tools/call, and a second call proving the register persisted inside the one
 * tenant document.
 *
 * The point is trap 1 of CLAUDE.md: a hosted endpoint that silently differs from the
 * stdio build is worse than none. None of these four writes a file on any tool (the
 * exports and renders come back INLINE), so the assertions also pin that nothing is ever
 * published: there is no /out/ and no publish rule on any of the four endpoints.
 *
 * The vendored sources import their siblings as "./x.js" while the file on disk is x.ts,
 * so the same scoped resolve hook the sibling suites use maps a relative ".js" onto the
 * ".ts" beside it when, and only when, no ".js" is there. The timezone-engine stub from
 * hosted-loop34.test.mjs is repeated here: the licence shim pulls the vendored timezone
 * engine in for inferTimezoneFromAddress, and TypeScript parameter properties are not
 * loadable by Node's strip-only mode.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
});

const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
const ctxMod = await import("../src/shims/ctx.ts");

/** A request context shaped like the one remote/src/index.ts builds per request. */
function requestCtx(server, over = {}) {
  return {
    tenant: "anon:" + "c".repeat(32), server, isPro: false,
    anonToken: "anon_" + "c".repeat(32),
    files: new Map(), dirs: new Set(), downloads: [], baseUrl: "https://mcp.zovo.one",
    published: new Map(), maxBytes: 512 * 1024, bytes: 0, nfiles: 0, fds: new Map(), nextFd: 100,
    ...over,
  };
}

/** The exact tool names each stdio build carries, license pair included. */
const EXPECTED_TOOLS = {
  "supplier-list": ["supplier_add", "supplier_list", "supplier_get", "supplier_update", "supplier_remove", "supplier_mark_reviewed", "supplier_due_review", "supplier_export", "license_status", "license_activate"],
  "service-agreement": ["agreement_create", "agreement_get", "agreement_list", "agreement_update_status", "clause_library", "agreement_render", "agreement_checklist", "license_status", "license_activate"],
  "maintenance-log": ["asset_add", "maintenance_log", "maintenance_due", "asset_history", "maintenance_export", "asset_remove", "license_status", "license_activate"],
  "mileage-log": ["trip_add", "trip_list", "trip_remove", "rate_set", "rate_list", "mileage_summary", "mileage_export", "license_status", "license_activate"],
};

async function withServer(name, fn) {
  const c = requestCtx(name);
  return await ctxMod.STORE.run(c, async () => {
    const { createServer } = await import(`../src/vendor/${name}/index.ts`);
    const server = createServer();
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "hosted-loop35-test", version: "1" });
    await Promise.all([server.connect(st), client.connect(ct)]);
    try {
      const tools = (await client.listTools()).tools.map((t) => t.name);
      const call = async (tool, args) => {
        const r = await client.callTool({ name: tool, arguments: args });
        const text = (r.content ?? []).map((x) => x.text ?? "").join("\n");
        let parsed;
        try { parsed = JSON.parse(text); } catch { parsed = undefined; }
        return { text, json: parsed, isError: r.isError === true };
      };
      await fn({ tools, call, ctx: c });
    } finally {
      await client.close().catch(() => {});
      await server.close().catch(() => {});
    }
  });
}

test("supplier-list: the 10 stdio tools + add/list/export inline, register persists, nothing published", async () => {
  await withServer("supplier-list", async ({ tools, call, ctx }) => {
    assert.deepEqual([...tools].sort(), [...EXPECTED_TOOLS["supplier-list"]].sort());
    const created = await call("supplier_add", {
      name: "Shenzhen Box Co", category: "Packaging", contact_name: "Maria Chen",
      email: "sales@shenzhenbox.example", payment_terms: "Net 30", lead_time_days: 21,
    });
    assert.equal(created.isError, false, created.text);
    const id = created.json?.created?.id;
    assert.match(id ?? "", /^SUP-2026-\d{4}$/);
    // A duplicate name is refused, here exactly as over stdio.
    const dup = await call("supplier_add", { name: "shenzhen box co", category: "Packaging" });
    assert.equal(dup.isError, true);
    assert.match(dup.text, /already in the directory/);
    // The store persisted inside the tenant document: a second call sees the first row.
    const listed = await call("supplier_list", {});
    assert.equal(listed.json.total, 1);
    // The export comes back inline as CSV text, not as a file.
    const csv = await call("supplier_export", {});
    assert.equal(csv.isError, false, csv.text);
    assert.ok(csv.text.startsWith("id,name,category,"), csv.text.slice(0, 80));
    assert.ok(csv.text.includes("Shenzhen Box Co"));
    assert.equal(ctx.downloads.length, 0, "no tool here writes a file, so nothing is published");
  });
});

test("service-agreement: the 9 stdio tools + create/render inline, the one-step machine, nothing published", async () => {
  await withServer("service-agreement", async ({ tools, call, ctx }) => {
    assert.deepEqual([...tools].sort(), [...EXPECTED_TOOLS["service-agreement"]].sort());
    const created = await call("agreement_create", {
      freelancer: "Anna Nowak", client: "Brightleaf Studio",
      scope: "Design and build of a five-page marketing site",
      deliverables: ["Five-page site deployed to the client host"],
      rate_cents: 8500, rate_unit: "hour", currency: "EUR",
      payment_terms: "Net 14 from invoice date",
    });
    assert.equal(created.isError, false, created.text);
    const id = created.json?.created?.id;
    assert.match(id ?? "", /^SA-2026-\d{4}$/);
    // The render comes back inline as Markdown and carries the template-not-advice line.
    assert.ok(created.json.markdown.includes("Anna Nowak") && created.json.markdown.includes("Brightleaf Studio"));
    // The status machine moves one dated step at a time, here exactly as over stdio.
    const skip = await call("agreement_update_status", { agreement: id, status: "signed", date: "2026-09-10" });
    assert.equal(skip.isError, true);
    assert.match(skip.text, /one step at a time/);
    const step = await call("agreement_update_status", { agreement: id, status: "sent", date: "2026-09-10" });
    assert.equal(step.json?.agreement?.status, "sent");
    // A second call sees the first agreement: the store persisted in the tenant document.
    const listed = await call("agreement_list", {});
    assert.equal(listed.json.count, 1);
    const lib = await call("clause_library", {});
    assert.equal(lib.json.pro, false, "the free tier lists titles and summaries only");
    assert.equal(ctx.downloads.length, 0, "agreement_render is inline on both transports");
  });
});

test("maintenance-log: the 8 stdio tools + add/log/history/export inline, nothing published", async () => {
  await withServer("maintenance-log", async ({ tools, call, ctx }) => {
    assert.deepEqual([...tools].sort(), [...EXPECTED_TOOLS["maintenance-log"]].sort());
    const added = await call("asset_add", { name: "Combi boiler", tag: "SN-88-4412", location: "14 Nowa Street, flat 3", currency: "EUR" });
    assert.equal(added.isError, false, added.text);
    const id = added.json?.created?.id;
    assert.match(id ?? "", /^AST-2026-\d{4}$/);
    // A duplicate tag is refused, here exactly as over stdio.
    const dup = await call("asset_add", { name: "Another boiler", tag: "SN-88-4412" });
    assert.equal(dup.isError, true);
    assert.match(dup.text, /already on/);
    const logged = await call("maintenance_log", { asset: id, date: "2026-09-01", work: "Annual service", cost_cents: 12000, technician: "Acme Heating Ltd", interval_days: 365 });
    assert.equal(logged.isError, false, logged.text);
    assert.equal(logged.json.logged.next_due, "2027-09-01");
    // The store persisted inside the tenant document: the history reads the entry back.
    const hist = await call("asset_history", { asset: id });
    assert.equal(hist.json.log.length, 1);
    assert.equal(hist.json.total_spent_cents, 12000);
    // The export comes back inline as CSV text, not as a file.
    const csv = await call("maintenance_export", {});
    assert.ok(csv.text.startsWith("asset_id,asset_name,"), csv.text.slice(0, 80));
    assert.ok(csv.text.includes("Annual service"));
    assert.equal(ctx.downloads.length, 0, "no tool here writes a file, so nothing is published");
  });
});

test("mileage-log: the 9 stdio tools + rate/trip/summary pricing, nothing published", async () => {
  await withServer("mileage-log", async ({ tools, call, ctx }) => {
    assert.deepEqual([...tools].sort(), [...EXPECTED_TOOLS["mileage-log"]].sort());
    const rate = await call("rate_set", { jurisdiction: "US federal", category: "business", rate: 0.70, unit: "miles", currency: "USD", effective_from: "2026-01-01" });
    assert.equal(rate.isError, false, rate.text);
    const trip = await call("trip_add", { date: "2026-09-01", from: "Home office", to: "Client site", distance: 12.5, unit: "miles", purpose: "Site visit", category: "business" });
    assert.equal(trip.isError, false, trip.text);
    const id = trip.json?.logged?.id;
    assert.match(id ?? "", /^TR-2026-\d{4}$/);
    // 12.5 miles at 0.70 USD a mile is 875 cents, rounded once, here exactly as over stdio.
    const listed = await call("trip_list", {});
    assert.equal(listed.json.trips[0].amount_cents, 875);
    const summary = await call("mileage_summary", { from_date: "2026-01-01", to_date: "2026-12-31" });
    assert.equal(summary.json.totals[0].amount_cents, 875);
    assert.equal(summary.json.totals[0].currency, "USD");
    // A future-dated trip is refused, here exactly as over stdio.
    const future = await call("trip_add", { date: "2099-01-01", from: "A", to: "B", distance: 1, unit: "miles", purpose: "x", category: "business" });
    assert.equal(future.isError, true);
    assert.match(future.text, /after today/);
    assert.equal(ctx.downloads.length, 0, "mileage_export is inline on both transports");
  });
});

test("the four loop-35 endpoints carry no publish rule: no tool writes a file on any of them", async () => {
  // Read the worker config rather than restating it, so this fails if a rule ever appears.
  const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  for (const name of ["supplier-list", "service-agreement", "maintenance-log", "mileage-log"]) {
    const i = src.indexOf(`"${name}": {`);
    assert.ok(i > 0, `${name} is not in the SERVERS table`);
    const block = src.slice(i, src.indexOf("},", i));
    assert.ok(!/\n\s+publish:/.test(block), `${name} publishes nothing: every answer is inline`);
    assert.ok(!/\n\s+sharedDoc:/.test(block), `${name} reads no sibling document`);
  }
});
