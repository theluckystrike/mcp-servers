#!/usr/bin/env node
// Writes data/tests.json from a node --test log (the release chain's test output), so the
// "Unit tests passing" KPI reads the count the last release measured instead of re-running the suite.
// Usage: node scripts/record-tests.mjs <test-log-path> <release-tag>
import { readFileSync, writeFileSync } from "node:fs";
const [logPath, release] = process.argv.slice(2);
if (!logPath) { console.error("usage: record-tests.mjs <test-log> [release]"); process.exit(2); }
const log = readFileSync(logPath, "utf8");
const sum = (k) => [...log.matchAll(new RegExp(`^# ${k} (\\d+)$`, "gm"))].reduce((a, m) => a + Number(m[1]), 0);
const out = { tests: sum("tests"), pass: sum("pass"), fail: sum("fail"), cancelled: sum("cancelled"), skipped: sum("skipped"), at: new Date().toISOString(), release: release || null };
const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
writeFileSync(`${ROOT}/data/tests.json`, JSON.stringify(out, null, 2) + "\n");
console.log(`tests.json: ${out.pass} pass, ${out.fail} fail, ${out.cancelled} cancelled of ${out.tests}`);
