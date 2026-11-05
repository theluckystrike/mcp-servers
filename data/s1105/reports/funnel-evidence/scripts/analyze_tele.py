import json, re, sys, collections, datetime as dt
from urllib.parse import urlparse, parse_qs, unquote
S='/private/tmp/claude-501/-Users-mike/45fe5236-4e4e-45a6-a3ad-cec4f85b961e/scratchpad'
BOT=re.compile(r"(googlebot|bingbot|claudebot|gptbot|oai-searchbot|chatgpt-user|perplexitybot|ccbot|bytespider|amazonbot|applebot|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|duckduckbot|baiduspider|yandexbot|facebookexternalhit|slackbot|twitterbot|discordbot|telegrambot|linkedinbot|whatsapp|headlesschrome|phantomjs|puppeteer|playwright|selenium|scrapy|crawler|spider|slurp|\bbot\b|bot\/)",re.I)
TOOL=re.compile(r"(curl|libcurl|wget|python-requests|python-urllib|python\/|node-fetch|node\.js|undici|axios|httpie|go-http-client|okhttp|java\/|apache-httpclient|libwww|powershell|postmanruntime|insomnia|guzzle|restsharp|scrapy)",re.I)
def human(h):
    g=lambda k:(h.get(k) or '').lower()
    if g('x-mcp-probe')=='1': return False
    ua=h.get('user-agent') or ''
    if BOT.search(ua) or TOOL.search(ua): return False
    if g('sec-fetch-mode')!='navigate' or g('sec-fetch-dest')!='document': return False
    if not (h.get('referer') or ''): return False
    if not g('sec-fetch-site'): return False
    return True
PRODUCTS=set(open('/Users/mike/mcp-servers/data/s1103/leak/slugs.txt').read().split())|set(open('/Users/mike/mcp-servers/data/s1103/leak/known.txt').read().split())|{'bundle','office-suite'}
def salvageable(asked):
    m=re.match(r'[a-z0-9-]+',asked)
    if not m: return False
    run=m.group(0)
    return run in PRODUCTS or any(run.startswith(p) and False for p in PRODUCTS)
seen=set(); rows=[]
for fn in sys.argv[1:]:
    for line in open(fn):
        r=json.loads(line); e=r['e']
        mid=e['$metadata']['id']
        if mid in seen: continue
        seen.add(mid)
        ev=e['$workers']['event']; rq=ev['request']; rs=ev.get('response') or {}
        u=urlparse(rq['url']); h=rq.get('headers',{})
        if not u.path.startswith('/buy/') or rs.get('status') is None: continue
        ts=dt.datetime.fromtimestamp(e['timestamp']/1000,dt.timezone.utc)
        asked=unquote(u.path[5:]) if '%' not in u.path[5:] or True else u.path[5:]
        try: asked=unquote(u.path[5:])
        except Exception: asked=u.path[5:]
        own=('mcp-audit-s1105' in (h.get('user-agent') or ''))
        rows.append(dict(ts=ts,day=ts.strftime('%m-%d'),method=rq['method'],status=rs.get('status'),path=u.path,asked=asked,src=parse_qs(u.query).get('src',[''])[0],human=human(h),probe=(h.get('x-mcp-probe')=='1'),own=own,ua=(h.get('user-agent') or '')[:60],country=h.get('cf-ipcountry'),ip=h.get('cf-connecting-ip'),referer=h.get('referer') or '',sfs=h.get('sec-fetch-site') or ''))
print('unique /buy/ events',len(rows),'(own s1105 probes excluded below:',sum(r['own'] for r in rows),')')
rows=[r for r in rows if not r['own']]
days=sorted({r['day'] for r in rows})
hdr=['day','all','probe-hdr','GET200','GET200 human','GET404','GET404 human','404 human salvageable','POST','POST303','POST other']
print(' | '.join(hdr))
tot=collections.Counter()
for d in days:
    R=[r for r in rows if r['day']==d]
    c=dict(all=len(R),probe=sum(r['probe'] for r in R),
      g200=sum(r['method']=='GET' and r['status']==200 for r in R),
      g200h=sum(r['method']=='GET' and r['status']==200 and r['human'] for r in R),
      g404=sum(r['method']=='GET' and r['status']==404 for r in R),
      g404h=sum(r['method']=='GET' and r['status']==404 and r['human'] for r in R),
      g404hs=sum(r['method']=='GET' and r['status']==404 and r['human'] and salvageable(r['asked']) is not None and re.match(r'[a-z0-9-]+',r['asked']) and re.match(r'[a-z0-9-]+',r['asked']).group(0) in PRODUCTS for r in R),
      post=sum(r['method']=='POST' for r in R),
      p303=sum(r['method']=='POST' and r['status']==303 for r in R),
      pother=sum(r['method']=='POST' and r['status']!=303 for r in R))
    tot.update(c)
    print(d,*c.values(),sep=' | ')
print('TOTAL',*tot.values(),sep=' | ')
json.dump([{**r,'ts':r['ts'].isoformat()} for r in rows],open(S+'/tele_rows.json','w'))
