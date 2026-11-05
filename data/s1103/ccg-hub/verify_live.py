#!/usr/bin/env python3
"""Live check after deploy: every satellite page 200 with its H1 title, hosted URL and example,
listed in sitemap.xml; the /mcp/ index carries the section. Writes verify_live.json."""
import json, os, re, sys, urllib.request

ROOT = os.path.expanduser("~/mcp-servers")
BASE = sys.argv[1] if len(sys.argv) > 1 else "https://claudecodeguides.com"
sats = json.load(open(os.path.join(ROOT, "data/satellite_hub.json")))["satellites"]


def get(u):
    req = urllib.request.Request(u, headers={"user-agent": "Mozilla/5.0 s1103-ccg-hub-verify"})
    try:
        r = urllib.request.urlopen(req, timeout=60)
        return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""


code, sm = get(BASE + "/sitemap.xml")
locs = set(re.findall(r"<loc>([^<]+)</loc>", sm))
rows = []
for x in sats:
    u = BASE + "/mcp/%s/" % x["repo"]
    c, body = get(u)
    rows.append({
        "url": u, "status": c,
        "title_ok": "MCP server (free, no API key)</h1>" in body,
        "hosted_url_ok": x["hosted_url"] in body,
        "example_ok": x["example"]["summary"][:50].replace("&", "&amp;") in body or x["example"]["summary"][:50] in body,
        "jsonld_ok": "SoftwareApplication" in body and "FAQPage" in body,
        "in_sitemap": u in locs,
    })
ic, idx = get(BASE + "/mcp/")
out = {
    "base": BASE, "sitemap_status": code, "sitemap_urls": len(locs),
    "sitemap_mcp_urls": sum(1 for l in locs if "/mcp/" in l),
    "index_status": ic, "index_has_section": "Free live-data MCP servers (no key)" in idx,
    "index_links": sum(1 for x in sats if "/mcp/%s/" % x["repo"] in idx),
    "pages": len(rows), "pages_200": sum(r["status"] == 200 for r in rows),
    "pages_all_ok": sum(all(v for k, v in r.items() if k not in ("url", "status")) and r["status"] == 200 for r in rows),
    "pages_in_sitemap": sum(r["in_sitemap"] for r in rows),
    "rows": rows,
}
json.dump(out, open(os.path.join(ROOT, "data/s1103/ccg-hub/verify_live.json"), "w"), indent=1)
print({k: v for k, v in out.items() if k != "rows"})
for r in rows:
    if not (r["status"] == 200 and all(v for k, v in r.items() if k not in ("url", "status"))):
        print("NOT OK", r)
