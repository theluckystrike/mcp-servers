// Round-10 fix (docs/USER_VALUE_R10.md):
// D-R48 - business_set receives an address but no timezone: inferTimezoneFromAddress
// works out a zone from the last city or country name in the address, using
// @theluckystrike/mcp-timezone's place table, so "I am ... in Warsaw" no longer leaves
// the shared profile's timezone blank.
import { test } from "node:test";
import assert from "node:assert/strict";
import { inferTimezoneFromAddress } from "../dist/index.js";

test("D-R48: a bare city name resolves", () => {
  const hit = inferTimezoneFromAddress("Warsaw");
  assert.equal(hit.zone, "Europe/Warsaw");
});

test("D-R48: a full address infers from the city, not the street", () => {
  const hit = inferTimezoneFromAddress("1 Market Square, Warsaw");
  assert.equal(hit.zone, "Europe/Warsaw");
  assert.equal(hit.matched, "Warsaw");
});

test("D-R48: 'Austin, TX' skips the unrecognized state abbreviation and matches the city", () => {
  const hit = inferTimezoneFromAddress("Austin, TX");
  assert.equal(hit.zone, "America/Chicago");
  assert.equal(hit.matched, "Austin");
});

test("D-R48: a newline-separated address is scanned the same way, last segment first", () => {
  // "USA" is itself a country name and is the LAST segment, so it wins over "Austin" -
  // the rule is the last city OR COUNTRY name, not necessarily the most specific one.
  const hit = inferTimezoneFromAddress("123 Main St\nAustin, TX\nUSA");
  assert.ok(hit, "expected a match somewhere in the address");
  assert.equal(hit.matched, "USA");
});

test("D-R48: an address with no recognizable place infers nothing", () => {
  const hit = inferTimezoneFromAddress("42 Nowhere Lane, Zzyzxville");
  assert.equal(hit, undefined);
});

test("D-R48: an empty or missing address infers nothing", () => {
  assert.equal(inferTimezoneFromAddress(""), undefined);
  assert.equal(inferTimezoneFromAddress(undefined), undefined);
});
