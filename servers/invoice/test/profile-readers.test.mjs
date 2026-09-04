// D-R60: business_set names the servers that read the shared profile. That list must be
// derived from the source, not hand-typed, so it cannot silently drift as servers are added
// or removed. This test re-runs the same grep and fails if servers/invoice/src/index.ts's
// PROFILE_READERS constant ever disagrees with it.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SERVERS_DIR = join(here, "..", "..");
const INDEX_TS = join(here, "..", "src", "index.ts");

function serversThatReadSharedProfile() {
  const names = [];
  for (const entry of readdirSync(SERVERS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "invoice") continue; // invoice itself is the writer, not listed as a reader
    const srcDir = join(SERVERS_DIR, entry.name, "src");
    if (!existsSync(srcDir)) continue;
    if (dirContainsReadSharedProfile(srcDir)) names.push(entry.name);
  }
  return names.sort();
}

function dirContainsReadSharedProfile(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (dirContainsReadSharedProfile(p)) return true;
    } else if (entry.name.endsWith(".ts")) {
      if (readFileSync(p, "utf8").includes("readSharedProfile")) return true;
    }
  }
  return false;
}

test("D-R60: PROFILE_READERS matches every server that actually imports readSharedProfile", () => {
  const src = readFileSync(INDEX_TS, "utf8");
  const m = /export const PROFILE_READERS = \[([\s\S]*?)\];/.exec(src);
  assert.ok(m, "PROFILE_READERS constant not found in servers/invoice/src/index.ts");
  const declared = m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^["']|["']$/g, ""))
    .sort();
  const grepped = serversThatReadSharedProfile();
  assert.deepEqual(declared, grepped,
    `PROFILE_READERS drifted from the grep. declared=${JSON.stringify(declared)} grepped=${JSON.stringify(grepped)}`);
});
