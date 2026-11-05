import json,sys,urllib.parse
sys.path.insert(0,'/Users/mike/mcp-servers/scripts'); import gsc_tool as g
t=g.token(); P='/sites/'+urllib.parse.quote('sc-domain:mcpstamp.com',safe='')+'/searchAnalytics/query'
q=lambda dims: g.call(t,'POST',P,{'startDate':'2026-10-06','endDate':'2026-11-03','dimensions':dims,'rowLimit':1000,'dataState':'all'}).get('rows',[])
d=q(['date']); pg=q(['page']); qq=q(['query'])
json.dump({'date':d,'page':pg,'query':qq},open('gsc_dims28.json','w'),indent=1)
for x in d: print(x['keys'][0],x['impressions'],x['clicks'])
print('pages',len(pg)); [print(x['keys'][0].replace('https://www.mcpstamp.com',''),x['impressions'],round(x['position'],1)) for x in sorted(pg,key=lambda x:-x['impressions'])[:25]]
print('queries',len(qq))
