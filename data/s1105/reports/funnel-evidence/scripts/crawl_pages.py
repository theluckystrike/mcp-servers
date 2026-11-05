import re, sys, json, time, subprocess
from urllib.parse import urljoin
base = sys.argv[1]; out = sys.argv[2]
locs = re.findall(r'<loc>([^<]+)</loc>', open(base + '/sitemap.xml').read())[:200]
hrefre = re.compile(r'''(?:href|action|data-href|src)\s*=\s*["']([^"']+)["']''', re.I)
# also bare absolute URLs in text/JSON that mention buy/checkout
bare = re.compile(r'https?://[^\s"\'<>)\\]+')
want = re.compile(r'/buy/|checkout|buy\.stripe', re.I)
res = {}
status = {}
for i, u in enumerate(locs):
    t0 = time.time()
    p = subprocess.run(['curl','-sS','--max-time','30','-A','mcp-audit-s1105/1','-o','-','-w','\n__HTTP__%{http_code}',u],capture_output=True,text=True,errors='replace')
    body = p.stdout
    code = body.rsplit('__HTTP__',1)[-1].strip() if '__HTTP__' in body else 'ERR'
    body = body.rsplit('\n__HTTP__',1)[0]
    status[u] = code
    found = set()
    for h in hrefre.findall(body):
        if want.search(h): found.add(urljoin(u, h.replace('&amp;','&')))
    for h in bare.findall(body):
        if want.search(h): found.add(h.replace('&amp;','&').rstrip('.,;'))
    for h in found: res.setdefault(h, []).append(u)
    sys.stderr.write(f'{i+1}/{len(locs)} {code} {len(found)} {u}\n')
    dt = time.time() - t0
    if dt < 1.0: time.sleep(1.0 - dt)
json.dump({'pages': status, 'links': res}, open(out, 'w'), indent=1)
print(len(locs), 'pages;', len(res), 'unique matching links')
