/**
 * Accept-header content negotiation (remote/src/accept.ts).
 *
 * Measured before the fix, 2026-09-10, against the live endpoints:
 *
 *   Accept                                 initialize   tools/list
 *   (no Accept header)                     406          200
 *   * / *                                  406          200
 *   application/json                       406          200
 *   application/json, text/event-stream    200          200
 *   text/html                              406          200
 *
 * Identical on /mcp/invoice, /mcp/cash-book and /mcp/pdf. tools/list is unaffected because
 * the worker answers it from module scope and never reaches the SDK transport; every 406
 * came from the SDK's literal substring test on the Accept header.
 *
 * The first two rows are the defect: both admit every media type, so both had to be 200.
 * The last two rows are correct and must stay exactly as they are.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { acceptsType, negotiateAccept, negotiatedHeaders, REQUIRED_ACCEPT, REQUIRED_TYPES } from "../src/accept.ts";

/**
 * The SDK's own predicate, read out of the installed SDK rather than restated here, so an
 * SDK upgrade that changes the check fails this suite instead of silently reintroducing
 * the 406. This is the exact line the worker is working around.
 */
const SDK = new URL("../../node_modules/@modelcontextprotocol/sdk/dist/esm/server/webStandardStreamableHttp.js", import.meta.url);
const sdkSrc = readFileSync(SDK, "utf8");
const SDK_CHECK = "if (!acceptHeader?.includes('application/json') || !acceptHeader.includes('text/event-stream'))";

test("the SDK still rejects on a literal substring test (the reason this module exists)", () => {
  assert.ok(
    sdkSrc.includes(SDK_CHECK),
    "the SDK's Accept check has changed; re-read webStandardStreamableHttp.js and re-verify remote/src/accept.ts",
  );
});

/** The SDK's predicate, as a function: true means the SDK would answer 406. */
function sdkWouldReject(accept) {
  return !accept?.includes("application/json") || !accept.includes("text/event-stream");
}

/** What the transport actually sees for a given caller Accept, after the worker's rewrite. */
function afterRewrite(accept) {
  const h = new Headers();
  if (accept !== null) h.set("accept", accept);
  return negotiatedHeaders(h).get("accept");
}

test("the measured before/after matrix", () => {
  // [caller Accept, admits both types?, expected status after the fix]
  const rows = [
    [null, true, 200],                                   // no Accept header: RFC 9110 12.5.1
    ["*/*", true, 200],                                  // curl's default
    ["", true, 200],                                     // present but empty
    ["*/*; q=0.8", true, 200],
    ["text/html, */*", true, 200],
    ["application/json, text/event-stream", true, 200],  // already correct, must not change
    ["application/json,text/event-stream", true, 200],   // no space, must not change
    ["application/json", false, 406],                    // names one type, excludes the other
    ["text/html", false, 406],
    ["text/*", false, 406],                              // admits event-stream, not json
    ["application/*", false, 406],                       // admits json, not event-stream
    ["*/*;q=0", false, 406],                             // explicitly accepts nothing
    ["*/*, application/json;q=0", false, 406],           // most specific range wins
  ];
  for (const [accept, admitsBoth, expected] of rows) {
    const seen = afterRewrite(accept);
    const status = sdkWouldReject(seen) ? 406 : 200;
    assert.equal(status, expected, `Accept: ${JSON.stringify(accept)} -> expected ${expected}, transport saw ${JSON.stringify(seen)}`);
    assert.equal(
      REQUIRED_TYPES.every((t) => accept !== null && accept !== "" ? acceptsType(accept, t) : true),
      admitsBoth,
      `Accept: ${JSON.stringify(accept)} admits-both mismatch`,
    );
  }
});

test("a header that already spells both types out is returned untouched", () => {
  for (const a of ["application/json, text/event-stream", "text/event-stream, application/json;q=0.9"]) {
    assert.equal(negotiateAccept(a), null);
    const h = new Headers({ accept: a });
    assert.equal(negotiatedHeaders(h), h, "the same Headers object must come back when nothing is rewritten");
  }
});

test("a rewrite copies the headers rather than mutating the caller's", () => {
  const original = new Headers({ accept: "*/*", authorization: "Bearer anon_" + "0".repeat(32) });
  const out = negotiatedHeaders(original);
  assert.notEqual(out, original);
  assert.equal(original.get("accept"), "*/*", "the caller's headers must be untouched");
  assert.equal(out.get("accept"), REQUIRED_ACCEPT);
  assert.equal(out.get("authorization"), original.get("authorization"), "every other header survives the copy");
});

test("only the Accept header is ever rewritten", () => {
  const original = new Headers({ accept: "*/*", "content-type": "application/json", "mcp-protocol-version": "2026-07-28" });
  const out = negotiatedHeaders(original);
  for (const [k, v] of original) {
    if (k === "accept") continue;
    assert.equal(out.get(k), v, `${k} must survive unchanged`);
  }
});

test("acceptsType ranks by specificity, not by q alone", () => {
  assert.equal(acceptsType("*/*", "application/json"), true);
  assert.equal(acceptsType("*/*", "text/event-stream"), true);
  assert.equal(acceptsType("application/json", "application/json"), true);
  assert.equal(acceptsType("application/json", "text/event-stream"), false);
  assert.equal(acceptsType("text/*", "text/event-stream"), true);
  assert.equal(acceptsType("*/*, text/event-stream;q=0", "text/event-stream"), false);
  assert.equal(acceptsType("text/*;q=0, text/event-stream", "text/event-stream"), true);
  // An unparseable q is read as 0, so a malformed header can only ever be stricter.
  assert.equal(acceptsType("*/*;q=nonsense", "application/json"), false);
});

test("the worker calls negotiatedHeaders on the request it hands the transport", () => {
  const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.ok(
    /request = new Request\(req\.url, \{ method: "POST", headers: negotiatedHeaders\(req\.headers\), body \}\);/.test(src),
    "remote/src/index.ts must build the transport request with negotiatedHeaders(req.headers)",
  );
  // The auth boundary reads the untouched request, not the rewritten one.
  assert.ok(src.includes('req.headers.get("authorization")'), "authenticate() must still read the original headers");
});

/**
 * End-to-end through the real SDK transport, not a restatement of its predicate. This is
 * the proof that the rewrite turns the measured 406 into a 200, and that the answer on
 * this path is `application/json` - the transport is built with enableJsonResponse and
 * never opens an event stream, which is why refusing `* / *` was pure loss.
 *
 * Recorded 2026-09-10:
 *   accept                                before  after  content-type(after)
 *   (none)                                406     200    application/json
 *   "*​/*"                                 406     200    application/json
 *   ""                                    406     200    application/json
 *   "application/json"                    406     406    application/json
 *   "application/json, text/event-stream" 200     200    application/json
 *   "text/html"                           406     406    application/json
 *   "*​/*, application/json;q=0"           406     406    application/json
 */
test("end-to-end: the rewrite turns the measured 406 into a 200 on the real SDK transport", async () => {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  const { WebStandardStreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js");
  const BODY = JSON.stringify({
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "probe", version: "1" } },
  });

  async function status(accept, rewrite) {
    const server = new McpServer({ name: "probe", version: "1.0.0" });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
      const h = new Headers({ "content-type": "application/json" });
      if (accept !== null) h.set("accept", accept);
      const res = await transport.handleRequest(
        new Request("https://mcp.zovo.one/mcp/probe", { method: "POST", headers: rewrite ? negotiatedHeaders(h) : h, body: BODY }));
      await res.text();
      return { code: res.status, ct: res.headers.get("content-type") };
    } finally {
      await transport.close().catch(() => {});
      await server.close().catch(() => {});
    }
  }

  const rows = [
    [null, 406, 200], ["*/*", 406, 200], ["", 406, 200],
    ["application/json", 406, 406],
    ["application/json, text/event-stream", 200, 200],
    ["text/html", 406, 406],
    ["*/*, application/json;q=0", 406, 406],
  ];
  for (const [accept, before, after] of rows) {
    const b = await status(accept, false);
    const a = await status(accept, true);
    assert.equal(b.code, before, `Accept ${JSON.stringify(accept)}: before the rewrite`);
    assert.equal(a.code, after, `Accept ${JSON.stringify(accept)}: after the rewrite`);
    // Non-vacuity for the whole exercise: this transport answers JSON, never an event
    // stream, so the required text/event-stream was never going to be used.
    assert.match(a.ct ?? "", /application\/json/);
  }
});
