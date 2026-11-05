#!/usr/bin/env python3
"""Call a catalog server on mcp.zovo.one through the printed path form /mcp/<id>/t/<token>.
usage: TOK=... A_mcpcall.py <server_id> <name> list | call <tool> '<json args>'   -> writes calls/A/<name>.json (raw)"""
import json, os, sys, urllib.request
TOK = os.environ['TOK']; sid_, name, mode = sys.argv[1], sys.argv[2], sys.argv[3]
url = f'https://mcp.zovo.one/mcp/{sid_}/t/{TOK}'
def post(body, sid=None):
    h = {'user-agent': 's1105-A-mcpcall/1', 'content-type': 'application/json', 'accept': 'application/json, text/event-stream', 'x-mcp-probe': '1'}
    if sid: h['mcp-session-id'] = sid
    r = urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(body).encode(), headers=h), timeout=60)
    raw = r.read().decode(); s = r.headers.get('mcp-session-id')
    if raw.lstrip().startswith('{'): return json.loads(raw), s
    for line in raw.splitlines():
        if line.startswith('data:'):
            d = json.loads(line[5:])
            if 'id' in d: return d, s
    return {'raw': raw}, s
_, sid = post({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-03-26', 'capabilities': {}, 'clientInfo': {'name': 's1105-A', 'version': '1'}}})
try: post({'jsonrpc': '2.0', 'method': 'notifications/initialized'}, sid)
except Exception: pass
if mode == 'list':
    r, _ = post({'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list'}, sid)
else:
    args = json.loads(sys.argv[5] if len(sys.argv) > 5 else '{}')
    r, _ = post({'jsonrpc': '2.0', 'id': 2, 'method': 'tools/call', 'params': {'name': sys.argv[4], 'arguments': args}}, sid)
    r = {'server_id': sid_, 'tool': sys.argv[4], 'args': args, 'response': r}
out = os.path.expanduser(f'~/mcp-servers/data/s1105/calls/A/{name}.json')
json.dump(r, open(out, 'w'), indent=1)
print(json.dumps(r, indent=1)[:3000])
