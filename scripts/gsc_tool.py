#!/usr/bin/env python3
"""Google Search Console tool: list properties, submit sitemaps, inspect a URL.

Auth: service-account ADC at ~/.config/gcloud/legacy_credentials/<sa>/adc.json
Usage:
  python3 scripts/gsc_tool.py sites
  python3 scripts/gsc_tool.py sitemaps <property>
  python3 scripts/gsc_tool.py submit <property> <sitemap-url> [<sitemap-url> ...]
  python3 scripts/gsc_tool.py inspect <property> <url>
"""
import base64
import json
import sys
import time
import urllib.parse
import urllib.request
import urllib.error

ADC = "/Users/mike/.config/gcloud/legacy_credentials/zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com/adc.json"


def token():
    adc = json.load(open(ADC))
    def b64(b):
        return base64.urlsafe_b64encode(b).rstrip(b"=")
    now = int(time.time())
    claim = {
        "iss": adc["client_email"],
        "scope": "https://www.googleapis.com/auth/webmasters",
        "aud": adc["token_uri"],
        "exp": now + 3600,
        "iat": now,
    }
    hdr = b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    pl = b64(json.dumps(claim).encode())
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    key = serialization.load_pem_private_key(adc["private_key"].encode(), password=None)
    sig = b64(key.sign(hdr + b"." + pl, padding.PKCS1v15(), hashes.SHA256()))
    jwt = (hdr + b"." + pl + b"." + sig).decode()
    data = urllib.parse.urlencode(
        {"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": jwt}
    ).encode()
    req = urllib.request.Request(adc["token_uri"], data=data)
    return json.loads(urllib.request.urlopen(req, timeout=30).read())["access_token"]


def call(tok, method, path, body=None):
    url = "https://www.googleapis.com/webmasters/v3" + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Authorization": "Bearer " + tok, "content-type": "application/json"},
    )
    if data is None:
        req.data = None
    try:
        return json.loads(urllib.request.urlopen(req, timeout=45).read() or b"{}")
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read().decode()[:400]}


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    tok = token()
    cmd = sys.argv[1]
    if cmd == "sites":
        for s in call(tok, "GET", "/sites").get("siteEntry", []):
            print(s["permissionLevel"], s["siteUrl"])
    elif cmd == "sitemaps":
        prop = sys.argv[2]
        r = call(tok, "GET", "/sites/%s/sitemaps" % urllib.parse.quote(prop, safe=""))
        for m in r.get("sitemap", []):
            idx = [c.get("indexed") for c in (m.get("contents") or [])]
            print(m.get("path"), "| errors", m.get("errors"), "| warnings", m.get("warnings"),
                  "| submitted", [c.get("submitted") for c in (m.get("contents") or [])],
                  "| indexed", idx, "| last", m.get("lastDownloaded"))
        if not r.get("sitemap"):
            print(r)
    elif cmd == "submit":
        prop = sys.argv[2]
        for sm in sys.argv[3:]:
            # PUT must go to the raw URL
            url = "https://www.googleapis.com/webmasters/v3/sites/%s/sitemaps/%s" % (
                urllib.parse.quote(prop, safe=""), urllib.parse.quote(sm, safe=""))
            req = urllib.request.Request(url, method="PUT", data=b"",
                                         headers={"Authorization": "Bearer " + tok})
            try:
                r = urllib.request.urlopen(req, timeout=45)
                print("submitted", sm, "->", r.status)
            except urllib.error.HTTPError as e:
                print("submit failed", sm, e.code, e.read().decode()[:200])
    elif cmd == "inspect":
        prop, url = sys.argv[2], sys.argv[3]
        body = {"inspectionUrl": url, "siteUrl": prop, "languageCode": "en-US"}
        req = urllib.request.Request(
            "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
            data=json.dumps(body).encode(), method="POST",
            headers={"Authorization": "Bearer " + tok, "content-type": "application/json"})
        try:
            r = json.loads(urllib.request.urlopen(req, timeout=45).read())
        except urllib.error.HTTPError as e:
            print("inspect failed", e.code, e.read().decode()[:300])
            return 1
        st = (r.get("inspectionResult") or {}).get("indexStatusResult") or {}
        for k in ("verdict", "coverageState", "pageFetchState", "lastCrawlTime", "googleCanonical"):
            print(k, "=", st.get(k))
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
