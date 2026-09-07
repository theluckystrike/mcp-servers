#!/usr/bin/env node
/**
 * scripts/traffic.mjs — organic-traffic instrument for mcp.zovo.one
 *
 * Channel 1 (WORKING): Cloudflare GraphQL Analytics API (free, no paid tier used).
 *   POST https://api.cloudflare.com/client/v4/graphql
 *   Auth: env CLOUDFLARE_API_TOKEN (or CF_API_TOKEN).
 *
 * Channel 2 (DOWN): Google Search Console. The service-account key at
 *   ~/Desktop/keys/gsc-sa-key.json is iCloud-dataless and `brctl download`
 *   does not materialise it. See docs/HUMAN_GATED_PACK.md.
 *
 * Writes: data/traffic.json  (+ data/gsc.json when the GSC key is readable)
 * Never writes zeros for a missing credential — it throws.
 *
 * Usage:
 *   node scripts/traffic.mjs              # 7d window (Cloudflare retention cap)
 *   node scripts/traffic.mjs --days 3
 *   node scripts/traffic.mjs --no-gsc
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GQL = 'https://api.cloudflare.com/client/v4/graphql';
const ZONE_NAME = process.env.CF_ZONE_NAME || 'zovo.one';
const HOST = process.env.MCP_HOST || 'mcp.zovo.one';
const OPERATOR_COUNTRY = process.env.OPERATOR_COUNTRY || 'PL'; // the machine this repo runs on
const SITEMAP = `https://${HOST}/sitemap.xml`;
const GSC_KEY = process.env.GSC_KEY || `${process.env.HOME}/Desktop/keys/gsc-sa-key.json`;
const GSC_SITE = process.env.GSC_SITE || 'sc-domain:zovo.one';

const argv = process.argv.slice(2);
const DAYS = Number((argv.find(a => a.startsWith('--days')) || '').split('=')[1]
  || (argv.includes('--days') ? argv[argv.indexOf('--days') + 1] : 0)) || 7;
const SKIP_GSC = argv.includes('--no-gsc');

function die(msg) { console.error(`\n[traffic.mjs] FATAL: ${msg}\n`); process.exit(2); }

const TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
if (!TOKEN) {
  die('no Cloudflare credential. Set CLOUDFLARE_API_TOKEN (a token with '
    + 'Zone:Analytics:Read on ' + ZONE_NAME + '). Refusing to write zeros to data/traffic.json.');
}

// ---------------------------------------------------------------- helpers
async function cfREST(p) {
  const r = await fetch(`https://api.cloudflare.com/client/v4${p}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const j = await r.json();
  if (!j.success) die(`Cloudflare REST ${p} failed: ${JSON.stringify(j.errors)}`);
  return j.result;
}

const QUERIES = {}; // name -> the exact GraphQL sent, so every figure can cite it

async function gql(name, query) {
  QUERIES[name] = query.replace(/\s+/g, ' ').trim();
  const r = await fetch(GQL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const j = await r.json();
  if (j.errors && j.errors.length) {
    die(`GraphQL query "${name}" failed: ${JSON.stringify(j.errors).slice(0, 500)}`);
  }
  return j.data.viewer.zones[0];
}

const iso = d => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

// ------------------------------------------------------- UA classification
// Deliberately explicit so the numbers are auditable. Order matters.
const SEARCH_AI_CRAWLERS = [
  ['Googlebot', /Googlebot/i], ['Google-Extended', /Google-Extended/i],
  ['GoogleOther', /GoogleOther/i], ['Google-CloudVertexBot', /Google-CloudVertexBot/i],
  ['Google-InspectionTool', /Google-InspectionTool/i],
  ['bingbot', /bingbot|BingPreview|MicrosoftPreview/i],
  ['GPTBot', /GPTBot/i], ['OAI-SearchBot', /OAI-SearchBot/i], ['ChatGPT-User', /ChatGPT-User/i],
  ['ClaudeBot', /ClaudeBot/i], ['Claude-User', /Claude-User|Claude-SearchBot|anthropic-ai/i],
  ['PerplexityBot', /PerplexityBot|Perplexity-User/i],
  ['Amazonbot', /Amazonbot/i], ['Applebot', /Applebot/i],
  ['DuckDuckBot', /DuckDuckBot|DuckAssistBot/i], ['YandexBot', /Yandex/i],
  ['Baiduspider', /Baiduspider/i], ['Bytespider', /Bytespider|TikTokSpider/i],
  ['meta-externalagent', /meta-externalagent|facebookexternalhit|FacebookBot/i],
  ['CCBot', /CCBot/i], ['cohere-ai', /cohere-ai|cohere-training/i],
  ['MistralAI-User', /MistralAI/i], ['YouBot', /YouBot/i],
  ['Diffbot', /Diffbot/i], ['ImagesiftBot', /ImagesiftBot/i],
  ['Timpibot', /Timpibot/i], ['omgili', /omgili/i], ['Kagi', /Kagibot|Kagi/i],
  ['AhrefsBot', /AhrefsBot/i], ['SemrushBot', /SemrushBot/i], ['MJ12bot', /MJ12bot/i],
  ['DotBot', /DotBot/i], ['DataForSeoBot', /DataForSeoBot/i], ['Barkrowler', /Barkrowler/i],
  ['PetalBot', /PetalBot/i], ['SeekportBot', /Seekport/i],
];
// Which of the above actually feed a search index or an LLM answer surface.
const INDEXING = new Set(['Googlebot', 'Google-Extended', 'GoogleOther', 'Google-CloudVertexBot',
  'Google-InspectionTool', 'bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot',
  'Claude-User', 'PerplexityBot', 'Amazonbot', 'Applebot', 'DuckDuckBot', 'YandexBot',
  'Baiduspider', 'Bytespider', 'meta-externalagent', 'CCBot', 'cohere-ai', 'MistralAI-User',
  'YouBot', 'Kagi', 'PetalBot', 'SeekportBot', 'Diffbot', 'Timpibot', 'omgili', 'ImagesiftBot']);

const SCRIPTED = /^(node|undici|curl\/|Wget|Go-http-client|python-|python$|aiohttp|requests\/|httpx|okhttp|axios|Java\/|Apache-HttpClient|GuzzleHttp|Bun\/|Deno\/|libwww|PostmanRuntime|insomnia|got \(|Faraday|Ruby|HTTPie|reqwest|hyper\/|nginx-ssl|claude-code\/|codex|cline|openai-python|@modelcontextprotocol)/i;
const PROBEY = /(bot|crawler|spider|probe|scan|monitor|registry|health|liveness|audit|census|collector|research|validator|check|watch|uptime|pinger|beat|observatory|explorer|indexer|fetcher|scraper|archiver|agent-|-agent\b)/i;
const BROWSERY = /^Mozilla\/5\.0 \((Windows NT|Macintosh;|X11;|iPhone;|iPad;|Linux; Android|Android)/;
const BROWSER_ENGINE = /(Chrome\/\d|Safari\/\d|Firefox\/\d|Edg\/\d|OPR\/\d|Version\/\d.*Safari)/;
const HEADLESS = /(HeadlessChrome|PhantomJS|Chrome-Lighthouse|Google Page Speed|Screaming Frog|SiteAudit|puppeteer|playwright|Selenium)/i;
// A real rendering engine auto-fetches these. A scraper with a spoofed browser UA does not.
// This is the only render-engine proof available without Bot Management (botScore is ENT-only:
// measured error `zone ... does not have access to the field 'botscore'`).
const RENDER_PROOF = /^\/(cdn-cgi\/|favicon\.ico|assets\/|apple-touch-icon)/;

function classify(ua) {
  if (!ua) return { klass: 'unknown-empty-ua', crawler: null };
  for (const [name, re] of SEARCH_AI_CRAWLERS) {
    if (re.test(ua)) return { klass: INDEXING.has(name) ? 'search_ai_crawler' : 'seo_crawler', crawler: name };
  }
  if (HEADLESS.test(ua)) return { klass: 'headless_tool', crawler: null };
  if (BROWSERY.test(ua) && BROWSER_ENGINE.test(ua) && !PROBEY.test(ua)) {
    return { klass: 'human_browser', crawler: null };
  }
  if (SCRIPTED.test(ua)) return { klass: 'scripted_client', crawler: null };
  if (PROBEY.test(ua)) return { klass: 'other_bot_probe', crawler: null };
  return { klass: 'unclassified', crawler: null };
}

// ---------------------------------------------------------------- sitemap
async function sitemapPaths() {
  const r = await fetch(SITEMAP, { headers: { 'User-Agent': 'mcp-servers/traffic.mjs' } });
  if (!r.ok) die(`sitemap fetch ${SITEMAP} -> HTTP ${r.status}`);
  const xml = await r.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
  if (!locs.length) die(`sitemap ${SITEMAP} parsed to 0 <loc> entries`);
  return locs.map(u => { try { return new URL(u).pathname; } catch { return null; } }).filter(Boolean);
}

// ---------------------------------------------------------------- main CF pull
async function cloudflare() {
  const zones = await cfREST(`/zones?name=${encodeURIComponent(ZONE_NAME)}`);
  if (!zones.length) die(`zone ${ZONE_NAME} not visible to this token`);
  const zone = zones[0];
  const end = new Date(Math.floor(Date.now() / 1000) * 1000);
  const start = new Date(end.getTime() - DAYS * 86400e3);
  const S = iso(start), E = iso(end);
  const F = `datetime_geq: "${S}", datetime_leq: "${E}", clientRequestHTTPHost: "${HOST}"`;

  const q = (dims, extra = '', limit = 10000) => `query { viewer { zones(filter: {zoneTag: "${zone.id}"}) {
    httpRequestsAdaptiveGroups(limit: ${limit}, orderBy: [count_DESC], filter: {${F}}) {
      count ${extra} dimensions { ${dims} } } } } }`;

  const pathUA = (await gql('cf_path_x_useragent_x_country',
    q('clientRequestPath userAgent clientCountryName', 'sum { visits edgeResponseBytes } avg { sampleInterval }')
  )).httpRequestsAdaptiveGroups;
  if (pathUA.length >= 10000) {
    die('cf_path_x_useragent_x_country hit the 10000-row cap — the grouping is saturated and '
      + 'every per-path figure would be under-counted. Split the window by day and re-run.');
  }

  const byCountry = (await gql('cf_country', q('clientCountryName', '', 250)))
    .httpRequestsAdaptiveGroups;
  const byReferer = (await gql('cf_referer_host', q('clientRefererHost', '', 500)))
    .httpRequestsAdaptiveGroups;
  const byStatus = (await gql('cf_status', q('edgeResponseStatus', '', 100)))
    .httpRequestsAdaptiveGroups;
  const totals = (await gql('cf_totals', `query { viewer { zones(filter: {zoneTag: "${zone.id}"}) {
    httpRequestsAdaptiveGroups(limit: 1, filter: {${F}}) {
      count sum { visits edgeResponseBytes } avg { sampleInterval } } } } }`)
  ).httpRequestsAdaptiveGroups[0];

  // zone-wide daily, 30d — the only 30d dataset this plan retains (no host dim)
  const d0 = new Date(end.getTime() - 30 * 86400e3).toISOString().slice(0, 10);
  const d1 = end.toISOString().slice(0, 10);
  const daily = (await gql('cf_zone_daily_30d',
    `query { viewer { zones(filter: {zoneTag: "${zone.id}"}) {
      httpRequests1dGroups(limit: 40, orderBy: [date_ASC], filter: {date_geq: "${d0}", date_leq: "${d1}"}) {
        dimensions { date } sum { requests pageViews bytes } uniq { uniques } } } } }`)
  ).httpRequests1dGroups;

  return { zone, window: { start: S, end: E, days: DAYS }, pathUA, byCountry, byReferer, byStatus, totals, daily };
}

// ---------------------------------------------------------------- GSC
function gscKeyReadable() {
  // `wc -c` answers from stat() and CANNOT detect an iCloud-dataless file.
  try {
    const ls = execFileSync('/bin/ls', ['-lO', GSC_KEY], { encoding: 'utf8', timeout: 5000 });
    if (/dataless/.test(ls)) return { ok: false, why: 'iCloud-dataless (ls -lO shows "dataless")' };
  } catch { return { ok: false, why: 'key file not present' }; }
  // NOTE: `wc -c` cannot detect a dataless file (it answers from stat()). A bounded
  // /bin/cat is the only honest probe: on a dataless file it hangs and the timeout fires.
  try {
    const buf = execFileSync('/bin/cat', [GSC_KEY], { timeout: 8000, maxBuffer: 1 << 20 });
    JSON.parse(buf.toString('utf8'));
    return { ok: true };
  } catch (e) {
    return { ok: false, why: `read of key blocked/hung or unparseable (${e.code || e.message})` };
  }
}

async function gsc() {
  const st = gscKeyReadable();
  if (!st.ok) {
    return { channel: 'google_search_console', status: 'DOWN', reason: st.why, key_path: GSC_KEY,
      human_step: 'see docs/HUMAN_GATED_PACK.md', rows: null };
  }
  // Key readable: mint a JWT and pull 28d page+query for GSC_SITE.
  const crypto = await import('node:crypto');
  const k = JSON.parse(fs.readFileSync(GSC_KEY, 'utf8'));
  const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: k.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claim)}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(k.private_key).toString('base64url');
  const tr = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${sig}` }),
  })).json();
  if (!tr.access_token) die(`GSC token exchange failed: ${JSON.stringify(tr).slice(0, 300)}`);
  const H = { Authorization: `Bearer ${tr.access_token}`, 'Content-Type': 'application/json' };
  const sites = await (await fetch('https://www.googleapis.com/webmasters/v3/sites', { headers: H })).json();
  const owned = (sites.siteEntry || []).map(s => s.siteUrl);
  if (!owned.includes(GSC_SITE)) {
    return { channel: 'google_search_console', status: 'PROPERTY_MISSING',
      reason: `${GSC_SITE} is not among the ${owned.length} verified properties`, properties: owned, rows: null };
  }
  const end = new Date(Date.now() - 3 * 86400e3).toISOString().slice(0, 10);
  const start = new Date(Date.now() - 31 * 86400e3).toISOString().slice(0, 10);
  const enc = encodeURIComponent(GSC_SITE);
  const pull = async dims => (await (await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${enc}/searchAnalytics/query`,
    { method: 'POST', headers: H, body: JSON.stringify({ startDate: start, endDate: end,
      dimensions: dims, rowLimit: 25000, dataState: 'final' }) })).json()).rows || [];
  const page = await pull(['page']);
  const qp = await pull(['query', 'page']);
  // Control probe: ask Google DIRECTLY for the host, so a zero cannot be an artefact of
  // the page-dimension row cap or of my own client-side filtering.
  const filtered = async dims => (await (await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${enc}/searchAnalytics/query`,
    { method: 'POST', headers: H, body: JSON.stringify({ startDate: start, endDate: end,
      dimensions: dims, rowLimit: 25000, dataState: 'final',
      dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains',
        expression: `//${HOST}/` }] }] }) })).json()).rows || [];
  const hostDaily = await filtered(['date']);
  const hostQueries = await filtered(['query']);
  // Positive control: the same shaped query for the host that DOES rank, to prove the
  // filter syntax works and the zero above is real.
  const controlDaily = (await (await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${enc}/searchAnalytics/query`,
    { method: 'POST', headers: H, body: JSON.stringify({ startDate: start, endDate: end,
      dimensions: ['date'], rowLimit: 100, dataState: 'final',
      dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains',
        expression: '//zovo.one/' }] }] }) })).json()).rows || [];
  return { channel: 'google_search_console', status: 'OK', site: GSC_SITE, window: { start, end },
    api: 'POST https://www.googleapis.com/webmasters/v3/sites/'
      + GSC_SITE + '/searchAnalytics/query, dataState:final, rowLimit:25000',
    totals: { clicks: page.reduce((n, r) => n + r.clicks, 0),
      impressions: page.reduce((n, r) => n + r.impressions, 0), page_rows: page.length },
    host_probe: {
      host: HOST,
      filter: `page contains "//${HOST}/"`,
      daily_rows_returned: hostDaily.length,
      days_with_impressions: hostDaily.filter(r => r.impressions > 0).length,
      clicks: hostDaily.reduce((n, r) => n + r.clicks, 0),
      impressions: hostDaily.reduce((n, r) => n + r.impressions, 0),
      queries: hostQueries,
      daily: hostDaily,
      positive_control_zovo_one: { daily_rows_returned: controlDaily.length,
        days_with_impressions: controlDaily.filter(r => r.impressions > 0).length,
        clicks: controlDaily.reduce((n, r) => n + r.clicks, 0),
        impressions: controlDaily.reduce((n, r) => n + r.impressions, 0) },
    },
    page, query_page: qp,
    mcp_pages: page.filter(r => r.keys[0].includes(`//${HOST}`)) };
}

// ---------------------------------------------------------------- assemble
const cf = await cloudflare();
const sitePaths = await sitemapPaths();
const sitemapSet = new Set(sitePaths);

// Pass 1 — which browser-UA strings proved they run a rendering engine.
const renderProven = new Set();
for (const r of cf.pathUA) {
  if (classify(r.dimensions.userAgent).klass === 'human_browser'
      && RENDER_PROOF.test(r.dimensions.clientRequestPath)) {
    renderProven.add(r.dimensions.userAgent);
  }
}

const perPath = new Map();
const crawlerTotals = new Map();
const klassTotals = new Map();
for (const r of cf.pathUA) {
  const p = r.dimensions.clientRequestPath;
  const { klass, crawler } = classify(r.dimensions.userAgent);
  const e = perPath.get(p) || { path: p, total: 0, human: 0, human_verified: 0, search_ai: 0,
    human_verified_ex_operator: 0, seo: 0, scripted: 0, other_bot: 0, unclassified: 0,
    visits: 0, crawlers: {} };
  e.total += r.count;
  e.visits += (r.sum && r.sum.visits) || 0;
  if (klass === 'human_browser') {
    e.human += r.count;
    if (renderProven.has(r.dimensions.userAgent)) {
      e.human_verified += r.count;
      // The operator's own machine is in PL (memory: user residence = Poland) and PL is the
      // single largest source of requests to this zone. Excluding PL gives a floor on
      // genuine third-party humans.
      if (r.dimensions.clientCountryName !== OPERATOR_COUNTRY) e.human_verified_ex_operator += r.count;
    }
  }
  else if (klass === 'search_ai_crawler') { e.search_ai += r.count; e.crawlers[crawler] = (e.crawlers[crawler] || 0) + r.count; }
  else if (klass === 'seo_crawler') { e.seo += r.count; e.crawlers[crawler] = (e.crawlers[crawler] || 0) + r.count; }
  else if (klass === 'scripted_client') e.scripted += r.count;
  else if (klass === 'other_bot_probe' || klass === 'headless_tool') e.other_bot += r.count;
  else e.unclassified += r.count;
  perPath.set(p, e);
  klassTotals.set(klass, (klassTotals.get(klass) || 0) + r.count);
  if (crawler) crawlerTotals.set(crawler, (crawlerTotals.get(crawler) || 0) + r.count);
}

const sitemapRows = sitePaths.map(p => perPath.get(p)
  || { path: p, total: 0, human: 0, human_verified: 0, human_verified_ex_operator: 0,
       search_ai: 0, seo: 0, scripted: 0, other_bot: 0, unclassified: 0, visits: 0, crawlers: {} });

// How many of the sitemap URLs each named crawler actually fetched — the indexation number.
const crawlerCoverage = {};
for (const r of sitemapRows) {
  for (const [name, n] of Object.entries(r.crawlers)) {
    const e = crawlerCoverage[name] || (crawlerCoverage[name] = { urls_fetched: 0, requests: 0 });
    e.urls_fetched++; e.requests += n;
  }
}

const cov = {
  sitemap_urls: sitePaths.length,
  fetched_by_any_client: sitemapRows.filter(r => r.total > 0).length,
  fetched_by_search_or_ai_crawler: sitemapRows.filter(r => r.search_ai > 0).length,
  fetched_by_any_crawler_incl_seo: sitemapRows.filter(r => r.search_ai + r.seo > 0).length,
  fetched_by_human_browser_ua_loose: sitemapRows.filter(r => r.human > 0).length,
  fetched_by_render_proven_browser_strict: sitemapRows.filter(r => r.human_verified > 0).length,
  fetched_by_render_proven_browser_excl_operator_country:
    sitemapRows.filter(r => r.human_verified_ex_operator > 0).length,
  never_fetched_at_all: sitemapRows.filter(r => r.total === 0).length,
  // Page views, not requests: these rows are sitemap HTML URLs only, so favicon/cdn-cgi
  // render-proof fetches are already excluded.
  human_page_views_render_proven: sitemapRows.reduce((n, r) => n + r.human_verified, 0),
  human_page_views_render_proven_excl_operator_country:
    sitemapRows.reduce((n, r) => n + r.human_verified_ex_operator, 0),
  human_page_views_excl_homepage_and_operator:
    sitemapRows.filter(r => r.path !== '/').reduce((n, r) => n + r.human_verified_ex_operator, 0),
  sitemap_urls_with_human_page_view_excl_homepage:
    sitemapRows.filter(r => r.path !== '/' && r.human_verified_ex_operator > 0).length,
};

const out = {
  generated_at: new Date().toISOString(),
  host: HOST,
  channels: { cloudflare_graphql: 'WORKING', google_search_console: null },
  cloudflare: {
    zone: { name: cf.zone.name, id: cf.zone.id, plan: cf.zone.plan && cf.zone.plan.name,
      account: cf.zone.account && cf.zone.account.id },
    window: cf.window,
    retention_note: 'httpRequestsAdaptiveGroups on this Pro zone refuses data older than 1w1d '
      + '(measured: query at -14d returns extensions.code=quota, "cannot request data older than 1w1d"). '
      + 'A 30-day per-path pull is IMPOSSIBLE on this plan. httpRequests1dGroups retains 30d but has no host dimension.',
    sampling: { avg_sample_interval: cf.totals.avg.sampleInterval,
      note: 'count is the sample-adjusted request estimate returned by the adaptive dataset.' },
    totals: { requests: cf.totals.count, visits: cf.totals.sum.visits,
      edge_response_bytes: cf.totals.sum.edgeResponseBytes },
    by_class: Object.fromEntries([...klassTotals.entries()].sort((a, b) => b[1] - a[1])),
    by_crawler: Object.fromEntries([...crawlerTotals.entries()].sort((a, b) => b[1] - a[1])),
    top_countries: cf.byCountry.slice(0, 20).map(r => ({ country: r.dimensions.clientCountryName, requests: r.count })),
    top_referer_hosts: cf.byReferer.slice(0, 25).map(r => ({ referer_host: r.dimensions.clientRefererHost || '(none)', requests: r.count })),
    by_status: cf.byStatus.map(r => ({ status: r.dimensions.edgeResponseStatus, requests: r.count })),
    zone_wide_daily_30d: cf.daily.map(r => ({ date: r.dimensions.date, requests: r.sum.requests,
      page_views: r.sum.pageViews, uniques: r.uniq.uniques })),
    robots_and_sitemap: ['/robots.txt', '/sitemap.xml', '/llms.txt'].map(p => {
      const e = perPath.get(p);
      return { path: p, requests: e ? e.total : 0, search_ai_crawler: e ? e.search_ai : 0,
        crawlers: e ? e.crawlers : {} };
    }),
    section_rollup: (() => {
      const secs = {};
      for (const r of sitemapRows) {
        const k = '/' + (r.path.split('/')[1] || '(root)');
        const s = secs[k] || (secs[k] = { urls: 0, requests: 0, human: 0, human_verified: 0,
          human_verified_ex_operator: 0, search_ai: 0, urls_with_human: 0,
          urls_with_human_verified: 0, urls_with_human_verified_ex_operator: 0, urls_with_crawler: 0 });
        s.urls++; s.requests += r.total; s.human += r.human; s.human_verified += r.human_verified;
        s.human_verified_ex_operator += r.human_verified_ex_operator;
        if (r.human_verified_ex_operator > 0) s.urls_with_human_verified_ex_operator++;
        s.search_ai += r.search_ai;
        if (r.human > 0) s.urls_with_human++;
        if (r.human_verified > 0) s.urls_with_human_verified++;
        if (r.search_ai > 0) s.urls_with_crawler++;
      }
      return secs;
    })(),
    non_sitemap_top_paths: [...perPath.values()].filter(r => !sitemapSet.has(r.path))
      .sort((a, b) => b.total - a.total).slice(0, 25),
  },
  sitemap_coverage: cov,
  crawler_url_coverage: Object.fromEntries(Object.entries(crawlerCoverage)
    .sort((a, b) => b[1].urls_fetched - a[1].urls_fetched)
    .map(([k, v]) => [k, { ...v, pct_of_312: +(100 * v.urls_fetched / sitePaths.length).toFixed(1) }])),
  sitemap_pages: sitemapRows.sort((a, b) => b.human_verified_ex_operator - a.human_verified_ex_operator
    || b.human_verified - a.human_verified || b.human - a.human || b.total - a.total),
  human_evidence: {
    render_proof_paths: String(RENDER_PROOF),
    browser_ua_strings_seen: [...new Set(cf.pathUA.filter(r => classify(r.dimensions.userAgent).klass === 'human_browser').map(r => r.dimensions.userAgent))].length,
    browser_ua_strings_render_proven: renderProven.size,
    requests_human_ua_loose: [...perPath.values()].reduce((n, r) => n + r.human, 0),
    requests_render_proven: [...perPath.values()].reduce((n, r) => n + r.human_verified, 0),
    requests_render_proven_excl_operator_country:
      [...perPath.values()].reduce((n, r) => n + r.human_verified_ex_operator, 0),
    operator_country_excluded: OPERATOR_COUNTRY,
  },
  queries: QUERIES,
  classification_rules: {
    human_browser: String(BROWSERY) + ' AND ' + String(BROWSER_ENGINE) + ' AND NOT ' + String(PROBEY),
    scripted_client: String(SCRIPTED),
    other_bot_probe: String(PROBEY),
    search_ai_crawler: [...INDEXING].join(', '),
    human_verified: 'human_browser UA that ALSO fetched ' + String(RENDER_PROOF)
      + ' somewhere in the window (proves a real rendering engine ran).',
  },
};

if (!SKIP_GSC) {
  const g = await gsc();
  out.channels.google_search_console = g.status;
  fs.writeFileSync(path.join(ROOT, 'data/gsc.json'), JSON.stringify(g, null, 2) + '\n');
  console.error(`[traffic.mjs] GSC channel: ${g.status}${g.reason ? ' — ' + g.reason : ''}`);
} else {
  out.channels.google_search_console = 'SKIPPED';
}

fs.writeFileSync(path.join(ROOT, 'data/traffic.json'), JSON.stringify(out, null, 2) + '\n');
console.error(`[traffic.mjs] wrote data/traffic.json — ${cov.sitemap_urls} sitemap URLs, `
  + `${cov.fetched_by_search_or_ai_crawler} crawled by a search/AI bot, `
  + `${cov.fetched_by_human_browser_ua_loose} touched by a browser UA (loose), `
  + `${cov.fetched_by_render_proven_browser_strict} by a render-proven browser (strict), over ${DAYS}d.`);
