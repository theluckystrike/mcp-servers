# Content round 7: kanban and image guides, 14 setup pages, 2 compare pages - 2026-09-04

status: DONE

## What shipped

18 new URLs, all live at mcp.zovo.one:

- 2 guides in `billing/src/content.js`: `GUIDES["kanban-board-in-claude-with-time-tracking"]` (id-counter
  concurrency insight, verified against `servers/kanban/test/concurrency.test.mjs`, plus the
  `task_start_timer` handoff to the time tracker) and
  `GUIDES["image-resize-compress-watermark-from-chat"]` (the measured PNG "compress" insight: quantizing a
  300x220 test PNG to 16 colours produced 115,451 bytes against a 39,262 byte original, 2.9x larger, so
  `quality` only applies to a JPEG output and the extension of `out_path` picks the codec).
- kanban and image added to `SETUP_SERVERS` in `billing/src/setup.js`, each with 6 hand-written `ANGLE`
  sentences (claude-desktop, claude-code, cursor, vscode, windsurf, cline) plus one `WEB_ANGLE` sentence
  for the claude-web connector page, producing 14 setup pages total (2 servers x 7 clients) through the
  existing `serversFor()` / `setupUrls()` machinery.
- 2 comparison pages in `billing/src/compare.js`: `COMPARE["kanban"]` (vs KanbanThing and SwiftKanban CLI)
  and `COMPARE["image"]` (vs Pictomancer and Image Resize API).

Both servers already had `servers.kanban` / `servers.image` entries in `data/facts.json`, `/s/kanban` and
`/s/image` product pages in `billing/src/pages.js`, and complete READMEs at `servers/kanban/README.md` and
`servers/image/README.md` before this round started, so no part of this build was written from an absent
spec. `/s/kanban` and `/s/image` were not new URLs this round.

Confirmed rather than assumed: `/sitemap.xml` and `/llms.txt` build their URL lists from `GUIDES`,
`COMPARE`, `PAGES` and `setupUrls()`, with no separate list to keep in sync (read directly in
`billing/src/index.js`, lines building the `/sitemap.xml` and `/llms.txt` handlers). Live sitemap now
carries 170 `<loc>` entries: 18 under `/guides` (17 guide pages + the index), 16 under `/compare` (15
compare pages + the index), 16 under `/s/` (unchanged product pages), 119 under `/setup` (16 servers x 6
clients + 15 for claude-web, excluding office-suite, plus the setup index and 7 client hubs). `llms.txt`
was fetched live and carries both new guide lines, both new compare lines, and all 14 new setup lines
under each per-client section, verified by grep.

## Competitor research, verified before writing

Every competitor fact in the two compare pages was read from the official MCP registry search
(`registry.modelcontextprotocol.io/v0/servers?search=<term>`) for the terms `kanban`, `todo`, `tasks`,
`image` and `resize`, cross-checked against each project's own README, its GitHub repository metadata, its
npm record, or its site, all fetched by curl on 2026-09-04. Nothing was installed.

- **KanbanThing** (`com.kanbanthing/kanban` on the registry, github.com/tronschell/kanban-thing, hosted
  streamable-http at `www.kanbanthing.com/mcp`): README and the CLI docs page at kanbanthing.com/cli read
  directly. 8 MCP tools counted by name (create_board, get_board, list_columns, list_cards, create_card,
  move_card, update_card, delete_card). Its own README states boards are deleted up to 60 days after
  creation and says plainly this is on purpose, which became the honest differentiator rather than an
  invented weakness. MIT licence confirmed via the GitHub repo API.
- **SwiftKanban CLI** (`io.github.deenaik/swiftkanban` on the registry, npm `@nimblework/sk-cli`,
  github.com/digiteinfotech/sk-cli): README read directly. It requires `sk login` against an existing
  SwiftKanban account with the Integration User role before any tool works; confirmed from its own setup
  instructions, not inferred. MIT licence confirmed via the npm record and the GitHub repo API.
- **Pictomancer** (`ai.pictomancer/image-processing` on the registry, hosted at `api.pictomancer.ai/mcp`):
  registry entry and pictomancer.ai's own pricing page read directly. Six operations counted from its own
  pricing table (analyze free, resize, compress, crop, convert, ai-generated), billed from $0.001 per
  operation after 50 free requests with no card or account for those first 50, stated on its own site. No
  repository field readable (gitlab.com/pictomancer.ai/pig-gateway redirects to a login wall), so its
  licence is reported as "not stated" rather than guessed.
- **Image Resize API** (`io.github.Br0ski777/image-resize` on the registry, github.com/Br0ski777/image-resize-x402,
  hosted via x402 at `image-resize.api.klymax402.com/mcp`): README read directly. One tool,
  `media_resize_image`, $0.008 per call in USDC on Base via the x402 protocol, no signup, MIT licensed per
  its own README badge. Its own "Not for" section (OCR, QR codes, screenshots) is quoted rather than
  paraphrased as a weakness we invented.

## Guide content

`kanban-board-in-claude-with-time-tracking` covers install, what a task carries, the id-counter
concurrency insight in detail: the counter that produces ids like `NOVA-1` lives inside the same JSON file
as the board, so an unlocked load-increment-save cycle under two writers can hand out the same id twice; the
shipped fix is an advisory lock file next to the data file, verified by
`servers/kanban/test/concurrency.test.mjs`, which fires 40 concurrent `task_add` calls from two separate
server processes at one board and asserts all 40 persist, every id is unique, and the board's counter lands
on exactly 41. The guide also covers `task_start_timer`'s handoff (it returns arguments for the time
tracker's `timer_start` rather than calling it directly), `task_log_time`, `board`, `overdue` and
`weekly_review`.

`image-resize-compress-watermark-from-chat` covers install, why `image_compress`'s `quality` parameter is a
JPEG-only knob, and the measured PNG insight required for this round: quantizing a 300x220 noisy test PNG
to 16 colours, read verbatim from `servers/image/README.md`'s own measured section, produced 115,451 bytes
against a 39,262 byte original (2.9x larger), because the encoder still writes RGBA either way and
quantizing destroys the row-to-row pixel similarity PNG's own deflate compression depends on; the practical
consequence stated in the guide is that the output format follows the extension of `out_path`, so a PNG
screenshot that needs to shrink should be written out as `.jpg`. The guide also covers resize/crop/thumbnail
batching with reserved output paths, what `image_strip_metadata` actually removes, and the header-based
decompression-bomb refusal.

## Quality gate

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|
                 revolutionary|blazing|cutting-edge|leverage'  -> 0 (content.js, setup.js, compare.js)
                 (one false-positive hit on "unlocked" inside a sentence was found and reworded to avoid
                 the substring match, then re-verified at 0)
    grep -cP em-dash (\xe2\x80\x94)                              -> 0 (all 3 sources)
    grep -cP non-ASCII on content.js, setup.js, compare.js      -> 0
    node --check on all 3 edited sources                         -> pass
    npm test (billing)                                            -> 25 pass, 0 fail

## Deploy and verification

    cd billing && wrangler deploy   -> mcp-billing, version d1acb3ab-38e9-40aa-bea1-4e82411d44cb
    curl x24 (18 new URLs + /guides, /compare, /setup, /sitemap.xml, /llms.txt, /) -> 24 x HTTP 200
    sitemap.xml <loc>                                              -> 170 total (18 guides incl. index,
                                                                       16 compare incl. index, 16 s/,
                                                                       119 setup incl. index and hubs);
                                                                       17 guide pages, 15 compare pages
                                                                       confirmed via grep count
    llms.txt                                                       -> carries both guide lines, both
                                                                       compare lines, 14 kanban/image
                                                                       setup lines across all 7 client
                                                                       sections, verified by grep
    POST https://api.indexnow.org/IndexNow                        -> HTTP 200, 23 URLs in one request
                                                                       (18 new pages + /guides, /compare,
                                                                       /setup, /sitemap.xml, /)
    GET  https://mcp.zovo.one/22fad93b71a88e2e60acae203c4288ae.txt -> HTTP 200 (keyLocation)

Zero paid API calls. Outbound requests were the MCP registry search endpoint, npm registry records, GitHub
repository API and raw.githubusercontent.com README fetches, two project homepages
(kanbanthing.com/cli, pictomancer.ai), IndexNow, and the Cloudflare deploy.

## RESULT.md

```
status: DONE
evidence:
  18 new URLs live, all HTTP 200: 2 guides, 14 setup pages (kanban and image across all 7 clients), 2
  compare pages (kanban vs KanbanThing/SwiftKanban CLI, image vs Pictomancer/Image Resize API)
  competitor facts for both compare pages read from the official MCP registry search plus each project's
  own README/npm record/site, fetched by curl on 2026-09-04; KanbanThing's 60-day board deletion and
  SwiftKanban CLI's account/login requirement, and Pictomancer's per-call pricing and Image Resize API's
  "Not for" scope line, are quoted from source, not inferred
  kanban guide states the id-counter concurrency defect and its advisory-lock fix exactly as verified by
  servers/kanban/test/concurrency.test.mjs (40 concurrent task_add calls, 2 processes, unique ids, counter
  lands on 41), plus the task_start_timer handoff to the time tracker
  image guide states the measured PNG quantization insight exactly as documented in
  servers/image/README.md: 16-colour quantization of a 300x220 test PNG produced 115,451 bytes against a
  39,262 byte original (2.9x larger), so quality only applies to a JPEG output and out_path's extension
  picks the codec
  sitemap.xml and llms.txt confirmed to derive from GUIDES/COMPARE/PAGES/setupUrls() with no separate
  list; sitemap now 170 <loc> entries (17 guide pages, 15 compare pages, 16 product pages, 119 setup/hub
  pages), all new URLs matched; /s/kanban and /s/image were not new, already live before this round
  quality gate: hype 0 (one "unlocked" false-positive substring match found and reworded), em dash 0,
  non-ASCII 0 across all 3 edited sources; npm test 25 pass 0 fail
  wrangler deploy d1acb3ab-38e9-40aa-bea1-4e82411d44cb; 24 curls all HTTP 200
  IndexNow POST 200 for 23 URLs, keyLocation 200
artifacts:
  billing/src/content.js (2 guides, GUIDE_INDEX description extended)
  billing/src/setup.js (kanban and image SETUP_SERVERS rows, 12 ANGLE sentences, 2 WEB_ANGLE sentences)
  billing/src/compare.js (2 comparison pages, COMPARE_INDEX description updated to Fifteen)
  docs/CONTENT_R7_RESULT.md
  data/distribution.json (guides surface note extended for round 7)
cost: 35 wall minutes
failures: none.
```
