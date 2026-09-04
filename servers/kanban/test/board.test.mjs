// Unit tests for the pure board logic. index.js boots a stdio server on import, so the
// arithmetic lives in board.js and is exercised here without a child process.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COLUMNS, ambiguousText, doneColumn, hm, isDone, isDueOn, isOverdue,
  makeId, resolveProject, slugFor, totalActual, totalEstimate,
} from "../dist/board.js";

const task = (o) => ({
  id: "X-1", project: "Nova Site", title: "t", tags: [], priority: "normal",
  column: "todo", created: "2026-01-01T00:00:00.000Z", updated: "2026-01-01T00:00:00.000Z", ...o,
});

test("ids: base36 of a per-board counter, prefixed with the project slug", () => {
  assert.equal(slugFor("Nova"), "NOVA");
  assert.equal(slugFor("Nova Site"), "NS");            // multi-word: initials
  assert.equal(slugFor("Acme Website Redesign Now"), "AWRN");
  assert.equal(slugFor("!!"), "TASK");                 // never empty
  assert.equal(slugFor("Nova", ["NOVA"]), "NOVA2");    // never collides with a live board

  assert.equal(makeId("NOVA", 1), "NOVA-1");
  assert.equal(makeId("NOVA", 35), "NOVA-Z");
  assert.equal(makeId("NOVA", 38), "NOVA-12");         // base36
  // stable: the same counter always renders the same id
  assert.equal(makeId("NOVA", 38), makeId("NOVA", 38));
  // and monotonic ids never repeat
  const ids = new Set(Array.from({ length: 500 }, (_, i) => makeId("NOVA", i + 1)));
  assert.equal(ids.size, 500);
});

test("moves: the done column is 'done', or the last column when a board renames it", () => {
  assert.equal(doneColumn(DEFAULT_COLUMNS), "done");
  assert.equal(doneColumn(["inbox", "next", "shipped"]), "shipped");

  const open = task({ column: "doing" });
  assert.equal(isDone(open, DEFAULT_COLUMNS), false);
  const moved = { ...open, column: "done" };
  assert.equal(isDone(moved, DEFAULT_COLUMNS), true);
  // a task carrying a done stamp counts as done wherever it sits
  assert.equal(isDone(task({ column: "review", done_at: "2026-03-02T10:00:00.000Z" }), DEFAULT_COLUMNS), true);
  // custom board: "done" is not a column, so the last one closes the task
  assert.equal(isDone({ ...open, column: "shipped" }, ["inbox", "next", "shipped"]), true);
});

test("overdue flips exactly at local midnight, not at a UTC instant", () => {
  const due = task({ due: "2026-03-10", column: "todo" });
  // the whole of the due day is still on time
  assert.equal(isOverdue(due, "2026-03-09", DEFAULT_COLUMNS), false);
  assert.equal(isOverdue(due, "2026-03-10", DEFAULT_COLUMNS), false);
  assert.equal(isDueOn(due, "2026-03-10", DEFAULT_COLUMNS), true);
  // the next local day, and only then, it is late
  assert.equal(isOverdue(due, "2026-03-11", DEFAULT_COLUMNS), true);
  // finished work is never overdue
  assert.equal(isOverdue({ ...due, column: "done" }, "2026-03-11", DEFAULT_COLUMNS), false);
  // no due date, no overdue
  assert.equal(isOverdue(task({}), "2026-03-11", DEFAULT_COLUMNS), false);
  // month and year rollovers compare as day keys, so no off-by-one
  assert.equal(isOverdue(task({ due: "2026-02-28" }), "2026-03-01", DEFAULT_COLUMNS), true);
  assert.equal(isOverdue(task({ due: "2026-12-31" }), "2027-01-01", DEFAULT_COLUMNS), true);
  assert.equal(isOverdue(task({ due: "2026-12-31" }), "2026-12-31", DEFAULT_COLUMNS), false);
});

test("estimate and actual totals ignore tasks that carry no number", () => {
  const list = [
    task({ estimate_minutes: 90, actual_minutes: 120 }),
    task({ estimate_minutes: 30 }),
    task({}),
    task({ estimate_minutes: 0, actual_minutes: 45 }),
  ];
  assert.equal(totalEstimate(list), 120);
  assert.equal(totalActual(list), 165);
  assert.equal(totalEstimate([]), 0);
  assert.equal(hm(0), "-");
  assert.equal(hm(45), "45m");
  assert.equal(hm(60), "1h");
  assert.equal(hm(90), "1h 30m");
  assert.equal(hm(120), "2h");
});

test("project resolution: exact, prefix, containment, ambiguity", () => {
  const known = ["Nova Site", "Acme Website", "Acme App"];
  assert.deepEqual(resolveProject(known, "Nova Site"), { kind: "use", project: "Nova Site", note: undefined });

  const ci = resolveProject(known, "nova site");
  assert.equal(ci.kind, "use");
  assert.equal(ci.project, "Nova Site");
  assert.match(ci.note, /Matched the existing project/);

  const prefix = resolveProject(known, "nova");
  assert.equal(prefix.project, "Nova Site");
  assert.match(prefix.note, /you said "nova"/);

  const amb = resolveProject(known, "acme");
  assert.equal(amb.kind, "ambiguous");
  assert.deepEqual(amb.candidates, ["Acme App", "Acme Website"]);
  const text = ambiguousText("acme", amb.candidates);
  assert.match(text, /matches 2 existing projects/);
  assert.match(text, /Nothing was written/);

  // an unknown name creates a new board rather than guessing
  assert.deepEqual(resolveProject(known, "Zephyr"), { kind: "use", project: "Zephyr" });
});
