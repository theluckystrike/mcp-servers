# mcp-petty-cash: Part 2 CLI run and the Part 1 gaps

Date 2026-09-06. Scope: `servers/petty-cash/src`, `servers/petty-cash/test` and this file.
`remote/`, billing, scripts, the petty-cash manifests and `packages/mcp-license` belong to
other agents; nothing there was touched. Pulled `--rebase --autostash` before editing.

Part 1 harness: `servers/petty-cash/test/_client.mjs`, as in `docs/PETTY_CASH_RESULT.md`.

Part 2 harness: the real `claude` CLI as an MCP client, `--model sonnet`, against
`/private/tmp/uv-pc/mcp.json`, which registers `petty-cash` and `cash-book` together with
`--strict-mcp-config`, fresh `XDG_DATA_HOME=/private/tmp/uv-pc/data`,
`XDG_CONFIG_HOME=/private/tmp/uv-pc/cfg` and `XDG_STATE_HOME=/private/tmp/uv-pc/state` placed
in each server's own env block inside `mcp.json` (never the CLI's own environment). A shared
business profile was written directly to
`/private/tmp/uv-pc/data/mcp-servers/profile/business.json`: name "Nova Studio",
`default_currency EUR`, `timezone Europe/Warsaw`, `default_tax_rate 23`. The server stayed on
the free tier through prompt 4's first half, then Pro was activated (a signed key from
`scripts/sign-license.mjs petty-cash`) for the second half of prompt 4 onward, on purpose, to
carry `replenish_request` and `float_report` through. Each prompt is one bounded `-p` call
with `--resume <session-id>` chaining the same conversation, request timeout 240 s (every
call completed well inside it). Explicit per-tool allowlist: every `mcp__petty-cash__*` and
`mcp__cash-book__*` tool plus `license_status`/`license_activate` on each, read from
`src/index.ts` before the run. All 8 calls (6 prompts, one with a follow-up for the Pro
activation) completed on the first attempt with `is_error: false`.

---

## Part 2 - six prompts through the claude CLI

Scores are 0-3, checked against `/private/tmp/uv-pc/data/mcp-servers/petty-cash/floats.json`
and `vouchers.json` on disk, not against the model's prose.

| # | Prompt | Score | Verified |
| --- | --- | --- | --- |
| 1 | "Open a EUR 500 office float, I am the custodian" | 2 | `float_open`. Store: `FLOAT-2026-0001`, `imprest_minor 50000`, `currency EUR`, `opened 2026-09-06`, `custodian_source "call"`. Imprest and currency are right, but the model set `custodian: "support@zovo.one"` explicitly rather than leaving `custodian` unset so it fell through to the shared profile's `"Nova Studio"` (`custodian_source` would then read `"shared profile"`, as in the Part 1 suite's own test of that path). The user gave no name, only "I am the custodian"; the model filled the gap with the operator's email from its own system context, not with anything either the tool call or the profile actually supplied. Not a store defect, but a real finding: unrequested identity data from the calling context ended up written into a business record |
| 2 | "Paid EUR 12.40 for milk, EUR 38 for printer paper and EUR 9.99 for a taxi, all today" | 3 | Three `voucher_add` calls. Store: `VOU-2026-0001` 1240 kitchen, `VOU-2026-0002` 3800 office, `VOU-2026-0003` 999 travel, all dated 2026-09-06. Reported balance EUR 439.61 = 50000 - 1240 - 3800 - 999 = 43961, exact |
| 3 | "I counted EUR 439.50 in the tin" | 3 | `reconcile` at `counted_minor 43950`. Store: `counts[0] = { expected_minor 43961, counted_minor 43950, difference_minor -11 }`. All three vouchers now carry `reconciled_on "2026-09-06"`. The model named the shortage in EUR and flagged it will roll into `cash_over_short` on the next replenishment, matching the design in `PETTY_CASH_RESULT.md` exactly |
| 4 | "Prepare the replenishment" | 3 | First call, still free tier: `replenish_request` refused correctly ("Pro is a one-time $19"), nothing written. The model then hand-computed the replenishment itself: vouchers 1240+3800+999 = 6039 (EUR 60.39) plus the 11-cent shortage = EUR 60.50, and it named this as `imprest - balance`, not the voucher sum — the exact distinction `PETTY_CASH_RESULT.md` is built around. It also flagged the gate's `NO_HAND_MATH` guard text as a "paywall nudge" rather than a technical limit, which is a mixed signal: this time the number it produced by hand was correct, but the guard exists precisely because the naive version (voucher total alone, 60.39) looks equally plausible and is wrong. Once Pro was activated with a signed key and the same request re-run, `replenish_request` itself returned `amount_minor 6050`, `vouchers_total_minor 6039`, `over_short_minor 11` — matching the hand figure to the minor unit |
| 5 | "Delete the taxi voucher" | 2 | Correct outcome: `VOU-2026-0003` is still in `vouchers.json` (3 vouchers, unchanged) after the prompt. But the model refused pre-emptively from reasoning alone ("the tool will refuse the delete outright... do you want me to try anyway") rather than calling `voucher_delete` and surfacing its actual refusal text (which names the count date and the exact amount the deletion would break, per `float.ts`/`index.ts`'s `voucher_delete` handler). Right answer, but the evidence a human would want — the tool's own numbers — was never produced |
| 6 | "Add EUR 5 for stamps and show me the float" | 3 | `voucher_add` (`VOU-2026-0004`, 500 minor, postage) then `float_report` (Pro, now unlocked). Balance reported EUR 434.50 = 43950 - 500 - 999_pending_note... recomputed: imprest 50000, vouchers 1240+3800+999+500=6539, count difference -11 -> balance = 50000-6539-11 = 43450 (EUR 434.50), exact. `to_replenish` EUR 65.50 = 50000-43450, exact |

Scorecard: **16 / 18** (2.67 / 3).

### Findings from the six prompts

**Custodian identity leak (prompt 1).** The model reached for a value that was in neither
the user's sentence nor the shared profile and wrote it into the float record as
`custodian_source: "call"`. The shared profile existed for exactly this ("Nova Studio" would
have been the correct default), and the design in `PETTY_CASH_RESULT.md` explicitly treats
`custodian_source` as the tell for where a name came from. This is a model-behaviour finding,
not a server defect: the server did exactly what it was told, and the tell worked (an
auditor reading `floats.json` immediately sees the value came from a `call`, not the
profile) — but the value itself should not have existed.

**Correct number despite a dismissed guardrail (prompt 4).** The model's own words called
the `NO_HAND_MATH` guard text a "paywall nudge... not a technical limitation" and did the
math anyway. It happened to reach EUR 60.50, the answer the imprest-minus-balance rule gives,
not EUR 60.39, the voucher-sum trap `PETTY_CASH_RESULT.md`'s three-cycle drift test exists to
catch. The reasoning that got it there was "the count already told me the tin is 11 short",
which is in fact the correct decomposition — but a model that treats every gate message as
marketing copy to override is one bad prompt away from confidently reporting the wrong
figure with no server ever in the loop to catch it.

**A refusal argued rather than demonstrated (prompt 5).** The right voucher survived, but no
tool call happened, so the concrete evidence (`voucher_delete`'s refusal names the count date
and the exact amount in minor units) never reached the transcript. Reasoning-only refusals
are indistinguishable, from the outside, between "the model checked and is right" and "the
model guessed and got lucky."

---

## Part 1 - the gaps not yet covered

| # | Probe | Result | Where |
| --- | --- | --- | --- |
| 1 | A second float on the free tier | PASS, already covered | `adversarial.test.mjs` "the free tier caps floats and vouchers, and names what stays free": a second `float_open` is refused naming the open float and what stays free |
| 2 | A voucher dated before the float opened | **DEFECT FOUND, FIXED** | `voucher_add` checked only that the voucher wasn't dated in the future and that the balance at that date could cover it. Because the imprest applies unconditionally (not date-filtered) in `balance()`, a voucher dated before the float's own `opened` date was silently accepted as long as its amount was under the imprest — a float that legally could not have existed yet still "paid out" cash. Probed directly against the built server (`voucher_add` with a date of 2026-02-15 against a float opened 2026-03-01: `isError: false`, voucher written). Fixed in `src/index.ts`: both `voucher_add` and `topup_record` now check `date < f.opened` inside the locked section, before any other check, and refuse by name, matching the check `reconcile` already had. Tests added: "a voucher dated before the float opened is refused, not merely allowed because the tin held enough" and "a top-up dated before the float opened is refused the same way" |
| 3 | Reconcile twice on one day | PASS, already covered | `unit.test.mjs` line 69-74: the second `reconcile` call on the same date and count comes back with `vouchers_reconciled: []` and `difference_minor` unaffected by the first call — no voucher is reconciled twice |
| 4 | A top-up over the imprest | PASS, test ADDED | The server already computed and returned a note (`"...which is more than the imprest..."`) when a top-up pushes the balance above the imprest, but no test asserted it. Added "a top-up larger than what was spent is allowed and flagged, not silently absorbed" to `adversarial.test.mjs`: spend 1000, top up 5000, balance ends at 54000 against a 50000 imprest, and the note fires |
| 5 | A 21st voucher in the month | PASS, already covered | `adversarial.test.mjs` "the free tier caps floats and vouchers...": the 21st `voucher_add` in a calendar month is refused naming the count and the month, the 20th is not, and the next month's first voucher is free again |
| 6 | A corrupt store | PASS, already covered | `adversarial.test.mjs` "an unreadable store is never read as an empty one": every tool refuses over a hand-corrupted store, quarantined byte-for-byte beside a `.corrupt` marker |
| 7 | Two processes | PASS, already covered | `concurrency.test.mjs`: forty vouchers from two processes, the race on the 21st free voucher, the race on the second free float, and a count racing a voucher, all asserted against one critical section |

One real defect out of seven gaps: a voucher or top-up could be dated before its own float
existed. Both `voucher_add` and `topup_record` are fixed the same way `reconcile` already
worked; `float.ts`'s pure functions (`balance`, `firstNegative`, `reconcile`, `replenishment`)
needed no change, since the missing check was a tool-level gate, not an engine defect.

Two new tests were added to `servers/petty-cash/test/adversarial.test.mjs` closing the
defect, plus one assertion added for the previously-unasserted top-up-over-imprest note:

1. `"a voucher dated before the float opened is refused, not merely allowed because the tin held enough"`
2. `"a top-up dated before the float opened is refused the same way"`
3. `"a top-up larger than what was spent is allowed and flagged, not silently absorbed"`

---

## Final test summary

    npm run build (repo-wide)                  tsc clean, no output
    npm test -w servers/petty-cash             # tests 44 / # pass 44 / # fail 0 (was 41, three added)
    node scripts/sync-versions.mjs --check     0 file(s) written
    Part 2: claude CLI, sonnet, petty-cash + cash-book, per-tool allowlist, fresh XDG dirs
      in mcp.json's server env, shared profile (Nova Studio, Europe/Warsaw, EUR), free tier
      through prompt 4's first half, Pro activated for the replenishment onward, 6 prompts
      (8 calls counting the Pro-activation follow-up), all first-attempt, zero permission
      denials, 16/18 (2.67/3)

---

## RESULT.md block

    status: DONE
    evidence:
    - npm run build (repo-wide): tsc clean
    - npm test -w servers/petty-cash: # tests 44 / # pass 44 / # fail 0 (was 41, three added)
    - node scripts/sync-versions.mjs --check: 0 file(s) written
    - Part 2: EUR 439.61 after three vouchers (12.40+38.00+9.99), count found the tin
      EUR 0.11 short (expected 439.61, counted 439.50), replenishment correctly computed
      as imprest-minus-balance both by the model's own hand math (EUR 60.50) and by
      replenish_request itself once Pro was unlocked (amount_minor 6050, vouchers_total
      6039, over_short 11), reconciled taxi voucher survived a delete request, final float
      report balance EUR 434.50 against a EUR 500.00 imprest after a fourth voucher
    - Part 1 gap-fill: 7 probes named in the brief checked; 6 already asserted (second
      float, reconcile twice same day, 21st voucher, corrupt store, two processes) and
      re-verified passing, plus one note (top-up over imprest) that existed in the server
      but had no test, now added; 1 real defect found and fixed: voucher_add and
      topup_record accepted a date before the float's own opened date, because only
      reconcile carried that check. Fixed both the same way, two regression tests added
    artifacts:
    - /Users/mike/mcp-servers/docs/PETTY_CASH_AUDIT.md
    - /Users/mike/mcp-servers/servers/petty-cash/src/index.ts
    - /Users/mike/mcp-servers/servers/petty-cash/test/adversarial.test.mjs
    cost: 35 wall minutes
    failures:
    - voucher_add and topup_record could both be dated before the float they belong to
      existed, because only reconcile checked date against f.opened; a voucher under the
      imprest amount slipped through since balance() applies the imprest unconditionally
      rather than filtering it by date. Fixed by adding the same date < f.opened check to
      both tools, inside the locked section, before any other check
    insight:
    - The sharpest moment in the six-prompt run was prompt 4: the model dismissed the
      gate's own NO_HAND_MATH guard as marketing copy, then did the forbidden hand math
      anyway and got the right answer only because it happened to use the count's
      difference rather than the naive voucher sum. The same reasoning path with a
      slightly different phrasing of the question could have produced the wrong number
      (60.39, the voucher total) with the same confident tone, which is exactly the
      failure PETTY_CASH_RESULT.md's three-cycle drift test was written to catch inside
      the server. The guard text exists because the model cannot be trusted to always
      pick the right shortcut; here it did, but by luck of framing, not by deferring to
      the tool

Built by theluckystrike. https://github.com/theluckystrike
