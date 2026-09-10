// CHILDREN must cover every stdio server in the estate.
//
// The bundle's whole claim is that one install exposes every tool of every server. Two
// servers (packing-list and checklist) were added to servers/ and CHILDREN was not updated,
// and nothing anywhere noticed: the suite started, connected the children it knew about, and
// reported success. That is the defect this file closes. A missing entry is not a crash, it
// is a bundle that quietly sells less than it says, which is exactly the failure mode no
// runtime test can see.
//
// The rule: every servers/<id> that has a package.json AND a stdio bin AND builds a licence
// gate of its own is a child. servers/office-suite is excluded because it IS the proxy, and
// a server with no gate sells nothing and is not part of the bundle's claim.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SERVERS_DIR = join(here, "..", "..");
const INDEX_TS = join(here, "..", "src", "index.ts");

/** Every server directory the bundle is expected to proxy, from the filesystem. */
function stdioServers() {
  const out = [];
  for (const entry of readdirSync(SERVERS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "office-suite") continue;
    const dir = join(SERVERS_DIR, entry.name);
    const pkgPath = join(dir, "package.json");
    const srcPath = join(dir, "src", "index.ts");
    if (!existsSync(pkgPath) || !existsSync(srcPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (!pkg.bin || !Object.keys(pkg.bin).length) continue;
    if (!readFileSync(srcPath, "utf8").includes("createLicenseGate")) continue;
    out.push({ id: entry.name, pkg: pkg.name });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Parse the CHILDREN array out of src/index.ts. Read from the SOURCE rather than imported
 * from dist, so a stale build cannot make this pass: the point of the test is to catch a
 * source edit that forgot a line, and dist is regenerated from that same source.
 */
function declaredChildren(src = readFileSync(INDEX_TS, "utf8")) {
  const m = /const CHILDREN: ChildDef\[\] = \[([\s\S]*?)\n\];/.exec(src);
  assert.ok(m, "CHILDREN array not found in servers/office-suite/src/index.ts");
  return [...m[1].matchAll(/\{\s*id:\s*"([^"]+)"\s*,\s*pkg:\s*"([^"]+)"/g)]
    .map((x) => ({ id: x[1], pkg: x[2] }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

test("CHILDREN covers every stdio server in the estate", () => {
  const expected = stdioServers();
  const declared = declaredChildren();
  assert.ok(expected.length >= 30, `only ${expected.length} servers found; the scan is broken, not the list`);
  const missing = expected.filter((e) => !declared.some((d) => d.id === e.id)).map((e) => e.id);
  const extra = declared.filter((d) => !expected.some((e) => e.id === d.id)).map((d) => d.id);
  assert.deepEqual(missing, [], `servers/ ships these and CHILDREN does not proxy them: ${missing.join(", ")}. Add them to CHILDREN in servers/office-suite/src/index.ts, or the bundle sells less than it claims.`);
  assert.deepEqual(extra, [], `CHILDREN names servers that do not exist: ${extra.join(", ")}`);
});

test("every CHILDREN entry names the package that server actually publishes", () => {
  const expected = stdioServers();
  for (const d of declaredChildren()) {
    const e = expected.find((x) => x.id === d.id);
    assert.ok(e, `CHILDREN names ${d.id}, which is not a stdio server`);
    assert.equal(d.pkg, e.pkg, `CHILDREN has ${d.id} -> ${d.pkg}, but servers/${d.id}/package.json is ${e.pkg}`);
  }
});

/**
 * The control. A completeness assertion that cannot fail is worse than none, because it
 * reads as coverage. This removes one real entry from a COPY of the source text and asserts
 * the parser plus the comparison actually notice. Nothing on disk is touched.
 */
test("control: the completeness assertion fails when an entry is removed", () => {
  const src = readFileSync(INDEX_TS, "utf8");
  const declared = declaredChildren(src);
  assert.ok(declared.length >= 2, "need at least two entries to remove one");
  const victim = declared[declared.length - 1];
  const line = new RegExp(`\\n\\s*\\{ id: "${victim.id}", pkg: "${victim.pkg}"[^\\n]*\\n`);
  assert.match(src, line, `could not locate the ${victim.id} line to remove; the control cannot run`);
  const mutilated = src.replace(line, "\n");
  const after = declaredChildren(mutilated);
  assert.equal(after.length, declared.length - 1, "removing a line did not change what the parser sees");
  assert.equal(after.some((d) => d.id === victim.id), false, `${victim.id} survived its own removal`);
  const missing = stdioServers().filter((e) => !after.some((d) => d.id === e.id)).map((e) => e.id);
  assert.deepEqual(missing, [victim.id], `the comparison did not report ${victim.id} as missing; it reported ${JSON.stringify(missing)}`);
});
