# Distribution round 6: kanban, image onto Docker MCP catalog + Cline marketplace

status: DONE

evidence:

Docker MCP catalog (docker/mcp-registry PR #4892, fork theluckystrike/mcp-registry branch
add-theluckystrike-mcp-servers, clone reused at /private/tmp/docker-mcp-registry).
- `git -c rebase.autoStash=true pull --rebase` on the fork clone first: already up to date (branch
  unchanged since round 5's push).
- Read `servers/{kanban,image}/Dockerfile` in the theluckystrike/mcp-servers repo first: both build
  from the repo root as context (`COPY package.json`, `COPY packages`, `COPY servers`, npm workspaces),
  same shape as the existing thirteen entries. Neither has a sibling-server dependency (image depends
  only on `jimp`, a pure-JS npm package, not another workspace server). No `directory` key needed in
  server.yaml, same reasoning as the prior thirteen.
- Added `servers/{kanban,image}/server.yaml`: category productivity for both, `dockerfile:
  servers/<name>/Dockerfile`, `MCP_LICENSE_KEY` optional secret same as all thirteen prior entries,
  commit and icon URL both pinned to `806454f16a32918efc20a22e06af04d180e5c14e` (origin/main HEAD of
  theluckystrike/mcp-servers at task start).
- Took the same commit as an opportunity to repin all thirteen existing entries (time-tracker,
  price-tracker, spreadsheet, invoice, expense-tracker, currency, timezone, docx, resume, recurring,
  clauses, pdf, calendar) from `75e358fce74fef68c20051209af64f51c917e798` to the same new HEAD, per the
  instruction to keep all fifteen on one commit.
- `tools.json` generated per server from a live `tools/list` call over stdio JSON-RPC against each
  `servers/<name>/dist/index.js` (small Node script driving the initialize / notifications/initialized /
  tools/list handshake, converting `inputSchema.properties` into the `{name, type, desc}` argument shape
  used by the existing files): kanban 16 tools (including `license_status`/`license_activate` and
  `columns_set`), image 12 tools (including `image_dominant_colors`).
- `go run ./cmd/validate -name <n>` for all 15 (kanban, image, time-tracker, price-tracker,
  spreadsheet, invoice, expense-tracker, currency, timezone, docx, resume, recurring, clauses, pdf,
  calendar): 15/15 green each (Name, Directory, Title, YAML formatting, Commit is pinned, Secrets,
  Config env, License, Icon, Remote skipped, OAuth dynamic). `npm_config_cache` exported to
  `/private/tmp/npmcache` for the validate calls per the round-5/prior-round fix (global `~/.npmrc`
  cache dir is still stale/unrelated; left untouched, out of scope).
- Committed and pushed to the fork branch: commit `82a76f8` "Add kanban, image servers; pin all to
  latest commit". Pushed to `fork` (`theluckystrike/mcp-registry`), `0ad018f..82a76f8
  add-theluckystrike-mcp-servers -> add-theluckystrike-mcp-servers`. PR #4892 updates automatically from
  the branch (still one PR, now fifteen servers).

Cline marketplace (cline/mcp-marketplace), same issue template as 2397-2401, 2408-2413, 2416-2417.
- Issues created:
  https://github.com/cline/mcp-marketplace/issues/2422 (kanban)
  https://github.com/cline/mcp-marketplace/issues/2423 (image)
- Repo URL https://github.com/theluckystrike/mcp-servers/tree/main/servers/<name>, logo
  https://raw.githubusercontent.com/theluckystrike/mcp-servers/main/assets/<name>-logo.png,
  llms-install.md referenced for each (confirmed present in the repo before writing the issue). Same
  honest-checkbox pattern as the prior thirteen: "Cline installed it from the README" left unchecked
  because the npm packages are not published, "server is stable" checked. Free-tier limits quoted
  verbatim from each README's Free vs Pro table.

Status check, PR #4892 and all fifteen prior issues plus the two new ones, read via
`gh pr view --json state,mergeable,labels,comments` / `gh issue view --json state,labels,comments`:
- PR #4892: state OPEN, mergeable MERGEABLE, statusCheckRollup [] (no checks configured), labels [],
  comments [] (0 comments). No maintainer request.
- Issues 2397, 2398, 2399, 2400, 2401, 2408, 2409, 2410, 2411, 2412, 2413, 2416, 2417: all state OPEN,
  labels [], comments [] (0 comments each). No maintainer request on any of them.
- Issues 2422, 2423 (created this run): state OPEN, labels [], comments [] at time of check.
- Verbatim maintainer requests found: none. No comment or label has been added by anyone on the Docker
  side or the Cline side across any of the fifteen Docker catalog entries or eighteen Cline issues to
  date.

data/distribution.json: added `per_server.kanban` and `per_server.image` (these two servers had no
per_server entry before this round), each set to `github: "published"`, `registry: "pending (v0.6.0)"`
(matches the `0.6.0` version currently in each server's package.json), `docker-mcp-catalog:
"submitted"`, `cline-marketplace: "submitted"` -- the four surfaces specified in scope for this round;
other surfaces (npm, smithery, glama, hosted, mcpservers.org, mcpmarket.com, etc.) are left unset since
they were not verified in this task and no other file besides data/distribution.json and this
RESULT.md was in scope to edit. `surfaces.docker-mcp-catalog.note` and `surfaces.cline-marketplace.note`
extended with the new PR/issue references, the shared fifteen-way repin commit, and the current
OPEN/0-comments/no-labels status. `updated_at` bumped to the time of this edit.

Paid surfaces: none encountered.

artifacts:
- /private/tmp/docker-mcp-registry servers/{kanban,image}/{server.yaml,tools.json} (new),
  servers/{time-tracker,price-tracker,spreadsheet,invoice,expense-tracker,currency,timezone,docx,resume,recurring,clauses,pdf,calendar}/server.yaml
  (commit repin only), pushed to theluckystrike/mcp-registry branch add-theluckystrike-mcp-servers,
  commit 82a76f8
- Docker PR (updated in place): https://github.com/docker/mcp-registry/pull/4892
- Cline issues: https://github.com/cline/mcp-marketplace/issues/2422 (kanban),
  https://github.com/cline/mcp-marketplace/issues/2423 (image)
- /Users/mike/mcp-servers/data/distribution.json
- /Users/mike/mcp-servers/docs/DIST_R6_RESULT.md (this file)

cost: 20 wall minutes

failures: none this round -- the `npm_config_cache` workaround from round 5 was reused proactively
before the first validate call, so the earlier `ERR_INVALID_PACKAGE_CONFIG` from a stale global `npx`
prettier cache did not recur.

insight: pdf's `per_server.registry` in data/distribution.json already reads "published" (advanced past
"pending" in a later round than R5), confirming registry status is tracked and updated independently of
this round's Docker/Cline scope; kanban and image are new entries so they start at "pending (v0.6.0)"
per instruction, matching the version currently in their package.json files.
