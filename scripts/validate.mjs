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
  resume: async (c, tmp, tier, ok) => {
    const prof = { name: "Ada Probe", email: "ada@example.com", summary: "Backend engineer.", skills: ["Go", "Postgres"], experience: [{ company: "Acme", title: "Engineer", start: "2022-01", bullets: ["Built the billing service handling 12000 invoices a month"] }], education: [{ school: "MIT", degree: "BSc" }] };
    const a = await c.tool("profile_set", prof); ok(`${tier}: profile_set`, !a.isError, a.text.slice(0, 80));
    const out = join(tmp, "cv.docx");
    const r = await c.tool("resume_create", { style: "modern", keywords: ["Go", "Kubernetes"], out_path: out }); ok(`${tier}: resume_create writes docx and reports keywords`, !r.isError && existsSync(out) && /Kubernetes/.test(r.text), r.text.slice(0, 100));
    const t = await c.tool("tailor_to_job", { job_description: "Senior Go engineer with Kubernetes and Postgres experience." }); ok(`${tier}: tailor_to_job matched and missing`, !t.isError && /kubernetes/i.test(t.text) && /\bgo\b/i.test(t.text), t.text.slice(0, 100));
    let last;
    for (let i = 1; i <= 4; i++) last = await c.tool("cover_letter_create", { company: `Co${i}`, role: "Engineer", tone: "direct", out_path: join(tmp, `cl${i}.docx`) });
    ok(`${tier}: 4th cover letter ${tier === "pro" ? "allowed" : "gated"}`, tier === "pro" ? !/mcp\.zovo\.one/.test(last.text) : /mcp\.zovo\.one\/buy\/resume/.test(last.text), last.text.slice(0, 100));
  },
  docx: async (c, tmp, tier, ok) => {
    const out = join(tmp, "md.docx");
    const a = await c.tool("doc_from_markdown", { markdown: "# Title\n\nHello **world**.\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n", out_path: out }); ok(`${tier}: doc_from_markdown writes docx`, !a.isError && existsSync(out) && readFileSync(out).subarray(0, 2).toString() === "PK", a.text.slice(0, 100));
    const r = await c.tool("doc_read", { path: out }); ok(`${tier}: doc_read returns text`, !r.isError && /Hello/.test(r.text) && /Title/.test(r.text), r.text.slice(0, 100));
    await c.tool("business_set", { name: "Validator Ltd" });
    let last;
    for (let i = 1; i <= 4; i++) last = await c.tool("proposal_create", { client: "Acme", project_title: `P${i}`, summary: "s", scope: ["a"], deliverables: ["d"], timeline: [{ phase: "x", duration: "1 week" }], price: { amount: 4500, currency: "EUR", terms: "50% upfront" }, out_path: join(tmp, `p${i}.docx`) });
    ok(`${tier}: 4th proposal ${tier === "pro" ? "allowed" : "gated"}`, tier === "pro" ? !/mcp\.zovo\.one/.test(last.text) : /mcp\.zovo\.one\/buy\/docx/.test(last.text), last.text.slice(0, 100));
  },
  timezone: async (c, tmp, tier, ok) => {
    const a = await c.tool("convert_time", { time: "2026-09-10 15:00", from_zone: "Europe/Warsaw", to_zones: ["America/Denver"] }); ok(`${tier}: convert_time Warsaw 15:00 -> Denver 07:00`, !a.isError && /07:00/.test(a.text), a.text.slice(0, 120));
    const parts = [{ name: "me", zone: "Europe/Warsaw" }, { name: "Sara", zone: "Australia/Sydney" }, { name: "Tom", zone: "America/Chicago" }];
    const sl = await c.tool("find_meeting_slots", { participants: parts, duration_minutes: 60, days: 5 }); ok(`${tier}: find_meeting_slots 3 participants answers`, !sl.isError, sl.text.slice(0, 100));
    const four = await c.tool("find_meeting_slots", { participants: [...parts, { name: "Ana", zone: "Europe/Lisbon" }], duration_minutes: 60, days: 5 }); ok(`${tier}: 4th participant ${tier === "pro" ? "allowed" : "gated"}`, tier === "pro" ? !/mcp\.zovo\.one/.test(four.text) : /mcp\.zovo\.one\/buy\/timezone/.test(four.text), four.text.slice(0, 100));
  },
  currency: async (c, tmp, tier, ok) => {
    const a = await c.tool("convert", { amount: 100, from: "USD", to: "PLN" }); ok(`${tier}: convert USD->PLN with rate date`, !a.isError && /PLN/.test(a.text) && /20\d\d-\d\d-\d\d/.test(a.text), a.text.slice(0, 120));
    const f = await c.tool("fx_rates_for", { target: "USD", currencies: ["EUR", "GBP"] }); ok(`${tier}: fx_rates_for shape`, !f.isError && /"EUR"/.test(f.text) && /"GBP"/.test(f.text), f.text.slice(0, 120));
    const h = await c.tool("rate_history", { from: "EUR", to: "USD", days: 91 }); ok(`${tier}: 91-day history ${tier === "pro" ? "allowed" : "gated"}`, tier === "pro" ? !/mcp\.zovo\.one/.test(h.text) : /mcp\.zovo\.one\/buy\/currency/.test(h.text), h.text.slice(0, 100));
  },
  "expense-tracker": async (c, tmp, tier, ok) => {
    const a = await c.tool("expense_add", { amount: 61.5, currency: "EUR", merchant: "Media Markt", project: "acme", billable: true, vat_rate: 23, note: "USB hub" }); ok(`${tier}: expense_add VAT split 50.00 + 11.50`, !a.isError && /50\.00/.test(a.text) && /11\.50/.test(a.text), a.text);
    const r = await c.tool("category_rules", { rules: [{ match: "bolt", category: "Travel" }] }); ok(`${tier}: category_rules`, !r.isError, r.text);
    const b = await c.tool("expense_add", { amount: 23, currency: "PLN", merchant: "Bolt" }); ok(`${tier}: rule auto-categorises Travel`, !b.isError && /Travel/.test(b.text), b.text);
    // D-R15: "today" is the LOCAL calendar date in every server now, so the probe window
    // must be local too; a UTC slice is yesterday for any run before UTC midnight in a
    // positive-offset zone, and the range then excludes the rows just written.
    const localDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const m = await c.tool("mileage_add", { km: 45, date: localDay(new Date()), purpose: "client meeting", region: "PL" }).catch(() => ({ text: "", isError: true }));
    ok(`${tier}: mileage 45 km PL = 51.75 PLN`, !m.isError && /51\.75/.test(m.text), m.text);
    const now = new Date(); const from = localDay(new Date(now.getFullYear(), now.getMonth(), 1)); const to = localDay(now);
    const sm = await c.tool("expense_summary", { from, to, group_by: "category" }); ok(`${tier}: summary by category per currency`, !sm.isError && /EUR/.test(sm.text) && /PLN/.test(sm.text), sm.text);
    if (tier === "pro") {
      const mk = await c.tool("expense_to_invoice", { project: "acme", from, to, markup_percent: 10 }); ok(`pro: markup allowed, net 50.00 x 1.10 = 55.00 + tax_rate`, !mk.isError && /55\.00|"unit_price": ?55/.test(mk.text) && /tax_rate/.test(mk.text), mk.text);
    } else {
      const mk = await c.tool("expense_to_invoice", { project: "acme", from, to, markup_percent: 10 }); ok(`free: markup free, net 50.00 x 1.10 = 55.00 + tax_rate`, !mk.isError && /55\.00|"unit_price": ?55/.test(mk.text) && /tax_rate/.test(mk.text), mk.text);
    }
  },
  "time-tracker": async (c, tmp, tier, ok) => {
    const a = await c.tool("timer_start", { project: "acme", task: "validation" }); ok(`${tier}: timer_start`, !a.isError, a.text);
    const b = await c.tool("timer_stop", {}); ok(`${tier}: timer_stop`, !b.isError && /s|min|h/.test(b.text), b.text);
    const now = new Date(); const from = new Date(now.getTime() - 86400e3).toISOString();
    const r = await c.tool("report", { from, to: new Date(now.getTime() + 3600e3).toISOString(), group_by: "project", format: "json" }); ok(`${tier}: report`, !r.isError && r.text.includes("acme"), r.text);
    // D-R22: tag grouping is FREE on both tiers now - it is a corrected total, not a
    // premium capability. Pro still keeps full history and unlimited rated projects.
    const g = await c.tool("report", { from, to: now.toISOString(), group_by: "tag", format: "table" });
    ok(`${tier}: tag grouping allowed (not gated)`, !g.isError && !/mcp\.zovo\.one/.test(g.text), g.text);
    // D-R22: group_by is optional and defaults to the plain total per currency.
    const p = await c.tool("report", { from, to: new Date(now.getTime() + 3600e3).toISOString(), format: "table" });
    ok(`${tier}: report without group_by returns a plain total`, !p.isError && /Total /.test(p.text) && !/\bproject\b\s*\|/.test(p.text), p.text);
    // D-R18: apply_to_existing re-stamps EVERY entry of the project.
    await c.tool("project_set_rate", { project: "acme", hourly_rate: 100, currency: "USD" });
    const rr = await c.tool("project_set_rate", { project: "acme", hourly_rate: 120, currency: "USD", apply_to_existing: true });
    ok(`${tier}: apply_to_existing re-rates logged entries and states the new total`, !rr.isError && /1 of 1 already logged entries re-rated/.test(rr.text) && /New total for "acme"/.test(rr.text), rr.text);
    const om = await c.tool("project_set_rate", { project: "acme", hourly_rate: 140, currency: "USD", apply_to_existing: true, only_missing: true });
    ok(`${tier}: only_missing true keeps the old fill-the-gaps behaviour`, !om.isError && /0 of 1 entries that had no rate of their own re-rated/.test(om.text), om.text);
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
    await c.tool("sheet_convert", { path: csv, to: "csv", out_path: out });
    const lines = existsSync(out) ? readFileSync(out, "utf8").trim().split("\n").length : 0;
    ok(`${tier}: convert 300 rows -> 301 lines (under the 500-row free write cap)`, lines === 301, `${lines} lines`);
    // D-1: over the free write cap nothing is written at all - no partial file that looks complete
    const csv600 = join(tmp, "orders600.csv");
    writeFileSync(csv600, "Customer,Qty,Unit Price,Status\n" + Array.from({ length: 600 }, (_, i) => `C${i},${i % 7},${(i % 5) + 0.5},${i % 2 ? "open" : "closed"}`).join("\n") + "\n");
    const out600 = join(tmp, "out600.csv");
    const w6 = await c.tool("sheet_convert", { path: csv600, to: "csv", out_path: out600 });
    const lines600 = existsSync(out600) ? readFileSync(out600, "utf8").trim().split("\n").length : 0;
    ok(`${tier}: convert 600 rows -> ${tier === "pro" ? "601 lines" : "refused, zero bytes written + upgrade"}`,
      tier === "pro" ? lines600 === 601 : (lines600 === 0 && !w6.isError && /Nothing was written/.test(w6.text) && /mcp\.zovo\.one/.test(w6.text)),
      `${lines600} lines`);
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

async function remote() {
  const checks = []; const ok = (n, p, d = "") => checks.push({ name: n, pass: !!p, detail: String(d).slice(0, 160) });
  const t0 = Date.now();
  try {
    const idx = await fetch("https://mcp.zovo.one/mcp").then((r) => r.json()); ok("index lists 3 endpoints", Array.isArray(idx.endpoints) ? idx.endpoints.length >= 3 : JSON.stringify(idx).includes("time-tracker"), JSON.stringify(idx).slice(0, 100));
    const mintRes = await fetch("https://mcp.zovo.one/mcp/token"); const mint = mintRes.status === 200 ? await mintRes.json() : { status: mintRes.status };
    ok("anonymous token minted (or per-IP mint limit 429 after repeated runs)", /^anon_[0-9a-f]{32}$/.test(mint.token || "") || mintRes.status === 429, mint.token || `HTTP ${mintRes.status}`);
    const tok = { token: sign("*") };  // probes use a bundle Pro key so validation runs never exhaust the anonymous mint limit
    const rpc = async (path, body) => fetch(`https://mcp.zovo.one/mcp/${path}`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${tok.token}` }, body: JSON.stringify(body) }).then((r) => r.json());
    for (const s of ["time-tracker", "price-tracker", "invoice", "expense-tracker", "spreadsheet", "currency", "timezone", "docx"]) { const r = await rpc(s, { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }); ok(`${s}: tools/list over HTTP`, (r.result?.tools || []).length >= 8, `${(r.result?.tools || []).length} tools`); }
    const ex = await rpc("expense-tracker", { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "expense_add", arguments: { amount: 61.5, currency: "EUR", merchant: "Media Markt", project: "acme", billable: true, vat_rate: 23 } } });
    ok("hosted expense_add splits 50.00 + 11.50", /50\.00/.test(JSON.stringify(ex)) && /11\.50/.test(JSON.stringify(ex)), JSON.stringify(ex).slice(0, 100));
    const ld = await rpc("spreadsheet", { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "sheet_load", arguments: { name: "probe", csv: "Region,Units\nNorth,5\nNorth,7\nSouth,2\n" } } });
    const q = await rpc("spreadsheet", { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "sheet_query", arguments: { path: "probe", group_by: ["Region"], aggregate: [{ col: "Units", fn: "sum", as: "total" }] } } });
    ok("hosted spreadsheet inline csv group_by sum (North 12)", !ld.error && /12/.test(JSON.stringify(q)), JSON.stringify(q).slice(0, 100));
    const cv = await rpc("currency", { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "convert", arguments: { amount: 100, from: "USD", to: "PLN" } } }); ok("hosted currency convert with rate date", /PLN/.test(JSON.stringify(cv)) && /20\d\d-\d\d-\d\d/.test(JSON.stringify(cv)), JSON.stringify(cv).slice(0, 100));
    const tz = await rpc("timezone", { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "convert_time", arguments: { time: "2026-09-10 15:00", from_zone: "Europe/Warsaw", to_zones: ["America/Denver"] } } }); ok("hosted timezone convert_time", /07:00/.test(JSON.stringify(tz)), JSON.stringify(tz).slice(0, 100));
    const dx = await rpc("docx", { jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "doc_from_markdown", arguments: { markdown: "# Probe\n\nhello" } } }); const dl = (JSON.stringify(dx).match(/https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]+/) || [])[0]; const dlr = dl ? await fetch(dl) : null; const head = dlr ? Buffer.from(await dlr.arrayBuffer()).subarray(0, 2).toString() : ""; ok("hosted docx download starts with PK", head === "PK", `${dl ? "link" : "no link"} ${head}`);
    const batch = await fetch("https://mcp.zovo.one/mcp/invoice", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${tok.token}` }, body: "[{}]" }); ok("JSON-RPC batch rejected 400", batch.status === 400, batch.status);
    const big = await fetch("https://mcp.zovo.one/mcp/invoice", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${tok.token}` }, body: "x".repeat(300 * 1024) }); ok("oversize body 413", big.status === 413, big.status);
    const ssrf = await rpc("price-tracker", { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "price_check", arguments: { url: "http://169.254.169.254/latest/meta-data/" } } }); ok("SSRF target refused", /refus|block|not allowed|private|denied|not a public address/i.test(JSON.stringify(ssrf)), JSON.stringify(ssrf).slice(0, 100));
    const a = await rpc("time-tracker", { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "timer_start", arguments: { project: "remote-probe" } } });
    const b = await rpc("time-tracker", { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "timer_status", arguments: {} } });
    ok("state persists across requests (KV)", !a.error && /remote-probe/.test(JSON.stringify(b)), JSON.stringify(b).slice(0, 100));
    const un = await fetch("https://mcp.zovo.one/mcp/invoice", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); ok("no token -> 401", un.status === 401, un.status);
  } catch (e) { ok("exception", false, e.message); }
  return { id: "remote (mcp.zovo.one/mcp)", pass: checks.filter((c) => c.pass).length, total: checks.length, ms: Date.now() - t0, checks };
}

async function billing() {
  const checks = []; const ok = (n, p, d = "") => checks.push({ name: n, pass: !!p, detail: String(d).slice(0, 160) });
  const t0 = Date.now();
  try {
    const h = await fetch("https://mcp.zovo.one/health").then((r) => r.json()); ok("health ok, live mode, signer ok", h.ok && h.stripe_mode === "live" && h.signer === "ok", JSON.stringify(h).slice(0, 120));
    for (const p of ["time-tracker", "price-tracker", "spreadsheet", "invoice", "expense-tracker", "currency", "docx", "timezone", "resume", "recurring", "clauses", "bundle"]) { const r = await fetch(`https://mcp.zovo.one/buy/${p}`, { redirect: "manual" }); ok(`buy/${p} -> 303 to Stripe`, r.status === 303 && /checkout\.stripe\.com/.test(r.headers.get("location") || ""), `${r.status} ${(r.headers.get("location") || "").slice(0, 50)}`); }
    const key = sign("invoice"); const v = await fetch(`https://mcp.zovo.one/verify?key=${encodeURIComponent(key)}`).then((r) => r.json()); ok("verify accepts a locally signed key (same keypair as worker)", v.ok && v.product === "invoice", JSON.stringify(v));
    const bad = await fetch(`https://mcp.zovo.one/verify?key=MCPL1.abc.def`).then((r) => r.json()); ok("verify rejects garbage", bad.ok === false, JSON.stringify(bad));
    const w = await fetch("https://mcp.zovo.one/webhook", { method: "POST", body: "{}" }); ok("webhook rejects unsigned POST", w.status === 400, w.status);
    const nf = await fetch("https://mcp.zovo.one/buy/nope", { redirect: "manual" }); ok("unknown product 404", nf.status === 404, nf.status);
  } catch (e) { ok("exception", false, e.message); }
  return { id: "billing (mcp.zovo.one)", pass: checks.filter((c) => c.pass).length, total: checks.length, ms: Date.now() - t0, checks };
}

const results = [];
for (const id of Object.keys(PROBES)) { results.push(await runServer(id, PROBES[id])); console.log(`${id}: ${results.at(-1).pass}/${results.at(-1).total} in ${results.at(-1).ms} ms`); }
results.push(await remote()); console.log(`remote: ${results.at(-1).pass}/${results.at(-1).total}`);
results.push(await billing()); console.log(`billing: ${results.at(-1).pass}/${results.at(-1).total}`);
const unit = JSON.parse(readFileSync(join(ROOT, "data/ledger.json"), "utf8")).servers.map((s) => ({ id: s.id, summary: s.test_summary }));
const run = { at: new Date().toISOString(), node: process.version, sdk: JSON.parse(readFileSync(join(ROOT, "node_modules/@modelcontextprotocol/sdk/package.json"), "utf8")).version, results, unit_tests: unit,
  pass: results.reduce((a, r) => a + r.pass, 0), total: results.reduce((a, r) => a + r.total, 0) };
const db = existsSync(DB) ? JSON.parse(readFileSync(DB, "utf8")) : { runs: [] };
db.runs.push(run); db.runs = db.runs.slice(-50);
writeFileSync(DB, JSON.stringify(db, null, 2));
console.log(`validation db: ${DB} run ${db.runs.length}: ${run.pass}/${run.total}`);
process.exit(run.pass === run.total ? 0 : 1);
