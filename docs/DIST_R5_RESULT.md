# Distribution round 5: pdf, calendar onto Docker MCP catalog + Cline marketplace

status: DONE

evidence:

Docker MCP catalog (docker/mcp-registry PR #4892, fork theluckystrike/mcp-registry branch
add-theluckystrike-mcp-servers, clone reused at /private/tmp/docker-mcp-registry).
- Read `servers/{pdf,calendar}/Dockerfile` in the theluckystrike/mcp-servers repo first: both build
  from the repo root as context (`COPY package.json`, `COPY packages`, `COPY servers`, npm workspaces),
  same shape as the existing eleven entries. calendar additionally builds and copies in
  `@theluckystrike/mcp-timezone` (it reads its time zone and `.ics` engine from that server as a
  library). pdf has no sibling dependency. No `directory` key needed in server.yaml, same reasoning as
  the prior eleven; no Dockerfile is stored in the registry repo itself (only server.yaml + tools.json
  live under `servers/<name>/`, `dockerfile:` in server.yaml points back at the path in
  theluckystrike/mcp-servers).
- Added `servers/{pdf,calendar}/server.yaml`: category productivity for both, `dockerfile:
  servers/<name>/Dockerfile`, `MCP_LICENSE_KEY` optional secret same as all eleven prior entries, commit
  and icon URL both pinned to `75e358fce74fef68c20051209af64f51c917e798` (origin/main HEAD of
  theluckystrike/mcp-servers at task start).
- Took the same commit as an opportunity to repin the eleven existing entries (time-tracker,
  price-tracker, spreadsheet, invoice, expense-tracker, currency, timezone, docx, resume, recurring,
  clauses) from `2f47c581212dcaa080d33e3f04dafefab34c733d` to the same new HEAD, per the instruction to
  keep all thirteen on one commit.
- `tools.json` generated per server from a live `tools/list` call over stdio JSON-RPC against each
  `servers/<name>/dist/index.js` (small Node script driving the initialize / tools/list handshake,
  converting `inputSchema.properties` into the `{name, type, desc}` argument shape used by the existing
  files): pdf 12 tools, calendar 12 tools.
- `go run ./cmd/validate -name <n>` for all 13: 13/13 green each (Name, Directory, Title, YAML
  formatting, Commit is pinned, Secrets, Config env, License, Icon, Remote skipped, OAuth dynamic).
  The prettier step inside validate shells out via `npx`, and the machine's global `~/.npmrc` points
  `cache=` at an unrelated project directory with a corrupted `_npx` cache entry, which broke the very
  first validate call with an `ERR_INVALID_PACKAGE_CONFIG` from a stale `prettier` package.json; fixed
  by exporting `npm_config_cache` to a fresh directory (`/private/tmp/npmcache`) for the validate calls
  only, without touching `~/.npmrc` (out of scope for this task and possibly load-bearing for other
  work).
- Committed and pushed to the fork branch: commit `0ad018f` "Add pdf, calendar servers; pin all to
  latest commit". Pushed to `fork` (`theluckystrike/mcp-registry`), `23625d0..0ad018f
  add-theluckystrike-mcp-servers -> add-theluckystrike-mcp-servers`. PR #4892 updates automatically from
  the branch (still one PR, now thirteen servers).

Cline marketplace (cline/mcp-marketplace), same issue template as 2397-2401, 2408-2410, 2411-2413.
- Issues created:
  https://github.com/cline/mcp-marketplace/issues/2416 (pdf)
  https://github.com/cline/mcp-marketplace/issues/2417 (calendar)
- Repo URL https://github.com/theluckystrike/mcp-servers/tree/main/servers/<name>, logo
  https://raw.githubusercontent.com/theluckystrike/mcp-servers/main/assets/<name>-logo.png,
  llms-install.md referenced for each (confirmed present in the repo before writing the issue). Same
  honest-checkbox pattern as the prior eleven: "Cline installed it from the README" left unchecked
  because the npm packages are not published, "server is stable" checked. Free-tier limits quoted
  verbatim from each README's Free vs Pro table.

Status check, PR #4892 and all fourteen prior issues plus the two new ones, read via
`gh pr view --json state,mergeable,labels,comments` / `gh issue view --json state,labels,comments`:
- PR #4892: state OPEN, mergeable MERGEABLE, statusCheckRollup [] (no checks configured), labels [],
  comments [] (0 comments). No maintainer request.
- Issues 2397, 2398, 2399, 2400, 2401, 2408, 2409, 2410, 2411, 2412, 2413: all state OPEN, labels [],
  comments [] (0 comments each). No maintainer request on any of them.
- Issues 2416, 2417 (created this run): state OPEN, labels [], comments [] at time of check.
- Verbatim maintainer requests found: none. No comment or label has been added by anyone on the Docker
  side or the Cline side across any of the thirteen Docker catalog entries or sixteen Cline issues to
  date.

data/distribution.json: added `per_server.pdf` and `per_server.calendar` (these two servers had no
per_server entry before this round), each set to `github: "published"`, `registry: "pending (v0.5.0)"`,
`docker-mcp-catalog: "submitted"`, `cline-marketplace: "submitted"` -- the four surfaces specified in
scope for this round; other surfaces (npm, smithery, glama, hosted, mcpservers.org, mcpmarket.com, etc.)
are left unset since they were not verified in this task and no other file besides
data/distribution.json and this RESULT.md was in scope to edit. `surfaces.docker-mcp-catalog.note` and
`surfaces.cline-marketplace.note` extended with the new PR/issue references, the shared
thirteen-way repin commit, and the current OPEN/0-comments/no-labels status.

Paid surfaces: none encountered.

artifacts:
- /private/tmp/docker-mcp-registry servers/{pdf,calendar}/{server.yaml,tools.json} (new),
  servers/{time-tracker,price-tracker,spreadsheet,invoice,expense-tracker,currency,timezone,docx,resume,recurring,clauses}/server.yaml
  (commit repin only), pushed to theluckystrike/mcp-registry branch add-theluckystrike-mcp-servers,
  commit 0ad018f
- Docker PR (updated in place): https://github.com/docker/mcp-registry/pull/4892
- Cline issues: https://github.com/cline/mcp-marketplace/issues/2416 (pdf),
  https://github.com/cline/mcp-marketplace/issues/2417 (calendar)
- /Users/mike/mcp-servers/data/distribution.json
- /Users/mike/mcp-servers/docs/DIST_R5_RESULT.md (this file)

cost: 19 wall minutes

failures:
- First `go run ./cmd/validate -name time-tracker` call failed with a Node
  `ERR_INVALID_PACKAGE_CONFIG` from `npx prettier`, root-caused to the global `~/.npmrc` `cache=`
  setting pointing at an unrelated project's stale npm cache directory
  (`/Users/mike/Desktop/bugbounty/poc-verify/npm-cache`), not at the mcp-registry repo or this task's
  data. Fixed by exporting `npm_config_cache=/private/tmp/npmcache` for the validate calls; no edit to
  `~/.npmrc` since that file is outside this task's scope and may be intentional for other work.

insight: the 2-minute cold-Go-build-cache timeout noted in rounds 3 and 4 did not recur this round
(build cache from the prior session was still warm); the actual first-call failure this round was an
unrelated pre-existing environment defect (corrupted global npx cache) rather than a build timeout,
worth telling apart since the fix is different (env var override vs. a longer timeout).
