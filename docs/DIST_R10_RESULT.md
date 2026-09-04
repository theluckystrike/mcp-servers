# Distribution Round 10

Scope this round: targets not yet covered by rounds 3-9 (Glama, PulseMCP, mcpservers.org, mcp-get, LobeHub,
Cursor directory, Smithery, plain-text MCP hub lists, .mcpb/DXT awesome lists), plus keeping the free-only
and no-login rules. Cap: 40 minutes.

## Already-covered targets, re-checked, no change

- Glama: `pending`, still no unauthenticated add/submit endpoint; Add Server needs a Glama account, directory
  API needs a key from account settings. Left as-is.
- PulseMCP: `blocked`, submissions "temporarily paused", no form rendered.
- mcpservers.org: `submitted` already (4 servers, free tier).
- mcp-get.com: `closed`, archived read-only snapshot.
- Cursor directory: `blocked: login`, `/plugins/new` redirects to GitHub/Google OAuth.
- Smithery: `blocked`, needs one interactive browser login (`npx @smithery/cli auth login`). Recorded as
  human-gated, not attempted.
- awesome-mcp-servers (punkpeye): PR #13473 still open, still hard-blocked on Glama listing + emoji per
  entry, per the original project rule of never using emojis.
- mcp.so: `skipped: paid` ($39 listing fee, no free tier).

None of these needed new action; no paid submissions attempted, no login flows attempted.

## New research and one new submission

**LobeHub** (`lobehub/lobe-chat-agents` and `gh search repos "lobehub mcp"`): the repo indexes LobeChat
*agent* system prompts (`agent-template.json`, submit via GitHub issue form), not MCP servers. No LobeHub MCP
marketplace repository exists. Recorded `not applicable`.

**MCP Hub lists** (`gh search repos "awesome mcp servers" --sort stars`, 15 results reviewed): checked
README format on the top unblocked candidates for emoji-per-entry requirements.
- `TensorBlock/awesome-mcp-servers` (838 stars): category docs under `docs/*.md`, entries are plain
  `- [Name](url): description` bullets, only the category *heading* carries a decorative emoji. Cleared as
  plain-text format. Submission is PR-to-`docs/<category>.md` or an issue-form (`Add MCP server`). Not
  submitted this round -- ran out of time budget before opening the PR; recorded as researched, format
  cleared, ready for next round.
- `YuzeHao2023/Awesome-MCP-Servers` (1061 stars): README `## Category: X (emoji)` sections use plain
  `- Name — url (description)` bullets, no per-entry emoji. Same outcome: cleared, not submitted, next round.
- `PipedreamHQ/awesome-mcp-servers` (282 stars): auto-generated from Pipedream's own connect-app catalog
  (`mcp.pipedream.com/app/<slug>` URLs only) -- not a manual community PR target, skipped.
- `ever-works/awesome-mcp-servers`, `toolsdk-ai/toolsdk-mcp-registry`: reviewed, both viable
  (issue-form/PR-based, plain entries) but not reached within the 3-list cap or the time budget.

**Awesome lists for Claude Desktop extensions (.mcpb/DXT)**:
- `mgoldsborough/awesome-mcpb`: README, alphabetized `## <Category>` sections, plain
  `- [Name](url) - description.` bullets, no emoji anywhere in entries. **Submitted**: forked to
  `theluckystrike/awesome-mcpb`, added 19 entries (18 servers + the office-suite bundle) into the existing
  `## Productivity` and `## Utilities` sections in alphabetical order, one commit, no changes outside
  `readme.md`. Each entry links to
  `https://github.com/theluckystrike/mcp-servers/tree/main/servers/<name>` and names `mcp.zovo.one`.
  PR: https://github.com/mgoldsborough/awesome-mcpb/pull/11 (open).
- `MCPStar/awesome-dxt-mcp` (20 stars): "Community Extensions" section is an unpopulated placeholder
  ("Looking for contributions!") with category ideas, not real entries -- no existing format to match.
  Skipped, recorded with reason.

## data/distribution.json

Five new surface keys added: `awesome-mcpb` (submitted, PR #11), `lobehub-mcp-marketplace` (not applicable),
`tensorblock-awesome-mcp-servers` and `yuzehao2023-awesome-mcp-servers` (researched, format cleared, not yet
submitted), `mcpstar-awesome-dxt-mcp` (skipped, no populated list). No `per_server` changes this round --
the new submission is one bundle-level PR listing all 19 entries, not per-server registry rows.

Paid surfaces: none encountered beyond the already-recorded mcp.so skip. Zero paid API calls. No account
creation requiring email verification or browser login was attempted (Smithery, Cursor directory, Glama
account confirmed still gated, left untouched).

## Time and what is left for round 11

Cap reached at ~40 minutes with the TensorBlock and YuzeHao2023 PRs researched but not opened -- both
formats are confirmed emoji-free and PR-ready, so round 11 can open them directly without re-doing the
format check. `ever-works/awesome-mcp-servers` and `toolsdk-ai/toolsdk-mcp-registry` are untouched next
candidates if more than 3 MCP hub lists are wanted.

artifacts:
- /Users/mike/mcp-servers/data/distribution.json
- /Users/mike/mcp-servers/docs/DIST_R10_RESULT.md (this file)
- https://github.com/mgoldsborough/awesome-mcpb/pull/11
- /private/tmp/awesome-mcpb (fork clone, branch main, pushed to theluckystrike/awesome-mcpb)

cost: 40 wall minutes
