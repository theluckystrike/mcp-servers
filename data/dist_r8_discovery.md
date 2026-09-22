# dist_r8_discovery.md — Round 8 directory discovery sweep
DATE: 2026-09-22 | STATUS: shipped (orchestrator-verified, curl evidence per row)
Previous delegation (deleg_dc4e571a) produced nothing — this file was rebuilt directly from live probes.

## 1. Auto-index status (verified via curl)
| Aggregator | zovo listed? | Evidence | Action |
|---|---|---|---|
| mcp.so | NO (0 results, total:0 in SSR payload) | search?q=zovo → total:0 | FREE path: GitHub issue submission (per mcp.so Submit page). PAID: $39 one-time, dofollow, instant. ⇒ ISSUE DRAFTED below. |
| smithery.ai | NO | search?q=zovo → 0 listing hits | Free listing requires npm/GitHub-registry package naming (smithery.yaml). Blocked on packaging decision — see priority list. |
| pulsemcp.com | NO | 403 on search (bot-guard), zero known listings | Human-gated / needs manual check in browser. |
| mcpservers.org | NO | 403 search (bot-guard) | Has FREE submit form at mcpservers.org/submit — actionable-today via browser. |
| influzer.ai | SUBMITTED 09-22 | form accepted: "submission was received and will be reviewed shortly" | Wait for review email (hello@zovo.one). |

## 2. Actionable-today (ranked, biggest organic win first)
1. **mcp.so GitHub issue (FREE)** — DR 72, 2.2M visits/12mo. File issue per their Submit button. Cost: 0.
2. **mcpservers.org/submit (FREE form)** — bot-guarded but form is open; browser submit next sprint.
3. **mcpfinder.org/submit (FREE form)** — confirmed live /submit page, free tier.
4. **influzer.ai** — DONE 09-22 (pending review).

## 3. Human-gated / deferred
- mcp.so PAID $39 (dofollow DR-72 link) — user decision; skip while free tier untested.
- smithery.ai — requires smithery.yaml packaging; defer to packaging sprint.
- Anthropic MCP directory — paid Team plan required; skip.

## 4. Ready-to-paste entries
**mcp.so issue (copy verbatim):**
- Name: zovo.one MCP Servers
- URL: https://mcp.zovo.one
- Repo: https://github.com/theluckystrike/mcp-servers
- Description: 47 production MCP servers for freelancers — invoice, PDF, DOCX, time-tracker, expense-tracker, petty-cash, per-diem and more. Free remote streamable-http endpoints (https://mcp.zovo.one/mcp/<server>), no install. Pro: $19/server or $39 bundle.

**mcpservers.org / mcpfinder.org form fields:** same as above; category "Files & Docs" or "Payments & Commerce"; transport http; docs https://mcp.zovo.one/servers.

## 5. Note
Punkpeye/rohitg00/wagneragent/habitoai PRs unchanged this round (12 open, 8 merged cumulative) — no new activity detected.
