#!/usr/bin/env node
// loop34-fields.mjs -- measure GitHub repository-search fields for candidate NEW
// servers, one buyer query per candidate. Records total_count and the top-3 repos
// with full_name, stargazers_count, and name-term coverage (fraction of query terms
// present in the repo name). 5s spacing between calls; search limit is 30/min.
//
// Usage: node scripts/loop34-fields.mjs  (writes data/loop36_fields_raw.json)

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "loop36_fields_raw.json");

const CANDIDATES = [
  ["delivery-note",        "mcp delivery note"],
  ["late-fee-calculator",  "mcp late fee"],
  ["retainer-agreement",   "mcp retainer agreement"],
  ["incident-report",      "mcp incident report"],
  ["risk-register",        "mcp risk register"],
  ["staff-rota",           "mcp staff rota"],
  ["visitor-log",          "mcp visitor log"],
  ["price-list",           "mcp price list"],
  ["commission-calculator","mcp commission calculator"],
  ["purchase-requisition", "mcp purchase requisition"],
  ["goods-received-note",  "mcp goods received note"],
  ["handover-note",        "mcp handover note"],
  ["appointment-booking",  "mcp appointment booking"],
  ["service-report",       "mcp service report"],
  ["equipment-checkout",   "mcp equipment checkout"],
  ["punch-list",           "mcp punch list"],
  ["rent-invoice",         "mcp rent invoice"],
  ["subcontractor-agreement", "mcp subcontractor agreement"],
];

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

function positiveControl() {
  const r = JSON.parse(gh(["api", "-X", "GET", "search/repositories",
    "-f", "q=modelcontextprotocol", "-F", "per_page=5"]));
  if (!r.total_count || !r.items?.length) throw new Error("positive control failed");
  return { query: "modelcontextprotocol", total_count: r.total_count, first: r.items[0].full_name };
}

function search(q, attempt = 0) {
  try {
    return JSON.parse(gh(["api", "-X", "GET", "search/repositories",
      "-f", `q=${q}`, "-F", "per_page=10"]));
  } catch (e) {
    if (attempt < 4 && /rate limit|403/i.test(String(e.stderr || e.message))) {
      execFileSync("sleep", [String(20 * (attempt + 1))]);
      return search(q, attempt + 1);
    }
    throw e;
  }
}

function nameCoverage(query, repoName) {
  const terms = query.toLowerCase().split(/\s+/);
  const name = repoName.toLowerCase().replace(/[-_/.]+/g, " ");
  const hit = terms.filter((t) => name.includes(t)).length;
  return +(hit / terms.length).toFixed(2);
}

const control = positiveControl();
const rows = [];
for (const [candidate, q] of CANDIDATES) {
  let r;
  try {
    r = search(q);
  } catch (e) {
    rows.push({ candidate, query: q, error: String(e.message).slice(0, 200) });
    continue;
  }
  const top3 = (r.items || []).slice(0, 3).map((it) => ({
    name: it.full_name,
    stars: it.stargazers_count,
    name_coverage: nameCoverage(q, it.name),
  }));
  rows.push({ candidate, query: q, total_count: r.total_count, top3 });
  process.stderr.write(`${candidate}  "${q}"  total=${r.total_count}\n`);
  execFileSync("sleep", ["5"]);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ measured_at: new Date().toISOString(), control, rows }, null, 2) + "\n");
process.stderr.write(`wrote ${OUT}\n`);
