#!/usr/bin/env node
// Organic traffic + distribution metrics, appended to data/metrics.json. Free endpoints only.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const gh = (p) => { try { return JSON.parse(execFileSync("gh", ["api", p]).toString()); } catch (e) { return { error: e.message.split("\n")[0] }; } };
const j = async (u) => { try { const r = await fetch(u, { headers: { "user-agent": "mcp-servers-metrics" } }); return r.ok ? await r.json() : { error: r.status }; } catch (e) { return { error: e.message }; } };
const views = gh("repos/theluckystrike/mcp-servers/traffic/views");
const clones = gh("repos/theluckystrike/mcp-servers/traffic/clones");
const repo = gh("repos/theluckystrike/mcp-servers");
const rel = gh("repos/theluckystrike/mcp-servers/releases");
const releaseDownloads = Array.isArray(rel) ? rel.flatMap((r) => r.assets.map((a) => ({ tag: r.tag_name, name: a.name, downloads: a.download_count }))) : [];
const reg = await j("https://registry.modelcontextprotocol.io/v0/servers?search=theluckystrike&limit=50");
const npmDl = {};
for (const n of ["time-tracker", "price-tracker", "spreadsheet", "invoice"]) npmDl[n] = await j(`https://api.npmjs.org/downloads/point/last-week/@theluckystrike/mcp-${n}`);
const health = await j("https://mcp.zovo.one/health");
const snap = {
  at: new Date().toISOString(),
  github: { stars: repo.stargazers_count, forks: repo.forks_count, watchers: repo.subscribers_count, views_14d: views.count, uniques_14d: views.uniques, clones_14d: clones.count, clone_uniques_14d: clones.uniques },
  release_downloads: releaseDownloads, release_downloads_total: releaseDownloads.reduce((a, r) => a + (r.downloads || 0), 0),
  registry_entries: Array.isArray(reg.servers) ? reg.servers.map((s) => `${s.server.name}@${s.server.version}`) : reg,
  npm_weekly_downloads: Object.fromEntries(Object.entries(npmDl).map(([k, v]) => [k, typeof v.downloads === "number" ? v.downloads : "not published"])),
  billing_health: health.ok === true,
};
const p = `${ROOT}/data/metrics.json`;
const db = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : { snapshots: [] };
db.snapshots.push(snap); db.snapshots = db.snapshots.slice(-200);
writeFileSync(p, JSON.stringify(db, null, 2));
console.log(JSON.stringify(snap));
