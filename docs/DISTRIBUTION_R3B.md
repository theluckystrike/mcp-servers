# Distribution round 3B: loop-33 readback, plugin marketplaces, ToolHive preflight, Glama census (2026-09-12)

Four tasks, executed in order. One PR opened, one surface skipped with policy evidence, one preflight
failed with the exact gap, one census completed against two positive controls. Machine-readable rows in
`data/distribution_r3b.json`. 0 accounts created, 0 repos starred, 0 pushes to theluckystrike's own repos.

## Task 1 — Loop-33 PR status

Command per row: `gh pr view <n> -R <repo> --json state,mergedAt,closedAt,reviews,comments`.

| PR | State | mergedAt | Reviews | Comments |
|---|---|---|---|---|
| [Kilo-Org/kilo-marketplace#269](https://github.com/Kilo-Org/kilo-marketplace/pull/269) | OPEN | null | 0 | 0 |
| [Sagargupta16/awesome-mcp-servers#88](https://github.com/Sagargupta16/awesome-mcp-servers/pull/88) | MERGED | 2026-09-10T14:29:08Z | 0 | 1 (bot) |
| [BlockRunAI/awesome-finance-mcp#69](https://github.com/BlockRunAI/awesome-finance-mcp/pull/69) | OPEN | null | 0 | 0 |
| [wundercorp/awesome-mcp#60](https://github.com/wundercorp/awesome-mcp/pull/60) | OPEN | null | 0 | 0 |

The single comment on #88 is from `sonarqubecloud` ("Quality Gate passed", authorAssociation NONE), an
automation bot, not the maintainer. **No maintainer requested changes on any of the four PRs.** #88
merged 26 minutes after its last commit (`closedAt` = `mergedAt` = 2026-09-10T14:29:08Z).

## Task 2 — Claude Code community plugin marketplaces

Repo names verified first: `gh search repos "agents" --owner wshobson` → `wshobson/agents` (39,570
stars); `gh search repos "awesome-claude-plugins"` → `composio-community/awesome-claude-plugins` (1,957
stars). `gh repo view composiohq/awesome-claude-plugins` resolves to the same
`composio-community/awesome-claude-plugins` nameWithOwner.

### wshobson/agents — SKIPPED, fit is not real and policy bars the estate model

Evidence, all from a scratch clone (`gh repo clone wshobson/agents -- --depth 1`):

1. **Artefact mismatch.** 92 plugins under `plugins/`; each is a markdown payload of
   `agents/`, `commands/`, `skills/`, `hooks/` plus `.claude-plugin/plugin.json`.
   `find plugins -name '.mcp.json'` → 0 files. `/usr/bin/grep -rn '"mcpServers"' plugins/` → exactly 1
   hit, an example block inside `plugins/meigen-ai-design/README.md:11`. The marketplace does not carry
   MCP server entries; even `plugins/protect-mcp` is a governance plugin whose payload is
   agents/commands/hooks/skills about MCP, not an MCP server.
2. **Policy bars our commercial model verbatim.** `CONTRIBUTING.md`, "External and vendor plugins":
   "**No metered or paid API on the default path.** A free tier with a daily quota and a paid tier
   behind it is a funnel, disclosed or not." The estate model per `curl -s https://mcp.zovo.one/llms.txt`:
   "Free tokens allow 600 calls an hour, a Pro key 6000" and "$19 a server or $39 for all 33". That is a
   free tier with a paid tier behind it — the exact pattern the repo bans.
3. **Precedent confirms enforcement.** `gh pr view 648 -R wshobson/agents` (attester-verify, a careful,
   fully disclosed submission wrapping a maintainer-operated metered API) was declined by the maintainer:
   "This is one of the more careful submissions I've had. The disclosure is thorough ... I'm still going
   to decline, and the reason is policy rather than craft. CONTRIBUTING picked up an external and vendor
   plugin section on Aug 15, after you opened this."
4. Vertical: the plugins are coding/harness tooling; CONTRIBUTING requires "Solve a problem this repo
   has" and warns speculative integrations "will be declined". Back-office paperwork servers do not pass.

### composio-community/awesome-claude-plugins — fit is real, PR opened

Evidence, from a scratch clone and `gh pr list -R composio-community/awesome-claude-plugins --state
merged --limit 20`:

1. **The list carries MCP server entries.** README rows include codebase-graph ("Code intelligence MCP
   server ..."), backlog ("24 MCP tools for tasks, projects, tags, dependencies"), taisly-agent-kit
   ("Claude Code plugin, skill, SDK, CLI, and MCP server ..."). The repo's own description: "extend
   Claude Code with custom commands, agents, hooks, and MCP servers".
2. **External-link rows are the established format.** 15 merged PRs read back; external entries merged
   include #2 MyVibe, #7 kaggle-skill, #10 AWS Cost Saver, #14 nano-banana, #18 Manifest, #19 Context
   Mode, #121 codebase-graph+agntk, #129 backlog, #133 Maestro, #304 taisly, #306 asqav. External
   entries appear only in the README: `/usr/bin/grep -c 'codebase-graph\|backlog\|taisly\|myvibe'
   marketplace.json .claude-plugin/marketplace.json` → 0 and 0.
3. **No anti-commercial rule.** Contributing asks only: real use case, no duplication, template
   structure, tested. Commercial entries were merged (MyVibe links myvibe.so; Manifest links
   manifest.build; Taisly is a paid SaaS; the repo owner's own connect-apps funnels to composio.dev).

Submission: **https://github.com/composio-community/awesome-claude-plugins/pull/465** — one new
"Business & Finance" README section with 34 rows, one per public mirror repo
(`gh repo list theluckystrike --limit 100 --json name,description,isPrivate`, filtering `mcp-*` and
`isPrivate == false`), alphabetical, each in the established external-row format, plus the matching
table-of-contents line. Verified readback: `gh pr view 465 -R composio-community/awesome-claude-plugins
--json state,additions,deletions,changedFiles,author` → OPEN, 1 file, +38/-0, author theluckystrike.
The body discloses authorship of all 34 servers, states the free-tier-plus-one-time-Pro model, cites
the external-row precedent, and offers to trim to mcp-office-suite alone or any named subset.

## Task 3 — stacklok/toolhive-catalog preflight: NOT COMPLIANT, no PR opened

The criterion, `docs/server-criteria.md` line 25, verbatim: "**Required** -- Pinned dependencies and
GitHub Actions pinned to SHAs." The scoring table (line 106) repeats "Pinned dependencies / Actions
pinned to SHAs | Required".

Measured against the estate:

1. **Actions are tag-pinned, not SHA-pinned.** `/usr/bin/grep -rn 'uses:'
   /Users/mike/mcp-servers/.github/workflows/` → 2 matches in the monorepo's only workflow
   (`npm-publish-oidc.yml`): `actions/checkout@v4`, `actions/setup-node@v4`. Mirrors are the same:
   `curl -s .../mcp-invoice/main/.github/workflows/ci.yml | /usr/bin/grep 'uses:'` →
   `actions/checkout@v5`, `actions/setup-node@v5`.
2. **Dependencies are ranges, not pins.** `servers/invoice/package.json` dependencies:
   `{"@modelcontextprotocol/sdk": "^1.30.0", "@theluckystrike/mcp-license": "^0.21.0", "pdfkit":
   "^0.15.0", "zod": "^3.25.0"}`; `servers/time-tracker` and `servers/kanban` show the same caret-range
   pattern (read via python3 json). The mirror package.json carries the same ranges plus a
   `file:vendor/mcp-license` local override. A root `package-lock.json` exists, but the manifests
   declare ranges, and the mirrors are the repos a catalogue entry would point at.
3. Compliant items, for the record: MIT license (`head -1 LICENSE` → "MIT License"), public source.

**Exact gap to close before any PR:** (a) pin every dependency to an exact version in all 34
`servers/*/package.json` and in the mirror templates that `scripts/sync-mirrors.sh` regenerates;
(b) pin every workflow `uses:` to a full commit SHA in the monorepo and all 34 mirrors. Both are writes
to theluckystrike's own repos, which this round may not perform — recorded, not fixed.

## Task 4 — Glama server-page census

Question: do `glama.ai/mcp/servers/theluckystrike/<repo>` pages exist for 8 sample mirrors? The blind
instrument cites that surface (6 of 7 Glama citations), not `/mcp/connectors/` where the estate holds
25 listings.

Command per repo per pass:
`curl -s -o <file> -w '%{http_code}' -A 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' https://glama.ai/mcp/servers/theluckystrike/<repo>`

| Repo | Pass 1 | Pass 2 | Pass 3 | Body verdict | Real page? |
|---|---|---|---|---|---|
| mcp-invoice | 404 | 404 (52B) | 200 (0B) | JSON not_found / empty | no |
| mcp-pdf | 404 | 404 (52B) | 404 (52B) | JSON not_found | no |
| mcp-time-tracker | 200 | 404 (52B) | 200 (0B) | JSON not_found / empty | no |
| mcp-expense-tracker | 200 | 404 (52B) | 404 (52B) | JSON not_found | no |
| mcp-spreadsheet | 404 | 404 (52B) | 404 (52B) | JSON not_found | no |
| mcp-currency | 404 | 404 (52B) | 404 (52B) | JSON not_found | no |
| mcp-quotes | 404 | 404 (52B) | 200 (0B) | JSON not_found / empty | no |
| mcp-kanban | 404 | 404 (52B) | 404 (52B) | JSON not_found | no |

Every 404 body is the same 52 bytes: `{"error":{"code":"not_found","message":"Not Found"}}`. The
intermittent 200s carry 0-byte bodies — an edge artifact, not a page. **0 of 8 sample mirrors have a
Glama server page; none shows a tools list.**

Positive controls, run the same way so the zeros are believable:

- `https://glama.ai/mcp/servers/integrations/xero` (a page the blind instrument cited): 200, 240,685
  bytes, `<title>Xero | Glama</title>`, contains a `>Tools<` heading and `toolCount`.
- `https://glama.ai/mcp/servers/theluckystrike/mcp-statement-of-account` (the one estate mirror known
  ingested since loop 31): 200, 294,161 bytes, `<title>mcp-statement-of-account by theluckystrike |
  Glama</title>`, tools present: statement_aging, statement_build, statement_pdf, statement_text
  (`/usr/bin/grep -o 'statement_[a-z_]*' | sort -u`).

So the estate-wide count on the citation-carrying surface remains **1 of 34 mirrors**
(mcp-statement-of-account), unchanged since `data/glama_r2.json` recorded it on 2026-09-09.

### Documented ingestion mechanism

Verified today against `https://glama.ai/mcp/methodology` (via WebFetch, quoted):

- Section 1.1: "Before a server is listed, the submitting maintainer authenticates through GitHub
  OAuth." / "Glama verifies that the submitter has write or admin access to the repository they are
  listing." / "Servers cannot be submitted on behalf of someone who does not control the source."
- Section 1.2: no discovery crawler exists; listing requires maintainer submission, after which "Glama
  clones and continuously syncs the complete Git history from GitHub."
- Section 3: "Glama ingests and re-publishes everything in the official registry" — the path that
  produced the estate's 25 **connectors**, which is a different surface from `/mcp/servers`.
- The public API (`https://glama.ai/mcp/reference`) is read-only; its only POST is unauthenticated
  telemetry. The "Add Server" button on `/mcp/servers` is JS-driven and sits behind the sign-in.

**Exact mechanism to trigger a server page: maintainer GitHub OAuth submission at
`https://glama.ai/mcp/servers` ("Add Server"), with verified write/admin access to the repository.**
That is a browser sign-in flow, human-gated under the standing rules; recorded, not performed. Loop
31's undocumented low-rate path that ingested mcp-statement-of-account remains unsteerable — today's
0-of-8 is consistent with it.
