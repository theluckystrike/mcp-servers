# Distribution round 4: resume, recurring, clauses onto Docker MCP catalog + Cline marketplace

status: DONE

evidence:

Docker MCP catalog (docker/mcp-registry PR #4892, fork theluckystrike/mcp-registry branch
add-theluckystrike-mcp-servers, clone reused at /private/tmp/docker-mcp-registry).
- Read `servers/{resume,recurring,clauses}/Dockerfile` first: all three build from the repo root as
  context (`COPY package.json`, `COPY packages`, `COPY servers`, npm workspaces), same shape as the
  existing eight entries. resume and clauses additionally build and copy in
  `@theluckystrike/mcp-docx` (they import its `/lib` as a document engine); recurring additionally
  builds and copies in `@theluckystrike/mcp-invoice` (it writes generated invoices through that
  engine). No `directory` key needed in server.yaml, same reasoning as the other eight.
- Added `servers/{resume,recurring,clauses}/server.yaml`: category productivity (resume, clauses) /
  finance (recurring), `dockerfile: servers/<name>/Dockerfile`, `MCP_LICENSE_KEY` optional secret same
  as all eight prior entries, commit and icon URL both pinned to
  `2f47c581212dcaa080d33e3f04dafefab34c733d` (origin/main HEAD of theluckystrike/mcp-servers at task
  start).
- Took the same commit as an opportunity to repin the eight existing entries (time-tracker,
  price-tracker, spreadsheet, invoice, expense-tracker, currency, timezone, docx) from
  `9a44330714a9b44b43d9ea0e106c4899a89aa813` to the same new HEAD, per the instruction to keep all
  eleven on one commit.
- `tools.json` generated per server from a live `tools/list` call over stdio JSON-RPC against each
  `servers/<name>/dist/index.js` (small Node script driving the JSON-RPC handshake, then the same
  Python convert step used in round 3): resume 10 tools, recurring 13 tools, clauses 12 tools.
- `go run ./cmd/validate -name <n>` for all eleven: 11/11 green each (Name, Directory, Title, YAML
  formatting, Commit is pinned, Secrets, Config env, License, Icon, Remote skipped, OAuth dynamic).
  First run (`resume`) hit the 2-minute tool timeout on a cold Go build cache, same as round 3's docx;
  re-ran alone with a 300s timeout and it passed, after which the remaining ten ran well within the
  default timeout.
- Committed and pushed to the fork branch: commit `23625d0` "Add resume, recurring, clauses servers;
  pin all to latest commit". Push initially failed against `origin` (no upstream) -- the correct
  remote is `fork` (`theluckystrike/mcp-registry`), confirmed by `git remote -v`; pushed
  `3cf391f..23625d0 add-theluckystrike-mcp-servers -> add-theluckystrike-mcp-servers`. PR #4892 updates
  automatically from the branch (still one PR, now eleven servers).

Cline marketplace (cline/mcp-marketplace), same issue template as 2397-2401 and 2408-2410.
- Issues created:
  https://github.com/cline/mcp-marketplace/issues/2411 (resume)
  https://github.com/cline/mcp-marketplace/issues/2412 (recurring)
  https://github.com/cline/mcp-marketplace/issues/2413 (clauses)
- Repo URL https://github.com/theluckystrike/mcp-servers/tree/main/servers/<name>, logo
  https://raw.githubusercontent.com/theluckystrike/mcp-servers/main/assets/<name>-logo.png,
  llms-install.md referenced for each (confirmed present in the repo before writing the issue). Same
  honest-checkbox pattern as the prior eight: "Cline installed it from the README" left unchecked
  because the npm packages are not published, "server is stable" checked. Free-tier limits quoted
  verbatim from each README's Free vs Pro table.

Status check, PR #4892 and issues 2397-2401, 2408-2410, plus the three new issues, read via
`gh pr view --json state,mergeable,labels,comments` / `gh issue view --json state,labels,comments`:
- PR #4892: state OPEN, mergeable MERGEABLE, labels [], comments [] (0 comments). No maintainer request.
- Issues 2397, 2398, 2399, 2400, 2401, 2408, 2409, 2410: all state OPEN, labels [], comments [] (0
  comments each). No maintainer request on any of them.
- Issues 2411, 2412, 2413 (created this run): state OPEN, labels [], comments [] at time of check.
- Verbatim maintainer requests found: none. No comment or label has been added by anyone on the Docker
  side or the Cline side across any of the eleven Docker catalog entries or fourteen Cline issues to
  date.

data/distribution.json: added `per_server.resume`, `per_server.recurring`, `per_server.clauses` (these
three servers had no per_server entry before this round), each set to `docker-mcp-catalog: "submitted"`,
`cline-marketplace: "submitted"` -- only the two surfaces in scope for this round; other surfaces
(github, registry, npm, smithery, glama, hosted) are left unset since they were not verified in this
task and no other file besides data/distribution.json and this RESULT.md was in scope to edit.
`surfaces.docker-mcp-catalog.note` and `surfaces.cline-marketplace.note` extended with the new PR/issue
references, the shared eleven-way repin commit, and the current OPEN/0-comments/no-labels status.

Paid surfaces: none encountered.

artifacts:
- /private/tmp/docker-mcp-registry servers/{resume,recurring,clauses}/{server.yaml,tools.json} (new),
  servers/{time-tracker,price-tracker,spreadsheet,invoice,expense-tracker,currency,timezone,docx}/server.yaml
  (commit repin only), pushed to theluckystrike/mcp-registry branch add-theluckystrike-mcp-servers,
  commit 23625d0
- Docker PR (updated in place): https://github.com/docker/mcp-registry/pull/4892
- Cline issues: https://github.com/cline/mcp-marketplace/issues/2411 (resume),
  https://github.com/cline/mcp-marketplace/issues/2412 (recurring),
  https://github.com/cline/mcp-marketplace/issues/2413 (clauses)
- /Users/mike/mcp-servers/data/distribution.json
- /Users/mike/mcp-servers/docs/DIST_R4_RESULT.md (this file)

cost: 20 wall minutes

failures:
- `git push` to `origin` failed with "no upstream branch" -- `origin` is `docker/mcp-registry` (the
  upstream, not the fork); the correct remote for this branch is `fork`
  (`theluckystrike/mcp-registry`), same as round 3 pushed to implicitly. Fixed by pushing to `fork`
  explicitly; no data lost.
- `go run ./cmd/validate -name resume` hit the 2-minute tool timeout on a cold Go build cache (first
  validate call of the session). Re-ran alone with a 300s timeout; passed 11/11. Not a defect in the
  resume entry itself, matches the same failure mode noted in round 3 for docx.

insight: resume and clauses both depend on mcp-docx, and recurring depends on mcp-invoice, at the
library level (not a running server) -- their Dockerfiles copy and build the dependency package inside
the same multi-stage build rather than expecting it pre-built, so no change to the root-context /
no-`directory`-key pattern from earlier rounds was needed even though these are the first three
sibling-dependent servers submitted.
