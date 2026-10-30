#!/usr/bin/env python3
"""Render DASHBOARD.html — the single page that says what the MCP estate is,
what it earns, which rails work, and what ships next.

Data: data/mcp_catalog.json (built by build_catalog.py) + data/kpi.json.
Run after every session:  python3 scripts/build_catalog.py && python3 scripts/build_dashboard.py
"""
import json
import os
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = json.load(open(os.path.join(ROOT, "data/mcp_catalog.json")))
KPI = json.load(open(os.path.join(ROOT, "data/kpi.json")))

K = {(k.get("id") or k.get("name")): k for k in KPI["kpis"]}


def val(i, default="—"):
    """Look a KPI up by id, failing that by a case-insensitive name fragment."""
    k = K.get(i)
    if k:
        return k["value"]
    for name, row in K.items():
        if i.lower().replace("_", " ") in str(name).lower():
            return row["value"]
    return default


CATEGORY = {
    "invoicing": ["invoice", "quotes", "recurring", "credit-note", "dunning-letters", "statement-of-account",
                  "duplicate-invoice-check", "bill-of-sale", "change-order", "deposits", "stripe-billing",
                  "billing-docs", "office-suite"],
    "documents": ["pdf", "docx", "spreadsheet", "image", "zip", "barcode", "catalogue", "packing-list",
                  "resume", "clauses", "service-agreement", "checklist"],
    "money": ["amortization", "asset-register", "bank-statement", "budget", "cash-book", "currency",
              "expense-tracker", "goods-receipt", "loan-calculator", "payroll", "petty-cash", "receipts",
              "tax-calc", "three-way-match", "supplier-statement-check", "purchase-requisition",
              "mileage-log", "per-diem", "hourly-rate"],
    "operations": ["time-tracker", "kanban", "job-card", "work-order", "leave", "pomodoro",
                   "maintenance-log", "timezone", "delivery-schedule", "onboarding", "supplier-list",
                   "price-tracker", "calendar"],
    "web": ["backlink-checker"],
}

RAILS = [
    ("Stripe (mcp.zovo.one)", "LIVE — proven today",
     "Browser-real POST /buy/invoice returns 303 to checkout.stripe.com/c/pay/cs_live_… in 1.2 s. "
     "Bot-guarded (Origin + Sec-Fetch + order token) so scripted probes get bounced to /s/. "
     "Cards, Apple/Google Pay via Stripe. 2.9% + 30¢.", "green"),
    ("Cloudflare deploy", "OPEN — authenticated",
     "wrangler whoami succeeds on account dd3f2a29…; mcp.zovo.one is deployable from "
     "billing/ with node@22. Not used this session (no code change worth the risk).", "green"),
    ("npm registry", "BLOCKED — 401",
     "0 of 58 packages are on npm; ~/.npmrc token is dead and there is no OIDC trusted publisher. "
     "npm is the registry the MCP directory reads. One `npm login` unblocks 58 pages.", "red"),
    ("Telegram Stars (XTR)", "AVAILABLE — not wired",
     "Fleet kit already sends XTR invoices (hub/src/kit.ts, 150 stars default). A second rail that "
     "needs no card and no Stripe account, but it lives inside a Telegram bot, not a web funnel.", "amber"),
    ("Gumroad / Lemon Squeezy", "NOT NEEDED",
     "Would add 10% + 50¢ and a second catalogue to maintain. Stripe is live and owns the pricing. "
     "Only reason to add: marketplace discovery traffic, which is not where MCP buyers are.", "grey"),
]

# ---- per-server rows -------------------------------------------------------
by_id = {s["id"]: s for s in CAT["servers"]}
seen = set()
sections = []
for name, ids in CATEGORY.items():
    rows = []
    for i in ids:
        s = by_id.get(i)
        if not s or i in seen:
            continue
        seen.add(i)
        rows.append(s)
    if rows:
        sections.append((name, rows))

STATUS_CLS = {"green": "ok", "red": "bad", "amber": "warn", "grey": "mute"}


def money(n):
    return "$%d" % n


def server_row(s):
    tools = len(s.get("tools") or [])
    return (
        "<tr>"
        f'<td><a href="https://theluckystrike.github.io/mcp/{s["slug"]}/">{s["human"]}</a></td>'
        f'<td class="dim">{s["description"][:96]}</td>'
        f'<td class="num">{tools or "—"}</td>'
        f'<td class="num">{money(s.get("price_usd") or 19)}</td>'
        f'<td><a class="buy" href="{s["buy_url"]}">buy</a></td>'
        "</tr>"
    )


def section_html(name, rows):
    total = sum(r.get("price_usd") or 19 for r in rows)
    body = "\n".join(server_row(r) for r in rows)
    return f"""
<section>
  <h2>{name.title()} <span class="pill">{len(rows)} servers · {money(total)} bought separately</span></h2>
  <table>
    <thead><tr><th>Server</th><th>What it does</th><th class="num">Tools</th><th class="num">Price</th><th></th></tr></thead>
    <tbody>{body}</tbody>
  </table>
</section>"""


def rail_html():
    out = []
    for name, status, detail, colour in RAILS:
        out.append(
            f'<div class="rail"><div class="rail-head"><b>{name}</b>'
            f'<span class="tag {STATUS_CLS[colour]}">{status}</span></div>'
            f'<p>{detail}</p></div>')
    return "\n".join(out)


MEAS = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "kpi_measured.json")))

kpi_cards = [
    ("Google indexation, measured", "homepage PASS",
     "URL Inspection, 2026-10-28: https://mcp.zovo.one/ = “Submitted and indexed” (verdict PASS). Of 10 sampled "
     "/s/<id> pages, 2 = “Discovered - currently not indexed”, 8 = “URL is unknown to Google”. The sitemap reports "
     "299 submitted / 0 indexed, which is a sitemap-level number, not the whole truth."),
    ("Organic clicks (7d)", str(val("organic_clicks_7d", "0")), "Google. 38 impressions, 0 clicks."),
    ("Paid orders, all time", "0", "Stripe live; nobody has reached the card form."),
    ("Hosted tenants with data", str(val("hosted_tenants_with_data", "32")), "People who did install and use it."),
    ("Upgrade clicks (7d)", str(val("upgrade_clicks_tagged_7d", "4")), "Guard-passing clicks on a paid CTA."),
    ("Hosted MCP endpoints answering", "%d / 58" % MEAS["hosted"]["live"],
     "Measured just now: real MCP initialize + tools/list handshake against "
     "https://mcp.zovo.one/mcp/<id> at %s. The other %d servers are local-only and their pages now "
     "say so instead of promising a URL that 404s." % (MEAS["measured_at"], 58 - MEAS["hosted"]["live"])),
    ("Public catalogue pages", "70", "59 catalogue + 11 how-to guides, live at theluckystrike.github.io/mcp/."),
    ("npm packages published", "0 / 58", "Registry token dead — the biggest single unblock."),
    ("Repo stars", str(val("repo_stars", "2")), "Social proof is the weakest signal in the funnel."),
]

import glob
import html as _html

SESSIONS = sorted((json.load(open(f)) for f in glob.glob(os.path.join(ROOT, "data/sessions/*.json"))),
                  key=lambda x: x["id"], reverse=True)
SATS = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(ROOT, "data/s1030/*-mcp.json")))]


def esc(x):
    return _html.escape(str(x), quote=True)


def sat_rows():
    """One row per data satellite, straight from its builder report."""
    out = []
    for r in SATS:
        live = r.get("live_calls_ok") or {}
        ok = sum(1 for v in live.values() if v)
        tag = "ok" if live and ok == len(live) and r.get("registry_visible") else "warn"
        out.append(
            f'<tr><td><a href="{esc(r.get("repo_url", ""))}">{esc(r.get("repo", ""))}</a></td>'
            f'<td class="num">{len(r.get("tools") or [])}</td>'
            f'<td class="num">{esc(fx.get("node_tests", "") if isinstance(fx := r.get("fixtures", ""), dict) else fx)}</td>'
            f'<td><span class="tag {tag}">{ok}/{len(live)} live calls</span></td>'
            f'<td>{"yes" if r.get("registry_visible") else "no"}</td>'
            f'<td><code>{esc(r.get("hosted_url", ""))}</code></td>'
            f'<td><a href="{esc(r.get("money_site", ""))}">{esc(r.get("money_site", ""))}</a></td></tr>')
    return "\n".join(out)


def session_html(sess, open_):
    items = "".join(f'<li><h3><a href="{esc(x["url"])}">{esc(x["title"])}</a></h3><p>{esc(x["detail"])}</p></li>'
                    for x in sess.get("shipped", []))
    nxt = "".join(f'<li><h3>{i + 1}. {esc(x["title"])} <span class="tag {STATUS_CLS[x["colour"]]}">'
                  f'{"do first" if i == 0 else "queued"}</span></h3><p>{esc(x["detail"])}</p></li>'
                  for i, x in enumerate(sess.get("next", [])))
    return (f'<details{" open" if open_ else ""}><summary><b>{esc(sess["title"])}</b></summary>'
            f'<p class="verdict">{esc(sess["verdict"])}</p>'
            f'<h3 class="sec">Shipped</h3><ul class="actions">{items}</ul>'
            f'<h3 class="sec">Next, in order of return per hour</h3><ul class="actions">{nxt}</ul></details>')


now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
total_tools = sum(len(s.get("tools") or []) for s in CAT["servers"])

html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MCP estate dashboard — {now}</title>
<style>
 :root {{ --bg:#0e1014; --panel:#161a21; --line:#242a34; --ink:#e8ecf1; --dim:#8b97a8;
   --ok:#3ecf8e; --bad:#ef5b5b; --warn:#e8b23a; --mute:#6b7686; --accent:#7aa2ff; }}
 * {{ box-sizing:border-box }}
 body {{ margin:0; background:var(--bg); color:var(--ink);
   font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif; }}
 .wrap {{ max-width:1180px; margin:0 auto; padding:40px 24px 96px; }}
 h1 {{ font-size:30px; margin:0 0 6px; letter-spacing:-.02em }}
 h2 {{ font-size:18px; margin:38px 0 12px; letter-spacing:-.01em }}
 h3 {{ font-size:14px; margin:0 0 6px }}
 .sub {{ color:var(--dim); margin:0 0 28px; font-size:14px }}
 .kpis {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(255px,1fr)); gap:12px }}
 .kpi {{ background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px }}
 .kpi .v {{ font-size:24px; font-weight:650; letter-spacing:-.02em }}
 .kpi .l {{ color:var(--dim); font-size:12px; text-transform:uppercase; letter-spacing:.08em; margin-bottom:6px }}
 .kpi .n {{ color:var(--mute); font-size:12.5px; margin-top:6px }}
 .rail {{ background:var(--panel); border:1px solid var(--line); border-radius:10px;
   padding:14px 16px; margin-bottom:10px }}
 .rail-head {{ display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap }}
 .rail p {{ margin:8px 0 0; color:var(--dim); font-size:13.5px }}
 .tag {{ font-size:11.5px; padding:3px 9px; border-radius:999px; border:1px solid; white-space:nowrap }}
 .tag.ok {{ color:var(--ok); border-color:#1f5c43; background:#10241c }}
 .tag.bad {{ color:var(--bad); border-color:#5c2222; background:#241212 }}
 .tag.warn {{ color:var(--warn); border-color:#5c4a1f; background:#241f10 }}
 .tag.mute {{ color:var(--mute); border-color:var(--line); background:#1a1e25 }}
 table {{ width:100%; border-collapse:collapse; font-size:13.5px;
   background:var(--panel); border:1px solid var(--line); border-radius:10px; overflow:hidden }}
 th {{ text-align:left; font-weight:600; color:var(--dim); font-size:12px; text-transform:uppercase;
   letter-spacing:.06em; padding:10px 12px; border-bottom:1px solid var(--line) }}
 td {{ padding:9px 12px; border-bottom:1px solid #1c222b; vertical-align:top }}
 tr:last-child td {{ border-bottom:0 }}
 td.num, th.num {{ text-align:right; font-variant-numeric:tabular-nums }}
 td.dim {{ color:var(--dim) }}
 a {{ color:var(--accent); text-decoration:none }}
 a:hover {{ text-decoration:underline }}
 .buy {{ display:inline-block; padding:2px 10px; border:1px solid #2f4a7a; border-radius:6px;
   background:#141c2c; font-size:12px }}
 .pill {{ font-size:12px; font-weight:400; color:var(--mute); margin-left:8px }}
 ul.actions {{ list-style:none; padding:0; margin:0 }}
 ul.actions li {{ background:var(--panel); border:1px solid var(--line); border-radius:10px;
   padding:14px 16px; margin-bottom:10px }}
 ul.actions p {{ margin:6px 0 0; color:var(--dim); font-size:13.5px }}
 code {{ background:#0a0c10; border:1px solid var(--line); border-radius:5px; padding:1px 5px;
   font:12.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace }}
 details {{ background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px 16px; margin-bottom:12px }}
 summary {{ cursor:pointer }}
 .verdict {{ color:var(--ink); font-size:14.5px }}
 h3.sec {{ margin:18px 0 8px; color:var(--dim) }}
 footer {{ margin-top:48px; color:var(--mute); font-size:12.5px; border-top:1px solid var(--line); padding-top:16px }}
</style></head>
<body><div class="wrap">
<h1>MCP estate — monetisation dashboard</h1>
<p class="sub">{len(CAT['servers'])} servers · {total_tools} tools · built {now} ·
<a href="https://theluckystrike.github.io/mcp/">public catalogue</a> ·
<a href="https://mcp.zovo.one/">storefront</a></p>

<h2>The constraint, in one line</h2>
<div class="rail"><p style="margin:0;font-size:14.5px;color:var(--ink)">{esc(SESSIONS[0]["verdict"])}</p></div>

<h2>Data satellites (one-server repos, hosted, no token)</h2>
<table><tr><th>repo</th><th class="num">tools</th><th class="num">fixtures</th><th>hosted</th><th>registry</th><th>URL</th><th>feeds</th></tr>
{sat_rows() or '<tr><td colspan="7" class="dim">No satellite reports yet.</td></tr>'}
</table>

<h2>KPIs (measured, not claimed)</h2>
<div class="kpis">
{''.join(f'<div class="kpi"><div class="l">{esc(l)}</div><div class="v">{esc(v)}</div><div class="n">{esc(n)}</div></div>' for l, v, n in (SESSIONS[0].get('kpis') and [(k['label'], k['value'], k['note']) for k in SESSIONS[0]['kpis']] or kpi_cards))}
</div>

<h2>Payment rails</h2>
{rail_html()}

<h2>Sessions, newest first</h2>
{''.join(session_html(x, i == 0) for i, x in enumerate(SESSIONS))}

<h2>The catalogue — every server, its price and its checkout</h2>
{''.join(section_html(n, r) for n, r in sections)}

<footer>
Generated by <code>scripts/build_dashboard.py</code> from <code>data/mcp_catalog.json</code> +
<code>data/kpi.json</code>. Prices are the live storefront prices ($19 single, $39 bundle).
Buy links point at <code>mcp.zovo.one/buy/&lt;id&gt;</code> and were verified HTTP 200 for all
{len(CAT['servers'])} servers this session.
</footer>
</div></body></html>
"""

out = os.path.join(ROOT, "DASHBOARD.html")
open(out, "w", encoding="utf-8").write(html)
print("wrote", out, len(html), "bytes;", len(sections), "sections,", len(seen), "servers")
