# MCP Stripe Billing — check your Stripe balance and build payment links from chat

Give Claude (or any MCP client) two working Stripe tools: `stripe_balance` reads your live account balance, and `stripe_payment_link` creates a real Stripe payment link for a price you name. Direct Stripe REST calls from your machine with your own `STRIPE_SECRET_KEY` — no dashboard round-trip for the two questions you actually ask most.

## Why a Stripe server

Most Stripe questions in a work session are small ones: "what's my balance?", "make me a payment link for that $19 price". Opening the dashboard for each is friction. With this server connected, the answer or the link arrives in the conversation — and the link is immediately shareable.

## What it does

- `stripe_balance` — available and pending balance across your Stripe account, straight from `/v1/balance`.
- `stripe_payment_link` — given a price ID (and optionally a quantity), creates a shareable `https://buy.stripe.com/...` link via `/v1/payment_links`.
- Without `STRIPE_SECRET_KEY` set, both tools say so plainly instead of pretending — no silent mock data.

## Install

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

Use a restricted key (balance read + payment links write) rather than your full secret.

## Try it

- "What's my Stripe balance right now?"
- "Create a payment link for price_abc123, quantity 1."

## Part of the luckystrike MCP suite

Free, part of the [luckystrike MCP suite](https://github.com/theluckystrike) — productivity & finance servers that turn AI chat into working documents and calculations. Listing in the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=theluckystrike%2Fstripe-billing).

## Docs (GitMCP)

Live docs endpoint: https://gitmcp.io/theluckystrike/mcp-stripe-billing
