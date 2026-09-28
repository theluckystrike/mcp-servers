# MCP Receipts — turn receipt lines into an itemized, taxed total

Give Claude (or any MCP client) a receipt parser: `receipt_parse` takes raw receipt lines — "2 x Coffee 4.50", "Sandwich 8.90" — and returns an itemized total with quantity × price per line, a subtotal, and tax added at your rate. For expense reports, splitting bills, or just checking the receipt was rung up right.

## Why a receipts server

You already have the receipt text — photographed, typed or copy-pasted. What you want is the total with tax, not another app asking to connect to your bank. Paste the lines into the conversation, get back a clean itemized breakdown with the tax rate you specify (8.5%, 20% VAT, whatever applies), and ask follow-up questions in the same breath.

## What it does

- `receipt_parse` — an array of receipt lines plus an optional tax rate → per-line amounts (qty × unit price), subtotal, tax, grand total, rounded with plain decimal arithmetic.
- Handles quantity prefixes ("2 x ...", "3x ...") and bare line items equally.

## Install

```json
{
  "mcpServers": {
    "mcp-receipts": {
      "command": "npx",
      "args": ["-y", "github:theluckystrike/mcp-receipts"]
    }
  }
}
```

## Try it

- "Parse this receipt at 8.5% tax: '2 x Coffee 4.50', 'Bagel 3.20', 'Orange juice 2.75'."
- "Split these 4 items three ways after 20% VAT."

## Part of the luckystrike MCP suite

Free, part of the [luckystrike MCP suite](https://github.com/theluckystrike) — productivity & finance servers that turn AI chat into working documents and calculations. Listing in the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=theluckystrike%2Freceipts).

## Docs (GitMCP)

Live docs endpoint: https://gitmcp.io/theluckystrike/mcp-receipts
