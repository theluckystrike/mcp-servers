import sys,json,time,base64,urllib.parse,urllib.request,urllib.error
sys.path.insert(0,'/Users/mike/mcp-servers/scripts')
import gsc_tool as g
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
adc=json.load(open(g.ADC))
b=lambda x: base64.urlsafe_b64encode(x).rstrip(b'=')
now=int(time.time())
h=b(json.dumps({'alg':'RS256','typ':'JWT'}).encode()); p=b(json.dumps({'iss':adc['client_email'],'scope':'https://www.googleapis.com/auth/analytics.readonly','aud':adc['token_uri'],'exp':now+3000,'iat':now}).encode())
k=serialization.load_pem_private_key(adc['private_key'].encode(),password=None)
s=b(k.sign(h+b'.'+p,padding.PKCS1v15(),hashes.SHA256()))
d=urllib.parse.urlencode({'grant_type':'urn:ietf:params:oauth:grant-type:jwt-bearer','assertion':(h+b'.'+p+b'.'+s).decode()}).encode()
T=json.loads(urllib.request.urlopen(urllib.request.Request(adc['token_uri'],data=d),timeout=30).read())['access_token']
def req(u,body=None):
    r=urllib.request.Request(u,data=json.dumps(body).encode() if body else None,headers={'Authorization':'Bearer '+T,'Content-Type':'application/json'})
    try: return json.loads(urllib.request.urlopen(r,timeout=60).read())
    except urllib.error.HTTPError as e: return {'error':e.code,'body':e.read().decode()[:400]}
summ=req('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200')
props=[(p['property'],p['displayName']) for a in summ.get('accountSummaries',[]) for p in a.get('propertySummaries',[])]
print(len(props),props)
out={'properties':props,'reports':{}}
def report(pid,dims,filt=None,start='28daysAgo'):
    body={'dateRanges':[{'startDate':start,'endDate':'today'}],'dimensions':[{'name':n} for n in dims],'metrics':[{'name':'sessions'},{'name':'activeUsers'}],'limit':1000}
    if filt: body['dimensionFilter']=filt
    return req(f'https://analyticsdata.googleapis.com/v1beta/{pid}:runReport',body)
mcpf={'filter':{'fieldName':'sessionSource','stringFilter':{'matchType':'EXACT','value':'mcp'}}}
for pid,name in props:
    tot=report(pid,['sessionSource'],None)
    m=report(pid,['sessionSource','sessionMedium','sessionCampaignName'],mcpf)
    r={'name':name}
    if 'error' in tot: r['error']=tot
    else:
        rows=tot.get('rows',[]); r['sessions_28d']=sum(int(x['metricValues'][0]['value']) for x in rows)
        r['top_sources']=[(x['dimensionValues'][0]['value'],int(x['metricValues'][0]['value'])) for x in sorted(rows,key=lambda x:-int(x['metricValues'][0]['value']))[:5]]
        r['mcp_rows']=[([d['value'] for d in x['dimensionValues']],[v['value'] for v in x['metricValues']]) for x in m.get('rows',[])]
        r['mcp_sessions_28d']=sum(int(x['metricValues'][0]['value']) for x in m.get('rows',[]))
    out['reports'][pid]=r
json.dump(out,open('ga4.json','w'),indent=1)
for pid,r in out['reports'].items(): print(pid,r.get('name'),r.get('sessions_28d'),r.get('mcp_sessions_28d'),r.get('error'),r.get('top_sources',[])[:3])
