#!/usr/bin/env node
import { serve, money } from './_shared.js';
import { monthlyPayment, validateInputs, calculateAmortization } from './loan.js';

serve('mcp-loan-calculator', '1.0.0', [
  {
    name: 'loan_payment',
    desc: 'Monthly payment + total interest for a loan: principal, annual rate (%), term in years.',
    schema: { type: 'object', properties: { principal: { type: 'number' }, annual_rate: { type: 'number' }, years: { type: 'number' } }, required: ['principal', 'annual_rate', 'years'] },
    handler: async ({ principal, annual_rate, years }) => {
      const error = validateInputs(principal, annual_rate, years);
      if (error) return error;

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
      const error = validateInputs(principal, annual_rate, years);
      if (error) return error;

      const lines = calculateAmortization(principal, annual_rate, years);
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  },
]);