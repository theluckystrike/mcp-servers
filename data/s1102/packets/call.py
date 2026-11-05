import json,sys,urllib.request
def post(url,body,sid=None):
    h={"user-agent":"Mozilla/5.0 (probe)","content-type":"application/json","accept":"application/json, text/event-stream"}
    if sid:h["mcp-session-id"]=sid
    r=urllib.request.Request(url,json.dumps(body).encode(),h)
    with urllib.request.urlopen(r,timeout=40) as f:
        t=f.read().decode(); sid=f.headers.get("mcp-session-id")
    for l in t.splitlines():
        if l.startswith("data:"): t=l[5:].strip();break
    return json.loads(t),sid
def call(repo,tool,args):
    u=f"https://{repo}.lipmichal.workers.dev/mcp"
    i,sid=post(u,{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}})
    r,_=post(u,{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":tool,"arguments":args}},sid)
    return r
if __name__=="__main__":
    print(json.dumps(call(sys.argv[1],sys.argv[2],json.loads(sys.argv[3])),indent=1)[:int(sys.argv[4]) if len(sys.argv)>4 else 3500])
