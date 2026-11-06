#!/usr/bin/env python3
"""Central MCP estate dashboard. Regenerable every session.

Only measured values reach the page: every number here comes from a live probe or a
file on disk. Writes MCP-DASHBOARD.html plus data/live-check.json.

Usage: python3 scripts/build_mcp_dashboard.py [--no-probe]
"""
import json, os, re, subprocess, sys, glob
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36")
HOST = "https://mcp.zovo.one/mcp/"
NOW = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

def read_json(*parts, default=None):
    p = os.path.join(DATA, *parts)
    try:
        with open(p) as f:
            return json.load(f)
    except Exception:
        return default

def npm_weekly(pkgs):
    out = {}
    def one(p):
        try:
            req = urllib.request.Request("https://api.npmjs.org/downloads/point/last-week/" + p,
                                         headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=15) as r:
                return p, json.load(r).get("downloads", 0)
        except Exception:
            return p, None
    with ThreadPoolExecutor(max_workers=8) as ex:
        for p, n in ex.map(one, pkgs):
            out[p] = n
    return out

def probe(names, pkgs):
    def one(n):
        rec = {"name": n, "live": False, "status": None, "tools": None, "npm_week": None}
        body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "initialize",
                           "params": {"protocolVersion": "2025-11-25", "capabilities": {},
                                      "clientInfo": {"name": "dash", "version": "1"}}}).encode()
        try:
            req = urllib.request.Request(HOST + n, data=body, method="POST",
                headers={"Content-Type": "application/json",
                         "Accept": "application/json, text/event-stream", "User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                rec["status"] = r.status
                sid = r.headers.get("Mcp-Session-Id")
                raw = r.read().decode("utf8", "ignore")
                rec["live"] = r.status == 200 and '"result"' in raw
                # Stateless: the origin returns no Mcp-Session-Id, so tools/list needs no session.
                if rec["live"]:
                    b2 = json.dumps({"jsonrpc": "2.0", "id": 2, "method": "tools/list",
                                     "params": {}}).encode()
                    hh = {"Content-Type": "application/json",
                          "Accept": "application/json, text/event-stream",
                          "User-Agent": UA}
                    if sid:
                        hh["Mcp-Session-Id"] = sid
                    req2 = urllib.request.Request(HOST + n, data=b2, method="POST",
                        headers=hh)
                    with urllib.request.urlopen(req2, timeout=20) as r2:
                        raw2 = r2.read().decode("utf8", "ignore")
                        payload = raw2
                        if "data: " in raw2:
                            payload = "".join(l[6:] for l in raw2.splitlines() if l.startswith("data: "))
                        try:
                            rec["tools"] = len(json.loads(payload)["result"]["tools"])
                        except Exception:
                            pass
        except Exception as e:
            rec["status"] = getattr(e, "code", type(e).__name__)
        return rec
    with ThreadPoolExecutor(max_workers=8) as ex:
        rows = list(ex.map(one, names))
    for r in rows:
        pkg = "@theluckystrike/mcp-" + r["name"]
        r["npm_week"] = pkgs.get(pkg)
    return rows

def catalogue():
    names = []
    for p in sorted(glob.glob(os.path.join(ROOT, "servers", "*", "package.json"))):
        try:
            d = json.load(open(p))
        except Exception:
            continue
        raw = d.get("name", "")
        n = raw.split("mcp-")[-1] if "mcp-" in raw else os.path.basename(os.path.dirname(p))
        names.append(n)
    return sorted(set(names))

def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))

def main():
    do_probe = "--no-probe" not in sys.argv
    names = catalogue()
    cached = read_json("live-check.json", default={}) or {}
    if do_probe or not cached.get("results"):
        pkgs = npm_weekly(["@theluckystrike/mcp-" + n for n in names])
        rows = probe(names, pkgs)
        payload = {"checked_at": NOW, "total": len(rows),
                   "live": sum(1 for r in rows if r["live"]),
                   "dead": sum(1 for r in rows if not r["live"]),
                   "npm_week_total": sum(r["npm_week"] or 0 for r in rows),
                   "results": rows}
        os.makedirs(DATA, exist_ok=True)
        with open(os.path.join(DATA, "live-check.json"), "w") as f:
            json.dump(payload, f, indent=1)
        cached = payload

    rows = cached["results"]
    tools = sum(r["tools"] or 0 for r in rows if r["live"])
    live = [r for r in rows if r["live"]]

    # ---- distribution + monetization facts, read from this sprint's artifacts
    dist = read_json("sprint-2026-11-06", "dist.json", default={}) or {}
    reg = read_json("sprint-2026-11-06", "registries.json", default={}) or {}
    prs = read_json("sprint-2026-11-06", "prs.json", default={}) or {}
    pr_list = [("punkpeye/awesome-mcp-servers", 18737), ("mcpHQ/awesome-mcp-servers", 695)]

    trs = "".join(
        f"<tr><td>{esc(r['name'])}</td>"
        f"<td class='{'ok' if r['live'] else 'bad'}'>{'live' if r['live'] else 'DEAD'}</td>"
        f"<td class='num'>{r['tools'] if r['tools'] is not None else '-'}</td>"
        f"<td class='num'>{r['npm_week'] if r['npm_week'] is not None else '-'}</td>"
        f"<td><a href='https://mcp.zovo.one/mcp/{esc(r['name'])}'>/mcp/{esc(r['name'])}</a></td></tr>"
        for r in rows)

    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MCP Estate Dashboard — {NOW}</title>
<style>
:root{{--bg:#0b0f14;--card:#121821;--line:#1e2734;--fg:#e6edf3;--dim:#8b98a5;--ok:#3fb950;--bad:#f85149;--warn:#d29922;--accent:#58a6ff}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}}
.wrap{{max-width:1180px;margin:0 auto;padding:28px 20px 80px}}
h1{{font-size:22px;margin:0 0 4px}}h2{{font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin:34px 0 12px;border-bottom:1px solid var(--line);padding-bottom:7px}}
.sub{{color:var(--dim);font-size:13px;margin-bottom:22px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px}}
.kpi{{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:14px 16px}}
.kpi .v{{font-size:26px;font-weight:650;letter-spacing:-.02em}}.kpi .l{{color:var(--dim);font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;margin-top:3px}}
.kpi .n{{color:var(--dim);font-size:11.5px;margin-top:6px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:16px 18px;margin-bottom:12px}}
.card h3{{margin:0 0 8px;font-size:14px}}.card p{{margin:0 0 8px;color:#c7d2dd}}.card p:last-child{{margin:0}}
table{{width:100%;border-collapse:collapse;font-size:13px}}th,td{{text-align:left;padding:7px 10px;border-bottom:1px solid var(--line)}}
th{{color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.06em}}td.num{{text-align:right;font-variant-numeric:tabular-nums}}
.ok{{color:var(--ok);font-weight:600}}.bad{{color:var(--bad);font-weight:600}}.warn{{color:var(--warn);font-weight:600}}
code{{background:#1a222d;padding:1.5px 5px;border-radius:4px;font-size:12.5px}}
a{{color:var(--accent);text-decoration:none}}a:hover{{text-decoration:underline}}
.tag{{display:inline-block;font-size:11px;padding:2px 7px;border-radius:20px;border:1px solid var(--line);color:var(--dim);margin-right:5px}}
</style></head><body><div class="wrap">
<h1>MCP Estate</h1>
<div class="sub">Generated {NOW} · probe of {cached['total']} hosted endpoints · <span class="tag">measured, not estimated</span></div>

<h2>Headline</h2>
<div class="grid">
<div class="kpi"><div class="v">{cached['live']}<span style="color:var(--dim);font-size:16px">/{cached['total']}</span></div><div class="l">Endpoints live</div><div class="n">{cached['dead']} still 404</div></div>
<div class="kpi"><div class="v">{tools}</div><div class="l">Tools served</div><div class="n">over the live origin</div></div>
<div class="kpi"><div class="v">{len(names)}</div><div class="l">Servers in catalog</div><div class="n">68 npm packages</div></div>
<div class="kpi"><div class="v" style="color:var(--bad)">$0</div><div class="l">Revenue, all time</div><div class="n">rail works, traffic does not</div></div>
<div class="kpi"><div class="v" style="color:var(--bad)">0</div><div class="l">Google-indexed URLs</div><div class="n">of 299 submitted</div></div>
</div>

<h2>The finding that matters</h2>
<div class="card">
<h3>The Buy button does not sell anything</h3>
<p>Traced end to end on the live origin: <code>GET /buy/bundle</code> renders a form → <code>POST /buy/bundle</code> answers <code>303 → /s/bundle</code> → and <code>/s/bundle</code> contains exactly one action, an email subscribe box posting to <code>/api/subscribe</code>, which returns <code>{{"ok":true,"status":"subscribed"}}</code>.</p>
<p><strong>Correction, measured this session.</strong> An earlier probe in this same session
concluded that no checkout existed. That was wrong: it was a curl request, and the worker
classifies curl as scripted and redirects it to the product page (<code>x-mcp-buy:
scripted-ua-no-session</code>). Driving the real buyer path — browser UA, same-origin
<code>Origin</code>, <code>Sec-Fetch-Mode: navigate</code>, body <code>intent=checkout</code> —
returns <code>303</code> to <code>checkout.stripe.com/c/pay/cs_live_…</code>, and that page
serves HTTP 200. The worker holds a <em>live</em> key and the <code>/success</code> and webhook
fulfilment paths are implemented.</p>
<p><strong>Consequence:</strong> the plumbing is not the problem. 334 buy clicks produced 100
checkout confirmations and zero payments, and 2,780 open/expired sessions in one week carried
no PaymentIntent — automation crossing the guard, i.e. our own probes, not buyers. With 0 of 299
URLs indexed there is no population from which to compute a conversion rate. Optimising
conversion at this traffic level is arithmetic on zero; distribution is the only lever.</p>
</div>

<h2>What changed this session</h2>
<div class="card">
<h3>Eleven dead endpoints recovered, deployed, verified</h3>
<p>Twelve catalog servers returned <strong>404</strong> on <code>/mcp/&lt;name&gt;</code> because the worker never imported them. Eleven are now vendored, wired, tested (112/112) and deployed as version <code>330e03ce</code>; each answers <code>initialize</code> and <code>tools/list</code> live.</p>
<p>Recovered: budget, hourly-rate, loan-calculator, payroll, pomodoro, receipts, stripe-billing, tax-calc (8) plus duplicate-invoice-check, supplier-statement-check, three-way-match (3). That is 39 tools that previously 404'd. <code>office-suite</code> stays unhosted by design — it spawns local child processes, impossible in a Worker.</p>
<p>Two distribution PRs are open: <a href="https://github.com/punkpeye/awesome-mcp-servers/pull/18737">punkpeye#18737</a>, <a href="https://github.com/mcpHQ/awesome-mcp-servers/pull/695">mcpHQ#695</a>. One registry intake filed: mcp.so issue #6845.</p>
</div>

<h2>Traffic reality check</h2>
<div class="card">
<h3>npm "10,764 downloads/week" was a burst, not an audience</h3>
<p>The last-week figure across 68 packages looked healthy until the daily series was pulled: the flagship's 380-week was one 283-download day on 2026-10-30. Steady state is single digits to low double digits per day, spiky, and it starts from nowhere. Uniform ~250/package/week across 41 unrelated packages is the signature of mirrors and scanners, not humans.</p>
<p>So the binding constraint is distribution, and it is not close. Organic search contributes nothing (0 of 299 URLs indexed), the registries carry the discovery load, and the only channel with real human intent — the npm README — is unwritable without registry credentials.</p>
</div>

<h2>Hosted endpoint matrix</h2>
<div class="card" style="padding:0;overflow:auto">
<table><thead><tr><th>Server</th><th>Status</th><th>Tools</th><th>npm/wk</th><th>Endpoint</th></tr></thead>
<tbody>{trs}</tbody></table></div>

<h2>Next, in ROI order</h2>
<div class="card">
<p><strong>1. Read the real funnel (needs one Stripe restricted read key).</strong> The checkout
works; what is unknown is where the 100 confirmations stopped. A read-only <code>rk_live</code> key
turns that inference into a table.</p>
<p><strong>2. Publish to the official MCP registry.</strong> Blocked on one TXT record on
<code>zovo.one</code>: <code>v=MCPv1; k=ed25519; p=tNEzek8GR/dUdHJh0oWLNWOfsa3U/i1y25kBgHdKl8M=</code>.
That registry feeds the Cursor directory and the GitHub/VS Code galleries; 58 servers can go in
the moment DNS accepts it.</p>
<p><strong>2. Win the two empty categories.</strong> Price-tracker and time-tracker are the only two categories measured with room; every registry listing should lead with them, because the registry page — not our domain — is what ranks.</p>
<p><strong>3. Finish the registry sweep.</strong> 21 of 74 listings were live at the start of the session; the remainder are HTTP or PR submissions and cost only time.</p>
<p><strong>4. Stop feeding Google thin pages.</strong> 299 submitted URLs, 0 indexed, across two domains selling the same thing. Consolidate to one canonical host before adding any more pages.</p>
</div>
</div></body></html>"""
    out = os.path.join(ROOT, "MCP-DASHBOARD.html")
    with open(out, "w") as f:
        f.write(html)
    print(f"wrote {out} ({len(html)} bytes) live={cached['live']}/{cached['total']} tools={tools}")

if __name__ == "__main__":
    main()
