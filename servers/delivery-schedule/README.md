# mcp-delivery-schedule

Dated deliverables against a quote, a work order or a change order. Each one carries what
is being handed over, the day it is due, its value in minor units, and a status that moves
planned to in progress to delivered to accepted, every step with the day it actually
happened. `late_report` then answers the only question anybody asks about a schedule: what
has slipped, as at a date you name. Once the client has signed something off, the accepted
milestones come back as `invoice_create`-ready items in MAJOR units and `quote_create`-ready
items in MINOR units, in one call, with the scale printed against each.

Late is not a status here, it is a reading. A stored "late" flag is a fact about the
afternoon somebody last ran the report, and it keeps being reported long after the work
lands. So nothing derived is stored: a deliverable holds its due date, its value and its
dated history, and the current status, the delivered date, the acceptance note, the
lateness and every total are worked out on the call, against the date you passed.

## Install


**One-click (.mcpb):** download `delivery-schedule.mcpb` from the latest release and double-click it in Claude Desktop:
https://github.com/theluckystrike/mcp-servers/releases/latest

**Hosted, no install:** point a URL-based client at `https://mcp.zovo.one/mcp/delivery-schedule`. `GET https://mcp.zovo.one/mcp/connect` mints a token and prints a ready URL.

npm publish for `@theluckystrike/mcp-delivery-schedule` is pending, so the `npx` line below returns 404 today.

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "delivery-schedule": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-delivery-schedule"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add delivery-schedule -- npx -y @theluckystrike/mcp-delivery-schedule
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project), same entry as Claude Desktop.

## Tools

| Tool | What it does |
| --- | --- |
| `delivery_schedule_create` | Open a schedule against a quote, work order or change order: the reference, its own date, the client, a title |
| `deliverable_add` | Add one dated deliverable: what it is, the day it is due, and its value in minor units when it is separately priced |
| `deliverable_status` | Record a dated move: in progress, delivered, and accepted with the client's acceptance note |
| `deliverable_delete` | Delete a deliverable added by mistake, while it is still planned and has nothing recorded against it |
| `delivery_schedule_get` | One schedule in full as at a date, with every deliverable's status, dates, value and lateness |
| `delivery_schedule_list` | Schedules by client, reference and whether the job is finished, with the counts as at a date |
| `delivery_schedule_delete` | Delete an empty schedule opened by mistake. Free on every tier |
| `late_report` | What is late as at a date you name, worst first, with the value at risk per currency |
| `delivery_schedule_document` | The schedule as a plain-text document for the client, with a sign-off block |
| `milestone_payload` | The accepted milestones as `invoice_create` items (MAJOR units) and `quote_create` items (MINOR units) |
| `license_status` / `license_activate` | Free or Pro, and where to upgrade |

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Open schedules (a job with anything not yet accepted) | 3 | unlimited |
| Deliverables per schedule | 200 | 200 |
| Open, add, move, get, list, delete | yes | yes |
| What is late, as at any date | yes | yes |
| Delivery schedule document | no | yes |
| Milestone invoice payload, both scales | no | yes |

The cap counts OPEN schedules, the jobs that still owe something, not the jobs you have
ever run. Accepting the last deliverable completes a schedule and frees its slot without
deleting the record, and `delivery_schedule_delete` clears an empty one; both are free on
every tier, because a way back that only a Pro key can reach is not a way back.

Get Pro: https://mcp.zovo.one/buy/delivery-schedule (one-time $19, lifetime), or all servers
for $39: https://mcp.zovo.one/buy/bundle

## The status machine

`planned` to `in_progress` or straight to `delivered`; `delivered` to `accepted`. Accepted
is final, and nothing moves back: work the client sent back is a new deliverable with its
own due date, so the record keeps both the miss and the fix. Accepting something that was
never delivered is refused by name, because acceptance is the client's answer to a
handover and a deliverable accepted on a day nothing was handed over has no delivered date
to bill from. Every move carries the day it actually happened, and a move dated before the
reference document's own date, or before the previous move, is refused so the history reads
as a timeline.

## What "late" means

A deliverable is late once `as_of` is PAST its due date and it has not been delivered by
then. One due on `as_of` itself is `due_today`, not late, which is the same rule the
statement server ages an invoice by. A deliverable that was delivered is `delivered_late`
or `delivered_on_time` by comparing its delivered date with its due date, which is a fact
that no longer moves. Every comparison is between two `YYYY-MM-DD` strings and every day
count is the difference of two UTC midnights, so the answer is the same on a laptop in
Warsaw and a server in Auckland.

Two readings of the same store, four days apart, differ on purpose:

```
late_report as_of 2026-04-22   D02 is LATE by 2 days, nothing has been delivered late
late_report as_of 2026-05-05   D02 was DELIVERED LATE by 4 days, D03 is now LATE by 4 days
```

## Deliverables with no price

A deliverable with no `value_minor` is not worth zero. It is one whose price was never
stated here, usually because the job is a lump sum, and adding it in as zero would
understate every total with nothing on the page to say so. It is counted apart wherever a
total is printed, and `milestone_payload` lists it under `excluded.accepted_but_unpriced`
rather than billing it. Nothing here invents a price.

## Where the money comes from

This server keeps no arithmetic of its own. `computeTotals`, `currencyDecimals`,
`formatMoney` and `daysBetween` are imported from `@theluckystrike/mcp-invoice/lib`, the
corrupt-store quarantine from `@theluckystrike/mcp-timezone/lib`, the timezone-aware
"today" from `@theluckystrike/mcp-quotes/lib`. The VAT rate, the currency and the business
name come from the shared business profile that `business_set` in the invoice server writes.
Nothing is written outside this server's own directory, and no sibling store is opened.

## The measured insight

**The same deliverable is late, on time and not yet due depending only on the date you ask
about, so storing the answer is storing the day somebody asked.** D02 in the worked example
is due 2026-04-20 and was delivered 2026-04-24. Read at 2026-04-22 it is late by two days
with no delivered date at all, even though the store already holds one dated 04-24. Read at
2026-05-01 it is delivered late by four days. Read at 2026-04-19 it is not yet due. One
store, three answers, all correct. The unit suite asserts all three from one unchanged
sandbox, and a separate suite replays every call under four timezones fourteen hours apart
and asserts the responses are byte-identical, so the day somebody reads the report on a
laptop that travelled cannot move a client's deadline.

## Privacy

All data stays on your machine, in
`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/delivery-schedule/`. Nothing is sent
anywhere. There is no account and no API key. License keys are verified offline. This
server reads one file it does not own, the shared business profile, and writes into no
store but its own.

Built by theluckystrike. https://github.com/theluckystrike
