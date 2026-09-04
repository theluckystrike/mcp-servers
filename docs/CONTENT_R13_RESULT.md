# Content round 13: refresh the three oldest guides - 2026-09-04

status: DONE

## What shipped

Edited three guides already live in `billing/src/content.js` (`GUIDES`), the oldest in the file:
`track-time-in-claude-code`, `invoice-pdf-from-chat` and `expense-tracking-in-claude`. No new slugs,
no route changes. Each guide got:

- every free/pro statement re-checked against the current `servers/*/SPEC.md` tables
- a new "Connect without installing" paragraph pointing at `/mcp/connect` and the matching
  `/setup/claude-web/<server>` page
- one sentence naming a sibling server that did not exist when the guide was first written, linking
  that server's own guide (kanban for time-tracker, quotes for invoice, bank-statement for
  expense-tracker)
- the nineteen-server, $39 lifetime bundle named once, in the time-tracker guide

Each guide's original measured insight (round-1/round-2 call counts, the VAT split arithmetic, the
mileage rate table) was left untouched.

## Before/after of each corrected claim

### track-time-in-claude-code

The only wrong claim in the three guides. `docs/GUARDRAILS_RESULT.md` and `servers/time-tracker/SPEC.md`
both show `report`, `invoice_summary` and grouping by tag are free tools, gated only by the same 7-day
window as everything else (`FREE_WINDOW_DAYS` = 7, `FREE_RATED_PROJECTS` = 2; see SPEC.md:255-256 and
tools table SPEC.md:28-34). The old sentence implied they were Pro-exclusive.

Before:
> "Free gives unlimited timers and entries, reports and CSV export over the last 7 days, and two
> projects with an hourly rate. Pro ($19 once, lifetime) opens full history, invoice summaries,
> grouping by tag and unlimited rated projects."

After:
> "Free gives unlimited timers and entries. Reports, invoice summaries and grouping by project, day,
> task or tag all run on the free tier too; the limit is that every read (report, invoice_summary,
> entry_list, CSV export) is clamped to the last 7 days, and only two projects can carry an hourly
> rate. Pro ($19 once, lifetime) opens the full history and unlimited rated projects."

### invoice-pdf-from-chat

The free/pro paragraph already matched `servers/invoice/SPEC.md:227-239` (3 invoices/month, footer,
logo, custom prefix, free unlimited `overdue_report`) so the figures were not changed. One word was
added for precision, matching SPEC.md:230 ("Yes, unlimited"):

Before:
> "the overdue report is free"

After:
> "the overdue report is free and unlimited"

### expense-tracking-in-claude

The free/pro paragraph already matched `servers/expense-tracker/SPEC.md:264-282` (30-day window, 3
projects, 5 rules, 200-row csv/json export, 20 rebill items, xlsx as Pro) exactly. No correction was
needed or made to that paragraph.

## Additions (not corrections, per the brief)

- Connect by URL: all three guides now link `/mcp/connect` (mints a token, prints a ready URL per
  server, per `docs/REMOTE_RESULT.md`'s "Connect by URL" section) and their own
  `/setup/claude-web/<server>` page (`billing/src/setup.js`, `SETUP_SERVERS["time-tracker"|"invoice"|
  "expense-tracker"]`, none in `WEB_EXCLUDED`).
- Bundle: "There are nineteen of these MCP servers in total; one lifetime key covering all of them,
  this one included, is $39." in the time-tracker guide, matching `billing/src/index.js:27`
  (`PRODUCTS.bundle`, `usd: 39`, desc "Saves $322 against buying nineteen").
- Sibling servers, one sentence each, all already shipped and in `GUIDES`:
  - time-tracker guide links `kanban-board-in-claude-with-time-tracking`
    (`task_start_timer` hands the timer the exact project/task name).
  - invoice guide links `quotes-and-estimates-to-invoice-in-claude`
    ("Acme said yes" turns a quote into an invoice in the same client list/number series).
  - expense-tracker guide links `bank-statement-csv-categorize-reconcile`
    (flags bank debits with no matching logged expense, or the reverse).

## Quality gate

Run over `billing/src/content.js`:

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|revolutionary|blazing|cutting-edge|leverage' -> 0
    grep -cP '\xe2\x80\x94' (em dash)                                                                                       -> 0
    grep -cP '[^\x00-\x7F]' (non-ASCII, catches emoji too)                                                                  -> 0
    node --check billing/src/content.js                                                                                    -> syntax OK

## Verification

    cd billing && npm test        -> 25 pass, 0 fail
    wrangler deploy               -> Version 01d50034-65c0-4535-94ff-c1757025b2a6

    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/guides/track-time-in-claude-code    -> 200
    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/guides/invoice-pdf-from-chat         -> 200
    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/guides/expense-tracking-in-claude    -> 200

One changed sentence confirmed present in the live HTML of each page:

    grep -o "A kanban board on the same task" live/track-time-in-claude-code.html      -> match
    grep -o "Quoting the work before you bill it" live/invoice-pdf-from-chat.html      -> match
    grep -o "Checking the ledger against the bank" live/expense-tracking-in-claude.html -> match

Word counts of rendered text, script/style stripped: track-time-in-claude-code 1028, invoice-pdf-from-chat
1015, expense-tracking-in-claude 1453 (this guide already carried the longest measured section before
this round, from `docs/CONTENT_R2` era content, and the round only added the three new sections above it).

IndexNow:

    POST https://api.indexnow.org/IndexNow (key from data/indexnow.key, 3 guide URLs) -> HTTP 200

## Content sourcing

No new claims. Every correction and addition traces to a file already in the repo:

- `docs/GUARDRAILS_RESULT.md` for the time-tracker free/pro correction.
- `servers/time-tracker/SPEC.md`, `servers/invoice/SPEC.md`, `servers/expense-tracker/SPEC.md` free/pro
  tables and enforced-limit lines for every figure kept or changed.
- `docs/REMOTE_RESULT.md` "Connect by URL" section for the `/mcp/connect` paragraph wording and claim
  that it works for Claude.ai, Claude Desktop and several IDE pickers.
- `billing/src/index.js` `PRODUCTS.bundle` for the nineteen-server, $39 figure.
- `billing/src/setup.js` `SETUP_SERVERS` and `WEB_EXCLUDED` for the claude-web setup page links.
- `billing/src/content.js` `GUIDES` for the three sibling-server guide slugs and titles linked.

Zero paid API calls.
