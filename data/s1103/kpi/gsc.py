import json,sys,urllib.parse,urllib.request
sys.path.insert(0,'/Users/mike/mcp-servers/scripts')
import gsc_tool as g
tok=g.token()
sites=g.call(tok,'GET','/sites')['siteEntry']
def q(site,s,e,state,dims=None,filt=None,limit=25000):
    body={'startDate':s,'endDate':e,'dataState':state,'rowLimit':limit}
    if dims: body['dimensions']=dims
    if filt: body['dimensionFilterGroups']=[{'filters':[filt]}]
    return g.call(tok,'POST','/sites/'+urllib.parse.quote(site,safe='')+'/searchAnalytics/query',body)
W={'final_28d':('2026-10-04','2026-10-31','final'),'all_28d_to_today':('2026-10-06','2026-11-02','all')}  # s1103: final data ends 10-31, fresh (all) ends 11-02 (probe 2026-11-03)
out={'sites':[],'windows':W}
for s in sites:
    u=s['siteUrl']; r={'site':u,'perm':s['permissionLevel']}
    for k,(a,b,st) in W.items():
        d=q(u,a,b,st)
        if 'error' in d: r[k]={'error':d['error'],'body':d['body'][:150]}
        else:
            rows=d.get('rows',[]); r[k]={'clicks':sum(x['clicks'] for x in rows),'impressions':sum(x['impressions'] for x in rows)}
    out['sites'].append(r)
# mcp.zovo.one page filter
z={}
for k,(a,b,st) in W.items():
    f={'dimension':'page','operator':'contains','expression':'//mcp.zovo.one/'}
    pg=q('sc-domain:zovo.one',a,b,st,['page'],f)
    z[k]={'clicks':sum(x['clicks'] for x in pg.get('rows',[])),'impressions':sum(x['impressions'] for x in pg.get('rows',[])),'pages':len(pg.get('rows',[])),'top':[(x['keys'][0],x['impressions'],x['clicks']) for x in sorted(pg.get('rows',[]),key=lambda x:-x['impressions'])[:8]],'err':pg.get('error')}
    f2={'dimension':'page','operator':'notContains','expression':'//mcp.zovo.one/'}
out['mcp_zovo_one']=z
# mcpstamp queries & pages
ms={}
for k,(a,b,st) in W.items():
    p=q('sc-domain:mcpstamp.com',a,b,st,['page']); qq=q('sc-domain:mcpstamp.com',a,b,st,['query'])
    ms[k]={'pages':[(x['keys'][0],x['impressions'],x['clicks']) for x in sorted(p.get('rows',[]),key=lambda x:-x['impressions'])[:10]],'queries':[(x['keys'][0],x['impressions'],x['clicks']) for x in sorted(qq.get('rows',[]),key=lambda x:-x['impressions'])[:10]]}
out['mcpstamp_detail']=ms
out['mcpstamp_sitemaps']=g.call(tok,'GET','/sites/sc-domain%3Amcpstamp.com/sitemaps')
out['mcpstamp_sitemaps_www']=g.call(tok,'GET','/sites/sc-domain%3Amcpstamp.com/sitemaps')
# s1103 extras: per-day rows for mcpstamp.com and mcp.zovo.one pages (fresh window), and the site list
d1=q('sc-domain:mcpstamp.com','2026-10-20','2026-11-02','all',['date'])
out['mcpstamp_by_day']=[(x['keys'][0],x['impressions'],x['clicks']) for x in d1.get('rows',[])]
d2=q('sc-domain:zovo.one','2026-10-20','2026-11-02','all',['date'],{'dimension':'page','operator':'contains','expression':'//mcp.zovo.one/'})
out['mcp_zovo_one_by_day']=[(x['keys'][0],x['impressions'],x['clicks']) for x in d2.get('rows',[])]
out['site_list']=[s['siteUrl'] for s in sites]
json.dump(out,open('gsc.json','w'),indent=1)
