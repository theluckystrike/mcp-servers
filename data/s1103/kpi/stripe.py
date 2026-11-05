import json,subprocess,time,collections,urllib.parse
now=int(time.time())
def pull(days):
    since=now-days*86400; cur=None; rows=[]; pages=0
    while True:
        a=['stripe','-p','worthmyclaim','get','/v1/checkout/sessions','--live','-d','limit=100','-d',f'created[gte]={since}']
        if cur: a+=['-d','starting_after='+cur]
        r=subprocess.run(a,capture_output=True,text=True,timeout=60); assert r.returncode==0,r.stderr[:200]
        p=json.loads(r.stdout); pages+=1
        for s in p['data']:
            try: u=urllib.parse.urlparse(s.get('success_url') or ''); host=u.hostname or ''
            except: host='?'
            rows.append((host,s['status'],s['payment_status'],(s.get('metadata') or {}).get('probe'),s.get('amount_total') or 0,s.get('currency'),'utm_source=mcp' in (s.get('success_url') or '')+(s.get('cancel_url') or '')))
        if not p['has_more']: break
        cur=p['data'][-1]['id']; assert pages<50
    return rows,pages
out={'generated':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'cmd':"stripe get /v1/checkout/sessions --live -d limit=100 -d created[gte]=<now-N d> (cursor to has_more=false); aggregates only, no PII stored"}
for d in (7,28):
    rows,pages=pull(d)
    mcp=[r for r in rows if r[0]=='mcp.zovo.one' or r[6]]
    out[f'd{d}']={'pages':pages,'all_sessions':len(rows),'all_paid':sum(1 for r in rows if r[2]=='paid'),'hosts':dict(collections.Counter(r[0] for r in rows)),
      'mcp_sessions':len(mcp),'mcp_by_status':dict(collections.Counter((r[1],r[2]) for r in mcp) and {f'{k[0]}/{k[1]}':v for k,v in collections.Counter((r[1],r[2]) for r in mcp).items()}),
      'mcp_probe_tagged':sum(1 for r in mcp if r[3]=='1'),'mcp_paid':sum(1 for r in mcp if r[2]=='paid'),'mcp_paid_untagged':sum(1 for r in mcp if r[2]=='paid' and r[3]!='1'),
      'mcp_paid_gross_minor':{}}
    for r in mcp:
        if r[2]=='paid': out[f'd{d}']['mcp_paid_gross_minor'][r[5]]=out[f'd{d}']['mcp_paid_gross_minor'].get(r[5],0)+r[4]
json.dump(out,open('stripe.json','w'),indent=1); print(json.dumps(out,indent=1))
