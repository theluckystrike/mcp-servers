#!/usr/bin/env node
// outreach_send.mjs — Resend-based outreach send engine for mcp.zovo.one
//
// Usage:
//   node scripts/outreach_send.mjs --input data/outreach_targets.json --dry-run   (default)
//   node scripts/outreach_send.mjs --input data/outreach_targets.json --live
//
// Input: JSON array of {draft_ref, channel, target, subject, status, to?, body?}
//   - channel must be "email" or "manual".
//   - Only email-channel rows with a "to" address and status "ready" are candidates.
//   - manual-channel rows are listed and skipped (no public email -> human post/comment).
//
// Safety:
//   - --dry-run (default) logs only, writes nothing to Resend; attempts recorded to outbox.
//   - --live actually sends. Hard cap: MAX_SENDS_PER_RUN = 10. 3s pause between sends.
//   - Every attempt appended to data/outbox.json as {ts, to, status, resend_id, campaign}.
//
// Env: RESEND_API_KEY (source ~/.zshrc). Sender: "MCP Servers <hello@zovo.one>" (domain verified).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FROM = 'MCP Servers <hello@zovo.one>';
const RESEND_URL = 'https://api.resend.com/emails';
const MAX_SENDS_PER_RUN = 10;
const SEND_INTERVAL_MS = 3000;

const args = process.argv.slice(2);
const live = args.includes('--live');
const inIdx = args.indexOf('--input');
const inputArg = inIdx >= 0 ? args[inIdx + 1] : null;

if (!inputArg) {
  console.error('Usage: node scripts/outreach_send.mjs --input <targets.json> [--live]');
  console.error('Default mode is --dry-run (no emails sent).');
  process.exit(1);
}

const inputPath = resolve(ROOT, inputArg);
const outboxPath = resolve(ROOT, 'data/outbox.json');

const raw = JSON.parse(readFileSync(inputPath, 'utf8'));
const targets = Array.isArray(raw) ? raw : (raw.targets || []);
if (!targets.length) { console.error('No targets found in ' + inputPath); process.exit(1); }
const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.error('RESEND_API_KEY not set. Run: source ~/.zshrc');
  process.exit(1);
}
if (live && !apiKey.startsWith('re_')) {
  console.error('RESEND_API_KEY does not look like a Resend key (re_...). Aborting live send.');
  process.exit(1);
}

function loadOutbox() {
  if (existsSync(outboxPath)) {
    try { return JSON.parse(readFileSync(outboxPath, 'utf8')); } catch { return []; }
  }
  return [];
}
function appendOutbox(entry) {
  const outbox = loadOutbox();
  outbox.push(entry);
  writeFileSync(outboxPath, JSON.stringify(outbox, null, 2) + '\n');
}

const emailRows = targets.filter(t => t.channel === 'email' && t.status === 'ready' && t.to);
const manualRows = targets.filter(t => t.channel === 'manual' || !t.to);
let sentCount = 0;
let failures = 0;

console.log(`outreach_send: input=${inputArg} mode=${live ? 'LIVE' : 'dry-run'}`);
console.log(`candidates: ${emailRows.length} email, ${manualRows.length} manual (manual never emailed)\n`);

for (const t of manualRows) {
  console.log(`[manual] ${t.draft_ref} -> ${t.target} (channel:manual, not emailable)`);
  appendOutbox({ ts: new Date().toISOString(), to: null, status: 'skipped:manual', resend_id: null, campaign: t.campaign || t.draft_ref, draft_ref: t.draft_ref });
}
console.log('');

for (const t of emailRows) {
  if (sentCount >= MAX_SENDS_PER_RUN) {
    console.log(`HARD CAP reached (${MAX_SENDS_PER_RUN} sends/run). Remaining rows not sent this run.`);
    break;
  }
  const ts = new Date().toISOString();
  if (!live) {
    console.log(`[dry-run] would send: to=${t.to} subject="${t.subject}" campaign=${t.campaign || t.draft_ref}`);
    appendOutbox({ ts, to: t.to, status: 'dry-run', resend_id: null, campaign: t.campaign || t.draft_ref, draft_ref: t.draft_ref });
    continue;
  }
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [t.to],
        subject: t.subject,
        html: t.body || `<p>${(t.body_text || '').replace(/\n/g, '<br>')}</p>`,
      }),
    });
    const data = await res.json().catch(() => ({}));
    const status = res.ok ? 'sent' : `error:${res.status}`;
    console.log(`[live] to=${t.to} -> ${status} id=${data.id || '-'}`);
    appendOutbox({ ts, to: t.to, status, resend_id: data.id || null, campaign: t.campaign || t.draft_ref, draft_ref: t.draft_ref, error: res.ok ? undefined : data });
    if (res.ok) sentCount++; else failures++;
  } catch (err) {
    console.error(`[live] to=${t.to} -> exception: ${err.message}`);
    appendOutbox({ ts, to: t.to, status: 'exception', resend_id: null, campaign: t.campaign || t.draft_ref, draft_ref: t.draft_ref, error: String(err.message) });
    failures++;
  }
  if (sentCount > 0 || failures > 0) await new Promise(r => setTimeout(r, SEND_INTERVAL_MS));
}

console.log(`\ndone: mode=${live ? 'live' : 'dry-run'}, sent=${sentCount}, failures=${failures}, outbox=${outboxPath}`);
