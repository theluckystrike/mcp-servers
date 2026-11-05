exec(open('ga4b.py').read().split("anyf=")[0])
f={'filter':{'fieldName':'sessionSource','stringFilter':{'matchType':'EXACT','value':'mcp'}}}
r=rep('properties/555964379',['dateHourMinute','country','deviceCategory','browser','operatingSystem'],['sessions','engagedSessions'],f)
out=[([d['value'] for d in x['dimensionValues']],[v['value'] for v in x['metricValues']]) for x in r.get('rows',[])]
json.dump(out,open('ga4_ingredient_mcp_sessions.json','w')); print(out)
