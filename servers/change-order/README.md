# mcp-change-order

Change orders against a quote or a work order, kept the way a variation is kept on site:
what was added, what was taken out and what changed, each with a reason and a date, sent to
the client, and answered. The running contract value is the original plus the deltas the
client has APPROVED; what they have not answered yet is shown as pending and never added in.
Once a change order is approved, the delta comes back as `invoice_create`-ready items in
MAJOR units and `quote_create`-ready items in MINOR units, in one call, with the scale
printed against each.

No delta is stored. A change order holds its lines and its status history; the delta, the
running value and the VAT are derived on every call, with the invoice server's own
arithmetic. Nothing is invented: the first change order against a reference states the
original contract value once, every later one inherits it, and a different figure is
refused by name.

## Install


**One-click (.mcpb):** download `change-order.mcpb` from the latest release and double-click it in Claude Desktop:
https://github.com/theluckystrike/mcp-servers/releases/latest

**Hosted, no install:** point a URL-based client at `https://mcp.zovo.one/mcp/change-order`. `GET https://mcp.zovo.one/mcp/connect` mints a token and prints a ready URL.

npm publish for `@theluckystrike/mcp-change-order` is pending, so the `npx` line below returns 404 today.

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "change-order": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-change-order"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add change-order -- npx -y @theluckystrike/mcp-change-order
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project), same entry as Claude Desktop.

## Tools

| Tool | What it does |
| --- | --- |
| `change_order_create` | Raise a change order against a quote or work order: reference, client, title, date, and the original contract value on the first one |
| `change_order_add_line` | Add an added, removed or changed line to a draft, with its quantity, unit price in minor units, reason and date |
| `change_order_status` | Move it along: draft to sent, sent to approved or rejected, draft or sent to void, each step dated |
| `change_order_get` | One change order in full: every line with its delta, the VAT, the history and the running value of the reference |
| `change_order_list` | Change orders by reference, status, client and date range, with approved and pending deltas per currency |
| `change_order_delete` | Delete an empty draft raised by mistake. Free on every tier |
| `contract_value` | The running value of one reference: original, approved delta, current value, pending delta held apart |
| `change_order_document` | The change order as a plain-text document for the client to approve |
| `change_order_invoice_payload` | The approved delta as `invoice_create` items (MAJOR units) and `quote_create` items (MINOR units) |
| `license_status` / `license_activate` | Free or Pro, and where to upgrade |

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Open change orders (draft and sent) | 5 | unlimited |
| Lines per change order | 200 | 200 |
| Raise, line, move, get, list, delete | yes | yes |
| Running contract value | yes | yes |
| Change order document | no | yes |
| Invoice-ready delta payload, both scales | no | yes |

The cap counts OPEN change orders, the ones the client has not answered, not the ones you
have ever raised. Approving, rejecting or voiding one frees its slot, and so does
`change_order_delete` on a draft with no lines; all of those are free on every tier, because
a way back that only a Pro key can reach is not a way back.

Get Pro: https://mcp.zovo.one/buy/change-order (one-time $19, lifetime), or all servers for
$39: https://mcp.zovo.one/buy/bundle

## The status machine

`draft` to `sent`; `sent` to `approved` or `rejected`; `draft` or `sent` to `void`.
Approved, rejected and void are final. A draft cannot be approved directly: approval is the
client's answer to something they were sent. Lines are added only while a change order is a
draft; a sent one that needs another line is voided and raised again, so the client's
approval always refers to what they were sent. Every step carries its own date, and a step
dated before the last one is refused.

## Where the money comes from

This server keeps no arithmetic of its own. `computeTotals`, `currencyDecimals`,
`formatMoney` and `roundHalfUp` are imported from `@theluckystrike/mcp-invoice/lib`, the
corrupt-store quarantine from `@theluckystrike/mcp-timezone/lib`, the timezone-aware
"today" from `@theluckystrike/mcp-quotes/lib`. The VAT rate, the currency and the business
name come from the shared business profile that `business_set` in the invoice server writes.
Nothing is written outside this server's own directory, and no sibling store is opened.

## The measured insight

**A changed line is two items, not one, because one net item shows the customer nothing
they can check.** A line that goes from 3 x EUR 450.00 to 5 x EUR 420.00 is worth +EUR
750.00, and the tempting payload is one item of quantity 1 at EUR 750.00. The customer
cannot reproduce that figure from anything on the change order they signed. The payload
this server emits is a reversal, -3 x EUR 450.00, and the revised line, 5 x EUR 420.00;
each reproduces on a calculator, and `computeTotals` over both is the same +EUR 750.00,
because the invoice server's `roundHalfUp` is symmetric in sign. The same rule carries a
removal as a negative quantity at the unit price it was booked at, which `invoice_create`
accepts. The unit suite re-runs the invoice server's own `computeTotals` over the payload
as returned and asserts the four item values and the three totals, then feeds the
`quote_create` items into the same engine as though their MINOR figure were MAJOR and
asserts the net is exactly 100x, so the day someone "simplifies" the payload to one net
item, or moves a field between the two scales, the build says so instead of the customer.

## Privacy

All data stays on your machine, in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/change-order/`.
Nothing is sent anywhere. There is no account and no API key. License keys are verified
offline. This server reads one file it does not own, the shared business profile, and
writes into no store but its own.

Built by theluckystrike. https://github.com/theluckystrike
