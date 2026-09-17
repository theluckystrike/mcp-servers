#!/usr/bin/env python3
"""S39 T2: fully-paginated registry search per tracked token."""
import json, sys, time, urllib.parse, urllib.request

API = "https://registry.modelcontextprotocol.io/v0/servers"
NS = "io.github.theluckystrike/"


def fetch(url, tries=4):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "zovo-organic-probe/1.0"})
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 + 3 * i)
    raise RuntimeError("fetch failed after %d tries: %r" % (tries, last))


def probe(token):
    """Return dict with pages walked, total rows, and our hits."""
    rec = {"token": token, "pages": 0, "total_rows": 0, "our_hits": [],
           "page1_our_hits": [], "page1_rows": 0, "capped": False, "error": None,
           "page1_star_max": None}
    cursor = None
    while True:
        q = {"search": token, "limit": "100"}
        if cursor:
            q["cursor"] = cursor
        url = API + "?" + urllib.parse.urlencode(q)
        try:
            body = fetch(url)
        except Exception as e:  # noqa: BLE001
            rec["error"] = repr(e)
            return rec
        rec["pages"] += 1
        servers = body.get("servers") or []
        rec["total_rows"] += len(servers)
        if rec["pages"] == 1:
            rec["page1_rows"] = len(servers)
        for idx, item in enumerate(servers, start=1):
            s = item.get("server", item)
            name = s.get("name", "")
            if name.startswith(NS):
                hit = {"page": rec["pages"], "position": idx, "name": name}
                rec["our_hits"].append(hit)
                if rec["pages"] == 1:
                    rec["page1_our_hits"].append(hit)
        cursor = (body.get("metadata") or {}).get("nextCursor")
        if not cursor:
            break
        if rec["pages"] >= 60:
            rec["capped"] = True
            break
        time.sleep(0.15)
    return rec


def main():
    tokens = json.load(open(sys.argv[1]))
    out = []
    for t in tokens:
        r = probe(t)
        out.append(r)
        print(json.dumps(r), flush=True)
    json.dump(out, open(sys.argv[2], "w"), indent=1)


if __name__ == "__main__":
    main()
