import json, urllib.request, urllib.parse, time
seeds = [
 "can chatgpt tell me the", "can claude tell me the", "can chatgpt check", "can claude check", "can chatgpt look up",
 "can chatgpt see current", "can chatgpt give real time", "can chatgpt tell me if",
 "tide times today", "tide chart mcp", "tides api", "high tide today",
 "northern lights tonight", "aurora forecast", "kp index today", "aurora mcp",
 "check car recall", "is my car recalled", "recall check by vin", "vin decoder api free", "vehicle recall mcp",
 "npi lookup", "npi number lookup", "npi mcp",
 "mortgage rates today", "treasury yield today", "10 year treasury yield today", "treasury yield mcp",
 "food recall today", "fda recall", "drug recall", "drug shortage list", "openfda mcp",
 "fema disaster declaration", "is my county a disaster area", "fema mcp",
 "product recall check", "cpsc recall",
 "earthquake today", "earthquake mcp",
 "sunrise sunset time", "air quality today", "air quality mcp",
 "federal register mcp", "census geocoder", "address to census tract",
 "uv index today", "pollen count today", "wildfire map",
 "drought monitor", "noaa api mcp", "usgs mcp", "nhtsa api", "sec filings mcp",
 "mcp server for recalls", "mcp server for tides", "mcp server for space weather", "mcp server for government data",
 "can chatgpt check recalls", "can chatgpt predict northern lights",
]
assert len(seeds) <= 60, len(seeds)
out = {}
for s in seeds:
    u = 'https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=' + urllib.parse.quote(s)
    try:
        r = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=15).read().decode('utf-8', 'replace'))
        out[s] = r[1]
    except Exception as e:
        out[s] = ['ERR ' + str(e)[:60]]
    time.sleep(0.5)
json.dump({"fetched": time.strftime('%Y-%m-%dT%H:%M:%S%z'), "requests": len(seeds), "results": out}, open('probe-1105.json', 'w'), indent=1)
for k, v in out.items(): print(f"{k} [{len(v)}]: " + '; '.join(v))
