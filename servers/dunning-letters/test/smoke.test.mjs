// Smoke test: spawn dist/index.js over stdio, run initialize + tools/list + one
// tools/call, and check the server answers the protocol and the free tier holds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, cleanup, sandbox, ACME } from "./_client.mjs";

const EXPECTED_TOOLS = [
  "invoice_register", "payment_record", "letter_render", "letter_sent", "overdue_list",
  "aging_summary", "chase_today", "invoice_status", "invoice_delete",
  "license_status", "license_activate",
];

test("smoke: initialize, tools/list, one tools/call over stdio", async () => {
  const sb = sandbox();
  const c = client({ dataHome: sb.dataHome });
  try {
    const init = await c.init();
    assert.equal(init.serverInfo.name, "mcp-dunning-letters");

    const tools = await c.tools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [...EXPECTED_TOOLS].sort());

    // The one call: register the worked invoice and read its id back off the wire.
    const reg = await c.json("invoice_register", ACME);
    assert.equal(reg.isError, undefined);
    assert.match(reg.registered.id, /^DUN-2026-\d{4}$/);
    assert.deepEqual(reg.registered.schedule.map((s) => s.date), ["2026-06-08", "2026-06-15", "2026-06-22"]);

    // Errors come back in the envelope, never thrown across the transport.
    const bad = await c.call("letter_render", { invoice: "NOPE-1" });
    assert.equal(bad.isError, true);
    assert.match(bad.text, /^Error: /);
  } finally {
    c.close();
    cleanup(sb.dir);
  }
});
