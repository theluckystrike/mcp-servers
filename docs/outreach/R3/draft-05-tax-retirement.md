# Draft 05 — JapanFinance/kei3 #56 — Idea: Retirement income tax calculator (lump-sum vs annuity)

GitHub Issue — OPEN, 3 comments
https://github.com/JapanFinance/kei3/issues/56

---

## Draft answer (paste as-is)

For the lump-sum vs annuity comparison, the pieces that decide the answer more than the headline rates:

- **Lump-sum retirement income gets separate taxation in Japan** (退職所得) — roughly half is taxable after the 20-year work-life deduction (勤続年数 × 40万円 − 20 covers the first 20 years), so the effective rate is usually far below salary withholding. Annuity payouts are 公的年金等 with the public-pension deduction instead. Modeling them with the same brackets is the most common mistake.
- **Compare after-tax present value, not total tax.** An annuity pays later; discount at a conservative rate before comparing.
- Social insurance premiums apply differently to each — worth including or the comparison skews.

If you want a calculator to start from, I built a free tax MCP server (income tax, brackets, withholding estimates) callable from Claude or any MCP client — easy to extend with the 退職所得 rule above:

```json
{
  "mcpServers": {
    "tax-calculator": {
      "command": "claude",
      "args": ["mcp", "add", "--mcpb", "https://github.com/theluckystrike/mcp-servers/releases/download/v0.22.0/tax-calc.mcpb"]
    }
  }
}
```

Setup: https://mcp.zovo.one/s/tax-calculator

Disclosure: I built it — treat accordingly; the separate-taxation point is the part worth keeping regardless of what you build.
