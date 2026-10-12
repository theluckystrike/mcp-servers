#!/usr/bin/env node
import { serve, money } from './_shared.js';

// Uses Stripe REST API directly — set STRIPE_SECRET_KEY env var.
async function stripe(path) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: 'Set STRIPE_SECRET_KEY env var to use live Stripe tools.' };
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${key}` } });
  return r.json();
}

serve('mcp-stripe-billing', '1.0.0', [
  {
    name: 'stripe_balance',
    desc: 'Show available and pending Stripe balance (requires STRIPE_SECRET_KEY env var).',
    handler: async () => {
      const b = await stripe('balance');
      if (b.error) return { content: [{ type: 'text', text: b.error }] };
      const f = x => x.reduce((s, i) => s + i.amount / 100, 0);
      return { content: [{ type: 'text', text: `Available: $${money(f(b.available))}\nPending: $${money(f(b.pending))}` }] };
    },
  },
  {
    name: 'stripe_payment_link',
    desc: 'Formula for creating a Stripe payment link: give a product name and price; returns the exact curl command to run.',
    schema: { type: 'object', properties: { product: { type: 'string' }, price: { type: 'number', description: 'Price in dollars' } }, required: ['product', 'price'] },
    handler: async ({ product, price }) => {
      const cents = Math.round(price * 100);
      return { content: [{ type: 'text', text: `stripe payment_links create is a 2-step call. Run:\n1) curl https://api.stripe.com/v1/prices -u sk_live_xxx: -d unit_amount=${cents} -d currency=usd -d "product_data[name]=${product}"\n2) curl https://api.stripe.com/v1/payment_links -u sk_live_xxx: -d "line_items[0][price]=<price_id>" -d "line_items[0][quantity]=1"` }] };
    },
  },
]);
