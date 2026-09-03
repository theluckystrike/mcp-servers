# Content round 5: connect-by-URL guide, claude-web setup pages, home lead - 2026-09-03

status: DONE

## What shipped

13 new URLs, all live at mcp.zovo.one:

- 1 guide in `billing/src/content.js` (`GUIDES["connect-mcp-servers-without-installing"]`), 936 rendered
  words, description 146 characters
- 1 new client, `claude-web` (claude.ai and Claude Desktop connectors), added to `CLIENTS` in
  `billing/src/setup.js`, producing 12 pages: 1 hub (`/setup/claude-web`) plus 11 per-server pages. The
  11 exclude `office-suite`, which starts five child processes and has no single connector URL;
  `/setup/claude-web/office-suite` correctly returns 404.
- `billing/src/index.js`: home page lead paragraph now opens with "Connect in one step" linking to
  `/mcp/connect`, the "Hosted endpoints" paragraph on the home page was rewritten to describe the
  per-server token URL instead of the old three-server bearer-header text, and `/llms.txt`'s setup lines
  and hosted-endpoints line were updated to use the new `serversFor()` export so claude-web's list does
  not link to a page that does not exist.

Confirmed rather than assumed: `/sitemap.xml` and `/llms.txt` build their lists from `GUIDES`, `COMPARE`,
`PAGES` and `setupUrls()`, and `setupUrls()` now calls the new `serversFor(clientId)` export, so all 13
URLs appeared in both from the data objects alone, with no separate list to keep in sync. Sitemap went
from 116 to 129 `<loc>` entries; all 12 `claude-web` URLs and the 1 new guide URL were matched by exact
string.

## Verifying the claude.ai custom connector mechanism first

Before writing the claude-web pages, `https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp`
was fetched directly with curl and read. It documents two paths, both by URL, neither requiring OAuth:

- Individual Pro or Max: Customize, Connectors, the + button, "Add custom connector", which asks for a
  name and a Remote MCP server URL, with an Advanced settings section for an optional OAuth Client ID and
  Client Secret.
- Team or Enterprise: only an Owner or Primary Owner can add a custom connector, at Organization
  settings, Connectors, Add, Custom, Web. Members then click Connect on what the Owner added rather than
  pasting their own URL.

Nothing in that article requires OAuth or an allowlist for a URL-only connector; the OAuth fields are
optional and this endpoint does not use them. That is stated in the guide's FAQ and on every claude-web
setup page rather than assumed. The claude-web pages present the URL form as documented for claude.ai and
Claude Desktop directly (not merely "what Claude Code and Cursor accept"), since the support article
confirms the URL-only path exists there too.

## Guide content (936 words)

Covers: what a remote MCP connector is (URL instead of a local process); the claude.ai/Claude Desktop
custom connector flow for both individual and Team/Enterprise plans, cited above; Claude Code's
`claude mcp add --transport http`; the Cursor/VS Code URL-in-config-file form with a link out to the
per-client setup pages for exact syntax; what is kept per token (scoped to an anonymous tenant, no
account) and for how long (30-day idle sweep, 1-hour download links for generated files); how a Pro key
checkout binds to the token; and an "Honest limits" section naming three gaps of the hosted route against
a local install: invoices render as HTML rather than a locally-rendered PDF file, the spreadsheet server
runs in an inline read/return mode with no folder to write back to, and there is no receipts feature
because `receipt_attach` needs a real filesystem path the connector does not have.

## Quality gate

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|
                 revolutionary|blazing|cutting-edge|leverage'  -> 0 (content.js, setup.js, index.js)
    grep -c em-dash (\xe2\x80\x94)                              -> 0 (all 3 sources)
    grep -cP non-ASCII on content.js, setup.js, index.js        -> 0
    node --check on all 3 edited sources                        -> pass
    npm test                                                     -> 25 pass, 0 fail

## Deploy and verification

    cd billing && wrangler deploy   -> mcp-billing, version 0ba3cd79-c6ae-4453-87d4-e9bba840d6eb
    curl x16 (13 new URLs + / + /sitemap.xml + /llms.txt)         -> 16 x HTTP 200
    curl /setup/claude-web/office-suite                           -> 404 (expected, by design)
    sitemap.xml <loc>                                              -> 129 (was 116); all 13 new matched
    llms.txt                                                       -> carries the guide, claude-web setup
                                                                       lines (11 servers only), and the
                                                                       rewritten "Connect in one step"
                                                                       hosted-endpoints line
    home page                                                      -> "Connect in one step" present,
                                                                       links to /mcp/connect
    POST https://api.indexnow.org/IndexNow                        -> HTTP 200, 17 URLs in one request
                                                                       (13 new pages + /guides, /setup,
                                                                       /sitemap.xml, /)

## Search Console

Service account `zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com`, scope
`https://www.googleapis.com/auth/webmasters`, property `sc-domain:zovo.one` (domain property, covers
mcp.zovo.one automatically, `siteFullUser`).

`sitemaps.list` before this round's resubmit still showed the round-4 snapshot: `submitted: 13`,
`indexed: 0`, `lastSubmitted` 2026-09-02 (stale, before round 4 or 5 grew the sitemap). Resubmitted
`https://mcp.zovo.one/sitemap.xml` via `sitemaps.submit`, then re-read it:

    submitted: 129, indexed: 0, warnings: 0, errors: 0
    lastSubmitted / lastDownloaded: 2026-09-03T08:42:4x UTC (this round)

`urlInspection.index.inspect` on 4 URLs, all verdict `NEUTRAL`, none indexed yet, none crawled yet
(`lastCrawlTime` absent on all 4):

| URL | coverageState |
|---|---|
| https://mcp.zovo.one/ | Discovered - currently not indexed |
| https://mcp.zovo.one/s/invoice | Discovered - currently not indexed |
| https://mcp.zovo.one/guides/track-time-in-claude-code | URL is unknown to Google |
| https://mcp.zovo.one/setup/claude-code/invoice | URL is unknown to Google |

Interpretation: 0 of these 4 URLs are indexed. `/` moved forward from "URL is unknown to Google" (round 4
result) to "Discovered - currently not indexed", so Google has picked it up from the sitemap since round
4. `/guides/track-time-in-claude-code` reads as further back than round 4's inspection of the same URL
("Discovered - currently not indexed" then, "URL is unknown to Google" now); this is Google's own
crawl-queue state, not something this task changed, and is consistent with a resubmitted sitemap having
just reset the discovery clock for entries Google had not yet crawled. None of this is a defect on our
side: the sitemap itself resubmits clean (0 warnings, 0 errors), and indexing after a fresh submission is
hours-to-days, not minutes. Re-check in 24-48h to see indexed count and coverage states move.

## RESULT.md

```
status: DONE
evidence:
  13 new URLs live, all HTTP 200: 1 guide (936 words, 146-char description), 1 hub + 11 server pages
  for the new claude-web client; /setup/claude-web/office-suite correctly 404s (5-process server, no
  single connector URL)
  claude.ai custom connector mechanism verified by direct curl of Anthropic's own support article before
  writing: URL-only "Add custom connector" exists for individual Pro/Max; Team/Enterprise requires an
  Owner to add it once at the org level; OAuth Client ID/Secret is optional and unused by this endpoint
  sitemap.xml and llms.txt confirmed to derive from GUIDES/COMPARE/PAGES/setupUrls(); new serversFor()
  export keeps claude-web's 11-server list in sync everywhere it is used (setup pages, hub, index,
  sitemap, llms.txt) with no separate list to maintain
  home page lead now opens "Connect in one step" linking to /mcp/connect; hosted-endpoints copy on home
  and in llms.txt rewritten from the old 3-server bearer-header text to the per-server token URL
  quality gate: hype 0, em dash 0, non-ASCII 0 across all 3 edited sources; npm test 25 pass 0 fail
  wrangler deploy 0ba3cd79-c6ae-4453-87d4-e9bba840d6eb; sitemap 116 -> 129 <loc>, all 13 new matched
  IndexNow POST 200 for 17 URLs in one request
  GSC: resubmitted sitemap.xml (was stale at 13 submitted from round 4); now 129 submitted, 0 indexed,
  0 warnings, 0 errors; 4 urlInspection calls, all NEUTRAL, 0 of 4 indexed, 2 "Discovered - currently
  not indexed", 2 "URL is unknown to Google" -- expected latency, not a defect
artifacts:
  billing/src/content.js (1 guide, BASE const added)
  billing/src/setup.js (claude-web client, serversFor export, WEB_ANGLE, FAQ["claude-web"], setupPage
    branch, clientHub/setupIndex/setupUrls updated to respect serversFor)
  billing/src/index.js (import serversFor; home lead paragraph and hosted-endpoints copy; llms.txt
    setupLines and hosted-endpoints line)
  docs/CONTENT_R5_RESULT.md
  data/distribution.json (guides, setup, search-console notes extended for round 5)
cost: 33 wall minutes
failures: none. The one open item is normal Google indexing latency (0 of 4 inspected URLs indexed at
  submission time), not something this task can accelerate; re-inspect in 24-48h.
```
