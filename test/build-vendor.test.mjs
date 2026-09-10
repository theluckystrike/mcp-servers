// The hosted worker is built by remote/build-vendor.mjs, which vendors each server's source
// into the worker and applies about 113 exact-string patches on the way. Every patch throws
// on a miss, because the hosted copy must differ from the local one.
//
// Nothing ran it. Not `npm test`, not `scripts/release-check.mjs`. On 2026-09-10 it was found
// exiting 1 at HEAD: two patch sites had drifted when servers/clauses and servers/zip moved to
// the bounded mkdir walk, so the worker could not be built or deployed AT ALL, and no gate said
// so. This is the same shape as the billing/ directory sitting outside npm workspaces and
// hiding six red assertions for days.
//
// So this test exists to make "the worker can still be built" a thing the ordinary test loop
// asserts. It is deliberately the weakest useful assertion, exit 0, because the script's own
// patch failures are already precise and self-describing; the defect was that nobody asked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("remote/build-vendor.mjs still builds the hosted worker", () => {
  let out = "";
  try {
    out = execFileSync(process.execPath, [join(ROOT, "remote", "build-vendor.mjs")], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 300000,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    // The script names the exact patch that failed, e.g. "patch did not apply: zip zip_history
    // description". Surface that rather than a bare non-zero exit, because the message is the
    // whole diagnostic and it points at the tool description that moved.
    const detail = String(e.stderr || e.stdout || e.message).trim().split("\n").slice(-6).join("\n");
    assert.fail(
      `build-vendor.mjs failed, so the hosted worker cannot be deployed.\n` +
      `If you changed a tool description under servers/*/src, the hosted variant in\n` +
      `remote/build-vendor.mjs has to change with it, and it deliberately says something\n` +
      `different because a hosted tenant has no data directory.\n\n${detail}`
    );
  }
  assert.match(out, /vendored /, "expected build-vendor to report at least one vendored server");
});
