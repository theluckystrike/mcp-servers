#!/usr/bin/env node
import { serve } from './_shared.js';

serve('mcp-pomodoro', '1.0.0', [
  {
    name: 'pomodoro_plan',
    desc: 'Plan a work session into pomodoros: 25-min focus blocks with 5-min short breaks and a 15-min long break every 4th block.',
    schema: { type: 'object', properties: { minutes: { type: 'number', description: 'Total minutes available' }, blocks: { type: 'number', description: 'Alternative: number of pomodoros' } } },
    handler: async ({ minutes, blocks }) => {
      const n = blocks ?? Math.max(1, Math.floor((minutes ?? 120) / 30));
      const schedule = [];
      for (let i = 1; i <= n; i++) {
        schedule.push(`Pomodoro ${i}: 25 min focus`);
        if (i % 4 === 0 && i < n) schedule.push('Long break: 15 min');
        else if (i < n) schedule.push('Short break: 5 min');
      }
      return { content: [{ type: 'text', text: schedule.join('\n') }] };
    },
  },
]);
