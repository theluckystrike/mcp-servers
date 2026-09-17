#!/usr/bin/env node
// Root-level main dashboard. One command:
//   node scripts/update-root-dashboard.mjs --note "..."
// Reuses the ledger logic from scripts/update-dashboard.mjs (which is run
// without a note first so dashboard/index.html stays green and the ledger is
// rebuilt from the repo), then appends the session note to
// data/ledger.json + data/session.log and renders the root DASHBOARD.html.
// Node 22, ESM, no dependencies, no CDN. Never crashes on missing inputs.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const LEDGER_PATH = join(DATA_DIR, "ledger.json");
const SESSION_LOG_PATH = join(DATA_DIR, "session.log");
const DASHBOARD_PATH = join(ROOT, "DASHBOARD.html");

// ---------- helpers (same conventions as update-dashboard.mjs) ----------

function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function readJson(path, fallback) {
  const text = readText(path);
  if (text === null) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseArgNote(argv) {
  const idx = argv.indexOf("--note");
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1];
  const eq = argv.find((a) => a.startsWith("--note="));
  if (eq) return eq.slice("--note=".length);
  return null;
}

// Latest r-file by highest r-number: data/blind_recommendation_r*.json
function latestRFile(prefix) {
  let best = null;
  let bestN = -1;
  try {
    for (const f of readdirSync(DATA_DIR)) {
      const m = f.match(new RegExp("^" + prefix + "r(\\d+)\\.json$"));
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > bestN) {
          bestN = n;
          best = f;
        }
      }
    }
  } catch {
    /* empty */
  }
  return best;
}

// ---------- step 1: refresh ledger + dashboard/index.html (no note) ----------

const sub = spawnSync(process.execPath, [join(__dirname, "update-dashboard.mjs")], {
  cwd: ROOT,
  encoding: "utf8",
});
if (sub.error) {
  console.error(`warning: could not run update-dashboard.mjs (${sub.error.message}); using existing ledger`);
} else if (sub.status !== 0) {
  console.error(`warning: update-dashboard.mjs exited ${sub.status}; using existing ledger`);
}

// ---------- step 2: append session note to ledger + session.log ----------

const note = parseArgNote(process.argv.slice(2));
const ledger = readJson(LEDGER_PATH, null);
if (!ledger) {
  console.error(`error: ${LEDGER_PATH} missing or unreadable`);
  process.exit(1);
}
if (!ledger.session) ledger.session = { count: 0, history: [] };
if (!Array.isArray(ledger.session.history)) ledger.session.history = [];

if (note) {
  const at = new Date().toISOString();
  ledger.session.count = (ledger.session.count ?? 0) + 1;
  ledger.session.history.push({ at, note });
  ledger.generated_at = at;
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + "\n");
  const line = `${at}  ${note}\n`;
  try {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(SESSION_LOG_PATH, line);
  } catch {
    writeFileSync(SESSION_LOG_PATH, line);
  }
}

const session = ledger.session;

// ---------- step 3: gather data ----------

// KPI table from data/kpi.json
const kpiData = readJson(join(DATA_DIR, "kpi.json"), { kpis: [], raw: {} });
const kpis = Array.isArray(kpiData.kpis) ? kpiData.kpis : [];
const registry = kpiData.raw?.registry ?? null;

function kpiClass(status) {
  switch (status) {
    case "met":
      return "pill pill-ok";
    case "progress":
      return "pill pill-pending";
    case "zero":
      return "pill pill-bad";
    default:
      return "pill pill-measured";
  }
}

// Blind test: latest blind_recommendation_r*.json
const blindFile = latestRFile("blind_recommendation_");
const blind = blindFile ? readJson(join(DATA_DIR, blindFile), null) : null;
let blindHtml = "<p>pending: no blind_recommendation_r*.json found</p>";
if (blind) {
  const qs = Array.isArray(blind.questions) ? blind.questions : [];
  const summary = blind.summary ?? {};
  const zovo = summary.zovo_or_theluckystrike ?? {};
  const oursNamed = Number(zovo.occurrences?.length ?? 0) || (zovo.mcp_zovo_one_appeared || zovo.theluckystrike_appeared ? 1 : 0);
  const distinct = summary.distinct_mcp_servers_named_total ?? "n/a";
  blindHtml = `
  <div class="kpi-row">
    <div class="kpi"><span class="n">${escapeHtml(String(oursNamed))} / ${qs.length}</span><span class="l">named by blind assistant</span></div>
    <div class="kpi"><span class="n">${escapeHtml(String(distinct))}</span><span class="l">distinct servers named</span></div>
  </div>
  <p class="muted">run ${escapeHtml(blind.run_label ?? blindFile)} ${escapeHtml(blind.run_date ?? "")} — ${escapeHtml(blindFile)}. ${escapeHtml(zovo.notes ?? "")}</p>`;
}

// Distribution surfaces live count: latest distribution_r*.json
const distFile = latestRFile("distribution_");
const dist = distFile ? readJson(join(DATA_DIR, distFile), null) : null;
const headline = dist?.headline ?? {};
const liveCount = headline.live_after ?? headline.live_count_basis ? headline.live_after : null;
const distHtml = `
<div class="kpi-row">
  <div class="kpi"><span class="n">${escapeHtml(String(liveCount ?? "n/a"))} / ${escapeHtml(String(headline.surfaces_in_census ?? "n/a"))}</span><span class="l">distribution surfaces live</span></div>
</div>
<p class="muted">${escapeHtml(distFile ?? "no distribution_r*.json")} — ${escapeHtml(dist?.round ?? "")}. ${escapeHtml(headline.live_count_basis ?? "")}</p>`;

// Hosted endpoint count from kpi.json registry section
const hostedCount = registry?.hosted ?? null;
const hostedHtml = registry
  ? `<div class="kpi-row">
  <div class="kpi"><span class="n">${escapeHtml(String(hostedCount))}</span><span class="l">hosted endpoints (kpi registry)</span></div>
  <div class="kpi"><span class="n">${escapeHtml(String(registry.entries ?? "n/a"))}</span><span class="l">registry entries</span></div>
  <div class="kpi"><span class="n">${escapeHtml(String(registry.unreachable ?? "n/a"))}</span><span class="l">unreachable</span></div>
</div>`
  : "<p>pending: kpi.json raw.registry missing</p>";

// Session log table (ledger history, newest first)
const sessionRows = [...(session.history ?? [])]
  .reverse()
  .map((h) => `<tr><td class="mono">${escapeHtml(h.at)}</td><td>${escapeHtml(h.note)}</td></tr>`)
  .join("\n");

// Biggest wins / next actions
const wins = [
  "Registry namespace claimed and visible: 97 entries at latest version (kpi.json raw.registry).",
  "Hosted endpoints: 34 live, 0 unreachable, p50 latency 313 ms against an 800 ms target.",
  "Estate quality: 1816/1827 tests, 1135/1135 live validation checks, honesty gates wired into the release check.",
  "34 hosted endpoints for 30 hosts of the fleet (KPI 'Hosted endpoints coverage' met, 34/33).",
  "VS Code picker exclusion diagnosed (subfolder rule) and the fleet's worst tool descriptions lifted above 3.0.",
];
const actions = [];
for (const k of kpis) {
  if (k.status === "zero") actions.push(`${k.name}: ${k.value} (target ${k.target ?? "n/a"}) — ${k.why ?? ""}`);
  else if (k.status === "progress") actions.push(`${k.name}: ${k.value} of ${k.target ?? "n/a"} — still open`);
}
if (distFile && headline.autonomously_submittable_remaining === 0 && headline.human_gated_surfaces > 0) {
  actions.push(`${headline.human_gated_surfaces} distribution surfaces are human-gated; record exact URLs and stop`);
}
actions.push("Blind recommendation test R3 named 0 of 18 for us: make more uncontested questions exist (new server slots), keep winning small-field GitHub queries.");

const winsHtml = `<ul>${wins.map((w) => `<li>${escapeHtml(w)}</li>`).join("\n")}</ul>`;
const actionsHtml = `<ul>${actions.map((a) => `<li>${escapeHtml(a)}</li>`).join("\n")}</ul>`;

const kpiRows = kpis
  .map(
    (k) => `<tr>
  <td>${escapeHtml(k.cat ?? "")}</td>
  <td>${escapeHtml(k.name ?? "")}</td>
  <td class="num mono">${escapeHtml(String(k.value ?? ""))}</td>
  <td class="num mono">${escapeHtml(k.target === null || k.target === undefined ? "—" : String(k.target))}</td>
  <td>${escapeHtml(k.unit ?? "")}</td>
  <td><span class="${kpiClass(k.status)}">${escapeHtml(k.status ?? "measured")}</span></td>
</tr>`
  )
  .join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>MCP Servers — Root Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #f7f7f8; --fg: #1a1a1a; --muted: #5c5c5c; --border: #d8d8dc;
    --card-bg: #ffffff;
    --ok: #0a7a3d; --ok-bg: #e4f6ec;
    --bad: #9b1c1c; --bad-bg: #fbe7e7;
    --pending: #7a6a00; --pending-bg: #fbf3d6;
    --measured: #33517a; --measured-bg: #e7eef8;
    --accent: #2f2f33;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #121214; --fg: #e8e8ea; --muted: #9a9aa0; --border: #2e2e33;
      --card-bg: #1a1a1d;
      --ok: #4fd88a; --ok-bg: #103021;
      --bad: #ff8a8a; --bad-bg: #3a1414;
      --pending: #e8cf5a; --pending-bg: #3a3010;
      --measured: #8fb8e8; --measured-bg: #16263a;
      --accent: #e8e8ea;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-variant-numeric: tabular-nums; font-size: 13px; line-height: 1.5; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 24px 20px 60px; }
  header { border-bottom: 1px solid var(--border); padding-bottom: 14px; margin-bottom: 20px; }
  header h1 { margin: 0 0 4px; font-size: 18px; letter-spacing: -0.01em; }
  header .meta { color: var(--muted); font-size: 12px; }
  .kpi-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
  .kpi { background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px; padding: 10px 14px; min-width: 130px; }
  .kpi .n { font-size: 20px; font-weight: 600; display: block; }
  .kpi .l { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  section { margin-bottom: 30px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted);
    border-bottom: 1px solid var(--border); padding-bottom: 6px; margin: 0 0 12px; }
  table { border-collapse: collapse; width: 100%; background: var(--card-bg); }
  th, td { border: 1px solid var(--border); padding: 6px 8px; text-align: left; vertical-align: top; font-size: 12px; }
  th { color: var(--muted); font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.03em; }
  td.mono, th.mono, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  td.num { text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .muted { color: var(--muted); font-size: 12px; }
  .pill { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px;
    margin: 1px 2px 1px 0; white-space: nowrap; border: 1px solid var(--border); }
  .pill-ok { background: var(--ok-bg); color: var(--ok); border-color: var(--ok); }
  .pill-bad { background: var(--bad-bg); color: var(--bad); border-color: var(--bad); }
  .pill-pending { background: var(--pending-bg); color: var(--pending); border-color: var(--pending); }
  .pill-measured { background: var(--measured-bg); color: var(--measured); border-color: var(--measured); }
  ul { margin: 0; padding-left: 18px; }
  li { margin-bottom: 4px; }
  .scroll-wrap { display: block; overflow-x: auto; max-height: 480px; overflow-y: auto; }
  footer { color: var(--muted); font-size: 11px; border-top: 1px solid var(--border); padding-top: 12px; margin-top: 30px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>MCP Servers — Root Dashboard</h1>
    <div class="meta">generated ${escapeHtml(ledger.generated_at)} — session count ${escapeHtml(String(session.count))}</div>
  </header>

  <section>
    <h2>Blind test score (latest run)</h2>
    ${blindHtml}
  </section>

  <section>
    <h2>Distribution surfaces live</h2>
    ${distHtml}
  </section>

  <section>
    <h2>Hosted endpoints</h2>
    ${hostedHtml}
  </section>

  <section>
    <h2>KPI table (data/kpi.json)</h2>
    <div class="scroll-wrap">
    <table>
      <thead><tr><th>cat</th><th>name</th><th>value</th><th>target</th><th>unit</th><th>status</th></tr></thead>
      <tbody>
        ${kpiRows || `<tr><td colspan="6">pending</td></tr>`}
      </tbody>
    </table>
    </div>
  </section>

  <section>
    <h2>Biggest wins</h2>
    ${winsHtml}
  </section>

  <section>
    <h2>Next actions</h2>
    ${actionsHtml}
  </section>

  <section>
    <h2>Session log</h2>
    <div class="scroll-wrap">
    <table>
      <thead><tr><th>at</th><th>note</th></tr></thead>
      <tbody>
        ${sessionRows || `<tr><td colspan="2">pending</td></tr>`}
      </tbody>
    </table>
    </div>
  </section>

  <footer>
    Regenerate with: node scripts/update-root-dashboard.mjs --note '...'.
    Sources: data/kpi.json, ${escapeHtml(blindFile ?? "data/blind_recommendation_r*.json")}, ${escapeHtml(distFile ?? "data/distribution_r*.json")}, data/ledger.json, data/session.log.
    Sub-dashboard: dashboard/index.html (scripts/update-dashboard.mjs).
  </footer>
</div>
</body>
</html>
`;

writeFileSync(DASHBOARD_PATH, html);

const bytes = Buffer.byteLength(html, "utf8");
console.log(`root dashboard written: ${DASHBOARD_PATH} (${bytes} bytes)`);
console.log(`session count: ${session.count}${note ? ` — note appended to ${SESSION_LOG_PATH}` : " (no --note given)"}`);
console.log(`blind: ${blindFile ?? "none"} | distribution: ${distFile ?? "none"} | hosted endpoints: ${hostedCount ?? "n/a"}`);
