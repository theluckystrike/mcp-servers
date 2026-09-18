# T4 mcpmux PR #300 follow-up (R1)

STATUS: complete

## Executive summary
PR#300 (`mcpmux/mcp-servers`, "Add one.zovo-invoice") is **OPEN and unreviewed** — not merged. Per the task's decision rule, second-batch registry entries (`one.zovo-office-suite.json`, `one.zovo-bill-of-sale.json`) were **NOT prepared**; their exact schema was instead documented from the PR's pending diff for a zero-turn handoff when the PR merges. Census: the mcpmux registry currently contains **0 zovo entries** (289 files total in `servers/`, 288 `.json` + `.gitkeep`), consistent with #300 being unmerged. The mcpmux.com front-end is a Next.js SPA (HTTP 200 root); its listing routes 404 under curl as expected for client-side-rendered pages.

## 1. PR #300 exact state
Produced by: `gh pr view 300 --repo mcpmux/mcp-servers --json state,mergeable,reviews,comments,statusCheckRollup`
```
{"comments":[],"mergeable":"MERGEABLE","reviews":[],"state":"OPEN","statusCheckRollup":[]}
```
- state: **OPEN**
- mergeable: **MERGEABLE**
- reviews: **none**; comments: **none**; statusCheckRollup: **empty**
- details (`gh pr view 300 ... --json headRefName,additions,deletions,files`):
  - title: "Add one.zovo-invoice"; base `main`; head `add-zovo-invoice`
  - createdAt 2026-09-18T08:16:52Z, +48/−0, single file `servers/one.zovo-invoice.json`

## 2. Second-batch entries prep — DEFERRED (PR not merged)
Rule applied: "If OPEN+unreviewed: do nothing beyond documenting." PR is OPEN, so the branch files `one.zovo-office-suite.json` and `one.zovo-bill-of-sale.json` were **not created** and nothing was fetched/pushed. To keep the next turn zero-inference, the exact target schema was captured from the pending diff (`gh pr diff 300`). Captured schema of `servers/one.zovo-invoice.json` (48 lines):
- `$schema`: `../schemas/server-definition.schema.json`
- `id`: `one.zovo-invoice` (registry id pattern `io.github.theluckystrike/<slug>` in the OFFICIAL registry; mcpmux uses org-scoped `one.zovo-*` ids)
- `name` / `alias` (`zovoinvoice`) / `description` (local stdio + hosted https://mcp.zovo.one/mcp/invoice)
- `schema_version`: `2.1`; `categories` [`productivity`,`file-system`]; `tags` [5]
- `transport`: type `http`, url `https://mcp.zovo.one/mcp/invoice`, metadata.inputs `[]`
- `auth`: type `none`
- `contributor`: name/github `theluckystrike`, url `https://mcp.zovo.one`
- `links`: repository `https://github.com/theluckystrike/mcp-servers`, documentation `https://mcp.zovo.one/s/invoice`
- `platforms` [`all`]; `capabilities`: tools true, resources false, prompts false, read_only_mode false

For the second batch, only `id`/`name`/`alias`/`description`/`transport.url`/`links.documentation` would change (e.g. `one.zovo-office-suite` @ `https://mcp.zovo.one/mcp/office-suite`, `one.zovo-bill-of-sale` @ `https://mcp.zovo.one/mcp/bill-of-sale`). Validation tooling lives in the mcpmux repo (`pnpm validate`, check-conflicts, DCO), not in the local monorepo whose package.json scripts are `build`/`test`/`release:check`/`digest`.

## 3. Census: zovo entries in mcpmux registry
Produced by: `curl https://api.github.com/repos/mcpmux/mcp-servers/contents/servers?per_page=1000` grepped for zovo/luckystrike.
- **0** entries matching `zovo` or `luckystrike` (grep -ci = 0; python parse `'zovo' in name.lower()` = [] for 289 names)
- Total `servers/` files: **289** (288 `.json`, 1 `.gitkeep`)
- Reconciled with PR state: `one.zovo-invoice.json` is absent from the target branch because #300 is unmerged (consistent, no drift).

## 4. mcpmux.com listing probe
Produced by curl with Chrome UA.
- `https://www.mcpmux.com` → **HTTP:000** (DNS/connection fail, www subdomain not resolvable)
- `https://mcpmux.com` → HTTP 301 → **HTTP 200** (951,688 bytes, Next.js SPA; nav to `/features/`, `/docs/`, `/download/`)
- `https://mcpmux.com/invoice`, `/io.github.theluckystrike/invoice`, `/mcp/servers/theluckystrike` → all **HTTP 404**; `https://api.mcpmux.com/v0/servers?search=...` → **HTTP 404**
- Interpretation: mcpmux.com renders listings client-side (SPA), so server-side curl of a listing route 404s even when a server is registered. The GitHub registry file presence is the authoritative source of truth for "listed"; website URL verification via curl is not a valid gate for this estate. (No 403 observed; 404 is the tolerated non-blocking signal here.)

## 5. Next-step recommendation
1. Monitor #300 for merge (manual; no pinging maintainers, no @mentions permitted).
2. On merge, create a local branch in the luckystrike work tree and add `servers/one.zovo-office-suite.json` + `servers/one.zovo-bill-of-sale.json` using the captured schema, changing only id/name/alias/description/transport.url/links.documentation per the office-suite and bill-of-sale hosted endpoints (`https://mcp.zovo.one/mcp/office-suite`, `/mcp/bill-of-sale`). Do NOT push; open a fresh PR from the fork.
3. Easiest merge signal without polling: check the mcpmux `servers/` contents listing for `one.zovo-invoice.json` (the census command above); its appearance == merged.
4. After any future mcpmux submission, rely on GitHub-registry file presence (not the mcpmux.com SPA URL) as the listing-health gate.

## Evidence trail
- 2026-09-18: PR state query (gh), census API listing (curl), mcpmux.com probes (curl), PR diff schema capture (gh pr diff), local package.json scripts read (search_files). All above.