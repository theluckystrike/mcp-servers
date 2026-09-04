# Estate backlinks round 3 - 2026-09-04

Goal: one crawlable HTML anchor to `https://mcp.zovo.one`, anchor text **MCP servers for Claude**,
in the footer of worthmyclaim.com and dscrradar.com. Round 2 (`BACKLINKS_R2_RESULT.md`) skipped both:
their GitHub repos are behind the live sites, and deploying either repo as-is would have deleted live
pages (`/personal-injury-settlement-formula/`, `/wrongful-death-settlement-calculator/` on worthmyclaim;
`/rental-vacancy-by-county/` on dscrradar).

This round used a **live-mirror deploy** instead of the repo: crawl every URL the live sitemap lists
plus every locally-referenced asset, patch only the footer, and redeploy that mirror with the site's
own documented Cloudflare Workers mechanism. No repo commit, no repo push, no code change. Everything
below happened in fresh `/private/tmp/blr3` directories; nothing was written under `~/Desktop` or any
iCloud path.

## Summary

| Site | Verdict | Pages | Anchor |
|---|---|---|---|
| worthmyclaim.com | SHIPPED (live mirror deploy) | 30 sitemap URLs | in "About" footer column |
| dscrradar.com | SHIPPED (live mirror deploy) | 50 sitemap URLs | in "Site" footer column |

Target verified before any patch: `https://mcp.zovo.one` returns 200.

## Method

1. **Sitemap discovery.** `sitemap.xml` 404s on both sites; the real path is `sitemap-index.xml` ->
   `sitemap-0.xml` (from `robots.txt`). worthmyclaim: 30 URLs, dscrradar: 50 URLs, both already
   containing the pages missing from their GitHub repos, confirming the live site (not the repo) is
   the source of truth.
2. **Full mirror, not just HTML.** Every sitemap URL was fetched with `curl` into a directory tree
   mirroring the URL path (`/slug/` -> `slug/index.html`). Every local asset referenced by those pages
   (`/_astro/*.css`, `/_astro/*.js`, `/favicon.svg`, `og-default.png`, `robots.txt`, `sitemap-index.xml`,
   `sitemap-0.xml`, `404`) was then extracted by grep across all mirrored HTML and fetched too — a
   plain page mirror without these would have shipped a site with broken CSS/JS on redeploy. Final
   mirror: worthmyclaim 42 files, dscrradar 64 files, both matching a `wrangler deploy --dry-run`
   scan of the same directory (73/115 filesystem entries including subdirectories, consistent).
3. **Deploy mechanism confirmed from the repo, not assumed.** Both `wrangler.toml` files declare
   Cloudflare Workers Static Assets (`[assets] directory = "./dist"`), not Pages — both accounts are at
   the 100/100 Pages project cap, matching memory. worthmyclaim additionally runs a thin
   `src/worker.js` (from the repo, unmodified) that only adds security headers and short-circuits the
   GSC verification file; its header set was diffed against a live `curl -I` and matched exactly, so
   using the repo's `worker.js` reproduces live behaviour. dscrradar has no worker script, assets-only.
   `wrangler deploy --dry-run` on each patched mirror reported a **total upload of ~2 KiB and ~0.3 KiB
   respectively** before the real deploy — i.e. nearly every byte in the mirror already existed on
   Cloudflare's asset store under the same content hash, which is independent confirmation the mirror
   is byte-identical to live except for the intended footer edit.
4. **Footer patch, single careful text replace.** worthmyclaim: appended after
   `<li><a href="/disclaimer/">Disclaimer</a></li>` in the "About" column (all 30 files carried this
   exact string once). dscrradar: appended after
   `<li><a href="mailto:hello@dscrradar.com">Contact</a></li>` in the "Site" column (all 50 files
   carried this exact string once). Anchor: `<li><a href="https://mcp.zovo.one" target="_blank"
   rel="noopener">MCP servers for Claude</a></li>`. A Python replace asserted `old` occurred exactly
   once per file and that `<!--`/`-->` counts were unchanged and balanced before writing, per the
   [[html-comment-terminator-corruption]] guard. Verified after: exactly one `MCP servers for Claude`
   match per file on both sites (30/30, 50/50), and home-page byte length grew by exactly 98 bytes on
   both sites (23,839 -> 23,937 worthmyclaim; 22,405 -> 22,503 dscrradar) — precisely the inserted
   string, nothing else moved.
5. **Deploy.** `CLOUDFLARE_API_TOKEN` from `~/.zshenv`, `npx wrangler@4.80.0 deploy` run from a
   directory holding the repo's `wrangler.toml` (+ `src/worker.js` for worthmyclaim) and the patched
   mirror as `dist/`.
   - worthmyclaim: `Uploaded 31 files (11 already uploaded)`. Worker version `d790f16f-49d4-4371-a5f1-0c35d798599c`.
   - dscrradar: `Uploaded 50 files (14 already uploaded)`. Worker version `990fdcbf-e0ea-4c31-8466-59368878a3e3`.
6. **Live verification.**
   - worthmyclaim: all 30 sitemap URLs HTTP 200; `/personal-injury-settlement-formula/` and
     `/wrongful-death-settlement-calculator/` still HTTP 200; anchor present exactly once on `/` and
     on `/personal-injury-settlement-formula/`; all mirrored assets (5 `_astro` files, favicon,
     og-default.png, sitemap-index.xml) HTTP 200; an unmapped path still correctly 404s.
   - dscrradar: all 50 sitemap URLs HTTP 200; `/rental-vacancy-by-county/` still HTTP 200; anchor
     present exactly once on `/` and on `/rental-vacancy-by-county/`; all mirrored assets (7 `_astro`
     files, favicon, og-default.png, sitemap-index.xml) HTTP 200; an unmapped path still correctly 404s.

No rollback was needed on either site.

## Notes / caveats

- The mirror covers exactly what the sitemap and the HTML itself reference. It does not include any
  URL deliberately excluded from the sitemap (e.g. a Google Search Console HTML-verification file at
  its own literal path) beyond what each repo's worker code already serves; worthmyclaim's
  `GSC_FILE` token is served from code, not a static file, so it needed no separate mirroring.
- The repos (`theluckystrike/worthmyclaim`, `theluckystrike/dscrradar`) were used **only** to read
  `wrangler.toml` and, for worthmyclaim, `src/worker.js` — never built, never committed to, never
  pushed. They remain behind live exactly as before; this round does not fix that drift, it works
  around it for this one footer edit the same way the 08-30 dscrradar sprint did for a full page ship.
- No em dashes, no emoji, and no `--` sequence was introduced or removed by the patch on either site.
