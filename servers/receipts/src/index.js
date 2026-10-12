#!/usr/bin/env node
import { serve, money } from './_shared.js';

serve('mcp-receipts', '1.0.0', [
  {
    name: 'receipt_parse',
    desc: 'Parse raw receipt lines ("2 x Coffee 4.50") into an itemized total with tax.',
    schema: { type: 'object', properties: { lines: { type: 'array', items: { type: 'string' } }, tax_rate: { type: 'number', description: 'Percent, e.g. 8.5' } }, required: ['lines'] },
    handler: async ({ lines, tax_rate = 0 }) => {
      let sub = 0; const items = [];
      for (const l of lines) {
        const m = l.match(/^(?:(\d+(?:\.\d+)?)\s*[xX@]\s*)?(.+?)\s+(\d+(?:\.\d+)?)$/);
        if (!m) { items.push(`SKIP: ${l}`); continue; }
        const qty = m[1] ? parseFloat(m[1]) : 1;
        const price = parseFloat(m[3]);
        sub += qty * price; items.push(`${qty} x ${m[2].trim()} = $${money(qty * price)}`);
      }
      const tax = money(sub * tax_rate / 100);
      return { content: [{ type: 'text', text: items.join('\n') + `\nSubtotal: $${money(sub)}\nTax: $${tax}\nTotal: $${money(sub + tax)}` }] };
    },
  },
]);
