import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_KEY_B64 } from "../../billing/src/license.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("paid fulfillment route retries failed binds and reuses one key with a generated signer", () => {
  const scratch = mkdtempSync(join(tmpdir(), "mcp-billing-route-ci-"));
  try {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const spki = publicKey.export({ format: "der", type: "spki" });
    assert.equal(spki.subarray(0, 12).toString("hex"), "302a300506032b6570032100");
    const fixturePublicB64 = spki.subarray(12).toString("base64");

    mkdirSync(join(scratch, "billing", "test"), { recursive: true });
    mkdirSync(join(scratch, "keys"));
    cpSync(join(root, "billing", "src"), join(scratch, "billing", "src"), { recursive: true });
    cpSync(join(root, "billing", "test", "fulfillment-route.test.mjs"),
      join(scratch, "billing", "test", "fulfillment-route.test.mjs"));
    writeFileSync(join(scratch, "package.json"), '{"type":"module"}\n');
    writeFileSync(join(scratch, "keys", "license-private.pem"),
      privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });

    const licenseFile = join(scratch, "billing", "src", "license.js");
    const source = readFileSync(licenseFile, "utf8");
    const exact = `export const PUBLIC_KEY_B64 = "${PUBLIC_KEY_B64}";`;
    assert.equal(source.split(exact).length - 1, 1, "expected one known production public-key constant");
    writeFileSync(licenseFile, source.replace(exact,
      `export const PUBLIC_KEY_B64 = "${fixturePublicB64}";`));

    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, ["--test", "billing/test/fulfillment-route.test.mjs"], {
      cwd: scratch, encoding: "utf8", timeout: 30000, env,
    });
    assert.equal(run.status, 0, `${run.error?.message || ""}\n${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /# tests 2\n/);
    assert.match(run.stdout, /# pass 2\n/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
