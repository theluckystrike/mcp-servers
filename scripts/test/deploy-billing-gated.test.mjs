import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { recoveryPlan, rollbackDecision, sourceHash } from "../deploy-billing-gated.mjs";

const approvedVersion = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const uploadedVersion = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const uploadedDeployment = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", version: uploadedVersion };

test("rollback is allowed only for our observed active deployment and unchanged remote pin", () => {
  const state = { approvedVersion, uploadedVersion, uploadedDeployment,
    currentDeployment: uploadedDeployment, currentPin: approvedVersion };
  assert.equal(rollbackDecision(state), null);
  assert.match(rollbackDecision({ ...state, uploadedDeployment: undefined }), /not observed/);
  assert.match(rollbackDecision({ ...state, currentDeployment: { ...uploadedDeployment,
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" } }), /active deployment changed/);
  assert.match(rollbackDecision({ ...state, currentDeployment: { ...uploadedDeployment,
    version: approvedVersion } }), /active deployment changed/);
  assert.match(rollbackDecision({ ...state, currentPin: uploadedVersion }), /pin changed/);
  assert.match(rollbackDecision({ ...state, approvedVersion: "invalid" }), /missing approved/);
});

test("an ambiguous final KV pin write requires manual recovery", () => {
  const base = { approvedVersion, uploadedVersion };
  assert.equal(recoveryPlan({ ...base, pinWriteStarted: false }), "rollback");
  assert.equal(recoveryPlan({ ...base, pinWriteStarted: true }), "manual");
  assert.equal(recoveryPlan({ ...base, uploadedVersion: undefined, pinWriteStarted: false }), "none");
});

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
  ".github/workflows/billing-preflight.yml",
  ".github/workflows/billing-monitor-watchdog.yml",
  ".github/workflows/billing-monitor-periodic.yml",
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
