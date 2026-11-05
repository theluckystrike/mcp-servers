# s1103 optin: double opt-in update list on www.mcpstamp.com

Live 2026-11-03. One email about once a month listing the new free MCP servers and Can Claude answers. Nobody is on the list until they click the confirmation link and press the button.

## What visitors see
- Form (email only, plus hidden source page and a honeypot) on /free-servers/, /can-claude/ and the footer of all 33 /can-claude/<slug>/ pages. The copy says what they get, how often, that a confirmation comes first, that every email has an unsubscribe link, and links /privacy/#updates.
- Notice pages /updates/check-email/, confirm-email/, confirmed/, leave/, unsubscribed/, problem/. All are noindex and none are in the sitemap (still 195 URLs).
- Privacy page (updated 3 November 2026), section 7 "Setup tips and the update list", #updates. It covers what is stored (the email, plus the date Resend added it, only after confirm), where it is stored (Resend audience mcpstamp-updates), how to unsubscribe, and the hashed rate-limit counters. The page also has a consent row in legal bases, a retention row and a Resend recipient line. "This website has no signup form" was removed.

## How it works
- The backend is Pages Functions in mcp-showcase-preview: site/functions/updates/{subscribe,confirm,unsubscribe}.js and site/lib/optin.js. No Worker was touched.
- subscribe: checks Origin, applies the per-IP limit (5 per 10 min, invalid tries count), drops honeypot posts, validates the email, applies the per-email limit (2 sends per hour), then sends via Resend from "McpStamp updates <hello@zovo.one>" with reply-to support@zovo.one. It stores nothing. Limits live in isolate memory plus the Cache API, with hashed keys. No KV.
- confirm: the link holds an HMAC-signed token that expires after 3 days. GET only shows a button, so mail scanners that open links cannot subscribe anyone. POST adds the contact to audience mcpstamp-updates (0bddb949-303b-42d6-b9bd-51f949bdc03e).
- unsubscribe: the link (no expiry) is in every email, along with List-Unsubscribe and List-Unsubscribe-Post one-click headers. It deletes the contact.
- Pages secrets are OPTIN_HMAC_SECRET (random, piped in) and OPTIN_RESEND_KEY. The Resend key is named "mcpstamp-optin-2026-11-03" (id 0b1cd435-2311-4ce6-b7cb-9fe62f5715b9) and has full_access, because the contacts API needs it. Neither secret was ever written to disk or git. Revoking that key turns the form off and leaves the other keys alone.
- No Turnstile: the Cloudflare API lists widgets only for boldtake.io and belikenative.com.

## Verification (live, curl plus the Resend API)
- Resend GET /domains: zovo.one is verified with sending enabled. The audience did not exist, so it was created with POST /audiences.
- Bad origin returned 403, a bad email 400 (JSON and HTML), the honeypot 200 with no send, and GET 405.
- The setup doc names no test inbox, so the test used delivered@resend.dev. Subscribe returned 200 with id 01a1a15b-81be-7d9b-b01e-2454282995dd, and GET /emails/{id} showed last_event delivered. Confirm GET returned 200 and the audience still held 0 contacts. Confirm POST returned 303 to /updates/confirmed/ and the audience held 1 contact (delivered@resend.dev). One-click unsubscribe POST returned 303 and the audience went back to 0, which also removed the test contact.
- Rate limit: 7 bad-email POSTs returned 400 429 429 429 429 429 429.
- Emails sent in total: 1. GET /emails?limit=20 shows exactly one confirmation email.
- Humanize: the control run failed the bad sample (exit 1) and passed the clean one (exit 0). Then all new copy and the email body passed --strict with exit 0.

## Deploy
- Pre-checks: 35 GB disk, 62% memory free, no deploy or build running, only this lane's files changed, and local = origin = live (0dceb83 / 5161b1dd).
- Commit eb38715 on theluckystrike/mcp-showcase-site (1 push). Deployment 349c794b-a8c8-458e-accd-1395b0716ad3, previous 5161b1dd-c9bb-4043-b26b-dbcb3d51e1ef.
- Rollback: `npx wrangler pages deployment rollback 5161b1dd-c9bb-4043-b26b-dbcb3d51e1ef --project-name mcp-showcase-preview`

## How the owner sends the monthly update
Dashboard: open resend.com > Broadcasts > Create. Pick audience "mcpstamp-updates" and set From to `McpStamp updates <hello@zovo.one>` and Reply-To to support@zovo.one. Use a subject such as "New free MCP servers, November 2026". List each new /free-servers/ and /can-claude/ page with one line on what it answers. Put `{{{RESEND_UNSUBSCRIBE_URL}}}` in the footer, send a test to yourself, then Send. Once a month at most, which matches what the form promises.

API (same result):
```sh
curl -s -X POST https://api.resend.com/broadcasts -H "Authorization: Bearer $RESEND_API_KEY" -H 'content-type: application/json' \
  -d '{"audience_id":"0bddb949-303b-42d6-b9bd-51f949bdc03e","from":"McpStamp updates <hello@zovo.one>","reply_to":"support@zovo.one",
       "subject":"New free MCP servers, November 2026","html":"<p>...</p><p><a href=\"{{{RESEND_UNSUBSCRIBE_URL}}}\">Unsubscribe</a></p>"}'
curl -s -X POST https://api.resend.com/broadcasts/<id>/send -H "Authorization: Bearer $RESEND_API_KEY"
```
Unsubscribing from a broadcast link marks the contact unsubscribed=true in Resend, and later broadcasts skip it. The site's own link deletes the contact. Both paths stop mail.

## Open
- The audience is empty. Signups will show up as Resend contacts.
- If bots get past the honeypot, create a Turnstile widget for www.mcpstamp.com (owner) and add it to the form.

Evidence: optin/ (audience_create.json, email_receipt.json, real.json, build.log, deploy.log, rollback.txt, hz_*.txt).
