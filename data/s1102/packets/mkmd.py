import json,sys
sys.path.insert(0,'.')
from data import *
J=json.load(open('/Users/mike/mcp-servers/data/s1102/packets.json'))
L=[]
def a(*x):
    for i in x: L.append(i)
def esc(s): return s.replace('|','/')
a("# Directory packets for the data satellites",
"",
"Prepared 2026-11-02 by the packets lane. Nothing was submitted, posted or sent. Every check below was a read-only request.",
"",
"## Findings that change the plan",
"",
"1. The brief says 16 servers, but I found 15 (9 reports in data/s1030, 6 in data/s1102, 15 public repos on GitHub, 15 folders in ~/mcp-servers/satellites). No 16th turned up.",
"2. Glama lists 9 of 15. Six are missing. Details in section 1.",
"3. All 66 tools on all 15 live servers have a title and readOnlyHint true. Zero gaps. The destructiveHint and openWorldHint values are explicit too, which OpenAI now requires.",
"4. Five things block a clean submission and none of them are owner minutes. They are in the next table. Two need a code change by the builder session.",
"5. The three picks are minimum-wage-mcp, no-tax-on-overtime-mcp and lake-level-mcp. The holidays server was ruled out because its results pitch the paid Zovo bundle.",
"6. OpenAI renamed its directory. It now takes a plugin ZIP, not a form, and checks domain ownership with a file on each Worker hostname.",
"",
"## Blockers before anyone submits",
"",
"| Id | Where | Problem | Fix | Who |",
"|---|---|---|---|---|")
for b in J['blockers']:
    a(f"| {b['id']} | {esc(b['area'])} | {esc(b['issue'])} | {esc(b['fix'])} | {esc(b['owner'])} |")
a("",
"## The three picks and why",
"")
for r in J['picks']['submit_order_by_risk']:
    a(f"- {r}. {J['picks']['why'][r]}")
a("","Held back.","")
for k,v in J['picks']['rejected'].items():
    a(f"- {k}. {v}")
a("","Submit in the order above, lowest policy risk first, so a rejection on the third doesn't colour the first two.","")

# Section 1 Glama
a("## 1 Glama directory, 12 minutes","",
"URL for the owner step is https://glama.ai/mcp/servers (Add Server). Sign-in is the owner's. Every repo already has glama.json and an MIT LICENSE.","",
"Method. I fetched https://glama.ai/mcp/servers/theluckystrike/REPO for all 15 with a browser user agent. Nine returned 200 with a full page, six returned 404. The positive control was the nine real pages. The negative control was a made-up repo name, which also returned 404. I cross-checked with the search page https://glama.ai/mcp/servers?query=theluckystrike, which lists the same nine and none of the six. Glama did not block the requests. Its REST API needs a key, so I read the HTML.","",
"| Repo | State | TDQS score | Maintenance grade | Scored |",
"|---|---|---|---|---|")
gl={x['repo']:x for x in J['glama']['listed']}
import re
for r in [l.strip() for l in open('repos.txt')]:
    if r in gl:
        g=gl[r]; mg=[x for x in g.get('grades',[]) if x.startswith('maintenance')]
        a(f"| {r} | listed | {g.get('score') or 'tier A, number not parsed'} | {mg[0].split('_grade')[1].replace(':','') if mg else ''} | {g.get('scoredAt','')[:10]} |")
    else:
        a(f"| {r} | missing (404) | none | none | none |")
a("","Scores date from 2026-10-30, so none of the six new servers have been scored yet. Maintenance grade c on most pages will rise as the repos age.","")

# Section 2 Claude
a("## 2 Claude connectors directory, 55 minutes for all three","",
"URL is https://claude.ai/directory/manage then Submit new then MCP connector. It needs any paid Claude plan, and the Owner role on a Team or Enterprise plan. The portal has ten steps and autosaves in the browser, so do each connector in one sitting.","",
"What the current docs require (fetched today from https://claude.com/docs/connectors/building/submission, https://claude.com/docs/connectors/building/review-criteria and https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy).","",
"- Remote HTTPS URL. No authentication is allowed for public data.",
"- Every tool needs a title and readOnlyHint or destructiveHint. The portal flags gaps.",
"- Listing fields are name up to 100 characters, one-liner up to 200, description up to 2,000, one to five categories, docs URL, privacy URL, support contact, icon, and a permanent URL slug.",
"- At least three working example prompts, a privacy policy link, and a verified support channel.",
"",
"On the review side.",
"",
"- Seven policy acknowledgments, all required. The portal asks you to confirm you ran every tool.",
"- A Community listing appears automatically after a scan. A human review is optional, has no SLA, and escalations go to mcp-review@anthropic.com.",
"- Tax, legal and finance count as high-risk uses and need a direct disclosure. The overtime server's estimate disclaimer covers that.",
"- Policy 3F expects you to own or control the endpoints and resources the server touches. Public government data is the gray area, and it only affects the lake server.","")
a("### Privacy policy","",
"https://mcp.zovo.one/privacy exists and returns 200, but it doesn't cover these servers. It describes local servers, the token-based hosted endpoints, Stripe and email signups, and has no mention of workers.dev. Do not submit it unchanged. Add this paragraph under the hosted endpoints heading, or publish it on its own URL.","")
a("> "+PRIVACY_TEXT,"")
a("The policy needs to cover data collection, usage, third-party sharing, retention and contact. The paragraph covers each of those, and the Cloudflare sentence is the honest answer on retention. I checked the Worker config for all 15 servers and none has KV, D1, Durable Object, R2, analytics or cron bindings, so nothing is stored.","")
a("### How the more link must be framed","",
"Results carry a source link (the agency or IRS page) and a more link (a same-topic page on a site you run, with utm_source=mcp and utm_medium set to the repo name). The Anthropic policy bars software that serves advertisements or sponsored content or exists mainly to promote something. A same-topic link with UTM tags is a source link, not an ad, and the three picks pass if they stay that way. The listing and the reviewer notes should say this plainly.","",
"Paste this into the reviewer instructions and the end of each description.","",
"> Each result includes a source link to the agency or IRS page the figure came from. It also includes one related page on a reference site run by the same author, on the same topic as the answer. The answer is complete without it, and the utm tags only count visits.","",
"Rules that keep it safe. One link per result. Never a store, pricing or checkout page. No product names in summaries. Use the GitHub README as the documentation URL, not the Worker landing page, because the landing pages still carry the Zovo collection line. Lake Level Now must lose the almanac text first (blocker B1). Optionally rename more to reference_page.","")
a("### Tool annotation check","",
"Method. I sent initialize and tools/list to every live Worker and tested whether readOnlyHint is true. The check flags a tool with no annotation and one with readOnlyHint false, so a clean result means something. Result across 15 servers and 66 tools. Missing title 0. Missing readOnlyHint 0. Missing destructiveHint 0. Missing openWorldHint 0. The tools with openWorldHint true are the live-fetch ones (gold prices, lake gauges, the subdomain finder).","",
"Style flags only. The lake and gold descriptions say the model's training data can't know today's value, and the recipe nutrition descriptions say to use the tool instead of estimating from memory. Both are factual, but a strict reviewer could read them as steering. An optional reword is Reads the gauge at call time. The paycheck calculator titles contain a colon, which is harmless here.","")
for p in J['claude_packets']:
    r=p['repo']; l=p['listing']
    a(f"### Packet {J['picks']['submit_order_by_risk'].index(r)+1}, {l['name']}","",
      "| Portal step | Answer |","|---|---|",
      f"| 1 Connection | {p['connection_url']} |",
      f"| 2 Tools | Auto-synced. Expect {len(p['tools_synced'])} tools, {', '.join(p['tools_synced'])}. No flags expected. |",
      f"| 3 Name ({l['name_chars']} chars) | {l['name']} |",
      f"| 3 URL slug (permanent) | {l['slug']} |",
      f"| 3 Categories | {l['categories']} |",
      f"| 3 Documentation URL | {l['docs_url']} |",
      f"| 3 Privacy policy URL | https://mcp.zovo.one/privacy, after the paragraph above is added |",
      f"| 3 Support contact | support@zovo.one |",
      f"| 3 Icon | You supply one square PNG (blocker B4) |",
      f"| 4 Reads or writes | Reads data only |",
      f"| 5 Company | Your legal or trading name, website https://zovo.one, contact support@zovo.one |",
      f"| 6 Authentication | Not required |",
      f"| 7 Data handling | {esc(p['data_handling']['api_ownership'])} No personal health data. No sponsored content. |",
      f"| 8 Test and launch | No account needed. See the reviewer instructions below. Run each tool once in Claude first (blocker B5). |",
      f"| 9 Compliance | Tick all seven after reading each. The first-party API item needs the truthful answer in row 7. |","",
      f"One-liner ({l['one_liner_chars']} of 200 characters).","",
      "> "+l['one_liner'],"",
      f"Description ({l['description_chars']} of 2,000 characters).","")
    for para in l['description'].split("\n\n"):
        a("> "+para,">")
    L.pop()
    a("","Use cases text.","","> "+p['use_cases'],"",
      "Reviewer instructions.","","> "+p['test_and_launch']['reviewer_instructions'],"",
      "Example prompts, three, as the policy requires.","")
    for i,t in enumerate(p['test_and_launch']['test_prompts'],1):
        a(f"{i}. {t}")
    a("")

# Section 3 ChatGPT
a("## 3 ChatGPT plugin directory, 90 minutes for all three","",
"URL is the Plugins page in the OpenAI Platform dashboard, documented at https://developers.openai.com/apps-sdk/deploy/submission and https://developers.openai.com/apps-sdk/app-submission-guidelines. Identity verification comes first, either individual or business, in the organization settings. Only organization owners can submit, and EU data residency projects can't.","",
"What changed since the earlier notes. The listing is now a plugin ZIP with plugin.json and mcp.json, uploaded on the Plugins page. The portal then connects to the MCP URL, checks domain ownership with a plain text file at /.well-known/openai-apps-challenge on the MCP hostname, and scans the tools. Review needs five positive and three negative test cases, a demo recording URL and release notes. Only one review runs at a time per plugin.","",
"Rules that bite these servers.","",
"- No MCP, Plugin or Server in the name, so the display names above are used without the repo suffix.",
"- No pricing, subscriptions or promotion in descriptions, and no links to checkout or upgrade pages. Same-topic reference links are fine. The lake almanac text is not (B1).",
"- Servers must not exist mainly as an advertising vehicle. Each satellite has standalone value, which is the argument to make if asked.",
"- readOnlyHint, destructiveHint and openWorldHint must be explicit booleans. All 66 tools pass.",
"",
"Data and scope rules.",
"",
"- A privacy policy URL and a terms URL are expected. The terms URL is missing (B3).",
"- Don't collect SSNs, health data, card data or credentials. The overtime tools ask for filing status, income and amounts only, and negative case 3 tests that an SSN isn't passed along.",
"- Don't scrape or relay third-party services without authorization. The lake server reads public keyless government gauge APIs, so mention that in reviewer notes.",
"- Restrict countries. These servers are US-specific, so each plugin.json lists US only.","",
"Each plugin.json, mcp.json and the test cases are in packets.json under chatgpt_packets. Values in the expected results come from live tool calls today. The lake values move, so the cases say so.","")
for p in J['chatgpt_packets']:
    c=CONN[p['repo']]
    a(f"### Plugin {J['picks']['submit_order_by_risk'].index(p['repo'])+1}, {p['display_name']}","",
      f"MCP URL is {p['mcp_url']}. Domain challenge file goes at https://{p['repo']}.{HOST}/.well-known/openai-apps-challenge and is currently a 404.","",
      "Five positive cases.","",
      "| Scenario | Prompt | Expected tools | Expected result |","|---|---|---|---|")
    for x in p['positive_cases']:
        a(f"| {esc(x['description'])} | {esc(x['prompt'])} | {x['tools_triggered']} | {esc(x['expected_behavior'])} |")
    a("","Three negative cases.","","| Scenario | Prompt | Expected safe behavior |","|---|---|---|")
    for x in p['negative_cases']:
        a(f"| {esc(x['description'])} | {esc(x['prompt'])} | {esc(x['expected_behavior'])} |")
    a("",f"Demo recording. {c['demo_note']}","")
# Section 4
a("## 4 Show HN and the Glama newsletter pitch","",
"### Show HN, 15 minutes to post, then stay in the thread","",
f"Post at https://news.ycombinator.com/submit. The rules are at https://news.ycombinator.com/showhn.html. It must be something people can try, personally built and not a quick one-off, with the author in the thread and no vote asking.","",
f"Title, {J['show_hn']['title_chars']} characters. The Show HN prefix keeps its colon because HN needs that token.","",
"`"+J['show_hn']['title']+"`","",
f"Shorter alternative, {J['show_hn']['alt_title_chars']} characters.","",
"`"+J['show_hn']['alt_title']+"`","",
f"URL to submit is {J['show_hn']['url']}. Its README lists the other servers.","",
"First comment, posted by you as the author.","")
for para in J['show_hn']['first_comment'].split("\n\n"):
    a("> "+para,">")
L.pop()
a("","Risks.","")
for g in J['show_hn']['guideline_risks']: a("- "+g)
a(f"- {J['show_hn']['owner_check']}","")
a("### Glama newsletter email, 3 minutes","",
"Send from your normal mailbox, not Resend, to frank@glama.ai. The newsletter page at https://glama.ai/newsletter asks for a practical piece, says Glama helps with editing, and allows a product mention when the piece is useful. This pitch offers a piece about directory policy mistakes, not an announcement.","",
f"Subject is {J['glama_pitch']['subject']}.","")
for para in J['glama_pitch']['body'].split("\n\n"):
    for ln in para.split("\n"): a("> "+ln,">")
    a(">")
L.pop()
a("","## 5 Text gate","",
"GATE_PLACEHOLDER","",
"## Minutes summary","",
"| Destination | URL | Owner minutes |","|---|---|---|",
"| Glama, add 6 servers | https://glama.ai/mcp/servers | 12 |",
"| Claude directory, 3 connectors | https://claude.ai/directory/manage | 55 |",
"| ChatGPT plugins, 3 plugins | the Plugins page in the OpenAI Platform dashboard | 90 |",
"| Icons and company details | n/a | 15 |",
"| Show HN | https://news.ycombinator.com/submit | 15, plus thread time |",
"| Glama newsletter email | frank@glama.ai | 3 |","",
"The ChatGPT figure assumes identity verification isn't done yet. It drops by about 15 if it is.","")
open('packets.md.draft','w').write("\n".join(L))
