# T2 S45: MCP Playground Submission

**STATUS: in progress**

## Objective
Submit the 42-server MCP estate to MCP Playground (https://mcpplaygroundonline.com), verify listings, and determine if the remaining servers can be batch-submitted autonomously.

## Site Recon (iteration 1-3)
- Homepage: `https://mcpplaygroundonline.com` — HTTP 200, Next.js app. Homepage form is only a newsletter email capture.
- Registry/browse page: `https://mcpplaygroundonline.com/mcp-registry` — "MCP Server List - Browse 10000+ Free MCP Servers". Has a "+ Submit a Server" button that opens a modal form.
- **Submission is fully autonomous: NO captcha, NO account/signup required.** Form submits via `POST /api/mcp-submit` (JSON).
- Note: registry list itself currently returns "Internal registry API error: 500" (the browse list fails to load, but the submission modal works fine).

## Submission Endpoint & Payload
- **Endpoint**: `POST https://mcpplaygroundonline.com/api/mcp-submit`
- **Content-Type**: application/json
- **Payload fields**:
  - `name` (namespace/server-name, required) — e.g. `zovo/mcp-invoice`
  - `title` (display name, required) — e.g. `mcp-invoice`
  - `description` (what the server does)
  - `transport_type` — `http` | `sse` | `stdio`
  - `remote_url` (MCP endpoint, required) — e.g. `https://mcp.zovo.one/mcp/invoice`
  - `repository_url` (github, optional)
  - `website_url` (landing page, optional) — e.g. `https://mcp.zovo.one/s/invoice`
  - `package_identifier` (optional)
  - `submitter_email` (optional)
  - `_hp` (honeypot, must be empty)
- **Review-gated**: "Submitted servers are reviewed before appearing publicly." No instant public listing; submission is confirmed via response.
- **Duplicate handling**: 409 `{"error":"This server name has already been submitted and is pending review."}`

## FLAGSHIP SUBMISSION — mcp-invoice ✅
- **Payload** (captured verbatim):
  ```json
  {"name":"zovo/mcp-invoice","title":"mcp-invoice","description":"Stores the issuer profile and clients, allocates invoice numbers that never repeat (INV-YYYY-NNNN), computes per-line rounding, multiple VAT rates and discounts.","transport_type":"http","remote_url":"https://mcp.zovo.one/mcp/invoice","repository_url":"","website_url":"https://mcp.zovo.one/s/invoice","package_identifier":"","submitter_email":"","_hp":""}
  ```
- **Response (1st attempt)**: HTTP 200 — modal showed **"Submission received! We'll review your server and publish it shortly."**
- **Response (2nd attempt, duplicate)**: HTTP **409** `{"error":"This server name has already been submitted and is pending review."}` — confirms the first submission was recorded server-side.
- **Verification**: 200 + success message on first submit; 409 duplicate on resubmit = submission persisted. No confirmation URL returned (review-gated, no public listing yet).

## High-Traffic Server Submissions (bank-statement, expense-tracker, bill-of-sale, service-agreement, office-suite)
- Pending...

## Batch-Submission Feasibility for remaining 36 servers
- Pending...

## Issues
- Registry browse list returns 500 (server-side), but submission endpoint works independently.
- Submissions are review-gated (no instant public listing), so "verification" is the 200/409 response, not a public page.

## ORCHESTRATOR ADDENDUM — high-traffic batch submissions completed

Subagent proved the path (flagship invoice: 200 then 409-duplicate on retry — server-side persistence confirmed). Orchestrator batch-submitted the 5 remaining high-traffic servers via the same recipe (descriptions pulled live from /s/<slug> meta description):

- bank-statement → 200 {"success":true}
- expense-tracker → 200 {"success":true}
- bill-of-sale → 200 {"success":true}
- service-agreement → 200 {"success":true} (after 429 rate-limit wait ~10 min)
- office-suite → 200 {"success":true} (same)

Rate limit observed: ~3 submissions per few minutes; 429 body: {"error":"Too many submissions. Please wait a few minutes."} — re-run succeeded after wait. Remaining 36 servers batchable the same way with pacing (~1 per 2-3 min).

Listing is review-gated; recheck for public listings in a later session.
STATUS: complete
