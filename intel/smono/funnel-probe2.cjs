const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'https://mcp.zovo.one';
const net = [];
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('response', r => {
    if (/\/buy\/|stripe|checkout|\/s\//.test(r.url()) && (r.request().method() !== 'GET' || r.status() >= 300 || /buy|stripe|checkout/.test(r.url()))) {
      const h = r.headers();
      net.push({ url: r.url().slice(0,160), method: r.request().method(), status: r.status(),
        location: h['location']||null, xmcpbuy: h['x-mcp-buy']||null, server: h['server']||null, setcookie: h['set-cookie'] ? 'yes' : null });
    }
  });
  const log = [];
  // A) buy/invoice with email filled, click each button
  await page.goto(BASE + '/buy/invoice', { waitUntil: 'load' });
  const forms = await page.evaluate(() => [...document.querySelectorAll('form')].map((f,i) => ({i, action: f.action, method: f.method, html: f.outerHTML.slice(0,400)})));
  log.push({ step: 'forms-on-buy', forms });
  // click the first submit (Continue to Stripe)
  const btns = page.locator('button[type=submit]');
  const n = await btns.count();
  log.push({ step: 'submit-buttons', count: n });
  for (let i = 0; i < Math.min(n, 2); i++) {
    const t0 = Date.now();
    const txt = await btns.nth(i).textContent().catch(()=>null);
    try {
      const email = page.locator('input[type=email]');
      if (await email.count()) await email.first().fill('audit-test@example.com');
      await btns.nth(i).click({ timeout: 5000 });
      try { await page.waitForLoadState('load', { timeout: 15000 }); } catch {}
      await page.waitForTimeout(3000);
      const stripe = await page.evaluate(() => ({ url: location.href, iframes: [...document.querySelectorAll('iframe')].map(f=>f.src.slice(0,120)), text: document.body.innerText.slice(0,300) }));
      log.push({ step: 'clicked-submit-' + i, clickedText: txt, ms: Date.now()-t0, after: stripe });
      // go back
      await page.goto(BASE + '/buy/invoice', { waitUntil: 'load' });
    } catch (e) { log.push({ step: 'clicked-submit-' + i, error: String(e).slice(0,150) }); }
  }
  // B) bundle
  await page.goto(BASE + '/buy/bundle', { waitUntil: 'load' }).catch(e => log.push({step:'bundle-goto', error:String(e).slice(0,120)}));
  const bundle = await page.evaluate(() => ({ title: document.title, text: document.body.innerText.slice(0, 700), price: (document.body.innerText.match(/\$\d+/g)||[]).slice(0,5) })).catch(e => ({error:String(e).slice(0,120)}));
  log.push({ step: 'bundle', bundle });
  fs.writeFileSync('/Users/mike/mcp-servers/intel/smono/funnel-raw2.json', JSON.stringify({ log, net }, null, 1));
  console.log('DONE');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
