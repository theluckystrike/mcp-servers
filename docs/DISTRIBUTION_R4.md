# DISTRIBUTION R4 (loop 35): 49-surface census, one new submission, Glama placeholder-badge trap (2026-09-12)

Round 4 re-probes all 49 surfaces in `data/distribution.json` instead of trusting the record,
reads back loop 34's five open PRs plus Sagargupta16#88, and submits to the one surface that
moved from blocked to autonomously-submittable. Machine-readable rows are in
`data/distribution_r4.json`. Working copies live in `.scratch-distribution/` (gitignored); no
project remote was touched.

**1 PR opened and verified OPEN (toolsdk-ai/toolsdk-mcp-registry#514, validator green). 0 PRs
merged this round. Live surfaces 12 before and 12 after; the Gemini CLI gallery moved from
published-unverified to verified-indexed (34 of our repos listed). 0 accounts created, 0
logins, 0 paid surfaces, 0 stars given.**

## Loop-34 PR readback

Command per row: `gh pr view <n> -R <repo> --json state,mergedAt,closedAt,reviews,comments`.

| PR | State | mergedAt | Reviews | Comments |
|---|---|---|---|---|
| Chat2AnyLLM/awesome-mcp-servers#22 | OPEN | null | 0 | 0 |
| zencoderai/zenagents-library#31 | OPEN | null | 0 | 0 |
| jaw9c/awesome-remote-mcp-servers#769 | OPEN | null | 0 | 0 |
| Appnova-EU-OU/awesome-remote-mcp-servers#614 | OPEN | null | 0 | 0 |
| composio-community/awesome-claude-plugins#465 | OPEN | null | 0 | 0 |
| Sagargupta16/awesome-mcp-servers#88 | MERGED | 2026-09-10T14:29:08Z | - | - |

All ten other tracked PRs (punkpeye#13963-13966, mgoldsborough#11, YuzeHao2023#473, MobinX#420,
mctrinh#112, JustInCache#44, collabnix#112, habitoai#144, abordage#106, Kilo-Org#269,
BlockRunAI#69, wundercorp#60) are still OPEN with zero maintainer engagement, and all 30
cline/mcp-marketplace submission issues remain OPEN with zero engagement
(`gh issue list -R cline/mcp-marketplace --author theluckystrike --state open --json number`
-> 30). Nothing was bumped; prior rounds recorded that maintainer nudges get no reply.

## The one new submission: toolsdk-ai-mcp-registry

`data/distribution.json` had this 187-star registry as `blocked` on two grounds, one of which
was stale. Its CONTRIBUTING (read fresh from `docs/CONTRIBUTING.md` on main) accepts **"an
official, public HTTPS Streamable HTTP endpoint"** for remote entries, and the record's claim
that our endpoints answer 401 to an unauthenticated prober is only true of `tools/call`:
`initialize` answers HTTP 200 by design (re-verified: `curl -X POST
https://mcp.zovo.one/mcp/invoice ... -d initialize` -> 200, `serverInfo {name mcp-invoice,
version 0.21.0}`, tools capability). The merged APITube entry (PR #466, 2026-08-26) is the
identical auth shape: a Bearer-keyed remote listed with no `auth` block and the limitation
stated in the description, which the guide explicitly permits.

Submitted: **https://github.com/toolsdk-ai/toolsdk-mcp-registry/pull/514** — one file,
`packages/finance-fintech/zovo-invoice.json`, remote entry `@toolsdk-remote/zovo-invoice`
pointing at `https://mcp.zovo.one/mcp/invoice`, description stating the free anonymous token
from `https://mcp.zovo.one/mcp/connect`. One server, one PR: the observed merge pattern is ten
single-server outside PRs merged 2026-08-26/27 (`gh pr list -R toolsdk-ai/toolsdk-mcp-registry
--state merged`), open queue 34. Validation run and quoted in the PR:
`node scripts/validate-registry.mjs --base upstream/main` -> "Registry validation checked 1
file(s): 0 error(s), 0 warning(s)." Readback: `gh pr view 514 -R toolsdk-ai/toolsdk-mcp-registry
--json state,changedFiles,additions,deletions,author` -> OPEN, 1 file, +19/-0, author
theluckystrike. If this merges cleanly, the sibling servers are the obvious follow-up; that is
a decision for a future loop, not five same-day PRs into a queue of 34.

## Key findings

1. **Glama badge endpoint changed — a 200 is now actively misleading there.**
   `https://glama.ai/mcp/servers/theluckystrike/<repo>/badges/score.svg` returned 404 for
   unlisted repos in every prior round; today it returns HTTP 200 with a 2,880-byte placeholder
   SVG whose `<title>` reads "This MCP server is not listed on Glama" (verified for
   mcp-spreadsheet, mcp-pdf, mcp-barcode, mcp-invoice-generator, mcp-time-tracker, two passes
   each). The control (mcp-statement-of-account) returns a 4,228-byte SVG titled "rated A on
   Glama", and the five server pages are still 404. The standing watch instruction ("poll the
   badge URL; a 200 turns into a green PR in one line") is now wrong — the check must read the
   SVG `<title>`. No badge was pushed to any punkpeye PR. Glama census unchanged: 1 of 34
   mirrors have server pages.
2. **Gemini CLI gallery is confirmed live.** `curl -sL https://geminicli.com/extensions/`
   (12,962,351 bytes) carries 34 distinct `theluckystrike/mcp-*` repos
   (`/usr/bin/grep -oE 'theluckystrike/[a-z0-9_-]+' | sort -u | wc -l` -> 34), including the
   four loop-34 builds; office-suite and delivery-schedule correctly absent. Zero submission
   step, crawled within about two days of shipping. This is the only catalog that has ingested
   the fleet wholesale.
3. **mcp.pizza is revived** (was "temporarily paused"): a live directory at
   https://www.mcp.pizza/, but no submission route exists — no submit/add/contribute href in
   348,800 bytes of HTML; the "Open a Pull Request" text is per-entry boilerplate. Not
   submittable.
4. **mcp-get.com is still an archived snapshot** — the notice survives verbatim in the new
   SPA bundle (`assets/index-CxW3pm6b.js`). Dead stays dead.
5. Unchanged negatives, re-probed: pulsemcp now 403 to curl (intake still paused);
   mcpservers.org listing readback still Cloudflare-403; mcpmarket.com still 429;
   cursor.directory/plugins/new still 429; mcpindex.net and portal.mcpcentral.io still
   connection-fail; appcypher still `isArchived=true`; mcpserverfinder.com/submit still 404
   (mailto only); MCPStar/awesome-dxt-mcp community section still a placeholder.
6. **The autonomous route is exhausted.** After this round there is no tracked surface that is
   free, accountless and has a working submission route that we have not used. The remaining
   upside is: operator logins (npm, Glama, Smithery, cursor.directory, mcp.directory,
   allmcps.com, findmcp.dev — exact URLs below), the three emoji-format lists (waiver
   decision), punkpeye/awesome-remote-mcp-servers (operator waivers, off-limits to agents),
   and maintainer merges of the 17 open PRs, which no action of ours has ever caused.

## The 49-row census

States: live / pr-open / human-gated / submitted-unverifiable / blocked / skipped / dead /
no-route / waiver-needed. Every row was re-probed or re-read this round; rows marked "ours"
are first-party pages verified via the probes in `data/distribution_r4.json`.

| # | Surface | State | Evidence (command in JSON) |
|---|---|---|---|
| 1 | github | live | repo public |
| 2 | billing | live | mcp.zovo.one serving, Stripe live |
| 3 | npm | human-gated | https://www.npmjs.com/login (pack 0-NPM) |
| 4 | registry | live | exact GET .../invoice-pdf-billing-generator/versions/latest -> 200 |
| 5 | smithery | human-gated | `npx -y @smithery/cli auth login` |
| 6 | glama | partially live (1 of 34) + human-gated | badge-placeholder trap documented above |
| 7 | mcpb | live | 38 assets on v0.21.0 |
| 8 | awesome-mcp-servers (punkpeye) | pr-open x4 | #13963-13966 OPEN; badges NOT addable (placeholder SVGs) |
| 9 | mcp.so | skipped: paid; free route sign-in | free queue unattended |
| 10 | docker-mcp-catalog | blocked: engineering | dependency-cycle defect; not a distribution action |
| 11 | cline-marketplace | pr-open | 30 issues, zero engagement |
| 12 | guides | live | ours |
| 13 | mcpservers.org | submitted-unverifiable | /submit 200, readback 403 |
| 14 | mcpmarket.com | submitted-unverifiable | 429 |
| 15 | cursor.directory | human-gated | https://cursor.directory/plugins/new (429) |
| 16 | pulsemcp | blocked | intake paused; 403 today |
| 17 | wong2-awesome-mcp-servers | no-route | issues/PRs disabled |
| 18 | appcypher-awesome-mcp-servers | dead: archived | isArchived=true |
| 19 | mcp-get.com | dead: archived | archive notice in SPA bundle |
| 20 | mcpserverfinder.com | human-gated | mailto:info@mcpserverfinder.com; /submit 404 |
| 21 | mcpindex.net | dead | curl 000 |
| 22 | mcp.pizza | alive, no route | revived; no submit href |
| 23 | mcpcentral.io | dead | curl 000 (DNS) |
| 24 | hosted | live | initialize POST /mcp/time-tracker -> 200 |
| 25 | search-console | submitted | ours |
| 26 | github-mirrors | live | 34 public mirrors |
| 27 | setup | live | ours |
| 28 | estate-backlinks | live | 4-of-12 spot-check all carry the anchor |
| 29 | awesome-mcpb | pr-open | #11, maintainer workflow gate |
| 30 | lobehub-mcp-marketplace | not applicable | agent prompts, not MCP |
| 31 | tensorblock-awesome-mcp-servers | live | #2164 merged 2026-09-05 |
| 32 | yuzehao2023-awesome-mcp-servers | pr-open | #473 OPEN |
| 33 | mcpstar-awesome-dxt-mcp | skipped: empty list | placeholder section |
| 34 | mobinx-awesome-mcp-list | pr-open | #420 OPEN |
| 35 | aianytime-awesome-mcp-server | live | #83 merged 2026-09-05 |
| 36 | mctrinh-awesome-mcp-servers | pr-open | #112 OPEN |
| 37 | yzfly-awesome-mcp-zh | waiver-needed: per-entry emoji | format requires it |
| 38 | alexmili-awesome-mcp | waiver-needed: per-entry emoji | format requires it |
| 39 | awesome-mcp-collection-justincache | pr-open | #44 OPEN |
| 40 | collabnix-awesome-mcp-lists | pr-open | #112 OPEN |
| 41 | habitoai-awesome-mcp-servers | pr-open | #144 OPEN |
| 42 | abordage-awesome-mcp | pr-open | #106 OPEN, CI green |
| 43 | mcp.directory | human-gated | https://mcp.directory/submit (200; operator clicks Submit) |
| 44 | tolkonepiu-best-of-mcp-servers | waiver-needed: per-entry emoji | generator-stamped |
| 45 | businessmcp.com | skipped: paid | tiered fee |
| 46 | toolsdk-ai-mcp-registry | pr-open (NEW) | #514 OPEN, validator green |
| 47 | allmcps.com | human-gated | https://allmcps.com/submit |
| 48 | modelcontextprotocol-servers | closed: retired | routes to the registry we are on |
| 49 | gemini-cli-gallery | live, verified indexed | 34 repos on geminicli.com/extensions/ |

Live count (KPI basis, status published|live): rows 1, 2, 4, 7, 12, 24, 26, 27, 28, 31, 35,
49 = **12 of 49**, before and after. The honest movement this round is one new open PR, one
surface promoted to verified-indexed, and three traps closed off for future loops.

## Human-gated surfaces for the operator pack (exact URLs)

| Surface | URL | Gate |
|---|---|---|
| npm | https://www.npmjs.com/login | `npm login --auth-type=web`, then `scripts/publish-all.sh --go` (pack 0-NPM) |
| Glama | https://glama.ai/mcp/servers | GitHub OAuth, Add Server per mirror; claim mcp-statement-of-account |
| Smithery | https://smithery.ai/auth/cli | `npx -y @smithery/cli auth login`, approve session URL |
| cursor.directory | https://cursor.directory/plugins/new | GitHub/Google sign-in (429 on probe today) |
| mcp.directory | https://mcp.directory/submit | No account; operator clicks Submit (standing rule) |
| allmcps.com | https://allmcps.com/submit | Contact email + ownership claim; untick newsletter |
| findmcp.dev | https://findmcp.dev/submit | No account, free; operator clicks Submit |
| mcpserverfinder.com | mailto:info@mcpserverfinder.com | Email-only intake; no agent mail channel |
| mcp.so (free route) | https://mcp.so/submit | GitHub sign-in; $39 form stays skipped: paid |
| punkpeye/awesome-remote-mcp-servers | (off-limits to agents) | Needs operator waivers: required star, emoji format, connector badge |

## What this round does not claim

toolsdk#514 is OPEN, not merged; the toolsdk maintainers merge by hand. The 16 other open PRs
and 30 open issues have never drawn maintainer engagement and this round did not change that.
The Gemini gallery listing is real but its install yield is unmeasured. The live count did not
move; distribution's binding constraint is now operator logins and maintainer queues, both
outside agent authority.
