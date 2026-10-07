# New-server picks — session 2026-10-07 (agent brief, read-only)

Four picks to extend the 54-server estate; all pure-JS, stdio + streamable-http,
Cloudflare Workers-safe, ~12-17 tools each. Ranked by demand evidence.

1. **crm-lite** — contacts/companies/deals/pipeline + notes & stats.
   Evidence: HubSpot MCP ranked #1 Marketing/Sales in Skyvia's 2026 top-12;
   vendor-locked official CRM remotes (HubSpot/Salesforce/monday) dominate;
   ZoomInfo/Merge.dev/GetKnit all published CRM-MCP guides in 2026.
   Fits the office/business estate (invoice, payroll, retainer) — pipeline
   completes the freelancer suite.

2. **email** — send/reply/draft/search/label/schedule via Gmail REST or Resend
   (no IMAP sockets, Workers-safe).
   Evidence: Inbox Zero ~12k stars (#54 mcpmarket top-100); biggest uncaptured
   channel in our estate; we already run Resend for license delivery, so the
   Resend path needs zero new infra.

3. **e-signature** — envelopes, signers, fields, reminders, audit trail
   (WebCrypto + R2/D1).
   Evidence: whitespace — no e-sign server in mcpmarket top-100 despite
   DocuSign-class demand. Completes docx → pdf → invoice → signed pipeline.

4. **meal-planner** (consumer) — recipes, pantry, weekly plan, shopping list.
   Evidence: Mealie 13.3k stars, multiple independent MCP forks spawned Sep 2026;
   Reddit builder activity (Mealift, Pantry Aide, yamp). Consumer wedge for
   traffic the office estate doesn't reach.

Order of build: crm-lite first (highest organic + monetization overlap with
existing buyers), then email (reuses Resend), then e-signature, then
meal-planner as the traffic wedge.

Source: subagent brief (deleg_e643ddcc), session 2026-10-07.
