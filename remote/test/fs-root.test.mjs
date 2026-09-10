// The hosted filesystem is a per-request virtual one: files and directories live in maps on
// the request context. Nothing ever calls mkdirSync("/"), so the root was never present in
// those maps and existsSync("/") answered false.
//
// That mattered because of a fix made elsewhere. Seven servers that write a caller-supplied
// output path replaced mkdirSync(recursive) with a BOUNDED ancestor walk, since on Linux a
// recursive mkdir under /proc answers ENOENT in 0 ms and Node retries forever. The bounded
// walk climbs until it finds an existing ancestor and throws if it reaches the top without
// one. In the worker it reached "/" every time.
//
// The defect stayed hidden for weeks because remote/build-vendor.mjs was itself failing, so
// the worker could not be rebuilt and production stayed on a version predating the walk. The
// first successful deploy after that was repaired surfaced it as a single live validation
// failure: hosted zip_extract, "cannot create /out: no existing ancestor directory".
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync as fsExists } from "node:fs";
import { fileURLToPath } from "node:url";

// The shims import each other with ".js" specifiers, the way the Workers bundler resolves
// them, and those files do not exist on disk. Map a relative ".js" onto the ".ts" beside it,
// scoped as tightly as the sibling suite does: relative only, ".js" only, and only when the
// ".js" is absent and the ".ts" is present, so nothing that resolves normally is touched.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && specifier.endsWith(".js") && context.parentURL) {
      const asJs = new URL(specifier, context.parentURL);
      if (!fsExists(fileURLToPath(asJs))) {
        const asTs = new URL(specifier.slice(0, -3) + ".ts", context.parentURL);
        if (fsExists(fileURLToPath(asTs))) return next(specifier.slice(0, -3) + ".ts", context);
      }
    }
    return next(specifier, context);
  },
});

const { existsSync, mkdirSync } = await import("../src/shims/fs.ts");
const { STORE } = await import("../src/shims/ctx.ts");

const ctx = () => ({ tenant: "anon:test", server: "zip", isPro: false, files: new Map(), dirs: new Set(), published: new Map(), baseUrl: "https://example.invalid" });
const runWithCtx = (c, fn) => STORE.run(c, fn);

test("the virtual filesystem root exists", () => {
  runWithCtx(ctx(), () => {
    assert.equal(existsSync("/"), true, "the root must exist or every ancestor walk fails");
  });
});

test("a bounded ancestor walk can create the virtual out directory", () => {
  runWithCtx(ctx(), () => {
    // This is the exact shape of ensureDirBounded in the vendored servers.
    const dir = "/out";
    assert.equal(existsSync(dir), false, "precondition: /out is not there yet");
    const missing = [];
    let cur = dir;
    for (let i = 0; i < 64 && !existsSync(cur); i++) {
      missing.push(cur);
      const parent = cur.slice(0, Math.max(1, cur.lastIndexOf("/")));
      if (parent === cur) break;
      cur = parent;
    }
    assert.ok(existsSync(cur), `walk stopped at ${cur}, which does not exist, so /out is uncreatable`);
    for (const d of missing.reverse()) mkdirSync(d);
    assert.equal(existsSync("/out"), true);
  });
});

test("a path with no reachable ancestor is still refused", () => {
  runWithCtx(ctx(), () => {
    // The guard must not have been loosened into "anything is creatable".
    assert.equal(existsSync("/out/nested/deep"), false);
  });
});
