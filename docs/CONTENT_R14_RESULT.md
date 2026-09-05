# Content round 14: a standalone /bundle page - 2026-09-05

status: DONE

## What shipped

- `GET /bundle` in `billing/src/index.js`: title "Nineteen MCP servers for Claude, one $39
  key", a table of all nineteen servers (name linking `/s/<id>`, one-line tagline from
  `PAGES[id].tagline`, free tier in about five words from a new `FREE_FIVE_WORDS` map),
  the price math computed from `PRODUCTS` (19 x $19 = $361, bundle $39, saving $322 via
  the existing `SERVER_COUNT`/`BUNDLE_SAVING_USD` exports, not retyped), three ways to
  start (connect by URL via `/mcp/connect`, `.mcpb` from the GitHub release, npx), how the
  key arrives (rendered once on `/success`, hosted tenants bound automatically, per
  `docs/CHECKOUT_AUDIT.md`), two identical CTAs to `/buy/bundle?src=store.bundle`, a
  `Product`/`Offer` JSON-LD block, and a meta description under 160 chars.
- Home hero (`home()`): one added sentence, "See the full table and price math at
  `/bundle`."
- `scripts/build-pages.mjs`: new `addBundleCta(html, id)`. Every server page generated
  from a README now ends with "Or the nineteen-server bundle for $39", linking
  `/buy/bundle?src=store.s.<id>.bundle`. It tries to fold the sentence into the README's
  own "Get Pro" paragraph first, and falls back to a standalone paragraph when a README
  has no `/buy` line of its own (true for time-tracker, which has no Get Pro line at all -
  confirmed by reading its README before writing the fallback). `billing/src/pages.js`
  regenerated; all 19 pages carry the tagged link, verified in a test and by curl.
- `/sitemap.xml`: `/bundle` added to the hardcoded URL array.
- `/llms.txt`: one added line, `- [Nineteen-server bundle, $39 lifetime](https://mcp.zovo.one/bundle): saves $322 against buying all 19 singly`.
- `billing/test/store-src.test.mjs`: the src-tag regex for generated pages was
  `store\.s\.[a-z0-9-]+` (no dot allowed), which the new `store.s.<id>.bundle` tag would
  have failed. Widened to `store\.s\.[a-z0-9-]+(?:\.bundle)?` rather than loosened past
  what the two real shapes need.
- `billing/test/bundle.test.mjs` (new, 8 tests): the route exists, the page's title/price
  math/CTA text, all 19 `/s/<id>` row links present, meta description length, the
  Product/Offer JSON-LD shape, sitemap and llms.txt both cover `/bundle`, every generated
  page's CTA carries the tagged bundle link, and the home hero links `/bundle`.

## Why a separate page rather than expanding the home table

The home page's price table already lists all 19 servers with free/pro text; `/bundle`
exists to be the thing a cap-message cross-sell link or a Stripe `custom_text.submit`
link can point at instead of the whole storefront, per `docs/CHECKOUT_AUDIT.md`'s finding
that the bundle math was previously visible nowhere a buyer could act on it before paying.
It reuses `PAGES[id].tagline` (one sentence per server, already curated for `/llms.txt`)
rather than the longer `PRODUCTS[id].desc`, so the table stays scannable at nineteen rows.

## Free-tier five-word summaries

Hand-written in `FREE_FIVE_WORDS`, each checked against `data/facts.json`
`servers.<id>.free` (the full sentence), not a mechanical truncation of it - a naive
first-five-words cut of several of them (e.g. spreadsheet, quotes) would have chopped
mid-clause and lost the actual limit number.

## Quality gate

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|revolutionary|blazing|cutting-edge|leverage' billing/src/index.js scripts/build-pages.mjs -> 0
    grep -cP '\xe2\x80\x94' billing/src/index.js scripts/build-pages.mjs                                                                                        -> 0
    grep -cP '[^\x00-\x7F]' billing/src/index.js scripts/build-pages.mjs (non-ASCII, catches emoji)                                                             -> 0
    node --check billing/src/index.js                                                                                                                           -> syntax OK

## Verification

    cd billing && npm test    -> 53 pass, 0 fail (was 45; +8 for bundle.test.mjs)
    wrangler deploy           -> Version 77e4becf-3e45-4511-b002-3afcd440e4f7

    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/bundle              -> 200
    curl -s https://mcp.zovo.one/bundle | grep -o '<title>[^<]*</title>'            -> "Nineteen MCP servers for Claude, one $39 key"
    curl -s https://mcp.zovo.one/bundle | grep -o 'href="/buy/bundle?src=store.bundle"' -> present
    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/s/invoice           -> 200
    curl -s https://mcp.zovo.one/s/invoice | grep -o 'href="https://mcp.zovo.one/buy/bundle?src=store.s.invoice.bundle"' -> present
    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/sitemap.xml         -> 200
    curl -s https://mcp.zovo.one/sitemap.xml | grep -o '<loc>https://mcp.zovo.one/bundle</loc>' -> present
    curl -s https://mcp.zovo.one/llms.txt | grep -o 'Nineteen-server bundle.*bundle'            -> present

IndexNow:

    POST https://api.indexnow.org/IndexNow (key from data/indexnow.key,
      urlList ["https://mcp.zovo.one/bundle", "https://mcp.zovo.one/"]) -> HTTP 200

## Content sourcing

Every figure traces to a file already in the repo:

- `billing/src/index.js` `PRODUCTS`, `SERVER_COUNT`, `BUNDLE_SAVING_USD` for the
  nineteen-server, $361/$39/$322 math (unchanged formula from `docs/CHECKOUT_AUDIT.md`'s
  round, only rendered on a new page).
- `billing/src/pages.js` (generated from `data/facts.json` and `servers/*/README.md`) for
  every server's tagline.
- `data/facts.json` `servers.<id>.free` for the five-word free-tier summaries.
- `docs/CHECKOUT_AUDIT.md` for "how the key arrives" - rendered once on `/success`,
  hosted tenants bound automatically.
- `billing/src/setup.js` for the "connect by URL, no headers" wording reused on this page.

Zero paid API calls.
