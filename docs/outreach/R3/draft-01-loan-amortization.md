# Draft 01 — nextjedi/life-mathematics #3 — Implement Loan Calculator with Amortization Schedule

GitHub Issue — OPEN, created 2026-01-29, 0 comments
https://github.com/nextjedi/life-mathematics/issues/3
Ask: inputs principal, annual rate, term, payment frequency; outputs monthly payment, total paid, total interest, payoff date (M = P[r(1+r)^n]/[(1+r)^n-1]).

---

## Draft answer (paste as-is)

The formula you listed is the standard annuity-immediate monthly payment; the parts that trip implementations up are the edges, so worth pinning down before you code it:

- **r must be periodic, not annual.** For monthly payments r = annualRate/12, and n = years*12. If you support payment frequency, recompute both r and n from the frequency (weekly = rate/52, n = years*52, etc.) — never reuse monthly n.
- **Zero-rate special case.** When r = 0 the closed form divides by zero; payment is simply P/n. Guard it explicitly or the calculator 500s on 0% promotional loans.
- **Amortization schedule = running balance loop.** Payment is constant; interest each period = balance*r, principal = payment − interest, balance −= principal. Round display to cents but carry full precision in the loop or the final payment drifts.
- Payoff date = issue date + n periods (calendar-aware if you want it exact for monthly terms, since months differ in length).

If you want a working reference implementing exactly this contract (payment, totals, interest, and the full period-by-period schedule, with the zero-rate guard), I built a free MCP tool for it — you can call it from Claude or any MCP client without installing anything:

```json
{
  "mcpServers": {
    "loan-calculator": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-loan-calculator"]
    }
  }
}
```

Setup page: https://mcp.zovo.one/s/loan-calculator

Disclosure: I built it, so weigh the recommendation accordingly — but the periodic-rate/zero-rate/schedule-precision points above are the parts worth keeping regardless of what you build.
