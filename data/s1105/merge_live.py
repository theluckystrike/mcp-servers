# append live-answer entries into repo data/content/can-claude-live.json, skipping slug clashes with live or job pages
import json, sys
R='/Users/mike/mcp-site-2026-10-30/repo'; F=R+'/data/content/can-claude-live.json'
doc=json.load(open(F)); pages=json.load(open(R+'/site/src/data/pages.json'))
taken={p['slug'] for p in doc['pages']}|{p['path'].strip('/').split('/')[-1] for p in pages if p['path'].startswith('/can-claude/')}
add=[];skip=[]
for f in sys.argv[1:]:
    for p in json.load(open(f))['pages']:
        if p['slug'] in taken or '—' in json.dumps(p) or p.get('example',{}).get('is_error'): skip.append(p['slug']); continue
        doc['pages'].append(p); taken.add(p['slug']); add.append(p['slug'])
json.dump(doc,open(F,'w'),indent=1,ensure_ascii=False)
print('added',len(add),add); print('skipped',skip)
