/**
 * Newer protocol-version header (s1114).
 *
 * Captured live 2026-11-14 10:31 UTC with wrangler tail on /mcp/time-tracker/t/<token>:
 *   POST mcp-protocol-version 2026-07-28, 268 bytes  -> 400
 *   POST mcp-protocol-version 2026-07-28, 458 bytes  -> 400
 *   POST no version header (initialize)              -> 200
 *   POST 2025-11-25 (notifications/initialized)      -> 202
 *   POST 2025-11-25 (tools/list)                     -> 200, and the call is never retried
 * The SDK's own version list is read from the installed SDK so an upgrade cannot drift.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { negotiateProtocolVersion, negotiatedHeaders, SDK_LATEST_PROTOCOL } from "../src/accept.ts";

const types = readFileSync(new URL("../../node_modules/@modelcontextprotocol/sdk/dist/esm/types.js", import.meta.url), "utf8");

test("SDK_LATEST_PROTOCOL matches the installed SDK", () => {
  const m = types.match(/LATEST_PROTOCOL_VERSION = '([^']+)'/);
  assert.equal(m?.[1], SDK_LATEST_PROTOCOL);
});

test("a newer dated version is served as the newest supported one", () => {
  assert.equal(negotiateProtocolVersion("2026-07-28"), SDK_LATEST_PROTOCOL);
  assert.equal(negotiateProtocolVersion(" 2027-01-01 "), SDK_LATEST_PROTOCOL);
});

test("supported, older, malformed and missing values are left to the SDK", () => {
  for (const v of ["2025-11-25", "2025-06-18", "2024-11-05", "2023-01-01", "latest", "2026-7-28", ""]) {
    assert.equal(negotiateProtocolVersion(v), null, v);
  }
  assert.equal(negotiateProtocolVersion(null), null);
});

test("negotiatedHeaders rewrites only the version when Accept is already exact", () => {
  const h = new Headers({ accept: "application/json, text/event-stream", "mcp-protocol-version": "2026-07-28", "user-agent": "Claude-User" });
  const out = negotiatedHeaders(h);
  assert.equal(out.get("mcp-protocol-version"), SDK_LATEST_PROTOCOL);
  assert.equal(out.get("accept"), "application/json, text/event-stream");
  assert.equal(out.get("user-agent"), "Claude-User");
  const same = new Headers({ accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-11-25" });
  assert.equal(negotiatedHeaders(same), same);
});
