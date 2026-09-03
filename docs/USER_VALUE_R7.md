# User value audit, round 7 — 2026-09-03

Round 7 is a **cross-server round**. Every scenario is a sentence a freelancer would actually type,
and none of them can be answered by one child server: each one has to cross two, three or four of
the eight servers now behind the `office-suite` bundle. The question is no longer "does the tool
work" (rounds 1-6, plus the currency, docx and timezone audits, answered that) but "does the chain
hold when the client has to carry a number from one server into another".

## Method

Same client and rubric as rounds 3-6.

- **Client** — `claude -p ... --model sonnet --strict-mcp-config --output-format stream-json
  --verbose --max-turns 16`, per-tool allowlist written out by name — **76 entries**, every tool the
  bundle exposes — because `--allowedTools "mcp__*"` grants nothing (D-E4).
- **Server** — `servers/office-suite/dist/index.js` (v0.3.1) registered as ONE server named `office`,
  proxying eight children: time-tracker, price-tracker, spreadsheet, invoice, expense-tracker,
  currency, docx, timezone. `tools/list` returns **76 tools**; the bundle prefixed two colliding
  `business_set` tools into `invoice_business_set` and `docx_business_set`.
- **One lane, one conversation** — `/private/tmp/uv40`, fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME`,
  `MCP_LICENSE_KEY=""` (free tier), `--session-id` then `--resume` five times, so scenarios 2-6 can
  refer to "the invoice", "the proposal" and "the first Nova entry".
- **Fixture, seeded by direct JSON-RPC before the client ran** (`/private/tmp/uv40/seed.mjs`), so
  that "this week" and "the first Nova entry" have something to point at:
  two Nova entries, `2026-08-31 09:00-13:00` (4.00 h) and `2026-09-01 10:00-13:00` (3.00 h), both at
  EUR 90/h. The same script warmed the ECB cache with one real download of `eurofxref-daily.xml` and
  `eurofxref-hist.xml`. Everything else in the run was created by the model.
- **Clock** — local zone UTC+07, run start 09:36 local = 02:36 UTC. Today is Thursday 2026-09-03;
  the week is Mon 2026-08-31 .. Sun 2026-09-06. At that hour the ECB has not published 2026-09-03,
  so "today's rates" must resolve to 2026-09-02 — a deliberate honesty test.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn or a
workaround. 1 = partially wrong, or asked for something the tool could infer. 0 = failed.
Tool-call counts exclude the client's own `ToolSearch` schema lookups.

## Scorecard — 16 / 18

| # | Servers crossed | Scenario | Score | Calls | Sec | Note |
|---|---|---|---|---|---|---|
| 1 | time-tracker + expense + currency + invoice | "Log 6 hours today on Nova at 90 EUR, plus a 45 GBP train receipt for Nova. Invoice Nova in USD at today's ECB rates, 0% VAT, due in 30 days." | **3** | 8 | 63.5 | `entry_add` 6.00 h EUR 540.00 -> `expense_add` GBP 45.00 (**billable: yes** by default, the D-R21 fix, stated in the response) -> `fx_rates_for {target: USD, currencies: [EUR, GBP]}` -> `expense_to_invoice` -> `invoice_create` USD, `due_days: 30`, `tax_rate: 0` -> `expense_mark_rebilled`. **USD 685.88**, and the model volunteered that the rate date is 2026-09-02 because 09-03 is not published until 16:00 CET. Every number reproduces from the cache file (below). One-cent line defect D-R24 rides along. |
| 2 | time-tracker + docx | "Write a proposal for Nova based on the hours I logged this week: the work so far, then a phase 2 of 20 hours at the same rate, in EUR. Save it as a Word file." | **2** | 3 | 52.5 | `entry_list` -> `report {group_by: day}` (13.00 h, EUR 1,170.00) -> `proposal_create`. The .docx carries "totaling 13 hours", a timeline row "Phase 1 ... 13 hours", "Phase 2 - Implementation 20 hours" and **EUR 1,800.00** as the investment total. Correct arithmetic, one turn. Marked down because the shipped file contains the literal characters `\n\n` mid-sentence (D-R25) and because the EUR 1,170.00 already earned appears only in the chat, never in the client-facing document. |
| 3 | timezone + docx | "Set up a kickoff call with Nova's team: Sara in Sydney and Tom in Austin, next week, one hour. Give me the ics and put the meeting date into the proposal's timeline." | **2** | 5 | 71.5 | `find_meeting_slots {days: 7}` -> **paywall** (free tier searches 5) -> `{days: 5}` -> **"No slot fits everyone's working hours"** (Sydney/Austin 09:00-17:00 do not intersect at all) -> retried with Sara 07:00-17:00 and Tom 09:00-19:00, 25 slots -> `ics_create`. The .ics is right: `DTSTART:20260907T220000Z`, `DTEND:20260907T230000Z` = Mon 07 Sep 17:00 CDT Austin / Tue 08 Sep 08:00 AEST Sydney. The timeline row landed in the .docx verbatim. Marked down for three things the user pays for: a paywall on the plainest reading of "next week", working hours silently widened without asking, and a regenerated proposal that **overwrote the first one** and burned a second reference number (D-R26). |
| 4 | currency + arithmetic over the invoice | "What did 1 EUR cost in USD on the day I logged the first Nova hours, and how much would the invoice have been then?" | **3** | 2 | 21.8 | `rate_on {EUR->USD, 2026-08-31}` -> 1.1596 exact, and unprompted `rate_on {GBP->USD}` -> 1.353914, because the invoice mixes currencies. Recomputed **USD 626.18 + 60.93 = 687.11**, and named the delta against the real invoice (+1.23) and the rate date each side used. Independently exact (below). |
| 5 | invoice + docx | "Convert my invoice to a Word document I can edit." | **3** | 2 | 25.6 | `invoice_get {INV-2026-0001}` -> `doc_create {style: letter}` with a 5-column line table. Every figure in the .docx matches the store to the cent, including both FX annotations, and the model correctly framed it as editable text rather than a PDF. |
| 6 | timezone | "How many working days did I have between the first and last Nova entry, in Poland?" | **3** | 1 | 11.1 | `business_days {2026-08-31 .. 2026-09-03, zone: "Poland"}` -> `Europe/Warsaw`, **4 of 4 calendar days**. The tool states it has no holiday calendar; the model relayed that limit and then checked the specific window rather than hiding behind it. |

**Totals: 21 tool calls, 246.0 s of wall clock, 16 / 18.**

**Per server** (calls made through the bundle, `ToolSearch` excluded):

| Server | Calls | Tools used | Points it carried |
|---|---|---|---|
| timezone | 6 | `now`, `find_meeting_slots` x3, `ics_create`, `business_days` | 3, 6 |
| time-tracker | 3 | `entry_add`, `entry_list`, `report` | 1, 2 |
| expense-tracker | 3 | `expense_add`, `expense_to_invoice`, `expense_mark_rebilled` | 1 |
| currency | 3 | `fx_rates_for`, `rate_on` x2 | 1, 4 |
| invoice | 3 | `client_list`, `invoice_create`, `invoice_get` | 1, 5 |
| docx | 3 | `proposal_create` x2, `doc_create` | 2, 3, 5 |
| spreadsheet | 0 | — | none of these six sentences is a spreadsheet |
| price-tracker | 0 | — | idem |

Every tool the model reached for was the right one. **D-R19 (the tool is never called) did not recur
once in this round** — six scenarios, four servers crossed in a single sentence, and not one fallback
to `Read`, `curl` or `WebFetch`. Two of the three round-6 description fixes could not be retested
here (no spreadsheet or price sentence), but the failure mode itself did not appear.

## Independent verification of the numbers

Read off the ECB cache, the three JSON stores, the two .docx packages and the .ics — never off the
model's prose.

| Check | Method | Result |
|---|---|---|
| "Today's" ECB rate is 09-02, not 09-03 | `data/mcp-servers/currency/daily.json`: `"date": "2026-09-02"`, `USD 1.1578`, `GBP 0.8587` | PASS |
| GBP -> USD cross rate | 1.1578 / 0.8587 = 1.3483172237... ; the server returned **1.348317** | PASS |
| Invoice total | 6 x (90 x 1.1578) = 625.212 -> **625.21**; 45 x 1.348317 = 60.674265 -> **60.67**; sum **USD 685.88**. `invoices.json` `subtotal_minor: 68588`, `total_minor: 68588`, `tax: []` | PASS |
| Unit price x quantity does not equal the line | store line: `unit_price_minor: 10420`, `quantity: 6`, `gross_minor: 62521`. 10420 x 6 = 62520 | FAIL, D-R24 |
| Due date | issue 2026-09-03 + 30 -> `due_date: 2026-10-03` | PASS |
| Expense billable by default with a project | `expense-tracker/data.json`: `"billable": true` with no `billable` argument passed, plus `rebilled_at` and `rebilled_invoice: "INV-2026-0001"` | PASS (D-R21 fix holds) |
| Hours in the proposal | `word/document.xml`: "totaling 13 hours", timeline "Phase 1 ... 13 hours", "Phase 2 - Implementation 20 hours" | PASS |
| Amount in the proposal | `word/document.xml`: "EUR 1,800.00" twice (investment row and total). 20 x 90 = 1800 | PASS |
| Proposal is a valid package | `unzip -t` -> "No errors detected" | PASS |
| Literal `\n\n` in the proposal body | `word/document.xml` contains `confidence.\n\nBuilding on that foundation` as character data | FAIL, D-R25 |
| Proposal file was overwritten | `documents.json` holds two rows, `PROP-2026-0001` and `PROP-2026-0002`, with the **same** `path`; only one file exists on disk and it says `Ref PROP-2026-0002` | FAIL, D-R26 |
| Meeting instant | `meeting.ics`: `DTSTART:20260907T220000Z` / `DTEND:20260907T230000Z`. 22:00Z = 17:00 CDT (UTC-5) Austin Mon 07 Sep = 08:00 AEST (UTC+10) Sydney Tue 08 Sep | PASS |
| ICS attendees | `ATTENDEE;CN=Sara:invalid:nomail` — not a CAL-ADDRESS; RFC 5545 wants `mailto:` | FAIL, D-R27 |
| Rate on the first-entry day | `history.json` `days["2026-08-31"]`: USD 1.1596, GBP 0.85648; cross 1.1596/0.85648 = 1.3539136... -> **1.353914** | PASS |
| Scenario 4 arithmetic | 540 x 1.1596 = **626.184 -> 626.18**; 45 x 1.353914 = **60.926 -> 60.93**; total **687.11**, exactly what the model reported | PASS |
| Invoice .docx matches the store | `word/document.xml`: `USD 104.20 / 0% / USD 625.21`, `USD 60.67`, `Subtotal: USD 685.88`, `Tax (0%): USD 0.00`, `Total due: USD 685.88`, both FX notes | PASS |
| Working days | `business_days` -> 4 of 4, days listed 08-31, 09-01, 09-02, 09-03; all Mon-Thu | PASS |
| The 6 h are still un-invoiced in the tracker | `time-tracker/data.json`: all three entries carry `rateCents: 9000`, none carries any invoiced / billed-on marker after INV-2026-0001 was issued | FAIL, D-R28 |

## Defects

**D-R24 (high, invoice) — a line's unit price times its quantity does not equal the line amount.**
`servers/invoice/src/money.ts:116` computes the line from the *unrounded* unit price
(`gross = roundHalfUp(quantity * unit_price * f)`) while `:123` stores the *rounded* one
(`unit_price_minor = roundHalfUp(unit_price * f)`). Any converted rate lands on a sub-cent unit
price, so the two disagree. Exact repro, and it is the real invoice this round shipped:
`invoice_create {items: [{description: "...", quantity: 6, unit_price: 104.202, tax_rate: 0}],
currency: "USD"}` -> stored `unit_price_minor: 10420`, `gross_minor: 62521`; the .docx and the JSON
both print `USD 104.20`, `6`, `USD 625.21`, and 104.20 x 6 = 625.20. A client who checks the
arithmetic on the invoice finds it wrong by a cent, which is exactly the kind of thing that gets an
invoice queried. Server-side. Fix direction: pick one basis and state it. Either round the unit price
first and compute `gross` from the rounded value (the line then always adds up, at the cost of a cent
against the true converted total), or keep the precise basis and carry the extra precision into the
displayed unit price (`USD 104.202`) plus a note. The `expense_to_invoice` -> `invoice_create` handoff
should pass whichever it is; today it passes six-decimal unit prices into a two-decimal display.

**D-R25 (medium, docx) — a literal `\n\n` reaches the printed page.** The `summary` argument of
`proposal_create` is rendered as one paragraph. A model that wants two paragraphs writes `\n\n`, and
the escape survives into `word/document.xml` as character data, so the delivered proposal reads
"...proceed with confidence.\n\nBuilding on that foundation...". Repro:
`/private/tmp/uv40/out/s2.jsonl`, then `unzip -p .../nova-engagement-phase-2-proposal.docx
word/document.xml | grep 'n\\nBuilding'`. The escaping is the client's, but the server can neutralise
it: split `summary` (and any other free-text block) on real newlines into separate `<w:p>` elements,
and additionally treat a literal backslash-n as a paragraph break, since no proposal legitimately
contains that sequence. Say so in the argument description ("newlines start a new paragraph"), which
also stops the model reaching for the escape in the first place.

**D-R26 (high, docx) — `proposal_create` silently overwrites an earlier proposal when it derives its
own path.** The round-6 docx fix refuses to clobber an explicit `out_path` (audit item 12/14), but
when `out_path` is omitted the file name is slugged from the title, so a second call with the same
title lands on the same file with no guard. This round: two `proposal_create` calls, references
`PROP-2026-0001` and `PROP-2026-0002`, `documents.json` records **the same path for both**, and the
only file on disk is the second one. The user was told "Proposal updated: same file", which is true
by accident — nothing updated anything, the first document is gone. Repro: call `proposal_create`
twice with `client: "Nova"`, `project_title: "Nova Engagement - Phase 2 Proposal"`, no `out_path`.
Server-side. Fix direction: apply the same collision guard to derived paths, and when the target
exists, suffix the slug with the new reference (`nova-engagement-phase-2-proposal-PROP-2026-0002.docx`)
rather than refusing — a regeneration is a normal thing to want. Related, and the reason the model
regenerated at all: there is no way to edit a generated document. `doc_fill_template` needs
`{{placeholders}}` that `proposal_create` does not emit, so "put the meeting date into the proposal"
can only be served by building the whole document again, which on the free tier costs one of three
monthly generations and burns a reference number.

**D-R27 (medium, timezone) — `ics_create` writes an invalid ATTENDEE value.** The file contains
`ATTENDEE;CN=Sara:invalid:nomail`. RFC 5545 defines ATTENDEE as a CAL-ADDRESS, i.e. a URI, normally
`mailto:`; `invalid:nomail` is a placeholder scheme. Strict parsers reject the property and lenient
ones show an attendee nobody can reach, and the .ics carries no ORGANIZER at all, so the invite is
not actionable in a calendar client. Repro: `ics_create {title, start, zone, duration_minutes: 60,
attendees: ["Sara", "Tom"]}` -> `/private/tmp/uv40/data/mcp-servers/timezone/meeting.ics`.
Server-side. Fix direction: accept `attendees` as either a name or `{name, email}`; emit ATTENDEE only
for entries that have an address, and put bare names in DESCRIPTION instead. If `contacts_set` grows
an optional email, the kickoff case resolves itself — the participants are already saved contacts.

**D-R28 (high, cross-server: time-tracker + invoice) — invoicing hours leaves the hours open, and
there is no FX path that would have closed them.** `expense_to_invoice` converts, marks
`rebilled_at` and names the invoice, so an expense cannot be billed twice. Hours have no equivalent:
`invoice_from_hours` (`servers/invoice/src/index.ts:396`) takes bare `hours` and `rate` numbers and
knows nothing about the tracker, and it has no `target_currency` / `fx_rates` pair, so the moment the
invoice currency differs from the rate currency — the whole point of scenario 1 — the model must
hand-build the line in `invoice_create`. It did, correctly. The consequence is silent: after
INV-2026-0001 was issued, `time-tracker/data.json` still shows all three entries with no invoiced
marker, so the next "invoice Nova" bills the same 6 hours again. Repro: the whole of
`/private/tmp/uv40/out/s1.jsonl`, then `grep -c invoiced
/private/tmp/uv40/data/mcp-servers/time-tracker/data.json` -> 0. Server-side, and the largest gap the
bundle has: the two halves of a freelancer's invoice behave differently. Fix direction: give
time-tracker the same shape expense-tracker already has — `hours_to_invoice {project, from, to,
target_currency, fx_rates, markup_percent}` returning invoice-ready lines, and
`entries_mark_invoiced {ids, invoice_number}` writing `invoiced_at` / `invoiced_invoice`, with
`report` and `invoice_summary` excluding already-invoiced entries by default.

**D-R29 (medium, office-suite) — the bundle renames colliding tools but the children's own prose
still names the old tool.** `business_set` exists in both invoice and docx, so the bundle exposes
`invoice_business_set` and `docx_business_set`. Every child response that ends "Run `business_set`
{name, address, email, vat_id} and create it again" now names a tool that does not exist on the
bundle, and the model relayed that text to the user twice (scenarios 2 and 3) before working out the
prefixed name on its own in scenario 5. Repro: any `proposal_create` or `invoice_create` response in
`/private/tmp/uv40/out/`. Server-side (the bundle). Fix direction: the proxy already knows both the
child name and the exposed name (`servers/office-suite/src/index.ts:176`); when a tool was renamed,
rewrite whole-word occurrences of the child's own tool names in the text content it forwards, and
list the renames once in the bundle's startup line and README.

**D-R30 (medium, timezone) — the free tier gates the plainest reading of "next week", and a
zero-overlap pair gets no fallback.** "Next week" is a 7-day window; `find_meeting_slots {days: 7}`
returns the upgrade text on the free tier (the cap is 5), so the first call of the scenario was spent
on a paywall. Then Sydney and Austin, both 09:00-17:00, have literally no intersection, and the tool
answered "No slot fits everyone's working hours ... Try a shorter duration, widen someone's
work_start/work_end". The model widened both participants' hours by itself and never told the user it
had changed their assumptions — a defensible move that a tool should not force. Repro:
`/private/tmp/uv40/out/s3.jsonl`, calls 1 and 2. Fix direction: when nothing fits, return the best
near-misses anyway, ranked by how far outside working hours each side sits ("Sara 08:00, one hour
before her start"), flagged as `outside_working_hours: ["Sara"]` — that is the answer the user wants
from a Sydney/Austin pair, and it removes the incentive to silently rewrite the constraints. Separately,
consider making the free-tier day cap 7 rather than 5, since "next week" is the modal request.

## Bottom line

The chains hold. Sixteen of eighteen points, twenty-one calls, four minutes of wall clock, and the
model picked the right tool every single time across eight servers — including two unprompted correct
moves: pulling the GBP rate as well as the EUR one in scenario 4 because it remembered the invoice was
mixed, and calling `expense_mark_rebilled` in scenario 1 so the receipt cannot be billed twice.
`D-R19`, the defect class that cost points in rounds 4, 5 and 6, did not appear.

What the round exposes instead is a seam. Inside one server the arithmetic is exact — every figure in
this document reproduces from the ECB cache and the stores to the cent, and the currency, docx and
timezone servers each did what their own audits said they would. The failures are all at the joins:
an invoice line whose unit price and amount round on different bases (D-R24), hours that stay open
after they are billed while expenses close themselves (D-R28), a document that can only be changed by
destroying it (D-R26), an .ics that names attendees it cannot address (D-R27), and a bundle that
renames tools without telling the text that mentions them (D-R29). None of these is a parser or an
extractor. They are contracts between servers that no single server's test suite can see, which is
what a bundle is for and what the next round of fixes should be about.

## Round-7 fixes

Three defects from the list above are fixed. Every claim below is a line of shipped code or a line
of test output copied verbatim.

### D-R24 (invoice) — the line is computed from the unit price that is stored and printed

`servers/invoice/src/money.ts:123-128` now rounds the unit price into minor units first and
multiplies the quantity by that stored value, instead of multiplying the unrounded input:

    const unit = roundHalfUp(it.unit_price * f);
    const gross = roundHalfUp(it.quantity * unit);

The rounding contract at the head of the file (`servers/invoice/src/money.ts:1-14`) states the basis
and its cost: `unit_price_minor x quantity` equals `gross_minor` for a whole quantity, so
`10420 x 6 = 62520` reproduces on a client's calculator, and a converted line may sit one minor unit
away from the mathematically exact conversion. The round-7 invoice is the test case: 90 EUR/h at the
ECB 2026-09-02 rate 1.1578 is 104.202, stored as `10420`, and six hours are now `62520`, not `62521`.
The identity is also asserted across 2-, 0- and 3-decimal currencies (JPY, KWD).

### D-R28 (time-tracker + invoice) — billed hours close

time-tracker:

- `servers/time-tracker/src/index.ts:46-47` — entries carry `billed_at` and `billed_invoice`.
- `servers/time-tracker/src/index.ts:871` — new tool `entry_mark_billed {ids[] | project+from+to,
  invoice_number}`. Already-billed entries are listed back, never re-stamped; an unknown id refuses
  the whole call so nothing is half-marked. Its window is deliberately unclamped by the free tier,
  because under-marking is what puts the same hours on a second invoice.
- `servers/time-tracker/src/index.ts:751` and `:931` — `unbilled_only` (default **true**) on `report`
  and `invoice_summary`; the excluded count is stated in the text and as
  `billed_entries_excluded` in the JSON report.
- `servers/time-tracker/src/index.ts:979-985` — `invoice_summary` returns `entry_ids: [...]` and the
  instruction to call `entry_mark_billed` with the new invoice number.

invoice:

- `servers/invoice/src/index.ts:375-395` — `invoice_from_hours` takes `target_currency` + `fx_rates`
  with exactly the semantics of `expense_to_invoice` (1 unit of the source currency = X units of the
  target; nothing fetches or guesses a rate), converts the rate, and annotates the line
  `[converted from EUR 90.00/h at 1.1578]`. `fx_rates` without `target_currency` and a missing rate
  both return the exact call to make.
- `servers/invoice/src/index.ts:431-433` — the response echoes `entry_ids` and tells the caller to
  run `entry_mark_billed {ids: [...], invoice_number: "INV-2026-0001"}` "or the same hours appear on
  the next invoice".

Scenario 1 of this round now closes end to end: `invoice_from_hours {hours: 6, rate: 90,
currency: "EUR", target_currency: "USD", fx_rates: {"EUR": 1.1578}}` produces USD 104.20 x 6 =
USD 625.20 in one call, and the hours behind it stop being offered once marked.

### D-R29 (office-suite) — renamed tools are renamed in the child's prose too

- `servers/office-suite/src/index.ts:203-236` — `renameMapFor` / `rewriteToolNames` /
  `rewriteContent`: per child, every whole-word occurrence of a child tool name that was renamed on
  the bundle is replaced by the exposed name in the text content forwarded to the client.
  `business_set_extra` and `my_business_set` are untouched, and a child that never collided keeps
  its text byte for byte.
- `servers/office-suite/src/index.ts:308` — the rewrite is applied on the `tools/call` return path.
- `servers/office-suite/src/index.ts:318-360` — the `office://tools_map` resource: exposed name ->
  `child.tool` for every tool, with the renamed pairs listed separately.
- `servers/office-suite/src/index.ts:392-400` — the renames are named once on the startup line.

### Test summaries (verbatim)

    == invoice
    ok 19 - D-R24: the line gross is the STORED unit price times the quantity
    ok 20 - D-R24: the identity holds for whole quantities, currencies and tax rates
    ok 21 - D-R28: invoice_from_hours converts with target_currency + fx_rates and the line adds up
    ok 22 - D-R28: fx_rates without target_currency, and a missing rate, name the exact fix
    # tests 28
    # pass 28
    # fail 0
    # duration_ms 1617.26125

    == time-tracker
    ok 15 - D-R28: hours billed once are excluded from the next invoice_summary
    ok 16 - D-R28: report hides billed hours by default and shows them on unbilled_only false
    ok 17 - D-R28: entry_mark_billed refuses an unknown id and marks nothing
    # tests 20
    # pass 20
    # fail 0
    # duration_ms 836.956208

    == office-suite
    ok 3 - D-R29: a renamed tool is renamed in the child's text too, per child
    ok 4 - D-R29: tools_map resource lists exposed name -> child.tool
    # tests 5
    # pass 5
    # fail 0
    # duration_ms 1258.499458

New test files: `servers/invoice/test/round7.test.mjs`, `servers/time-tracker/test/round7.test.mjs`,
`servers/office-suite/test/round7.test.mjs` (a stub bundle whose invoice and docx children both
register `business_set` and answer "Run business_set {name, address, email, vat_id} and create it
again").

`node scripts/validate.mjs`, with no probe changed:

    docx: 16/16 in 416 ms
    timezone: 16/16 in 291 ms
    currency: 16/16 in 3942 ms
    expense-tracker: 22/22 in 409 ms
    time-tracker: 24/24 in 231 ms
    price-tracker: 18/18 in 280 ms
    spreadsheet: 18/18 in 396 ms
    invoice: 20/20 in 388 ms
    remote: 20/20
    billing: 14/14
    validation db: /Users/mike/mcp-servers/data/validation.json run 50: 184/184

### What is still open from round 7

D-R25, D-R26, D-R27 (docx and timezone) and D-R30 belong to servers other agents own and are not
touched here.
