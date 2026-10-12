#!/usr/bin/env node
import { serve, money } from './_shared.js';
import { VERSION } from './version.js';

// Inputs a freelancer actually knows: the income they want, what the business costs
// to run, how much of their week is billable, how many weeks they work, and the tax
// rate on profit. Everything below is one division family; no table, no storage.

function hourlyRate({ desired_annual_income, business_expenses, billable_hours_per_week, weeks_per_year, tax_rate_pct }) {
  const hours = billable_hours_per_week * weeks_per_year;
  const net = 1 - tax_rate_pct / 100;
  const gross = desired_annual_income + business_expenses;
  return { hours, net, gross, rate: (gross / hours) / net };
}

function check(args) {
  const a = {
    desired_annual_income: args.desired_annual_income ?? 0,
    business_expenses: args.business_expenses ?? 0,
    billable_hours_per_week: args.billable_hours_per_week,
    weeks_per_year: args.weeks_per_year ?? 46,
    tax_rate_pct: args.tax_rate_pct ?? 0,
  };
  for (const [k, v] of Object.entries(a)) {
    if (typeof v !== 'number' || !isFinite(v) || v < 0) throw new Error(`${k} must be a non-negative number. Nothing was calculated.`);
  }
  if (a.billable_hours_per_week === undefined || a.billable_hours_per_week <= 0) {
    throw new Error('billable_hours_per_week must be greater than zero: a rate over zero hours is undefined. Nothing was calculated.');
  }
  if (a.weeks_per_year <= 0 || a.weeks_per_year > 52) {
    throw new Error('weeks_per_year must be between 0 and 52. Nothing was calculated.');
  }
  if (a.tax_rate_pct >= 100) {
    throw new Error('tax_rate_pct must be below 100: at a 100 percent tax rate no billable hour can fund after-tax income. Nothing was calculated.');
  }
  return a;
}

const BASIS =
  'The rate = (desired after-tax income + business expenses) / (billable hours per week x weeks per year), ' +
  'then divided by (1 - tax rate). Expenses are billed, not taxed: the tax rate applies to profit only.';

serve('mcp-hourly-rate', VERSION, [
  {
    name: 'calculate_rate',
    desc: 'Minimum hourly rate to hit a desired annual after-tax income, given expenses, billable hours and tax.',
    schema: {
      type: 'object',
      properties: {
        desired_annual_income: { type: 'number', description: 'After-tax take-home you want for the year, in currency units' },
        business_expenses: { type: 'number', description: 'Annual business expenses the rate must also cover. Default 0' },
        billable_hours_per_week: { type: 'number', description: 'Hours you can actually bill per week, not hours worked' },
        weeks_per_year: { type: 'number', description: 'Working weeks per year after holidays and slack. Default 46' },
        tax_rate_pct: { type: 'number', description: 'Tax and social charges on profit, as a percent. Default 0' },
      },
      required: ['billable_hours_per_week'],
    },
    handler: async (args) => {
      const a = check(args);
      const r = hourlyRate(a);
      const lines = [
        BASIS,
        '',
        `Gross revenue needed: $${money(r.gross)}`,
        `Billable hours per year: ${r.hours}`,
        `Minimum hourly rate: $${money(r.rate)}`,
      ];
      if (a.tax_rate_pct > 0) lines.push(`Pre-tax rate: $${money(r.gross / r.hours)}, lifted to $${money(r.rate)} by the ${a.tax_rate_pct}% tax on profit.`);
      if (a.billable_hours_per_week > 40) lines.push(`Note: ${a.billable_hours_per_week} billable hours per week is above most solo capacity; unbilled admin time is already excluded, but consider whether it holds.`);
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  },
  {
    name: 'break_even',
    desc: 'The hourly rate that covers business expenses only: below it, every billable hour loses money.',
    schema: {
      type: 'object',
      properties: {
        business_expenses: { type: 'number', description: 'Annual business expenses to cover' },
        billable_hours_per_week: { type: 'number', description: 'Hours you can actually bill per week' },
        weeks_per_year: { type: 'number', description: 'Working weeks per year. Default 46' },
        tax_rate_pct: { type: 'number', description: 'Tax rate on profit, percent. Default 0' },
      },
      required: ['business_expenses', 'billable_hours_per_week'],
    },
    handler: async (args) => {
      const a = check({ ...args, desired_annual_income: 0 });
      const r = hourlyRate(a);
      return { content: [{ type: 'text', text: [
        BASIS,
        '',
        `Annual expenses to cover: $${money(r.gross)}`,
        `Billable hours per year: ${r.hours}`,
        `Break-even hourly rate: $${money(r.rate)}`,
        'Below this rate each billable hour loses money. Price above it by the margin calculate_rate gives you.',
      ].join('\n') }] };
    },
  },
  {
    name: 'what_if',
    desc: 'Compare hourly rates across scenarios: change income, hours, expenses or tax per scenario.',
    schema: {
      type: 'object',
      properties: {
        scenarios: {
          type: 'array',
          description: 'Two or more scenarios to compare. Each takes the calculate_rate inputs.',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Name of the scenario, e.g. "fewer hours"' },
              desired_annual_income: { type: 'number' },
              business_expenses: { type: 'number' },
              billable_hours_per_week: { type: 'number' },
              weeks_per_year: { type: 'number' },
              tax_rate_pct: { type: 'number' },
            },
            required: ['label', 'billable_hours_per_week'],
          },
        },
      },
      required: ['scenarios'],
    },
    handler: async ({ scenarios }) => {
      if (!Array.isArray(scenarios) || scenarios.length < 2) throw new Error('what_if needs at least two scenarios to compare. Nothing was calculated.');
      if (scenarios.length > 12) throw new Error('at most 12 scenarios per call. Nothing was calculated.');
      const rows = scenarios.map((s) => {
        const a = check(s);
        const r = hourlyRate(a);
        return { label: s.label, rate: money(r.rate), hours: r.hours, gross: money(r.gross) };
      });
      rows.sort((x, y) => y.rate - x.rate);
      const text = rows.map((r) => `${r.label}: $${r.rate}/h (${r.hours} billable hours, $${r.gross} gross revenue)`).join('\n');
      return { content: [{ type: 'text', text: BASIS + '\n\n' + text + '\n\nHighest rate first.' }] };
    },
  },
]);
