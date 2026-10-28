const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'https://mcp.zovo.one';
const out = { steps: [], console: [] };

function rec(s) { out.steps.push(s); }

async function newPage(ctx, tag) {
  const page = await ctx.newPage();
  page.on('console', m => { if (['error','warning'].includes(m.type())) out.console.push({tag, type: m.type(), text: m.text().slice(0,300)}); });
  page.on('pageerror', e => out.console.push({tag, type:'pageerror', text: String(e).slice(0,300)}));
  page.on('requestfailed', r => out.console.push({tag, type:'requestfailed', url: r.url().slice(0,200), err: r.failure() && r.failure().errorText}));
  page.on('response', r => { if (r.status() >= 400) out.console.push({tag, type:'http'+r.status(), url: r.url().slice(0,200)}); });
  return page;
}

async function load(page, url, tag) {
  const t0 = Date.now();
  const resp = await page.goto(url, { waitUntil: 'load', timeout: 30000 }).catch(e => ({ error: String(e).slice(0,150) }));
  const ms = Date.now() - t0;
  return { tag, url, ms, status: resp && resp.status, error: resp && resp.error };
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });

  // ---- Desktop JS-on probes ----
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let page = await newPage(ctx, 'desktop');

  // Landing page
  let r = await load(page, BASE + '/', 'landing');
  rec(r);
  await page.waitForTimeout(500);
  const landing = await page.evaluate(() => ({
    title: document.title,
    bodyText: document.body.innerText.slice(0, 3000),
    priceText: (document.body.innerText.match(/\$\d+[\d.,]*/g) || []).slice(0, 10),
    trialMentions: (document.body.innerText.match(/trial|free tier|demo/gi) || []).slice(0,5),
    buyLinks: [...document.querySelectorAll('a[href*="buy"], a[href*="/s/"], button')].map(a => (a.textContent||'').trim().slice(0,60) + ' -> ' + (a.getAttribute('href')||'(button)')).slice(0, 30),
    inputsOnLanding: document.querySelectorAll('input,select,textarea').length,
    licenceKeyMention: /licence|license key/i.test(document.body.innerText)
  })).catch(e => ({ error: String(e).slice(0,200) }));
  rec({ step: 'landing-eval', landing });

  // Click path: landing -> buy/invoice via clicking
  r = await load(page, BASE + '/', 'click-path-start'); // fresh
  let t0 = Date.now();
  try {
    const buyLink = page.locator('a[href*="/buy/invoice"]').first();
    await buyLink.click({ timeout: 8000 });
    await page.waitForLoadState('load', { timeout: 20000 });
    rec({ step: 'click-1-landing-to-buy', clickedText: await buyLink.textContent().catch(()=>null), landedUrl: page.url(), ms: Date.now() - t0 });
  } catch (e) {
    rec({ step: 'click-1-landing-to-buy', error: String(e).slice(0, 200), landedUrl: page.url() });
    // try any buy link
    try {
      const any = page.locator('a[href*="/buy/"]').first();
      await any.click({ timeout: 5000 });
      await page.waitForLoadState('load', { timeout: 20000 });
      rec({ step: 'click-1b-any-buy-link', landedUrl: page.url(), ms: Date.now() - t0 });
    } catch (e2) { rec({ step: 'click-1b', error: String(e2).slice(0,200) }); }
  }
  const buyPageText = await page.evaluate(() => document.body.innerText.slice(0, 2500)).catch(()=>null);
  const buyPageInputs = await page.evaluate(() => [...document.querySelectorAll('input,select,textarea,button[type=submit]')].map(i => ({tag: i.tagName, type: i.type||null, name: i.name||null, placeholder: i.placeholder||null, label: (i.labels && i.labels[0] && i.labels[0].innerText.slice(0,60))||null}))).catch(()=>null);
  rec({ step: 'buy-page-state', url: page.url(), text: buyPageText, fields: buyPageInputs });

  // Click checkout on buy page
  t0 = Date.now();
  try {
    const btn = page.locator('button[type=submit], button:has-text("Buy"), button:has-text("Checkout"), button:has-text("Purchase"), a:has-text("Checkout")').first();
    const txt = await btn.textContent().catch(()=>null);
    await btn.click({ timeout: 8000 });
    try { await page.waitForLoadState('load', { timeout: 20000 }); } catch {}
    await page.waitForTimeout(2500); // allow redirect/Stripe iframe to mount
    rec({ step: 'click-2-checkout', clickedText: txt, landedUrl: page.url(), ms: Date.now() - t0 });
  } catch (e) {
    rec({ step: 'click-2-checkout', error: String(e).slice(0,200), landedUrl: page.url() });
  }
  const payText = await page.evaluate(() => document.body.innerText.slice(0, 2500)).catch(()=>null);
  const payFields = await page.evaluate(() => [...document.querySelectorAll('input,select,iframe')].map(i => ({tag: i.tagName, name: i.name||null, id: i.id||null, type: i.type||null, src: (i.tagName==='IFRAME'? (i.src||'').slice(0,120):null), required: i.required||null}))).catch(()=>null);
  rec({ step: 'payment-page-state', url: page.url(), text: payText, fields: payFields });
  rec({ step: 'stripe-detected', iframesStripe: payFields && payFields.filter(f => f.src && /stripe/.test(f.src)), urlHasStripe: /stripe|checkout/.test(page.url()) });

  // Direct entry probes
  for (const path of ['/buy/invoice', '/buy/zip', '/s/invoice', '/pricing']) {
    const p2 = await newPage(ctx, 'direct-' + path);
    const t = Date.now();
    const rr = await load(p2, BASE + path, 'direct-' + path);
    const txt = await p2.evaluate(() => document.body.innerText.slice(0, 1200)).catch(e => 'EVALFAIL ' + String(e).slice(0,100));
    const links = await p2.evaluate(() => [...document.querySelectorAll('a')].map(a => a.getAttribute('href')).slice(0, 25)).catch(()=>null);
    rec({ ...rr, elapsedMs: Date.now() - t, text: txt, links });
    await p2.close();
  }

  // Mobile 390px
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', isMobile: true, hasTouch: true });
  for (const path of ['/', '/buy/invoice']) {
    const p3 = await newPage(mctx, 'mobile-' + path);
    const t = Date.now();
    const rr = await load(p3, BASE + path, 'mobile-' + path);
    const m = await p3.evaluate(() => ({ hScroll: document.documentElement.scrollWidth > 392, scrollWidth: document.documentElement.scrollWidth, buyLink: !!document.querySelector('a[href*="/buy/"]'), text: document.body.innerText.slice(0, 500) })).catch(e => ({ error: String(e).slice(0,150) }));
    rec({ ...rr, elapsedMs: Date.now() - t, mobile: m });
    await p3.close();
  }
  await mctx.close();

  // JS disabled
  const jctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: false });
  for (const path of ['/', '/buy/invoice']) {
    const p4 = await newPage(jctx, 'nojs-' + path);
    const rr = await load(p4, BASE + path, 'nojs-' + path);
    const body = await p4.content().catch(()=>null);
    rec({ ...rr, nojsHtmlSnippet: body ? body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 600) : null });
    await p4.close();
  }
  await jctx.close();

  await ctx.close();
  await browser.close();
  fs.writeFileSync('/Users/mike/mcp-servers/intel/smono/funnel-raw.json', JSON.stringify(out, null, 1));
  console.log('DONE steps=' + out.steps.length + ' issues=' + out.console.length);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
