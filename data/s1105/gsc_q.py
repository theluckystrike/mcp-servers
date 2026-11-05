import sys, json, urllib.parse
sys.path.insert(0,'/Users/mike/mcp-site-2026-10-30/scripts')
import gsc
gsc.TOK = gsc.access_token()
P = urllib.parse.quote(gsc.PROP, safe='')
def q(dims, start='2026-10-01', end='2026-11-05', rows=200):
    s,r = gsc.call('POST', f'https://www.googleapis.com/webmasters/v3/sites/{P}/searchAnalytics/query',
        {'startDate':start,'endDate':end,'dimensions':dims,'rowLimit':rows,'dataState':'all'})
    return r
out = {'date':q(['date']),'page':q(['page']),'query':q(['query'])}
json.dump(out, open('/Users/mike/mcp-servers/data/s1105/gsc_mcpstamp.json','w'), indent=1)
for k in out:
    rows = out[k].get('rows',[]) if isinstance(out[k],dict) else out[k]
    print('==',k, len(rows) if isinstance(rows,list) else rows)
    if isinstance(rows,list):
        for x in sorted(rows, key=lambda x:-x['impressions'])[:25]:
            print(x['keys'][0][-70:], x['clicks'], x['impressions'], round(x['position'],1))
