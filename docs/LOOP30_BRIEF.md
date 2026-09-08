# Loop 30 brief (2026-09-08)

Read this before anything. Loop 29's brief (docs/LOOP29_BRIEF.md) still applies; this adds
what changed and what is now known.

## The one fact that decides priorities

This project is audience-poor, not conversion-poor, by about two orders of magnitude.
Measured 2026-09-07: 22 unique GitHub visitors in 14 days, 0 stars, 0 Google impressions
ever across 99+ days, and 218 human page views on the storefront in a week. The official
MCP registry sent 9 of those 22 people and is the only channel that demonstrably delivers
humans. ClaudeBot fetched 311 of 312 URLs while Googlebot took 2, so assistant crawlers,
not Google, are the audience reaching these pages today. Full working in
docs/AUDIENCE_REALITY_R1.md and docs/SEO_INDEXATION_R1.md.

Do not propose building more servers. Intel round 14 concluded the marginal server has
stopped paying for itself and the same conclusion was reached independently from the
traffic data. Effort goes to being found, not to more supply.

## State as at the start of this loop

- Release v0.21.0 is live with 32 bundles. 85 active registry rows, all at 0.21.0, all
  pointing at /s/ product pages. 33 of 33 checkouts reach Stripe. 0 sales.
- Sitemap is a curated 126 URLs, all submitted to IndexNow (Bing, Yandex, Seznam, Naver).
- npm is PROVEN human-gated: npm 12.0.2 plus two real GitHub Actions OIDC runs returned
  ENEEDAUTH, because npmjs.com requires a package to exist before OIDC can be enabled on
  it. Every page that prints the npx command now says it returns 404.
- Hosted endpoints answer an unauthenticated GET with 200 and a description; POST and any
  request carrying a token still require auth.
- Glama indexes on its own with no account. 1 of 33 mirror repos is in:
  mcp-statement-of-account, with a live score badge.

## What changed overnight, and it matters

`punkpeye/awesome-mcp-servers` PR 13473 was CLOSED by the maintainer, with the reason:
"this PR adds multiple servers. Please submit one server per PR ... Feel free to open
separate PRs." That is a process instruction, not a rejection.

Two consequences. One server per pull request from now on, in that repo and by default in
any list whose maintainer has not said otherwise. And the CI Glama gate is a substring test
for a `glama.ai/mcp/servers/.../badges/score.svg` URL among the added lines, so the only
server that can pass that gate today is mcp-statement-of-account, the one genuinely indexed.

## Hard rules, in addition to loop 29's

1. No paid APIs, no paid listings, no featured slots. Record any as `skipped: paid`.
2. Never spam a maintainer. Where a list asks for one server per PR, open a small batch of
   the strongest candidates, not thirty-one. Quality of entry beats quantity.
3. Never paste a badge or a claim you have not verified returns 200.
4. Probe /buy/ with `-I` or `?src=probe` or the `x-mcp-probe: 1` header; a browser
   User-Agent is recorded as a real upgrade click and inflates the funnel metric.
5. Own only your assigned files. Do not run `npx wrangler deploy`; the orchestrator deploys.
6. Every number you write names the command or file it came from.
