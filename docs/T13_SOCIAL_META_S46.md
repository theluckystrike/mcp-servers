# T13: Social meta tags and JSON-LD schema on the mcp.zovo.one worker

Track: S46. Additive only. No copy rewrites, no new deps, content.js data untouched.

## 1. Audit: OG / meta description / canonical coverage by handler

The worker renders every page through the shared `page()` helper (head contains charset,
viewport, title, and now Twitter Card fallback). Full social metadata (og, meta description,
canonical) is injected per handler via `.replace("</title>", "</title>" + meta)`. The
`og()` helper lives at `billing/src/index.js:357`.

Handlers that DO emit OG tags (via `og()`):

| Handler path | Line | OG hits |
|---|---|---|
| `/s/<id>` product | 1235 | og ✓ |
| `/guides` index | 1287 | og ✓ |
| `/guides/<slug>` | 1314 | og ✓ |
| `/compare` index | 1344 | og ✓ |
| `/compare/<slug>` | 1359 | og ✓ |
| `/setup`, `/setup/<slug>` | 1392 | og ✓ |

Handlers MISSING OG / canonical / description:

| Handler path | Line | meta description | canonical | OG | JSON-LD |
|---|---|---|---|---|---|
| `/` home | 524 | ✓ | ✓ | missing | SoftwareApplication + ItemList |
| `/bundle` | 623 | ✓ | ✓ | missing | Product/Offer |
| `/changelog` | 671 | ✓ | ✓ | missing | none |
| `/privacy` | 1517 | ✓ | **missing** | missing | none |

Availability routes (`/health`, `/robots.txt`, `/sitemap.xml`, `.well-known/*`, `/favicon`,
`/llms.txt`, `/webhook`, `/success`, `/recover`, `/verify`, `/bound`, `/stats/clicks`) are
not human-facing HTML index pages and are out of scope. **No og:image exists anywhere on the
site** (confirmed by grep for `og:image` across `billing/src/`). There is **no `/search`
route** (confirmed by enumerating every `path ===` branch in the router). `/robots.txt` does
not expose a search sitemap either.

## 2. Changes made

All additive; nothing existing removed.

1. **Twitter Card via the shared helpers** (`billing/src/index.js`):
   - `og()` helper (line ~357): now returns its five existing OG meta tags unchanged, plus
     `twitter:card` = summary, `twitter:title`, and `twitter:description`. Because no
     `og:image` exists, the card type is always `summary`, never `summary_large_image`.
   - `page()` helper (line ~445): now emits a universal `twitter:card` = summary and
     `twitter:title` (the page title) as a fallback. This means every HTML page rendered
     through the shell carries a Twitter card even when it does not call `og()` (home,
     bundle, changelog, privacy). On OG pages the richer `og()`-level twitter:title and
     twitter:description repeat the same two harmless values.
   - Existing OG tags untouched.

2. **Organization + WebSite JSON-LD on the home page** (`billing/src/index.js`, `home()`
   `ld` array around line 505): two new schema.org objects appended to the existing
   `SoftwareApplication` and `ItemList` entries, both with `@context` `https://schema.org`,
   `url` `https://mcp.zovo.one/`, and the author/publisher pointed at the
   `https://github.com/theluckystrike` account already used across the page. **No
   SearchAction block**: the worker has no real `/search` route, so emitting one would be a
   broken signal.

3. **Honesty-gate count** (`billing/src/index.js:241`): `BILLING_TEST_COUNT` updated from 142
   to 148 because `checkout-r1.test.mjs` counts declared `test(` blocks on disk and fails if
   the home-page figure disagrees. This is the derived measured figure the gate enforces, not
   a prose rewrite.

4. **New regression tests** (`billing/test/t13-social-meta.test.mjs`): 6 tests asserting
   Organization JSON-LD, WebSite JSON-LD, no SearchAction, twitter:card summary on a sample
   of rendered pages, additive-only OG retention, and no em-dash in the new markup.

## 3. Test evidence

From repo root:

```
node --test billing/test/
...
1..158
# tests 158
# suites 0
# pass 158
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 752.068083
```

Baseline was 152 passing before this round. 158 = 152 + 6 new. All green.

## 4. Files touched

- `billing/src/index.js` (edit): `og()` helper Twitter Card, `page()` helper Twitter Card
  fallback, home `ld` array Organization + WebSite (no SearchAction), `BILLING_TEST_COUNT` 142
  to 148.
- `billing/test/t13-social-meta.test.mjs` (new): 6 regression tests.

Verified in house style: no em-dashes, no hype, no new dependencies, content.js data
unchanged, additive only. No commit made; leaf does not deploy.