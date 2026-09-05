# Content round 17: version-free office-suite guide slug, redirect the old one - 2026-09-05

status: DONE

## What shipped

Edited `billing/src/content.js`, `billing/src/index.js` (redirect only), `billing/test/guide-redirect.test.mjs` (new), and this result file.

1. The guide `one-install-nineteen-servers-office-suite` in `GUIDES` (`billing/src/content.js`) was
   renamed to the version-free slug `one-install-office-suite`, title changed to "One install, every
   server: the office-suite bundle". The reason this was overdue: `docs/DIST_R13_RESULT.md` had
   already moved the bundle from nineteen children/186 tools to twenty children/198 tools, but the
   slug, title and body still said nineteen and 186, which was left open in that round's "Open, named
   rather than hidden" section rather than half-done there.
2. Current facts in the rewritten guide are stated at their current values, sourced against
   `PRODUCTS.SERVER_COUNT` (20, confirmed by importing `billing/src/index.js` directly) and a live
   `tools/list` read against the built `servers/office-suite/dist/index.js` on 2026-09-05:
   - Twenty servers, twenty config entries, `license_status`/`license_activate` merged from twenty
     pairs to one.
   - **198 tools**, stated with the date it was read (2026-09-05), and the arithmetic in prose
     (twenty license pairs merged to one).
   - **Four** prefixed tools, not two: `invoice_business_set`, `docx_business_set`,
     `expense-tracker_category_rules`, `bank-statement_category_rules`. The live probe found a second
     collision (`category_rules`, between expense-tracker and bank-statement) that the prior guide's
     "exactly two" claim did not carry; both `docs/DIST_R13_RESULT.md` and `docs/USER_VALUE_R17.md`
     say "still two" / "exactly two", which is stale against the current build, not this round's
     source. That is called out in the report below rather than propagated.
   - billing-docs (credit notes and purchase orders) named among the twenty children in the opening
     paragraph, the "When to install single servers instead" section, and the FAQ.
3. The round-17 audit's own six prompts, scores, defects and reach numbers (13/18, 20 calls, 226.5 s,
   5/6 and 3/6 reach, D-R83/84/85) are kept verbatim as a dated measurement rather than rewritten to
   match the current count: every occurrence is now framed as **"measured on 2026-09-04 against the
   nineteen-server build with 186 tools"**, with one added sentence noting the bundle has since grown
   to twenty servers and 198 tools and that growth has not been re-measured against this audit. This
   keeps the past a fact instead of turning it into a guess, the same principle `docs/DIST_R13_RESULT.md`
   states for the office-suite audit sentences ("a stale measurement is a fact about the past").
4. `billing/src/index.js`: added a `GUIDE_REDIRECTS` map with one entry,
   `"one-install-nineteen-servers-office-suite": "one-install-office-suite"`, checked at the top of
   the `/guides/<slug>` route and answered with `Response.redirect(..., 301)` before the normal
   `GUIDES[slug]` lookup runs. No other route logic touched.
5. `/sitemap.xml` and `/llms.txt` needed no code change: both already derive their guide URLs from
   `Object.keys(GUIDES)` / `Object.entries(GUIDES)`, so renaming the key in `content.js` was enough to
   drop the old slug from both and list only the new one. Verified live below.
6. `GUIDE_INDEX.description` (`billing/src/content.js`) already named the bundle generically ("the
   one-install office-suite bundle") with no slug or version number baked in, so it needed no edit.

## Source of every fact

- `PRODUCTS.SERVER_COUNT` in `billing/src/index.js`, read via a direct `import()` of the built module:
  **20**.
- A live `tools/list` against `servers/office-suite/dist/index.js`, fresh `XDG_DATA_HOME`,
  `MCP_LICENSE_KEY=""`, on 2026-09-05: **198 tools total**, four renamed
  (`invoice_business_set`, `docx_business_set`, `expense-tracker_category_rules`,
  `bank-statement_category_rules`); stderr's own summary line separately reports 196 (the
  child-proxied count before the two merged license tools are added back), which is why the guide
  quotes the `tools/list` total (198) and not the stderr line.
- `docs/USER_VALUE_R17.md`: the six prompts, scores, calls, wall-clock seconds, reach percentages and
  D-R83/84/85 descriptions, all kept as the 2026-09-04/186-tool measurement.
- `docs/DIST_R13_RESULT.md`: twenty children, billing-docs added, and the open item naming this guide
  as not yet rewritten.

## Discrepancy found and not smoothed over

`docs/DIST_R13_RESULT.md` and `docs/USER_VALUE_R17.md` both assert the bundle needs to disambiguate
only two tool names. A live probe against the current `servers/office-suite/dist/index.js` build
found four: `expense-tracker` and `bank-statement` both register a tool literally named
`category_rules` (`servers/expense-tracker/src/index.ts:413`, `servers/bank-statement/src/index.ts:396`),
and the office-suite proxy's own stderr line lists all four renames on every start. Both source
sentences predate this and were written when only the `business_set` collision existed, or checked
tool counts without checking rename lists. The rewritten guide states four, matching the live build,
and does not repeat the stale "two" claim as a current fact anywhere; it survives only inside the
sentences explicitly dated 2026-09-04/186-tools, where it was true.

## Quality gate

Run over `billing/src/content.js` and `billing/src/index.js`:

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|revolutionary|blazing|cutting-edge|leverage' -> 0 (both files)
    grep -cP '\xe2\x80\x94' (em dash)                                                              -> 0 (both files)
    grep -cP '[^\x00-\x7F]' (non-ASCII, catches emoji too)                                          -> 0 (both files)
    node --check billing/src/content.js                                                            -> syntax OK
    node --check billing/src/index.js                                                               -> syntax OK
    grep -c "one-install-nineteen-servers-office-suite" billing/src/content.js                      -> 0

## Verification

    cd billing && npm test                                    -> 68 pass, 0 fail (62 prior + 6 new
                                                                   in test/guide-redirect.test.mjs)
    git pull --rebase --autostash                              -> already up to date
    wrangler deploy                                            -> Version dabf1cb5-32f3-47ef-acb1-7486c3b50772

    curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}' https://mcp.zovo.one/guides/one-install-nineteen-servers-office-suite
      -> 301 -> https://mcp.zovo.one/guides/one-install-office-suite
    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/guides/one-install-office-suite
      -> 200

    curl -s https://mcp.zovo.one/sitemap.xml | grep -c one-install-nineteen-servers-office-suite -> 0
    curl -s https://mcp.zovo.one/sitemap.xml | grep -c one-install-office-suite                  -> 1
    curl -s https://mcp.zovo.one/llms.txt    | grep -c one-install-nineteen-servers-office-suite -> 0
    curl -s https://mcp.zovo.one/llms.txt    | grep -c one-install-office-suite                  -> 1

Content spot-checked in the live HTML of the new guide:

    grep -o "198 tools" live -> match
    grep -o "bank-statement_category_rules" live -> match
    grep -o "One install, every server" live -> match

IndexNow:

    POST https://api.indexnow.org/IndexNow (key from data/indexnow.key, one URL:
    https://mcp.zovo.one/guides/one-install-office-suite) -> HTTP 200

## New test

`billing/test/guide-redirect.test.mjs`, 6 assertions:

- `GUIDES` no longer has the old slug key, does have the new one.
- `GET /guides/<old slug>` returns 301 with `Location: https://mcp.zovo.one/guides/<new slug>`.
- `GET /guides/<new slug>` returns 200 and the body contains "198 tools".
- The redirect map is wired at the source level (`GUIDE_REDIRECTS` and the exact old-to-new mapping
  appear in `billing/src/index.js`).
- `/sitemap.xml` never contains the old slug and does contain the new one.
- `/llms.txt` never contains the old slug and does contain the new one.

Zero paid API calls.
