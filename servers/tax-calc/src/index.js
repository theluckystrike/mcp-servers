#!/usr/bin/env node
import { serve, money } from './_shared.js';

// 2026 US federal brackets (single filer, approximate planning values)
const BRACKETS = [
  [11925, 0.10], [48475, 0.12], [103350, 0.22], [197300, 0.24],
  [250525, 0.32], [626350, 0.35], [Infinity, 0.37],
];
const STD_DEDUCTION = 15750;

function tax(taxable) {
  let t = 0, prev = 0;
  for (const [cap, rate] of BRACKETS) { if (taxable > prev) { t += (Math.min(taxable, cap) - prev) * rate; prev = cap; } else break; }
  return t;
}

serve('mcp-tax-calc', '1.0.0', [
  {
    name: 'us_federal_tax',
    desc: 'Estimate 2026 US federal income tax (single filer, standard deduction): gross annual income.',
    schema: { type: 'object', properties: { gross_income: { type: 'number' } }, required: ['gross_income'] },
    handler: async ({ gross_income }) => {
      const taxable = Math.max(0, gross_income - STD_DEDUCTION);
      const t = tax(taxable);
      return { content: [{ type: 'text', text: `Taxable income: $${money(taxable)}\nEstimated federal tax: $${money(t)}\nEffective rate: ${(100 * t / gross_income).toFixed(1)}%\nAfter-tax: $${money(gross_income - t)}` }] };
    },
  },
]);
