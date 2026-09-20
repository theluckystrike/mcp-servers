# T22 — Leave MCP Server: Drive Test Suite to Zero Failures (S48)

STATUS: in progress

## Goal
Drive `node --test test/*.test.mjs` in `/Users/mike/mcp-servers/servers/leave` from 42/53 to 0 failures.

## Verified root causes + fixes (from delegation brief)
1. CSV import must use FULL names ('Ada Lovelace', 'Zora ...'); short 'Ada'/'Zora' ambiguous.
2. out_range semantics: days = count of days where ANYONE is out (inclusive day count), NOT requested span; empty store -> days:0, personDays:0.
3. Pro refusal text verbatim contains 'Pro is a one-time $19'; contract #21 regex lines ~109/113 -> /Pro is a one-time|license_activate/.
4. contract #23: tools/list exposes 12 (10 leave + 2 license). Fix assertion to >= 10 + name checks.
5. README test (#24): update expected README content markers if names/description checked.
6. read-only dir (#30), corrupt store (#31): corrupt store quarantined to `.corrupt-<ts>` with `.corrupt` marker, server starts empty.
7. ICS tests (#20/#32): check actual ICS field names/order in src.
8. leave_list filters: src patches filter correctly (employee AND status); failing filter tests should pass with full name + valid status.

## Evidence log
(appended as work proceeds)

## Result
- # fail: 0  => RESULT: verified-green
- else         => RESULT: blocked (+ exact remaining + root cause)