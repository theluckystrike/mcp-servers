#!/usr/bin/env node
// Generates billing/src/figures.js: every number the guide pages are allowed to quote,
// read out of the repository rather than typed by a writer.
//
// Why this exists. A prior round shipped a guide that promised every figure came from one
// measured run and then quoted the current bundle instead, and billing/test/guide-figures.test.mjs
// was added to catch exactly that on one page. This file generalises the idea: a page that
// wants to say "31 servers" or "600 calls an hour" interpolates a constant from here, so the
// number cannot go stale without the generator noticing.
//
// Sources, all inside this repository, none of them under billing/src:
//   servers/<id>/src/index.ts          -> server.registerTool(...) calls, the stdio tool count
//   packages/mcp-license/src/index.ts  -> the shared license tools every server registers
//   remote/src/index.ts                -> the hosted SERVERS map and the rate-limit constants
//   servers/<id>/server.json           -> the published version
//   data/facts.json                    -> prices, and the free-tier sentence per server
//
// Verification of the tool-count derivation, 2026-09-10, against the live hosted endpoints:
//   invoice     src 11 + 2 = 13, tools/list returned 13
//   kanban      src 15 + 2 = 17, tools/list returned 17
//   petty-cash  src  7 + 2 =  9, tools/list returned  9
//   barcode     src  8 + 2 = 10, tools/list returned 10
//   zip         src  7 + 2 =  9, tools/list returned 12
// zip disagrees because the hosted wrapper adds three file-transfer tools that the stdio
// server does not have. So TOOLS here is the STDIO count and is labelled that way wherever
// a page quotes it. Do not present it as the hosted count.
//
// Usage: node scripts/build-figures.mjs           (writes billing/src/figures.js)
//        node scripts/build-figures.mjs --check   (exits 1 if the file is out of date)

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "billing/src/figures.js");

function read(p) {
  return readFileSync(join(ROOT, p), "utf8");
}

/** Count `server.registerTool("name"` calls in a TypeScript source file. */
function countRegisterTool(src) {
  return (src.match(/\bregisterTool\s*\(\s*["'`]/g) || []).length;
}

/** Read one `const NAME = <int>;` out of a TypeScript source file, or throw. */
function intConst(src, name, where) {
  const m = src.match(new RegExp(`\\bconst\\s+${name}\\s*(?::\\s*number\\s*)?=\\s*(\\d[\\d_]*)`));
  if (!m) throw new Error(`build-figures: ${name} not found in ${where}`);
  return Number(m[1].replace(/_/g, ""));
}

// ---------------------------------------------------------------------------
// servers/
// ---------------------------------------------------------------------------
const SERVER_IDS = readdirSync(join(ROOT, "servers"))
  .filter((d) => existsSync(join(ROOT, "servers", d, "src/index.ts")))
  .sort();

// A server directory can exist for days before the storefront serves a page for it, and
// during that window the site must not count it. The authority on what the site lists is
// the `ids` array in scripts/build-pages.mjs, because that array is exactly what becomes
// billing/src/pages.js and therefore exactly what /s/<id> serves. Reading the directory
// instead was wrong twice on 2026-09-10 alone: servers/packing-list appeared with source
// and no README, then with a README and still no page.
const pagesSrc = read("scripts/build-pages.mjs");
const idsMatch = pagesSrc.match(/^const ids = \[([^\]]*)\];/m);
if (!idsMatch) throw new Error("build-figures: could not read the ids array from scripts/build-pages.mjs");
const LISTED_IDS = [...idsMatch[1].matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]).sort();
if (LISTED_IDS.length < 2) throw new Error("build-figures: the page id list came back empty");
for (const id of LISTED_IDS) {
  if (!SERVER_IDS.includes(id)) throw new Error(`build-figures: ${id} has a page and no src/index.ts`);
}
const LISTED_CHILD_IDS = LISTED_IDS.filter((id) => id !== "office-suite");

const TOOLS = {};
for (const id of SERVER_IDS) {
  TOOLS[id] = countRegisterTool(read(`servers/${id}/src/index.ts`));
}

const licenseSrc = read("packages/mcp-license/src/index.ts");
const LICENSE_TOOLS = countRegisterTool(licenseSrc);
if (LICENSE_TOOLS < 1) throw new Error("build-figures: no license tools found");

// office-suite spawns the others rather than registering tools of its own, so it is not a
// term in the catalogue total.
const CHILD_IDS = SERVER_IDS.filter((id) => id !== "office-suite");
// Listed children only: an unlisted server in progress is not part of what the suite ships.
const OWN_TOOLS_TOTAL = LISTED_CHILD_IDS.reduce((n, id) => n + TOOLS[id], 0);

// ---------------------------------------------------------------------------
// remote/  (the hosted endpoints and their limits)
// ---------------------------------------------------------------------------
const remoteSrc = read("remote/src/index.ts");
const serversBlockStart = remoteSrc.indexOf("const SERVERS: Record<string, ServerCfg> = {");
if (serversBlockStart < 0) throw new Error("build-figures: SERVERS map not found in remote/src/index.ts");
const serversBlock = remoteSrc.slice(serversBlockStart, remoteSrc.indexOf("\n};", serversBlockStart));
const HOSTED_IDS = [...serversBlock.matchAll(/^ {2}"?([a-z][a-z0-9-]*)"?:\s*\{/gm)].map((m) => m[1]);
if (HOSTED_IDS.length < 2) throw new Error("build-figures: hosted server list came back empty");

const RATE_LIMIT_FREE = intConst(remoteSrc, "RATE_LIMIT_FREE", "remote/src/index.ts");
const RATE_LIMIT_PRO = intConst(remoteSrc, "RATE_LIMIT_PRO", "remote/src/index.ts");
const DISCOVERY_LIMIT = intConst(remoteSrc, "DISCOVERY_LIMIT", "remote/src/index.ts");
const TOKEN_MINTS_PER_IP = intConst(remoteSrc, "TOKEN_MINTS_PER_IP", "remote/src/index.ts");
const SWEEP_AFTER_DAYS = intConst(remoteSrc, "SWEEP_AFTER_DAYS", "remote/src/index.ts");
const ANON_TOKEN_DAYS = Number((remoteSrc.match(/data_retention_days:\s*(\d+)/) || [])[1]);
if (!ANON_TOKEN_DAYS) throw new Error("build-figures: anonymous token retention not found");

// ---------------------------------------------------------------------------
// data/facts.json  (prices, and the free-tier sentence per server)
// ---------------------------------------------------------------------------
const facts = JSON.parse(read("data/facts.json"));
const SINGLE_USD = facts.pricing.single_usd;
const BUNDLE_USD = facts.pricing.bundle_usd;
if (!SINGLE_USD || !BUNDLE_USD) throw new Error("build-figures: prices missing from data/facts.json");

const FREE = {};
const PRO = {};
for (const id of SERVER_IDS) {
  const f = facts.servers?.[id];
  if (!f) continue;
  if (f.free) FREE[id] = f.free;
  if (f.pro) PRO[id] = f.pro;
}

// ---------------------------------------------------------------------------
// versions
// ---------------------------------------------------------------------------
const versions = new Set();
for (const id of SERVER_IDS) {
  const p = join(ROOT, "servers", id, "server.json");
  if (existsSync(p)) versions.add(JSON.parse(readFileSync(p, "utf8")).version);
}
const VERSION = versions.size === 1 ? [...versions][0] : [...versions].sort().pop();

// ---------------------------------------------------------------------------
// emit
// ---------------------------------------------------------------------------
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty"];
const TENS = { 20: "twenty", 30: "thirty", 40: "forty", 50: "fifty", 60: "sixty", 70: "seventy", 80: "eighty", 90: "ninety" };

function j(v) { return JSON.stringify(v, null, 2); }

const banner = `// GENERATED by scripts/build-figures.mjs. Do not edit by hand.
//
// Every number a guide page is allowed to quote lives here, read out of the repository at
// build time. Regenerate with \`node scripts/build-figures.mjs\`; \`--check\` fails when this
// file no longer matches the sources. billing/test/figures.test.mjs runs the check.
//
// TOOLS is the STDIO tool count: server.registerTool calls in servers/<id>/src/index.ts.
// The hosted wrapper adds file-transfer tools to some servers, so the hosted count can be
// higher. Pages must say "stdio" when they quote it.
`;

const body = `${banner}
/** Every server directory with a TypeScript entry point, sorted. */
export const SERVER_IDS = ${j(SERVER_IDS)};

/** Servers that register tools of their own, i.e. everything office-suite spawns. */
export const CHILD_IDS = ${j(CHILD_IDS)};

/** Servers answering at https://mcp.zovo.one/mcp/<id>, read from remote/src/index.ts. */
export const HOSTED_IDS = ${j(HOSTED_IDS)};

/** stdio tools each server registers, excluding the shared license pair. */
export const TOOLS = ${j(TOOLS)};

/** Tools @theluckystrike/mcp-license adds to every server. */
export const LICENSE_TOOLS = ${LICENSE_TOOLS};

/** Sum of TOOLS over CHILD_IDS. */
export const OWN_TOOLS_TOTAL = ${OWN_TOOLS_TOTAL};

/** Distinct tool names office-suite exposes: every child's own tools, plus the shared
 * license pair once. Reconciles with the independently measured OFFICE_SUITE_TOOLS in
 * billing/src/index.js, taken over stdio from the running bundle on 2026-09-07. */
export const OFFICE_SUITE_TOOLS = ${OWN_TOOLS_TOTAL + LICENSE_TOOLS};

/** Servers the site actually lists, i.e. those with a README that becomes a /s/ page. */
export const LISTED_IDS = ${j(LISTED_IDS)};
export const LISTED_CHILD_IDS = ${j(LISTED_CHILD_IDS)};

/** Counts, computed so prose cannot go stale. LISTED_COUNT is the one a visitor should
 * ever see: SERVER_DIR_COUNT can be ahead of it while a new server is being built. */
export const LISTED_COUNT = ${LISTED_IDS.length};
export const LISTED_CHILD_COUNT = ${LISTED_CHILD_IDS.length};
export const SERVER_DIR_COUNT = ${SERVER_IDS.length};
export const CHILD_COUNT = ${CHILD_IDS.length};
export const HOSTED_COUNT = ${HOSTED_IDS.length};

/** Hosted limits, read from remote/src/index.ts. */
export const RATE_LIMIT_FREE = ${RATE_LIMIT_FREE};
export const RATE_LIMIT_PRO = ${RATE_LIMIT_PRO};
export const DISCOVERY_LIMIT = ${DISCOVERY_LIMIT};
export const TOKEN_MINTS_PER_IP = ${TOKEN_MINTS_PER_IP};
export const ANON_TOKEN_DAYS = ${ANON_TOKEN_DAYS};
export const SWEEP_AFTER_DAYS = ${SWEEP_AFTER_DAYS};

/** Prices, read from data/facts.json. */
export const SINGLE_USD = ${SINGLE_USD};
export const BUNDLE_USD = ${BUNDLE_USD};

/** Published version, read from servers/<id>/server.json. */
export const VERSION = ${j(VERSION)};

/** The free-tier sentence for each server, verbatim from data/facts.json. */
export const FREE = ${j(FREE)};

/** The Pro sentence for each server, verbatim from data/facts.json. */
export const PRO = ${j(PRO)};

const ONES = ${j(NUMBER_WORDS)};
const TENS = ${j(TENS)};

/** A small integer as an English word, so a count can be written out without typing it. */
export function word(n) {
  if (n <= 20) return ONES[n] || String(n);
  const t = Math.floor(n / 10) * 10;
  const r = n % 10;
  if (!TENS[t]) return String(n);
  return r === 0 ? TENS[t] : TENS[t] + "-" + ONES[r];
}

/** Same, capitalised, for the start of a sentence. */
export function Word(n) {
  const w = word(n);
  return w.charAt(0).toUpperCase() + w.slice(1);
}
`;

if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current !== body) {
    process.stderr.write("billing/src/figures.js is out of date; run node scripts/build-figures.mjs\n");
    process.exit(1);
  }
  process.stdout.write(`figures OK: ${SERVER_IDS.length} server dirs, ${LISTED_IDS.length} listed, ${CHILD_IDS.length} children, ${HOSTED_IDS.length} hosted, ${OWN_TOOLS_TOTAL} own tools + ${LICENSE_TOOLS} license tools each\n`);
  process.exit(0);
}

writeFileSync(OUT, body);
process.stdout.write(`wrote billing/src/figures.js: ${SERVER_IDS.length} server dirs, ${LISTED_IDS.length} listed, ${CHILD_IDS.length} children, ${HOSTED_IDS.length} hosted, ${OWN_TOOLS_TOTAL} own tools, $${SINGLE_USD}/$${BUNDLE_USD}, v${VERSION}\n`);
