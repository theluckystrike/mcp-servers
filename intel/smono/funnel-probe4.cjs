const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'https://mcp.zovo.one';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';
const log = [];
async function timed(page, url, wait = 'load') {
  const t0 = Date.now();
  const resp = await page.goto(url, { waitUntil: wait, timeout: 30000 }).catch(e => ({ err: String(e).slice(0, 120) }));
  const ms = Date.now() - t0;
  const status = resp && resp.status ? resp.status() : resp && resp.err ? resp.err : null;
  return { status, ms };
}
async function bodyInfo(page) {
  return page.evaluate(() => ({
    title: document.title,
    h1: (document.querySelector('h1') || {}).textContent || null,
    prices: [...document.body.innerText.matchAll(/\$\d+(?:\.\d{2})?/g)].map(m => m[0]).slice(0, 8),
    buyLinks: [...document.querySelectorAll('a[href*="/buy/"]')].map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim().slice(0, 60) })).slice(0, 6),
    inputs: [...document.querySelectorAll('input,select')].filter(i => i.type !== 'hidden').map(i => ({ name: i.name, type: i.type, required: i.required })),
    trial: /free (trial|tier)|trial|no credit card/i.test(document.body.innerText) ? document.body.innerText.match(/[^.\n]*(free (trial|tier)|trial|no credit card)[^.\n]*/i)[0].slice(0, 120) : null,
    licenceKey: /licen[cs]e.?key|sk[-_]|mcp[_-]key/i.test(document.body.innerText) ? 'MENTIONED' : null,
    text: document.body.innerText.slice(0, 400)
  })).catch(e => ({ error: String(e).slice(0, 120) }));
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  // desktop
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA });
  const page = await ctx.newPage();
  const cerr = [];
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text().slice(0, 150)); });
  page.on('requestfailed', r => cerr.push('REQFAIL ' + r.url().slice(0, 100) + ' ' + (r.failure() || {}).errorText));
  for (const u of ['/', '/pricing', '/s/invoice', '/buy/zip']) {
    const t = await timed(page, BASE + u);
    const b = await bodyInfo(page);
    log.push({ ep: u, ...t, ...b });
  }
  log.push({ ep: 'desktop-console-errors', cerr: cerr.slice(0, 12) });
  await ctx.close();
  // mobile 390
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const mp = await mctx.newPage();
  for (const u of ['/', '/buy/invoice']) {
    const t = await timed(mp, BASE + u);
    const b = await bodyInfo(mp);
    b.hscroll = await mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth).catch(() => null);
    log.push({ ep: 'mobile390:' + u, ...t, ...b });
  }
  await mctx.close();
  // JS disabled
  const jctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: false, userAgent: UA });
  const jp = await jctx.newPage();
  for (const u of ['/', '/buy/invoice']) {
    const t = await timed(jp, BASE + u, 'domcontentloaded');
    const b = await bodyInfo(jp);
    log.push({ ep: 'js-off:' + u, ...t, ...b });
  }
  await jctx.close();
  await browser.close();
  fs.writeFileSync('/Users/mike/mcp-servers/intel/smono/funnel-raw4.json', JSON.stringify(log, null, 1));
  console.log('DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
