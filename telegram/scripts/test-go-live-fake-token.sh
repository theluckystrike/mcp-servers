#!/usr/bin/env bash
#
# test-go-live-fake-token.sh - proves go-live.sh fails cleanly.
#
# Three cases, all offline-safe and offline-except-case-2:
#   1. no token at all        -> exit 2, no network calls
#   2. fake token             -> one getMe call, 401, exit 4, clear message
#   3. fake token, no network -> curl failure is still reported, no silent pass
#
# Case 2 does hit api.telegram.org with a syntactically valid but unregistered
# token. That is the documented Bot API behaviour (401 Unauthorized) and is the
# only way to prove the getMe gate. It creates nothing and sends no message.
#
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="${HERE}/go-live.sh"
PASS=0
FAIL=0

check() { # check <label> <expected-exit> <actual-exit>
  if [ "$2" = "$3" ]; then
    printf 'ok   - %s (exit %s)\n' "$1" "$3"
    PASS=$((PASS + 1))
  else
    printf 'FAIL - %s (expected exit %s, got %s)\n' "$1" "$2" "$3"
    FAIL=$((FAIL + 1))
  fi
}

printf '== case 1: no token at all ==\n'
env -u TELEGRAM_BOT_TOKEN "$SCRIPT" >/tmp/gl1.out 2>&1
check "refuses without TELEGRAM_BOT_TOKEN" 2 $?
/usr/bin/grep -q "is not set" /tmp/gl1.out && { printf 'ok   - message names the missing variable\n'; PASS=$((PASS+1)); } \
  || { printf 'FAIL - message did not name the variable\n'; FAIL=$((FAIL+1)); }
/usr/bin/grep -q "t.me/BotFather" /tmp/gl1.out && { printf 'ok   - message gives the mint URL\n'; PASS=$((PASS+1)); } \
  || { printf 'FAIL - message missing the mint URL\n'; FAIL=$((FAIL+1)); }
printf '%s\n' '--- captured output ---'; /usr/bin/sed 's/^/  /' /tmp/gl1.out

printf '\n== case 2: fake token (must die at getMe) ==\n'
TELEGRAM_BOT_TOKEN='123456789:FAKE_TOKEN_FOR_FAILURE_TEST_ONLY' "$SCRIPT" >/tmp/gl2.out 2>&1
check "fails at the getMe gate" 4 $?
/usr/bin/grep -q "getMe failed" /tmp/gl2.out && { printf 'ok   - message names the getMe failure\n'; PASS=$((PASS+1)); } \
  || { printf 'FAIL - message did not name the getMe failure\n'; FAIL=$((FAIL+1)); }
/usr/bin/grep -q "Nothing was changed" /tmp/gl2.out && { printf 'ok   - message states nothing was changed\n'; PASS=$((PASS+1)); } \
  || { printf 'FAIL - no no-side-effects statement\n'; FAIL=$((FAIL+1)); }
# It must stop at getMe: no later step may have run.
if /usr/bin/grep -q "webhook-less polling mode" /tmp/gl2.out; then
  printf 'FAIL - script continued past getMe into step 2\n'; FAIL=$((FAIL+1))
else
  printf 'ok   - stopped before step 2 (no partial setup)\n'; PASS=$((PASS+1))
fi
if /usr/bin/grep -q "FAKE_TOKEN_FOR_FAILURE_TEST_ONLY" /tmp/gl2.out; then
  printf 'FAIL - the token leaked into output\n'; FAIL=$((FAIL+1))
else
  printf 'ok   - token never echoed to stdout/stderr\n'; PASS=$((PASS+1))
fi
printf '%s\n' '--- captured output ---'; /usr/bin/sed 's/^/  /' /tmp/gl2.out

printf '\n== case 3: fake token with the network unreachable ==\n'
# Force curl to fail as if there were no route, without touching the network.
# PATH shim: a curl that exits 6 (could not resolve host) shadows the real one.
SHIM="$(mktemp -d)"
printf '%s\n' '#!/bin/sh' 'exit 6' > "${SHIM}/curl"
chmod +x "${SHIM}/curl"
TELEGRAM_BOT_TOKEN='123456789:FAKE_TOKEN_FOR_FAILURE_TEST_ONLY' \
  PATH="${SHIM}:${PATH}" \
  "$SCRIPT" >/tmp/gl3.out 2>&1
GL3=$?
rm -rf "$SHIM"
if [ "$GL3" -ne 0 ]; then
  printf 'ok   - non-zero exit when curl cannot connect (exit %s)\n' "$GL3"; PASS=$((PASS+1))
else
  printf 'FAIL - exited 0 with an unreachable API\n'; FAIL=$((FAIL+1))
fi
printf '%s\n' '--- captured output ---'; /usr/bin/sed 's/^/  /' /tmp/gl3.out

printf '\nRESULT: %s passed, %s failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
