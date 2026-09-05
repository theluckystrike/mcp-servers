// Every figure quoted in the month-end-close guide must be a figure the round 27
// measurement actually produced. The guide is a report of one run, not an
// illustration, so a number that is not in data/user_value_r27.json is a number
// nobody measured. Numbers are compared with commas stripped from both sides and
// with digit boundaries enforced, so 11 does not satisfy itself out of 1,107.00.
import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { GUIDES } from "../src/content.js";

const SLUG = "month-end-close-with-mcp-servers";
const round = readFileSync(new URL("../../data/user_value_r27.json", import.meta.url), "utf8");
const haystack = round.replace(/,(?=\d)/g, "");

function figures(text) {
  const plain = text.replace(/<[^>]+>/g, " ");
  const found = plain.match(/\d[\d,]*(?:\.\d+)?/g) || [];
  return [...new Set(found.map((n) => n.replace(/,/g, "")))];
}

test("the month-end-close guide exists", () => {
  assert.ok(GUIDES[SLUG], `${SLUG} should be a live guide`);
});

test("every figure in the guide appears in data/user_value_r27.json", () => {
  const g = GUIDES[SLUG];
  const text = [g.title, g.description, g.html, ...g.faq.flatMap((f) => [f.q, f.a])].join("\n");
  const missing = [];
  for (const n of figures(text)) {
    const re = new RegExp(`(?<!\\d)(?<!\\d\\.)${n.replace(".", "\\.")}(?!\\d)(?!\\.\\d)`);
    if (!re.test(haystack)) missing.push(n);
  }
  assert.deepEqual(missing, [], `figures not in the round file: ${missing.join(", ")}`);
});
