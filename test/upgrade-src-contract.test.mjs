// Repo-wide contract for the conversion instrument (docs/CONVERSION_INSTRUMENT.md).
//
// The per-server contract suites assert the runtime half: the cheapest gate each of them
// already trips must return a /buy link tagged src=<product>.<tool>. That covers one gate
// per server and costs a server spawn, so it cannot be the whole rule.
//
// This suite is the static half, and it covers every server at once: no gate call site
// inside a registerTool handler may be left without a tool name. It runs the codemod in
// --check mode, which writes nothing and reports what it would still change. A new gate
// added inside a handler without a tool name fails here the day it is written, instead of
// showing up months later as another `<product>.unknown` row on /stats/clicks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

function codemodReport() {
  const out = execFileSync(process.execPath, [join(REPO, "scripts", "codemod-upgrade-src.mjs"), "--check", "--json"], {
    cwd: REPO, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
  });
  return JSON.parse(out);
}

test("every gate call site inside a registerTool handler passes its tool name", () => {
  const r = codemodReport();
  assert.equal(
    r.totalChanged, 0,
    `scripts/codemod-upgrade-src.mjs still has ${r.totalChanged} untagged in-handler call site(s). ` +
    `Run: node scripts/codemod-upgrade-src.mjs\n` +
    r.rows.filter((x) => x.changed > 0).map((x) => `  ${x.server}: ${x.changed}`).join("\n"),
  );
});

test("the codemod reports every server, and every server it changed still builds a table row", () => {
  const r = codemodReport();
  assert.ok(r.rows.length >= 20, `expected a row per server, got ${r.rows.length}`);
  for (const row of r.rows) assert.equal(typeof row.server, "string");
});
