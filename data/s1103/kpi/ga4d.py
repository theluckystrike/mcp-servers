# s1103 extra GA4 checks (read-only): (a) positive control hostName distribution in zovo.one property, (b) mcpstamp.com sessions by day/source/engagement (14d),
# (c) sessions per property by date for 4 days to date the human-plausible signal. Output ./ga4d.json
exec(open('ga4b.py').read().split("anyf=")[0])
out={}
def rep2(pid,dims,mets,filt=None,start='14daysAgo'):
    body={'dateRanges':[{'startDate':start,'endDate':'today'}],'dimensions':[{'name':n} for n in dims],'metrics':[{'name':m} for m in mets],'limit':500}
    if filt: body['dimensionFilter']=filt
    return req(f'https://analyticsdata.googleapis.com/v1beta/{pid}:runReport',body)
r=rep2('properties/521066195',['hostName'],['sessions'],None,'28daysAgo')
out['zovo_one_hostnames_28d']=[(x['dimensionValues'][0]['value'],x['metricValues'][0]['value']) for x in r.get('rows',[])]
r=rep2('properties/561638567',['date','sessionSource','sessionMedium'],['sessions','engagedSessions','activeUsers'])
out['mcpstamp_by_day_source']=[([d['value'] for d in x['dimensionValues']],[v['value'] for v in x['metricValues']]) for x in r.get('rows',[])]
r=rep2('properties/561638567',['landingPagePlusQueryString'],['sessions','engagedSessions'],None,'7daysAgo')
out['mcpstamp_landing_7d']=[([d['value'] for d in x['dimensionValues']],[v['value'] for v in x['metricValues']]) for x in sorted(r.get('rows',[]),key=lambda x:-int(x['metricValues'][0]['value']))[:15]]
# any utm_medium/campaign equal to one of our satellite repo names, any property, 28d
import os
names=sorted(d for d in os.listdir('/Users/mike/mcp-servers/satellites') if d.endswith('-mcp'))
out['satellite_utm_medium_28d']={}
for pid,name in props:
    f={'orGroup':{'expressions':[{'filter':{'fieldName':'sessionMedium','stringFilter':{'matchType':'CONTAINS','value':'-mcp','caseSensitive':False}}},{'filter':{'fieldName':'firstUserMedium','stringFilter':{'matchType':'CONTAINS','value':'-mcp','caseSensitive':False}}}]}}
    r=rep2(pid,['firstUserSource','firstUserMedium','sessionMedium'],['sessions','engagedSessions'],f,'28daysAgo')
    rows=[([d['value'] for d in x['dimensionValues']],[v['value'] for v in x['metricValues']]) for x in r.get('rows',[])]
    if rows or 'error' in r: out['satellite_utm_medium_28d'][name]=rows or r
json.dump(out,open('ga4d.json','w'),indent=1)
print(json.dumps(out)[:3500])
