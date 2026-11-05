# S1103 strategy, 2026-11-03

## Numbers this rests on (data/s1103/kpi.md unless noted)

| measure | value |
|---|---|
| MCP paid Stripe gross, all time | $0 (Stripe unreadable today, last read 10-30) |
| npm downloads 10-30..11-01, 68 packages | 17,205, about 40% on the 0.0.0-stage placeholder, mirror-shaped decay |
| npm packages above the mirror floor on 11-01 | 4 (timezone 54, license 55, invoice 24, quotes 21 vs median 7) |
| utm_source=mcp sessions, 30 GA4 properties, 28d | 7, all likely a launch scan |
| mcpstamp.com Google impressions per day | 6, 49, 72, 73 (10-30..11-02), 0 clicks |
| mcpstamp pages on Google page 1 | 1 (/can-claude/read-zip-files/, position 7-9) |
| Dead buy clicks from assistant answers (7d) | 24 of 25 were real product links broken by glued CJK punctuation (data/s1103/leak.md) |
| Free data satellites live | 25 (20 + 5 today), all in the official registry |

## Conclusions

1. The biggest win across all sprints is that assistants already recommend us. R8 measured 9 of 18 blind buyer
   questions naming an estate server. Today's worker logs show assistants answering in Japanese and Chinese writing
   our buy links into their answers. Those clicks died on a 404 because auto-linking swallowed the punctuation.
   That is the only buyer-intent stream ever measured, and it was 96% broken. PR #116 fixes it.
2. Revenue from selling MCP servers one by one is still zero, and no channel shows enough human traffic to change
   that this quarter. At $19 and a 2% conversion, $1,000 a month needs about 2,600 qualified visits a month. We
   measure under 10.
3. The one organic channel that is growing is question pages on mcpstamp.com. Impressions went from 6 to 73 a day
   in four days, and the only page-one page answers a "can Claude ..." question. So the content engine is
   "can Claude do X" pages answered honestly, with a live server for the part Claude cannot do alone.
4. Payment rails that can bill end users today are Stripe on mcp.zovo.one (works, $19 and $39 open Checkout) and
   Apify pay-per-event (5 Actors built, waiting on an account). Every other marketplace is unproven, free-only or
   shut down (Smithery, 10-31).
5. Building more servers has falling marginal value. Keep building only live-data or post-2025-rule satellites
   that feed a money site with proven Google traffic.

## Owner unlocks, ranked by return per minute

1. `stripe login` for the live account (5 min). It unblocks the waiting s1102m billing release, lets PR #116
   ship with it, and makes revenue measurable again.
2. npm login with 2FA (5 min), then publish the 5 new satellites. Better, create a granular automation token
   with publish rights for the @theluckystrike scope so agents can publish without a phone.
3. Apify account and API token (about 35 min including KYC). It is the only marketplace that bills end users and
   shows real MCP usage. Then `cd ~/mcp-servers/apify && ./publish-all.sh`.
4. Free BLS API key (2 min) for the CPI satellite's live refresh.
5. Outreach. Resend works, but it needs consented recipients. The right first batch is 10 to 15 personal emails
   from the owner's own address to MCP newsletter and directory editors, which agents can draft. Cold scraped
   lists would break Resend's policy and burn zovo.one, which sends license emails.
