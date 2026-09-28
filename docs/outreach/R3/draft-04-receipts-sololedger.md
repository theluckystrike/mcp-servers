# Draft 04 — vivek-OZ/sololedger #5 — Expense Tracking / Upload receipt image with expense entry

GitHub Issue — OPEN, 0 comments
https://github.com/vivek-OZ/sololedger/issues/5

---

## Draft answer (paste as-is)

One design note that matters more than the storage choice: **separate the receipt (artifact) from the expense (record).** Store the image wherever you like (Firebase Storage works), but keep an `expenses` row with {amount, currency, category, date, merchant, receiptUrl} and never OCR-parse at write time. Parse async, prefill a draft expense, let the user confirm — auto-extracted amounts are wrong often enough that trusting them silently destroys the ledger's credibility.

Data model sketch:

- expenses(id, amount_minor INT, currency, category, date, merchant, receipt_id)
- receipts(id, storage_path, uploaded_at, ocr_status)

Integer minor units for amount (cents), not floats — same reason as always.

If you want a reference for the record-keeping side (capture, categorize, total expenses) callable from Claude or any MCP client, I built a free receipts MCP server:

```json
{
  "mcpServers": {
    "receipts": {
      "command": "claude",
      "args": ["mcp", "add", "--mcpb", "https://github.com/theluckystrike/mcp-servers/releases/download/v0.22.0/receipts.mcpb"]
    }
  }
}
```

Setup: https://mcp.zovo.one/s/receipts

Disclosure: I built it — treat accordingly; the artifact/record separation is the part worth keeping regardless of stack.
