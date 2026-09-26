#!/usr/bin/env node
import { serve, money } from './_shared.js';

const LEDGER = {};

serve('mcp-budget', '1.0.0', [
  {
    name: 'budget_set',
    desc: 'Set a monthly budget category and cap (e.g. groceries, 400).',
    schema: { type: 'object', properties: { category: { type: 'string' }, monthly_cap: { type: 'number' } }, required: ['category', 'monthly_cap'] },
    handler: async ({ category, monthly_cap }) => {
      LEDGER[category] = { cap: monthly_cap, spent: LEDGER[category]?.spent ?? 0 };
      return { content: [{ type: 'text', text: `Budget set: ${category} = $${money(monthly_cap)}/month` }] };
    },
  },
  {
    name: 'budget_spend',
    desc: 'Record an expense against a budget category.',
    schema: { type: 'object', properties: { category: { type: 'string' }, amount: { type: 'number' } }, required: ['category', 'amount'] },
    handler: async ({ category, amount }) => {
      const b = LEDGER[category] ?? { cap: 0, spent: 0 };
      b.spent = money(b.spent + amount); LEDGER[category] = b;
      const left = money(b.cap - b.spent);
      return { content: [{ type: 'text', text: `${category}: spent $${money(b.spent)} of $${money(b.cap)} — ${left >= 0 ? `$${left} remaining` : `$${-left} OVER`}` }] };
    },
  },
  {
    name: 'budget_report',
    desc: 'Show all budgets and remaining amounts.',
    handler: async () => {
      const lines = Object.entries(LEDGER).map(([c, b]) => `${c}: $${money(b.spent)}/$${money(b.cap)} (${100 * b.spent / (b.cap || 1)}% used)`);
      return { content: [{ type: 'text', text: lines.length ? lines.join('\n') : 'No budgets set yet.' }] };
    },
  },
]);
