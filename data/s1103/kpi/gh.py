import json,subprocess,glob
sat=sorted({json.load(open(f))['repo'] for f in glob.glob('/Users/mike/mcp-servers/data/s1030/*-mcp.json')+glob.glob('/Users/mike/mcp-servers/data/s1102/*-mcp.json')})  # s1103: 20 satellites
mir=[x['repo'] for x in json.load(open('/Users/mike/mcp-servers/data/s1030/github_raw.json'))]
def api(p):
    r=subprocess.run(['gh','api',p],capture_output=True,text=True,timeout=60)
    try: return json.loads(r.stdout)
    except: return {'error':(r.stdout+r.stderr)[:200]}
def pull(full):
    v=api(f'repos/{full}/traffic/views'); c=api(f'repos/{full}/traffic/clones'); ref=api(f'repos/{full}/traffic/popular/referrers'); pa=api(f'repos/{full}/traffic/popular/paths'); r=api(f'repos/{full}')
    return {'repo':full,'private':r.get('private'),'stars':r.get('stargazers_count'),'views':v.get('count'),'view_uniques':v.get('uniques'),
     'views_by_day':[(d['timestamp'][:10],d['count'],d['uniques']) for d in v.get('views',[])] if 'views' in v else None,
     'clones':c.get('count'),'clone_uniques':c.get('uniques'),'clones_by_day':[(d['timestamp'][:10],d['count'],d['uniques']) for d in c.get('clones',[])] if 'clones' in c else None,
     'referrers':ref if isinstance(ref,list) else ref,'paths':pa if isinstance(pa,list) else pa,'err':[x.get('error') or x.get('message') for x in (v,c,r) if isinstance(x,dict) and (x.get('error') or x.get('message'))]}
out={'satellites':[pull('theluckystrike/'+s) for s in sat],'mirrors_all':[pull(m) for m in mir]}
json.dump(out,open('gh.json','w'),indent=1)
