# s1103 npm re-measure. Derived from s1102/kpi/npm.py; output -> ./npm.json (cwd = s1103/kpi)
import json,urllib.request,time,datetime
rows=[l.split('\t') for l in open('/Users/mike/mcp-servers/data/s1030/npm-registry-check.tsv').read().strip().split('\n')]
pk=[r[1] for r in rows]
CTRL='@modelcontextprotocol/sdk'
RANGE='2026-10-30:2026-11-03'
def get(u):
    err=None
    for i in range(4):
        try: return json.load(urllib.request.urlopen(u,timeout=30))
        except Exception as e:
            err=str(e)
            if '404' in err: return {'error':err}
            time.sleep(2*(i+1))
    return {'error':err}
def enc(p): return p.replace('/','%2F')
out={'generated':datetime.datetime.utcnow().isoformat()+'Z','range':RANGE,'cmd':'GET https://api.npmjs.org/downloads/range/'+RANGE+'/<pkg>; GET https://registry.npmjs.org/<pkg> (time.created)','packages':[]}
for p in [CTRL]+pk:
    r=get(f'https://api.npmjs.org/downloads/range/{RANGE}/{enc(p)}')
    rg=get(f'https://registry.npmjs.org/{enc(p)}') if p!=CTRL else {}
    wk=get(f'https://api.npmjs.org/downloads/point/last-week/{enc(p)}')
    ld=get(f'https://api.npmjs.org/downloads/point/last-day/{enc(p)}')
    days={d['day']:d['downloads'] for d in r.get('downloads',[])} if isinstance(r.get('downloads'),list) else None
    out['packages'].append({'pkg':p,'days':days,'range_err':r.get('error'),'last_week':wk.get('downloads'),'last_week_window':f"{wk.get('start')}..{wk.get('end')}",'last_day':ld.get('downloads'),'last_day_window':f"{ld.get('start')}..{ld.get('end')}",
        'created':(rg.get('time') or {}).get('created'),'modified':(rg.get('time') or {}).get('modified'),'latest':(rg.get('dist-tags') or {}).get('latest'),'registry_err':rg.get('error')})
    time.sleep(0.25)
json.dump(out,open('npm.json','w'),indent=1)
print(len(out['packages']),'packages written')
