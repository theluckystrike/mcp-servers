# DIST R35 — S57 (2026-09-20): mcpservers.org badge verification + honest probe

## Outcome: verified-green (with a material negative finding)

## What was done
1. **PROBE (cold data)**: enumerated all estate slugs against the mcpservers.org
   public listing pattern `/servers/github-com-theluckystrike-mcp-servers-tree-main-servers-{slug}`
   (pattern confirmed from our own earlier blind-recommendation capture data).
   Only the browser lane works (curl gets CF 403).
2. **Result: only 4 of 46 slugs resolve 200**: invoice, time-tracker, price-tracker,
   spreadsheet. The other 42 "accepted" submissions have NO public listing page (404).
3. **Badges**: added "Featured on Awesome MCP Servers" badge lines to the 4 servers
   with verified-live listings — 4 monorepo READMEs (commit 8f3dad5a) + 4 standalone
   mirror repos (mcp-invoice, mcp-time-tracker, mcp-price-tracker, mcp-spreadsheet),
   all verified live via raw.githubusercontent.com (grep mcpservers.org = 1 each).
4. distribution.json: surfaces["mcpservers.org"].badge_s57 recorded.

## Why not badge all 46
S56 established the rule: never link to unverified URLs. 42/46 listing pages 404 —
badging them would hand users dead links and damage trust. Honest scope = 4.

## Implication / next lever
- "Accepted" submission confirmations on mcpservers.org do NOT equal live listings.
  42 estate servers have zero public presence there despite acceptance.
- Options for S58+: (a) resubmit missing servers via the working form lane and
  verify listing pages go live this time; (b) treat mcpservers.org lane as
  saturated/unreliable and shift effort to lanes that demonstrably publish
  (percall pattern worked 10/10 — look for similar machine-verifiable directories).

## Verified KPIs
- mcpservers.org live listing pages: 4 (not 46)
- Badges added this sprint: 8 (4 monorepo + 4 standalone), all verified live
- Commits: 8f3dad5a (monorepo), 4 standalone pushes
