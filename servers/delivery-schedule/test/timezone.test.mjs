// "Late as at a date" must not move when the machine does.
//
// The report is the only number a client argues with, and it is a comparison of dates. A
// server that compared timestamps rather than calendar dates would call the same
// deliverable late in Auckland and on time in Honolulu on the same afternoon, from one
// unchanged store. This suite runs the same store through the same calls under two
// timezones fourteen hours apart at each end of the range, and asserts every reading is
// byte-identical.
import { test } from "node:test";
import assert from "node:assert/strict";
import { client, sandbox, cleanup, proKey, writeProfile, seed, AS_OF_LATE, AS_OF_EARLIER, AS_OF_DUE_TODAY } from "./_client.mjs";

const ZONES = ["Pacific/Kiritimati", "Pacific/Niue", "UTC", "Europe/Warsaw"];

/** One seeded sandbox, read back under a given TZ. */
async function readUnder(t, box, tz, calls) {
  const c = client({ dataHome: box.dataHome, key: proKey(), env: { TZ: tz } });
  t.after(() => c.close());
  await c.init();
  const out = [];
  for (const [tool, args] of calls) out.push(await c.call(tool, args));
  return out;
}

test("every as_of reading is identical under timezones fourteen hours apart", async (t) => {
  const box = sandbox();
  writeProfile(box.dataHome);
  t.after(() => cleanup(box.dir));

  // Seed once, in one zone. Every later read is of the same bytes on disk.
  const seeder = client({ dataHome: box.dataHome, key: proKey(), env: { TZ: "UTC" } });
  await seeder.init();
  const id = await seed(seeder);
  seeder.close();

  const calls = [
    ["late_report", { as_of: AS_OF_LATE }],
    ["late_report", { as_of: AS_OF_EARLIER }],
    ["late_report", { as_of: AS_OF_DUE_TODAY }],
    ["delivery_schedule_get", { schedule: id, as_of: AS_OF_LATE }],
    ["milestone_payload", { schedule: id, as_of: AS_OF_LATE, issue_date: "2026-05-06" }],
    ["delivery_schedule_document", { schedule: id, as_of: AS_OF_LATE }],
  ];

  const baseline = await readUnder(t, box, ZONES[0], calls);
  for (const zone of ZONES.slice(1)) {
    const got = await readUnder(t, box, zone, calls);
    for (let i = 0; i < calls.length; i++) {
      assert.equal(got[i].isError, baseline[i].isError, `${calls[i][0]} errored in ${zone} but not in ${ZONES[0]}`);
      assert.equal(got[i].text, baseline[i].text,
        `${calls[i][0]} with as_of ${JSON.stringify(calls[i][1].as_of)} answered differently in ${zone} than in ${ZONES[0]}`);
    }
  }
});

test("the profile timezone, not the machine, decides what today is when as_of is omitted", async (t) => {
  const box = sandbox();
  // A profile with no timezone falls back to the machine's calendar date; with one, the
  // home zone decides. Both are stable answers, and both say which they used.
  writeProfile(box.dataHome, { timezone: "Pacific/Kiritimati" });
  t.after(() => cleanup(box.dir));
  const c = client({ dataHome: box.dataHome, env: { TZ: "Pacific/Niue" } });
  t.after(() => c.close());
  await c.init();
  await c.call("delivery_schedule_create", { reference: "WO-2026-0011", reference_date: "2020-01-01", client: "Harbour Cafe", title: "Job" });

  const r = await c.json("late_report", {});
  assert.equal(r.as_of_source, "today", "an omitted as_of must say it fell back to today");
  const kiritimati = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Kiritimati", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  assert.equal(r.as_of, kiritimati,
    "today came from the machine's TZ (Pacific/Niue) rather than the shared profile's home zone, which is a whole day out");
});

test("days_late is a whole number of days across a daylight-saving boundary", async (t) => {
  const box = sandbox();
  writeProfile(box.dataHome, { timezone: "Europe/Warsaw" });
  t.after(() => cleanup(box.dir));
  const c = client({ dataHome: box.dataHome, env: { TZ: "Europe/Warsaw" } });
  t.after(() => c.close());
  await c.init();
  // Warsaw moves to summer time on 2026-03-29, so 03-25 to 04-02 spans the change.
  await c.call("delivery_schedule_create", { reference: "WO-2026-0012", reference_date: "2026-03-01", client: "Harbour Cafe", title: "Spring job" });
  await c.call("deliverable_add", { schedule: "DS-2026-0001", description: "Spring deliverable", due_date: "2026-03-25", value_minor: 1000 });
  const r = await c.json("late_report", { as_of: "2026-04-02" });
  assert.equal(r.late[0].days_late, 8, "eight calendar days, whatever the clocks did on 2026-03-29");
  assert.ok(Number.isInteger(r.late[0].days_late));
});
