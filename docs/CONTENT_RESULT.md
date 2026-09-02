# Guides content run - 2026-09-02

status: DONE

## What shipped

Five long-form guides plus an index, served by the billing Worker at mcp.zovo.one. Content lives in
`billing/src/content.js` as `GUIDES[slug] = { title, description, html, faq }`; `billing/src/index.js`
serves `/guides` and `/guides/<slug>` through the existing `page()` helper and injects the meta
description, the canonical link, a `TechArticle` block and a `FAQPage` block after `</title>`, the same
way `/s/:id` does. The guide URLs were added to `/sitemap.xml` and `/llms.txt`. A "Guides" section with
links to all five was added to the storefront home page and to the bottom of every `/s/<id>` page.

Every page carries one H1, H2 sections, a code block with the exact client config, an FAQ of five
question and answer pairs matching the JSON-LD, internal links to `/` and to the relevant `/s/<id>`,
a canonical tag and the shared "Built by theluckystrike" footer.

## URLs, status, word counts

Word counts are of rendered text with script and style stripped. Meta description length in characters.

| URL | HTTP | Title | Words | Meta desc |
|---|---|---|---|---|
| https://mcp.zovo.one/guides | 200 | Guides for MCP servers in Claude and Cursor | 255 | 140 |
| https://mcp.zovo.one/guides/track-time-in-claude-code | 200 | How to track billable hours inside Claude Code and Cursor | 870 | 138 |
| https://mcp.zovo.one/guides/invoice-pdf-from-chat | 200 | Create an invoice PDF from a chat message with an MCP server | 897 | 138 |
| https://mcp.zovo.one/guides/read-excel-in-cursor | 200 | Ask questions about an Excel or CSV file from Cursor or Claude | 853 | 142 |
| https://mcp.zovo.one/guides/price-drop-alerts-with-claude | 200 | Watch a product price with Claude and get told when it drops | 963 | 147 |
| https://mcp.zovo.one/guides/mcp-server-free-vs-pro | 200 | What the free tier includes and what Pro adds | 858 | 141 |

The five article pages are inside the 600-1100 word target. The index page is a link list, 255 words.

Re-checked after deploy: `/`, all four `/s/<id>` pages, `/sitemap.xml` and `/llms.txt` all return 200.
`/sitemap.xml` now carries 11 URLs (home, `/guides`, 4 product pages, 5 guides).

## Quality gate

Run over `billing/src/content.js` and over the six pages fetched from production
(`/tmp/live.html`, 6 documents concatenated):

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer' -> 0
    grep -c $'—' (em dash)                                                -> 0
    grep -cP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' (emoji)                  -> 0
    grep -nP '[^\x00-\x7F]' billing/src/content.js (any non-ASCII)             -> no match
    grep -c 'Built by <a' /tmp/live.html                                       -> 6
    grep -c 'FAQPage' /tmp/live.html                                           -> 5

One banned word was caught before deploy ("unlocks all four servers") and rewritten to "covers all four
servers". One meta description measured 157 characters and was cut to 147, because the injection slices
at 155 and would otherwise have truncated it mid-word.

## Deploy and submission

    cd billing && npm test                 -> 18 pass, 0 fail
    wrangler deploy                        -> Version 5b007a9b-29bc-42c1-ab29-cbb2122108e3, 106.22 KiB
    POST https://api.indexnow.org/IndexNow -> HTTP 200 (5 URLs: /guides plus 4 guides)
    GET  https://api.indexnow.org/IndexNow -> HTTP 200 (the 6th URL, price-drop-alerts-with-claude)

Key `22fad93b71a88e2e60acae203c4288ae`, keyLocation
`https://mcp.zovo.one/22fad93b71a88e2e60acae203c4288ae.txt`, which returns 200.

Zero paid API calls. No external key beyond the Cloudflare deploy credentials already in use.

## Content sourcing

Every measured claim in the guides comes from `docs/USER_VALUE.md` or from the server source, not from
invention:

- Time tracker: timer start, timer stop and the forgotten-entry log each ran in one tool call
  (8.6 s, 9.4 s, 10.0 s). The weekly billing question took three calls, and the guide says so.
- Invoice: 12 h at 90 EUR plus a 300 EUR setup with 23% VAT gives 1380.00 + 317.40 = 1697.40 EUR, in
  two tool calls including the PDF render.
- Spreadsheet: `headerRow=2` found past a title and a blank row on a 3-sheet, 400-row file; the group-by
  ranking that used to take 5 calls and 71 s via a python fallback is now one `sheet_query` call.
- Price tracker: 5 of 12 real retailer URLs extracted correctly (41.7%); 5 bot walls at HTTP 403, 1
  timeout, 1 redirect onto a category page. The guide names the shops and states plainly that nothing
  polls in the background.

The fixed defects (currency on `entry_add`, project name reconciliation, the refusing write cap, the
redirect check, free `alerts_pending`) are described as fixed, because the shipped source has them.

## Insight

The honest paragraphs are the ones with search value. "5 of 12 retailers block bots" and "there is no
background job" are exactly the queries a person types before they buy a price watcher, and no
competitor page answers them. Writing the failure list gave the price-tracker guide the highest word
count and the most specific long-tail surface of the five.
