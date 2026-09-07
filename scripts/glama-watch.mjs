#!/usr/bin/env node
// Which of the mirror repos has Glama indexed?
//
// Glama indexes on its own: theluckystrike/mcp-statement-of-account appeared 33 minutes
// after its repo was created, at zero stars, with nobody claiming anything. So the listing
// is a waiting game, not a submission. This script answers "how many are in now", because
// the awesome-mcp-servers CI gate needs a Glama score badge on the entries in that PR and
// the gate is satisfied the moment any of them is indexed.
//
// Usage: node scripts/glama-watch.mjs [--json]
import { writeFileSync } from "node:fs";

const OWNER = "theluckystrike";
const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const JSON_OUT = process.argv.includes("--json");

// gh is authenticated here and the anonymous API is rate limited, so shell out rather than
// fetch: an empty list from a throttled anonymous call reads exactly like "nothing indexed".
import { execFileSync } from "node:child_process";
const repos = execFileSync("gh", ["repo", "list", OWNER, "--limit", "100", "--json", "name", "--jq", ".[].name"], { encoding: "utf8" })
  .split("\n").map((x) => x.trim()).filter((n) => n.startsWith("mcp-")).sort();
if (!repos.length) { console.error("FATAL: gh returned no mcp-* repos; refusing to report zero as a finding"); process.exit(2); }

// Positive control: this one is known listed (found 2026-09-07). If the probe cannot see
// it, the probe is broken and every "absent" below is meaningless.
const CONTROL = "mcp-statement-of-account";

const listed = [], absent = [];
for (const name of repos) {
  const badge = `https://glama.ai/mcp/servers/${OWNER}/${name}/badges/score.svg`;
  let ok = false;
  try { ok = (await fetch(badge, { method: "GET", headers: { "user-agent": "mcp-servers-glama-watch" } })).ok; } catch {}
  (ok ? listed : absent).push(name);
}

const controlSeen = listed.includes(CONTROL);
if (!controlSeen) { console.error(`FATAL: positive control ${CONTROL} reads as absent, so this probe is broken. Not writing a result.`); process.exit(3); }

const out = {
  at: new Date().toISOString(),
  checked: repos.length,
  listed,
  absent_count: absent.length,
  badge_url_pattern: `https://glama.ai/mcp/servers/${OWNER}/<repo>/badges/score.svg`,
  control: CONTROL,
  note: "The awesome-mcp-servers CI gate is satisfied by a badge URL on any entry in the PR. Add badges as soon as one of the four repos in PR 13473 appears here.",
};
writeFileSync(`${ROOT}/data/glama_watch.json`, JSON.stringify(out, null, 2));
if (JSON_OUT) console.log(JSON.stringify(out, null, 2));
else console.log(`glama: ${listed.length} of ${repos.length} mirror repos indexed${listed.length ? ": " + listed.join(", ") : ""}`);
