/**
 * D-R69, as a class rather than as two instances.
 *
 * Every hosted server is a vendored copy of a stdio server that really does keep its data
 * in a directory on the caller's own machine, and several of them say so in a sentence the
 * caller reads. Hosted, that sentence is false twice over: the path is
 * /home/mcp/.local/share/... inside a Worker with no disk, and the data is on this server,
 * not on the caller's machine. Round 14 found it in price-tracker's watch_add ("Stored in
 * ${dbPath()}") and in resume's profile_set ("Stored under ${dataDir()}; nothing leaves
 * this machine"), in both cases in text the model was expected to relay.
 *
 * The test scans the GENERATED vendor sources - what the worker actually ships - for any
 * data-directory function interpolated into a template literal, which is the only shape
 * this leak takes. It is not a whitelist of the two known lines: a new server vendored
 * with the same sentence fails here before it is deployed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";

const VENDOR = new URL("../src/vendor/", import.meta.url);
const DIR = VENDOR.pathname;

/** Functions that answer with a path on a disk the hosted caller does not have. */
const PATH_FNS = ["dataDir", "dbPath", "outDir", "storeDir", "invoiceDataDir"];
/** ${fn()} inside a template literal, which is how every one of these leaks reached a user. */
const LEAK = new RegExp(String.raw`\$\{\s*(${PATH_FNS.join("|")})\s*\(\s*\)\s*\}`);

function files() {
  const out = [];
  for (const server of readdirSync(DIR)) {
    const d = `${DIR}${server}`;
    if (!statSync(d).isDirectory()) continue;
    for (const f of readdirSync(d)) if (f.endsWith(".ts")) out.push([`${server}/${f}`, `${d}/${f}`]);
  }
  return out;
}

test("the vendor tree exists and is not empty (non-vacuity)", () => {
  assert.ok(existsSync(DIR), "run `node remote/build-vendor.mjs` first");
  const f = files();
  assert.ok(f.length > 20, `expected the vendored sources, found ${f.length}`);
});

test("no hosted response interpolates a data directory into text a caller reads", () => {
  const bad = [];
  for (const [name, path] of files()) {
    const src = readFileSync(path, "utf8");
    for (const [i, line] of src.split("\n").entries()) {
      if (!LEAK.test(line)) continue;
      // A path used as an argument (readFileSync, join, mkdirSync ...) is fine: only a
      // path INSIDE a sentence is a leak, and a sentence has a space and a letter run.
      const inProse = /`[^`]*[A-Za-z]{3,}\s[A-Za-z]{3,}[^`]*\$\{/.test(line) || /Stored|stored|saved|Saved|written to|Wrote|kept in/.test(line);
      if (inProse) bad.push(`${name}:${i + 1}: ${line.trim().slice(0, 160)}`);
    }
  }
  assert.deepEqual(bad, [], `hosted text names a directory the caller cannot open:\n${bad.join("\n")}`);
});

test("the scanner would catch the two lines round 14 found (non-vacuity, both directions)", () => {
  const known = [
    "          `Stored in ${dbPath()}`,",
    '      `Stored under ${dataDir()}; nothing leaves this machine.${note}`);',
  ];
  for (const line of known) assert.ok(LEAK.test(line), `regex missed: ${line}`);
  assert.ok(!LEAK.test("  const file = join(dataDir(), \"watches.json\");"), "a plain call must not match");
});
