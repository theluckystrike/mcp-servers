# Content round 6: pdf and calendar guides, 14 setup pages, 2 compare pages - 2026-09-03

status: DONE

## What shipped

18 new URLs, all live at mcp.zovo.one:

- 2 guides in `billing/src/content.js`: `GUIDES["pdf-merge-split-stamp-from-chat"]` (895 rendered
  words) and `GUIDES["calendar-ics-free-busy-in-claude"]` (737 rendered words).
- pdf and calendar added to `SETUP_SERVERS` in `billing/src/setup.js`, each with 7 hand-written `ANGLE`
  sentences (one per client: claude-desktop, claude-code, cursor, vscode, windsurf, cline) plus one
  `WEB_ANGLE` sentence for the claude-web connector page, producing 14 setup pages total (2 servers x 7
  clients) through the existing `serversFor()` / `setupUrls()` machinery. Neither server is a child of
  office-suite, so no office-suite page changed.
- 2 comparison pages in `billing/src/compare.js`: `COMPARE["pdf"]` (vs pdf-mcp and DocWand) and
  `COMPARE["calendar"]` (vs mcp-ical and google-calendar-mcp).

Both servers already had `servers.pdf` / `servers.calendar` entries in `data/facts.json` and complete
READMEs at `servers/pdf/README.md` and `servers/calendar/README.md` before this round started, so no
part of this build was written from an absent spec.

Confirmed rather than assumed: `/sitemap.xml` and `/llms.txt` build their URL lists from `GUIDES`,
`COMPARE`, `PAGES` and `setupUrls()`, with no separate list to keep in sync. Sitemap went from 129 to 149
`<loc>` entries (20 more: 2 guides + 2 compare + 14 setup + `/s/pdf` + `/s/calendar`, the last two already
existed as product pages before this round and were not new). `llms.txt` was checked directly and carries
both new guide lines, both new compare lines, and 14 new setup lines under the per-client sections.

## Competitor research, verified before writing

Every competitor fact in the two compare pages was read from the official MCP registry search
(`registry.modelcontextprotocol.io/v0/servers?search=<term>`) for the terms `pdf`, `merge`, `calendar`
and `ics`, cross-checked against the npm registry record and the project's own README, all fetched by
curl on 2026-09-03. Nothing was installed.

- **pdf-mcp** (npm `mcp-pdf`, github.com/nitaiaharoni1/pdf-mcp): README read directly. It lists roughly
  24 tools across forms, signatures, security and export, well beyond page-level jobs, but its own
  feature list marks "Extract Text" as "requires additional implementation," which became the honest
  differentiator on the compare page rather than an invented weakness.
- **DocWand** (`app.docwand/pdf` on the official registry, streamable-http remote at
  `mcp.docwand.app/mcp`): registry entry read directly; its own site (docwand.app) states signing,
  filling, merging and splitting run entirely in the browser tab even though the connection is a hosted
  MCP endpoint. No repository field on the registry entry, so the tool count in the compare table is
  described as "documented flows" rather than a tool count read from a README, since none was found.
- **mcp-ical** (`@voxxit/mcp-ical`, github.com/voxxit/mcp-ical): README read directly, 5 tools counted
  by name (subscribe_calendar, list_calendars, unsubscribe_calendar, get_events, search_events). No
  free/busy, no conflicts, no time-entry handoff, which the compare page states plainly rather than as a
  guess.
- **google-calendar-mcp** (`@cocal/google-calendar-mcp`, github.com/nspady/google-calendar-mcp): README
  read directly, 12 tools counted from its own "Available Tools" table (list-calendars, list-events,
  search-events, get-event, list-colors, create-event, update-event, delete-event, get-freebusy,
  get-current-time, respond-to-event, manage-accounts). Confirmed it requires Google OAuth 2.0
  credentials and a browser consent flow before first use, since that fact drives most of the "when to
  pick" reasoning against it.

## Guide content

`pdf-merge-split-stamp-from-chat` (895 words) covers install, the merge/split/extract/rotate/stamp/
watermark tool set, a worked PAID-stamp example, and the required insight in detail: a subset-embedded or
CID-encoded font maps bytes to a private glyph-numbering table rather than to characters, so
`pdf_text` reading that table blind would return glyph index numbers that look like output but are not
text; the server does not carry a font-encoding decoder, so instead of returning that as if it were real
text, it checks whether the extracted result contains recognisable characters and, when it does not,
answers that the font's encoding is the reason, distinct from the separate "this page is a scan" answer
for an image-only page with no text operators at all. This is stated only as far as `servers/pdf/README.md`
documents it (the README's own wording: "When the output has no readable characters, the answer says the
font is the reason"); no internal detection heuristic beyond that was invented.

`calendar-ics-free-busy-in-claude` (737 words) covers exporting from Google Calendar, Apple Calendar and
Outlook (desktop and web), installing the server, the RRULE/EXDATE/RDATE/RECURRENCE-ID recurrence surface
and why VTIMEZONE is deliberately ignored in favour of Node's own ICU data, `free_busy` and `conflicts`,
and `event_to_time_entry` turning a finished meeting into billable time for the time tracker.

## Quality gate

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|
                 revolutionary|blazing|cutting-edge|leverage'  -> 0 (content.js, setup.js, compare.js)
    grep -c em-dash (\xe2\x80\x94)                              -> 0 (all 3 sources)
    grep -cP non-ASCII on content.js, setup.js, compare.js      -> 0
    node --check on all 3 edited sources                        -> pass
    npm test (billing)                                           -> 25 pass, 0 fail
    npm test -w servers/pdf                                      -> 39 pass, 0 fail (unchanged, not edited)
    npm test -w servers/calendar                                 -> 36 pass, 0 fail (unchanged, not edited)

## Deploy and verification

    cd billing && wrangler deploy   -> mcp-billing, version ce5895f9-9598-4400-9486-412723cbce3d
    curl x24 (18 new URLs + /guides, /compare, /setup, /sitemap.xml, /llms.txt, /) -> 24 x HTTP 200
    sitemap.xml <loc>                                              -> 149 (was 129); all new URLs matched
    llms.txt                                                       -> carries both guide lines, both
                                                                       compare lines, 14 pdf/calendar
                                                                       setup lines
    POST https://api.indexnow.org/IndexNow                        -> HTTP 200, 23 URLs in one request
                                                                       (18 new pages + /guides, /compare,
                                                                       /setup, /sitemap.xml, /)
    GET  https://mcp.zovo.one/22fad93b71a88e2e60acae203c4288ae.txt -> HTTP 200 (keyLocation)

Zero paid API calls. Outbound requests were the MCP registry search endpoint, four npm registry records,
three raw.githubusercontent.com README fetches, one project homepage (docwand.app), IndexNow, and the
Cloudflare deploy.

## RESULT.md

```
status: DONE
evidence:
  18 new URLs live, all HTTP 200: 2 guides (895 + 737 words), 14 setup pages (pdf and calendar across
  all 7 clients), 2 compare pages (pdf vs pdf-mcp/DocWand, calendar vs mcp-ical/google-calendar-mcp)
  competitor facts for both compare pages read from the official MCP registry search plus each project's
  own README/npm record, fetched by curl on 2026-09-03; the pdf-mcp "Extract Text requires additional
  implementation" line and google-calendar-mcp's OAuth requirement are quoted from source, not inferred
  pdf guide states the subset/CID font glyph-index insight exactly as documented in
  servers/pdf/README.md, including the two-message distinction between a scan and a font-encoding
  failure; calendar guide covers Google/Apple/Outlook export paths, RRULE/EXDATE/RDATE/RECURRENCE-ID
  expansion, why VTIMEZONE is ignored in favour of Node's ICU data, free_busy/conflicts, and
  event_to_time_entry
  sitemap.xml and llms.txt confirmed to derive from GUIDES/COMPARE/PAGES/setupUrls() with no separate
  list; sitemap 129 -> 149 <loc>, all 20 new/existing product entries accounted for
  quality gate: hype 0, em dash 0, non-ASCII 0 across all 3 edited sources; npm test 25 pass 0 fail;
  servers/pdf and servers/calendar suites (39 and 36 tests) re-run and confirmed green, unedited
  wrangler deploy ce5895f9-9598-4400-9486-412723cbce3d; 24 curls all HTTP 200
  IndexNow POST 200 for 23 URLs, keyLocation 200
artifacts:
  billing/src/content.js (2 guides, GUIDE_INDEX description extended)
  billing/src/setup.js (pdf and calendar SETUP_SERVERS rows, 14 ANGLE sentences, 2 WEB_ANGLE sentences)
  billing/src/compare.js (2 comparison pages, COMPARE_INDEX description updated to Thirteen)
  docs/CONTENT_R6_RESULT.md
  data/distribution.json (guides surface note extended for round 6)
cost: 35 wall minutes
failures: none.
```
