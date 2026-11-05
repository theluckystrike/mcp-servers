# S1102 money lane: where MCP can bill end users, plus outreach options

Fetched 2026-11-02 (UTC). Research only: no accounts, no sign-ups, no email, no production change. WebFetch pages carry no publication dates, so each fact is dated by fetch date. Vendor claims are labeled as claims. Machine-readable twin: `money.json`. Raw API pulls: `money/apify_mcp.json`, `money/apify_search_mcp.json`.

## Bottom line

1. Only Apify both bills end users and shows public usage numbers. Its `ts-mcp-proxy` template wraps our npm packages unchanged. But the real MCP market there is small: median MCP-named Actor had 1 successful run in 30 days.
2. Every other marketplace is either unproven on traffic (MCPize), free-only (AgenticMarket), docs-silent (MCPBundles), shut down (Smithery hosting, 2026-10-31), or has no buyers (x402, Stripe MPP).
3. Official directories (Claude, ChatGPT, Google) give distribution and recognition, not billing. Both Anthropic and OpenAI policies restrict ads/promo, which constrains the "every tool result links to a money site" pattern.
4. Resend cannot be used for cold outreach. Legitimate outreach is owner-sent one-to-one pitches and owner-posted community posts.
5. All cold EV estimates are below $1 per owner minute and under about $15/month mid-case. Treat MCP as recognition and referral, as S1030 already concluded.

## 1. Marketplaces

### Apify Store
- Share: Apify keeps 20%; payout = revenue - commission - platform usage; negative months count $0. In Standby (how MCP runs) the user pays usage on top of event price. https://docs.apify.com/platform/actors/publishing/monetize (2026-11-02)
- Payout: invoice on the 11th, paid days 21-25. Minimum $20 PayPal/Wise, $100 other (SWIFT fees $10-50). KYC identity check required. https://docs.apify.com/platform/actors/publishing/monetize/monthly-payouts (2026-11-02)
- Publish an MCP server: `apify create my-actor -t ts-mcp-proxy`, set `MCP_COMMAND` (default `npx @modelcontextprotocol/server-everything`) to our package, e.g. `['npx','-y','@theluckystrike/mcp-<id>']`, enable Standby, set pay-per-event, charge `tool-request` in code. Buyers must send an Apify token as Bearer, so buyers need an Apify account. https://apify.com/templates/ts-mcp-proxy and https://apify.com/mcp/developers
- `apify push` and `apify login` need an API token (token is created in the Apify Console; docs pages fetched did not state it for `push` explicitly, standard CLI behavior).
- Owner steps (about 35 min): sign up https://console.apify.com/sign-up (5), copy API token from Settings > Integrations (2), Insights > Payouts > Verify identity with exact legal name (10-15), payout details PayPal or Wise (5).
- Traffic evidence (public API, no auth, 2026-11-02):
  - `curl 'https://api.apify.com/v2/store?limit=1'` total 105,348 Actors (control: the MCP developers page shows 106,519).
  - `curl 'https://api.apify.com/v2/store?category=MCP_SERVERS&limit=1'` total 3,183 (mostly scrapers tagged MCP).
  - 919 unique Actors pulled; 200 have "mcp" in the name; their SUCCEEDED runs in the last 30 days sum to 27,442; median 1.
  - Top by 30-day successful runs: mrbridge/espn-mcp-server 8,047; kazkn/vinted-mcp-server 2,627; makework36/airbnb-mcp-server 2,221; nexgendata/travel-mcp-server 1,790; smacient/google-keyword-planner-mcp 1,690 (741 total users, the largest). Event prices $0.005 to $0.05.
  - Vendor claims (undated, inconsistent): 36K+ monthly developers, 130k+ signups, $500k+ monthly payouts vs $1.7M last month.
  - Caveat: the category query returned 880 items for limit=1000, so counts are lower bounds.
- Fit: high. No server code change; wrapper only.

### MCPize
- Share: 80% to developer, computed after Stripe fees; 85% only for servers monetized before 2026-06-10 (closed). Sources disagree (80 vs 85). https://mcpize.com/developers/monetize-mcp-servers, https://mcpize.com/faq
- Payout: Stripe Connect to bank (FAQ also says PayPal), monthly on the 1st; minimum $100 on the developers page, FAQ silent, one blog says $25. Unresolved.
- Owner steps (about 35 min): sign up (inferred https://mcpize.com/auth), Dashboard > Settings > Payouts connect Stripe (5-10), GitHub import or `mcpize deploy`, set price and visibility public.
- Traffic: only vendor claims (350+ monetized servers, 450+ developers, "$10K+ top earner" self-reported). No visitor, install or subscriber figure visible. Honest status: unproven.
- Fit: medium-high; FAQ says TypeScript auto-detected, optional `mcpize.yaml`; Dockerfile requirement not stated.

### AgenticMarket (agenticmarket.dev)
51 servers listed, "All servers free - no credits needed", "Zero platform fees", no revenue share described. Fails the bills-end-users test. https://agenticmarket.dev, https://agenticmarket.dev/pricing (2026-11-02)

### MCPBundles
Free directory publishing (public HTTPS URL, ownership check via work email on the domain or contact in `/.well-known/mcpbundles.json`). No pricing or revenue share in docs. https://www.mcpbundles.com/docs/how-to/publishing-mcp-servers

### Smithery
Smithery is now part of Arcade. smithery.ai/future: "MCP Proxy and managed identity shut down on October 31"; run.tools / server.smithery.ai URLs, API, Connect, Toolbox, accounts, API keys, CLI and SDKs end; registry stays as a public non-proxied directory. No publisher monetization. Do not invest. https://smithery.ai/future (2026-11-02)

### RapidAPI
No RapidAPI-specific MCP product found by search. No claim made.

### Cloudflare x402 and Stripe MPP
- Cloudflare `paidTool` / `x402-hono`: charge per tool call; default facilitator is Coinbase's; no fee or marketplace stated; page updated Oct 22, 2026. https://developers.cloudflare.com/agents/x402/
- Stripe MPP: HTTP 402 challenge; card via Shared Payment Tokens (min $0.50) or stablecoin (min 0.01 USDC) settled into the Stripe balance; API version `2026-07-29.preview`. Owner already has live Stripe, so no new account, but it needs a Stripe profile and deposit address and code changes in each Worker. https://docs.stripe.com/payments/machine/mpp
- Demand: docs/AGENT_PAYMENTS_R1.md (2026-09-10) found no mainstream MCP client that settles 402 without a user-installed wallet bridge.

### x402 Bazaar
- Listing free; seller sets price; Base and Solana USDC; "early development"; a tool is only cataloged after a paying client echoes the discovery data. https://docs.x402.org/extensions/bazaar, https://docs.cdp.coinbase.com/x402/bazaar
- Market scale (third party, mid-Aug 2026): 75.41M tx, $24.24M, 94,060 buyers, 22,000 sellers in 30 days; Artemis: average 63.94% of tx 2025-11-09..2026-02-07 were gamed; top 1% of buyers drive about 90% of adjusted volume. https://cryptobriefing.com/solana-x402-market-share-dominance/, https://research.4pillars.io/en/research/x402-on-polygon-real-or-gamed
- Needs a self-custody USDC wallet (custody and tax decision for the owner).

## 2. Official directories

### Claude Connectors Directory
- Submit: https://claude.ai/directory/manage > Submit new > MCP connector. Any paid Claude plan; Owner on Team/Enterprise.
- Need: remote HTTPS URL; OAuth 2.0 for account tools, no auth allowed for public data; each tool has `title` and `readOnlyHint` or `destructiveHint`; docs URL, privacy URL, support contact, icon, reviewer test account; 7 acknowledgments.
- Timeline: portal always open; automated scan lists it as a Community connector by default; some get a human review, no SLA; escalate mcp-review@anthropic.com. https://claude.com/docs/connectors/building/submission
- Policy 4C excludes software that "serves advertisements, sponsored content, paid product placements" or exists "primarily as an advertising or promotional vehicle". Our UTM-link pattern must stay a plain relevant source link. https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy
- Fit: the no-auth satellite Workers fit directly. mcp.zovo.one needs a token, so it does not.

### OpenAI ChatGPT Apps directory
- Verified individual or organization; owner submits; public domain server; website, support, privacy and terms URLs; test account without MFA; exactly 5 positive and 3 negative test cases; video walkthrough; icon at least 48px; one review at a time; EU data residency projects cannot submit. https://developers.openai.com/apps-sdk/deploy/submission
- Commerce: physical goods only; no digital goods or subscriptions, no ads, no direct checkout links. So $19/$39 licenses cannot be sold here. https://developers.openai.com/apps-sdk/app-submission-guidelines
- Timeline: no official figure. Third party (Dec 2025, unverified): 5-10 business days.

### Google Connected Apps
Applied 2026-11-01 (owner). Third-party coverage: preview since late Oct 2026, staged rollout, 50+ apps, apply and test in Connected Console. No official criteria found. https://www.androidheadlines.com/2026/10/google-gemini-connected-apps-platform-preview.html

## 3. Outreach

| Channel | Status 2026-11-02 | Route |
|---|---|---|
| Glama newsletter | Open. 60k+ developers, Fridays (vendor claim) | Owner emails frank@glama.ai a written piece; product mention allowed if useful. https://glama.ai/newsletter |
| Glama directory | 114,061 servers, 9,637 claimed | Add Server / claim. https://glama.ai/mcp/servers |
| PulseMCP + "The Agentic Loop" | Closed: submissions paused, no date | Official MCP Registry listing is its stated route. https://www.pulsemcp.com/submit |
| mcp.so | Open, review before live | https://mcp.so/submit; "Advertise" link not used |
| mcpservers.org | Free (review within 2 weeks) | https://mcpservers.org/submit; $39 premium not used per brief |
| Show HN | Owner only | Must be tryable, no landing pages, no quick one-offs, no vote asking, author in thread. https://news.ycombinator.com/showhn.html |
| Reddit r/mcp, r/ClaudeAI | Rules unread (reddit blocked fetch and curl) | Owner reads sidebar first |
| Product Hunt | Official rules not fetched; third-party guides: no vote soliciting, real person accounts | Owner account |

Resend (https://resend.com/legal/acceptable-use, 2026-11-02): can send transactional mail and mail to explicitly opted-in recipients with business name, address, stated reason, and opt-out honored within 7 days; complaints under 0.08%, bounces under 4%. Cannot send "cold outreach, purchased lists, or scraped contact data." State per docs/OUTREACH_RESEND_SETUP.md: key present, zovo.one verified, 0 eligible contacts, 0 sent.

Owner can give: (a) their own accounts and the act of posting (HN, Reddit, PH), (b) one-to-one editor emails from a normal mailbox, not Resend, (c) a disclosed-purpose signup form as the only way to build a Resend-mailable list, (d) paid Claude account for connector submission, OpenAI org verification, Apify account and token.

## Cold EV, top 5 ranked by dollars per owner minute

Monthly USD, average of first 90 days, after platform share. V (value of one referred visit to a monetized site) = $0.02 / $0.05 / $0.15. No license sales assumed ($0 measured). Owner minutes are one-time setup by the owner; packaging and drafts are done by us.

| Rank | Option | Owner min | Low | Mid | High | $/min (mid) | Basis |
|---|---|---|---|---|---|---|---|
| 1 | Apify: 10 Actors, PPE | 35 | 0 | 10 | 120 | 0.29 | $0.03/event, 20% cut; mid 3 Actors x 100 runs; high one Actor at top-decile 2,000 runs |
| 2 | MCPize: 3-5 subscriptions | 35 | 0 | 7 | 60 | 0.20 | mid 1 subscriber x $9 x 0.8; no traffic data |
| 3 | Show HN, one satellite | 90 | 0 | 15 | 120 | 0.17 | 10% chance 8,000 visits, 90% chance 150; one-off over 3 months |
| 4 | Claude directory, 3 no-auth satellites | 70 | 0 | 6 | 40 | 0.09 | 120 visits x $0.05; reach and recognition not priced |
| 5 | Glama newsletter piece | 30 | 0 | 2 | 30 | 0.07 | 25% acceptance, 180-600 visits one-off |

Not in top 5: ChatGPT apps directory (70 min, about $3), Stripe MPP (20 min, about $1, needs code), x402 Bazaar (45 min, about $2, wallet custody).

Caveat: figures are guesses with a $0 floor. Only Apify has verified usage data. Ranking is sensitive to V and the acceptance probability.

## Single best owner unlock

Create an Apify account, finish payout identity verification, and give an API token (https://console.apify.com/sign-up, about 35 minutes). That is the only route to real end-user billing with visible usage; we then wrap up to 10 existing npm packages with `ts-mcp-proxy` and report real run counts within a week.

## Open items
- r/mcp, r/ClaudeAI rules unread; Product Hunt official rules not fetched; RapidAPI MCP not found.
- MCPize minimum payout ($100 vs $25) and traffic unresolved.
- Apify category query returned 880 items for limit 1000; MCP-named counts are lower bounds.
- No SLA for Claude or OpenAI review.
