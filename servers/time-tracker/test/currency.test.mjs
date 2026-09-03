// D-3: per-entry currency ("90 euros an hour" -> EUR 225.00, never "$")
// D-7: a partial project name that matches exactly one existing project is used, ambiguity is listed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// D-R15: "today" is the LOCAL calendar date in every server; a UTC slice disagrees
// with it for any run before UTC midnight in a positive-offset zone.
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const here = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(here, "..", "dist", "index.js");
const REPO = join(here, "..", "..", "..");

function client(env) {
  const sandbox = mkdtempSync(join(tmpdir(), "mcp-tt-cur-"));
  const child = spawn(process.execPath, [ENTRY], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, XDG_DATA_HOME: join(sandbox, "data"), XDG_CONFIG_HOME: join(sandbox, "config"), MCP_LICENSE_KEY: "", ...env },
  });
  let buf = "";
  const pending = new Map();
  child.stdout.on("data", chunk => {
    buf += chunk.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      const r = pending.get(msg.id);
      if (r) { pending.delete(msg.id); r(msg); }
    }
  });
  let id = 0;
  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, res);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: mid, method, params }) + "\n");
    const t = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(`timeout on ${method}`)); } }, 10000);
    t.unref();
  });
  return {
    sandbox,
    async call(name, args) {
      const r = await send("tools/call", { name, arguments: args ?? {} });
      assert.ok(r.result, `tools/call ${name} returned ${JSON.stringify(r.error)}`);
      return { text: r.result.content.map(c => c.text).join("\n"), isError: r.result.isError === true };
    },
    async init() {
      await send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "currency", version: "0" } });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
    },
    close() { child.kill(); try { rmSync(sandbox, { recursive: true, force: true }); } catch {} },
  };
}

const today = localDay();
const DAY = { from: `${today}T00:00:00`, to: `${today}T23:59:59` };

test("D-3: 2.5 hours at 90 euros an hour comes back as EUR 225.00, mixed currencies stay apart", async (t) => {
  const c = client({});
  t.after(() => c.close());
  await c.init();

  // the model may pass the words the user said
  const add = await c.call("entry_add", { project: "acme", task: "design review", start: `${today}T09:00:00`, minutes: 150, rate: "90 euros an hour" });
  assert.equal(add.isError, false, add.text);
  assert.match(add.text, /EUR 90\.00\/h/);
  assert.match(add.text, /EUR 225\.00/);
  assert.doesNotMatch(add.text, /\$/, "no dollar sign for a euro rate");

  // or an explicit currency word
  const add2 = await c.call("entry_add", { project: "beta", task: "support", start: `${today}T13:00:00`, minutes: 60, rate: 100, currency: "usd" });
  assert.match(add2.text, /USD 100\.00/);

  // report keeps the two currencies apart
  const tbl = await c.call("report", { ...DAY, group_by: "project" });
  assert.match(tbl.text, /EUR 225\.00/);
  assert.match(tbl.text, /USD 100\.00/);
  assert.match(tbl.text, /Total 3\.50 h, EUR 225\.00 \+ USD 100\.00\./);
  assert.doesNotMatch(tbl.text, /\$/);

  const js = JSON.parse((await c.call("report", { ...DAY, group_by: "project", format: "json" })).text.split("\n\nNote:")[0]);
  const acme = js.rows.find(r => r.key === "acme");
  assert.equal(acme.currency, "EUR");
  assert.equal(acme.amount_cents, 22500);
  assert.deepEqual(js.total.amounts.map(a => a.currency).sort(), ["EUR", "USD"]);

  // csv gets one line per currency, never a summed number
  const csv = await c.call("report", { ...DAY, group_by: "project", format: "csv" });
  assert.match(csv.text, /^acme,2\.50,2\.50,225\.00,EUR$/m);
  assert.match(csv.text, /^beta,1\.00,1\.00,100\.00,USD$/m);
  assert.match(csv.text, /^TOTAL,3\.50,,225\.00,EUR$/m);
  assert.match(csv.text, /^TOTAL,3\.50,,100\.00,USD$/m);

  // export uses the entry currency
  const exp = await c.call("export_csv", {});
  const path = exp.text.replace(/^Wrote \d+ entries to /, "").split("\n")[0].trim();
  const rows = readFileSync(path, "utf8").trim().split("\n");
  assert.match(rows.find(r => r.includes("acme")), /,90\.00,EUR,225\.00,/);
  assert.match(rows.find(r => r.includes("beta")), /,100\.00,USD,100\.00,/);

  // a project rate stated in words
  const pr = await c.call("project_set_rate", { project: "gamma", hourly_rate: "90 euros an hour" });
  assert.match(pr.text, /EUR 90\.00 per hour/);
  const pr2 = await c.call("project_set_rate", { project: "delta", hourly_rate: 60, currency: "pounds" });
  assert.match(pr2.text, /GBP 60\.00 per hour/);
});

test("D-3: invoice_summary bills in the entry currency", async (t) => {
  const key = execFileSync(process.execPath, [join(REPO, "scripts", "sign-license.mjs"), "time-tracker"], { encoding: "utf8" }).trim();
  const c = client({ MCP_LICENSE_KEY: key });
  t.after(() => c.close());
  await c.init();
  await c.call("entry_add", { project: "acme", task: "design review", start: `${today}T09:00:00`, minutes: 150, rate: "90 eur" });
  const inv = await c.call("invoice_summary", { project: "acme", ...DAY });
  assert.equal(inv.isError, false, inv.text);
  assert.match(inv.text, /EUR 90\.00/);          // rate
  assert.match(inv.text, /TOTAL 2\.50 h  EUR 225\.00/);
  assert.doesNotMatch(inv.text, /\$/);
  assert.doesNotMatch(inv.text, /USD/);
});

test("D-7: a partial project name resolves to the one existing project, ambiguity is listed", async (t) => {
  const c = client({});
  t.after(() => c.close());
  await c.init();

  await c.call("timer_start", { project: "Acme website", task: "setup" });
  await c.call("timer_stop", {});

  // "Acme" prefixes exactly one existing project
  const add = await c.call("entry_add", { project: "Acme", task: "css", start: `${today}T09:00:00`, minutes: 30 });
  assert.equal(add.isError, false, add.text);
  assert.match(add.text, /Used the existing project "Acme website"/);
  assert.match(add.text, /"Acme website" - css/);

  // timer_start does the same
  const st = await c.call("timer_start", { project: "acme", task: "more css" });
  assert.match(st.text, /Used the existing project "Acme website"/);
  assert.match(st.text, /Started timer for "Acme website"/);
  await c.call("timer_stop", {});

  // a second Acme project makes the short name ambiguous: nothing is logged
  await c.call("entry_add", { project: "Acme mobile", task: "spec", start: `${today}T11:00:00`, minutes: 30 });
  const amb = await c.call("entry_add", { project: "Acme", task: "unclear", start: `${today}T12:00:00`, minutes: 30 });
  assert.equal(amb.isError, false, "ambiguity is a question, not an error");
  assert.match(amb.text, /matches 2 existing projects/);
  assert.match(amb.text, /"Acme mobile"/);
  assert.match(amb.text, /"Acme website"/);
  assert.match(amb.text, /Nothing was written or reported/);

  const ambTimer = await c.call("timer_start", { project: "Acme" });
  assert.match(ambTimer.text, /matches 2 existing projects/);

  const list = await c.call("entry_list", {});
  assert.doesNotMatch(list.text, /unclear/, "the ambiguous entry must not have been written");
  const exact = await c.call("entry_add", { project: "Acme mobile", task: "clear", start: `${today}T13:00:00`, minutes: 30 });
  assert.doesNotMatch(exact.text, /matches/);
  assert.match(exact.text, /"Acme mobile" - clear/);
});
