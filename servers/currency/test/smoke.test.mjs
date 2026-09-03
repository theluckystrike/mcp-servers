import test from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(here, "..", "dist", "index.js");
const REPO = join(here, "..", "..", "..");

/* --------------------------------------------------------------- ECB fixtures */
/* Dates are generated relative to today so the free-tier 90-day window is exercised
   against a moving clock rather than a date that ages out of it. */
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => iso(new Date(Date.now() - n * 86_400_000));
const D0 = daysAgo(0), D1 = daysAgo(1), D2 = daysAgo(2), D5 = daysAgo(5);

const day = (t, usd, jpy, gbp, pln) =>
  `<Cube time='${t}'><Cube currency='USD' rate='${usd}'/><Cube currency='JPY' rate='${jpy}'/>` +
  `<Cube currency='GBP' rate='${gbp}'/><Cube currency='PLN' rate='${pln}'/></Cube>`;

const HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"><Cube>`;
const TAIL = `</Cube></gesmes:Envelope>`;

const DAILY_XML = HEAD + day(D0, "1.0812", "172.53", "0.85023", "4.2650") + TAIL;
const HIST_XML = HEAD +
  day(D0, "1.0812", "172.53", "0.85023", "4.2650") +
  day(D1, "1.0790", "172.10", "0.85110", "4.2710") +
  day(D2, "1.0755", "171.88", "0.85240", "4.2800") +
  day(D5, "1.0731", "171.02", "0.85310", "4.2890") +
  TAIL;

let hits = 0;
function ecbServer() {
  const srv = createServer((req, res) => {
    hits++;
    if (req.url.includes("eurofxref-daily.xml")) { res.writeHead(200, { "content-type": "text/xml" }); res.end(DAILY_XML); return; }
    if (req.url.includes("eurofxref-hist.xml")) { res.writeHead(200, { "content-type": "text/xml" }); res.end(HIST_XML); return; }
    res.writeHead(404); res.end("no");
  });
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}` })));
}

/* ------------------------------------------------------------------- JSON-RPC */

function client(env = {}) {
  const home = mkdtempSync(join(tmpdir(), "mcp-currency-"));
  const child = spawn(process.execPath, [ENTRY], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      XDG_DATA_HOME: join(home, "data"),
      XDG_CONFIG_HOME: join(home, "config"),
      MCP_LICENSE_KEY: "",
      ...env,
    },
  });
  child.stderr.resume();
  let buf = "";
  const pending = new Map();
  child.stdout.on("data", (d) => {
    buf += d.toString();
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id).resolve(msg); pending.delete(msg.id); }
    }
  });
  let id = 0;
  const send = (method, params) => new Promise((resolve, reject) => {
    const myId = ++id;
    pending.set(myId, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: myId, method, params }) + "\n");
    const to = setTimeout(() => { if (pending.has(myId)) { pending.delete(myId); reject(new Error(`timeout on ${method}`)); } }, 20000);
    to.unref();
  });
  return {
    home, child, send,
    notify: (m, p) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: m, params: p }) + "\n"),
    call: async (name, args) => {
      const r = await send("tools/call", { name, arguments: args ?? {} });
      assert.ok(r.result, `tools/call ${name} returned ${JSON.stringify(r.error)}`);
      return { text: r.result.content.map((c) => c.text).join("\n"), isError: !!r.result.isError };
    },
    close: () => child.kill(),
  };
}

async function init(c) {
  const r = await c.send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "0" } });
  assert.ok(r.result?.serverInfo, "initialize failed");
  assert.equal(r.result.serverInfo.name, "mcp-currency");
  c.notify("notifications/initialized", {});
  return r.result;
}

test("stdio: initialize, tools/list, convert, fx_rates_for, resource, prompt", async (t) => {
  const { srv, url } = await ecbServer();
  t.after(() => srv.close());
  const c = client({ ECB_BASE_URL: url });
  t.after(() => c.close());

  await init(c);

  const tools = (await c.send("tools/list", {})).result.tools.map((x) => x.name).sort();
  assert.deepEqual(tools, [
    "cache_status", "convert", "convert_many", "currencies_list", "fx_rates_for",
    "license_activate", "license_status", "rate_history", "rate_on", "rates_latest",
  ]);

  // convert 100 USD -> PLN against the fixture: 4.2650/1.0812 = 3.944691, 394.4691 -> 394.47
  const conv = JSON.parse((await c.call("convert", { amount: 100, from: "USD", to: "PLN" })).text);
  assert.equal(conv.rate, 3.944691);
  assert.equal(conv.result, "PLN 394.47");
  assert.equal(conv.result_number, 394.47);
  assert.equal(conv.rate_date, D0, "every answer states the rate date");
  assert.match(conv.note, /16:00 CET on TARGET business days/);

  // JPY rounds to whole units
  const jpy = JSON.parse((await c.call("convert", { amount: 10, from: "EUR", to: "JPY" })).text);
  assert.equal(jpy.result, "JPY 1725");
  assert.match(jpy.rounding, /0 decimal places/);

  // the shape expense_to_invoice takes as fx_rates
  const fx = JSON.parse((await c.call("fx_rates_for", { target: "USD", currencies: ["EUR", "GBP", "USD"] })).text);
  assert.equal(fx.target_currency, "USD");
  assert.deepEqual(Object.keys(fx.fx_rates).sort(), ["EUR", "GBP"], "the target's own currency needs no rate");
  assert.equal(fx.fx_rates.EUR, 1.0812);
  assert.equal(fx.fx_rates.GBP, 1.271656);
  for (const v of Object.values(fx.fx_rates)) assert.equal(typeof v === "number" && v > 0, true, "fx_rates values must be positive numbers");
  assert.equal(fx.rate_date, D0);
  assert.match(fx.next_step, /expense_to_invoice/);

  const many = JSON.parse((await c.call("convert_many", { amount: 50, from: "EUR", to: ["USD", "PLN", "JPY"] })).text);
  assert.equal(many.results.length, 3);
  assert.equal(many.results.find((r) => r.to === "JPY").result, "JPY 8627");

  const list = JSON.parse((await c.call("currencies_list", {})).text);
  assert.equal(list.count, 5);
  assert.equal(list.currencies.find((x) => x.code === "JPY").decimals, 0);

  const status = JSON.parse((await c.call("cache_status", {})).text);
  assert.equal(status.daily.exists, true);
  assert.equal(status.daily.rate_date, D0);
  assert.equal(status.mode, "free");

  const res = await c.send("resources/read", { uri: "fx://latest" });
  const body = JSON.parse(res.result.contents[0].text);
  assert.equal(body.base, "EUR");
  assert.equal(body.date, D0);

  const prompts = (await c.send("prompts/list", {})).result.prompts.map((p) => p.name);
  assert.deepEqual(prompts, ["convert_invoice_lines"]);
  const got = await c.send("prompts/get", { name: "convert_invoice_lines", arguments: { project: "Nova", target_currency: "USD" } });
  assert.match(got.result.messages[0].content.text, /fx_rates_for/);
  assert.match(got.result.messages[0].content.text, /invoice_create/);
});

test("free: a 91-day history window is refused with upgrade text, not truncated", async (t) => {
  const { srv, url } = await ecbServer();
  t.after(() => srv.close());
  const c = client({ ECB_BASE_URL: url });
  t.after(() => c.close());
  await init(c);

  const r = await c.call("rate_history", { from: "USD", to: "PLN", days: 91 });
  assert.equal(r.isError, false, "a limit hit is information, not a transport error");
  assert.match(r.text, /free tier reads 90 days/);
  assert.match(r.text, /mcp\.zovo\.one/);
  assert.doesNotMatch(r.text, /"rates":/, "nothing was looked up");

  const old = await c.call("rate_on", { from: "USD", to: "PLN", date: daysAgo(400) });
  assert.equal(old.isError, false);
  assert.match(old.text, /older than the 90 days/);

  // inside the window the free tier answers normally
  const okr = JSON.parse((await c.call("rate_history", { from: "USD", to: "PLN", days: 30 })).text);
  assert.equal(okr.business_days, 4);
  assert.equal(okr.pair, "USD/PLN");
  assert.equal(typeof okr.avg, "number");
  assert.equal(okr.min.rate <= okr.max.rate, true);
});

test("pro: a 91-day window and an old date are allowed", async (t) => {
  const { srv, url } = await ecbServer();
  t.after(() => srv.close());
  const key = execFileSync(process.execPath, [join(REPO, "scripts", "sign-license.mjs"), "currency"], { encoding: "utf8" }).trim();
  const c = client({ ECB_BASE_URL: url, MCP_LICENSE_KEY: key });
  t.after(() => c.close());
  await init(c);

  assert.match((await c.call("license_status", {})).text, /"tier": "pro"/);

  const r = JSON.parse((await c.call("rate_history", { from: "USD", to: "PLN", days: 91 })).text);
  assert.equal(r.business_days, 4);
  assert.equal(r.from_date < daysAgo(90), true);

  const on = JSON.parse((await c.call("rate_on", { from: "USD", to: "PLN", date: D5 })).text);
  assert.equal(on.rate_date, D5);
  assert.equal(on.exact, true);
});

test("nearest previous business day is stated in the answer", async (t) => {
  const { srv, url } = await ecbServer();
  t.after(() => srv.close());
  const c = client({ ECB_BASE_URL: url });
  t.after(() => c.close());
  await init(c);

  // D5-1 has no fixture row, so the rule must fall back and say so
  const asked = daysAgo(4);
  const on = JSON.parse((await c.call("rate_on", { from: "USD", to: "PLN", date: asked })).text);
  assert.equal(on.requested_date, asked);
  assert.equal(on.rate_date, D5);
  assert.equal(on.exact, false);
  assert.match(on.note, /No ECB rate was published on/);
  assert.match(on.rule, /nearest previous business day/);
});

test("offline: after one download every answer comes from the cache", async (t) => {
  const { srv, url } = await ecbServer();
  const home = mkdtempSync(join(tmpdir(), "mcp-currency-offline-"));
  const env = { ECB_BASE_URL: url, XDG_DATA_HOME: join(home, "data"), XDG_CONFIG_HOME: join(home, "config") };

  const warm = client(env);
  await init(warm);
  await warm.call("convert", { amount: 1, from: "EUR", to: "USD" });
  warm.close();
  const afterWarm = hits;
  assert.ok(afterWarm > 0, "the first call went to the ECB");

  // Same data dir, dead URL: the cache is fresh, so nothing is fetched and the answer is identical.
  const cold = client({ ...env, ECB_BASE_URL: "http://127.0.0.1:1/none" });
  t.after(() => { cold.close(); srv.close(); });
  await init(cold);
  const conv = JSON.parse((await cold.call("convert", { amount: 100, from: "USD", to: "PLN" })).text);
  assert.equal(conv.result, "PLN 394.47");
  assert.equal(conv.rate_date, D0);
  assert.equal(hits, afterWarm, "a fresh cache makes no network call at all");
});
