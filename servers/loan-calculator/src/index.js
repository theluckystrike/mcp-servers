#!/usr/bin/env node
import { serve, money } from './_shared.js';

function monthlyPayment(P, annualRate, years) {
  const r = annualRate / 100 / 12, n = years * 12;
  if (r === 0) return P / n;
  return P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
}

serve('mcp-loan-calculator', '1.0.0', [
  {
    name: 'loan_payment',
    desc: 'Monthly payment + total interest for a loan: principal, annual rate (%), term in years.',
    schema: { type: 'object', properties: { principal: { type: 'number' }, annual_rate: { type: 'number' }, years: { type: 'number' } }, required: ['principal', 'annual_rate', 'years'] },
    handler: async ({ principal, annual_rate, years }) => {
      const pmt = monthlyPayment(principal, annual_rate, years);
      const total = pmt * years * 12;
      return { content: [{ type: 'text', text: `Monthly payment: $${money(pmt)}\nTotal paid: $${money(total)}\nTotal interest: $${money(total - principal)}` }] };
    },
  },
  {
    name: 'loan_amortize',
    desc: 'Year-by-year amortization: principal, annual rate (%), term in years.',
    schema: { type: 'object', properties: { principal: { type: 'number' }, annual_rate: { type: 'number' }, years: { type: 'number' } }, required: ['principal', 'annual_rate', 'years'] },
    handler: async ({ principal, annual_rate, years }) => {
      const r = annual_rate / 100 / 12, n = years * 12;
      let bal = principal; const lines = [];
      for (let y = 1; y <= years; y++) {
        let pi = 0, ia = 0;
        for (let m = 0; m < 12; m++) { const i = bal * r; const p = monthlyPayment(bal, annual_rate, (n - (y - 1) * 12 - m) / 12); pi += p; ia += i; bal -= (p - i); }
        lines.push(`Year ${y}: principal $${money(pi)}, interest $${money(ia)}, balance $${money(Math.max(0, bal))}`);
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  },
]);
