# Distribution round 2: new surfaces (2026-09-10)

`data/distribution.json` already holds about 48 surfaces, most of them published, dead, paid or
human-gated. None of those was re-walked. This round looked only for surfaces that are not in
that file, submitted to the ones that are free and need no account, and recorded the rest with
the exact gate. Machine-readable results are in `data/distribution_r2.json`.

**40 new surfaces recorded. 5 submissions made, 4 of them pull requests, all verified by reading
them back with `gh`. 0 paid surfaces used, 0 accounts created, 0 logins performed.**

## Submitted, with the real numbers

| Surface | What it is | Submission | Verified state |
|---|---|---|---|
| GitHub MCP Registry onboarding queue | The curation queue behind VS Code's picker | [discussion #1257 comment](https://github.com/github/github-mcp-server/discussions/1257#discussioncomment-18387359) | posted 2026-09-10T13:56:45Z by theluckystrike |
| Kilo Code marketplace | In-IDE Marketplace tab of the Kilo Code editor | [Kilo-Org/kilo-marketplace#269](https://github.com/Kilo-Org/kilo-marketplace/pull/269) | OPEN, 1 file |
| Sagargupta16/awesome-mcp-servers | Curated directory, self-promotion explicitly allowed | [#88](https://github.com/Sagargupta16/awesome-mcp-servers/pull/88) | OPEN, 1 file |
| BlockRunAI/awesome-finance-mcp | 209-star finance list, 5 outside merges in one day | [#69](https://github.com/BlockRunAI/awesome-finance-mcp/pull/69) | OPEN, 1 file |
| wundercorp/awesome-mcp | Schema-validated JSON catalogue | [#60](https://github.com/wundercorp/awesome-mcp/pull/60) | OPEN, 2 files |

Every PR body discloses authorship, because three of the four projects require it and the fourth
merges self-submissions routinely. Two points worth keeping:

- The Sagargupta16 PR template asks you to tick "`validate.py` passes locally". It does not pass:
  two entries already on `main` are over the description limit and out of order. The PR says so
  in plain text instead of quietly ticking the box, and offers a separate PR for them.
- The wundercorp PR ran both required scripts and quotes their output: `Validated 23 MCP server
  entries` and `Generated README.md with 9 populated categories`. The README diff is 6 added
  lines and nothing else.

## The single most valuable finding

Round 1's client survey recorded the VS Code gallery as having "no form, no pull request, no
request path". **That is wrong.** GitHub staff have twice stated in public that the gallery is a
hand-curated list and that onboarding happens by request, and the discussion thread has become the
queue. Full evidence is in `docs/VSCODE_GALLERY_R2.md`; a request has been posted.

Its measured yield is bad and that number belongs next to it: of eleven servers requested in that
thread, two are in the gallery today, and both belong to the one publisher a GitHub engineer
engaged with personally over eight months. The 2026-07 to 2026-09 cohort is 0 of 8. The route
costs one comment, so it was worth taking; it is not worth taking twice.

## Free, agent-submittable, not used this round

These need no account and no money, and a follow-up round should take them:

- **Gemini CLI extension gallery** — the cheapest unlock found anywhere. There is no submission
  at all: a public repo with the GitHub topic `gemini-cli-extension` and a `gemini-extension.json`
  at its **root** is crawled daily into `geminicli.com/extensions/browse/`. 664 repos already carry
  the topic. It is not done here because it needs a commit to a repo root, which is outside this
  round's file ownership, and because `scripts/sync-mirrors.sh` force-pushes the mirrors, so a
  manual commit there would be wiped on the next sync. This should be routed to whoever owns
  `sync-mirrors.sh` and shipped as part of the mirror template.
- **Chat2AnyLLM/awesome-mcp-servers** — `servers/<slug>.yaml` plus `make ci`; four outside merges
  on 2026-09-03.
- **Zencoder zenagents-library** — `mcp-library.json`, 99 servers, copied to a public bucket by CI
  on every push, so the file is the live product. The submission precedent for MCP entries is
  unwritten.
- **stacklok/toolhive-catalog** — where ToolHive's registry moved. Its criteria require pinned
  dependencies and GitHub Actions pinned to commit SHAs; check our workflows before spending a PR.
- **Claude Code community plugin marketplaces** (`wshobson/agents`, `composio-community/awesome-claude-plugins`).
  Anthropic's own `marketplace.json` is first-party only, so this is the only route.
- **FlowiseAI/Flowise** — real, but the artefact is a TypeScript node class, not a catalogue row,
  so it carries ongoing maintenance. Its marketplace-template slot has no MCP entry yet.
- **jaw9c/awesome-remote-mcp-servers** (1,110 stars, 755 open PRs, ~80 days idle) and
  **Appnova-EU-OU/awesome-remote-mcp-servers** (604 open PRs) — cheap lottery tickets.

## Skipped on the operator's standing rules

**punkpeye/awesome-remote-mcp-servers** is the best topical fit found in the whole round: a
remote-servers-only list, 110 stars, merging several outside pull requests every single day, and
this project has 30 hosted endpoints. It was skipped anyway, on three grounds an agent should not
decide alone:

1. Every entry must carry an authentication marker emoji, and its CONTRIBUTING fast-tracks agent
   PRs that put three robot emoji in the title. The operator's no-emoji rule already cost
   `yzfly/Awesome-MCP-ZH`, `AlexMili/Awesome-MCP` and `tolkonepiu/best-of-mcp-servers`, and being
   inconsistent about it is worse than the loss.
2. "Star the repository. This is required -- PRs are not merged unless the account opening them has
   starred the repo." That is a write to the operator's GitHub account for a reason unrelated to
   the contribution.
3. A Glama connector badge is mandatory and CI verifies it resolves, so the connector namespace
   must be confirmed first.

If the operator waives (1) and (2), this is one PR and it is the highest-yield one available.

## Blocked, with the evidence

- **MCPFind / mcpfind.org** — its CONTRIBUTING requires "published to npm, PyPI, or available as a
  Docker image". An `.mcpb` bundle on a GitHub release does not qualify, and npm remains
  human-gated. Unblocks the day `npm login --auth-type=web` happens.
- **5ire / mcpsvr** — the index is stdio `command` plus `args` only, with no `url` field. Our stdio
  artefact is an mcpb bundle, which is not an `npx` target, and wrapping the hosted endpoint in
  `mcp-remote` cannot carry a per-user token cleanly. Also npm-gated, and 6 PRs have sat open since
  2026-06-18.
- **Chatbox** (41,710 stars, the largest client catalogue found) — the PR is mechanical, but the
  template requires ticking a contributor agreement granting its proprietary edition free
  commercial rights. That is a licensing decision, not an agent's call.

## Human-gated, with the exact gate

| Surface | URL | What a human must do |
|---|---|---|
| Postman MCP Network | learning.postman.com/docs/postman-ai/mcp-servers/promote/ | Postman account, verified publisher status, a public workspace holding the server, then an email to api-network@postman.com |
| Apify store, MCP category | console.apify.com | Sign in, build and publish an Actor. The `apify/actor-mcp-servers` repo explicitly refuses code contributions |
| n8n creator hub | creators.n8n.io/nodes | Account, plus an npm package published with GitHub Actions provenance (mandatory since 2026-05-01). Its verification rule is one third-party service per package, which disqualifies a 32-server fleet outright |
| findmcp.dev | findmcp.dev/submit | Web form, "free and takes under 2 minutes" |
| mcp.so free route | mcp.so/submit | Behind a GitHub Sign In |
| GitHub MCP Registry, partner route | partnerships@github.com | An email, named in a third-party onboarding issue |

## Dead, or no route at all

Verified negatives, so no future round spends time on them:

- **smallcloudai/refact — ARCHIVED.** `gh pr create` refused with "Repository was archived so is
  read-only"; `archived: true`, last push 2026-05-30. Its 161-server marketplace index has been
  stale since 2026-04-26.
- **Roo Code marketplace — RETIRED.** `RooCodeInc/Roo-Code-Marketplace` 404, and both
  `api.roocode.com/api/marketplace` and `/marketplace/mcps` return **HTTP 410 Gone**.
- **mcphub.dev — RETIRED** by its own notice.
- **PulseMCP — submissions paused**, stated on the page on 2026-09-03. `distribution.json` records
  this as "blocked"; the reason is now known and it is not at our end.
- **Tome** archived; **Jan**, **Cherry Studio**, **DeepChat**, **Kiro**, **Antigravity**, **Trae**,
  **Warp**, **Cloudflare**, **Witsy** — each either has no catalogue, a first-party-only catalogue,
  or a catalogue with no discoverable submission route. Details per surface in the JSON.
- **e2b-dev/awesome-mcp-gateways**, **soxoj/awesome-osint-mcp-servers**,
  **WagnerAgent/awesome-mcp-servers-devops** — alive and merging, but the vertical is gateways,
  OSINT and DevOps. These 32 servers are back-office tools. Submitting would be spam.

## One reusable lesson

Refact's marketplace advertises the official MCP registry as a source. Reading the code,
`fetch_official_registry_servers` builds `?limit=<=100`, discards the search query and never
follows `nextCursor`. A client that says "registry-backed" may only ever see the registry's first
page, which for a catalogue of 20,000-plus servers means almost nobody. **Being in the official
registry is not the same as being visible in a client that reads it.** Check the fetch, not the
claim. The same mistake in reverse is what produced round 1's subfolder hypothesis: a deprecated
endpoint that silently dropped the field under test.
