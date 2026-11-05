# s1103: per-version downloads (last-week window 2026-10-26..11-01) via https://api.npmjs.org/versions/<pkg>/last-week; output ./npm_versions.json
import json,urllib.request,time
pk=[l.split('\t')[1] for l in open('/Users/mike/mcp-servers/data/s1030/npm-registry-check.tsv').read().strip().split('\n')]
out={}
for p in pk:
    u='https://api.npmjs.org/versions/'+p.replace('/','%2F')+'/last-week'
    for i in range(3):
        try: out[p]=json.load(urllib.request.urlopen(u,timeout=30)).get('downloads'); break
        except Exception as e: out[p]={'error':str(e)}; time.sleep(2)
    time.sleep(0.2)
json.dump(out,open('npm_versions.json','w'),indent=1)
print(len(out))
