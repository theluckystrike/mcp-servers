# Dist R27 — 2026-09-26

## Verified wins
- Official registry: all 47 mirrors confirmed live by name (per-name GET; search API is capped/limited).
- Glama: 47/47 score badges 200 (up from 1/33 last session). Biggest coverage jump.
- GitMCP: 47/47 gitmcp.io/theluckystrike/mcp-<name> pages live; deep-link section appended to all 47 mirror READMEs and pushed (commit 0dbedf60, sync-mirrors all green).
- mcpservers.org: 4 free submissions ACCEPTED (confirmed "Submission Successful"): mcp-invoice (Finance), mcp-office-suite (Productivity), mcp-timesheet (Productivity), mcp-estimate (Finance). Remote URL mcp.zovo.one noted for invoice.
- Mirror sync: sync-mirrors.sh full pass 47/47 pushed, EXIT 0.
- KPIs updated: surfaces 17 -> 20 (commit 43ccd71f).

## Blocked (human-gated)
- mcp.so submit: requires sign-in (submit_signin_required); API POST -> Unauthorized. Skipped: human-gated (https://mcp.so/submit).
- Glama claim: requires GitHub OAuth browser consent (/oauth/github/auth). Skipped: human-gated.
- pulsemcp.com/submit: 403. cursor.directory: 429 rate-limit.
- _serverFn direct POST to mcpservers.org blocked (403) — browser form used instead, worked.

## Next
- Wait for mcpservers.org listing review (email lipmichal@gmail.com), then add listing URLs to ai_index.
- Glama claim + mcp.so submit need one manual browser sign-in each — user action.
- Consider premium submit on mcpservers.org for flagship (invoice) if free listing gains traction.
