const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'https://mcp.zovo.one';
const net = [];
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  page.on('response', r => {
    if (/\/buy\//.test(r.url()) && r.request().method() === 'POST' || /stripe|checkout\.stripe/.test(r.url())) {
      const h = r.headers();
      net.push({ url: r.url().slice(0,180), method: r.request().method(), status: r.status(), location: h['location']||null, xmcpbuy: h['x-mcp-buy']||null });
    }
  });
  const log = [];
  for (const id of ['invoice', 'bundle']) {
    await page.goto(BASE + '/buy/' + id, { waitUntil: 'load' });
    const t0 = Date.now();
    await page.locator('button.buy, button[type=submit]').first().click({ timeout: 5000 });
    try { await page.waitForLoadState('load', { timeout: 15000 }); } catch {}
    await page.waitForTimeout(4000);
    const state = await page.evaluate(() => ({ url: location.href, title: document.title,
      iframes: [...document.querySelectorAll('iframe')].map(f => f.src.slice(0,140)),
      inputs: [...document.querySelectorAll('input,select,textarea')].map(i => ({ name: i.name, type: i.type, id: i.id, placeholder: i.placeholder })),
      text: document.body.innerText.slice(0, 600) }));
    log.push({ id, ms: Date.now() - t0, state });
  }
  fs.writeFileSync('/Users/mike/mcp-servers/intel/smono/funnel-raw3.json', JSON.stringify({ log, net }, null, 1));
  console.log('DONE');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
