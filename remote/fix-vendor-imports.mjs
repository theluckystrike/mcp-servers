// Repairs remote/src/vendor/*/index.js produced by vendor-served.mjs: that script left the
// original `import` lines inside the createServer() body (illegal ES syntax). Hoist them to
// module scope, dedupe, and leave the body import-free.
// Run: node remote/fix-vendor-imports.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), "src", "vendor");
const NAMES = ["budget", "hourly-rate", "loan-calculator", "payroll", "pomodoro", "receipts", "stripe-billing", "tax-calc"];

for (const name of NAMES) {
  const dir = join(VENDOR, name);
  const f = readdirSync(dir).find((x) => /^index\.(js|ts)$/.test(x));
  if (!f) { console.log("skip", name, "no index"); continue; }
  const p = join(dir, f);
  const lines = readFileSync(p, "utf8").split("\n");
  const header = [];
  const topImports = new Set();
  const bodyImports = [];
  const body = [];
  let inBody = false;

  for (const l of lines) {
    if (!inBody) {
      if (/^export function createServer\(\)/.test(l)) { inBody = true; continue; }
      header.push(l);
      if (/^import\s/.test(l)) topImports.add(l.trim());
      continue;
    }
    if (/^\s*import\s.*from\s+['"][^'"]+['"];?\s*$/.test(l)) {
      const t = l.trim();
      if (!topImports.has(t)) { bodyImports.push(t); topImports.add(t); }
      continue;
    }
    body.push(l);
  }

  // Insert any newly hoisted imports after the last top-level import in the header.
  let last = -1;
  header.forEach((l, i) => { if (/^import\s/.test(l)) last = i; });
  header.splice(last + 1, 0, ...bodyImports);

  const out = [...header, "export function createServer() {", ...body].join("\n").replace(/\n{3,}/g, "\n\n");
  writeFileSync(p, out);
  console.log("fixed", name, "+imports:", bodyImports.length);
}
