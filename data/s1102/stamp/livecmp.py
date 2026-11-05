import re,sys,subprocess,pathlib,html
DIST=pathlib.Path('/Users/mike/mcpstamp-work/s1102-stamp/repo/site/dist')
out=pathlib.Path('livecmp'); out.mkdir(exist_ok=True)
def fetch(u):
    return subprocess.run(['curl','-s','-m','20','-A','curl/8.7.1',u],capture_output=True,text=True).stdout
sm=fetch('https://www.mcpstamp.com/sitemap.xml')
live=re.findall(r'<loc>(.*?)</loc>',sm)
mine=re.findall(r'<loc>(.*?)</loc>',(DIST/'sitemap.xml').read_text())
print('live sitemap',len(live),'mine',len(mine))
print('in live not mine:',sorted(set(live)-set(mine)))
print('in mine not live:',len(set(mine)-set(live)),sorted(set(mine)-set(live))[:3])
def norm(t):
    t=re.sub(r'/_astro/[^"\' )]+','/_astro/X',t)
    t=re.sub(r'data-astro-cid-[a-z0-9]+','',t)
    t=re.sub(r'astro-[a-z0-9]{8}','astro-X',t)
    # remove my additions
    t=t.replace('<a href="/free-servers/" class="nav-link"  >Free servers</a>','')
    t=re.sub(r'<a href="/free-servers/"[^>]*>(<span[^>]*>\d+</span>)?Free servers</a>','',t)
    t=t.replace('<li><a href="/free-servers/">Free live-data servers</a></li>','')
    t=re.sub(r'<!-- FREE LIVE-DATA.*?</section>','',t,flags=re.S)
    t=re.sub(r'<section id="free-servers".*?</section>','',t,flags=re.S)
    return t
diff=[]
for u in live:
    p=u.replace('https://www.mcpstamp.com','')
    f=DIST/(p.lstrip('/')+'index.html') if p.endswith('/') else DIST/p.lstrip('/')
    if not f.exists(): diff.append((p,'MISSING')); continue
    a=norm(fetch(u)); b=norm(f.read_text())
    if a!=b:
        # text-only compare
        ta=re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',re.sub(r'<script.*?</script>|<style.*?</style>','',a,flags=re.S))))
        tb=re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',re.sub(r'<script.*?</script>|<style.*?</style>','',b,flags=re.S))))
        diff.append((p,'TEXT' if ta!=tb else 'markup-only'))
        if ta!=tb and len([d for d in diff if d[1]=='TEXT'])<=3:
            (out/(p.strip('/').replace('/','_') or 'home')).with_suffix('.live.txt').write_text(ta)
            (out/(p.strip('/').replace('/','_') or 'home')).with_suffix('.mine.txt').write_text(tb)
from collections import Counter
print(Counter(d[1] for d in diff), 'of', len(live))
for d in diff[:15]: print(d)
