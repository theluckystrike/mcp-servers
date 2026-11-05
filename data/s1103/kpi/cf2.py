import os,json,urllib.request,datetime,collections
T=os.environ['CLOUDFLARE_API_TOKEN']; ACC='dd3f2a29b7707e21a87f26a622c0bb9d'
def gql(q,v):
    r=urllib.request.Request('https://api.cloudflare.com/client/v4/graphql',data=json.dumps({'query':q,'variables':v}).encode(),headers={'Authorization':'Bearer '+T,'Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(r,timeout=60))
Q='''query($acc:String!,$s:Time!,$e:Time!,$n:[string!]){viewer{accounts(filter:{accountTag:$acc}){workersInvocationsAdaptive(limit:10000,filter:{datetime_geq:$s,datetime_lt:$e,scriptName_in:$n}){sum{requests errors} quantiles{cpuTimeP50} dimensions{scriptName status date:datetimeHour}}}}}'''
Q=Q.replace('[string!]','[String!]').replace('quantiles{cpuTimeP50} ','')
import os as _os
import glob as _g
_all=sorted(d for d in _os.listdir('/Users/mike/mcp-servers/satellites') if d.endswith('-mcp'))
SAT=[n for n in _all if _g.glob(f'/Users/mike/mcp-servers/data/s1030/{n}.json') or _g.glob(f'/Users/mike/mcp-servers/data/s1102/{n}.json')]
EXTRA=[n for n in _all if n not in SAT]  # in-progress satellites from other lanes (no results json yet); queried for completeness only
assert len(SAT)==20,len(SAT)
names=SAT+EXTRA+['mcp-remote']  # s1103: the 20 measured satellites + extras + mcp-remote
print('EXTRA',EXTRA)
now=datetime.datetime.utcnow().replace(microsecond=0)
# window: start of UTC day 7 days ago.. now ; first check retention by going 8 days back
res={}
tot={}
for days in (9,):
    s=datetime.datetime(2026,10,26).isoformat()+'Z'; e=now.isoformat()+'Z'  # s1103: from 10-26 00:00Z
    r=gql(Q,{'acc':ACC,'s':s,'e':e,'n':names})
    if r.get('errors'): print(r['errors'])
    rows=r['data']['viewer']['accounts'][0]['workersInvocationsAdaptive']
    print('rows',len(rows))
    agg=collections.defaultdict(lambda: collections.defaultdict(lambda: collections.Counter()))
    for x in rows:
        d=x['dimensions']; day=d['date'][:10]
        agg[d['scriptName']][day][d['status']]+=x['sum']['requests']
        agg[d['scriptName']][day]['_errors']+=x['sum']['errors']
    res={k:{d:dict(v) for d,v in sorted(vv.items())} for k,vv in agg.items()}
    hourly=collections.defaultdict(lambda: collections.Counter())
    for x in rows:
        hourly[x['dimensions']['scriptName']][x['dimensions']['date']]+=x['sum']['requests']
    out={'sat':SAT,'extra':EXTRA,'window':[s,e],'rows':len(rows),'per_script_per_day_status':res,'per_script_hourly':{k:dict(sorted(v.items())) for k,v in hourly.items()}}
json.dump(out,open('cf.json','w'),indent=1)  # s1103: cwd is s1103/kpi
days=sorted({d for v in res.values() for d in v})
print(days)
for n in names:
    print(n,[sum(v for k,v in res.get(n,{}).get(d,{}).items() if k!='_errors') for d in days], {k for d in res.get(n,{}).values() for k in d})
