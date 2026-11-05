import json,sys,re
sys.path.insert(0,'.')
from data import *

HN_TITLE="Show HN: Free MCP servers for lake levels, 2027 wages and new tax rules"
HN_ALT="Show HN: 15 free hosted MCP servers for data LLMs lack, no signup"
HN_URL=f"{GH}/lake-level-mcp"
HN_COMMENT=(
"Assistants get one kind of question wrong again and again, and it isn't a reasoning problem. The model just doesn't have the number. "
"Where Lake Mead sits today, what Colorado's minimum wage is on January 1, 2027, how the income phase-out works for the new overtime deduction.\n\n"
"So I wrote small servers that hold those numbers. I have 15 of them now, each one a separate repo with 4 or 5 read-only tools. "
"They run on Cloudflare Workers, need no key and no sign-in, and you can paste the URL into a Claude or ChatGPT connector or run the repo with npx. "
"The lake one is https://lake-level-mcp.lipmichal.workers.dev/mcp and the other 14 are listed at the bottom of its README.\n\n"
"The data comes from two places. The lake server reads USGS, Reclamation, Army Corps, California CDEC and Texas Water Development Board gauges at call time. "
"The wage and tax servers ship tables I copied from DOL, state labor departments and IRS documents, with each source URL and fetch date in DATA_SOURCES.md, and tests built from the official worked examples.\n\n"
"Limits I know about. Three 2027 minimum wage figures (Arizona, Connecticut and Rhode Island) come from the text of the official notice plus a news report because those state sites blocked me, and the result says so. "
"Nebraska, Vermont, DC and Oregon haven't announced 2027 rates, so the server answers not announced instead of guessing. Reclamation publishes with a lag, so Lake Mead can be a day or two old. City minimum wages aren't covered.\n\n"
"Every result also links to a related page on a site I run, with a utm tag so I can see if anyone clicks. The answer doesn't depend on the link, and those sites show ads. "
"I'd like to hear whether you think a link like that belongs in a tool result at all.\n\n"
"MIT licensed. I'm around today to fix anything, and wrong numbers are the bug reports I most want."
)
PITCH_SUBJECT="Pitch for the MCP newsletter on what directory reviewers see in a tool result"
PITCH_BODY=(
"Hi Frank,\n\n"
"I'd like to write a practical piece for the MCP newsletter on what Anthropic's and OpenAI's directory reviewers actually check in a tool result, and the mistakes I found in my own servers while preparing submissions.\n\n"
"I run 15 free, keyless, hosted MCP servers for data a model can't know (lake levels, 2027 state minimum wages, 2025 to 2028 tax deductions). Reading the two directory policies against my own tool output turned up things I'd shipped without noticing. "
"A summary sentence that pointed readers to a paid almanac. A note field that pitched a paid bundle. A link field named more that read like a teaser. Each one is a small fix, and each is the kind of thing that gets a submission rejected.\n\n"
"The piece would be about 900 words with the checklist, real before and after tool output, and the policy clauses linked. It would mention my servers only where they serve as examples. "
"Four of them already have Glama listings with TDQS scores around 4.1 to 4.4, and I'd happily use those as the worked case.\n\n"
"Would that suit a Friday issue? I can send an outline first if you prefer.\n\n"
"Thanks,\nMichael\nhttps://github.com/theluckystrike"
)
# fix claim: how many already listed? computed below

glama=json.load(open('glama-status.json'))
tools=json.load(open('tools-live.json'))
listed=[r for r,v in glama.items() if v]
missing=[r for r,v in glama.items() if not v]
PITCH_BODY=PITCH_BODY.replace("Four of them already have Glama listings with TDQS scores around 4.1 to 4.4",f"Nine of them already have Glama listings, and the scores I could read run from 4.1 to 4.4 on its tool quality scale")

# annotation check
ann=[]
miss_total=0; tool_total=0
for r,v in tools.items():
    for t in v['tools']:
        tool_total+=1
        a=t['annotations'] or {}
        ok=a.get('readOnlyHint') is True
        if not ok: miss_total+=1
        ann.append(dict(server=r,tool=t['name'],title=t['title'],readOnlyHint=a.get('readOnlyHint'),destructiveHint=a.get('destructiveHint'),idempotentHint=a.get('idempotentHint'),openWorldHint=a.get('openWorldHint')))
ow_true=[(x['server'],x['tool']) for x in ann if x['openWorldHint'] is True]
ow_missing=[x for x in ann if x['openWorldHint'] is None]

BLOCKERS=[
 dict(id="B1",area="Lake Level Now, both directories",issue="Tool results contain promotion of a paid product. get_lake_history and get_lake_level add the sentence 'Decades of daily record and day-of-year normals for this lake are in the Lake Level Almanac.' to summary for lakes flagged almanac, and the structured result carries an almanac URL. The landing page also says 'the paid Lake Level Almanac'. Claude policy 4C bars promotional vehicles and OpenAI bars promoting paid digital products and upgrade links.",fix="Remove the almanac sentence from the summary and the almanac field in src/core.ts (lines 474, 507, 521 and the list at 408), and drop the word paid from the landing page in src/worker.ts line 35. Then redeploy. Live evidence 2026-11-02, Shasta history summary and Powell almanac field.",owner="builder session, not done here"),
 dict(id="B2",area="All three, both directories",issue="No privacy policy covers the public servers. https://mcp.zovo.one/privacy returns 200 but describes local stdio servers, the token-based hosted endpoints, Stripe and email signups. It has zero mentions of workers.dev or the public data servers (grep count 0).",fix="Add the Public data servers paragraph from this packet to that page, or publish it as a separate URL. Text is in packets.json under privacy_text and in section 2.",owner="owner or the mcpstamp session (this lane may not edit ~/mcpstamp-work)"),
 dict(id="B3",area="ChatGPT only",issue="OpenAI asks for a terms of service URL and https://mcp.zovo.one/terms returns 404. The plugin also needs a domain challenge file at /.well-known/openai-apps-challenge on each Worker hostname, and all three currently return 404.",fix="Publish a short terms page. For each plugin, add a route to the Worker that returns the exact token the portal shows, then deploy that Worker only.",owner="owner gets the token in the portal, builder deploys"),
 dict(id="B4",area="Both",issue="No icon exists for these servers. Claude asks for an icon and OpenAI asks for four icon files. ~/mcpstamp-work/a4-listing/icons holds only mcpstamp-expenses, resume and tasks.",fix="Supply one square PNG per listing, 512 px or more, plus dark variants for OpenAI.",owner="owner"),
 dict(id="B5",area="Claude",issue="The submission asks you to confirm you ran every tool through MCP Inspector or as a custom connector in Claude. This lane checked over raw HTTP only (initialize and tools/list on all 15 servers, plus 26 tools/call on the three picks and the holidays server).",fix="Add each URL as a custom connector in Claude once and run the three test prompts. About 3 minutes each.",owner="owner"),
]

# Plugin json builders
def plugin_json(r):
    c=CONN[r]; u=urls(r)
    site={"minimum-wage-mcp":"https://statewage.com","no-tax-on-overtime-mcp":"https://noovertimetax.com","lake-level-mcp":"https://lakelevelnow.com"}[r]
    return {
     "$schema":"https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
     "name":c['slug'],"version":"1.0.0","description":c['one_liner'],
     "author":{"name":"OWNER FILL (verified developer name)","email":"support@zovo.one","url":"https://zovo.one"},
     "homepage":site,"repository":u['repo'],"license":"MIT","keywords":c['keywords'],
     "extensions":{"com.openai":{
       "interface":{"displayName":c['display'],"shortDescription":c['one_liner'][:100].rsplit(' ',1)[0] if len(c['one_liner'])>100 else c['one_liner'],
         "longDescription":c['description'],"developerName":"OWNER FILL","category":"Productivity",
         "capabilities":["Read"],"websiteURL":site,"supportURL":"https://zovo.one","privacyPolicyURL":"https://mcp.zovo.one/privacy (after B2)","termsOfServiceURL":"OWNER FILL (after B3)",
         "defaultPrompt":c['prompts'],"brandColor":"OWNER FILL","composerIcon":"./assets/icon.png","logo":"./assets/logo.png"},
       "review":{"test_cases":{
          "positive":[dict(description=d,prompt=p,tools_triggered=t,expected_behavior=e) for d,p,t,e in c['pos']],
          "negative":[dict(description=d,prompt=p,expected_behavior=e) for d,p,e in c['neg']]},
          "demo_recording_url":"OWNER FILL after recording","commerce":False,"commerce_description":"This plugin does not sell products or process payments."},
       "publication":{"countries":["US"] if r!="lake-level-mcp" else ["US"],"release_notes":"Initial release."}}}}
def mcp_json(r):
    return {"$schema":"https://agent-plugins.org/schemas/1.0.0/mcp.schema.json","mcpServers":{c_slug(r):{"type":"streamable-http","url":urls(r)['hosted']}}}
def c_slug(r): return CONN[r]['slug']

out=dict(
 meta=dict(lane="packets",date=TODAY,
   satellites_found=15,satellites_in_brief=16,
   count_evidence="ls ~/mcp-servers/satellites | grep -- '-mcp$' returned 15 dirs; gh repo list theluckystrike --limit 300 shows the same 15 public repos; reports 9 in data/s1030 plus 6 in data/s1102. No 16th found.",
   no_actions="No account created, no form submitted, nothing posted or sent. Read-only curl and MCP tools/list and tools/call only."),
 glama=dict(
   method="curl -s -A 'Mozilla/5.0' -L https://glama.ai/mcp/servers/theluckystrike/<repo> and the search page https://glama.ai/mcp/servers?query=theluckystrike (listed servers parsed from the HTML). Positive control, 9 pages returned 200 with 230 to 275 KB. Negative control, theluckystrike/zzz-not-a-real-repo-mcp returned 404. Glama's REST API needs a key so the HTML was used.",
   blocked=False,
   listed=[dict(repo=r,**{k:v for k,v in glama[r].items() if k in('score','grades','scoredAt')}) for r in listed],
   missing=missing,
   score_note="score is the TDQS overall value. cups-to-grams and us-federal-holidays show TDQS tier A on the page but the numeric value is not in the parsable payload. All scores date from 2026-10-30.",
   owner_action="Add the 6 missing at https://glama.ai/mcp/servers (Add Server). Every repo already carries glama.json and an MIT LICENSE."),
 requirements=dict(
   claude=dict(
     sources=["https://claude.com/docs/connectors/building/submission","https://claude.com/docs/connectors/building/review-criteria","https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy","https://claude.com/docs/connectors/verification"],
     portal="https://claude.ai/directory/manage then Submit new then MCP connector. Any paid Claude plan, Owner role on Team or Enterprise.",
     steps=["Connection (https URL)","Tools (auto-synced, flags missing title or annotation)","Listing (name up to 100, one-liner up to 200, description up to 2,000, 1 to 5 categories, docs URL, privacy URL, support contact, icon, permanent slug)","Use cases","Company","Authentication (choose not required)","Data handling","Test and launch (reviewer instructions, confirm every tool was run)","Compliance (7 acknowledgments, all required)","Review and submit"],
     policy_points=["3A privacy policy link for anything that connects to a remote service","3B verified contact and support channel","3E at least three working example prompts","3F verify you own or control endpoints, domains and external resources the software retrieves","1B high-risk uses (legal, finance, tax) need human-in-the-loop and direct disclosure","4C no advertising, sponsored content, paid placement or promotional vehicle","5E title, readOnlyHint and destructiveHint on every tool"],
     review_criteria_extra=["Tool descriptions must not promote products and services","Server domain should match the service and calls must be to first-party or legitimately proxied APIs","Generic errors fail review","Community listing is automatic after a scan, a human review is optional and has no SLA, escalate to mcp-review@anthropic.com"]),
   openai=dict(
     sources=["https://developers.openai.com/apps-sdk/deploy/submission","https://developers.openai.com/apps-sdk/app-submission-guidelines"],
     note="The directory is now called the plugin directory shared by ChatGPT and Codex. Submission is a plugin ZIP (plugin.json plus mcp.json) uploaded in the Plugins page, with MCP setup and domain verification in the portal.",
     steps=["Verify individual or business identity in OpenAI Platform organization settings","Upload plugin ZIP (plugin.json, mcp.json, icons)","Connect the MCP server, complete the /.well-known/openai-apps-challenge domain check, wait for the tool scan","Fill review details (5 positive and 3 negative test cases, demo recording URL, release notes)","Submit for review and accept attestations, one review active per plugin"],
     policy_points=["No MCP, Plugin or Server in the name","No pricing, subscription or promotion in descriptions","Commerce for physical goods only, no links to checkout or upgrade pages","Must not serve ads or exist mainly as an advertising vehicle","readOnlyHint, destructiveHint and openWorldHint explicit booleans on every tool","Response minimization, no diagnostic or session identifiers","Published privacy policy plus support contact, terms URL expected","Restricted data (SSN, PHI, PCI, credentials) must not be collected","Unofficial connectors and unauthorized scraping are not approved"])),
 blockers=BLOCKERS,
 picks=dict(
   chosen=["minimum-wage-mcp","no-tax-on-overtime-mcp","lake-level-mcp"],
   submit_order_by_risk=["minimum-wage-mcp","no-tax-on-overtime-mcp","lake-level-mcp"],
   why={
    "minimum-wage-mcp":"2027 state rates were announced from August to late September 2026, after most model training data. Embedded tables, no runtime upstream calls, no promotional text in results. Weakness is three 2027 figures from secondary text, which the description and the result both flag. Results carry no disclaimer line, so add one sentence saying it is reference data and the state labor department has the final word (optional, since wage lookup is lower risk than tax).",
    "no-tax-on-overtime-mcp":"Exact phase-out and cap arithmetic from IRS forms and FS-2026-13 (August 2026). Results carry an estimate and not tax advice disclaimer, which satisfies the high-risk disclosure clause. Embedded tables, no runtime upstream calls.",
    "lake-level-mcp":"The only one where the model has no possible answer, because the data is a live gauge reading. Strongest user value and Glama TDQS 4.4. Carries the most policy exposure (live third-party fetches, almanac promotion in B1), so it goes third and only after B1 is fixed."},
   rejected=dict({
    "us-federal-holidays-business-days-mcp":"Useful, but invoice_due_date returns a more_note that pitches the paid Zovo back-office bundle and its more link goes to the https://mcp.zovo.one store page. That is advertising under Claude 4C and a paid-product link under OpenAI rules. Fix first and it becomes the fourth pick.",
    "gold-price-per-gram-mcp":"Live data, but a single third-party spot source with no warranty (api.gold-api.com), which raises the API ownership and unofficial connector questions.",
    "paycheck-calculator-mcp, uk-income-tax-salary-mcp, dscr-loan-calculator-mcp":"Good data, but the tax and finance computation carries the same high-risk disclosure duty as the overtime server with less newer-than-training data."})),
 annotation_check=dict(
   method="POST initialize then tools/list to https://<repo>.lipmichal.workers.dev/mcp for all 15 servers on 2026-11-02, predicate readOnlyHint is true. Control, the predicate flags a tool with no annotations and one with readOnlyHint false.",
   servers=len(tools),tools=tool_total,missing_readOnlyHint=miss_total,
   missing_title=0,missing_destructiveHint=sum(1 for x in ann if x['destructiveHint'] is None),missing_openWorldHint=len(ow_missing),
   openWorldHint_true=[f"{a}.{b}" for a,b in ow_true],
   note="Every tool has a top-level title and annotations.title, readOnlyHint true, destructiveHint false, idempotentHint true and an explicit openWorldHint. This also meets the OpenAI rule that all three hints be explicit booleans.",
   style_flags=["paycheck-calculator-mcp titles contain a colon, for example 'Paycheck calculator: take-home pay'. Harmless for review.","lake-level-mcp get_lake_level and gold-price-per-gram-mcp descriptions say 'Your training data cannot know today's level.' That is a statement of fact, but a strict reader could take it as steering the model. Optional reword to 'Reads the gauge at call time.'","recipe-nutrition-calculator-mcp calculate descriptions say 'Use it instead of estimating nutrition from memory.' Same optional reword."]),
 utm_policy_risk=dict(
   what="Every result carries source (agency or IRS URL) and more (a page on the author's reference site with utm_source=mcp and utm_medium=<repo>). The sites show AdSense ads (lakelevelnow.com privacy page confirms it).",
   rules=["Claude 4C bars software that serves advertisements or sponsored content, or exists primarily as an advertising or promotional vehicle","Claude review criteria bar tool descriptions that promote products and services","OpenAI bars ads, links to checkout or upgrade pages, and promotion of digital products"],
   assessment="A topical link to the page for the same lake, state or calculator, plus UTM tags, is a source link and not an ad. The risk is in four extras. (1) the lake almanac sentence and field (B1), (2) the holidays more_note and store-page more link (rejected pick), (3) the Part of the Zovo MCP collection line on the landing page, which should not be the documentation URL, (4) the key name more, which reads as a teaser.",
   framing="Submit the GitHub README as the documentation URL, not the Worker landing page. In reviewer notes and the listing description say the link goes to a reference page on the same topic run by the same author and that the answer is complete without it. Keep one link per result, never a store, pricing or checkout page. Optional change for lower risk, rename more to reference_page and keep the UTM tags.",
   verified_clean=["minimum-wage-mcp and no-tax-on-overtime-mcp results have no product or paid-offer text (grep of src for paid, bundle, zovo, upgrade, buy, premium, checkout, sponsor, affiliate found nothing relevant)"],
   needs_fix=["lake-level-mcp B1","us-federal-holidays-business-days-mcp more_note and mcp.zovo.one more link"]),
 privacy=dict(checked={"https://mcp.zovo.one/privacy":"200, last updated 16 October 2026, does not mention the public servers","https://mcp.zovo.one/terms":"404","https://lakelevelnow.com/privacy/":"200, covers the website only (AdSense, analytics), not the MCP server","https://zovo.one/privacy":"301 to https://zovo.one/privacy-policy"},
   recommendation="Use https://mcp.zovo.one/privacy after adding the paragraph below. Do not submit it unchanged.",privacy_text=PRIVACY_TEXT),
 claude_packets=[],
 chatgpt_packets=[],
 show_hn=dict(title=HN_TITLE,title_chars=len(HN_TITLE),alt_title=HN_ALT,alt_title_chars=len(HN_ALT),url=HN_URL,
   prefix_note="The Show HN prefix with its colon is the required HN token, so it is kept as is.",
   first_comment=HN_COMMENT,
   guideline_risks=["HN says non-trivial and personally built, not quickly generated one-offs. A batch of 15 servers can read that way. Lead with the three data stories, and say plainly how the work was done if asked.","Show HN needs something people can try. The hosted URL works with no signup, and a reader can curl tools/list.","The README footer lists only 8 other servers. Regenerate it with ~/mcp-servers/satellites/render_index.py so it shows all 14 before posting.","Never ask anyone to upvote."],
   owner_check="Before posting, the owner confirms the sentence about being around today, and decides whether to add a plain line on how much a coding agent wrote."),
 glama_pitch=dict(to="frank@glama.ai",subject=PITCH_SUBJECT,body=PITCH_BODY,source="https://glama.ai/newsletter says contributors write the piece, Glama edits it, and mentioning your product is fine if it delivers value. Send from the owner's normal mailbox, not Resend."),
)
for r in ORDER:
    c=CONN[r]; u=urls(r)
    site={"minimum-wage-mcp":"https://statewage.com","no-tax-on-overtime-mcp":"https://noovertimetax.com","lake-level-mcp":"https://lakelevelnow.com"}[r]
    out['claude_packets'].append(dict(repo=r,
      connection_url=u['hosted'],
      tools_synced=[t['name'] for t in tools[r]['tools']],
      tool_annotations_ok=all((t['annotations'] or {}).get('readOnlyHint') is True for t in tools[r]['tools']),
      listing=dict(name=c['display'],name_chars=len(c['display']),one_liner=c['one_liner'],one_liner_chars=len(c['one_liner']),description=c['description'],description_chars=len(c['description']),
        categories=c['categories_hint'],docs_url=u['readme'],privacy_url="https://mcp.zovo.one/privacy (after B2)",support_contact="support@zovo.one",icon="OWNER supply (B4)",slug=c['slug']),
      use_cases=c['use_cases'],reads_or_writes="Reads data only",
      company=dict(name="OWNER FILL (legal or trading name)",website="https://zovo.one",primary_contact="support@zovo.one"),
      authentication="Not required. No sign-in, no OAuth.",
      data_handling=dict(api_ownership=("Third-party public data. Live reads from US government gauge APIs (USGS, USACE, CDEC, Reclamation, TWDB). Expect a reviewer question on policy 3F." if r=="lake-level-mcp" else "Own computation over tables embedded in the server from official sources. No runtime calls to outside APIs."),personal_health_data="No",sponsored_content="No. Results link to a same-topic reference page run by the author."),
      test_and_launch=dict(reviewer_instructions=f"No account is needed. In Claude add {u['hosted']} as a custom connector with no authentication, then run the three example prompts. Each result includes the source link and an as_of date.",test_prompts=c['prompts'],confirm_tools_run="Owner runs each tool once in Claude (B5)"),
      compliance="Seven acknowledgments, all required. Owner reads and ticks each. Item on first-party API usage needs a truthful answer, see data_handling."))
    pj=plugin_json(r)
    out['chatgpt_packets'].append(dict(repo=r,display_name=c['display'],mcp_url=u['hosted'],plugin_json=pj,mcp_json=mcp_json(r),
      domain_check=f"Portal shows a token. Serve it as plain text at https://{r}.{HOST}/.well-known/openai-apps-challenge (currently 404).",
      positive_cases=pj['extensions']['com.openai']['review']['test_cases']['positive'],negative_cases=pj['extensions']['com.openai']['review']['test_cases']['negative'],
      positive_values_verified=f"Expected values were taken from live tools/call runs against {u['hosted']} on {TODAY}.",
      countries=["US"],commerce=False))
out['owner_minutes']={
  "glama_add_6":12,"claude_directory_3_connectors":55,"chatgpt_plugins_3":90,"show_hn_post":15,"glama_email":3,"icons_and_company_details":15,
  "note":"Estimates. Claude is about 15 minutes per connector plus 10 for the first-time portal tour. ChatGPT includes 15 for identity verification if not yet done, about 15 per plugin for upload and checks, and a 3 minute recording each."}
json.dump(out,open('/Users/mike/mcp-servers/data/s1102/packets.json','w'),indent=1,ensure_ascii=False)
print("ok",miss_total,tool_total,missing)
