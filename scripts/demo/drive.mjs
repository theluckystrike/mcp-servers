#!/usr/bin/env node
// Demo driver: spawns a server's dist/index.js over stdio, runs initialize + a
// short scripted sequence of tool calls, and prints the exchange the way a
// person would see it in a chat client (prompt, tool call, result), with a
// short pause between steps so a terminal recorder captures readable beats.
//
// Usage: node scripts/demo/drive.mjs <server-name>
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
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
  const c = client(entry, env, { showStderr });
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

  await sleep(STEP_DELAY_MS);
  c.close();
  if (ecb) ecb.close();
}

const name = process.argv[2];
if (!name) { console.error("usage: drive.mjs <server-name>"); process.exit(1); }
run(name).catch((e) => { console.error(e); process.exit(1); });
