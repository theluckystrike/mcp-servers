#!/usr/bin/env python3
"""Gumroad publish rail (v2 API).

Why: a second, token-free rail. Stripe at mcp.zovo.one is the primary checkout and is
live; this exists for the day a marketplace listing (Gumroad Discover) is worth the 10%.
Gumroad is a merchant of record, needs no server, and has
its own discovery surface. This module uploads a deliverable file and creates or
updates a published product in one call.

    python3 scripts/gumroad_publish.py upload <file>          # -> prints hosted url
    python3 scripts/gumroad_publish.py upsert sku.json        # -> prints product url
    python3 scripts/gumroad_publish.py list                   # -> prints all products
    python3 scripts/gumroad_publish.py delete <product_id>

sku.json keys: permalink, name, price_cents, description, file (path), published,
tags, custom_summary, custom_receipt
"""
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

API = "https://api.gumroad.com/v2"
CFG = os.path.expanduser("~/.config/gumroad/config.json")
PART = 5 * 1024 * 1024


def token():
    with open(CFG) as f:
        return json.load(f)["access_token"]


def api(method, path, form=None, json_body=None, raw=False):
    url = path if path.startswith("http") else API + path
    data = None
    headers = {"Authorization": "Bearer " + token()}
    if form is not None:
        data = urllib.parse.urlencode(form, doseq=True).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    elif json_body is not None:
        data = json.dumps(json_body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            body = r.read()
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            j = json.loads(body)
        except Exception:
            raise SystemExit(f"HTTP {e.code} {url}: {body[:400]!r}")
        raise SystemExit(f"HTTP {e.code} {url}: {j.get('message') or j}")
    return body if raw else json.loads(body or b"{}")


def put_part(presigned_url, blob):
    req = urllib.request.Request(presigned_url, data=blob, method="PUT")
    req.add_header("Content-Type", "application/octet-stream")
    with urllib.request.urlopen(req, timeout=300) as r:
        etag = r.headers.get("ETag", "").strip('"')
        r.read()
    return etag


def upload(path):
    """Presign -> PUT parts -> complete. Returns the public file url."""
    size = os.path.getsize(path)
    ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
    nparts = max(1, -(-size // PART))
    pre = api(
        "POST",
        "/files/presign",
        json_body={"filename": os.path.basename(path), "content_type": ctype,
                   "file_size": size, "part_count": nparts},
    )
    parts = pre["parts"]
    done, sent = [], 0
    for p in parts:
        start = (p["part_number"] - 1) * PART
        # Gumroad may return fewer parts than requested; clamp to what it gave us.
        end = min(start + PART, size)
        if start >= size:
            break
        blob = open(path, "rb") if False else None
        with open(path, "rb") as f:
            f.seek(start)
            blob = f.read(end - start)
        etag = put_part(p["presigned_url"], blob)
        done.append({"part_number": p["part_number"], "etag": etag})
        sent += len(blob)
    api("POST", "/files/complete", json_body={
        "upload_id": pre["upload_id"], "key": pre["key"], "parts": done})
    return pre["file_url"], sent


def find_product(permalink):
    page = 1
    while True:
        d = api("GET", f"/products?page={page}")
        for p in d.get("products", []):
            if p.get("custom_permalink") == permalink:
                return p
        if len(d.get("products", [])) < 10:
            return None
        page += 1


def upsert(spec):
    permalink = spec["permalink"]
    form = {
        "name": spec["name"],
        "price": str(spec["price_cents"]),
        "description": spec["description"],
        "published": "true" if spec.get("published", True) else "false",
        "custom_permalink": permalink,
        "custom_summary": spec.get("custom_summary", ""),
        "custom_receipt": spec.get("custom_receipt", ""),
        "taxonomy_id": spec.get("taxonomy_id", ""),
        "tags": spec.get("tags", ""),
        "charge_tax": "false",
        "require_shipping": "false",
    }
    form = {k: v for k, v in form.items() if v != ""}
    existing = find_product(permalink)
    if existing:
        d = api("PUT", f"/products/{existing['id']}", form=form)
        action = "updated"
    else:
        d = api("POST", "/products", form=form)
        action = "created"
    pid = d["product"]["id"]
    if spec.get("file"):
        url, sent = upload(spec["file"])
        api("PUT", f"/products/{pid}", form={"files[][url]": url})
        action += f" +file({sent}B)"
    p = api("GET", f"/products/{pid}")["product"]
    return {"action": action, "id": pid, "short_url": p["short_url"],
            "url": f"https://gumroad.com/l/{p['custom_permalink']}",
            "price": p["formatted_price"], "published": p["published"],
            "files": len(p.get("files") or [])}


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    if cmd == "upload":
        print(upload(sys.argv[2]))
    elif cmd == "upsert":
        spec = json.load(open(sys.argv[2]))
        print(json.dumps(upsert(spec), indent=2))
    elif cmd == "list":
        d = api("GET", "/products")
        for p in d["products"]:
            print(p.get("custom_permalink"), "|", p["formatted_price"], "|",
                  "pub" if p["published"] else "unpub", "|", p["short_url"], "|", p["name"][:60])
    elif cmd == "delete":
        print(api("DELETE", f"/products/{sys.argv[2]}"))
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
