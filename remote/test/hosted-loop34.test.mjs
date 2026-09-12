/**
 * Hosted wiring for the four servers added in loop 34: bill-of-sale, credit-note,
 * job-card and dunning-letters. Each vendored createServer is booted in process over the
 * SDK's linked in-memory transports and driven through the same four moves the live
 * validation makes against a deployed worker: initialize, tools/list with the exact tool
 * names the stdio build carries (the license pair included), a real mutating tools/call,
 * and - for the one server of the four that writes a file - the publish path that turns a
 * rendered document into a one-hour download.
 *
 * The point is trap 1 of CLAUDE.md: a hosted endpoint that silently differs from the
 * stdio build is worse than none. So the assertions below are on the things that could
 * differ: the tool set, the shared business profile reaching sale_create and the letters
 * through the licence shim, the rendered files landing under /out/ and being published,
 * and the register persisting across calls inside one tenant document.
 *
 * The vendored sources import their siblings as "./x.js" while the file on disk is x.ts,
 * so the same scoped resolve hook the sibling suites use maps a relative ".js" onto the
 * ".ts" beside it when, and only when, no ".js" is there. One exception: the vendored
 * timezone engine uses TypeScript parameter properties, which Node's strip-only mode
 * refuses, and the only names these four servers (and the licence shim) import from it
 * are readJsonFile and resolveZone, so a data: module stands in with a readJsonFile that
 * runs the same ENOENT-means-empty contract over the fs shim.
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
    // The licence shim pulls the vendored timezone engine in for inferTimezoneFromAddress,
    // and vendored dunning-letters/store.ts (and asset-register/store.ts on the way to its
    // lib) import readJsonFile from it. Neither path can load the real engine here.
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
const license = await import("../src/shims/license.ts");

/** A request context shaped like the one remote/src/index.ts builds per request. */
function requestCtx(server, over = {}) {
  return {
    tenant: "anon:" + "b".repeat(32), server, isPro: false,
    anonToken: "anon_" + "b".repeat(32),
    files: new Map(), dirs: new Set(), downloads: [], baseUrl: "https://mcp.zovo.one",
    published: new Map(), maxBytes: 512 * 1024, bytes: 0, nfiles: 0, fds: new Map(), nextFd: 100,
    ...over,
  };
}

/** The exact tool names each stdio build carries, license pair included. */
const EXPECTED_TOOLS = {
  "bill-of-sale": ["sale_create", "sale_update", "sale_finalize", "sale_list", "sale_get", "sale_delete", "sale_render", "sale_summary", "license_status", "license_activate"],
  "credit-note": ["credit_note_create", "credit_note_update", "credit_note_finalize", "credit_note_list", "credit_note_get", "credit_note_delete", "credit_note_render", "credit_note_summary", "license_status", "license_activate"],
  "job-card": ["job_card_create", "job_card_log_labor", "job_card_log_material", "job_card_update_status", "job_card_list", "job_card_get", "job_card_print", "job_card_delete", "job_card_summary", "license_status", "license_activate"],
  "dunning-letters": ["invoice_register", "payment_record", "letter_render", "letter_sent", "overdue_list", "aging_summary", "chase_today", "invoice_status", "invoice_delete", "license_status", "license_activate"],
};

/**
 * Boot one vendored server inside its request context and run the session. The publish
 * predicate is the one remote/src/index.ts gives the endpoint (bill-of-sale publishes
 * /out/; the other three publish nothing and write no file).
 */
async function withServer(name, publish, fn) {
  const c = requestCtx(name, publish ? { publish } : {});
  return await ctxMod.STORE.run(c, async () => {
    const { createServer } = await import(`../src/vendor/${name}/index.ts`);
    const server = createServer();
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "hosted-loop34-test", version: "1" });
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

const DAY = "2026-09-01"; // safely before the hosted UTC "today" wherever this runs

test("bill-of-sale: initialize + the 10 stdio tools + create/render/publish with the shared profile", async () => {
  await withServer("bill-of-sale", (p) => p.startsWith("/out/"), async ({ tools, call, ctx }) => {
    assert.deepEqual([...tools].sort(), [...EXPECTED_TOOLS["bill-of-sale"]].sort());
    // The shared business profile reaches sale_create through the licence shim, exactly as
    // business_set on /mcp/invoice would place it for a hosted caller.
    license.writeSharedProfile({ name: "Probe Seller", address: "1 Dock Street", email: "seller@example.com" });
    const created = await call("sale_create", {
      buyer_name: "Jane Kowalska", item_description: "2019 Honda Civic 1.5 petrol, grey",
      vin: "SHHRE4567YU123456", price_minor: 120000, currency: "USD", date: DAY,
    });
    assert.equal(created.isError, false, created.text);
    const id = created.json?.recorded?.id;
    assert.match(id ?? "", /^BOS-2026-\d{4}$/);
    assert.equal(created.json.recorded.seller.name, "Probe Seller", "the seller came from the shared profile");
    assert.ok(created.json.notes.some((n) => /shared business profile/.test(n)));
    assert.equal(created.json.recorded.price, "1,200.00 USD");
    // The store persisted inside the tenant document: a second call sees the first sale.
    const listed = await call("sale_list", {});
    assert.equal(listed.json.total, 1);
    // Render both formats: two files under /out/, both published as one-hour downloads.
    const rendered = await call("sale_render", { sale: id, format: "both" });
    assert.equal(rendered.isError, false, rendered.text);
    const paths = (rendered.json.files ?? []).map((f) => f.path).sort();
    assert.deepEqual(paths, [`/out/${id}.html`, `/out/${id}.md`]);
    assert.equal(ctx.downloads.length, 2, "both renderings became downloads");
    // The published URLs are the worker's substitution inputs: assert them directly.
    const htmlUrl = ctx.published.get(`/out/${id}.html`);
    const mdUrl = ctx.published.get(`/out/${id}.md`);
    assert.match(htmlUrl ?? "", /^https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]{32}$/);
    assert.match(mdUrl ?? "", /^https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]{32}$/);
    assert.notEqual(htmlUrl, mdUrl);
    const htmlDl = ctx.downloads.find((d) => d.filename === `${id}.html`);
    assert.equal(htmlDl.mime, "text/html; charset=utf-8");
    assert.ok(htmlDl.body.startsWith("<!doctype html") && htmlDl.body.includes(`Bill of Sale ${id}`));
    assert.ok(rendered.json.markdown.includes("# BILL OF SALE") && rendered.json.html.includes("DRAFT"));
    // Finalize, and the signing copy drops the watermark.
    const fin = await call("sale_finalize", { sale: id });
    assert.equal(fin.json.finalized.status, "final");
    const signing = await call("sale_render", { sale: id, format: "html" });
    assert.ok(!signing.json.html.includes("watermark"), "the signing copy carries no DRAFT watermark");
  });
});

test("credit-note: the 10 stdio tools + draft to finalized, and nothing is ever published", async () => {
  await withServer("credit-note", undefined, async ({ tools, call, ctx }) => {
    assert.deepEqual([...tools].sort(), [...EXPECTED_TOOLS["credit-note"]].sort());
    const created = await call("credit_note_create", {
      recipient: "Acme GmbH", reason: "overcharge", currency: "EUR",
      reason_detail: "Client was billed 10 seats, used 7",
      lines: [{ description: "Returned: 3 seats", quantity: 3, unit_price_minor: 10420, tax_rate: 23 }],
    });
    assert.equal(created.isError, false, created.text);
    const id = created.json?.created?.id;
    assert.match(id ?? "", /^CN-DRAFT-2026-\d{4}$/);
    assert.equal(created.json.created.total_minor, 38450); // 3 x 10420 = 31260, plus tax rounded once per line: roundHalfUp(31260 x 23%) = 7190
    const fin = await call("credit_note_finalize", { id });
    assert.match(fin.json?.finalized?.number ?? "", /^CN-2026-\d{4}$/);
    const rendered = await call("credit_note_render", { id, format: "markdown" });
    assert.ok(rendered.text.includes(`# CREDIT NOTE ${fin.json.finalized.number}`));
    assert.ok(rendered.text.includes("Generated with mcp-credit-note"), "the free tier stamps the footer");
    assert.equal(ctx.downloads.length, 0, "no tool here writes a file, so nothing is published");
    // A finalized note is immutable, on this transport exactly as over stdio.
    const edit = await call("credit_note_update", { id, notes: "too late" });
    assert.equal(edit.isError, true);
    assert.match(edit.text, /finalized and cannot be edited/);
  });
});

test("job-card: the 11 stdio tools + create/log/status/print, and nothing is ever published", async () => {
  await withServer("job-card", undefined, async ({ tools, call, ctx }) => {
    assert.deepEqual([...tools].sort(), [...EXPECTED_TOOLS["job-card"]].sort());
    const created = await call("job_card_create", {
      client: "Kowalski bathroom refit", site: "14 Nowa Street, flat 3",
      description: "Replace the consumer unit and certify", currency: "EUR",
    });
    assert.equal(created.isError, false, created.text);
    const id = created.json?.created?.id;
    assert.match(id ?? "", /^JC-2026-\d{4}$/);
    const labor = await call("job_card_log_labor", { card: id, worker: "Anna", date: DAY, hours: 2.5, rate_cents: 4500 });
    assert.equal(labor.json?.logged?.value_cents, 11250); // 2.5 x 45.00, rounded once at log time
    const mat = await call("job_card_log_material", { card: id, item: "Consumer unit 10-way", date: DAY, qty: 1, unit_cost_cents: 12999 });
    assert.equal(mat.json?.logged?.value_cents, 12999);
    assert.equal(mat.json?.card?.grand_total_cents, 24249);
    // The status machine moves one dated step at a time, here exactly as over stdio.
    const skip = await call("job_card_update_status", { card: id, status: "done", date: DAY });
    assert.equal(skip.isError, true);
    assert.match(skip.text, /the only step from here is in_progress/);
    const step = await call("job_card_update_status", { card: id, status: "in_progress", date: DAY });
    assert.equal(step.json?.card?.status, "in_progress");
    const printed = await call("job_card_print", { card: id, format: "markdown" });
    assert.ok(printed.text.includes(`# Job card ${id}`) && printed.text.includes("Total due: EUR 242.49"));
    assert.equal(ctx.downloads.length, 0, "job_card_print is inline on both transports");
  });
});

test("dunning-letters: the 11 stdio tools + register/render/send/pay, and nothing is ever published", async () => {
  await withServer("dunning-letters", undefined, async ({ tools, call, ctx }) => {
    assert.deepEqual([...tools].sort(), [...EXPECTED_TOOLS["dunning-letters"]].sort());
    license.writeSharedProfile({ name: "Probe Sender", email: "sender@example.com" });
    const reg = await call("invoice_register", {
      client: "Acme Ltd", reference: "INV-PROBE-34", amount_minor: 125000,
      currency: "USD", due: "2026-08-01", gaps: [7, 14, 21],
    });
    assert.equal(reg.isError, false, reg.text);
    const id = reg.json?.registered?.id;
    assert.match(id ?? "", /^DUN-2026-\d{4}$/);
    assert.equal(reg.json.registered.outstanding_minor, 125000);
    // 42 days past due on 2026-09-12, so reminder 1 is long due and the ladder is sequential.
    const letter = await call("letter_render", { invoice: id, on: "2026-09-12" });
    assert.equal(letter.isError, false, letter.text);
    assert.equal(letter.json.stage, 1);
    assert.equal(letter.json.subject, "Payment reminder: invoice INV-PROBE-34 for USD 1,250.00");
    assert.ok(letter.json.letter.includes("Acme Ltd") && letter.json.letter.includes("Probe Sender"));
    // Out of order is refused, here exactly as over stdio.
    const leap = await call("letter_sent", { invoice: id, stage: 2, sent: "2026-09-12" });
    assert.equal(leap.isError, true);
    assert.match(leap.text, /letters go out in order/);
    const sent = await call("letter_sent", { invoice: id, stage: 1, sent: "2026-09-12" });
    assert.equal(sent.json?.recorded?.stage, 1);
    const pay = await call("payment_record", { invoice: id, amount_minor: 25000, date: "2026-09-12" });
    assert.equal(pay.json?.outstanding_minor, 100000);
    const status = await call("invoice_status", { invoice: id, on: "2026-09-12" });
    assert.equal(status.json?.days_late, 42);
    assert.equal(status.json?.schedule?.[0]?.state, "sent");
    assert.equal(status.json?.schedule?.[1]?.state, "due");
    assert.equal(ctx.downloads.length, 0, "letter_render is inline on both transports");
  });
});

test("the vendored bill-of-sale never persists the JSON store into a published download", async () => {
  // The publish rule is the /out/ prefix and nothing else: read it off the worker config
  // rather than restating it, so this test fails if the rule ever widens.
  const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  const i = src.indexOf('"bill-of-sale": {');
  const block = src.slice(i, src.indexOf("},", i));
  assert.ok(block.includes('publish: (p) => p.startsWith("/out/")'), "bill-of-sale publishes /out/ only");
  assert.ok(!block.includes("persistPublished: true"), "rendered documents are transient downloads, not tenant state");
});
