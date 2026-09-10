/**
 * The 401 a tokenless request gets is the last line of defence behind the storefront.
 *
 * Measured live on 2026-09-10, before the storefront was corrected (docs/FUNNEL_R1.md):
 * every hosted /s/ page and every /llms.txt line advertised the bare
 * `https://mcp.zovo.one/mcp/<server>`. That URL answers `initialize` and `tools/list` with
 * 200 and the full tool list, so a client connects and every tool appears, and then every
 * `tools/call` lands on this 401 - 8 of 8 servers tested. An MCP client does not render
 * this JSON; it shows a tool or transport error, and whatever text reaches the user comes
 * from the top of the payload. The old `message` said where to PUT a token and never where
 * to GET one, so the three places this body already named /mcp/connect were all nested
 * where nothing surfaces them.
 *
 * The body is pure, so it is extracted from the source rather than imported: src/index.ts
 * pulls in the Workers runtime. Same technique as test/binding.test.mjs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = new URL("../src/index.ts", import.meta.url);
const src = readFileSync(SRC, "utf8");

const start = src.indexOf("export function unauthorizedBody(");
assert.ok(start > 0, "unauthorizedBody must be exported from remote/src/index.ts");
const end = src.indexOf("\n}\n", start) + 3;
const body = src
  .slice(start, end)
  .replace("export function unauthorizedBody(product: string)", "function unauthorizedBody(product)")
  .replace(/\bGUIDE\b/g, '"https://mcp.zovo.one/guides/mcp-server-free-vs-pro"');
const CONNECT_URL = "https://mcp.zovo.one/mcp/connect";
const unauthorizedBody = new Function(`const CONNECT_URL = ${JSON.stringify(CONNECT_URL)}; ${body}; return unauthorizedBody;`)();

test("the message names where to GET a token, not only where to put one", () => {
  const b = unauthorizedBody("invoice");
  assert.ok(b.message.includes(CONNECT_URL), `message does not name ${CONNECT_URL}: ${b.message}`);
  // The ready-to-paste form, for the clients that cannot set a header at all - which is the
  // audience the storefront hero was written for.
  assert.ok(b.message.includes("https://mcp.zovo.one/mcp/invoice/t/<token>"), "message does not print the tokened URL shape");
  // The header form must survive too: it is the only one a Pro key uses.
  assert.match(b.message, /Authorization: Bearer/);
});

test("the message explains the symptom the reader is actually looking at", () => {
  // "It connected, it listed 14 tools, and now nothing works" is the confusing part, and
  // it is the whole reason this 401 is ever seen by a person.
  const m = unauthorizedBody("invoice").message;
  assert.match(m, /initialize and tools\/list/);
  assert.match(m, /refuses every tool call/);
});

test("the body still carries every machine-readable field a client may key off", () => {
  const b = unauthorizedBody("time-tracker");
  assert.equal(b.error, "unauthorized");
  assert.equal(b.connect, CONNECT_URL);
  assert.deepEqual(b.forms.map((f) => f.form), ["header", "url path", "url query"]);
  assert.equal(b.forms[1].how, "https://mcp.zovo.one/mcp/time-tracker/t/<token>");
  assert.equal(b.forms[2].how, "https://mcp.zovo.one/mcp/time-tracker?token=<token>");
  assert.deepEqual(b.options.map((o) => o.kind), ["anonymous", "pro"]);
  assert.ok(b.options[0].how.includes(CONNECT_URL));
  assert.ok(b.options[1].how.includes("https://mcp.zovo.one/buy/time-tracker"));
  assert.match(b.guide, /^https:\/\/mcp\.zovo\.one\/guides\//);
});

test("every URL in the message is a per-product URL for the product that refused the call", () => {
  for (const p of ["invoice", "cash-book", "per-diem"]) {
    const m = unauthorizedBody(p).message;
    assert.ok(m.includes(`https://mcp.zovo.one/mcp/${p}/t/<token>`), `${p}: wrong tokened URL`);
    assert.ok(m.includes(`https://mcp.zovo.one/mcp/${p} answers`), `${p}: wrong bare URL`);
  }
});

test("the 401 route uses the builder rather than a second copy of the body", () => {
  // A second inline copy would drift: this body is edited when the funnel changes and the
  // route is not where anyone looks for it.
  assert.ok(src.includes("return json(unauthorizedBody(product), 401,"), "the tokenless branch no longer calls unauthorizedBody");
  assert.equal((src.match(/error: "unauthorized"/g) || []).length, 1, "there is more than one unauthorized body in the file");
});
