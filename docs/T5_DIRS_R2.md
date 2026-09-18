# T5 — Directory Sweep R2 Execution

STATUS: complete

## Scope
Execute R2 sweep: submit theluckystrike/mcp-servers to top free MCP directories
identified in the R1 census. $0 budget, no new accounts, no forks created.
Max 3 submissions.

## Method
For each candidate: (1) verify the submission mechanism actually exists
(web_extract / curl the submit page), (2) verify absence of any existing
theluckystrike/mcp-servers listing (positive control), (3) submit only where
the mechanism is fully automatable with $0 and no new account.

## Candidates and verdicts
| # | Directory | Mechanism found | Automatable $0/no-account? | Verdict |
|---|-----------|-----------------|----------------------------|---------|
| 1 | mcpmux.com | GitHub PR to mcpmux/mcp-servers (CONTRIBUTING.md: fork → `servers/<id>.json` → `pnpm validate` → PR) | YES — gh CLI already authed as theluckystrike | **SUBMITTED (PR #300)** |
| 2 | mcpserver.dev | None exist — `/submit`, `/add-server`, `/submit-server`, `/contribute`, `/add` all 404; `/s/github` is just the GitHub-MCP detail page; `submit-portal.css` asset exists but no public route | NO | SKIP (no mechanism) |
| 3 | claudepluginhub.com | `tools/submit-plugin` page exists but states **"Sign in to submit"** — account-gated | NO | SKIP (account) |
| 4 | awesomeclaude.ai | Aggregator/landing page, no self-serve submit endpoint | NO | SKIP (no mechanism) |
| 5 | mcprepository.com | Auto-indexes from GitHub repos; no submission endpoint | NO | SKIP (auto-index only) |
| 6 | allyourtech.ai | Domain unreachable / not resolving to a directory | NO | SKIP (offline) |
| 7 | clawtools.com | Directify-hosted; requires account signup to submit | NO | SKIP (account) |

## Prior attempt failure (do not repeat)
Previous mcpmux PR attempt failed:
`invalid qualified head ref format theluckystrike:mcp-servers-1:add-community-mcp-invoice`
→ Root cause: head ref must be `<owner>:<branch>` — the fork repo name is NOT
part of the ref. Correct form: `theluckystrike:add-zovo-invoice`.
Verified fork exists first: `gh repo view theluckystrike/mcp-servers-1 --json name`
→ `mcp-servers-1`, `isFork: true`, `parent: mcpmux/mcp-servers`. No new fork created.

## Evidence Log

### E1 — mcpmux fork verification (iteration 5)
```
$ gh repo view theluckystrike/mcp-servers-1 --json name,parent,isFork
{"defaultBranchRef":{"name":"main"},"isFork":true,"name":"mcp-servers-1",
 "parent":{"id":"R_kgDORFYzhA","name":"mcp-servers","owner":{"login":"mcpmux"}}}
```

### E2 — Absence control, mcpmux (iteration 5)
```
$ gh api "search/code?q=theluckystrike+repo:mcpmux/mcp-servers" --jq '.total_count'
0
$ curl -s "https://mcpmux.com/servers/community.theluckystrike" -o /dev/null -w "%{http_code}"
404
```
Absent → safe to submit.

### E3 — mcpmux mechanism confirmed (iteration 5–6)
CONTRIBUTING.md fetched from raw.githubusercontent.com/mcpmux/mcp-servers/main.
Requires: `servers/<id>.json`, `pnpm validate`, `pnpm check-conflicts`,
`git commit -s` (DCO sign-off; CI rejects unsigned commits), then PR.

### E4 — Live transport probe for the submitted server (iteration 7)
```
$ curl -s https://mcp.zovo.one/s/invoice -o /dev/null -w "%{http_code}"
invoice page:200
$ curl -s -X POST https://mcp.zovo.one/mcp/invoice -H 'Content-Type: application/json' ...
initialize:200
```
Server definition points at a transport verified live.

### E5 — Local validation before push (iteration 9)
```
$ pnpm validate servers/one.zovo-invoice.json
PASS  servers/one.zovo-invoice.json
$ pnpm check-conflicts
No conflicts found across 289 server file(s).
```

### E6 — Signed-off commit pushed to fork (iteration 10)
```
$ git commit -s -m "Add one.zovo-invoice"
[add-zovo-invoice 24aa7c0] Add one.zovo-invoice
 1 file changed, 48 insertions(+)
24aa7c04be31e58940cd4f99d92757643461e56e
Signed-off-by: theluckystrike <theluckystrike@users.noreply.github.com>

$ git push origin add-zovo-invoice
 * [new branch]      add-zovo-invoice -> add-zovo-invoice
```

### E7 — PR OPENED (iterations 11–12) ★ LIVE SUBMISSION
```
$ gh pr create --repo mcpmux/mcp-servers --head theluckystrike:add-zovo-invoice --base main
https://github.com/mcpmux/mcp-servers/pull/300

$ gh pr view 300 --repo mcpmux/mcp-servers --json number,title,state,url,isCrossRepository,mergeable
{"headRefName":"add-zovo-invoice","isCrossRepository":true,"mergeable":"MERGEABLE",
 "number":300,"state":"OPEN","url":"https://github.com/mcpmux/mcp-servers/pull/300"}
```

### E8 — claudepluginhub.com is account-gated (iteration 15)
```
GET https://www.claudepluginhub.com/tools/submit-plugin
  "Sign in to submit your plugin or marketplace."
  "[Sign in to continue](https://www.claudepluginhub.com/signin?redirect=/tools/submit-plugin)"
```
Absence: `plugins?q=theluckystrike` returned only query echoes (4 occurrences),
no theluckystrike plugin slug in results → absent, but unsubmittable without an account.

### E9 — mcpserver.dev has no submission route (iteration 16–17)
```
/s/github        -> 200 (size 69724)  # GitHub MCP server detail page, not a form
/submit          -> 404
/submit-server   -> 404
/add-server      -> 404
/contribute      -> 404
/add             -> 404
/github          -> 404
```
Absence: `mcp-servers?q=theluckystrike` matched only the echoed query param (2).
No automatable mechanism → skipped.

## RESULT

STATUS: complete

### Live submissions (1 of max 3 used)
| Directory | Verifiable URL | State | Submitted at (UTC) |
|-----------|----------------|-------|--------------------|
| mcpmux.com (registry mcpmux/mcp-servers) | https://github.com/mcpmux/mcp-servers/pull/300 | OPEN, MERGEABLE, 1 file / +48 lines | 2026-09-18T08:16:52Z |

Final live verification (`gh pr view 300 --repo mcpmux/mcp-servers --json ...`):
```
{"additions":48,"changedFiles":1,"createdAt":"2026-09-18T08:16:52Z",
 "number":300,"state":"OPEN","url":"https://github.com/mcpmux/mcp-servers/pull/300"}
gh pr diff 300 --name-only -> servers/one.zovo-invoice.json
```

### Submitted definition
- File: `servers/one.zovo-invoice.json`, id `one.zovo-invoice`
- Transport: HTTP, `https://mcp.zovo.one/mcp/invoice` (live probe: `initialize` → 200)
- Local gates passed: `pnpm validate` PASS, `pnpm check-conflicts` → no conflicts (289 files)
- Commit `24aa7c04be31e58940cd4f99d92757643461e56e`, DCO `Signed-off-by` present (CI requirement)

### Skipped (6) — with reason
| Directory | Reason |
|-----------|--------|
| mcpserver.dev | No submission mechanism: /submit, /submit-server, /add-server, /contribute, /add, /github all 404; /s/github is a server detail page |
| claudepluginhub.com | `tools/submit-plugin` explicitly requires sign-in ("Sign in to submit") → account-gated |
| awesomeclaude.ai | Landing/aggregator page, no self-serve submit endpoint |
| mcprepository.com | Auto-indexes from GitHub only; no submission endpoint |
| allyourtech.ai | Domain unreachable / not a live directory |
| clawtools.com | Directify-hosted, requires account signup |

### Budget note
1 of the 3 allowed submissions was used. The remaining 5 candidates were
mechanically verified as not automatable at $0 with no new account, so no
further submissions were possible within the sweep's constraints.

### Prior failure — resolved
The earlier `invalid qualified head ref format theluckystrike:mcp-servers-1:add-community-mcp-invoice`
was caused by including the fork repo name in the head ref. Correct syntax is
`<owner>:<branch>` → `theluckystrike:add-zovo-invoice`. The PR succeeded on the
first attempt with the corrected ref. Fork `theluckystrike/mcp-servers-1`
already existed; no new fork was created.
