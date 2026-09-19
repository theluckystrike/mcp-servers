# T3 S45: Sitemap + Robots + SEO-Infrastructure Audit and Upgrade

## Scope
Audit and improve crawler-facing infrastructure for https://mcp.zovo.one:
- robots.txt (allows /guides, /s, /setup, /compare)
- sitemap.xml (format, lastmod, validity)
- Per-template SEO markup (canonical, meta description, OpenGraph, JSON-LD)
- Implement missing high-value pieces in billing/src/*.js
- Keep `node --test test/` green (152 baseline)
- Validate live sitemap still parses. No commit/deploy.

## Audit Findings

### 1. robots.txt — PASS, no change needed
Live `https://mcp.zovo.one/robots.txt` (Chrome UA):
```
User-agent: *
Allow: /
Disallow: /buy/
Disallow: /success
Disallow: /recover
Disallow: /verify
Disallow: /bound
Sitemap: https://mcp.zovo.one/sitemap.xml
```
`Allow: /` permits /guides, /s, /setup, /compare. Only checkout/account paths disallowed. Correct.

### 2. sitemap.xml — PASS, no change needed
- **Valid XML** (xmllint: `XML VALID`).
- **193 URLs**, all 193 carry `<lastmod>`.
- **lastmod is stable & deterministic**: generated in `billing/src/index.js` (~line 1390) using `siteDate` = newest CHANGELOG release date (see comment at line 399: "the same honest site-wide value the sitemap lastmod"). This is NOT build-time-now, so no churn. All 193 currently `2026-09-17`. Correct approach — no change required.
- Sitemap includes /, /mcp/connect, /bundle, /changelog, /guides, /compare, /privacy, all /s/*, all /guides/*, all /compare/*, and shallow /setup/* URLs.

### 3. Per-template SEO markup audit (live, Chrome UA)

| Template | canonical | meta desc | OpenGraph | JSON-LD |
|---|---|---|---|---|
| /guides (index) | ✅ | ✅ | ❌ | ❌ |
| /guides/{slug} | ✅ | ✅ | ❌ | ✅ TechArticle + FAQPage |
| /compare (index) | ✅ | ✅ | ❌ | ❌ |
| /compare/{slug} | ✅ | ✅ | ❌ | ✅ TechArticle + FAQPage |
| /s/{slug} | ✅ | ✅ | ❌ | ✅ SoftwareApplication + Offer + Person |
| /setup (index) | ✅ | ✅ | ❌ | ✅ TechArticle + Organization + Person |
| /setup/{client}/{server} | ✅ | ✅ | ❌ | ✅ (noindex,follow) |

canonical + meta description + JSON-LD already present everywhere. lastmod already present. No stuffing needed.

## Changes Implemented (billing/src/index.js)

Added an `og()` helper (after `esc()`, ~line 349) that emits og:title, og:description, og:url, og:type, og:site_name. No og:image (site has no per-page image asset; fabricating one would be worse than omitting). Injected into all 6 handlers:

- `/guides` index → og type `website`
- `/guides/{slug}` → og type `article`
- `/compare` index → og type `website`
- `/compare/{slug}` → og type `article`
- `/s/{slug}` → og type `product`
- `/setup` (index + client/server) → og type `article`

Diff: `billing/src/index.js | 24 ++++++++------` (18 insertions, 6 deletions).

## Verification
- `cd billing && node --test test/` → **152 pass, 0 fail** (baseline 152, green).
- Live sitemap re-validated: `xmllint --noout` → `XML VALID`, 193 URLs, 193 lastmod.
- `og()` helper output verified via node snippet (valid HTML meta tags).
- No commit, no deploy (per contract).

## Files
- Modified: `billing/src/index.js` (added `og()` helper + injected OG tags into 6 handlers)
- Created: `docs/T3_SITEMAP_S45.md` (this file)
