#!/usr/bin/env python3
"""Build /Users/mike/mcp-servers/index.html from data/*.json.

Bakes KPI, distribution, registry-publish, organic and GSC JSON into a
static HTML file (inline CSS + vanilla JS). Rerun after each session:
    python3 scripts/build_dashboard.py
"""
import json, os, html
from collections import Counter
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")

def load(name):
    with open(os.path.join(DATA, name)) as f:
        return json.load(f)

kpi = load("kpi.json")
dist = load("distribution.json")
reg = load("registry_publish.json")
org = load("organic.json")
gsc = load("gsc.json")

kpis = kpi["kpis"]
by_cat = {}
for k in kpis:
    by_cat.setdefault(k["cat"], []).append(k)
CATS = ["Discovery", "Install", "Activation", "Value", "Reliability", "Monetization"]

def find(name):
    for k in kpis:
        if k["name"] == name:
            return k
    raise KeyError(name)

# Funnel: storefront requests -> anon tokens -> hosted tenants -> checkout sessions -> paid
funnel = [
    ("Storefront requests (7d, assets included)", find("Human requests, storefront (assets included)")["value"]),
    ("Anonymous hosted tokens minted", find("Anonymous hosted tokens minted")["value"]),
    ("Hosted tenants with stored data", find("Hosted tenants with stored data")["value"]),
    ("Checkout sessions from humans (last 100)", find("Checkout sessions from humans (last 100)")["value"]),
    ("Paid sessions", find("Paid sessions")["value"]),
]
stripe = kpi.get("raw", {}).get("stripe", {})
funnel_note = stripe.get("note", "")

surfaces = dist["surfaces"]
def bucket(status):
    s = status.lower()
    if s.startswith("published") or s.startswith("live"):
        return "live/published"
    if s.startswith("submitted") or s.startswith("pr-open") or "pending" in s or s.startswith("pr "):
        return "submitted/PR open"
    if s.startswith("blocked"):
        return "blocked"
    if s.startswith("dead") or s.startswith("closed"):
        return "dead/closed"
    if s.startswith("skipped") or s.startswith("not applicable"):
        return "skipped/n.a."
    return "identified/other"
counts = Counter(bucket(v.get("status", "unknown")) for v in surfaces.values())

payload = {
    "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
    "kpi_generated": kpi["generated_at"],
    "kpis": kpis,
    "cats": CATS,
    "funnel": funnel,
    "funnel_note": funnel_note,
    "surface_counts": dict(counts),
    "surfaces": {n: {"status": v.get("status", "unknown"), "note": v.get("note", v.get("detail", ""))[:300]} for n, v in surfaces.items()},
    "registry": {"at": reg["at"], "published": len(reg.get("published", [])), "duplicate": len(reg.get("duplicate", [])), "other": {k: len(v) for k, v in reg.items() if isinstance(v, list) and k not in ("published", "duplicate")}},
    "organic": {"updated_at": org.get("updated_at"), "model": org.get("model", "")[:400], "keys": list(org.keys())},
    "gsc": {"window": gsc.get("window"), "totals": gsc.get("totals"), "host_probe_clicks": gsc.get("host_probe", {}).get("clicks"), "host_probe_impressions": gsc.get("host_probe", {}).get("impressions")},
    "session": {
        "date": "2026-10-12",
        "title": "Session 2026-10-12 — 5-agent sprint: sitemap, paid-gap, outreach, surfaces, llms.txt",
        "items": [
            "SITEMAP FIXED + DEPLOYED (5b09cf92, worker 62793d4d): sitemap.xml now offers 47 /mcp/ landing URLs (was 1) out of 287 total; IndexNow submitted. Per-server hosted landing pages are finally offered to crawlers.",
            "PAID-GAP RESOLVED — was misdiagnosis, not defect (intel/s20261012-paid-gap.md): 77 of 97 'checkout sessions' were other storefronts' (shared Stripe account); real mcp.zovo.one sessions ~17-20, ALL expired unpaid. Worker fulfillment verified correct (webhook + /success mints Ed25519 license server-side). Conclusion: no buyers yet — traffic + conversion is the lever, not the funnel plumbing. kpi.mjs fixed to scope human_sessions to the storefront (97→17).",
            "llms.txt UPGRADED (a26eeed8, worker 82f5517b): all 54 servers now have task-oriented 'Use when' phrasing — the exact failure mode from blind-recommendation R1-R7 (0/18). robots.txt verified open to all 7 AI crawlers. 167/168 tests pass (1 pre-existing).",
            "Outreach send engine SHIPPED: scripts/outreach_send.mjs (dry-run verified, rate-limited 10/run + 3s gaps, outbox.json audit log) + data/outreach_targets.json: 18 targets from R1-R4 drafts, all channel:manual (GitHub/Reddit/dev.to comment threads, no public emails). Resend: zovo.one verified, live send works.",
            "Surfaces sweep: distribution.json reclassified after live probes (R-s20261012): 22 live / 14 submitted-pending / 11 blocked / 7 dead / 7 n-a / 13 other. Wins: mcpHQ PR #72 MERGED, habitoai MERGED, Glama auto-indexing, allmcps.com links us directly. 3 stale PRs bumped (DhanushNehru #95, ever-works #181, rohitg00 #338).",
            "Next big unlock: ONE $1 live test purchase to prove end-to-end license delivery, then all effort on traffic. Email-based outreach needs real email targets (directory contacts / buyer replies) — engine is ready.",
        ],
        "next_levers": [
            "1. $1 live Stripe test purchase → verify license key arrives → clears the last unproven link in the monetization chain.",
            "2. Traffic: ClaudeBot coverage was 34/237 — after sitemap fix, re-measure crawler coverage in 7d; submit landing URLs to GSC.",
            "3. Registry at latest version still 0/149 — release-version drift; republish at current release.",
            "4. Email outreach: source real email targets (curators, directory contacts) → outreach_send.mjs --live is ready.",
        ],
    },
}

TEMPLATE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MCP Estate — Main Dashboard</title>
<style>
:root{color-scheme:light dark;--bg:#fcfcfb;--panel:#fff;--line:#e5e4df;--tx:#0b0b0b;--tx2:#52514e;--tx3:#82817b;--acc:#2a78d6;--good:#1baf7a;--warn:#c98500;--bad:#e34948}
@media(prefers-color-scheme:dark){:root{--bg:#151514;--panel:#1a1a19;--line:#333330;--tx:#fff;--tx2:#c3c2b7;--tx3:#8d8c83;--acc:#3987e5;--good:#199e70}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:14px/1.55 -apple-system,Segoe UI,Inter,Helvetica,Arial,sans-serif;font-variant-numeric:tabular-nums}
.wrap{max-width:1100px;margin:0 auto;padding:36px 24px 80px}
h1{font-size:26px;margin:0 0 4px}.sub{color:var(--tx3);font-size:12.5px;margin-bottom:20px}
h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--tx3);margin:32px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:10.5px;text-transform:uppercase;color:var(--tx3);padding:8px 10px;border-bottom:1px solid var(--line)}
td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.num{text-align:right;font-family:ui-monospace,Menlo,monospace}
.st{font-size:10.5px;font-weight:700;padding:1px 8px;border-radius:9px;white-space:nowrap}
.st.met{color:#fff;background:var(--good)}.st.zero{color:#fff;background:var(--bad)}.st.progress{color:#fff;background:var(--warn)}.st.measured{color:var(--tx2);border:1px solid var(--line)}
.funnel{display:flex;gap:8px;flex-wrap:wrap}.fstep{flex:1 1 150px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px;text-align:center}
.fstep .n{font-size:22px;font-weight:700}.fstep .k{font-size:11px;color:var(--tx3);margin-top:4px}.fstep.zero .n{color:var(--bad)}
.arrow{text-align:center;color:var(--tx3);align-self:center;font-size:18px}
.pill{display:inline-block;font-size:10.5px;padding:1px 7px;border-radius:4px;border:1px solid var(--line);margin:2px 3px 2px 0;color:var(--tx2)}
details summary{cursor:pointer;color:var(--acc);font-size:12.5px;margin:6px 0}
.dim{color:var(--tx3);font-size:12px}.mono{font-family:ui-monospace,Menlo,monospace;font-size:12px}
ol,ul{margin:4px 0;padding-left:20px}li{margin-bottom:6px}
</style></head><body><div class="wrap">
<h1>MCP Estate — Main Dashboard</h1>
<div class="sub">theluckystrike &middot; built __GENERATED__ from KPI data of __KPIGEN__ &middot; regenerate with <code>python3 scripts/build_dashboard.py</code></div>

<h2>Monetization funnel</h2>
<div class="card"><div class="funnel" id="funnel"></div><div class="dim" id="funnel-note" style="margin-top:10px"></div></div>

<h2>Session log — 2026-10-12</h2>
<div class="card" id="session-log"></div>

<h2>Top levers — next session</h2>
<div class="card" id="levers"></div>

<h2>KPIs by category (32)</h2>
<div id="kpi-tables"></div>

<h2>Distribution surfaces (74)</h2>
<div class="card"><div id="surf-counts"></div><details><summary>Show all surfaces</summary><div id="surf-list"></div></details></div>

<h2>Registry &amp; organic &amp; search</h2>
<div class="card" id="misc"></div>

<div class="card dim">Data sources: data/kpi.json, data/distribution.json, data/registry_publish.json, data/organic.json, data/gsc.json. Status colors: green = met, amber = progress, red = zero, grey = measured (no target).</div>
</div>
<script>
const D = __DATA__;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = v => (v === null || v === undefined) ? '—' : (typeof v === 'number' ? v.toLocaleString('en-US') : v);

// Funnel
const f = document.getElementById('funnel');
D.funnel.forEach(([label, n], i) => {
  if (i) { const a = document.createElement('div'); a.className = 'arrow'; a.textContent = '→'; f.appendChild(a); }
  const d = document.createElement('div'); d.className = 'fstep' + (n === 0 ? ' zero' : '');
  d.innerHTML = '<div class="n">' + fmt(n) + '</div><div class="k">' + esc(label) + '</div>';
  f.appendChild(d);
});
document.getElementById('funnel-note').innerHTML = '<b>Drop-off:</b> requests ' + fmt(D.funnel[0][1]) + ' → tokens ' + fmt(D.funnel[1][1]) + ' → tenants ' + fmt(D.funnel[2][1]) + ' → checkout sessions ' + fmt(D.funnel[3][1]) + ' → paid <b>' + fmt(D.funnel[4][1]) + '</b>. ' + esc(D.funnel_note || '');

// Session log
document.getElementById('session-log').innerHTML = '<b>' + esc(D.session.title) + '</b><ul>' +
  D.session.items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>';
document.getElementById('levers').innerHTML = '<ol>' + D.session.next_levers.map(i => '<li>' + esc(i.replace(/^\\d+\\.\\s*/, '')) + '</li>').join('') + '</ol>';

// KPI tables
const kt = document.getElementById('kpi-tables');
D.cats.forEach(cat => {
  const rows = D.kpis.filter(k => k.cat === cat);
  if (!rows.length) return;
  const met = rows.filter(k => k.status === 'met').length;
  kt.insertAdjacentHTML('beforeend', '<h2 style="margin-top:22px">' + esc(cat) + ' — ' + met + '/' + rows.length + ' met</h2>' +
    '<div class="card" style="padding:0;overflow-x:auto"><table><tr><th>KPI</th><th>Value</th><th>Target</th><th>Status</th><th>How measured</th></tr>' +
    rows.map(k => '<tr><td><b>' + esc(k.name) + '</b><br><span class="dim">' + esc(k.unit || '') + '</span></td>' +
      '<td class="num">' + fmt(k.value) + '</td><td class="num">' + fmt(k.target) + '</td>' +
      '<td><span class="st ' + esc(k.status) + '">' + esc(k.status) + '</span></td>' +
      '<td class="dim" style="max-width:340px">' + esc((k.how || '').slice(0, 220)) + '</td></tr>').join('') +
    '</table></div>');
});

// Surfaces
const sc = D.surface_counts;
document.getElementById('surf-counts').innerHTML = Object.entries(sc).sort((a,b)=>b[1]-a[1]).map(([k,v]) => '<span class="pill">' + esc(k) + ': <b>' + v + '</b></span>').join('');
document.getElementById('surf-list').innerHTML = '<div class="card" style="padding:0;overflow-x:auto"><table><tr><th>Surface</th><th>Status</th><th>Note</th></tr>' +
  Object.entries(D.surfaces).map(([n, s]) => '<tr><td class="mono">' + esc(n) + '</td><td>' + esc(s.status) + '</td><td class="dim">' + esc(s.note) + '</td></tr>').join('') + '</table></div>';

// Misc
const r = D.registry, g = D.gsc, o = D.organic;
document.getElementById('misc').innerHTML =
  '<b>Registry publish run</b> (' + esc(r.at.slice(0, 10)) + '): published ' + r.published + ', duplicate (already at version) ' + r.duplicate + '.<br>' +
  '<b>GSC</b> sc-domain:zovo.one, window ' + esc(g.window ? g.window.start + ' → ' + g.window.end : 'n/a') + ': ' + fmt(g.totals ? g.totals.clicks : '—') + ' clicks / ' + fmt(g.totals ? g.totals.impressions : '—') + ' impressions; storefront host probe: ' + fmt(g.host_probe_clicks) + ' clicks / ' + fmt(g.host_probe_impressions) + ' impressions.<br>' +
  '<b>Organic</b> (updated ' + esc(o.updated_at || 'n/a') + '): model — <span class="dim">' + esc(o.model.slice(0, 260)) + '</span>…';
</script></body></html>
"""

out = TEMPLATE.replace("__GENERATED__", payload["generated"]) \
              .replace("__KPIGEN__", payload["kpi_generated"][:10]) \
              .replace("__DATA__", json.dumps(payload))
with open(os.path.join(ROOT, "index.html"), "w") as f:
    f.write(out)
print(f"Wrote index.html ({len(out)} bytes); {len(kpis)} KPIs, {len(surfaces)} surfaces baked in.")
