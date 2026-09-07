#!/usr/bin/env node
// Write fileSha256 into every registry manifest whose package is an .mcpb bundle.
//
// The registry validates the digest against the asset it downloads, so this must run
// AFTER the bundles are built and the release assets are the exact files hashed here.
// A manifest carrying a stale digest is worse than one carrying none: the registry
// rejects it, and the rejection names the digest rather than the cause.
//
// Usage: node scripts/manifest-sha256.mjs [--check]
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const CHECK = process.argv.includes("--check");
const digests = new Map();
let written = 0, missing = [], checked = 0, drift = [];

for (const d of readdirSync(join(ROOT, "servers"))) {
  for (const f of readdirSync(join(ROOT, "servers", d))) {
    if (!/^server(\.[a-z0-9-]+)?\.json$/.test(f) || f === "server.npm-package.json") continue;
    const path = join(ROOT, "servers", d, f);
    let m; try { m = JSON.parse(readFileSync(path, "utf8")); } catch { continue; }
    let changed = false;
    for (const p of m.packages || []) {
      if (p.registryType !== "mcpb" || typeof p.identifier !== "string") continue;
      const file = p.identifier.split("/").pop();               // "<name>.mcpb"
      const bundle = join(ROOT, "bundles", file);
      if (!existsSync(bundle)) { missing.push(`${m.name}: ${file}`); continue; }
      if (!digests.has(bundle)) digests.set(bundle, createHash("sha256").update(readFileSync(bundle)).digest("hex"));
      const sha = digests.get(bundle);
      checked++;
      if (p.fileSha256 === sha) continue;
      if (CHECK) { drift.push(`${m.name}: ${file} manifest ${String(p.fileSha256).slice(0, 12)} != bundle ${sha.slice(0, 12)}`); continue; }
      p.fileSha256 = sha; changed = true;
    }
    if (changed) { writeFileSync(path, JSON.stringify(m, null, 2) + "\n"); written++; }
  }
}
console.log(`${CHECK ? "checked" : "wrote"} ${CHECK ? checked : written} manifest package block(s) over ${digests.size} distinct bundles`);
if (missing.length) { console.log(`missing bundle for ${missing.length}:`); for (const x of missing.slice(0, 8)) console.log("  " + x); }
if (drift.length) { console.log(`digest drift on ${drift.length}:`); for (const x of drift.slice(0, 8)) console.log("  " + x); }
process.exit(missing.length || drift.length ? 1 : 0);
