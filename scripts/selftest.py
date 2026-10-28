#!/usr/bin/env python3
"""Self-test for the MCP estate generators. Exit 0 = every invariant held.

Run: python3 scripts/selftest.py [--online]
  default   offline: catalogue + dashboard + hub rendered into a temp dir
  --online  also HEAD every buy_url and check JSON-LD blocks parse

Invariants:
  1. build_catalog.py is idempotent and yields 58 servers, unique ids/slugs.
  2. Every server has a description, a price and an https buy_url on the live host.
  3. build_hub.py emits 58 pages + index.md + index.json, no Liquid tokens
     ({{ or {% ) that would break the Jekyll build, no unescaped frontmatter quote.
  4. Every JSON-LD block in every page parses as JSON and carries @context schema.org.
  5. build_dashboard.py emits one row per server and a buy link per server.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable
CAT = os.path.join(ROOT, "data/mcp_catalog.json")
fails, checks = [], 0


def check(cond, msg):
    global checks
    checks += 1
    if not cond:
        fails.append(msg)


def run(*args):
    r = subprocess.run([PY] + list(args), capture_output=True, text=True, cwd=ROOT)
    assert r.returncode == 0, "".join(r.stderr)[-800:]
    return r.stdout


def jsonld_blocks(html):
    return re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)


def main():
    online = "--online" in sys.argv
    def stable():
        d = json.load(open(CAT))
        d.pop("generated_at", None)
        return json.dumps(d, sort_keys=True)

    run("scripts/build_catalog.py")
    first = stable()
    run("scripts/build_catalog.py")
    check(first == stable(), "build_catalog.py is not idempotent (ignoring generated_at)")

    cat = json.load(open(CAT))
    servers = cat["servers"]
    check(len(servers) == 58, "expected 58 servers, got %d" % len(servers))
    for key in ("id", "slug"):
        vals = [s[key] for s in servers]
        check(len(vals) == len(set(vals)), "duplicate %s values" % key)
    for s in servers:
        check(bool(s.get("description")), "%s has no description" % s["id"])
        check(bool(s.get("price_usd")), "%s has no price" % s["id"])
        check(s.get("buy_url", "").startswith("https://mcp.zovo.one/buy/"),
              "%s has a bad buy_url: %r" % (s["id"], s.get("buy_url")))

    with tempfile.TemporaryDirectory() as tmp:
        run("scripts/build_hub.py", "--site", tmp,
            "--base-url", "https://example.invalid", "--layout", "page")
        hub = os.path.join(tmp, "mcp")
        pages = sorted(f for f in os.listdir(hub) if f.endswith(".md") and f != "index.md")
        check(len(pages) == 58, "hub emitted %d server pages" % len(pages))
        check(os.path.exists(os.path.join(hub, "index.json")), "hub emitted no index.json")
        # truth-in-advertising gate: a page may only promise a hosted URL if the
        # endpoint actually answered a real MCP handshake (data/hosted_live.json).
        hosted_pages = 0
        # a weaker mirror must not compete with the canonical pages
        with tempfile.TemporaryDirectory() as tmp2:
            run("scripts/build_hub.py", "--site", tmp2, "--base-url", "https://mirror.invalid",
                "--layout", "page", "--canonical-base", "https://strong.invalid")
            miss = [f for f in os.listdir(os.path.join(tmp2, "mcp"))
                    if f.endswith(".md") and f != "index.md"
                    and "canonical_url: https://strong.invalid/mcp/" not in
                    open(os.path.join(tmp2, "mcp", f), encoding="utf-8").read()]
            check(not miss, "%d pages lack the canonical_url pointer" % len(miss))

        buy_bad = 0
        buy_n = 0
        for name in pages:
            src0 = open(os.path.join(hub, name), encoding="utf-8").read()
            for u in re.findall(r"https://mcp\.zovo\.one/buy/[^\s)\"']+", src0):
                buy_n += 1
                if "&src=" in u or "?src=" not in u:
                    buy_bad += 1
                    check(False, "%s has an unattributable buy link: %s" % (name, u))
        check(buy_n >= 58, "hub emitted only %d buy links" % buy_n)
        check(buy_bad == 0, "%d buy links lack a ?src= tag" % buy_bad)

        for name in pages:
            src = open(os.path.join(hub, name), encoding="utf-8").read()
            if "Hosted, nothing to install" in src:
                hosted_pages += 1
        claimed = sum(1 for s in servers if s.get("hosted_live"))
        check(hosted_pages == claimed,
              "hub advertises %d hosted pages but %d endpoints are measured live"
              % (hosted_pages, claimed))
        print("  hosted claims: %d pages, %d measured live" % (hosted_pages, claimed))

        idx = json.load(open(os.path.join(hub, "index.json")))
        check(len(idx.get("servers") or idx) == 58, "index.json is not 58 rows")

        for name in pages:
            src = open(os.path.join(hub, name), encoding="utf-8").read()
            check(not re.search(r"\{\{|\{%", src), "%s contains a Liquid token" % name)
            head = src.split("---")[1]
            for line in head.strip().splitlines():
                check(line.count('"') % 2 == 0, "%s has an unbalanced quote: %r" % (name, line))
            body_part = src.split("---", 2)[-1]
            if "application/ld+json" in body_part:
                check(body_part.find("<script") > body_part.find("\n# "),
                      "%s puts JSON-LD before the H1 (csg layout drops pre-H1 content)" % name)
            blocks = jsonld_blocks(src)
            check(len(blocks) == 1, "%s has %d JSON-LD blocks" % (name, len(blocks)))
            for b in blocks:
                try:
                    obj = json.loads(b)
                except json.JSONDecodeError as e:
                    fails.append("%s has invalid JSON-LD: %s" % (name, e))
                    continue
                types = json.dumps(obj)
                check("schema.org" in types, "%s JSON-LD lacks schema.org" % name)
                check("SoftwareApplication" in types and "FAQPage" in types,
                      "%s JSON-LD is missing a @graph member" % name)

    run("scripts/build_dashboard.py")
    dash = open(os.path.join(ROOT, "DASHBOARD.html"), encoding="utf-8").read()
    check(dash.count("<tr>") >= 58 + 5, "dashboard lost rows: %d" % dash.count("<tr>"))
    check(dash.count("mcp.zovo.one/buy/") >= 58, "dashboard lost buy links")
    for s in servers:
        check(s["buy_url"] in dash, "dashboard is missing %s" % s["id"])

    if online:
        for s in servers:
            # GET, not HEAD: the storefront answers HEAD with 403.
            req = urllib.request.Request(
                s["buy_url"], headers={"user-agent": "Mozilla/5.0 (selftest)"})
            try:
                code = urllib.request.urlopen(req, timeout=20).status
            except Exception as e:  # noqa: BLE001 - reported as a failure below
                code = str(e)
            check(code == 200, "%s -> %s" % (s["buy_url"], code))

    print("%d checks, %d failures" % (checks, len(fails)))
    for f in fails[:25]:
        print("  FAIL", f)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
