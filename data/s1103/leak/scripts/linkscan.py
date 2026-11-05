import re, sys, json, urllib.request, urllib.parse, concurrent.futures as cf
H={'User-Agent':'mcp-leak/1','x-mcp-probe':'1','Accept':'text/html'}
def get(u, method='GET'):
    req=urllib.request.Request(u, headers=H, method=method)
    class NR(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*a,**k): return None
    op=urllib.request.build_opener(NR)
    try:
        r=op.open(req, timeout=20); return r.status, (r.read(3_000_000).decode('utf-8','replace') if method=='GET' else ''), r.headers
    except urllib.error.HTTPError as e: return e.code, '', e.headers
    except Exception as e: return 0, str(e), {}
def locs(sm):
    s,b,_=get(sm); return re.findall(r'<loc>([^<]+)', b)
pages=[]
pages+=locs('https://mcp.zovo.one/sitemap.xml')
pages+=locs('https://www.mcpstamp.com/sitemap.xml')
pages+=[u for u in locs('https://claudecodeguides.com/sitemap.xml') if '/mcp/' in u]
pages+=['https://mcp.zovo.one/','https://www.mcpstamp.com/','https://claudecodeguides.com/mcp/']
pages=sorted(set(pages))
print('pages',len(pages),file=sys.stderr)
links={}  # target -> set(source)
pstat={}
def scan(p):
    s,b,_=get(p); out=set()
    for h in re.findall(r'href="([^"#]+)', b):
        t=urllib.parse.urljoin(p,h)
        host=urllib.parse.urlparse(t).netloc
        if host in ('mcp.zovo.one','www.mcpstamp.com','mcpstamp.com','claudecodeguides.com') and t.startswith('http'):
            out.add(t)
    return p,s,out
with cf.ThreadPoolExecutor(6) as ex:
    for p,s,out in ex.map(scan,pages):
        pstat[p]=s
        for t in out: links.setdefault(t,set()).add(p)
print('targets',len(links),file=sys.stderr)
def norm(t):
    # /buy/ links: check GET (intent page, no Stripe side effect); strip query for dedupe of other links
    return t
def chk(t):
    m='GET' if '/buy/' in t else 'HEAD'
    s,_,h=get(t,m)
    if s in (405,0) and m=='HEAD': s,_,h=get(t,'GET')
    return t,s,(h.get('location') if h else None),(h.get('x-mcp-buy') if h else None)
bad=[]
with cf.ThreadPoolExecutor(6) as ex:
    for t,s,loc,xb in ex.map(chk,sorted(links)):
        if s>=400 or s==0: bad.append({'url':t,'status':s,'x_mcp_buy':xb,'sources':sorted(links[t])[:5],'n_sources':len(links[t])})
res={'pages':len(pages),'page_errors':{p:s for p,s in pstat.items() if s>=400 or s==0},'targets':len(links),'buy_targets':sum('/buy/' in t for t in links),'broken':bad}
json.dump(res,open(sys.argv[1],'w'),indent=1)
print(json.dumps({k:(v if k!='broken' else len(v)) for k,v in res.items()}))
