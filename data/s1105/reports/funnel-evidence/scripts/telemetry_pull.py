import json, os, sys, time, urllib.request, datetime as dt
ACC = 'dd3f2a29b7707e21a87f26a622c0bb9d'
URL = f'https://api.cloudflare.com/client/v4/accounts/{ACC}/workers/observability/telemetry/query'
TOK = os.environ['CLOUDFLARE_API_TOKEN']
def q(frm, to, status=None, limit=2000, needle='zovo.one/buy/'):
    filters = [{"key":"$metadata.service","operation":"eq","type":"string","value":"mcp-billing"}]
    if status is not None:
        filters.append({"key":"$workers.event.response.status","operation":"eq","type":"number","value":status})
    body = {"queryId":"s1105-funnel","view":"events","limit":limit,"dry":False,
            "timeframe":{"from":frm,"to":to},
            "parameters":{"datasets":["cloudflare-workers"],"filters":filters,
                          "needle":{"value":needle,"isRegex":False,"matchCase":False}}}
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), method='POST',
        headers={'Authorization':'Bearer '+TOK,'Content-Type':'application/json','User-Agent':'mcp-audit-s1105/1'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)
if __name__ == '__main__':
    start = dt.datetime.fromisoformat(sys.argv[1]).replace(tzinfo=dt.timezone.utc)
    end = dt.datetime.fromisoformat(sys.argv[2]).replace(tzinfo=dt.timezone.utc)
    out = sys.argv[3]
    step = dt.timedelta(hours=6)
    t = start; n = 0
    with open(out, 'w') as f:
        while t < end:
            t2 = min(t+step, end)
            for attempt in range(3):
                try:
                    r = q(int(t.timestamp()*1000), int(t2.timestamp()*1000)); break
                except Exception as e:
                    sys.stderr.write(f'retry {t} {type(e).__name__} {str(e)[:100]}\n'); time.sleep(3)
            else:
                sys.stderr.write(f'FAILED {t}\n'); t = t2; continue
            res = r.get('result', {})
            evs = (res.get('events') or {}).get('events') or []
            st = res.get('statistics', {})
            sys.stderr.write(f'{t:%m-%d %H} events={len(evs)} count={(res.get("events") or {}).get("count")} abr={st.get("abr_level")}\n')
            for e in evs:
                f.write(json.dumps({'win': t.isoformat(), 'abr': st.get('abr_level'), 'e': e})+'\n'); n += 1
            t = t2; time.sleep(1)
    print('total events', n)
