// D-R19 (docs/DIST_R19_RESULT.md, finding 3): a create tool that takes a byte-identical
// record twice, with no delete tool, spends free-tier slots the user cannot get back
// except with a Pro key. These are the two halves of the answer, asserted end to end:
// quote_create refuses the identical quote and names the one it already has, and
// quote_delete removes a draft nobody has seen and gives its open slot back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { client, REPO } from "./harness.mjs";

const PRO = execFileSync(process.execPath, [join(REPO, "scripts", "sign-license.mjs"), "quotes"], { encoding: "utf8" }).trim();
const ITEM = { description: "Work", quantity: 1, unit_price_minor: 10000 };
const ARGS = { client: "Acme", items: [ITEM], currency: "EUR", validity_days: 14, notes: "Scope: one API." };

test("a byte-identical quote is refused by the id of the one already stored, under the cap", async (t) => {
  const c = client();
  t.after(() => c.close());
  await c.init();

  const first = (await c.json("quote_create", ARGS)).created;
  const again = await c.call("quote_create", ARGS);
  assert.equal(again.isError, true, "the second identical quote must be refused");
  assert.match(again.text, new RegExp(first.id), again.text);
  assert.match(again.text, /Nothing was written and no free open slot was used/, again.text);
  assert.match(again.text, /quote_delete/, again.text);
  // One open quote, and four free slots still there: the refusal spent nothing.
  assert.equal((await c.json("quote_list", {})).count, 1);
  const counter = JSON.parse(readFileSync(join(c.home, "data", "mcp-servers", "quotes", "counter.json"), "utf8"));
  assert.deepEqual(Object.values(counter), [1], "a refused duplicate must not burn a quote id");

  // Normalised, not compared byte for byte: whitespace and case are the same quote.
  const folded = await c.call("quote_create", { ...ARGS, client: "  acme ", currency: "eur", items: [{ ...ITEM, description: "  WORK  " }] });
  assert.equal(folded.isError, true, folded.text);
  assert.match(folded.text, new RegExp(first.id));

  // One real difference and it is a different quote.
  const changed = await c.call("quote_create", { ...ARGS, items: [{ ...ITEM, quantity: 2 }] });
  assert.equal(changed.isError, false, changed.text);
  assert.equal((await c.json("quote_list", {})).count, 2);
});

test("quote_delete gives the free open slot back: fill the cap, delete one, create again", async (t) => {
  const c = client();
  t.after(() => c.close());
  await c.init();

  const ids = [];
  for (let i = 0; i < 5; i++) {
    ids.push((await c.json("quote_create", { ...ARGS, client: `C${i}` })).created.id);
  }
  const full = await c.call("quote_create", { ...ARGS, client: "C5" });
  assert.equal(full.isError, true);
  assert.match(full.text, /keeps 5 quotes open/);

  const del = await c.json("quote_delete", { id: ids[0] });
  assert.equal(del.deleted.id, ids[0]);
  assert.equal(del.slot_freed, true);
  assert.equal(del.open_quotes_now, 4);
  assert.equal(del.deleted.total, "EUR 100.00", "the deleted record comes back in full so it can be re-created");
  assert.equal((await c.json("quote_list", {})).count, 4, "the row is gone from the store, not just closed");

  const now = await c.call("quote_create", { ...ARGS, client: "C5" });
  assert.equal(now.isError, false, now.text);
  // The id is never reissued: the deleted Q-...-0001 does not come back on the new quote.
  const created = JSON.parse(now.text).created;
  assert.notEqual(created.id, ids[0]);
  assert.equal(created.id, "Q-" + created.issue_date.slice(0, 4) + "-0006");

  const missing = await c.call("quote_delete", { id: ids[0] });
  assert.equal(missing.isError, true);
  assert.match(missing.text, /no quote matches/);
});

test("a quote with a dependent is refused and the dependent is named", async (t) => {
  const c = client({ MCP_LICENSE_KEY: PRO });
  t.after(() => c.close());
  await c.init();

  // Sent: the client is holding the text, so the draft is a document now.
  const sent = (await c.json("quote_create", { ...ARGS, client: "Sent Co" })).created;
  await c.call("quote_send_text", { id: sent.id });
  const rSent = await c.call("quote_delete", { id: sent.id });
  assert.equal(rSent.isError, true);
  assert.match(rSent.text, /the copy sent to Sent Co on \d{4}-\d{2}-\d{2}/, rSent.text);
  assert.match(rSent.text, /nothing was deleted/, rSent.text);
  assert.match(rSent.text, /quote_decline/, rSent.text);

  // Exported: the rendered PDF is on disk and would point at nothing.
  const exported = (await c.json("quote_create", { ...ARGS, client: "Pdf Co" })).created;
  const pdf = await c.json("quote_pdf", { id: exported.id });
  assert.ok(existsSync(pdf.path));
  const rPdf = await c.call("quote_delete", { id: exported.id });
  assert.equal(rPdf.isError, true);
  assert.match(rPdf.text, new RegExp(`the exported document at ${pdf.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), rPdf.text);

  // Accepted and invoiced: the invoice would be left with no quote behind it.
  const won = (await c.json("quote_create", { ...ARGS, client: "Won Co" })).created;
  const acc = await c.json("quote_accept", { id: won.id, create_invoice: "always" });
  const rWon = await c.call("quote_delete", { id: won.id });
  assert.equal(rWon.isError, true);
  assert.match(rWon.text, new RegExp(`invoice ${acc.invoice_number} in the invoice server`), rWon.text);
  assert.match(rWon.text, /the acceptance recorded on \d{4}-\d{2}-\d{2}/, rWon.text);

  // Declined: the win rate counts it.
  const lost = (await c.json("quote_create", { ...ARGS, client: "Lost Co" })).created;
  await c.json("quote_decline", { id: lost.id, reason: "price" });
  const rLost = await c.call("quote_delete", { id: lost.id });
  assert.equal(rLost.isError, true);
  assert.match(rLost.text, /the decline recorded on \d{4}-\d{2}-\d{2} \(price\), which quote_report counts in the win rate/, rLost.text);

  // Every one of them is still in the store.
  assert.equal((await c.json("quote_list", {})).count, 4);
});
