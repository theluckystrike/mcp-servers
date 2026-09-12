# mcp-bill-of-sale

Record a sale and get a signed-paper-ready bill of sale. Tell your assistant who sold, who bought, what the item is -- with the VIN, serial number or IMEI where it has one -- the price and the date, and the server writes the document: parties, item, price, an as-is clause for second-hand sales, any warranty in your own words, and signature lines for both sides. Work on it as a draft, finalize it into the frozen signing copy, and print it as Markdown or as a single self-contained HTML file that prints to PDF from any browser with no assets beside it. Everything stays on your machine; there is no account and no network call in this server at all.

Built by theluckystrike.

npm publish for `@theluckystrike/mcp-bill-of-sale` is pending, so `npx -y @theluckystrike/mcp-bill-of-sale` returns 404 today. Until then, a clone+build is the working path.

## Install

### Claude Desktop

macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bill-of-sale": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-bill-of-sale"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add bill-of-sale -- npx -y @theluckystrike/mcp-bill-of-sale
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project), same entry as Claude Desktop.

## Tools

| tool | what it does |
| --- | --- |
| `sale_create` | Record a sale and generate the bill of sale: seller, buyer, item with VIN/serial/IMEI where it has one, price in minor units, date. Returns `BOS-YYYY-NNNN`. An identical repeat sale is refused unless you confirm it |
| `sale_update` | Change anything on a draft before signing: price, parties, item details, identifiers, the as-is clause, warranty, notes. Empty string clears an optional field |
| `sale_finalize` | Freeze the draft into the signing copy. From here `sale_update` refuses it and every render prints without the DRAFT watermark |
| `sale_list` | Every bill of sale, newest first: id, status, date, item, buyer, seller, price. Filter to drafts or finalized |
| `sale_get` | One bill of sale in full by its BOS number |
| `sale_delete` | Delete a draft outright; a finalized document needs `confirm_finalized: true`. The number is never reissued, so a gap in the series is the record of the deletion |
| `sale_render` | Print the document: Markdown, a self-contained HTML file for print-to-PDF, or both, with signature lines. Drafts carry a DRAFT watermark so a review copy cannot be signed by mistake |
| `sale_summary` | The book at a glance: draft and finalized counts, total value per currency. Currencies are never added together |
| `license_status` / `license_activate` | Free or Pro, and the key |

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Open drafts | 10 | Unlimited |
| Finalized documents | 5 | Unlimited |
| Render to Markdown and HTML (`sale_render`) | Unlimited | Unlimited |
| Read, list and summarize (`sale_get`, `sale_list`, `sale_summary`) | Unlimited | Unlimited |
| Delete (`sale_delete`) | Yes | Yes |

The document itself is never metered. Whether you hold a signed record of the sale is the question this server exists to answer, and a free tier that withholds the document is a demo. What is metered is the volume of records held: ten open drafts and five finalized documents is a real year of side-business sales, not a trial. `sale_delete` is free for the same reason the cap is on records held: a draft typed in twice would otherwise cost a slot with no way back but a key.

**Get Pro:** https://mcp.zovo.one/buy/bill-of-sale -- $19 one-time for this server, or $39 for the bundle.

## How a sale flows

1. `sale_create` with the facts. The seller defaults to the shared business profile's name when the profile has one, so the seller block is typed once for the whole suite.
2. `sale_render` prints the review copy, watermarked DRAFT.
3. `sale_update` fixes anything the buyer or seller spots.
4. `sale_finalize` freezes it. `sale_render` now prints the signing copy: sign the printed page or print the HTML to PDF, and both parties keep a copy.

Every amount is an integer number of minor units, a price is never a float, and dates are checked as real calendar dates. A VIN that is not 17 characters or an IMEI that is not 15 digits is stored as given but flagged in the response, because those are the two identifiers a buyer most often misreads.

## Privacy

All data stays local, in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/bill-of-sale/`. Two files: `sales.json`, `counter.json`, plus rendered documents under `documents/`. Nothing is sent anywhere, there is no account, no API key and no network call in this server at all. License keys are verified offline.

The rendered document is a generic template, not legal advice. Bills of sale for vehicles, boats and regulated goods may have statutory form or filing requirements where the sale happens.

Built by theluckystrike. https://github.com/theluckystrike
