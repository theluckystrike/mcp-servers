# merge content fragments A/B into site pages.json + data/content/jobs.json (source tree ~/mcp-site-2026-10-30)
import json, sys, re
B='/Users/mike/mcp-site-2026-10-30/repo'
PJ=B+'/site/src/data/pages.json'; JJ=B+'/data/content/jobs.json'
cat=json.load(open(B+'/data/catalog.json'))
tools={s['id']:{t['name'] for t in s.get('tools',[])} for s in cat['servers']}
pages=json.load(open(PJ)); jobs=json.load(open(JJ))
have={p['path'] for p in pages}
added=[]; errs=[]
for f in [a for a in sys.argv[1:] if not a.startswith("--")]:
    d=json.load(open(f))
    for p in d['pages']:
        path=p['path']
        if path in have: errs.append(f'dup {path}'); continue
        if not re.fullmatch(r'/can-(claude|chatgpt|cursor)/[a-z0-9-]+/',path): errs.append(f'badpath {path}'); continue
        j=d['jobs'].get(path)
        if not j: errs.append(f'nojob {path}'); continue
        bad=[s for s in p['servers'] if s not in tools]
        main=p['servers'][0] if p['servers'] else None
        badt=[st['tool'] for st in j.get('example',{}).get('steps',[]) if not any(st['tool'] in tools.get(s,()) for s in p['servers'])]
        if bad or badt: errs.append(f'tools {path} {bad} {badt}'); continue
        txt=json.dumps(j)+p['title']+p['meta_description']
        if '—' in txt: errs.append(f'emdash {path}'); continue
        p['page_type']='answer'
        pages.append(p); jobs['jobs'][path]=j; have.add(path); added.append(path)
print('added',len(added)); print('\n'.join(errs) or 'no errors')
if '--write' in sys.argv[0:] or True:
    if added and '--dry' not in sys.argv:
        json.dump(pages,open(PJ,'w'),indent=1,ensure_ascii=False); json.dump(jobs,open(JJ,'w'),indent=1,ensure_ascii=False)
        print('written')
