# s1103: map each GA4 property to its web data-stream domain (read-only analyticsadmin dataStreams) to verify which money sites have no GA4 property. Output ./ga4e.json
exec(open('ga4b.py').read().split("anyf=")[0])
out={}
for pid,name in props:
    r=req(f'https://analyticsadmin.googleapis.com/v1beta/{pid}/dataStreams?pageSize=50')
    pr=req(f'https://analyticsadmin.googleapis.com/v1beta/{pid}')
    out[pid]={'name':name,'timeZone':pr.get('timeZone'),'streams':[(s.get('displayName'),(s.get('webStreamData') or {}).get('defaultUri')) for s in r.get('dataStreams',[])] if 'error' not in r else r}
json.dump(out,open('ga4e.json','w'),indent=1)
doms=sorted({(u or '') for v in out.values() if isinstance(v['streams'],list) for _,u in v['streams']})
print(doms)
print({v['name']:v['timeZone'] for k,v in out.items() if k in ('properties/561638567','properties/555964379','properties/521066195')})
for d in ('noovertimetax','dscrradar','ukmoneycalc','taxbreakcalc','abwex','bugbountyreality','examscorecalc','mcp.zovo'):
    print(d, [pid for pid,v in out.items() if isinstance(v['streams'],list) and any(d in (u or '') for _,u in v['streams'])])
