# mcp-credit-note

Credit notes (credit memos) for freelancers and small businesses, kept the way the paperwork keeps them. Issue a credit against an invoice or standalone: the recipient, the reason (returned goods, overcharge, discount correction, service issue, other), line items with quantity, unit price and tax rate, and the currency. Every credit note starts as a draft you can revise and delete; finalizing burns the final CN-YYYY-NNNN number and freezes it, because a finalized credit note is a document the client may have seen. Render one to Markdown to paste into an email, or to a self-contained printable HTML page, and get the totals credited per currency, reason and month. Every amount is an integer number of minor units, and nothing is sent anywhere.

Built by theluckystrike.

npm publish for `@theluckystrike/mcp-credit-note` is pending, so `npx -y @theluckystrike/mcp-credit-note` returns 404 today. Until then, a clone+build is the working path.

## Install

### Claude Desktop

macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "credit-note": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-credit-note"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add credit-note -- npx -y @theluckystrike/mcp-credit-note
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project), same entry as Claude Desktop.

## Tools

| tool | what it does |
| --- | --- |
| `credit_note_create` | Issue a credit note against an invoice or standalone: recipient, reason, lines with quantity, unit price in minor units and tax rate, currency. Returns a `CN-DRAFT-YYYY-NNNN` draft |
| `credit_note_update` | Revise a draft while it is still a draft: recipient, reason, lines, currency, invoice reference, issue date or notes. New lines replace all old ones. A finalized note is refused by name |
| `credit_note_finalize` | Burn the final `CN-YYYY-NNNN` number and freeze the note: from here it cannot be edited or deleted, only rendered and listed |
| `credit_note_list` | List credit notes with number, recipient, reason, status, issue date and total. Filter by recipient, reason, status, and issue-date period |
| `credit_note_get` | Read one credit note in full by CN number or draft id: every line, the tax lines, the totals, the reason and the notes |
| `credit_note_delete` | Delete a draft entered wrongly. A finalized note is refused: it is a document the client may have seen |
| `credit_note_render` | Render a credit note as Markdown to paste into an email, or as a self-contained printable HTML page. Drafts render with a DRAFT banner |
| `credit_note_summary` | Total credited per currency over finalized notes, broken down by reason and by month, in an optional issue-date period |
| `license_status` / `license_activate` | Free or Pro, and the key |

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Finalized credit notes | 10, lifetime | Unlimited |
| Drafts (`credit_note_create`, `credit_note_update`) | Unlimited | Unlimited |
| Delete a draft (`credit_note_delete`) | Yes | Yes |
| Listing, reading (`credit_note_list`, `credit_note_get`) | Unlimited | Unlimited |
| Rendering (`credit_note_render`) | Unlimited, one-line footer | Unlimited, no footer |
| Totals (`credit_note_summary`) | Unlimited | Unlimited |

Finalizing is the metered act because that is what turns a draft into the document the client sees. Everything else is free and unlimited: a free tier that withholds the rendered document or the totals is a demo, and ten real finalized credit notes is a working year for a freelancer who credits an invoice now and then.

**Get Pro:** https://mcp.zovo.one/buy/credit-note -- $19 one-time for this server, or $39 for the bundle.

## The rounding rule

Every amount is an integer number of minor units (cents), and the line math is documented so the printed document reproduces on a calculator:

1. The unit price enters as integer minor units, so nothing is rounded on input. The line gross is quantity x unit price, rounded **half-up once**: `gross = round_half_up(quantity * unit_price_minor)`. A whole quantity is exact; a fractional one (2.5 hours at EUR 33.33) lands on the nearest cent, and 2.5 x 3333 = 8332.5 rounds to 8333, never banker's 8332.
2. Tax is computed **per line** and rounded half-up per line: `tax = round_half_up(gross * rate / 100)`.
3. The line total is gross + tax, and the note totals are plain integer sums of the already-rounded line values.

Round per line, then sum: a total can never drift from the printed lines by more than the rounding already visible on those lines, so the tax line at 23% is on its own base (the 23% lines only), not on the whole subtotal.

## Numbering

Drafts carry a `CN-DRAFT-YYYY-NNNN` id no client sees. The final `CN-YYYY-NNNN` number is assigned only at finalize, in the issue date's year, and the counter is written before the record, so a crash burns a number rather than reusing one. Because drafts never hold a final number and finalized notes cannot be deleted, the final series never has a gap.

## Privacy

All data stays local, in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/credit-note/`. Two files: `notes.json`, `counter.json`. Nothing is sent anywhere, there is no account, no API key and no network call in this server at all. License keys are verified offline. The Markdown and HTML renders are returned as text; this server writes no document files.

Built by theluckystrike. https://github.com/theluckystrike
