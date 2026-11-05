#!/usr/bin/env python3
"""Minimal streamable-HTTP MCP client. usage: mcpcall.py <repo> list | <repo> call <tool> '<json args>'"""
import json, sys, urllib.request
def post(url, body, sid=None):
    h={'user-agent':'s1103-stamp-mcpcall/1 (curl-compatible)','content-type':'application/json','accept':'application/json, text/event-stream'}
    if sid: h['mcp-session-id']=sid
    r=urllib.request.urlopen(urllib.request.Request(url,data=json.dumps(body).encode(),headers=h),timeout=60)
    raw=r.read().decode(); s=r.headers.get('mcp-session-id')
    if raw.lstrip().startswith('{'): return json.loads(raw), s
    for line in raw.splitlines():
        if line.startswith('data:'):
            d=json.loads(line[5:])
            if 'id' in d: return d, s
    return {'raw':raw}, s
repo=sys.argv[1]; url=f'https://{repo}.lipmichal.workers.dev/mcp'
init,sid=post(url,{'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-03-26','capabilities':{},'clientInfo':{'name':'s1103-stamp','version':'1'}}})
try: post(url,{'jsonrpc':'2.0','method':'notifications/initialized'},sid)
except Exception: pass
if sys.argv[2]=='list':
    r,_=post(url,{'jsonrpc':'2.0','id':2,'method':'tools/list'},sid)
else:
    r,_=post(url,{'jsonrpc':'2.0','id':2,'method':'tools/call','params':{'name':sys.argv[3],'arguments':json.loads(sys.argv[4] if len(sys.argv)>4 else '{}')}},sid)
print(json.dumps(r,indent=1))
