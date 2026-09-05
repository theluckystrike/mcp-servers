# Distribution Round 12

Scope: find up to four more GitHub-hosted MCP server lists not yet submitted to, check README/CONTRIBUTING
format, submit a single office-suite bundle entry where the format is plain text without per-entry emoji
and rules allow one project per PR. Cap: 30 minutes.

## Method

`gh search repos "mcp servers" --sort stars --limit 30` and `gh search repos "awesome mcp" --sort stars
--limit 30`, cross-checked against `data/distribution.json` to exclude repos already covered (punkpeye,
appcypher, wong2, chatmcp/mcpso, TensorBlock, YuzeHao2023, PipedreamHQ, ever-works, toolsdk-ai,
mgoldsborough/awesome-mcpb, MCPStar/awesome-dxt-mcp, lobehub).

Candidates reviewed: yzfly/Awesome-MCP-ZH (7629 stars), MobinX/awesome-mcp-list (881), AlexMili/Awesome-MCP
(146), AIAnytime/Awesome-MCP-Server (67), mctrinh/awesome-mcp-servers (46). Others in the search results
(rohitg00/awesome-devops-mcp-servers, Puliczek/awesome-mcp-security, punkpeye/awesome-mcp-devtools,
darjeeling/awesome-mcp-korea, e2b-dev/awesome-mcp-gateways, bh-rat/awesome-mcp-enterprise,
WagnerAgent/awesome-mcp-servers-devops, beriberikix/awesome-mcp-hardware, AIM-Intelligence/awesome-mcp-security,
LeslieLeung/awesome-mcp-server-cn, Tommertom/awesome-ionic-mcp, rizzdev/awesome-mcp-open,
agenticdevops/awesome-devops-mcp) are single-domain lists (security, devops, hardware, mobile, regional)
with no fitting category for a general office-suite bundle, so not opened.

## Skipped

- **yzfly/Awesome-MCP-ZH**: table format uses per-entry emoji tags in the notes column on every row
  (medal, cloud, house, apple, disk, flag emoji marking official/language/deployment/platform), e.g. under
  the Office/Project-management category: `官方实现 (Paragon) 🎖️, TypeScript 开发 📇`. Same rejection
  reason as prior rounds (lists rejected for emoji tags). Skipped.
- **AlexMili/Awesome-MCP**: table format has a checkmark emoji column and a colored-circle "Activity"
  column (🟢/🟡/🔴) rendered per row for every entry, not just category headings. Emoji-tagged per entry.
  Skipped.

## Submitted (3 PRs, one office-suite entry each)

1. **MobinX/awesome-mcp-list** (881 stars): plain `-   **[Name](url)** [![GitHub stars](badge)](url):
   description.` bullets, no CONTRIBUTING.md but README has no per-entry emoji (only decorative emoji on
   category headings, same convention TensorBlock and YuzeHao2023 already cleared in round 10). Forked to
   `theluckystrike/awesome-mcp-list`, branch `add-office-suite`, one entry added at the end of the
   `### 🛠️ Utilities` section next to `Markgatcha/universal-mcp-toolkit` (another all-in-one bundle entry,
   closest neighbor), one commit.
   PR: https://github.com/MobinX/awesome-mcp-list/pull/420 (open)

2. **AIAnytime/Awesome-MCP-Server** (67 stars): CONTRIBUTING.md states one server per PR, exact bullet
   format `- **[Name](link)** \`stdio|http|sse\` — sentence. Install: ... · [Docs](...)`, alphabetical order
   within category, no emoji. Forked to `theluckystrike/Awesome-MCP-Server`, branch `add-office-suite`, one
   entry added to `### Work & productivity`, alphabetically between "AI Applyd" and "Process Street", one
   commit.
   PR: https://github.com/AIAnytime/Awesome-MCP-Server/pull/83 (open)

3. **mctrinh/awesome-mcp-servers** (46 stars): flat single "Community Servers" list (same shape as
   punkpeye's original list but without its CI bot), plain `* [Name](url) - description.` bullets, no
   emoji anywhere, alphabetical. No CONTRIBUTING.md; format is self-evident and consistent for hundreds of
   entries including three existing `Office-*-MCP-Server` entries. Forked to
   `theluckystrike/awesome-mcp-servers-5` (name collision bumped the suffix), branch `add-office-suite`,
   one entry `Office Suite` inserted alphabetically between `Office-Visio-MCP-Server` and
   `Office-Word-MCP-Server`, one commit.
   PR: https://github.com/mctrinh/awesome-mcp-servers/pull/112 (open)

Each PR adds exactly one entry linking `https://github.com/theluckystrike/mcp-servers` and
`https://mcp.zovo.one`, worded as an office-suite/back-office bundle (invoices, spreadsheets, PDFs, time
tracking, expense tracking, resumes, contracts), matching the exact neighboring bullet format of its list.
No emoji added, no em dashes, no paid submissions, no login flows attempted.

## data/distribution.json

Three new surface keys: `mobinx-awesome-mcp-list`, `aianytime-awesome-mcp-server`,
`mctrinh-awesome-mcp-servers`, all `status: submitted` with their PR URLs. No `per_server` changes -- these
are bundle-level entries like the round 10/10b/10c submissions, not per-server registry rows.

## Time

Cap reached at ~28 minutes: search + candidate triage (~12 min), format checks on 5 candidates (~8 min),
three fork/edit/PR cycles (~8 min).

artifacts:
- /Users/mike/mcp-servers/data/distribution.json
- /Users/mike/mcp-servers/docs/DIST_R12_RESULT.md (this file)
- https://github.com/MobinX/awesome-mcp-list/pull/420
- https://github.com/AIAnytime/Awesome-MCP-Server/pull/83
- https://github.com/mctrinh/awesome-mcp-servers/pull/112

cost: ~28 wall minutes
