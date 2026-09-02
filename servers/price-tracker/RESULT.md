status: DONE

evidence:

```
$ export npm_config_cache=/Users/mike/.npm-cache-local
$ npm install --no-audit --no-fund        # repo root
changed 4 packages in 203ms

$ rm -rf servers/price-tracker/dist && npm run build -w servers/price-tracker
> @theluckystrike/mcp-price-tracker@0.1.0 build
> tsc -p tsconfig.json && node -e "import('node:fs').then(f=>f.chmodSync('dist/index.js',0o755))"
npm run build -w servers/price-tracker  1.71s user 0.08s system 232% cpu 0.768 total

$ npm test -w servers/price-tracker
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1371.004708
npm test -w servers/price-tracker  0.86s user 0.14s system 66% cpu 1.492 total
```

Test breakdown: 13 extraction tests (test/extract.test.mjs) + 5 stdio tests (test/smoke.test.mjs).
Smoke tests spawn dist/index.js and drive JSON-RPC over stdio against a node:http server started
inside the test (no network), with XDG_DATA_HOME / XDG_CONFIG_HOME in mkdtemp dirs.
Pro key generated in-test by `node /Users/mike/mcp-servers/scripts/sign-license.mjs price-tracker`.

Live-page check (public pages, zero paid calls):

```
$ node -e '... fetchPage + extractPrice ...'
https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html
  -> {"price":"51.77","currency":"GBP","title":"A Light in the Attic | Books to Scrape - Sandbox","source":"regex-fallback"}
https://www.gutenberg.org/ebooks/1342 -> null
```

artifacts:
- /Users/mike/mcp-servers/servers/price-tracker/src/index.ts
- /Users/mike/mcp-servers/servers/price-tracker/src/extract.ts
- /Users/mike/mcp-servers/servers/price-tracker/src/fetch.ts
- /Users/mike/mcp-servers/servers/price-tracker/src/store.ts
- /Users/mike/mcp-servers/servers/price-tracker/test/extract.test.mjs
- /Users/mike/mcp-servers/servers/price-tracker/test/smoke.test.mjs
- /Users/mike/mcp-servers/servers/price-tracker/package.json
- /Users/mike/mcp-servers/servers/price-tracker/tsconfig.json
- /Users/mike/mcp-servers/servers/price-tracker/README.md
- /Users/mike/mcp-servers/servers/price-tracker/LICENSE
- /Users/mike/mcp-servers/servers/price-tracker/server.json
- /Users/mike/mcp-servers/servers/price-tracker/smithery.yaml
- /Users/mike/mcp-servers/servers/price-tracker/Dockerfile
- /Users/mike/mcp-servers/servers/price-tracker/RESULT.md

Storage: ${XDG_DATA_HOME:-~/.local/share}/mcp-servers/price-tracker/watches.json, atomic tmp+rename.
Prices are decimal strings in the major unit, "." decimal separator, no grouping ("1299.00").
Timestamps ISO 8601 UTC.

cost: 21 wall minutes

failures:
- First `npm install` at repo root failed EDUPLICATEWORKSPACE: packages/mcp-license and
  servers/time-tracker both reported the name @theluckystrike/mcp-time-tracker. A concurrent agent
  was mid-write on a package.json owned by it. No edit made; the same command 40s later succeeded.
- No other failures. Build and both test files passed on first run.

insight:
Structured price data is not the common case on the open web. Of the extraction paths, only
JSON-LD, Open Graph and microdata are exact; the live check against books.toscrape.com resolved
through the regex fallback, because the page publishes no product schema at all. The fallback
therefore carries real weight and its selection rule matters: picking the largest currency-adjacent
number in the visible text is what makes it survive pages that also print "Free shipping over $50"
and trade-in credits above the fold. A first-match rule would have returned the shipping threshold.
The second measured consequence is currency: symbol-only pages give no ISO code, so `$` is resolved
against the URL's ccTLD (.ca -> CAD, .au -> AUD) rather than defaulting to USD blindly.
