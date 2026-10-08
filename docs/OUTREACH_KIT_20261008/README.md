# Resend Outreach Kit — 2026-10-08

STATUS: complete — all files written and tested (dry-run only; no emails sent)

Ready-to-send Resend kit for (a) MCP directory outreach and (b) free-tenant upgrade drip. Sending domain zovo.one is already DKIM-verified; billing worker already sends via Resend from mike@zovo.one. 54 MCP servers at mcp.zovo.one, $19/server lifetime or $39 bundle, 131 free hosted tenants.

## 1. Mike grants access (one time)

1. Go to https://resend.com/api-keys → create key named **`cold-outreach-prod`** (sending access only).
2. Save it (replace `$KEY` with the pasted value, keeping it out of shell history):
   ```
   mkdir -p ~/.zovo && read -s -p 'resend key: ' K && printf '%s\n' "$K" > ~/.zovo/.resend_api_key && chmod 600 ~/.zovo/.resend_api_key
   ```
   (The kit never reads the key file unless `--send` is passed; it must be chmod 600.)

## 2. The one-line send command

Dry run (default, no email leaves the machine):
```
bash send.sh --to owner@example.com --subject "Subject here" --body-file /tmp/body.txt
```
Real send — add `--send`:
```
bash send.sh --to owner@example.com --subject "Subject here" --body-file /tmp/body.txt --send
```
`--list` shows recent outbox entries. Every run (dry or real) is logged to `outbox.csv` in this directory.

## 3. Warmup rules (MUST follow)

- **Week 1: max 10/day.** Week 2: 20/day. Week 3+: 40/day ceiling.
- Interleave tenant-drip emails separately (max 20/day in week 1) — total first-week volume ≤ 10 outreach + 20 drip.
- Space sends ≥ 5 min apart; no identical bodies to consecutive recipients.
- Only send to targets in `targets.csv` or tenants who opted in. Honor "unsubscribe" replies same day.
- Pause immediately on any Resend bounce/block notification; don't resume for 48h.

## 4. Files

| File | Purpose |
|---|---|
| `send.sh` | Resend sender. Dry-run default, perms-checked key file, logs to outbox.csv. Tested. |
| `targets.csv` | 17 verified MCP directories (none in the s20261007 already-done set). Verified 2026-10-08. |
| `templates/directory-outreach.md` | 3 templates: initial / day-4 follow-up / day-10 close. |
| `templates/tenant-drip.md` | 2-email free-tenant drip: value recap (day 0) + $39 bundle offer (day 7). CAN-SPAM compliant — fill `{{postal_address}}` before sending. |
| `outbox.csv` | Created on first run (currently holds the dry-run test row). |

## 5. Test evidence (2026-10-08)

- Dry run: printed from/to/subject/body, exit 0, logged to outbox.csv, nothing sent.
- `--send` without `~/.zovo/.resend_api_key`: exits 1 with clear setup instructions. ✔ graceful
