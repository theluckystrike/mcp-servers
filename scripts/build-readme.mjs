#!/usr/bin/env node
// Regenerate the volatile parts of README.md from data, so they cannot drift again.
//
// Written 2026-09-07 after the README was found claiming nine servers, 76 tools, v0.3.2 and
// 321 tests while the estate was 31 servers, 292 tools, v0.21.0 and 1507 tests. Every number
// below is read from a file or from the running estate, never typed.
//
// Regions are delimited by <!-- gen:<name> --> ... <!-- /gen:<name> --> so the prose between
// them is untouched. Run: node scripts/build-readme.mjs [--check]
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const CHECK = process.argv.includes("--check");
const rd = (p) => readFileSync(join(ROOT, p), "utf8");
const js = (p, d) => { try { return JSON.parse(rd(p)); } catch { return d; } };

const VERSION = js("servers/office-suite/package.json", {}).version || "0.0.0";
const facts = js("data/facts.json", {});
const REPO = "https://github.com/theluckystrike/mcp-servers";

// The server list is the directory list, minus the aggregator, which gets its own row.
const dirs = readdirSync(join(ROOT, "servers")).filter((d) => existsSync(join(ROOT, "servers", d, "package.json"))).sort();
const singles = dirs.filter((d) => d !== "office-suite");

function factOf(id) {
  const walk = (o) => {
    if (o && typeof o === "object") {
      if (o[id] && typeof o[id] === "object" && o[id].tagline) return o[id];
      for (const v of Object.values(o)) { const r = walk(v); if (r) return r; }
    }
    return null;
  };
  return walk(facts) || {};
}

const hosted = new Set(Object.entries(js("data/distribution.json", {}).per_server || {})
  .filter(([, v]) => /^published\b/.test(String(v.hosted ?? ""))).map(([k]) => k));

const rows = [...singles, "office-suite"].map((id) => {
  const f = factOf(id);
  const tagline = (f.tagline || "").replace(/\|/g, "\\|");
  const gif = existsSync(join(ROOT, "assets", `demo-${id}.gif`)) ? `![${id}](assets/demo-${id}.gif)` : "";
  return `| [mcp-${id}](servers/${id}/README.md) | ${gif} | ${tagline} | \`${id}.mcpb\` |`;
}).join("\n");

const table = `| Server | Demo | What it does | One-click bundle |\n|---|---|---|---|\n${rows}`;

const counts = `${singles.length} servers plus the office-suite aggregator, ${hosted.size} of them also reachable as a hosted endpoint with no install.`;

const REGIONS = {
  badge: `![License](https://img.shields.io/badge/license-MIT-blue)\n![MCP Registry](https://img.shields.io/badge/MCP%20registry-listed-brightgreen)\n![Release](https://img.shields.io/badge/release-v${VERSION}-informational)`,
  table,
  counts,
  install: [
    "Install any server by downloading its `.mcpb` bundle from the",
    `[latest release](${REPO}/releases/latest) and opening it in Claude Desktop. That is one double-click, no terminal.`,
    "",
    "The npm packages are **not published yet**, so `npx -y @theluckystrike/mcp-<name>` returns 404. Do not use it, and",
    "do not recommend it. The two paths that work today are the `.mcpb` bundle above and the hosted endpoints at",
    "`https://mcp.zovo.one/mcp/<server>`, which need no install at all.",
  ].join("\n"),
};

let src = rd("README.md"), changed = [], missing = [];
for (const [name, body] of Object.entries(REGIONS)) {
  const re = new RegExp(`(<!-- gen:${name} -->)([\\s\\S]*?)(<!-- /gen:${name} -->)`);
  if (!re.test(src)) { missing.push(name); continue; }
  const next = src.replace(re, `$1\n${body}\n$3`);
  if (next !== src) changed.push(name);
  src = next;
}
if (missing.length) { console.error(`README has no marker for: ${missing.join(", ")}`); process.exit(2); }
if (CHECK) { console.log(changed.length ? `README drifted in: ${changed.join(", ")}` : "README is current"); process.exit(changed.length ? 1 : 0); }
writeFileSync(join(ROOT, "README.md"), src);
console.log(`README regenerated (v${VERSION}, ${singles.length} servers, ${hosted.size} hosted); regions rewritten: ${changed.join(", ") || "none"}`);
