#!/usr/bin/env python3
"""Build data/mcp_catalog.json — one row per server, everything the public hub needs.

Reads (per servers/<id>/): server.json (registry metadata), package.json (npm name,
description, bin), dist/index.js (tool names), README.md (first paragraph fallback).

Output is deterministic (sorted) so the Pages generator and the dashboard agree.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVERS = os.path.join(ROOT, "servers")
OUT = os.path.join(ROOT, "data", "mcp_catalog.json")

HOSTED_JSON = os.path.join(os.path.dirname(OUT), "hosted_live.json")


def hosted_truth():
    """Measured, not claimed: which /mcp/<id> endpoints answered a real MCP handshake."""
    try:
        with open(HOSTED_JSON, encoding="utf-8") as fh:
            d = json.load(fh)
        return {r["id"]: r for r in d.get("results", [])}
    except Exception:
        return {}


# Price map: what the live Stripe store charges (data/payment_map.json is authoritative
# for what is *purchasable*; this is the display price).
PRICE = {"single": 19, "bundle": 39}

TOOL_RE = re.compile(
    r"""(?:server\.)?(?:tool|registerTool)\(\s*["'`]([a-z][a-z0-9_]{2,40})["'`]|"""
    r"""name:\s*["']([a-z][a-z0-9_]{2,40})["']\s*,\s*(?:description|title):"""
)
NAME_RE = re.compile(r"""name:\s*["']([a-z][a-z0-9_]{2,40})["']\s*,\s*\n?\s*(?:description|title|inputSchema)""")


def read_json(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def liquid_safe(text):
    """Collapse {{ }} {% %} so a Jekyll page never sees a Liquid tag.

    One server (clauses) ships descriptions containing {{variables}}. Those
    braces are meaningful to us and fatal to a Liquid build, so they are
    normalised once here instead of being escaped at every consumer.
    """
    return re.sub(r"\{\{|\}\}|\{%|%\}", lambda m: m.group(0)[0], str(text or ""))


def first_paragraph(md, limit=400):
    text = re.sub(r"^#.*$", "", md, flags=re.M)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    for block in text.split("\n\n"):
        b = " ".join(block.split())
        if len(b) > 80 and not b.startswith(("|", "-", "*", ">", "```")):
            return b[:limit]
    return ""


def tools_for(srv_dir):
    names = []
    for rel in ("dist/index.js", "dist/server.js"):
        p = os.path.join(srv_dir, rel)
        if not os.path.exists(p):
            continue
        src = open(p, encoding="utf-8", errors="ignore").read()
        for m in TOOL_RE.finditer(src):
            n = m.group(1) or m.group(2)
            if n and n not in names:
                names.append(n)
        if not names:
            for m in NAME_RE.finditer(src):
                n = m.group(1)
                if n and n not in names:
                    names.append(n)
        if names:
            break
    return names[:24]


def _toolcount(v):
    """hosted_live.json stores either a list of tool names (old) or a count (new)."""
    if isinstance(v, int):
        return v
    return len(v or [])


def main():
    hosted = hosted_truth()
    rows = []
    for sid in sorted(os.listdir(SERVERS)):
        d = os.path.join(SERVERS, sid)
        if not os.path.isdir(d):
            continue
        reg = read_json(os.path.join(d, "server.json"))
        pkg = read_json(os.path.join(d, "package.json"))
        if not pkg and not reg:
            continue
        title = (reg.get("title") or "").strip()
        desc = liquid_safe((pkg.get("description") or reg.get("description") or "").strip())
        readme = ""
        rp = os.path.join(d, "README.md")
        if os.path.exists(rp):
            readme = open(rp, encoding="utf-8", errors="ignore").read()
        long_desc = first_paragraph(readme) or desc
        mcpb = ""
        for p in reg.get("packages") or []:
            if p.get("registryType") == "mcpb":
                mcpb = p.get("identifier") or ""
        lic_env = ""
        for p in reg.get("packages") or []:
            for ev in p.get("environmentVariables") or []:
                if "LICENSE" in (ev.get("name") or "").upper():
                    lic_env = ev.get("name")
        rows.append(
            {
                "id": sid,
                "slug": sid,
                "human": title or sid.replace("-", " ").title(),
                "registry_name": reg.get("name") or "",
                "npm": pkg.get("name") or "",
                "bin": (pkg.get("bin") or {}) and list((pkg.get("bin") or {}).values()) or [],
                "version": pkg.get("version") or reg.get("version") or "",
                "description": desc,
                "long_description": liquid_safe(long_desc),
                "tools": tools_for(d),
                "website": (reg.get("websiteUrl") or f"https://mcp.zovo.one/s/{sid}"),
                "mcpb": mcpb,
                "license_env": lic_env,
                "buy_url": f"https://mcp.zovo.one/buy/{sid}",
                "price_usd": PRICE["single"],
                "repo_subfolder": f"servers/{sid}",
                "hosted_live": bool(hosted.get(sid, {}).get("live")),
                "hosted_tools": _toolcount(hosted.get(sid, {}).get("tools")),
                "hosted_url": f"https://mcp.zovo.one/mcp/{sid}",
            }
        )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    payload = {
        "generated_at": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "count": len(rows),
        "bundle_url": "https://mcp.zovo.one/buy/bundle",
        "bundle_price_usd": PRICE["bundle"],
        "servers": rows,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=1, ensure_ascii=False)
    with_tools = sum(1 for r in rows if r["tools"])
    n_hosted = sum(1 for r in rows if r["hosted_live"])
    print(
        f"wrote {OUT}: {len(rows)} servers, {with_tools} with tool names, {n_hosted} hosted-live"
    )
    for r in rows[:5]:
        print(" ", r["id"], "|", r["npm"], "|", len(r["tools"]), "tools |", r["human"])


if __name__ == "__main__":
    sys.exit(main())
