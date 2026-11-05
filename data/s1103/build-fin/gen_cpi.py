import json,glob,sys
series={}
for f in sorted(glob.glob('bls2/*.json')):
    for s in json.load(open(f))['Results']['series']:
        d=series.setdefault(s['seriesID'],{'m':{},'a':{}})
        for x in s['data']:
            y=int(x['year'])
            if x['period']=='M13': d['a'][y]=float(x['value'])
            else:
                mo=int(x['period'][1:])
                v=None if x['value'].strip() in('-','') else float(x['value'])
                d['m'][(y,mo)]=v
out={}
for sid,d in series.items():
    keys=sorted(d['m'])
    y0,m0=keys[0]; y1,m1=keys[-1]
    arr=[]
    y,m=y0,m0
    while (y,m)<=(y1,m1):
        arr.append(d['m'].get((y,m)))
        m+=1
        if m==13: y+=1;m=1
    out[sid]={'start':[y0,m0],'end':[y1,m1],'monthly':arr,'annual':{str(k):v for k,v in sorted(d['a'].items())}}
    print(sid,y0,m0,y1,m1,len(arr),sum(1 for v in arr if v is None),len(d['a']))
ts='// Generated from the BLS Public Data API (api.bls.gov v1 and v2, annualaverage=true), fetched 2026-11-03.\n// Series: CUUR0000SA0 (CPI-U all items, U.S. city average, not seasonally adjusted, 1982-84=100),\n// CWUR0000SA0 (CPI-W all items), CUUR0000SA0L1E (CPI-U all items less food and energy).\n// null = no index published (October 2025: not collected during the 2025 lapse in appropriations).\n'
ts+='export interface SeriesData { start: [number, number]; end: [number, number]; monthly: (number | null)[]; annual: Record<string, number>; }\n'
ts+='export const BUNDLED_FETCHED = "2026-11-03";\n'
ts+='export const DATA: Record<string, SeriesData> = '+json.dumps(out,separators=(',',':'))+';\n'
open(sys.argv[1],'w').write(ts)
