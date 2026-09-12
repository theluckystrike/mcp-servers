// Smoke: spawn dist/index.js, initialize, tools/list, one real tools/call over stdio.
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, sandbox, cleanup } from "./_client.mjs";

test("stdio: initialize, tools/list, and a real credit note over the wire", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });

  const info = await c.init();
  assert.equal(info.serverInfo.name, "mcp-credit-note");
  assert.ok(info.serverInfo.version, "serverInfo carries a version");

  const tools = await c.tools();
  assert.deepEqual(tools.map((x) => x.name).sort(), [
    "credit_note_create", "credit_note_delete", "credit_note_finalize", "credit_note_get",
    "credit_note_list", "credit_note_render", "credit_note_summary", "credit_note_update",
    "license_activate", "license_status",
  ]);

  const created = await c.json("credit_note_create", {
    recipient: "Smoke Test Client", reason: "overcharge", currency: "EUR",
    invoice_ref: "INV-2026-0001",
    lines: [{ description: "Double-billed hosting", quantity: 1, unit_price_minor: 4900, tax_rate: 23 }],
  });
  assert.ok(created.created, JSON.stringify(created).slice(0, 300));
  assert.match(created.created.id, /^CN-DRAFT-\d{4}-0001$/);
  assert.equal(created.created.total_minor, 6027, "4900 + round(4900*0.23)=1127");
  assert.equal(created.created.total, "EUR 60.27");

  const fin = await c.json("credit_note_finalize", { id: created.created.id });
  assert.equal(fin.finalized.status, "final");
  assert.match(fin.finalized.number, /^CN-\d{4}-0001$/);

  // stdout carried JSON-RPC only.
  const lines = [...c.stdoutLines, c.tail].filter((l) => l.trim() !== "");
  for (const line of lines) {
    let m;
    try { m = JSON.parse(line); } catch { assert.fail(`non-JSON on stdout: ${JSON.stringify(line.slice(0, 200))}`); }
    assert.equal(m.jsonrpc, "2.0", `stdout line is JSON but not JSON-RPC: ${line.slice(0, 200)}`);
  }
});
