// "First five minutes" traceability (docs/CONTENT_R15_RESULT.md).
//
// Every /s/<id> page carries a section built by scripts/build-pages.mjs out of the
// measurement rounds in data/. The point of the section is that a reader can check it:
// the prompt is one a round actually ran, the sentence under it is that round's own
// evidence, and the round and date name where to look. This suite re-derives all of that
// from data/ independently of the generator and fails if the rendered page and the round
// files have drifted apart. It reads files only, so it costs nothing to run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES } from "../src/pages.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA = join(ROOT, "data");
const ROUND_FILES = readdirSync(DATA).filter((f) => /^user_value(?:_r\d+)?\.json$/.test(f)).sort();
const FACTS = JSON.parse(readFileSync(join(DATA, "facts.json"), "utf8"));

/** Raw text of every round file, for the "this string exists in the data" check. */
const ROUND_TEXT = Object.fromEntries(ROUND_FILES.map((f) => [f, readFileSync(join(DATA, f), "utf8")]));

/** Every scored, prompt-carrying scenario across all rounds, keyed nowhere in particular. */
const SCENARIOS = ROUND_FILES.flatMap((file) => {
  const doc = JSON.parse(ROUND_TEXT[file]);
  const round = typeof doc.round === "number" ? doc.round : Number(/_r(\d+)\./.exec(file)?.[1] || 1);
  return (doc.scenarios || [])
    .filter((s) => typeof s.prompt === "string" && typeof s.score === "number")
    .map((s) => ({ file, round, date: String(doc.at || "").slice(0, 10), server: s.server || (typeof s.surface === "string" ? s.surface.split("/").pop() : null), prompt: s.prompt, score: s.score, note: typeof s.note === "string" ? s.note : "" }));
});

/**
 * The servers a measurement round has actually exercised, derived from the round files
 * themselves rather than kept as a list. A server enters this set the moment a round covers
 * it, and no exemption has to be written down or later remembered.
 */
const MEASURED = new Set(SCENARIOS.map((s) => s.server).filter(Boolean));
const MEASURED_PAGES = Object.keys(PAGES).filter((id) => MEASURED.has(id));

/**
 * The section, or a failure naming the page. `html.slice(html.indexOf(needle))` returns the
 * LAST CHARACTER when the needle is absent, not the empty string, so a page with no section
 * used to be checked against one character of unrelated markup and fail somewhere else with
 * a message about scores or dates. Read it through here and the absence is what is reported.
 */
function firstFiveSection(id) {
  const html = PAGES[id].html;
  const at = html.indexOf("<h2>First five minutes</h2>");
  assert.notEqual(at, -1, `${id}: no First five minutes section`);
  return html.slice(at);
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function unesc(s) {
  return s.replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
}

/** The prompts a page actually shows, read back out of the rendered HTML, not the metadata. */
function renderedPrompts(html) {
  const section = html.slice(html.indexOf("<h2>First five minutes</h2>"));
  return [...section.matchAll(/<pre class="prompt">([\s\S]*?)<\/pre>/g)].map((m) => unesc(m[1]));
}

test("a page carries a First five minutes section exactly when a round has exercised it", () => {
  // Was: every page must have the section, full stop. delivery-schedule is the thirty-first
  // server and was built after the last user-value round, so no round has ever exercised it
  // and scripts/build-pages.mjs emits no section for it. The assertion was therefore failing
  // on the generator being honest.
  //
  // The fix is not to let a missing section pass. It is to assert the property that was
  // always meant: the section exists if and only if there is a measurement behind it. That
  // fails in BOTH directions, where the old one only failed in one - a page that grew a
  // section for a server no round has touched is fabricated evidence on a sales page, and
  // nothing caught that before. The uncovered servers are named in the failure text either
  // way, and scripts/release-check.mjs prints them as a standing named gap on every run, so
  // the hole stays in sight instead of being quietly tolerated here.
  const measuredWithNoSection = [];
  const sectionWithNoMeasurement = [];
  for (const [id, pg] of Object.entries(PAGES)) {
    const has = pg.html.includes("<h2>First five minutes</h2>");
    if (MEASURED.has(id) && !has) measuredWithNoSection.push(id);
    if (!MEASURED.has(id) && has) sectionWithNoMeasurement.push(id);
  }
  assert.deepEqual(measuredWithNoSection, [],
    `a round has exercised these servers but their page shows no section; run node scripts/build-pages.mjs: ${measuredWithNoSection.join(", ")}`);
  assert.deepEqual(sectionWithNoMeasurement, [],
    `these pages show a First five minutes section for a server no round has exercised, which is evidence nobody measured: ${sectionWithNoMeasurement.join(", ")}`);
});

test("every measured page quotes one to three prompts", () => {
  for (const id of MEASURED_PAGES) {
    const pg = PAGES[id];
    assert.ok(Array.isArray(pg.first_five) && pg.first_five.length >= 1, `${id} quotes no prompt`);
    assert.ok(pg.first_five.length <= 3, `${id} quotes more than three prompts`);
  }
});

test("every quoted prompt string exists verbatim in some data/user_value_r*.json", () => {
  const missing = [];
  for (const id of MEASURED_PAGES) {
    const pg = PAGES[id];
    for (const prompt of renderedPrompts(pg.html)) {
      // JSON.stringify so the comparison is against the encoded form actually on disk:
      // a prompt carrying a quote or a newline must match the escaped bytes, not a
      // loosened version of them.
      const needle = JSON.stringify(prompt).slice(1, -1);
      if (!ROUND_FILES.some((f) => ROUND_TEXT[f].includes(needle))) missing.push(`${id}: ${prompt.slice(0, 60)}`);
    }
  }
  assert.deepEqual(missing, [], "prompts on a page that no round file contains:\n" + missing.join("\n"));
});

test("the metadata prompts and the rendered prompts are the same list", () => {
  for (const id of MEASURED_PAGES) {
    const pg = PAGES[id];
    assert.deepEqual(renderedPrompts(pg.html), pg.first_five.map((e) => e.prompt), `${id} renders different prompts than it records`);
  }
});

test("each quoted prompt carries the score the round file recorded, in the round the page names", () => {
  for (const id of MEASURED_PAGES) {
    const pg = PAGES[id];
    for (const e of pg.first_five) {
      const match = SCENARIOS.find((s) => s.server === id && s.round === e.round && s.prompt === e.prompt);
      assert.ok(match, `${id}: no round ${e.round} scenario with that prompt`);
      assert.equal(e.score, match.score, `${id}: score on the page disagrees with round ${e.round}`);
      assert.equal(e.round, pg.first_five_round, `${id}: a prompt from a round the page does not name`);
      assert.equal(e.date, pg.first_five_date, `${id}: date disagrees with the page`);
    }
  }
});

test("the sentence under each prompt is a substring of that scenario's evidence", () => {
  for (const id of MEASURED_PAGES) {
    const pg = PAGES[id];
    for (const e of pg.first_five) {
      const match = SCENARIOS.find((s) => s.server === id && s.round === e.round && s.prompt === e.prompt);
      assert.ok(e.evidence.length > 0, `${id}: empty evidence sentence`);
      assert.ok(match.note.includes(e.evidence), `${id}: sentence is not in the round's note:\n${e.evidence}`);
      assert.ok(pg.html.includes(esc(e.evidence)), `${id}: sentence not rendered`);
    }
  }
});

test("the round each page names is one that scored at least as well as any other round for that server", () => {
  for (const id of MEASURED_PAGES) {
    const pg = PAGES[id];
    const rows = SCENARIOS.filter((s) => s.server === id);
    const means = new Map();
    for (const r of rows) {
      const acc = means.get(r.round) || { n: 0, sum: 0 };
      acc.n += 1; acc.sum += r.score; means.set(r.round, acc);
    }
    const best = Math.max(...[...means.values()].map((a) => a.sum / a.n));
    const chosen = means.get(pg.first_five_round);
    assert.ok(chosen, `${id}: names round ${pg.first_five_round}, which never covered it`);
    assert.equal(chosen.sum / chosen.n, best, `${id}: round ${pg.first_five_round} is not the best-scoring round`);
  }
});

test("a page quoting anything below 3 states the score, a page quoting only 3s does not", () => {
  for (const id of MEASURED_PAGES) {
    const pg = PAGES[id];
    const section = firstFiveSection(id);
    const allThree = pg.first_five.every((e) => e.score === 3);
    assert.equal(allThree, section.includes("scored 3 of 3"), `${id}: lead sentence disagrees with the scores`);
    for (const e of pg.first_five) {
      if (e.score !== 3) assert.ok(section.includes(`Score ${e.score} of 3.`), `${id}: a ${e.score}-scoring prompt without its score stated`);
    }
  }
});

test("each section names its round and date, and quotes the free tier from data/facts.json", () => {
  for (const id of MEASURED_PAGES) {
    const pg = PAGES[id];
    const section = firstFiveSection(id);
    assert.ok(section.includes(`measured in round ${pg.first_five_round}, ${pg.first_five_date}`), `${id}: no source line`);
    assert.match(pg.first_five_date, /^\d{4}-\d{2}-\d{2}$/, `${id}: date is not a date`);
    const free = FACTS.servers[id].free;
    assert.ok(section.includes(`On the free tier for this path: ${esc(free)}`), `${id}: free tier line does not match data/facts.json`);
  }
});

test("the section is plain text a reader can copy, with no unescaped markup from the round data", () => {
  for (const id of MEASURED_PAGES) {
    const pg = PAGES[id];
    for (const prompt of renderedPrompts(pg.html)) {
      assert.ok(!/<[a-z/]/i.test(prompt), `${id}: markup leaked into a copy block`);
    }
  }
});
