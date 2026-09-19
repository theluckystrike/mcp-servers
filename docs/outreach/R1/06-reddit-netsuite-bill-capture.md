# Draft 06 — Reddit r/Netsuite: Using MCP for Bill Capture (PDF vendor bills)

Reddit r/Netsuite — `HUMAN-GATED` (Reddit account required)
https://www.reddit.com/r/Netsuite/comments/1ozq0ox/using_mcp_for_bill_capture/
*Using MCP for Bill Capture* — "Anyone had any success getting MCP via Claude to
create vendor bills from pdfs?"
The thread's existing answer says a bridge/middleware is needed to get clean vendor bills into
NetSuite. The useful contribution is the shape that bridge should take and the fields that must be
mapped, so the asker can scope it before committing.

https://mcp.zovo.one/guides/invoice-pdf-from-chat

---

## Draft answer (paste as-is)

You're right that this needs a bridge — but the bridge should live on the *extraction + staging* side,
not inside the ERP call. That's the split that makes bill capture work.

The pattern that holds up: the MCP server does PDF → validated row, and something else does row →
NetSuite. Concretely:

1. **Extract to a fixed schema, on disk.** Not free-form model output — a tool call that returns
   `{vendor, invoice_number, invoice_date, due_date, currency, net, tax, gross, po_ref, line_items}`.
   Lines with their own amounts matter for anything with more than one GL account.
2. **Validate before it goes anywhere.** Three checks catch nearly all bad captures: net + tax = gross
   (to the cent, in the invoice currency); the invoice number is unique per vendor; the currency is one
   you actually transact in. A failed check needs to *not* create the bill — a wrong vendor bill that
   balances is far more expensive to find later than a capture that errors loudly.
3. **Stage it, then post.** Write the validated row to a table you can eyeball, then push to NetSuite.
   Two reasons: you get a review step on the first hundred (which you will want, whatever the docs say),
   and re-runs don't double-post, because the staged row is the idempotency key.
4. **Whatever NetSuite path you use** — SuiteTalk, REST, or a scheduled import — is downstream of step 3
   and can be changed without touching the extraction.

The bit people underrate: because Claude reads PDFs but the *server* does extraction, you inherit a
correction loop — when a vendor changes their template, you fix the parse for that vendor and don't
re-prompt. That's the difference between a demo and something that survives a month-end.

I maintain local MCP servers for this (invoice PDF in, structured row out, plus bank-side
reconciliation), and the extraction contract above is written out here, free and no signup:
https://mcp.zovo.one/guides/invoice-pdf-from-chat — runs locally, documents are not uploaded.
Disclosure: those servers are mine. The four-step split is what I'd suggest even if you build the rest
yourself.

---

## Notes for the operator
- Answer complements rather than contradicts the existing "you'll need a bridge" reply — do not post as a rebuttal.
- NetSuite-specific ERP details are deliberately kept generic; do not invent SuiteTalk endpoint specifics.
