#!/usr/bin/env python3
"""Measure the estate instead of trusting claims.

Writes data/kpi_measured.json and prints one table. Every number in the
dashboard and the session report should come from here.

Sources, in order of authority:
  1. Google Search Console API (service account ADC) - what Google actually
     has indexed, submitted, and how many clicks/impressions.
  2. Live HTTP sweeps - hosted MCP endpoints, buy URLs, hub pages, sitemaps.
  3. Local files - only for things that cannot be measured remotely.

Usage:
  python3 scripts/measure.py            # remote checks, ~60s
  python3 scripts/measure.py --fast     # skip the 58-endpoint MCP sweep
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "kpi_measured.json")
HOSTED_CACHE = os.path.join(ROOT, "data", "hosted_live.json")
UA = {"user-agent": "curl/8.7.1"}
PROPERTY = "sc-domain:zovo.one"


def http(url, method="GET", timeout=20, headers=None, data=None):
    req = urllib.request.Request(url, data=data, method=method, headers=headers or UA)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:
        return 0, ""


def gsc(*args):
    """Run the existing GSC helper and return its stdout."""
    p = subprocess.run(
        [sys.executable, os.path.join(ROOT, "scripts", "gsc_tool.py")] + list(args),
        capture_output=True,
        text=True,
        timeout=180,
    )
    return p.stdout + p.stderr


def measure_gsc():
    out = {"property": PROPERTY, "reachable": False, "indexed": None, "submitted": None, "inspect": None}
    txt = gsc("inspect", PROPERTY, "https://mcp.zovo.one/s/invoice")
    m = re.search(r"verdict\s*=\s*([A-Z_]+)", txt)
    cov = re.search(r"coverageState\s*=\s*(.+)", txt)
    if m or cov:
        out["reachable"] = True
        out["inspect"] = {"verdict": m.group(1) if m else None, "coverage": cov.group(1).strip() if cov else None}
    for label, url in (("hub_page", "https://theluckystrike.github.io/mcp/invoice/"),
                       ("csg_page", "https://claudecodeguides.com/mcp/invoice/")):
        t = gsc("inspect", PROPERTY, url)
        mm = re.search(r"verdict\s*=\s*([A-Z_]+)", t)
        cc = re.search(r"coverageState\s*=\s*(.+)", t)
        out.setdefault("inspect_others", {})[label] = {
            "verdict": mm.group(1) if mm else None,
            "coverage": cc.group(1).strip() if cc else None,
        }
    sm = gsc("sitemaps", PROPERTY)
    for line in sm.splitlines():
        low = line.lower()
        if "mcp" in low and ("submitted" in low or "indexed" in low or "|" in line):
            out.setdefault("sitemap_lines", []).append(line.strip()[:200])
    return out


def measure_hosted(fast=False):
    cat = json.load(open(os.path.join(ROOT, "data", "mcp_catalog.json")))
    servers = cat["servers"]
    if fast and os.path.exists(HOSTED_CACHE):
        L = json.load(open(HOSTED_CACHE))
        return {
            "checked": L.get("checked"),
            "live": sum(1 for r in L["results"] if r["live"]),
            "total": len(L["results"]),
            "tools": sum(int(r.get("tools") or 0) for r in L["results"]),
            "dead": [r["id"] for r in L["results"] if not r["live"]],
            "source": "cache",
        }
    H = {"content-type": "application/json", "accept": "application/json,text/event-stream", **UA}
    body = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05",
         "capabilities": {}, "clientInfo": {"name": "measure", "version": "1"}}}
    ).encode()

    def probe(s):
        sid = s["id"]
        code, txt = http("https://mcp.zovo.one/mcp/%s" % sid, "POST", 25, H, body)
        ok = code == 200 and '"result"' in txt
        n = 0
        if ok:
            tools_body = json.dumps({"jsonrpc": "2.0", "id": 2, "method": "tools/list"}).encode()
            c2, t2 = http("https://mcp.zovo.one/mcp/%s" % sid, "POST", 25, H, tools_body)
            n = len(re.findall(r'"inputSchema"', t2))
        return {"id": sid, "live": ok, "status": code, "tools": n}

    with ThreadPoolExecutor(max_workers=12) as ex:
        rows = list(ex.map(probe, servers))
    json.dump({"checked": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
               "results": rows}, open(HOSTED_CACHE, "w"), indent=1)
    return {"checked": "now", "live": sum(1 for r in rows if r["live"]), "total": len(rows),
            "tools": sum(r.get("tools") or 0 for r in rows), "dead": [r["id"] for r in rows if not r["live"]], "source": "live"}


def measure_surfaces():
    out = {}
    for name, url in [
        ("hub_us", "https://theluckystrike.github.io/mcp/"),
        ("hub_us_sitemap", "https://theluckystrike.github.io/sitemap-mcp.xml"),
        ("csg_mcp", "https://claudecodeguides.com/mcp/"),
        ("csg_sitemap", "https://claudecodeguides.com/sitemap.xml"),
        ("buy_invoice", "https://mcp.zovo.one/buy/invoice"),
        ("connect", "https://mcp.zovo.one/mcp/connect"),
    ]:
        code, body = http(url)
        row = {"status": code}
        if "sitemap" in name and code == 200:
            row["urls"] = body.count("<loc>")
        out[name] = row
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fast", action="store_true")
    a = ap.parse_args()

    data = {
        "measured_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "gsc": measure_gsc(),
        "hosted": measure_hosted(a.fast),
        "surfaces": measure_surfaces(),
    }
    cat = json.load(open(os.path.join(ROOT, "data", "mcp_catalog.json")))
    data["estate"] = {"servers": len(cat["servers"]), "bundle_price_usd": cat["bundle_price_usd"]}
    json.dump(data, open(OUT, "w"), indent=1, ensure_ascii=False)

    g, h, s = data["gsc"], data["hosted"], data["surfaces"]
    print("measured at", data["measured_at"])
    print("  GSC reachable      ", g["reachable"], "| inspect:", g["inspect"])
    print("  hosted endpoints   ", "%s/%s live" % (h["live"], h["total"]), "| dead:", len(h["dead"]))
    for k, v in s.items():
        print("  %-16s %s %s" % (k, v["status"], ("%d urls" % v["urls"]) if "urls" in v else ""))
    print("wrote", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
