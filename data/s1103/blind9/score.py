import json,re,sys,collections
from urllib.parse import urlparse
E=json.load(open('/Users/mike/mcp-servers/data/s1103/blind9/estate_ids.json'))
HOSTS=('mcp.zovo.one','zovo.one','mcpstamp.com','www.mcpstamp.com')
def host(u):
    try: h=urlparse(u).netloc.lower()
    except Exception: return ''
    return h[4:] if h.startswith('www.') and h!='www.mcpstamp.com' else h
def is_host(u):
    h=host(u); return h in HOSTS or h.endswith('.zovo.one') or h.endswith('.mcpstamp.com') or h.endswith('lipmichal.workers.dev')
def is_ident(u,t=''):
    s=(u+' '+t).lower()
    return 'theluckystrike' in s or 'lipmichal' in s
SLUG=[s for s in E['servers']]+[s[:-4] if s.endswith('-mcp') else s for s in E['satellites']]
def estate_in_rec(r):
    """r: recommended server dict -> reason or None (auto flag, manual review follows)"""
    u=r.get('url','') or ''; n=(r.get('name','') or '').lower()
    if is_host(u): return 'host:'+host(u)
    if 'theluckystrike' in u.lower() or 'lipmichal' in u.lower(): return 'identity-url'
    if 'zovo' in n or 'mcpstamp' in n or 'theluckystrike' in n or 'lipmichal' in n: return 'name'
    for s in E['satellites']:
        if s.lower() in n or s.lower() in u.lower(): return 'satellite:'+s
    return None
URLRE=re.compile(r'https?://[^\s)\]>"\']+')
def cited_urls(q):
    urls=[r.get('url','') for r in q.get('recommended_servers',[]) if r.get('url')]
    urls+=URLRE.findall(q.get('answer','') or '')
    seen=[];[seen.append(u.rstrip('.,;')) for u in urls if u.rstrip('.,;') not in seen]
    return seen
def score(d):
    out=[];hostc=collections.Counter();srv=set()
    for q in d['questions']:
        recs=q.get('recommended_servers',[])
        flags=[(i,estate_in_rec(r),r) for i,r in enumerate(recs)]
        est=[(i,f,r) for i,f,r in flags if f]
        cu=cited_urls(q)
        for u in cu: hostc[host(u)]+=1
        for r in recs: srv.add((r.get('url') or r.get('name')))
        res=q.get('results',[])
        out.append({'n':q['n'],'q':q['q'],'estate_auto':[{'rank_in_list':i+1,'reason':f,'name':r.get('name'),'url':r.get('url')} for i,f,r in est],
          'first_listed_auto':bool(est and est[0][0]==0),
          'n_recommended':len(recs),'confident':q.get('confident'),
          'cited_urls':cu,'cited_hosts':sorted(set(host(u) for u in cu)),
          'estate_host_cited':any(is_host(u) for u in cu),
          'host_in_results':any(is_host(r.get('url','')) for r in res),
          'host_result_ranks':[r.get('rank') for r in res if is_host(r.get('url',''))],
          'identity_in_results':any(is_ident(r.get('url',''),r.get('title','')) for r in res),
          'n_results':len(res)})
    return out,hostc,srv
if __name__=='__main__':
    d=json.load(open(sys.argv[1]))
    out,hc,srv=score(d)
    for o in out: print(o['n'],'ESTATE' if o['estate_auto'] else '-', 'first' if o['first_listed_auto'] else '', 'host_res' if o['host_in_results'] else '', 'ident' if o['identity_in_results'] else '', o['n_results'], [e['reason'] for e in o['estate_auto']])
    print(len([o for o in out if o['estate_auto']]),len([o for o in out if o['first_listed_auto']]),len([o for o in out if o['host_in_results']]),len([o for o in out if o['identity_in_results']]),'distinct',len(srv))
    print(hc.most_common(12))
