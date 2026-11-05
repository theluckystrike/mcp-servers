# Outreach packet for MCP editors and directories

Prepared 2026-11-03 by the outreach-drafts lane. Nothing was sent, no account was created and nothing was posted. Machine-readable twin is outreach.json.

Four targets publish a route for this. Glama and MCP.Directory are strong fits, Skila AI and Console are weaker and carry cautions below. The ask was 12 to 15. I stopped at four because every other candidate I checked either publishes no contact, is paused, charges money, is dormant or covers a different topic, and I did not guess or scrape a single address. The reasons are in the last section so nobody repeats the search.

Send them in this order, one email each, from your own mailbox and not from Resend. Wait seven days before a single follow-up.

Before sending, confirm three things. The signature reads Michael, copied from the earlier Glama draft. The 25 server count still matches the live estate. And if the older directory-policy pitch to frank@glama.ai has gone out, hold the Glama draft below until Frank replies.

## Targets

### 1. Glama MCP Newsletter

- Who. No editor named on the page. The only published address is frank@glama.ai.
- Proof. https://glama.ai/newsletter, fetched 2026-11-03 (WebFetch, then raw HTML by curl 08:24Z). It says "If you are building with MCP and have practical insights to share ... we would like to hear from you. ... Mentioning your product is fine as long as the piece delivers genuine value to the MCP community. Interested? Reach out at frank@glama.ai."
- Route. email to frank@glama.ai (mailto link on the page).
- Fit, high. MCP-only weekly digest. It asks for practical pieces, deep-dives, adoption stories and lessons from running MCP in production, and it allows a product mention when the piece is useful.

Caution. The invitation is for a written piece, not a server announcement, so the draft pitches a piece.

Caution. 60,000+ readers and the Friday send day are Glama's own claims. No issue archive was found.

Caution. data/s1102/packets.md already holds a different pitch to the same address (directory policy mistakes). Send only one of the two, and wait for a reply before the other.

Subject line.

> Pitch for the newsletter on what models get wrong

Draft, 99 words.

> Hi,
>
> I'd like to write a practical piece for the MCP newsletter on facts a model gets wrong, and the small server that fixes each one.
>
> The clearest case is the IRS mileage rate. It went from 72.5 to 76 cents on July 1, 2026, after most models were trained, so a model multiplies by the old rate. Live river gauges and 2026 SAT percentiles work the same way.
>
> I run 25 free hosted servers that need no key, and I'd use them only as worked examples. The explainers are at mcpstamp.com/can-claude/. Should I send an outline first?
>
> Michael

### 2. MCP.Directory

- Who. No maintainer named.
- Proof. https://mcp.directory/about, fetched 2026-11-03 (WebFetch, then raw HTML by curl 08:24Z). It says "Have a question, suggestion, or want to list your server? Reach out to us at [email protected]. You can also submit your server directly through the site."
- Route. email to hello@mcp.directory (Cloudflare-protected link; the data-cfemail value decodes to hello@mcp.directory and the page data also carries a plain mailto).
- Fit, high. MCP directory. It publishes this address for questions and listing requests, and 25 of our servers sit in its review queue.

Caution. It's a status question, not a pitch. The page states no review time.

Caution. Facts behind the draft. 25 repos accepted by POST /api/submit-server on 2026-10-30, 2026-11-02 and 2026-11-03 (logs in data/s1030, s1102/dirsub, s1103/dist/w2). 0 of 27 repo names resolve under /servers/ today, with controls /servers/github 200 before and after and a fake name 404.

Subject line.

> 25 submissions from theluckystrike, none listed yet

Draft, 85 words.

> Hi,
>
> I sent 25 free MCP servers through your submit endpoint between October 30 and November 3. None has a page under /servers/ yet. I checked today, and /servers/github loads while ours don't.
>
> Is something wrong with the entries, or is the queue just long? Each one is a hosted server with no key, built for facts models get wrong, such as the IRS mileage rate that changed on July 1, 2026. Examples are at mcpstamp.com/can-claude/.
>
> Tell me what's missing and I'll fix it.
>
> Michael

### 3. Skila AI (news, tools directory, weekly newsletter)

- Who. Unnamed editorial team.
- Proof. https://skila.ai/contact, fetched 2026-11-03 (WebFetch, then raw HTML by curl 08:24Z). It says "Have a tip for a breaking AI story, want to suggest a tool for review ... Our editorial team reviews all submissions. ... How do I get my AI tool listed on tools.skila.ai? Email us at skilavn@gmail.com with your tool name, website, and a brief description."
- Route. email to skilavn@gmail.com (published on the contact page, with mailto links for editorial inquiries).
- Fit, medium. Its newsletter page lists MCP server and agent skill roundups for developers, and the site has an MCP Servers section.

Caution. Activity is unconfirmed. The newest dated article on the news.skila.ai homepage is 2026-06-14. Open a recent issue before sending.

Caution. Its FAQ says it publishes no guest posts or press releases, so the draft is a tool suggestion.

Caution. It also sells featured slots. Do not buy one.

Subject line.

> Tool suggestion, free IRS mileage rate MCP server

Draft, 88 words.

> Hi Skila team,
>
> I'd like to suggest a free MCP server for your MCP roundups. It's the IRS Mileage Rate and Per Diem server. The IRS moved the 2026 business mileage rate from 72.5 to 76 cents on July 1, after most models were trained, so a model can multiply by the old rate.
>
> It needs no key and no signup. MIT license, source at github.com/theluckystrike/irs-mileage-rate-per-diem-mcp, and a plain explainer at mcpstamp.com/can-claude/calculate-mileage-deduction/.
>
> I'm the author. I have 24 more free servers if another suits your readers better.
>
> Michael

### 4. Console (weekly developer tools newsletter)

- Who. David Mytton, named on the about page as the writer.
- Proof. https://console.dev/about, fetched 2026-11-03 (WebFetch, then raw HTML by curl 08:24Z). It says "To suggest a tool or flag an error, email hello@console.dev"
- Route. email to hello@console.dev (mailto link on the page).
- Fit, adjacent. Active weekly (latest issue October 29, 2026, every Thursday). It reviews developer tools and offers its own feed over MCP.

Caution. The about page does not say it covers MCP servers, so expect a low hit rate. Send last, or skip.

Caution. It sells review placement. Do not buy one.

Subject line.

> Tool suggestion, 25 free MCP servers for live data

Draft, 88 words.

> Hi David,
>
> I'd like to suggest a tool for Console. It's a set of 25 free, MIT-licensed MCP servers that give an agent facts it can't get from training, with no API key. One reads live USGS river gauges. Another applies the IRS mileage rate that changed on July 1, 2026.
>
> Each runs as a hosted URL, and the source is under github.com/theluckystrike. Explainers are at mcpstamp.com/can-claude/.
>
> I know you review developer tools, so tell me if this is the wrong fit. A one-line no is fine.
>
> Michael

## Checked and not used

Newsletters with no route. PulseMCP and The Agentic Loop pause all submissions (page last updated September 3, 2026, https://www.pulsemcp.com/submit) and publish no tips address. MCP Bits (Dave Bettin), MCP Weekly Digest and MCPJam publish no tips or contact route on their about pages. MCP Manager's digest offers only a demo booking. Skillselion's MCP Server of the Week gives info@skillselion.com for corrections, citations, press and partnerships, not submissions.

Directories. mcp.so shows only an unlabeled footer email icon and a $39 paid tier. mcpservers.org and mcp-archive.com are forms with no contact. MyMCPShelf asks for 10 or more GitHub stars and publishes no address. OpenTools charges an annual subscription. ScriptByAI wants three months of operation and a reciprocal backlink. mcpserverfinder.com lists info@ with no invitation. Glama publishes support@glama.ai for questions, but there is nothing to ask, since 25 of 27 repos have Glama pages today.

Awesome lists. No contributing file asks for personal contact. punkpeye/awesome-mcp-servers (97,232 stars) takes pull requests only. punkpeye/awesome-remote-mcp-servers says ask in the PR or on Discord. wong2 sends submissions to mcpservers.org. tolkonepiu/best-of-mcp-servers takes an issue or pull request. appcypher, TensorBlock, jaw9c, Sagargupta16 and bhavyshekhaliya route through pull requests. The Remote MCP List repo is dormant (last push 2025-09-05, 152 open issues, remotemcplist.com does not resolve).

Podcasts and video. No show or channel I fetched publishes a pitch route for MCP tools. ThursdAI lists only host profiles. The Practical AI and AI Engineering Podcast pages returned 404 or moved. The Changelog takes episode requests through a form that needs a sign-in and is not MCP specific. I found no YouTube creator who invites MCP server submissions.

Developer newsletters. Web Tools Weekly takes tool tips by DM on X or Bluesky, but covers front-end tools and never mentions MCP, so a pitch would be off topic. TLDR, Cooper Press titles, Heavybit DevTools Digest and DevelopersDigest publish no submission route. Agent Commerce Weekly covers x402 payments and invites nothing. Changelog News has a submit form that needs an account and excludes commercial products.

## How to give the agents outreach access safely

1. Resend can mail people who asked for it, so the safe build is an opt-in signup on mcpstamp.com for an update list (new free servers, new can-claude pages) with the purpose written on the form and a confirmation email. An agent can build the form, the confirm page and the unsubscribe page.
2. Each signup needs a stored receipt (source, UTC time, purpose, confirmed mailbox) and a working per-person unsubscribe link, because scripts/outreach_send.mjs refuses any row without them and caps a batch at ten.
3. Resend's acceptable-use policy (read 2026-11-02) bans cold outreach, purchased lists and scraped contact data, and it expects complaints under 0.08 percent and bounces under 4 percent.
4. zovo.one is the verified sending domain and it also sends license and setup mail, so one cold batch that draws a few complaints would put paying customers' email at risk for a list of strangers who never asked.
5. So the agents get drafts and a signup page, not a send key for outreach, and the owner sends the packet emails by hand from their own mailbox, one at a time.
6. If the owner wants agent sending later, create a separate sending_access key limited to the verified domain, keep it in the secret store, and point it only at the opted-in file.

## Checks run

Every address above was read from the page's raw HTML by curl, not only from a fetch summary. The 25 of 27 Glama pages and 0 of 27 mcp.directory pages were counted with a positive control at the start and the end of the run and a negative control at the start, on each site. The facts in the drafts (72.5 to 76 cents on July 1, 2026, the river gauge and SAT pages, tools/list with no token) were each re-read today. My first count was wrong because zsh does not split an unquoted variable, the controls exposed it, and the rerun under bash is the one reported.

Humanize gate. Scanner control first. A sample with an em dash, a banned word, a bold label, a heading colon and an exclamation mark failed with exit 1, and a clean sample passed with exit 0. Then `python3 ~/Desktop/humanize/scan.py --strict` returned exit 0 on the drafts file (drafts.txt) and exit 0 on outreach.md. All four drafts are under 120 words (99, 85, 88 and 88).
