# Operator actions, loop 34

Ranked by measured effect on the one number that matters: named by a blind assistant,
currently **0 of 18** (R2, 2026-09-12, unchanged from the R1 baseline). Everything that did
not need a human was done autonomously this loop. Each item below is gated on you, with the
exact step.

---

## 1. Glama "Add Server" GitHub OAuth — 33 missing server pages, the citation surface

**Why first.** The blind instrument's citations split github.com 21 / glama.ai 7, and 6 of the
7 Glama citations were `/mcp/servers/<owner>/<repo>` pages — NOT the `/mcp/connectors/` surface
where we hold 25 listings. Census this loop (docs/DISTRIBUTION_R3B.md): **1 of 34** mirror repos
has a /mcp/servers/ page (mcp-statement-of-account); the other 33 return not_found. R2 watched
our connector get fetched and passed over twice; the servers page is the row that gets cited.

**The gate.** Glama server-page ingestion runs through a maintainer GitHub OAuth "Add Server"
flow. Browser sign-in; no agent path (API is read-only).

**The step.** https://glama.ai/mcp/servers — sign in with GitHub, add the repos. Highest-value
order (blind-question fields): mcp-invoice-generator, mcp-pdf, mcp-time-tracker,
mcp-expense-tracker, mcp-spreadsheet, mcp-currency, mcp-quotes, mcp-bank-statement, then the
rest of the 34. 10 minutes for the top 8.

## 2. npm sign-in — unblocks 33 npx install paths (unchanged from loop 33)

`! npm login --auth-type=web` in this session's terminal, complete the browser sign-in, say so.
Then `scripts/publish-all.sh` runs unattended. Still proven human-gated (ENEEDAUTH; package must
exist before OIDC). Until this lands, every README leads with mcpb/source install and the Gemini
gallery rows use the hosted URL.

## 3. punkpeye/awesome-remote-mcp-servers waiver — one PR, highest-yield list open to us

Remote-only list, merges daily, our 30 hosted endpoints fit exactly. Needs two standing-rule
waivers: per-entry emoji marker, and starring the repo from theluckystrike. Both cosmetic, both
yours to waive or not. If waived: one PR, drafted and ready on request.

## 4. Search Console service account to Owner (unchanged; converts a human step autonomous)

Property sc-domain:zovo.one, Settings, Users: zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com
from Full to Owner. Unblocks Indexing API requests for the 115 discovered-not-indexed URLs.

## 5. Bing Webmaster sign-in (unchanged; the ChatGPT-facing index number)

https://www.bing.com/webmasters/ — verify mcp.zovo.one, then Settings, API access, API key.
IndexNow accepted 154 URLs on 2026-09-10; re-measure date 2026-09-24.

## 6. Telegram bot tokens — the cheap saturation test the platform research priced

platform-analysis-2026 scored Telegram bots #1 raw (71, inferred): 1bn+ users, native Stars
billing, zero review, Mini App supply ~55x thinner than MCP servers. Its own cheap test:
publish two bots with distinct names, no promotion, count 30-day organic. BotFather cap
unverified (20/account reported, undocumented). The step: open @BotFather, /newbot twice,
hand over the two tokens. Scaffold (grammy, webhook worker) builds in one loop once tokens
exist.

## 7. Atlassian Forge + Shopify credentials — the measured #1 revenue anchor

Atlassian Marketplace is the #1 MEASURED platform (median 10-user flat tier $70/mo; 69.5% of
6,137 cloud apps paid). Scaffolding is credential-gated, exact commands recorded in
~/Desktop/platform-analysis-2026/NEEDS_APPROVAL.md (FORGE_EMAIL + FORGE_API_TOKEN env vars;
Shopify needs a Partner organization id). One-time setup each.

## 8. toolhive-catalog compliance decision

stacklok/toolhive-catalog requires pinned dependencies and SHA-pinned GitHub Actions
(verbatim criteria). Ours: actions/checkout@v4 tags and caret ranges (^1.30.0). Pinning 37
servers' deps and all workflows is one autonomous loop of work — but it changes every repo's
CI, so the go/no-go is recorded here as yours. Yield: one catalogue row.

---
Loop 34 autonomous work is recorded in docs/LOOP34_RESULT.md. Nothing above was attempted by
an agent; nothing below requires you.
