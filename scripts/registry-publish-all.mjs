#!/usr/bin/env node
// Publish every server manifest to the official MCP registry.
//
// Two constraints make this worth scripting rather than doing by hand:
//  1. The registry JWT issued by `mcp-publisher login` expires about 5 minutes after it is
//     issued, so a 118-manifest batch must re-login part way through, not once at the start.
//  2. (name, version) is immutable. Republishing an unchanged version returns
//     "invalid version: cannot publish duplicate version". That is recorded as `duplicate`,
//     not as a failure: it means the registry already has that exact row.
//
// Auth needs no human: `mcp-publisher login github --token "$(gh auth token)"` uses the
// operator's already-authenticated gh CLI.
//
// Usage: node scripts/registry-publish-all.mjs [--dry] [--only <substring>]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const DRY = process.argv.includes("--dry");
const onlyIx = process.argv.indexOf("--only");
const ONLY = onlyIx > -1 ? process.argv[onlyIx + 1] : null;
const TOKEN_PATH = join(homedir(), ".config/mcp-publisher/token.json");

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", timeout: 120000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } });

function secondsLeft() {
  try {
    const t = JSON.parse(readFileSync(TOKEN_PATH, "utf8")).token;
    const c = JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString());
    return c.exp - Math.floor(Date.now() / 1000);
  } catch { return -1; }
}
function login() {
  const ghToken = sh("gh", ["auth", "token"]).trim();
  sh("mcp-publisher", ["login", "github", "--token", ghToken]);
  const left = secondsLeft();
  console.log(`  logged in, token good for ${left}s`);
  if (left < 30) throw new Error("token expired on arrival");
}

// Collect every manifest that is a registry entry.
const manifests = [];
for (const d of readdirSync(join(ROOT, "servers"))) {
  const dir = join(ROOT, "servers", d);
  for (const f of readdirSync(dir)) {
    if (!/^server(\.[a-z0-9-]+)?\.json$/.test(f)) continue;
    if (f === "server.npm-package.json") continue;
    const path = join(dir, f);
    let m; try { m = JSON.parse(readFileSync(path, "utf8")); } catch { continue; }
    if (!m.name || !m.version) continue;
    if (ONLY && !m.name.includes(ONLY)) continue;
    manifests.push({ server: d, file: f, path, name: m.name, version: m.version, websiteUrl: m.websiteUrl });
  }
}
manifests.sort((a, b) => a.name.localeCompare(b.name));
console.log(`${manifests.length} manifests to publish${DRY ? " (dry run)" : ""}`);
if (DRY) { for (const m of manifests.slice(0, 5)) console.log(`  ${m.name}@${m.version} -> ${m.websiteUrl}`); process.exit(0); }

const result = { at: new Date().toISOString(), published: [], duplicate: [], failed: [] };
login();
for (const [i, m] of manifests.entries()) {
  // Re-login before the token can expire mid-publish rather than after a failure.
  if (secondsLeft() < 60) { console.log(`  [${i}] token low, re-login`); login(); }
  try {
    sh("mcp-publisher", ["publish", m.path]);
    result.published.push(`${m.name}@${m.version}`);
    console.log(`  ok        ${m.name}@${m.version}`);
  } catch (e) {
    const out = String(e.stdout || "") + String(e.stderr || "") + String(e.message || "");
    if (/duplicate version/.test(out)) { result.duplicate.push(`${m.name}@${m.version}`); console.log(`  duplicate ${m.name}@${m.version}`); }
    else if (/401|unauthor|token/i.test(out)) {
      try { login(); sh("mcp-publisher", ["publish", m.path]); result.published.push(`${m.name}@${m.version}`); console.log(`  ok(retry) ${m.name}@${m.version}`); }
      catch (e2) { const o2 = String(e2.stdout || "") + String(e2.stderr || ""); result.failed.push({ name: m.name, version: m.version, error: o2.slice(0, 300) }); console.log(`  FAIL      ${m.name}: ${o2.slice(0, 120)}`); }
    } else { result.failed.push({ name: m.name, version: m.version, error: out.slice(0, 300) }); console.log(`  FAIL      ${m.name}: ${out.slice(0, 120)}`); }
  }
}
writeFileSync(join(ROOT, "data/registry_publish.json"), JSON.stringify(result, null, 2));
console.log(`published ${result.published.length}, duplicate ${result.duplicate.length}, failed ${result.failed.length}`);
process.exit(result.failed.length ? 1 : 0);
