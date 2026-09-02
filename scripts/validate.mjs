#!/usr/bin/env node
// Live validation of every server + billing, appended to data/validation.json (the validation database).
// Each run: spawn dist/index.js over stdio, initialize, tools/list, real tool calls, free gate, pro gate, timing.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const DB = join(ROOT, "data/validation.json");
const sign = (p) => execFileSync("node", [join(ROOT, "scripts/sign-license.mjs"), p]).toString().trim();

function client(dir, env = {}) {
  const proc = spawn("node", [join(ROOT, "servers", dir, "dist/index.js")], { env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe"] });
  let buf = ""; const waiters = new Map(); let id = 0; const stderr = [];
  proc.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue; try { const m = JSON.parse(line); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } } catch { stderr.push("NON-JSON STDOUT: " + line.slice(0, 120)); } } });
  proc.stderr.on("data", (d) => stderr.push(String(d).trim()));
  const call = (method, params = {}) => new Promise((res, rej) => { const i = ++id; const t = setTimeout(() => rej(new Error(`timeout ${method}`)), 8000); t.unref(); waiters.set(i, (m) => { clearTimeout(t); res(m); }); proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: i, method, params }) + "\n"); });
  const tool = async (name, args = {}) => { const r = await call("tools/call", { name, arguments: args }); const text = r.result?.content?.map((c) => c.text).join("\n") ?? JSON.stringify(r.error); return { text, isError: !!r.result?.isError || !!r.error }; };
  return { call, tool, stderr, close: () => proc.kill() };
}

async function runServer(id, probes) {
  const t0 = Date.now();
  const checks = [];
  const ok = (name, pass, detail = "") => checks.push({ name, pass: !!pass, detail: String(detail).slice(0, 160) });
  for (const tier of ["free", "pro"]) {
    const tmp = mkdtempSync(join(tmpdir(), `val-${id}-${tier}-`));
    const env = { XDG_DATA_HOME: join(tmp, "data"), XDG_CONFIG_HOME: join(tmp, "cfg") };
    if (tier === "pro") env.MCP_LICENSE_KEY = sign(id);
    const c = client(id, env);
    try {
      const ts = Date.now();
      const init = await c.call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "validator", version: "1" } });
      ok(`${tier}: initialize`, init.result?.serverInfo?.name, `${init.result?.serverInfo?.name} in ${Date.now() - ts} ms`);
      await c.call("notifications/initialized").catch(() => {});
      const list = await c.call("tools/list");
      const names = (list.result?.tools || []).map((t) => t.name);
      ok(`${tier}: tools/list`, names.length >= 8 && names.includes("license_status") && names.includes("license_activate"), `${names.length} tools`);
      const st = await c.tool("license_status");
      ok(`${tier}: license_status reports ${tier}`, st.text.includes(`"tier": "${tier}"`), st.text.replace(/\s+/g, " ").slice(0, 80));
      await probes(c, tmp, tier, ok);
      const bad = await c.tool("nonexistent_tool", {});
      ok(`${tier}: unknown tool returns clean error`, bad.isError || /unknown|not found/i.test(bad.text), bad.text.slice(0, 60));
      ok(`${tier}: stdout carried only JSON-RPC`, !c.stderr.some((l) => l.startsWith("NON-JSON")), c.stderr.filter((l) => l.startsWith("NON-JSON")).join(" | "));
    } catch (e) { ok(`${tier}: exception`, false, e.message); }
    finally { c.close(); }
  }
  const pass = checks.filter((c) => c.pass).length;
  return { id, pass, total: checks.length, ms: Date.now() - t0, checks };
}

const PROBES = {
  "time-tracker": async (c, tmp, tier, ok) => {
    const a = await c.tool("timer_start", { project: "acme", task: "validation" }); ok(`${tier}: timer_start`, !a.isError, a.text);
    const b = await c.tool("timer_stop", {}); ok(`${tier}: timer_stop`, !b.isError && /s|min|h/.test(b.text), b.text);
    const now = new Date(); const from = new Date(now.getTime() - 86400e3).toISOString();
    const r = await c.tool("report", { from, to: new Date(now.getTime() + 3600e3).toISOString(), group_by: "project", format: "json" }); ok(`${tier}: report`, !r.isError && r.text.includes("acme"), r.text);
    const g = await c.tool("report", { from, to: now.toISOString(), group_by: "tag", format: "table" });
    ok(`${tier}: tag grouping ${tier === "pro" ? "allowed" : "gated with upgrade link"}`, tier === "pro" ? !/mcp\.zovo\.one/.test(g.text) : /mcp\.zovo\.one\/buy\/time-tracker/.test(g.text), g.text);
  },
  "price-tracker": async (c, tmp, tier, ok) => {
    const a = await c.tool("price_add_manual", { url: "https://example.com/p/1", price: "1.299,00", currency: "EUR", label: "probe" }); ok(`${tier}: price_add_manual normalises 1.299,00`, !a.isError && /1299/.test(a.text), a.text);
    const h = await c.tool("price_history", { url: "https://example.com/p/1" }); ok(`${tier}: price_history`, !h.isError && /1299/.test(h.text), h.text);
    const srv = createServer((req, res) => res.end(`<html><head><script type="application/ld+json">{"@type":"Product","name":"Probe ${req.url}","offers":{"@type":"Offer","price":"49.90","priceCurrency":"USD"}}</script></head><body>Probe</body></html>`));
    await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const port = srv.address().port;
    const first = await c.tool("watch_add", { url: `http://127.0.0.1:${port}/p/1`, label: "w1" }); ok(`${tier}: watch_add extracts JSON-LD price`, !first.isError && /49\.90/.test(first.text), first.text);
    for (let i = 2; i <= 3; i++) await c.tool("watch_add", { url: `http://127.0.0.1:${port}/p/${i}`, label: `w${i}` });
    const w = await c.tool("watch_add", { url: `http://127.0.0.1:${port}/p/4`, label: "w4" }); srv.close();
    ok(`${tier}: 4th+ watch ${tier === "pro" ? "allowed" : "gated"}`, tier === "pro" ? !/mcp\.zovo\.one/.test(w.text) : /mcp\.zovo\.one\/buy\/price-tracker/.test(w.text), w.text);
  },
  spreadsheet: async (c, tmp, tier, ok) => {
    const csv = join(tmp, "orders.csv");
    writeFileSync(csv, "Customer,Qty,Unit Price,Status\n" + Array.from({ length: 300 }, (_, i) => `C${i},${i % 7},${(i % 5) + 0.5},${i % 2 ? "open" : "closed"}`).join("\n") + "\n");
    const info = await c.tool("sheet_info", { path: csv }); ok(`${tier}: sheet_info`, !info.isError && /300/.test(info.text), info.text);
    const q = await c.tool("sheet_query", { path: csv, where: '[Qty] >= 5 AND [Status] = "open"', limit: 5 }); ok(`${tier}: sheet_query expression`, !q.isError && /open/.test(q.text), q.text);
    const out = join(tmp, "out.csv");
    const w = await c.tool("sheet_convert", { path: csv, to: "csv", out_path: out });
    const lines = existsSync(out) ? readFileSync(out, "utf8").trim().split("\n").length : 0;
    ok(`${tier}: convert 300 rows -> ${tier === "pro" ? "301 lines" : "capped 201 lines + upgrade"}`, tier === "pro" ? lines === 301 : (lines === 201 && /mcp\.zovo\.one/.test(w.text)), `${lines} lines`);
  },
  invoice: async (c, tmp, tier, ok) => {
    const b = await c.tool("business_set", { name: "Validator Ltd", default_currency: "EUR", default_tax_rate: 23 }); ok(`${tier}: business_set`, !b.isError, b.text);
    const cl = await c.tool("client_add", { name: "Acme" }); ok(`${tier}: client_add`, !cl.isError, cl.text);
    let last;
    for (let i = 1; i <= 4; i++) last = await c.tool("invoice_create", { client: "Acme", items: [{ description: `Work ${i}`, quantity: 12, unit_price: 90 }] });
    ok(`${tier}: 4th invoice in month ${tier === "pro" ? "allowed" : "gated"}`, tier === "pro" ? /INV-\d{4}-0004/.test(last.text) : /mcp\.zovo\.one\/buy\/invoice/.test(last.text), last.text);
    const list = await c.tool("invoice_list", {}); const num = (list.text.match(/INV-\d{4}-\d{4}/) || [])[0];
    const pdfPath = join(tmp, "inv.pdf");
    const p = await c.tool("invoice_pdf", { number: num, out_path: pdfPath });
    const head = existsSync(pdfPath) ? readFileSync(pdfPath).subarray(0, 5).toString() : "";
    ok(`${tier}: invoice_pdf writes a PDF`, head === "%PDF-" && statSync(pdfPath).size > 1024, `${num} ${head} ${existsSync(pdfPath) ? statSync(pdfPath).size : 0} bytes`);
    const total = (list.text.match(/1\s?328\.40|1328\.40/) || [])[0];
    ok(`${tier}: total 12 x 90 + 23% = 1328.40`, !!total, list.text.replace(/\s+/g, " ").slice(0, 120));
  },
};

async function billing() {
  const checks = []; const ok = (n, p, d = "") => checks.push({ name: n, pass: !!p, detail: String(d).slice(0, 160) });
  const t0 = Date.now();
  try {
    const h = await fetch("https://mcp.zovo.one/health").then((r) => r.json()); ok("health ok, live mode, signer ok", h.ok && h.stripe_mode === "live" && h.signer === "ok", JSON.stringify(h).slice(0, 120));
    for (const p of ["time-tracker", "price-tracker", "spreadsheet", "invoice", "bundle"]) { const r = await fetch(`https://mcp.zovo.one/buy/${p}`, { redirect: "manual" }); ok(`buy/${p} -> 303 to Stripe`, r.status === 303 && /checkout\.stripe\.com/.test(r.headers.get("location") || ""), `${r.status} ${(r.headers.get("location") || "").slice(0, 50)}`); }
    const key = sign("invoice"); const v = await fetch(`https://mcp.zovo.one/verify?key=${encodeURIComponent(key)}`).then((r) => r.json()); ok("verify accepts a locally signed key (same keypair as worker)", v.ok && v.product === "invoice", JSON.stringify(v));
    const bad = await fetch(`https://mcp.zovo.one/verify?key=MCPL1.abc.def`).then((r) => r.json()); ok("verify rejects garbage", bad.ok === false, JSON.stringify(bad));
    const w = await fetch("https://mcp.zovo.one/webhook", { method: "POST", body: "{}" }); ok("webhook rejects unsigned POST", w.status === 400, w.status);
    const nf = await fetch("https://mcp.zovo.one/buy/nope", { redirect: "manual" }); ok("unknown product 404", nf.status === 404, nf.status);
  } catch (e) { ok("exception", false, e.message); }
  return { id: "billing (mcp.zovo.one)", pass: checks.filter((c) => c.pass).length, total: checks.length, ms: Date.now() - t0, checks };
}

const results = [];
for (const id of Object.keys(PROBES)) { results.push(await runServer(id, PROBES[id])); console.log(`${id}: ${results.at(-1).pass}/${results.at(-1).total} in ${results.at(-1).ms} ms`); }
results.push(await billing()); console.log(`billing: ${results.at(-1).pass}/${results.at(-1).total}`);
const unit = JSON.parse(readFileSync(join(ROOT, "data/ledger.json"), "utf8")).servers.map((s) => ({ id: s.id, summary: s.test_summary }));
const run = { at: new Date().toISOString(), node: process.version, sdk: JSON.parse(readFileSync(join(ROOT, "node_modules/@modelcontextprotocol/sdk/package.json"), "utf8")).version, results, unit_tests: unit,
  pass: results.reduce((a, r) => a + r.pass, 0), total: results.reduce((a, r) => a + r.total, 0) };
const db = existsSync(DB) ? JSON.parse(readFileSync(DB, "utf8")) : { runs: [] };
db.runs.push(run); db.runs = db.runs.slice(-50);
writeFileSync(DB, JSON.stringify(db, null, 2));
console.log(`validation db: ${DB} run ${db.runs.length}: ${run.pass}/${run.total}`);
process.exit(run.pass === run.total ? 0 : 1);
