# R32 — Email unsubscribe flow shipped (2026-10-14)

## What shipped (PR #44, merged `aa1a2bcc`, deployed version 47c897d0)

One-click email unsubscribe for the entire funnel (E1 welcome + E2/E3 drip):

- `GET /api/unsub?e=<b64url email>&s=<hmac-sha256("unsub:"+email)>` — signed link,
  HMAC key = `UNSUB_SECRET` worker secret (random 32-byte, set in prod).
- Opt-out persisted as KV `unsub:<email>` (5y TTL) in LICENSES namespace.
- Welcome email: unsub footer link + `List-Unsubscribe` / `List-Unsubscribe-Post: One-Click` headers.
- Drip sweep (`runDripSweep`): skips any subscriber with `unsub:` key; drip emails carry
  the same headers + footer. Re-subscribing an opted-out email returns `status:"unsubscribed"`
  (no email sent) — compliant with one-click opt-out requirements (RFC 8058 / Gmail/Yahoo bulk sender rules).

## Verification (all real)

- Local wrangler dev: valid sig 200 + page, bad sig/bad email 400, re-subscribe suppressed.
- Production: sub → signed click 200 → KV `unsub:` written (timestamp confirmed via remote KV read)
  → re-subscribe returns `unsubscribed` → secret rotated (stale-signed link now 400).
- Full suite: 147 pass / 0 fail (21 skipped locally); CI Billing preflight pass after 2 fixes
  (graceful no-secret degradation; self-contained unsubUrl in monitor module).

## KPIs at time of writing

- Real subscribers in KV: 3 (incl. 1 masked real user `live-probe+202****1014@zovo.one`); test probes excluded.
- Funnel live: subscribe → welcome (Resend, FROM hello@zovo.one) → E2 +48h → E3 +7d.
- Directory PRs pending: Sagargupta16 #173, jaw9c #1306, punkpeye #1771, toolsdk #776 (unblocked).

## Next

- Check Resend dashboard for deliverability + unsub click rate after first real drips.
- mcpservers.org listing + canonical cleanup (next distribution round).
- BUY-link static form → hi@zovo.one when user provides asset details.
