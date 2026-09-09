// HOSTED_SERVERS drives the "paste this URL, no install" line on every product page.
// If it drifts from the servers that actually declare a hosted endpoint, a product page
// either advertises a URL that 404s or hides one that works. Both are worse than the
// hardcoded list this replaced, so the list is asserted against the manifests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { HOSTED_SERVERS } from "../src/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("HOSTED_SERVERS is exactly the set of servers whose manifest declares a remote", () => {
  const fromManifests = new Set();
  for (const name of readdirSync(join(ROOT, "servers"))) {
    const f = join(ROOT, "servers", name, "server.mcpb.json");
    if (!existsSync(f)) continue;
    let m;
    try { m = JSON.parse(readFileSync(f, "utf8")); } catch { continue; }
    if (Array.isArray(m.remotes) && m.remotes.length > 0) fromManifests.add(name);
  }
  assert.ok(fromManifests.size > 0, "no manifest declares a remote; the probe is broken, not the list");
  const listed = [...HOSTED_SERVERS].sort();
  const actual = [...fromManifests].sort();
  assert.deepEqual(listed, actual,
    `HOSTED_SERVERS has drifted. Missing: ${actual.filter((x) => !HOSTED_SERVERS.has(x)).join(", ") || "none"}. ` +
    `Stale: ${listed.filter((x) => !fromManifests.has(x)).join(", ") || "none"}.`);
});

test("office-suite is never hosted: it spawns local child processes", () => {
  assert.equal(HOSTED_SERVERS.has("office-suite"), false);
});
