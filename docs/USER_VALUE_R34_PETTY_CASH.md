# User value audit, round 34 (petty-cash, hosted) - 2026-09-06

Round 34 is a single-lane hosted re-run of round 33's six petty-cash prompts
(`data/user_value_r33.json`), which measured the server for the first time over stdio on the
free tier and scored 14/18: turn one taught the client the wrong replenishment rule before
any count had been taken, and turn five's Pro refusal carried a cap sentence
("Do not total or journal by hand from refused data...") that the client read as a prompt
injection and deliberately defied. That cap sentence has since been reworded as a statement
of fact. This round asks the identical six questions against
`https://mcp.zovo.one/mcp/petty-cash` per `docs/REMOTE_RESULT.md` Extension 18, with only
`/mcp/cash-book` also registered on the same token, per the amortization recipe in
`docs/USER_VALUE_R32_AMORTIZATION.md`. No code was changed as part of this round; it is
measurement only. Cap: 30 minutes, met in about 8 minutes wall.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect -m 15` -> 200, minting
  `anon_4756350dff4b74484716c23dc3e6ed09`. One token, reused for the whole lane.
- **Profile.** `business_set` called directly by curl on `/mcp/invoice` with the same token
  before any prompt ran: Nova Studio, `Europe/Warsaw`, `EUR`. Unlike round 32's amortization
  lane, petty-cash IS listed among the endpoints that read this shared profile.
- **Registration.** One `mcp.json`, two `http` entries, both
  `https://mcp.zovo.one/mcp/<server>` with an `Authorization: Bearer <token>` header:
  `petty-cash` (the lane under test) and `cash-book` (registered per the recipe, never
  called: no prompt named it and no journal step reached it).
- **Allowlist.** 18 explicit `mcp__<server>__<tool>` entries read from a live `tools/list` of
  both endpoints: petty-cash 9 (`float_open`, `topup_record`, `voucher_add`,
  `voucher_delete`, `reconcile`, `replenish_request`, `float_report`, `license_status`,
  `license_activate`), cash-book 9 (`ledger_build`, `period_delete`, `trial_balance`,
  `ledger_lines`, `month_close`, `ledger_export_csv`, `ledger_report`, `license_status`,
  `license_activate`). No `mcp__*` wildcard.
- **Client.** `claude` CLI 2.1.261, `-p`, `--model sonnet`, `--strict-mcp-config`,
  `--mcp-config` pointing at the two-entry file above, `--output-format json`, one
  `--session-id` (a real UUID) then five `--resume` so all six prompts are one conversation,
  each prompt its own isolated shell invocation under `timeout 240` with `</dev/null` on
  stdin, every call completing well inside the timeout with zero `permission_denials` and
  `is_error: false`, each result read back before the next prompt ran.
- **Empty working directory, disallowed CLI tools.** Every turn ran in an empty
  `/private/tmp/uv-r34pc/wd`, with `Bash, Read, Write, Edit, Glob, Grep, WebFetch,
  WebSearch, NotebookEdit, Task, TodoWrite, Agent` denied. Fresh `XDG_DATA_HOME` /
  `XDG_CONFIG_HOME` / `XDG_CACHE_HOME` / `XDG_STATE_HOME` under `/private/tmp/uv-r34pc/xdg`
  for every `claude` invocation. `npm_config_cache=/Users/mike/.npm-cache-local` and `PATH`
  prefixed with `$HOME/.npm-global/bin` for every call.
- **Verification, and why it needed two channels.** `replenish_request` and `float_report`
  are Pro-gated, and the remote endpoint has no path that elevates an existing anonymous
  token to Pro: calling `license_activate` with a signed key on the round's own token returns
  reconnect-with-the-key-as-bearer instructions rather than upgrading the token in place, and
  reconnecting with that key opens a completely different tenant (`lic:...`) with an empty
  store, confirmed live. So verification used: (1) `reconcile`, free and unlimited, called
  directly by curl on the round's OWN token after the six prompts, which read back
  `expected_minor 29795 = counted_minor 29795, difference_minor 0`, confirming the round's
  own write; and (2) a byte-identical replica float (same five vouchers, same dates, same
  categories, same count) opened under a signed Pro key (`scripts/sign-license.mjs '*'`) on a
  SEPARATE tenant, used only to obtain the authoritative `replenish_request` / `float_report`
  numerics, the real chart-of-accounts ids, and the real category split -- all deterministic
  given identical inputs, and cross-checked against the same-token `reconcile` echo.
- **A method limitation, disclosed.** `--output-format json` returns one aggregate result per
  call, not individual `tool_use` blocks. `num_turns` and the iteration count were used
  instead to determine whether a Pro-gated tool was actually invoked in a given turn: a
  single-turn, single-iteration result means no tool round trip occurred at all. This is how
  pc5's "no tool call was ever attempted" finding below was established.

## Scorecard - 16 / 18 (round 33, stdio: 14 / 18)

| # | Prompt | R33 (stdio) | R34 (hosted) | What happened |
|---|---|---|---|---|
| pc1 | Open a EUR 500 tin, Anna custodian, explain how it works | 2 | **3** | Correct rule stated from the first turn: a top-up restores the tin to exactly 500, not just the vouchers' sum. Round 33 opened with the wrong rule; that did not recur |
| pc2 | Record five March vouchers | 3 | **3** | All five recorded, EUR 201.94 total, EUR 298.06 balance, correct disclosure that only the taxi carries a receipt reference |
| pc3 | Try to push a EUR 9,000 laptop through the tin | 3 | **3** | Refused on the merits (insufficient balance) plus the added judgement that capital equipment does not belong in petty cash at all |
| pc4 | Count finds EUR 297.95, what does it mean | 2 | **3** | EUR 0.11 short, correctly computed; round 33's wrong subtotal (202.00 for a true 201.94) did not recur |
| pc5 | What is the cheque and the double entry | 1 | **1** | Cheque EUR 202.05 correct, but the journal folds the coffee voucher (refreshments) into an invented "office" line, dropping the real refreshments account, and uses invented ids ("cash over/short", "Cash (bank)") instead of the real ones. No tool call was attempted at all this time |
| pc6 | Just total the receipts, isn't that the cheque? | 3 | **3** | EUR 201.94 total given, then a flat correct no: the cheque must be 202.05 or the shortfall is baked in permanently |

**Totals: 16/18 hosted, against round 33's 14/18 over stdio on the identical six prompts.**

## Independent verification

| Claim | Evidence | Verdict |
|---|---|---|
| pc1's explanation | Consistent with the round's own later balance (298.06) and top-up figure (202.05 = imprest minus counted balance, not the voucher sum) | PASS |
| pc2's figures | Replica float with identical vouchers: `balance_minor 29806`, `vouchers_total_minor 20194`; only `VOU-2026-0002` (taxi) carries `receipt_ref` | PASS |
| pc3's refusal | Replica float refuses any voucher exceeding the balance on hand, same reasoning; no such voucher exists in the round's store or the replica | PASS |
| pc4's arithmetic | Same-token `reconcile` re-call: `expected_minor 29795 = counted_minor 29795, difference_minor 0` (confirms the round wrote `counted_minor 29795`); replica `reconcile`: `expected_minor 29806, counted_minor 29795, difference_minor -11` | PASS |
| pc5's cheque total, travel line, over/short | Replica `replenish_request`: `request_minor 20205`, `expenses:travel 5545`, `cash_over_short 11` | PASS on these three |
| pc5's office line | Reported "expenses:office (8.99+125.00) 133.99" as one line. Replica's real `by_category`: `office 12500` (printer paper alone) and `refreshments 899` (coffee alone) as TWO separate lines | FAIL -- a real account (refreshments) was dropped and folded into an invented single line |
| pc5's account ids | "cash over/short" and "Cash (bank)" reported. Replica journal's real ids: `cash_over_short` and `cash` | FAIL, same defect class as round 33 pc5, round 31 am6, round 32 am6 |
| pc6's total and consequence | 20194 minor matches the replica's `vouchers_total_minor`; the "49989 against 50000" consequence is exact arithmetic on the round's own figures | PASS |

## Was replenish_request ever actually called in pc5 or pc6?

No. `num_turns` for both responses is 1, with a single message iteration and no tool-use
round trip, meaning the model answered directly from context already in the conversation
rather than calling the Pro-gated tool and receiving a refusal. This matters directly for the
comparison this round was asked to make.

## Did the reworded cap sentence change the client's behaviour at the gate?

**This cannot be answered from this round, and that is itself the finding.**

Round 33's stdio run DID call `replenish_request`, WAS refused, and the refusal's cap
sentence at the time read as an imperative: "Do not total or journal by hand from refused
data; the free tools above already carry the exact figures." The model explicitly named that
sentence a prompt-injection attempt riding in a tool error and defied it, hand-building the
journal anyway with invented account ids.

Round 34 never reached that gate. Calling `replenish_request` directly on this round's own
token after the six prompts confirms the sentence has in fact been reworded, live:

> "The exact figures for this request are only in the free tools' output above; any total or
> journal composed outside them is an estimate, not a figure from the books."

That is a statement of fact, with no "do not" construction left for a model to read as a
directive. But since `num_turns` shows the model never called `replenish_request` in this
conversation at all, it never saw either the old or the new wording in pc5 or pc6. The
client's failure mode moved one step earlier: instead of misreading a warning after calling
the tool, it skipped the call that would have surfaced any warning, old or new. The
underlying defect the wording change was meant to address -- hand-building a journal from
data the client never fetched through the paid tool, with invented account ids -- is present
in both rounds. Only its proximate trigger differs, and this round supplies no evidence about
whether the reworded sentence, had the model actually reached it, would still be read as
hostile.

## Defects

1. **pc5**: no tool call attempted for `replenish_request` at all; the model answered from
   prior conversation context rather than calling the Pro tool.
2. **pc5**: a genuine category error, not just an id-invention. The coffee voucher
   (refreshments, EUR 8.99) was folded into an invented `expenses:office` 133.99 line rather
   than kept as its own `expenses:refreshments` account -- the replica's real journal has
   both as separate lines. The grand total still nets out correctly only because both real
   lines were merged rather than one being dropped outright.
3. **pc5**: account ids invented in place of the payload's own (`cash over/short` and
   `Cash (bank)` instead of `cash_over_short` and `cash`), the same defect class as round 33
   pc5, round 31 am6 and round 32 am6, now four rounds running across two different servers.

## Bottom line

16 of 18 hosted, against round 33's 14 of 18 over stdio on the identical six prompts,
through `https://mcp.zovo.one/mcp/petty-cash` with `cash-book` also registered but never
called. Three of round 33's defects did not recur: pc1 opened with the correct
replenishment rule instead of the wrong one, pc4's wrong voucher subtotal did not reappear
(201.94 + 0.11 = 202.05 stated directly), and pc2's disclosure behaviour was unchanged and
correct. The fourth, pc5's hand-built journal, recurred but through a different mechanism:
rather than calling `replenish_request`, being refused, and defying the refusal's cap
sentence, this run skipped the Pro tool call entirely and went straight to hand arithmetic --
so the reworded cap sentence, confirmed live to now read as a statement of fact, was never
seen by the model in this conversation. In its place, a real new defect appeared: a
refreshments voucher was folded into an invented office line and dropped from the journal as
its own account, on top of the unchanged invented-id defect. So the question of whether the
reworded cap sentence changed the client's behaviour at the gate has a null answer this
round: the gate was never reached, because the client's failure mode moved one step earlier,
from misreading a warning to skipping the call that would have surfaced it. Every
server-returned figure across all six prompts -- including those obtained via a
byte-identical replica float opened under a Pro key on a separate tenant, since this token's
Pro gate cannot be elevated without a real purchase -- matched to the minor unit. No code was
touched; this is a measurement-only report.

Built by theluckystrike. https://github.com/theluckystrike
