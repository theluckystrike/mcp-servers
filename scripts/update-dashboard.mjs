#!/usr/bin/env node
// Scans the mcp-servers repo, writes data/ledger.json, renders dashboard/index.html.
// Node 22, ESM, no dependencies. Must never crash on missing/partial inputs.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const DASHBOARD_DIR = join(ROOT, "dashboard");
const LEDGER_PATH = join(DATA_DIR, "ledger.json");
const HTML_PATH = join(DASHBOARD_DIR, "index.html");

const PRICE_USD = 19;
const BUY_BASE = "https://mcp.zovo.one/buy/";

// ---------- helpers ----------

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

function fileExists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
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

function listDirs(path) {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

function listTsFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

function countLines(path) {
  const text = readText(path);
  if (text === null) return 0;
  if (text.length === 0) return 0;
  return text.split("\n").length;
}

function parseTools(srcDir) {
  // Per spec: parse registerTool("name" from src/index.ts.
  const indexPath = join(srcDir, "index.ts");
  const text = readText(indexPath);
  if (text === null) return [];
  const names = [];
  const re = /registerTool\(\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    names.push(m[1]);
  }
  return names;
}

function parseFreeLimits(readmeText) {
  if (!readmeText) return "pending";
  const lines = readmeText.split("\n");
  for (const line of lines) {
    // Markdown table row starting with "| Free" or a line beginning with "Free"
    if (/^\s*\|?\s*\*{0,2}Free\*{0,2}\s*\|/i.test(line) || /^\s*Free\s*[:\-]/i.test(line)) {
      return line.trim();
    }
  }
  return "pending";
}

function parseResultMd(text) {
  const out = { status: "pending", test_summary: "pending" };
  if (!text) return out;
  const lines = text.split("\n");
  for (const line of lines) {
    const statusMatch = line.match(/^\s*status\s*:\s*(.+)$/i);
    if (statusMatch) out.status = statusMatch[1].trim();
    if (/#\s*pass/i.test(line) || /#\s*fail/i.test(line)) {
      out.test_summary = out.test_summary === "pending" ? line.trim() : out.test_summary + " / " + line.trim();
    }
  }
  return out;
}

function parseBillingResult(text) {
  if (!text) return { status: "pending", urls: [] };
  const lines = text.split("\n");
  let status = "pending";
  const urls = [];
  const urlRe = /https?:\/\/[^\s)"'<>]+/g;
  for (const line of lines) {
    const statusMatch = line.match(/^\s*status\s*:\s*(.+)$/i);
    if (statusMatch) status = statusMatch[1].trim();
    let m;
    while ((m = urlRe.exec(line)) !== null) urls.push(m[0]);
  }
  return { status, urls: [...new Set(urls)] };
}

function parseDocFirstLine(text) {
  if (!text) return "pending";
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines[0].replace(/^#+\s*/, "") : "pending";
}

// ---------- load existing ledger for session history ----------

const existingLedger = readJson(LEDGER_PATH, null);
const note = parseArgNote(process.argv.slice(2));

const prevHistory = existingLedger?.session?.history ?? [];
const prevCount = existingLedger?.session?.count ?? 0;

const session = {
  count: note ? prevCount + 1 : prevCount,
  history: note
    ? [...prevHistory, { at: new Date().toISOString(), note }]
    : prevHistory,
};

// ---------- distribution.json ----------

const distributionData = readJson(join(DATA_DIR, "distribution.json"), {});

function distributionFor(id) {
  const d = distributionData[id] || {};
  return {
    npm: d.npm || "unknown",
    registry: d.registry || "unknown",
    github: d.github || "unknown",
    smithery: d.smithery || "unknown",
    glama: d.glama || "unknown",
  };
}

// ---------- servers ----------

const SERVERS_DIR = join(ROOT, "servers");
const serverIds = listDirs(SERVERS_DIR);

const servers = serverIds.map((id) => {
  const dir = join(SERVERS_DIR, id);
  const srcDir = join(dir, "src");
  const pkgJson = readJson(join(dir, "package.json"), null);
  const readmeText = readText(join(dir, "README.md"));
  const resultText = readText(join(dir, "RESULT.md"));
  const resultParsed = parseResultMd(resultText);

  const tools = parseTools(srcDir);
  const tsFiles = listTsFiles(srcDir);
  const loc = tsFiles.reduce((sum, f) => sum + countLines(f), 0);

  const filesPresent = {
    readme: fileExists(join(dir, "README.md")),
    server_json: fileExists(join(dir, "server.json")),
    smithery_yaml: fileExists(join(dir, "smithery.yaml")),
    dockerfile: fileExists(join(dir, "Dockerfile")),
    license: fileExists(join(dir, "LICENSE")),
  };

  return {
    id,
    npm_name: pkgJson?.name ?? "pending",
    version: pkgJson?.version ?? "pending",
    dir: `servers/${id}`,
    tools,
    tool_count: tools.length,
    free_limits: parseFreeLimits(readmeText),
    price_usd: PRICE_USD,
    build_ok: fileExists(join(dir, "dist", "index.js")),
    test_summary: resultParsed.test_summary,
    result_status: resultParsed.status,
    loc,
    files_present: filesPresent,
    distribution: distributionFor(id),
  };
});

// ---------- billing ----------

const billingResultText = readText(join(ROOT, "billing", "RESULT.md"));
const billingParsed = parseBillingResult(billingResultText);
const billingProductsJson = readJson(join(DATA_DIR, "products.json"), null);

const billing = {
  status: billingParsed.status,
  urls: billingParsed.urls,
  products: billingProductsJson ?? serverIds.map((id) => ({ id, price_usd: PRICE_USD, url: `${BUY_BASE}${id}` })),
};

// ---------- docs ----------

const DOCS_DIR = join(ROOT, "docs");
const docFiles = (() => {
  try {
    return readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return [];
  }
})();

const docs = docFiles.map((f) => ({
  file: `docs/${f}`,
  first_line: parseDocFirstLine(readText(join(DOCS_DIR, f))),
}));

// ---------- revenue ----------

const salesData = readJson(join(DATA_DIR, "sales.json"), null);

const revenue = {
  stripe_live_sales: salesData?.stripe_live_sales ?? 0,
  note: salesData ? (salesData.note ?? "pending") : "pending (data/sales.json not found)",
};

// ---------- ledger ----------

const ledger = {
  generated_at: new Date().toISOString(),
  session,
  servers,
  billing,
  docs,
  revenue,
};

writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + "\n");

// ---------- render HTML ----------

function statusPill(ok, label) {
  const cls = ok === true ? "pill pill-ok" : ok === false ? "pill pill-bad" : "pill pill-pending";
  const text = ok === true ? "yes" : ok === false ? "no" : "pending";
  return `<span class="${cls}" title="${escapeHtml(label)}">${escapeHtml(label)}: ${text}</span>`;
}

function distPill(value, label) {
  const v = value || "unknown";
  const cls =
    v === "published" ? "pill pill-ok" : v === "missing" ? "pill pill-bad" : "pill pill-pending";
  return `<span class="${cls}" title="${escapeHtml(label)}">${escapeHtml(label)}: ${escapeHtml(v)}</span>`;
}

const totalTools = servers.reduce((s, sv) => s + sv.tool_count, 0);

function countPassingTests(sv) {
  const m = sv.test_summary.match(/#\s*pass\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}
const testsPassingTotal = servers.reduce((s, sv) => s + countPassingTests(sv), 0);

function publishedSurfaceCount(sv) {
  return Object.values(sv.distribution).filter((v) => v === "published").length;
}
const publishedSurfacesTotal = servers.reduce((s, sv) => s + publishedSurfaceCount(sv), 0);

function buildServerRow(sv) {
  const buyLink = `${BUY_BASE}${sv.id}`;
  const distPills = [
    distPill(sv.distribution.npm, "npm"),
    distPill(sv.distribution.registry, "registry"),
    distPill(sv.distribution.github, "github"),
    distPill(sv.distribution.smithery, "smithery"),
    distPill(sv.distribution.glama, "glama"),
  ].join(" ");
  const filePills = [
    statusPill(sv.files_present.readme, "readme"),
    statusPill(sv.files_present.server_json, "server.json"),
    statusPill(sv.files_present.smithery_yaml, "smithery.yaml"),
    statusPill(sv.files_present.dockerfile, "dockerfile"),
    statusPill(sv.files_present.license, "license"),
  ].join(" ");
  const toolsList = sv.tools.length ? sv.tools.map(escapeHtml).join(", ") : "pending";
  return `<tr>
    <td class="mono">${escapeHtml(sv.id)}</td>
    <td class="mono">${escapeHtml(sv.version)}</td>
    <td class="num">${sv.tool_count}</td>
    <td class="tools" title="${escapeHtml(toolsList)}">${toolsList}</td>
    <td>${escapeHtml(sv.free_limits)}</td>
    <td>${statusPill(sv.build_ok, "build")}</td>
    <td class="mono">${escapeHtml(sv.test_summary)}</td>
    <td class="mono">${escapeHtml(sv.result_status)}</td>
    <td>${filePills}</td>
    <td>${distPills}</td>
    <td class="num mono">$${sv.price_usd}</td>
    <td><a href="${escapeHtml(buyLink)}">${escapeHtml(buyLink)}</a></td>
  </tr>`;
}

function buildNextActions() {
  const actions = [];
  for (const sv of servers) {
    if (!sv.build_ok) actions.push(`${sv.id}: build not present (dist/index.js missing) — run npm run build`);
    if (sv.tool_count === 0) actions.push(`${sv.id}: no tools parsed from src/index.ts (missing or not yet written)`);
    if (!sv.files_present.readme) actions.push(`${sv.id}: README.md missing`);
    if (!sv.files_present.license) actions.push(`${sv.id}: LICENSE missing`);
    if (!sv.files_present.server_json) actions.push(`${sv.id}: server.json missing`);
    if (!sv.files_present.smithery_yaml) actions.push(`${sv.id}: smithery.yaml missing`);
    if (!sv.files_present.dockerfile) actions.push(`${sv.id}: Dockerfile missing`);
    if (sv.result_status === "pending") actions.push(`${sv.id}: RESULT.md missing or has no status line`);
    for (const [surface, v] of Object.entries(sv.distribution)) {
      if (v !== "published") actions.push(`${sv.id}: ${surface} not published (${v})`);
    }
  }
  if (billing.status === "pending") actions.push("billing: RESULT.md missing or has no status line");
  if (docs.length === 0) actions.push("docs: no docs/*.md files present yet");
  if (revenue.note.startsWith("pending")) actions.push("revenue: data/sales.json not found");
  return actions;
}

const nextActions = buildNextActions();

const sessionRows = session.history
  .slice()
  .reverse()
  .map((h) => `<tr><td class="mono">${escapeHtml(h.at)}</td><td>${escapeHtml(h.note)}</td></tr>`)
  .join("\n");

const docRows = docs
  .map((d) => `<tr><td class="mono">${escapeHtml(d.file)}</td><td>${escapeHtml(d.first_line)}</td></tr>`)
  .join("\n");

const billingUrlsHtml = billing.urls.length
  ? billing.urls.map((u) => `<a href="${escapeHtml(u)}">${escapeHtml(u)}</a>`).join("<br>")
  : "pending";

const billingProductsRows = billing.products
  .map(
    (p) =>
      `<tr><td class="mono">${escapeHtml(p.id)}</td><td class="num mono">$${escapeHtml(String(p.price_usd))}</td><td><a href="${escapeHtml(p.url)}">${escapeHtml(p.url)}</a></td></tr>`
  )
  .join("\n");

const nextActionsHtml = nextActions.length
  ? `<ul>${nextActions.map((a) => `<li>${escapeHtml(a)}</li>`).join("\n")}</ul>`
  : "<p>none</p>";

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>MCP Servers by theluckystrike</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #f7f7f8;
    --fg: #1a1a1a;
    --muted: #5c5c5c;
    --border: #d8d8dc;
    --card-bg: #ffffff;
    --ok: #0a7a3d;
    --ok-bg: #e4f6ec;
    --bad: #9b1c1c;
    --bad-bg: #fbe7e7;
    --pending: #7a6a00;
    --pending-bg: #fbf3d6;
    --accent: #2f2f33;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #121214;
      --fg: #e8e8ea;
      --muted: #9a9aa0;
      --border: #2e2e33;
      --card-bg: #1a1a1d;
      --ok: #4fd88a;
      --ok-bg: #103021;
      --bad: #ff8a8a;
      --bad-bg: #3a1414;
      --pending: #e8cf5a;
      --pending-bg: #3a3010;
      --accent: #e8e8ea;
    }
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-variant-numeric: tabular-nums;
    font-size: 13px;
    line-height: 1.5;
  }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 24px 20px 60px; }
  header { border-bottom: 1px solid var(--border); padding-bottom: 14px; margin-bottom: 20px; }
  header h1 { margin: 0 0 4px; font-size: 18px; letter-spacing: -0.01em; }
  header .meta { color: var(--muted); font-size: 12px; }
  .kpi-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 24px; }
  .kpi {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 14px;
    min-width: 120px;
  }
  .kpi .n { font-size: 20px; font-weight: 600; display: block; }
  .kpi .l { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  section { margin-bottom: 30px; }
  h2 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    padding-bottom: 6px;
    margin: 0 0 12px;
  }
  table { border-collapse: collapse; width: 100%; background: var(--card-bg); }
  table.scroll-wrap { display: block; overflow-x: auto; }
  th, td {
    border: 1px solid var(--border);
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
    font-size: 12px;
  }
  th { color: var(--muted); font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.03em; }
  td.mono, th.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  td.num { text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  td.tools { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  a { color: var(--accent); }
  .pill {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    margin: 1px 2px 1px 0;
    white-space: nowrap;
    border: 1px solid var(--border);
  }
  .pill-ok { background: var(--ok-bg); color: var(--ok); border-color: var(--ok); }
  .pill-bad { background: var(--bad-bg); color: var(--bad); border-color: var(--bad); }
  .pill-pending { background: var(--pending-bg); color: var(--pending); border-color: var(--pending); }
  footer { color: var(--muted); font-size: 11px; border-top: 1px solid var(--border); padding-top: 12px; margin-top: 30px; }
  ul { margin: 0; padding-left: 18px; }
  li { margin-bottom: 4px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>MCP Servers by theluckystrike</h1>
    <div class="meta">generated ${escapeHtml(ledger.generated_at)} — session count ${session.count}</div>
  </header>

  <div class="kpi-row">
    <div class="kpi"><span class="n">${servers.length}</span><span class="l">servers</span></div>
    <div class="kpi"><span class="n">${totalTools}</span><span class="l">tools total</span></div>
    <div class="kpi"><span class="n">${testsPassingTotal}</span><span class="l">tests passing</span></div>
    <div class="kpi"><span class="n">${publishedSurfacesTotal}</span><span class="l">published surfaces</span></div>
    <div class="kpi"><span class="n">$${revenue.stripe_live_sales}</span><span class="l">revenue</span></div>
  </div>

  <section>
    <h2>Servers</h2>
    <div class="scroll-wrap" style="overflow-x:auto;">
    <table>
      <thead><tr>
        <th>id</th><th>version</th><th class="num">tools</th><th>tool names</th><th>free limits</th>
        <th>build</th><th>tests</th><th>result</th><th>files</th><th>distribution</th>
        <th class="num">price</th><th>buy link</th>
      </tr></thead>
      <tbody>
        ${servers.map(buildServerRow).join("\n")}
      </tbody>
    </table>
    </div>
  </section>

  <section>
    <h2>Billing</h2>
    <p class="mono">status: ${escapeHtml(billing.status)}</p>
    <p>${billingUrlsHtml}</p>
    <div class="scroll-wrap" style="overflow-x:auto;">
    <table>
      <thead><tr><th>product</th><th class="num">price</th><th>url</th></tr></thead>
      <tbody>
        ${billingProductsRows || `<tr><td colspan="3">pending</td></tr>`}
      </tbody>
    </table>
    </div>
  </section>

  <section>
    <h2>Distribution checklist</h2>
    <div class="scroll-wrap" style="overflow-x:auto;">
    <table>
      <thead><tr><th>id</th><th>npm</th><th>registry</th><th>github</th><th>smithery</th><th>glama</th></tr></thead>
      <tbody>
        ${servers
          .map(
            (sv) =>
              `<tr><td class="mono">${escapeHtml(sv.id)}</td><td>${escapeHtml(sv.distribution.npm)}</td><td>${escapeHtml(sv.distribution.registry)}</td><td>${escapeHtml(sv.distribution.github)}</td><td>${escapeHtml(sv.distribution.smithery)}</td><td>${escapeHtml(sv.distribution.glama)}</td></tr>`
          )
          .join("\n")}
      </tbody>
    </table>
    </div>
  </section>

  <section>
    <h2>Docs</h2>
    <div class="scroll-wrap" style="overflow-x:auto;">
    <table>
      <thead><tr><th>file</th><th>first line</th></tr></thead>
      <tbody>
        ${docRows || `<tr><td colspan="2">pending</td></tr>`}
      </tbody>
    </table>
    </div>
  </section>

  <section>
    <h2>Session log</h2>
    <div class="scroll-wrap" style="overflow-x:auto;">
    <table>
      <thead><tr><th>at</th><th>note</th></tr></thead>
      <tbody>
        ${sessionRows || `<tr><td colspan="2">pending</td></tr>`}
      </tbody>
    </table>
    </div>
  </section>

  <section>
    <h2>Next actions</h2>
    ${nextActionsHtml}
  </section>

  <footer>
    Data: data/ledger.json, regenerate with node scripts/update-dashboard.mjs --note '...'
  </footer>
</div>
</body>
</html>
`;

writeFileSync(HTML_PATH, html);

console.error(`ledger written: ${LEDGER_PATH}`);
console.error(`dashboard written: ${HTML_PATH} (${Buffer.byteLength(html, "utf8")} bytes)`);
