import os,json,urllib.request,datetime,sys
T=os.environ['CLOUDFLARE_API_TOKEN']; ACC='dd3f2a29b7707e21a87f26a622c0bb9d'
def gql(q,v):
    r=urllib.request.Request('https://api.cloudflare.com/client/v4/graphql',data=json.dumps({'query':q,'variables':v}).encode(),headers={'Authorization':'Bearer '+T,'Content-Type':'application/json'})
    try: return json.load(urllib.request.urlopen(r,timeout=60))
    except urllib.error.HTTPError as e: return {'http':e.code,'body':e.read().decode()[:500]}
Q='''query($acc:String!,$s:Time!,$e:Time!){viewer{accounts(filter:{accountTag:$acc}){workersInvocationsAdaptive(limit:10000,filter:{datetime_geq:$s,datetime_lt:$e}){sum{requests errors subrequests} dimensions{scriptName status date:datetimeHour}}}}}'''
now=datetime.datetime.utcnow().replace(microsecond=0)
s=(now-datetime.timedelta(days=7)).isoformat()+'Z'; e=now.isoformat()+'Z'
r=gql(Q,{'acc':ACC,'s':s,'e':e})
json.dump(r,open('cf_raw.json','w'))
print(json.dumps(r)[:600])
