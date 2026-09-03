/**
 * Adversarial probes, docs/TIMEZONE_AUDIT.md. Every test here is a probe that either
 * failed before the audit or guards a bound that a caller can otherwise blow past.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(here, "..", "dist", "index.js");
const tz = await import(join(here, "..", "dist", "tz.js"));

function client() {
  const home = mkdtempSync(join(tmpdir(), "mcp-tz-adv-"));
  const child = spawn(process.execPath, [ENTRY], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, XDG_DATA_HOME: join(home, "data"), XDG_CONFIG_HOME: join(home, "cfg"), MCP_LICENSE_KEY: "" },
  });
  child.stderr.resume();
  let buf = "";
  const pending = new Map();
  const nonJson = [];
  child.stdout.on("data", (d) => {
    buf += d.toString();
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { nonJson.push(line); continue; }
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
    home, nonJson, send,
    notify: (m, p) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: m, params: p }) + "\n"),
    raw: (name, args) => send("tools/call", { name, arguments: args ?? {} }),
    call: async (name, args) => {
      const r = await send("tools/call", { name, arguments: args ?? {} });
      if (!r.result) return { text: JSON.stringify(r.error), isError: true, rpcError: true };
      return { text: r.result.content.map((c) => c.text).join("\n"), isError: !!r.result.isError };
    },
    close: () => child.kill(),
  };
}
async function init(c) {
  await c.send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "adv", version: "0" } });
  c.notify("notifications/initialized", {});
}

const MB = "a".repeat(1_000_000);

test("a 1 MB argument is refused at the schema, not echoed back", async (t) => {
  const c = client(); t.after(() => c.close()); await init(c);
  const zone = await c.call("now", { zones: [MB] });
  assert.ok(zone.isError);
  assert.ok(zone.text.length < 2000, `error was ${zone.text.length} characters`);
  assert.match(zone.text, /100 characters or fewer/);

  const title = await c.call("ics_create", { title: MB, start: "2026-09-10 15:00", zone: "Warsaw", duration_minutes: 60 });
  assert.ok(title.isError);
  assert.ok(title.text.length < 2000);
});

test("unknown and near-miss place names", async (t) => {
  const c = client(); t.after(() => c.close()); await init(c);
  const good = await c.call("now", { zones: ["New york", "warsaw", "PST", "CET", "GMT+2", "Europe/warsaw", "poland"] });
  assert.ok(!good.isError, good.text);
  assert.match(good.text, /America\/New_York/);
  assert.match(good.text, /Europe\/Warsaw/);
  assert.match(good.text, /America\/Los_Angeles/);
  assert.match(good.text, /Etc\/GMT-2/);

  const bad = await c.call("now", { zones: ["Xanadu"] });
  assert.ok(bad.isError);
  assert.match(bad.text, /unknown time zone or place/);

  // a fixed offset with minutes is not an IANA zone; say so instead of suggesting UTC
  const half = await c.call("now", { zones: ["UTC+5:30"] });
  assert.ok(half.isError);
  assert.match(half.text, /fixed offset with minutes/);
});

test("bounds: days, duration, participants, work_start after work_end", async (t) => {
  const c = client(); t.after(() => c.close()); await init(c);
  const p = [{ name: "a", zone: "Warsaw" }];
  assert.ok((await c.call("find_meeting_slots", { participants: p, days: 0 })).isError);
  assert.ok((await c.call("find_meeting_slots", { participants: p, days: 10000 })).isError);
  assert.ok((await c.call("find_meeting_slots", { participants: p, duration_minutes: 0 })).isError);
  assert.ok((await c.call("find_meeting_slots", { participants: p, duration_minutes: 100000 })).isError);
  const many = Array.from({ length: 200 }, (_, i) => ({ name: `p${i}`, zone: "Warsaw" }));
  assert.ok((await c.call("find_meeting_slots", { participants: many })).isError);
  const bad = await c.call("overlap", { zones: ["Warsaw", "Denver"], work_start: "17:00", work_end: "09:00" });
  assert.ok(bad.isError);
  assert.match(bad.text, /must be after work_start/);
});

test("business_days refuses a span it cannot walk instead of reporting a short count", () => {
  const r = tz.businessDays("2026-09-01", "2026-09-30", "Europe/Warsaw", []);
  assert.equal(r.days.length, 22);
  assert.equal(r.total, 30);
  assert.throws(() => tz.businessDays("1900-01-01", "2100-01-01", "Europe/Warsaw", []), /calendar days; this tool counts at most/);
});

test("a second contact with the same name says what it replaced", async (t) => {
  const c = client(); t.after(() => c.close()); await init(c);
  await c.call("contacts_set", { name: "Sara", zone: "Sydney" });
  const again = await c.call("contacts_set", { name: " sara ", zone: "Austin" });
  assert.match(again.text, /Replaced the saved Sara \(was Australia\/Sydney/);
  const list = await c.call("contacts_list", {});
  assert.equal((list.text.match(/America\/Chicago/g) ?? []).length, 1);
});

test("ics escapes commas, semicolons and newlines, and DTSTART is UTC", async (t) => {
  const c = client(); t.after(() => c.close()); await init(c);
  const out = join(c.home, "esc.ics");
  const r = await c.call("ics_create", {
    title: "Nova, kickoff\nsecond; line", start: "2026-09-10 15:00", zone: "Warsaw",
    duration_minutes: 60, attendees: ["sara@example.com", "Tom"], out_path: out,
  });
  assert.ok(!r.isError, r.text);
  const ics = readFileSync(out, "utf8");
  assert.ok(ics.includes("SUMMARY:Nova\\, kickoff\\nsecond\\; line\r\n"), ics);
  assert.match(ics, /DTSTART:20260910T130000Z/);
  assert.match(ics, /ATTENDEE;CN=sara;RSVP=TRUE:mailto:sara@example.com/);
  assert.ok(ics.split("\r\n").every((l) => Buffer.byteLength(l, "utf8") <= 75));
});

test("an unwritable out_path fails cleanly and writes nothing", async (t) => {
  const c = client(); t.after(() => c.close()); await init(c);
  const r = await c.call("ics_create", { title: "x", start: "2026-09-10 15:00", zone: "Warsaw", duration_minutes: 60, out_path: "/proc/nope/x.ics" });
  assert.ok(r.isError, r.text);
  assert.ok(!existsSync("/proc/nope/x.ics"));
});

test("DST gap and fold, and far dates", async (t) => {
  const c = client(); t.after(() => c.close()); await init(c);
  const gap = await c.call("convert_time", { time: "2026-03-29 02:30", from_zone: "Europe/Warsaw", to_zones: ["UTC"] });
  assert.match(gap.text, /2026-03-29 03:30/);           // the gap time lands after the jump
  assert.match(gap.text, /UTC instant: 2026-03-29T01:30/);
  const fold = await c.call("convert_time", { time: "2026-10-25 02:30", from_zone: "Europe/Warsaw", to_zones: ["UTC"] });
  assert.match(fold.text, /UTC instant: 2026-10-25T01:30/); // the second (post-fold) reading
  const old = await c.call("convert_time", { time: "1900-06-15 12:00", from_zone: "Europe/Warsaw", to_zones: ["America/New_York"] });
  assert.ok(!old.isError, old.text);
  const far = await c.call("convert_time", { time: "2100-06-15 12:00", from_zone: "Europe/Warsaw", to_zones: ["America/New_York"] });
  assert.ok(!far.isError, far.text);
});

test("missing and wrong-typed arguments are refused, and stdout stays JSON-RPC", async (t) => {
  const c = client(); t.after(() => c.close()); await init(c);
  const missing = await c.call("convert_time", {});
  assert.ok(missing.isError, missing.text);
  assert.match(missing.text, /Required at time/);
  const typed = await c.call("convert_time", { time: 123, from_zone: "Warsaw", to_zones: ["UTC"] });
  assert.ok(typed.isError);
  assert.match(typed.text, /Expected string, received number/);
  await c.call("now", {});
  assert.deepEqual(c.nonJson, []);
});

test("business_days says whether a holiday list was used (D-T1)", async (t) => {
  const c = client(); t.after(() => c.close()); await init(c);
  const bare = await c.call("business_days", { from: "2026-09-01", to: "2026-09-30", zone: "Poland" });
  assert.match(bare.text, /22 business day\(s\) of 30 calendar day\(s\)/);
  assert.match(bare.text, /no national holiday calendar/);
  const withHol = await c.call("business_days", { from: "2026-11-01", to: "2026-11-30", zone: "Poland", holidays: ["2026-11-01", "2026-11-11"] });
  assert.match(withHol.text, /Excluded as holidays: 2026-11-01, 2026-11-11/);
});
