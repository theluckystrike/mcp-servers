#!/usr/bin/env node
// gh-search-rank.mjs -- measure where our repos rank in GitHub repository search
// for buyer-intent queries, and record what the repos that outrank us look like.
//
// Why this exists: a blind assistant asked 18 buyer-intent questions cited github.com
// 21 times, glama.ai 7, and registry.modelcontextprotocol.io 0. GitHub repo search is
// the surface a recommendation is actually sourced from, so it is the surface to
// measure. Ranks are meaningless without a competitor diff, so this records the top
// five results per query with their description, topics and star count. That is the
// only way to tell a keyword problem from a stars problem.
//
// No paid API. Uses the already-authenticated `gh` CLI against GitHub's own
// search/repositories endpoint (rate limit 30 req/min, so calls are spaced).
//
// Usage:
//   node scripts/gh-search-rank.mjs --label before  > /dev/null
//   node scripts/gh-search-rank.mjs --label after
// Both runs are appended to data/gh_search_r1.json under their label.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "gh_search_r1.json");
const OWNER = "theluckystrike";
const TOP_N = 30;      // how deep we look for ourselves
const COMPETITORS = 5; // how many rivals we record per query

// Buyer-intent queries: the words a person types into GitHub when they want one of
// these servers. Derived from the 32 folders under servers/. `server` maps a query to
// the server it should surface, so a miss is attributable.
const QUERIES = [
  ["mcp invoice generator",        "invoice"],
  ["mcp server invoice pdf",       "invoice"],
  ["claude mcp invoice vat",       "invoice"],
  ["mcp server pdf merge",         "pdf"],
  ["mcp pdf split stamp",          "pdf"],
  ["mcp docx word document",       "docx"],
  ["mcp spreadsheet xlsx",         "spreadsheet"],
  ["mcp csv query server",         "spreadsheet"],
  ["mcp timezone meeting",         "timezone"],
  ["mcp meeting planner timezone", "timezone"],
  ["mcp currency converter",       "currency"],
  ["mcp exchange rates ecb",       "currency"],
  ["claude mcp expense tracker",   "expense-tracker"],
  ["mcp receipts mileage",         "expense-tracker"],
  ["mcp time tracking timesheet",  "time-tracker"],
  ["mcp billable hours freelance", "time-tracker"],
  ["mcp resume cover letter",      "resume"],
  ["mcp quote estimate proposal",  "quotes"],
  ["mcp qr code barcode",          "barcode"],
  ["mcp image resize thumbnail",   "image"],
  ["mcp zip archive unzip",        "zip"],
  ["mcp kanban task board",        "kanban"],
  ["mcp calendar ics free busy",   "calendar"],
  ["mcp bank statement reconcile", "bank-statement"],
  ["mcp bookkeeping double entry", "cash-book"],
  ["mcp accounts receivable aging","statement-of-account"],
  ["mcp price tracker shopping",   "price-tracker"],
  ["mcp recurring billing subscription", "recurring"],
  ["mcp fixed asset depreciation", "asset-register"],
  ["mcp work order field service", "work-order"],
  ["mcp per diem travel allowance","per-diem"],
  ["mcp petty cash imprest",       "petty-cash"],
  ["mcp contract clause library",  "clauses"],
  ["mcp price list rate card",     "catalogue"],
];

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

// A zero from search is only trustworthy from an instrument that has returned non-zero.
// This positive control runs first; if it comes back empty the run aborts rather than
// reporting 34 honest-looking zeros produced by a broken call.
function positiveControl() {
  const r = JSON.parse(gh(["api", "-X", "GET", "search/repositories",
    "-f", "q=modelcontextprotocol", "-F", "per_page=5"]));
  if (!r.total_count || !r.items?.length) {
    throw new Error("positive control failed: search/repositories returned nothing for 'modelcontextprotocol'");
  }
  return { query: "modelcontextprotocol", total_count: r.total_count, first: r.items[0].full_name };
}

// The search endpoint allows 30 requests per minute and answers 403 when that is
// exceeded. A 403 here is a rate limit, not a zero: retry with backoff rather than
// recording an empty result, which would look exactly like "nobody has this repo".
function search(q, attempt = 0) {
  try {
    return JSON.parse(gh(["api", "-X", "GET", "search/repositories",
      "-f", `q=${q}`, "-F", `per_page=${TOP_N}`]));
  } catch (e) {
    if (attempt < 4 && /rate limit|403/i.test(String(e.stderr || e.message))) {
      execFileSync("sleep", [String(20 * (attempt + 1))]);
      return search(q, attempt + 1);
    }
    throw e;
  }
}

function summarise(item) {
  return {
    full_name: item.full_name,
    stars: item.stargazers_count,
    forks: item.forks_count,
    pushed_at: item.pushed_at,
    created_at: item.created_at,
    description: item.description,
    topics: item.topics || [],
    has_homepage: Boolean(item.homepage),
    open_issues: item.open_issues_count,
  };
}

function run(label) {
  const control = positiveControl();
  const rows = [];
  for (const [q, server] of QUERIES) {
    let r;
    try {
      r = search(q);
    } catch (e) {
      rows.push({ query: q, server, error: String(e.message).slice(0, 200) });
      continue;
    }
    const items = r.items || [];
    let ourRank = null, ourRepo = null;
    items.forEach((it, i) => {
      if (ourRank === null && it.owner?.login?.toLowerCase() === OWNER) {
        ourRank = i + 1;
        ourRepo = it.full_name;
      }
    });
    rows.push({
      query: q,
      server,
      total_count: r.total_count,
      returned: items.length,
      our_rank: ourRank,          // null means: not in the top TOP_N
      our_repo: ourRepo,
      competitors: items.slice(0, COMPETITORS).map(summarise),
    });
    process.stderr.write(`${q}  total=${r.total_count}  our_rank=${ourRank ?? "-"}\n`);
    // 30 authenticated search requests per minute.
    execFileSync("sleep", ["3"]);
  }
  return { label, measured_at: new Date().toISOString(), control, top_n: TOP_N, rows };
}

const label = (process.argv.includes("--label")
  ? process.argv[process.argv.indexOf("--label") + 1]
  : "run") || "run";

mkdirSync(dirname(OUT), { recursive: true });
const result = run(label);
// Re-read AFTER the run, not before: a run takes two minutes and anything else written to
// this file in the meantime (the context block, another label) would otherwise be
// silently overwritten by a stale copy. Measured the hard way.
const doc = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { runs: [] };
doc.runs = (doc.runs || []).filter((x) => x.label !== label).concat([result]);
writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");

const errored = result.rows.filter((r) => r.error);
const surfaced = result.rows.filter((r) => r.our_rank != null);
process.stderr.write(
  `\n[${label}] ${surfaced.length}/${result.rows.length - errored.length} answered queries surfaced a ${OWNER} repo in the top ${TOP_N}` +
  (errored.length ? ` (${errored.length} query/queries errored and are NOT counted)` : "") + "\n"
);
if (surfaced.length) {
  process.stderr.write(
    surfaced.map((r) => `  rank ${r.our_rank}  ${r.our_repo}  <- "${r.query}" (${r.total_count} results)`).join("\n") + "\n"
  );
}
