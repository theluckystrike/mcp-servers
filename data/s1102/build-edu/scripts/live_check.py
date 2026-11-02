"""usage: python3 -I live_check.py <url> <calls.json> <outdir>  -- POSTs initialize, tools/list and each tools/call with no token."""
import json, sys, urllib.request
url, calls_path, outdir = sys.argv[1:4]
calls = json.load(open(calls_path))
H = {'content-type': 'application/json', 'accept': 'application/json, text/event-stream', 'user-agent': 'live-check/1'}
def post(body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=H, method='POST')
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.read().decode()
ok = {}
st, b = post({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-06-18', 'capabilities': {}, 'clientInfo': {'name': 'live', 'version': '1'}}})
open(f'{outdir}/live_initialize.json', 'w').write(b); print('initialize', st, json.loads(b)['result']['serverInfo'])
st, b = post({'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list'})
open(f'{outdir}/live_tools_list.json', 'w').write(b); print('tools/list', st, [t['name'] for t in json.loads(b)['result']['tools']])
for k, c in enumerate(calls):
    st, b = post({'jsonrpc': '2.0', 'id': 10 + k, 'method': 'tools/call', 'params': c})
    open(f"{outdir}/live_{c['name']}.json", 'w').write(b)
    res = json.loads(b).get('result', {})
    good = st == 200 and not res.get('isError') and 'structuredContent' in res and res['structuredContent'].get('more', '').startswith('https://')
    ok[c['name']] = good
    print(c['name'], st, 'OK' if good else 'FAIL', res.get('content', [{}])[0].get('text', b)[:160].replace('\n', ' '))
print(json.dumps(ok))
