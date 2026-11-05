import json,sys,urllib.request
def post(url,body,sid=None):
    h={"user-agent":"Mozilla/5.0 (probe)","content-type":"application/json","accept":"application/json, text/event-stream"}
    if sid:h["mcp-session-id"]=sid
    r=urllib.request.Request(url,json.dumps(body).encode(),h)
    with urllib.request.urlopen(r,timeout=30) as f:
        t=f.read().decode(); sid=f.headers.get("mcp-session-id")
    if t.startswith("event:") or "\ndata:" in t or t.startswith("data:"):
        for l in t.splitlines():
            if l.startswith("data:"): t=l[5:].strip();break
    return json.loads(t),sid
out={}
for r in open('repos.txt').read().split():
    u=f"https://{r}.lipmichal.workers.dev/mcp"
    try:
        i,sid=post(u,{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}})
        try: post(u,{"jsonrpc":"2.0","method":"notifications/initialized"},sid)
        except Exception as e: pass
        t,_=post(u,{"jsonrpc":"2.0","id":2,"method":"tools/list"},sid)
        tools=t["result"]["tools"]
        out[r]={"serverInfo":i["result"].get("serverInfo"),"tools":[{"name":x["name"],"title":x.get("title"),"annotations":x.get("annotations"),"desc":x.get("description","")[:160],"hasOutputSchema":"outputSchema" in x} for x in tools]}
        miss=[x["name"] for x in tools if not (x.get("annotations") or {}).get("readOnlyHint") is True]
        print(r,len(tools),"missing readOnlyHint:",miss, "no title:",[x["name"] for x in tools if not (x.get("title") or (x.get("annotations") or {}).get("title"))])
    except Exception as e:
        out[r]={"error":str(e)}; print(r,"ERR",e)
json.dump(out,open('tools-live.json','w'),indent=1)
