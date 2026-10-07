import json, urllib.request, urllib.parse, time, base64, sys
KEY = "/Users/mike/.config/gcloud/legacy_credentials/zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com/adc.json"
k = json.load(open(KEY))
b64u = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
now = int(time.time())
hdr = b64u(json.dumps({"alg":"RS256","typ":"JWT"},separators=(",",":")).encode())
pl = b64u(json.dumps({"iss":k["client_email"],"scope":"https://www.googleapis.com/auth/webmasters.readonly",
  "aud":"https://oauth2.googleapis.com/token","exp":now+3300,"iat":now},separators=(",",":")).encode())
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
key = serialization.load_pem_private_key(k["private_key"].encode(), password=None)
sig = b64u(key.sign(f"{hdr}.{pl}".encode(), padding.PKCS1v15(), hashes.SHA256()))
tok = json.load(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token",
  data=urllib.parse.urlencode({"grant_type":"urn:ietf:params:oauth:grant-type:jwt-bearer","assertion":f"{hdr}.{pl}.{sig}"}).encode()), timeout=30))["access_token"]

SITE = "sc-domain:zovo.one"
urls = sys.argv[1:]
out = {}
for u in urls:
    body = {"inspectionUrl": u, "siteUrl": SITE}
    req = urllib.request.Request("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
      data=json.dumps(body).encode(), headers={"Authorization":f"Bearer {tok}","Content-Type":"application/json"})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=30))
        i = r.get("inspectionResult", {})
        idx = i.get("indexStatusResult", {})
        crawl = idx.get("crawlingUserAgents") or []
        out[u] = {"verdict": idx.get("verdict"), "coverage": idx.get("coverageState"),
                  "googlebot": crawl, "crawled_at": idx.get("lastCrawlTime"),
                  "robots": idx.get("robotsTxtState"), "canonical": (idx.get("googleCanonical") or "")[:80]}
    except Exception as e:
        out[u] = {"error": str(e)[:200]}
    time.sleep(1)
print(json.dumps(out, indent=1))
