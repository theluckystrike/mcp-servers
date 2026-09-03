# Plan v2 (2026-09-03, loop 5)

Orchestrator: Claude Fable 5.1. Executors: Claude Opus and Sonnet agents, Codex (GPT) for independent review. Zero paid APIs. No paid submissions. No emojis.

## Measured state at the start of loop 5

| Metric | Value | Source |
|---|---|---|
| Products | 11 servers + office-suite bundle, 106 tools | data/ledger.json |
| Unit tests | 399 passing | npm test |
| Live validation database | 241/241 | data/validation.json run 50 |
| User value through a real MCP client | R1 28/39, R2 37/39, R4 20/24, R5 26/30, R6 13/24 (client reach), R7 16/18 | data/user_value*.json |
| Registry entries | 12 at v0.4.0, 8 hosted | data/distribution.json |
| Hosted endpoints | 8 of 11 servers | docs/REMOTE_RESULT.md |
| Mirror repos | 9 of 12 | docs/MIRRORS_RESULT.md |
| Pages on mcp.zovo.one | 116 sitemap URLs | docs/CONTENT_R4_RESULT.md |
| Bundle downloads | 290 | data/metrics.json |
| GitHub views, stars, sales | 0, 0, 0 | data/metrics.json, Stripe |
| Organic fleet score (noisy-OR) | 99.2, best surface 34.5 | data/organic.json |

## Where value is lost (from seven rounds)

1. Seams between servers, not arithmetic inside them. Every round-3 to round-7 defect was a handoff: currency of a line, a billed flag, a placeholder issuer, a renamed tool.
2. Client tool selection, not server behaviour. Round 6: 8/8 correct on direct probe, 5/8 reached through the client.
3. Silent partial results. The costly defects returned a plausible answer with no signal: truncated history, capped loop, partial file.

## Specs for this loop (each has a pass condition that a script can check)

### S1 Host the last three servers
- Endpoints /mcp/resume, /mcp/recurring, /mcp/clauses on the existing worker; vendored engines mapped ("@theluckystrike/mcp-docx/lib", "@theluckystrike/mcp-invoice/lib"; invoice lib re-exports renderInvoicePdf which the remote replaces with the HTML shim).
- Pass: scripts/validate.mjs remote block lists 11 endpoints with tools/list >= 8 each and one real call per new endpoint; registry entries for the three carry remotes[].

### S2 Mirror repos for the last three
- scripts/sync-mirrors.sh vendors @theluckystrike/* siblings recursively with file: deps; fresh clone builds and tests.
- Pass: three repos exist, `git clone && npm install && npm run build && npm test` green on each.

### S3 Round 8: a freelancer week through the eleven-server bundle
- One conversation, free tier, fresh state: onboarding, time, expenses, currency, proposal, contract, invoice, recurring, resume tailoring, meeting slot, spreadsheet export.
- Pass: every number verified from stores and files; every seam defect gets a fix with a test in the same loop.

### S4 Contract specs per server
- servers/<name>/SPEC.md generated from source plus audits: tools with input schema, invariants (money in minor units, local dates, no partial writes, quarantine on corrupt store), free/pro table, failure modes with the exact error text, storage paths.
- test/contract.test.mjs per server asserts the invariants that can be asserted mechanically (no partial file on cap, corrupt store quarantined, JSON-RPC-only stdout, tool descriptions under 220 chars and starting with an imperative for file/URL tools).
- Pass: 11 SPEC.md files, 11 contract suites green, validate.mjs still green.

### S5 Independent review of the newest servers
- Codex reads resume, recurring, clauses; P1s fixed with tests.
- Pass: docs/CODEX_REVIEW_V5.md plus a fixes section.

### S6 Dashboard user-value tab
- One consolidated view: per-round totals as a trend, per-server matrix (best score, last round tested, open defects), seam-defect ledger with status.
- Pass: index.html#uservalue renders the matrix from data/user_value*.json without hand edits.

## Not in this loop (human-gated or measured as low value)
npm login, Smithery and cursor.directory logins, Claude Desktop directory form, awesome-mcp-servers emoji tags, paid directories, X and LinkedIn posts (measured near-zero return).

## Budget
Six agents in wave A, 30-45 minutes each. Release v0.4.1 only if source changes. Dashboard, memory, sound at the end.
