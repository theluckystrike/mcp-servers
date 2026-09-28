#!/usr/bin/env node
// Single supported path for deploying mcp-billing. Do not run wrangler deploy
// directly: the local guard and live postdeploy probe must travel with a release.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const billing = join(root, "billing");
const gate = join(root, "scripts", "billing-release-gate.mjs");

function sourceHash() {
  const hash = createHash("sha256");
  const visit = (path) => {
    for (const name of readdirSync(path).sort()) {
      const file = join(path, name);
      if (statSync(file).isDirectory()) visit(file);
      else { hash.update(file.slice(root.length)); hash.update(readFileSync(file)); }
    }
  };
  visit(join(billing, "src"));
  visit(join(billing, "test"));
  visit(join(root, "scripts", "test"));
  for (const file of [join(billing, "wrangler.toml"), join(billing, "package.json"), gate]) {
    hash.update(file.slice(root.length)); hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

function run(bin, args, cwd) {
  const result = spawnSync(bin, args, { cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 300000 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) throw new Error(`${bin} ${args.slice(0, 2).join(" ")} failed: ${result.error?.message || `exit ${result.status}`}`);
  return result.stdout;
}

try {
  if (process.argv.length !== 2) throw new Error("This deployment command accepts no bypass flags");
  const checkedSource = sourceHash();
  run(process.execPath, [gate, "preflight"], root);
  if (sourceHash() !== checkedSource) throw new Error("Billing source or gate changed during preflight; rerun against stable files");
  const output = run("npx", ["wrangler", "deploy", "--strict"], billing);
  if (sourceHash() !== checkedSource) throw new Error("Billing source or gate changed during deployment; postdeploy verification cannot certify the tested source");
  const version = /Current Version ID:\s*([0-9a-f-]{36})/i.exec(output)?.[1];
  if (!version) throw new Error("Wrangler did not report a deployed Version ID; postdeploy verification cannot be tied to this release");
  run(process.execPath, [gate, "verify", "--expected-version", version], root);
  // Cron reads this remote pin. A direct Wrangler deployment leaves the pin on
  // the prior version and will fail the scheduled check.
  run("npx", ["wrangler", "kv", "key", "put", "monitor:approved-version", version,
    "--binding", "REMOTE_DATA", "--remote", "--config", "wrangler.toml"], billing);
  console.log(`Billing release verified: ${version}`);
} catch (error) {
  console.error(`BILLING DEPLOYMENT FAILED: ${error.message}`);
  process.exitCode = 1;
}
