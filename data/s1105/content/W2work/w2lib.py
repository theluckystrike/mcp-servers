#!/usr/bin/env python3
"""s1105 A: run the real tools/call sequence for each page against mcp.zovo.one/mcp/<id>/t/<token>.
usage: TOK=... FX=<fixture dir> A_run_calls.py <page-key> [...]   Raw responses -> ~/mcp-servers/data/s1105/calls/A/<page>.<n>.<tool>.json"""
import base64, json, os, sys, urllib.request, urllib.error
TOK = os.environ['TOK']; FX = os.environ.get('FX', '.')
OUT = os.path.expanduser('~/mcp-servers/data/s1105/calls/W2')
b64 = lambda f: base64.b64encode(open(os.path.join(FX, f), 'rb').read()).decode()

class S:
    def __init__(self, sid_):
        self.url = f'https://mcp.zovo.one/mcp/{sid_}/t/{TOK}'; self.sess = None; self.id = 1; self.server = sid_
        self.post({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-03-26', 'capabilities': {}, 'clientInfo': {'name': 's1105-W2', 'version': '1'}}})
        try: self.post({'jsonrpc': '2.0', 'method': 'notifications/initialized'})
        except Exception: pass
    def post(self, body):
        h = {'user-agent': 's1105-W2/1', 'content-type': 'application/json', 'accept': 'application/json, text/event-stream', 'x-mcp-probe': '1'}
        if self.sess: h['mcp-session-id'] = self.sess
        import time
        for a in range(3):
            try:
                r = urllib.request.urlopen(urllib.request.Request(self.url, data=json.dumps(body).encode(), headers=h), timeout=90); break
            except urllib.error.URLError as e:
                if a == 2 or (getattr(e, 'code', None) or 500) < 500: raise
                time.sleep(8)
        raw = r.read().decode(); self.sess = r.headers.get('mcp-session-id') or self.sess
        if raw.lstrip().startswith('{'): return json.loads(raw)
        for line in raw.splitlines():
            if line.startswith('data:'):
                d = json.loads(line[5:])
                if 'id' in d: return d
        return {'raw': raw}
    def call(self, page, n, tool, args, show=True):
        self.id += 1
        r = self.post({'jsonrpc': '2.0', 'id': self.id, 'method': 'tools/call', 'params': {'name': tool, 'arguments': args}})
        short = {k: (v[:40] + '...' if isinstance(v, str) and len(v) > 200 else v) for k, v in args.items()}
        rec = {'server_id': self.server, 'url_form': '/mcp/<id>/t/<token>', 'tool': tool, 'args': short, 'response': r}
        json.dump(rec, open(f'{OUT}/{page}.{n}.{tool}.json', 'w'), indent=1)
        txt = '\n'.join(c.get('text', '') for c in r.get('result', {}).get('content', []) if c.get('type') == 'text')
        print(f'--- {page}.{n}.{tool} err={r.get("result", {}).get("isError")}\n{txt[:1800] if show else txt[:200]}')
        return r

JOBS = {}
def job(f): JOBS[f.__name__.replace('_', '-')] = f; return f

@job

def tools_list(server):
    s = S(server); s.id += 1
    r = s.post({'jsonrpc': '2.0', 'id': s.id, 'method': 'tools/list'})
    json.dump(r, open(f'{OUT}/{server}.tools.json', 'w'), indent=1)
    return r
