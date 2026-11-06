// Second pass: collapse duplicate module-scope imports in remote/src/vendor/*/index.*
// vendor-served.mjs emitted both `import { serve } from "../../shims/serve.js"` and the
// original `import { serve, money } from "../../shims/serve.js"`, which redeclares names.
// Merge named imports per source module, preserving order of first appearance.
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
  const lines = readFileSync(p, "utf8").split("\n");

  const order = [];
  const bySrc = new Map();
  const passthrough = [];
  let started = false;
  const rest = [];

  for (const l of lines) {
    if (/^export function createServer\(\)/.test(l)) started = true;
    if (!started) {
      const m = l.match(RE);
      if (m) {
        const src = m[3];
        if (!bySrc.has(src)) { bySrc.set(src, []); order.push(src); }
        for (const s of m[1].split(",").map((x) => x.trim()).filter(Boolean)) {
          if (!bySrc.get(src).includes(s)) bySrc.get(src).push(s);
        }
        continue;
      }
      if (/^import\s/.test(l)) { passthrough.push(l); continue; }
      rest.push(l);
      continue;
    }
    rest.push(l);
  }

  const merged = order.map((src, i) => {
    const q = src.includes('"') ? "'" : '"';
    return `import { ${bySrc.get(src).join(", ")} } from ${q}${src}${q};`;
  });
  const out = [...passthrough.filter((l) => l.trim() !== ""), ...merged, ...rest.filter((l, i) => !(i === 0 && l.trim() === ""))]
    .join("\n").replace(/\n{3,}/g, "\n\n");
  writeFileSync(p, out);
  console.log("merged", name, "modules:", order.length);
}
