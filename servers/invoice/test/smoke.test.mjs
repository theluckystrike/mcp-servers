import test from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(here, "..", "dist", "index.js");
const REPO = join(here, "..", "..", "..");

function client(env = {}) {
  const home = mkdtempSync(join(tmpdir(), "mcp-invoice-"));
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
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve } = pending.get(msg.id);
        pending.delete(msg.id);
        resolve(msg);
      }
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
    notify: (method, params) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n"),
    call: async (name, args) => {
      const r = await send("tools/call", { name, arguments: args ?? {} });
      assert.ok(r.result, `tools/call ${name} returned ${JSON.stringify(r.error)}`);
      return { text: r.result.content.map((c) => c.text).join("\n"), isError: !!r.result.isError };
    },
    close: () => child.kill(),
  };
}

async function init(c) {
  const r = await c.send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0" },
  });
  assert.ok(r.result?.serverInfo, "initialize failed");
  assert.equal(r.result.serverInfo.name, "mcp-invoice");
  c.notify("notifications/initialized", {});
  return r.result;
}

test("stdio: initialize, tools/list, full invoice lifecycle, PDF", async (t) => {
  const c = client();
  t.after(() => c.close());

  await init(c);

  const list = await c.send("tools/list", {});
  const names = list.result.tools.map((x) => x.name).sort();
  for (const n of [
    "business_set", "client_add", "client_list", "invoice_create", "invoice_from_hours",
    "invoice_get", "invoice_list", "invoice_mark_paid", "invoice_pdf", "overdue_report",
    "license_activate", "license_status",
  ]) assert.ok(names.includes(n), `missing tool ${n} (have ${names.join(",")})`);

  const res = await c.send("resources/list", {});
  assert.ok(res.result.resources.some((r) => r.uri === "invoices://open"), "invoices://open not registered");

  let r = await c.call("business_set", {
    name: "Lucky Strike Software", address: "ul. Testowa 1\n00-001 Warsaw", email: "support@zovo.one",
    vat_id: "PL1234567890", iban: "PL61109010140000071219812874", bank: "Test Bank",
    default_currency: "EUR", default_tax_rate: 23, payment_terms_days: 14,
  });
  assert.equal(r.isError, false);
  assert.match(r.text, /Business profile saved/);

  r = await c.call("client_add", { name: "Acme GmbH", address: "Hauptstr. 5\nBerlin", email: "ap@acme.example", vat_id: "DE999999999" });
  assert.match(r.text, /Added client Acme GmbH/);

  r = await c.call("client_list", {});
  assert.match(r.text, /Acme GmbH/);

  r = await c.call("invoice_create", {
    client: "Acme GmbH",
    items: [
      { description: "Backend development, sprint 14. A deliberately long description so the PDF table has to wrap it across more than one line.", quantity: 12, unit_price: 90 },
      { description: "Server hosting", quantity: 1, unit_price: 50, tax_rate: 8 },
    ],
    issue_date: "2026-03-02", due_days: 14, notes: "Thanks for your business.",
  });
  assert.equal(r.isError, false);
  const number = r.text.match(/INV-2026-\d{4}/)[0];
  assert.equal(number, "INV-2026-0001");
  assert.match(r.text, /EUR 1382\.40/); // 1080.00 + 50.00 + 248.40 + 4.00
  const created = JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1));
  assert.equal(created.total_minor, 108000 + 5000 + 24840 + 400);
  assert.equal(created.status, "unpaid");

  r = await c.call("invoice_get", { number });
  const inv = JSON.parse(r.text);
  assert.equal(inv.number, number);
  assert.equal(inv.tax_lines.length, 2);

  const out = join(c.home, "acme.pdf");
  r = await c.call("invoice_pdf", { number, out_path: out });
  assert.equal(r.isError, false);
  assert.ok(existsSync(out), "PDF not written");
  const head = readFileSync(out).subarray(0, 5).toString("latin1");
  assert.equal(head, "%PDF-");
  const size = statSync(out).size;
  assert.ok(size > 1024, `PDF too small: ${size} bytes`);
  assert.match(r.text, /Generated with mcp-invoice by theluckystrike/); // free-tier note

  r = await c.call("invoice_mark_paid", { number, paid_date: "2026-03-10" });
  assert.match(r.text, /marked paid/);

  r = await c.call("invoice_list", { status: "paid" });
  assert.match(r.text, new RegExp(number));
  r = await c.call("invoice_list", { status: "unpaid" });
  assert.match(r.text, /No invoices match/);

  r = await c.call("invoice_from_hours", { client: "Acme GmbH", hours: 3.5, rate: 100, issue_date: "2026-03-05" });
  assert.match(r.text, /INV-2026-0002/);

  // numbering never repeats
  const numbers = new Set();
  r = await c.call("invoice_list", {});
  for (const m of r.text.matchAll(/INV-2026-\d{4}/g)) numbers.add(m[0]);
  assert.equal(numbers.size, 2);

  // overdue_report is Pro: free returns the upgrade text as plain text, not an error
  r = await c.call("overdue_report", {});
  assert.equal(r.isError, false);
  assert.match(r.text, /Pro feature/);
  assert.match(r.text, /mcp\.zovo\.one\/buy\/invoice/);
});

test("free tier blocks a 4th invoice in a calendar month; Pro allows it", async (t) => {
  const key = execFileSync(process.execPath,
    [join(REPO, "scripts", "sign-license.mjs"), "invoice"], { encoding: "utf8" }).trim();
  assert.match(key, /^MCPL1\./);

  const free = client();
  t.after(() => free.close());
  await init(free);
  await free.call("business_set", { name: "Solo Dev", default_currency: "EUR" });

  const mk = (c, n) => c.call("invoice_create", {
    client: "Repeat Client",
    items: [{ description: `Job ${n}`, quantity: 1, unit_price: 100 }],
    issue_date: "2026-04-10",
  });

  for (let i = 1; i <= 3; i++) {
    const r = await mk(free, i);
    assert.equal(r.isError, false);
    assert.match(r.text, /Created invoice INV-2026-000\d/);
  }
  const blocked = await mk(free, 4);
  assert.equal(blocked.isError, false, "gate must not be an error result");
  assert.match(blocked.text, /free tier allows 3 invoices per calendar month/i);
  assert.match(blocked.text, /mcp\.zovo\.one\/buy\/invoice/);
  const after = await free.call("invoice_list", {});
  assert.equal(JSON.parse(after.text).count, 3, "blocked invoice must not be stored");

  const pro = client({ MCP_LICENSE_KEY: key });
  t.after(() => pro.close());
  await init(pro);
  const st = await pro.call("license_status", {});
  assert.match(st.text, /"tier": "pro"/);
  await pro.call("business_set", { name: "Solo Dev", default_currency: "EUR", invoice_prefix: "ACME" });
  for (let i = 1; i <= 4; i++) {
    const r = await mk(pro, i);
    assert.equal(r.isError, false);
    assert.match(r.text, /Created invoice ACME-2026-000\d/, `pro invoice ${i} was blocked: ${r.text}`);
  }
  const proList = await pro.call("invoice_list", {});
  assert.equal(JSON.parse(proList.text).count, 4);

  // Pro-only extras
  const rep = await pro.call("overdue_report", { as_of: "2026-06-01" });
  assert.equal(rep.isError, false);
  const parsed = JSON.parse(rep.text);
  assert.equal(parsed.count, 4);
  assert.ok(parsed.invoices[0].days_overdue > 0);
  assert.deepEqual(parsed.totals_per_currency, ["EUR 400.00"]);

  // Pro PDF carries no branding footer
  const out = join(pro.home, "pro.pdf");
  const pr = await pro.call("invoice_pdf", { number: "ACME-2026-0001", out_path: out });
  assert.equal(pr.isError, false);
  assert.doesNotMatch(pr.text, /Generated with mcp-invoice/);
  const bytes = readFileSync(out).toString("latin1");
  assert.ok(bytes.startsWith("%PDF-"));
  assert.ok(statSync(out).size > 1024);
});
