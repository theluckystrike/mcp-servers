status: DONE

## What was built

`servers/delivery-schedule`, the twelfth-and-newest product server: dated deliverables
against a quote, a work order or a change order, each with a due date, a value in whole
minor units, and a dated status history that runs planned to in progress to delivered to
accepted with the client's acceptance note on the accepted move. `late_report` answers
what has slipped as at a date the caller names. `milestone_payload` turns the
delivered-and-accepted deliverables into `invoice_create` items in MAJOR units and
`quote_create` items in MINOR units in one call.

Twelve tools: `delivery_schedule_create`, `deliverable_add`, `deliverable_status`,
`deliverable_delete`, `delivery_schedule_get`, `delivery_schedule_list`,
`delivery_schedule_delete`, `late_report`, `delivery_schedule_document` (Pro),
`milestone_payload` (Pro), `license_status`, `license_activate`.
One resource (`deliveryschedule://contract`), one prompt (`run_the_schedule`).

## evidence

`npm test` in `servers/delivery-schedule`:

```
# tests 53
# pass 53
# fail 0
# duration_ms 4315.669792
```

Five suites: `unit` (13), `adversarial` (19), `contract` (14), `concurrency` (4),
`timezone` (3).

Sequential stdio probe of the BUILT server (`dist/index.js`), one request awaited before
the next is written, the way `scripts/validate.mjs` drives a server:

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
STDERR: mcp-delivery-schedule 0.20.0 ready; store at .../mcp-servers/delivery-schedule
FILES:  delivery-schedule, profile  |  delivery-schedule/: counter.json, schedules.json
```

The four `late_report` lines are the point of the server: one unchanged store, four dates,
four different correct answers. D02 is not yet due on 04-19, late by two days on 04-22,
delivered late by four days on 05-01, and D03 is due today on 05-01 and late by four days
on 05-05. A stored "late" flag can produce at most one of those.

The money check, recomputed by hand and asserted in `test/unit.test.mjs`: 90000 + 47988 =
137,988 net; VAT 23% rounded per line (20700 + 11037) = 31,737; total 169,725. The suite
re-runs `computeTotals` from `@theluckystrike/mcp-invoice/lib` over the payload's OWN
returned items and gets the same three figures, then feeds the `quote_create` items into
the same engine as though their MINOR figure were MAJOR and asserts the net is exactly
100x, so the day someone moves a field between the two scales the build says so instead of
the customer.

## artifacts

- `servers/delivery-schedule/` (src, test, README.md, llms-install.md, SPEC.md, LICENSE,
  Dockerfile, smithery.yaml, glama.json, four registry manifests)
- `docs/DELIVERY_SCHEDULE_RESULT.md`, `data/delivery_schedule.json`
- Registration lines added, one each: `scripts/build-mcpb.sh` (SERVERS, DISPLAY_NAME,
  KEYWORDS), `scripts/sync-mirrors.sh` (ALL_SERVERS, topics_for), `scripts/build-pages.mjs`
  (ids), `scripts/gen-spec.mjs` (SERVERS and a CURATED entry),
  `servers/office-suite/src/index.ts` (CHILDREN), `servers/invoice/src/index.ts`
  (PROFILE_READERS).

## cost

Wall time from the first file to the passing suite: about 70 minutes. Zero paid API calls.
Zero network calls of any kind from the server: `test/contract.test.mjs` greps `src/` for
`fetch(`, `node:http`, `node:net`, `node:dns` and `console.` and asserts nothing matches.

## failures

**D-DS1, found by a test and fixed: a deleted deliverable's id came back.**
`nextDeliverableId` was copied from change-order's `nextLineId`, which allocates from
`lines.length`. Change orders cannot delete a line, so the bug never surfaces there.
Deliverables can: `deliverable_delete` removes a planned one, the length drops, and the
next `deliverable_add` was handed the id that had just been freed. A schedule document, an
email or a client's note naming D04 would then point at a different piece of work, and
nothing on the record would say so. Fixed with a per-schedule `deliverable_counter` that
only goes up and that also scans the ids already present, so a restored or hand-edited
schedule cannot reissue one either. A gap in the D series is now the record that a
deliverable was removed. `test/adversarial.test.mjs` asserts the id after a delete is D05,
and `test/concurrency.test.mjs` asserts the counter equals 30 after thirty deliverables
raced in from two processes.

Two test-authoring mistakes, both fixed in the tests rather than in `src`: the em-dash
guard was written with a literal em dash and so flagged its own file (the estate
convention is the escaped code point), and the minor-unit-in-prose guard flagged
`${money(value_minor, cur)}`, which is the correct form because `formatMoney` prints the
currency code; the guard now exempts `${money(` and `${formatMoney(` and flags everything
else.

## insight

**"Late" cannot be stored, and this is measurable in one file.** The four probe lines
above come from one store read at four dates, and no two agree. The store holds only what
happened and when: a due date, and a dated history. Every reading is derived, so the same
bytes answer correctly for last month's report and for today's. A schedule that stored a
`late` boolean would have to be swept on a timer, would be wrong between sweeps, and would
answer last month's question with this month's answer. The second half of the same
insight: because everything is a comparison of two `YYYY-MM-DD` strings and every day
count is a difference of two UTC midnights, `test/timezone.test.mjs` can replay the whole
probe under `Pacific/Kiritimati`, `Pacific/Niue`, `UTC` and `Europe/Warsaw`, fourteen hours
apart at the ends, and assert the responses are byte-identical. The one place the machine's
clock still gets in is the fallback when `as_of` is omitted, and there `today()` reads the
shared profile's home zone, not the process zone, which that suite also asserts by running
the server under `Pacific/Niue` with a `Pacific/Kiritimati` profile and demanding the
Kiritimati date.
