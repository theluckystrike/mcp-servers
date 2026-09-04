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
  const callTimeout = dir === "currency" ? 45000 : 8000;
  const proc = spawn("node", [join(ROOT, "servers", dir, "dist/index.js")], { env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe"] });
  let buf = ""; const waiters = new Map(); let id = 0; const stderr = [];
  proc.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue; try { const m = JSON.parse(line); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } } catch { stderr.push("NON-JSON STDOUT: " + line.slice(0, 120)); } } });
  proc.stderr.on("data", (d) => stderr.push(String(d).trim()));
  const call = (method, params = {}) => new Promise((res, rej) => { const i = ++id; const t = setTimeout(() => rej(new Error(`timeout ${method}`)), callTimeout); t.unref(); waiters.set(i, (m) => { clearTimeout(t); res(m); }); proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: i, method, params }) + "\n"); });
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
  barcode: async (c, tmp, tier, ok) => {
    const qr = await c.tool("qr_create", { text: "https://mcp.zovo.one/s/barcode" });
    ok(`${tier}: qr_create returns an inline SVG`, !qr.isError && /<svg/.test(qr.text) && /<\/svg>/.test(qr.text), qr.text.replace(/\s+/g, " ").slice(0, 80));
    const sepa = await c.tool("qr_payment_sepa", { name: "Zovo", iban: "DE89370400440532013000", amount: 120.5, reference: "INV-2026-0007", out_path: join(tmp, "sepa.svg") });
    ok(`${tier}: qr_payment_sepa draws a valid IBAN`, !sepa.isError && existsSync(join(tmp, "sepa.svg")), sepa.text.replace(/\s+/g, " ").slice(0, 90));
    const badIban = await c.tool("qr_payment_sepa", { name: "Zovo", iban: "DE89370400440532013001", out_path: join(tmp, "bad.svg") });
    ok(`${tier}: a wrong IBAN check digit is refused and nothing written`, badIban.isError && /check digit/i.test(badIban.text) && !existsSync(join(tmp, "bad.svg")), badIban.text.replace(/\s+/g, " ").slice(0, 110));
    const short = await c.tool("barcode_create", { symbology: "ean13", value: "590123412345", out_path: join(tmp, "ean.svg") });
    ok(`${tier}: ean13 check digit computed as 7`, !short.isError && /5901234123457/.test(short.text), short.text.replace(/\s+/g, " ").slice(0, 100));
    const wrong = await c.tool("barcode_create", { symbology: "ean13", value: "5901234123450", out_path: join(tmp, "wrong.svg") });
    ok(`${tier}: a wrong ean13 check digit is refused, never redrawn`, wrong.isError && /5901234123457/.test(wrong.text) && !existsSync(join(tmp, "wrong.svg")), wrong.text.replace(/\s+/g, " ").slice(0, 110));
    const png = join(tmp, "png.png");
    const p = await c.tool("qr_create", { text: "png gate", format: "png", size: 200, out_path: png });
    ok(`${tier}: PNG ${tier === "pro" ? "written" : "gated with the buy link"}`, tier === "pro" ? !p.isError && existsSync(png) : /mcp\.zovo\.one\/buy\/barcode/.test(p.text) && !existsSync(png), p.text.replace(/\s+/g, " ").slice(0, 100));
    const inv = await c.tool("invoice_payment_qr", { iban: "DE89370400440532013000", name: "Zovo", amount: 90, reference: "INV-2026-0009", out_path: join(tmp, "inv.svg") });
    ok(`${tier}: invoice_payment_qr draws or names the missing business profile`, !inv.isError ? existsSync(join(tmp, "inv.svg")) : /business|profile|invoice/i.test(inv.text), inv.text.replace(/\s+/g, " ").slice(0, 110));
    const cl = await c.tool("code_list", {});
    ok(`${tier}: code_list lists the register${tier === "pro" ? "" : " and the free allowance used"}`, !cl.isError && /\d+ code\(s\) in the register/.test(cl.text) && /text\/qr/.test(cl.text) && (tier === "pro" || /\d+ of 20 free codes used in \d{4}-\d{2}/.test(cl.text)), cl.text.replace(/\s+/g, " ").slice(0, 100));
  },
  quotes: async (c, tmp, tier, ok) => {
    const items = [{ description: "Design hours", quantity: 12, unit_price_minor: 9000, tax_rate: 23 }, { description: "Setup", quantity: 1, unit_price_minor: 30000, tax_rate: 23 }];
    const cr = await c.tool("quote_create", { client: "Acme Ltd", currency: "EUR", tax_rate: 23, validity_days: 14, items });
    const qid = (cr.text.match(/Q-\d{4}-\d{4}/) || [])[0];
    ok(`${tier}: quote_create allocates an id and totals 1697.40`, !cr.isError && !!qid && /1\s?697\.40|1697\.40/.test(cr.text), `${qid} ${cr.text.replace(/\s+/g, " ").slice(0, 90)}`);
    const ls = await c.tool("quote_list", {});
    ok(`${tier}: quote_list shows it open`, !ls.isError && ls.text.includes(qid) && /open/.test(ls.text), ls.text.replace(/\s+/g, " ").slice(0, 100));
    const txt = await c.tool("quote_send_text", { id: qid });
    ok(`${tier}: quote_send_text is free on both tiers`, !txt.isError && /Acme Ltd/.test(txt.text) && !/mcp\.zovo\.one/.test(txt.text), txt.text.replace(/\s+/g, " ").slice(0, 90));
    let last;
    for (let i = 2; i <= 6; i++) last = await c.tool("quote_create", { client: `Client ${i}`, currency: "EUR", tax_rate: 23, items: [{ description: `Work ${i}`, quantity: 1, unit_price_minor: 10000 }] });
    ok(`${tier}: 6th open quote ${tier === "pro" ? "allowed" : "gated"}`, tier === "pro" ? !last.isError && /Q-\d{4}-0006/.test(last.text) : /mcp\.zovo\.one\/buy\/quotes/.test(last.text), last.text.replace(/\s+/g, " ").slice(0, 100));
    const acc = await c.tool("quote_accept", { id: qid });
    ok(`${tier}: quote_accept invoices the agreed total`, !acc.isError && /INV-\d{4}-\d{4}|invoice_create_args/.test(acc.text) && /1\s?697\.40|1697\.40/.test(acc.text), acc.text.replace(/\s+/g, " ").slice(0, 120));
    const twice = await c.tool("quote_accept", { id: qid });
    ok(`${tier}: accepting the same quote twice is refused`, twice.isError && /already accepted/i.test(twice.text), twice.text.replace(/\s+/g, " ").slice(0, 110));
    const rep = await c.tool("quote_report", {});
    // D-R55: the report is a guardrail, so free answers it for the current year to date and names the cap.
    ok(`${tier}: quote_report gives the win rate${tier === "pro" ? "" : " with the free cap named"}`, !rep.isError && /win_rate/i.test(rep.text) && (tier === "pro" || /current calendar year to date/.test(rep.text)), rep.text.replace(/\s+/g, " ").slice(0, 100));
  },
  "bank-statement": async (c, tmp, tier, ok) => {
    const csv = "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\n" + [["2026-08-02","Spotify","-9.99"],["2026-08-05","Adobe","-61.50"],["2026-08-09","Coffee Bar","-3.50"],["2026-08-12","Nova Labs","4500.00"],["2026-09-02","Spotify","-9.99"],["2026-09-04","Adobe","-61.50"]].map(([d, desc, a]) => `CARD_PAYMENT,Current,${d} 10:00:00,${d} 10:00:01,${desc},${a},0.00,EUR,COMPLETED,1000.00`).join("\n") + "\n";
    const f = join(tmp, "revolut.csv"); writeFileSync(f, csv);
    const imp = await c.tool("statement_import", { path: f, account: "Main" }); ok(`${tier}: statement_import stores 6 rows`, !imp.isError && /6/.test(imp.text), imp.text.slice(0, 100));
    const again = await c.tool("statement_import", { path: f, account: "Main" }); ok(`${tier}: re-import stores 0 and reports duplicates`, !again.isError && /"duplicates_skipped":\s*6/.test(again.text) && /"imported":\s*0/.test(again.text), again.text.slice(0, 100));
    const rules = await c.tool("category_rules", { rules: [{ match: "spotify", category: "Software" }, { match: "adobe", category: "Software" }] }); ok(`${tier}: category_rules`, !rules.isError, rules.text.slice(0, 80));
    const sum = await c.tool("statement_summary", { from: "2026-08-01", to: "2026-08-31", group_by: "category" }); ok(`${tier}: summary shows Software 71.49 EUR`, !sum.isError && /71\.49/.test(sum.text), sum.text.slice(0, 120));
    const rec = await c.tool("recurring_detect", { months: 3 }); ok(`${tier}: recurring_detect finds Spotify${tier === "pro" ? "" : " with the free cap named"}`, !rec.isError && /Spotify/i.test(rec.text) && (tier === "pro" || /last 3 months and up to 5 recurring charges/.test(rec.text)), rec.text.slice(0, 100));
  },
  image: async (c, tmp, tier, ok) => {
    const { Jimp } = await import("jimp");
    const src = join(tmp, "in.png"); const img = new Jimp({ width: 640, height: 480, color: 0x3366ccff }); await img.write(src);
    const info = await c.tool("image_info", { path: src }); ok(`${tier}: image_info 640x480`, !info.isError && /640/.test(info.text) && /480/.test(info.text), info.text.slice(0, 80));
    const out = join(tmp, "out.png"); const rs = await c.tool("image_resize", { path: src, width: 320, fit: "inside", out_path: out }); ok(`${tier}: image_resize to 320 wide`, !rs.isError && existsSync(out) && /320/.test(rs.text), rs.text.slice(0, 80));
    const same = await c.tool("image_resize", { path: src, width: 100, out_path: src, overwrite: true }); ok(`${tier}: output equal to input refused`, same.isError || /refus|same|input/i.test(same.text), same.text.slice(0, 80));
    const paths = []; for (let i = 0; i < 6; i++) { const p = join(tmp, `b${i}.png`); await new Jimp({ width: 64, height: 64, color: 0xff0000ff }).write(p); paths.push(p); }
    const th = await c.tool("image_thumbnails", { paths, size: 32, out_dir: join(tmp, "th") }); ok(`${tier}: 6-file batch ${tier === "pro" ? "allowed" : "gated"}`, tier === "pro" ? !/mcp\.zovo\.one/.test(th.text) : /mcp\.zovo\.one\/buy\/image/.test(th.text), th.text.slice(0, 80));
  },
  kanban: async (c, tmp, tier, ok) => {
    const a = await c.tool("task_add", { title: "API design", project: "Nova", estimate_minutes: 180, due: "2026-09-10" }); ok(`${tier}: task_add returns an id`, !a.isError && /NOVA-\w+/.test(a.text), a.text.slice(0, 80));
    const id = (a.text.match(/NOVA-\w+/) || [""])[0];
    const mv = await c.tool("task_move", { id, column: "doing" }); ok(`${tier}: task_move to doing`, !mv.isError && /doing/.test(mv.text), mv.text.slice(0, 80));
    const b = await c.tool("board", { project: "Nova" }); ok(`${tier}: board shows one task in doing`, !b.isError && /doing\s+1\b/.test(b.text), b.text.slice(0, 120));
    const st = await c.tool("task_start_timer", { id }); ok(`${tier}: task_start_timer hands off timer_start args`, !st.isError && /timer_start/.test(st.text) && /Nova/.test(st.text), st.text.slice(0, 100));
    let last; for (const p of ["P2", "P3", "P4"]) last = await c.tool("task_add", { title: "x", project: p });
    ok(`${tier}: 4th project ${tier === "pro" ? "allowed" : "gated"}`, tier === "pro" ? !/mcp\.zovo\.one/.test(last.text) : /mcp\.zovo\.one\/buy\/kanban/.test(last.text), last.text.slice(0, 80));
  },
  calendar: async (c, tmp, tier, ok) => {
    const ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//probe//EN\r\nBEGIN:VEVENT\r\nUID:a1@probe\r\nDTSTART:20260910T090000Z\r\nDTEND:20260910T100000Z\r\nSUMMARY:Nova call\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:a2@probe\r\nDTSTART:20260910T093000Z\r\nDTEND:20260910T110000Z\r\nSUMMARY:Design review\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:a3@probe\r\nDTSTART;VALUE=DATE:20260912\r\nSUMMARY:Holiday\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    const imp = await c.tool("ics_import", { text: ics, name: "Work" }); ok(`${tier}: ics_import 3 events`, !imp.isError && /3/.test(imp.text), imp.text.slice(0, 80));
    const ev = await c.tool("events_list", { from: "2026-09-08", to: "2026-09-14", zone: "UTC" }); ok(`${tier}: events_list shows Nova call and Holiday`, !ev.isError && /Nova call/.test(ev.text) && /Holiday/.test(ev.text), ev.text.slice(0, 100));
    const cf = await c.tool("conflicts", { from: "2026-09-08", to: "2026-09-14" }); ok(`${tier}: conflicts finds the overlap`, !cf.isError && /Nova call/.test(cf.text) && /Design review/.test(cf.text), cf.text.slice(0, 100));
    const te = await c.tool("event_to_time_entry", { event_id: (ev.text.match(/\bwork\.[0-9a-f]+\.\d{8}T\d{6}\b/) || ["a1@probe"])[0], project: "Nova" }); ok(`${tier}: event_to_time_entry returns start/end/project`, !te.isError && /Nova/.test(te.text) && /2026-09-10/.test(te.text), te.text.slice(0, 100));
    for (const n of ["Second", "Third"]) { const r = await c.tool("ics_import", { text: ics.replace(/probe/g, n), name: n }); if (n === "Third") ok(`${tier}: 3rd calendar ${tier === "pro" ? "allowed" : "gated"}`, tier === "pro" ? !/mcp\.zovo\.one/.test(r.text) : /mcp\.zovo\.one\/buy\/calendar/.test(r.text), r.text.slice(0, 80)); }
  },
  pdf: async (c, tmp, tier, ok) => {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const mk = async (n, label) => { const d = await PDFDocument.create(); for (let i = 0; i < n; i++) { const pg = d.addPage([400, 300]); pg.drawText(`${label} page ${i + 1}`, { x: 40, y: 200, size: 18, font: await d.embedFont(StandardFonts.Helvetica) }); } const p = join(tmp, `${label}.pdf`); writeFileSync(p, await d.save()); return p; };
    const a = await mk(2, "a"), b = await mk(3, "b");
    const info = await c.tool("pdf_info", { path: a }); ok(`${tier}: pdf_info reports 2 pages`, !info.isError && /2/.test(info.text), info.text.slice(0, 80));
    const out = join(tmp, "merged.pdf");
    const m = await c.tool("pdf_merge", { paths: [a, b], out_path: out }); ok(`${tier}: pdf_merge writes 5 pages`, !m.isError && existsSync(out) && /5/.test(m.text), m.text.slice(0, 80));
    const st = await c.tool("pdf_stamp", { path: out, text: "PAID", position: "center", out_path: join(tmp, "paid.pdf") }); ok(`${tier}: pdf_stamp PAID`, !st.isError && existsSync(join(tmp, "paid.pdf")), st.text.slice(0, 80));
    const tx = await c.tool("pdf_text", { path: a }); ok(`${tier}: pdf_text reads the fixture`, !tx.isError && /a page 1/.test(tx.text), tx.text.slice(0, 80));
    const six = await c.tool("pdf_merge", { paths: [a, b, a, b, a, b], out_path: join(tmp, "six.pdf") }); ok(`${tier}: 6-file merge ${tier === "pro" ? "allowed" : "gated"}`, tier === "pro" ? !/mcp\.zovo\.one/.test(six.text) : /mcp\.zovo\.one\/buy\/pdf/.test(six.text) && !existsSync(join(tmp, "six.pdf")), six.text.slice(0, 80));
  },
  clauses: async (c, tmp, tier, ok) => {
    const s1 = await c.tool("clause_search", { query: "payment" }); ok(`${tier}: clause_search payment finds starter clauses`, !s1.isError && /payment/i.test(s1.text), s1.text.slice(0, 100));
    const ids = [...s1.text.matchAll(/\b(cl_[a-z0-9-]+|[a-z0-9]{6,}-[a-z0-9-]+|[a-z-]+_[a-z_]+)\b/g)].map((m) => m[1]).slice(0, 2);
    const asm = await c.tool("contract_assemble", { title: "Probe contract", categories: ["payment", "scope"], values: { client: "Acme Probe", fee: "4,500 EUR" }, client: "Acme Probe", out_path: join(tmp, "contract.docx"), format: "docx" });
    ok(`${tier}: contract_assemble writes docx with disclaimer`, !asm.isError && existsSync(join(tmp, "contract.docx")) && /legal advice/i.test(asm.text), asm.text.slice(0, 100));
    let last;
    for (let i = 1; i <= 11; i++) last = await c.tool("clause_add", { title: `Own clause ${i}`, body: `Body ${i} with {{var${i}}}`, category: "custom" });
    ok(`${tier}: 11th own clause ${tier === "pro" ? "allowed" : "gated"}`, tier === "pro" ? !/mcp\.zovo\.one/.test(last.text) : /mcp\.zovo\.one\/buy\/clauses/.test(last.text), last.text.slice(0, 100));
  },
  recurring: async (c, tmp, tier, ok) => {
    const a = await c.tool("schedule_create", { client: "Acme", items: [{ description: "Retainer", quantity: 12, unit_price: 90, tax_rate: 23 }], currency: "EUR", every: "monthly", start_date: "2026-07-01", due_days: 14 }); ok(`${tier}: schedule_create monthly`, !a.isError, a.text.slice(0, 100));
    const dry = await c.tool("invoice_generate_due", { as_of: "2026-09-01", dry_run: true }); ok(`${tier}: dry run reports due periods`, !dry.isError && /3|three/.test(dry.text), dry.text.slice(0, 100));
    const gen = await c.tool("invoice_generate_due", { as_of: "2026-09-01" }); ok(`${tier}: generate creates invoices at 1328.40`, !gen.isError && /1328\.40|1,328\.40/.test(gen.text), gen.text.slice(0, 120));
    const again = await c.tool("invoice_generate_due", { as_of: "2026-09-01" }); ok(`${tier}: second run creates none`, !again.isError && /created 0|0 created|skipped 3/i.test(again.text), again.text.slice(0, 100));
    let last;
    for (let i = 2; i <= 4; i++) last = await c.tool("schedule_create", { client: `C${i}`, items: [{ description: "x", quantity: 1, unit_price: 10 }], currency: "EUR", every: "monthly", start_date: "2026-09-01" });
    ok(`${tier}: 4th active schedule ${tier === "pro" ? "allowed" : "gated"}`, tier === "pro" ? !/mcp\.zovo\.one/.test(last.text) : /mcp\.zovo\.one\/buy\/recurring/.test(last.text), last.text.slice(0, 100));
  },
  resume: async (c, tmp, tier, ok) => {
    const prof = { name: "Ada Probe", email: "ada@example.com", summary: "Backend engineer.", skills: ["Go", "Postgres"], experience: [{ company: "Acme", title: "Engineer", start: "2022-01", bullets: ["Built the billing service handling 12000 invoices a month"] }], education: [{ school: "MIT", degree: "BSc" }] };
    const a = await c.tool("profile_set", prof); ok(`${tier}: profile_set`, !a.isError, a.text.slice(0, 80));
    const out = join(tmp, "cv.docx");
    const r = await c.tool("resume_create", { style: "modern", keywords: ["Go", "Kubernetes"], out_path: out }); ok(`${tier}: resume_create writes docx and reports keywords`, !r.isError && existsSync(out) && /Kubernetes/.test(r.text), r.text.slice(0, 100));
    const t = await c.tool("tailor_to_job", { job_description: "Senior Go engineer with Kubernetes and Postgres experience." }); ok(`${tier}: tailor_to_job matched and missing`, !t.isError && /kubernetes/i.test(t.text) && /postgres/i.test(t.text), t.text.slice(0, 100));
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
    const h = await c.tool("rate_history", { from: "EUR", to: "USD", days: 91 }); ok(`${tier}: 91-day history ${tier === "pro" ? "allowed" : "shortened to 90 days and answered"}`, tier === "pro" ? !/mcp\.zovo\.one/.test(h.text) : /Free tier reads 90 days back/.test(h.text) && /"rates"/.test(h.text), h.text.slice(0, 100));
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
    await new Promise((r) => setTimeout(r, 1200));
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
    const idx = await fetch("https://mcp.zovo.one/mcp").then((r) => r.json()); ok("index lists 17 endpoints", Array.isArray(idx.endpoints) ? idx.endpoints.length >= 17 : JSON.stringify(idx).includes("time-tracker"), JSON.stringify(idx).slice(0, 100));
    const mintRes = await fetch("https://mcp.zovo.one/mcp/token"); const mint = mintRes.status === 200 ? await mintRes.json() : { status: mintRes.status };
    ok("anonymous token minted (or per-IP mint limit 429 after repeated runs)", /^anon_[0-9a-f]{32}$/.test(mint.token || "") || mintRes.status === 429, mint.token || `HTTP ${mintRes.status}`);
    const tok = { token: sign("*") };  // probes use a bundle Pro key so validation runs never exhaust the anonymous mint limit
    const rpc = async (path, body) => fetch(`https://mcp.zovo.one/mcp/${path}`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${tok.token}` }, body: JSON.stringify(body) }).then((r) => r.json());
    for (const s of ["time-tracker", "price-tracker", "invoice", "expense-tracker", "spreadsheet", "currency", "timezone", "docx", "resume", "recurring", "clauses", "pdf", "calendar", "kanban", "image", "bank-statement", "quotes"]) { const r = await rpc(s, { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }); ok(`${s}: tools/list over HTTP`, (r.result?.tools || []).length >= 8, `${(r.result?.tools || []).length} tools`); }
    const ex = await rpc("expense-tracker", { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "expense_add", arguments: { amount: 61.5, currency: "EUR", merchant: "Media Markt", project: "acme", billable: true, vat_rate: 23 } } });
    ok("hosted expense_add splits 50.00 + 11.50", /50\.00/.test(JSON.stringify(ex)) && /11\.50/.test(JSON.stringify(ex)), JSON.stringify(ex).slice(0, 100));
    const ld = await rpc("spreadsheet", { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "sheet_load", arguments: { name: "probe", csv: "Region,Units\nNorth,5\nNorth,7\nSouth,2\n" } } });
    const q = await rpc("spreadsheet", { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "sheet_query", arguments: { path: "probe", group_by: ["Region"], aggregate: [{ col: "Units", fn: "sum", as: "total" }] } } });
    ok("hosted spreadsheet inline csv group_by sum (North 12)", !ld.error && /12/.test(JSON.stringify(q)), JSON.stringify(q).slice(0, 100));
    const cv = await rpc("currency", { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "convert", arguments: { amount: 100, from: "USD", to: "PLN" } } }); ok("hosted currency convert with rate date", /PLN/.test(JSON.stringify(cv)) && /20\d\d-\d\d-\d\d/.test(JSON.stringify(cv)), JSON.stringify(cv).slice(0, 100));
    const tz = await rpc("timezone", { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "convert_time", arguments: { time: "2026-09-10 15:00", from_zone: "Europe/Warsaw", to_zones: ["America/Denver"] } } }); ok("hosted timezone convert_time", /07:00/.test(JSON.stringify(tz)), JSON.stringify(tz).slice(0, 100));
    const dx = await rpc("docx", { jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "doc_from_markdown", arguments: { markdown: "# Probe\n\nhello" } } }); const dl = (JSON.stringify(dx).match(/https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]+/) || [])[0]; const dlr = dl ? await fetch(dl) : null; const head = dlr ? Buffer.from(await dlr.arrayBuffer()).subarray(0, 2).toString() : ""; ok("hosted docx download starts with PK", head === "PK", `${dl ? "link" : "no link"} ${head}`);
    const pset = await rpc("resume", { jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "profile_set", arguments: { name: "Remote Probe", email: "probe@example.com", summary: "Backend engineer.", skills: ["TypeScript"], experience: [{ company: "Probe Ltd", title: "Engineer", start: "2021", bullets: ["Shipped the hosted endpoint."] }] } } });
    const rc = await rpc("resume", { jsonrpc: "2.0", id: 12, method: "tools/call", params: { name: "resume_create", arguments: { target_role: "Engineer", overwrite: true } } });
    const rdl = (JSON.stringify(rc).match(/https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]+/) || [])[0];
    const rhead = rdl ? Buffer.from(await (await fetch(rdl)).arrayBuffer()).subarray(0, 2).toString() : "";
    ok("hosted resume profile_set + resume_create download starts with PK", !pset.error && rhead === "PK", `${rdl ? "link" : "no link"} ${rhead} ${JSON.stringify(rc).slice(0, 80)}`);
    const sc = await rpc("recurring", { jsonrpc: "2.0", id: 13, method: "tools/call", params: { name: "schedule_create", arguments: { client: `Probe ${Date.now()}`, every: "monthly", start_date: "2026-07-01", currency: "EUR", items: [{ description: "Retainer", quantity: 1, unit_price: 150000 }] } } });
    const gen = await rpc("recurring", { jsonrpc: "2.0", id: 14, method: "tools/call", params: { name: "invoice_generate_due", arguments: {} } });
    ok("hosted recurring schedule_create + invoice_generate_due writes the invoice store", !sc.error && /INV-\d{4}-\d{4}/.test(JSON.stringify(gen)), JSON.stringify(gen).slice(0, 120));
    const cs = await rpc("clauses", { jsonrpc: "2.0", id: 15, method: "tools/call", params: { name: "clause_search", arguments: { query: "payment" } } });
    const ca = await rpc("clauses", { jsonrpc: "2.0", id: 16, method: "tools/call", params: { name: "contract_assemble", arguments: { title: `Probe ${Date.now()}`, categories: ["payment"], client: "Probe Corp", values: { fee: "4500" }, overwrite: true } } });
    const cdl = (JSON.stringify(ca).match(/https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]+/) || [])[0];
    const chead = cdl ? Buffer.from(await (await fetch(cdl)).arrayBuffer()).subarray(0, 2).toString() : "";
    ok("hosted clauses clause_search + contract_assemble download starts with PK", /payment-terms/.test(JSON.stringify(cs)) && chead === "PK", `${cdl ? "link" : "no link"} ${chead}`);
    const { PDFDocument: RemotePdfDoc, StandardFonts: RemoteFonts } = await import("pdf-lib");
    const probeDoc = await RemotePdfDoc.create();
    const probeFont = await probeDoc.embedFont(RemoteFonts.Helvetica);
    for (let i = 0; i < 2; i++) probeDoc.addPage([400, 300]).drawText(`remote probe page ${i + 1}`, { x: 40, y: 200, size: 18, font: probeFont });
    const probeB64 = Buffer.from(await probeDoc.save()).toString("base64");
    const pup = await rpc("pdf", { jsonrpc: "2.0", id: 17, method: "tools/call", params: { name: "pdf_upload", arguments: { name: "probe", pdf_base64: probeB64 } } });
    const pinfo = await rpc("pdf", { jsonrpc: "2.0", id: 18, method: "tools/call", params: { name: "pdf_info", arguments: { path: "probe" } } });
    const pstamp = await rpc("pdf", { jsonrpc: "2.0", id: 19, method: "tools/call", params: { name: "pdf_stamp", arguments: { path: "probe", text: "PAID", position: "center", out_path: "probe-paid", overwrite: true } } });
    const pdl = (JSON.stringify(pstamp).match(/https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]+/) || [])[0];
    const pres = pdl ? await fetch(pdl) : null;
    const phead = pres ? Buffer.from(await pres.arrayBuffer()).subarray(0, 5).toString() : "";
    ok("hosted pdf upload + pdf_info(2 pages) + pdf_stamp PAID download starts with %PDF-", !pup.error && /"pages": 2/.test(JSON.stringify(pinfo).replace(/\\n/g, "\n").replace(/\\"/g, '"')) && phead === "%PDF-" && (pres?.headers.get("content-type") || "") === "application/pdf", `${pdl ? "link" : "no link"} ${phead} ${pres?.headers.get("content-type")}`);
    const ptext = await rpc("pdf", { jsonrpc: "2.0", id: 20, method: "tools/call", params: { name: "pdf_text", arguments: { path: "probe" } } });
    ok("hosted pdf_text decompresses with node:zlib under nodejs_compat", /remote probe page 1/.test(JSON.stringify(ptext)), JSON.stringify(ptext).slice(0, 90));
    const calIcs = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//validate//EN",
      "BEGIN:VEVENT", "UID:v1@probe", "DTSTART:20260910T090000Z", "DTEND:20260910T100000Z", "SUMMARY:Nova call", "END:VEVENT",
      "BEGIN:VEVENT", "UID:v2@probe", "DTSTART:20260910T093000Z", "DTEND:20260910T110000Z", "SUMMARY:Design review", "END:VEVENT",
      "BEGIN:VEVENT", "UID:v3@probe", "DTSTART;VALUE=DATE:20260912", "SUMMARY:Holiday", "END:VEVENT",
      "END:VCALENDAR", ""].join("\r\n");
    const cimp = await rpc("calendar", { jsonrpc: "2.0", id: 21, method: "tools/call", params: { name: "ics_import", arguments: { text: calIcs, name: "Work" } } });
    const cev = await rpc("calendar", { jsonrpc: "2.0", id: 22, method: "tools/call", params: { name: "events_list", arguments: { from: "2026-09-08", to: "2026-09-14", zone: "UTC" } } });
    const cexp = await rpc("calendar", { jsonrpc: "2.0", id: 23, method: "tools/call", params: { name: "event_export", arguments: { from: "2026-09-08", to: "2026-09-14", out_path: "week.ics" } } });
    const cdl2 = (JSON.stringify(cexp).match(/https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]+/) || [])[0];
    const cbody = cdl2 ? await (await fetch(cdl2)).text() : "";
    ok("hosted calendar ics_import(3) + events_list + event_export download starts with BEGIN:VCALENDAR", !cimp.error && /Nova call/.test(JSON.stringify(cev)) && /Holiday/.test(JSON.stringify(cev)) && cbody.startsWith("BEGIN:VCALENDAR"), `${cdl2 ? "link" : "no link"} ${cbody.slice(0, 20)}`);
    const cssrf = await rpc("calendar", { jsonrpc: "2.0", id: 24, method: "tools/call", params: { name: "ics_import", arguments: { url: "http://169.254.169.254/latest/meta-data/", name: "meta" } } });
    ok("calendar feed SSRF target refused", /not a public address/.test(JSON.stringify(cssrf)), JSON.stringify(cssrf).slice(0, 90));
    const urlTok = await fetch(`https://mcp.zovo.one/mcp/time-tracker/t/${tok.token}`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 11, method: "tools/list", params: {} }) }).then((r) => r.json()); ok("url-token path lists tools with no headers", (urlTok.result?.tools || []).length >= 8, `${(urlTok.result?.tools || []).length} tools`);
    const who = await fetch(`https://mcp.zovo.one/mcp/whoami/t/${tok.token}`).then((r) => r.json()); ok("whoami reports tier pro for a signed key", who.tier === "pro", JSON.stringify(who).slice(0, 100));
    const con = await fetch("https://mcp.zovo.one/mcp/connect"); ok("connect page 200 or per-IP 429", con.status === 200 || con.status === 429, con.status);
    const ka = await rpc("kanban", { jsonrpc: "2.0", id: 21, method: "tools/call", params: { name: "task_add", arguments: { project: "Nova Site", title: "Ship the hosted board", due: "2026-09-10", estimate_minutes: 90, priority: "high" } } });
    const kb = await rpc("kanban", { jsonrpc: "2.0", id: 22, method: "tools/call", params: { name: "board", arguments: {} } });
    ok("hosted kanban task_add + board shows the task on the new board", !ka.error && /NS-1/.test(JSON.stringify(ka)) && /Nova Site/.test(JSON.stringify(kb)) && /1h 30m/.test(JSON.stringify(kb)), JSON.stringify(kb).slice(0, 100));
    const { Jimp: RemoteJimp } = await import("jimp");
    const probeImg = new RemoteJimp({ width: 64, height: 64, color: 0x1b7f3bff });
    for (let x = 0; x < 64; x++) for (let y = 0; y < 32; y++) probeImg.setPixelColor(0xd94f2bff, x, y);
    const probePng = Buffer.from(await probeImg.getBuffer("image/png"));
    const iup = await rpc("image", { jsonrpc: "2.0", id: 23, method: "tools/call", params: { name: "image_upload", arguments: { name: "probe", image_base64: probePng.toString("base64") } } });
    const iinfo = await rpc("image", { jsonrpc: "2.0", id: 24, method: "tools/call", params: { name: "image_info", arguments: { path: "probe" } } });
    const irz = await rpc("image", { jsonrpc: "2.0", id: 25, method: "tools/call", params: { name: "image_resize", arguments: { path: "probe", width: 32, height: 32, out_path: "probe-32", overwrite: true } } });
    const idl = (JSON.stringify(irz).match(/https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]+/) || [])[0];
    const ires = idl ? await fetch(idl) : null;
    const ihead = ires ? Buffer.from(await ires.arrayBuffer()).subarray(0, 8).toString("hex") : "";
    ok("hosted image upload + image_info(64x64 png) + image_resize download is a PNG served image/png", !iup.error && /"width": 64/.test(JSON.stringify(iinfo).replace(/\\n/g, "\n").replace(/\\"/g, '"')) && ihead === "89504e470d0a1a0a" && (ires?.headers.get("content-type") || "") === "image/png", `${idl ? "link" : "no link"} ${ihead} ${ires?.headers.get("content-type")}`);
    const icv = await rpc("image", { jsonrpc: "2.0", id: 26, method: "tools/call", params: { name: "image_convert", arguments: { path: "probe", format: "jpeg", out_path: "probe-j", overwrite: true } } });
    ok("hosted image jimp decode + encode round trip under nodejs_compat (png -> jpeg)", /Converted PNG to JPEG/.test(JSON.stringify(icv)), JSON.stringify(icv).slice(0, 90));
    const bankCsv = ["Date,Description,Amount,Currency", "2026-07-03,NETFLIX.COM AMSTERDAM,-12.99,EUR", "2026-08-03,NETFLIX.COM AMSTERDAM,-12.99,EUR", "2026-09-03,NETFLIX.COM AMSTERDAM,-12.99,EUR", "2026-09-01,Hetzner Online GmbH,-61.50,EUR", "2026-09-05,ACME GMBH INVOICE 12,1200.00,EUR", ""].join("\n");
    const bnm = `probe${Date.now().toString(36)}`;
    const bup = await rpc("bank-statement", { jsonrpc: "2.0", id: 27, method: "tools/call", params: { name: "bank_upload", arguments: { name: bnm, content: bankCsv } } });
    const bi1 = await rpc("bank-statement", { jsonrpc: "2.0", id: 28, method: "tools/call", params: { name: "statement_import", arguments: { path: bnm, account: bnm } } });
    const bi2 = await rpc("bank-statement", { jsonrpc: "2.0", id: 29, method: "tools/call", params: { name: "statement_import", arguments: { path: bnm, account: bnm } } });
    ok("hosted bank_upload + statement_import(5 rows) + re-import skips 5 duplicates", !bup.error && /"imported": 5/.test(JSON.stringify(bi1).replace(/\\n/g, "\n").replace(/\\"/g, '"')) && /"duplicates_skipped": 5/.test(JSON.stringify(bi2).replace(/\\n/g, "\n").replace(/\\"/g, '"')), JSON.stringify(bi2).slice(0, 120));
    const brec = await rpc("bank-statement", { jsonrpc: "2.0", id: 30, method: "tools/call", params: { name: "recurring_detect", arguments: { months: 6, account: bnm } } });
    ok("hosted bank recurring_detect finds the monthly NETFLIX charge", /NETFLIX/.test(JSON.stringify(brec)) && /monthly/.test(JSON.stringify(brec)), JSON.stringify(brec).slice(0, 120));
    const bex = await rpc("bank-statement", { jsonrpc: "2.0", id: 31, method: "tools/call", params: { name: "statement_export", arguments: { from: "2026-07-01", to: "2026-09-30", format: "csv", path: bnm, account: bnm } } });
    const bdl = (JSON.stringify(bex).match(/https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]+/) || [])[0];
    const bres = bdl ? await fetch(bdl) : null;
    const bbody = bres ? await bres.text() : "";
    ok("hosted bank statement_export download is text/csv and carries the rows", bbody.startsWith("id,date,account,") && /NETFLIX/.test(bbody) && (bres?.headers.get("content-type") || "").startsWith("text/csv"), `${bdl ? "link" : "no link"} ${bres?.headers.get("content-type")}`);
    const qbiz = await rpc("invoice", { jsonrpc: "2.0", id: 32, method: "tools/call", params: { name: "business_set", arguments: { name: "Probe Studio", default_currency: "EUR", default_tax_rate: 23 } } });
    const qc = await rpc("quotes", { jsonrpc: "2.0", id: 33, method: "tools/call", params: { name: "quote_create", arguments: { client: `Probe ${Date.now()}`, items: [{ description: "Design sprint", quantity: 12, unit_price_minor: 9000 }] } } });
    const qid = (JSON.stringify(qc).match(/Q-\d{4}-\d{4}/) || [])[0];
    ok("hosted quote_create: 12 x 90.00 + 23% = EUR 1328.40", !qc.error && /1328\.40/.test(JSON.stringify(qc)), `${qid} ${JSON.stringify(qc).slice(0, 80)}`);
    const qpdf = await rpc("quotes", { jsonrpc: "2.0", id: 34, method: "tools/call", params: { name: "quote_pdf", arguments: { id: qid, out_path: "probe-quote" } } });
    const qdl = (JSON.stringify(qpdf).match(/https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]+/) || [])[0];
    const qres = qdl ? await fetch(qdl) : null;
    const qbody = qres ? await qres.text() : "";
    ok("hosted quote_pdf download is the HTML quote served text/html (no PDF renderer on Workers)", qbody.startsWith("<!doctype html") && qbody.includes(`<title>Quote ${qid}`) && (qres?.headers.get("content-type") || "").startsWith("text/html"), `${qdl ? "link" : "no link"} ${qres?.headers.get("content-type")}`);
    const qacc = await rpc("quotes", { jsonrpc: "2.0", id: 35, method: "tools/call", params: { name: "quote_accept", arguments: { id: qid, create_invoice: "always" } } });
    const qinv = (JSON.stringify(qacc).match(/INV-\d{4}-\d{4}/) || [])[0];
    const qil = await rpc("invoice", { jsonrpc: "2.0", id: 36, method: "tools/call", params: { name: "invoice_list", arguments: {} } });
    ok("hosted quote_accept writes the invoice into the store /mcp/invoice serves for the same token", !qbiz.error && !!qinv && new RegExp(qinv).test(JSON.stringify(qil)) && /1328\.40/.test(JSON.stringify(qil)), `${qinv} ${JSON.stringify(qil).slice(0, 80)}`);
    const bound = await fetch("https://mcp.zovo.one/bound?tenant=anon_00000000000000000000000000000000").then((r) => r.json()); ok("bound endpoint answers for an unknown tenant", bound.bound === false, JSON.stringify(bound).slice(0, 80));
    const buyT = await fetch("https://mcp.zovo.one/buy/invoice?tenant=anon_00000000000000000000000000000000", { redirect: "manual", headers: { "x-mcp-probe": "1" } }); ok("buy with tenant still 303 to Stripe", buyT.status === 303, buyT.status);
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
    for (const p of ["time-tracker", "price-tracker", "spreadsheet", "invoice", "expense-tracker", "currency", "docx", "timezone", "resume", "recurring", "clauses", "pdf", "calendar", "kanban", "image", "bank-statement", "quotes", "barcode", "bundle"]) { const r = await fetch(`https://mcp.zovo.one/buy/${p}`, { redirect: "manual", headers: { "x-mcp-probe": "1" } }); ok(`buy/${p} -> 303 to Stripe`, r.status === 303 && /checkout\.stripe\.com/.test(r.headers.get("location") || ""), `${r.status} ${(r.headers.get("location") || "").slice(0, 50)}`); }
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
