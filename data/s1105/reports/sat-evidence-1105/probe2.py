import json, urllib.request, urllib.parse, time, sys
seeds = ["i bond rate", "current i bond rate", "i bond rate november 2026", "i bond fixed rate", "i bond calculator",
 "social security cola 2027", "cola 2027", "full retirement age", "full retirement age calculator", "social security full retirement age",
 "social security earnings limit 2027", "social security wage base 2027",
 "flood zone by address", "fema flood zone", "what flood zone am i in", "flood zone lookup", "flood zone map",
 "passport wait times", "zip code to county", "medicare part b premium 2027"]
out = {}
for s in seeds:
    u = 'https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=' + urllib.parse.quote(s)
    try:
        r = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=15).read().decode('utf-8', 'replace'))
        out[s] = r[1]
    except Exception as e:
        out[s] = ['ERR ' + str(e)[:60]]
    time.sleep(0.5)
json.dump({"fetched": time.strftime('%Y-%m-%dT%H:%M:%S%z'), "requests": len(seeds), "results": out}, open(sys.argv[1], 'w'), indent=1)
for k, v in out.items(): print(f"{k} [{len(v)}]: " + '; '.join(v))
