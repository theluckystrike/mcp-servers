// Usage: node tgapi.js '<js body using invoke(method, params)>'  -> runs inside web.telegram.org/k via rootScope.managers.apiManager
const { chromium } = require('/Users/mike/node_modules/playwright-core');
(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const p = b.contexts()[0].pages().find(x => x.url().includes('web.telegram.org'));
  const out = await p.evaluate(async (body) => {
    const invoke = (m, prm) => window.rootScope.managers.apiManager.invokeApi(m, prm);
    const fn = new Function('invoke', 'return (async () => {' + body + '})()');
    try { return JSON.stringify(await fn(invoke)); } catch (e) { return 'ERR ' + (e && (e.type || e.message) || e); }
  }, process.argv[2]);
  console.log(out); process.exit(0);
})();
