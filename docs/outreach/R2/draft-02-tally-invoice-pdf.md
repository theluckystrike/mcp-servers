# Draft 02 — GitHub Issue: gasparyanvazgen/tally #18 — Implement real invoice PDF generation

**Surface:** GitHub Issues (gasparyanvazgen/tally) — `OPEN`, created 2026-08-27
**Thread URL:** https://github.com/gasparyanvazgen/tally/issues/18
**Thread title:** *Implement real invoice PDF generation*
**Ask (quote):** "Replace browser print as the primary invoice-generation mechanism… Build an invoice PDF template. Include business information, client information, invoice number, issue date, billing period, line items, hours, rate, subtotal and total."
**Server that answers it:** `invoice` — https://mcp.zovo.one/s/invoice (hosted HTTP MCP endpoint `https://mcp.zovo.one/mcp/invoice/t/<token>`)
**Fit:** The ask enumerates exactly the fields our invoice server accepts and renders into a PDF. Value-first answer maps each required field to a working call.

---

## Draft answer (paste as-is)

The field list you've written out is exactly the right contract for an invoice PDF, and it's worth noting that every one of those fields maps to a structured argument rather than a layout decision. Business info, client info, invoice number, issue date, billing period, line items with hours/rate, subtotal and total — that's a data contract, not a template problem. If you model it that way, the PDF becomes a pure render of a known shape, which is what makes it testable and re-issuable.

Two implementation notes that will save you the classic bugs:

- **Compute the total from line items, never accept it as input.** Subtotal and total should be derived server-side from hours × rate per line. If a caller can pass a total that disagrees with the lines, you get invoices that don't add up and you can't tell which side is wrong.
- **Integer minor units for money.** Pass amounts in cents/pence. Float arithmetic is where "the total is off by a cent" bugs come from, and they're miserable to chase in a PDF that's already been sent.

If you want a working reference for this exact contract rather than building the renderer from scratch, I built a free hosted MCP server that takes those fields as arguments and returns the rendered invoice PDF. It's an HTTP MCP endpoint, so it drops into any MCP client as a URL — no install:

```json
{
  "mcpServers": {
    "invoice": {
      "type": "http",
      "url": "https://mcp.zovo.one/mcp/invoice/t/<token>"
    }
  }
}
```

The token is minted free at `https://mcp.zovo.one/mcp/connect`. Disclosure: I built this server, so treat the recommendation accordingly — but the "derive totals from lines, integer minor units" contract above is the part worth keeping regardless of what you build.

---

## Notes for the operator
- Post only if the issue is still open and no one has already described the data-contract approach.
- The value is the "data contract, not template" reframe plus the two bug-avoidance notes.
- Do not mention maintainers; do not ping anyone.
