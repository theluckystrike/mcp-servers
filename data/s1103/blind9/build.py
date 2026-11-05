import json,re,collections,sys,shutil,hashlib
from urllib.parse import urlparse
sys.path.insert(0,'.')
import score as S
SC='/private/tmp/claude-501/-Users-mike/0aae16dd-365c-4bae-b2e8-e3082a9e13f9/scratchpad/'
SUB='/Users/mike/.claude-zovo-team2/projects/-Users-mike/0aae16dd-365c-4bae-b2e8-e3082a9e13f9/subagents/'
R9T=SUB+'agent-a5abbce40d16d064b.jsonl'; SUT=SUB+'agent-ad02314099cb616a4.jsonl'
Q9=json.load(open('/Users/mike/mcp-servers/data/blind_questions.json'))['questions']
QS=json.load(open('supplement_questions.json'))['questions']
r9=json.load(open(SC+'r9/r9_raw.json')); su=json.load(open(SC+'supp/supp_raw.json')); r8=json.load(open('/Users/mike/mcp-servers/data/blind_recommendation_r8.json'))
shutil.copy(SC+'r9/r9_raw.json','r9_raw.json'); shutil.copy(SC+'supp/supp_raw.json','supplement_raw.json')
EST_HOSTS=('mcp.zovo.one','zovo.one','mcpstamp.com','claudecodeguides.com')
def est_owned(u):
    h=S.host(u)
    return h in EST_HOSTS or h.endswith('.zovo.one') or h.endswith('.mcpstamp.com') or h.endswith('lipmichal.workers.dev')
def est_third(u):
    p=urlparse(u); h=S.host(u); pl=p.path.lower()
    return (h=='github.com' and pl.startswith('/theluckystrike')) or (h=='mcpservers.org' and ('theluckystrike' in pl or 'zovo' in pl)) or ('@theluckystrike' in u.lower())
# ---- transcript ground truth
def transcript(path,questions):
    qs={q['q']:q['n'] for q in questions}; calls={}; first={}; fq=[]; nsearch=0; nfetch=0; first_msg=None; other=[]
    for line in open(path):
        try:o=json.loads(line)
        except Exception: continue
        m=o.get('message',{}); c=m.get('content')
        if first_msg is None and m.get('role')=='user': first_msg=c if isinstance(c,str) else json.dumps(c)
        if not isinstance(c,list): continue
        for b in c:
            if b.get('type')=='tool_use':
                calls[b['id']]=(b['name'],b['input'].get('query') or b['input'].get('url') or '')
                if b['name']=='WebSearch': nsearch+=1; fq.append(b['input'].get('query') or '')
                elif b['name']=='WebFetch': nfetch+=1
                elif b['name'] not in ('ToolSearch',): other.append(b['name'])
            elif b.get('type')=='tool_result' and calls.get(b.get('tool_use_id'),('',''))[0]=='WebSearch':
                qq=calls[b['tool_use_id']][1]; t=b.get('content'); t=t if isinstance(t,str) else json.dumps(t)
                if qq in qs and qs[qq] not in first:
                    mm=re.search(r'Links: (\[.*?\])\n',t,re.S); links=json.loads(mm.group(1)) if mm else []
                    first[qs[qq]]={'links':[{'rank':i+1,'title':l.get('title'),'url':l.get('url')} for i,l in enumerate(links)],'text':t.lower()}
    return first,nsearch,nfetch,first_msg,other,fq
def run(label,path,questions,raw):
    first,ns,nf,fm,other,fq=transcript(path,questions)
    prompt_ok=all(q['q'] in fm for q in questions)
    forb=[t for t in ('zovo','mcpstamp','theluckystrike','lipmichal','claudecodeguides') if t in fm.lower()]
    rj={q['n']:q for q in raw['questions']}
    per={}
    for q in questions:
        n=q['n']; links=first[n]['links']; txt=first[n]['text']
        per[n]={'n_raw_results':len(links),
          'mcp_zovo_one_in_raw_results':any(S.is_host(l['url']) for l in links),
          'claudecodeguides_in_raw_results':[l['rank'] for l in links if 'claudecodeguides.com' in l['url']],
          'identity_in_raw_results':[l['rank'] for l in links if S.is_ident(l['url'],l['title'] or '')],
          'estate_text_in_own_verbatim_search':any(t in txt for t in ('zovo','theluckystrike','lipmichal','mcpstamp')),
          'runner_results_match_transcript':[l['url'] for l in links]==[r['url'] for r in rj[n]['results']]}
    est_q=[i for i,x in enumerate(fq) if any(t in x.lower() for t in ('zovo','theluckystrike','lipmichal','mcpstamp','claudecodeguides'))]
    audit={'prompt_contains_all_frozen_questions_verbatim':prompt_ok,'prompt_contains_estate_terms':forb,'web_searches':ns,'web_fetches':nf,
           'other_tools':collections.Counter(other),'first_estate_term_query_index_1based':(est_q[0]+1 if est_q else None),
           'estate_term_queries':[fq[i] for i in est_q]}
    return per,audit
per9,aud9=run('R9',R9T,Q9,r9); perS,audS=run('SUPP',SUT,QS,su)
# ---- manual scoring, R9 (reviewed against answer text and recommended_servers order)
M9={1:(['invoice'],False),3:(['expense-tracker','mileage-log'],True),4:(['bank-statement'],False),6:(['docx','quotes'],True),
    11:(['barcode'],False),12:(['zip'],False),13:(['petty-cash','cash-book'],True),14:(['work-order'],True),
    15:(['recurring'],False),17:(['invoice','quotes','bank-statement','expense-tracker'],False)}
CAVEAT_ONLY={18:'Zovo $19/$39 licence pricing mentioned as an example in a caveat; not recommended, no estate URL cited, runner says it did not find where the purchase is made'}
auto9,hc9,srv9=S.score(r9); auto8,hc8,srv8=S.score(r8)
# check manual vs auto flags
auto_named9={a['n'] for a in auto9 if a['estate_auto']}
assert auto_named9==set(M9),(auto_named9,set(M9))
rows=[]
rec9={q['n']:q for q in r9['questions']}
for q in Q9:
    n=q['n']; a=auto9[n-1]; named=n in M9
    cu=a['cited_urls']
    rows.append({'n':n,'q':q['q'],'r9_estate_named':named,'r9_estate_servers':M9[n][0] if named else [],'r9_first_listed':M9[n][1] if named else False,
      'r9_estate_mentioned_caveat_only':CAVEAT_ONLY.get(n),'r9_confident':rec9[n].get('confident'),
      'r9_n_recommended':a['n_recommended'],'r9_cited_urls':cu,'r9_cited_hosts':a['cited_hosts'],
      'r9_estate_owned_urls_cited':[u for u in cu if est_owned(u)],'r9_estate_third_party_urls_cited':[u for u in cu if est_third(u)],
      **{'r9_'+k:v for k,v in per9[n].items()}})
# R8 recomputed
n8=[a for a in auto8 if a['estate_auto']]
r8_named=[a['n'] for a in n8]; r8_first=[a['n'] for a in auto8 if a['first_listed_auto']]
r8_host=[a['n'] for a in auto8 if a['host_in_results']]; r8_id=[a['n'] for a in auto8 if a['identity_in_results']]
assert r8_named==r8['identity_evaluation']['named_questions'] and r8_first==r8['identity_evaluation']['first_recommendation_questions']
assert r8_host==r8['identity_evaluation']['host_in_results_questions'] and r8_id==r8['identity_evaluation']['identity_in_results_questions']
def occ(d): return sum(len(q.get('recommended_servers',[])) for q in d['questions'])
def estocc(d,auto): return sum(len(a['estate_auto']) for a in auto)
def hostcounts(auto):
    urls=collections.Counter(); qs=collections.defaultdict(set)
    for a in auto:
        for u in a['cited_urls']:
            h=S.host(u); urls[h]+=1; qs[h].add(a['n'])
    return urls,qs
u8,q8=hostcounts(auto8); u9,q9=hostcounts(auto9)
def own(urls): return sum(c for h,c in urls.items() if h in EST_HOSTS or h.endswith('lipmichal.workers.dev'))
r9_est_urls=[u for a in auto9 for u in a['cited_urls'] if est_owned(u)]
r8_est_urls=[u for a in auto8 for u in a['cited_urls'] if est_owned(u)]
spill=[n for n in M9 if not per9[n]['estate_text_in_own_verbatim_search']]
own_search=[n for n in M9 if per9[n]['estate_text_in_own_verbatim_search']]
comp={'named_in_answer':{'R8':len(r8_named),'R9':len(M9),'R9_strict_excluding_caveat_only':len(M9),'R9_if_caveat_mention_counted':len(M9)+len(CAVEAT_ONLY)},
 'first_listed':{'R8':len(r8_first),'R9':sum(1 for v in M9.values() if v[1])},
 'mcp_zovo_one_in_raw_results_of_verbatim_search':{'R8':len(r8_host),'R9':sum(1 for n in per9 if per9[n]['mcp_zovo_one_in_raw_results'])},
 'identity_theluckystrike_or_lipmichal_in_raw_results':{'R8':len(r8_id),'R9':sum(1 for n in per9 if per9[n]['identity_in_raw_results'])},
 'estate_owned_host_urls_cited':{'R8':len(r8_est_urls),'R9':len(r9_est_urls)},
 'questions_citing_an_estate_owned_host':{'R8':len({a['n'] for a in auto8 if any(est_owned(u) for u in a['cited_urls'])}),'R9':len({a['n'] for a in auto9 if any(est_owned(u) for u in a['cited_urls'])})},
 'recommendation_occurrences':{'R8':occ(r8),'R9':occ(r9)},'estate_recommendation_occurrences':{'R8':estocc(r8,auto8),'R9':estocc(r9,auto9)},
 'distinct_recommended_urls_or_names':{'R8':len(srv8),'R9':len(srv9)},'runner_reported_distinct_servers':{'R8':r8['summary']['recommended_server_count'],'R9':r9['summary']['distinct_servers_named']},
 'raw_results_per_verbatim_search_min_max':{'R8':[min(len(q['results']) for q in r8['questions']),max(len(q['results']) for q in r8['questions'])],'R9':[min(v['n_raw_results'] for v in per9.values()),max(v['n_raw_results'] for v in per9.values())]},
 'R9_named_questions':sorted(M9),'R8_named_questions':r8_named,'R9_new_vs_R8':sorted(set(M9)-set(r8_named)),'R9_lost_vs_R8':sorted(set(r8_named)-set(M9)),
 'R9_named_after_estate_surfaced_in_own_verbatim_search':sorted(own_search),'R9_named_only_via_cross_question_follow_up':sorted(spill)}
# supplement
asu=S.score(su)[0]
supp=[]
for q in QS:
    n=q['n']; a=asu[n-1]; sj=[x for x in su['questions'] if x['n']==n][0]
    supp.append({'n':n,'q':q['q'],'estate_named':False,'confident':sj.get('confident'),'recommended':[{'name':r['name'][:110],'url':r['url']} for r in sj['recommended_servers']],
      'cited_hosts':a['cited_hosts'],**{k:v for k,v in perS[n].items()}})
supp_hosts=collections.Counter(S.host(u) for a in asu for u in a['cited_urls'])
assert not [a for a in asu if a['estate_auto']]
out={'lane':'blind9','measured_at':'2026-11-03','procedure':'docs/BLIND_RECOMMENDATION_PROCEDURE.md (re-run steps 1-4); questions: data/blind_questions.json v1 (frozen 2026-09-10), sha256 fe25d683ab4d1c58dd79e15717935151f7bec373c9787b4bc9a776d9f6b759e2',
 'instrument':{'runner':'Agent tool, subagent_type general-purpose, fresh context (not a fork), prompt = 18 verbatim questions + neutral research instruction; runner model per transcript: claude-sonnet-5-5','r8_runner_model':r8['provenance']['model'],
   'runner_audit_R9':aud9,'runner_audit_supplement':audS,
   'scoring':'parent, after runner completed, scripts blind9/score.py + blind9/build.py; scorer reproduces R8 exactly (9 named, 6 first-listed, 15 host-in-results, 11 identity) from data/blind_recommendation_r8.json'},
 'r9':{'named_in_answer':len(M9),'first_listed':comp['first_listed']['R9'],'per_question':rows},
 'r8_recomputed':{'named_questions':r8_named,'first_listed_questions':r8_first,'host_in_results_questions':r8_host,'identity_in_results_questions':r8_id},
 'comparison':comp,
 'source_host_counts':{'definition':'URLs cited per runner: recommended_servers[].url plus URLs inside the answer text, de-duplicated per question','R8_top':[[h,c,len(q8[h])] for h,c in u8.most_common(15)],'R9_top':[[h,c,len(q9[h])] for h,c in u9.most_common(15)],'fields':'[host, url_count, questions_citing]'},
 'supplement':{'label':'SUPPLEMENT, not part of R9 or the R8/R9 KPI series','questions_file':'data/s1103/blind9/supplement_questions.json','questions_sha256':hashlib.sha256(open('supplement_questions.json','rb').read()).hexdigest(),
   'estate_named':0,'first_listed':0,'mcp_zovo_one_or_mcpstamp_or_satellite_host_in_raw_results':0,'identity_in_raw_results_questions':[n for n in perS if perS[n]['identity_in_raw_results']],
   'questions_without_confident_answer':su['summary']['questions_without_confident_answer'],'cited_host_counts':supp_hosts.most_common(15),'per_question':supp}}
json.dump(out,open('/Users/mike/mcp-servers/data/s1103/blind9.json','w'),indent=1,default=list)
json.dump({'comp':comp,'aud9':aud9,'audS':audS,'u8':u8.most_common(12),'u9':u9.most_common(12),'supp_hosts':supp_hosts.most_common(10),'spill':spill,'own':own_search},open('/private/tmp/claude-501/-Users-mike/0aae16dd-365c-4bae-b2e8-e3082a9e13f9/scratchpad/dbg.json','w'),indent=1,default=list)
print(json.dumps(comp,indent=1))
print(json.dumps(aud9,default=list,indent=1)); print(json.dumps(audS,default=list,indent=1))
print(u8.most_common(10)); print(u9.most_common(12)); print(supp_hosts.most_common(10))
