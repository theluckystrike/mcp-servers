import json,sys,urllib.parse
sys.path.insert(0,'/Users/mike/mcp-servers/scripts'); import gsc_tool as g
t=g.token(); P='sc-domain:mcpstamp.com'
r=g.call(t,'POST','/sites/'+urllib.parse.quote(P,safe='')+'/searchAnalytics/query',{'startDate':'2026-10-06','endDate':'2026-11-03','dimensions':['query','page'],'rowLimit':1000,'dataState':'all'})
rows=r.get('rows',[]); json.dump(rows,open('gsc_q28.json','w'),indent=1)
print(len(rows), sum(x['impressions'] for x in rows))
for x in sorted(rows,key=lambda x:-x['impressions']): print(x['keys'][0],'|',x['keys'][1].replace('https://www.mcpstamp.com',''),x['impressions'],round(x['position'],1))
