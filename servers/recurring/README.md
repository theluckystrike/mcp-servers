# mcp-recurring

Say "bill Acme 12 hours at 90 EUR on the 1st of every month" once, and stop remembering it. This MCP server stores recurring invoice schedules -- client, line items, cadence, start and end dates -- and then, when you ask, creates the invoices that have actually fallen due as real records in the [invoice server](../invoice), with its number series, its clients and its A4 PDF. Generation is idempotent: one invoice per schedule per period, keyed by the occurrence date, so running the billing run twice on the same day creates nothing the second time. It also answers "what falls due in the next 30 days" and "what will I invoice per month for the next year". Everything is stored in plain JSON files on your own machine; nothing is uploaded anywhere.

![recurring demo](../../assets/demo-recurring.gif)

**Define a repeating invoice once, generate the due PDFs from chat -- no billing SaaS required.**

## 60-second install

npm publish for `@theluckystrike/mcp-recurring` is pending. Until then, the `.mcpb` one-click bundle or a clone+build
is the working path -- both are verified below.

**One-click (.mcpb):** download `recurring.mcpb` from the latest release and double-click it in Claude Desktop:
https://github.com/theluckystrike/mcp-servers/releases/latest

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "recurring": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-recurring"]
    }
  }
}
```

**Claude Code:**

```sh
claude mcp add recurring -- npx -y @theluckystrike/mcp-recurring
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "recurring": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-recurring"]
    }
  }
}
```

The `npx` form above starts working the moment the package is published. Until then, use the .mcpb bundle above, or
build from source with exactly these three commands:

```sh
git clone https://github.com/theluckystrike/mcp-servers.git && cd mcp-servers
npm install
npm run build -w packages/mcp-license -w servers/invoice -w servers/recurring
```

Then point your client's `command` at `node` with one arg: the absolute path to `servers/recurring/dist/index.js`.

To run in Pro mode set `MCP_LICENSE_KEY` in the same config block, or call `license_activate` once with your key.

## Pairs with

- **[mcp-invoice](../invoice)** -- required in practice, not by code. This server writes into the invoice
  server's data directory and shares its number counter, its client list and its business profile, so every
  generated invoice appears in `invoice_list`, counts in `overdue_report` and can be re-rendered with
  `invoice_pdf`. Set your issuer details once with `business_set` **there**; this server has no `business_set`
  of its own on purpose, so there is only one profile to keep right.
- **[mcp-time-tracker](../time-tracker)** -- for the hours that are not on a retainer. Track them, invoice
  them ad hoc, and leave the fixed monthly part to a schedule here.
- **[mcp-expense-tracker](../expense-tracker)** -- rebillable costs that change every month belong on an ad
  hoc invoice; a schedule is for the amount that does not change.

## Tools

| Tool | What it does |
| --- | --- |
| `schedule_create` | Define a repeating invoice: client, items, cadence, start date, optional end date, due days, notes |
| `schedule_list` | Every schedule with cadence, amount per period, next due date and status |
| `schedule_get` | Full record for one schedule, plus how many invoices it has generated |
| `schedule_update` | Change client, items, currency, cadence, dates, due days or notes. Periods already invoiced are never re-issued |
| `schedule_pause` | Stop generating without deleting; history is kept |
| `schedule_resume` | Make it active again. Periods that fell due while paused are still due |
| `schedule_delete` | Remove the schedule. Invoices it made stay in the invoice server and its history is kept as an audit trail. A re-created schedule gets a new id, so `invoice_generate_due` warns when it re-covers a period the old one already billed |
| `schedule_skip` | Skip ONE occurrence for good, without pausing the schedule -- the answer to "do not bill this client for October". `undo: true` puts the period back |
| `schedule_upcoming` | What falls due in the next N days, with amounts and totals per currency, plus any period that already fell due and was never invoiced. Free covers 30 days |
| `invoice_generate_due` | Create the invoices that are due as of a date and render their PDFs. Idempotent, keyed by period; reports created and skipped. At most 60 invoices per call, oldest period first, and it says how many are still due. `dry_run` shows the run first. Free and unlimited |
| `schedule_history` | Pro: the audit log for one schedule -- every period, invoice number, dates, amount, paid status and PDF path |
| `forecast` | Expected revenue per calendar month per currency, with paused schedules listed separately rather than dropped. Free covers 3 months |
| `license_status` | Show free or Pro mode |
| `license_activate` | Activate a Pro key (verified offline) |

Resource: `recurring://upcoming` returns the next 30 days of occurrences as JSON.
Prompt: `monthly_billing_run` -- dry run, generate, list what is coming, then report who needs a payment reminder.

## What you can say

| You say | Tool |
| --- | --- |
| "Bill Acme 12 hours at 90 EUR every month from the 1st." | `schedule_create` |
| "What recurring invoices do I have?" | `schedule_list` |
| "What is due in the next 30 days?" | `schedule_upcoming` |
| "Run this month's billing." | `monthly_billing_run` / `invoice_generate_due` |
| "Show me what would be created before you create it." | `invoice_generate_due {dry_run: true}` |
| "Pause the Beta Corp retainer, they are on hold." | `schedule_pause` |
| "Do not bill Acme for October." | `schedule_skip` |
| "Put the Acme retainer up to 100 EUR an hour from now on." | `schedule_update` |
| "How much will I invoice per month next year?" | `forecast` |
| "Show me every invoice this retainer has produced." | `schedule_history` |

## Worked example

```
You: Bill Acme 12 hours at 90 EUR a month, starting 1 June, 14 day terms.

  schedule_create {
    client: "Acme Retainer", currency: "EUR", every: "monthly",
    start_date: "2026-06-01", due_days: 14,
    items: [{ description: "Retainer hours", quantity: 12, unit_price: 90 }]
  }
  -> schedule 9f2c1a04, next dates 2026-06-01, 2026-07-01, 2026-08-01, 2026-09-01

You (on 3 September): Run the billing.

  invoice_generate_due {}
  -> as_of 2026-09-03: created 4 invoices, skipped 0 already invoiced.
     INV-2026-0001  Acme Retainer  period 2026-06-01  EUR 1080.00  due 2026-06-15  .../pdf/INV-2026-0001.pdf
     INV-2026-0002  Acme Retainer  period 2026-07-01  EUR 1080.00  due 2026-07-15  .../pdf/INV-2026-0002.pdf
     INV-2026-0003  Acme Retainer  period 2026-08-01  EUR 1080.00  due 2026-08-15  .../pdf/INV-2026-0003.pdf
     INV-2026-0004  Acme Retainer  period 2026-09-01  EUR 1080.00  due 2026-09-15  .../pdf/INV-2026-0004.pdf
     Total: EUR 4320.00

You (five minutes later, having forgotten): Run the billing.

  invoice_generate_due {}
  -> as_of 2026-09-03: created 0 invoices, skipped 4 already invoiced.
```

The second run is the point: the period, not the calendar day, is the key, so a repeated billing run is a
no-op rather than a duplicate invoice sitting in a client's inbox.

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Active schedules | 3 | Unlimited |
| `invoice_generate_due` | Yes, unlimited | Yes, unlimited |
| `schedule_upcoming` horizon | 30 days | Up to 10 years |
| `forecast` | 3 months | Up to 120 months |
| `schedule_history` audit log | No | Yes |
| End-of-month and anchor-day rules (`anchor_day`, `end_of_month`) | No, bills on the start date's day of month | Yes |
| Pause, resume, update, delete, dry run, multi-currency | Yes | Yes |

Pro is a one-time $19, or $39 for every server in the collection, lifetime.

**Get Pro: https://mcp.zovo.one/buy/recurring**

## Dates: what happens at a month end

Every date is a local ISO calendar date, `YYYY-MM-DD`. An occurrence is the k-th step from `start_date`, and
occurrence 0 is `start_date` itself, so a schedule starting today is due today.

- `weekly` = +7 days per step. `{days: n}` = +n days per step.
- `monthly` = +1 month, `quarterly` = +3 months, `yearly` = +12 months.
- **Month ends.** The month step keeps the day of month of `start_date` and clamps it to the length of the
  target month; it never carries the clamp forward. From `2026-01-31` the series is 01-31, **02-28**, 03-31,
  04-30, 05-31 -- February does not silently turn a month-end retainer into a 28th-of-the-month retainer.
- **Feb 29.** The same rule makes a yearly schedule starting `2028-02-29` fall on 02-28 in common years and
  back on **02-29** in the next leap year.
- **`anchor_day` / `end_of_month` (Pro).** `anchor_day` replaces the day of month before clamping, so
  `anchor_day: 31` means the last day of every month; `end_of_month: true` does the same explicitly. Both are
  ignored for `weekly` and `{days: n}`, which have no month to anchor to. An anchored first occurrence that
  would land before `start_date` is dropped, never billed early.
- **`end_date` is inclusive.** An occurrence landing exactly on `end_date` is generated; the next one is not.
- **Long-lived schedules.** Looking up what is due does not replay the schedule from `start_date`: it jumps to
  an estimate near the date you asked about and scans forward from there, so a daily schedule created in 2010
  still reports what is due in 2026 instead of exhausting its per-run occurrence cap walking there one day at
  a time.

## Money

Amounts are held as integer minor units by the invoice engine -- the same ISO 4217 table, the same
round-per-line-then-sum contract, so a schedule's amount and the invoice it produces can never disagree. Each
line's gross is rounded first, tax is computed and rounded per line and grouped into one line per rate, and
the totals are integer sums of those already-rounded values. A schedule bills in its own `currency`, or your
business default currency if it has none; nothing here converts between currencies.

## How it stores data

Schedules and the generation log live in
`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/recurring/` as `schedules.json` and `history.json`. The
**invoices** go into the invoice server's directory, `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/invoice/`,
with their PDFs under its `pdf/` subfolder -- the same files `invoice_list`, `overdue_report` and
`invoice_pdf` read there.

Every mutation runs under an advisory lock file. Anything that writes an invoice takes **two** locks, always
in the same order -- `recurring/.lock` first, then `invoice/.lock` -- so two billing runs (or a billing run
and a hand-written invoice in the other server) cannot interleave, cannot allocate the same invoice number
and cannot deadlock. Invoice numbers are allocated inside the lock; the PDFs are rendered after it is
released, so a slow render never holds up the counter. Saves go to a temporary file and are renamed into
place.

If `schedules.json` or `history.json` is unreadable or not valid JSON it is never treated as "empty": the
file is moved aside byte-for-byte as `<name>.json.corrupt-<timestamp>`, a `<name>.json.corrupt` marker is
written, and every tool fails loudly until you restore a good copy and delete the marker. This matters more
here than anywhere else in the collection: a `history.json` silently read as empty would re-bill every period
the schedule has ever covered.

## Limits and honest caveats

- **Nothing runs in the background.** This is a stdio MCP server: it exists while your client runs it. No
  daemon, no cron, no email. Invoices are created when you (or the `monthly_billing_run` prompt) call
  `invoice_generate_due`. `auto_generate` is a marker for that prompt, not a scheduler.
- **Nothing is sent to the client.** The server produces the invoice record and the PDF; delivering it and
  chasing payment is still yours to do. `overdue_report` in the invoice server tells you who to chase.
- Free tier allows 3 active schedules. Pausing one frees a slot; the paused schedule's history is kept.
- Deleting a schedule keeps its history rows, deliberately: a re-created schedule with the same id cannot
  double-bill a period. Invoices already generated are never touched by anything here.
- `schedule_update` changes future periods only. A period already invoiced keeps the amount that was billed;
  correct it in the invoice server instead.
- No proration and no mid-period cancellation credit: a period is billed in full or not at all.
- No currency conversion; a schedule bills in one currency.

## Troubleshooting

- **`npx` hangs or fails to find the package**: npm publish for this package is pending. Use the `.mcpb`
  bundle or the clone-and-build path above until it lands.
- **Using the clone path**: build `servers/invoice` before `servers/recurring` -- the engine is imported from
  it. `npm run build -w packages/mcp-license -w servers/invoice -w servers/recurring` does that in order.
- **"No business profile yet"**: run `business_set` in the invoice server (mcp-invoice), not here.
  Generation is never blocked by it; the PDF just carries the placeholder issuer "Your business".
- **The invoices are not in my invoice server**: both servers must see the same `XDG_DATA_HOME`. They write
  to `.../mcp-servers/invoice/` under it; if one client sets that variable and the other does not, you have
  two stores.
- **A period was skipped**: `invoice_generate_due` only skips a period already present in `history.json`.
  `schedule_history` (Pro) or the file itself shows exactly which invoice covered it.
- **Node version**: requires Node >= 18. Check with `node -v`.

## Privacy

All data stays local: schedules, the generation log, invoices and PDFs are plain files under your own home
directory. The server makes no network calls at all, and license keys are verified offline.

Built by [theluckystrike](https://github.com/theluckystrike). MIT. Support: support@zovo.one

## One business profile for the whole suite

Your identity is stored once, at `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/profile/business.json`,
and every server in the suite reads it: the invoice issuer, the docx letterhead, the recurring
issuer, expense-tracker's default VAT rate, time-tracker's and timezone's home zone, and the
resume and contract letterheads. Set it once with `business_set` (invoice or docx) - you never
repeat it anywhere else. An email address is only ever taken from that profile or from an explicit
argument; when none is stored, documents show `[add: email]` and the tool says so rather than
letting anyone improvise an address.
