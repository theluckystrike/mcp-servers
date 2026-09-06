#!/usr/bin/env node
// Demo driver: spawns a server's dist/index.js over stdio, runs initialize + a
// short scripted sequence of tool calls, and prints the exchange the way a
// person would see it in a chat client (prompt, tool call, result), with a
// short pause between steps so a terminal recorder captures readable beats.
//
// Usage: node scripts/demo/drive.mjs <server-name>
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..", "..");
const STEP_DELAY_MS = 1400;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function client(entry, env, opts = {}) {
  const sandbox = mkdtempSync(join(tmpdir(), "mcp-demo-"));
  const child = spawn(process.execPath, [entry], {
    stdio: ["pipe", "pipe", "pipe"],
    ...(opts.cwd ? { cwd: opts.cwd } : {}),
    env: {
      ...process.env,
      XDG_DATA_HOME: join(sandbox, "data"),
      XDG_CONFIG_HOME: join(sandbox, "config"),
      MCP_LICENSE_KEY: "",
      ...env,
    },
  });
  if (opts.showStderr) {
    let sbuf = "";
    child.stderr.on("data", (chunk) => {
      sbuf += chunk.toString();
      let i;
      while ((i = sbuf.indexOf("\n")) >= 0) {
        const line = sbuf.slice(0, i);
        sbuf = sbuf.slice(i + 1);
        if (opts.showStderr(line)) console.log(`\x1b[90m${line}\x1b[0m`);
      }
    });
  }
  let buf = "";
  const pending = new Map();
  child.stdout.on("data", (chunk) => {
    buf += chunk.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      const r = pending.get(msg.id);
      if (r) { pending.delete(msg.id); r(msg); }
    }
  });
  let id = 0;
  const send = (method, params) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: mid, method, params }) + "\n");
    const t = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error(`timeout on ${method}`)); } }, 10000);
    t.unref();
  });
  return {
    sandbox, child,
    async init() {
      await send("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "demo", version: "1.0" } });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    },
    async call(name, args) {
      const r = await send("tools/call", { name, arguments: args ?? {} });
      const t = (r.result?.content ?? []).map((c) => c.text).join("\n");
      return t;
    },
    close() { child.kill(); },
  };
}

function startFixtureShop() {
  const FIXTURE = `<!doctype html><html><head><meta charset="utf-8">
<title>Aurora Desk Lamp - Northlight Home</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Aurora Desk Lamp",
"offers":{"@type":"Offer","price":"49.00","priceCurrency":"USD"}}</script>
</head><body><h1>Aurora Desk Lamp</h1><div class="product-price">$49.00</div></body></html>`;
  const srv = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(FIXTURE);
  });
  return new Promise((resolve) => {
    srv.listen(0, "127.0.0.1", () => resolve({
      url: `http://127.0.0.1:${srv.address().port}/product/aurora-lamp`,
      close: () => srv.close(),
    }));
  });
}

function startEcbFixture() {
  const iso = (d) => d.toISOString().slice(0, 10);
  const daysAgo = (n) => iso(new Date(Date.now() - n * 86_400_000));
  const D0 = daysAgo(0), D1 = daysAgo(1), D2 = daysAgo(2), D5 = daysAgo(5);
  const day = (t, usd, gbp, pln) =>
    `<Cube time='${t}'><Cube currency='USD' rate='${usd}'/><Cube currency='GBP' rate='${gbp}'/>` +
    `<Cube currency='PLN' rate='${pln}'/></Cube>`;
  const HEAD = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"><Cube>`;
  const TAIL = `</Cube></gesmes:Envelope>`;
  const DAILY_XML = HEAD + day(D0, "1.0812", "0.85023", "4.2650") + TAIL;
  const HIST_XML = HEAD +
    day(D0, "1.0812", "0.85023", "4.2650") +
    day(D1, "1.0790", "0.85110", "4.2710") +
    day(D2, "1.0755", "0.85240", "4.2800") +
    day(D5, "1.0731", "0.85310", "4.2890") +
    TAIL;
  const srv = createServer((req, res) => {
    if (req.url.includes("eurofxref-daily.xml")) { res.writeHead(200, { "content-type": "text/xml" }); res.end(DAILY_XML); return; }
    if (req.url.includes("eurofxref-hist.xml")) { res.writeHead(200, { "content-type": "text/xml" }); res.end(HIST_XML); return; }
    res.writeHead(404); res.end("no");
  });
  return new Promise((resolve) => {
    srv.listen(0, "127.0.0.1", () => resolve({
      url: `http://127.0.0.1:${srv.address().port}`,
      close: () => srv.close(),
    }));
  });
}

// A raw zip writer for the demo: the archive "somebody sent you" has to hold a traversal
// entry and a bomb entry, and no honest packer will produce either.
const CRCT = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(b) { let c = -1; for (let i = 0; i < b.length; i++) c = CRCT[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function rawZip(entries) {
  const locals = [], centrals = []; let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, "utf8");
    const body = e.deflate ? deflateRawSync(raw, { level: 9 }) : raw;
    const method = e.deflate ? 8 : 0, crc = crc32(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(method, 8); lh.writeUInt16LE(0x6000, 10); lh.writeUInt16LE(0x590e, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26);
    locals.push(lh, name, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE((3 << 8) | 20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10); ch.writeUInt16LE(0x6000, 12);
    ch.writeUInt16LE(0x590e, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20);
    ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE((0o100644 << 16) >>> 0, 38); ch.writeUInt32LE(off, 42);
    centrals.push(ch, name); off += 30 + name.length + body.length;
  }
  const lo = Buffer.concat(locals), cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(lo.length, 16);
  return Buffer.concat([lo, cd, eocd]);
}

function say(line) { console.log(line); }
function toolLine(name, args) {
  const a = args && Object.keys(args).length ? " " + JSON.stringify(args) : "";
  console.log(`\x1b[36m> ${name}${a}\x1b[0m`);
}
function resultLine(text) {
  for (const line of text.split("\n")) console.log(`  ${line}`);
}

async function run(name) {
  const entry = join(ROOT, "servers", name, "dist", "index.js");
  const showStderr = name === "office-suite" ? (line) => line.startsWith("mcp-office-suite ready") : undefined;
  let ecb;
  const env = {};
  if (name === "currency") {
    ecb = await startEcbFixture();
    env.ECB_BASE_URL = ecb.url;
  }
  if (name === "bank-statement") {
    const { execFileSync } = await import("node:child_process");
    env.MCP_LICENSE_KEY = execFileSync(
      process.execPath,
      [join(ROOT, "scripts", "sign-license.mjs"), "bank-statement"],
    ).toString().trim();
  }
  if (name === "quotes") {
    const { execFileSync } = await import("node:child_process");
    env.MCP_LICENSE_KEY = execFileSync(
      process.execPath,
      [join(ROOT, "scripts", "sign-license.mjs"), "quotes"],
    ).toString().trim();
  }
  if (name === "barcode") {
    const { execFileSync } = await import("node:child_process");
    env.MCP_LICENSE_KEY = execFileSync(
      process.execPath,
      [join(ROOT, "scripts", "sign-license.mjs"), "barcode"],
    ).toString().trim();
  }
  // zip works on paths the caller gives, so its demo runs from a short working directory:
  // the recorded terminal is 900 px wide and a per-run path under $TMPDIR is 62 characters
  // before the file name, which would wrap every line of the transcript.
  const cwd = name === "zip" ? mkdtempSync("/tmp/zip-demo-") : undefined;
  // billing-docs reads the invoice server's store out of XDG_DATA_HOME, and the fixture below
  // writes into it, so the demo pins a short data home for the same reason zip pins a short cwd.
  let bdocsHome;
  if (name === "billing-docs" || name === "deposits") {
    bdocsHome = join(mkdtempSync("/tmp/bdocs-demo-"), "data");
    env.XDG_DATA_HOME = bdocsHome;
    env.XDG_CONFIG_HOME = join(bdocsHome, "..", "config");
  }
  const c = client(entry, env, { showStderr, cwd });
  if (cwd) process.chdir(cwd);
  await c.init();

  const today = new Date().toISOString().slice(0, 10);

  if (name === "time-tracker") {
    say("$ Track billable time from chat, then generate a report.\n");
    await sleep(STEP_DELAY_MS);
    toolLine("timer_start", { project: "acme", task: "api work" });
    resultLine(await c.call("timer_start", { project: "acme", task: "api work" }));
    await sleep(STEP_DELAY_MS);
    toolLine("timer_stop", { note: "shipped the endpoint" });
    resultLine(await c.call("timer_stop", { note: "shipped the endpoint" }));
    await sleep(STEP_DELAY_MS);
    await c.call("project_set_rate", { project: "acme", hourly_rate: 100 });
    toolLine("report", { from: `${today}T00:00:00`, to: `${today}T23:59:59`, group_by: "project" });
    resultLine(await c.call("report", { from: `${today}T00:00:00`, to: `${today}T23:59:59`, group_by: "project" }));
  }

  if (name === "price-tracker") {
    const shop = await startFixtureShop();
    say("$ Check a price and start watching it for drops.\n");
    await sleep(STEP_DELAY_MS);
    toolLine("price_check", { url: shop.url });
    resultLine(await c.call("price_check", { url: shop.url }));
    await sleep(STEP_DELAY_MS);
    toolLine("watch_add", { url: shop.url, target_price: 39 });
    resultLine(await c.call("watch_add", { url: shop.url, target_price: 39 }));
    await sleep(STEP_DELAY_MS);
    toolLine("watch_list", {});
    resultLine(await c.call("watch_list", {}));
    shop.close();
  }

  if (name === "spreadsheet") {
    const file = join(c.sandbox, "orders.csv");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(file, "Item,Qty,Unit Price\nWidget,4,12.50\nGadget,2,30.00\nGizmo,10,4.20\n");
    say("$ Read, query and extend a spreadsheet without corrupting it.\n");
    await sleep(STEP_DELAY_MS);
    toolLine("sheet_info", { path: file });
    resultLine(await c.call("sheet_info", { path: file }));
    const withTotal = join(c.sandbox, "orders-plus-total.csv");
    await sleep(STEP_DELAY_MS);
    toolLine("sheet_add_column", { path: file, name: "Total", formula: "[Qty] * [Unit Price]" });
    resultLine(await c.call("sheet_add_column", { path: file, name: "Total", formula: "[Qty] * [Unit Price]", out_path: withTotal }));
    await sleep(STEP_DELAY_MS);
    toolLine("sheet_query", { path: withTotal, where: "[Total] > 20", select: ["Item", "Total"] });
    resultLine(await c.call("sheet_query", { path: withTotal, where: "[Total] > 20", select: ["Item", "Total"] }));
  }

  if (name === "invoice") {
    say("$ Create a numbered invoice with tax lines from chat.\n");
    await sleep(STEP_DELAY_MS);
    toolLine("business_set", { name: "Lucky Strike Software", default_currency: "EUR", default_tax_rate: 23 });
    resultLine(await c.call("business_set", { name: "Lucky Strike Software", default_currency: "EUR", default_tax_rate: 23 }));
    await sleep(STEP_DELAY_MS);
    await c.call("client_add", { name: "Acme GmbH", address: "Hauptstr. 5\nBerlin", email: "ap@acme.example" });
    toolLine("invoice_create", { client: "Acme GmbH", items: [{ description: "Backend development", quantity: 12, unit_price: 90 }] });
    resultLine(await c.call("invoice_create", { client: "Acme GmbH", items: [{ description: "Backend development", quantity: 12, unit_price: 90 }], issue_date: today }));
    await sleep(STEP_DELAY_MS);
    toolLine("invoice_list", {});
    resultLine(await c.call("invoice_list", {}));
  }

  if (name === "expense-tracker") {
    say("$ Log a receipt and a mileage claim from chat, then rebill them.\n");
    await c.call("category_rules", { rules: [{ match: "Adobe", category: "software" }] });
    await sleep(STEP_DELAY_MS);
    toolLine("expense_add", { amount: 61.50, currency: "EUR", merchant: "Adobe", project: "acme", vat_rate: 23, billable: true });
    resultLine(await c.call("expense_add", { amount: 61.50, currency: "EUR", merchant: "Adobe", project: "acme", vat_rate: 23, billable: true }));
    await sleep(STEP_DELAY_MS);
    toolLine("mileage_add", { km: 45, region: "PL", purpose: "client site visit" });
    resultLine(await c.call("mileage_add", { km: 45, region: "PL", purpose: "client site visit" }));
    await sleep(STEP_DELAY_MS);
    toolLine("expense_to_invoice", { project: "acme", from: today, to: today });
    resultLine(await c.call("expense_to_invoice", { project: "acme", from: today, to: today }));
  }

  if (name === "office-suite") {
    say("$ One server, every tool: timers, expenses, invoices, all in one session.\n");
    await sleep(STEP_DELAY_MS);
    toolLine("timer_start", { project: "acme", task: "onsite consulting" });
    resultLine(await c.call("timer_start", { project: "acme", task: "onsite consulting" }));
    await sleep(STEP_DELAY_MS);
    toolLine("expense_add", { amount: 18.90, currency: "EUR", merchant: "train ticket", project: "acme", vat_rate: 23, billable: true });
    resultLine(await c.call("expense_add", { amount: 18.90, currency: "EUR", merchant: "train ticket", project: "acme", vat_rate: 23, billable: true }));
    await sleep(STEP_DELAY_MS);
    await c.call("business_set", { name: "Lucky Strike Software", default_currency: "EUR", default_tax_rate: 23 });
    await c.call("client_add", { name: "Acme GmbH", address: "Hauptstr. 5\nBerlin", email: "ap@acme.example" });
    toolLine("invoice_from_hours", { client: "Acme GmbH", hours: 6, rate: 120, currency: "EUR", tax_rate: 23 });
    resultLine(await c.call("invoice_from_hours", { client: "Acme GmbH", hours: 6, rate: 120, currency: "EUR", tax_rate: 23 }));
  }

  if (name === "currency") {
    say("$ Convert an amount, compare a few currencies, and see how a pair has moved.\n");
    await sleep(STEP_DELAY_MS);
    toolLine("convert", { amount: 100, from: "USD", to: "PLN" });
    resultLine(await c.call("convert", { amount: 100, from: "USD", to: "PLN" }));
    await sleep(STEP_DELAY_MS);
    toolLine("fx_rates_for", { target: "USD", currencies: ["EUR", "GBP"] });
    resultLine(await c.call("fx_rates_for", { target: "USD", currencies: ["EUR", "GBP"] }));
    await sleep(STEP_DELAY_MS);
    toolLine("rate_history", { from: "USD", to: "PLN", days: 30 });
    resultLine(await c.call("rate_history", { from: "USD", to: "PLN", days: 30 }));
  }

  if (name === "timezone") {
    say("$ Convert a time across cities, find a meeting slot, and write the invite.\n");
    await sleep(STEP_DELAY_MS);
    toolLine("convert_time", { time: "2026-09-10 15:00", from_zone: "Warsaw", to_zones: ["Denver", "Sydney"] });
    resultLine(await c.call("convert_time", { time: "2026-09-10 15:00", from_zone: "Warsaw", to_zones: ["Denver", "Sydney"] }));
    await sleep(STEP_DELAY_MS);
    const participants = [
      { name: "Mike", zone: "Warsaw" },
      { name: "Dana", zone: "London" },
      { name: "Priya", zone: "New York" },
    ];
    toolLine("find_meeting_slots", { participants, duration_minutes: 30, limit: 3 });
    resultLine(await c.call("find_meeting_slots", { participants, duration_minutes: 30, limit: 3 }));
    await sleep(STEP_DELAY_MS);
    const icsPath = join(c.sandbox, "meeting.ics");
    toolLine("ics_create", { title: "Roadmap sync", start: "2026-09-10 15:00", zone: "Warsaw", duration_minutes: 30, attendees: ["dana@example.com", "priya@example.com"] });
    resultLine(await c.call("ics_create", { title: "Roadmap sync", start: "2026-09-10 15:00", zone: "Warsaw", duration_minutes: 30, attendees: ["dana@example.com", "priya@example.com"], out_path: icsPath }));
  }

  if (name === "docx") {
    say("$ Set a business profile, write a client proposal, and read it back.\n");
    await sleep(STEP_DELAY_MS);
    toolLine("business_set", { name: "Lucky Strike Software", default_currency: "EUR", default_tax_rate: 23 });
    resultLine(await c.call("business_set", { name: "Lucky Strike Software", default_currency: "EUR", default_tax_rate: 23 }));
    await sleep(STEP_DELAY_MS);
    const proposalArgs = {
      client: "Acme GmbH",
      project_title: "Checkout rebuild",
      summary: "Rebuild the checkout flow to cut cart abandonment.",
      scope: ["Audit current checkout", "Rebuild payment step"],
      deliverables: ["New checkout flow in production"],
      timeline: [
        { phase: "Discovery", duration: "1 week" },
        { phase: "Build", duration: "3 weeks" },
        { phase: "Launch", duration: "1 week" },
      ],
      price: { amount: 4500, currency: "EUR", terms: "50% on signature, 50% on delivery" },
    };
    toolLine("proposal_create", proposalArgs);
    const proposalResult = await c.call("proposal_create", proposalArgs);
    resultLine(proposalResult);
    await sleep(STEP_DELAY_MS);
    const docPath = JSON.parse(proposalResult.split("\n\n")[1]).file;
    toolLine("doc_read", { path: docPath });
    resultLine(await c.call("doc_read", { path: docPath }));
  }

  if (name === "resume") {
    say("$ Store the facts once, then tailor a resume and cover letter to a posting.\n");
    await sleep(STEP_DELAY_MS);
    const profileArgs = {
      name: "Mika Nowak",
      email: "mika@example.com",
      summary: "Backend engineer focused on payments infrastructure.",
      skills: ["Node.js", "PostgreSQL", "AWS"],
      experience: [{
        company: "Northlight Systems", title: "Senior Backend Engineer", start: "2021",
        bullets: ["Rebuilt the payments API on Node.js and PostgreSQL, cutting p99 latency 40%"],
      }],
      education: [{ school: "University of Warsaw", degree: "BSc Computer Science" }],
    };
    toolLine("profile_set", profileArgs);
    resultLine(await c.call("profile_set", profileArgs));
    await sleep(STEP_DELAY_MS);
    const resumeArgs = {
      target_role: "Senior Backend Engineer",
      keywords: ["Node.js", "Kubernetes"],
      max_pages: 1,
    };
    toolLine("resume_create", resumeArgs);
    resultLine(await c.call("resume_create", resumeArgs));
    await sleep(STEP_DELAY_MS);
    const letterArgs = {
      company: "Acme GmbH",
      role: "Senior Backend Engineer",
      highlights: ["cut p99 latency 40%"],
    };
    toolLine("cover_letter_create", letterArgs);
    resultLine(await c.call("cover_letter_create", letterArgs));
  }

  if (name === "recurring") {
    say("$ Define a repeating invoice once, then generate the ones actually due.\n");
    await sleep(STEP_DELAY_MS);
    const past = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
    const scheduleArgs = {
      client: "Acme GmbH",
      items: [{ description: "Retainer - backend support", quantity: 10, unit_price: 90 }],
      every: "monthly",
      start_date: past,
    };
    toolLine("schedule_create", scheduleArgs);
    const scheduleResult = await c.call("schedule_create", scheduleArgs);
    resultLine(scheduleResult);
    await sleep(STEP_DELAY_MS);
    toolLine("invoice_generate_due", { dry_run: true });
    resultLine(await c.call("invoice_generate_due", { dry_run: true }));
    await sleep(STEP_DELAY_MS);
    toolLine("invoice_generate_due", {});
    resultLine(await c.call("invoice_generate_due", {}));
    await sleep(STEP_DELAY_MS);
    say("$ Run it again the same day: idempotent, nothing new is created.\n");
    toolLine("invoice_generate_due", {});
    resultLine(await c.call("invoice_generate_due", {}));
  }

  if (name === "pdf") {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const { writeFileSync } = await import("node:fs");
    async function makeInvoicePdf(fileName, invNo, total) {
      const doc = await PDFDocument.create();
      const page = doc.addPage([612, 792]);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText(`Invoice ${invNo}`, { x: 50, y: 740, size: 20, font });
      page.drawText(`Acme GmbH`, { x: 50, y: 700, size: 12, font });
      page.drawText(`Backend development - 12h @ 90 EUR`, { x: 50, y: 660, size: 12, font });
      page.drawText(`Total: ${total} EUR`, { x: 50, y: 620, size: 14, font, color: rgb(0, 0, 0) });
      const bytes = await doc.save({ useObjectStreams: false });
      const p = join(c.sandbox, fileName);
      writeFileSync(p, bytes);
      return p;
    }
    const inv1 = await makeInvoicePdf("invoice-001.pdf", "INV-001", "1250.00");
    const inv2 = await makeInvoicePdf("invoice-002.pdf", "INV-002", "980.00");
    const inv3 = await makeInvoicePdf("invoice-003.pdf", "INV-003", "1476.00");
    say("$ Inspect a PDF, merge a few, stamp PAID, and read the total back.\n");
    await sleep(STEP_DELAY_MS);
    toolLine("pdf_info", { path: inv1 });
    const infoResult = JSON.parse(await c.call("pdf_info", { path: inv1 }));
    resultLine(JSON.stringify({ file: infoResult.file, size: infoResult.size, pages: infoResult.pages, encrypted: infoResult.encrypted, paper: infoResult.page_sizes[0].paper }, null, 2));
    await sleep(STEP_DELAY_MS);
    const merged = join(c.sandbox, "merged.pdf");
    toolLine("pdf_merge", { paths: [inv1, inv2, inv3], out_path: merged });
    resultLine((await c.call("pdf_merge", { paths: [inv1, inv2, inv3], out_path: merged })).split("\n\n")[0]);
    await sleep(STEP_DELAY_MS);
    const stamped = join(c.sandbox, "merged-paid.pdf");
    toolLine("pdf_stamp", { path: merged, text: "PAID", out_path: stamped });
    resultLine((await c.call("pdf_stamp", { path: merged, text: "PAID", out_path: stamped })).split("\n\n")[0]);
    await sleep(STEP_DELAY_MS);
    toolLine("pdf_text", { path: stamped, pages: "3" });
    resultLine((await c.call("pdf_text", { path: stamped, pages: "3" })).split("\n\nHow this was read")[0]);
  }

  if (name === "calendar") {
    const { writeFileSync } = await import("node:fs");
    const icsPath = join(c.sandbox, "work.ics");
    const dtStart = "20260908T090000";
    const dtEnd = "20260908T093000";
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//mcp-servers demo//EN",
      "BEGIN:VEVENT",
      "UID:standup-1@example.com",
      `DTSTART;TZID=Europe/Warsaw:${dtStart}`,
      `DTEND;TZID=Europe/Warsaw:${dtEnd}`,
      "SUMMARY:Daily standup",
      "RRULE:FREQ=WEEKLY;COUNT=4",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:acme-review@example.com",
      "DTSTART;TZID=Europe/Warsaw:20260910T140000",
      "DTEND;TZID=Europe/Warsaw:20260910T150000",
      "SUMMARY:Acme GmbH quarterly review",
      "LOCATION:Zoom",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    writeFileSync(icsPath, ics);
    say("$ Import a calendar, list events, see free/busy, and bill a meeting.\n");
    await sleep(STEP_DELAY_MS);
    toolLine("ics_import", { path: icsPath, name: "work" });
    resultLine(await c.call("ics_import", { path: icsPath, name: "work" }));
    await sleep(STEP_DELAY_MS);
    toolLine("events_list", { calendar: "work", from: "2026-09-08", to: "2026-09-30" });
    const listResult = await c.call("events_list", { calendar: "work", from: "2026-09-08", to: "2026-09-30" });
    resultLine(listResult);
    await sleep(STEP_DELAY_MS);
    toolLine("free_busy", { calendars: ["work"], from: "2026-09-08", to: "2026-09-12" });
    resultLine(await c.call("free_busy", { calendars: ["work"], from: "2026-09-08", to: "2026-09-12" }));
    await sleep(STEP_DELAY_MS);
    const idMatch = listResult.match(/id (\S+)/);
    const eventId = idMatch ? idMatch[1] : "";
    toolLine("event_to_time_entry", { event_id: eventId, project: "acme" });
    resultLine(await c.call("event_to_time_entry", { event_id: eventId, project: "acme" }));
  }

  if (name === "kanban") {
    say("$ Add tasks to a project board, check the board, hand off a timer, and review the week.\n");
    await sleep(STEP_DELAY_MS);
    toolLine("task_add", { title: "Write the launch email", project: "nova", due: "Friday", estimate_minutes: 90 });
    resultLine(await c.call("task_add", { title: "Write the launch email", project: "nova", due: "Friday", estimate_minutes: 90 }));
    await sleep(STEP_DELAY_MS);
    toolLine("task_add", { title: "Fix checkout bug", project: "nova", priority: "high" });
    resultLine(await c.call("task_add", { title: "Fix checkout bug", project: "nova", priority: "high" }));
    await sleep(STEP_DELAY_MS);
    const thirdArgs = { title: "Review pull request", project: "nova", column: "doing" };
    toolLine("task_add", thirdArgs);
    const thirdResult = await c.call("task_add", thirdArgs);
    resultLine(thirdResult);
    await sleep(STEP_DELAY_MS);
    toolLine("board", { project: "nova" });
    resultLine(await c.call("board", { project: "nova" }));
    await sleep(STEP_DELAY_MS);
    const taskId = thirdResult.split(/\s+/)[0];
    toolLine("task_start_timer", { id: taskId });
    resultLine(await c.call("task_start_timer", { id: taskId }));
    await sleep(STEP_DELAY_MS);
    toolLine("weekly_review", {});
    resultLine(await c.call("weekly_review", {}));
  }

  if (name === "image") {
    const { Jimp } = await import("jimp");
    const { writeFileSync } = await import("node:fs");
    function noisy(width, height, seed) {
      const img = new Jimp({ width, height, color: 0x000000ff });
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const r = (x * 37 + y * 91 + seed * 13) % 256;
          const g = (x * 13 + y * 7 + seed * 29) % 256;
          const b = (x * 5 + y * 53 + seed * 61) % 256;
          img.setPixelColor((((r << 24) | (g << 16) | (b << 8) | 0xff) >>> 0), x, y);
        }
      }
      return img;
    }
    const photoPath = join(c.sandbox, "photo.jpg");
    writeFileSync(photoPath, await noisy(640, 480, 1).getBuffer("image/jpeg", { quality: 90 }));
    say("$ Inspect a photo, resize it, compress it with a byte report, and make thumbnails.\n");
    await sleep(STEP_DELAY_MS);
    toolLine("image_info", { path: photoPath });
    resultLine(await c.call("image_info", { path: photoPath }));
    await sleep(STEP_DELAY_MS);
    const resizedPath = join(c.sandbox, "photo-1200.jpg");
    toolLine("image_resize", { path: photoPath, width: 320, out_path: resizedPath });
    resultLine(await c.call("image_resize", { path: photoPath, width: 320, out_path: resizedPath }));
    await sleep(STEP_DELAY_MS);
    const compressedPath = join(c.sandbox, "photo-small.jpg");
    toolLine("image_compress", { path: photoPath, quality: 60, out_path: compressedPath });
    resultLine(await c.call("image_compress", { path: photoPath, quality: 60, out_path: compressedPath }));
    await sleep(STEP_DELAY_MS);
    const thumbDir = join(c.sandbox, "thumbs");
    toolLine("image_thumbnails", { paths: [photoPath], size: 128, out_dir: thumbDir });
    resultLine(await c.call("image_thumbnails", { paths: [photoPath], size: 128, out_dir: thumbDir }));
  }

  if (name === "clauses") {
    say("$ Search the clause library, assemble a contract, and check what it still needs.\n");
    await sleep(STEP_DELAY_MS);
    toolLine("clause_search", { query: "payment" });
    resultLine(await c.call("clause_search", { query: "payment" }));
    await sleep(STEP_DELAY_MS);
    const clauseIds = ["scope-of-work", "payment-terms", "ip-assignment", "confidentiality", "termination"];
    const assembleArgs = {
      title: "Service Agreement - Beta Corp",
      clause_ids: clauseIds,
      client: "Beta Corp",
      values: { contractor: "Lucky Strike Software", project: "website redesign", deliverables: "a redesigned marketing site", fee: "4500", currency: "EUR", payment_days: "14" },
    };
    toolLine("contract_assemble", assembleArgs);
    resultLine(await c.call("contract_assemble", assembleArgs));
    await sleep(STEP_DELAY_MS);
    toolLine("variables_list", { clause_ids: clauseIds });
    resultLine(await c.call("variables_list", { clause_ids: clauseIds }));
  }

  if (name === "bank-statement") {
    const { writeFileSync } = await import("node:fs");
    const csv = [
      "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance",
      "CARD_PAYMENT,Current,2026-07-04 08:12:00,2026-07-04 09:00:00,Spotify,-9.99,0.00,EUR,COMPLETED,1500.00",
      "CARD_PAYMENT,Current,2026-08-03 08:12:00,2026-08-03 09:00:00,Spotify,-9.99,0.00,EUR,COMPLETED,1490.01",
      "TOPUP,Current,2026-08-05 10:00:00,2026-08-05 10:01:00,Payment from Acme,2500.00,0.00,EUR,COMPLETED,3990.01",
      "CARD_PAYMENT,Current,2026-08-10 12:00:00,2026-08-10 12:05:00,Lidl Warszawa,-64.30,0.00,EUR,COMPLETED,3925.71",
      "CARD_PAYMENT,Current,2026-08-15 09:00:00,2026-08-15 09:01:00,Rent transfer,-1200.00,0.00,EUR,COMPLETED,2725.71",
      "CARD_PAYMENT,Current,2026-08-20 19:30:00,2026-08-20 19:31:00,Restaurant Bistro,-45.50,0.00,EUR,COMPLETED,2680.21",
      "ATM,Current,2026-08-25 14:00:00,2026-08-25 14:01:00,Cash withdrawal,-200.00,0.00,EUR,COMPLETED,2480.21",
      "CARD_PAYMENT,Current,2026-09-02 08:15:00,2026-09-02 09:00:00,Spotify,-9.99,0.00,EUR,COMPLETED,2470.22",
      "",
    ].join("\n");
    const csvPath = join(c.sandbox, "revolut-export.csv");
    writeFileSync(csvPath, csv);
    say("$ Import a Revolut export, set a category rule, summarise the month, and find the subscriptions (Pro).\n");
    await sleep(STEP_DELAY_MS);
    toolLine("statement_import", { path: csvPath, account: "business EUR" });
    resultLine(await c.call("statement_import", { path: csvPath, account: "business EUR" }));
    await sleep(STEP_DELAY_MS);
    const rulesArgs = { rules: [{ match: "Spotify", category: "software" }, { match: "Rent", category: "rent" }] };
    toolLine("category_rules", rulesArgs);
    resultLine(await c.call("category_rules", rulesArgs));
    await sleep(STEP_DELAY_MS);
    const summaryArgs = { from: "2026-07-01", to: "2026-09-03", group_by: "category" };
    toolLine("statement_summary", summaryArgs);
    resultLine(await c.call("statement_summary", summaryArgs));
    await sleep(STEP_DELAY_MS);
    const recurringArgs = { months: 12 };
    toolLine("recurring_detect", recurringArgs);
    resultLine(await c.call("recurring_detect", recurringArgs));
  }

  if (name === "quotes") {
    // The quotes server reads the shared business profile and the invoice server's own
    // client list rather than exposing business_set/client_add itself, so the fixture
    // writes those two files directly into this run's sandboxed invoice data directory,
    // the same place the invoice server itself would have written them.
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const invoiceDir = join(c.sandbox, "data", "mcp-servers", "invoice");
    mkdirSync(invoiceDir, { recursive: true });
    writeFileSync(join(invoiceDir, "business.json"), JSON.stringify({
      name: "Lucky Strike Software", default_currency: "EUR", default_tax_rate: 23,
      payment_terms_days: 14, invoice_prefix: "INV",
    }, null, 2));
    writeFileSync(join(invoiceDir, "clients.json"), JSON.stringify([{
      id: "acme-gmbh", name: "Acme GmbH", address: "Hauptstr. 5\nBerlin", email: "ap@acme.example", created: today,
    }], null, 2));
    say("$ Quote a client with VAT, send it as email text, and turn the yes into an invoice (Pro).\n");
    await sleep(STEP_DELAY_MS);
    const quoteArgs = {
      client: "Acme GmbH", currency: "EUR", validity_days: 14,
      items: [
        { description: "API work", quantity: 12, unit_price_minor: 9000, tax_rate: 23 },
        { description: "Setup fee", quantity: 1, unit_price_minor: 30000, tax_rate: 23 },
      ],
    };
    toolLine("quote_create", quoteArgs);
    const created = await c.call("quote_create", quoteArgs);
    resultLine(created);
    const idMatch = created.match(/Q-\d{4}-\d{4}/);
    const quoteId = idMatch ? idMatch[0] : "Q-2026-0001";
    await sleep(STEP_DELAY_MS);
    toolLine("quote_send_text", { id: quoteId });
    resultLine(await c.call("quote_send_text", { id: quoteId }));
    await sleep(STEP_DELAY_MS);
    toolLine("quote_accept", { id: quoteId });
    resultLine(await c.call("quote_accept", { id: quoteId }));
    await sleep(STEP_DELAY_MS);
    toolLine("quote_report", {});
    resultLine(await c.call("quote_report", {}));
  }

  if (name === "barcode") {
    say("$ QR codes and barcodes drawn on this machine: no upload, no account, no network call.\n");
    await sleep(STEP_DELAY_MS);
    const qrArgs = { text: "https://mcp.zovo.one/s/barcode", format: "png", size: 512, out_path: join(c.sandbox, "site.png") };
    toolLine("qr_create", qrArgs);
    resultLine(await c.call("qr_create", qrArgs));
    await sleep(STEP_DELAY_MS);
    const sepaArgs = {
      name: "Lucky Strike Software", iban: "DE89370400440532013000",
      amount: 1697.4, reference: "INV-2026-0007", out_path: join(c.sandbox, "pay.svg"),
    };
    toolLine("qr_payment_sepa", sepaArgs);
    resultLine(await c.call("qr_payment_sepa", sepaArgs));
    await sleep(STEP_DELAY_MS);
    const eanArgs = { symbology: "ean13", value: "590123412345", out_path: join(c.sandbox, "ean.svg") };
    toolLine("barcode_create", eanArgs);
    resultLine(await c.call("barcode_create", eanArgs));
    await sleep(STEP_DELAY_MS);
    const badArgs = { symbology: "ean13", value: "5901234123450", out_path: join(c.sandbox, "bad.svg") };
    toolLine("barcode_create", badArgs);
    resultLine(await c.call("barcode_create", badArgs));
  }

  if (name === "zip") {
    say("$ Pack a folder, and be told what is wrong with the archive somebody sent you.\n");
    mkdirSync(join("august", "node_modules"), { recursive: true });
    writeFileSync(join("august", "expenses.csv"), "client,amount\n" + "Acme Ltd,120.50\n".repeat(4000));
    writeFileSync(join("august", "notes.txt"), "August close. Send to the accountant.\n");
    writeFileSync(join("august", "node_modules", "junk.js"), "module.exports = 1;\n");
    const createArgs = { dir: "august", patterns: ["**/*.csv", "**/*.txt"], exclude: ["**/node_modules/**"], out_path: "august.zip" };
    toolLine("zip_create", createArgs);
    resultLine(await c.call("zip_create", createArgs));
    await sleep(STEP_DELAY_MS);
    writeFileSync("from-a-stranger.zip", rawZip([
      { name: "invoice.pdf", data: "%PDF-1.4 not really\n" },
      { name: "../../.ssh/authorized_keys", data: "ssh-rsa AAAA...\n" },
      { name: "data.bin", data: Buffer.alloc(200 * 1024 * 1024, 0), deflate: true },
    ]));
    toolLine("zip_extract", { path: "from-a-stranger.zip", out_dir: "unpacked" });
    resultLine(await c.call("zip_extract", { path: "from-a-stranger.zip", out_dir: "unpacked" }));
    say(`  ${existsSync("unpacked") ? "out_dir was created" : "out_dir was never created; nothing was inflated"}`);
    await sleep(STEP_DELAY_MS);
    toolLine("zip_extract_text", { path: "august.zip", entry: "notes.txt" });
    resultLine(await c.call("zip_extract_text", { path: "august.zip", entry: "notes.txt" }));
  }

  if (name === "billing-docs") {
    // A credit note has to have an invoice to credit, and this server reads the invoice
    // server's store rather than owning one, so the fixture writes the shared business
    // profile, the client list and one mixed-VAT invoice straight into this run's invoice
    // data directory, exactly where the invoice server itself would have put them. Same
    // approach the suites use (servers/billing-docs/test/_client.mjs seedInvoice).
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const invoiceDir = join(bdocsHome, "mcp-servers", "invoice");
    mkdirSync(invoiceDir, { recursive: true });
    writeFileSync(join(invoiceDir, "business.json"), JSON.stringify({
      name: "Lucky Strike Software", default_currency: "EUR", default_tax_rate: 23,
      payment_terms_days: 14, invoice_prefix: "INV",
    }, null, 2));
    writeFileSync(join(invoiceDir, "clients.json"), JSON.stringify([{
      id: "acme-gmbh", name: "Acme GmbH", address: "Hauptstr. 5\nBerlin", email: "ap@acme.example", created: "2026-09-01",
    }], null, 2));
    const invLine = (description, unit, rate) => ({
      description, quantity: 1, unit_price_minor: unit, tax_rate: rate,
      gross_minor: unit, discount_minor: 0, net_minor: unit,
      tax_minor: Math.round(unit * rate / 100), exact_gross_minor: unit, round_total: false,
    });
    writeFileSync(join(invoiceDir, "invoices.json"), JSON.stringify([{
      number: "INV-2026-0042", client_id: "acme-gmbh", client: { name: "Acme GmbH" },
      issue_date: "2026-09-01", due_date: "2026-09-15", currency: "EUR", decimals: 2,
      lines: [invLine("Consulting", 100000, 23), invLine("Printed manuals", 50000, 8)],
      subtotal_minor: 150000, discount_percent: 0, discount_minor: 0, net_minor: 150000,
      tax_lines: [{ rate: 23, base_minor: 100000, tax_minor: 23000 }, { rate: 8, base_minor: 50000, tax_minor: 4000 }],
      tax_minor: 27000, total_minor: 177000, status: "unpaid", paid_minor: 0,
      created: "2026-09-01T00:00:00.000Z", branded: true,
    }], null, 2));

    // These tools answer in JSON and the whole answer does not fit the recorded frame, so the
    // demo prints picked fields. Every string below is copied out of the response, never rebuilt.
    const pick = (raw) => JSON.parse(raw);

    say("$ Credit a mixed-VAT invoice, be stopped from crediting more than it billed, and raise a supplier order.\n");
    await sleep(STEP_DELAY_MS);
    const creditArgs = { invoice: "INV-2026-0042", amount_minor: 17700, reason: "Goodwill credit" };
    toolLine("credit_note_create", creditArgs);
    const credited = pick(await c.call("credit_note_create", creditArgs));
    resultLine(`${credited.created.id} credits ${credited.created.invoice_number} of ${credited.created.invoice_total}: ${credited.created.total}`);
    resultLine(credited.created.tax.join("\n"));
    resultLine(`still creditable ${credited.invoice.still_creditable}`);
    await sleep(STEP_DELAY_MS);

    const tooMuchArgs = { invoice: "INV-2026-0042", amount_minor: 200000, reason: "Second credit" };
    toolLine("credit_note_create", tooMuchArgs);
    resultLine(await c.call("credit_note_create", tooMuchArgs));
    await sleep(STEP_DELAY_MS);

    const orderArgs = {
      supplier: "Nordpapier GmbH", currency: "EUR", expected_delivery: "2026-09-20",
      items: [
        { description: "A4 paper, 80gsm", quantity: 40, unit_price_minor: 450, tax_rate: 23 },
        { description: "Toner cartridge", quantity: 4, unit_price_minor: 8900, tax_rate: 23 },
      ],
    };
    toolLine("purchase_order_create", orderArgs);
    const order = pick(await c.call("purchase_order_create", orderArgs));
    resultLine(`${order.created.id} to ${order.created.supplier.name}, ${order.created.status}, net ${order.created.net}, ${order.created.tax[0]}, total ${order.created.total}`);
    await sleep(STEP_DELAY_MS);

    const receiveArgs = { id: "PO-2026-0001", partial: true, date: "2026-09-05", note: "25 of 40 reams, toner back-ordered" };
    toolLine("purchase_order_receive", receiveArgs);
    const received = pick(await c.call("purchase_order_receive", receiveArgs));
    resultLine(`${received.received.id} ${received.received.status}, received ${received.receipts[0].date}: ${received.receipts[0].note}`);
    resultLine(received.note);
  }

  if (name === "deposits") {
    // Same fixture reasoning as billing-docs: this server reads and writes the invoice
    // server's store rather than owning one, so the run's invoice data directory gets the
    // shared business profile, one client and one unpaid invoice written straight into it,
    // exactly where the invoice server itself would have put them.
    const { writeFileSync, mkdirSync, readFileSync } = await import("node:fs");
    const invoiceDir = join(bdocsHome, "mcp-servers", "invoice");
    mkdirSync(invoiceDir, { recursive: true });
    writeFileSync(join(invoiceDir, "business.json"), JSON.stringify({
      name: "Lucky Strike Software", default_currency: "EUR", default_tax_rate: 23,
      payment_terms_days: 14, invoice_prefix: "INV",
    }, null, 2));
    writeFileSync(join(invoiceDir, "clients.json"), JSON.stringify([{
      id: "acme-gmbh", name: "Acme GmbH", address: "Hauptstr. 5\nBerlin", email: "ap@acme.example", created: "2026-09-01",
    }], null, 2));
    writeFileSync(join(invoiceDir, "invoices.json"), JSON.stringify([{
      number: "INV-2026-0042", client_id: "acme-gmbh", client: { name: "Acme GmbH" },
      issue_date: "2026-09-01", due_date: "2026-09-15", currency: "EUR", decimals: 2,
      lines: [{
        description: "Consulting", quantity: 1, unit_price_minor: 100000, tax_rate: 23,
        gross_minor: 100000, discount_minor: 0, net_minor: 100000, tax_minor: 23000,
        exact_gross_minor: 100000, round_total: false,
      }],
      subtotal_minor: 100000, discount_percent: 0, discount_minor: 0, net_minor: 100000,
      tax_lines: [{ rate: 23, base_minor: 100000, tax_minor: 23000 }],
      tax_minor: 23000, total_minor: 123000, status: "unpaid",
      // EUR 200.00 already arrived by bank transfer before the deposit is applied. This is the
      // number the demo is about: applying through invoice_mark_paid would overwrite it.
      paid_minor: 20000, paid_date: "2026-09-03",
      created: "2026-09-01T00:00:00.000Z", branded: true,
    }], null, 2));

    // These tools answer in JSON and the whole answer does not fit the recorded frame, so the
    // demo prints picked fields. Every string below is copied out of the response, never rebuilt.
    const pick = (raw) => JSON.parse(raw);

    say("$ Hold a client deposit, apply it to an invoice on top of what was already paid, be stopped from paying out more than is held.\n");
    await sleep(STEP_DELAY_MS);
    const recordArgs = { client: "Acme GmbH", amount_minor: 50000, currency: "EUR", kind: "security", received_date: "2026-09-01", reference: "SEPA ref 88213" };
    toolLine("deposit_record", recordArgs);
    const recorded = pick(await c.call("deposit_record", recordArgs));
    resultLine(`${recorded.recorded.id} ${recorded.recorded.kind} from ${recorded.recorded.client}, received ${recorded.recorded.received_date}: ${recorded.recorded.received}, held ${recorded.recorded.held}`);
    await sleep(STEP_DELAY_MS);

    const before = JSON.parse(readFileSync(join(invoiceDir, "invoices.json"), "utf8"))[0];
    say(`  INV-2026-0042 already shows a EUR 200.00 bank transfer (paid_minor ${before.paid_minor}).\n`);
    const applyArgs = { id: "DEP-2026-0001", invoice: "INV-2026-0042", amount_minor: 30000, date: "2026-09-05" };
    toolLine("deposit_apply", applyArgs);
    const applied = pick(await c.call("deposit_apply", applyArgs));
    resultLine(`${applied.applied.amount} of ${applied.applied.deposit} to ${applied.applied.invoice}: paid ${applied.invoice.paid} of ${applied.invoice.total}, balance due ${applied.invoice.balance_due}, ${applied.invoice.status}`);
    const after = JSON.parse(readFileSync(join(invoiceDir, "invoices.json"), "utf8"))[0];
    resultLine(`  paid_minor ${before.paid_minor} + 30000 = ${after.paid_minor}. The transfer was added to, not replaced.`);
    resultLine(`  ${applied.deposit.id} now holds ${applied.deposit.held}`);
    await sleep(STEP_DELAY_MS);

    const tooMuchArgs = { id: "DEP-2026-0001", invoice: "INV-2026-0042", amount_minor: 40000, date: "2026-09-05" };
    toolLine("deposit_apply", tooMuchArgs);
    resultLine(await c.call("deposit_apply", tooMuchArgs));
    await sleep(STEP_DELAY_MS);

    const refundArgs = { id: "DEP-2026-0001", amount_minor: 20000, date: "2026-09-05", method: "bank transfer" };
    toolLine("deposit_refund", refundArgs);
    const refunded = pick(await c.call("deposit_refund", refundArgs));
    resultLine(`${refunded.refunded.amount} back to the client by ${refunded.refunded.method}: ${refunded.deposit.id} is ${refunded.deposit.status}, held ${refunded.deposit.held}`);
  }
  if (name === "asset-register") {
    // The scheme is derived from the shared business profile's default_currency, the same
    // file every other server reads, so the fixture writes it where that profile lives.
    const { writeFileSync: wf, mkdirSync: mk } = await import("node:fs");
    const profileDir = join(c.sandbox, "data", "mcp-servers", "profile");
    mk(profileDir, { recursive: true });
    wf(join(profileDir, "business.json"), JSON.stringify({
      name: "Lucky Strike Software", default_currency: "PLN", timezone: "Europe/Warsaw",
    }, null, 2));

    // These tools answer in JSON and a whole answer does not fit the recorded frame, so the
    // demo prints picked fields. Every string below is copied out of the response, never rebuilt.
    const pick = (raw) => JSON.parse(raw);

    say("$ Depreciate on the tax authority's own table, month by month, and be refused when the class is not bundled.\n");
    await sleep(STEP_DELAY_MS);

    const addArgs = {
      name: "Dell workstation", category: "Computers and computer sets",
      cost_minor: 849900, currency: "PLN", purchase_date: "2026-03-15", scheme: "pl",
    };
    toolLine("asset_add", addArgs);
    const added = pick(await c.call("asset_add", addArgs));
    const a = added.added;
    resultLine(`${a.id} ${a.name}, ${a.cost}, KST ${a.category}: ${a.rate_pct}% ${a.method}, life ${a.useful_life_years || added.useful_life_years} yr`);
    resultLine(`  first charge ${added.first_charge_month}, not ${a.in_service_date.slice(0, 7)}: Poland charges from the month AFTER (art. 16h ust. 1 pkt 1)`);
    await sleep(STEP_DELAY_MS);

    const schedArgs = { asset: a.id, granularity: "month" };
    toolLine("asset_schedule", schedArgs);
    const sched = pick(await c.call("asset_schedule", schedArgs));
    for (const p of sched.periods) resultLine(`  ${p.year}: ${p.amount}   ${p.basis}`);
    const y26 = sched.months.filter((m) => m.month.startsWith("2026"));
    const sum26 = y26.reduce((n, m) => n + m.amount_minor, 0);
    const sumAll = sched.months.reduce((n, m) => n + m.amount_minor, 0);
    resultLine(`  ${sched.months.length} monthly rows from ${sched.months[0].month} at ${sched.months[0].amount}; 2026's ${y26.length} sum to ${(sum26 / 100).toFixed(2)} = its own year`);
    resultLine(`  all ${sched.months.length} months sum to ${(sumAll / 100).toFixed(2)} = ${sched.total}. ${sched.check}`);
    await sleep(STEP_DELAY_MS);

    // The published US percentages, reproduced rather than approximated.
    const macrsArgs = { scheme: "us", category: "5-year", cost_minor: 1000000, currency: "USD", purchase_date: "2026-01-01" };
    toolLine("asset_schedule", macrsArgs);
    const macrs = pick(await c.call("asset_schedule", macrsArgs));
    resultLine(`MACRS 5-year GDS half-year: ${macrs.periods.map((p) => p.amount.replace("USD ", "")).join(" / ")} = ${macrs.total}`);
    resultLine(`  six periods on a five-year class: ${macrs.notes[0].slice(0, 96)}`);
    await sleep(STEP_DELAY_MS);

    // The refusal that matters. A 10-year class is NOT approximated to the 7-year one.
    const tenArgs = { scheme: "us", category: "10-year", cost_minor: 1000000, currency: "USD", purchase_date: "2026-01-01" };
    toolLine("asset_schedule", tenArgs);
    resultLine(await c.call("asset_schedule", tenArgs));
  }
  if (name === "cash-book") {
    // The six books this server derives from belong to mcp-invoice, mcp-billing-docs,
    // mcp-deposits, mcp-expense-tracker, mcp-bank-statement and mcp-asset-register. The demo
    // seeds the same worked month the unit suite asserts against, reusing that suite's own
    // seeder, so every figure on screen is one recomputed by hand in docs/CASH_BOOK_RESULT.md
    // rather than one invented for the recording.
    const seedMod = await import(join(ROOT, "servers", "cash-book", "test", "_client.mjs"));
    seedMod.workedMonth(join(c.sandbox, "data"));

    // These tools answer in JSON and a whole answer does not fit the recorded frame, so the
    // demo prints picked fields. Every string below is copied out of the response.
    const pick = (raw) => JSON.parse(raw);
    const period = { from: "2026-06-01", to: "2026-06-30", currency: "EUR" };

    say("$ Six books, one double-entry ledger, derived on the call. Does June come to zero?\n");
    await sleep(STEP_DELAY_MS);

    toolLine("ledger_build", period);
    const b = pick(await c.call("ledger_build", period));
    resultLine(`${b.period.from} to ${b.period.to} ${b.currency}: ${b.lines} lines, ${b.debits} of debits against ${b.credits} of credits, balanced ${b.balanced}`);
    resultLine(`  read ${b.sources.map((x) => `${x.store} ${x.rows}`).join(", ")}`);
    resultLine(`  bank: ${b.bank_reconciliation.matched} rows matched a posted cash movement, ${b.bank_reconciliation.bank_rows_unmatched} unmatched, ${b.bank_reconciliation.posted_cash_without_bank_evidence} posted movement with no bank line`);
    await sleep(STEP_DELAY_MS);

    // The measured point. The bank import posts NOTHING; it is matched as evidence.
    toolLine("ledger_lines", { ...period, account: "cash" });
    const ll = pick(await c.call("ledger_lines", { ...period, account: "cash" }));
    for (const l of ll.lines) resultLine(`  ${l.date}  ${l.entry.slice(0, 24).padEnd(24)} ${(l.debit_minor ? "Dr " + l.debit : "Cr " + l.credit).padEnd(16)} ${l.source.padEnd(16)} ${l.bank_ref ? "bank " + l.bank_ref : "no bank line"}`);
    resultLine("  every line is posted from a DOCUMENT. The bank rows post nothing: they are matched on and written on as evidence");
    resultLine("  post the import as well and 4 of those 5 rows arrive twice: cash goes -10543.00 to -21111.00 and the trial balance STILL comes to zero");
    await sleep(STEP_DELAY_MS);

    toolLine("trial_balance", period);
    const tb = pick(await c.call("trial_balance", period));
    for (const a of tb.accounts) resultLine(`  ${a.account.padEnd(26)} Dr ${a.debits.replace("EUR ", "").padStart(10)}  Cr ${a.credits.replace("EUR ", "").padStart(10)}  = ${a.balance}`);
    resultLine(`  ${tb.debits} against ${tb.credits}, imbalance ${tb.imbalance}. Free and unlimited on every tier`);
    await sleep(STEP_DELAY_MS);

    // The Pro gate, on the free tier, shown rather than described.
    toolLine("month_close", { month: "2026-06", currency: "EUR" });
    resultLine(await c.call("month_close", { month: "2026-06", currency: "EUR" }));
  }
  if (name === "amortization") {
    // This server reads no sibling store, so there is nothing to seed. Every figure recorded
    // below is one the unit suite asserts and docs/AMORTIZATION_RESULT.md recomputes by hand:
    // the reference loan is 1,000,000 minor units at a nominal 12 percent compounded monthly
    // over 12 monthly payments, drawn 2026-01-15, payment 88,849, total interest 66,188.
    const pick = (raw) => JSON.parse(raw);

    say("$ The terms of a credit agreement, and what it actually costs. Free tier.\n");
    await sleep(STEP_DELAY_MS);

    const createArgs = { name: "Van finance", kind: "loan", principal_minor: 1000000, currency: "EUR", rate_bps: 1200, compounding: "monthly", payment_frequency: "monthly", term_periods: 12, method: "annuity", start_date: "2026-01-15" };
    toolLine("loan_create", createArgs);
    const cr = pick(await c.call("loan_create", createArgs));
    resultLine(`${cr.created.id} ${cr.created.name}: ${cr.created.principal} at a nominal ${cr.created.nominal_annual_rate_pct}% compounded ${cr.created.compounding}, ${cr.created.term_periods} ${cr.created.payment_frequency} payments`);
    resultLine(`  payment ${cr.created.payment}, effective annual rate ${cr.created.effective_annual_rate_pct}% against the nominal ${cr.created.nominal_annual_rate_pct}%, periodic rate ${cr.periodic_rate_pct}%`);
    resultLine(`  total paid ${cr.total_payments}, total interest ${cr.total_interest}. First payment ${cr.first_payment_date}, last ${cr.final_payment_date}`);
    await sleep(STEP_DELAY_MS);

    // The measured point. The payment never varies and the LAST period absorbs the rounding
    // residual in its interest and principal split, so the closing balance is exactly zero.
    toolLine("loan_schedule", { loan: "LOAN-2026-0001" });
    const sc = pick(await c.call("loan_schedule", { loan: "LOAN-2026-0001" }));
    for (const r of sc.rows) resultLine(`  ${String(r.period).padStart(2)}  ${r.date}  open ${r.opening.replace("EUR ", "").padStart(9)}  pay ${r.payment.replace("EUR ", "").padStart(7)}  int ${r.interest.replace("EUR ", "").padStart(6)}  prin ${r.principal.replace("EUR ", "").padStart(7)}  close ${r.closing.replace("EUR ", "").padStart(9)}`);
    resultLine(`  ${sc.periods} periods, total interest ${sc.total_interest}, closing balance ${sc.closing_balance} exactly`);
    resultLine("  period 12 charges 882 rather than the 880 an unrounded balance carries: the residual goes in the SPLIT, never in the payment");
    resultLine("  putting it in the payment instead would make the last payment 888.47, an amount that is on no agreement");
    await sleep(STEP_DELAY_MS);

    // Free and unlimited: the balance outstanding at a date is the other question this server
    // exists to answer, so it is not metered either.
    toolLine("loan_list", { as_of: "2026-06-30" });
    const ls = pick(await c.call("loan_list", { as_of: "2026-06-30" }));
    for (const r of ls.loans) resultLine(`  ${r.id}  ${r.name.padEnd(14)} ${r.payment.padStart(11)} / ${r.payment_frequency.padEnd(9)} outstanding at 2026-06-30 ${r.outstanding}`);
    await sleep(STEP_DELAY_MS);

    // The Pro gate, on the free tier, shown rather than described.
    toolLine("loan_repay_early", { loan: "LOAN-2026-0001", as_of_period: 6, penalty_minor: 5000 });
    resultLine(await c.call("loan_repay_early", { loan: "LOAN-2026-0001", as_of_period: 6, penalty_minor: 5000 }));
  }
  if (name === "work-order") {
    // This server writes only its own directory and the demo seeds nothing: the client is
    // recorded inline because the invoice server has no record of it on a fresh sandbox,
    // and the server says so itself in its own notes. Every figure below is one
    // servers/work-order/test/unit.test.mjs asserts and docs/WORK_ORDER_RESULT.md
    // recomputes by hand: 4.75 hours, labour 40,375, materials 19,458 on a parts cost of
    // 18,093, markup earned 1,365, net 59,833.
    const pick = (raw) => JSON.parse(raw);

    say("$ A job card for a one-van trade. The markup goes on the UNIT cost, never on the line total.\n");
    await sleep(STEP_DELAY_MS);

    const createArgs = { client: "Harbour Cafe", client_address: "12 Quay Street, Gdansk", site_address: "12 Quay Street, Gdansk", requested_date: "2026-03-02", description: "Walk-in not holding temperature", priority: "high", currency: "EUR" };
    toolLine("work_order_create", createArgs);
    const cr = pick(await c.call("work_order_create", createArgs)).created;
    resultLine(`${cr.id} ${cr.client} ${cr.site_address}, requested ${cr.requested_date}, ${cr.priority}, ${cr.currency}, status ${cr.status}`);
    resultLine("  the client is looked up in the INVOICE server's own records, so the job and the invoice carry one customer");
    await sleep(STEP_DELAY_MS);

    const lines = [
      { work_order: "WO-2026-0001", kind: "labour", description: "Diagnosis and gas check", hours: 3.5, rate_minor: 8500, date: "2026-03-08" },
      { work_order: "WO-2026-0001", kind: "labour", description: "Refit and test", hours: 1.25, rate_minor: 8500, date: "2026-03-08" },
      { work_order: "WO-2026-0001", kind: "parts", description: "Thermostat", quantity: 7, unit_cost_minor: 1299, markup_percent: 15, date: "2026-03-08" },
      { work_order: "WO-2026-0001", kind: "parts", description: "Fan motor", quantity: 2, unit_cost_minor: 4500, markup_percent: 0, date: "2026-03-08" },
    ];
    toolLine("work_order_add_line", lines[2]);
    for (const l of lines) await c.call("work_order_add_line", l);
    const got = pick(await c.call("work_order_get", { work_order: "WO-2026-0001" })).work_order;
    for (const l of got.lines_detail) {
      resultLine(l.kind === "labour"
        ? `  ${l.id}  labour  ${String(l.hours).padStart(5)} h  x ${l.rate.padEnd(9)}                   = ${l.value_minor.toString().padStart(7)}`
        : `  ${l.id}  parts   ${String(l.quantity).padStart(5)}    x ${l.unit_cost.padEnd(9)} +${String(l.markup_percent).padStart(3)}%  unit ${l.billed_unit_minor} = ${l.value_minor.toString().padStart(7)}`);
    }
    resultLine(`  hours ${got.hours}, labour ${got.labour_minor}, materials ${got.materials_minor} (cost ${got.parts_cost_minor}, markup earned ${got.markup_earned_minor}), net ${got.net_minor}`);
    resultLine("  7 x 1299 +15% is roundHalfUp(1299*1.15)=1494 a unit and 10,458; on the LINE total it is 10,457");
    resultLine("  one minor unit, and only the unit basis is one the invoice server can reproduce");
    await sleep(STEP_DELAY_MS);

    // No total is stored: the record holds the facts and every figure above is derived.
    toolLine("work_order_status", { work_order: "WO-2026-0001", status: "invoiced", date: "2026-03-09" });
    resultLine(await c.call("work_order_status", { work_order: "WO-2026-0001", status: "invoiced", date: "2026-03-09" }));
    resultLine("  every step carries its own date, so a skipped one loses the day the job reached it");
    await sleep(STEP_DELAY_MS);

    // A byte-identical job is refused BEFORE the cap is consulted: it names the id, not the upsell.
    toolLine("work_order_create", createArgs);
    resultLine(await c.call("work_order_create", createArgs));
    resultLine("  refused before the free cap is even read, so it burns neither a slot nor a WO number");
    await sleep(STEP_DELAY_MS);

    // The Pro gate, on the free tier, shown rather than described.
    toolLine("work_order_invoice_payload", { work_order: "WO-2026-0001" });
    resultLine(await c.call("work_order_invoice_payload", { work_order: "WO-2026-0001" }));
    resultLine("  Pro: the payload's totals are the INVOICE server's own computeTotals over the very items it hands you");
    resultLine("  it posts nothing and marks nothing: posted false, marked_invoiced false");
  }
  if (name === "petty-cash") {
    // This server reads no sibling store, so there is nothing to seed. Every figure recorded
    // below is one servers/petty-cash/test/unit.test.mjs asserts and docs/PETTY_CASH_RESULT.md
    // recomputes by hand: a 50,000 minor unit imprest, five vouchers totalling 20,194, a
    // count of 29,795 against an expected 29,806, and a replenishment of 20,205.
    const pick = (raw) => JSON.parse(raw);

    say("$ A petty cash tin on the imprest system. The count is free on every tier.\n");
    await sleep(STEP_DELAY_MS);

    const openArgs = { name: "Office float", currency: "EUR", imprest_minor: 50000, custodian: "Anna", opened: "2026-03-01" };
    toolLine("float_open", openArgs);
    const op = pick(await c.call("float_open", openArgs));
    resultLine(`${op.opened.id} ${op.opened.name}: imprest ${op.opened.imprest}, ${op.opened.custodian} holds the tin`);
    for (const j of op.journal) resultLine(`  ${j.account.padEnd(16)} Dr ${String(j.debit).padStart(7)}  Cr ${String(j.credit).padStart(7)}`);
    resultLine("  petty_cash is debited ONCE here and does not move again unless the imprest itself changes");
    await sleep(STEP_DELAY_MS);

    const vouchers = [
      { date: "2026-03-02", category: "postage", description: "Stamps", amount_minor: 1250, paid_to: "Post Office", receipt_ref: "R-1" },
      { date: "2026-03-05", category: "travel", description: "Taxi", amount_minor: 3480, paid_to: "City Cabs", receipt_ref: "4471" },
      { date: "2026-03-11", category: "office", description: "Coffee", amount_minor: 899, paid_to: "Corner Shop", receipt_ref: "R-3" },
      { date: "2026-03-18", category: "office", description: "Paper", amount_minor: 12500, paid_to: "Stationers", receipt_ref: "R-4" },
      { date: "2026-03-24", category: "travel", description: "Bus", amount_minor: 2065, paid_to: "Transit", receipt_ref: "R-5" },
    ];
    toolLine("voucher_add", vouchers[0]);
    for (const v of vouchers) {
      const r = pick(await c.call("voucher_add", v));
      resultLine(`  ${r.recorded.id}  ${r.recorded.date}  ${r.recorded.category.padEnd(8)} ${r.recorded.description.padEnd(7)} ${r.recorded.amount.padStart(10)}  ${r.expense_account.padEnd(17)} balance ${r.balance}`);
    }
    await sleep(STEP_DELAY_MS);

    // A float is cash in a tin and can never hold less than nothing.
    toolLine("voucher_add", { date: "2026-03-25", category: "office", description: "Laptop", amount_minor: 900000, paid_to: "Nobody" });
    resultLine(await c.call("voucher_add", { date: "2026-03-25", category: "office", description: "Laptop", amount_minor: 900000, paid_to: "Nobody" }));
    await sleep(STEP_DELAY_MS);

    // The count. Free and unlimited on every tier: this is the question the server exists for.
    toolLine("reconcile", { counted_minor: 29795, date: "2026-03-31" });
    const rc = pick(await c.call("reconcile", { counted_minor: 29795, date: "2026-03-31" }));
    resultLine(`expected ${rc.expected}, counted ${rc.counted}, difference ${rc.difference} ${rc.verdict}`);
    resultLine(`  ${rc.vouchers_reconciled.length} vouchers reconciled, ${rc.vouchers_reconciled_minor} minor units, balance from here ${rc.balance_after}`);
    resultLine("  free and unlimited on every tier: eleven cents no receipt will ever explain");
    await sleep(STEP_DELAY_MS);

    // The Pro gate, on the free tier, shown rather than described. The refusal is the
    // measured point of the whole server: the cheque is imprest minus balance, 20,205,
    // and never the sum of the vouchers, 20,194.
    toolLine("replenish_request", { date: "2026-03-31" });
    resultLine(await c.call("replenish_request", { date: "2026-03-31" }));
    resultLine("  Pro: the cheque is imprest MINUS BALANCE, 20,205, never the vouchers' 20,194");
    resultLine("  the 11 is a cash_over_short line. Reimburse 20,194 instead and the tin stays 11 short, for good");
  }
  if (name === "statement-of-account") {
    // The three books this server reads belong to mcp-invoice, mcp-billing-docs and
    // mcp-deposits. The demo seeds the same worked month the unit suite asserts against,
    // reusing that suite's own seeders, so every figure on screen is one recomputed by
    // hand in docs/STATEMENT_RESULT.md rather than one invented for the recording.
    const seedMod = await import(join(ROOT, "servers", "statement-of-account", "test", "_client.mjs"));
    seedMod.workedMonth(join(c.sandbox, "data"));

    // These tools answer in JSON and a whole answer does not fit the recorded frame, so the
    // demo prints picked fields. Every string below is copied out of the response.
    const pick = (raw) => JSON.parse(raw);

    say("$ One client, one month: the balance carried in, every movement, the balance out. Then age it as at a date.\n");
    await sleep(STEP_DELAY_MS);

    const buildArgs = { client: "Acme Ltd", from: "2026-06-01", to: "2026-06-30", currency: "EUR" };
    toolLine("statement_build", buildArgs);
    const st = pick(await c.call("statement_build", buildArgs));
    resultLine(`${st.statement_id} ${st.client} ${st.period.from} to ${st.period.to} ${st.currency}`);
    resultLine(`  opening ${st.opening_balance}  invoiced ${st.invoices_issued}  received ${st.payments_received} (of which ${st.of_which_deposits_applied} deposit)  credited ${st.credit_notes}`);
    for (const m of st.movements) resultLine(`  ${m.date}  ${m.reference.padEnd(13)} ${m.kind.padEnd(16)} ${m.amount}`);
    resultLine(`  closing ${st.closing_balance}. ${st.deposit_still_held} still held is the client's money and is NOT in that balance`);
    await sleep(STEP_DELAY_MS);

    // The measured point. Aged at 2026-06-10 a payment dated 2026-06-12 has NOT happened.
    const pastArgs = { as_of: "2026-06-10", client: "Acme Ltd", currency: "EUR" };
    toolLine("statement_aging", pastArgs);
    const pa = pick(await c.call("statement_aging", pastArgs)).aging[0];
    resultLine(`as at 2026-06-10: outstanding ${pa.outstanding}, overdue ${pa.overdue} (31-60 ${pa.buckets["31-60"].amount}), not yet due ${pa.not_yet_due}`);
    resultLine("  the 600.00 payment dated 2026-06-12 has not happened on the 10th, so it is not subtracted yet");
    resultLine("  bucket by due date and take today's paid figure off instead and the SAME book reports 1700.00 and zero overdue");
    await sleep(STEP_DELAY_MS);

    const nowArgs = { as_of: "2026-06-30", currency: "EUR" };
    toolLine("statement_aging", nowArgs);
    const rows = pick(await c.call("statement_aging", nowArgs)).aging;
    for (const r of rows) resultLine(`  ${r.client.padEnd(10)} outstanding ${r.outstanding.padEnd(12)} 0-30 ${r.buckets["0-30"].amount.padEnd(11)} not yet due ${r.not_yet_due.padEnd(12)} oldest overdue ${r.oldest_overdue}`);
    resultLine(`  due today is not overdue: day zero sits in not_yet_due, and ${rows[0].unapplied_credit} of credit is unapplied rather than cancelling another invoice`);
    await sleep(STEP_DELAY_MS);

    const dunArgs = { client: "Acme Ltd", level: 1, currency: "EUR", as_of: "2026-06-30" };
    toolLine("dunning_text", dunArgs);
    const dun = await c.call("dunning_text", dunArgs);
    for (const l of String(dun).split("\n").slice(0, 9)) resultLine(`  ${l}`);
    resultLine("  levels 2 and 3 change the tone and the deadline. The figures and the bank details never move");
    await sleep(STEP_DELAY_MS);

    // The Pro gate, on the free tier, shown rather than described.
    toolLine("statements_report", { as_of: "2026-06-30" });
    resultLine(await c.call("statements_report", { as_of: "2026-06-30" }));
  }
  if (name === "per-diem") {
    // The traveller on a saved trip comes from the suite's shared business profile, the same
    // file every other server reads, so the fixture writes it where that profile lives rather
    // than teaching this server a second place to look.
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const profileDir = join(c.sandbox, "data", "mcp-servers", "profile");
    mkdirSync(profileDir, { recursive: true });
    writeFileSync(join(profileDir, "business.json"), JSON.stringify({
      name: "Lucky Strike Software", default_currency: "PLN", timezone: "Europe/Warsaw",
    }, null, 2));

    // These tools answer in JSON and a whole answer does not fit the recorded frame, so the
    // demo prints picked fields. Every string below is copied out of the response, never rebuilt.
    const pick = (raw) => JSON.parse(raw);

    say("$ Price a trip on the tax authority's own table, and be refused when the country is not bundled.\n");
    await sleep(STEP_DELAY_MS);

    const plArgs = {
      scheme: "pl", destination: "Poland",
      start: "2026-03-02T08:00:00+01:00", end: "2026-03-04T18:00:00+01:00",
      meals_provided: [["breakfast"], [], []], lodging_nights: 2,
    };
    toolLine("perdiem_calc", plArgs);
    const pl = pick(await c.call("perdiem_calc", plArgs));
    resultLine(`Krakow, ${pl.total_hours} hours, ${pl.days.length} diet days:`);
    for (const d of pl.days) {
      const less = d.meal_deduction_minor ? ` less ${d.meals_provided.join(", ")} PLN ${(d.meal_deduction_minor / 100).toFixed(2)}` : "";
      resultLine(`  day ${d.day} ${d.hours}h ${d.basis}: PLN ${(d.gross_minor / 100).toFixed(2)}${less} = PLN ${(d.amount_minor / 100).toFixed(2)}`);
    }
    resultLine(`  diets ${pl.subsistence} + lodging ${pl.lodging_nights} x PLN 67.50 = ${pl.lodging} -> total ${pl.total}`);
    await sleep(STEP_DELAY_MS);

    const ukArgs = {
      scheme: "uk", destination: "United Kingdom",
      start: "2026-03-10T07:00:00Z", end: "2026-03-10T23:00:00Z",
      meals_provided: [["lunch"]],
    };
    toolLine("perdiem_calc", ukArgs);
    const uk = pick(await c.call("perdiem_calc", ukArgs));
    const ukd = uk.days[0];
    resultLine(`${ukd.hours}h, ${ukd.basis}: GBP ${(ukd.gross_minor / 100).toFixed(2)} less ${ukd.meals_provided.join(", ")} GBP ${(ukd.meal_deduction_minor / 100).toFixed(2)} = ${uk.total}`);
    await sleep(STEP_DELAY_MS);

    // The refusal that matters. An earlier build fell back to country.includes(destination),
    // and "romania".includes("oman") is true, so Oman came back priced at Romania's EUR 42.00.
    const omanArgs = { scheme: "pl", destination: "Oman", start: plArgs.start, end: plArgs.end };
    toolLine("perdiem_calc", omanArgs);
    resultLine(await c.call("perdiem_calc", omanArgs));
    await sleep(STEP_DELAY_MS);

    const tripArgs = { name: "Krakow client workshop", project: "acme", ...plArgs };
    toolLine("trip_record", tripArgs);
    const trip = pick(await c.call("trip_record", tripArgs));
    const r = trip.recorded;
    resultLine(`${r.id} "${r.name}" for ${r.traveller}, ${r.destination}, ${r.days} days: ${r.total}`);
    resultLine(`  ${trip.notes[trip.notes.length - 1]}`);
  }
  if (name === "catalogue") {
    // The catalogue reads the shared business profile for its currency and its VAT
    // fallback, the same file every other server reads, so the fixture writes it where
    // that profile lives. Nothing else is seeded: every figure below is one
    // servers/catalogue/test/unit.test.mjs asserts and docs/CATALOGUE_RESULT.md recomputes
    // by hand -- the 39000/45000/49500 ladder, the 2026-01-01 row picked on 2026-03-15,
    // and a net of 261,363 minor against the 26,136,300 the mis-scaled payload bills.
    const { writeFileSync: wf, mkdirSync: mk } = await import("node:fs");
    const profileDir = join(c.sandbox, "data", "mcp-servers", "profile");
    mk(profileDir, { recursive: true });
    wf(join(profileDir, "business.json"), JSON.stringify({
      name: "Nova Studio", address: "ul. Prosta 1, Warsaw", default_currency: "EUR",
      default_tax_rate: 23, payment_terms_days: 14, timezone: "Europe/Warsaw",
    }, null, 2));

    // These tools answer in JSON and a whole answer does not fit the recorded frame, so the
    // demo prints picked fields. Every number below is read out of the response, never rebuilt.
    const pick = (raw) => JSON.parse(raw);

    say("$ One price list both sibling servers read. The price on a date is a ROW, and the two payloads are two SCALES.\n");
    await sleep(STEP_DELAY_MS);

    const ladder = [
      { sku: "WEB-AUDIT", name: "Website audit", unit: "each", price_minor: 39000, valid_from: "2025-01-01" },
      { sku: "WEB-AUDIT", name: "Website audit", unit: "each", price_minor: 45000, valid_from: "2026-01-01" },
      { sku: "WEB-AUDIT", name: "Website audit", unit: "each", price_minor: 49500, valid_from: "2026-07-01" },
    ];
    toolLine("sku_set", ladder[2]);
    let created;
    // The first call creates the SKU and the two later ones add rows to it, so the answer
    // is keyed "created" once and "updated" after that.
    for (const s of ladder) { const j = pick(await c.call("sku_set", s)); created = j.created ?? j.updated; }
    resultLine(`${created.sku} "${created.name}" per ${created.unit}: ${created.rows} price rows, none of them "the" price`);
    for (const r of created.price_rows) resultLine(`  ${r.currency} ${r.tier.padEnd(8)} from ${r.valid_from}  ${r.price.padStart(10)}  (${r.price_minor} minor)`);
    await sleep(STEP_DELAY_MS);

    // The measured point. Three dates, three rows, and the middle one is picked on its own
    // merits: the row is named, and the row that already replaces it is named with it.
    for (const date of ["2025-06-30", "2026-03-15", "2026-09-01"]) {
      toolLine("sku_get", { sku: "WEB-AUDIT", date });
      const g = pick(await c.call("sku_get", { sku: "WEB-AUDIT", date }));
      resultLine(`  ${g.date} -> ${g.price} (${g.price_minor} minor) from the ${g.from_row.valid_from} row`
        + (g.superseded_by ? `, already replaced by ${g.superseded_by.price} from ${g.superseded_by.valid_from}` : ", nothing booked after it"));
    }
    resultLine("  the middle answer is 45000, not the 39000 it was and not the 49500 it becomes: no current price is stored");
    await sleep(STEP_DELAY_MS);

    for (const s of [
      { sku: "HOST-MO", name: "Managed hosting", unit: "month", price_minor: 3999, valid_from: "2025-01-01" },
      { sku: "COPY-1K", name: "Copywriting", unit: "1000 words", price_minor: 12000, valid_from: "2025-01-01" },
    ]) await c.call("sku_set", s);
    for (const r of [
      { role: "senior developer", hourly_minor: 8500, valid_from: "2025-01-01" },
      { role: "junior developer", hourly_minor: 4500, valid_from: "2025-01-01" },
    ]) await c.call("rate_set", r);

    const resolveArgs = {
      client: "Harbour Cafe", date: "2026-03-15",
      lines: [
        { sku: "WEB-AUDIT", quantity: 3 },
        { sku: "HOST-MO", quantity: 12 },
        { role: "senior developer", hours: 7.5 },
        { role: "junior developer", hours: 3.25 },
      ],
    };
    toolLine("lines_resolve", resolveArgs);
    const res = pick(await c.call("lines_resolve", resolveArgs));
    for (const l of res.lines) {
      resultLine(`  ${l.ref.padEnd(16)} ${String(l.quantity).padStart(5)} ${l.unit.padEnd(10)} x ${l.unit_price.padEnd(10)} = ${l.value.padStart(11)}  priced from the ${l.priced_from.valid_from} ${l.priced_from.tier} row`);
    }
    resultLine(`  net ${res.totals.net} (${res.totals.net_minor} minor), VAT ${res.totals.vat}, gross ${res.totals.total}, rounding_drift_minor ${res.totals.rounding_drift_minor}`);
    await sleep(STEP_DELAY_MS);

    // THE point of the server: one call, two payloads, and the scale printed against each.
    const inv = res.invoice_create.arguments.items;
    const quo = res.quote_create.arguments.items;
    resultLine(`  ${res.invoice_create.tool} (server ${res.invoice_create.server}): ${res.invoice_create.unit}`);
    resultLine(`    items[0] ${JSON.stringify(inv[0])}`);
    resultLine(`  ${res.quote_create.tool} (server ${res.quote_create.server}): ${res.quote_create.unit}`);
    resultLine(`    items[0] ${JSON.stringify(quo[0])}`);
    const ratio = quo.map((q, i) => q.unit_price_minor / inv[i].unit_price);
    resultLine(`  unit_price ${inv.map((i) => i.unit_price).join(" ")}  against  unit_price_minor ${quo.map((q) => q.unit_price_minor).join(" ")}`);
    resultLine(`  every line differs by exactly ${[...new Set(ratio)].join(" ")}x, so the quote payload fed to invoice_create bills ${res.totals.net_minor * 100} minor, not ${res.totals.net_minor}`);
    resultLine("  both fields are plain numbers and both are called the unit price: neither sibling tool can detect the swap");
    await sleep(STEP_DELAY_MS);

    // A code that is not in the catalogue is refused by name, and nothing is priced.
    const badArgs = { lines: [{ sku: "WEB-AUDT", quantity: 3 }], date: "2026-03-15" };
    toolLine("lines_resolve", badArgs);
    resultLine(await c.call("lines_resolve", badArgs));
    await sleep(STEP_DELAY_MS);

    // The Pro gate, on the free tier, shown rather than described.
    toolLine("catalogue_report", {});
    resultLine(await c.call("catalogue_report", {}));
  }
  await sleep(STEP_DELAY_MS);
  c.close();
  if (ecb) ecb.close();
}

const name = process.argv[2];
if (!name) { console.error("usage: drive.mjs <server-name>"); process.exit(1); }
run(name).catch((e) => { console.error(e); process.exit(1); });
