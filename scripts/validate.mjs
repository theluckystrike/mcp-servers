#!/usr/bin/env node
// Live validation of every server + billing, appended to data/validation.json (the validation database).
// Each run: spawn dist/index.js over stdio, initialize, tools/list, real tool calls, free gate, pro gate, timing.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
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

const CRCT = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = CRCT[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function storedZip(entries) {
  const locals = [], centrals = []; let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8"), body = Buffer.from(e.data, "utf8"), crc = crc32(body);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(0x6000, 10); lh.writeUInt16LE(0x590e, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(body.length, 22); lh.writeUInt16LE(name.length, 26);
    locals.push(lh, name, body);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE((3 << 8) | 20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(0x6000, 12); ch.writeUInt16LE(0x590e, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(body.length, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE((0o100644 << 16) >>> 0, 38); ch.writeUInt32LE(off, 42);
    centrals.push(ch, name); off += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(centrals), lo = Buffer.concat(locals);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(lo.length, 16);
  return Buffer.concat([lo, cd, eocd]);
}

const PROBES = {
  deposits: async (c, tmp, tier, ok) => {
    // Same reasoning as billing-docs: the invoice store is seeded directly rather than by
    // spawning servers/invoice, so a failure here means deposits failed. INV-2026-0001 is
    // seeded with paid_minor ALREADY at 20000 (a EUR 200.00 transfer) on purpose: that is
    // the only way to prove deposit_apply adds to the field instead of assigning it.
    const dInvDir = join(tmp, "data", "mcp-servers", "invoice");
    mkdirSync(dInvDir, { recursive: true });
    const dLine = (description, unit, rate) => ({ description, quantity: 1, unit_price_minor: unit, tax_rate: rate, gross_minor: unit, discount_minor: 0, net_minor: unit, tax_minor: Math.round(unit * rate / 100), exact_gross_minor: unit, round_total: false });
    const dInvoice = (number, currency, lines, paid = 0) => {
      const net = lines.reduce((n, l) => n + l.net_minor, 0);
      const tax = lines.reduce((n, l) => n + l.tax_minor, 0);
      return { number, client_id: "c1", client: { name: "Acme Ltd" }, issue_date: "2026-09-01", due_date: "2026-09-15", currency, decimals: 2, lines, subtotal_minor: net, discount_percent: 0, discount_minor: 0, net_minor: net, tax_lines: tax ? [{ rate: lines[0].tax_rate, base_minor: net, tax_minor: tax }] : [], tax_minor: tax, total_minor: net + tax, status: paid ? "partial" : "unpaid", paid_minor: paid, created: "2026-09-01T00:00:00.000Z", branded: true };
    };
    const dInvPath = join(dInvDir, "invoices.json");
    writeFileSync(dInvPath, JSON.stringify([
      dInvoice("INV-2026-0001", "EUR", [dLine("Consulting", 100000, 23)], 20000),
      dInvoice("INV-2026-0002", "USD", [dLine("Support", 40000, 0)]),
      dInvoice("INV-2026-0003", "EUR", [dLine("Retainer month", 10000, 0)]),
    ], null, 2));
    writeFileSync(join(dInvDir, "clients.json"), JSON.stringify([{ id: "c1", name: "Acme Ltd", address: "12 Dame St\nDublin", email: "ap@acme.example", created: "2026-09-01" }], null, 2));

    // 1. Record. EUR 500.00 in minor units, held in full, id shape asserted.
    const rec = await c.tool("deposit_record", { client: "Acme Ltd", amount_minor: 50000, currency: "EUR", kind: "security", received_date: "2026-09-01", reference: "SEPA 88213" });
    ok(`${tier}: deposit_record holds EUR 500.00 as DEP-YYYY-NNNN`,
      !rec.isError && /"id": "DEP-\d{4}-0001"/.test(rec.text) && /"received": "EUR 500\.00"/.test(rec.text) && /"held": "EUR 500\.00"/.test(rec.text) && /"status": "held"/.test(rec.text),
      rec.text.replace(/\s+/g, " ").slice(0, 130));

    // 2. THE measured one: applying on top of a payment that is already on the invoice.
    // 20000 + 30000 = 50000. An assigning write path would leave 30000 and pass every
    // schema check, so the store is read back rather than trusting the reply.
    const app = await c.tool("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 30000, date: "2026-09-05" });
    const paidAfter = JSON.parse(readFileSync(dInvPath, "utf8")).find((i) => i.number === "INV-2026-0001").paid_minor;
    ok(`${tier}: deposit_apply ADDS to the invoice's paid_minor (20000 + 30000 = 50000)`,
      !app.isError && paidAfter === 50000 && /"paid": "EUR 500\.00"/.test(app.text) && /"balance_due": "EUR 730\.00"/.test(app.text) && /"held": "EUR 200\.00"/.test(app.text),
      `paid_minor ${paidAfter}; ${app.text.replace(/\s+/g, " ").slice(0, 110)}`);

    // 3. Over-apply: more than is HELD. Named in the refusal, and nothing written.
    const over = await c.tool("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0001", amount_minor: 20001, date: "2026-09-05" });
    const paidStill = JSON.parse(readFileSync(dInvPath, "utf8")).find((i) => i.number === "INV-2026-0001").paid_minor;
    ok(`${tier}: one cent past what is held is refused and nothing is written`,
      over.isError && /holds EUR 200\.00/.test(over.text) && /EUR 200\.01/.test(over.text) && /Nothing was changed/.test(over.text) && paidStill === 50000,
      over.text.replace(/\s+/g, " ").slice(0, 130));

    // 4. Over-apply the OTHER way: more than the invoice still owes. INV-2026-0003 is
    // EUR 100.00, the deposit holds EUR 200.00, so the cap that bites is the invoice's.
    const overInv = await c.tool("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0003", amount_minor: 20000, date: "2026-09-05" });
    ok(`${tier}: more than the invoice still owes is refused, naming the invoice's balance`,
      overInv.isError && /EUR 100\.00/.test(overInv.text) && /overpaid|owes/.test(overInv.text),
      overInv.text.replace(/\s+/g, " ").slice(0, 130));

    // 5. Currency: never converted, both currencies named, nothing written on either side.
    const cross = await c.tool("deposit_apply", { id: "DEP-2026-0001", invoice: "INV-2026-0002", amount_minor: 10000, date: "2026-09-05" });
    ok(`${tier}: a EUR deposit against a USD invoice is refused, never converted`,
      cross.isError && /EUR/.test(cross.text) && /USD/.test(cross.text) && /never converted/.test(cross.text) && /Nothing was changed/.test(cross.text),
      cross.text.replace(/\s+/g, " ").slice(0, 130));

    // 6. Refund: over-refund refused naming what is held, then a real refund closes it out.
    const badRef = await c.tool("deposit_refund", { id: "DEP-2026-0001", amount_minor: 20001, date: "2026-09-05", method: "bank transfer" });
    ok(`${tier}: refunding more than is held is refused, naming what is held`,
      badRef.isError && /EUR 200\.00/.test(badRef.text), badRef.text.replace(/\s+/g, " ").slice(0, 130));
    const ref = await c.tool("deposit_refund", { id: "DEP-2026-0001", amount_minor: 20000, date: "2026-09-05", method: "bank transfer" });
    const paidAfterRefund = JSON.parse(readFileSync(dInvPath, "utf8")).find((i) => i.number === "INV-2026-0001").paid_minor;
    ok(`${tier}: a refund closes the deposit and does NOT touch the invoice`,
      !ref.isError && /"refunded": "EUR 200\.00"/.test(ref.text) && /"held": "EUR 0\.00"/.test(ref.text) && paidAfterRefund === 50000,
      `paid_minor ${paidAfterRefund}; ${ref.text.replace(/\s+/g, " ").slice(0, 110)}`);

    // 7. Balance: one row per currency, never summed across them, and the basis is stated.
    const bal = await c.tool("deposit_balance", { client: "Acme Ltd" });
    ok(`${tier}: deposit_balance reports received, applied, refunded and held`,
      !bal.isError && /"received": "EUR 500\.00"/.test(bal.text) && /"applied": "EUR 300\.00"/.test(bal.text) && /"refunded": "EUR 200\.00"/.test(bal.text) && /"held": "EUR 0\.00"/.test(bal.text) && /"currency": "EUR"/.test(bal.text),
      bal.text.replace(/\s+/g, " ").slice(0, 130));

    // 8. The text statement is free on BOTH tiers and carries no buy link.
    const st = await c.tool("deposit_statement_text", { client: "Acme Ltd", currency: "EUR" });
    ok(`${tier}: deposit_statement_text is free on both tiers and carries no buy link`,
      !st.isError && /DEP-\d{4}-0001/.test(st.text) && /EUR 500\.00/.test(st.text) && !/mcp\.zovo\.one\/buy/.test(st.text),
      st.text.replace(/\s+/g, " ").slice(0, 130));

    // 9. Report gate, written per tier so a gate that stopped working fails on free.
    const rep = await c.tool("deposits_report", {});
    ok(`${tier}: deposits_report is ${tier === "pro" ? "allowed and reports held per currency" : "Pro and names the buy link"}`,
      tier === "pro" ? !rep.isError && /held|EUR/.test(rep.text) : rep.isError && /mcp\.zovo\.one\/buy\/deposits/.test(rep.text),
      rep.text.replace(/\s+/g, " ").slice(0, 130));

    // Same shape for the PDF: Pro writes a real file, free names the link and writes nothing.
    const pdfPath = join(tmp, "dep.pdf");
    const spdf = await c.tool("deposit_statement_pdf", { client: "Acme Ltd", currency: "EUR", out_path: pdfPath });
    ok(`${tier}: deposit_statement_pdf ${tier === "pro" ? "writes an A4 file over 1 KB" : "is refused and writes no file"}`,
      tier === "pro" ? !spdf.isError && existsSync(pdfPath) && statSync(pdfPath).size > 1000 : spdf.isError && /mcp\.zovo\.one\/buy\/deposits/.test(spdf.text) && !existsSync(pdfPath),
      spdf.text.replace(/\s+/g, " ").slice(0, 130));

    // 10. The free cap counts RECORDS only. One exists, so the fifth lands and the sixth
    // is refused naming the count and the buy link; Pro gets DEP-2026-0006.
    let lastRec = null;
    for (let n = 2; n <= 6; n++) {
      lastRec = await c.tool("deposit_record", { client: "Acme Ltd", amount_minor: 1000, currency: "EUR", kind: "retainer", received_date: "2026-09-10" });
    }
    ok(`${tier}: the 6th deposit in a month is ${tier === "pro" ? "allowed" : "refused, naming the count and the buy link"}`,
      tier === "pro" ? !lastRec.isError && /DEP-\d{4}-0006/.test(lastRec.text) : lastRec.isError && /mcp\.zovo\.one\/buy\/deposits/.test(lastRec.text) && /5/.test(lastRec.text),
      lastRec.text.replace(/\s+/g, " ").slice(0, 130));

    // A deposit received in another month is not blocked by this month's five.
    const nextMonth = await c.tool("deposit_record", { client: "Acme Ltd", amount_minor: 1000, currency: "EUR", kind: "retainer", received_date: "2026-10-02" });
    ok(`${tier}: a deposit received in another month is not blocked by this month's count`,
      !nextMonth.isError && /DEP-\d{4}-\d{4}/.test(nextMonth.text), nextMonth.text.replace(/\s+/g, " ").slice(0, 110));
  },
  "billing-docs": async (c, tmp, tier, ok) => {
    // The invoice store is seeded directly rather than by spawning servers/invoice: this
    // probe is about billing-docs, and a failure here has to mean billing-docs failed.
    // Mixed VAT on purpose, EUR 1,000.00 consulting at 23% plus EUR 500.00 print at 8%,
    // gross EUR 1,770.00, because a single-rate invoice cannot show the split at all.
    const invDir = join(tmp, "data", "mcp-servers", "invoice");
    mkdirSync(invDir, { recursive: true });
    const line = (description, qty, unit, rate) => {
      const gross = Math.round(qty * unit);
      return { description, quantity: qty, unit_price_minor: unit, tax_rate: rate, gross_minor: gross, discount_minor: 0, net_minor: gross, tax_minor: Math.round(gross * rate / 100), exact_gross_minor: gross, round_total: false };
    };
    const invoice = (number, lines, date = "2026-09-01") => {
      const net = lines.reduce((n, l) => n + l.net_minor, 0);
      const tax = lines.reduce((n, l) => n + l.tax_minor, 0);
      const rates = [...new Set(lines.map((l) => l.tax_rate))].sort((a, b) => a - b);
      return { number, client_id: "c1", client: { name: "Acme Ltd" }, issue_date: date, due_date: date, currency: "EUR", decimals: 2, lines, subtotal_minor: net, discount_percent: 0, discount_minor: 0, net_minor: net, tax_lines: rates.map((r) => ({ rate: r, base_minor: lines.filter((l) => l.tax_rate === r).reduce((n, l) => n + l.net_minor, 0), tax_minor: lines.filter((l) => l.tax_rate === r).reduce((n, l) => n + l.tax_minor, 0) })), tax_minor: tax, total_minor: net + tax, status: "unpaid", paid_minor: 0, created: `${date}T00:00:00.000Z`, branded: true };
    };
    writeFileSync(join(invDir, "invoices.json"), JSON.stringify([
      invoice("INV-2026-0001", [line("Consulting", 1, 100000, 23), line("Print run", 1, 50000, 8)]),
      invoice("INV-2026-0002", [line("Development", 10, 9000, 23)]),
    ], null, 2));

    // 1. Partial credit by gross amount. The measured insight: EUR 177.00 of a mixed-VAT
    // invoice must come back as EUR 23.00 at 23% AND EUR 4.00 at 8%, not EUR 33.10 at one
    // blended rate. Both rate lines are asserted, so a single-rate regression fails here.
    const part = await c.tool("credit_note_create", { invoice: "INV-2026-0001", reason: "Overcharged, ten percent back", amount_minor: 17700 });
    const cn1 = (part.text.match(/CN-\d{4}-\d{4}/) || [])[0];
    ok(`${tier}: credit_note_create by amount splits EUR 177.00 across 23% and 8%`,
      !part.isError && !!cn1 && /EUR -177\.00/.test(part.text) && /8% on EUR -50\.00 = EUR -4\.00/.test(part.text) && /23% on EUR -100\.00 = EUR -23\.00/.test(part.text) && /"still_creditable": "EUR 1593\.00"/.test(part.text),
      part.text.replace(/\s+/g, " ").slice(0, 150));

    // 2. Over-credit. Remaining is 177000 - 17700 = 159300 minor; ask for one cent more.
    const over = await c.tool("credit_note_create", { invoice: "INV-2026-0001", reason: "Too much", amount_minor: 159301 });
    ok(`${tier}: crediting one cent past the remainder is refused, nothing stored`,
      over.isError && /can still be credited/i.test(over.text) && /refund, not a credit note/i.test(over.text) && /Nothing was stored/.test(over.text),
      over.text.replace(/\s+/g, " ").slice(0, 150));

    // 3. Full credit of the second invoice: EUR 1,107.00, copied from the stored totals.
    const full = await c.tool("credit_note_create", { invoice: "INV-2026-0002", reason: "Work returned in full" });
    const cn2 = (full.text.match(/CN-\d{4}-\d{4}/) || [])[0];
    ok(`${tier}: a full credit note copies the invoice's own EUR 1,107.00`,
      !full.isError && !!cn2 && cn2 !== cn1 && /-?1107\.00/.test(full.text), full.text.replace(/\s+/g, " ").slice(0, 120));
    const again = await c.tool("credit_note_create", { invoice: "INV-2026-0002", reason: "Twice" });
    ok(`${tier}: crediting the same invoice in full twice is refused`,
      again.isError && /already been credited|can still be credited/i.test(again.text), again.text.replace(/\s+/g, " ").slice(0, 130));
    const cnTxt = await c.tool("credit_note_text", { id: cn1 });
    ok(`${tier}: credit_note_text is free on both tiers and names the invoice`,
      !cnTxt.isError && cnTxt.text.includes("INV-2026-0001") && !/mcp\.zovo\.one\/buy/.test(cnTxt.text), cnTxt.text.replace(/\s+/g, " ").slice(0, 100));

    // 4. Purchase order: 40 reams at EUR 4.90 plus 8 toners at EUR 42.00, 23% VAT.
    const po = await c.tool("purchase_order_create", { supplier: "Nordpapier GmbH", currency: "EUR", tax_rate: 23, expected_delivery_date: "2026-09-20", items: [{ description: "A4 paper, 500 sheets", quantity: 40, unit_price_minor: 490 }, { description: "Toner cartridge", quantity: 8, unit_price_minor: 4200 }] });
    const poId = (po.text.match(/PO-\d{4}-\d{4}/) || [])[0];
    ok(`${tier}: purchase_order_create totals EUR 532.00 net, EUR 654.36 gross`,
      !po.isError && !!poId && /"net": "EUR 532\.00"/.test(po.text) && /"total": "EUR 654\.36"/.test(po.text) && /23% on EUR 532\.00 = EUR 122\.36/.test(po.text), `${poId} ${po.text.replace(/\s+/g, " ").slice(0, 110)}`);

    // 5. Receiving in part keeps the order open; receiving it in full twice does not.
    const rec = await c.tool("purchase_order_receive", { id: poId, partial: true, date: "2026-09-05", note: "25 of 40 reams, toner back-ordered" });
    ok(`${tier}: a partial receipt leaves the order open and is on the record`,
      !rec.isError && /partially_received/.test(rec.text) && /25 of 40 reams/.test(rec.text), rec.text.replace(/\s+/g, " ").slice(0, 120));
    await c.tool("purchase_order_receive", { id: poId, date: "2026-09-06", note: "the rest" });
    const recTwice = await c.tool("purchase_order_receive", { id: poId, date: "2026-09-07", note: "again" });
    ok(`${tier}: receiving an order in full twice is refused by date`,
      recTwice.isError && /already received in full/i.test(recTwice.text) && /2026-09-06/.test(recTwice.text), recTwice.text.replace(/\s+/g, " ").slice(0, 120));

    // 6. Report gate. Free refuses with the buy link; Pro answers with the credited total.
    const rep = await c.tool("billing_docs_report", {});
    ok(`${tier}: billing_docs_report ${tier === "pro" ? "gives credited and on-order totals" : "is gated with the buy link"}`,
      tier === "pro"
        ? !rep.isError && /credited/i.test(rep.text) && /-?1284\.00|-?1107\.00/.test(rep.text)
        : /mcp\.zovo\.one\/buy\/billing-docs/.test(rep.text) && !/"credited"/.test(rep.text),
      rep.text.replace(/\s+/g, " ").slice(0, 120));
    const pdf = await c.tool("credit_note_pdf", { id: cn1, out_path: join(tmp, "cn.pdf") });
    ok(`${tier}: credit_note_pdf ${tier === "pro" ? "writes an A4 file" : "is gated and writes nothing"}`,
      tier === "pro" ? !pdf.isError && existsSync(join(tmp, "cn.pdf")) && statSync(join(tmp, "cn.pdf")).size > 1000 : /mcp\.zovo\.one\/buy\/billing-docs/.test(pdf.text) && !existsSync(join(tmp, "cn.pdf")),
      pdf.text.replace(/\s+/g, " ").slice(0, 110));

    // 7. The free cap counts credit notes and purchase orders TOGETHER: three documents
    // exist by now, so the fourth and fifth land and the sixth is refused by count.
    let last;
    for (let i = 4; i <= 6; i++) {
      last = await c.tool("purchase_order_create", { supplier: `Supplier ${i}`, currency: "EUR", tax_rate: 23, items: [{ description: `Order ${i}`, quantity: 1, unit_price_minor: 10000 }] });
    }
    ok(`${tier}: the 6th document in a month is ${tier === "pro" ? "allowed" : "refused, naming the count and the buy link"}`,
      tier === "pro" ? !last.isError && /PO-\d{4}-0004/.test(last.text) : /mcp\.zovo\.one\/buy\/billing-docs/.test(last.text) && /5/.test(last.text),
      last.text.replace(/\s+/g, " ").slice(0, 130));
    // A document dated in another month is not blocked by this month's five.
    const other = await c.tool("purchase_order_create", { supplier: "Next month", currency: "EUR", tax_rate: 23, issue_date: "2026-10-02", items: [{ description: "Order in October", quantity: 1, unit_price_minor: 10000 }] });
    ok(`${tier}: a document dated in another month is not blocked by this month's count`,
      !other.isError && /PO-\d{4}-\d{4}/.test(other.text), other.text.replace(/\s+/g, " ").slice(0, 110));
  },
  zip: async (c, tmp, tier, ok) => {

    const src = join(tmp, "src"); mkdirSync(src, { recursive: true });
    const csv = join(src, "rows.csv"), txt = join(src, "note.txt");
    writeFileSync(csv, "client,amount\n" + "Acme Ltd,120.50\n".repeat(4000));
    writeFileSync(txt, "August close. Send to the accountant.\n");
    const arc = join(tmp, "bundle.zip");
    const cr = await c.tool("zip_create", { paths: [csv, txt], out_path: arc });
    ok(`${tier}: zip_create packs two files`, !cr.isError && existsSync(arc) && /rows\.csv/.test(cr.text) && /note\.txt/.test(cr.text), cr.text.replace(/\s+/g, " ").slice(0, 120));
    const ls = await c.tool("zip_list", { path: arc });
    ok(`${tier}: zip_list gives every entry a ratio`, !ls.isError && /rows\.csv/.test(ls.text) && /note\.txt/.test(ls.text) && /\d+(\.\d+)?x/.test(ls.text), ls.text.replace(/\s+/g, " ").slice(0, 140));
    const outDir = join(tmp, "unpacked");
    const dry = await c.tool("zip_extract", { path: arc, out_dir: outDir, dry_run: true });
    ok(`${tier}: zip_extract dry_run reports the plan and creates no out_dir`, !dry.isError && /dry run/i.test(dry.text) && !existsSync(outDir), dry.text.replace(/\s+/g, " ").slice(0, 120));
    const ex = await c.tool("zip_extract", { path: arc, out_dir: outDir });
    ok(`${tier}: zip_extract writes exactly that plan, bytes identical`, !ex.isError && existsSync(join(outDir, "note.txt")) && readFileSync(join(outDir, "note.txt"), "utf8") === readFileSync(txt, "utf8"), ex.text.replace(/\s+/g, " ").slice(0, 120));
    const eva = join(tmp, "evil.zip");
    writeFileSync(eva, storedZip([{ name: "safe.txt", data: "harmless" }, { name: "../escaped.txt", data: "owned" }]));
    const evd = join(tmp, "evilout");
    const ev = await c.tool("zip_extract", { path: eva, out_dir: evd });
    ok(`${tier}: a crafted ../ entry is refused and nothing lands beside out_dir`, ev.isError && /unsafe|\.\./.test(ev.text) && !existsSync(join(tmp, "escaped.txt")) && !existsSync(join(evd, "safe.txt")), ev.text.replace(/\s+/g, " ").slice(0, 140));
    const rd = await c.tool("zip_extract_text", { path: arc, entry: "note.txt" });
    ok(`${tier}: zip_extract_text reads one entry inline`, !rd.isError && /Send to the accountant/.test(rd.text), rd.text.replace(/\s+/g, " ").slice(0, 100));
    const many = join(tmp, "many"); mkdirSync(many, { recursive: true });
    for (let i = 0; i < 201; i++) writeFileSync(join(many, `f${i}.txt`), `row ${i}\n`);
    const big = join(tmp, "many.zip");
    const bg = await c.tool("zip_create", { dir: many, out_path: big });
    ok(`${tier}: 201 entries ${tier === "pro" ? "packed" : "refused with the free cap and the buy link"}`, tier === "pro" ? !bg.isError && existsSync(big) && /201/.test(bg.text) : !bg.isError && /mcp\.zovo\.one\/buy\/zip/.test(bg.text) && /201/.test(bg.text) && !existsSync(big), bg.text.replace(/\s+/g, " ").slice(0, 140));
    const h = await c.tool("zip_history", {});
    ok(`${tier}: zip_history lists what was created${tier === "pro" ? " with no allowance line" : " and the free allowance used"}`, !h.isError && /bundle\.zip/.test(h.text) && (tier === "pro" ? !/free archive/.test(h.text) : /\d+ of 20 free archives used in \d{4}-\d{2}/.test(h.text)), h.text.replace(/\s+/g, " ").slice(0, 140));
  },
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
    const idx = await fetch("https://mcp.zovo.one/mcp").then((r) => r.json()); ok("index lists 21 endpoints", Array.isArray(idx.endpoints) ? idx.endpoints.length >= 21 : JSON.stringify(idx).includes("time-tracker"), JSON.stringify(idx).slice(0, 100));
    const mintRes = await fetch("https://mcp.zovo.one/mcp/token"); const mint = mintRes.status === 200 ? await mintRes.json() : { status: mintRes.status };
    ok("anonymous token minted (or per-IP mint limit 429 after repeated runs)", /^anon_[0-9a-f]{32}$/.test(mint.token || "") || mintRes.status === 429, mint.token || `HTTP ${mintRes.status}`);
    const tok = { token: sign("*") };  // probes use a bundle Pro key so validation runs never exhaust the anonymous mint limit
    const rpc = async (path, body) => fetch(`https://mcp.zovo.one/mcp/${path}`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${tok.token}` }, body: JSON.stringify(body) }).then((r) => r.json());
    for (const s of ["time-tracker", "price-tracker", "invoice", "expense-tracker", "spreadsheet", "currency", "timezone", "docx", "resume", "recurring", "clauses", "pdf", "calendar", "kanban", "image", "bank-statement", "quotes", "barcode", "zip", "billing-docs", "deposits"]) { const r = await rpc(s, { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }); ok(`${s}: tools/list over HTTP`, (r.result?.tools || []).length >= 8, `${(r.result?.tools || []).length} tools`); }
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
    // D-R76 follow-up: /mcp/expense-tracker hydrates the bank ledger read-only (the mirror
    // of /mcp/bank-statement's own hydration of the expense ledger), so bankLedgerLine
    // (D-B4) runs for real on the hosted endpoint again and names the bank transaction
    // count plus the sibling tool to call, for the SAME token that just imported the rows
    // above.
    const esum = await rpc("expense-tracker", { jsonrpc: "2.0", id: 315, method: "tools/call", params: { name: "expense_summary", arguments: { from: "2026-07-01", to: "2026-09-30", group_by: "category" } } });
    ok("hosted expense_summary names the bank transaction count and statement_summary", /bank_ledger/.test(JSON.stringify(esum)) && /\d+ transactions?/.test(JSON.stringify(esum)) && /statement_summary/.test(JSON.stringify(esum)), JSON.stringify(esum).slice(0, 160));
    const qbiz = await rpc("invoice", { jsonrpc: "2.0", id: 32, method: "tools/call", params: { name: "business_set", arguments: { name: "Probe Studio", default_currency: "EUR", default_tax_rate: 23, iban: "DE89370400440532013000" } } });
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
    const zsvg = await rpc("barcode", { jsonrpc: "2.0", id: 37, method: "tools/call", params: { name: "qr_create", arguments: { text: "https://mcp.zovo.one/mcp/barcode", out_path: "probe-qr", overwrite: true } } });
    const zsl = (JSON.stringify(zsvg).match(/https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]+/) || [])[0];
    const zsr = zsl ? await fetch(zsl) : null;
    const zsb = zsr ? await zsr.text() : "";
    ok("hosted qr_create svg download starts with <svg and is served image/svg+xml", zsb.startsWith("<svg") && /viewBox/.test(zsb) && (zsr?.headers.get("content-type") || "").startsWith("image/svg+xml"), `${zsl ? "link" : "no link"} ${zsr?.headers.get("content-type")}`);
    const zpng = await rpc("barcode", { jsonrpc: "2.0", id: 38, method: "tools/call", params: { name: "qr_create", arguments: { text: "hosted PNG probe", format: "png", size: 240, out_path: "probe-qr-png", overwrite: true } } });
    const zpl = (JSON.stringify(zpng).match(/https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]+/) || [])[0];
    const zpr = zpl ? await fetch(zpl) : null;
    const zph = zpr ? Buffer.from(await zpr.arrayBuffer()).subarray(0, 8).toString("hex") : "";
    ok("hosted qr_create png download carries the PNG signature and is served image/png", zph === "89504e470d0a1a0a" && (zpr?.headers.get("content-type") || "") === "image/png", `${zpl ? "link" : "no link"} ${zph} ${zpr?.headers.get("content-type")}`);
    const zean = await rpc("barcode", { jsonrpc: "2.0", id: 39, method: "tools/call", params: { name: "barcode_create", arguments: { symbology: "ean13", value: "590123412345", out_path: "probe-ean", overwrite: true } } });
    const zbad = await rpc("barcode", { jsonrpc: "2.0", id: 40, method: "tools/call", params: { name: "barcode_create", arguments: { symbology: "ean13", value: "5901234123450" } } });
    ok("hosted barcode_create ean13 computes check digit 7 and refuses a wrong one", /5901234123457/.test(JSON.stringify(zean)) && /check digit is wrong/.test(JSON.stringify(zbad)), JSON.stringify(zean).slice(0, 90));
    const zpay = await rpc("barcode", { jsonrpc: "2.0", id: 41, method: "tools/call", params: { name: "invoice_payment_qr", arguments: { invoice_id: qinv, out_path: "probe-pay", overwrite: true } } });
    ok("hosted invoice_payment_qr reads the invoice store of the same token and the shared profile IBAN (EUR 1328.40)", !!qinv && new RegExp(qinv).test(JSON.stringify(zpay)) && /1328\.40/.test(JSON.stringify(zpay)), JSON.stringify(zpay).slice(0, 140));
    const { zipSync: RemoteZipSync } = await import("fflate");
    const probeZip = Buffer.from(RemoteZipSync({ "notes.txt": [Buffer.from("Hello from the hosted zip probe.\n"), { level: 6 }], "rows.csv": [Buffer.from("alpha,beta\n1,2\n3,4\n"), { level: 6 }] }));
    const zup = await rpc("zip", { jsonrpc: "2.0", id: 42, method: "tools/call", params: { name: "zip_upload", arguments: { name: "probe.zip", content_base64: probeZip.toString("base64") } } });
    const zls = await rpc("zip", { jsonrpc: "2.0", id: 43, method: "tools/call", params: { name: "zip_list", arguments: { path: "probe" } } });
    const ztx = await rpc("zip", { jsonrpc: "2.0", id: 44, method: "tools/call", params: { name: "zip_extract_text", arguments: { path: "probe", entry: "notes.txt" } } });
    ok("hosted zip_upload + zip_list (2 entries, nothing suspicious) + zip_extract_text reads one entry", !zup.error && /2 entries/.test(JSON.stringify(zls)) && /Nothing suspicious/.test(JSON.stringify(zls)) && /Hello from the hosted zip probe/.test(JSON.stringify(ztx)), JSON.stringify(ztx).slice(0, 90));
    const zex = await rpc("zip", { jsonrpc: "2.0", id: 45, method: "tools/call", params: { name: "zip_extract", arguments: { path: "probe", patterns: ["rows.csv"], overwrite: true } } });
    const zxl = (JSON.stringify(zex).match(/https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]+/) || [])[0];
    const zxr = zxl ? await fetch(zxl) : null;
    const zxb = zxr ? await zxr.text() : "";
    ok("hosted zip_extract publishes one download per entry, served with the entry's own type", zxb === "alpha,beta\n1,2\n3,4\n" && (zxr?.headers.get("content-type") || "").startsWith("text/csv"), `${zxl ? "link" : "no link"} ${zxr?.headers.get("content-type")}`);
    await rpc("zip", { jsonrpc: "2.0", id: 46, method: "tools/call", params: { name: "zip_upload", arguments: { name: "one.txt", content: "first uploaded file\n" } } });
    await rpc("zip", { jsonrpc: "2.0", id: 47, method: "tools/call", params: { name: "zip_upload", arguments: { name: "two.csv", content: "a,b\n1,2\n" } } });
    const zcr = await rpc("zip", { jsonrpc: "2.0", id: 48, method: "tools/call", params: { name: "zip_create", arguments: { out_path: "bundle", paths: ["one.txt", "two.csv"], overwrite: true } } });
    const zcl = (JSON.stringify(zcr).match(/https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]+/) || [])[0];
    const zcres = zcl ? await fetch(zcl) : null;
    const zchead = zcres ? Buffer.from(await zcres.arrayBuffer()).subarray(0, 4).toString("hex") : "";
    ok("hosted zip_create from two uploaded files downloads with the PK magic, served application/zip", /2 entries/.test(JSON.stringify(zcr)) && zchead === "504b0304" && (zcres?.headers.get("content-type") || "") === "application/zip", `${zcl ? "link" : "no link"} ${zchead} ${zcres?.headers.get("content-type")}`);
    const evilZip = Buffer.concat([Buffer.from(RemoteZipSync({ "safe.txt": [Buffer.from("safe content\n"), { level: 0 }], "xx/xx/escaped.txt": [Buffer.from("pwned\n"), { level: 0 }] }))]);
    const evilTrav = Buffer.from(evilZip.toString("latin1").split("xx/xx/escaped.txt").join("../../escaped.txt"), "latin1");
    const zev = await rpc("zip", { jsonrpc: "2.0", id: 49, method: "tools/call", params: { name: "zip_upload", arguments: { name: "evil.zip", content_base64: evilTrav.toString("base64") } } });
    const zer = await rpc("zip", { jsonrpc: "2.0", id: 50, method: "tools/call", params: { name: "zip_extract", arguments: { path: "evil" } } });
    ok("hosted zip_extract refuses a traversal entry before anything is inflated", !zev.error && /parent traversal/.test(JSON.stringify(zer)) && /nothing was extracted/.test(JSON.stringify(zer)), JSON.stringify(zer).slice(0, 110));
    // Extension 11: /mcp/billing-docs. The credit notes are issued against the invoice
    // quote_accept wrote above, which is the shared invoice store read on this endpoint.
    const bcn = await rpc("billing-docs", { jsonrpc: "2.0", id: 65, method: "tools/call", params: { name: "credit_note_create", arguments: { invoice: qinv, reason: "Project cancelled" } } });
    const bover = await rpc("billing-docs", { jsonrpc: "2.0", id: 66, method: "tools/call", params: { name: "credit_note_create", arguments: { invoice: qinv, amount_minor: 100, reason: "one cent too many" } } });
    const bid = (JSON.stringify(bcn).match(/CN-\d{4}-\d{4}/) || [])[0];
    ok("hosted credit_note_create credits the invoice /mcp/invoice holds for the same token (EUR -1328.40), and the next cent is refused", /-1328\.40/.test(JSON.stringify(bcn)) && /at most EUR 0\.00 can still be credited/.test(JSON.stringify(bover)), `${bid} ${JSON.stringify(bover).slice(0, 90)}`);
    const bpdf = await rpc("billing-docs", { jsonrpc: "2.0", id: 67, method: "tools/call", params: { name: "credit_note_pdf", arguments: { id: bid, out_path: "probe-credit" } } });
    const bcdl = (JSON.stringify(bpdf).match(/https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]+/) || [])[0];
    const bcres = bcdl ? await fetch(bcdl) : null;
    const bcbody = bcres ? await bcres.text() : "";
    ok("hosted credit_note_pdf download is the HTML credit note served text/html, titled CREDIT NOTE and naming the invoice", bcbody.startsWith("<!doctype html") && bcbody.includes(`<title>Credit note ${bid}`) && bcbody.includes(`<h1>CREDIT NOTE ${bid}`) && bcbody.includes(`against invoice ${qinv}`) && (bcres?.headers.get("content-type") || "").startsWith("text/html"), `${bcdl ? "link" : "no link"} ${bcres?.headers.get("content-type")}`);
    const bpo = await rpc("billing-docs", { jsonrpc: "2.0", id: 68, method: "tools/call", params: { name: "purchase_order_create", arguments: { supplier: "Nordic Paper AB", supplier_address: "Storgatan 5, Stockholm", supplier_vat_id: "SE556000000001", items: [{ description: "Recycled A4 paper, box of 5 reams", quantity: 20, unit_price_minor: 2450 }], expected_delivery_date: "2026-12-20" } } });
    const bpid = (JSON.stringify(bpo).match(/PO-\d{4}-\d{4}/) || [])[0];
    const bdrec = await rpc("billing-docs", { jsonrpc: "2.0", id: 69, method: "tools/call", params: { name: "purchase_order_receive", arguments: { id: bpid, note: "20 of 20 boxes" } } });
    const bdrep = await rpc("billing-docs", { jsonrpc: "2.0", id: 70, method: "tools/call", params: { name: "billing_docs_report", arguments: {} } });
    ok("hosted purchase_order_create (20 x EUR 24.50 + 23% = EUR 602.70) receives in full and billing_docs_report reads both documents", /602\.70/.test(JSON.stringify(bpo)) && /"status": "received"/.test(JSON.stringify(bdrec).replace(/\\n/g, "\n").replace(/\\"/g, '"')) && /"purchase_orders": 1/.test(JSON.stringify(bdrep).replace(/\\n/g, "\n").replace(/\\"/g, '"')) && /-1328\.40/.test(JSON.stringify(bdrep)), `${bpid} ${JSON.stringify(bdrep).slice(0, 90)}`);
    // Extension 12: /mcp/deposits. The deposit is applied to the invoice quote_accept
    // wrote above, which is the shared invoice store this endpoint hydrates read-WRITE:
    // the payment has to be readable back on /mcp/invoice with the same token.
    const dclient = `Probe Deposits ${Date.now()}`;
    const drec = await rpc("deposits", { jsonrpc: "2.0", id: 71, method: "tools/call", params: { name: "deposit_record", arguments: { client: dclient, amount_minor: 50000, currency: "EUR", kind: "retainer", received_date: "2026-09-01", reference: "TRF-778" } } });
    const did = (JSON.stringify(drec).match(/DEP-\d{4}-\d{4}/) || [])[0];
    const dap = await rpc("deposits", { jsonrpc: "2.0", id: 72, method: "tools/call", params: { name: "deposit_apply", arguments: { id: did, invoice: qinv, amount_minor: 30000, note: "part payment" } } });
    const dover = await rpc("deposits", { jsonrpc: "2.0", id: 73, method: "tools/call", params: { name: "deposit_apply", arguments: { id: did, invoice: qinv, amount_minor: 40000 } } });
    const dil = await rpc("invoice", { jsonrpc: "2.0", id: 74, method: "tools/call", params: { name: "invoice_list", arguments: {} } });
    const dilTxt = JSON.stringify(dil).replace(/\\n/g, "\n").replace(/\\"/g, '"');
    // The payment has to be visible on the OTHER endpoint, on that invoice's own row, so
    // the window is anchored on the number rather than on the document as a whole.
    const dilRow = new RegExp(`"number": "${qinv}"[\\s\\S]{0,700}?"paid": "EUR 300\\.00",\\s*"balance_due": "EUR 1028\\.40"`).test(dilTxt);
    ok("hosted deposit_apply writes the payment into the invoice /mcp/invoice holds for the same token (EUR 300.00 of EUR 1328.40 on invoice_list), and more than is held is refused",
      !!did && /"balance_due": "EUR 1028\.40"/.test(JSON.stringify(dap).replace(/\\n/g, "\n").replace(/\\"/g, '"')) && dilRow && /"status": "partial"/.test(dilTxt) && /holds EUR 200\.00 and this would apply EUR 400\.00/.test(JSON.stringify(dover)),
      `${did} ${dilRow} ${JSON.stringify(dover).slice(0, 80)}`);
    const dref = await rpc("deposits", { jsonrpc: "2.0", id: 75, method: "tools/call", params: { name: "deposit_refund", arguments: { id: did, amount_minor: 5000, method: "bank transfer" } } });
    const dbal = await rpc("deposits", { jsonrpc: "2.0", id: 76, method: "tools/call", params: { name: "deposit_balance", arguments: { client: dclient } } });
    ok("hosted deposit_refund leaves EUR 150.00 held (500.00 received - 300.00 applied - 50.00 refunded), and deposit_balance agrees",
      /"held": "EUR 150\.00"/.test(JSON.stringify(dref).replace(/\\n/g, "\n").replace(/\\"/g, '"')) && /"held": "EUR 150\.00"/.test(JSON.stringify(dbal).replace(/\\n/g, "\n").replace(/\\"/g, '"')),
      JSON.stringify(dbal).slice(0, 110));
    const dpdf = await rpc("deposits", { jsonrpc: "2.0", id: 77, method: "tools/call", params: { name: "deposit_statement_pdf", arguments: { client: dclient, out_path: "probe-deposits" } } });
    const ddl = (JSON.stringify(dpdf).match(/https:\/\/mcp\.zovo\.one\/mcp\/download\/[0-9a-f]+/) || [])[0];
    const dres = ddl ? await fetch(ddl) : null;
    const dbody = dres ? await dres.text() : "";
    ok("hosted deposit_statement_pdf download is the HTML statement served text/html, titled DEPOSIT STATEMENT, closing on what is still held",
      dbody.startsWith("<!doctype html") && dbody.includes("<h1>DEPOSIT STATEMENT") && dbody.includes(dclient) && /EUR 150\.00 is still held/.test(dbody) && (dres?.headers.get("content-type") || "").startsWith("text/html"),
      `${ddl ? "link" : "no link"} ${dres?.headers.get("content-type")}`);
    // Extension 10: the `url` alternative on every upload shim. One fetch per shim from
    // raw.githubusercontent.com (D-R73: the worker cannot fetch its own zone), one refusal.
    const RAWFX = "https://raw.githubusercontent.com/theluckystrike/mcp-servers/main/remote/fixtures";
    const updf = await rpc("pdf", { jsonrpc: "2.0", id: 51, method: "tools/call", params: { name: "pdf_upload", arguments: { name: "urlpdf", url: `${RAWFX}/sample-doc.pdf` } } });
    const updfi = await rpc("pdf", { jsonrpc: "2.0", id: 52, method: "tools/call", params: { name: "pdf_info", arguments: { path: "urlpdf" } } });
    ok("url upload: pdf_upload {url} fetches the PDF and pdf_info reads 2 pages", /Fetched 1074 bytes from raw\.githubusercontent\.com/.test(JSON.stringify(updf)) && /"pages": 2/.test(JSON.stringify(updfi).replace(/\\n/g, "\n").replace(/\\"/g, '"')), JSON.stringify(updf).slice(0, 120));
    const udx = await rpc("docx", { jsonrpc: "2.0", id: 53, method: "tools/call", params: { name: "doc_upload", arguments: { name: "urldocx", url: `${RAWFX}/sample-template.docx` } } });
    const udxr = await rpc("docx", { jsonrpc: "2.0", id: 54, method: "tools/call", params: { name: "doc_read", arguments: { path: "urldocx", format: "text" } } });
    ok("url upload: doc_upload {url} fetches the .docx and doc_read sees its placeholders", /Fetched 1215 bytes from raw\.githubusercontent\.com/.test(JSON.stringify(udx)) && /\{\{client\}\}/.test(JSON.stringify(udxr)), JSON.stringify(udx).slice(0, 120));
    const ush = await rpc("spreadsheet", { jsonrpc: "2.0", id: 55, method: "tools/call", params: { name: "sheet_load", arguments: { name: "urlcsv", url: `${RAWFX}/sample-rows.csv` } } });
    const ushi = await rpc("spreadsheet", { jsonrpc: "2.0", id: 56, method: "tools/call", params: { name: "sheet_info", arguments: { path: "urlcsv" } } });
    ok("url upload: sheet_load {url} loads the CSV and sheet_info reports 5 rows x 4 cols", /Fetched 203 bytes from raw\.githubusercontent\.com/.test(JSON.stringify(ush)) && /5 rows x 4 cols/.test(JSON.stringify(ushi)), JSON.stringify(ush).slice(0, 120));
    const uim = await rpc("image", { jsonrpc: "2.0", id: 57, method: "tools/call", params: { name: "image_upload", arguments: { name: "urlpng", url: `${RAWFX}/sample-image.png` } } });
    const uimi = await rpc("image", { jsonrpc: "2.0", id: 58, method: "tools/call", params: { name: "image_info", arguments: { path: "urlpng" } } });
    ok("url upload: image_upload {url} fetches the PNG and image_info reads 64x64", /Fetched 189 bytes from raw\.githubusercontent\.com/.test(JSON.stringify(uim)) && /"width": 64/.test(JSON.stringify(uimi).replace(/\\n/g, "\n").replace(/\\"/g, '"')), JSON.stringify(uim).slice(0, 120));
    const ubn = `urlbank${Date.now().toString(36)}`;
    const ubk = await rpc("bank-statement", { jsonrpc: "2.0", id: 59, method: "tools/call", params: { name: "bank_upload", arguments: { name: ubn, url: `${RAWFX}/sample-rows.csv` } } });
    const ubki = await rpc("bank-statement", { jsonrpc: "2.0", id: 60, method: "tools/call", params: { name: "statement_import", arguments: { path: ubn, account: ubn } } });
    ok("url upload: bank_upload {url} fetches the export and statement_import reads 4 rows", /Fetched 203 bytes from raw\.githubusercontent\.com/.test(JSON.stringify(ubk)) && /"imported": 4/.test(JSON.stringify(ubki).replace(/\\n/g, "\n").replace(/\\"/g, '"')), JSON.stringify(ubk).slice(0, 120));
    const uzp = await rpc("zip", { jsonrpc: "2.0", id: 61, method: "tools/call", params: { name: "zip_upload", arguments: { name: "urlzip.zip", url: `${RAWFX}/sample-archive.zip` } } });
    const uzpl = await rpc("zip", { jsonrpc: "2.0", id: 62, method: "tools/call", params: { name: "zip_list", arguments: { path: "urlzip" } } });
    ok("url upload: zip_upload {url} fetches the archive and zip_list reads 2 entries", /Fetched 407 bytes from raw\.githubusercontent\.com/.test(JSON.stringify(uzp)) && /2 entries/.test(JSON.stringify(uzpl)), JSON.stringify(uzp).slice(0, 120));
    const uref = await rpc("pdf", { jsonrpc: "2.0", id: 63, method: "tools/call", params: { name: "pdf_upload", arguments: { name: "urlbad", url: "http://169.254.169.254/latest/meta-data/" } } });
    const uref2 = await rpc("image", { jsonrpc: "2.0", id: 64, method: "tools/call", params: { name: "image_upload", arguments: { name: "urlbad2", url: `${RAWFX}/sample-doc.pdf` } } });
    ok("url upload refusals: the metadata address is not fetched, and a PDF is not stored as an image", /not a public address/.test(JSON.stringify(uref)) && /magic bytes of a PNG/.test(JSON.stringify(uref2)), JSON.stringify(uref).slice(0, 110));
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
    for (const p of ["time-tracker", "price-tracker", "spreadsheet", "invoice", "expense-tracker", "currency", "docx", "timezone", "resume", "recurring", "clauses", "pdf", "calendar", "kanban", "image", "bank-statement", "quotes", "barcode", "zip", "billing-docs", "deposits", "bundle"]) { const r = await fetch(`https://mcp.zovo.one/buy/${p}`, { redirect: "manual", headers: { "x-mcp-probe": "1" } }); ok(`buy/${p} -> 303 to Stripe`, r.status === 303 && /checkout\.stripe\.com/.test(r.headers.get("location") || ""), `${r.status} ${(r.headers.get("location") || "").slice(0, 50)}`); }
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
