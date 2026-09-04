# Profile-first sweep: never ask for a fact the shared profile already holds

Round 13 found D-R64 (`qr_payment_sepa` required `iban` and `name`, so a model asked the user
for their own IBAN and drew nothing) and round 15 found D-R82 (`find_meeting_slots` required a
`zone` per participant, so a model asked the user what timezone they are in). Both were the same
defect in two servers: **business identity treated as per-call input.** Both were fixed one tool
at a time.

This is the sweep that asks the question estate-wide instead. Every tool argument in
`servers/*/src/index.ts` whose name or description overlaps a field the shared business profile
carries was listed, and every one that the profile could fill but did not was fixed to the D-R64
pattern: the argument is optional, it falls back to `readSharedProfile()`, an explicit argument
still wins and is never annotated, the response says where an unpassed value came from, and where
neither exists the tool refuses by **naming `business_set`** rather than asking the caller.

## The profile's fields

From `packages/mcp-license/src/profile.ts`, `PROFILE_FIELDS`:

`name`, `address`, `email`, `phone`, `vat_id`, `iban`, `bank`, `default_currency`,
`default_tax_rate`, `payment_terms_days`, `invoice_prefix`, `timezone`, `timezone_source`,
`logo_path`.

Note two fields that read like something they are not: `bank` holds a **bank name**, not a BIC,
and there is no `website`, `job title` or `logo URL` field. Nothing below falls back to a field
that does not exist.

## Counts

| | before | after |
|---|---|---|
| Tool arguments overlapping a profile field (grep, false-positive name collisions removed) | 44 | 44 |
| Of those, **required** and fillable from the profile | 4 | **0** |
| Of those, optional with **no** profile fallback | 8 | **0** |
| Of those, already profile-backed | 32 | 44 |
| Servers reading `readSharedProfile` (`PROFILE_READERS` in `servers/invoice/src/index.ts`) | 12 | **14** |
| New tests | - | 12, in 6 servers |

## What changed

Every row: the argument became optional where it was required, gained the profile fallback, and
the response names the source. The refusal, where neither the argument nor the profile has a
value, names `business_set` and says nothing was written.

| Server | Tool | Arg | Before | After |
|---|---|---|---|---|
| barcode | `qr_vcard` | `name` | **required** | optional; `profile.name`; refuses naming `business_set` |
| barcode | `qr_vcard` | `phone` | optional, no fallback | `profile.phone` |
| barcode | `qr_vcard` | `email` | optional, no fallback | `profile.email` |
| barcode | `qr_vcard` | `address` | optional, no fallback | `profile.address` |
| resume | `profile_set` | `name` | **required** | optional; stored profile, then `profile.name`; refuses naming `business_set` |
| resume | `profile_set` | `phone` | optional, no fallback | stored profile, then `profile.phone` |
| currency | `convert` | `to` | **required** | optional; `profile.default_currency`; refuses naming `business_set` |
| currency | `fx_rates_for` | `target` | **required** | optional; `profile.default_currency`; refuses naming `business_set` |
| currency | `rates_latest` | `base` | optional, hardcoded EUR | `profile.default_currency`, else EUR |
| bank-statement | `statement_import` | `currency` | optional, hardcoded EUR | `profile.default_currency`, else EUR |
| expense-tracker | `expense_add` | `currency` | optional, `expense_settings` then EUR | call, then `expense_settings`, then `profile.default_currency`, then EUR |
| time-tracker | `project_set_rate` | `currency` | optional, hardcoded USD | call, then a currency spelled out in `hourly_rate`, then `profile.default_currency`, then USD |

`qr_vcard` is the sharpest of these: "make a QR code with my contact details" required a name and
had no fallback for phone, email or address, so a model asked the user for four facts the profile
already held. It now draws the card from the profile and says
`name, phone, email, address taken from the shared business profile.`

`currency` and `bank-statement` were not reading the shared profile at all before this sweep; both
are now in `PROFILE_READERS`, which `servers/invoice/test/profile-readers.test.mjs` re-greps so the
list cannot drift.

## Already profile-backed, unchanged

These were checked and left alone because they already resolve through the shared profile:

- barcode `qr_payment_sepa` and `invoice_payment_qr`: `iban`, `name` (D-R64).
- timezone `find_meeting_slots`: participant `zone`, and `contacts_list`'s `You:` row (D-R82).
- resume `profile_set`: `email` (D-R40, with the `[add: email]` placeholder).
- expense-tracker `expense_add`: `vat_rate` / `tax_rate` / `vat`, via `default_tax_rate` (D-R34).
- image `image_watermark`: `text`, defaulting to the business name.
- invoice `invoice_create` / `invoice_from_hours`, docx `proposal_create` / `proposal_update` /
  `contract_create`, quotes `quote_create` / `quote_update` / `quote_send_text`, recurring
  `schedule_create` / `schedule_update`: `currency`, `tax_rate`, `terms`, `due_days`, `issue_date`
  and `sign_off` all resolve through `getBusiness()`, which merges the shared profile
  (`servers/invoice/src/store.ts`).
- time-tracker `timer_start` / `entry_add` / `entry_edit`: `currency`, via `currencyFor()`.

## Exempt: the profile-writing tools themselves

`business_set` (invoice and docx) and `expense_settings` (expense-tracker) take these fields as
input because writing them is the point. They are the tools every refusal above points at.

## Considered and rejected

Not everything that shares a name with a profile field is your identity:

- invoice `client_add`: `name`, `address`, `email`, `vat_id` are the **client's**, never yours.
- resume `cover_letter_create`: `company` is the employer you are writing to.
- price-tracker `price_add_manual` / watch tools: `currency` is what a shop's page prints.
  Defaulting a scraped foreign price to your own currency would mislabel the number.
- currency `convert.from`, `convert_many.from`: the currency the amount is in, genuinely per-call.
- barcode `qr_vcard.org` / `.title` / `.url`, `qr_payment_sepa.bic`: the profile has no field for
  any of these (`bank` is a bank name, not a BIC).
- Name collisions with unrelated meaning: spreadsheet `sheet_add_column.name`, zip `zip_add.prefix`,
  bank-statement `statement_import.bank` (a parser profile) and `.account`, time-tracker
  `report.group_by` / `.format`, `statement_summary.top`.

## Tests

Three per changed server, to the pattern the D-R64 and D-R82 fixes set: the fallback is used and
annotated; an explicit argument wins and is **not** annotated; with neither, the refusal names
`business_set`.

- `servers/barcode/test/smoke.test.mjs`
- `servers/resume/test/smoke.test.mjs`
- `servers/currency/test/smoke.test.mjs`
- `servers/bank-statement/test/smoke.test.mjs`
- `servers/expense-tracker/test/bank-sibling.test.mjs`
- `servers/time-tracker/test/currency.test.mjs`

## One unrelated defect found and fixed on the way

`servers/expense-tracker/test/bank-sibling.test.mjs` asserted on transactions dated `2026-08-05`
and `2026-08-07` while the free tier reads a window of the last 30 days measured from **today**.
The test passed when it was written and started failing on 2026-09-05, when the older of the two
rows fell out of the window and the count dropped from 2 to 1. Every date in that fixture is now
relative to today. A fixed date against a rolling window is a time bomb, not a test.
