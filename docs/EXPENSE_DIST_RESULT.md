# Expense tracker distribution: Docker MCP catalog, Cline marketplace, guide

status: DONE

evidence:

Docker MCP catalog (docker/mcp-registry PR #4892, fork theluckystrike/mcp-registry branch
add-theluckystrike-mcp-servers, clone at /private/tmp/docker-mcp-registry, already present from the
earlier four-server submission).
- Added `servers/expense-tracker/server.yaml` in the same shape as the four existing entries: category
  finance, `dockerfile: servers/expense-tracker/Dockerfile`, no `directory` key (root build context, same
  reasoning as the other four: `@theluckystrike/mcp-license` lives outside a per-server context), commit
  pinned to `d82c6132861779083f0949c03c274dcedfc89c61` (origin/main HEAD of theluckystrike/mcp-servers at
  the time), icon URL pinned to the same commit.
- `servers/expense-tracker/Dockerfile` in the repo was already root-context multi-stage (matches the other
  four), no edit needed.
- `tools.json` generated from a live `tools/list` call against `servers/expense-tracker/dist/index.js`
  over stdio JSON-RPC: 12 tools (expense_add, expense_list, expense_update, expense_delete,
  receipt_attach, category_rules, expense_summary, mileage_add, expense_export, expense_to_invoice,
  license_status, license_activate), converted from each tool's inputSchema.properties into the
  `{name, description, arguments:[{name,type,desc}]}` shape used by the four existing tools.json files.
- `go run ./cmd/validate -name expense-tracker`: 11/11 green (Name, Directory, Title, YAML formatting,
  Commit pinned, Secrets, Config env, License, Icon, Remote skipped, OAuth dynamic).
- Committed and pushed to the fork branch: commit `cb3a862` "Add expense-tracker server",
  `a7ecc45..cb3a862 add-theluckystrike-mcp-servers -> add-theluckystrike-mcp-servers`. PR #4892 updates
  automatically from the branch. Did not run prettier on the tree (it reformatted ~40 unrelated entries
  the first time, per the earlier RESULT).

Cline marketplace (cline/mcp-marketplace), same issue template as 2397-2400.
- Issue created: https://github.com/cline/mcp-marketplace/issues/2401
- Repo URL https://github.com/theluckystrike/mcp-servers/tree/main/servers/expense-tracker, logo
  https://raw.githubusercontent.com/theluckystrike/mcp-servers/main/assets/expense-tracker-logo.png,
  llms-install.md referenced. Same honest-checkbox pattern as the other four: "Cline installed it from the
  README" left unchecked because the npm package is not published, "server is stable" checked. Free-tier
  limits quoted from the README table (30-day list/summary history, capped projects/rules/export rows)
  rather than a made-up number.

Guide: `/guides/expense-tracking-in-claude`.
- Added to `billing/src/content.js` GUIDES: title "Log expenses and mileage in Claude, split VAT, rebill
  to an invoice", 8 H2 sections, 5 FAQ pairs, 1051 words of rendered text, meta description 152 characters
  (under the 155-char slice the route applies).
- No change needed in `billing/src/index.js`: `/guides`, `/sitemap.xml` and `/llms.txt` are all generated
  from `Object.keys(GUIDES)`, so the new slug appeared automatically.
- Worked examples, matching the ones specified: 61.50 EUR gross at 23% VAT splits to net 50.00 EUR + VAT
  11.50 EUR (`net = round(gross*100/(100+rate))`); 45 km in Poland at the built-in 1.15 PLN/km rate is
  51.75 PLN. The rebill section explains why `expense_to_invoice` sends the **net** amount as `unit_price`
  with the original `tax_rate`, so `invoice_create` computes the VAT once instead of taxing an
  already-VAT-inclusive gross a second time.
- Internal links present: `/s/expense-tracker`, `/s/invoice`, `/s/time-tracker`, plus
  `/guides/invoice-pdf-from-chat`, `/guides/track-time-in-claude-code`, `/guides/mcp-server-free-vs-pro`.
- `GUIDE_INDEX.description` updated to mention the new guide (146 chars).
- `cd billing && npm test` -> 18 pass, 0 fail.
- `wrangler deploy` -> Version 0827244d-66f1-406a-8cef-160bd58841d9, 162.81 KiB.
- Deployed-page checks (cache-busted query string, because the CDN had cached a pre-deploy 404 for the new
  URL under a 3600s cache-control and served it as HTTP 200 to a plain curl): title, headline and FAQPage
  JSON-LD present, 1667 words of rendered text on the live page. `/guides`, `/sitemap.xml` and `/llms.txt`
  each contain `expense-tracking-in-claude` once when re-fetched with a cache buster.
- Quality grep on the live page, all zero: banned hype words
  (seamless|powerful|effortless|unlock|supercharge|game-changer), em dash, emoji range. `Built by <a` count
  1.
- IndexNow: `POST https://api.indexnow.org/IndexNow` with key `22fad93b71a88e2e60acae203c4288ae`
  (keyLocation `https://mcp.zovo.one/22fad93b71a88e2e60acae203c4288ae.txt`, verified 200) for
  `/guides/expense-tracking-in-claude`, `/guides`, `/sitemap.xml` -> HTTP 200.

data/distribution.json: `docker-mcp-catalog` and `cline-marketplace` surface notes extended with the
expense-tracker PR/issue references; `guides` surface note updated to 6 guides / 12 sitemap URLs;
`per_server.expense-tracker` added with `github: published`, `registry: pending: v0.2.0`,
`docker-mcp-catalog: submitted`, `cline-marketplace: submitted`, plus the same not-applicable/blocked/dead
rows the other four servers carry for surfaces expense-tracker was never submitted to (it was not part of
the mcpservers.org / mcpmarket.com / awesome-mcp-servers batches).

Paid surfaces: none encountered; nothing skipped beyond the pre-existing "skipped: paid" rows already in
the file (mcp.so).

artifacts:
- /Users/mike/mcp-servers/billing/src/content.js (GUIDES["expense-tracking-in-claude"], GUIDE_INDEX)
- /Users/mike/mcp-servers/data/distribution.json
- /Users/mike/mcp-servers/docs/EXPENSE_DIST_RESULT.md (this file)
- /private/tmp/docker-mcp-registry servers/expense-tracker/{server.yaml,tools.json}, pushed to
  theluckystrike/mcp-registry branch add-theluckystrike-mcp-servers, commit cb3a862
- Cline issue: https://github.com/cline/mcp-marketplace/issues/2401
- Docker PR (updated in place): https://github.com/docker/mcp-registry/pull/4892
- Live guide: https://mcp.zovo.one/guides/expense-tracking-in-claude

cost: 27 wall minutes

failures:
- The production CDN cache-control (`public, max-age=3600`) meant the first post-deploy curl to the new
  guide URL returned a cached pre-deploy 404 with an HTTP 200 status line, because Cloudflare had already
  cached the 404 response body under that path from an earlier check in this same session. A query-string
  cache buster (`?cb=<timestamp>`) confirmed the real deployed page and JSON-LD.
- Guide word count landed at 1051, slightly over the 700-1000 target quoted in the brief; trimmed two
  sentences but left the rebill section (the load-bearing double-tax explanation and the worked example)
  at full length rather than cutting it for a round number. The five existing guides range 853-963.
- `servers/expense-tracker/src/index.ts` and `README.md` were being edited by another agent concurrently
  (adding `expense_settings` and ReDoS-guarded category rules) while this task ran; those files were left
  untouched, are not part of the commit made here, and the `tools.json` generated for the Docker PR
  reflects the tool set at the pinned commit `d82c613`, not the uncommitted in-flight changes.

insight: The route-derived `/guides`, `/sitemap.xml` and `/llms.txt` (built from `Object.keys(GUIDES)`)
meant zero changes to `billing/src/index.js` were needed to add a sixth guide; the only place content and
plumbing could drift apart was the CDN cache on the individual guide URL, not the generation code.
