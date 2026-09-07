# delivery-schedule: build result (loop 29, 2026-09-07)

status: DONE, stdio only. Ready for the next release as an npm and .mcpb product; NOT
hosted, and six estate rows owned by other agents are still open (listed at the end).

Plan slot: `docs/PLAN_V26.md` item 1. INTEL_R13 scored `delivery-schedule` 55.25 with a
measured registry count of 0 (`data/intel_r13.json` line 12), so there is no competing
server on the official registry to be compared against.

Machine-readable twin of this page: `data/delivery_schedule.json`.
Per-server result with the same evidence: `servers/delivery-schedule/RESULT.md`.
Generated contract: `servers/delivery-schedule/SPEC.md`.

## What it does

A delivery schedule is opened against a quote, a work order or a change order, and holds
the dated deliverables on it. Each deliverable carries what is being handed over, the day
it is due, its value in whole minor units when it is separately priced, and a status
history that runs planned to in progress to delivered to accepted, every move stamped with
the day it actually happened and the accepted move carrying the client's acceptance note.

`late_report` then answers what has slipped as at a date the caller names, worst first,
with the value at risk per currency. `milestone_payload` turns the delivered-and-accepted
deliverables into `invoice_create` items in MAJOR units and `quote_create` items in MINOR
units in one call, through the same 100x seam the change-order and quotes servers use.

## The design decision the whole server rests on

`docs/PLAN_V26.md` lists five statuses: planned, in progress, delivered, accepted, late.
Four of those are stored. **Late is not stored**, because it is not a property of a
deliverable at all: it is a reading of a due date against a date somebody chose, and it
moves as that date moves.

A stored `late` flag has to be swept on a timer, is wrong between sweeps, and answers last
month's question with this month's answer. So the store holds only what happened and when,
and every reading is derived on the call. The proof is one store read at four dates:

| `as_of` | late | due today | delivered late | not yet due | value at risk |
| --- | --- | --- | --- | --- | --- |
| 2026-04-19 | 0 | 0 | 0 | 3 | none |
| 2026-04-22 | 1 (D02 by 2 days) | 0 | 0 | 2 | EUR 479.88 |
| 2026-05-01 | 0 | 1 (D03) | 1 | 1 | none |
| 2026-05-05 | 1 (D03 by 4 days) | 0 | 1 | 1 | EUR 2,100.00 |

D02 is due 2026-04-20 and was delivered 2026-04-24. It is not yet due on the 19th, late by
two days on the 22nd, and on the record as delivered late by four days on 1 May. All three
are correct, and a stored flag can hold at most one of them. The rows above are the real
output of the stdio probe below.

The second half of the decision: because every comparison is between two `YYYY-MM-DD`
strings and every day count is a difference of two UTC midnights,
`test/timezone.test.mjs` replays the whole probe under `Pacific/Kiritimati`,
`Pacific/Niue`, `UTC` and `Europe/Warsaw` (fourteen hours apart at the ends) and asserts
the responses are byte-identical. The only place the machine's clock still gets in is the
fallback when `as_of` is omitted, and there `today()` reads the shared profile's home zone,
not the process zone; the same suite runs the server under `Pacific/Niue` with a
`Pacific/Kiritimati` profile and demands the Kiritimati date.

## Tools

| Tool | Tier | What it does |
| --- | --- | --- |
| `delivery_schedule_create` | free | Open a schedule against a quote, work order or change order: the reference, its own date, the client, a title |
| `deliverable_add` | free | One dated deliverable: what it is, the day it is due, its value in minor units when separately priced |
| `deliverable_status` | free | A dated move: in progress, delivered, accepted with the acceptance note |
| `deliverable_delete` | free | Remove one still planned with nothing recorded against it |
| `delivery_schedule_get` | free | One schedule in full as at a date, with every deliverable's status, dates, value and lateness |
| `delivery_schedule_list` | free | Schedules by client, reference and completion, with the counts as at a date |
| `delivery_schedule_delete` | free | Remove an empty schedule |
| `late_report` | free | What is late as at a date you name, worst first, with the value at risk per currency |
| `delivery_schedule_document` | Pro | The schedule as a plain-text document for the client, with a sign-off block |
| `milestone_payload` | Pro | The accepted milestones as `invoice_create` items (MAJOR) and `quote_create` items (MINOR) |
| `license_status`, `license_activate` | free | Free or Pro, and where to upgrade |

Twelve tools, one resource (`deliveryschedule://contract`), one prompt
(`run_the_schedule`).

Free tier: three OPEN schedules, where open means at least one deliverable is not yet
accepted. `late_report` is free on every tier, because what is late is the question the
server exists for. Two ways back under the cap, both free: accept the last deliverable,
which completes the schedule without deleting it, or `delivery_schedule_delete` on an empty
one.

## Evidence: the tests

`npm test -w servers/delivery-schedule`

```
# tests 53
# pass 53
# fail 0
# duration_ms 4315.669792
```

Five suites: `unit` 13, `adversarial` 19, `contract` 14, `concurrency` 4, `timezone` 3.

The correctness bars in the brief, and the tests that hold them:

| Bar | Test |
| --- | --- |
| Money in minor units through the 100x seam, no float drift | `unit`: `computeTotals` from the invoice server is re-run over the payload's OWN returned items and must give 137,988 net, 31,737 VAT, 169,725 total with `rounding_drift_minor` 0; the `quote_create` items are then fed to the same engine as though MINOR were MAJOR and the net must be exactly 100x |
| No bare minor-unit figure in a human-readable description | `unit`: every milestone description must be the deliverable plus its two dates and must not contain its own `unit_price_minor`; no invoice item description may carry a bare five-digit figure; every number on the rendered document is under 1000 or already formatted. `contract`: `src/*.ts` may not interpolate a `*_minor` variable into a string unless it goes through `money(` or `formatMoney(` |
| An impossible status transition is refused with a clear message | `adversarial`: accepting from planned and from in progress, going backwards from delivered, and moving out of accepted, each asserted on the message text AND on the store being unchanged |
| A delivered date before the reference document's own date | `adversarial`: refused, with the reference date named; the reference date itself is allowed |
| Late computed against the caller's date, stable across timezones | `unit`: the four-date table above from one store. `timezone`: every call replayed under four zones, responses byte-identical |
| No truncated list presented as complete | `adversarial`: `late_report` with `limit` 5 over 12 late rows must keep `late_count` 12, set `truncated` true, set `rows_not_shown` 7 and say the counts are complete but the rows are cut; `include_delivered_late: false` must still report the count of what it left out; late rows with no value must be counted apart from `value_at_risk` and said out loud |
| Nothing on stdout but protocol | `contract`: every stdout line across initialize, tools/list, a success and an error parsed as JSON-RPC 2.0; and `src/` grepped for `fetch(`, `node:http`, `node:net`, `node:dns`, `console.` with zero matches |

## Evidence: the stdio probe

The built server, driven sequentially over stdio the way `scripts/validate.mjs` drives one:
each response awaited before the next request is written. Verbatim output.

```
initialize      -> serverInfo {"name":"mcp-delivery-schedule","version":"0.20.0"}  capabilities tools, resources, prompts  protocol 2024-11-05
tools/list      -> 12 tools: delivery_schedule_create, deliverable_add, deliverable_status, deliverable_delete, delivery_schedule_get, delivery_schedule_list, delivery_schedule_delete, late_report, delivery_schedule_document, milestone_payload, license_status, license_activate
create          -> DS-2026-0001  WO-2026-0011 (work_order, dated 2026-04-01)  EUR  complete=false
deliverable_add -> D01  due 2026-04-10  EUR 900.00  status planned
deliverable_add -> D02  due 2026-04-20  EUR 479.88  status planned
deliverable_add -> D03  due 2026-05-01  EUR 2100.00  status planned
deliverable_add -> D04  due 2026-05-08  not separately priced  status planned
REFUSAL accept-never-delivered -> isError=true
  Error: DS-2026-0001 D01 "Wireframes for the five main pages" is planned and has not been delivered. Acceptance is the client's answer to a handover, so record the delivery first (with the day it was handed over), then the acceptance. Nothing was written.
REFUSAL delivered-before-the-work-order -> isError=true
  Error: DS-2026-0001 delivers WO-2026-0011 dated 2026-04-01, and this move is dated 2026-03-28, before it. Work cannot have been delivered before the document that ordered it exists. Nothing was written.
six dated moves recorded
late_report as_of 2026-04-19 -> late 0 (none)  due_today 0  delivered_late 0  not_yet_due 3  value_at_risk []
late_report as_of 2026-04-22 -> late 1 (D02 by 2d)  due_today 0  delivered_late 0  not_yet_due 2  value_at_risk ["EUR 47988 minor, 0 unpriced"]
late_report as_of 2026-05-01 -> late 0 (none)  due_today 1  delivered_late 1  not_yet_due 1  value_at_risk []
late_report as_of 2026-05-05 -> late 1 (D03 by 4d)  due_today 0  delivered_late 1  not_yet_due 1  value_at_risk ["EUR 210000 minor, 0 unpriced"]
milestone_payload as_of 2026-05-05 -> items D01 EUR 900.00, D02 EUR 479.88  net_minor 137988  vat_minor 31737  total_minor 169725  drift 0  posted false
  invoice_create items (MAJOR): [900,479.88]   quote_create items (MINOR): [90000,47988]
  excluded: not_yet_accepted D03, D04
resources/read  -> statuses ["planned","in_progress","delivered","accepted"]  lateness_states ["not_yet_due","due_today","late","delivered_on_time","delivered_late"]  free_tier.open_schedules 3

STDOUT: 21 lines, all JSON-RPC 2.0: true, non-protocol lines: 0
STDERR: mcp-delivery-schedule 0.20.0 ready; store at <XDG_DATA_HOME>/mcp-servers/delivery-schedule
FILES:  delivery-schedule, profile  |  delivery-schedule/: counter.json, schedules.json
```

The money check by hand: 90000 + 47988 = 137,988 net; VAT 23% rounded per line, 20700 +
11037 = 31,737; total 169,725. The same three figures come back out of the invoice server's
own `computeTotals` run over the payload's returned items.

The `FILES` line is the store discipline: two files in this server's own directory, and the
shared profile directory read but not written. `test/contract.test.mjs` asserts the same
thing after every tool has been called, including both Pro ones.

A note on how the probe was run. The first attempt piped all seven requests at once without
awaiting, and the two read-only `late_report` calls answered before the two writes ahead of
them had taken the file lock, so they reported an empty store. That is correct JSON-RPC
behaviour (responses are matched by id, not ordered) and correct locking behaviour (reads
are not queued behind pending writes), but it is a trap for anyone writing a probe: drive
the server sequentially or the answer is about a store that does not exist yet.

## Evidence: the estate

`node scripts/validate.mjs` (run 50 in `data/validation.json`, 2026-09-07T01:28:06Z):
**948 / 951**.

All 30 stdio servers and the remote endpoint are green. The three failures are in the
billing section against the live worker and are not from this build:

```
buy/work-order    -> 303 probe-session-reused   (assertion expects 503 price-pending-human)
buy/catalogue     -> 303 probe-session-reused
buy/change-order  -> 303 probe-session-reused
```

Those three routes are the PENDING_HUMAN products. The worker is now answering the probe
with a reused session and a 303 instead of the 503 the assertion was written for, so either
the worker changed or the assertion needs to follow it. That is billing's call, not this
server's. `delivery-schedule` is not in `validate.mjs`'s `PROBES` map, so the run does not
cover it; the stdio probe above is what covers it.

`node scripts/release-check.mjs`: `delivery-schedule` passes 16 of its 22 checks. The six
that fail are all owned elsewhere and are listed below.

## Defect found and fixed

**D-DS1: a deleted deliverable's id came back.**

`nextDeliverableId` was modelled on change-order's `nextLineId`, which allocates from
`lines.length`. A change order cannot delete a line, so the bug cannot surface there. A
delivery schedule can: `deliverable_delete` removes a planned deliverable, the length
drops, and the next `deliverable_add` was handed the id that had just been freed. The tool
copy said "the id is not reissued" while the code reissued it. A schedule document, an
email or a client's note naming D04 would then have pointed at a different piece of work,
with nothing on the record saying so.

Fixed with a per-schedule `deliverable_counter` that only goes up, and that also takes the
maximum of the ids already present so a restored or hand-edited schedule cannot reissue one
either. A gap in the D series is now the record that a deliverable was removed. Caught by
`test/adversarial.test.mjs` on the first run of that suite; the regression is asserted
there (the id after a delete must be D05) and in `test/concurrency.test.mjs` (the counter
must equal 30 after thirty deliverables raced in from two processes).

Two test-authoring mistakes were also fixed, both in the tests rather than in `src`: the
em-dash guard was written with a literal em dash and flagged its own file (the estate
convention is the escaped code point), and the minor-unit-in-prose guard flagged
`${money(value_minor, cur)}`, which is the correct form because `formatMoney` prints the
currency code. The guard now exempts `${money(` and `${formatMoney(` and flags everything
else.

## Estate registration

Added, one additive line each, no reformatting:

| File | Entry |
| --- | --- |
| `scripts/build-mcpb.sh` | `SERVERS`, `DISPLAY_NAME[delivery-schedule]`, `KEYWORDS[delivery-schedule]` |
| `scripts/sync-mirrors.sh` | `ALL_SERVERS`, `topics_for` |
| `scripts/build-pages.mjs` | `ids` |
| `scripts/gen-spec.mjs` | `SERVERS` and a `CURATED` entry (SPEC.md generated from it) |
| `servers/office-suite/src/index.ts` | `CHILDREN` |
| `servers/invoice/src/index.ts` | `PROFILE_READERS` |
| `data/tools.json` | the 12 tools, from `scripts/extract-tools.mjs` |
| `data/facts.json` | `servers["delivery-schedule"]` |

`test/contract.test.mjs` asserts every one of those registrations, so an omission fails in
this server's own suite rather than at bundle time.

## Still open, by owner

| Check | Owner | What is needed |
| --- | --- | --- |
| `product` | billing (agent A) | `billing/src/index.js` `PRODUCTS["delivery-schedule"]`, $19, `price: "PENDING_HUMAN"` until a Stripe key with `product_write` exists |
| estate bundle copy | billing (agent A) | `PRODUCTS.bundle` description names 30 servers and a $531 saving; with 31 it is thirty-one and $550. Release-check fails on this globally, not just for this server |
| `setup` | billing (agent A) | `billing/src/setup.js` `SETUP_SERVERS` plus an `ANGLE` entry covering the six clients |
| `compare` | content (agent C) | a `COMPARE` entry, or a dated `compare_none` note in `data/facts.json`. INTEL_R13 measured 0 registry servers on this token, so a `compare_none` note is the honest form |
| `guide` | content (agent C) | a guide in `billing/src/content.js` that mentions the server |
| `gif`, `logo` | assets | `assets/demo-delivery-schedule.gif`, `assets/delivery-schedule-logo.png` |
| hosting | distribution (agent D) / Extension 22 | `remotes.json`, `remote/src/index.ts` `SERVERS` and vendor wiring, `data/distribution.json` `per_server.delivery-schedule.hosted`, `WEB_ANGLE` |

Hosting was deliberately not wired here. `remote/src/index.ts` and `remote/build-vendor.mjs`
are one shared file each and plan item 2 puts that work in another lane; two agents editing
them in one tree in one loop is how a release gets a half-merged endpoint. The server is
stdio-only and honest about it: it ships no `remotes.json`, and the contract suite asserts
that no manifest advertises a remote while that file is absent, and that `server.mcpb.json`
must carry it by value the day it lands.

## Cost

About 70 minutes wall time from the first file to the passing suite. Zero paid API calls,
zero paid submissions, and zero network calls of any kind from the server itself.
