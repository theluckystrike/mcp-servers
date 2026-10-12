# mcp.zovo.one Outreach Send Engine — s20261012

STATUS: complete

## Usage / How to approve+send a batch

Engine: `scripts/outreach_send.mjs` (Node 22, no deps). Sender: `MCP Servers <hello@zovo.one>` (zovo.one verified, sending enabled). Every attempt is appended to `data/outbox.json` as `{ts, to, status, resend_id, campaign}`.

**Dry-run (default, logs only — nothing is sent):**
```bash
cd /Users/mike/mcp-servers && source ~/.zshrc
node scripts/outreach_send.mjs --input data/outreach_targets.json --dry-run
```

**Approve + send a live batch (after user review):**
```bash
cd /Users/mike/mcp-servers && source ~/.zshrc
node scripts/outreach_send.mjs --input data/outreach_targets.json --live
```

Safety rails in the engine:
- `--dry-run` is the default; `--live` is opt-in and refuses to run without a `re_…` key.
- Hard cap: **max 10 sends per run**; 3s pause between sends (rate limit).
- Only rows with `channel:"email"`, `status:"ready"` and a `to` address are sent. Rows with `channel:"manual"` are logged as `skipped:manual` and never emailed.
- Outbox is append-only JSON at `data/outbox.json`.

**How to add an email-eligible target** (when a public email is confirmed): edit `data/outreach_targets.json`, add a row:
```json
{"draft_ref":"R5/01-…","channel":"email","target":"maintainer X","to":"x@host.com","subject":"invoice","status":"ready","campaign":"invoice","body":"<p>…</p>"}
```
Shape example: `data/outreach_targets.example.json`.

## Target list summary

Consolidated list: `data/outreach_targets.json` — **18 targets from all R1–R4 drafts** (7 R1, 3 R2, 6 R3, 2 R4).

**Key finding: zero email-eligible targets.** All R1–R4 drafts target GitHub issues/discussions, Reddit threads, and a dev.to tutorial — comment channels with no public email. All 18 are therefore `channel:"manual"`; none are emailed. The engine's email path is built and tested (dry-run) and ready for future email targets.

Targets by channel:
- GitHub issues/discussions: 12 (modelcontextprotocol #325, #541; kimai/cli #32; tally #18; skills-integrate-mcp-with-copilot #13; life-mathematics #3; stu-ai-web #2; finance-tracker #296; sololedger #5; kei3 #56; hr-dashboard-v2 #126; writ #28; ledgerfield #29)
- Reddit: 4 (r/ClaudeAI, r/LocalLLaMA, r/ollama, r/Netsuite)
- dev.to: 1 (comment on Claude Desktop MCP tutorial)
- Email: 0

Campaigns: mcp-server-startup-config-checklist (3), pdf-merge-split-stamp-from-chat (1), invoice-pdf-from-chat / invoice (5), mcp-on-windows-paths-and-npx (1), expense-tracker / budget / receipts / payroll / loan / pomodoro / tax / stripe (1 each).

Note: R3/R4 rows carry `note` fields — 7 were already posted 2026-09-28 (comment IDs recorded); kei3 #56 was skipped (issue paused).

## Engine design

- `scripts/outreach_send.mjs` — ESM, `fetch` to `POST https://api.resend.com/emails` with `{from, to:[…], subject, html}`. Body from row `body` (HTML) or `body_text` (auto `<br>`).
- Modes: `--dry-run` (default) logs `would send` + writes outbox entry `status:"dry-run"`; `--live` sends, records `sent` / `error:<http code>` / `exception` with Resend response.
- Env: `RESEND_API_KEY` from shell (`source ~/.zshrc`); aborts if missing or not `re_…` prefixed in live mode.
- Domain check: `GET https://api.resend.com/domains` confirms `zovo.one` status `verified`, sending `enabled` (account also has ml0x.com and belikenative.com verified).

## Evidence log

- 2026-10-12 iter 1: deliverable scaffold created; drafts discovered: R1 7, R2 3, R3 6, R4 2 = 18.
- iter 2: extracted thread URLs + titles from all 18 drafts (R1/07 dev.to has no fixed URL — pick live at post time).
- iter 3: wrote `scripts/outreach_send.mjs`; wrote `data/outreach_targets.json` (18 rows, all channel:manual, status:ready, thread_url + campaign + note fields).
- iter 4: Resend API verified live: `GET /domains` → zovo.one `verified`, capabilities.sending `enabled`.
- iter 5: dry-run bug fixed (input accepts bare array or `{targets:[…]}` wrapper).
- iter 6: dry-run of full 18-target list: exit 0, 0 email / 18 manual, all logged.
- iter 7: added outbox entries for manual rows (`skipped:manual`); created `data/outreach_targets.example.json` fixture.
- iter 9 (verification): `node --check scripts/outreach_send.mjs` syntax OK; full-list dry-run exit 0; fixture dry-run exit 0 (`sent=0, failures=0`); outbox append verified. All checks pass. Live POST path unexercised by design (first real sends after user review).
