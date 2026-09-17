# S37 — Collabnix / UniHack Awesome MCP Servers Submission

STATUS: shipped

## Repo identified

- Repo: `collabnix/awesome-mcp-lists` — "A Curated List of MCP Servers, Clients and Toolkits"
- URL: https://github.com/collabnix/awesome-mcp-lists
- Not the `docker-labs` repo. It is a standalone list repo (34 stars, 14 open issues, not archived).
- Verified via: `gh api repos/collabnix/awesome-mcp-lists --jq '{full_name,description,default_branch}'`
- Root files: `README.md`, `LICENSE`, `index.html`, `check-docker-pulls.sh`, `docs/`, `icons/`, `scripts/`

## Entry format spec

- NO `CONTRIBUTING.md` exists in the repo. The `## Contributing` section of README.md links to
  `CONTRIBUTING.md`, which returns HTTP 404 — so the README table itself is the format spec.
- Format is a 4-column markdown table, numbered sequentially:
  `| N | **name** | description | [GitHub](url) |`
- Verified from an existing row:
  `| 51 | **cve-mcp-server** | Production-grade MCP server... | [GitHub](https://github.com/mukul975/cve-mcp-server) |`
- Placement: NOT alphabetical. New entries are **appended to the end of the relevant section's
  table**, taking the next sequential row number.
- Relevant section: `### DevOps & Infrastructure` (starts line 42 of README.md).
- No emoji in this table (some other rows/sections use emoji; the DevOps table does not).

## Exact file + line

- File: `README.md` (repo root), blob sha `5e23ce2` on upstream `main`
- Anchor line: **line 98** — `| 51 | **cve-mcp-server** | ... | [GitHub](https://github.com/mukul975/cve-mcp-server) |`
- New entries inserted at **lines 99, 100, 101** (immediately after row 51, before the blank line
  and `### Database & Storage` on line 103).
- Row numbers used: 52, 53, 54 (continuing the section's sequence).

## Entries chosen (3)

Chosen for a devops/infra audience: local-first, Docker-shippable, no API key, data never leaves
the host. Source descriptions taken from `servers/*/server.json`.

1. `| 52 | **pdf-merge-split-stamp** | Merge, split, extract, rotate, reorder and stamp PDF pages from your AI chat, all offline. Deterministic, no upload, no cloud dependency — runs locally in Docker. | [GitHub](https://github.com/theluckystrike/mcp-servers/tree/main/servers/pdf) |`
   - source: `servers/pdf/server.json` — "Merge, split, extract, rotate, reorder and stamp PDF pages from your AI chat, all offline."
2. `| 53 | **invoice-pdf-billing** | Create PDF invoices from your AI chat: clients, numbering, VAT, overdue reports. All data is local, so billing data never leaves the host. | [GitHub](https://github.com/theluckystrike/mcp-servers/tree/main/servers/invoice) |`
   - source: `servers/invoice/server.json` — "Create PDF invoices from your AI chat: clients, numbering, VAT, overdue reports. All data is local."
3. `| 54 | **time-tracker-timesheet** | Track billable time from your AI chat: timers, entries, reports, CSV export. All data stays local — useful for freelancers and consultancies billing hours. | [GitHub](https://github.com/theluckystrike/mcp-servers/tree/main/servers/time-tracker) |`
   - source: `servers/time-tracker/server.json` — "Track billable time from your AI chat: timers, entries, reports, CSV export. All data stays local."

Note on `spreadsheet` (4th candidate, not submitted): dropped to keep the PR to 3 entries; its
`server.json` is "Open, inspect, filter, edit and convert xlsx and csv files from your AI chat.
Processing is local." Can be a follow-up PR.

## PR

- **PR #117** — https://github.com/collabnix/awesome-mcp-lists/pull/117
- Title: "Add 3 offline office MCP servers to DevOps & Infrastructure"
- Head: `theluckystrike:add-devops-office-servers` → base: `collabnix:main`
- Fork already existed (`theluckystrike/awesome-mcp-lists`, fork=true, parent=collabnix/awesome-mcp-lists);
  merged upstream into the fork, created branch from `00718ed6`.
- Commit: `cde80f44` "Add 3 offline office MCP servers to DevOps & Infrastructure"
- Sparse approach used (no clone): `gh api .../contents/README.md` to read, edit locally,
  `gh api -X PUT .../contents/README.md` with base64 content + blob sha to commit.

## Verification

```
$ gh pr view 117 -R collabnix/awesome-mcp-lists --json number,state,mergeable,mergeStateStatus,title,url,headRefName,baseRefName,additions,deletions,changedFiles
{"additions":3,"baseRefName":"main","changedFiles":1,"deletions":0,
 "headRefName":"add-devops-office-servers","mergeStateStatus":"CLEAN",
 "mergeable":"MERGEABLE","number":117,"state":"OPEN",
 "title":"Add 3 offline office MCP servers to DevOps & Infrastructure",
 "url":"https://github.com/collabnix/awesome-mcp-lists/pull/117"}
```

- `gh api repos/collabnix/awesome-mcp-lists/compare/main...theluckystrike:add-devops-office-servers --jq '{ahead,behind,files}'`
  → `{"ahead":1,"behind":0,"files":["README.md"]}`

## Notes / pitfalls found

- A prior PR from this account is already open on the same repo: **PR #112** "Add mcp-office-suite
  to Development Tools" (state OPEN, MERGEABLE, head `add-office-suite`, opened 2026-09-07). This
  submission deliberately does not duplicate `office-suite` and targets a different section
  (DevOps & Infrastructure vs Development Tools) with three different servers.
- The first PUT attempt returned HTTP 409 `README.md does not match 5e23ce2` because the fork
  branch's README blob was `f4a56b5` (fork main tree was stale relative to its ref SHA). Committing
  against the branch's own blob sha resolved it; the retry succeeded.
- This repo's README is regenerated by a workflow (`.github/workflows/update-mcp-servers.yml`) and
  there is an open bot PR #111 "Add newly discovered MCP tools from GitHub", so the README churns;
  rebase may be needed before merge.
