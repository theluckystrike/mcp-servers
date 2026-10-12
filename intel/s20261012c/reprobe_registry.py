#!/usr/bin/env python3
"""Re-probe the official MCP registry for the expired compare_none tokens (2026-10-12).
For each server whose compare_none note has expired: run every token through the
registry search API, record total rows and any competitor-looking hit. Print JSON.
Nothing is written to data/facts.json here - the orchestrator reviews the output first."""
import json, time, urllib.parse, urllib.request, sys

API = "https://registry.modelcontextprotocol.io/v0/servers"
OUR_HOST_FRAGMENTS = ("theluckystrike", "zovo")

def fetch(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "zovo-organic-probe/1.0"})
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            last = e
            time.sleep(1 + 2 * i)
    raise RuntimeError(f"fetch failed: {last!r}")

def search(token):
    """Walk search results for one token; return (rows, competitor_names)."""
    rows = 0
    comps = []
    cursor = None
    for _page in range(10):  # cap at 10 pages (1000 rows) per token
        q = {"search": token, "limit": "100"}
        if cursor:
            q["cursor"] = cursor
        body = fetch(API + "?" + urllib.parse.urlencode(q))
        servers = body.get("servers") or []
        rows += len(servers)
        for s in servers:
            name = s.get("name") or ""
            if any(f in name for f in OUR_HOST_FRAGMENTS):
                continue
            comps.append(name)
        cursor = body.get("metadata", {}).get("nextCursor")
        if not cursor:
            break
    return rows, comps

def main():
    facts = json.load(open("data/facts.json"))
    today = "2026-10-12"
    out = {}
    for server, note in (facts.get("compare_none") or {}).items():
        age = (time.mktime(time.strptime(today, "%Y-%m-%d")) - time.mktime(time.strptime(note["date"], "%Y-%m-%d"))) / 86400
        if age <= 30:
            continue
        rec = {"tokens": {}, "competitor_samples": {}}
        for tok in note["tokens"]:
            try:
                rows, comps = search(tok)
                rec["tokens"][tok] = rows
                if comps:
                    rec["competitor_samples"][tok] = comps[:8]
            except Exception as e:
                rec["tokens"][tok] = f"ERROR {e!r}"
            time.sleep(0.4)
        out[server] = rec
        print(f"probed {server}: {sum(v for v in rec['tokens'].values() if isinstance(v, int))} rows", file=sys.stderr)
    print(json.dumps(out, indent=1))

if __name__ == "__main__":
    main()
