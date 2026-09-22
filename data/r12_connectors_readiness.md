# R12 — Connectors Directory readiness

STATUS: complete (2026-09-22)

## Intel (verified via support.claude.com FAQ + claude.com/docs/connectors/building/submission)
1. Remote-server directory submission = Team/Enterprise org settings portal → human-gated. Form at claude.com/docs/connectors/building/submission is for DESKTOP EXTENSIONS (MCPB) and is publicly accessible (clau.de/desktop-extention-submission → 401 without browser session, needs human sign-in).
2. All connectors REQUIRE: OAuth 2.1 + PKCE (done R10, verified live), tool annotations title + readOnlyHint/destructiveHint (audited: 239/239 tools across 44 servers fully annotated — no work needed), privacy policy (done this round).

## Shipped this round
- `scripts/gen-manifest.mjs`: added `privacy_policies` block (source of truth for future builds).
- All 47 `bundles/*.mcpb`: privacy_policies injected in place, zip integrity verified (testzip None, manifest parses, manifest_version 0.2). Committed + pushed.
- Privacy URL live: https://mcp.zovo.one/privacy → 200.

## Remaining (human-gated, cannot automate)
- Desktop extension submission form: human signs in at https://clau.de/desktop-extention-submission, submits top MCPB bundles (billing-docs, invoice, pdf first — highest-traffic).
- Remote-server directory: requires Team/Enterprise claude.ai org → submit invoice/pdf/docx remotes from org settings portal.
