# T5 Community Outreach R2

STATUS: complete (drafts only — nothing posted)

Goal: Find 3 genuine GitHub help asks (2026-dated, open issues) that match our free HTTP MCP servers, and draft value-first replies. DRAFTS ONLY — nothing posted, nothing committed.

## Ranked matches

| # | Issue | Ask (quote) | Server that answers it | Draft |
|---|---|---|---|---|
| 1 | [kimai/cli #32](https://github.com/kimai/cli/issues/32) — *Add invoice PDF generation* (open, 2026-09-08) | "Could we add support for generating invoice PDFs through Kimai's API? Would this first require an endpoint that accepts invoice generation options and creates the PDF server side?" | `invoice` — https://mcp.zovo.one/s/invoice | [draft-01](docs/outreach/R2/draft-01-kimai-invoice-pdf.md) |
| 2 | [gasparyanvazgen/tally #18](https://github.com/gasparyanvazgen/tally/issues/18) — *Implement real invoice PDF generation* (open, 2026-08-27) | "Build an invoice PDF template. Include business information, client information, invoice number, issue date, billing period, line items, hours, rate, subtotal and total." | `invoice` — https://mcp.zovo.one/s/invoice | [draft-02](docs/outreach/R2/draft-02-tally-invoice-pdf.md) |
| 3 | [Brandrei/skills-integrate-mcp-with-copilot #13](https://github.com/Brandrei/skills-integrate-mcp-with-copilot/issues/13) — *Expense Management & Cost Tracking* (open, 2026-04-15) | "Track operational expenses for activities and compute profitability metrics… Record activity-related expenses, categorize expenses, calculate net revenue per activity, generate expense reports." | `expense-tracker` — https://mcp.zovo.one/s/expense-tracker | [draft-03](docs/outreach/R2/draft-03-brandrei-expense-tracker.md) |

## Draft links

- docs/outreach/R2/draft-01-kimai-invoice-pdf.md
- docs/outreach/R2/draft-02-tally-invoice-pdf.md
- docs/outreach/R2/draft-03-brandrei-expense-tracker.md

## Posting checklist (needs approval)

1. **Re-check each issue is still OPEN** and that no one has already answered with the same angle (data-contract / server-side / integer-minor-units reframe). If answered, skip — do not add a redundant comment.
2. **Confirm the linked server still matches the question** at post time (invoice for #32 and #18; expense-tracker for #13).
3. **Paste the draft as-is**, keeping the disclosure line ("I built this server") and the config snippet.
4. **Do NOT ping or mention maintainers.** Do not post on any issue that is closed, or where a maintainer has already identified a real bug/regression that contradicts the draft.
5. **Verify the token URL** `https://mcp.zovo.one/mcp/connect` still mints tokens and the `/mcp/<server>/t/<token>` path form still works before posting.
6. **Posting surfaces:** all three are GitHub Issues, `OPEN` with a GitHub account (theluckystrike). No new accounts needed.

## Method / evidence

- Searched `gh search issues` (read-only) across invoice, expense, PDF billing, mileage, petty cash, bill of sale, dunning, service agreement, bank reconciliation, bookkeeping, docx terms.
- Filtered to 2026-dated OPEN issues that are genuine help asks (not our own marketplace submissions, not bug-in-own-code reports, not internal product plans, not validation-lab problem statements).
- Rejected candidates: `pankaj-gkm/mcp#1` (bug in their own demo, not a request), `Coil-Legal/coil#9` (QA finding against own product), `muaddibco/RealWorldProblems#842` (validation-lab problem statement, not a help ask), `wuyonghui0810/invoice_ocr_mcp#1` (Chinese bug report on own server), `studio-my/messaging#1` (internal plan), `shreyas-pachpute/dispatch#5` (internal roadmap), `Jcal-4/Spendo#9` (2025-dated, outside window).
- `gh search discussions` is not available in this gh CLI version (only code/commits/issues/prs/repos), so issue search was used exclusively.
- Endpoint format confirmed from repo docs: hosted HTTP MCP at `https://mcp.zovo.one/mcp/<server>/t/<token>`, token minted at `https://mcp.zovo.one/mcp/connect`.
