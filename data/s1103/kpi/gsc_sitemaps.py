# s1103: sitemap status for mcpstamp.com and zovo.one (fixes the 's1102 gsc.py' typo 'mpstamp'); output ./gsc_sitemaps.json
import json,sys
sys.path.insert(0,'/Users/mike/mcp-servers/scripts')
import gsc_tool as g
tok=g.token()
out={}
for site in ('sc-domain:mcpstamp.com','sc-domain:zovo.one'):
    out[site]=g.call(tok,'GET','/sites/'+site.replace(':','%3A')+'/sitemaps')
json.dump(out,open('gsc_sitemaps.json','w'),indent=1)
for s,v in out.items():
    for m in v.get('sitemap',[]):
        print(s,m.get('path'),'lastDownloaded',m.get('lastDownloaded'),'errors',m.get('errors'),'warnings',m.get('warnings'),[(c.get('type'),c.get('submitted'),c.get('indexed')) for c in m.get('contents',[])])
    if 'error' in v: print(s,v)
