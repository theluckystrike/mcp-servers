#!/usr/bin/env bash
# send.sh — Resend sender for the 2026-10-08 outreach kit.
# Dry-run by default: prints what WOULD be sent, touches nothing remote.
# Actual send requires ~/.zovo/.resend_api_key and the --send flag.
#
# Usage:
#   bash send.sh --to a@b.com --subject "..." --body-file templates/x.txt [--send]
#   bash send.sh --list            # show recent outbox.csv entries
#
# Every run (dry or real) is logged to outbox.csv.
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTBOX="$KIT_DIR/outbox.csv"
KEY_FILE="$HOME/.zovo/.resend_api_key"
FROM="Mike <mike@zovo.one>"

TO=""; SUBJECT=""; BODY_FILE=""; SEND=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --to) TO="$2"; shift 2 ;;
    --subject) SUBJECT="$2"; shift 2 ;;
    --body-file) BODY_FILE="$2"; shift 2 ;;
    --send) SEND=1; shift ;;
    --list)
      if [[ -f "$OUTBOX" ]]; then tail -n 20 "$OUTBOX"; else echo "outbox.csv is empty or absent (no sends yet)"; fi
      exit 0 ;;
    *) echo "Unknown arg: $1"; exit 2 ;;
  esac
done

# --- validation ---
MISSING=()
[[ -z "$TO" ]] && MISSING+=("--to")
[[ -z "$SUBJECT" ]] && MISSING+=("--subject")
[[ -z "$BODY_FILE" ]] && MISSING+=("--body-file")
if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "ERROR: missing required args: ${MISSING[*]}"
  echo "Usage: bash send.sh --to a@b.com --subject \"...\" --body-file body.txt [--send]"
  exit 2
fi
if [[ ! -f "$BODY_FILE" ]]; then
  echo "ERROR: body file not found: $BODY_FILE"
  exit 2
fi

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STATUS=""; NOTE=""

if [[ $SEND -eq 0 ]]; then
  echo "== DRY RUN (no email sent; pass --send for a real send) =="
  echo "  from:    $FROM"
  echo "  to:      $TO"
  echo "  subject: $SUBJECT"
  echo "  body:    $BODY_FILE ($(wc -c < "$BODY_FILE" | tr -d ' ') bytes)"
  STATUS="dry-run"
else
  # --- real send: key + perms checks first ---
  if [[ ! -f "$KEY_FILE" ]]; then
    echo "ERROR: $KEY_FILE not found."
    echo "Mike: create API key 'cold-outreach-prod' at https://resend.com/api-keys and save it:"
    printf "  mkdir -p ~/.zovo && read -s -p 'resend key: ' K && printf '%%s\\n' \"\\\$K\" > %s && chmod 600 %s\n" "$KEY_FILE" "$KEY_FILE"
    exit 1
  fi
  PERMS="$(stat -f '%Lp' "$KEY_FILE" 2>/dev/null || stat -c '%a' "$KEY_FILE")"
  if [[ "$PERMS" != "600" ]]; then
    echo "ERROR: $KEY_FILE has perms $PERMS; refusing to read it. Fix: chmod 600 $KEY_FILE"
    exit 1
  fi
  API_KEY="$(tr -d '\n\r' < "$KEY_FILE")"
  HTTP_CODE="$(printf '%s' "$BODY_FILE" | jq -Rs --arg to "$TO" --arg from "$FROM" --arg subj "$SUBJECT" \
    '{from:$from, to:[$to], subject:$subj, text:.}' \
    | curl -s -o /tmp/resend_last_response.json -w '%{http_code}' \
        -X POST https://api.resend.com/emails \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d @-)"
  RESP="$(cat /tmp/resend_last_response.json 2>/dev/null || echo '(no response body)')"
  if [[ "$HTTP_CODE" == "2"* ]]; then
    echo "SENT: $HTTP_CODE $RESP"
    STATUS="sent"
  else
    echo "SEND FAILED: HTTP $HTTP_CODE — $RESP" >&2
    STATUS="failed"
  fi
  NOTE="$RESP"
fi

# --- log ---
if [[ ! -f "$OUTBOX" ]]; then
  echo "timestamp,mode,to,subject,status,note" > "$OUTBOX"
fi
csv_escape() { printf '"%s"' "$(printf '%s' "$1" | tr -d '"' | tr '\n' ' ')"; }
echo "$(csv_escape "$TS"),$(csv_escape "$STATUS"),$(csv_escape "$TO"),$(csv_escape "$SUBJECT"),$(csv_escape "$STATUS"),$(csv_escape "$NOTE")" >> "$OUTBOX"
echo "Logged to $OUTBOX"
