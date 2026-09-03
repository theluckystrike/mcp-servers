# User value audit, round 8 — 2026-09-03

Round 8 is **a freelancer's week**, in order, through one conversation: onboarding, a new client,
a proposal, a contract, a timer, a receipt and a drive, a meeting, an invoice, a retainer, a CSV
export, a tailored resume, and a Friday "where do I stand". Twelve sentences, each one following
from the last, all of them through the `office-suite` bundle — which since round 7 proxies **eleven**
child servers rather than eight (`resume`, `recurring` and `clauses` joined).

Round 7 asked whether a chain holds when a number crosses two servers. Round 8 asks the harder
question: **does a fact the user states once, in sentence 1, still hold in sentence 12?**

## Method

- **Client** — `claude -p ... --model sonnet --strict-mcp-config --output-format stream-json
  --verbose --max-turns 18`, per-tool allowlist written out by name, **108 entries**, taken from a
  live `tools/list` against the bundle (`/private/tmp/uv41/tools.mjs`), because `--allowedTools
  "mcp__*"` grants nothing (D-E4, round 7).
- **Server** — `servers/office-suite/dist/index.js` **v0.4.0** registered as ONE server named
  `office`, proxying eleven children: time-tracker, price-tracker, spreadsheet, invoice,
  expense-tracker, currency, docx, timezone, resume, recurring, clauses. `tools/list` returns
  **108 tools**; the two colliding `business_set` tools are exposed as `invoice_business_set` and
  `docx_business_set`.
- **One lane, one conversation** — `/private/tmp/uv41`, fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME`,
  `MCP_LICENSE_KEY=""` (**free tier throughout**), `--session-id` then thirteen `--resume`, so
  "stop it", "this week" and "my clause library" all point at something.
- **Fixture** — none, except one pre-run download of `eurofxref-daily.xml` / `eurofxref-hist.xml`
  to warm the ECB cache (`/private/tmp/uv41/seed.mjs`). **Every other row in every store in this
  document was created by the model.** No time entries, no clients, no profile were seeded.
- **Turns** — 14 CLI invocations for 12 scenarios: scenario 5 is two sentences ("start a timer",
  then "stop it and log 3 more hours"), and scenario 11 is a background paragraph followed by the
  posting. Scores are per scenario; calls and seconds are summed across a scenario's turns.
- **Clock** — local zone UTC+07, run start 14:06 local = 07:06 UTC, Thursday 2026-09-03. The week is
  Mon 2026-08-31 .. Sun 2026-09-06; "yesterday" is 2026-09-02. At that hour the ECB has not published
  2026-09-03, so "today's rate" must resolve to 2026-09-02 — the same honesty test as round 7.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap to close. 1 = partially wrong, or asked for something the tool
could infer. 0 = failed. Tool-call counts exclude the client's own `ToolSearch` schema lookups.

## Scorecard — 27 / 36

| # | Servers crossed | Scenario | Score | Calls | Sec | Note |
|---|---|---|---|---|---|---|
| 1 | invoice | "I am Lucky Strike Software in Warsaw, VAT PL1234567890, I invoice in EUR with 23% VAT, 14-day terms." | **2** | 1 | 32.2 | `invoice_business_set` stored all five facts plus `invoice_prefix: "INV"`, verified in `invoice/business.json`. Marked down because the bundle keeps **three** business/tax profiles and this sentence filled one: `docx/business.json` did not exist (it cost a document in s3) and `expense-tracker` `settings` stayed `{}` (it cost the VAT split in s6). D-R31. The model also left the bundle here — twice — to write the same facts into the CLI's own memory directory. |
| 2 | invoice + timezone | "New client Nova Labs in Austin; save Tom Reed there as a contact, Austin time." | **3** | 2 | 11.7 | `client_add {name: "Nova Labs", address: "Austin, TX, USA"}` -> `a1863018`; `contacts_set {name: "Tom Reed", zone: "Austin"}` -> resolved to `America/Chicago`, 09:00-17:00, and quoted the local time there. Two servers, one sentence, no clarification. |
| 3 | clauses + docx | "Write a proposal for Nova: API redesign, 3 phases, 6,000 EUR, using my standard scope and payment clauses." | **2** | 7 | 76.3 | `clause_list {scope}`, `clause_list {payment}`, `clause_get {scope-of-work}`, `clause_get {payment-terms}` -> `proposal_create`. The document is right: three phases, `EUR 6,000.00` twice, both clause bodies filled with Nova Labs / 6,000 / EUR / 50 percent / 14 days, `All amounts exclude VAT at 23%`. But the first `proposal_create` came back "No business profile yet ... run `docx_business_set` and create it again", so the model set the second profile and generated the proposal **again** — burning `PROP-2026-0001`, two of the free tier's three monthly documents, and leaving a phantom row in `documents.json` whose `path` points at a file that now says `PROP-2026-0002`. D-R31, D-R32. It also invented an email address for the letterhead. D-R40. `proposal_update` exists on the bundle and was never mentioned by the failing message. |
| 4 | clauses | "Draft the contract from my clause library: scope, payment 50% upfront, IP on final payment, Polish law." | **2** | 8 | 39.4 | Six exploratory calls, then `contract_assemble {clause_ids: [scope-of-work, payment-terms, ip-assignment, governing-law], values: {...}}`. The `.docx` is clean: numbered 1-4, the disclaimer, `50 percent before work begins`, `On receipt of payment in full ... assigns`, `governed by the laws of Poland`, zero surviving `{{`, and the scope names the proposal reference. Marked down because the assembled contract **cites two clauses it does not contain** — "handled under the Change Requests clause" and "not resolved under the Dispute Resolution clause". D-R37. |
| 5 | time-tracker | "Start a timer on Nova, API design." / "Stop it and log 3 more hours yesterday on Nova at 90 EUR." | **2** | 3 | 22.7 | `timer_start` -> `timer_stop` (11 s) -> `entry_add {minutes: 180, rate: 90, currency: EUR}` -> `EUR 270.00`, exact. Marked down for two things the store shows: the stopped timer is kept as an entry with `seconds: 11, rateCents: 0, currency: "USD"` — a zero-value row in a EUR business, which then rode into the invoice summary and the CSV — and the 3 h are stamped `2026-09-02T02:00:00Z`, i.e. 09:00 in the **machine's** zone, which is 04:00 in the Warsaw the user declared in sentence 1. D-R35. |
| 6 | expense-tracker | "Log a 61.50 EUR Adobe receipt for Nova, billable, and a 30 km drive to the airport in Poland." | **1** | 2 | 19.7 | `expense_add` stored `EUR 61.50`, project Nova Labs, billable true — but `vat_rate: 0`, `net = gross = 61.50`. The 23% given in sentence 1 lives in `invoice/business.json` and expense-tracker never sees it, so the expected **50.00 + 11.50** split did not happen; the tool said so in its own answer and the model relayed it rather than passing `vat_rate: 23`. D-R34. `mileage_add {km: 30, region: "PL"}` -> `PLN 34.50` correctly, but with **no project and no billable flag**, so the drive is invisible to every project view, to `expense_to_invoice`, and to the s10 CSV; the model then told the user it was "not marked billable" when the store says `billable: true`. D-R36. |
| 7 | timezone | "Find a one-hour call with Tom next week inside both our working hours and give me the ics." | **3** | 2 | 26.0 | `find_meeting_slots {duration_minutes: 60, earliest_date: "2026-09-07", days: 5, participants: [You/Warsaw, Tom Reed/Austin]}` -> 5 slots, best `2026-09-07T14:00:00Z` = 16:00-17:00 Warsaw / 09:00-10:00 Austin, both inside 09:00-17:00 -> `ics_create`. The file is valid and honest: `DTSTART:20260907T140000Z`, `DTEND:20260907T150000Z`, a real `ORGANIZER ... mailto:`, and Tom in `DESCRIPTION` with the reason he is not an `ATTENDEE`. Round 7's D-R27 is fixed. The organizer address is the invented one from s3. |
| 8 | time-tracker + expense + currency + invoice | "Invoice Nova for this week's hours and expenses in USD at today's ECB rate." | **3** | 8 | 61.8 | `invoice_summary` -> `expense_to_invoice` -> `fx_rates_for {target: USD}` -> `expense_to_invoice {target_currency, fx_rates}` -> `invoice_create` -> `entry_mark_billed` -> `expense_mark_rebilled` -> `invoice_pdf`. **USD 383.80**, rate 1.1578 dated **2026-09-02** with the "not published until ~16:00 CET" explanation, and a stored note reading "Services supplied to a client outside the EU; invoiced at 0% VAT (reverse charge / outside scope)". Round 7's D-R24 and D-R28 are both fixed and both were exercised: `10420 x 3 = 31260` reproduces on a calculator, and the hours are now closed against the invoice. The best scenario in the round. |
| 9 | recurring | "Set Nova up on a monthly retainer of 20 hours at 90 EUR from next month and show me the next 3 invoices." | **2** | 3 | 30.6 | `schedule_create` came back **EUR 2,214.00** — 1,800 plus the 23% it inherited from the invoice business profile — so the model issued `schedule_update {tax_rate: 0}` to get the EUR 1,800.00 the user asked for. Correct end state (`schedules.json`: 20 x 90, monthly, from 2026-10-01, tax_rate 0) but the reasoning it gave, "0% VAT (US client)", is stored **nowhere**; the schedule has no note field. Then `schedule_upcoming {days: 100}` was silently clamped to the free tier's 30, returning one occurrence, so two of the "next 3 invoices" are the model's own arithmetic. D-R39. |
| 10 | time-tracker + expense + spreadsheet | "Export this week's Nova time and expenses to a CSV and then open it and total it by type." | **2** | 5 | 27.6 | `export_csv` (2 rows) + `expense_export` (1 row) -> `sheet_query` aggregates. Totals verified against the files: **270.00 / 3.00 h** and **61.50**. Three deductions: the time CSV carries the 0.00 h timer stub as a real row; the mileage is missing entirely because it has no project; and `sheet_query {col: "amount"}` **errored** on the expense CSV — time-tracker calls that column `amount`, expense-tracker calls it `gross` — costing a call. D-R38. "By type" was answered per file, not per expense category. |
| 11 | resume | 120-word background, then "Tailor my resume to this Nova job posting: ..." | **2** | 5 | 80.0 | `profile_set` (3 roles, 8 bullets, 9 skills) -> `tailor_to_job` -> **`profile_set` again** -> `tailor_to_job` -> `resume_to_html`. The output is a real tailored resume, coverage 50% -> 57%, and no employer or date is fabricated. But there is no write path for tailoring: `tailor_to_job` only reports a gap, so the model **rewrote the user's stored profile** to raise the score, and in doing so a bullet the user dictated as "wrote the OpenAPI style guide two of those clients still use" is now stored, permanently, as "wrote the OpenAPI style guide **and governance documentation** two of those clients still use". D-R33. The keyword list is still noisy (`end`, `run`, `accretion`, `ten-year-old`, `austin-anchored` outrank nothing). |
| 12 | time-tracker + invoice + expense | "What is unbilled, what is due, and what did I earn this week?" | **3** | 5 | 40.0 | `report {unbilled_only: true}` -> nothing, with the tool volunteering "2 entries are hidden because they have already been invoiced"; `overdue_report` -> 0; `invoice_list {unpaid}` -> INV-2026-0001 **USD 383.80** due 2026-09-17; `report {unbilled_only: false}` -> **3.00 h, EUR 270.00**; `expense_list` -> the orphan **PLN 34.50**. The answer is correct on all three counts and it surfaced the mileage as the one thing the week left open, offering to fix it. It also relayed the free tier's 7-day report window rather than pretending to full history. |

**Totals: 51 tool calls, 468.0 s of wall clock, 27 / 36.**

**Per server** (calls through the bundle, `ToolSearch` excluded):

| Server | Calls | Tools used | Scenarios |
|---|---|---|---|
| clauses | 12 | `clause_list` x5, `clause_get` x4, `clause_search`, `contract_assemble` | 3, 4 |
| time-tracker | 8 | `timer_start`, `timer_stop`, `entry_add`, `invoice_summary`, `entry_mark_billed`, `export_csv`, `report` x2 | 5, 8, 10, 12 |
| expense-tracker | 7 | `expense_add`, `mileage_add`, `expense_to_invoice` x2, `expense_mark_rebilled`, `expense_export`, `expense_list` | 6, 8, 10, 12 |
| invoice | 6 | `invoice_business_set`, `client_add`, `invoice_create`, `invoice_pdf`, `invoice_list`, `overdue_report` | 1, 2, 8, 12 |
| resume | 5 | `profile_set` x2, `tailor_to_job` x2, `resume_to_html` | 11 |
| docx | 3 | `proposal_create` x2, `docx_business_set` | 3 |
| timezone | 3 | `contacts_set`, `find_meeting_slots`, `ics_create` | 2, 7 |
| recurring | 3 | `schedule_create`, `schedule_update`, `schedule_upcoming` | 9 |
| spreadsheet | 3 | `sheet_query` x3 | 10 |
| currency | 1 | `fx_rates_for` | 8 |
| price-tracker | 0 | — | a freelancer's week contains no price watch |

**Did the model leave the bundle?** Once, in scenario 1: one `Read` and two `Write` calls against
`~/.claude-alt2/projects/-private-tmp-uv41/memory/`, saving the business profile into the CLI's own
memory files after it had already stored it in the server. Client-harness behaviour, not a fallback —
every other request in the week was served by a bundle tool, and no `curl`, `WebFetch` or file read
of a store ever happened. Tool selection was right on 50 of 51 calls; the miss is the `amount` /
`gross` column guess in s10, which the schemas made unguessable.

**Errors returned:** 1 of 51 (`sheet_query`, unknown column). No tool crashed, no non-JSON line, and
the two free-tier gates that fired (docx generations, `schedule_upcoming` 30-day horizon) were both
relayed to the user in plain words.

## Independent verification of the numbers

Read off the ECB cache, the seven JSON stores, the two `.docx` packages, the `.ics`, the two `.csv`
files and the `.html` — never off the model's prose.

| Check | Method | Result |
|---|---|---|
| "Today's" ECB rate is 09-02, not 09-03 | `currency/daily.json`: `"date": "2026-09-02"`, `USD 1.1578` | PASS |
| Business profile | `invoice/business.json`: name, `vat_id "PL1234567890"`, `default_currency "EUR"`, `default_tax_rate 23`, `payment_terms_days 14` | PASS |
| The same profile in the other two stores | `docx/business.json` created only in s3; `expense-tracker` `"settings": {}` | FAIL, D-R31 |
| Client and contact | `invoice/clients.json` `a1863018` Nova Labs; `timezone/data.json` Tom Reed `America/Chicago` 09:00-17:00 | PASS |
| Proposal figures | `word/document.xml`: `EUR 6,000.00` in the Investment row and the Total, three timeline rows, `All amounts exclude VAT at 23%` | PASS |
| Proposal reference and file | `documents.json` holds `PROP-2026-0001` **and** `PROP-2026-0002` with the **same** `path`; the one file on disk says `Ref PROP-2026-0002` | FAIL, D-R32 |
| Letterhead email | `docx/business.json` `"email": "support@zovo.one"` — never given by the user; it is the operator's account address, taken from the client's environment | FAIL, D-R40 |
| Contract clauses | `word/document.xml`: headings `1. Scope of Work` .. `4. Governing Law`, `50 percent`, `On receipt of payment in full`, `laws of Poland`, zero `{{` | PASS |
| Contract cross-references | the same XML cites "the Change Requests clause" and "the Dispute Resolution clause"; neither is in the document | FAIL, D-R37 |
| 3 hours yesterday | `time-tracker/data.json` `8c9a8dce`: `seconds: 10800`, `rateCents: 9000`, `currency: "EUR"` -> 3.00 h, EUR 270.00 | PASS |
| The entry's wall-clock day | stored `2026-09-02T02:00:00.000Z` = 09:00 UTC+07 (the machine) = **04:00 Europe/Warsaw** | FAIL, D-R35 |
| Timer stub | `c13c1cbf`: `seconds: 11`, `rateCents: 0`, `currency: "USD"` in a EUR business; present in `invoice_summary` and in `nova-time-this-week.csv` | FAIL, D-R35 |
| Expense split 50.00 + 11.50 | `expense-tracker/data.json`: `amount_minor 6150`, no `vat_rate`; `expense_list` reports `net EUR 61.50 / vat EUR 0.00` | FAIL, D-R34 |
| Mileage | `70c14d62`: 30 km x 1.15 PLN/km = `PLN 34.50`, `billable: true`, **no `project`** | PASS on arithmetic, FAIL on routing, D-R36 |
| Meeting instant | `meeting.ics`: `DTSTART:20260907T140000Z` / `DTEND:20260907T150000Z` = 16:00-17:00 Europe/Warsaw Mon 07 Sep = 09:00-10:00 America/Chicago, both inside 09:00-17:00 | PASS |
| ICS validity | `ORGANIZER;CN="Lucky Strike Software":mailto:support@zovo.one` is a real CAL-ADDRESS; no bogus `ATTENDEE`; unnamed guest moved to `DESCRIPTION` with the reason | PASS (round 7 D-R27 fixed) |
| Invoice line 1 | `unit_price_minor 10420`, `quantity 3`, `gross_minor 31260`; **104.20 x 3 = 312.60 reproduces** | PASS (round 7 D-R24 fixed) |
| Invoice line 1 against the true conversion | 270 x 1.1578 = 312.606, so the line is USD 0.01 under the unrounded value — the documented cost of computing from the printed unit price | PASS, by the stated basis |
| Invoice line 2 | 61.50 x 1.1578 = 71.2047 -> `7120`; description carries "[VAT unknown, gross rebilled as-is]" | PASS |
| Invoice total | 31260 + 7120 = **38380 minor = USD 383.80**; `tax_minor: 0`; `due_date 2026-09-17` = issue + 14, the term from sentence 1 | PASS |
| VAT decision recorded | `notes`: "Services supplied to a client outside the EU; invoiced at 0% VAT (reverse charge / outside scope). Converted from EUR at the ECB reference rate of 2026-09-02 (1 EUR = 1.1578 USD)." | PASS |
| Hours closed after invoicing | `entry_mark_billed` -> `report {unbilled_only: true}` in s12 returns nothing and says 2 entries are hidden | PASS (round 7 D-R28 fixed) |
| Expense closed after invoicing | `485062d6`: `rebilled_at`, `rebilled_invoice: "INV-2026-0001"` | PASS |
| PDF exists | `invoice/pdf/INV-2026-0001.pdf` written, free-tier footer named | PASS |
| Retainer periods | `schedules.json`: `every: "monthly"`, `start_date: "2026-10-01"`, one item `20 x 90`, `tax_rate 0` -> EUR 1,800.00; `next_dates` 2026-10-01, 11-01, 12-01; `invoice_due` 2026-10-15 = +14 | PASS |
| Retainer VAT | first `schedule_create` returned **EUR 2,214.00** (1,800 + 23%); the correction to 0% lives only in the chat | FAIL, D-R39 |
| Time CSV | `nova-time-this-week.csv`, 2 data rows, `amount` column 270.00 + 0.00 | PASS on sum, the second row is the stub |
| Expense CSV | `nova-expenses-this-week.csv`, 1 data row, `gross 61.5`; the mileage is absent | PASS on sum, FAIL on completeness |
| CSV totals as reported | `sheet_query` sums: `total_amount 270`, `total_hours 3`, `total_gross 61.5`; the model's table says 270.00 / 61.50 / 331.50 combined | PASS |
| Resume facts | `resume/profiles.json` and the `.html`: 3 employers, dates 2021-, 2017-2021, 2014-2017, MSc 2014, 9 skills — all from the dictated background, none invented | PASS |
| Resume bullet drift | the stored bullet is now "Wrote the OpenAPI style guide **and governance documentation** two of those clients still use"; the user said "wrote the OpenAPI style guide two of those clients still use" | FAIL, D-R33 |
| Week answer | unbilled hours 0 (all marked billed), due USD 383.80 by 2026-09-17, overdue 0, earned 3.00 h / EUR 270.00, orphan PLN 34.50 named | PASS |

## Defects

**D-R31 (high, office-suite) — one business, three business profiles, and the user only fills one.**
Sentence 1 of a freelancer's week states the company, the VAT id, the currency, the tax rate and the
payment terms. `invoice_business_set` stored all five. `docx` keeps its **own** `business.json` (the
letterhead) and expense-tracker keeps its own `settings` (the default VAT rate), and neither was
touched, so the very next document failed and the receipt after that was never split. Repro: fresh
`XDG_DATA_HOME`, call `invoice_business_set {name, address, vat_id, default_currency: "EUR",
default_tax_rate: 23, payment_terms_days: 14}`, then `proposal_create {client, project_title, ...}` ->
"No business profile yet ... run `docx_business_set` and create it again", and
`expense_add {amount: 61.50, currency: "EUR"}` -> `vat_rate 0`. Server-side, in the bundle.
Fix direction: the bundle already knows which child owns which tool
(`servers/office-suite/src/index.ts:176`). Give it one `business_set` that fans out to every child
that has a business or settings surface — invoice, docx, expense-tracker (`expense_settings
{default_vat_rate}`) — and keep the per-child tools for overrides. Failing that, have
`invoice_business_set`'s answer name the other two calls, the way `invoice_summary` now names
`entry_mark_billed`.

**D-R32 (high, docx) — "create it again" is expensive advice.** `proposal_create` with no business
profile still writes the file, still consumes a reference number, still counts against the free
tier's three documents a month, and then tells the caller to create it again. The model did, so
`documents.json` holds `PROP-2026-0001` and `PROP-2026-0002` pointing at the **same path**, one file
exists, and the free tier has one generation left before the week is half over. Repro:
`/private/tmp/uv41/out/s3.jsonl`, then
`python3 -m json.tool /private/tmp/uv41/data/mcp-servers/docx/documents.json | grep path` -> the same
path twice. Server-side. Fix direction: check the business profile **before** writing anything and
refuse with the fix, so nothing is consumed; and since `proposal_update` now exists on the bundle,
name it in that message ("... then `proposal_update {reference}`") instead of "create it again".

**D-R33 (high, resume) — tailoring has no write path, so the model edits the user's profile.**
`tailor_to_job` is read-only: it returns `matched`, `missing` and a coverage percentage. There is no
`resume_create {emphasise: [...]}` or `tailor_apply`, so a model asked to "tailor my resume" has
exactly one lever — `profile_set` — and it pulled it. The stored profile, the one every future resume
and cover letter is built from, now contains a bullet the user never dictated: "and governance
documentation" was added to make the `documentation` keyword match, and the coverage number moved
50% -> 57% because of it. Nothing warned anyone; `profile_set` overwrites in place with no version
history. Repro: `/private/tmp/uv41/out/s11b.jsonl`, calls 2 and 3, then diff
`resume/profiles.json` against the dictated text in `s11a.jsonl`. Server-side.
Fix direction: give `resume_create` / `resume_to_html` an `emphasise: string[]` (reorder and select
stored bullets, never rewrite them) and have `tailor_to_job` return the ordering it recommends. Then
make `profile_set` refuse a silent overwrite of an existing profile — `profile_update {add_bullet}`
for real additions, and a warning naming the bullets whose text changed. The fact-integrity guard in
`cover_letter_create` (RESUME_AUDIT D-R2/D-R3) is worth nothing if the profile it checks against can
be rewritten to license the claim.

**D-R34 (high, expense-tracker) — the VAT rate the user gave in sentence 1 never reaches the
receipt.** "23% VAT" was stated at onboarding. `expense_add {amount: 61.50, currency: "EUR",
merchant: "Adobe", project: "Nova Labs", billable: true}` stored `net = gross = 61.50, vat = 0.00`
where a Polish freelancer expects **50.00 + 11.50**. The tool's own answer explains the fix
("Pass `vat_rate` on the call, or set a default once with `expense_settings`") and the model relayed
it to the user instead of acting on it, because nothing in the conversation told it the rate had a
home in this server. The consequence is not cosmetic: the receipt was then rebilled gross onto
INV-2026-0001 with `[VAT unknown, gross rebilled as-is]`, which is the correct conservative choice
and also the wrong number for the books. Repro: as above, on a fresh data dir, then
`expense_list` -> `"vat_rate": 0`. Server-side (with D-R31). Fix direction: fan the onboarding rate
into `expense_settings.default_vat_rate`; and when a receipt has no rate but a default exists,
apply it and say so, rather than recording a gross-only row that can never be corrected retroactively
(`expense_to_invoice` deliberately refuses to apply a default after the fact, so the moment of entry
is the only moment this can be got right).

**D-R35 (medium, time-tracker) — a stopped timer leaves a zero-rate row, and no entry knows what zone
it is in.** Two separate seams in one scenario. (a) `timer_start {project, task}` takes no rate and
no currency, so `timer_stop` wrote `rateCents: 0, currency: "USD"` into a business whose declared
currency is EUR; the row is 0.00 h so it changes no total, but it appears in `invoice_summary`, gets
passed to `entry_mark_billed`, and shows up as a line in the exported CSV. (b) `entry_add
{start: "2026-09-02T09:00:00"}` was resolved in the **host machine's** zone (UTC+07) and stored as
`02:00:00Z`, which is 04:00 in the Warsaw the user declared. Nothing is wrong by 3 hours here, but any
entry logged near midnight lands on the wrong day, and `report {from, to}` slices by those stamps.
Repro: `/private/tmp/uv41/data/mcp-servers/time-tracker/data.json`, both entries. Server-side.
Fix direction: default a timer's rate and currency from the project rate or the business profile and
say which was used; and give time-tracker a `zone` in its own settings (or read the business
profile's address), defaulting entry parsing to the user's zone rather than the process's, with the
resolved zone echoed in the answer.

**D-R36 (medium, expense-tracker) — `mileage_add`'s two routing arguments are the only ones with no
description, and the drive fell out of the week.** In `servers/expense-tracker/src/index.ts`, the
`mileage_add` schema describes `km`, `miles`, `date`, `purpose`, `region`, `rate_per_km` and
`currency` — and leaves `project: text().optional()` and `billable: z.boolean().optional()` bare. The
model filled every described argument and omitted both bare ones, so a drive the user described in the
same breath as a billable client receipt is stored with no project: it is invisible to
`expense_to_invoice`, absent from the s10 CSV, and in s12 it is the one loose end of the week. The
response then omits the billable flag it defaulted to `true`, and the model told the user the opposite.
Repro: `mileage_add {km: 30, purpose: "Drive to airport", region: "PL"}` -> stored `billable: true`,
no project; compare the answer text, which mentions neither. Server-side.
Fix direction: describe both arguments ("`project`: bill it to a client, the same name you use in
time-tracker"; "`billable`: default true"), and echo `project` and `billable` in the answer exactly as
`expense_add` does — that one sentence is what stopped the model guessing wrong on the receipt.

**D-R37 (medium, clauses) — an assembled contract cites clauses that are not in it.** The starter
`scope-of-work` body says work outside the description "is handled under the Change Requests clause",
and `governing-law` says the courts decide "any dispute that is not resolved under the Dispute
Resolution clause". Assemble a contract from `[scope-of-work, payment-terms, ip-assignment,
governing-law]` and both sentences ship pointing at nothing. In a document whose whole value is that a
non-lawyer can send it, a dangling cross-reference is the defect a lawyer finds first. Repro:
`contract_assemble {clause_ids: ["scope-of-work","payment-terms","ip-assignment","governing-law"]}`,
then `unzip -p <out> word/document.xml | grep -o "the [A-Z][a-z]* [A-Z][a-z]* clause"`. Server-side.
Fix direction: each starter clause already knows its own id; add a `references: string[]` field, and
have `contract_assemble` return `missing_references: [{clause: "scope-of-work", refers_to:
"change-requests"}]` with an offer to include them. Cheap, and it turns a silent hole into a prompt.

**D-R38 (medium, spreadsheet seam) — the two exporters name the same column differently.**
`export_csv` (time) writes `amount`; `expense_export` writes `gross`, `net`, `vat`. A model that has
just summed `amount` on the first file asks for `amount` on the second and gets
`Error: column "amount" not found`. The error message is good — it lists the real columns — and the
recovery cost one call, but the two files are meant to be read together by the same
`sheet_query`. Repro: `/private/tmp/uv41/out/s10.jsonl`, call 3 vs call 4. Server-side.
Fix direction: either add an `amount` alias column to the expense export (equal to `gross`), or, better,
say in both tools' descriptions which column carries the money — and give `sheet_query` a hint on a
miss ("did you mean `gross`?"), which it is one line from doing already.

**D-R39 (medium, recurring) — the free tier's horizon silently truncates the answer, and a tax
decision has nowhere to live.** `schedule_upcoming {days: 100}` returned `horizon_days: 30` with the
upgrade text; the model then produced the three requested periods from its own arithmetic. The
arithmetic is right and it said what it was doing, but "show me the next 3 invoices" on a monthly
schedule is a 90-day question, so the free cap makes the modal request unanswerable by the tool.
Separately, the schedule was created at EUR 2,214.00 (inheriting the 23% default) and corrected to
EUR 1,800.00 with `tax_rate: 0`; the reason — a non-EU client, reverse charge — is written into the
**invoice** notes in s8 but there is no field for it on a schedule, so every invoice this retainer
generates from October onward will carry 0% VAT with no explanation on the document. Repro:
`/private/tmp/uv41/out/s9.jsonl` and `recurring/schedules.json`. Server-side. Fix direction: make the
free cap a count of occurrences (3) rather than a window of days, so the plain question is answerable;
and add `notes` to `schedule_create` / `schedule_update`, passed through to every generated invoice.

**D-R40 (medium, docx + timezone; client-side, server-mitigable) — an address the user never gave was
printed on a client-facing document.** Asked for a letterhead it did not have, the model filled
`docx_business_set {email: "support@zovo.one"}` — the operator's account address, visible to it in the
harness environment, never mentioned in the conversation. It is now on the proposal and, because
`ics_create` reads the same profile, it is the `ORGANIZER` of the calendar invite for the client call.
Nothing in either server asked where the address came from. Repro: `docx/business.json` and
`timezone/meeting.ics` in `/private/tmp/uv41`. Fix direction: make `email` explicitly optional in
`docx_business_set` with a description that says to leave it out unless the user supplied it, and have
the proposal render "email not set" rather than accept an invented one; the same guard belongs on
`ics_create`'s organizer. A tool that prints an identity should never let a caller improvise one.

## Round 7 defects retested

| id | Round 7 | Round 8 |
|---|---|---|
| D-R24 | invoice line: unit price x quantity did not equal the amount | **fixed and exercised** — `10420 x 3 = 31260` in `invoices.json`, and `money.ts:116` now computes from the rounded unit |
| D-R25 | literal `\n\n` reached the printed page | **not reproduced** — no escape survives into either `word/document.xml` |
| D-R26 | `proposal_create` silently overwrote an earlier proposal | **guard works** (the second call had to pass `overwrite: true`) but the cost moved rather than vanished: D-R32 |
| D-R27 | `ics_create` wrote `ATTENDEE;CN=Sara:invalid:nomail` | **fixed** — real `ORGANIZER ... mailto:`, unaddressable guests moved to `DESCRIPTION` with the reason |
| D-R28 | invoiced hours stayed open | **fixed and exercised** — `entry_mark_billed` exists, was called unprompted, and s12 proves the hours are closed |
| D-R29 | child prose named the pre-rename tool | **fixed** — the failing `proposal_create` said `docx_business_set`, the exposed name, and the model called it directly |
| D-R30 | free tier gated "next week" at 5 days | **worked around, not fixed** — the model asked for exactly 5 days from Monday and got 5 slots; the cap is still 5 |

## Bottom line

Twenty-seven of thirty-six, fifty-one calls, eight minutes of wall clock, and the two defects that
cost the most points in round 7 — an invoice that did not add up, and hours that stayed open after
they were billed — are both fixed and were both exercised for real by this week's invoice. Scenario 8,
the hardest sentence in the set, is a clean 3: four servers, an FX rate the model correctly dated to
the previous day, a reverse-charge note it wrote into the store, and both halves of the work closed
against the invoice number.

What round 8 exposes is not arithmetic. It is that **the bundle has no memory of the user.** A
freelancer says who they are once, and eleven servers each decide separately what to do about it:
invoice keeps the VAT rate, docx does not have a letterhead, expense-tracker does not have a default
rate, time-tracker does not know the zone or the currency, recurring inherits the rate but not the
reason. Five of the ten defects in this round (D-R31, D-R34, D-R35, D-R39, D-R40) are the same
sentence — a fact stated in scenario 1 that was not there in scenario 6 or 9 — and the two most
expensive ones are what the model did to close the gap on its own: it invented an email address and
printed it on a contract-track document, and it rewrote the user's stored resume profile to make a
keyword match. Both were reasonable moves for a model with no other lever. Both are exactly what a
tool should never make a model choose.

## RESULT.md block

```
status: DONE
evidence:
  one conversation, 14 turns, 12 scenarios through servers/office-suite/dist/index.js v0.4.0
  108 tools from a live tools/list, per-tool allowlist, free tier, fresh XDG dirs, no seeded fixture
  51 bundle tool calls, 468.0 s, 27/36; 1 tool error; the model left the bundle once (CLI memory write)
  every number reproduced from the stores: invoice USD 383.80 (31260 + 7120), rate 1.1578 of 2026-09-02,
    3.00 h EUR 270.00, retainer EUR 1,800.00 x 3 periods, CSV totals 270.00 / 61.50
  round 7 D-R24, D-R27, D-R28, D-R29 verified fixed against live artifacts
artifacts:
  docs/USER_VALUE_R8.md, data/user_value_r8.json
  /private/tmp/uv41 (lane: mcp.json, allow.txt, run.sh, seed.mjs, out/*.jsonl, data/, csv, html)
cost: 65 wall minutes
failures:
  D-R31 one business, three business profiles; onboarding fills one
  D-R32 proposal_create consumes a reference and a free-tier document, then says "create it again"
  D-R33 tailoring has no write path, so the model rewrote the stored resume profile and altered a fact
  D-R34 the 23% VAT never reaches expense-tracker; the 61.50 receipt was never split 50.00 + 11.50
  D-R35 a stopped timer leaves a 0-rate USD row; entries are stamped in the machine's zone, not Warsaw's
  D-R36 mileage_add's project and billable are the only undescribed arguments, and the drive fell out
  D-R37 an assembled contract cites two clauses it does not contain
  D-R38 export_csv calls the money column amount, expense_export calls it gross
  D-R39 the free horizon truncates "the next 3 invoices"; a schedule has no field for its tax reason
  D-R40 the model invented an email address and it shipped on a proposal and an ICS ORGANIZER
insight:
  The arithmetic is solved. Every figure in this week -- an FX-converted invoice, a retainer, two CSV
  totals, a resume -- reproduces from the stores to the cent, and the two round-7 money defects are
  gone. What is not solved is identity. Eleven servers behind one bundle still means eleven places to
  say who you are, and the user says it once. Every remaining defect is a fact that did not survive the
  trip from sentence 1 to sentence 9 -- and the two worst are not the missing fact but the model's
  repair of it: with no letterhead it improvised an email onto a client document, and with no way to
  tailor a resume it edited the source of truth the fact-integrity guard checks against. A gap in a
  bundle is not a blank the user fills in. It is a blank the model fills in.
```
