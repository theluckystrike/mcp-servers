#!/usr/bin/env node
// Are we in VS Code's MCP gallery yet?
//
// VS Code 1.129's product.json points mcpGallery.serviceUrl at https://api.mcp.github.com,
// and that service syncs from the official MCP registry. It is therefore the highest-reach
// registry-backed surface this project can reach, and it needs no submission: there is no
// form and no pull request, only a sync we are currently below the cut of.
//
// 2026-09-10, instrument repaired (docs/VSCODE_GALLERY_R2.md):
//   * /v0/servers is DEPRECATED (the response carries `deprecation: true`) and its cursor is
//     the raw hex id of the last row, which the service then rejects with 400 Invalid cursor.
//     That is what made this watch partial. /v0.1/servers issues a real opaque cursor
//     (`mcp.cursor.<base64>`) and pages cleanly, so the full catalogue is readable again.
//   * /v0/servers also FLATTENS repository into a legacy shape with no `subfolder` field.
//     The 2026-09-09 finding "0 of 252 gallery entries use a monorepo subfolder" was an
//     artefact of that, not a property of the gallery. /v0.1 shows 14 of 252 with one.
//   * /v0.1/servers/<name>/versions/latest is a direct membership test: 200 = in the
//     gallery, 404 = not. It needs no pagination, so absence is now proven, not assumed.
//
// Usage: node scripts/vscode-gallery-watch.mjs [--json]
import { writeFileSync } from "node:fs";
const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const BASE = "https://api.mcp.github.com/v0.1/servers";
const NEEDLES = ["theluckystrike", "bestremotetools", "zovo"];
const UA = { "user-agent": "mcp-servers-gallery-watch" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Direct membership probes. CONTROL must be present or the probe is broken; the two
// EXPERIMENT names hold the namespace fixed and vary only repository.subfolder.
const CONTROL = "microsoft/markitdown";
const PROBES = [
  CONTROL,
  "com.bestremotetools/office-suite-all-servers-one-install", // no subfolder (the experiment)
  "com.bestremotetools/archive-zip-unzip-bomb-guard",         // subfolder servers/zip (the control arm)
];

async function probe(name) {
  const u = `${BASE}/${encodeURIComponent(name)}/versions/latest`;
  const res = await fetch(u, { headers: UA });
  return { name, status: res.status, in_gallery: res.status === 200 };
}

let rows = [], cursor = null, pages = 0, partial = "";
while (pages < 40) {
  const u = `${BASE}?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
  const res = await fetch(u, { headers: UA });
  if (!res.ok) {
    if (pages === 0) { console.error(`FATAL: ${u} returned ${res.status} on the first page; refusing to report a count from a failed pull`); process.exit(2); }
    partial = `pagination stopped at page ${pages + 1}: HTTP ${res.status}`;
    break;
  }
  const d = await res.json();
  const got = d.servers || [];
  rows = rows.concat(got);
  cursor = d.metadata?.nextCursor || d.metadata?.next_cursor || null;
  pages++;
  if (!cursor || !got.length) break;
  await sleep(3000); // the service rate-limits at 10 requests per window
}
if (!rows.length) { console.error("FATAL: gallery returned no rows; not writing a result"); process.exit(2); }

const names = rows.map((r) => r.server?.name).filter(Boolean);
if (!names.includes(CONTROL)) { console.error(`FATAL: control ${CONTROL} absent, so this probe is broken`); process.exit(3); }

const membership = [];
for (const n of PROBES) { membership.push(await probe(n)); await sleep(3000); }
if (!membership.find((m) => m.name === CONTROL)?.in_gallery) {
  console.error(`FATAL: membership probe says the control ${CONTROL} is absent; the probe is broken`); process.exit(3);
}

const hits = names.filter((n) => NEEDLES.some((x) => n.toLowerCase().includes(x)));
const withSubfolder = rows.filter((r) => r.server?.repository?.subfolder);
const out = {
  at: new Date().toISOString(), gallery: BASE, pages, total_rows: names.length, control: CONTROL, ours: hits,
  partial: partial || false,
  coverage: partial ? "PARTIAL: only the rows above were seen" : "complete",
  membership_probes: membership,
  entries_with_repository_subfolder: withSubfolder.length,
  subfolder_examples: withSubfolder.slice(0, 5).map((r) => `${r.server.name} -> ${r.server.repository.subfolder}`),
  subfolder_hypothesis: withSubfolder.length === 0
    ? "no gallery entry uses a monorepo subfolder"
    : `REFUTED: ${withSubfolder.length} gallery entries do use a monorepo subfolder, so a subfolder is not what excludes us`,
  note: "Registry-backed but hand-curated: 252 rows against a registry of 20,000+. The only known request path is an onboarding-request comment on github/github-mcp-server discussion #1257, whose measured yield is 2 of 11 (docs/VSCODE_GALLERY_R2.md). If ours is non-empty, VS Code users can find these servers in the built-in picker.",
};
writeFileSync(`${ROOT}/data/vscode_gallery.json`, JSON.stringify(out, null, 2));
if (process.argv.includes("--json")) console.log(JSON.stringify(out, null, 2));
else console.log(`vscode gallery: ${names.length} servers over ${pages} pages${partial ? " (PARTIAL)" : ""}, ours = ${hits.length}${hits.length ? ": " + hits.join(", ") : ""}; entries using a monorepo subfolder = ${withSubfolder.length}; probes = ${membership.map((m) => `${m.name}:${m.status}`).join(" ")}`);
