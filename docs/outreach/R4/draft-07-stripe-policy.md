# Draft 07 — writ-agent/writ #28 — Policy pack: stripe-billing-mcp

GitHub Issue — OPEN, 0 comments
https://github.com/writ-agent/writ/issues/28

---

## Draft answer (paste as-is)

This scoping is right, and the ask/deny split matches how a real billing server behaves in practice. A few additions from running a stripe-billing MCP server in production:

- **Read tools are where the daily value is.** Most agent-side Stripe usage is `balance` reads and payment-link creation — low-risk, high-frequency. Consider a middle tier between "ask" and "deny": *auto-allow reads* (`balance`, `charges:list`, `invoices:list`), since gating read-only calls adds friction without protecting money.
- **Payment links are the edge case.** `payment_links:create` mints a shareable URL that charges real money, but it's also the most useful write. It's a good candidate for ask-with-allowlist: permit only when the price ID matches a pre-configured set (e.g. `price_*` IDs pinned in server config), so the agent can't invent new prices.
- **Missing key should fail loudly, not silently.** A server without `STRIPE_SECRET_KEY` configured should refuse with a clear message — the worst failure mode is a mock-successful refund report. Worth adding to the policy pack as a server-side requirement.
- **Restricted keys beat server-side gating.** The strongest control is upstream: run the server with a Stripe restricted key scoped to exactly the allowed operations (balance read + payment link write). Then even a policy bypass can't refund or payout.

For reference, I built a small stripe-billing MCP server (balance + payment link only, restricted-key guidance built into the README, loud failure without the key) — useful as a concrete example of the minimal-risk tool surface this pack is describing:

```json
{
  "mcpServers": {
    "mcp-stripe-billing": {
      "command": "npx",
      "args": ["-y", "github:theluckystrike/mcp-stripe-billing"],
      "env": { "STRIPE_SECRET_KEY": "sk_live_..." }
    }
  }
}
```

Setup page: https://mcp.zovo.one/s/stripe-billing

Disclosure: I built it, so weigh the recommendation accordingly — the read-tier and restricted-key points stand regardless of which server you use.
