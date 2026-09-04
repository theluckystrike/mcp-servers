#!/usr/bin/env node
// release-check: one command that fails the release when a server is only half wired.
//
// Every server in this monorepo has to be present in about twenty places outside its own
// folder before it is really shipped: registry manifests, the office-suite proxy, three
// build scripts, two data files, the Stripe product table, the setup pages, a guide, a
// comparison page, a demo GIF, a logo, and the container/marketplace descriptors. Every
// release so far found at least one of those missing by hand (zip shipped with one
// registry name, barcode carried a 106-character description with no remotes block, the
// claude-web pages lagged hosting twice). This script is the reader those lists never had.
//
// Run: node scripts/release-check.mjs        (also: npm run release:check)
// Exit 0 when every check passes, 1 otherwise. Prints a server x check table.
//
// Deliberately dependency-free and read-only: it never writes, never builds, never calls
// the network, and imports the billing and setup modules only to read their exported
// tables, so it cannot itself be the thing that breaks a release.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVERS_DIR = join(ROOT, "servers");
const MAX_DESCRIPTION = 100; // the registry returns 422 above this
const SCOPE = "@theluckystrike";

const read = (p) => readFileSync(p, "utf8");
const readJson = (p) => JSON.parse(read(p));
const has = (p) => existsSync(p);

/* ------------------------------------------------------------------ inputs */

// The release version is office-suite's: it is the umbrella package every child is
// vendored into, so nothing can ship at a version it disagrees with. The root
// package.json is the private workspace shell and stays at 0.1.0 by design.
const RELEASE_VERSION = readJson(join(SERVERS_DIR, "office-suite", "package.json")).version;

// Every servers/<x> with a package.json, office-suite excepted (it is the bundle, not a
// product: no Stripe price, no comparison page, no second registry name).
const SERVERS = readdirSync(SERVERS_DIR)
  .sort()
  .filter((n) => n !== "office-suite" && has(join(SERVERS_DIR, n, "package.json")));

const src = {
  officeSuite: read(join(ROOT, "servers", "office-suite", "src", "index.ts")),
  buildMcpb: read(join(ROOT, "scripts", "build-mcpb.sh")),
  syncMirrors: read(join(ROOT, "scripts", "sync-mirrors.sh")),
  buildPages: read(join(ROOT, "scripts", "build-pages.mjs")),
  remote: read(join(ROOT, "remote", "src", "index.ts")),
};
const facts = readJson(join(ROOT, "data", "facts.json"));
const tools = readJson(join(ROOT, "data", "tools.json"));
const assets = readdirSync(join(ROOT, "assets"));

const billing = await import(join(ROOT, "billing", "src", "index.js"));
const setup = await import(join(ROOT, "billing", "src", "setup.js"));
const content = await import(join(ROOT, "billing", "src", "content.js"));
const compare = await import(join(ROOT, "billing", "src", "compare.js"));

const { PRODUCTS } = billing;
const { SETUP_SERVERS, CLIENT_ORDER } = setup;
const { GUIDES } = content;
const { COMPARE } = compare;

// The six installed clients. claude-web is the hosted connector and is served by
// WEB_ANGLE, not by ANGLE, so it is not one of the six.
const ANGLE_CLIENTS = CLIENT_ORDER.filter((c) => c !== "claude-web");

// setup.js keeps ANGLE and WEB_ANGLE module-private (only the rendered page is exported),
// so read them out of the source text rather than re-exporting them for a checker.
const setupSrc = read(join(ROOT, "billing", "src", "setup.js"));
/** Text of a top-level `const NAME = { ... };` object literal in setup.js. */
function objectBody(name) {
  const start = setupSrc.indexOf(`const ${name} = {`);
  if (start < 0) throw new Error(`release-check: cannot find ${name} in billing/src/setup.js`);
  let i = setupSrc.indexOf("{", start);
  let depth = 0;
  for (let j = i; j < setupSrc.length; j++) {
    if (setupSrc[j] === "{") depth++;
    else if (setupSrc[j] === "}") {
      depth--;
      if (depth === 0) return setupSrc.slice(i, j + 1);
    }
  }
  throw new Error(`release-check: unbalanced ${name} in billing/src/setup.js`);
}
const ANGLE_SRC = objectBody("ANGLE");
const WEB_ANGLE_SRC = objectBody("WEB_ANGLE");
const WEB_EXCLUDED = JSON.parse(
  (setupSrc.match(/const WEB_EXCLUDED = (\[[^\]]*\]);/) || [, "[]"])[1].replace(/'/g, '"'),
);

/** The value of key `id` in an object-literal source blob, as raw text, or null. */
function entryText(blob, id) {
  const idx = blob.search(new RegExp(`(?:"${id}"|${id})\\s*:`));
  if (idx < 0) return null;
  const after = blob.slice(blob.indexOf(":", idx) + 1);
  if (after.trimStart().startsWith("{")) {
    const s = after.indexOf("{");
    let depth = 0;
    for (let j = s; j < after.length; j++) {
      if (after[j] === "{") depth++;
      else if (after[j] === "}") {
        depth--;
        if (depth === 0) return after.slice(s, j + 1);
      }
    }
    return null;
  }
  return after.slice(0, after.indexOf("\n") + 1);
}

/** Deep value equality, order-insensitive for object keys. */
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a !== "object") return false;
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}

/* ------------------------------------------------------------------ checks */

// Each check: { id, label, fn(server) -> true | string }. A string is the failure reason.
// Truth is always read from a file, never from a list inside this script: the point is to
// have no second copy of the estate that can itself go stale.

const checks = [];
const check = (id, label, fn) => checks.push({ id, label, fn });

check("version", "version == release", (s) => {
  const p = readJson(join(SERVERS_DIR, s, "package.json"));
  if (p.version !== RELEASE_VERSION) return `${p.version}, release is ${RELEASE_VERSION}`;
  const bad = [];
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    for (const [name, range] of Object.entries(p[field] || {})) {
      if (!name.startsWith(SCOPE + "/")) continue;
      if (range !== `^${RELEASE_VERSION}`) bad.push(`${name}@${range}`);
    }
  }
  return bad.length ? `ranges: ${bad.join(", ")}` : true;
});

check("manifests", "server.json + mcpb", (s) => {
  const miss = ["server.json", "server.mcpb.json"].filter((f) => !has(join(SERVERS_DIR, s, f)));
  return miss.length ? `missing ${miss.join(", ")}` : true;
});

check("desc", `descriptions < ${MAX_DESCRIPTION}`, (s) => {
  const bad = [];
  for (const f of readdirSync(join(SERVERS_DIR, s)).filter((f) => /^server(\..+)?\.json$/.test(f))) {
    const j = readJson(join(SERVERS_DIR, s, f));
    // server.npm-package.json is a package fragment (`{"npm": {...}}`), not a manifest:
    // no name, no description, never published. Anything with a registry name is.
    if (typeof j.name !== "string") continue;
    const d = j.description;
    if (typeof d !== "string") { bad.push(`${f}: no description`); continue; }
    if (d.length > MAX_DESCRIPTION) bad.push(`${f}: ${d.length}`);
    // A description that ends ",." or ".." was cut to fit the limit by a machine and
    // reads as damage in the registry listing. Rewrite the sentence instead.
    else if (/[,.]\.$/.test(d) || /,$/.test(d)) bad.push(`${f}: truncated at the limit (${JSON.stringify(d.slice(-24))})`);
  }
  return bad.length ? bad.join("; ") : true;
});

check("names", "second registry name", (s) => {
  const extra = readdirSync(join(SERVERS_DIR, s)).filter(
    (f) => /^server\..+\.json$/.test(f) && f !== "server.mcpb.json" && f !== "server.npm-package.json",
  );
  if (!extra.length) return "only server.mcpb.json; needs server.variant.json or server.<token>.json";
  const primary = readJson(join(SERVERS_DIR, s, "server.json")).name;
  const dupes = extra.filter((f) => readJson(join(SERVERS_DIR, s, f)).name === primary);
  return dupes.length ? `${dupes.join(", ")} repeat the primary name ${primary}` : true;
});

check("remotes", "remotes.json merged", (s) => {
  const rp = join(SERVERS_DIR, s, "remotes.json");
  if (!has(rp)) return true; // stdio-only server: nothing to merge
  const remotes = readJson(rp);
  const mcpb = readJson(join(SERVERS_DIR, s, "server.mcpb.json"));
  if (!mcpb.remotes) return "server.mcpb.json has no remotes block";
  return deepEqual(mcpb.remotes, remotes) ? true : "server.mcpb.json remotes != remotes.json by value";
});

check("endpoint", "remote /mcp/<x>", (s) => {
  if (!has(join(SERVERS_DIR, s, "remotes.json"))) return true;
  const re = new RegExp(`["']${s}["']\\s*:\\s*\\{`);
  return re.test(src.remote) ? true : `remote/src/index.ts SERVERS has no "${s}"`;
});

check("web", "claude-web setup page", (s) => {
  if (!has(join(SERVERS_DIR, s, "remotes.json"))) return true;
  if (WEB_EXCLUDED.includes(s)) return `WEB_EXCLUDED lists ${s} although it is hosted`;
  return entryText(WEB_ANGLE_SRC, s) ? true : "no WEB_ANGLE entry";
});

check("children", "office-suite CHILDREN", (s) =>
  new RegExp(`id:\\s*"${s}"`).test(src.officeSuite) ? true : "not in CHILDREN");

check("mcpb-lists", "build-mcpb 3 lists", (s) => {
  const miss = [];
  const servers = (src.buildMcpb.match(/^SERVERS="([^"]*)"/m) || [, ""])[1].split(/\s+/);
  if (!servers.includes(s)) miss.push("SERVERS");
  if (!new RegExp(`^\\s*\\[${s}\\]="`, "m").test(src.buildMcpb)) miss.push("DISPLAY_NAME");
  if (!new RegExp(`^\\s*\\[${s}\\]='\\[`, "m").test(src.buildMcpb)) miss.push("KEYWORDS");
  return miss.length ? `missing ${miss.join(", ")}` : true;
});

check("mirrors", "sync-mirrors", (s) => {
  const all = (src.syncMirrors.match(/^ALL_SERVERS="([^"]*)"/m) || [, ""])[1].split(/\s+/);
  const miss = [];
  if (!all.includes(s)) miss.push("ALL_SERVERS");
  if (!new RegExp(`^\\s*${s}\\)\\s*echo`, "m").test(src.syncMirrors)) miss.push("topics_for");
  return miss.length ? `missing ${miss.join(", ")}` : true;
});

check("pages", "build-pages ids", (s) =>
  new RegExp(`["']${s}["']`).test((src.buildPages.match(/const ids = \[[^\]]*\]/) || [""])[0])
    ? true
    : "not in ids");

check("facts", "facts.json", (s) => (facts.servers?.[s] ? true : "no entry"));

check("tools", "tools.json", (s) =>
  Array.isArray(tools[s]) && tools[s].length ? true : "no entry");

check("product", "Stripe PRODUCTS", (s) => {
  const p = PRODUCTS[s];
  if (!p) return "no entry";
  if (!p.price || !/^price_/.test(p.price)) return "no Stripe price id";
  return true;
});

check("setup", `SETUP_SERVERS + ${ANGLE_CLIENTS.length} ANGLE`, (s) => {
  if (!SETUP_SERVERS[s]) return "not in SETUP_SERVERS";
  const body = entryText(ANGLE_SRC, s);
  if (!body) return "no ANGLE entry";
  const miss = ANGLE_CLIENTS.filter((c) => !new RegExp(`(?:"${c}"|${c})\\s*:`).test(body));
  return miss.length ? `ANGLE missing ${miss.join(", ")}` : true;
});

check("compare", "COMPARE page", (s) => (COMPARE[s] ? true : "no entry"));

check("guide", "a guide mentions it", (s) => {
  const title = SETUP_SERVERS[s]?.title || s;
  const needles = [s, `/s/${s}`, `mcp-${s}`, title];
  for (const [slug, g] of Object.entries(GUIDES)) {
    const blob = JSON.stringify(g);
    if (needles.some((n) => blob.includes(n))) return true;
    void slug;
  }
  return "no guide mentions this server";
});

check("gif", "demo GIF", (s) => (assets.includes(`demo-${s}.gif`) ? true : `assets/demo-${s}.gif missing`));
check("logo", "logo", (s) => (assets.includes(`${s}-logo.png`) ? true : `assets/${s}-logo.png missing`));

check("docker", "Dockerfile", (s) => (has(join(SERVERS_DIR, s, "Dockerfile")) ? true : "missing"));
check("smithery", "smithery.yaml", (s) => (has(join(SERVERS_DIR, s, "smithery.yaml")) ? true : "missing"));
check("glama", "glama.json", (s) => (has(join(SERVERS_DIR, s, "glama.json")) ? true : "missing"));
check("llms", "llms-install.md", (s) => (has(join(SERVERS_DIR, s, "llms-install.md")) ? true : "missing"));
check("spec", "SPEC.md", (s) => (has(join(SERVERS_DIR, s, "SPEC.md")) ? true : "missing"));
check("contract", "contract test", (s) =>
  has(join(SERVERS_DIR, s, "test", "contract.test.mjs")) ? true : "test/contract.test.mjs missing");

/* ----------------------------------------------------------------- waivers */

// Two kinds of thing fail this script. A wiring gap is a one-line omission and is fixed in
// the same minute it is found; those block the release. A content gap is a document
// somebody has to write and cannot be fixed by editing a list, and holding the whole
// release chain hostage to one would only get this script removed from build-mcpb.sh.
//
// So a content gap is recorded here, by server and check, with the reason. A waived
// failure prints `gap` and does not block. Everything else about it still blocks:
//   - the same check failing on a server NOT in this table blocks (the list cannot grow
//     silently, which is how "known gap" tables usually rot);
//   - a waiver whose check now passes is reported stale and blocks, so the entry has to
//     be deleted when the work lands.
// Recorded 2026-09-04. Owners are named so the table reads as a queue, not an excuse.
const WAIVERS = [
  { check: "compare", servers: ["zip"],
    why: "billing/src/compare.js rows are quoted from named competitors' own READMEs on a dated read; no zip alternative has been researched yet, and a comparison page cannot be invented" },
];
const waived = new Map(); // "server:check" -> why
for (const w of WAIVERS) for (const s of w.servers) waived.set(`${s}:${w.check}`, w.why);

/* --------------------------------------------------- estate-wide assertions */

/** Checks that are about the estate, not about one server. */
const globals = [];
const global_ = (label, fn) => globals.push({ label, fn });

global_("PRODUCTS.bundle names the right count and saving", () => {
  const b = PRODUCTS.bundle;
  if (!b) return "no bundle product";
  const n = SERVERS.length;
  const saving = n * PRODUCTS[SERVERS[0]].usd - b.usd;
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
    "twenty", "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five"];
  const bad = [];
  const prices = new Set(SERVERS.map((s) => PRODUCTS[s]?.usd));
  if (prices.size !== 1) bad.push(`per-server prices are not uniform: ${[...prices].join(", ")}`);
  if (!b.desc.includes(`$${saving}`)) bad.push(`desc does not name the saving $${saving} (${n} x $${PRODUCTS[SERVERS[0]].usd} - $${b.usd})`);
  const named = new RegExp(`\\b(${words[n]}|${n})\\b`, "i").test(b.desc);
  if (!named) bad.push(`desc does not name the server count ${n} (${words[n]})`);
  return bad.length ? bad.join("; ") : true;
});

global_("every hosted server has a claude-web page", () => {
  const hosted = SERVERS.filter((s) => has(join(SERVERS_DIR, s, "remotes.json")));
  const missing = hosted.filter((s) => !entryText(WEB_ANGLE_SRC, s));
  return missing.length ? `no WEB_ANGLE for ${missing.join(", ")}` : true;
});

global_("no list carries a server that does not exist", () => {
  const known = new Set([...SERVERS, "office-suite"]);
  const strays = [];
  const servers = (src.buildMcpb.match(/^SERVERS="([^"]*)"/m) || [, ""])[1].split(/\s+/).filter(Boolean);
  for (const s of servers) if (!known.has(s)) strays.push(`build-mcpb SERVERS: ${s}`);
  const all = (src.syncMirrors.match(/^ALL_SERVERS="([^"]*)"/m) || [, ""])[1].split(/\s+/).filter(Boolean);
  for (const s of all) if (!known.has(s)) strays.push(`sync-mirrors ALL_SERVERS: ${s}`);
  for (const s of Object.keys(PRODUCTS)) if (s !== "bundle" && !known.has(s)) strays.push(`PRODUCTS: ${s}`);
  for (const s of Object.keys(SETUP_SERVERS)) if (!known.has(s)) strays.push(`SETUP_SERVERS: ${s}`);
  for (const s of Object.keys(COMPARE)) if (!known.has(s)) strays.push(`COMPARE: ${s}`);
  return strays.length ? strays.join("; ") : true;
});

/* ------------------------------------------------------------------ report */

const results = new Map(); // server -> check id -> true | reason
for (const s of SERVERS) {
  const row = new Map();
  for (const c of checks) {
    let r;
    try { r = c.fn(s); } catch (e) { r = `threw: ${e.message}`; }
    row.set(c.id, r);
  }
  results.set(s, row);
}

const nameW = Math.max(...SERVERS.map((s) => s.length), 6);
const colW = checks.map((c) => Math.max(c.id.length, 3));
const pad = (s, w) => s + " ".repeat(Math.max(0, w - s.length));

console.log(`release-check: ${SERVERS.length} servers at ${RELEASE_VERSION}, ${checks.length} checks each\n`);
console.log(pad("server", nameW) + "  " + checks.map((c, i) => pad(c.id, colW[i])).join(" "));
console.log("-".repeat(nameW) + "  " + colW.map((w) => "-".repeat(w)).join(" "));
const cell = (s, id) => {
  const r = results.get(s).get(id);
  if (r === true) return waived.has(`${s}:${id}`) ? "STALE" : "ok";
  return waived.has(`${s}:${id}`) ? "gap" : "FAIL";
};
for (const s of SERVERS) {
  console.log(pad(s, nameW) + "  " + checks.map((c, i) => pad(cell(s, c.id), colW[i])).join(" "));
}

const failures = [];
const gaps = [];
for (const s of SERVERS) {
  for (const c of checks) {
    const r = results.get(s).get(c.id);
    const w = waived.get(`${s}:${c.id}`);
    if (r !== true && w) gaps.push(`${s}  ${c.id}: ${r}  [waived: ${w}]`);
    else if (r !== true) failures.push(`${s}  ${c.id}: ${r}`);
    else if (w) failures.push(`${s}  ${c.id}: waiver is stale, this check now passes; delete it from WAIVERS in scripts/release-check.mjs`);
  }
}
// A waiver naming a server that no longer exists is also stale.
for (const w of WAIVERS) {
  for (const s of w.servers) {
    if (!SERVERS.includes(s)) failures.push(`estate  waiver ${w.check}/${s}: no such server; delete it from WAIVERS`);
  }
}

console.log("");
for (const g of globals) {
  let r;
  try { r = g.fn(); } catch (e) { r = `threw: ${e.message}`; }
  console.log(`${r === true ? "ok  " : "FAIL"}  ${g.label}`);
  if (r !== true) failures.push(`estate  ${g.label}: ${r}`);
}

console.log("");
if (gaps.length) {
  console.log(`${gaps.length} recorded gap(s), not blocking (see WAIVERS in this script):`);
  for (const g of gaps) console.log(`  ${g}`);
  console.log("");
}
if (failures.length) {
  console.log(`${failures.length} failure(s):`);
  for (const f of failures) console.log(`  ${f}`);
  console.log("");
  console.log("legend: " + checks.map((c) => `${c.id}=${c.label}`).join(", "));
  process.exit(1);
}
console.log(`release-check: green (${gaps.length} recorded gap(s))`);
