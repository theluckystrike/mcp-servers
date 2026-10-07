import json, urllib.request, urllib.parse, time, base64

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
jwt = f"{hdr}.{pl}.{sig}"
data = urllib.parse.urlencode({"grant_type":"urn:ietf:params:oauth:grant-type:jwt-bearer","assertion":jwt}).encode()
tok = json.load(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=data), timeout=30))["access_token"]

SITE = "sc-domain:zovo.one"
enc = "sc-domain%3Azovo.one"
def query(start, end, dims, filt=None):
    body = {"startDate":start,"endDate":end,"dimensions":dims,"rowLimit":25000,"dataState":"final"}
    if filt: body["dimensionFilterGroups"]=[{"filters":[{"dimension":"page","operator":"contains","expression":filt}]}]
    req = urllib.request.Request(f"https://www.googleapis.com/webmasters/v3/sites/{enc}/searchAnalytics/query",
      data=json.dumps(body).encode(), headers={"Authorization":f"Bearer {tok}","Content-Type":"application/json"})
    return json.load(urllib.request.urlopen(req)).get("rows",[])

def days_ago(n): return time.strftime("%Y-%m-%d", time.localtime(time.time()-n*86400))

out = {"pulled_at": today if False else time.strftime("%Y-%m-%d")}
for win, (s,e) in {"28d":(days_ago(31), days_ago(3)), "90d":(days_ago(93), days_ago(3))}.items():
    for host, filt in {"mcp":"//mcp.zovo.one/", "control":"//zovo.one/"}.items():
        pages = query(s,e,["page"],filt)
        qs = query(s,e,["query"],filt)
        out[f"{win}_{host}_pages_total"] = {kk:sum(r.get(kk,0) for r in pages) for kk in ("clicks","impressions")}
        out[f"{win}_{host}_pages_count"] = len(pages)
        out[f"{win}_{host}_top_pages"] = sorted(pages, key=lambda r:-r["impressions"])[:15]
        out[f"{win}_{host}_top_queries"] = sorted(qs, key=lambda r:-r["impressions"])[:15]
json.dump(out, open("/Users/mike/mcp-servers/data/organic_r3_gsc.json","w"), indent=1)
print(json.dumps({k:v for k,v in out.items() if "top_" not in k}, indent=1))
