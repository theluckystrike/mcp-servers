import json,re,sys
def raw_first_searches(path,questions):
    qs={q['q']:q['n'] for q in questions}
    calls={};out={};allq=[]
    for line in open(path):
        try:o=json.loads(line)
        except Exception: continue
        c=o.get('message',{}).get('content')
        if not isinstance(c,list): continue
        for b in c:
            if b.get('type')=='tool_use' and b['name']=='WebSearch':
                calls[b['id']]=b['input'].get('query')
            elif b.get('type')=='tool_result' and b.get('tool_use_id') in calls:
                qq=calls[b['tool_use_id']]
                t=b.get('content'); t=t if isinstance(t,str) else json.dumps(t)
                m=re.search(r'Links: (\[.*?\])\n',t,re.S)
                links=[]
                if m:
                    try: links=json.loads(m.group(1))
                    except Exception: pass
                allq.append((qq,links))
                if qq in qs and qs[qq] not in out:
                    out[qs[qq]]=[{'rank':i+1,'title':l.get('title'),'url':l.get('url')} for i,l in enumerate(links)]
    return out,allq
