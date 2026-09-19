# T14 - Organic Distribution Intel Sweep (S46)

STATUS: complete

## Task 1: Guide Redirects Style Check

Clean sweep: probed 8 guide URLs pulled from https://mcp.zovo.one/sitemap.xml (109 guide <loc> entries). All returned HTTP 200 and carry a self-referencing `link rel="canonical"`. Evidence (curl, UA spoofed to a normal browser because the Cloudflare Worker 403s bare `urllib`/no-UA requests):

```
200 | /guides/answer-questions-about-a-spreadsheet-without-formulas | <link rel="canonical" href="https://mcp.zovo.one/guides/answer-questions-about-a-spreadsheet-without-formulas">
200 | /guides/connect-mcp-servers-without-installing | <link rel="canonical" href=".../connect-mcp-servers-without-installing">
200 | /guides/hosted-mcp-server-discovery-without-a-token | <link rel="canonical" href=".../hosted-mcp-server-discovery-without-a-token">
200 | /guides/mcp-client-config-file-locations | <link rel="canonical" href=".../mcp-client-config-file-locations">
200 | /guides/mcp-servers-that-work-offline | <link rel="canonical" href=".../mcp-servers-that-work-offline">
200 | /guides/petty-cash-book-and-cash-ledger-mcp-servers | <link rel="canonical" href=".../petty-cash-book-and-cash-ledger-mcp-servers">
200 | /guides/search-console-url-inspection-coverage-is-unstable | <link rel="canonical" href=".../search-console-url-inspection-coverage-is-unstable">
200 | /guides/what-ai-crawlers-fetch-that-googlebot-does-not | <link rel="canonical" href=".../what-ai-crawlers-fetch-that-googlebot-does-not">
```

VERDICT (Task 1): All 8 sampled guide URLs return 200 with a correct self canonical; no redirect anomalies or missing canonicals found. The guides section is clean for crawling/indexing. No action needed this round.

## Task 2: External Directories Not in distribution.json

Scope note: three of the named probes (mcp.directory, mcpmarket.com, mcpservers.org) are ALREADY tracked in data/distribution.json (human-gated / submitted, respectively). The genuinely-untracked probes are mcpservers.com, aiagentslist.com, opentools.ai, mcphub.io, mcpdirectory.com, craft.directory, mcpmarket.ai. Findings per directory (all via curl, UA spoofed):

```
mcpservers.com      HTTP 200 | title "MCP Servers - Model Context Protocol | The #1 MCP Server List"
                    /submit -> 200 (Sign in present), /add -> 404, /suggest -> 404
                    theluckystrike/zovo on /servers: 0 | positive control: 2 (github/modelcontextprotocol found)
                    DIFFERENT SITE from mcpservers.org (which is already submitted).
mcpmarket.ai        DNS NXDOMAIN: "curl: (6) Could not resolve host mcpmarket.ai". NOT LIVE.
                    Real project lives at mcpmarket.com (already tracked, submitted).
mcphub.io           DNS resolves (Cloudflare 172.67.218.211), but HTTPS -> HTTP 402 (bot/payment wall), HTTP -> 308 redirect.
                    Real but behind a challenge wall; no unauthenticated submission read.
mcpdirectory.com    http(s)://www.mcpdirectory.com -> 200, 114-byte stub: window.location.href="/lander"
                    /lander -> HTTP 403. DEAD/stub site, no directory content.
craft.directory     HTTP 200, but NOT an MCP tool directory. It is "CRAFT" (github.com/rekallai/craft),
                    a folder-structure standard for agentic projects. Submission route is GitHub issues only.
                    NOT a distribution target. N/A.
opentools.ai        Homepage 200 ("Browse 2,500+ AI Tools, Models & MCP Servers"); /mcp -> 200.
                    theluckystrike/zovo on /mcp: 0. /library -> 404 (path is /mcp). submit/add/login paths all
                    404/500. Mentions "Pro" extensively and "Submit"; paid-Pro tiered model, no free-account find.
aiagentslist.com    /submit -> 200 but login-gated (all CTA -> /login). FAQ: "ability check is free. Accepted
                    submission is a one-time $29 and the Launch is a one-time $49." theluckystrike/zovo on
                    /mcp-servers: 0 | positive control STRONG: real github.com server rows render (0xshariq/docker-mcp-server, etc).
```

VERDICT (Task 2): Three of the seven named probes are dead, parked, or not-a-directory (mcpmarket.ai = NXDOMAIN, mcpdirectory.com = parked stub, craft.directory = repo-folder spec). Two are real MCP directories not yet listed: mcpservers.com (free-ish, Sign-in present, distinct from .org) and aiagentslist.com (freemium, login + paid tiers). opentools.ai and mcphub.io are real but submission is Pro-gated / walled, so they fall under existing rules (no account / no paid) and are not intuitive adds. Next actionable: add mcpservers.com as a candidate (mirror of .org, likely same model) before aiagentslist.com since the latter is login+paid.

## Task 3: Glama.ai Weekly Recheck

Glama still serves the parent server but has NOT picked up email (statement-of-account / invoice = gmail) renamed versions. curl evidence:

```
GET https://glama.ai/mcp/servers/theluckystrike/mcp-checklist        -> HTTP 200
GET https://glama.ai/mcp/servers/theluckystrike/statement-of-account -> HTTP 404
GET https://glama.ai/mcp/servers/theluckystrike/invoice              -> HTTP 404
```

VERDICT (Task 3): Unchanged from prior rounds: the mcp-checklist server page is up (200), but both renamed email servers (statement-of-account, invoice) still 404 on Glama, meaning Glama has not re-fetched/renamed them. Still lagging behind the registry. No action beyond continuing to watch.

## Task 4: Registry MCP Latest-Version Post-Rename

All three renamed servers confirmed present at /versions/latest when the name portion is URL-encoded (only the name, not the whole path; over-encoding the full path 404s). curl evidence:

```
GET https://registry.modelcontextprotocol.io/v0.1/servers/io.github.theluckystrike%2Fspreadsheet/versions/latest  -> 200, v0.1.1
GET https://registry.modelcontextprotocol.io/v0.1/servers/io.github.theluckystrike%2Finvoice/versions/latest      -> 200, v0.1.1
GET https://registry.modelcontextprotocol.io/v0.1/servers/io.github.theluckystrike%2Fstatement-of-account/versions/latest -> 200, v0.22.0, remote mcp.zovo.one/mcp/statement-of-account
```

VERDICT (Task 4): PASS. All three renamed servers are live in the registry at their latest versions with correct remote URLs. The earlier 404s were probe artifacts (whole-path encoding), not registry gaps. No action needed.

## Final Verdict

- Task 1: PASS, all sampled guides 200 + self-canonical.
- Task 2: one actionable add (mcpservers.com), two login/paid-gated, three dead probes.
- Task 3: Glama ingest lag unchanged (renamed servers still 404 there).
- Task 4: registry fully consistent post-rename; probe-encoding note recorded for future scripts.