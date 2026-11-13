import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { funnelStats, saveMintCohort } from '../src/funnel.js';
import { namespaceHarness } from './funnel-harness.mjs';

const ORIGIN = 'https://mcp.zovo.one';
const TOKEN = 'anon_' + 'a'.repeat(32);
const SESSION = 'cs_test_synthetic_funnel_review';
const CHECKOUT = 'https://checkout.stripe.com/synthetic-funnel-review';
const POST_HEADERS = {
  accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded',
  origin: ORIGIN, 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document',
};

// Calls the actual billing router. Every outbound fetch is intercepted, including
// unexpected ones; no test can create a real payment session or contact a service.
function fixture(t, { stripeFails = false } = {}) {
  const namespace = namespaceHarness();
  const values = new Map();
  const pending = [];
  const stripeCalls = [];
  const metricErrors = [];
  const kv = {
    get: async (key) => values.get(key) ?? null,
    put: async (key, value) => { values.set(key, value); },
  };
  const env = { ...namespace.env, REMOTE_DATA: kv, STRIPE_SECRET_KEY: 'synthetic-test-value' };
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', (value) => { metricErrors.push(value); });
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://api.stripe.com', 'unexpected outbound service');
    assert.match(parsed.pathname, /^\/v1\/checkout\/sessions(?:\/cs_test_synthetic_funnel_review)?$/);
    stripeCalls.push({ method: options.method, path: parsed.pathname });
    if (stripeFails) return Response.json({ error: { message: 'synthetic checkout failure' } }, { status: 503 });
    return Response.json({ id: SESSION, url: CHECKOUT, metadata: { product: 'invoice' },
      payment_status: 'unpaid', status: 'open' });
  });
  return {
    ...namespace, env, values, kv, stripeCalls, metricErrors,
    async call(path, { method = 'GET', headers = {}, body } = {}) {
      const response = await worker.fetch(new Request(ORIGIN + path, { method, headers, body }), env,
        { waitUntil: (promise) => { pending.push(promise); } });
      while (pending.length) await Promise.all(pending.splice(0));
      return response;
    },
    stats: () => funnelStats(env),
  };
}

const handoffs = (stats, cohort = 'ordinary') => stats[cohort].checkout_handoff;

test('only an actual GET offer records a view; HEAD and unknown products cannot inflate it', async (t) => {
  const f = fixture(t);
  assert.equal((await f.call('/buy/invoice?acq=store.product', { method: 'HEAD' })).status, 200);
  assert.equal((await f.stats()).ordinary.offer_view, 0);
  assert.equal((await f.call('/buy/unknown-product')).status, 404);
  assert.equal((await f.stats()).ordinary.offer_view, 0);
  const response = await f.call('/buy/invoice?acq=store.product');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Continue to Stripe/);
  assert.equal((await f.stats()).ordinary.offer_view, 1);
  assert.equal(f.stripeCalls.length, 0, 'viewing an offer must never contact Stripe');
});

test('explicit acquisition and known first-party source declarations reach the actual offer counters', async (t) => {
  const f = fixture(t);
  for (const [query, source] of [
    ['acq=github&src=store.s.invoice', 'github'],
    ['src=store.s.invoice', 'store.product'],
    ['src=store.guide.duplicate-demo', 'guide'],
  ]) {
    const response = await f.call('/buy/invoice?' + query);
    assert.equal(response.status, 200);
    const html = await response.text();
    const formAction = html.match(/<form method="post" action="([^"]+)"/)?.[1];
    const bundleHref = html.match(/href="(\/buy\/bundle\?[^"]+)"/)?.[1];
    assert.ok(formAction, 'offer must render a checkout form');
    assert.ok(bundleHref, 'offer must render the bundle alternative');
    for (const target of [formAction, bundleHref]) {
      const next = new URL(target.replaceAll('&amp;', '&'), ORIGIN);
      assert.equal(next.searchParams.get('acq'), source, 'next-stage link preserves bounded acquisition');
    }
    const stats = await f.stats();
    assert.equal(stats.rows.find((row) => row.event === 'offer_view' && row.source === source)?.count, 1);
  }
  assert.equal(f.stripeCalls.length, 0);
});

test('stored anonymous provenance wins over query labels; missing sidecars stay unmeasured', async (t) => {
  const f = fixture(t);
  assert.equal((await f.call('/buy/invoice?tenant=' + TOKEN + '&acq=github')).status, 200);
  assert.equal((await f.stats()).ordinary.offer_view, 0);
  await saveMintCohort(f.kv, TOKEN, new Request(ORIGIN + '/mcp/token?acq=guide'));
  await f.call('/buy/invoice?tenant=' + TOKEN + '&acq=github&src=store.s.invoice');
  const stats = await f.stats();
  assert.equal(stats.ordinary.offer_view, 1);
  assert.equal(stats.rows.find((row) => row.event === 'offer_view').source, 'guide');
  assert.equal(JSON.stringify(stats).includes(TOKEN), false);
});

test('unknown acquisition/source input never becomes a stored or exported label', async (t) => {
  const f = fixture(t);
  const unknown = 'private-review-value@example.invalid';
  await f.call('/buy/invoice?acq=' + encodeURIComponent(unknown) + '&src=' + encodeURIComponent(unknown));
  await f.call('/buy/invoice?acq=' + encodeURIComponent(unknown) + '&src=store.s.invoice');
  await f.call('/buy/invoice?src=' + encodeURIComponent(unknown));
  const stats = await f.stats();
  assert.equal(stats.ordinary.offer_view, 3);
  assert.equal(stats.rows[0].source, 'unattributed');
  const stored = [...f.objects.values()].flatMap((object) => [...object.values()]);
  assert.equal(JSON.stringify(stored).includes(unknown), false);
  assert.equal(JSON.stringify(stats).includes(unknown), false);
});

test('valid POST records a handoff only after creating a checkout redirect', async (t) => {
  const f = fixture(t);
  const response = await f.call('/buy/invoice?acq=guide', {
    method: 'POST', headers: POST_HEADERS, body: 'intent=checkout',
  });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), CHECKOUT);
  assert.deepEqual(f.stripeCalls.map((call) => call.method), ['POST']);
  assert.equal(handoffs(await f.stats()), 1);
});

test('an explicitly resumed checkout records its redirect without creating a new session', async (t) => {
  const f = fixture(t);
  const response = await f.call('/buy/invoice?acq=guide&session_id=' + SESSION, {
    method: 'POST', headers: POST_HEADERS, body: 'intent=checkout',
  });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), CHECKOUT);
  assert.deepEqual(f.stripeCalls.map((call) => call.method), ['GET']);
  assert.equal(handoffs(await f.stats()), 1);
});

test('a cached explicit probe redirect records only the probe cohort and makes no Stripe call', async (t) => {
  // Default (2026-11-13 Stripe account guard): an explicit probe never reaches Stripe or the
  // probe cache, and records no handoff in either cohort.
  const g = fixture(t);
  g.values.set('probe-session:v2:invoice', JSON.stringify({ url: CHECKOUT, headers: {} }));
  const guarded = await g.call('/buy/invoice?acq=guide', {
    method: 'POST', headers: { ...POST_HEADERS, 'x-mcp-probe': '1' }, body: 'intent=checkout',
  });
  assert.equal(guarded.status, 303);
  assert.equal(guarded.headers.get('x-mcp-buy'), 'probe-no-live-session');
  assert.notEqual(guarded.headers.get('location'), CHECKOUT);
  assert.equal(g.stripeCalls.length, 0);
  const gStats = await g.stats();
  assert.equal(handoffs(gStats, 'probe'), 0);
  assert.equal(handoffs(gStats), 0);

  // With the owner-approved override, a cached probe Session is reused.
  const f = fixture(t);
  f.env.ALLOW_LIVE_PROBE_SESSIONS = '1';
  f.values.set('probe-session:v2:invoice', JSON.stringify({ url: CHECKOUT, headers: {} }));
  const response = await f.call('/buy/invoice?acq=guide', {
    method: 'POST', headers: { ...POST_HEADERS, 'x-mcp-probe': '1' }, body: 'intent=checkout',
  });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('x-mcp-buy'), 'probe-session-reused');
  assert.equal(f.stripeCalls.length, 0);
  const stats = await f.stats();
  assert.equal(handoffs(stats, 'probe'), 1);
  assert.equal(handoffs(stats), 0);
});

test('invalid intent and scripted POST redirects do not become checkout handoffs', async (t) => {
  const f = fixture(t);
  assert.equal((await f.call('/buy/invoice', {
    method: 'POST', headers: POST_HEADERS, body: 'intent=invalid',
  })).status, 400);
  const scripted = await f.call('/buy/invoice', { method: 'POST', body: 'intent=checkout' });
  assert.equal(scripted.status, 303);
  assert.equal(scripted.headers.get('x-mcp-buy'), 'scripted-ua-no-session');
  assert.equal(f.stripeCalls.length, 0);
  assert.equal(handoffs(await f.stats()), 0);
});

test('failed checkout creation cannot increment a handoff', async (t) => {
  const f = fixture(t, { stripeFails: true });
  const response = await f.call('/buy/invoice', { method: 'POST', headers: POST_HEADERS, body: 'intent=checkout' });
  assert.equal(response.status, 502);
  assert.equal(f.stripeCalls.length, 1);
  assert.equal(handoffs(await f.stats()), 0);
});

test('counter unavailability cannot fail a successful purchase redirect', async (t) => {
  const f = fixture(t);
  f.unavailable.add('funnel:v2:' + new Date().toISOString().slice(0, 10));
  const response = await f.call('/buy/invoice', { method: 'POST', headers: POST_HEADERS, body: 'intent=checkout' });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), CHECKOUT);
  assert.equal(f.stripeCalls.length, 1);
  assert.equal(f.metricErrors.length, 1);
  assert.equal(f.fetches(), 2, 'one bounded retry uses the same observation');
  f.unavailable.clear();
  assert.equal(handoffs(await f.stats()), 0);
});

test('public stats uses exactly seven object requests and exposes null totals when any day is unavailable', async (t) => {
  const f = fixture(t);
  f.unavailable.add('funnel:v2:' + new Date().toISOString().slice(0, 10));
  const response = await f.call('/stats/funnel?days=999999');
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const stats = await response.json();
  assert.equal(stats.complete, false);
  assert.equal(stats.ordinary, null);
  assert.equal(stats.probe, null);
  assert.deepEqual(stats.rows, []);
  assert.equal(stats.window.utc_dates.length, 7);
  assert.equal(f.fetches(), 7);
  assert.equal(f.stripeCalls.length, 0);
});
