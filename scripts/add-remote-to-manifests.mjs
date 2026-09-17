#!/usr/bin/env node
// Add the hosted streamable-http remote to every registry manifest of a HOSTED server.
//
// Why this exists: the registry binds one URL to one server name, so the hosted URL was
// only ever carried by the *primary* manifest shape. But `registry-publish-all.mjs`
// publishes EVERY registry manifest, so the stdio-only sibling names (server.json,
// server.<token>.json) published as NO-REMOTE rows. Directory consumers reading the
// registry (mcpservers.org etc) then saw the hosted endpoint as invisible.
//
// The hosted URL source of truth is servers/<s>/remotes.json -- it is already asserted
// equal-by-value to server.mcpb.json by scripts/release-check.mjs ("remotes" check).
// This script copies that block verbatim into the sibling manifests, leaving each
// manifest's local stdio `packages` transport completely intact.
//
// Unhosted servers (no remotes.json, e.g. office-suite) are SKIPPED, never guessed.
//
// Usage: node scripts/add-remote-to-manifests.mjs [--dry] [--only <substring>]
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const DRY = process.argv.includes("--dry");
const onlyIx = process.argv.indexOf("--only");
const ONLY = onlyIx > -1 ? process.argv[onlyIx + 1] : null;
const SERVERS_DIR = join(ROOT, "servers");

const changed = [], skipped = [], already = [];

for (const s of readdirSync(SERVERS_DIR).sort()) {
  const dir = join(SERVERS_DIR, s);
  const remotesPath = join(dir, "remotes.json");
  const remotes = existsSync(remotesPath) ? JSON.parse(readFileSync(remotesPath, "utf8")) : null;

  for (const f of readdirSync(dir).sort()) {
    if (!/^server(\.[a-z0-9-]+)?\.json$/.test(f)) continue;
    if (f === "server.npm-package.json") continue;
    const path = join(dir, f);
    let m;
    try { m = JSON.parse(readFileSync(path, "utf8")); } catch { continue; }
    if (!m.name || !m.version) continue;
    if (ONLY && !m.name.includes(ONLY)) continue;

    if (!remotes) { skipped.push(`${m.name} (${s} not hosted)`); continue; }
    if (JSON.stringify(m.remotes) === JSON.stringify(remotes)) { already.push(m.name); continue; }

    if (!DRY) {
      // Insert remotes without disturbing key order of the rest of the document.
      m.remotes = remotes;
      writeFileSync(path, JSON.stringify(m, null, 2) + "\n");
    }
    changed.push(`${m.name} -> ${remotes[0].url}`);
  }
}

console.log(`${DRY ? "[dry] " : ""}changed ${changed.length}, already-with-remote ${already.length}, skipped-unhosted ${skipped.length}`);
for (const c of changed) console.log(`  fix  ${c}`);
for (const s of skipped) console.log(`  skip ${s}`);
process.exit(0);
