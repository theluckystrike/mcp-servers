#!/usr/bin/env node
// Are we in VS Code's MCP gallery yet?
//
// VS Code 1.129's product.json points mcpGallery.serviceUrl at https://api.mcp.github.com,
// and that service syncs from the official MCP registry. It is therefore the highest-reach
// registry-backed surface this project can reach, and it needs no submission: there is no
// form and no pull request, only a sync we are currently below the cut of. Measured
// 2026-09-08: the gallery held ~250 servers against thousands in the registry, none ours.
//
// This is a watch, not a campaign. Run it each loop; the day we appear, that is a
// distribution event worth acting on.
//
// Usage: node scripts/vscode-gallery-watch.mjs [--json]
import { writeFileSync } from "node:fs";
const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const BASE = "https://api.mcp.github.com/v0/servers";
const NEEDLES = ["theluckystrike", "bestremotetools", "zovo"];

let rows = [], cursor = null, pages = 0;
while (pages < 40) {
  const u = `${BASE}?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
  const res = await fetch(u, { headers: { "user-agent": "mcp-servers-gallery-watch" } });
  if (!res.ok) { console.error(`FATAL: ${u} returned ${res.status}; refusing to report a count from a failed pull`); process.exit(2); }
  const d = await res.json();
  const got = d.servers || [];
  rows = rows.concat(got.map((r) => r.server?.name).filter(Boolean));
  cursor = d.metadata?.next_cursor || null;
  pages++;
  if (!cursor || !got.length) break;
}
if (!rows.length) { console.error("FATAL: gallery returned no rows; not writing a result"); process.exit(2); }

// Positive control: a server known to be in the gallery. If it is missing the pull is broken.
const CONTROL = "microsoft/markitdown";
if (!rows.includes(CONTROL)) { console.error(`FATAL: control ${CONTROL} absent, so this probe is broken`); process.exit(3); }

const hits = rows.filter((n) => NEEDLES.some((x) => n.toLowerCase().includes(x)));
const out = { at: new Date().toISOString(), gallery: BASE, pages, total_rows: rows.length, control: CONTROL, ours: hits,
  note: "Registry-backed and syncs from the official MCP registry. No submission path exists; appearing is a ranked cut. If ours is non-empty, VS Code users can now find these servers in the built-in picker." };
writeFileSync(`${ROOT}/data/vscode_gallery.json`, JSON.stringify(out, null, 2));
if (process.argv.includes("--json")) console.log(JSON.stringify(out, null, 2));
else console.log(`vscode gallery: ${rows.length} servers over ${pages} pages, ours = ${hits.length}${hits.length ? ": " + hits.join(", ") : ""}`);
