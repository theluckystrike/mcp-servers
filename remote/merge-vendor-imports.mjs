// Second pass: collapse duplicate module-scope imports in remote/src/vendor/*/index.*
// vendor-served.mjs emitted both `import { serve } from "../../shims/serve.js"` and the
// original `import { serve, money } from "../../shims/serve.js"`, which redeclares names.
// Merge named imports per source module, preserving the leading comment block and the order
// of first appearance. Idempotent: a file that is already merged is left untouched.
// Run: node remote/merge-vendor-imports.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), "src", "vendor");
const NAMES = ["budget", "hourly-rate", "loan-calculator", "payroll", "pomodoro", "receipts", "stripe-billing", "tax-calc"];
const RE = /^import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2;?\s*$/;

for (const name of NAMES) {
  const dir = join(VENDOR, name);
  const f = readdirSync(dir).find((x) => /^index\.(js|ts)$/.test(x));
  if (!f) continue;
  const p = join(dir, f);
  const src = readFileSync(p, "utf8");

  const split = src.match(/^((?:\/\/[^\n]*\n)+)([\s\S]*)$/);
  const header = split ? split[1].trimEnd() : "";
  const lines = (split ? split[2] : src).split("\n");

  const order = [];
  const bySrc = new Map();
  const passthrough = [];
  const pre = [];
  let started = false;

  for (const l of lines) {
    if (/^export function createServer\(\)/.test(l)) started = true;
    if (started) { pre.push(l); continue; }
    const m = l.match(RE);
    if (m) {
      if (!bySrc.has(m[3])) { bySrc.set(m[3], []); order.push(m[3]); }
      for (const s of m[1].split(",").map((x) => x.trim()).filter(Boolean)) {
        if (!bySrc.get(m[3]).includes(s)) bySrc.get(m[3]).push(s);
      }
      continue;
    }
    if (/^import\s/.test(l)) { passthrough.push(l); continue; }
    if (l.trim()) pre.push(l);
  }

  const merged = order.map((m) => `import { ${bySrc.get(m).join(", ")} } from "${m}";`);
  const out = [...(header ? [header] : []), ...passthrough, ...merged, ...pre].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

  if (out === src) { console.log("clean", name); continue; }
  writeFileSync(p, out);
  console.log("merged", name, "modules:", order.length);
}
