import openpyxl,json,sys,collections
out={}
for f,fy in [('gsa/FY2027PerDiemZipCode_Validated090126.xlsx',2027),('gsa/FY2026_ZipCodeFile.xlsx',2026)]:
    ws=openpyxl.load_workbook(f,read_only=True).worksheets[0]
    dests={}; zipmap={}; std=[]; dup=0
    for i,r in enumerate(ws.iter_rows(values_only=True)):
        if i==0: continue
        did,name,county,loc,st,z,fyv=r[:7]
        assert int(fyv)==fy
        z=str(z).zfill(5)
        lod=[int(x) for x in r[7:19]]; meals=int(r[19])
        if did==0:
            stdrate=(lod[0],meals)
        zipmap.setdefault(z,[])
        if did not in zipmap[z]: zipmap[z].append(did)
        else: dup+=1
        if did==0: continue
        e=dests.setdefault(did,{'id':did,'name':str(name).strip(),'county':(county or '').strip(),'defined':(loc or '').strip(),'state':st,'lodging_oct_sep':lod,'mie':meals})
        assert e['lodging_oct_sep']==lod and e['mie']==meals
    std=sorted(z for z,ids in zipmap.items() if ids==[0])
    zipmap={z:sorted(ids) for z,ids in sorted(zipmap.items()) if ids!=[0]}
    multi=sum(1 for ids in zipmap.values() if len(ids)>1)
    print('multi',multi)
    print(fy,len(dests),'dests',len(zipmap),'zips',len(std),'std zips dup',dup,'std',stdrate)
    out[str(fy)]={'standard':{'lodging':stdrate[0],'mie':stdrate[1]},'destinations':sorted(dests.values(),key=lambda d:(d['state'],d['name'])),'zips':zipmap,'standard_zips':''.join(std)}
ts='// Generated from GSA per diem ZIP code files (FY2026_ZipCodeFile.xlsx, FY2027PerDiemZipCode_Validated090126.xlsx),\n// https://www.gsa.gov/travel/per-diem-rates/per-diem-files, fetched 2026-11-03. Lodging by month Oct..Sep, M&IE per day.\n'
ts+='export interface Destination { id: number; name: string; county: string; defined: string; state: string; lodging_oct_sep: number[]; mie: number }\n'
ts+='export interface FiscalYearRates { standard: { lodging: number; mie: number }; destinations: Destination[]; zips: Record<string, number[]>; standard_zips: string }\n'
ts+='export const GSA: Record<string, FiscalYearRates> = '+json.dumps(out,separators=(',',':'))+';\n'
open(sys.argv[1],'w').write(ts)
