import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendSuccessUpgrade, funnelStats, readFunnelCohort, recordFunnelEvent,
  recordFunnelEvents, requestCohort, saveMintCohort, successfulBusinessResponse,
} from '../../billing/src/funnel.js';
import { namespaceHarness } from '../../billing/test/funnel-harness.mjs';

const TOKEN = `anon_${'a'.repeat(32)}`;
// Anchored to the run date, not a fixed day: FunnelState checks its 31-day retention
// against the real clock, so a fixed 2026-10-16 turned three tests red on 2026-11-16.
const NOW = Math.floor(Date.now() / 60000) * 60000;
const NOW_DAY = new Date(NOW).toISOString().slice(0, 10);
const request = (name = 'invoice_create') => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: { private_input: 'never export' } } });
const success = () => ({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: 'Completed' }], structuredContent: { private_result: 'never export' } } });
const body = JSON.stringify;
function kvFixture(pageSize = 1000) {
  const store = new Map();
  const writes = [];
  return {
    store, writes,
    async get(key) { return store.get(key) ?? null; },
    async put(key, value, options) { store.set(key, value); writes.push({ key, value, options }); },
    async list({ prefix = '', cursor = '0' }) {
      const keys = [...store.keys()].filter((key) => key.startsWith(prefix)).sort();
      const start = Number(cursor), end = start + pageSize;
      return { keys: keys.slice(start, end).map((name) => ({ name })), list_complete: end >= keys.length, cursor: end < keys.length ? String(end) : undefined };
    },
  };
}

test('positive business response and trailer preserve structured content under any property order', () => {
  const r = success();
  const reordered = { result: r.result, id: 1, jsonrpc: '2.0' };
  assert.equal(successfulBusinessResponse(body(request()), body(reordered)), true);
  const out = appendSuccessUpgrade(body(request()), body(reordered), 'Upgrade link');
  assert.equal(out.appended, true);
  assert.deepEqual(JSON.parse(out.body).result.structuredContent, r.result.structuredContent);
  assert.deepEqual(JSON.parse(out.body).result.content, [...r.result.content, { type: 'text', text: 'Upgrade link' }]);
});

test('negative controls never classify discovery, license administration, errors or malformed data as success', () => {
  const negative = [
    [{ ...request(), method: 'initialize' }, success(), 200],
    [{ ...request(), method: 'tools/list' }, success(), 200],
    [{ ...request(), jsonrpc: '1.0' }, success(), 200],
    [request('license_status'), success(), 200], [request('license_activate'), success(), 200],
    [{ ...request(), id: null }, success(), 200], [request(), { ...success(), id: 2 }, 200],
    [request(), { jsonrpc: '2.0', id: 1, error: { code: -32603 } }, 200],
    [request(), { ...success(), result: { ...success().result, isError: true } }, 200],
    [request(), { ...success(), result: { content: [{ type: 'text', text: ' Error: quota exceeded' }] } }, 200],
    [request(), { ...success(), result: { content: 'wrong' } }, 200],
    [request(), success(), 401], [request(), success(), 500],
    [[request()], success(), 200], [request(), [success()], 200],
    [request(), null, 200], [null, success(), 200],
  ];
  for (const [req, res, status] of negative) {
    assert.equal(successfulBusinessResponse(body(req), body(res), status), false, body({ req, res, status }));
    const out = appendSuccessUpgrade(body(req), body(res), 'must not append', status);
    assert.equal(out.appended, false);
    assert.equal(out.body, body(res));
  }
  assert.equal(successfulBusinessResponse('{', body(success())), false);
  assert.equal(successfulBusinessResponse(body(request()), 'event: message\ndata: {}'), false);
});

test('source declarations are a bounded allowlist, and unknown raw input never becomes a label', () => {
  const valid = new Request('https://mcp.zovo.one/mcp/token?acq=store.product');
  assert.deepEqual(requestCohort(valid), { source: 'store.product', cohort: 'ordinary' });
  const privateText = 'private@example.invalid';
  assert.deepEqual(requestCohort(new Request(`https://mcp.zovo.one/mcp/token?acq=${privateText}`)), { source: 'unattributed', cohort: 'ordinary' });
  assert.deepEqual(requestCohort(new Request(valid, { headers: { 'x-mcp-probe': '1' } })), { source: 'store.product', cohort: 'probe' });
});

test('mint sidecar stores a hash and fixed labels, retains probe classification without later headers', async () => {
  const kv = kvFixture();
  await saveMintCohort(kv, TOKEN, new Request('https://mcp.zovo.one/mcp/token?acq=guide', { headers: { 'x-mcp-probe': '1', 'cf-connecting-ip': '192.0.2.1' } }));
  const [{ key, value, options }] = kv.writes;
  assert.match(key, /^funnel:v1:cohort:[a-f0-9]{64}$/);
  assert.equal(key.includes(TOKEN), false);
  assert.deepEqual(JSON.parse(value), { source: 'guide', cohort: 'probe' });
  assert.equal(options.expirationTtl, 31 * 86400);
  assert.deepEqual(await readFunnelCohort(kv, TOKEN), { source: 'guide', cohort: 'probe' });
  assert.equal(body(kv.writes).includes('192.0.2.1'), false);
  assert.equal(body(kv.writes).includes(TOKEN), false);
});

test('old-token acquisition cannot be rewritten by query; explicit probe excludes just that request', async () => {
  const kv = kvFixture();
  const forged = new Request('https://mcp.zovo.one/buy/bundle?acq=github');
  assert.equal(await readFunnelCohort(kv, TOKEN, forged.headers, forged), null);
  assert.deepEqual(await readFunnelCohort(kv, TOKEN, new Headers({ 'x-mcp-probe': '1' })), { source: 'unattributed', cohort: 'probe' });
  assert.deepEqual(await readFunnelCohort(kv, '', forged.headers, forged), { source: 'github', cohort: 'ordinary' });
  await saveMintCohort(kv, 'not-an-anonymous-token', forged);
  assert.equal(kv.writes.length, 0);
});

test('OAuth mints use fixed OAuth source and corrupt or unavailable sidecars cannot leak into ordinary counts', async () => {
  const kv = kvFixture();
  await saveMintCohort(kv, TOKEN, new Request('https://mcp.zovo.one/oauth/authorize/consent?acq=github'));
  assert.deepEqual(await readFunnelCohort(kv, TOKEN), { source: 'oauth', cohort: 'ordinary' });
  kv.store.set(kv.writes[0].key, '{');
  await assert.rejects(readFunnelCohort(kv, TOKEN), /Invalid funnel cohort/);
  await assert.rejects(readFunnelCohort({ get: async () => { throw new Error('KV unavailable'); } }, TOKEN), /KV unavailable/);
});

test('first success deduplicates per token/server/UTC date, with probes isolated from ordinary', async () => {
  const { env, objects } = namespaceHarness();
  const event = { server: 'invoice', source: 'store.product', cohort: 'ordinary', events: ['successful_business_call', 'first_successful_anon_token_server_day'], token: TOKEN };
  await recordFunnelEvents(env, event, NOW);
  await recordFunnelEvents(env, event, NOW + 1000);
  await recordFunnelEvents(env, { ...event, cohort: 'probe' }, NOW);
  await recordFunnelEvents(env, { ...event, server: 'quotes' }, NOW);
  await recordFunnelEvents(env, event, NOW + 86400000);
  await recordFunnelEvents(env, { ...event, token: undefined }, NOW);
  const stats = await funnelStats(env, { days: 2, now: NOW + 86400000 });
  assert.equal(stats.ordinary.first_successful_anon_token_server_day, 3);
  assert.equal(stats.probe.first_successful_anon_token_server_day, 1);
  for (const object of objects.values()) assert.equal(body([...object.values()]).includes(TOKEN), false);
});

test('same-day window reads bounded atomic summaries, excludes old days and never exports markers or raw inputs', async () => {
  const { env } = namespaceHarness();
  for (const cohort of ['ordinary', 'probe']) {
    await recordFunnelEvents(env, { server: 'invoice', source: 'guide', cohort, events: ['successful_business_call', 'upgrade_impression'] }, NOW);
    for (const event of ['offer_view', 'checkout_handoff']) await recordFunnelEvent(env, { server: 'invoice', source: 'guide', cohort, event }, NOW);
  }
  await recordFunnelEvent(env, { server: 'invoice', source: 'private@example.invalid', cohort: 'ordinary', event: 'offer_view' }, NOW - 86400000);
  const stats = await funnelStats(env, { now: NOW });
  assert.equal(stats.ordinary.successful_business_call, 1);
  assert.equal(stats.ordinary.upgrade_impression, 1);
  assert.equal(stats.ordinary.offer_view, 1);
  assert.equal(stats.ordinary.checkout_handoff, 1);
  assert.equal(stats.probe.checkout_handoff, 1);
  assert.equal(stats.rows.length, 8);
  assert.deepEqual(stats.window.utc_dates, [NOW_DAY]);
  assert.equal(stats.window.start, `${NOW_DAY}T00:00:00.000Z`);
  assert.equal(body(stats).includes('private@example.invalid'), false);
  assert.equal(body(stats).includes('first:'), false);
  assert.equal('conversion' in stats, false);
});

test('invalid event and time inputs cannot create unbounded telemetry keys', async () => {
  const { env, fetches } = namespaceHarness();
  await assert.rejects(recordFunnelEvent(env, { server: 'arbitrary/user@email', event: 'offer_view' }, NOW));
  await assert.rejects(recordFunnelEvent(env, { server: 'invoice', event: 'private_input' }, NOW));
  await assert.rejects(recordFunnelEvent(env, { server: 'invoice', event: 'offer_view' }, NaN));
  await assert.rejects(funnelStats(env, { days: 8 }));
  await assert.rejects(funnelStats(env, { days: 0 }));
  assert.equal(fetches(), 0);
});

test('empty measurement is explicitly not a historic zero or deployment proof', async () => {
  const stats = await funnelStats(namespaceHarness().env, { now: NOW });
  assert.equal(stats.ordinary.successful_business_call, 0);
  assert.match(stats.coverage, /Empty counters do not prove deployment/);
  assert.match(stats.interpretation, /unmarked, not human or customer/);
  assert.match(stats.limitations, /not full traffic capture/);
});

test('real SDK HTTP envelopes: only successful business calls receive an upgrade and observation', async () => {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { WebStandardStreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js');
  const { env } = namespaceHarness();
  const rows = [
    ['business_ok', true], ['business_refused', false], ['business_throws', false],
    ['license_status', false], ['does_not_exist', false],
  ];
  for (const [name, expected] of rows) {
    const server = new McpServer({ name: 'r37-instrument-control', version: '1.0.0' });
    server.registerTool('business_ok', { inputSchema: {} }, async () => ({ content: [{ type: 'text', text: 'private business result' }] }));
    server.registerTool('business_refused', { inputSchema: {} }, async () => ({ content: [{ type: 'text', text: 'Error: Pro feature' }], isError: true }));
    server.registerTool('business_throws', { inputSchema: {} }, async () => { throw new Error('private failure'); });
    server.registerTool('license_status', { inputSchema: {} }, async () => ({ content: [{ type: 'text', text: 'free' }] }));
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
      const input = body(request(name));
      const result = await transport.handleRequest(new Request('https://mcp.zovo.one/mcp/control', {
        method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: input,
      }));
      const output = await result.text();
      const upgraded = appendSuccessUpgrade(input, output, 'Upgrade control link', result.status);
      assert.equal(upgraded.appended, expected, name);
      assert.equal(successfulBusinessResponse(input, output, result.status), expected, name);
      if (expected) await recordFunnelEvent(env, { server: 'invoice', source: 'guide', cohort: 'probe', event: 'successful_business_call' }, NOW);
    } finally {
      await transport.close();
      await server.close();
    }
  }
  const stats = await funnelStats(env, { now: NOW });
  assert.equal(stats.probe.successful_business_call, 1);
  assert.equal(stats.ordinary.successful_business_call, 0);
  assert.equal(body(stats).includes('private business result'), false);
  assert.equal(body(stats).includes('private failure'), false);
  assert.equal(body(stats).includes('private_input'), false);
});
