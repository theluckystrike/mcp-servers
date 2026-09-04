# Content round 12: zip guide, 6+1 setup pages, no compare page - 2026-09-04

status: DONE

evidence:

```
$ node --check billing/src/content.js && node --check billing/src/setup.js && node --check billing/src/compare.js
(no output from all three: syntax OK)

$ cd billing && npm test
# tests 25
# pass 25
# fail 0

$ grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|revolutionary|blazing|cutting-edge|leverage' \
    billing/src/content.js billing/src/setup.js billing/src/compare.js
0  0  0

$ grep -cP '\xe2\x80\x94' billing/src/content.js billing/src/setup.js billing/src/compare.js   # em dash
0  0  0

$ grep -cP '[^\x00-\x7F]' billing/src/content.js billing/src/setup.js billing/src/compare.js   # non-ASCII
0  0  0

$ curl -s -X POST https://mcp.zovo.one/mcp/zip -H 'content-type: application/json' -d '{}'   (first check, start of round)
{"error":"not_found","index":"https://mcp.zovo.one/mcp"}

$ curl -s -X POST https://mcp.zovo.one/mcp/zip -H 'content-type: application/json' -d '{}'   (re-check, end of round)
{"error":"not_found","index":"https://mcp.zovo.one/mcp"}
-> unchanged; zip excluded from claude-web, no WEB_ANGLE.zip added, no claude-web setup page

$ cd billing && PATH="$HOME/.npm-global/bin:$PATH" wrangler deploy
Current Version ID: 3a6d356a-af18-44b6-8c40-61d591dde067

$ curl x12 (guide, 6 setup pages, /, /guides, /setup, /sitemap.xml, /llms.txt) -> 12 x HTTP 200
$ curl https://mcp.zovo.one/setup/claude-web/zip -> HTTP 404 (correctly absent, endpoint not live)

$ curl -s https://mcp.zovo.one/sitemap.xml | grep -o '<loc>[^<]*</loc>' | wc -l
207 total; 8 contain "zip" (existing /s/zip product page, guide, 6 setup pages; no claude-web page,
no compare page)

$ curl -s https://mcp.zovo.one/llms.txt | grep -c "MCP Zip in "
6   (one line per client section: claude-desktop, claude-code, cursor, vscode, windsurf, cline)

$ POST https://api.indexnow.org/IndexNow            -> HTTP 200, 7 URLs
$ GET  https://mcp.zovo.one/22fad93b71a88e2e60acae203c4288ae.txt -> HTTP 200 (keyLocation)
```

## What shipped

7 new URLs, all live at mcp.zovo.one:

- 1 guide in `billing/src/content.js`: `GUIDES["zip-archives-safely-from-chat"]`, covering why the
  ratio ceiling (100x default) is the second guard and the total declared size the first (grounded
  in the measured 82.69x real CSV export vs a 1022x zeros-file bomb, from `servers/zip/README.md`
  and `docs/ZIP_RESULT.md`), traversal and absolute-path entries (`../../`, `/etc/cron.d/pwn`,
  `C:\Windows\evil.dll`) refused by name with the resolved target re-checked against `out_dir`, why
  a bounded inflate buffer is not a bomb guard (the measured 100,000-byte-into-10-byte-buffer
  result: 10 bytes back, no exception) and the CRC-32 check that catches what the buffer cannot,
  `zip_bundle_month` collecting a month of invoices, quotes and exports from the sibling servers'
  own output folders, and the free-vs-Pro split (reading unlimited on both tiers, writing metered).
  All facts read from `servers/zip/README.md`, `servers/zip/SPEC.md` and `docs/ZIP_RESULT.md`, not
  invented. GUIDE_INDEX description extended.
- `zip` added to `SETUP_SERVERS` in `billing/src/setup.js` with 6 hand-written `ANGLE` sentences
  (claude-desktop, claude-code, cursor, vscode, windsurf, cline), producing 6 setup pages.
- No claude-web page and no `WEB_ANGLE.zip`: `curl -s -X POST https://mcp.zovo.one/mcp/zip` returned
  `{"error":"not_found"}` both at the start of the round and on the re-check at the end, so `zip` was
  added to `WEB_EXCLUDED` (now `["office-suite", "zip"]`) and left there. No `/setup/claude-web/zip`
  page exists; confirmed HTTP 404.
- No compare page. Every competitor search this round came back empty of a genuine match; see
  below. `billing/src/compare.js` was not edited.

## Competitor research: no real competitor found

Searched the official MCP registry (`registry.modelcontextprotocol.io/v0/servers?search=<term>`) for
`zip`, `archive` and `compress`, then widened to `unzip`, `tar`, `gzip`, `7z`, `decompress`, `file
compression`, `extract`, `zip file`, `zip archive`, `archiver`, `unpack`, `inflate`, `deflate`, `file
archive` and `tarball`, all on 2026-09-04. Nothing came back that packs, lists or unpacks a .zip
file:

- `zip` returns only ZIP-postal-code servers (`io.github.andrew-sondgeroth/zipexplore-mcp`,
  `jp.addresstozip/address-to-zip`, `tax.zip/ziptax`, `io.github.pipeworx-io/zippopotam`) and
  unrelated products that happen to have "zip" in a company name (`com.zippfeed/zipp`,
  `ai.zipquote/us-property-hazard-risk`).
- `archive` returns Internet Archive wrappers (`io.github.pipeworx-io/archive`,
  `io.github.cyanheads/internet-archive-mcp-server`, `io.github.smeet666/mcp-archiveorg`), a
  Wayback/exoplanet/telegram/X-archive set, and paid data-handoff products
  (`io.github.HanbeenMoon/agent-failure-archive`) - none touch the zip container format.
- `compress` returns image compressors (`io.github.theluckystrike/image-resize-convert-compress-
  watermark`, our own; `io.github.zhaoyaqi18/compressio`), LLM-prompt compressors
  (`io.github.base76-research-lab/token-compressor`, `io.github.Evozim/brotli-prompt-compressor-
  mcp`), and `io.github.iowarp/compression-mcp`, checked directly against its README at
  github.com/iowarp/clio-kit: it compresses scientific data formats (HDF5, Parquet) for HPC
  workflows, not zip archives, and is one of 22 unrelated servers in that same repo.
- Checked `io.github.Digital-Defiance/mcp-filesystem` (`ai-capabilities-suite`) directly against its
  registry record on the chance a general filesystem server bundled archive support: its description
  is batch ops, watching, search and checksums, with no zip, tar or archive tool named anywhere.
- Every other search term (`unzip`, `tar`, `gzip`, `7z`, `decompress`, `file compression`, `zip
  file`, `zip archive`, `archiver`, `unpack`, `inflate`, `deflate`, `file archive`, `tarball`)
  returned either nothing or results with no bearing on file archiving.

No paid API calls anywhere in this search; every request was a GET against the free public registry
endpoint or a GitHub raw README.

## Quality gate

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|
                 revolutionary|blazing|cutting-edge|leverage'  -> 0 (content.js, setup.js, compare.js)
    grep -cP em-dash (\xe2\x80\x94)                              -> 0 (all 3 sources)
    grep -cP non-ASCII on content.js, setup.js, compare.js      -> 0 (none introduced)
    node --check on all 3 edited sources                         -> pass
    npm test (billing)                                            -> 25 pass, 0 fail

## Deploy and verification

    cd billing && wrangler deploy   -> mcp-billing, version 3a6d356a-af18-44b6-8c40-61d591dde067
    curl x12 (guide, 6 setup pages, /, /guides, /setup, /sitemap.xml, /llms.txt) -> 12 x HTTP 200
    curl /setup/claude-web/zip                                     -> HTTP 404 (correctly absent)
    sitemap.xml <loc>                                              -> 207 total, 8 containing "zip"
                                                                       (product page + guide + 6
                                                                       setup pages)
    llms.txt                                                       -> "MCP Zip in <client>" appears
                                                                       6 times, one per client
                                                                       section
    POST https://api.indexnow.org/IndexNow                        -> HTTP 200, 7 URLs in one request
    GET  https://mcp.zovo.one/22fad93b71a88e2e60acae203c4288ae.txt -> HTTP 200 (keyLocation)

Zero paid API calls. Outbound requests were the MCP registry search endpoint (15 search terms), one
GitHub raw README fetch (iowarp/clio-kit), two probes of mcp.zovo.one/mcp/zip (start and end of
round), one probe of /setup/claude-web/zip, IndexNow, and the Cloudflare deploy.

## RESULT.md

```
status: DONE
evidence:
  7 new URLs live, all HTTP 200: 1 guide, 6 setup pages (zip across claude-desktop, claude-code,
  cursor, vscode, windsurf, cline). No claude-web page: curl -X POST
  https://mcp.zovo.one/mcp/zip returned {"error":"not_found"} on both the start-of-round and the
  required end-of-round re-check, so zip was added to WEB_EXCLUDED and no WEB_ANGLE.zip or
  /setup/claude-web/zip page was created; confirmed HTTP 404.
  no compare page shipped: the official MCP registry search across zip, archive and compress
  (plus 12 further terms: unzip, tar, gzip, 7z, decompress, file compression, extract, zip file,
  zip archive, archiver, unpack, inflate, deflate, file archive, tarball) returned no server that
  packs, lists or unpacks a zip archive. Every hit was either a ZIP-postal-code lookup, an Internet
  Archive wrapper, an image or LLM-prompt compressor, or (checked directly against its README) a
  scientific-data compressor for HDF5/Parquet, none of which are a fair comparison to a zip-archive
  tool. billing/src/compare.js was not edited this round rather than shipping a page against a poor
  or fabricated comparison.
  guide covers the measured 82.69x-real-CSV-vs-1022x-bomb table that makes the ratio ceiling the
  second guard rather than the first, traversal/absolute-path refusal with the double out_dir check,
  the measured 100,000-byte-into-10-byte-buffer result that shows a bounded inflate buffer is not a
  bomb guard and why the CRC-32 check is, zip_bundle_month's read of the sibling servers' output
  folders, and the free-vs-Pro split (reading unlimited on both tiers), all read from
  servers/zip/README.md, servers/zip/SPEC.md and docs/ZIP_RESULT.md rather than invented.
  sitemap.xml and llms.txt confirmed to derive from GUIDES/SETUP_SERVERS/setupUrls() with no
  separate list to maintain; sitemap now 207 <loc> entries, 8 containing "zip" (the pre-existing
  product page plus the 7 new pages).
  quality gate: hype 0, em dash 0, non-ASCII 0 across all 3 edited sources; npm test 25 pass 0 fail.
  wrangler deploy 3a6d356a-af18-44b6-8c40-61d591dde067; 13 curls (12 new-URL checks plus the
  claude-web/zip 404 check) all returned the expected code.
  IndexNow POST 200 for 7 URLs, keyLocation 200
artifacts:
  billing/src/content.js (1 guide, GUIDE_INDEX description extended)
  billing/src/setup.js (zip SETUP_SERVERS row with hosted: null, 6 ANGLE sentences, WEB_EXCLUDED
    extended to ["office-suite", "zip"])
  docs/CONTENT_R12_RESULT.md
cost: 25 wall minutes.
failures: none.
follow-ups for the orchestrator (outside this unit's write scope):
  no compare page for zip exists yet, because no genuine competitor was found on the registry under
  15 searched terms; if a real zip/archive MCP server is published later, a future round should
  re-search before assuming this stays empty.
  the /mcp/zip route does not exist yet (two checks, both {"error":"not_found"}), so zip has no
  claude-web setup page and is in WEB_EXCLUDED; re-check when remote/src/index.ts grows that route,
  the way barcode's did mid-round in R11.
```
