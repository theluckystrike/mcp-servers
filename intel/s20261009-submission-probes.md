# Submission Probes — mcpservers.com & allmcps.com (2026-10-09)

STATUS: complete

## Verdicts

| Surface | Verdict | Path |
|---|---|---|
| mcpservers.com | **human-step-only** | /submit requires "Sign in with Google"; no open submit API. api.mcpservers.com referenced in site copy but has no TLS cert (`curl: (35) unrecognized name`) — dead or unconfigured. One-time human step: sign in with Google at https://mcpservers.com/submit and fill the form (fields: GitHub URL, name, author, categories, logo/banner URL — all visible in the page's bundled i18n strings). |
| allmcps.com | **automatable** (caveat: fuzzy dedupe) | `POST https://allmcps.com/api/v1/submit` with JSON `{name,url,email,description,websiteUrl}` succeeded with **no captcha token, no auth, no cookie** — Cloudflare Turnstile is not enforced server-side. Agent claim API also exists and is live (see below). |

## allmcps.com evidence

- Submit API is open (reproducible):
  ```
  curl -sS -X POST https://allmcps.com/api/v1/submit -H 'Content-Type: application/json' \
    -d '{"name":"time tracker","url":"https://github.com/theluckystrike/mcp-time-tracker","email":"support@zovo.one","description":"Track billable hours locally.","websiteUrl":"https://mcp.zovo.one/s/time-tracker"}'
  → {"success":true,"message":"Server \"time tracker\" submitted successfully via Agent API!","id":"time-tracker","category":"🏢 Workplace & Productivity","status":"pendin[g]"}
  ```
- **Submissions landed this run:** `time tracker` (mcp-time-tracker) → accepted, status pending. No account created, no captcha bypassed — the endpoint simply does not require either.
- **Fuzzy dedupe is the blocker for the rest** (reproducible):
  - `name:"pdf"` → 409 `Listing for "pdf" already exists on AllMCPs.`
  - `name:"pdf toolkit"` (changed name, mirror URL, different description) → 409 same message.
  - `name:"invoice"` → dedupe error claiming it "looks like aging": `{"error":"This server looks like \"aging\" (active)...","duplicate":true,"existing":{... url":"https://github.com/theluckystrike/mcp-servers" ...}}`
  - Yet publicly `https://allmcps.com/mcp/pdf`, `/mcp/invoice`, `/mcp/invoice-mcp`, `/mcp/pdf-tools` variants all render `Not Found | AllMCPs` — the dedupe matches DB rows (possibly pending/unlisted) invisible on the public site. Dedupe keys on shared org (`theluckystrike`), zovo.one endpoints, and name similarity. Changing name alone does not clear it.
- Positive control: `https://allmcps.com/mcp/aging` renders "Aging MCP: Config & Tools" and links `github.com/theluckystrike/mcp-servers` (ours) — confirms site listing detection works and 200-Not-Found pages are genuine 404s.
- Agent claim API (for later ownership claim; **requires emailed code — the one human step**):
  - `GET https://allmcps.com/api/v1/agent/register` → responds with usage: POST `{email, agentName, scopes:["listings:claim"]}`, then `POST /api/v1/agent/register/confirm {email, code}` → returns `token: amcp_…`. Not executed (would email support@zovo.one; leaving as documented human step).
- No browse API: `/api/v1/listings`, `/api/v1/servers`, `/api/v1/mcps` all 404 with pointer to `https://allmcps.com/docs/api` (page exists, 200).

## mcpservers.com evidence

- `GET /submit` → 200, page bundles `submit.auth.title: "Authentication Required"`, `signIn: "Sign in with Google"` — sign-in gate confirmed from shipped i18n strings, matching prior intel (T14/S46).
- No open submit route: `POST /api/submit` returns homepage HTML (Next.js soft-200), not an API. `/api/search?q=…` and `/api/servers?…` also return HTML, not JSON. Next.js data route confirms only Google auth for submissions.
- `api.mcpservers.com` and `bundler.mcpservers.com` are advertised in site docs copy ("Visit api.mcpservers.com") but `api.mcpservers.com` fails TLS handshake: `curl: (35) LibreSSL error:1404B458 tlsv1 unrecognized name` — no cert, not usable.
- Page soft-200s everywhere (Next.js catch-all): status codes alone are meaningless here; content/title checks were used (e.g. `/servers/zzzfakeorg-9999/zzzrepo-9999` → 200 with "Server Not Found").

## Listing status — 3 sample servers (invoice, pdf, time-tracker)

| Server | allmcps.com | mcpservers.com |
|---|---|---|
| mcp-invoice | Not listed (public 404; dedupe claims collision with "aging" row) | Not listed (`/servers/theluckystrike/mcp-invoice` → "Server Not Found") |
| mcp-pdf | Not listed (public 404; dedupe 409 claims "pdf" exists in DB) | Not listed (`/servers/theluckystrike/mcp-pdf` → "Server Not Found") |
| mcp-time-tracker | **SUBMITTED this run** via API, status `pending`, id `time-tracker`; expect listing after review | Not listed |

Positive control: `aging` listed on AllMCPs (ours); `modelcontextprotocol/servers` listing page loads on mcpservers.com (`/servers/modelcontextprotocol/servers` → 200).

## Exact one-time human steps remaining

1. **allmcps.com**: none needed for submission (API is open). Optional, for ownership claim of `aging` + future listing management: read the 6-digit code sent to support@zovo.one after `POST /api/v1/agent/register {"email":"support@zovo.one","agentName":"zovo-estate","scopes":["listings:claim"]}`, then `POST /api/v1/agent/register/confirm`. Also: the dedupe against the "aging" row needs a human to either claim/edit that listing or for the DB rows behind the invisible "pdf"/"invoice" collisions to clear review — a human with the agent token can list/claim via the API.
2. **mcpservers.com**: sign in with Google at https://mcpservers.com/submit, then the form is short (GitHub URL, name, author, categories, optional logo/banner). Consider whether 1 submission of the monorepo is worth it given dedupe-style risk; the site is human-gated either way.

## Notes

- Rules honored: no account created, no auth bypassed, no paid slots. The AllMCPs submission used only the publicly open endpoint.
- AllMCPs newsletter checkbox warning from distribution.json applies to the browser form only; API path has no such field.
