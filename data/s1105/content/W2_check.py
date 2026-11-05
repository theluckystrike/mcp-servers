#!/usr/bin/env python3
"""s1105 W2 checker for content/W2-live.json.  usage: W2_check.py [pages.json]   exit 1 on any FAIL.
Checks: schema, slug collisions (live json + pages.json /can-*/ and /use-cases/), paid catalog server, tool exists on the hosted
tools/list and in catalog_tools.txt, example tool not Pro-only, example result traced to a raw call in calls/W2 (exact text, a string
field, or a JSON subset with identical values) with matching args, no token or download link, style (dashes, !, emoji, hype words,
colons in prose), title/meta length, and truth lints from gate.md/regate.md."""
import glob, json, os, re, sys
H = os.path.expanduser
SRC = sys.argv[1] if len(sys.argv) > 1 else H('~/mcp-servers/data/s1105/content/W2-live.json')
CALLS = H('~/mcp-servers/data/s1105/calls/W2')
LIVE = json.load(open(H('~/mcp-site-2026-10-30/repo/data/content/can-claude-live.json')))['pages']
PAGES = json.load(open(H('~/mcp-site-2026-10-30/repo/site/src/data/pages.json')))
CAT = {}
for line in open(H('~/mcp-servers/data/s1105/catalog_tools.txt')):
    parts = line.split(' | ', 2)
    if len(parts) == 3:
        CAT[parts[0]] = (parts[1], {t.split(':')[0].strip() for t in parts[2].split('; ')})
fails, warns = [], []
def F(slug, msg): fails.append(f'{slug}: {msg}')

KEYS_REQ = {'slug', 'repo', 'server_id', 'h1', 'title', 'query', 'answer', 'native', 'needs', 'example', 'faq'}
KEYS_OK = KEYS_REQ | {'example2', 'meta_description'}
EX_KEYS = {'prompt', 'tool', 'args', 'result', 'note', 'is_error', 'run'}
HYPE = ['unlock', 'seamless', 'effortless', 'revolutioniz', 'game-changer', 'game changer', 'leverage', 'robust', 'powerful', 'supercharge', 'elevate', 'delve', 'empower']
FALSE = ['in most apps', 'most chat apps', 'never remembers', 'cannot remember', "can't remember", 'does not remember', 'no memory', 'starts over',
         'every new chat starts', 'cannot create files', "can't create files", 'text only', 'does not wake up', 'has no clock', 'cannot write a file']
live_slugs = {p['slug'] for p in LIVE}
used_paths = {p['path'] for p in PAGES if p.get('path', '').startswith(('/can-', '/use-cases/'))}
usecase_servers = {}
for p in PAGES:
    if p.get('path', '').startswith('/use-cases/'):
        for s in p.get('servers') or []: usecase_servers.setdefault(s, []).append(p['path'])

def clean(t):
    t = '\n'.join(l for l in t.splitlines() if not l.startswith('Free tier: 600 calls/hour'))
    return re.sub(r'https://mcp\.zovo\.one/mcp/download/[0-9a-f]+', '<download link>', t).strip()
def subset(a, b):
    if isinstance(a, dict): return isinstance(b, dict) and all(k in b and subset(v, b[k]) for k, v in a.items())
    if isinstance(a, list): return isinstance(b, list) and len(a) == len(b) and all(subset(x, y) for x, y in zip(a, b))
    return a == b
def traced(slug, e):
    for f in glob.glob(f'{CALLS}/{slug}.*.{e["tool"]}.json'):
        r = json.load(open(f))
        if r.get('tool') != e['tool'] or r.get('args') != e['args']: continue
        res = r['response'].get('result', {})
        if res.get('isError'): continue
        t = clean('\n'.join(c.get('text', '') for c in res.get('content', []) if c.get('type') == 'text'))
        if e['result'] == t: return True
        try: d = json.loads(t)
        except Exception: continue
        if isinstance(d, dict) and any(isinstance(v, str) and clean(v) == e['result'] for v in d.values()): return True
        try:
            if subset(json.loads(e['result']), d): return True
        except Exception: pass
    return False
def prose(p):
    out = [('answer', p['answer']), ('h1', p['h1'])] + [(f'native[{i}]', x) for i, x in enumerate(p['native'])] + [(f'needs[{i}]', x) for i, x in enumerate(p['needs'])]
    out += [(f'faq[{i}].q', f['q']) for i, f in enumerate(p['faq'])] + [(f'faq[{i}].a', f['a']) for i, f in enumerate(p['faq'])]
    for k in ('example', 'example2'):
        if k in p: out += [(k + '.prompt', p[k]['prompt']), (k + '.note', p[k]['note'])]
    if 'meta_description' in p: out.append(('meta_description', p['meta_description']))
    return out

data = json.load(open(SRC)); pages = data['pages']
seen = set()
if not 15 <= len(pages) <= 20: F('-', f'{len(pages)} pages, want 15 to 20')
for p in pages:
    s = p.get('slug', '?')
    if set(p) - KEYS_OK or KEYS_REQ - set(p): F(s, f'schema keys extra={set(p) - KEYS_OK} missing={KEYS_REQ - set(p)}'); continue
    if s in seen: F(s, 'duplicate slug in file')
    seen.add(s)
    if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', s): F(s, 'bad slug')
    if s in live_slugs: F(s, 'slug already in can-claude-live.json')
    if f'/can-claude/{s}/' in used_paths: F(s, 'path already in pages.json')
    sid = p['server_id']
    if p['repo'] != sid: F(s, 'repo != server_id')
    if sid not in CAT: F(s, f'server {sid} not in catalog'); continue
    if CAT[sid][0] != 'price 19': F(s, f'server {sid} is {CAT[sid][0]}, not a paid catalog server')
    if sid in usecase_servers: warns.append(f'{s}: server {sid} also on {usecase_servers[sid]} (check the job differs)')
    tf = f'{CALLS}/{sid}.tools.json'
    if not os.path.exists(tf): F(s, f'no hosted tools/list for {sid}'); continue
    tl = json.load(open(tf))['result']['tools']; hosted = {t['name']: t.get('description', '') for t in tl}
    params = {k for t in tl for k in (t.get('inputSchema', {}).get('properties') or {})}
    for k in ('example', 'example2'):
        if k not in p: continue
        e = p[k]
        if set(e) != EX_KEYS: F(s, f'{k} keys {set(e) ^ EX_KEYS}')
        if e['tool'] not in hosted: F(s, f'{k} tool {e["tool"]} not on hosted tools/list')
        if e['tool'] not in CAT[sid][1]: F(s, f'{k} tool {e["tool"]} not in catalog_tools.txt')
        d = hosted.get(e['tool'], '')
        if re.search(r'(^|\. )Pro(\.| feature)', d) or 'Not available on this hosted endpoint' in d or 'Local (stdio) install only' in d:
            F(s, f'{k} tool {e["tool"]} is Pro-only or not hosted')
        if e['is_error'] is not False: F(s, f'{k} is_error')
        if not traced(s, e): F(s, f'{k} result/args not traced to a raw call in calls/W2')
    # tools named in prose must exist; hosted-unavailable tools need "local install" in the same sentence
    allt = ' '.join(t for _, t in prose(p))
    for name in set(re.findall(r'\b[a-z]+_[a-z_]+\b', allt)):
        if name not in hosted and name not in params and name not in {'timer_start'}: F(s, f'prose names unknown tool {name}')
        d = hosted.get(name, '')
        if 'Not available on this hosted endpoint' in d or 'Local (stdio) install only' in d: F(s, f'prose names hosted-unavailable tool {name}')
    # Pro claims: every hosted tool whose description says Pro and is named as free is a fail
    for fld, t in prose(p):
        for sent in re.split(r'(?<=\.)\s+', t):
            for name in re.findall(r'\b[a-z]+_[a-z_]+\b', sent):
                d = hosted.get(name, '')
                if re.search(r'(^|\. )Pro(\.| feature)', d) and re.search(r'\bfree\b', sent, re.I) and 'Pro' not in sent: F(s, f'{fld} calls Pro tool {name} free')
    dump = json.dumps(p, ensure_ascii=False)
    if re.search(r'anon_[0-9a-f]{6,}|anon:[0-9a-f]{6,}|tenant=|/mcp/download/[0-9a-f]', dump): F(s, 'token or live download link in page')
    if re.search(r'[–—]', dump): F(s, 'en/em dash')
    if re.search(r'[\U0001F300-\U0001FAFF☀-➿]', dump): F(s, 'emoji')
    for fld, t in prose(p) + [('title', p['title'])]:
        if '!' in t: F(s, f'{fld} has !')
        for w in HYPE:
            if w in t.lower(): F(s, f'{fld} hype word {w}')
        if re.search(r':(?!\d)', t) and fld != 'title': F(s, f'{fld} colon in prose')
        for w in FALSE:
            if w in t.lower(): F(s, f'{fld} known-false phrase "{w}"')
        if 'code execution' in t and fld == 'answer' and 'default' not in t: F(s, 'answer mentions code execution without the default')
    if len(p['title']) > 62: F(s, f'title {len(p["title"])} chars')
    m = p.get('meta_description', '')
    if m and not 100 <= len(m) <= 165: F(s, f'meta {len(m)} chars')
    if not p['answer'].startswith(('Yes', 'No', 'Not', 'Partly')): F(s, 'answer does not open with an honest yes/no/partly')
    if not re.search(r'\$19 once', dump) or '$39 once' not in dump: F(s, 'no Pro price ($19 once / $39 once) stated')
    if '(free token)' not in p['answer']: F(s, 'answer does not say free token')
    if len(p['answer'].split()) > 115: F(s, f'answer {len(p["answer"].split())} words')
for w in warns: print('WARN', w)
for f in fails: print('FAIL', f)
print(f'{SRC}: {len(pages)} pages, {len(fails)} FAIL, {len(warns)} WARN')
sys.exit(1 if fails else 0)
