import json, re, subprocess, sys, time, html
from urllib.parse import urlparse
S='/private/tmp/claude-501/-Users-mike/45fe5236-4e4e-45a6-a3ad-cec4f85b961e/scratchpad'
d=json.load(open(S+'/crawl/pages_links.json'))
links=sorted(d['links'])
UA='mcp-audit-s1105/1'
def head(u):
    p=subprocess.run(['curl','-sS','-I','-L','--max-time','25','-A',UA,'-H','x-mcp-probe: 1','-o','/dev/null','-D','-','-w','\n__FINAL__ %{http_code} %{url_effective} %{num_redirects}',u],capture_output=True,text=True,errors='replace')
    out=p.stdout; err=p.stderr.strip()
    fin=out.rsplit('__FINAL__',1)
    meta=fin[1].split() if len(fin)==2 else []
    blocks=[b for b in re.split(r'\r?\n\r?\n',fin[0]) if b.strip().startswith('HTTP')]
    last=blocks[-1] if blocks else ''
    mb=re.search(r'(?im)^x-mcp-buy:\s*(.+)$',last)
    chain=[b.split('\n',1)[0].strip() for b in blocks]
    return {'url':u,'code':meta[0] if meta else 'ERR','final':meta[1] if len(meta)>1 else '','redirects':meta[2] if len(meta)>2 else '','x_mcp_buy':mb.group(1).strip() if mb else '','chain':chain,'err':err[:120]}
res=[]
for i,u in enumerate(links):
    t0=time.time()
    u2=html.unescape(u)
    if '&lt;' in u or '<' in u2:
        r={'url':u,'code':'SKIP','final':'','redirects':'','x_mcp_buy':'','chain':[],'err':'html-escaped placeholder, not a real href'}
    else:
        r=head(u2)
    res.append(r)
    sys.stderr.write(f'H {i+1}/{len(links)} {r["code"]} {r["x_mcp_buy"]} {u[:80]}\n')
    dt=time.time()-t0
    if dt<1: time.sleep(1-dt)
json.dump(res,open(S+'/crawl/head_results.json','w'),indent=1)
# GET once per distinct id (first URL seen), check for working intent form
seen={}
for u in links:
    m=re.search(r'/buy/([^/?#]+)',u)
    if m and '&lt;' not in u and m.group(1) not in seen: seen[m.group(1)]=u
gres=[]
for j,(bid,u) in enumerate(sorted(seen.items())):
    t0=time.time()
    p=subprocess.run(['curl','-sS','-L','--max-time','25','-A',UA,'-H','x-mcp-probe: 1','-w','\n__FINAL__ %{http_code} %{url_effective}',u],capture_output=True,text=True,errors='replace')
    body,_,fin=p.stdout.rpartition('\n__FINAL__ ')
    code,_,eff=fin.partition(' ')
    form=re.search(r'<form[^>]*method="post"[^>]*action="([^"]+)"',body,re.I)
    btn=re.search(r'<button[^>]*type="submit"[^>]*>(.*?)</button>',body,re.I|re.S)
    price=re.findall(r'\$\d+(?:\.\d\d)?',btn.group(1)) if btn else []
    h1=re.search(r'<h1>(.*?)</h1>',body,re.S)
    gres.append({'id':bid,'url':u,'code':code,'final':eff,'has_post_form':bool(form),'form_action':form.group(1) if form else '','button':re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>','',btn.group(1)))).strip() if btn else '','h1':re.sub(r'<[^>]+>','',h1.group(1)).strip() if h1 else '','stripe_mentioned':'Stripe' in body})
    sys.stderr.write(f'G {j+1}/{len(seen)} {code} form={bool(form)} {bid}\n')
    dt=time.time()-t0
    if dt<1: time.sleep(1-dt)
json.dump(gres,open(S+'/crawl/get_results.json','w'),indent=1)
print('done',len(res),len(gres))
