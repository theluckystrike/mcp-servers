# Draft 08 — ledgerfield/ledgerfield #29 — backlog: deep tax modules (bracket calculators)

GitHub Issue — OPEN, 0 comments
https://github.com/ledgerfield/ledgerfield/issues/29

---

## Draft answer (paste as-is)

For the IIT bracket modules, the pitfalls that bite across jurisdictions — worth encoding in the shared schema before implementing 16 countries:

- **Marginal vs effective must be separate outputs.** Bracket math gives both, but consumers constantly confuse them; return `marginal_rate`, `effective_rate`, and `tax` as distinct fields, never one "rate".
- **Non-monomorphic brackets.** Several of your Tier 2 list have brackets where the *rate structure* changes mid-scale (e.g. surcharges that apply above a threshold, or rebates that phase out). A simple `[(threshold, rate)]` list can't express a rebate phase-out — the schema needs a per-band "modifier" slot or the property tests will hide it.
- **Rounding is jurisdictional.** CH rounds to 1 CHF per line, IN to the nearest rupee only at the final step, BR keeps cents with specific truncation. Make rounding a per-country strategy parameter, not a shared default.
- **Property-test anchors:** zero income; income exactly at each threshold (off-by-one band assignment is the classic bug); income 1 unit above the top threshold; and negative-income input rejected.

If you want a reference for the bracket-calculation contract (marginal + effective + band-by-band breakdown), I built a small US federal income tax MCP server along exactly these lines — callable from Claude or any MCP client:

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

Setup: https://mcp.zovo.one/s/tax-calc

Disclosure: I built it, so weigh it accordingly — the schema/modifier/rounding points are the part worth keeping regardless of what you build.
