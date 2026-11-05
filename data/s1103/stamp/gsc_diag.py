#!/usr/bin/env python3
"""s1103 stamp: GSC URL inspection + search analytics for sc-domain:mcpstamp.com."""
import json, sys, urllib.request, urllib.parse
sys.path.insert(0, '/Users/mike/mcp-servers/scripts')
import gsc_tool as g
P = 'sc-domain:mcpstamp.com'
tok = g.token()
out = {}
def insp(url):
    req = urllib.request.Request('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
        data=json.dumps({'inspectionUrl': url, 'siteUrl': P}).encode(), method='POST',
        headers={'Authorization': 'Bearer ' + tok, 'content-type': 'application/json'})
    try: return json.loads(urllib.request.urlopen(req, timeout=60).read())
    except urllib.error.HTTPError as e: return {'error': e.code, 'body': e.read().decode()[:300]}
urls = sys.argv[1:]
out['inspect'] = {}
for u in urls:
    r = insp(u)
    ir = r.get('inspectionResult', {}).get('indexStatusResult', r)
    out['inspect'][u] = ir
    print(u, '|', ir.get('verdict'), '|', ir.get('coverageState'), '|', ir.get('robotsTxtState'), '|', ir.get('indexingState'), '| last', ir.get('lastCrawlTime'), '| gcanon', ir.get('googleCanonical'), '| ucanon', ir.get('userCanonical'), '| ref', (ir.get('referringUrls') or [])[:2], '| sm', ir.get('sitemap'))
q = lambda body: g.call(tok, 'POST', '/sites/' + urllib.parse.quote(P, safe='') + '/searchAnalytics/query', body)
for dims in (['query'], ['page'], ['query', 'page'], ['date']):
    r = q({'startDate': '2026-10-01', 'endDate': '2026-11-02', 'dimensions': dims, 'rowLimit': 500, 'dataState': 'all'})
    out['sa_' + '_'.join(dims)] = r.get('rows', r)
out['sitemaps'] = g.call(tok, 'GET', '/sites/' + urllib.parse.quote(P, safe='') + '/sitemaps')
json.dump(out, open('/Users/mike/mcp-servers/data/s1103/stamp/gsc_diag.json', 'w'), indent=1)
