# S1105 strategy, 2026-11-05

## Numbers (each with its source)

| measure | value | source |
|---|---|---|
| MCP paid orders, all time | 0 | Stripe unreadable (CLI holds no keys), last read 10-30; data/s1105/reports/funnel-evidence/ |
| mcpstamp.com Google impressions per day | 6, 49, 72, 100, 122, 143 (10-30..11-04) | data/s1105/gsc_mcpstamp.json (gsc_q.py) |
| mcpstamp.com Google clicks, 10-01..11-05 | 2 of 492 impressions | same |
| Best page | /can-claude/read-zip-files/, 165 impressions, position 8, 1 click | same |
| GA4 mcpstamp, 14 d | 226 sessions, 1 from Google, 6 begin_checkout from one user, 0 purchases | funnel-evidence |
| Buy links on mcpstamp.com that work | 454 of 454 product links | funnel-evidence (sitemap crawl) |
| Humans on /buy/ 11-03..11-05 | 5 plausible, from npm and the registry, none from mcpstamp | funnel-evidence |
| Official MCP registry entries | 274 names before today, 277 after | distribution.md, satellites-ship.md |
| Free live-data satellites | 30 (27 + 3 today) | satellites-ship.md |
| Answer pages on mcpstamp.com | 34 before, about 70 after this deploy | live sitemap, s1105 build |

## Conclusions

1. The single biggest win across all sprints is the answer-page format: one honest page per question a person
   types ("can Claude open zip files"), with a real call to a live server as proof. It is the only page type that
   reached page one, and impressions grew 24x in six days without links or ads. Today doubles that inventory.
2. The second win is that the registry plus free satellites put us in front of assistants and directories at zero
   cost (277 registry names, 34+ Glama listings, the biggest awesome list). That is distribution, not revenue yet.
3. Revenue is still $0 because the paid path has never been exercised by a real card, and Stripe cannot be read.
   At 2 clicks a month, no conversion fix matters until clicks reach the hundreds. Traffic first, then price tests.
4. Truth matters more than volume. Two gates found 29 false claims in 37 drafts (mainly "Claude cannot", when code
   execution is on by default). A page that lies about Claude loses trust and rankings. Every wave keeps a gate.

## Plan, only the highest return per hour

1. Answer engine (agents, daily): 20 to 40 gated answer pages per wave from real autocomplete questions, each with a
   live call. Measure in GSC 7 and 14 days after. Stop a topic family if it gets no impressions in 14 days.
2. Free satellites that feed the answer engine (agents): 3 per wave, only where a question has demand and fewer than 3
   competing servers. Ship as Worker + public repo + registry (no npm needed).
3. CTR work on pages already at positions 5 to 15 (agents): titles that answer the query directly.
4. Owner unlocks below, in order. Each removes a hard block on money.

## Owner unlocks, ranked by return per minute

1. `stripe login` (5 min), then one real $19 test buy on any product (5 min, refund after). Unblocks the billing
   deploy (PR #116 and #119 are merged but not live) and makes revenue measurable.
2. `npm login` (5 min), or a granular automation token for the @theluckystrike scope. 3 satellites wait to publish.
3. mcpservers.org/submit and mcp.so/submit (10 to 15 min, needs your browser sign-in). We are absent from both.
4. Outreach with Resend: Resend is connected and zovo.one sends. What it lacks is consented recipients. A double
   opt-in list already runs on mcpstamp.com (0 subscribers). The fastest legal route is 10 to 15 personal emails from
   your own address to MCP newsletter editors and directory owners; agents draft them, you send them. Cold scraped
   lists would break Resend's policy and put zovo.one license email at risk.
