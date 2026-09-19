#!/usr/bin/env node
// Regenerate the FEATURED_SERVERS list in billing/src/index.js from data/traffic.json:
// top 8 /s/ routes by human-verified 7d views. T15 fix 4 companion.
import { readFileSync, writeFileSync } from "node:fs";

const t = JSON.parse(readFileSync("data/traffic.json", "utf8"));
const top = (t.sitemap_pages || [])
  .filter((p) => p.path && p.path.startsWith("/s/"))
  .sort((a, b) => (b.human_verified || 0) - (a.human_verified || 0))
  .slice(0, 8)
  .map((p) => p.path.replace("/s/", ""));

const src = readFileSync("billing/src/index.js", "utf8");
const re = /const FEATURED_SERVERS = \[[^\]]*\];/;
if (!re.test(src)) {
  console.error("FEATURED_SERVERS block not found in billing/src/index.js");
  process.exit(2);
}
const block = "const FEATURED_SERVERS = [\n" + top.map((s) => `  "${s}",`).join("\n") + "\n];";
writeFileSync("billing/src/index.js", src.replace(re, block));
console.log("FEATURED_SERVERS updated:", top.length, "servers");
console.log(top.map((s) => "  " + s).join("\n"));
