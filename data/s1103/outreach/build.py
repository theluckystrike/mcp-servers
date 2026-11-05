#!/usr/bin/env python3
"""Builds outreach.json, outreach.md and drafts.txt for the S1103 outreach-drafts lane.
Single source for the draft text so the three outputs cannot drift. Run: python3 -I build.py
"""
import json, re, os

OUT = "/Users/mike/mcp-servers/data/s1103"
WORK = OUT + "/outreach"
DATE = "2026-11-03"
SIG = "Michael"

DRAFTS = {
 "glama-newsletter": {
  "subject": "Pitch for the newsletter on what models get wrong",
  "body": (
   "Hi,\n\n"
   "I'd like to write a practical piece for the MCP newsletter on facts a model gets wrong, and the small server that fixes each one.\n\n"
   "The clearest case is the IRS mileage rate. It went from 72.5 to 76 cents on July 1, 2026, after most models were trained, so a model multiplies by the old rate. Live river gauges and 2026 SAT percentiles work the same way.\n\n"
   "I run 25 free hosted servers that need no key, and I'd use them only as worked examples. The explainers are at mcpstamp.com/can-claude/. Should I send an outline first?\n\n"
   + SIG)},
 "mcp-directory": {
  "subject": "25 submissions from theluckystrike, none listed yet",
  "body": (
   "Hi,\n\n"
   "I sent 25 free MCP servers through your submit endpoint between October 30 and November 3. None has a page under /servers/ yet. I checked today, and /servers/github loads while ours don't.\n\n"
   "Is something wrong with the entries, or is the queue just long? Each one is a hosted server with no key, built for facts models get wrong, such as the IRS mileage rate that changed on July 1, 2026. Examples are at mcpstamp.com/can-claude/.\n\n"
   "Tell me what's missing and I'll fix it.\n\n"
   + SIG)},
 "skila-ai": {
  "subject": "Tool suggestion, free IRS mileage rate MCP server",
  "body": (
   "Hi Skila team,\n\n"
   "I'd like to suggest a free MCP server for your MCP roundups. It's the IRS Mileage Rate and Per Diem server. The IRS moved the 2026 business mileage rate from 72.5 to 76 cents on July 1, after most models were trained, so a model can multiply by the old rate.\n\n"
   "It needs no key and no signup. MIT license, source at github.com/theluckystrike/irs-mileage-rate-per-diem-mcp, and a plain explainer at mcpstamp.com/can-claude/calculate-mileage-deduction/.\n\n"
   "I'm the author. I have 24 more free servers if another suits your readers better.\n\n"
   + SIG)},
 "console-dev": {
  "subject": "Tool suggestion, 25 free MCP servers for live data",
  "body": (
   "Hi David,\n\n"
   "I'd like to suggest a tool for Console. It's a set of 25 free, MIT-licensed MCP servers that give an agent facts it can't get from training, with no API key. One reads live USGS river gauges. Another applies the IRS mileage rate that changed on July 1, 2026.\n\n"
   "Each runs as a hosted URL, and the source is under github.com/theluckystrike. Explainers are at mcpstamp.com/can-claude/.\n\n"
   "I know you review developer tools, so tell me if this is the wrong fit. A one-line no is fine.\n\n"
   + SIG)},
}

for k, d in DRAFTS.items():
    d["word_count"] = len(re.findall(r"[A-Za-z0-9'/.:@_-]+", d["body"]))
    assert d["word_count"] < 120, (k, d["word_count"])

TARGETS = [
 {"id": "glama-newsletter", "send_order": 1, "outlet": "Glama MCP Newsletter",
  "person": "No editor named on the page. The only published address is frank@glama.ai.",
  "kind": "newsletter", "fit": "high",
  "proof_url": "https://glama.ai/newsletter", "fetched": DATE + " (WebFetch, then raw HTML by curl 08:24Z)",
  "quote": "If you are building with MCP and have practical insights to share ... we would like to hear from you. ... Mentioning your product is fine as long as the piece delivers genuine value to the MCP community. Interested? Reach out at frank@glama.ai.",
  "route_type": "email", "route": "frank@glama.ai (mailto link on the page)",
  "why_fit": "MCP-only weekly digest. It asks for practical pieces, deep-dives, adoption stories and lessons from running MCP in production, and it allows a product mention when the piece is useful.",
  "cautions": ["The invitation is for a written piece, not a server announcement, so the draft pitches a piece.",
               "60,000+ readers and the Friday send day are Glama's own claims. No issue archive was found.",
               "data/s1102/packets.md already holds a different pitch to the same address (directory policy mistakes). Send only one of the two, and wait for a reply before the other."]},
 {"id": "mcp-directory", "send_order": 2, "outlet": "MCP.Directory",
  "person": "No maintainer named.", "kind": "directory", "fit": "high",
  "proof_url": "https://mcp.directory/about", "fetched": DATE + " (WebFetch, then raw HTML by curl 08:24Z)",
  "quote": "Have a question, suggestion, or want to list your server? Reach out to us at [email protected]. You can also submit your server directly through the site.",
  "route_type": "email", "route": "hello@mcp.directory (Cloudflare-protected link; the data-cfemail value decodes to hello@mcp.directory and the page data also carries a plain mailto)",
  "why_fit": "MCP directory. It publishes this address for questions and listing requests, and 25 of our servers sit in its review queue.",
  "cautions": ["It's a status question, not a pitch. The page states no review time.",
               "Facts behind the draft. 25 repos accepted by POST /api/submit-server on 2026-10-30, 2026-11-02 and 2026-11-03 (logs in data/s1030, s1102/dirsub, s1103/dist/w2). 0 of 27 repo names resolve under /servers/ today, with controls /servers/github 200 before and after and a fake name 404."]},
 {"id": "skila-ai", "send_order": 3, "outlet": "Skila AI (news, tools directory, weekly newsletter)",
  "person": "Unnamed editorial team.", "kind": "newsletter and directory", "fit": "medium",
  "proof_url": "https://skila.ai/contact", "fetched": DATE + " (WebFetch, then raw HTML by curl 08:24Z)",
  "quote": "Have a tip for a breaking AI story, want to suggest a tool for review ... Our editorial team reviews all submissions. ... How do I get my AI tool listed on tools.skila.ai? Email us at skilavn@gmail.com with your tool name, website, and a brief description.",
  "route_type": "email", "route": "skilavn@gmail.com (published on the contact page, with mailto links for editorial inquiries)",
  "why_fit": "Its newsletter page lists MCP server and agent skill roundups for developers, and the site has an MCP Servers section.",
  "cautions": ["Activity is unconfirmed. The newest dated article on the news.skila.ai homepage is 2026-06-14. Open a recent issue before sending.",
               "Its FAQ says it publishes no guest posts or press releases, so the draft is a tool suggestion.",
               "It also sells featured slots. Do not buy one."]},
 {"id": "console-dev", "send_order": 4, "outlet": "Console (weekly developer tools newsletter)",
  "person": "David Mytton, named on the about page as the writer.", "kind": "newsletter", "fit": "adjacent",
  "proof_url": "https://console.dev/about", "fetched": DATE + " (WebFetch, then raw HTML by curl 08:24Z)",
  "quote": "To suggest a tool or flag an error, email hello@console.dev",
  "route_type": "email", "route": "hello@console.dev (mailto link on the page)",
  "why_fit": "Active weekly (latest issue October 29, 2026, every Thursday). It reviews developer tools and offers its own feed over MCP.",
  "cautions": ["The about page does not say it covers MCP servers, so expect a low hit rate. Send last, or skip.",
               "It sells review placement. Do not buy one."]},
]

NOT_USED = [
 ("newsletters with no route", "PulseMCP and The Agentic Loop pause all submissions (page last updated September 3, 2026, https://www.pulsemcp.com/submit) and publish no tips address. MCP Bits (Dave Bettin), MCP Weekly Digest and MCPJam publish no tips or contact route on their about pages. MCP Manager's digest offers only a demo booking. Skillselion's MCP Server of the Week gives info@skillselion.com for corrections, citations, press and partnerships, not submissions."),
 ("directories", "mcp.so shows only an unlabeled footer email icon and a $39 paid tier. mcpservers.org and mcp-archive.com are forms with no contact. MyMCPShelf asks for 10 or more GitHub stars and publishes no address. OpenTools charges an annual subscription. ScriptByAI wants three months of operation and a reciprocal backlink. mcpserverfinder.com lists info@ with no invitation. Glama publishes support@glama.ai for questions, but there is nothing to ask, since 25 of 27 repos have Glama pages today."),
 ("awesome lists", "No contributing file asks for personal contact. punkpeye/awesome-mcp-servers (97,232 stars) takes pull requests only. punkpeye/awesome-remote-mcp-servers says ask in the PR or on Discord. wong2 sends submissions to mcpservers.org. tolkonepiu/best-of-mcp-servers takes an issue or pull request. appcypher, TensorBlock, jaw9c, Sagargupta16 and bhavyshekhaliya route through pull requests. The Remote MCP List repo is dormant (last push 2025-09-05, 152 open issues, remotemcplist.com does not resolve)."),
 ("podcasts and video", "No show or channel I fetched publishes a pitch route for MCP tools. ThursdAI lists only host profiles. The Practical AI and AI Engineering Podcast pages returned 404 or moved. The Changelog takes episode requests through a form that needs a sign-in and is not MCP specific. I found no YouTube creator who invites MCP server submissions."),
 ("developer newsletters", "Web Tools Weekly takes tool tips by DM on X or Bluesky, but covers front-end tools and never mentions MCP, so a pitch would be off topic. TLDR, Cooper Press titles, Heavybit DevTools Digest and DevelopersDigest publish no submission route. Agent Commerce Weekly covers x402 payments and invites nothing. Changelog News has a submit form that needs an account and excludes commercial products."),
]

RESEND_LINES = [
 "Resend can mail people who asked for it, so the safe build is an opt-in signup on mcpstamp.com for an update list (new free servers, new can-claude pages) with the purpose written on the form and a confirmation email. An agent can build the form, the confirm page and the unsubscribe page.",
 "Each signup needs a stored receipt (source, UTC time, purpose, confirmed mailbox) and a working per-person unsubscribe link, because scripts/outreach_send.mjs refuses any row without them and caps a batch at ten.",
 "Resend's acceptable-use policy (read 2026-11-02) bans cold outreach, purchased lists and scraped contact data, and it expects complaints under 0.08 percent and bounces under 4 percent.",
 "zovo.one is the verified sending domain and it also sends license and setup mail, so one cold batch that draws a few complaints would put paying customers' email at risk for a list of strangers who never asked.",
 "So the agents get drafts and a signup page, not a send key for outreach, and the owner sends the packet emails by hand from their own mailbox, one at a time.",
 "If the owner wants agent sending later, create a separate sending_access key limited to the verified domain, keep it in the secret store, and point it only at the opted-in file.",
]

CHECKS = {
 "email_addresses_verified_in_raw_html": ["frank@glama.ai (glama.ai/newsletter)", "hello@console.dev (console.dev/about)", "hello@mcp.directory (mcp.directory/about, mailto in page data and data-cfemail c0a8a5acacaf80ada3b0eea4a9b2a5a3b4afb2b9 decoded by XOR key 0xc0)", "skilavn@gmail.com (skila.ai/contact)", "support@glama.ai (glama.ai/support, not used)"],
 "glama_server_pages": "25 of 27 satellite repos return 200 at glama.ai/mcp/servers/theluckystrike/<repo>; the 2 misses are raw-to-cooked-weight-mcp and vegetable-yield-percentage-mcp (404 or not yet public). Controls cups-to-grams-mcp 200 at start and end, fake name 404. 2026-11-03T08:31Z, scratchpad dircheck.sh",
 "mcp_directory_pages": "0 of 27 return 200 at mcp.directory/servers/<repo>. Controls /servers/github 200 at start and end, fake name 404. Same run.",
 "mcp_directory_submissions": "25 distinct repos with ok:true from /api/submit-server, dates 2026-10-30, 2026-11-02, 2026-11-03",
 "can_claude_pages": "mcpstamp.com/can-claude/ returns 200 and links 16 question pages; calculate-mileage-deduction, check-river-levels and look-up-sat-percentiles each return 200 and state the facts used in the drafts",
 "hosted_endpoints_no_token": "irs-mileage-rate-per-diem-mcp (5 tools), river-level-mcp (4), sat-score-percentiles-mcp (4) answered tools/list with no token",
 "repos": "the three repos are public, MIT, pushed 2026-11-03",
 "mistake_caught": "my first Glama and mcp.directory count read 0 of 27 because zsh does not word-split an unquoted variable; controls exposed it and the count was rerun under bash",
 "free_server_count": "25 comes from intel/S1103-strategy.md; 27 satellite directories exist locally and 2 are not yet on Glama",
}


def write_json(scan):
    data = {
        "lane": "outreach-drafts", "date": DATE,
        "summary": {
            "requested": "12 to 15 one-to-one messages",
            "delivered": len(TARGETS),
            "why_fewer": "Only these 4 targets publish a route for MCP submissions or tips and are not paused, paid, dormant or off topic. No address was guessed or scraped, so the packet stops at 4 instead of padding.",
            "nothing_sent": True, "accounts_created": 0},
        "targets": [dict(t, subject=DRAFTS[t["id"]]["subject"], draft=DRAFTS[t["id"]]["body"], draft_words=DRAFTS[t["id"]]["word_count"]) for t in TARGETS],
        "not_used": [{"group": g, "detail": d} for g, d in NOT_USED],
        "resend_section": RESEND_LINES,
        "checks": CHECKS, "humanize": scan}
    json.dump(data, open(OUT + "/outreach.json", "w"), indent=1, ensure_ascii=False)


def bq(text):
    return "\n".join(("> " + l if l else ">") for l in text.split("\n"))


def write_md(scan):
    L = []
    L.append("# Outreach packet for MCP editors and directories\n")
    L.append("Prepared " + DATE + " by the outreach-drafts lane. Nothing was sent, no account was created and nothing was posted. Machine-readable twin is outreach.json.\n")
    L.append("Four targets publish a route for this. Glama and MCP.Directory are strong fits, Skila AI and Console are weaker and carry cautions below. The ask was 12 to 15. I stopped at four because every other candidate I checked either publishes no contact, is paused, charges money, is dormant or covers a different topic, and I did not guess or scrape a single address. The reasons are in the last section so nobody repeats the search.\n")
    L.append("Send them in this order, one email each, from your own mailbox and not from Resend. Wait seven days before a single follow-up.\n")
    L.append("Before sending, confirm three things. The signature reads Michael, copied from the earlier Glama draft. The 25 server count still matches the live estate. And if the older directory-policy pitch to frank@glama.ai has gone out, hold the Glama draft below until Frank replies.\n")
    L.append("## Targets\n")
    for t in TARGETS:
        d = DRAFTS[t["id"]]
        L.append("### %d. %s\n" % (t["send_order"], t["outlet"]))
        L.append("- Who. " + t["person"])
        L.append("- Proof. " + t["proof_url"] + ", fetched " + t["fetched"] + ". It says \"" + t["quote"] + "\"")
        L.append("- Route. " + t["route_type"] + " to " + t["route"] + ".")
        L.append("- Fit, " + t["fit"] + ". " + t["why_fit"])
        L.append("")
        for c in t["cautions"]:
            L.append("Caution. " + c + "\n")
        L.append("Subject line.\n")
        L.append(bq(d["subject"]) + "\n")
        L.append("Draft, %d words.\n" % d["word_count"])
        L.append(bq(d["body"]) + "\n")
    L.append("## Checked and not used\n")
    for g, dtl in NOT_USED:
        L.append(g[0].upper() + g[1:] + ". " + dtl + "\n")
    L.append("## How to give the agents outreach access safely\n")
    for i, ln in enumerate(RESEND_LINES, 1):
        L.append("%d. %s" % (i, ln))
    L.append("")
    L.append("## Checks run\n")
    L.append("Every address above was read from the page's raw HTML by curl, not only from a fetch summary. The 25 of 27 Glama pages and 0 of 27 mcp.directory pages were counted with a positive control at the start and the end of the run and a negative control at the start, on each site. The facts in the drafts (72.5 to 76 cents on July 1, 2026, the river gauge and SAT pages, tools/list with no token) were each re-read today. My first count was wrong because zsh does not split an unquoted variable, the controls exposed it, and the rerun under bash is the one reported.\n")
    L.append("Humanize gate. " + scan + "\n")
    open(OUT + "/outreach.md", "w").write("\n".join(L))


def write_drafts_txt():
    t = []
    for k, d in DRAFTS.items():
        t.append(d["subject"] + "\n\n" + d["body"] + "\n")
    open(WORK + "/drafts.txt", "w").write("\n\n".join(t))


if __name__ == "__main__":
    scan = open(WORK + "/scan_result.txt").read().strip() if os.path.exists(WORK + "/scan_result.txt") else "scan pending"
    write_drafts_txt(); write_json(scan); write_md(scan)
    print({k: v["word_count"] for k, v in DRAFTS.items()})
