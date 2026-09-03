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
const toolsDb = js("data/tools.json", {});
const valDb = js("data/validation.json", { runs: [] });
const lastRun = valDb.runs.at(-1);
const promo = js("data/promotion.json", { actions: [] });
const organic = js("data/organic.json", { surfaces: [], servers: [], measured: [] });
const uv = js("data/user_value.json", null);
const uv2 = js("data/user_value_r2.json", null);
const uv3 = js("data/user_value_r3.json", null);
const uv4 = js("data/user_value_r4.json", null);
const uv5 = js("data/user_value_r5.json", null);
const uv6 = js("data/user_value_r6.json", null);
const uv7 = js("data/user_value_r7.json", null);
const uv8 = js("data/user_value_r8.json", null);
const uvi = js("data/user_value_index.json", null);
const kpi = js("data/kpi.json", null);
const slog = js("data/sprint_log.json", null);
const metrics = js("data/metrics.json", { snapshots: [] });
const m = metrics.snapshots.at(-1);
const orgHeadline = organic.surfaces.length ? Math.round(organic.surfaces.reduce((a, s) => a + s.score * s.reach, 0) / organic.surfaces.reduce((a, s) => a + s.reach, 0)) : 0;

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
const pill = (s) => { const f = String(s).match(/^(\d+)\/(\d+)$/); const c = (f && f[1] === f[2]) ? "ok" : f ? "bad" : /published|DONE|ok|live|fixed|^met$/i.test(s) ? "ok" : /blocked|fail|missing/i.test(s) ? "bad" : "pend"; return `<span class="pill ${c}">${esc(s)}</span>`; };

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
.tabs{display:flex;gap:4px;margin:22px 0 6px;border-bottom:1px solid var(--line)}.tabs button{background:none;border:0;border-bottom:2px solid transparent;padding:10px 14px;font:inherit;font-weight:600;color:var(--tx3);cursor:pointer}.tabs button.on{color:var(--tx);border-bottom-color:var(--acc)}
.tab{display:none}.tab.on{display:block}
.srv{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin:14px 0}.srv h3{margin:0 0 2px;font-size:18px}.srv .tag{color:var(--tx3);margin-bottom:10px}.srv p{margin:6px 0;color:var(--tx2)}
.kv{display:grid;grid-template-columns:130px 1fr;gap:4px 12px;font-size:13px;margin:10px 0}.kv b{color:var(--tx3);font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em}
.chk{font-family:ui-monospace,Menlo,monospace;font-size:11.5px}.chk .p{color:var(--good)}.chk .f{color:var(--bad)}
details summary{cursor:pointer;color:var(--acc);font-size:12.5px}
</style></head><body><div class="wrap">
<h1>MCP Servers Command Dashboard</h1>
<div class="sub">theluckystrike &middot; generated ${esc(ledger.generated_at)} &middot; session ${ledger.session?.count ?? 0} &middot; folder /Users/mike/mcp-servers</div>
<div class="links"><a href="docs/how-it-works.html">How it works</a><a href="dashboard/index.html">Ledger view</a><a href="docs/DISTRIBUTION.md">Distribution runbook</a><a href="docs/AUDIT.md">Audit</a><a href="docs/CODEX_REVIEW.md">Codex review</a><a href="https://mcp.zovo.one">Storefront</a><a href="https://github.com/theluckystrike/mcp-servers">GitHub</a></div>

<div class="tabs"><button class="on" data-tab="overview">Overview</button><button data-tab="servers">What each server does</button><button data-tab="validation">Validation database${lastRun ? ` (${lastRun.pass}/${lastRun.total})` : ""}</button><button data-tab="promotion">Promotion playbook</button><button data-tab="uservalue">User value${uv7 ? ` (R7 ${uv7.totals?.score}/${uv7.totals?.max})` : uv5 ? ` (R5 ${uv5.totals?.score ?? uv5.totals?.r5}/${uv5.totals?.max})` : uv4 ? ` (R4 ${uv4.totals?.r4 ?? uv4.totals?.score}/${uv4.totals?.max})` : uv2 ? ` (${uv2.totals.score}/${uv2.totals.max})` : ""}</button><button data-tab="organic">Organic distribution (${orgHeadline}/100)</button><button data-tab="sprints">Sprint log${slog ? ` (${slog.sessions})` : ""}</button><button data-tab="kpi">KPIs${kpi ? ` (${kpi.kpis.filter(k => k.status === "met").length}/${kpi.kpis.length} met)` : ""}</button></div>
<div class="tab on" id="tab-overview">
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
${m ? `<div class="kpi"><div class="n">${m.release_downloads_total}</div><div class="k">bundle downloads (GitHub releases)</div></div><div class="kpi"><div class="n">${m.github.views_14d ?? 0} / ${m.github.uniques_14d ?? 0}</div><div class="k">repo views / uniques, 14d</div></div><div class="kpi"><div class="n">${m.github.stars ?? 0}</div><div class="k">stars</div></div>` : ""}
</div>
${metrics.snapshots.length > 1 ? `<p class="dim">Organic metrics history (${metrics.snapshots.length} snapshots, scripts/measure.mjs): ${metrics.snapshots.slice(-8).map(x => `${x.at.slice(5, 16).replace("T", " ")} dl ${x.release_downloads_total} views ${x.github.views_14d ?? 0} stars ${x.github.stars ?? 0}`).join(" | ")}</p>` : ""}

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

</div>

<div class="tab" id="tab-servers">
${Object.entries(facts.servers || {}).map(([id, v]) => {
  const tools = toolsDb[id] || []; const d = dist.per_server?.[id] || {};
  return `<div class="srv"><h3>${esc(v.title)} <span class="mono dim">@theluckystrike/mcp-${esc(id)}</span></h3><div class="tag">${esc(v.tagline)}</div>
<p><b>What it does.</b> ${esc(v.does)}</p><p><b>Who it is for.</b> ${esc(v.for)}</p><p><b>Example.</b> <span class="dim">${esc(v.example)}</span></p>
<div class="kv"><b>Free</b><span>${esc(v.free)}</span><b>Pro $${facts.pricing?.single_usd ?? 19}</b><span>${esc(v.pro)} <a href="https://mcp.zovo.one/buy/${esc(id)}">Buy</a></span><b>Data stays</b><span>${esc(v.storage)}</span>
<b>Install</b><span class="mono">claude mcp add ${esc(id)} -- npx -y @theluckystrike/mcp-${esc(id)}</span>
<b>Status</b><span>npm ${pill(d.npm || "unknown")} registry ${pill(d.registry || "unknown")} github ${pill(d.github || "unknown")} validation ${pill(lastRun ? (() => { const r = lastRun.results.find(x => x.id === id); return r ? `${r.pass}/${r.total}` : "pending"; })() : "pending")}</span></div>
<div class="tw"><table><tr><th>Tool</th><th>What it does</th></tr>${tools.map(t => `<tr><td class="mono">${esc(t.name)}</td><td class="dim">${esc(t.description)}</td></tr>`).join("")}</table></div>
<p class="dim"><a href="servers/${esc(id)}/README.md">README</a> &middot; <a href="servers/${esc(id)}/RESULT.md">build sprint</a> &middot; <a href="servers/${esc(id)}/src/index.ts">source</a></p></div>`; }).join("")}
</div>

<div class="tab" id="tab-validation">
<p class="dim">Every run spawns each server over stdio in a fresh sandbox, exercises real tools in free and Pro mode, then probes the live billing worker. Run: <code>node scripts/validate.mjs</code>. Database: data/validation.json (${valDb.runs.length} runs kept).</p>
${lastRun ? `<div class="kpis"><div class="kpi"><div class="n">${lastRun.pass}/${lastRun.total}</div><div class="k">checks passing, latest run</div></div><div class="kpi"><div class="n">${lastRun.results.length}</div><div class="k">units validated</div></div><div class="kpi"><div class="n">${esc(lastRun.sdk)}</div><div class="k">@modelcontextprotocol/sdk</div></div><div class="kpi"><div class="n">${esc(lastRun.node)}</div><div class="k">node</div></div><div class="kpi"><div class="n">${esc(lastRun.at.slice(0, 16).replace("T", " "))}</div><div class="k">run at (UTC)</div></div></div>
<h2>Latest run, every check</h2>
${lastRun.results.map(r => `<div class="card" style="margin-bottom:10px"><b>${esc(r.id)}</b> ${pill(`${r.pass}/${r.total}`)} <span class="dim">${r.ms} ms</span>
<div class="chk" style="margin-top:8px">${r.checks.map(c => `<div><span class="${c.pass ? "p" : "f"}">${c.pass ? "PASS" : "FAIL"}</span> ${esc(c.name)} <span class="dim">${esc(c.detail)}</span></div>`).join("")}</div></div>`).join("")}
<h2>Unit test suites (from each server's own npm test)</h2>
<div class="tw"><table><tr><th>Server</th><th>Summary</th></tr>${(lastRun.unit_tests || []).map(u => `<tr><td class="mono">${esc(u.id)}</td><td class="mono">${esc(u.summary)}</td></tr>`).join("")}</table></div>
<h2>Run history</h2>
<div class="tw"><table><tr><th>At</th><th>Pass</th><th>Total</th><th>Per unit</th></tr>${valDb.runs.slice().reverse().map(r => `<tr><td class="mono">${esc(r.at)}</td><td class="num">${r.pass}</td><td class="num">${r.total}</td><td class="dim">${r.results.map(x => `${x.id.split(" ")[0]} ${x.pass}/${x.total}`).join(" &middot; ")}</td></tr>`).join("")}</table></div>` : `<p>No validation run yet. Execute <code>node scripts/validate.mjs</code>.</p>`}
</div>
<div class="tab" id="tab-promotion">
<p class="dim">${esc(promo.method || "")}</p>
<div class="kpis"><div class="kpi"><div class="n">${promo.actions.filter(a => a.status === "done").length}</div><div class="k">done</div></div><div class="kpi"><div class="n">${promo.actions.filter(a => /ready|in progress/.test(a.status)).length}</div><div class="k">ready or in progress, terminal-only</div></div><div class="kpi"><div class="n">${promo.actions.filter(a => a.terminal === "yes").length}/${promo.actions.length}</div><div class="k">fully terminal</div></div><div class="kpi"><div class="n">${promo.actions.filter(a => a.human !== "none").length}</div><div class="k">need one human step</div></div></div>
<h2>Actions ranked by expected impact</h2>
<div class="tw"><table><tr><th>#</th><th>Action</th><th>Channel</th><th>Reach signal</th><th>Terminal</th><th>Human step</th><th>Status</th><th>How (agent runs this)</th><th>Impact</th></tr>
${promo.actions.slice().sort((a, b) => b.impact - a.impact).map(a => `<tr><td class="num">${a.rank}</td><td><b>${esc(a.action)}</b></td><td class="dim">${esc(a.channel)}</td><td class="dim">${esc(a.reach)}</td><td>${pill(a.terminal)}</td><td class="dim">${esc(a.human)}</td><td>${pill(a.status)}</td><td class="mono dim">${esc(a.how)}</td><td class="num"><b>${a.impact}</b></td></tr>`).join("")}</table></div>
<h2>Reading the table</h2>
<div class="card"><ul>
<li><b>Measured beats estimated.</b> Rows whose reach cell says MEASURED come from this estate's own numbers (X replies earned zero in 86% of 397 cases; LinkedIn buyer share 29-47%; estate clicks ~1,632/28d). Rows marked estimate are ranked below any measured row of similar size.</li>
<li><b>Registries compound, posts decay.</b> A registry or marketplace entry keeps producing installs for months; a social post is a one-day spike. Every row above impact 60 is a registry, a marketplace, or a search surface.</li>
<li><b>The pipeline stops at the human steps.</b> Four rows need one click each (npm login, Smithery, Glama, extensions directory). Each is under a minute and unlocks a terminal-only surface behind it.</li>
<li><b>Budget rule.</b> After two weeks, keep only channels with at least one measured click to mcp.zovo.one or one install; drop the rest.</li>
</ul></div>
</div>
<div class="tab" id="tab-uservalue">
${uvi ? `<h2>All rounds at a glance (generated by scripts/uv-index.mjs from data/user_value*.json)</h2>
<div class="kpis"><div class="kpi"><div class="n">${uvi.rounds.length}</div><div class="k">rounds through a real MCP client</div></div><div class="kpi"><div class="n">${uvi.rounds.at(-1)?.pct ?? ""}%</div><div class="k">latest round (R${uvi.rounds.at(-1)?.round})</div></div><div class="kpi"><div class="n">${uvi.counts.fixed}/${uvi.counts.defects}</div><div class="k">seam and server defects fixed of found</div></div><div class="kpi"><div class="n">${uvi.matrix.filter(m => m.best_pct === 100).length}/${uvi.matrix.length}</div><div class="k">servers that reached 100% in some round</div></div></div>
<div class="tw" style="margin-top:12px"><table><tr><th>Round</th><th>Score</th><th>Percent</th><th>Scenarios</th><th>What it measured</th></tr>${uvi.rounds.map(r => `<tr><td class="mono">R${r.round}</td><td class="num">${r.score ?? "?"}/${r.max ?? "?"}</td><td class="num"><b>${r.pct ?? ""}</b></td><td class="num">${r.scenarios}</td><td class="dim">${esc(({1:"four stdio servers, first contact",2:"same scenarios after the value fixes",3:"bundle, hosted endpoints, cross-server flow",4:"re-check of the failed set after round-3 fixes",5:"ten fresh scenarios via the bundle",6:"regression on the Codex-v3 changes (client reach)",7:"cross-server flows with currency, docx, timezone",8:"a freelancer week through eleven servers"})[r.round] || r.method)}</td></tr>`).join("")}</table></div>
<h2>Per-server matrix (score per round where that server was exercised)</h2>
<div class="tw"><table><tr><th>Server</th>${uvi.rounds.map(r => `<th>R${r.round}</th>`).join("")}<th>Best</th><th>Last tested</th></tr>${uvi.matrix.map(m => `<tr><td class="mono">${esc(m.server)}</td>${m.cells.map(c => `<td class="num">${esc(c)}</td>`).join("")}<td class="num"><b>${m.best_pct ?? ""}%</b></td><td class="num">R${m.last_round ?? ""}</td></tr>`).join("")}</table></div>
<h2>Defect ledger (every D-id found in the value rounds and audits)</h2>
<div class="tw"><table><tr><th>Id</th><th>Status</th><th>Severity</th><th>First seen in</th><th>Line</th></tr>${uvi.ledger.map(d => `<tr><td class="mono">${esc(d.id)}</td><td>${pill(d.status === "fixed" ? "fixed" : d.status.startsWith("open (") ? "client/accepted" : "open")}</td><td class="dim">${esc(d.severity)}</td><td class="mono dim">${esc(d.first_seen)}</td><td class="dim">${esc(d.title)}</td></tr>`).join("")}</table></div>` : ""}
${uv8 ? `<h2>Round 8, a freelancer week through the eleven-server bundle: ${uv8.totals?.score ?? ""}/${uv8.totals?.max ?? ""}</h2>
<div class="tw"><table><tr><th>Scenario</th><th>Score</th><th>Calls</th><th>Sec</th><th>Note</th></tr>${(uv8.scenarios || []).map(x => `<tr><td>${esc(x.prompt || x.id)}</td><td class="num"><b>${x.score}</b>/3</td><td class="num">${x.tool_calls ?? ""}</td><td class="num">${x.seconds ?? ""}</td><td class="dim">${esc(x.note)}</td></tr>`).join("")}</table></div>
<p class="dim">Report: <a href="docs/USER_VALUE_R8.md">docs/USER_VALUE_R8.md</a>.</p>` : ""}
${uv ? `<p class="dim">${esc(uv.method || "")} Run at ${esc(uv.at)}. Full report: <a href="docs/USER_VALUE.md">docs/USER_VALUE.md</a>.</p>
<div class="kpis"><div class="kpi"><div class="n">${uv.totals.score}/${uv.totals.max}</div><div class="k">scenario points (0-3 each, real MCP client)</div></div><div class="kpi"><div class="n">${Math.round(uv.totals.hit_rate * 100)}%</div><div class="k">real retailer price hit rate (${esc(uv.totals.hit_rate_of_reachable)})</div></div><div class="kpi"><div class="n">${esc(uv.pdf.verdict)}</div><div class="k">invoice PDF visual check</div></div><div class="kpi"><div class="n">${(uv.free_tier.limits_hit || []).length}</div><div class="k">free limits hit in first session</div></div></div>
${uv7 ? `<h2>Round 7, cross-server flows through the eight-server bundle (76 tools): ${uv7.totals?.score ?? ""}/${uv7.totals?.max ?? ""}</h2>
<div class="tw"><table><tr><th>Scenario</th><th>Score</th><th>Calls</th><th>Sec</th><th>Note</th></tr>${(uv7.scenarios || []).map(x => `<tr><td>${esc(x.prompt || x.id)}</td><td class="num"><b>${x.score}</b>/3</td><td class="num">${x.tool_calls ?? ""}</td><td class="num">${x.seconds ?? ""}</td><td class="dim">${esc(x.note)}</td></tr>`).join("")}</table></div>
<p class="dim">Report: <a href="docs/USER_VALUE_R7.md">docs/USER_VALUE_R7.md</a>. Every call picked the right tool; the invoice landed at USD 685.88 from EUR hours and a GBP receipt at ECB rates. Seven seam defects found, fixes in v0.3.2.</p>` : ""}
${uv6 ? `<h2>Round 6 regression on the v0.2.4 changes: ${uv6.totals?.score ?? ""}/${uv6.totals?.max ?? ""} through the client, 8/8 correct on direct probes</h2>
<div class="tw"><table><tr><th>Scenario</th><th>Score</th><th>Calls</th><th>Sec</th><th>Note</th></tr>${(uv6.scenarios || []).map(x => `<tr><td>${esc(x.prompt || x.id)}</td><td class="num"><b>${x.score}</b>/3</td><td class="num">${x.tool_calls ?? ""}</td><td class="num">${x.seconds ?? ""}</td><td class="dim">${esc(x.note)}</td></tr>`).join("")}</table></div>
<p class="dim">Report: <a href="docs/USER_VALUE_R6.md">docs/USER_VALUE_R6.md</a>. Every changed behaviour was correct when invoked; the points lost were the client choosing built-in readers over the tools. Fixes for the six follow-up defects are in v0.2.5.</p>` : ""}
${uv5 ? `<h2>Round 5, ten fresh scenarios through the office-suite bundle: ${uv5.totals?.score ?? uv5.totals?.r5 ?? ""}/${uv5.totals?.max ?? ""}</h2>
<div class="tw"><table><tr><th>Scenario</th><th>Score</th><th>Calls</th><th>Sec</th><th>Note</th></tr>${(uv5.scenarios || []).map(x => `<tr><td>${esc(x.prompt || x.id)}</td><td class="num"><b>${x.score ?? x.r5}</b>/3</td><td class="num">${x.tool_calls ?? ""}</td><td class="num">${x.seconds ?? ""}</td><td class="dim">${esc(x.note)}</td></tr>`).join("")}</table></div>
<p class="dim">Report: <a href="docs/USER_VALUE_R5.md">docs/USER_VALUE_R5.md</a>. Verified independently: 6.5 h x 85 = USD 552.50, supplier totals to the cent, 30 km UK converted to 18.64 mi x 0.45 = GBP 8.39 with the conversion disclosed.</p>` : ""}
${uv4 ? `<h2>Round 4 after the round-3 fixes: ${uv4.totals?.r4 ?? uv4.totals?.score ?? ""}/${uv4.totals?.max ?? ""} on the scenarios that had failed (round 3: ${uv4.totals?.r3_same_set ?? ""}/${uv4.totals?.max ?? ""})</h2>
<div class="tw"><table><tr><th>Surface</th><th>User said</th><th>R3</th><th>R4</th><th>Calls</th><th>Sec</th><th>Note</th></tr>${(uv4.scenarios || []).map(x => `<tr><td class="mono">${esc(x.surface || "")}</td><td>${esc(x.prompt || x.id)}</td><td class="num">${x.r3 ?? ""}</td><td class="num"><b>${x.r4 ?? x.score}</b>/3</td><td class="num">${x.tool_calls ?? ""}</td><td class="num">${x.seconds ?? ""}</td><td class="dim">${esc(x.note)}</td></tr>`).join("")}</table></div>
<p class="dim">Report: <a href="docs/USER_VALUE_R4.md">docs/USER_VALUE_R4.md</a>. Verified in the stores: invoice INV-2026-0001 total EUR 338.25 from 2.5 h x 90 plus a 50.00 net receipt at 23% VAT; the expense was marked rebilled only after the invoice existed.</p>` : ""}
${uv3 ? `<h2>Round 3: bundle, hosted endpoints, cross-server flow: ${uv3.totals?.score ?? ""}/${uv3.totals?.max ?? ""}</h2>
<div class="tw"><table><tr><th>Surface</th><th>User said</th><th>Score</th><th>Calls</th><th>Sec</th><th>Note</th></tr>${(uv3.scenarios || []).map(x => `<tr><td class="mono">${esc(x.surface || "")}</td><td>${esc(x.prompt)}</td><td class="num"><b>${x.score}</b>/3</td><td class="num">${x.tool_calls ?? ""}</td><td class="num">${x.seconds ?? ""}</td><td class="dim">${esc(x.note)}</td></tr>`).join("")}</table></div>
<p class="dim">Report: <a href="docs/USER_VALUE_R3.md">docs/USER_VALUE_R3.md</a>. The model never left the bundle in the cross-server flow (all tool calls stayed inside office-suite). Defects found are being fixed for v0.2.1.</p>` : ""}
${uv2 ? `<h2>Round 2 after the value fixes (v0.1.1): ${uv2.totals.score}/${uv2.totals.max}, round 1 was ${uv.totals.score}/${uv.totals.max}</h2>
<div class="tw"><table><tr><th>Server</th><th>User said</th><th>R1</th><th>R2</th><th>Calls</th><th>Sec</th><th>Note</th></tr>${uv2.scenarios.map((x, i) => { const r1 = uv.scenarios.find(y => y.id === x.id) || uv.scenarios[i] || {}; return `<tr><td class="mono">${esc(x.server)}</td><td>${esc(x.prompt)}</td><td class="num">${r1.score ?? ""}</td><td class="num"><b>${x.score}</b></td><td class="num">${x.tool_calls ?? ""}</td><td class="num">${x.seconds ?? ""}</td><td class="dim">${esc(x.note)}</td></tr>`; }).join("")}</table></div>
<p class="dim">Report: <a href="docs/USER_VALUE_R2.md">docs/USER_VALUE_R2.md</a>. Real-retailer hit rate round 2: ${Math.round((uv2.totals.hit_rate || 0) * 100)}%. PDF: ${esc(uv2.pdf?.verdict || "")}.</p>` : ""}
<h2>Round 1 scenarios (v0.1.0), phrased as a user would, through the claude CLI as MCP client</h2>
<div class="tw"><table><tr><th>Server</th><th>User said</th><th>Score</th><th>Calls</th><th>Sec</th><th>Note</th></tr>${uv.scenarios.map(x => `<tr><td class="mono">${esc(x.server)}</td><td>${esc(x.prompt)}</td><td class="num"><b>${x.score}</b>/3</td><td class="num">${x.tool_calls ?? ""}</td><td class="num">${x.seconds ?? ""}</td><td class="dim">${esc(x.note)}</td></tr>`).join("")}</table></div>
<h2>Price extraction on real retailer pages</h2>
<div class="tw"><table><tr><th>URL</th><th>HTTP</th><th>Price</th><th>Currency</th><th>Source</th><th>Correct</th></tr>${uv.price_hits.map(x => `<tr><td class="mono dim">${esc(String(x.url).slice(0, 70))}</td><td class="num">${esc(x.status)}</td><td class="num">${esc(x.price ?? "")}</td><td>${esc(x.currency ?? "")}</td><td class="dim">${esc(x.source ?? "")}</td><td>${pill(x.correct === true ? "ok" : x.correct === false ? "fail" : "n/a")}</td></tr>`).join("")}</table></div>
<div class="grid2"><div><h2>Invoice PDF</h2><div class="card"><p>${esc(uv.pdf.detail || "")}</p><a href="${esc(uv.pdf.png)}"><img src="${esc(uv.pdf.png)}" alt="invoice sample" style="max-width:100%;border:1px solid var(--line);border-radius:6px"></a></div></div>
<div><h2>Free tier in a first session</h2><div class="card"><ul>${(uv.free_tier.limits_hit || []).map(l => `<li><b>${esc(l.server)}</b>: ${esc(l.limit)} at ${esc(l.where)} (${esc(l.severity)}). ${esc(l.note)}</li>`).join("")}</ul></div></div></div>` : `<p>No user-value run yet.</p>`}
</div>

<div class="tab" id="tab-sprints">
${slog ? `<p class="dim">Every dashboard update is a session note in data/ledger.json; commits between two notes are attributed to the earlier note. Generated by scripts/sprint-log.mjs at ${esc(slog.generated_at)}. ${slog.total_commits} commits in ${slog.sessions} sessions.</p>
<div class="kpis">${slog.loops.filter(l => l.sessions).map(l => `<div class="kpi"><div class="n">${l.commits}</div><div class="k">${esc(l.name)} (${l.sessions} sessions)</div></div>`).join("")}</div>
<div class="tw" style="margin-top:12px"><table><tr><th>#</th><th>When (UTC)</th><th>Loop</th><th>Session note</th><th>Commits</th><th>Commit subjects</th></tr>${slog.rows.slice().reverse().map(r => `<tr><td class="num">${r.n}</td><td class="mono">${esc(r.at.slice(0, 16).replace("T", " "))}</td><td class="dim">${esc(r.loop.split(":")[0])}</td><td>${esc(r.note)}</td><td class="num">${r.commits}</td><td class="dim">${r.subjects.map(esc).join("<br>")}</td></tr>`).join("")}</table></div>
<h2>Agent units (RESULT.md files)</h2><p class="dim">The per-unit table with cost, failures and insights is on the Overview tab under Sprint results.</p>` : ""}
</div>

<div class="tab" id="tab-kpi">
${kpi ? `<p class="dim">What an MCP product owner should measure, in funnel order: discovered, installed, first call, value delivered, reliable, paid. Every indicator names its instrument so it can be re-collected with <code>node scripts/kpi.mjs</code>. Collected ${esc(kpi.generated_at)}. Status: met = at or past target; progress = non-zero and below target; zero = instrument works and reads zero; unmeasured = instrument not yet wired.</p>
<div class="kpis">${["Discovery", "Install", "Activation", "Value", "Reliability", "Monetization"].map(c => { const g = kpi.kpis.filter(k => k.cat === c); return `<div class="kpi"><div class="n">${g.filter(k => k.status === "met").length}/${g.length}</div><div class="k">${c} indicators met</div></div>`; }).join("")}</div>
${["Discovery", "Install", "Activation", "Value", "Reliability", "Monetization"].map(c => `<h2>${c}</h2><div class="tw"><table><tr><th>Indicator</th><th>Now</th><th>Target</th><th>Status</th><th>Instrument</th><th>Why it matters</th></tr>${kpi.kpis.filter(k => k.cat === c).map(k => `<tr><td><b>${esc(k.name)}</b></td><td class="num">${k.value === null || k.value === undefined ? "<span class=dim>n/a</span>" : esc(String(k.value))} <span class="dim">${esc(k.unit)}</span></td><td class="num">${esc(String(k.target ?? ""))}${k.lower_is_better ? " <span class=dim>(lower)</span>" : ""}</td><td>${pill(k.status === "met" ? "met" : k.status === "unmeasured" ? "unmeasured" : k.status === "zero" ? "zero" : "progress")}</td><td class="mono dim">${esc(k.how)}</td><td class="dim">${esc(k.why)}</td></tr>`).join("")}</table></div>`).join("")}
<h2>Reading the KPIs as a specialist</h2>
<div class="card"><ul>
<li><b>Hosted activation is the leading indicator.</b> Registries and directories only count hosted use, and an anonymous token is the cheapest possible first call. Watch anon tokens and tenant documents before downloads.</li>
<li><b>Tool reach beats tool count.</b> A server that is correct on direct probes but loses to a built-in reader delivers nothing; the first-prompt reach rate is the number to protect, and descriptions are its lever.</li>
<li><b>Probes contaminate funnel metrics.</b> Validation runs create checkout sessions and Pro tenants; since 2026-09-03 they are tagged (metadata.probe, signed keys) and excluded. Pre-tag sessions are excluded by timestamp.</li>
<li><b>Latency has a cliff, not a curve.</b> Round 4 measured first-prompt misses when connect plus tools/list ran past about a second; p50 is tracked against 800 ms.</li>
<li><b>Until paid sessions are non-zero, every other number is a proxy.</b> The KPI that closes the loop is paid sessions and minted keys; the rest exist to explain why it is still zero.</li>
</ul></div>` : `<p>Run <code>node scripts/kpi.mjs</code> to collect KPIs.</p>`}
</div>

<div class="tab" id="tab-organic">
<div class="kpis"><div class="kpi"><div class="n">${orgHeadline}/100</div><div class="k">fleet organic traffic rating (reach-weighted mean of surface scores)</div></div><div class="kpi"><div class="n">${organic.fleet?.max_surface ?? 0}</div><div class="k">best single surface</div></div><div class="kpi"><div class="n">${organic.fleet?.fleet_score ?? 0}%</div><div class="k">chance at least one surface yields any organic visit (noisy-OR, model)</div></div><div class="kpi"><div class="n">${organic.surfaces.filter(s => s.listed >= 1).length}/${organic.surfaces.length}</div><div class="k">surfaces where the fleet is live</div></div></div>
<div class="card" style="margin-top:12px"><b>Verdict.</b> ${esc(organic.fleet?.verdict || "")}</div>
<h2>Will a user see it? Score per surface (100 x listed x findable x reach)</h2>
<div class="tw"><table><tr><th>Surface</th><th>Status</th><th>Listed</th><th>Findable</th><th>Reach</th><th>Score</th><th>Evidence</th><th>What raises it</th></tr>
${organic.surfaces.slice().sort((a, b) => b.score - a.score).map(s => `<tr><td><b>${esc(s.surface)}</b></td><td>${pill(s.status)}</td><td class="num">${s.listed}</td><td class="num">${s.findable}</td><td class="num">${s.reach}</td><td class="num"><b>${s.score}</b></td><td class="dim">${esc(s.evidence)}</td><td class="dim">${esc(s.fix)}</td></tr>`).join("")}</table></div>
<h2>Per server, in the registry as it stands today</h2>
<div class="tw"><table><tr><th>Server</th><th>Registry slot (measured)</th><th>Competitors in slot</th><th>Organic rating</th><th>Why</th></tr>
${organic.servers.map(x => `<tr><td class="mono"><b>${esc(x.id)}</b></td><td class="dim">${esc(x.registry_slot)}</td><td class="num">${x.competitors_in_slot}</td><td class="num"><b>${x.organic}</b></td><td class="dim">${esc(x.why)}</td></tr>`).join("")}</table></div>
<h2>Measured inputs</h2>
<div class="tw"><table><tr><th>Finding</th><th>Detail</th><th>Source</th></tr>${organic.measured.map(m => `<tr><td><b>${esc(m[0])}</b></td><td class="dim">${esc(m[1])}</td><td class="dim">${esc(m[2])}</td></tr>`).join("")}</table></div>
<p class="dim">${esc(organic.model || "")}</p>
</div>
<script>
for (const b of document.querySelectorAll(".tabs button")) b.addEventListener("click", () => { document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x === b)); document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.id === "tab-" + b.dataset.tab)); location.hash = b.dataset.tab; });
if (location.hash) { const b = document.querySelector('.tabs button[data-tab="' + location.hash.slice(1) + '"]'); if (b) b.click(); }
</script>
<div class="foot">Regenerate: <code>node scripts/validate.mjs &amp;&amp; node scripts/update-dashboard.mjs --note "..." &amp;&amp; node scripts/render-main.mjs</code>. Data: data/ledger.json, data/facts.json, data/distribution.json. Built by theluckystrike. https://github.com/theluckystrike</div>
</div></body></html>`;

writeFileSync(join(ROOT, "index.html"), html);
console.log(`main dashboard written: ${join(ROOT, "index.html")} (${html.length} bytes, ${servers.length} servers, ${sprints.length} sprint units)`);
