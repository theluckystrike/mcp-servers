# Content round 10: home page rewrite for first-time visitors - 2026-09-04

status: DONE

evidence:

```
$ curl -s https://mcp.zovo.one/ (before)  -> 17,504 bytes, title "MCP Servers Pro licenses",
    no meta description, no JSON-LD, no compact server table, no "three ways to install" list

$ node --check billing/src/index.js
(no output: syntax OK)

$ cd billing && npm test
# tests 25
# pass 25
# fail 0

$ grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|revolutionary|blazing|cutting-edge|leverage' \
    billing/src/index.js
0

$ grep -cP '\xe2\x80\x94' billing/src/index.js   # em dash
0

$ grep -cP '[^\x00-\x7F]' billing/src/index.js   # non-ASCII
0

$ cd billing && wrangler deploy
Current Version ID: 21de396f-4831-4b3d-882f-fdd50905149f

$ curl -s https://mcp.zovo.one/ -> HTTP 200, 25,596 bytes
$ grep -o '<title>[^<]*</title>' -> "MCP servers for Claude: invoices, time tracking and freelance tools"
$ grep -o '<meta name="description"[^>]*>' -> present, starts "Seventeen local-first MCP servers
    for Claude: invoicing, time tracking, expenses, spreadsheets and more..."
$ grep -c 'application/ld+json' -> 2 script blocks (SoftwareApplication, ItemList of 17 servers)
$ grep -o 'href="/s/[a-z-]*"' | sort -u | wc -l -> 17
$ curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/mcp/connect -> 200

$ POST https://api.indexnow.org/IndexNow (host mcp.zovo.one, key from data/indexnow.key,
    urlList ["https://mcp.zovo.one/"]) -> HTTP 200
```

## What shipped

Rewrote the top of `billing/src/index.js`'s `home()` function so the first screen a
search visitor sees states, in plain words: seventeen local-first MCP servers for
freelancers and small businesses, the free tier works with no key, connect by URL in
under a minute through `/mcp/connect` (with the exact client list: Claude.ai custom
connectors, the Claude Desktop connector dialog, Claude Code, Cursor, VS Code), or
install the `.mcpb`, and the bundle price ($39 lifetime for all seventeen, or $19 per
server). Below that: a "Three ways to start" ordered list (connect by URL, install the
`.mcpb`, install locally with npx), a "Measured, not claimed" paragraph with the trust
facts, a new compact table of all seventeen servers linking to `/s/<id>`, then the
original full free/Pro comparison table and every other existing section unchanged
(hosted endpoints, activation, setup guides, guides, source link, footer).

Title changed from "MCP Servers Pro licenses" to "MCP servers for Claude: invoices,
time tracking and freelance tools", targeting the query "MCP servers for Claude
freelancers invoices time tracking". Added a meta description (155 chars) and two
JSON-LD blocks: a `SoftwareApplication` for the bundle with three `Offer` entries
(free, $19, $39) and an `ItemList` of the seventeen servers, each pointing at its
`/s/<id>` page. Neither existed on the home page before this round.

Trust facts on the page are hardcoded with the date they were measured, since the
billing Worker has no build step that reads `data/*.json` at runtime:

- 399 of 399 automated checks passing (from `data/validation.json`, run
  2026-09-03T04:59:40.802Z, 19 server/billing result groups)
- 25 unit tests green (billing test suite: `bind.test.mjs`, `fulfillment.test.mjs`,
  `mint.test.mjs`, `node --test`)
- Hosted `tools/list` p50 latency 375 ms (from `data/kpi.json`, generated
  2026-09-04T03:36:54.287Z, target 800 ms, status "met")

All stated "as of 2026-09-04" in the page copy so a later drift in the underlying
numbers reads as stale rather than false.

Every existing route, the shared `page()` layout, and the footer/legal line
(`Built by theluckystrike. Support: support@zovo.one`) are unchanged. No route was
removed or renamed.

## Before / after (first 300 characters of visible text, tags stripped)

Before:
```
MCP Servers Pro licenses MCP Servers Pro licenses Connect in one step: open /mcp/connect
for a URL that works in Claude.ai, Claude Desktop, Cursor and VS Code with no install and
no headers. Or install a server locally below: practical MCP servers for Claude, Cursor
and any MCP client, each with a g
```

After:
```
MCP servers for Claude: invoices, time tracking and freelance tools Seventeen
local-first MCP servers for Claude, for freelancers and small businesses Invoicing,
time tracking, expenses, spreadsheets, quotes, contracts and more, each running as its
own MCP server. The free tier works with no key and
```

## Files touched

- `billing/src/index.js` - `home()` rewritten (title, meta description, JSON-LD,
  intro paragraph, three-ways-to-start list, trust-facts paragraph, compact
  seventeen-server table); route handler for `path === "/"` unchanged, still returns
  `home()`'s output.
- `docs/CONTENT_R10_RESULT.md` - this file.

No changes to `billing/src/setup.js`, `billing/src/content.js`, `billing/src/compare.js`,
or `data/facts.json` in this round; those are other agents' surfaces per the task split.

## Not done / out of scope

- Did not touch `billing/test/**`: the three existing test files already cover
  `fulfillmentAllowed`, `validTenant`, `bindDecision`, key minting; none of those
  functions changed, so no new test was needed and the 30-minute cap was spent on
  the page rewrite and verification instead.
- Registry-entries and findable-share KPIs (`data/kpi.json`, "Discovery" category)
  were read but not surfaced on the page; the task asked for validation-checks count,
  tests count, and hosted p50 latency specifically.
