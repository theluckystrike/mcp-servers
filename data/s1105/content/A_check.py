#!/usr/bin/env python3
"""s1105 A: validate A-live.json. Tool names vs catalog_tools.txt, slugs vs live list and live JSON, copy rules."""
import json, os, re
B = os.path.expanduser('~/mcp-servers/data/s1105')
d = json.load(open(f'{B}/content/A-live.json'))
cat = {}
for line in open(f'{B}/catalog_tools.txt'):
    sid, _, body = line.rstrip('\n').split(' | ', 2)
    cat[sid] = set(re.findall(r'(?:^|; )([a-z0-9_]+): ', body))
live = {l.strip() for l in open(f'{B}/live_can_paths.txt') if l.strip()}
live |= {f"/can-claude/{p['slug']}/" for p in json.load(open(os.path.expanduser('~/mcp-site-2026-10-30/repo/data/content/can-claude-live.json')))['pages']}
live |= {p['path'] for p in json.load(open(os.path.expanduser('~/mcp-site-2026-10-30/repo/site/src/data/pages.json')))}
keys = ['slug', 'repo', 'server_id', 'h1', 'title', 'query', 'answer', 'native', 'needs', 'example', 'faq']
banned = r'\b(unlock|seamless|effortless|revolutioni[sz]e|game-changer|leverage|robust|powerful|delve|comprehensive|crucial|vital|streamline|empower|innovative)\b'
errs, n_tools, slugs = [], 0, set()
for p in d['pages']:
    s = p['slug']; path = f'/can-claude/{s}/'
    for k in keys:
        if k not in p: errs.append(f'{s}: missing {k}')
    if path in live: errs.append(f'{s}: path already live')
    if s in slugs: errs.append(f'{s}: duplicate slug')
    slugs.add(s)
    if p['server_id'] not in cat: errs.append(f'{s}: unknown server {p["server_id"]}')
    for e in [p['example']] + ([p['example2']] if 'example2' in p else []):
        n_tools += 1
        if e['tool'] not in cat.get(p['server_id'], ()): errs.append(f'{s}: tool {e["tool"]} not in catalog for {p["server_id"]}')
        if e['is_error']: errs.append(f'{s}: error example')
        if 'anon_' in json.dumps(e): errs.append(f'{s}: token leak')
    prose = [p['h1'], p['title'], p['answer']] + p['native'] + p['needs'] + [f['q'] + ' ' + f['a'] for f in p['faq']] + \
            [e['prompt'] + ' ' + e['note'] for e in [p['example']] + ([p['example2']] if 'example2' in p else [])]
    for t in prose:
        if ':' in t: errs.append(f'{s}: colon in "{t[:60]}"')
        if '—' in t or '--' in t or '!' in t: errs.append(f'{s}: dash or exclamation in "{t[:60]}"')
        if re.search(banned, t, re.I): errs.append(f'{s}: banned word in "{t[:60]}"')
print(f'pages {len(d["pages"])}, example tool calls {n_tools}, errors {len(errs)}')
for e in errs: print(' ', e)
print('PASS' if not errs else 'FAIL')
