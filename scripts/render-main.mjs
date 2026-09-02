#!/usr/bin/env node
// Renders the main dashboard /Users/mike/mcp-servers/index.html from data/ledger.json, data/facts.json,
// data/distribution.json and every RESULT.md in the tree. Run after scripts/update-dashboard.mjs.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const rd = (p) => existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : "";
const js = (p, d) => { try { return JSON.parse(rd(p)); } catch { return d; } };
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const ledger = js("data/ledger.json", { servers: [], session: { count: 0, history: [] } });
const facts = js("data/facts.json", {});
const dist = js("data/distribution.json", { surfaces: {}, per_server: {} });

// ---- sprint results: every RESULT.md ----
function findResults(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (["node_modules", "dist", ".git", "keys", ".wrangler"].includes(n)) continue;
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) findResults(p, out);
    else if (/RESULT\.md$/.test(n) || n === "AUDIT.md" || n === "CODEX_REVIEW.md") out.push(p);
  }
  return out;
}
function parseResult(p) {
  const t = readFileSync(p, "utf8");
  const get = (k) => (t.match(new RegExp(`^${k}:\\s*(.+)$`, "mi")) || [])[1]?.trim() || "";
  const insight = (t.match(/^insight:\s*([\s\S]*?)(?=\n\S+:|\n## |$)/mi) || [])[1]?.replace(/\s+/g, " ").trim() || "";
  const failures = (t.match(/^failures?:\s*([\s\S]*?)(?=\ninsight:|\n## |$)/mi) || [])[1]?.trim() || "";
  const tests = [...t.matchAll(/# pass (\d+)[\s\S]{0,40}?# fail (\d+)/g)].map(m => `${m[1]}/${Number(m[1]) + Number(m[2])}`);
  const rel = relative(ROOT, p);
  const unit = rel.replace(/\/RESULT\.md$/, "").replace(/^docs\//, "").replace(/_RESULT\.md$|\.md$/, "");
  return { unit, path: rel, status: get("status") || (p.endsWith("AUDIT.md") ? "AUDIT" : p.endsWith("CODEX_REVIEW.md") ? "REVIEW" : ""), cost: get("cost"), tests: tests.join(", "), failures: failures.split("\n").filter(l => /^\s*[-\d]/.test(l)).length, insight: insight.slice(0, 420) };
}
const sprints = findResults(ROOT).map(parseResult).sort((a, b) => a.unit.localeCompare(b.unit));

// ---- derived KPIs ----
const servers = ledger.servers || [];
const toolsTotal = servers.reduce((a, s) => a + (s.tool_count || 0), 0);
const testPass = servers.reduce((a, s) => a + Number((s.test_summary || "").match(/pass (\d+)/)?.[1] || 0), 0);
const testFail = servers.reduce((a, s) => a + Number((s.test_summary || "").match(/fail (\d+)/)?.[1] || 0), 0);
const locTotal = servers.reduce((a, s) => a + (s.loc || 0), 0);
const surfaces = Object.entries(dist.surfaces || {});
const live = surfaces.filter(([, v]) => v.status === "published").length;
const revenue = ledger.revenue?.stripe_live_sales ?? 0;
const pill = (s) => { const c = /published|DONE|ok|live/i.test(s) ? "ok" : /blocked|fail|missing/i.test(s) ? "bad" : "pend"; return `<span class="pill ${c}">${esc(s)}</span>`; };

// ---- next actions (derived) ----
const next = [];
if ((dist.surfaces?.npm?.status) !== "published") next.push("Run `npm login --auth-type=web` (about one minute, human step), then `scripts/publish-all.sh --go`.");
if ((dist.surfaces?.registry?.status) !== "published") next.push("After npm publish: `mcp-publisher login github` and publish each server.json to the official registry.");
if ((dist.surfaces?.smithery?.status) !== "published") next.push("Connect the GitHub repo on Smithery and claim the four servers on Glama.");
if (!existsSync(join(ROOT, "data/sales.json"))) next.push("Make one real $19 purchase to prove /success end to end; record it in data/sales.json.");
if (!existsSync(join(ROOT, "docs/AUDIT.md"))) next.push("Adversarial audit pending (docs/AUDIT.md).");
next.push("Submit the .mcpb bundles to the Claude Desktop extensions directory and open the awesome-mcp-servers PR.");

const serverRows = servers.map(s => {
  const d = dist.per_server?.[s.id] || {};
  return `<tr><td class="mono"><b>${esc(s.id)}</b><br><span class="dim">${esc(s.npm_name)} ${esc(s.version)}</span></td>
<td class="num">${s.tool_count}</td><td class="num">${s.loc ?? ""}</td>
<td>${pill(s.build_ok ? "build ok" : "build missing")} ${pill(s.test_summary || "pending")}</td>
<td>${["npm", "registry", "github", "smithery", "glama"].map(k => `${k} ${pill(d[k] || "unknown")}`).join("<br>")}</td>
<td class="tools dim">${esc((s.tools || []).join(", "))}</td>
<td><a href="https://mcp.zovo.one/buy/${esc(s.id)}">buy</a> &middot; <a href="servers/${esc(s.id)}/README.md">readme</a> &middot; <a href="servers/${esc(s.id)}/RESULT.md">sprint</a></td></tr>`;
}).join("\n");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MCP Servers Command Dashboard</title>
<style>
:root{color-scheme:light dark;--bg:#fcfcfb;--panel:#fff;--line:#e5e4df;--tx:#0b0b0b;--tx2:#52514e;--tx3:#82817b;--acc:#2a78d6;--good:#1baf7a;--warn:#c98500;--bad:#e34948}
@media(prefers-color-scheme:dark){:root{--bg:#151514;--panel:#1a1a19;--line:#333330;--tx:#fff;--tx2:#c3c2b7;--tx3:#8d8c83;--acc:#3987e5;--good:#199e70}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Helvetica,Arial,sans-serif;font-variant-numeric:tabular-nums}
.wrap{max-width:1240px;margin:0 auto;padding:36px 24px 80px}
h1{font-size:28px;margin:0 0 4px;letter-spacing:-.02em}.sub{color:var(--tx3);font-size:12.5px;margin-bottom:22px}
h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--tx3);margin:34px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.kpi{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.kpi .n{font-size:24px;font-weight:650;letter-spacing:-.02em;line-height:1.1}.kpi .k{font-size:11.5px;color:var(--tx3);margin-top:4px}
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--panel)}table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--tx3);padding:9px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}tr:last-child td{border-bottom:0}
.mono{font-family:ui-monospace,Menlo,monospace;font-size:12px}.num{text-align:right;font-family:ui-monospace,Menlo,monospace}.dim{color:var(--tx3);font-size:11.5px}
.tools{max-width:340px;font-size:11.5px}
.pill{display:inline-block;font-size:10px;font-weight:650;letter-spacing:.03em;padding:1px 6px;border-radius:4px;border:1px solid var(--line);color:var(--tx3);margin:1px 2px 1px 0;white-space:nowrap}
.pill.ok{color:var(--good);border-color:var(--good)}.pill.bad{color:var(--bad);border-color:var(--bad)}.pill.pend{color:var(--warn);border-color:var(--warn)}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:860px){.grid2{grid-template-columns:1fr}}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
ol,ul{margin:0;padding-left:20px;color:var(--tx2)}li{margin-bottom:6px}
code{font-family:ui-monospace,Menlo,monospace;font-size:12px;background:var(--line);padding:1px 4px;border-radius:3px}
.foot{margin-top:40px;padding-top:14px;border-top:1px solid var(--line);color:var(--tx3);font-size:12px}
.links a{margin-right:14px}
</style></head><body><div class="wrap">
<h1>MCP Servers Command Dashboard</h1>
<div class="sub">theluckystrike &middot; generated ${esc(ledger.generated_at)} &middot; session ${ledger.session?.count ?? 0} &middot; folder /Users/mike/mcp-servers</div>
<div class="links"><a href="docs/how-it-works.html">How it works</a><a href="dashboard/index.html">Ledger view</a><a href="docs/DISTRIBUTION.md">Distribution runbook</a><a href="docs/AUDIT.md">Audit</a><a href="docs/CODEX_REVIEW.md">Codex review</a><a href="https://mcp.zovo.one">Storefront</a><a href="https://github.com/theluckystrike/mcp-servers">GitHub</a></div>

<h2>Key numbers</h2>
<div class="kpis">
<div class="kpi"><div class="n">${servers.length}</div><div class="k">servers built</div></div>
<div class="kpi"><div class="n">${toolsTotal}</div><div class="k">MCP tools</div></div>
<div class="kpi"><div class="n">${testPass}${testFail ? ` <span style="color:var(--bad)">/ ${testFail} fail</span>` : ""}</div><div class="k">server tests passing</div></div>
<div class="kpi"><div class="n">${locTotal.toLocaleString()}</div><div class="k">lines of TypeScript</div></div>
<div class="kpi"><div class="n">${live}/${surfaces.length}</div><div class="k">distribution surfaces live</div></div>
<div class="kpi"><div class="n">$${facts.pricing?.single_usd ?? 19} / $${facts.pricing?.bundle_usd ?? 39}</div><div class="k">Pro price, single / bundle</div></div>
<div class="kpi"><div class="n">$${revenue}</div><div class="k">Stripe live sales (${esc(ledger.revenue?.note || "")})</div></div>
<div class="kpi"><div class="n">${sprints.length}</div><div class="k">sprint units reported</div></div>
</div>

<h2>Servers</h2>
<div class="tw"><table><tr><th>Server</th><th>Tools</th><th>LOC</th><th>Build / tests</th><th>Distribution</th><th>Tool names</th><th>Links</th></tr>${serverRows}</table></div>

<h2>Sprint results (one row per agent unit, parsed from RESULT.md)</h2>
<div class="tw"><table><tr><th>Unit</th><th>Status</th><th>Tests</th><th>Cost</th><th>Failures logged</th><th>Insight</th></tr>
${sprints.map(s => `<tr><td class="mono"><a href="${esc(s.path)}">${esc(s.unit)}</a></td><td>${pill(s.status || "n/a")}</td><td class="mono">${esc(s.tests)}</td><td class="dim">${esc(s.cost)}</td><td class="num">${s.failures}</td><td class="dim">${esc(s.insight)}</td></tr>`).join("\n")}
</table></div>

<div class="grid2">
<div>
<h2>Billing (Stripe ${esc(facts.billing?.stripe_mode || "")})</h2>
<div class="card">
<div>Storefront <a href="${esc(facts.billing?.storefront)}">${esc(facts.billing?.storefront)}</a> &middot; <a href="${esc(facts.billing?.health)}">health</a></div>
<div class="dim">webhook ${esc(facts.billing?.webhook)} &middot; KV ${esc(facts.billing?.kv)}</div>
<div class="tw" style="margin-top:10px"><table><tr><th>Product</th><th>Stripe product</th><th>Price id</th><th>USD</th></tr>
${(facts.billing?.products || []).map(p => `<tr><td class="mono">${esc(p[0])}</td><td class="mono dim">${esc(p[1])}</td><td class="mono dim">${esc(p[2])}</td><td class="num">${p[3]}</td></tr>`).join("")}</table></div>
</div>
</div>
<div>
<h2>Distribution surfaces</h2>
<div class="tw"><table><tr><th>Surface</th><th>Status</th><th>Note</th></tr>
${surfaces.map(([k, v]) => `<tr><td><a href="${esc(v.url)}">${esc(k)}</a></td><td>${pill(v.status)}</td><td class="dim">${esc(v.note)}</td></tr>`).join("")}</table></div>
</div>
</div>

<div class="grid2">
<div>
<h2>Why these servers (research numbers)</h2>
<div class="tw"><table><tr><th>Measure</th><th>Value</th><th>Context</th></tr>
${(facts.research?.numbers || []).map(r => `<tr><td>${esc(r[0])}</td><td class="num">${esc(r[1])}</td><td class="dim">${esc(r[2])}</td></tr>`).join("")}</table></div>
<p class="dim" style="margin-top:8px">${esc(facts.research?.decision || "")} Source: <a href="${esc(facts.research?.source || "")}">platform-analysis-2026</a></p>
</div>
<div>
<h2>Validation gates</h2>
<div class="tw"><table><tr><th>Gate</th><th>Command / file</th><th>When</th></tr>
${(facts.gates || []).map(g => `<tr><td>${esc(g[0])}</td><td class="mono dim">${esc(g[1])}</td><td class="dim">${esc(g[2])}</td></tr>`).join("")}</table></div>
</div>
</div>

<div class="grid2">
<div><h2>Next actions</h2><div class="card"><ol>${next.map(n => `<li>${esc(n).replace(/`([^`]+)`/g, "<code>$1</code>")}</li>`).join("")}</ol></div></div>
<div><h2>Session log</h2><div class="card"><ul>${(ledger.session?.history || []).slice(-12).reverse().map(h => `<li><span class="mono dim">${esc(h.at)}</span> ${esc(h.note)}</li>`).join("")}</ul></div></div>
</div>

<div class="foot">Regenerate: <code>node scripts/update-dashboard.mjs --note "..." &amp;&amp; node scripts/render-main.mjs</code>. Data: data/ledger.json, data/facts.json, data/distribution.json. Built by theluckystrike. https://github.com/theluckystrike</div>
</div></body></html>`;

writeFileSync(join(ROOT, "index.html"), html);
console.log(`main dashboard written: ${join(ROOT, "index.html")} (${html.length} bytes, ${servers.length} servers, ${sprints.length} sprint units)`);
