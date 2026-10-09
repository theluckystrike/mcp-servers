# s20261009 — SEO fixes on mcp.zovo.one storefront

STATUS: in progress

## Scope found
- OG + twitter card tags: ALREADY PRESENT on all /s/<id> pages (og() helper in billing/src/index.js). Verified live — no work needed.
- Sitemap lastmod: ALREADY PRESENT on all URLs incl. /s/* (lastmod 2026-09-28). Verified live — no work needed.
- Weak h1s: 39 of 54 /s/ pages have h1 = bare package name (e.g. `<h1>mcp-price-tracker</h1>`). Root cause: servers/<id>/README.md first heading is the package name; scripts/build-pages.mjs renders it verbatim. FIX: build-pages.mjs replaces a package-name h1 with the facts.json tagline for that server.

## Before evidence (live, 2026-10-09)
- /s/price-tracker meta: og:title "MCP Price Tracker", twitter:card present (x2 occurrences incl. fallback).
- /s/price-tracker h1: `<h1>mcp-price-tracker</h1>`  ← weak
- sitemap: `<loc>https://mcp.zovo.one/s/price-tracker</loc><lastmod>2026-09-28</lastmod>`

## Fix
- scripts/build-pages.mjs: h1 upgrade rule (see below)

## After evidence (post-deploy)
- /s/price-tracker h1: "Check and watch product prices on ordinary shop pages." (was mcp-price-tracker)
- Spot-check live: timezone, clauses, quotes all serve tagline h1s. Deploy fd80b59f.

## Verification
- Orchestrator verified live h1s + sitemap contains price-tracker + monitor PASS on fd80b59f.
