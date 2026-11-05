# s1103 KPI build: reads the raw outputs in this directory + the 11-02 baseline in ../../s1102/kpi, writes ../kpi.json and ../kpi.md
import json,collections,statistics as st,glob,os,datetime
B='../../s1102/kpi/'
L=lambda f: json.load(open(f))
npm=L('npm.json'); npv=L('npm_versions.json'); cf=L('cf.json'); gh=L('gh.json'); gsc=L('gsc.json'); sm=L('gsc_sitemaps.json')
ga=L('ga4.json'); ga4d=L('ga4d.json'); fun=L('stats_funnel.json'); clk=L('stats_clicks.json'); r38=L('r38_out.json')
bcf=L(B+'cf.json'); bgh=L(B+'gh.json'); bgsc=L(B+'gsc.json'); bga=L(B+'ga4.json'); bfun=L(B+'funnel_ordinary_by_day.json'); bclk=L(B+'stats_clicks.json'); br38=L(B+'r38_out.json')
GEN=datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')
K={'generated':GEN,'baseline':'data/s1102/kpi.md (measured 2026-11-02 ~02:30 UTC)'}
md=[]; a=md.append
fmt=lambda x: f'{x:,}' if isinstance(x,(int,float)) else str(x)
def sd(new,old):
    if old is None or new is None: return 'n/a'
    d=new-old; return ('+' if d>0 else '')+f'{d:,}'

# ---------------- npm
P=npm['packages']; ctrl=P[0]; pk=P[1:]
DAYS=['2026-10-30','2026-10-31','2026-11-01']
rows=[]
for p in pk:
    d=p['days'] or {}
    rows.append({'pkg':p['pkg'],'scoped':p['pkg'].startswith('@theluckystrike/'),'d1030':d.get('2026-10-30',0),'d1031':d.get('2026-10-31',0),'d1101':d.get('2026-11-01',0),'total':sum(d.get(x,0) for x in DAYS),'d1102':d.get('2026-11-02',0),'d1103':d.get('2026-11-03',0),
                 'stage':(npv.get(p['pkg']) or {}).get('0.0.0-stage',0),'real':sum(c for k,c in (npv.get(p['pkg']) or {}).items() if k!='0.0.0-stage')})
for r in rows: r['stage_share']=round(r['stage']/(r['stage']+r['real']),3) if r['stage']+r['real'] else None
tot={x:sum(r[k] for r in rows) for x,k in zip(DAYS,('d1030','d1031','d1101'))}; TOT=sum(tot.values())
med={x:st.median([r[k] for r in rows]) for x,k in zip(DAYS,('d1030','d1031','d1101'))}
mad={x:st.median([abs(r[k]-med[x]) for r in rows]) for x,k in zip(DAYS,('d1030','d1031','d1101'))}
out_flags={}
for x,k in zip(DAYS,('d1030','d1031','d1101')):
    thr=med[x]+5*1.4826*mad[x]
    for r in rows:
        if r[k]>thr: out_flags.setdefault(r['pkg'],[]).append((x,r[k],round(r[k]/med[x],1)))
srt=sorted(rows,key=lambda r:(-r['total'],r['pkg']))
stage_tot=sum(r['stage'] for r in rows); real_tot=sum(r['real'] for r in rows)
sc=[r for r in rows if r['scoped']]; un=[r for r in rows if not r['scoped']]
K['npm']={'cmd':'python3 npm.py -> GET https://api.npmjs.org/downloads/range/2026-10-30:2026-11-03/<pkg> (scoped / as %2F) for the 68 packages in data/s1030/npm-registry-check.tsv; python3 npm_versions.py -> GET https://api.npmjs.org/versions/<pkg>/last-week',
 'positive_control':{'pkg':ctrl['pkg'],'days':ctrl['days'],'last_week':ctrl['last_week'],'last_week_window':ctrl['last_week_window'],'last_day':ctrl['last_day'],'last_day_window':ctrl['last_day_window'],
   'curl_explicit_range_10-30_11-02':28961417},
 'populated_through':'2026-11-01','totals_by_day':tot,'total_10-30_to_11-01':TOT,'packages':len(rows),'median_per_pkg':med,'mad_per_pkg':mad,
 'scoped':{'n':len(sc),'total':sum(r['total'] for r in sc)},'unscoped_satellites':{'n':len(un),'total':sum(r['total'] for r in un)},
 'stage_placeholder_downloads':stage_tot,'real_version_downloads':real_tot,'stage_share':round(stage_tot/(stage_tot+real_tot),3),
 'outliers':{k:v for k,v in out_flags.items()},'per_package':rows,
 'unpublished_satellites_404':['ab-test-sample-size-calculator-mcp','aca-premium-tax-credit-calculator-mcp','ap-score-distributions-mcp','car-loan-interest-deduction-calculator-mcp','estate-gift-tax-exemption-calculator-mcp','recipe-nutrition-calculator-mcp','retirement-contribution-limits-2027-mcp','section-179-deduction-calculator-mcp','student-loan-repayment-assistance-plan-calculator-mcp','subdomain-finder-mcp','uk-statutory-sick-pay-maternity-pay-calculator-mcp']}

# ---------------- funnel / clicks
by=collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
for r in fun['rows']: by[r['cohort']][r['day']][r['event']]+=r['count']
EV=['offer_view','successful_business_call','first_successful_anon_token_server_day','upgrade_impression','checkout_handoff']
fdays=['2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03']
ftab={}
for d in fdays:
    if d in by['ordinary']: ftab[d]={e:by['ordinary'][d].get(e,0) for e in EV}; ftab[d]['probe_offer_view']=by['probe'][d].get('offer_view',0); ftab[d]['probe_checkout_handoff']=by['probe'][d].get('checkout_handoff',0); ftab[d]['src']='11-03 stats/funnel'
    else: ftab[d]={e:bfun.get(d,{}).get(e,0) for e in EV}; ftab[d]['probe_offer_view']=None; ftab[d]['probe_checkout_handoff']=None; ftab[d]['src']='11-02 baseline (10-27 fell out of the 7-date window)'
oauth=sum(r['count'] for r in fun['rows'] if r['source']=='oauth')
K['funnel']={'cmd':"curl -s -H 'x-mcp-probe: 1' -A mcp-kpi/1 https://mcp.zovo.one/stats/funnel (saved stats_funnel.json, generated_at "+fun['generated_at']+")",'window':fun['window'],'ordinary_window_total':fun['ordinary'],'probe_window_total':fun['probe'],'by_day':ftab,'oauth_source_rows':[r for r in fun['rows'] if r['source']=='oauth'],'baseline_ordinary_7d':{'offer_view':3530,'successful_business_call':373,'first_successful_anon_token_server_day':202,'upgrade_impression':302,'checkout_handoff':5}}
K['clicks']={'cmd':"curl -s -H 'x-mcp-probe: 1' -A mcp-kpi/1 https://mcp.zovo.one/stats/clicks (stats_clicks.json); node scripts/r38-commercial-kpis.mjs data/s1103/kpi/stats_clicks.json (r38_out.json)",
 'now':{k:r38[k] for k in ('guard_passing_navigation_total','guard_passing_navigation_7d','known_dead_product_navigation_total','known_dead_product_navigation_7d','other_guard_passing_navigation_total','other_guard_passing_navigation_7d')},
 'baseline':{k:br38[k] for k in ('guard_passing_navigation_total','guard_passing_navigation_7d','known_dead_product_navigation_total','known_dead_product_navigation_7d','other_guard_passing_navigation_total','other_guard_passing_navigation_7d')},
 'unattributed_total':[bclk['unattributed_total'],clk['unattributed_total']],'unattributed_7d':[bclk['unattributed_7d'],clk['unattributed_7d']],
 'by_src_7d_nonzero':{k:v for k,v in clk['by_src'].items() if v['last7d']}}

# ---------------- CF
SAT=cf['sat']; H=cf['per_script_hourly']; D=cf['per_script_per_day_status']
def day(n,d): return sum(v for k,v in D.get(n,{}).get(d,{}).items() if k!='_errors')
def errs(n): return sum(v.get('_errors',0) for v in D.get(n,{}).values())
bD=bcf['per_script_per_day_status']
def bday(n,d): return sum(v for k,v in bD.get(n,{}).get(d,{}).items() if k!='_errors') if n in bD else None
cfrows=[]
for n in SAT+cf['extra']+['mcp-remote']:
    hr=H.get(n,{}); comp=sorted(hr[k] for k in hr if '2026-11-02T07'<=k[:13]<'2026-11-03T07')
    burst=[(k[5:13],hr[k]) for k in sorted(hr) if hr[k]>300 and n!='mcp-remote' and k[:13]!='2026-11-03T07']
    cur=hr.get('2026-11-03T07:00:00Z')
    cfrows.append({'worker':n,'d1030':day(n,'2026-10-30'),'d1031':day(n,'2026-10-31'),'d1101':day(n,'2026-11-01'),'d1102':day(n,'2026-11-02'),'d1103_partial':day(n,'2026-11-03'),'baseline_d1102_partial':bday(n,'2026-11-02'),
      'median_hour_last24':st.median(comp) if comp else None,'launch_burst':burst,'hour_0700_partial':cur,'errors_total':errs(n),'statuses':sorted({k for dd in D.get(n,{}).values() for k in dd if k!='_errors'})})
S20=[r for r in cfrows if r['worker'] in SAT]
K['cf']={'cmd':'python3 cf2.py -> GraphQL viewer.accounts.workersInvocationsAdaptive (dims scriptName,status,datetimeHour; scriptName_in 20 satellites + 3 in-progress + mcp-remote) account dd3f2a29..., window '+cf['window'][0]+' .. '+cf['window'][1]+'; token env CLOUDFLARE_API_TOKEN',
 'window':cf['window'],'rows':cfrows,'satellites_total_by_day':{k:sum(r[k] for r in S20) for k in ('d1030','d1031','d1101','d1102','d1103_partial')},
 'old9_d1102_full':sum(r['d1102'] for r in S20 if r['baseline_d1102_partial'] is not None),'old9_d1102_baseline_partial':sum(r['baseline_d1102_partial'] for r in S20 if r['baseline_d1102_partial'] is not None),
 'satellite_errors_total':sum(r['errors_total'] for r in S20)}

# ---------------- GitHub
def idx(x): return {r['repo']:r for r in x}
gs=idx(gh['satellites']); bgs=idx(bgh['satellites'])
ghrows=[]
for n in SAT:
    r=gs['theluckystrike/'+n]; b=bgs.get('theluckystrike/'+n)
    ghrows.append({'repo':n,'views':r['views'],'view_uniques':r['view_uniques'],'clones':r['clones'],'clone_uniques':r['clone_uniques'],'referrers':r['referrers'],'stars':r['stars'],'private':r['private'],'baseline':b and {'views':b['views'],'view_uniques':b['view_uniques'],'clones':b['clones'],'clone_uniques':b['clone_uniques']}})
mir=gh['mirrors_all']; bmir=bgh['mirrors_all']
ref=collections.Counter(); refrepos=collections.defaultdict(list)
for r in gh['satellites']+mir:
    if isinstance(r['referrers'],list):
        for x in r['referrers']: ref[x['referrer']]+=x['count']; refrepos[x['referrer']].append((r['repo'],x['count']))
mtop=sorted(mir,key=lambda r:(-(r['view_uniques'] or 0),-(r['views'] or 0)))[:5]
bm={r['repo']:r for r in bmir}
K['github']={'cmd':'python3 gh.py -> gh api repos/<repo>/traffic/views | clones | popular/referrers | popular/paths, repos/<repo> (14-day window; 20 satellites + 65 mirrors)',
 'satellites':ghrows,'mirrors_65':{'views':sum(r['views'] or 0 for r in mir),'clones':sum(r['clones'] or 0 for r in mir),'baseline_views':sum(r['views'] or 0 for r in bmir),'baseline_clones':sum(r['clones'] or 0 for r in bmir)},
 'sat20_totals':{'views':sum(r['views'] or 0 for r in gh['satellites']),'clones':sum(r['clones'] or 0 for r in gh['satellites'])},
 'old9_totals':{'views':sum(r['views'] for r in ghrows if r['baseline']),'clones':sum(r['clones'] for r in ghrows if r['baseline']),'baseline_views':sum(r['baseline']['views'] for r in ghrows if r['baseline']),'baseline_clones':sum(r['baseline']['clones'] for r in ghrows if r['baseline'])},
 'referrers_all_repos':dict(ref.most_common()),'referrer_repos':{k:v for k,v in refrepos.items() if k!='github.com'},
 'top5_mirrors':[{'repo':r['repo'],'views':r['views'],'view_uniques':r['view_uniques'],'clones':r['clones'],'clone_uniques':r['clone_uniques'],'referrers':r['referrers'],'baseline':bm.get(r['repo']) and {k:bm[r['repo']][k] for k in ('views','view_uniques','clones','clone_uniques')}} for r in mtop],
 'private_flags':{r['repo']:r['private'] for r in gh['satellites']+mir if r['private']},'monorepo':[{k:r[k] for k in ('repo','private','views','view_uniques','clones','clone_uniques','referrers')} for r in mir if r['repo']=='theluckystrike/mcp-servers']}

# ---------------- GSC
ns={s['site']:s for s in gsc['sites']}; bs={s['site']:s for s in bgsc['sites']}
money=[('sc-domain:ingredientcalculator.com','cups-to-grams'),('https://goldgramprice.com/','gold-price-per-gram'),('https://lakelevelnow.com/','lake-level'),('https://statewage.com/','minimum-wage, paycheck, retirement-limits'),('sc-domain:recipetool.net','recipe-nutrition'),
 ('https://taxbreakcalc.com/','aca-ptc, car-loan, estate-gift'),('https://assetloancalculator.com/','section-179'),('sc-domain:abwex.com','ab-test'),('https://examscorecalc.com/','ap-score'),('sc-domain:bugbountyreality.com','subdomain-finder'),('sc-domain:mcpstamp.com','student-loan (free-servers page) + brand'),('sc-domain:zovo.one','us-federal-holidays (mcp.zovo.one) + zovo.one')]
gtab=[]
for u,s in money:
    n=ns.get(u,{}); b=bs.get(u,{})
    gtab.append({'site':u,'satellites':s,'final':[n['final_28d'].get('clicks'),n['final_28d'].get('impressions')],'fresh':[n['all_28d_to_today'].get('clicks'),n['all_28d_to_today'].get('impressions')],
     'baseline_final':[b.get('final_28d',{}).get('clicks'),b.get('final_28d',{}).get('impressions')],'baseline_fresh':[b.get('all_28d_to_today',{}).get('clicks'),b.get('all_28d_to_today',{}).get('impressions')]})
nopro=[x for x in ('noovertimetax.com','dscrradar.com','ukmoneycalc.com') if not any(x in u for u in gsc['site_list'])]
K['gsc']={'cmd':'python3 gsc.py (scripts/gsc_tool.py searchAnalytics/query per property); windows final '+'..'.join(gsc['windows']['final_28d'][:2])+' (dataState=final, ends 10-31), fresh '+'..'.join(gsc['windows']['all_28d_to_today'][:2])+' (dataState=all, ends 11-02); python3 gsc_sitemaps.py for sitemaps',
 'positive_control':{'site':'sc-domain:ingredientcalculator.com','final_clicks':ns['sc-domain:ingredientcalculator.com']['final_28d']['clicks'],'baseline_final_clicks':bs['sc-domain:ingredientcalculator.com']['final_28d']['clicks']},
 'money_sites':gtab,'mcp_zovo_one':{'final':gsc['mcp_zovo_one']['final_28d'],'fresh':gsc['mcp_zovo_one']['all_28d_to_today'],'by_day':gsc['mcp_zovo_one_by_day']},
 'mcpstamp':{'by_day':gsc['mcpstamp_by_day'],'detail':gsc['mcpstamp_detail']},'sitemaps':sm,'properties':len(gsc['sites']),'baseline_properties':len(bgsc['sites']),'no_property':nopro,'new_property':sorted(set(ns)-set(bs))}

# ---------------- GA4
gr=ga['reports']; bgr=bga['reports']
gatab=[]
for pid,r in gr.items():
    gatab.append({'property':r['name'],'pid':pid,'sessions_28d':r.get('sessions_28d'),'mcp_sessions_28d':r.get('mcp_sessions_28d'),'baseline_sessions_28d':bgr.get(pid,{}).get('sessions_28d'),'top_sources':r.get('top_sources',[])[:3]})
gatab.sort(key=lambda x:-(x['sessions_28d'] or 0))
tmcp=sum(x['mcp_sessions_28d'] or 0 for x in gatab); bmcp=sum(r.get('mcp_sessions_28d',0) or 0 for r in bgr.values())
ts=sum(x['sessions_28d'] or 0 for x in gatab); bts=sum(r.get('sessions_28d',0) or 0 for r in bgr.values())
mc=ga4d['mcpstamp_by_day_source']
K['ga4']={'cmd':'python3 ga4.py (Analytics Data API runReport, sessionSource EXACT mcp, 28daysAgo..today, 30 properties), ga4b.py (CONTAINS mcp on source/medium/campaign), ga4c.py (ingredientcalculator session detail), ga4d.py (mcpstamp by day, hostName control, -mcp utm_medium sweep)',
 'properties':len(gatab),'baseline_properties':len(bgr),'sessions_28d_total':ts,'baseline_sessions_28d_total':bts,'mcp_sessions_28d':tmcp,'baseline_mcp_sessions_28d':bmcp,
 'positive_control':{'property':'ingredientcalculator.com','google_sessions':[x for x in gr['properties/555964379']['top_sources'] if x[0]=='google'],'hostName_control_zovo_one_property':ga4d['zovo_one_hostnames_28d']},
 'mcp_detail':json.load(open('ga4_mcp_detail.json')),'per_property':gatab,'satellite_utm_medium_sweep':ga4d['satellite_utm_medium_28d'],'mcpstamp_by_day_source':mc,'mcpstamp_landing_7d':ga4d['mcpstamp_landing_7d'],
 'no_ga4_property':['noovertimetax.com','dscrradar.com','ukmoneycalc.com','taxbreakcalc.com','abwex.com','bugbountyreality.com']}

# ---------------- Stripe
K['stripe']={'status':'UNAVAILABLE, owner unlock','cmd':'python3 stripe.py (one attempt) -> stripe -p worthmyclaim get /v1/checkout/sessions --live -d limit=100 -d created[gte]=<now-7d>','result':'exit 1, stderr: "your live mode API key needs to be re-configured. Run `stripe login` to re-authenticate" (same state as 11-02 section 5)','login_attempted':False,
 'last_known':'2026-10-30 snapshot data/s1030/stripe_raw.json: MCP paid ever 0; MCP sessions 7d 5, 28d 13','proxy':{'ordinary_checkout_handoff_window':fun['ordinary']['checkout_handoff'],'last_ordinary_handoff_day':max(d for d,v in by['ordinary'].items() if v.get('checkout_handoff')),'probe_checkout_handoff_11-03':by['probe']['2026-11-03'].get('checkout_handoff',0)},'unlock':'stripe login for the live BeLikeNative account (owner), then python3 data/s1103/kpi/stripe.py'}

json.dump(K,open('../kpi.json','w'),indent=1)

# ================= markdown
a('# MCP estate KPI snapshot, 2026-11-03 (cold, read-only)\n')
a(f'Measured 2026-11-03 07:35-08:00 UTC ({GEN} build). Baseline: `data/s1102/kpi.md` (2026-11-02 ~02:30 UTC). Every figure carries the command that produced it; scripts, raw outputs and this build live in `data/s1103/kpi/`. 11-03 is a partial UTC day (~7.7 h). Result: npm finally reports (17,205 downloads, all mirror/scanner-shaped), but no channel shows verified human usage and MCP paid stays $0 (Stripe still locked).\n')
a('## 0. Headline and deltas vs the 11-02 baseline\n')
a('| metric | 11-02 baseline | 11-03 | delta | section |\n|---|---|---|---|---|')
o9=K['github']['old9_totals']; m65=K['github']['mirrors_65']
a(f"| npm downloads, 68 pkgs, 10-30..11-01 (npm populated through 11-01) | not measurable (0, window ended 10-29) | {fmt(TOT)} ({fmt(tot['2026-10-30'])} / {fmt(tot['2026-10-31'])} / {fmt(tot['2026-11-01'])}) | measurement now possible; not growth | 1 |")
a(f"| npm median per package 10-30 / 10-31 / 11-01 | n/a | {med['2026-10-30']:g} / {med['2026-10-31']:g} / {med['2026-11-01']:g} | decay to floor 7/day | 1 |")
a(f"| npm share of downloads on placeholder version `0.0.0-stage` | n/a | {stage_tot:,} of {stage_tot+real_tot:,} ({100*stage_tot/(stage_tot+real_tot):.1f}%) | scanner/mirror evidence | 1 |")
a(f"| mcp.zovo.one guard-passing clicks, total | {br38['guard_passing_navigation_total']} | {r38['guard_passing_navigation_total']} | {sd(r38['guard_passing_navigation_total'],br38['guard_passing_navigation_total'])} | 2 |")
a(f"| ... last 7d / of which known-dead `buy.unknown-product` | {br38['guard_passing_navigation_7d']} / {br38['known_dead_product_navigation_7d']} | {r38['guard_passing_navigation_7d']} / {r38['known_dead_product_navigation_7d']} | {sd(r38['guard_passing_navigation_7d'],br38['guard_passing_navigation_7d'])} / {sd(r38['known_dead_product_navigation_7d'],br38['known_dead_product_navigation_7d'])} (window roll, no new clicks) | 2 |")
a(f"| mcp.zovo.one ordinary successful_business_call, window total | 373 (10-27..11-02 partial) | {fun['ordinary']['successful_business_call']} (10-28..11-03 partial) | {sd(fun['ordinary']['successful_business_call'],373)} | 2 |")
a(f"| mcp.zovo.one ordinary checkout_handoff, window total | 5 | {fun['ordinary']['checkout_handoff']} | 0 (last 10-31) | 2 |")
a(f"| Workers: 20 satellites invocations 11-02 / 11-03 partial | 9 old only: {K['cf']['old9_d1102_baseline_partial']:,} (11-02 partial 02:30Z) | {K['cf']['satellites_total_by_day']['d1102']:,} (11-02 full, 20 sats) / {K['cf']['satellites_total_by_day']['d1103_partial']:,} (11-03 to 07:34Z) | old 9: {K['cf']['old9_d1102_baseline_partial']:,} -> {K['cf']['old9_d1102_full']:,} (partial -> full day) | 3 |")
mr=[r for r in cfrows if r['worker']=='mcp-remote'][0]
a(f"| Workers: mcp-remote 11-02 / 11-03 partial | 14,235 (partial) | {mr['d1102']:,} / {mr['d1103_partial']:,} | flat ~7.6k/h | 3 |")
a(f"| GitHub, 65 mirror repos, views / clones (14d) | 254 / 3,864 | {m65['views']} / {m65['clones']:,} | {sd(m65['views'],254)} / {sd(m65['clones'],3864)} (14d window roll) | 4 |")
a(f"| GitHub, original 9 satellites, views / clones (14d) | {o9['baseline_views']} / {o9['baseline_clones']} | {o9['views']} / {o9['clones']} | {sd(o9['views'],o9['baseline_views'])} / {sd(o9['clones'],o9['baseline_clones'])} | 4 |")
a(f"| GitHub, all 20 satellites, views / clones (14d) | n/a | {K['github']['sat20_totals']['views']} / {K['github']['sat20_totals']['clones']:,} | 11 satellites new | 4 |")
mst=[g for g in gtab if g['site']=='sc-domain:mcpstamp.com'][0]
a(f"| GSC mcpstamp.com, 28d fresh impressions / clicks | 92 / 0 | {mst['fresh'][1]} / {mst['fresh'][0]} | {sd(mst['fresh'][1],92)} impr, 0 clicks | 5 |")
a(f"| GSC mcp.zovo.one pages, 28d clicks / impressions | 0 / 37 | {gsc['mcp_zovo_one']['all_28d_to_today']['clicks']} / {gsc['mcp_zovo_one']['all_28d_to_today']['impressions']} | 0 / 0 | 5 |")
a(f"| GA4 utm_source=mcp sessions, 28d, {len(gatab)} properties | {bmcp} | {tmcp} | {sd(tmcp,bmcp)} (all 7: ingredientcalculator.com, 10-30, 0 engaged) | 6 |")
a(f"| GA4 all-source sessions 28d, same properties | {bts:,} ({len(bgr)} props) | {ts:,} ({len(gatab)} props) | {sd(ts,bts)} | 6 |")
a("| Stripe MCP paid | $0 last known (10-30), not re-measurable | not re-measurable (live key invalid) | owner unlock | 7 |\n")

a('## 1. npm downloads (68 packages)\n')
a(f"Commands: `python3 npm.py` = `GET https://api.npmjs.org/downloads/range/2026-10-30:2026-11-03/<pkg>` per package (scoped `/` as `%2F`) plus `GET https://registry.npmjs.org/<pkg>` for `time.created`; `python3 npm_versions.py` = `GET https://api.npmjs.org/versions/<pkg>/last-week`. Raw: `npm.json`, `npm_versions.json`.\n")
a(f"Positive control `@modelcontextprotocol/sdk`: `curl https://api.npmjs.org/downloads/point/last-day/@modelcontextprotocol%2Fsdk` now returns 7,867,120 for 2026-11-01..2026-11-01 (on 11-02 the window ended 10-29); explicit range 2026-10-30:2026-11-02 returns 28,961,417 (11-02 baseline: 0). Per day in `range/2026-10-25:2026-11-03`: 10-30 13,292,449, 10-31 7,801,848, 11-01 7,867,120, **11-02 = 0 and 11-03 = 0 (not yet populated, a zero here is NOT a measurement)**. So npm is populated through 2026-11-01 only; our packages were created 2026-10-30 04:05..05:xx UTC (registry `time.created`, 53 in hour 04, 15 in hour 05), so 10-30 is a partial first day.\n")
a(f"**Total, 68 packages, 10-30..11-01: {TOT:,}** (10-30 {tot['2026-10-30']:,}; 10-31 {tot['2026-10-31']:,}; 11-01 {tot['2026-11-01']:,}). @theluckystrike scope (n={len(sc)}): {sum(r['total'] for r in sc):,}; unscoped satellites (n={len(un)}): {sum(r['total'] for r in un):,}. The 11 satellites built on 11-02 are not on npm (`curl https://registry.npmjs.org/<name>` returns `Not found` for all 11; control `cups-to-grams-mcp` resolves, created 2026-10-30T04:05Z), so there is nothing to download.\n")
a('Top 15 by 10-30..11-01 downloads:\n')
a('| # | package | 10-30 | 10-31 | 11-01 | total | on `0.0.0-stage` (last-week) | flag |\n|---|---|---|---|---|---|---|---|')
for i,r in enumerate(srt[:15],1):
    a(f"| {i} | {r['pkg']} | {r['d1030']} | {r['d1031']} | {r['d1101']} | {r['total']} | {r['stage']} ({100*(r['stage_share'] or 0):.0f}%) | {'OUTLIER' if r['pkg'] in out_flags else 'mirror band'} |")
a(f"\n**Mirror/scanner noise (not demand).** Every one of the 68 packages got 166..490 downloads on 10-30 (median {med['2026-10-30']:g}, MAD {mad['2026-10-30']:g}), 8..21 on 10-31 (median {med['2026-10-31']:g}) and 4..55 on 11-01 (median {med['2026-11-01']:g}): one shape, same order of magnitude for a 58-server back-office estate and 9 data satellites alike. {stage_tot:,} of {stage_tot+real_tot:,} downloads ({100*stage_tot/(stage_tot+real_tot):.1f}%) hit version `0.0.0-stage`, a placeholder created in the first publish minute that no human installs by name; all 68 packages show downloads of it (per-version API). That is registries/mirrors/scanners fetching every version of every new package. Decay 203 -> 14 -> 7 per package per day is the signature of a one-time sweep plus a residual crawler floor.\n")
a('**Outliers** (robust z: above median + 5 x 1.4826 x MAD on that day):\n')
a('| package | day: downloads (x median) | stage share | note |\n|---|---|---|---|')
for k,v in sorted(out_flags.items(),key=lambda kv:-sum(x[1] for x in kv[1])):
    r=[x for x in rows if x['pkg']==k][0]
    a(f"| {k} | {'; '.join(f'{d[5:]}: {n} ({m}x)' for d,n,m in v)} | {100*(r['stage_share'] or 0):.0f}% | on 11-01 {r['d1101']} vs floor {med['2026-11-01']:g}; placeholder share well below the 40% norm: more of its downloads are on the real version |")
a(f"\nCaveat: npm gives no UA/referrer/geography, so even the outliers (mcp-timezone, mcp-license on both 10-30 and 11-01; mcp-invoice, mcp-quotes on 11-01) are only 'above the mirror floor by 3-8x'. Generic names (timezone, license, invoice, quotes) fit npm-search discovery or one extra scanner; neither is proven. Satellites: none of the 9 unscoped satellite packages is an outlier (totals 294..340 vs median {st.median([r['total'] for r in rows]):g}); no-tax-on-overtime-mcp is #3 only because its 10-30 count is a little higher. Delta vs baseline: baseline had no data; this is the first real read. Re-run `python3 npm.py` on/after 2026-11-05 for 11-02..11-04.\n")

a('## 2. mcp.zovo.one first-party funnel and clicks\n')
a(f"Commands: `curl -s -H 'x-mcp-probe: 1' -A mcp-kpi/1 https://mcp.zovo.one/stats/funnel` (generated_at {fun['generated_at']}, http 200, complete=true) and `/stats/clicks` (generated_at {clk['generated_at']}); clicks interpreted with `node scripts/r38-commercial-kpis.mjs data/s1103/kpi/stats_clicks.json`. Raw: `stats_funnel.json`, `stats_clicks.json`, `r38_out.json`. 'ordinary' = unmarked, not proven human; 'probe' = requests carrying x-mcp-probe.\n")
a('| day (UTC) | offer_view | successful_business_call | first_success_anon_token_day | upgrade_impression | checkout_handoff | probe offer_view | source |\n|---|---|---|---|---|---|---|---|')
for d in fdays:
    v=ftab[d]; a(f"| {d}{' (partial)' if d=='2026-11-03' else ''} | {v['offer_view']} | {v['successful_business_call']} | {v['first_successful_anon_token_server_day']} | {v['upgrade_impression']} | {v['checkout_handoff']} | {v['probe_offer_view'] if v['probe_offer_view'] is not None else 'n/a'} | {v['src']} |")
a(f"\nDelta on overlapping days: 10-28..11-01 identical to baseline; 11-02 was 41 offer_view / 0 calls at 02:30Z and is now {ftab['2026-11-02']['offer_view']} / {ftab['2026-11-02']['successful_business_call']} (full day). 11-01 sweep (358 business calls, 194 anon token-days, all `unattributed`) was a single day and has not repeated (11-02: 8, 11-03: 0 so far). **New on 11-02: 7 successful_business_call and 1 first-success anon token with source `oauth`** (all other days are `unattributed`); source labels are unverified declarations, so this is a client that completed an OAuth flow and called tools, not a verified person. Probe cohort: {fun['probe']['offer_view']:,} offer_views in the window (about 3,050/day, probe-marked: monitors or tests, not customers) and 2 probe checkout_handoffs today (11-03; probe-marked, most likely tests). Ordinary checkout_handoff: 5 in the window, last 10-31, none since.\n")
a(f"Clicks (instrument 3): guard-passing total {r38['guard_passing_navigation_total']} (baseline {br38['guard_passing_navigation_total']}, delta {sd(r38['guard_passing_navigation_total'],br38['guard_passing_navigation_total'])}: **no new counted click in ~29 hours**); last 7d {r38['guard_passing_navigation_7d']} (baseline {br38['guard_passing_navigation_7d']}), of which known-dead `buy.unknown-product` {r38['known_dead_product_navigation_7d']} (baseline {br38['known_dead_product_navigation_7d']}) and {r38['other_guard_passing_navigation_7d']} other (`site.usecase.merge-pdf-in-claude.sticky` 1, `store.bundle` 1, `store.home.table.invoice` 1; unchanged). Unattributed (excluded from totals): total {clk['unattributed_total']} (baseline {bclk['unattributed_total']}), 7d {clk['unattributed_7d']} (baseline {bclk['unattributed_7d']}). Verified buyers: not measurable (null).\n")

a('## 3. Cloudflare Workers invocations per satellite (all 20, plus mcp-remote)\n')
a(f"Command: `python3 cf2.py` = GraphQL `workersInvocationsAdaptive` on account dd3f2a29..., dims scriptName/status/datetimeHour, `scriptName_in` the 20 satellites in `~/mcp-servers/satellites` that have a results JSON + 3 in-progress ones from other lanes + `mcp-remote`, window {cf['window'][0]} .. {cf['window'][1]}; token from env `CLOUDFLARE_API_TOKEN`. Raw: `cf.json` (per-day/status and per-hour). 11-03 is partial (00:00..07:34Z). Counts include our probes and scanners; no UA/path dimension.\n")
a('| worker | 11-02 (full) | 11-03 (to 07:34Z) | baseline 11-02 (02:30Z partial) | median req/h, last 24 full hours | launch burst (hour UTC: req) | errors |\n|---|---|---|---|---|---|---|')
for r in cfrows:
    if r['worker']=='mcp-remote' or r['worker'] in cf['extra']: continue
    bb=r['baseline_d1102_partial']
    a(f"| {r['worker']} | {r['d1102']:,} | {r['d1103_partial']:,} | {bb if bb is not None else 'n/a (deployed 11-02)'} | {r['median_hour_last24']:g} | {', '.join(f'{h}: {c}' for h,c in r['launch_burst'])} | {r['errors_total']} |")
T=K['cf']['satellites_total_by_day']
a(f"| **20 satellites total** | **{T['d1102']:,}** | **{T['d1103_partial']:,}** | old 9: {K['cf']['old9_d1102_baseline_partial']:,} | | | {K['cf']['satellite_errors_total']} |")
a(f"| mcp-remote | {mr['d1102']:,} | {mr['d1103_partial']:,} | 14,235 | {mr['median_hour_last24']:g} | none | {mr['errors_total']} errors; 152 clientDisconnected (baseline 139) |")
a("\nReading: (1) every satellite shows exactly one 586..670 req/hour burst in the hour 05:00 UTC after its first deploy (10-30 for the old 9, 11-02 for the 11 new ones), then a flat median of 29..43 req/hour (individual hours 14..115) around the clock with no day/night swing: crawler/monitor shape, same for all 20, no satellite stands out. (2) Old-9 11-02 baseline numbers (70..105) were a 2.5-hour slice; the full day is 849..1,102, i.e. the same ~35-45/h. (3) Two bursts today are not demand: `car-loan-interest-deduction-calculator-mcp` 816 req in hour 06 and `ab-test-sample-size-calculator-mcp` 811 req in hour 07; their source dirs (and gold-price, subdomain-finder) were modified 07:33Z by another lane, so these are most likely that lane's build/test traffic (not verified). (4) Errors on satellites = 0 (clientDisconnected on 5 workers, 1-2 each). 3 satellite dirs created today (`cpi-inflation-calculator-mcp`, `irs-mileage-rate-per-diem-mcp`, `silver-price-per-gram-mcp`) have 0 invocations (not deployed yet) and are excluded from the 20. mcp-remote: median 7.6k requests/hour, flat, 176,578 on 11-02, against 8 ordinary business calls that day.\n")

a('## 4. GitHub traffic (14-day window)\n')
a("Command: `python3 gh.py` = `gh api repos/<repo>/traffic/views`, `/traffic/clones`, `/traffic/popular/referrers`, `/traffic/popular/paths`, `repos/<repo>` for 20 satellites (theluckystrike) and the 65 estate mirrors. Raw: `gh.json`. All repos report private=false. Window now ends 11-02 (11-03 not yet reported), so the 14 days roll one day forward relative to the baseline.\n")
a('| satellite repo | views (uniq) | clones (uniq) | baseline views (uniq) | baseline clones (uniq) | referrers |\n|---|---|---|---|---|---|')
for r in ghrows:
    b=r['baseline']; rf=', '.join(f"{x['referrer']} {x['count']}" for x in r['referrers']) if isinstance(r['referrers'],list) and r['referrers'] else 'none'
    bv=("%s (%s)"%(b['views'],b['view_uniques'])) if b else 'n/a'; bc=("%s (%s)"%(b['clones'],b['clone_uniques'])) if b else 'n/a'
    a(f"| {r['repo']} | {r['views']} ({r['view_uniques']}) | {r['clones']} ({r['clone_uniques']}) | {bv} | {bc} | {rf} |")
a(f"\nSatellites: 0..3 views each, 0 referrers on all 20, 33..129 clones with 20..72 uniques on the 14 repos that have any, 0 clones on 6 (ab-test, aca-ptc, ap-score, retirement-limits, subdomain-finder, uk-ssp; the newer repos) - clone volume rises with repo age: crawlers, CI, registry/directory ingestion. Original 9: views {o9['baseline_views']} -> {o9['views']}, clones {o9['baseline_clones']} -> {o9['clones']}. Top 5 estate mirrors by view uniques:\n")
a('| repo | views | view uniq | clones | clone uniq | referrers | baseline views/uniq/clones/uniq |\n|---|---|---|---|---|---|---|')
for r in K['github']['top5_mirrors']:
    rf=', '.join(f"{x['referrer']} {x['count']}" for x in r['referrers']) if isinstance(r['referrers'],list) and r['referrers'] else 'none'; b=r['baseline']
    a(f"| {r['repo']} | {r['views']} | {r['view_uniques']} | {r['clones']} | {r['clone_uniques']} | {rf} | {'/'.join(str(b[k]) for k in ('views','view_uniques','clones','clone_uniques')) if b else 'n/a'} |")
a(f"\n65 mirrors: {m65['views']} views, {m65['clones']:,} clones (baseline 254 / 3,864; the clone drop is `bln-mcp-grammar-server` rolling off a 710-clone day, not a trend). Non-github.com referrers across all 85 repos (14d): " + ', '.join(f"{k} {v}" for k,v in ref.most_common() if k!='github.com') + f". Where: Google 7 on zovo-one/mcp-price-tracker (views on 10-28 1, 10-29 1, 10-30 2, none 10-31..11-01; baseline 8); geminicli.com 4 (mcp-invoice-generator 2, mcp-spreadsheet 1, mcp-barcode 1); search.brave.com 2 (mcp-pdf, mcp-pomodoro), kagi.com 1 (mcp-tax-calc), yandex.ru 1 (mcp-calendar), registry.modelcontextprotocol.io 1 (theluckystrike/mcp-servers), aocr.org 1. Monorepo `theluckystrike/mcp-servers`: views 120 (42 uniq), clones 1,735 (197 uniq), private=false (baseline 123/44, 1,404/199).\n")

a('## 5. Google Search Console, 28 days\n')
a(f"Command: `python3 gsc.py` (`scripts/gsc_tool.py` searchAnalytics/query per property, {K['gsc']['properties']} properties; baseline {K['gsc']['baseline_properties']}, new: {', '.join(K['gsc']['new_property'])}), final window {gsc['windows']['final_28d'][0]}..{gsc['windows']['final_28d'][1]} (dataState=final; final data ends 10-31), fresh window {gsc['windows']['all_28d_to_today'][0]}..{gsc['windows']['all_28d_to_today'][1]} (dataState=all; data ends 11-02). Positive control ingredientcalculator.com: {K['gsc']['positive_control']['final_clicks']} final clicks (baseline {K['gsc']['positive_control']['baseline_final_clicks']}). Raw: `gsc.json`, `gsc_sitemaps.json` (note: the copied gsc.py sitemap call had a 's1102 typo `mpstamp`' that returned 403 in `gsc.json`; `gsc_sitemaps.py` supersedes it).\n")
a('| property (satellite money site) | satellites | final clicks / impr | baseline final | fresh clicks / impr | baseline fresh |\n|---|---|---|---|---|---|')
for g in gtab:
    a(f"| {g['site']} | {g['satellites']} | {g['final'][0]} / {g['final'][1]:,} | {g['baseline_final'][0]} / {g['baseline_final'][1]:,} | {g['fresh'][0]} / {g['fresh'][1]:,} | {g['baseline_fresh'][0]} / {g['baseline_fresh'][1]:,} |")
a(f"\nNo Search Console property for {', '.join(nopro)} (OWNER UNLOCK, unchanged: add zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com). Money-site traffic (lakelevelnow 303, goldgramprice 241, ingredientcalculator 565, statewage 21 final clicks) predates the MCPs and cannot be attributed to them: GSC never sees UTM.\n")
a(f"**mcp.zovo.one** (page filter `//mcp.zovo.one/` inside sc-domain:zovo.one): final 0 clicks / 37 impressions on 6 pages, fresh identical (top: `/` 26, `/mcp/connect` 7); per day 10-20..11-02 impressions: " + ', '.join(f"{d[5:]} {i}" for d,i,c in gsc['mcp_zovo_one_by_day']) + ". Unchanged from baseline.\n")
a("**mcpstamp.com** (sc-domain, fresh window): impressions per day " + ', '.join(f"{d[5:]} {i}" for d,i,c in gsc['mcpstamp_by_day']) + f" (all 0 clicks); 28d total {mst['fresh'][1]} impressions vs 92 on 11-02 (final window {mst['final'][1]} vs 6). First impressions appear on 10-30 and climb to ~72/day by 11-01. Top pages (fresh): " + ', '.join(f"{p.replace('https://www.mcpstamp.com','')} {i}" for p,i,c in gsc['mcpstamp_detail']['all_28d_to_today']['pages'][:5]) + '. Top queries (fresh): ' + ', '.join(f"`{q}` {i}" for q,i,c in gsc['mcpstamp_detail']['all_28d_to_today']['queries'][:6]) + '.\n')
ms=sm['sc-domain:mcpstamp.com']['sitemap'][0]; zs=sm['sc-domain:zovo.one']['sitemap']
a(f"Sitemaps: mcpstamp.com `{ms['path']}` submitted {ms['contents'][0]['submitted']} (baseline 144), last downloaded {ms['lastDownloaded']}, errors {ms['errors']}; `mcp.zovo.one/sitemap.xml` submitted " + str(next(int(s['contents'][0]['submitted']) for s in zs if 'mcp.zovo.one' in s['path'])) + " (unchanged), downloaded " + next(s['lastDownloaded'] for s in zs if 'mcp.zovo.one' in s['path']) + ". The `indexed` field reads 0 on every sitemap including zovo.one ones that earn clicks, so it is unreliable; impressions are the indexing signal.\n")

a('## 6. GA4 (28 days)\n')
a(f"Commands: `python3 ga4.py` (Analytics Data API `runReport`, service account zovo-gsc-cleanup, sessionSource EXACT `mcp`, 28daysAgo..today, {len(gatab)} properties), `python3 ga4b.py` (CONTAINS `mcp` on source/medium/campaign), `python3 ga4c.py`, `python3 ga4d.py`. Positive control: ingredientcalculator.com google sessions {[x for x in gr['properties/555964379']['top_sources'] if x[0]=='google'][0][1]} (baseline 561); hostName control: zovo.one property hostNames 28d = {ga4d['zovo_one_hostnames_28d']} (so `mcp.zovo.one` hostName = 0 rows is a real zero; and `curl -s https://mcp.zovo.one/` (200, 116,364 bytes) contains no gtag/googletagmanager/analytics string, so there is no GA tag on that page and GA4 could not see human visits there anyway). Raw: `ga4.json`, `ga4_mcp_detail.json`, `ga4_ingredient_mcp_sessions.json`, `ga4d.json`.\n")
a(f"**utm_source=mcp sessions across all {len(gatab)} properties: {tmcp} (baseline {bmcp}, delta {sd(tmcp,bmcp)})**; also zero for any `-mcp` utm_medium besides these: all {tmcp} are ingredientcalculator.com, medium `cups-to-grams-mcp`, 2026-10-30, 4 on `/cups-to-grams` and 3 on `/recipe-converter`, 0 engaged, US desktop Windows Chrome/Edge (property time 06:32-06:33 and 11:57; the property time zone is Europe/Warsaw per `ga4e.py` -> analyticsadmin `properties/555964379` timeZone, so 05:32-05:33 and 10:57 UTC on 10-30, which puts the first group of 5 inside the 05:00 UTC hour in which the cups-to-grams-mcp Worker took its 661-request launch burst; the 11-02 baseline wrote 13:32 / 18:57 UTC, which assumed Los Angeles time and was wrong). No new session since; none for any of the other 19 satellites on any property (lakelevelnow, goldgramprice, statewage, recipetool, assetloancalculator, mcpstamp, zovo.one included). Satellites whose money site has no GA4 property cannot be verified at all (verified with `python3 ga4e.py`: analyticsadmin dataStreams defaultUri of all 30 properties contain none of these six domains): noovertimetax.com, dscrradar.com, ukmoneycalc.com, taxbreakcalc.com, abwex.com, bugbountyreality.com (9 of 20 satellites: no-tax-on-overtime, dscr, uk-income-tax, uk-ssp, aca-ptc, car-loan, estate-gift, ab-test, subdomain-finder). Total sessions 28d {ts:,} vs {bts:,} baseline.\n")
a('| property | sessions 28d | baseline | utm_source=mcp | top sources |\n|---|---|---|---|---|')
for x in gatab[:12]:
    a(f"| {x['property']} | {x['sessions_28d']:,} | {x['baseline_sessions_28d'] if x['baseline_sessions_28d'] is not None else 'n/a'} | {x['mcp_sessions_28d']} | {', '.join(f'{s} {c}' for s,c in x['top_sources'])} |")
dd=collections.defaultdict(lambda:[0,0,0])
for (dt,src,med_),(s,e,u) in mc:
    k=(dt,'google organic' if (src,med_)==('google','organic') else 'bing organic' if (src,med_)==('bing','organic') else 'direct' if src=='(direct)' else src+'/'+med_)
    dd[k][0]+=int(s); dd[k][1]+=int(e)
a('\n**mcpstamp.com sessions by day and source** (`ga4d.py`, property time zone Europe/Warsaw (`ga4e.py`), sessions / engaged): ' + '; '.join(f"{d[4:6]}-{d[6:]} {s}: {v[0]}/{v[1]}" for (d,s),v in sorted(dd.items())) + f". Direct dominates (156 sessions on 10-30 with 2 engaged = launch-day scan; 15-19/day after, 0-3 engaged); organic search: bing 1+1+4 sessions (10-30, 10-31, 11-02, 0 engaged) and **1 google organic session on 11-03, engaged**. That one session is the only GA4 event in the estate that is both search-sourced and engaged, and it is n=1.\n")

a('## 7. Stripe (MCP checkout sessions and paid)\n')
a(f"**UNAVAILABLE. Owner unlock.** Command, tried once: `python3 stripe.py` (copied from s1102; first call is `stripe -p worthmyclaim get /v1/checkout/sessions --live -d limit=100 -d created[gte]=<now-7d>`). Result: exit 1, `your live mode API key needs to be re-configured. Run `stripe login` to re-authenticate` (same failure as 11-02 section 5). No `stripe login`, no browser sign-in, no plugin authenticate call. Unlock: owner runs `stripe login` for the live BeLikeNative account, then `python3 data/s1103/kpi/stripe.py`. Last known (2026-10-30 `data/s1030/stripe_raw.json`): MCP paid ever 0, MCP sessions 7d 5, 28d 13. Independent proxy (section 2): ordinary checkout_handoff (the event that creates a session) = {fun['ordinary']['checkout_handoff']} in the window, last on 10-31, none since; probe-marked handoffs today: 2 (tests). So any paid MCP order since the snapshot is bounded by 0 ordinary handoffs after 10-31; still unconfirmed without the key.\n")

a('## 8. Ranked: what shows any signal that is plausibly human\n')
a('Ranking is by how hard the signal is to explain with bots/our own checks. Nothing here is verified human; all are small.\n')
rank=[
 ('mcpstamp.com Google/Bing search discovery (channel)','GSC impressions 6 (10-30), 49, 72, 73 (11-02), 200 in 28d vs 92; real long-tail queries (`can claude open zip files` 10, `chase overdue invoices automatically` 13, `invoiced to chatgpt` 4) on pages /can-claude/read-zip-files/ 52, /developers/ 18; GA4 1 google-organic ENGAGED session on 11-03 plus 6 bing-organic sessions (0 engaged).','Impressions come from Google users or indexers issuing real queries; engaged organic session is behavior a scanner rarely shows. Caveats: 0 GSC clicks through 11-02, n=1 engaged session, could be our own test search. Indexing is what is new here.'),
 ('mcp.zovo.one `oauth` source calls (channel)','11-02: 7 successful_business_call + 1 first-success anon token with source `oauth`; every earlier day is `unattributed`.','A completed OAuth flow followed by tool calls is what a real MCP client (e.g. a Claude/ChatGPT connector) does; scanners and our probes use `unattributed`/probe. Caveat: source label is an unverified declaration; no offer_view or checkout_handoff accompanies it; one UTC day only.'),
 ('npm outliers: @theluckystrike/mcp-timezone, mcp-license, mcp-invoice, mcp-quotes (packages)','11-01: 54, 55, 24, 21 downloads vs median 7 (robust outliers); timezone 490 and license 394 on 10-30 vs median 203; stage-placeholder share 19-27% vs 40% overall.','Excess sits on the real versions, not the scanner-only placeholder, and persists into the third day when the sweep has decayed. Caveat: npm has no UA/referrer; could be one extra scanner or npm-search ranking for generic names.'),
 ('GitHub search-engine referrals (channel)','Google 7 on zovo-one/mcp-price-tracker (views 10-28..10-30, none after); search.brave.com 2 (mcp-pdf, mcp-pomodoro), kagi.com 1 (mcp-tax-calc), yandex.ru 1 (mcp-calendar), geminicli.com 4, registry.modelcontextprotocol.io 1.','People clicking from a search result land as search-engine referrers; bots rarely send a Referer. Caveat: 1-2 views per day total, all on back-office mirrors, none on any of the 20 satellites (0 referrers), last Google referral 10-30.'),
 ('cups-to-grams-mcp -> ingredientcalculator.com (satellite)','7 GA4 sessions utm_source=mcp on 10-30 (4 `/cups-to-grams`, 3 `/recipe-converter`), 0 engaged, no new since.','Only satellite with any downstream landing. Five sessions in two consecutive minutes at 05:32-05:33 UTC (GA4 property time zone is Europe/Warsaw; the 11-02 baseline mis-converted this to 13:32 UTC) and 2 at 10:57 UTC, all 0 engaged, US desktop Windows: the first group lands inside the 05:00 UTC launch-scan hour in which this Worker took 661 requests, so a JS-executing scanner or our own deploy check following the tool-result link is the simplest explanation. Static for 4 days.'),
]
for i,(t,e,w) in enumerate(rank,1): a(f"{i}. **{t}.** Evidence: {e} Why plausibly human: {w}")
a('\n**Show none** (each with the check that says so):\n')
none=[
 'All 20 satellite Workers (invocations): identical 586..670 req/h launch burst at 05:00Z then flat median 29..43/h around the clock, 0 errors; no worker differs from the others (section 3).',
 '19 of 20 satellites on GA4: 0 utm_source=mcp sessions in all 30 properties apart from the 7 cups-to-grams sessions (positive control: ingredientcalculator.com google 591 sessions); the money sites with GA4 are lakelevelnow, goldgramprice, statewage, recipetool, assetloancalculator, examscorecalc, mcpstamp; 9 satellites (no-tax-on-overtime, dscr-loan, uk-income-tax, uk-ssp, aca-ptc, car-loan, estate-gift, ab-test, subdomain-finder) have a money site with no GA4 property, so their downstream is unmeasurable, not zero.',
 'GitHub clones on the 14 satellites that have any (33..129 per repo, 20..72 uniques; 6 have 0) with 0 referrers and 0..3 views: crawler/CI/registry ingestion, not developers.',
 'npm for the 9 published satellites and the 58 back-office packages: all in the one mirror band (10-30 counts 166..490 across all 68, median 203; 7 median on 11-01); 11 newer satellites are not on npm.',
 'mcp.zovo.one clicks: 0 new guard-passing clicks since the baseline (1020 -> 1020); 23 of 26 in 7d are the known-dead `buy.unknown-product` route; Google clicks to mcp.zovo.one pages 0 (37 impressions, unchanged).',
 'mcp-remote (176,578 requests on 11-02): 8 ordinary business calls, 0 ordinary checkout_handoff after 10-31; the 11-01 spike of 358 calls did not repeat.',
 'Stripe: cannot be read (live key invalid); last known MCP paid = $0.',
]
for x in none: a(f"- {x}")
a('\n## Owner unlocks (unchanged unless noted)\n')
a('- Stripe live read: `stripe login` (live BeLikeNative account), then `python3 data/s1103/kpi/stripe.py`.\n- GSC and GA4 for noovertimetax.com, dscrradar.com, ukmoneycalc.com (GSC) and GA4 for taxbreakcalc.com, abwex.com, bugbountyreality.com: add zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com (https://search.google.com/search-console, https://analytics.google.com admin > access management).\n- Workers path/UA split: enable Workers Logs (observability) on the satellite workers (config change, not done here).\n- GA4 tag on mcp.zovo.one (no gtag in the home page HTML, hostName returns 0 rows with a working control), if page-level human traffic there should ever be measurable.\n- npm: re-run `python3 npm.py` on/after 2026-11-05 to read 11-02..11-04.')
a('\n## Reproduce\n')
a('`cd data/s1103/kpi && for s in npm.py npm_versions.py cf.py cf2.py gh.py gsc.py gsc_sitemaps.py ga4.py ga4b.py ga4c.py ga4d.py; do timeout 600 python3 $s; done; curl -s -H "x-mcp-probe: 1" -A mcp-kpi/1 https://mcp.zovo.one/stats/funnel -o stats_funnel.json; curl -s -H "x-mcp-probe: 1" -A mcp-kpi/1 https://mcp.zovo.one/stats/clicks -o stats_clicks.json; (cd ~/mcp-servers && node scripts/r38-commercial-kpis.mjs data/s1103/kpi/stats_clicks.json > data/s1103/kpi/r38_out.json); python3 build.py`. Scripts are copies of data/s1102/kpi with output paths, windows (gsc.py), satellite list (cf2.py, gh.py: 20) and sitemap typo adjusted; no s1102 file was modified.')
open('../kpi.md','w').write('\n'.join(md)+'\n')
print('ok',len('\n'.join(md)))

# add ranking / none / unlocks / corrections to kpi.json
K=json.load(open('../kpi.json'))
K['ranking_plausibly_human']=[{'rank':i,'signal':t,'evidence':e,'why_plausible_and_caveats':w} for i,(t,e,w) in enumerate(rank,1)]
K['show_none']=none
K['corrections_to_baseline']=['s1102 kpi.md section 6 converted the cups-to-grams GA4 sessions to 13:32 and 18:57 UTC assuming Los Angeles time; the property time zone is Europe/Warsaw (ga4e.json), so they were 05:32-05:33 and 10:57 UTC on 10-30; the first group falls in the 05:00 UTC launch-scan hour of the cups-to-grams-mcp Worker.','s1102 gsc.py sitemap call used `sc-domain%3Ampstamp.com` (typo, 403); fixed in the s1103 copy and superseded by gsc_sitemaps.py.']
K['owner_unlocks']=['Stripe live read: stripe login (live BeLikeNative account), then python3 data/s1103/kpi/stripe.py','GSC property for noovertimetax.com, dscrradar.com, ukmoneycalc.com and GA4 property for those plus taxbreakcalc.com, abwex.com, bugbountyreality.com: add zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com','Enable Workers Logs (observability) on satellite workers for a path/UA split','GA4 tag on mcp.zovo.one (none in the home page HTML)','npm: re-run npm.py on/after 2026-11-05 for 11-02..11-04']
K['ga4']['property_timezones']={v['name']:v.get('timeZone') for v in json.load(open('ga4e.json')).values()}
K['ga4']['domains_without_ga4_stream_verified']=['noovertimetax','dscrradar','ukmoneycalc','taxbreakcalc','abwex','bugbountyreality']
json.dump(K,open('../kpi.json','w'),indent=1)
