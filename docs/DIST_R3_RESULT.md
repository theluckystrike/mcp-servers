# Distribution round 3: currency, timezone, docx onto Docker MCP catalog + Cline marketplace

status: DONE

evidence:

Docker MCP catalog (docker/mcp-registry PR #4892, fork theluckystrike/mcp-registry branch
add-theluckystrike-mcp-servers, clone reused at /private/tmp/docker-mcp-registry).
- Added `servers/{currency,timezone,docx}/server.yaml` in the same shape as the five existing entries:
  category finance (currency) / productivity (timezone, docx), `dockerfile: servers/<name>/Dockerfile`,
  no `directory` key (root build context, same reasoning as the other five), commit and icon URL both
  pinned to `9a44330714a9b44b43d9ea0e106c4899a89aa813` (origin/main HEAD of theluckystrike/mcp-servers
  at task start).
- Took the same commit as an opportunity to repin the five existing entries (time-tracker, price-tracker,
  spreadsheet, invoice, expense-tracker) from their older pinned commits (7998ce2 / d82c613) to the same
  new HEAD, per the instruction to keep all eight on one commit.
- `tools.json` generated per server from a live `tools/list` call over stdio JSON-RPC against each
  `servers/<name>/dist/index.js`: currency 10 tools, timezone 11 tools, docx 10 tools. Converted from each
  tool's `inputSchema.properties` into the `{name, description, arguments:[{name,type,desc}]}` shape used
  by the five existing tools.json files (small Python script, `/private/tmp/toolslist/convert.py`).
- `go run ./cmd/validate -name <n>` for all eight: 11/11 green each (Name, Directory, Title, YAML
  formatting, Commit is pinned, Secrets, Config env, License, Icon, Remote skipped, OAuth dynamic). Did
  not run prettier on the tree (per the standing note, it reformats ~40 unrelated entries).
- Committed and pushed to the fork branch: commit `3cf391f` "Add currency, timezone, docx servers; pin
  all to latest commit", `cb3a862..3cf391f add-theluckystrike-mcp-servers -> add-theluckystrike-mcp-servers`.
  PR #4892 updates automatically from the branch (still one PR, eight servers, per the earlier note that
  nothing in CONTRIBUTING requires one server per PR).

Cline marketplace (cline/mcp-marketplace), same issue template as 2397-2401.
- Issues created:
  https://github.com/cline/mcp-marketplace/issues/2408 (currency)
  https://github.com/cline/mcp-marketplace/issues/2409 (timezone)
  https://github.com/cline/mcp-marketplace/issues/2410 (docx)
- Repo URL https://github.com/theluckystrike/mcp-servers/tree/main/servers/<name>, logo
  https://raw.githubusercontent.com/theluckystrike/mcp-servers/main/assets/<name>-logo.png,
  llms-install.md referenced for each. Same honest-checkbox pattern as the prior five: "Cline installed
  it from the README" left unchecked because the npm packages are not published, "server is stable"
  checked. Free-tier limits quoted verbatim from each README's Free vs Pro table.

Status check, PR #4892 and issues 2397-2401 (plus the three new issues), read via `gh pr view` /
`gh issue view --json state,labels,comments`:
- PR #4892: state OPEN, mergeable MERGEABLE, labels [], comments [] (0 comments). No maintainer request.
- Issues 2397, 2398, 2399, 2400, 2401: all state OPEN, labels [], comments [] (0 comments each). No
  maintainer request on any of them.
- Issues 2408, 2409, 2410 (created this run): state OPEN, labels [], comments [] at time of check.
- Verbatim maintainer requests found: none. No comment or label has been added by anyone on the Docker
  side or the Cline side since the prior two submission rounds.

data/distribution.json: `per_server.currency`, `per_server.timezone`, `per_server.docx` each gain
`docker-mcp-catalog: "submitted"` and `cline-marketplace: "submitted"`. `surfaces.docker-mcp-catalog.note`
and `surfaces.cline-marketplace.note` extended with the new PR/issue references, the shared repin commit,
and the current OPEN/0-comments/no-labels status.

Paid surfaces: none encountered; nothing skipped beyond the pre-existing "skipped: paid" row (mcp.so)
already in the file.

artifacts:
- /private/tmp/docker-mcp-registry servers/{currency,timezone,docx}/{server.yaml,tools.json} (new),
  servers/{time-tracker,price-tracker,spreadsheet,invoice,expense-tracker}/server.yaml (commit repin only),
  pushed to theluckystrike/mcp-registry branch add-theluckystrike-mcp-servers, commit 3cf391f
- Docker PR (updated in place): https://github.com/docker/mcp-registry/pull/4892
- Cline issues: https://github.com/cline/mcp-marketplace/issues/2408 (currency),
  https://github.com/cline/mcp-marketplace/issues/2409 (timezone),
  https://github.com/cline/mcp-marketplace/issues/2410 (docx)
- /Users/mike/mcp-servers/data/distribution.json
- /Users/mike/mcp-servers/docs/DIST_R3_RESULT.md (this file)

cost: 23 wall minutes

failures:
- `go run ./cmd/validate -name docx` hit the 2-minute tool timeout on its first run inside a loop over all
  eight servers (the earlier seven had already warmed the Go build cache within the same 2-minute window).
  Re-ran it alone with a 180s timeout; it passed 11/11 on the retry. Not a defect in the docx entry itself.

insight: Repinning all eight server.yaml files to one shared commit in the same push that adds three new
servers keeps the PR internally consistent (every entry in the catalog now points at the exact same
snapshot of theluckystrike/mcp-servers) without needing a separate commit or PR just for the repin.
