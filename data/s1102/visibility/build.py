import json
gh={}
for l in open('gh_raw.jsonl'):
    d=json.loads(l); gh.setdefault(d['repo'],[]).append(d)
dirs={}
for l in open('dir_raw.tsv'):
    r,reg,gl,ms=l.rstrip('\n').split('\t'); dirs[r]=dict(registry=reg.startswith('yes'),glama=gl=='200',mcpstamp=ms=='200')
web={ # repo: (query, hit_position or None, hit_url)
'lake-level-mcp':"MCP server for lake level data",
'no-tax-on-overtime-mcp':"MCP server for no tax on overtime deduction calculator",
'minimum-wage-mcp':"MCP server for state minimum wage lookup",
'dscr-loan-calculator-mcp':"MCP server for DSCR loan calculator",
'paycheck-calculator-mcp':"Claude connector for paycheck take-home pay calculator",
'uk-income-tax-salary-mcp':"MCP server for UK income tax salary calculator",
'cups-to-grams-mcp':"MCP server for cups to grams cooking conversion",
'gold-price-per-gram-mcp':"MCP server for gold price per gram",
'us-federal-holidays-business-days-mcp':"MCP server for US federal holidays and business days calculation",
'ab-test-sample-size-calculator-mcp':"MCP server for A/B test sample size calculator",
'ap-score-distributions-mcp':"Claude connector for AP score distributions",
'car-loan-interest-deduction-calculator-mcp':"MCP server for car loan interest deduction calculator",
'recipe-nutrition-calculator-mcp':"MCP server for recipe nutrition calculator",
'section-179-deduction-calculator-mcp':"MCP server for Section 179 deduction",
'subdomain-finder-mcp':"MCP server for subdomain finder"}
hits={'us-federal-holidays-business-days-mcp':(1,"https://mcpservers.org/servers/theluckystrike/us-federal-holidays-business-days-mcp")}
rows=[]
for r in dirs:
    g=gh[r]
    rows.append(dict(repo=r,
      github=[dict(query=x['query'],total_count=x['total_count'],rank=x['rank'],top3=x['top3']) for x in g],
      github_rank1_queries=sum(1 for x in g if x['rank']==1),
      web=dict(query=web[r],hit=r in hits,position=hits.get(r,(None,None))[0],url=hits.get(r,(None,None))[1]),
      directory=dirs[r], directory_count=sum(dirs[r].values())))
tot=dict(
 github_queries=len(rows)*2, github_rank1_queries=sum(x['github_rank1_queries'] for x in rows),
 github_satellites_rank1_on_both=sum(1 for x in rows if x['github_rank1_queries']==2),
 github_satellites_rank1_on_at_least_one=sum(1 for x in rows if x['github_rank1_queries']>=1),
 web_searches=15, web_searches_with_our_url=sum(1 for x in rows if x['web']['hit']),
 directory_registry=sum(x['directory']['registry'] for x in rows),
 directory_glama=sum(x['directory']['glama'] for x in rows),
 directory_mcpstamp=sum(x['directory']['mcpstamp'] for x in rows),
 directory_checks_passed=sum(x['directory_count'] for x in rows), directory_checks_total=45)
out=dict(date="2026-11-02",lane="visibility",totals=tot,satellites=rows,
 controls=dict(github_positive="'lake level mcp' -> lake-level-mcp rank 1 of 3 (gh api search/repositories?q=lake+level+mcp&per_page=30)",
  glama_negative="https://glama.ai/mcp/servers/theluckystrike/zz-fake-repo-xyz-mcp -> 404; github/github-mcp-server -> 200; our pages have title+repo name (real content)",
  mcpstamp_negative="https://www.mcpstamp.com/free-servers/zz-fake-repo-xyz-mcp/ -> 404; index 200",
  registry_negative="registry search zz-fake-repo-xyz-mcp -> 0 servers",
  web_positive="us-federal-holidays query surfaced mcpservers.org/servers/theluckystrike/us-federal-holidays-business-days-mcp at position 1, so the search tool can return our URLs"),
 caveats=["GitHub queries contain the repo-name phrase (by design, repos are named for the query), so rank 1 is expected; generic-phrase queries (gold price mcp server rank 5/19, recipe nutrition mcp server rank 7/19, take home pay mcp rank 2/5, cooking conversion mcp server rank 3/4) are the informative ones. uk salary tax calculator mcp returned 0 results (GitHub search is keyword AND on name/description/readme).",
  "WebSearch tool is standard mode, US-only, 1 call per question, returns ~7-20 URLs in engine order; position = order in returned list. Results may differ from Google.",
  "mcpservers.org listing exists for us-federal-holidays (found via search) but mcpservers.org returns 403 to curl for every URL incl. fake, so presence of the other 14 there is unmeasured (not counted).",
  "Only 1 web search per satellite; no Glama/mcpservers/getdrio pages for ours seen in any of the other 14 results."],
 commands=dict(github="gh api 'search/repositories?q=<q>&per_page=30' (3 s spacing), script visibility/gh_rank.sh, raw gh_raw.jsonl",
  registry="curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=<repo>' and match name io.github.theluckystrike/<repo>",
  glama="curl -A Mozilla/5.0 https://glama.ai/mcp/servers/theluckystrike/<repo> -> http code",
  mcpstamp="curl -L https://www.mcpstamp.com/free-servers/<repo>/ -> http code",
  web="WebSearch tool, standard mode, 2026-11-02"))
json.dump(out,open('../visibility.json','w'),indent=1)
L=["# Visibility baseline, 2026-11-02","",
"Measured read-only. Raw data: visibility/gh_raw.jsonl, visibility/dir_raw.tsv. Re-run: visibility/gh_rank.sh.","",
"## Totals",
f"- GitHub repo search: rank 1 on {tot['github_rank1_queries']} of {tot['github_queries']} queries ({tot['github_satellites_rank1_on_both']} of 15 satellites rank 1 on both, {tot['github_satellites_rank1_on_at_least_one']} of 15 on at least one). Caveat: queries contain the repo name; see generic-phrase rows.",
f"- Web search: our URL appeared in {tot['web_searches_with_our_url']} of 15 buyer-style searches (us-federal-holidays, via mcpservers.org listing, position 1; none to github.com/theluckystrike, mcpstamp.com, glama, registry or workers.dev).",
f"- Directory presence: {tot['directory_checks_passed']} of 45 checks (registry {tot['directory_registry']}/15, Glama {tot['directory_glama']}/15, mcpstamp {tot['directory_mcpstamp']}/15).","",
"## Per satellite","",
"| Satellite | GitHub q1 (total, rank) | GitHub q2 (total, rank) | Web search (our URL?) | Registry | Glama | mcpstamp |","|---|---|---|---|---|---|---|"]
for x in rows:
    g=x['github']; f=lambda y:f"{y['query']} ({y['total_count']}, {y['rank'] if y['rank'] else 'none'})"
    w="yes, pos %d (mcpservers.org)"%x['web']['position'] if x['web']['hit'] else "no"
    d=x['directory']; yn=lambda b:"yes" if b else "NO"
    L.append(f"| {x['repo']} | {f(g[0])} | {f(g[1])} | {w} | {yn(d['registry'])} | {yn(d['glama'])} | {yn(d['mcpstamp'])} |")
L+=["","## Web search questions (2026-11-02, WebSearch standard mode)",""]+[f"- {x['repo']}: \"{x['web']['query']}\" -> {'HIT pos %d'%x['web']['position'] if x['web']['hit'] else 'no hit'}" for x in rows]
L+=["","## Controls"]+[f"- {k}: {v}" for k,v in out['controls'].items()]
L+=["","## Caveats"]+[f"- {c}" for c in out['caveats']]
L+=["","## Commands"]+[f"- {k}: {v}" for k,v in out['commands'].items()]
open('../visibility.md','w').write("\n".join(L)+"\n")
print(json.dumps(tot,indent=1))
