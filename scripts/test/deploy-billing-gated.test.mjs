import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { sourceHash } from "../deploy-billing-gated.mjs";

const files = [
  "billing/src/worker.js",
  "billing/test/worker.test.mjs",
  "billing/wrangler.toml",
  "billing/package.json",
  "scripts/test/gate.test.mjs",
  "scripts/deploy-billing-gated.mjs",
  "scripts/billing-release-gate.mjs",
  "scripts/billing-operations-monitor.mjs",
  "scripts/billing-monitor-watchdog.mjs",
  "scripts/billing-monitor.sh",
  "scripts/install-billing-monitor.sh",
];

test("deployment source hash detects changes to every release-critical file", () => {
  const root = mkdtempSync(join(tmpdir(), "mcp-billing-deploy-hash-"));
  try {
    for (const relative of files) {
      const file = join(root, relative);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, relative);
    }
    const baseline = sourceHash(root);
    for (const relative of files) {
      const file = join(root, relative);
      writeFileSync(file, `${relative}\nchanged`);
      assert.notEqual(sourceHash(root), baseline, `missed ${relative}`);
      writeFileSync(file, relative);
    }
    assert.equal(sourceHash(root), baseline);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
