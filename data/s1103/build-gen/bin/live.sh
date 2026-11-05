#!/bin/bash
# usage: live.sh <url> <outdir> <tool> '<json args>' [<tool> '<json args>' ...]
U=$1; O=$2; shift 2; mkdir -p "$O"
H=(-H 'content-type: application/json' -H 'accept: application/json, text/event-stream')
curl -s -m 30 "${H[@]}" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"live-check","version":"1"}}}' "$U" > "$O/initialize.json"
echo "init: $(python3 -c "import json;d=json.load(open('$O/initialize.json'));print(d['result']['serverInfo'])")"
curl -s -m 30 "${H[@]}" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' "$U" > "$O/tools_list.json"
echo "tools: $(python3 -c "import json;d=json.load(open('$O/tools_list.json'));print([t['name'] for t in d['result']['tools']])")"
while [ $# -gt 1 ]; do
  T=$1; A=$2; shift 2
  curl -s -m 60 "${H[@]}" -d "{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"$T\",\"arguments\":$A}}" "$U" > "$O/$T.json"
  python3 -c "
import json;d=json.load(open('$O/$T.json'));r=d.get('result',{});t=r.get('content',[{}])[0].get('text','')
print('$T', 'ERROR' if r.get('isError') or 'error' in d else 'ok', '|', (t or json.dumps(d)).split(chr(10))[0][:300]); sc=r.get('structuredContent') or {}; print('   more:', sc.get('more'))"
done
