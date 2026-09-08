#!/usr/bin/env node
/**
 * scripts/traffic.mjs — organic-traffic instrument for mcp.zovo.one
 *
 * Channel 1 (WORKING): Cloudflare GraphQL Analytics API (free, no paid tier used).
 *   POST https://api.cloudflare.com/client/v4/graphql
 *   Auth: env CLOUDFLARE_API_TOKEN (or CF_API_TOKEN).
 *
 * Channel 2 (WORKING as of 2026-09-07): Google Search Console, via the service-account
 *   key at ~/Desktop/keys/gsc-sa-key.json. That path is on iCloud Desktop and goes
 *   dataless; the script probes it with a bounded /bin/cat and reports DOWN rather than
 *   writing zeros. See docs/HUMAN_GATED_PACK.md.
 *
 * Writes: data/traffic.json  (+ data/gsc.json when the GSC key is readable)
 * Never writes zeros for a missing credential — it throws.
 *
 * Usage:
 *   node scripts/traffic.mjs              # 7d window (Cloudflare retention cap)
 *   node scripts/traffic.mjs --days 3
 *   node scripts/traffic.mjs --no-gsc
 *   node scripts/traffic.mjs --start 2026-09-07T00:00:00Z --out /tmp/since.json --no-gsc
 *
 * The path x userAgent x country grouping saturates the API's 10,000-row cap over a
 * 7-day window on this host, so it is pulled ONE DAY AT A TIME and summed in-script.
 * The saturation guard is kept: a slice still at the cap is halved and re-pulled, and a
 * sub-hour slice at the cap exits 2 rather than write under-counted per-path numbers.
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
const flag = n => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const START_AT = flag('--start');          // ISO instant; overrides the --days window start
const OUT_FILE = flag('--out') || 'data/traffic.json';   // so a second window can be pulled
const GSC_OUT = flag('--gsc-out') || 'data/gsc.json';    // without clobbering the main extract

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
  const start = START_AT ? new Date(START_AT) : new Date(end.getTime() - DAYS * 86400e3);
  if (Number.isNaN(start.getTime())) die(`--start ${START_AT} is not a valid instant`);
  const S = iso(start), E = iso(end);
  const F = `datetime_geq: "${S}", datetime_leq: "${E}", clientRequestHTTPHost: "${HOST}"`;

  const q = (dims, extra = '', limit = 10000, flt = F) => `query { viewer { zones(filter: {zoneTag: "${zone.id}"}) {
    httpRequestsAdaptiveGroups(limit: ${limit}, orderBy: [count_DESC], filter: {${flt}}) {
      count ${extra} dimensions { ${dims} } } } } }`;

  // ---- path × userAgent × country, pulled ONE DAY AT A TIME -------------------------
  // The whole-window grouping saturates the API's 10,000-row cap on this host, which would
  // silently under-count every per-path figure. The guard below is NOT relaxed: a slice that
  // still saturates is halved and re-pulled, and if a slice under an hour is still at the cap
  // the script dies rather than write under-counted numbers.
  const ROW_CAP = 10000;
  const SLICE_ROWS = [];         // proof: rows returned per slice, all must be < ROW_CAP
  const PATH_UA_DIMS = 'clientRequestPath userAgent clientCountryName';
  const PATH_UA_EXTRA = 'sum { visits edgeResponseBytes } avg { sampleInterval }';

  async function pullPathUASlice(s, e, lastOfWindow, depth = 0) {
    const upper = lastOfWindow ? `datetime_leq: "${e}"` : `datetime_lt: "${e}"`;
    const flt = `datetime_geq: "${s}", ${upper}, clientRequestHTTPHost: "${HOST}"`;
    const label = `cf_path_x_useragent_x_country@${s}..${e}`;
    const rows = (await gql(label, q(PATH_UA_DIMS, PATH_UA_EXTRA, ROW_CAP, flt)))
      .httpRequestsAdaptiveGroups;
    if (rows.length >= ROW_CAP) {
      const ms = Date.parse(e) - Date.parse(s);
      if (ms <= 3600e3 || depth >= 8) {
        die(`cf_path_x_useragent_x_country hit the ${ROW_CAP}-row cap on the slice ${s} → ${e} `
          + `(${Math.round(ms / 60000)} min, already split ${depth} times) — the grouping is saturated `
          + 'and every per-path figure would be under-counted. Narrow the grouping dimensions '
          + '(drop clientCountryName) or shorten --days, and re-run.');
      }
      const mid = iso(new Date(Date.parse(s) + Math.floor(ms / 2)));
      const a = await pullPathUASlice(s, mid, false, depth + 1);
      const b = await pullPathUASlice(mid, e, lastOfWindow, depth + 1);
      return a.concat(b);
    }
    SLICE_ROWS.push({ start: s, end: e, upper_bound: lastOfWindow ? 'leq' : 'lt',
      rows_returned: rows.length, row_cap: ROW_CAP, saturated: false, split_depth: depth });
    for (const r of rows) r._slice = s;   // keeps a per-slice view after aggregation
    return rows;
  }

  // Day boundaries: [S, S+1d), [S+1d, S+2d), … , [S+(n-1)d, E]. Half-open except the last
  // slice, so the union is exactly [S, E] with no request counted twice.
  const spanDays = (end.getTime() - start.getTime()) / 86400e3;
  const nSlices = Math.max(1, Math.ceil(spanDays));
  const stepMs = (end.getTime() - start.getTime()) / nSlices;
  const rawSliceRows = [];
  for (let i = 0; i < nSlices; i++) {
    const s = iso(new Date(start.getTime() + i * stepMs));
    const last = i === nSlices - 1;
    const e = last ? E : iso(new Date(start.getTime() + (i + 1) * stepMs));
    rawSliceRows.push(...await pullPathUASlice(s, e, last));
  }

  // Aggregate the daily slices back into one whole-window grouping, summing counts and
  // volumes per (path, userAgent, country) and weighting sampleInterval by request count.
  const agg = new Map();
  for (const r of rawSliceRows) {
    const d = r.dimensions;
    const k = [d.clientRequestPath, d.userAgent, d.clientCountryName].join(" |UA| ");
    let e = agg.get(k);
    if (!e) {
      e = { count: 0, sum: { visits: 0, edgeResponseBytes: 0 }, avg: { sampleInterval: 0 },
        dimensions: { clientRequestPath: d.clientRequestPath, userAgent: d.userAgent,
          clientCountryName: d.clientCountryName }, _si: 0 };
      agg.set(k, e);
    }
    e.count += r.count;
    e.sum.visits += (r.sum && r.sum.visits) || 0;
    e.sum.edgeResponseBytes += (r.sum && r.sum.edgeResponseBytes) || 0;
    e._si += ((r.avg && r.avg.sampleInterval) || 1) * r.count;
  }
  const pathUA = [...agg.values()].map(e => {
    e.avg.sampleInterval = e.count ? e._si / e.count : 1; delete e._si; return e;
  }).sort((a, b) => b.count - a.count);
  const sliceProof = { row_cap: ROW_CAP, slices: SLICE_ROWS.sort((a, b) => a.start.localeCompare(b.start)),
    rows_before_aggregation: rawSliceRows.length, rows_after_aggregation: pathUA.length,
    max_rows_in_any_slice: SLICE_ROWS.reduce((m, s) => Math.max(m, s.rows_returned), 0),
    note: 'The whole-window path×UA×country grouping saturates the 10,000-row API cap on this '
      + 'host, so it is pulled one day at a time and summed in-script. Any slice that still hits '
      + 'the cap is halved and re-pulled; a sub-hour slice at the cap aborts the run (exit 2).' };

  const byCountry = (await gql('cf_country', q('clientCountryName', '', 250)))
    .httpRequestsAdaptiveGroups;
  const byReferer = (await gql('cf_referer_host', q('clientRefererHost', '', 500)))
    .httpRequestsAdaptiveGroups;
  const byStatus = (await gql('cf_status', q('edgeResponseStatus', '', 100)))
    .httpRequestsAdaptiveGroups;
  // Status per day, so a fix that landed mid-window (e.g. the hosted endpoints that used to
  // answer 401) shows up as a step change instead of being averaged away.
  const statusByDay = (await gql('cf_status_x_date', q('edgeResponseStatus date', '', 2000)))
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

  // Where does this host's granular data ACTUALLY start? The adaptive dataset's retention
  // boundary is not the same as the requested window: on this zone, per-host rows for
  // mcp.zovo.one vanish earlier than the 1w1d the API will accept. Measuring the first hour
  // with data stops a short window being reported as a long one.
  const hourly = (await gql('cf_host_hourly', `query { viewer { zones(filter: {zoneTag: "${zone.id}"}) {
    httpRequestsAdaptiveGroups(limit: 400, orderBy: [datetimeHour_ASC], filter: {${F}}) {
      count dimensions { datetimeHour } } } } }`)).httpRequestsAdaptiveGroups;
  const firstHour = hourly.length ? hourly[0].dimensions.datetimeHour : null;
  const effective = {
    requested_start: S, requested_end: E, requested_days: +spanDays.toFixed(3),
    first_hour_with_host_data: firstHour,
    hours_with_data: hourly.length,
    effective_days: firstHour ? +(((Date.parse(E) - Date.parse(firstHour)) / 86400e3).toFixed(3)) : 0,
    note: firstHour && Date.parse(firstHour) > Date.parse(S) + 3600e3
      ? 'RETENTION SHORTFALL: the adaptive dataset holds no rows for this host before '
        + firstHour + ', although the API accepts the older start and other hosts on the zone '
        + 'do return rows there. Absolute counts cover the effective window, not the requested one.'
      : 'Host data covers the requested window.',
  };

  return { zone, window: { start: S, end: E, days: +spanDays.toFixed(3) }, pathUA, sliceProof,
    rawRows: rawSliceRows,
    effective, hourly: hourly.map(r => ({ hour: r.dimensions.datetimeHour, requests: r.count })),
    byCountry, byReferer, byStatus, statusByDay, totals, daily };
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

// Mints a service-account access token for the Search Console APIs. Returns {ok:false,why}
// rather than a token when the key is unreadable, so callers report DOWN instead of zero.
async function mintGscToken() {
  const st = gscKeyReadable();
  if (!st.ok) return { ok: false, why: st.why };
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
  if (!tr.access_token) return { ok: false, why: `token exchange failed: ${JSON.stringify(tr).slice(0, 300)}` };
  return { ok: true, token: tr.access_token, client_email: k.client_email };
}

async function gsc() {
  const tok = await mintGscToken();
  if (!tok.ok) {
    return { channel: 'google_search_console', status: 'DOWN', reason: tok.why, key_path: GSC_KEY,
      human_step: 'see docs/HUMAN_GATED_PACK.md', rows: null };
  }
  const H = { Authorization: `Bearer ${tok.token}`, 'Content-Type': 'application/json' };
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
  const hostPages = await filtered(['page']);   // indexation: which URLs have EVER had an impression
  // "Ever" probe: GSC retains 16 months. Same filter, widest window the API allows, so a page
  // that earned an impression before the 28d window still shows up.
  const everStart = new Date(Date.now() - 480 * 86400e3).toISOString().slice(0, 10);
  const hostPagesEver = (await (await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${enc}/searchAnalytics/query`,
    { method: 'POST', headers: H, body: JSON.stringify({ startDate: everStart, endDate: end,
      dimensions: ['page'], rowLimit: 25000, dataState: 'final',
      dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains',
        expression: `//${HOST}/` }] }] }) })).json()).rows || [];
  const controlPagesEver = (await (await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${enc}/searchAnalytics/query`,
    { method: 'POST', headers: H, body: JSON.stringify({ startDate: everStart, endDate: end,
      dimensions: ['page'], rowLimit: 25000, dataState: 'final',
      dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains',
        expression: '//zovo.one/' }] }] }) })).json()).rows || [];
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
      page_rows_28d: hostPages.length,
      pages_with_impressions_28d: hostPages.filter(r => r.impressions > 0).length,
      pages: hostPages,
      ever: {
        window: { start: everStart, end },
        note: 'GSC retains 16 months; 480d is the widest honest "ever" probe from this API.',
        page_rows: hostPagesEver.length,
        pages_with_impressions: hostPagesEver.filter(r => r.impressions > 0).length,
        impressions: hostPagesEver.reduce((n, r) => n + r.impressions, 0),
        clicks: hostPagesEver.reduce((n, r) => n + r.clicks, 0),
        positive_control_zovo_one: { page_rows: controlPagesEver.length,
          pages_with_impressions: controlPagesEver.filter(r => r.impressions > 0).length,
          impressions: controlPagesEver.reduce((n, r) => n + r.impressions, 0) },
      },
      positive_control_zovo_one: { daily_rows_returned: controlDaily.length,
        days_with_impressions: controlDaily.filter(r => r.impressions > 0).length,
        clicks: controlDaily.reduce((n, r) => n + r.clicks, 0),
        impressions: controlDaily.reduce((n, r) => n + r.impressions, 0) },
    },
    page, query_page: qp,
    mcp_pages: page.filter(r => r.keys[0].includes(`//${HOST}`)) };
}

// ---------------------------------------------------------------- GitHub referrals
// The registry side of the "which channel reaches people" question. GitHub's traffic API is
// the only place a referrer is attributed to a person rather than to a crawler, and it is a
// rolling 14-day window, so recording it every round makes the trend readable.
function githubTraffic(repo) {
  const gh = a => JSON.parse(execFileSync('gh', ['api', ...a], { encoding: 'utf8', timeout: 30000 }));
  try {
    const views = gh([`repos/${repo}/traffic/views`]);
    const clones = gh([`repos/${repo}/traffic/clones`]);
    const refs = gh([`repos/${repo}/traffic/popular/referrers`]);
    const paths = gh([`repos/${repo}/traffic/popular/paths`]);
    const meta = gh([`repos/${repo}`]);
    const registry = refs.filter(r => /registry\.modelcontextprotocol\.io|mcp/i.test(r.referrer));
    return { status: 'OK', repo, api: `gh api repos/${repo}/traffic/{views,clones,popular/referrers,popular/paths}`,
      window: '14 days, rolling, as served by GitHub',
      views_14d: views.count, unique_visitors_14d: views.uniques,
      views_daily: views.views.map(v => ({ date: v.timestamp.slice(0, 10), views: v.count, uniques: v.uniques })),
      clones_14d: clones.count, clone_uniques_14d: clones.uniques,
      stars: meta.stargazers_count, forks: meta.forks_count, watchers: meta.subscribers_count,
      referrers: refs,
      registry_referrers: registry,
      registry_views_14d: registry.reduce((n, r) => n + r.count, 0),
      registry_unique_visitors_14d: registry.reduce((n, r) => n + r.uniques, 0),
      top_paths: paths.slice(0, 10) };
  } catch (e) {
    return { status: 'UNMEASURED', repo, reason: `gh api failed: ${String(e.message || e).slice(0, 200)}` };
  }
}

// ---------------------------------------------------------------- indexation
// Crawled is not indexed. This measures which of the sitemap URLs are actually IN an index.
//  - Google: the Search Console URL Inspection API, which states the index verdict for a
//    single URL directly (free, service-account auth, 2,000 URLs/day quota). Impressions
//    are also pulled, but "0 impressions" only proves a page never ranked, while
//    coverageState proves whether Google holds it at all.
//  - Bing / Yandex / others: there is no free, keyless, honest index-status API. A scripted
//    `site:` query is answered with an unrelated fallback SERP. That claim is not assumed:
//    each probe below runs WITH a positive control on a domain known to be indexed, and if
//    the control also comes back wrong the result is recorded as UNMEASURED, never as zero.
async function probeSiteOperator(name, url, targetHost, label) {
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
    const body = await r.text();
    const links = [...body.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map(m => m[0])
      .filter(u => !/bing\.com|duckduckgo\.com|mojeek\.com|w3\.org|schema\.org/.test(u));
    const onTarget = links.filter(u => { try { return new URL(u).hostname === targetHost; } catch { return false; } });
    return { engine: name, query_url: url, label, http_status: r.status, bytes: body.length,
      links_found: links.length, links_on_target_host: onTarget.length,
      sample_links: [...new Set(links)].slice(0, 5) };
  } catch (e) { return { engine: name, query_url: url, label, error: String(e).slice(0, 200) }; }
}

async function indexation(sitePaths) {
  const urls = sitePaths.map(p => `https://${HOST}${p}`);
  const out = { generated_at: new Date().toISOString(), host: HOST, sitemap_urls: urls.length,
    google: null, other_engines: null };

  // ---- Google: URL Inspection, one call per URL, small concurrency (quota 600/min) ------
  const tok = await mintGscToken();
  if (!tok.ok) {
    out.google = { status: 'DOWN', reason: tok.why, key_path: GSC_KEY };
  } else {
    const H = { Authorization: `Bearer ${tok.token}`, 'Content-Type': 'application/json' };
    const API = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';
    const results = [];
    let cursor = 0, apiErrors = 0;
    async function worker() {
      while (cursor < urls.length) {
        const u = urls[cursor++];
        const r = await fetch(API, { method: 'POST', headers: H,
          body: JSON.stringify({ inspectionUrl: u, siteUrl: GSC_SITE }) });
        const j = await r.json();
        if (!r.ok) { apiErrors++; results.push({ url: u, http: r.status, error: JSON.stringify(j).slice(0, 200) }); continue; }
        const i = (j.inspectionResult && j.inspectionResult.indexStatusResult) || {};
        results.push({ url: u, http: r.status, verdict: i.verdict || null,
          coverage_state: i.coverageState || null, robots_txt_state: i.robotsTxtState || null,
          indexing_state: i.indexingState || null, page_fetch_state: i.pageFetchState || null,
          last_crawl_time: i.lastCrawlTime || null, google_canonical: i.googleCanonical || null });
      }
    }
    await Promise.all([...Array(4)].map(worker));
    // One retry pass for transient API failures, so a 500 on a single URL does not leave a
    // hole in a 126-row census. Anything still failing is reported as an error row, not as
    // "unknown to Google".
    const failed = results.filter(r => r.error);
    if (failed.length) {
      for (const f of failed) {
        const r = await fetch(API, { method: 'POST', headers: H,
          body: JSON.stringify({ inspectionUrl: f.url, siteUrl: GSC_SITE }) });
        const j = await r.json();
        if (!r.ok) continue;
        const i = (j.inspectionResult && j.inspectionResult.indexStatusResult) || {};
        Object.assign(f, { http: r.status, error: undefined, verdict: i.verdict || null,
          coverage_state: i.coverageState || null, robots_txt_state: i.robotsTxtState || null,
          indexing_state: i.indexingState || null, page_fetch_state: i.pageFetchState || null,
          last_crawl_time: i.lastCrawlTime || null, google_canonical: i.googleCanonical || null,
          retried: true });
        apiErrors--;
      }
    }
    const tally = {};
    for (const r of results) tally[r.coverage_state || `HTTP ${r.http}`] = (tally[r.coverage_state || `HTTP ${r.http}`] || 0) + 1;
    out.google = {
      status: apiErrors === results.length ? 'ERROR' : 'MEASURED',
      method: 'POST ' + API + ' { inspectionUrl, siteUrl: "' + GSC_SITE + '" } — one call per sitemap URL',
      service_account: tok.client_email,
      urls_inspected: results.length,
      api_errors: apiErrors,
      by_coverage_state: tally,
      in_google_index: results.filter(r => r.verdict === 'PASS').length,
      known_to_google: results.filter(r => r.coverage_state && !/unknown to Google/i.test(r.coverage_state)).length,
      unknown_to_google: results.filter(r => /unknown to Google/i.test(r.coverage_state || '')).length,
      ever_crawled_by_google: results.filter(r => r.last_crawl_time).length,
      urls: results.sort((a, b) => a.url.localeCompare(b.url)),
    };
  }

  // ---- Everything else: attempt, with a control, and say UNMEASURED if the control fails
  const probes = [];
  probes.push(await probeSiteOperator('bing_rss', `https://www.bing.com/search?q=site%3A${HOST}&format=rss&count=50`, HOST, 'target'));
  probes.push(await probeSiteOperator('bing_rss', 'https://www.bing.com/search?q=site%3Amodelcontextprotocol.io&format=rss&count=50', 'modelcontextprotocol.io', 'positive control, a site certainly in Bing'));
  probes.push(await probeSiteOperator('mojeek', `https://www.mojeek.com/search?q=site%3A${HOST}`, HOST, 'target'));
  probes.push(await probeSiteOperator('mojeek', 'https://www.mojeek.com/search?q=site%3Amodelcontextprotocol.io', 'modelcontextprotocol.io', 'positive control'));
  probes.push(await probeSiteOperator('duckduckgo_html', `https://html.duckduckgo.com/html/?q=site%3A${HOST}`, HOST, 'target'));
  probes.push(await probeSiteOperator('duckduckgo_html', 'https://html.duckduckgo.com/html/?q=site%3Amodelcontextprotocol.io', 'modelcontextprotocol.io', 'positive control'));

  const verdictFor = eng => {
    const t = probes.find(p => p.engine === eng && p.label === 'target');
    const c = probes.find(p => p.engine === eng && p.label && p.label.startsWith('positive control'));
    if (!t || !c) return 'UNMEASURED — probe did not run';
    if (!c.links_on_target_host) {
      return `UNMEASURED — the positive control returned ${c.links_on_target_host} results on a domain `
        + `that is certainly indexed (HTTP ${c.http_status}), so this probe cannot see the index at all. `
        + 'A zero for our host would be a broken probe, not an absent site.';
    }
    return `MEASURED — control OK (${c.links_on_target_host} on-domain links); target returned `
      + `${t.links_on_target_host} on-domain links`;
  };
  out.other_engines = {
    note: 'No free keyless index-status API exists for Bing or Yandex. Bing Webmaster Tools '
      + 'has one (GET /webmaster/api.svc/json/GetUrlTrafficInfo etc.) but it needs an API key '
      + 'from a signed-in account, which is a human step; Yandex Webmaster likewise needs OAuth. '
      + 'Neither key exists in this repo, so those channels are reported UNMEASURED.',
    bing: verdictFor('bing_rss'),
    mojeek: verdictFor('mojeek'),
    duckduckgo: verdictFor('duckduckgo_html'),
    probes,
    human_gated_alternatives: [
      'Bing Webmaster Tools: sign in, create an API key, then GetUrlTrafficInfo / GetUrlWithQueryStats per URL (free).',
      'Yandex Webmaster: OAuth app + token, then /user/{id}/hosts/{host}/search-urls/in-search (free).',
    ],
  };
  return out;
}

// ---------------------------------------------------------------- assemble
const cf = await cloudflare();
const sitePaths = await sitemapPaths();
const sitemapSet = new Set(sitePaths);

// Comparability across rounds. The sitemap was cut from 312 URLs to a curated 126 on
// 2026-09-07, so "% of the sitemap" is not comparable between runs. Read the URL set of the
// previous run out of the data/traffic.json this run is about to overwrite, and report
// crawler coverage against BOTH universes.
let prevPaths = [], prevGeneratedAt = null, prevWindow = null;
try {
  const prev = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/traffic.json'), 'utf8'));
  prevPaths = [...new Set((prev.sitemap_pages || []).map(r => r.path))];
  prevGeneratedAt = prev.generated_at;
  prevWindow = prev.cloudflare && prev.cloudflare.window;
} catch { /* first run: no previous file */ }

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

// How many of a given URL set each named crawler actually fetched — the crawl-coverage number.
const blankRow = p => ({ path: p, total: 0, human: 0, human_verified: 0,
  human_verified_ex_operator: 0, search_ai: 0, seo: 0, scripted: 0, other_bot: 0,
  unclassified: 0, visits: 0, crawlers: {} });
function coverageOver(paths) {
  const c = {};
  for (const p of paths) {
    const r = perPath.get(p) || blankRow(p);
    for (const [name, n] of Object.entries(r.crawlers)) {
      const e = c[name] || (c[name] = { urls_fetched: 0, requests: 0 });
      e.urls_fetched++; e.requests += n;
    }
  }
  return Object.fromEntries(Object.entries(c)
    .sort((a, b) => b[1].urls_fetched - a[1].urls_fetched)
    .map(([k, v]) => [k, { ...v, pct_of_set: +(100 * v.urls_fetched / paths.length).toFixed(1) }]));
}
const crawlerCoverage = {};
for (const r of sitemapRows) {
  for (const [name, n] of Object.entries(r.crawlers)) {
    const e = crawlerCoverage[name] || (crawlerCoverage[name] = { urls_fetched: 0, requests: 0 });
    e.urls_fetched++; e.requests += n;
  }
}

// ---- per-day rollup -------------------------------------------------------------------
// Built from the day slices before aggregation, so "did crawler X show up after the change
// on 2026-09-07" is answerable from this file without another query.
const dayRoll = new Map();
for (const r of cf.rawRows) {
  const day = r._slice;   // slice START instant; slices run window-offset to window-offset, NOT midnight-to-midnight
  const p = r.dimensions.clientRequestPath;
  const { klass, crawler } = classify(r.dimensions.userAgent);
  let e = dayRoll.get(day);
  if (!e) { e = { slice_start: day, requests: 0, human_page_views_render_proven: 0,
    sitemap_requests: 0, crawlers: {} }; dayRoll.set(day, e); }
  e.requests += r.count;
  const onSitemap = sitemapSet.has(p);
  if (onSitemap) e.sitemap_requests += r.count;
  if (klass === 'human_browser' && renderProven.has(r.dimensions.userAgent) && onSitemap) {
    e.human_page_views_render_proven += r.count;
  }
  if (crawler) {
    const c = e.crawlers[crawler] || (e.crawlers[crawler] = { requests: 0, sitemap_urls: new Set() });
    c.requests += r.count;
    if (onSitemap) c.sitemap_urls.add(p);
  }
}
const dailyBreakdown = [...dayRoll.values()].sort((a, b) => a.slice_start.localeCompare(b.slice_start))
  .map(e => ({ ...e, crawlers: Object.fromEntries(Object.entries(e.crawlers)
    .sort((a, b) => b[1].requests - a[1].requests)
    .map(([k, v]) => [k, { requests: v.requests, sitemap_urls_fetched: v.sitemap_urls.size }])) }));

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
    path_ua_day_slices: cf.sliceProof,
    daily_breakdown: dailyBreakdown,
    status_by_day: cf.statusByDay.map(r => ({ date: r.dimensions.date,
      status: r.dimensions.edgeResponseStatus, requests: r.count }))
      .sort((a, b) => a.date.localeCompare(b.date) || b.requests - a.requests),
    effective_window: cf.effective,
    host_hourly_requests: cf.hourly,
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
  github_traffic: githubTraffic(process.env.GH_REPO || 'theluckystrike/mcp-servers'),
  registry_referral_baseline: null,   // filled in below, once both sides are known
  crawler_url_coverage: Object.fromEntries(Object.entries(crawlerCoverage)
    .sort((a, b) => b[1].urls_fetched - a[1].urls_fetched)
    .map(([k, v]) => [k, { ...v, pct_of_sitemap: +(100 * v.urls_fetched / sitePaths.length).toFixed(1) }])),
  // Same shape, over the previous run's URL set, so the two rounds are directly comparable
  // even though the sitemap was cut from 312 to 126.
  crawler_url_coverage_previous_set: prevPaths.length ? {
    source: 'data/traffic.json as it stood before this run',
    previous_generated_at: prevGeneratedAt,
    previous_window: prevWindow,
    urls_in_set: prevPaths.length,
    still_in_current_sitemap: prevPaths.filter(p => sitemapSet.has(p)).length,
    dropped_from_sitemap: prevPaths.filter(p => !sitemapSet.has(p)).length,
    coverage: coverageOver(prevPaths),
  } : null,
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

// A DOWN channel must not destroy a good extract. The GSC key lives on iCloud Desktop and
// goes dataless without warning; when that happens the last successful pull is far more
// valuable than a fresh file that says "DOWN", so the existing file is left alone.
function writeChannelFile(file, payload, goodStates) {
  const abs = path.resolve(ROOT, file);
  if (goodStates.includes(payload.status)) { fs.writeFileSync(abs, JSON.stringify(payload, null, 2) + '\n'); return 'written'; }
  try {
    const prev = JSON.parse(fs.readFileSync(abs, 'utf8'));
    const prevStatus = prev.status || (prev.google && prev.google.status);
    if (goodStates.includes(prevStatus)) {
      console.error(`[traffic.mjs] REFUSING to overwrite ${file}: this run is ${payload.status} `
        + `(${payload.reason || (payload.google && payload.google.reason) || 'no reason given'}) but the file on disk `
        + `holds a good extract from ${prev.generated_at || 'an earlier run'}. Left untouched.`);
      return 'preserved';
    }
  } catch { /* no readable previous file */ }
  fs.writeFileSync(abs, JSON.stringify(payload, null, 2) + '\n');
  return 'written';
}

if (!SKIP_GSC) {
  const g = await gsc();
  out.channels.google_search_console = g.status;
  const w = writeChannelFile(GSC_OUT, g, ['OK']);
  console.error(`[traffic.mjs] GSC channel: ${g.status}${g.reason ? ' — ' + g.reason : ''} (${GSC_OUT} ${w})`);
} else {
  out.channels.google_search_console = 'SKIPPED';
}

// ---- the registry-vs-crawler baseline, both sides recorded on the same date ------------
// Registry placement can be improved (namespace, naming, rank). Whether better placement
// turns into VISITS is the open question, so both referral sides are stamped today.
{
  const gt = out.github_traffic;
  const registryHosts = /registry\.modelcontextprotocol\.io|mcpindex\.ai|mcpi\.app|mcp\.ahel\.io|glama\.ai|mcpservers|smithery|pulsemcp|mcp\.so/i;
  const refRows = cf.byReferer.map(r => ({ referer_host: r.dimensions.clientRefererHost || '(none)', requests: r.count }));
  const storefront = refRows.filter(r => registryHosts.test(r.referer_host));
  out.registry_referral_baseline = {
    recorded_at: new Date().toISOString(),
    why: 'Baseline for the registry-placement experiment: if better registry rank is worth '
      + 'anything, these two numbers rise. Rank alone is not the outcome; visits are.',
    github_side: gt.status === 'OK' ? {
      window: '14d rolling', views_14d: gt.views_14d, unique_visitors_14d: gt.unique_visitors_14d,
      registry_referrer_views_14d: gt.registry_views_14d,
      registry_referrer_unique_visitors_14d: gt.registry_unique_visitors_14d,
      referrers: gt.referrers, stars: gt.stars,
    } : gt,
    storefront_side: {
      window: cf.window, effective_window: cf.effective,
      host: HOST,
      referer_hosts_matching_registry_ecosystem: storefront,
      requests_from_registry_ecosystem: storefront.reduce((n, r) => n + r.requests, 0),
      note: 'Cloudflare records a referer host, not a person. These are raw requests; the '
        + 'render-proven human filter is not applied per-referer because the referer dimension '
        + 'and the userAgent dimension are separate groupings.',
    },
    user_initiated_assistant_fetches: {
      note: 'The assistant-crawler side of the same question. ClaudeBot/GPTBot are scheduled '
        + 'crawls; Claude-User, ChatGPT-User and Perplexity-User are fetches a PERSON triggered '
        + 'by asking an assistant about a page. That is the only measurable proxy for an '
        + 'assistant surface sending a human here.',
      window: cf.window,
      counts: Object.fromEntries(['Claude-User', 'ChatGPT-User', 'PerplexityBot', 'OAI-SearchBot']
        .map(k => [k, crawlerTotals.get(k) || 0])),
    },
  };
}

if (argv.includes('--indexation')) {
  const ix = await indexation(sitePaths);
  // Crawl evidence from THIS run, so indexation.json is self-contained: crawled != indexed.
  ix.crawl_evidence = { window: cf.window, effective_window: cf.effective,
    crawler_url_coverage: out.crawler_url_coverage,
    sitemap_urls_fetched_by_search_or_ai_crawler: cov.fetched_by_search_or_ai_crawler };
  const ixFile = flag('--indexation-out') || 'data/indexation.json';
  const w = writeChannelFile(ixFile, { status: ix.google.status, generated_at: ix.generated_at, ...ix },
    ['MEASURED']);
  console.error(`[traffic.mjs] ${ixFile} ${w} — Google: `
    + `${ix.google.status === 'MEASURED' ? ix.google.in_google_index + ' of ' + ix.google.urls_inspected + ' in the index' : ix.google.status}`);
}

fs.writeFileSync(path.resolve(ROOT, OUT_FILE), JSON.stringify(out, null, 2) + '\n');
console.error(`[traffic.mjs] wrote ${OUT_FILE} — ${cov.sitemap_urls} sitemap URLs, `
  + `${cov.fetched_by_search_or_ai_crawler} crawled by a search/AI bot, `
  + `${cov.fetched_by_human_browser_ua_loose} touched by a browser UA (loose), `
  + `${cov.fetched_by_render_proven_browser_strict} by a render-proven browser (strict), over `
  + `${cf.window.start} → ${cf.window.end} (${cf.effective.effective_days}d of host data). `
  + `Max rows in any day slice: ${cf.sliceProof.max_rows_in_any_slice} of ${cf.sliceProof.row_cap}.`);
