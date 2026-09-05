# mcp-per-diem: Part 2 CLI run and the remaining Part 1 gaps

Date 2026-09-05. Scope: `servers/per-diem` only (src, test) plus this file. `remote/`, billing,
scripts and the per-diem manifests belong to other agents; nothing there was touched. Pulled
`--rebase --autostash` before editing; the working tree carried unrelated in-progress changes
from other agents (bundles, billing) which are left as found.

Part 1 harness: `servers/per-diem/test/_client.mjs`, as in `docs/PER_DIEM_RESULT.md`.

Part 2 harness: the real `claude` CLI (2.1.261) as an MCP client, `--model sonnet`, against
`/private/tmp/uv-perdiem/mcp.json`, which registers `per-diem` and `expense-tracker` together
with `--strict-mcp-config`, fresh `XDG_DATA_HOME=/private/tmp/uv-perdiem/data` and
`XDG_CONFIG_HOME=/private/tmp/uv-perdiem/cfg` placed in each server's own env block inside
`mcp.json` (never `CLAUDE_CONFIG_DIR`, never the CLI's own environment), and an explicit
per-tool allowlist of every `mcp__per-diem__*` / `mcp__expense-tracker__*` tool plus
`license_status`/`license_activate` on each. A shared business profile was written directly to
`data/mcp-servers/profile/business.json` before the run: name "Nova Studio",
`default_currency EUR`, `default_tax_rate 23`, `timezone Europe/Warsaw`. The per-diem server's
env block carried a Pro key (`node scripts/sign-license.mjs per-diem`) so prompt 4's export path
could actually run; expense-tracker stayed on free tier throughout, which is enough for
`expense_add`. Each of the six prompts is one bounded `-p` call with `--resume <session-id>`
chaining the same conversation, request timeout 240 s (each call completed in under 20 s).
Machine day: Saturday 2026-09-05.

Prompt 2 needed one extra round trip: the model asked which calendar week "Monday to Wednesday"
meant before computing anything, rather than guessing a date silently. That confirmation
("Yes, that week") is counted as part of prompt 2, not a new prompt.

---

## Part 2 - six prompts through the claude CLI

Scores are 0-3, checked against `trips.json` and `data.json` (expense-tracker) on disk and
against `servers/per-diem/src/tables/pl-foreign.json` and `src/schemes.ts`'s worked ladder, not
against the model's prose.

| # | Prompt | Score | Verified |
| --- | --- | --- | --- |
| 1 | "What is the Polish daily allowance for Germany?" | 3 | Answered EUR 55.00. Matches `pl-foreign.json` row `{"country": "Germany", "code": "DE", "currency": "EUR", "diet_minor": 5500}` exactly. No tool call was strictly required for this fact, and the model still cited the correct authority (Dz.U. 2013 poz. 167 as amended by Dz.U. 2022 poz. 2302) |
| 2 | "I was in Berlin from Monday 9:00 to Wednesday 14:00, hotel paid two breakfasts, what is my diet?" | 3 | After confirming the calendar week, `perdiem_calc` returned EUR 117.33: Mon full day EUR 55.00, Tue full day less 15% breakfast EUR 46.75, Wed 5-hour remainder at the foreign one-third-up-to-8-hours rule (par. 13(4)(1)) EUR 18.33 less 15% breakfast EUR 15.58. `55.00 + 46.75 + 15.58 = 117.33` exactly, and the stored `trip.calc.subsistence_minor` in prompt 3's write-back is `11733`, confirming the number came from the tool and not from the model doing the arithmetic itself |
| 3 | "Save that as the Berlin trip" | 3 | `trip_record`. Store: `TRIP-2026-0001`, `name: "Berlin trip"`, `scheme: pl`, `part: foreign`, `destination: Germany`, `total_minor: 11733` (EUR 117.33), traveller "Nova Studio" from the shared profile, `traveller_source: "shared profile"` |
| 4 | "Add it to my expenses" | 3 | `trip_export` then `expense_add` on expense-tracker. Store (`data/mcp-servers/expense-tracker/data.json`): expense id `81095899`, `amount_minor: 11733` (EUR 117.33), `date: 2026-09-02`, `category: travel`, `merchant: "Per diem - Berlin trip"`, `billable: false`. Matches `TRIP-2026-0001.calc.total_minor` to the cent |
| 5 | "What about a trip to Oman?" | 3 | Refused by name: "Oman isn't in the bundled data ... 34 of the ~120 countries ... I can't state a rate with confidence, and I won't guess," with the HMRC-equivalent Polish source URL. No price given, no Romania substitution, no substring-match near miss |
| 6 | "What did I claim this month?" | 3 | Answered from `expense_list`/`expense_summary` on expense-tracker (a free-tier tool, no `perdiem_report` needed for this phrasing): one expense, EUR 117.33 gross, net EUR 95.39 + VAT EUR 21.94 at 23%, matching `data.json` exactly. Separately verified `perdiem_report`'s own Pro refusal on a fresh free-tier client (see below) since this prompt's natural reading routed to expense-tracker instead |

Scorecard: **3.00 / 3** (18 of 18).

### Prompt 6 and the Pro-gated report, verified directly

The brief's framing of prompt 6 ("report is Pro: how the refusal reads") is about
`perdiem_report`, but "What did I claim this month?" is answered more naturally by
expense-tracker's own free `expense_list`/`expense_summary`, which is what the model called; it
never needed the per-diem server's Pro report for this phrasing, and no defect follows from
that routing choice. To still capture the exact refusal text, `perdiem_report` was called
directly against a fresh free-tier client (`servers/per-diem/test/_client.mjs`, no license key):

    Error: "the per diem report" is a Pro feature. Pro is a one-time $19 (or $39 for every
    server, lifetime). Buy at https://mcp.zovo.one/buy/per-diem?src=per-diem.perdiem_report ,
    then run license_activate with the key shown after checkout. Keys verify offline; nothing
    is sent anywhere.

This matches `unit.test.mjs`'s free-tier assertions and RESULT.md probe 21: the tool name, the
one-time price, both purchase URLs (per-tool and suite), and the instruction to run
`license_activate` are all present, and the message is worded as a refusal with a next step, not
an error dump.

### Not a defect: expense-tracker's own VAT default applied to a per-diem export

`trip_export`'s payload carries no `vat_rate` (per `PER_DIEM_RESULT.md`: "a statutory per diem is
an allowance, not a purchase, so there is no input VAT to reclaim"). `expense_add`, receiving
that payload with no `vat_rate` given, fell through to its own documented default chain and
applied the shared profile's `default_tax_rate: 23`, producing a VAT split on the stored expense.
This is expense-tracker's own designed behavior (`src/index.ts` lines 231-244: call, then
`expense_settings.default_vat_rate`, then the shared profile's `default_tax_rate`, then none),
correct on that server's own terms, and the model caught the mismatch unprompted and flagged it
back to the user ("per-diem allowances aren't actually a VAT-bearing supply ... want me to zero
out the VAT rate on this one?") rather than silently leaving a wrong-looking split. Nothing in
per-diem needs to change: it correctly omits `vat_rate`; the interaction is a property of the
receiving server's own default, working as documented there.

---

## Part 1 - probes not yet covered in docs/PER_DIEM_RESULT.md

RESULT.md's 26-row table already covers every gap named in this task's brief: end before start
and a zero-length trip (row 8), a 400-day trip and a 366-day one (row 11), a DST crossing in both
directions plus the same crossing under the US calendar-day rule (row 12), a spring-forward-gap
local time (row 13), an unknown scheme/country across all three schemes (row 9), meals provided
more than there are days including a duplicated meal (row 15), a corrupt `trips.json` and a
corrupt `counter.json` (row 18), and two processes both racing concurrent `trip_record` (row 19)
and racing the last free trip of the month (row 20). All 26 rows were re-run in this pass via
`npm test -w servers/per-diem` and all still pass; the table below adds nothing new because
nothing new was found.

| # | Probe | Result | What happens |
| --- | --- | --- | --- |
| — | end before start | PASS, re-verified | `adversarial.test.mjs` "end before start is refused as instants, not as text"; unchanged since RESULT.md row 8 |
| — | 400-day trip | PASS, re-verified | `adversarial.test.mjs` "a 400-day trip is refused and a 366-day one is not"; unchanged since RESULT.md row 11 |
| — | DST crossing inside the trip | PASS, re-verified | `adversarial.test.mjs` "a DST crossing is 23 or 25 elapsed hours, and the allowance follows the clock"; unchanged since RESULT.md row 12 |
| — | unknown scheme | PASS, re-verified | `adversarial.test.mjs` "an unknown country is refused by name and says the table is partial, not empty"; `perdiem_calc` also rejects a `scheme` value outside `pl`/`uk`/`us` at the Zod enum before any handler runs |
| — | meals provided more than days | PASS, re-verified | `adversarial.test.mjs` "meal deductions never take a day below zero"; a US day floors at 0 rather than going negative and a duplicated meal name deducts once |
| — | corrupt store | PASS, re-verified | `corrupt.test.mjs`, both `trips.json` and `counter.json`; quarantined byte for byte, `perdiem_calc`/`perdiem_rates` keep working |
| — | two processes on the monthly cap | PASS, re-verified | `concurrency.test.mjs` "two processes cannot both slip past the last free trip of the month"; exactly 5 stored, the rest refused, one lock around the check-and-write |

No new test file was added: every named gap already had a dedicated assertion before this pass,
and re-running the full suite found no regression and no new defect.

---

## Final test summary

    npm run build -w servers/per-diem   tsc clean, no output
    npm test -w servers/per-diem        # tests 33 / # pass 33 / # fail 0 / # skipped 0

33 tests: `unit.test.mjs`, `adversarial.test.mjs`, `corrupt.test.mjs`, `concurrency.test.mjs`,
`contract.test.mjs`. No file was added or changed in `test/` during this pass; all Part 1 gaps
named in the brief were already covered and still pass.

---

## RESULT.md block

    status: DONE
    evidence:
    - npm run build -w servers/per-diem: tsc clean
    - npm test -w servers/per-diem: # tests 33 / # pass 33 / # fail 0 / # skipped 0
    - Part 2: claude CLI 2.1.261, sonnet, per-diem + expense-tracker, per-tool allowlist, fresh
      XDG dirs in mcp.json's server env, shared profile (Nova Studio, Europe/Warsaw, EUR 23%),
      per-diem Pro key active, 6 prompts, 3.00/3, both stores verified on disk (TRIP-2026-0001
      Berlin, PL foreign scheme, EUR 117.33 -> expense 81095899 EUR 117.33 on expense-tracker;
      Oman refused by name with no Romania substitution; perdiem_report's Pro refusal separately
      verified against a fresh free-tier client)
    - Part 1 gap-fill: all 7 probes named in the brief (end before start, 400-day trip, DST
      crossing, unknown scheme, meals provided more than days, corrupt store, two processes on
      the monthly cap) were already asserted in docs/PER_DIEM_RESULT.md's 26-row table and
      servers/per-diem/test/*.test.mjs; all re-verified passing in this pass. No new test file
      needed
    artifacts:
    - /Users/mike/mcp-servers/docs/PER_DIEM_AUDIT.md
    cost: 35 wall minutes
    failures:
    - None found in this pass. `expense_add`'s own default VAT rate applied to a per-diem
      export is expense-tracker's documented default cascade, not a per-diem defect; the model
      caught and flagged the mismatch to the user unprompted
    insight:
    - Prompt 2's calendar ambiguity ("Monday to Wednesday" with no year) is the sharpest moment
      in the six-prompt run: the model asked which week rather than guessing silently, then
      recomputed against the confirmed dates. That confirmation round trip is exactly the
      behavior the corresponding unit test enforces in isolation ("a datetime with no zone is
      refused rather than assumed") extended to a case the schema cannot catch by itself,
      because a bare "Monday 9:00" is syntactically valid and only wrong in context

Built by theluckystrike. https://github.com/theluckystrike
