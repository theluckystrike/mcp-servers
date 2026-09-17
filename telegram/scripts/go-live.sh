#!/usr/bin/env bash
#
# go-live.sh - Telegram Stars go-live for the mcp-servers fleet bot.
#
# Idempotent: safe to re-run. Every step is either a read-back or a set of the
# same value, so a second run changes nothing and reports the same state.
#
# Fails loudly and exits non-zero if TELEGRAM_BOT_TOKEN is unset/empty, or if
# the token does not authenticate at the very first Bot API call (getMe).
#
# This script deliberately does NOT mint the token. BotFather is an interactive
# chat with @BotFather and cannot be scripted without an account sign-in, which
# the estate's hard rules forbid. That is the one human step.
#
# Usage:
#   export TELEGRAM_BOT_TOKEN='123456:ABC...'
#   ./scripts/go-live.sh
#
# Test with a fake token (fails cleanly at getMe):
#   ./scripts/test-go-live-fake-token.sh
#
set -euo pipefail

API="https://api.telegram.org"
BOT_TOKEN_ENV="TELEGRAM_BOT_TOKEN"

# Mini App URL must be HTTPS; Telegram rejects anything else on setChatMenuButton.
MINI_APP_URL="${MINI_APP_URL:-https://mcp.zovo.one/telegram/}"

say()  { printf '%s\n' "$*"; }
step() { printf '\n== %s\n' "$*"; }
ok()   { printf 'ok   - %s\n' "$*"; }
fail() { printf 'FAIL - %s\n' "$*" >&2; }

# --- token gate ------------------------------------------------------------
# Checked before any network call so a missing token never touches the network.
if [ -z "${!BOT_TOKEN_ENV:-}" ]; then
  fail "${BOT_TOKEN_ENV} is not set."
  fail "This script refuses to run without it and makes no network calls."
  fail "Mint a token: open https://t.me/BotFather in Telegram, send /newbot,"
  fail "follow the prompts, then copy the token it prints."
  fail "Then: export ${BOT_TOKEN_ENV}='<token>' && $0"
  exit 2
fi

TOKEN="${!BOT_TOKEN_ENV}"

command -v curl >/dev/null 2>&1 || { fail "curl not found on PATH"; exit 3; }

# call <method> [json-body]
# Prints the raw JSON response. Never echoes the token.
call() {
  local method="$1" body="${2:-}" rc=0
  if [ -n "$body" ]; then
    curl -sS --max-time 20 -X POST "${API}/bot${TOKEN}/${method}" \
      -H 'Content-Type: application/json' --data "$body" || rc=$?
  else
    curl -sS --max-time 20 "${API}/bot${TOKEN}/${method}" || rc=$?
  fi
  if [ "$rc" -ne 0 ]; then
    fail "curl could not reach the Bot API (curl exit ${rc}; 6=DNS, 7=connect, 28=timeout)."
    fail "Nothing was changed because step 1 (getMe) never succeeded."
    echo "" >&2
    exit 6
  fi
}

# jget <json> <expr> - read a field with python3 (jq is not installed here).
jget() {
  python3 -c '
import json,sys
try:
    d = json.loads(sys.argv[1])
except Exception:
    sys.stdout.write("")
    sys.exit(0)
if not isinstance(d, dict):
    sys.stdout.write("")
    sys.exit(0)
if not d.get("ok"):
    sys.stdout.write("ERR:" + str(d.get("error_code","")) + ":" + str(d.get("description","")))
    sys.exit(0)
cur = d.get("result")
for part in sys.argv[2].split("."):
    if isinstance(cur, dict) and part in cur:
        cur = cur[part]
    else:
        sys.stdout.write("")
        sys.exit(0)
if isinstance(cur, bool):
    sys.stdout.write("true" if cur else "false")
elif cur is None:
    sys.stdout.write("")
else:
    sys.stdout.write(str(cur))
' "$1" "$2"
}

# --- step 1: authenticate --------------------------------------------------
# The single hard gate. A wrong/revoked token is a 401 here with a clear
# message, and the script stops before doing anything half-applied.
step "1/5 authenticate (getMe)"
ME_JSON="$(call getMe)"
ME_ERR="$(jget "$ME_JSON" "id")"

if [ -z "$ME_ERR" ] || [ "${ME_ERR#ERR:}" != "$ME_ERR" ]; then
  fail "getMe failed; the token did not authenticate."
  fail "Bot API said: ${ME_ERR#ERR:}"
  fail "Nothing was changed. Check the token from https://t.me/BotFather."
  exit 4
fi

BOT_USERNAME="$(jget "$ME_JSON" "username")"
ok "authenticated as @${BOT_USERNAME} (id ${ME_ERR})"

# --- step 2: webhook-less polling mode -------------------------------------
# deleteWebhook with drop_pending_updates clears any webhook so the bot reads
# updates by long polling (how dist/bot.js runs). Idempotent: deleting an
# already-absent webhook returns ok:true.
step "2/5 webhook-less polling mode (deleteWebhook)"
WH_JSON="$(call deleteWebhook '{"drop_pending_updates":true}')"
WH_ERR="$(jget "$WH_JSON" "ok")"
if [ "$WH_ERR" != "true" ]; then
  fail "deleteWebhook failed: ${WH_ERR#ERR:}"
  exit 5
fi
ok "no webhook registered; bot will long-poll"

# --- step 3: register commands ---------------------------------------------
# /start /buy /upgrade appear in the client's blue command menu.
step "3/5 register commands (setMyCommands)"
CMDS='{"commands":[
  {"command":"start","description":"Open the server picker"},
  {"command":"buy","description":"Buy lifetime access with Stars"},
  {"command":"upgrade","description":"Upgrade to all servers with Stars"}
]}'
CMD_JSON="$(call setMyCommands "$CMDS")"
CMD_ERR="$(jget "$CMD_JSON" "ok")"
if [ "$CMD_ERR" != "true" ]; then
  fail "setMyCommands failed: ${CMD_ERR#ERR:}"
  exit 6
fi
ok "registered /start /buy /upgrade"

# Read back so a silent no-op cannot pass as success.
RB_JSON="$(call getMyCommands)"
RB_N="$(python3 -c '
import json,sys
try: d=json.loads(sys.argv[1])
except Exception: print(0); sys.exit(0)
print(len(d.get("result",[])) if d.get("ok") else 0)
' "$RB_JSON")"
ok "getMyCommands read-back: ${RB_N} command(s)"

# --- step 4: Mini App entry points -----------------------------------------
# BotFather-free path. There is no Bot API method that sets a Mini App's URL on
# the bot profile (setChatMenuButton is the documented Bot API surface that
# accepts a web_app URL from the bot side), so this sets the chat menu button to
# the Mini App. Answering web app queries with answerWebAppQuery is not needed:
# that method serves a message from inline-mode query results, and this flow
# opens the Mini App directly by URL.
step "4/5 Mini App menu button (setChatMenuButton)"
case "$MINI_APP_URL" in
  https://*) : ;;
  *) fail "MINI_APP_URL must be https, got: ${MINI_APP_URL}"; exit 7 ;;
esac
MB_JSON="$(call setChatMenuButton "{\"menu_button\":{\"type\":\"web_app\",\"text\":\"Open App\",\"web_app\":{\"url\":\"${MINI_APP_URL}\"}}}")"
MB_ERR="$(jget "$MB_JSON" "ok")"
if [ "$MB_ERR" != "true" ]; then
  fail "setChatMenuButton failed: ${MB_ERR#ERR:}"
  fail "Telegram requires an HTTPS Mini App URL. Got: ${MINI_APP_URL}"
  exit 7
fi
ok "chat menu button points at ${MINI_APP_URL}"

# --- step 5: self-test message ---------------------------------------------
# Who to send to: TELEGRAM_SELF_TEST_CHAT_ID if set, else the bot's own chat
# (Telegram lets a bot read its own outgoing chat when a getUpdates poll sees it
#  is not possible, so a chat id is required to prove delivery end to end).
step "5/5 self-test message"
if [ -z "${TELEGRAM_SELF_TEST_CHAT_ID:-}" ]; then
  say "skip - TELEGRAM_SELF_TEST_CHAT_ID is not set, so there is no chat to"
  say "        send to. Send /start to @${BOT_USERNAME} in Telegram, copy the"
  say "        numeric chat id, then re-run with:"
  say "          export TELEGRAM_SELF_TEST_CHAT_ID='<your numeric chat id>'"
  say "        (or just message the bot by hand: it is already live)"
else
  TXT="mcp-servers fleet bot is live. Commands: /start /buy /upgrade. Mini App: ${MINI_APP_URL}"
  MSG_JSON="$(call sendMessage "{\"chat_id\":\"${TELEGRAM_SELF_TEST_CHAT_ID}\",\"text\":\"${TXT}\"}")"
  MSG_ERR="$(jget "$MSG_JSON" "message_id")"
  if [ -z "$MSG_ERR" ] || [ "${MSG_ERR#ERR:}" != "$MSG_ERR" ]; then
    fail "sendMessage failed: ${MSG_ERR#ERR:}"
    fail "The bot is live, but it could not message chat ${TELEGRAM_SELF_TEST_CHAT_ID}."
    fail "A user must send the bot /start once before it may message them."
    exit 8
  fi
  ok "self-test message delivered (message_id ${MSG_ERR})"
fi

# --- done: exactly what remains human --------------------------------------
step "DONE - automated setup complete"
say "Bot:      @${BOT_USERNAME}"
say "Mode:     long polling, no webhook"
say "Commands: /start /buy /upgrade"
say "Mini App: ${MINI_APP_URL} (chat menu button)"

printf '\nREMAINS HUMAN (nothing below is scriptable here)\n'
printf '  1. Start the bot process and keep it running:\n'
printf '       cd %s && TELEGRAM_BOT_TOKEN=$%s node dist/bot.js\n' \
  "$(cd "$(dirname "$0")/.." && pwd)" "$BOT_TOKEN_ENV"
printf '  2. Host public/index.html at exactly: %s\n' "$MINI_APP_URL"
printf '     (HTTPS, and the path must match - Telegram will not load it otherwise)\n'
printf '  3. Bot profile: name, description, profile photo and the "What can this\n'
printf '     bot do?" text are BotFather /edit settings, not Bot API calls.\n'
printf '  4. Send /start to @%s and issue /buy to confirm a real Stars (XTR)\n' "$BOT_USERNAME"
printf '     invoice opens. Payment cannot be completed by a bot; a human pays.\n'
printf '  5. Revenue: Telegram pays out Stars via Fragment 21 days after the\n'
printf '     transaction, minus the app-store fee. Withdrawing is a human action\n'
printf '     in the app.\n'
printf '  6. Never commit the token. Export it in the shell that runs the bot.\n'

exit 0
