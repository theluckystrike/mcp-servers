# Draft 03 — tomalcorn/finance-tracker #296 — Budget tracker (categories) screen

GitHub Issue — OPEN, created 2026-09-25, 0 comments
https://github.com/tomalcorn/finance-tracker/issues/296

---

## Draft answer (paste as-is)

Your spec (categories/subcategories, budgets, accrual, progress-and-remaining, share-of-remaining, allocation view) is the right shape. Two modeling notes from building a similar budget tool that will save rework:

- **Store budgets at the leaf category only and roll up.** If you allow budgeting both "Food" and "Food › Coffee", progress math becomes ambiguous (double counting). Derive parent totals in the query layer.
- **Accrual needs an anchor date.** "Remaining this month" changes meaning for irregular income; keep accrual as budget − sum(spend in period) per leaf category, computed at read time — don't denormalize remaining into the row or edits will drift.

The allocation ring reads best as share-of-*remaining*, not share-of-budget — it stays meaningful after mid-month changes.

If useful as a reference, I built a free budget MCP server (envelopes, monthly plans, spend tracking) callable from Claude or any MCP client:

```json
{
  "mcpServers": {
    "budget": {
      "command": "claude",
      "args": ["mcp", "add", "--mcpb", "https://github.com/theluckystrike/mcp-servers/releases/download/v0.22.0/budget.mcpb"]
    }
  }
}
```

Setup: https://mcp.zovo.one/s/budget

Disclosure: I built it — treat accordingly; the leaf-only budgeting rule is the part I'd keep regardless.
