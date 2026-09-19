# Draft 01 — GitHub Issue: kimai/cli #32 — Add invoice PDF generation

GitHub Issues (kimai/cli) — `OPEN`, created 2026-09-08
https://github.com/kimai/cli/issues/32
*Add invoice PDF generation*
"Could we add support for generating invoice PDFs through Kimai's API? Would this first require an endpoint that accepts invoice generation options and creates the PDF server side?"
`invoice` — https://mcp.zovo.one/s/invoice (hosted HTTP MCP endpoint `https://mcp.zovo.one/mcp/invoice/t/<token>`)
The ask is exactly "an endpoint that accepts invoice generation options and creates the PDF server-side." That is precisely the shape of our hosted invoice MCP server: you pass business/client/line-item options and it returns a rendered PDF. Value-first answer below.

---

## Draft answer (paste as-is)

Yes — and the shape you're describing is the right one, so it's worth spelling out what "accepts options and creates the PDF server-side" has to mean for it to be useful, because that's where most invoice-PDF implementations quietly break.

The endpoint should take the *data*, not the layout. Pass business details, client details, invoice number, issue date, billing period, and line items (description, quantity, unit rate) as structured arguments, and let the server own the rendering. That keeps the caller free of PDF layout code and makes the output deterministic — same input, same bytes, which matters for audit and for re-issuing.

Two things to insist on before you build it:

- **Money as integer minor units.** Pass amounts in cents/pence, not floats. Float rounding is the classic source of "the total is off by a cent" bugs that are nearly impossible to trace later.
- **Server-side rendering, not a browser print.** A headless-browser print is fragile and slow; a server that renders the PDF directly is deterministic and testable. That's the "creates the PDF server side" part done properly.

If you want a working reference for exactly this contract, I built a free hosted MCP server that does it: you call it with business/client/line-item options and it returns the rendered invoice PDF. It's an HTTP MCP endpoint, so it drops into any MCP client as a URL — no install:

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

The token is minted free at `https://mcp.zovo.one/mcp/connect`. Disclosure: I built this server, so treat the recommendation accordingly — but the "structured data in, deterministic PDF out" contract above is the part worth keeping regardless of what you build.

---

## Notes for the operator
- Post only if the issue is still open and no one has already described the server-side contract.
- The value is the "data not layout" + "integer minor units" reframe; the config snippet is secondary.
- Do not mention maintainers; do not ping anyone.
