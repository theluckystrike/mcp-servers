import json, urllib.request, urllib.parse, time, string
seeds=[]
for base in ['can claude','can chatgpt','can cursor','how to make claude','claude mcp','mcp server for']:
    seeds.append(base+' ')
    for c in string.ascii_lowercase:
        seeds.append(f'{base} {c}')
out={}
for s in seeds:
    u='https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q='+urllib.parse.quote(s)
    try:
        r=json.loads(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=15).read().decode('utf-8','replace'))
        out[s]=r[1]
    except Exception as e:
        out[s]=['ERR '+str(e)[:60]]
    time.sleep(0.4)
json.dump(out,open('suggest.json','w'),indent=1)
allq=sorted({q for v in out.values() for q in v if not q.startswith('ERR')})
open('suggest.txt','w').write('\n'.join(allq))
print(len(allq), sum(1 for v in out.values() if v and v[0].startswith('ERR')),'errors')
