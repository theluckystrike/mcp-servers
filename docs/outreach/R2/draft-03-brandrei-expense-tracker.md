# Draft 03 — GitHub Issue: Brandrei/skills-integrate-mcp-with-copilot #13 — Expense Management & Cost Tracking

GitHub Issues (Brandrei/skills-integrate-mcp-with-copilot) — `OPEN`, created 2026-04-15
https://github.com/Brandrei/skills-integrate-mcp-with-copilot/issues/13
*Expense Management & Cost Tracking*
"Track operational expenses for activities and compute profitability metrics… Record activity-related expenses, categorize expenses (supplies, instructor fees, equipment, etc.), calculate net revenue per activity, generate expense reports."
`expense-tracker` — https://mcp.zovo.one/s/expense-tracker (hosted HTTP MCP endpoint `https://mcp.zovo.one/mcp/expense-tracker/t/<token>`)
The ask is a structured expense-tracking capability (record, categorize, report) in an MCP+Copilot context. Our expense-tracker server answers exactly this, and the MCP context makes the config snippet directly relevant.

---

## Draft answer (paste as-is)

The four goals you've listed — record, categorize, link to an activity, and report — are the right decomposition, and they're all data-model decisions, not UI decisions. If you model an expense as a row with an amount, a category, and an activity/foreign key, then "net revenue per activity" and "expense reports" both become queries over that table rather than features you build separately. That's the shape that survives contact with real use.

Two things to insist on before you build it:

- **Money as integer minor units.** Store amounts in cents/pence, not floats. Float rounding is the classic source of "the total is off by a cent" bugs, and they're miserable to chase once a report has been shared.
- **Category as a controlled vocabulary, not free text.** You listed supplies, instructor fees, equipment, facility, travel. Enforce a fixed set (with an "other" bucket) so the "cost vs. revenue analysis" you want is a group-by, not a string-matching exercise.

Since this is in an MCP context, the fastest way to get the capability working today is to point an MCP client at a hosted expense-tracking server rather than build the whole thing first. I built a free one that records, categorizes, and reports expenses, and it's an HTTP MCP endpoint — it drops into any MCP client as a URL, no install:

```json
{
  "mcpServers": {
    "expense-tracker": {
      "type": "http",
      "url": "https://mcp.zovo.one/mcp/expense-tracker/t/<token>"
    }
  }
}
```

The token is minted free at `https://mcp.zovo.one/mcp/connect`. Disclosure: I built this server, so treat the recommendation accordingly — but the "expense as a row with amount/category/activity" and "integer minor units" contract above is the part worth keeping regardless of what you build.

---

## Notes for the operator
- Post only if the issue is still open and no one has already described the data-model approach.
- The value is the "data model, not UI" reframe plus the two bug-avoidance notes; the config snippet is secondary.
- Do not mention maintainers; do not ping anyone.
