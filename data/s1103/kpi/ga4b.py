exec(open('ga4.py').read().split("summ=req")[0])
import json
props=json.load(open('ga4.json'))['properties']
def rep(pid,dims,mets,filt,start='28daysAgo',lim=200):
    body={'dateRanges':[{'startDate':start,'endDate':'today'}],'dimensions':[{'name':n} for n in dims],'metrics':[{'name':m} for m in mets],'limit':lim,'dimensionFilter':filt}
    return req(f'https://analyticsdata.googleapis.com/v1beta/{pid}:runReport',body)
anyf={'orFilterGroup' if False else 'orGroup':{'expressions':[
 {'filter':{'fieldName':'sessionSource','stringFilter':{'matchType':'CONTAINS','value':'mcp','caseSensitive':False}}},
 {'filter':{'fieldName':'sessionMedium','stringFilter':{'matchType':'CONTAINS','value':'mcp','caseSensitive':False}}},
 {'filter':{'fieldName':'sessionCampaignName','stringFilter':{'matchType':'CONTAINS','value':'mcp','caseSensitive':False}}}]}}
out={}
for pid,name in props:
    r=rep(pid,['date','sessionSource','sessionMedium','sessionCampaignName','landingPagePlusQueryString'],['sessions','activeUsers','engagedSessions','averageSessionDuration'],anyf)
    rows=r.get('rows',[])
    if 'error' in r: out[name]={'error':r}; continue
    if rows: out[name]=[([d['value'] for d in x['dimensionValues']],[v['value'] for v in x['metricValues']]) for x in rows]
json.dump(out,open('ga4_mcp_detail.json','w'),indent=1)
for k,v in out.items(): print(k,json.dumps(v)[:1500])
# mcp.zovo.one hostname in zovo.one property
hf={'filter':{'fieldName':'hostName','stringFilter':{'matchType':'EXACT','value':'mcp.zovo.one'}}}
r=rep('properties/521066195',['sessionSource'],['sessions','activeUsers'],hf)
print('mcp.zovo.one host',json.dumps(r)[:600])
# tracking presence check for properties: whether property gets any traffic since 7daysAgo
