# cash-book: why ledger_lines stays free and ledger_export_csv stays Pro

status: DONE

## The decision

`ledger_lines` is free and unlimited because it is the evidence behind the trial balance: every
figure a user needs to check that the books add up, including `bank_ref`, the bank row that
evidences a cash leg, is already in that answer. `ledger_export_csv` stays Pro, but the gate is
on shape, not content. The CSV is a formatting convenience, RFC 4180 columns and a file, over
data `ledger_lines` already returns.

That is why `trial_balance` and `ledger_lines` were free before this change and remain free
now. Gating one of the only two tools that answer "do the books add up, and can I see why" would
have moved the gate onto the guardrail itself, which is the mistake `docs/GUARDRAILS_RESULT.md`
names directly: a Pro gate on a check removes the guardrail, not the answer. `ledger_export_csv`
is not that check; it is packaging. Nothing about the number of periods, the accounts shown, or
the fields returned differs between a `ledger_lines` call and the paid CSV. Only the container
does: JSON versus RFC 4180 text, and a file versus a tool response.

## The round 29 evidence

`data/user_value_r29.json`, prompt 6 ("Give me the per-account report and export the June ledger
as CSV so I can send it to my accountant."), scored 2 of 3. The model called `ledger_report` and
`ledger_export_csv`, both correctly refused as Pro, relayed both refusals and both checkout links
accurately, and did not attempt to buy anything. It then hand-assembled a per-account table (fine:
it matched `ledger_report`'s real figures) and a CSV (not fine) from data it already had on the
free tier.

The hand-built CSV did not match the real export's schema: the real `ledger_export_csv` writes
eleven columns, `account_name` and `bank_ref` included, with amounts in minor units; the
hand-built one had nine columns, no `account_name`, no `bank_ref`, and amounts in major units.
The verifier's own words: "An accountant handed that file would be missing the bank evidence
column, which is the column this server's whole design exists to produce."

The relevant fact this drops is not that the model lacked the data. It had already called
`ledger_lines` in prompt 1 and prompt 2 of the same conversation, and that tool's own line shape
(`servers/cash-book/src/index.ts`, `lineJson`) already carries `account_name` and `bank_ref` on
every leg, free and unlimited, because `derive()` always runs `matchBank` before any tool sees a
line. The model had the bank evidence sitting in its own context and left it out when it
reformatted by hand.

## The fix

Gate text and descriptions now say this outright, so a client reaches for the free tool instead
of reconstructing one:

- `ledger_export_csv`'s Pro refusal names `ledger_lines` as the free equivalent and states plainly
  that `bank_ref` is already in it, not something the export adds.
- `ledger_export_csv`'s own tool description says the same thing: every field it writes, `bank_ref`
  included, is already free and unlimited through `ledger_lines`; this tool only lays them out as
  CSV columns.
- `ledger_lines`'s tool description names `bank_ref` directly and says it is the same field the
  Pro CSV lays out as a column, not a Pro-only figure.
- `servers/cash-book/README.md` and `servers/cash-book/SPEC.md` carry the same statement in the
  Free vs Pro section, so a reader who never calls the tool still sees it.
- The guide `/guides/one-ledger-from-every-server` (`billing/src/content.js`) carries one paragraph
  making the same point, citing round 29 by name.

No enforcement changed. `ledger_export_csv`, `ledger_report` and `month_close` are still Pro; the
free cap on `ledger_build` is unchanged at three distinct periods a calendar month. Only the
words a client reads before or after a refusal changed, so the next model asked for a CSV reaches
for the tool that already has the data it needs instead of inventing a lesser copy of it.
