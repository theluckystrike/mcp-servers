#!/usr/bin/env node
// Regenerate the PRIORITY_GUIDES list in billing/src/index.js from data/traffic.json.
// T15 fix 1 companion: top 10 guides by 7d total visits, same ordering rule as the
// hand-written list this replaces the first time it is run after a traffic re-measure.
import { readFileSync, writeFileSync } from "node:fs";

const t = JSON.parse(readFileSync("data/traffic.json", "utf8"));
const top = (t.sitemap_pages || [])
  .filter((p) => p.path && p.path.startsWith("/guides/"))
  .sort((a, b) => (b.total || 0) - (a.total || 0))
  .slice(0, 10)
  .map((p) => p.path.replace("/guides/", "").replace(/"/g, ""));

const src = readFileSync("billing/src/index.js", "utf8");
const re = /const PRIORITY_GUIDES = \[[^\]]*\];/;
if (!re.test(src)) {
  console.error("PRIORITY_GUIDES block not found in billing/src/index.js");
  process.exit(2);
}
const block = "const PRIORITY_GUIDES = [\n" + top.map((s) => `  "${s}",`).join("\n") + "\n];";
writeFileSync("billing/src/index.js", src.replace(re, block));
console.log("PRIORITY_GUIDES updated:", top.length, "guides");
console.log(top.map((s) => "  " + s).join("\n"));
