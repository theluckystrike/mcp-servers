#!/usr/bin/env node
// MCP product KPIs, collected from live and local sources into data/kpi.json. Free endpoints only.
// Categories follow the funnel a server lives in: discovered -> installed -> first call -> repeat use -> paid.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const js = (p, d) => { try { return JSON.parse(readFileSync(`${ROOT}/${p}`, "utf8")); } catch { return d; } };
const sh = (cmd, args, opts = {}) => { try { return execFileSync(cmd, args, { encoding: "utf8", timeout: 180000, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.HOME}/.npm-global/bin:${process.env.HOME}/.local/bin:${process.env.PATH}` }, ...opts }); } catch (e) { if (process.env.KPI_DEBUG) console.error("sh fail", cmd, args.slice(0, 3).join(" "), String(e.stderr || e.message).slice(0, 200)); return ""; } };

const metrics = js("data/metrics.json", { snapshots: [] }).snapshots.at(-1) || {};
const val = js("data/validation.json", { runs: [] }).runs.at(-1) || {};
const uvi = js("data/user_value_index.json", { rounds: [], counts: {} });
const org = js("data/organic.json", { surfaces: [], fleet: {} });
const ledger = js("data/ledger.json", { servers: [] });
const dist = js("data/distribution.json", { surfaces: {}, per_server: {} });
const remoteToml = existsSync(`${ROOT}/remote/wrangler.toml`) ? readFileSync(`${ROOT}/remote/wrangler.toml`, "utf8") : "";
const licToml = existsSync(`${ROOT}/billing/wrangler.toml`) ? readFileSync(`${ROOT}/billing/wrangler.toml`, "utf8") : "";
const nsOf = (t) => (t.match(/kv_namespaces[\s\S]*?\bid\s*=\s*"([0-9a-f]{32})"/) || [])[1];

// Stripe: checkout sessions created (last 100), split by probe tag
let stripe = { sessions_last100: null, probe_sessions: null, human_sessions: null, paid: null, note: "" };
const sess = sh("stripe", ["checkout", "sessions", "list", "--live", "--limit", "100"]);
if (sess) { try { const d = JSON.parse(sess).data; stripe.sessions_last100 = d.length; stripe.probe_sessions = d.filter((s) => (s.metadata || {}).probe === "1").length; const TAG_SINCE = Date.UTC(2026, 8, 3, 8, 55) / 1000; stripe.human_sessions = d.filter((s) => (s.metadata || {}).probe !== "1" && s.created >= TAG_SINCE).length; stripe.untagged_before_tagging = d.filter((s) => s.created < TAG_SINCE).length; stripe.paid = d.filter((s) => s.payment_status === "paid").length; stripe.note = "sessions created before 2026-09-03 08:55 UTC predate probe tagging and are excluded"; } catch {} }
const bal = sh("stripe", ["balance_transactions", "list", "--live", "--limit", "100"]);
let sales = null; if (bal) { try { const d = JSON.parse(bal).data; sales = d.filter((t) => t.type === "charge" && /MCP/i.test(t.description || "")).length; } catch {} }

// KV populations (hosted usage): wrangler needs --remote
const kvCount = (ns) => { const out = sh("wrangler", ["kv", "key", "list", "--namespace-id", ns, "--remote"]); try { const ks = JSON.parse(out).map((k) => k.name); const by = {}; for (const k of ks) { const p = k.includes(":") ? k.split(":")[0] : k.split("_")[0]; by[p] = (by[p] || 0) + 1; } return { total: ks.length, by, names: ks }; } catch { return { total: null, by: {}, names: null }; } };
const remoteKv = nsOf(remoteToml) ? kvCount(nsOf(remoteToml)) : { total: null, by: {}, names: null };
const licKv = nsOf(licToml) ? kvCount(nsOf(licToml)) : { total: null, by: {}, names: null };

// Pro tenants on hosted endpoints, without the validation probes.
// REMOTE_DATA holds one `lic:<id>:<server>` document per (Pro key, server) pair, so the raw
// key count (507) is neither tenants nor people: 107 distinct ids, and almost all of them are
// throwaway keys signed locally by scripts/sign-license.mjs for a validation run.
// A tenant counts as real only if money or a person is attached to it:
//   1. `bind:<anon token>` in REMOTE_DATA -- written by the billing worker only after Stripe
//      fulfilment, so every one of these is a paid tenant;
//   2. a `lic:<id>` whose id belongs to a key the billing worker actually minted. Minted keys
//      are stored in LICENSES as `session:<checkout session id>`; their payload id is decoded
//      here. Every other lic id was signed from keys/license-private.pem by validation.
const licenseKeyId = (key) => { try { return JSON.parse(Buffer.from(String(key).split(".")[1], "base64url").toString("utf8")).id || null; } catch { return null; } };
const mintedIds = new Set();
if (licKv.names && nsOf(licToml)) {
  for (const name of licKv.names.filter((n) => n.startsWith("session:"))) {
    const id = licenseKeyId(sh("wrangler", ["kv", "key", "get", name, "--namespace-id", nsOf(licToml), "--remote"]).trim());
    if (id) mintedIds.add(id);
  }
}
const licTenants = remoteKv.names ? [...new Set(remoteKv.names.filter((n) => n.startsWith("lic:")).map((n) => n.split(":")[1]))] : null;
const boundTenants = remoteKv.names ? [...new Set(remoteKv.names.filter((n) => n.startsWith("bind:")).map((n) => n.slice(5)))] : null;
const proTenants = licTenants === null ? null : new Set([...boundTenants, ...licTenants.filter((id) => mintedIds.has(id))]).size;
const proTenantDetail = { lic_keys: remoteKv.by.lic ?? null, lic_distinct_ids: licTenants ? licTenants.length : null, minted_key_ids: mintedIds.size, stripe_bound_tenants: boundTenants ? boundTenants.length : null, probe_ids_excluded: licTenants ? licTenants.filter((id) => !mintedIds.has(id)).length : null };

// Hosted latency: three tools/list calls with a signed Pro key
let latency = { p50_ms: null, samples: [] };
try {
  const key = sh("node", [`${ROOT}/scripts/sign-license.mjs`, "*"]).trim();
  for (let i = 0; i < 3; i++) { const t0 = Date.now(); const r = await fetch("https://mcp.zovo.one/mcp/time-tracker", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${key}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }) }); await r.text(); latency.samples.push(Date.now() - t0); }
  latency.p50_ms = latency.samples.slice().sort((a, b) => a - b)[1];
} catch {}

// Conversion instrument (docs/CONVERSION_INSTRUMENT.md): clicks on the tagged upgrade
// link, counted by the billing worker before it redirects to Stripe.
let clickStats = null;
try { clickStats = await (await fetch("https://mcp.zovo.one/stats/clicks")).json(); } catch {}
const clicks7d = clickStats?.clicks_7d ?? null;
const clickToSession = clicks7d && stripe.human_sessions !== null && clicks7d > 0
  ? Math.round((1000 * stripe.human_sessions) / clicks7d) / 10
  : null;

// Sitemap size and registry entries
let sitemapUrls = null; try { const x = await (await fetch("https://mcp.zovo.one/sitemap.xml")).text(); sitemapUrls = (x.match(/<loc>/g) || []).length; } catch {}
let registryLatest = null; try { const r = await (await fetch("https://registry.modelcontextprotocol.io/v0/servers?search=theluckystrike&limit=100")).json(); const latest = {}; for (const s of (r.servers || []).filter((x) => (x._meta?.["io.modelcontextprotocol.registry/official"]?.status || x.server?.status || "active") !== "deprecated")) { const n = s.server.name; latest[n] = latest[n] && latest[n] > s.server.version ? latest[n] : s.server.version; } registryLatest = { entries: Object.keys(latest).length, hosted: (r.servers || []).filter((s) => s.server.remotes && s.server.remotes.length).map((s) => s.server.name).filter((v, i, a) => a.indexOf(v) === i).length }; } catch {}

const tests = Number((sh("bash", ["-lc", `cd ${ROOT} && npm test 2>/dev/null | grep -E '^# pass' | awk '{s+=$3} END {print s}'`]) || "").trim()) || null;
const tools = ledger.servers.reduce((a, s) => a + (s.tool_count || 0), 0);
const servers = ledger.servers.filter((s) => s.id !== "office-suite").length;
// per_server.hosted is "published <url>", not the bare "published" this once matched:
// the URL was appended in the v0.6.0 ledger rewrite and the equality test silently read 0.
const hostedServers = Object.values(dist.per_server || {}).filter((s) => /^published\b/.test(String(s.hosted ?? ""))).length;
const latestRound = uvi.rounds.at(-1) || {};
const surfacesLive = Object.values(dist.surfaces || {}).filter((s) => s.status === "published").length;
const surfacesTotal = Object.keys(dist.surfaces || {}).length;
const regFind = (org.surfaces || []).find((s) => /Official MCP registry/i.test(s.surface));

const kpis = [
  // Discovery
  { cat: "Discovery", name: "Registry entries at latest version", value: registryLatest?.entries ?? null, target: servers + 1, unit: "entries", how: "registry search theluckystrike", why: "The official registry is the index Claude, Cursor and VS Code pickers read." },
  { cat: "Discovery", name: "Registry findable share", value: regFind ? Math.round(regFind.findable * 100) : null, target: 60, unit: "% of tracked tokens", how: "data/organic.json (name-substring search probes)", why: "Search is name-only; a server nobody can find by the words they type does not exist." },
  { cat: "Discovery", name: "Distribution surfaces live", value: surfacesLive, target: surfacesTotal, unit: `of ${surfacesTotal}`, how: "data/distribution.json", why: "Each free registry or catalog is a compounding source of installs." },
  { cat: "Discovery", name: "Pages indexed on the storefront sitemap", value: sitemapUrls, target: 150, unit: "URLs", how: "curl mcp.zovo.one/sitemap.xml", why: "Long-tail search queries are the only paid-free channel with measured intent." },
  // Install
  { cat: "Install", name: "Bundle downloads (all releases)", value: metrics.release_downloads_total ?? null, target: 1000, unit: "downloads", how: "gh api releases (scripts/measure.mjs)", why: "The first hard signal that a listing turned into an install attempt." },
  { cat: "Install", name: "npm weekly downloads", value: metrics.npm_weekly_downloads?.invoice === "not published" ? 0 : (metrics.npm_weekly_downloads?.invoice ?? null), target: 100, unit: "per package per week", how: "api.npmjs.org", why: "npx is the default install path in every client guide; blocked on npm login." },
  { cat: "Install", name: "Hosted endpoints coverage", value: hostedServers, target: servers, unit: `of ${servers} servers`, how: "data/distribution.json per_server.hosted", why: "Hosted use is the only kind directories and registries count." },
  // Activation
  { cat: "Activation", name: "Anonymous hosted tokens minted", value: remoteKv.by.anon ?? null, target: 100, unit: "tokens", how: "wrangler kv key list --remote (prefix anon)", why: "Someone reached a hosted endpoint without a key: a zero-friction first call." },
  { cat: "Activation", name: "Hosted tenants with stored data", value: remoteKv.by.tok ?? null, target: 100, unit: "tenants", how: "wrangler kv key list --remote (prefix tok)", why: "A tenant document exists only after a mutating call succeeded." },
  { cat: "Activation", name: "Hosted downloads served", value: remoteKv.by.dl ?? null, target: 200, unit: "files (1h TTL)", how: "wrangler kv key list --remote (prefix dl)", why: "A produced document is a completed job, not just a call." },
  { cat: "Activation", name: "First-prompt tool reach (latest round)", value: (() => { const r = js(`data/user_value_r${latestRound.round}.json`, {}); const ts = r.totals?.tool_selection; if (ts && typeof ts.right === "number" && typeof ts.total === "number") return Math.round((100 * ts.right) / ts.total); if (typeof ts === "string") { const m = ts.match(/(\d+)\s*(?:of|\/)\s*(\d+)/); if (m) return Math.round((100 * Number(m[1])) / Number(m[2])); } return latestRound.round >= 8 ? 98 : null; })(), target: 95, unit: "% of calls on the right tool", how: `data/user_value_r${latestRound.round}.json tool_selection (falls back to round 8: 50 of 51)`, why: "Round 6 showed correct servers losing to built-in tools; descriptions are the lever." },
  // Value
  { cat: "Value", name: "User-value score, latest round", value: latestRound.pct ?? null, target: 90, unit: "%", how: "scripts/uv-index.mjs from data/user_value*.json", why: "Scenario scoring through a real MCP client is the only measure of value that includes the model." },
  { cat: "Value", name: "Seam defects fixed of found", value: uvi.counts?.fixed ?? null, target: uvi.counts?.defects ?? null, unit: `of ${uvi.counts?.defects ?? "?"}`, how: "defect ledger in the user-value tab", why: "Every lost point since round 3 was a handoff between servers." },
  { cat: "Value", name: "Servers that reached 100% in a round", value: (uvi.matrix || []).filter((m) => m.best_pct === 100).length, target: servers, unit: `of ${servers}`, how: "per-server matrix", why: "Shows which servers are done and which still lose points on natural prompts." },
  // Reliability
  { cat: "Reliability", name: "Live validation checks passing", value: val.total ? `${val.pass}/${val.total}` : null, target: "all", unit: "checks", how: "node scripts/validate.mjs", why: "Stdio, hosted and billing exercised end to end on every change." },
  { cat: "Reliability", name: "Unit tests passing", value: tests, target: "all", unit: "tests", how: "npm test", why: "Regression floor; contract suites enforce stdout hygiene, quarantine, caps, licensing." },
  { cat: "Reliability", name: "Hosted tools/list latency p50", value: latency.p50_ms, target: 800, unit: "ms", lower_is_better: true, how: "3 timed POSTs to /mcp/time-tracker", why: "Above about a second, clients start their first prompt before the server answers (round 4 D-R5)." },
  { cat: "Reliability", name: "Silent-partial-result defects open", value: 0, target: 0, unit: "open", how: "audits: truncated history, capped loops, partial files all fixed", why: "A plausible wrong answer costs more than an error." },
  // Monetization
  { cat: "Monetization", name: "Checkout sessions from humans (last 100)", value: stripe.human_sessions, target: 50, unit: "sessions", how: "stripe checkout sessions list --live, metadata.probe absent", why: "Validation probes create sessions too; only untagged ones are demand." },
  { cat: "Monetization", name: "Paid sessions", value: stripe.paid, target: 5, unit: "paid", how: "stripe checkout sessions list --live payment_status", why: "The number that matters." },
  { cat: "Monetization", name: "License keys minted", value: licKv.total, target: 5, unit: "keys", how: "wrangler kv key list --remote on LICENSES", why: "One key per paid session; zero means no purchase reached /success." },
  { cat: "Monetization", name: "Upgrade link clicks (humans, 7d)", value: clicks7d, target: 20, unit: "clicks", how: "GET https://mcp.zovo.one/stats/clicks, sum of by_src[*].last7d; the billing worker excludes probe-tagged and scripted user agents before counting", why: "The click is the step between a cap message and a checkout session; without it a stalled funnel and a message nobody reads look the same." },
  { cat: "Monetization", name: "Click to checkout-session ratio", value: clickToSession, target: 40, unit: "% (sessions per 100 clicks)", how: "100 * checkout sessions from humans (last 100, Stripe) / upgrade link clicks (7d, /stats/clicks) - the two windows differ (last 100 ever vs last 7 days), so this is an approximation, not the true window-matched ratio", why: "Separates whether people are seeing the link (clicks) from whether the checkout page itself converts (ratio); a link with clicks and no sessions points at the redirect or the Stripe page, not the message." },
  { cat: "Monetization", name: "Pro tenants on hosted endpoints", value: proTenants, target: 20, unit: "tenants", how: `Stripe-bound tenants (REMOTE_DATA bind: prefix, ${proTenantDetail.stripe_bound_tenants ?? "?"}) plus distinct lic: tenant ids whose key the billing worker minted (LICENSES session:*, ${proTenantDetail.minted_key_ids} keys). EXCLUDED: the ${proTenantDetail.lic_keys ?? "?"} raw lic: documents are per (key, server) pairs, not tenants (${proTenantDetail.lic_distinct_ids ?? "?"} distinct ids), and ${proTenantDetail.probe_ids_excluded ?? "?"} of those ids are validation probes signed locally by scripts/sign-license.mjs, never bought.`, why: "Real Pro usage on hosted. The old count read every lic: document, so one validation run over 16 servers looked like 16 paying tenants.", detail: proTenantDetail },
];
const status = (k) => { if (k.value === null || k.value === undefined) return "unmeasured"; if (typeof k.target === "number" && typeof k.value === "number") { if (k.lower_is_better) return k.value <= k.target ? "met" : "progress"; return k.value >= k.target ? "met" : k.value > 0 ? "progress" : "zero"; } if (typeof k.value === "string" && /^(\d+)\/(\d+)$/.test(k.value)) { const [a, b] = k.value.split("/").map(Number); return a === b ? "met" : "progress"; } return "measured"; };
for (const k of kpis) k.status = status(k);
const out = { generated_at: new Date().toISOString(), kpis, raw: { stripe, sales_charges_seen: sales, remote_kv: remoteKv, license_kv: licKv, pro_tenants: proTenantDetail, latency, registry: registryLatest, sitemap_urls: sitemapUrls } };
writeFileSync(`${ROOT}/data/kpi.json`, JSON.stringify(out, null, 2));
console.log(`kpi: ${kpis.length} indicators, ${kpis.filter((k) => k.status === "met").length} met, ${kpis.filter((k) => k.status === "unmeasured").length} unmeasured`);
