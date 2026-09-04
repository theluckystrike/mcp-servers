// A store that fails to parse is never treated as "no quotes".
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { client } from "./harness.mjs";

const GARBAGE = '[{"id":"Q-2026-0001", <<< truncated by a crash';
const ITEM = { description: "Work", quantity: 1, unit_price_minor: 10000 };

test("a corrupt quotes.json is quarantined byte-for-byte and blocks every later call", async (t) => {
  const c = client();
  t.after(() => c.close());
  const dir = join(c.home, "data", "mcp-servers", "quotes");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "quotes.json"), GARBAGE);
  await c.init();

  const created = await c.call("quote_create", { client: "A", items: [ITEM], currency: "EUR" });
  assert.equal(created.isError, true, created.text);
  assert.match(created.text, /corrupt|not valid JSON/i);

  const moved = readdirSync(dir).filter((f) => f.startsWith("quotes.json.corrupt-"));
  assert.equal(moved.length, 1, JSON.stringify(readdirSync(dir)));
  assert.equal(readFileSync(join(dir, moved[0]), "utf8"), GARBAGE, "the quarantined copy must be the original bytes");
  assert.equal(readdirSync(dir).includes("quotes.json"), false, "an empty store must not be written over the corrupt one");

  // The marker keeps every later call failing, reads included, until a human clears it.
  for (const [tool, args] of [["quote_list", {}], ["quote_get", { id: "Q-2026-0001" }], ["quote_accept", { id: "Q-2026-0001" }]]) {
    const r = await c.call(tool, args);
    assert.equal(r.isError, true, `${tool}: ${r.text}`);
    assert.match(r.text, /corrupt/i, r.text);
  }
  assert.equal(readdirSync(dir).includes("quotes.json"), false);
});

test("a corrupt counter.json cannot hand back an id that is already on a document", async (t) => {
  const c = client();
  t.after(() => c.close());
  const dir = join(c.home, "data", "mcp-servers", "quotes");
  mkdirSync(dir, { recursive: true });
  await c.init();
  const first = (await c.json("quote_create", { client: "A", items: [ITEM], currency: "EUR" })).created;

  // Hand-edit the counter back to zero, the way a restored backup would.
  writeFileSync(join(dir, "counter.json"), JSON.stringify({}));
  const second = (await c.json("quote_create", { client: "B", items: [ITEM], currency: "EUR" })).created;
  assert.notEqual(second.id, first.id, "an id already on a quote must never be reissued");
  assert.equal((await c.json("quote_list", {})).count, 2);
});
