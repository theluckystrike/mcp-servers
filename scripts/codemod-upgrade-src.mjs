#!/usr/bin/env node
/**
 * codemod-upgrade-src.mjs - pass the enclosing tool name to every upgrade-link call site.
 *
 * docs/CONVERSION_INSTRUMENT.md tags every /buy link a cap message produces with
 * `src=<product>.<slug>`. When a call site does not pass a tool name the slug falls back
 * to the feature prose, which is why /stats/clicks shows rows like `recurring.unknown`
 * and cannot say which tool produced the message. This codemod fills in the missing
 * second argument from the enclosing `registerTool("<name>", ...)` call.
 *
 * AST-light: a small tokenizer masks strings, template literals, comments and regex
 * literals, then plain paren matching gives the span of each registerTool call. A gate
 * call inside that span belongs to that tool; one outside any span (a shared helper
 * such as pdf's freePageText) is left alone and listed as skipped.
 *
 * Idempotent: a call that already has a second argument is never touched.
 *
 * Usage: node scripts/codemod-upgrade-src.mjs [--check] [--json]
 *   --check  report only, write nothing (exit 1 if anything would change)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const CHECK = process.argv.includes("--check");
const JSON_OUT = process.argv.includes("--json");

/**
 * Replace every string/template/comment/regex BODY with spaces, preserving offsets and
 * the delimiters themselves, so paren matching and argument counting see structure only.
 * Single pass, explicit context stack - template interpolations resume real code.
 */
function mask(src) {
  const out = src.split("");
  const n = src.length;
  const sp = (k) => { if (k < n && out[k] !== "\n") out[k] = " "; };
  const stack = [{ type: "code", brace: 0, interp: false }];
  let i = 0, prev = "";
  while (i < n) {
    const top = stack[stack.length - 1];
    const c = src[i];
    if (top.type === "tpl") {
      if (c === "\\") { sp(i); sp(i + 1); i += 2; continue; }
      if (c === "`") { stack.pop(); prev = "`"; i++; continue; }
      if (c === "$" && src[i + 1] === "{") { sp(i); sp(i + 1); stack.push({ type: "code", brace: 0, interp: true }); i += 2; prev = "{"; continue; }
      sp(i); i++; continue;
    }
    if (c === "/" && src[i + 1] === "/") { let j = i; while (j < n && src[j] !== "\n") { sp(j); j++; } i = j; continue; }
    if (c === "/" && src[i + 1] === "*") { let j = src.indexOf("*/", i + 2); j = j === -1 ? n : j + 2; for (let k = i; k < j; k++) sp(k); i = j; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") { sp(j); sp(j + 1); j += 2; continue; }
        if (src[j] === c) { j++; break; }
        if (src[j] === "\n") break;
        sp(j); j++;
      }
      prev = '"'; i = j; continue;
    }
    if (c === "`") { stack.push({ type: "tpl" }); i++; continue; }
    if (c === "/" && /[=(,:[!&|?{};+\-*%<>~^]/.test(prev)) {
      let j = i + 1, cls = false, closed = false;
      while (j < n) {
        const d = src[j];
        if (d === "\\") { j += 2; continue; }
        if (d === "[") cls = true;
        else if (d === "]") cls = false;
        else if (d === "/" && !cls) { j++; closed = true; break; }
        else if (d === "\n") break;
        j++;
      }
      if (closed) { for (let k = i; k < j; k++) sp(k); prev = "/"; i = j; continue; }
    }
    if (c === "{") top.brace++;
    else if (c === "}") {
      if (top.interp && top.brace === 0) { stack.pop(); sp(i); prev = "}"; i++; continue; }
      top.brace--;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out.join("");
}

/** Match the paren opened at index `open` in masked code; returns index of the closer. */
function matchParen(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** Non-empty top-level argument count for the call whose parens are [open, close]. */
function argCount(code, open, close) {
  const parts = [];
  let depth = 0, start = open + 1;
  for (let i = open + 1; i < close; i++) {
    const c = code[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) { parts.push(code.slice(start, i)); start = i + 1; }
  }
  parts.push(code.slice(start, close));
  return parts.filter((p) => p.trim().length > 0).length;
}

const TARGET = /(?:\bgate\s*\.\s*upgradeText|\bupgradeText|\bgated)\s*\(/g;
const REGISTER = /\bregisterTool\s*\(/g;

function processFile(file) {
  const src = readFileSync(file, "utf8");
  const code = mask(src);

  // Does this file's `gated` helper forward to upgradeText? If it only wraps text
  // (bank-statement, currency, expense-tracker) a second argument would go nowhere.
  const gatedDef = /const\s+gated\s*=\s*\(([^)]*)\)\s*=>\s*ok\(\s*gate\.upgradeText\(/.exec(src);
  const gatedForwards = Boolean(gatedDef);

  // registerTool spans
  const spans = [];
  REGISTER.lastIndex = 0;
  let m;
  while ((m = REGISTER.exec(code))) {
    const before = code.slice(Math.max(0, m.index - 12), m.index);
    if (/function\s+$/.test(before)) continue;         // the wrapper's own definition
    const open = m.index + m[0].length - 1;
    const close = matchParen(code, open);
    if (close === -1) continue;
    const rest = src.slice(open + 1);
    const nameM = /^\s*(["'])([A-Za-z0-9_.-]+)\1/.exec(rest);
    spans.push({ open, close, name: nameM ? nameM[2] : null });
  }

  const edits = [];
  const skipped = [];
  TARGET.lastIndex = 0;
  while ((m = TARGET.exec(code))) {
    const callee = m[0].replace(/\s*\($/, "").replace(/\s+/g, "");
    const line = src.slice(0, m.index).split("\n").length;
    // the helper's own definition / a declaration is not a call site
    const isGated = callee === "gated";
    if (isGated && !gatedForwards) { skipped.push({ line, callee, why: "gated() does not forward to upgradeText" }); continue; }
    const open = m.index + m[0].length - 1;
    const close = matchParen(code, open);
    if (close === -1) { skipped.push({ line, callee, why: "unbalanced parens" }); continue; }
    const span = spans.filter((s) => s.open < m.index && s.close > close).sort((a, b) => b.open - a.open)[0];
    if (!span) { skipped.push({ line, callee, why: "outside any registerTool handler" }); continue; }
    if (!span.name) { skipped.push({ line, callee, why: "registerTool name is not a string literal" }); continue; }
    const n = argCount(code, open, close);
    if (n === 0) { skipped.push({ line, callee, why: "no arguments" }); continue; }
    if (n >= 2) { skipped.push({ line, callee, why: `already passes a tool name` }); continue; }
    edits.push({ at: close, text: `, "${span.name}"`, line, callee, tool: span.name });
  }

  let out = src;
  // helper signature first (offsets below are recomputed from the end, so order is safe)
  for (const e of [...edits].sort((a, b) => b.at - a.at)) {
    out = out.slice(0, e.at) + e.text + out.slice(e.at);
  }
  if (gatedForwards && edits.length && !/const\s+gated\s*=\s*\([^)]*toolName/.test(out)) {
    out = out.replace(
      /const\s+gated\s*=\s*\((\s*\w+\s*:\s*string\s*)\)\s*=>\s*ok\(\s*gate\.upgradeText\(\s*(\w+)\s*\)\s*\)/,
      (_all, p1, p2) => `const gated = (${p1.trim()}, toolName?: string) => ok(gate.upgradeText(${p2}, toolName))`,
    );
  }
  return { src, out, edits, skipped };
}

const servers = readdirSync(join(ROOT, "servers")).filter((d) => existsSync(join(ROOT, "servers", d, "src")));
const rows = [];
let totalChanged = 0, totalSkipped = 0;
const skipDetail = [];
for (const s of servers.sort()) {
  const dir = join(ROOT, "servers", s, "src");
  let changed = 0, skipped = 0;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".ts")).sort()) {
    const file = join(dir, f);
    const r = processFile(file);
    changed += r.edits.length;
    skipped += r.skipped.length;
    for (const k of r.skipped) skipDetail.push(`${s}/${f}:${k.line} ${k.callee}() - ${k.why}`);
    if (r.out !== r.src && !CHECK) writeFileSync(file, r.out);
  }
  rows.push({ server: s, changed, skipped });
  totalChanged += changed; totalSkipped += skipped;
}

if (JSON_OUT) {
  console.log(JSON.stringify({ rows, totalChanged, totalSkipped, skipped: skipDetail }, null, 2));
} else {
  const w = Math.max(12, ...rows.map((r) => r.server.length));
  console.log(`${"server".padEnd(w)}  changed  skipped`);
  console.log(`${"-".repeat(w)}  -------  -------`);
  for (const r of rows) console.log(`${r.server.padEnd(w)}  ${String(r.changed).padStart(7)}  ${String(r.skipped).padStart(7)}`);
  console.log(`${"-".repeat(w)}  -------  -------`);
  console.log(`${"TOTAL".padEnd(w)}  ${String(totalChanged).padStart(7)}  ${String(totalSkipped).padStart(7)}`);
  if (skipDetail.length) {
    console.log("\nskipped call sites:");
    for (const d of skipDetail) console.log(`  ${d}`);
  }
}
if (CHECK && totalChanged > 0) process.exit(1);
