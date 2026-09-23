# SURFACE SWEEP R3

**STATUS: complete** (orchestrator-verified; subagent's report write failed, recovered from transcript + re-probed live)

Read-only sweep of MCP directory/distribution surfaces: probe pending submissions for status flips and scout new free surfaces.

Date: 2026-09-23. Repo: /Users/mike/mcp-servers. Source of truth: data/distribution.json. Constraint honored: no PRs/issues created, no pushes.

## Status flip table (surface | old status | new status | evidence)

| surface | old status | new status | evidence |
|---|---|---|---|
| punkpeye/awesome-mcp-servers | "submitted: 4 single-server PRs, 1 all-green" | **CHANGED: PR 13473 CLOSED (unmerged)**; 12 of our PRs now open | `gh pr view 13473`: state=CLOSED closedAt=2026-09-07T14:47:53Z mergedAt=null labels=[missing-glama, has-emoji, valid-name]. Author search: 14 PRs total = 2 closed (5768, 13473), 12 open (13963–13966, 14559–14565, 14681). Open PRs carry labels [has-emoji, valid-name, **has-glama**] — the glama blocker is fixed on new PRs. Repo has 2,220 open PRs; queue is very long. Old PR 5768 also CLOSED unmerged (closedAt 2026-09-15). |
| MobinX/awesome-mcp-list | submitted | **MERGED** | `gh pr view 420`: mergedAt=2026-09-14T11:10:12Z, state MERGED. Live listing to verify in README. |
| abordage/awesome-mcp | submitted | **MERGED** | `gh pr view 106`: mergedAt=2026-09-14T06:52:29Z, state MERGED. Note: README is generated from repositories.yaml — check rendered output. |
| rohitg00/awesome-devops-mcp-servers | pr-open | pr-open (unchanged) | `gh pr view 338`: state=OPEN mergedAt=null. 1,022 stars. |
| wagneragent/awesome-mcp-servers-devops | pr-open | pr-open (unchanged) | `gh pr view 81 --repo wagneragent/awesome-mcp-servers-devops`: state=OPEN mergedAt=null. 97 stars. |
| YuzeHao2023/Awesome-MCP-Servers | submitted | open (unchanged) | `gh pr view 473`: state=OPEN. 1,066 stars. |
| mctrinh/awesome-mcp-servers | submitted | open (unchanged) | `gh pr view 112`: state=OPEN. |
| JustInCache/awesome-mcp-collection | submitted | open (unchanged) | `gh pr view 44`: state=OPEN. |
| collabnix/awesome-mcp-lists | submitted | open (unchanged) | `gh pr view 112`: state=OPEN. |
| habitoai/awesome-mcp-servers | submitted: review answered | open (unchanged) | `gh pr view 144`: state=OPEN. |
| glama | "partially indexed: 1 of 33 sampled" | **improved: 3 of 10 sampled now 200** | curl sample 2026-09-23: mcp-checklist 200, mcp-statement-of-account 200 (was 404 in data/), mcp-office-suite 200. Still 404: mcp-invoice, mcp-spreadsheet, mcp-pdf, mcp-quotes, mcp-work-order, mcp-time-tracker, mcp-expense-tracker. Glama ingest is slow but progressing. |
| docker-mcp-catalog | closed by us: blocked on build defect | unchanged (not re-openable until Docker build verified) | no state change possible; still blocked on local Docker daemon. |
| mcp-playground / mcpfinder / agenticskills / futuretools | pending review / published | unchanged — web review queues, not probeable without accounts | no live status endpoints; keep to scheduled recheck cadence. |

Note: the subagent summary claimed "modelcontextprotocol/servers PR 500 MERGED" as one of ours — verified: it merged 2025-01-08 and is **not ours** (historical unrelated PR). Discounted.

## New free surfaces scouted

Cross-checked via `gh search repos "awesome mcp servers" --sort stars` against data/distribution.json. 3 NEW surfaces found (rules read from repo READMEs; no CONTRIBUTING.md exists in any of them):

| surface | stars | submission rules | verdict |
|---|---|---|---|
| PipedreamHQ/awesome-mcp-servers | 284 | README-only list; entries link to mcp.pipedream.com hosted pages. No CONTRIBUTING.md, no stated rules. **Caveat:** stale (last push 2025-03-30). | LOW priority — dormant repo, entries are Pipedream-hosted format. |
| ever-works/awesome-mcp-servers | 107 | README is a pure list on `master`; no CONTRIBUTING.md, no submission rules found. Pushed 2026-08-04 (semi-active). | OK — plain PR adding bullet rows, same pattern as our merged MobinX/abordage PRs. |
| agenticdevops/awesome-devops-mcp | 41 | README: "Contributions are welcome! Please feel free to submit a Pull Request… follow our contribution guidelines" — but CONTRIBUTING.md is 404 (badge references missing file). DevOps-focused. | OK — plain PR; fits time-tracker/work-order/uptime-monitor angle (overlaps our open rohitg00 + wagneragent PRs). |

Also confirmed already-known/covered: wong2 (pushed 2026-07, no change), chatmcp/mcpso (stale since 2025-03), TensorBlock, appcypher.

## Failures

- Subagent hit its 30-iteration cap during punkpeye PR enumeration and never ran `gh search repos`; its final `write_file` also failed (malformed tool-call block) leaving a stub file. All evidence above was recovered by the orchestrator from its transcript and re-probed live.

## Insight

1. punkpeye (95k stars) has 2,220 open PRs — our 12 open PRs there are effectively frozen; the two closed ones (13473, 5768) both died on missing-glama at close time. New PRs label clean (has-glama), but expected time-to-merge is very long. Effort is better spent on mid-size lists (MobinX/abordage merged within ~1 week of submission).
2. MobinX + abordage merges = 2 new live listings to verify and add to distribution.json as "live".
3. Glama indexing is happening but lagging registry by weeks; 3/10 sampled now live (up from 1/33). Keep the weekly recheck — no action available to accelerate.
4. The "PR 500 merged in modelcontextprotocol/servers" claim in the raw subagent output was a false positive (2025-era, not ours) — always re-verify subagent claims before applying to data/.

## Cost

Orchestrator: ~14 tool calls to recover + verify + finalize. Subagent: 30/30 iterations (cap), 573.77s.

## Artifacts

- This file: docs/SURFACE_SWEEP_R3.md
- Subagent transcript: /Users/mike/.hermes/cache/delegation/live/deleg_194a3f4c/task-0.log

## For orchestrator to apply to data/distribution.json

- abordage-awesome-mcp → status "live" (PR 106 merged 2026-09-14)
- mobinx-awesome-mcp-list → status "live" (PR 420 merged 2026-09-14)
- awesome-mcp-servers (punkpeye) → status "open: 12 PRs, 2 closed unmerged (13473/5768); repo backlog 2220"
- glama → status "partially indexed: 3 of 10 sampled (checklist, statement-of-account, office-suite)"
- add surfaces: ever-works/awesome-mcp-servers (107⭐, plain PR), agenticdevops/awesome-devops-mcp (41⭐, PRs welcome)
- skip: PipedreamHQ (dormant, wrong entry format)
