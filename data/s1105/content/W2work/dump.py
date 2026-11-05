import json, sys, re
for s in sys.argv[1:]:
    r = json.load(open(f'{s}.tools.json'))
    print('=====', s)
    for t in r['result']['tools']:
        if t['name'].startswith('license_'): continue
        print('##', t['name'], '::', t.get('description', ''))
        for k, v in (t.get('inputSchema', {}).get('properties') or {}).items():
            d = json.dumps(v)
            if re.search(r'free|Pro\b|hosted|tier', d): print('   -', k, ':', v.get('description', d)[:400])
