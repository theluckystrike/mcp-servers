# mcp-goods-receipt

[![theluckystrike/mcp-goods-receipt MCP server](https://glama.ai/mcp/servers/theluckystrike/mcp-goods-receipt/badges/score.svg)](https://glama.ai/mcp/servers/theluckystrike/mcp-goods-receipt)

**In the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.theluckystrike%2Fgoods-receipt/versions/latest)** (`io.github.theluckystrike/goods-receipt`).

Purchase orders and the goods-receipt notes that receive them. A PO carries a reference, a
supplier, and dated lines — sku, description, whole units ordered — plus whole-percent
over/under tolerances that decide when a receipt is flagged. A GRN is raised against an open
PO, one cell per line: units received, units damaged, and any shortage you already know
about. Shortage is derived, not typed — ordered minus received, floored at zero — and shows
up as a discrepancy the moment the numbers disagree.

## The one rule that decides everything else

Over-tolerance is checked against the cumulative total across every GRN raised on the line,
not against each delivery in isolation.

Three deliveries of 40 against an order of 100 at 10% are allowed in ones and tens but the
third delivery is refused, because 120 received of 100 ordered breaks the over tolerance even
though no single delivery did. Partial deliveries are fine — several GRNs against the same PO
is the normal case — and the cumulative rule is what stops them quietly over-receiving.

Two smaller rules follow from it:

- **Nothing derived is stored.** Shortage and discrepancy are worked out on every call from
  the PO lines and the GRNs already recorded. Damage is the only thing typed in, because it
  is the only thing the warehouse actually sees.
- **Receiving past tolerance is refused, never clamped.** Unless the extra units are declared
  damaged, a receipt that breaks the over tolerance writes nothing and says why. Damaged
  units still count for the tolerance check — "it arrived broken" is not a licence to order
  100 and receive 130.

## The tools

| Tool | What it does |
| --- | --- |
| `po_add` | Create a purchase order: reference, supplier, dated lines, over/under tolerances |
| `grn_add` | Receive goods against an open PO: received/damaged per line, shortage derived |
| `grn_line_add` | Receive one more line onto an open GRN |
| `grn_list` | GRNs newest first, filtered by PO or status |
| `grn_get` | One GRN: every line with received, damaged, shortage and notes |
| `grn_discrepancy` | Lines short, over, damaged, or closed with outstanding amounts |
| `grn_close` | Close a GRN once the count is settled |
| `grn_status_report` | Every PO: open lines, cumulative received, what is still outstanding |
| `grn_export_csv` | GRNs as CSV (Pro) |
| `license_status` | Which tier this install is on and where the key came from |
| `license_activate` | Store a Pro key for this server |

## Quick start

```
po_add  { "reference": "ACME-1001", "supplier": "Acme Trading",
          "lines": [ { "sku": "BRK-8", "description": "Bracket, steel", "ordered": 100 } ] }
grn_add { "po": "PO-0001",
          "lines": [ { "line": "L01", "received": 60 } ] }
grn_add { "po": "PO-0001",
          "lines": [ { "line": "L01", "received": 35, "damaged": 2 },
                     { "line": "L01", "received": 10 } ] }   // refused: 105 > 100 + 10%
grn_discrepancy {}                                        // L01 is 5 short of 100
```

Ids look like `PO-0001` and `GRN-0001`; lines inside a PO are `L01`, `L02`, ….

## Quick start

```
{ "tool": "po_add", "args": { "reference": "ACME-1005", "supplier": "Acme Trading",
            "lines": [{ "sku": "BRK-01", "description": "Bracket, steel", "ordered": 10 }] } }
{ "tool": "grn_add", "args": { "po": "PO-0001", "lines": [{ "line": "L01", "received": 9, "damaged": 1 }] } }
{ "tool": "grn_discrepancy", "args": { "po": "PO-0001" } }
```

A GRN that arrives past the over tolerance is refused; shortage is computed as ordered minus
received and shown as a discrepancy. `grn_export_csv` (Pro) writes the whole ledger out as CSV.

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Purchase orders | up to 2,000 | up to 2,000 |
| GRNs | up to 5,000 | up to 5,000 |
| Lines per PO / per GRN | up to 200 | up to 200 |
| `grn_list`, `grn_get`, `grn_discrepancy`, `grn_status_report` | yes | yes |
| `grn_export_csv` | no | yes |

The domain is capped estate-wide (2,000 POs, 5,000 GRNs, 200 lines) on every tier — these are
hard rules so a store cannot grow past what the file format can hold, not a paywall. Pro
unlocks CSV export for pushing receipts into a spreadsheet or an ERP.

Get Pro: https://mcp.zovo.one/buy/goods-receipt (one-time), or all servers for one price at
https://mcp.zovo.one/buy/bundle

## Privacy

All data stays local, in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/goods-receipt/`, in
`store.json` (POs and GRNs) and `counter.json` (the PO- and GRN- series). There is no network
call anywhere in this server, no API key, and no account. The only file it reads that it does
not own is the shared business profile, and it never writes to it.

Built by [theluckystrike](https://github.com/theluckystrike). Support: support@zovo.one

## Use these docs as an MCP server

Any MCP client (Claude, Cursor, Windsurf, VS Code) can read this repository's documentation directly via GitMCP — no install:

- Docs MCP URL: https://gitmcp.io/theluckystrike/mcp-goods-receipt
