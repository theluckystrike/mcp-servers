import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptFunnelBatch, readFunnelDay, storageHarness, namespaceHarness } from './funnel-harness.mjs';
import { funnelStats, readFunnelCohort, recordFunnelEvents, saveMintCohort } from '../src/funnel.js';

const NOW = Date.parse('2026-10-16T08:00:00Z');
const DAY = '2026-10-16';
const TOKEN = `anon_${'b'.repeat(32)}`;
const batch = (overrides = {}) => ({
  day: DAY, server: 'invoice', source: 'guide', cohort: 'ordinary',
  events: ['successful_business_call', 'first_successful_anon_token_server_day', 'upgrade_impression'],
  observationId: crypto.randomUUID(), tokenServerHash: 'c'.repeat(64), ...overrides,
});

test('one transaction atomically records response counters and first marker; failures roll everything back', async () => {
  const h = storageHarness();
  const incoming = batch();
  h.failNextPut(`first:${incoming.tokenServerHash}`);
  await assert.rejects(acceptFunnelBatch(h.storage, incoming, NOW), /injected transaction failure/);
  assert.equal(h.values().size, 0);
  assert.equal(h.alarm(), null);
  const result = await acceptFunnelBatch(h.storage, incoming, NOW);
  assert.equal(result.status, 200);
  const stats = await readFunnelDay(h.storage, DAY);
  assert.equal(stats.complete, true);
  assert.deepEqual(stats.rows.map((row) => row.count), [1, 1, 1]);
  assert.equal(h.values().get(`first:${incoming.tokenServerHash}`), 1);
});

test('concurrent first responses increment every response exactly once and first observation once', async () => {
  const h = storageHarness();
  await Promise.all(Array.from({ length: 100 }, () => acceptFunnelBatch(h.storage, batch(), NOW)));
  const stats = await readFunnelDay(h.storage, DAY);
  const count = (event) => stats.rows.find((row) => row.event === event).count;
  assert.equal(count('successful_business_call'), 100);
  assert.equal(count('upgrade_impression'), 100);
  assert.equal(count('first_successful_anon_token_server_day'), 1);
});

test('replaying the same admitted response is idempotent, but a fresh response remains a new call', async () => {
  const h = storageHarness();
  const incoming = batch();
  await acceptFunnelBatch(h.storage, incoming, NOW);
  assert.equal((await acceptFunnelBatch(h.storage, incoming, NOW)).duplicate, true);
  assert.equal((await acceptFunnelBatch(h.storage, { ...incoming, source: 'github' }, NOW)).status, 409);
  await acceptFunnelBatch(h.storage, { ...incoming, observationId: crypto.randomUUID() }, NOW);
  const stats = await readFunnelDay(h.storage, DAY);
  assert.equal(stats.rows.find((row) => row.event === 'successful_business_call').count, 2);
  assert.equal(stats.rows.find((row) => row.event === 'first_successful_anon_token_server_day').count, 1);
});

test('lost reply after commit retries the same response identity without double counting any batch event', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW }); // FunnelState reads the real clock; keep the fixed day inside its 31-day retention
  const h = namespaceHarness();
  h.loseNextReply();
  await recordFunnelEvents(h.env, { server: 'invoice', source: 'guide', cohort: 'probe', token: TOKEN,
    events: ['successful_business_call', 'first_successful_anon_token_server_day', 'upgrade_impression'] }, NOW);
  assert.equal(h.fetches(), 2);
  const stats = await funnelStats(h.env, { now: NOW });
  assert.equal(stats.probe.successful_business_call, 1);
  assert.equal(stats.probe.first_successful_anon_token_server_day, 1);
  assert.equal(stats.probe.upgrade_impression, 1);
  assert.equal(stats.ordinary.successful_business_call, 0);
  const saved = JSON.stringify([...h.objects.values()][0].values());
  assert.equal(saved.includes(TOKEN), false);
});

test('1000 servers and concurrent responses still export at most70 source/cohort/event cells per day', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW }); // FunnelState reads the real clock; keep the fixed day inside its 31-day retention
  const h = namespaceHarness();
  await Promise.all(Array.from({ length: 1000 }, (_, index) => recordFunnelEvents(h.env, {
    server: `server-${index}`, source: 'guide', cohort: 'ordinary',
    token: `anon_${index.toString(16).padStart(32, '0')}`,
    events: ['successful_business_call', 'first_successful_anon_token_server_day', 'upgrade_impression'],
  }, NOW)));
  const before = h.fetches();
  const stats = await funnelStats(h.env, { days: 7, now: NOW });
  assert.equal(h.fetches() - before, 7);
  assert.equal(stats.complete, true);
  assert.equal(stats.rows.length, 3);
  assert.equal(stats.ordinary.successful_business_call, 1000);
  assert.equal(stats.ordinary.first_successful_anon_token_server_day, 1000);
  assert.ok(JSON.stringify(stats).length < 32768);
  assert.equal('server' in stats.rows[0], false, 'public summaries are explicitly pooled across server labels');
});

test('one unavailable day makes retrieval incomplete with null totals, no deceptively partial ordinary values', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW }); // FunnelState reads the real clock; keep the fixed day inside its 31-day retention
  const h = namespaceHarness();
  await recordFunnelEvents(h.env, { server: 'invoice', source: 'guide', cohort: 'ordinary', events: ['successful_business_call'] }, NOW);
  h.unavailable.add('funnel:v2:2026-10-15');
  const stats = await funnelStats(h.env, { days: 7, now: NOW });
  assert.equal(stats.complete, false);
  assert.equal(stats.ordinary, null);
  assert.equal(stats.probe, null);
  assert.deepEqual(stats.rows, []);
  assert.equal(stats.days.filter((day) => !day.complete).length, 1);
});

test('oversized, truncated and duplicate-cell responses cannot claim complete retrieval', async () => {
  for (const value of [
    { day: DAY, complete: false, rows: [] },
    { day: DAY, complete: true, rows: Array.from({ length: 71 }, () => ({ source: 'guide', cohort: 'ordinary', event: 'offer_view', count: 1 })) },
    { day: DAY, complete: true, rows: [{ source: 'guide', cohort: 'ordinary', event: 'offer_view', count: 1 }, { source: 'guide', cohort: 'ordinary', event: 'offer_view', count: 1 }] },
    { day: DAY, complete: true, rows: [], padding: 'x'.repeat(32768) },
  ]) {
    const env = { FUNNEL: { idFromName: (name) => name, get: () => ({ fetch: async () => Response.json(value) }) } };
    const stats = await funnelStats(env, { now: NOW });
    assert.equal(stats.complete, false);
    assert.equal(stats.ordinary, null);
  }
});

test('negative-cached or expired probe sidecars remain unmeasured unless current request explicitly marks probe', async () => {
  const values = new Map();
  let visible = true;
  const kv = { get: async (key) => visible ? values.get(key) ?? null : null, put: async (key, value) => values.set(key, value) };
  await saveMintCohort(kv, TOKEN, new Request('https://mcp.zovo.one/mcp/token?acq=guide', { headers: { 'x-mcp-probe': '1' } }));
  assert.deepEqual(await readFunnelCohort(kv, TOKEN), { source: 'guide', cohort: 'probe' });
  visible = false;
  assert.equal(await readFunnelCohort(kv, TOKEN), null);
  assert.deepEqual(await readFunnelCohort(kv, TOKEN, new Headers({ 'x-mcp-probe': '1' })), { source: 'unattributed', cohort: 'probe' });
  visible = true;
  values.clear(); // expiry after otherwise continued product-token use
  assert.equal(await readFunnelCohort(kv, TOKEN), null);
  const unavailable = { get: async () => { throw new Error('KV unavailable'); } };
  assert.deepEqual(await readFunnelCohort(unavailable, TOKEN, new Headers({ 'x-mcp-probe': '1' })), { source: 'unattributed', cohort: 'probe' });
});

test('validation rejects raw tokens, arbitrary fields, invalid labels and impossible event combinations', async () => {
  const h = storageHarness();
  for (const invalid of [
    batch({ token: TOKEN }), batch({ source: 'private@example.invalid' }), batch({ observationId: 'raw-token' }),
    batch({ events: ['first_successful_anon_token_server_day'] }), batch({ events: ['upgrade_impression'] }),
    batch({ events: ['successful_business_call', 'offer_view'] }), batch({ tokenServerHash: TOKEN }),
    batch({ day: '2026-02-30' }), batch({ events: ['successful_business_call', 'successful_business_call'] }),
  ]) assert.equal((await acceptFunnelBatch(h.storage, invalid, NOW)).status, 400);
  assert.equal(h.values().size, 0);
});

test('daily object refuses cross-day reuse and schedules retention cleanup at31days from day start', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW }); // FunnelState reads the real clock; keep the fixed day inside its 31-day retention
  const h = namespaceHarness();
  await recordFunnelEvents(h.env, { server: 'invoice', source: 'guide', cohort: 'probe', events: ['successful_business_call'] }, NOW);
  const object = h.objects.get(`funnel:v2:${DAY}`);
  assert.equal(object.alarm(), Date.parse('2026-11-16T00:00:00Z'));
  assert.equal((await acceptFunnelBatch(object.storage, batch({ day: '2026-10-15' }), NOW)).status, 409);
  assert.equal((await acceptFunnelBatch(object.storage, batch({ day: '2026-09-01' }), NOW)).status, 410);
  const meta = await object.storage.get('meta');
  await object.storage.transaction((tx) => tx.put('meta', { ...meta, expiresAt: 0 }));
  await object.object.alarm();
  assert.equal(object.values().size, 0);
  assert.equal(object.alarm(), null);
});
