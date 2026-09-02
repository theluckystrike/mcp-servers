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

function client(entry, env) {
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
  const c = client(entry, {});
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

  await sleep(STEP_DELAY_MS);
  c.close();
}

const name = process.argv[2];
if (!name) { console.error("usage: drive.mjs <server-name>"); process.exit(1); }
run(name).catch((e) => { console.error(e); process.exit(1); });
