// D-R83: a URL handed to a path argument must be refused by name, not resolved as a
// relative filesystem path (which used to leak the server's own cwd in the error text).
import test from "node:test";
import assert from "node:assert/strict";
import { client, cleanup, sandbox } from "./_client.mjs";

test("ics_import refuses a URL given as path instead of resolving it against cwd", async () => {
  const s = sandbox();
  const c = client({ dataHome: s.dataHome });
  try {
    await c.init();
    const r = await c.call("ics_import", { path: "http://127.0.0.1:8794/basic.ics", name: "work" });
    assert.equal(r.isError, true);
    assert.match(r.text, /is a URL, not a file path/);
    assert.match(r.text, /url argument/);
    assert.doesNotMatch(r.text, /no file at/);
    // never leaks the server's cwd
    assert.equal(r.text.includes(process.cwd()), false);
  } finally { c.close(); cleanup(s.dir); }
});

const ICS_TEXT = [
  "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//EN",
  "BEGIN:VEVENT", "UID:one@test", "DTSTART:20260110T090000Z", "DTEND:20260110T100000Z", "SUMMARY:Kickoff",
  "END:VEVENT", "END:VCALENDAR",
].join("\r\n") + "\r\n";

test("event_export refuses a URL for out_path the same way", async () => {
  const s = sandbox();
  const c = client({ dataHome: s.dataHome });
  try {
    await c.init();
    const imported = await c.call("ics_import", { text: ICS_TEXT, name: "work" });
    assert.equal(imported.isError, false, imported.text);
    const r = await c.call("event_export", { from: "2026-01-01", to: "2026-01-31", out_path: "https://example.com/out.ics" });
    assert.equal(r.isError, true);
    assert.match(r.text, /is a URL, not a file path/);
  } finally { c.close(); cleanup(s.dir); }
});
