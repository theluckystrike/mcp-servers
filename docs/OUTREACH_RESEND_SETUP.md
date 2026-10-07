# Resend Outbound Email Setup — mike@zovo.one (zovo.one on Cloudflare)

STATUS: in progress

## 1. Prerequisites
- Resend account (free tier): sign up at resend.com with mike@zovo.one.
- Cloudflare login for zovo.one DNS (you'll add records there).

## 2. Domain verification
1. Resend dashboard → **Domains → Add Domain** → enter your sending subdomain, e.g. `send.zovo.one` (Resend strongly recommends a subdomain rather than the root domain, to protect root-domain reputation; `zovo.one` root also works) → region: pick closest (e.g. `iad1` or `fra1`).
2. Easiest path: Resend's Cloudflare knowledge-base page offers **"Sign in to Cloudflare"** automatic setup — it adds the records for you. Otherwise add records manually in Cloudflare (DNS → Records):
   - **TXT** DKIM record (`resend._domainkey` or similar, value from Resend) — **DNS only, NOT proxied**
   - **TXT** SPF for the sending subdomain (`send` if using `send.zovo.one`)
   - **MX** on the sending subdomain → `feedback-smtp.<region>.amazonses.com` priority 10 (bounce handling)
   - Exact values/names come from the Resend dashboard — copy them verbatim; don't guess. When pasting into Cloudflare, omit your domain from record names: `send.zovo.one` → paste only `send`. If the suggested MX priority conflicts with an existing record, try 20 or 30.
3. Cloudflare: every record set to **DNS only** (grey cloud). Proxied records break DKIM.
4. Back in Resend → click **Verify DNS Records**. Usually verifies within ~15 minutes; allow up to 72h (check with https://dns.email/; use "Restart verification" if stuck). Status must show "Verified" before sending from the domain.

## 3. API key
1. Resend dashboard → **API Keys → Create API Key**.
2. Name: `cold-outreach-prod`, Permission: **Full access** (sending needs send scope).
3. Copy the key (`re_...`) once — it's shown only at creation. Store in password manager; export locally as `RESEND_API_KEY` in your shell profile.

## 4. Sending via curl (REST API)
```bash
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer '"$RESEND_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "Mike <cold-outreach@send.zovo.one>",
    "to": ["owner@example-mcp-directory.com"],
    "subject": "Listing request: <your-server> on <DirectoryName>",
    "text": "Hi,\n\n...plain text body...\n\nMike\nmike@zovo.one\n\nUnsubscribe: reply STOP"
  }'
```
- `from` must use the verified domain. Local-part `cold-outreach@` is fine; friendly name recommended.
- Keep a per-recipient log (CSV) locally: date, address, subject, thread-id.
- For replies landing in your Gmail/whatever inbox, optionally set `reply_to: ["mike@zovo.one"]`.

## 5. Warmup & limits
- Free tier: **100 emails/day, 3,000/month**, 1 domain, low-rate limits. Paid ($20/mo Pro): 50k/mo, higher throughput.
- Resend has **no automatic warmup** — you warm up manually:
  - Week 1: ≤10–20/day; Week 2: ≤30/day; Week 3: ≤50/day; Week 4+: ramp toward 100/day.
  - Only email real, targeted owners (perfect for 1–5/day outreach — well inside warmup).
  - Keep reply rate healthy; any bounces → stop and clean the address.
- Expect Gmail/Outlook to initially defer a few messages; deliverability stabilizes after ~2–4 weeks of consistent low volume.

## 6. Compliance checklist (CAN-SPAM / GDPR basics)
CAN-SPAM (US):
- [ ] Accurate From/Reply-To and non-deceptive subject line
- [ ] Your physical postal address in the email (can be a registered business address or, minimally, a PO box — required)
- [ ] Clear opt-out: "reply STOP / unsubscribe" honored within 10 business days
- [ ] Disclosure it's a commercial message (normal outreach copy covers this)
GDPR (EU recipients):
- [ ] Legitimate-interest basis (B2B outreach about their directory is commonly relied on — keep a note of the basis)
- [ ] Keep it minimal: no tracking pixels by default, no stored data beyond name/email/why
- [ ] Honor deletion/objection requests immediately
- [ ] Personalize to the actual recipient; no scraped bulk lists (also keeps you out of spam filters)
Hygiene:
- [ ] Never send to purchased lists; verify addresses of one-off targets
- [ ] Suppress anyone who opts out permanently (local suppression list)
- [ ] Plain-text, personal, one-to-one tone — also your best spam-defense

## 7. Sequential outreach flow (MCP directory owners)
Goal: listing/collab requests to directory owners. Volume is tiny (10–30 targets total), so keep it manual and sequential — no automation needed.

- Day 0 — Email 1: subject `Listing request: <server-name> on <Directory>`. 3–5 sentences: what the server does in one line, why it fits their directory, the repo/docs URL, one specific ask ("add it to <category>?"). Plain text, their name, one detail proving you know their site.
- Day 4 — If no reply: single short follow-up in the same thread (reply, don't new-send): one new sentence of value (e.g. star count, changelog, another user), restate the ask.
- Day 10 — Final touch: "closing the loop" note; offer collab instead (cross-link, their tool featured in your README).
- Day 15+ — Stop. Move to alternate channel (GitHub issue/discord/X DM of the same directory — many MCP directories prefer PRs to their listings repo anyway; a PR is often faster than email).
- Rules: max 3 touches, never same-day follow-up, log every send, never re-add someone who replied "no".
- Note: for MCP directories specifically, GitHub PR submissions are usually the primary listing path — use email mainly when no PR path exists or for collab/feature requests.

## 8. Resend vs Loops vs plain SES
| | Resend | Loops | Plain SES |
|---|---|---|---|
| Fit for 1:1 cold outreach | ✅ great: simple REST, curl, transactional-style sending | ❌ built for marketing/newsletters to subscribers; not ideal for cold 1:1 | ✅ works but barebones |
| Setup effort | Low: domain + API key + curl | Low, but wrong tool shape | Medium: SMTP/SDK, sandbox reqs, bounce/complaint handling yourself |
| Cost at tiny volume | Free tier covers 100/day | Free tier exists but newsletter-oriented | ~free, but you own deliverability plumbing |
| Deliverability tooling | Good dashboard, logs, webhooks | Good, marketing-focused | Raw: SNS notifications, config sets, manual |
| Risk | Cold-email sending is tolerated at low volume but it's not their stated use case | Same + worse fit | Explicitly forbids unsolicited bulk; tiny 1:1 volume is fine |

**Verdict:** Resend for this use case — cheapest friction path, curl-friendly, free tier is plenty at 1–5 sends/day. Loops is the wrong shape (marketing automation). SES is viable if you already have AWS, but more setup and you handle compliance plumbing yourself. (Long-term, truly cold outreach at scale is better served by dedicated tools like Instantly/Smartlead — unnecessary at this volume.)

---
STATUS: complete
Sources: resend.com docs (domains, API reference), AWS SES policies. Values for DNS records must be copied verbatim from your Resend dashboard.
