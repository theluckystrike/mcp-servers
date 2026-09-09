#!/usr/bin/env node
// What has Glama indexed, and what score is it giving us?
//
// Round 2 (loop 31) replaced a bare count with the full published rubric, because a count
// cannot answer the question the tool-description work actually needs answered: did the
// number move? Glama publishes every component of its score, so we record every component.
//
// Two surfaces, and they are different pipelines. This matters:
//
//   /mcp/servers/<owner>/<repo>       open-source path, built from GitHub in a sandbox.
//                                     Glama documents this as GitHub-OAuth submission only
//                                     (glama.ai/mcp/methodology, 1.1). We have 1 mirror repo
//                                     of 33 on it, unclaimed, and its last observation is
//                                     frozen at 2026-09-05T18:06:49Z.
//   /mcp/connectors/<namespace>/<n>   registry path, mirrored from the official MCP registry
//                                     that this project already publishes to. No account.
//                                     20 of our servers are on it and it re-scores daily.
//
// The connector surface is where movement will show up first, so it is swept by default.
//
// Usage:
//   node scripts/glama-watch.mjs                 full sweep, writes data/glama_watch.json
//   node scripts/glama-watch.mjs --json          also print the result
//   node scripts/glama-watch.mjs --fast          grades only, skip per-connector pages
//   node scripts/glama-watch.mjs --no-connectors servers only
//
// Be gentle: every Glama request is paced. GLAMA_WATCH_DELAY_MS overrides the pacing.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const OWNER = "theluckystrike";
const NAMESPACE = "io.github.theluckystrike";
const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const ARGV = process.argv.slice(2);
const JSON_OUT = ARGV.includes("--json");
const FAST = ARGV.includes("--fast");
const NO_CONNECTORS = ARGV.includes("--no-connectors");
const DELAY = Number(process.env.GLAMA_WATCH_DELAY_MS || 900);

// A desktop UA. Glama serves an anonymous visitor a full server-rendered page; a bare
// fetch/1.0 UA has been served a shell in the past, and a shell parses as "no score",
// which is exactly the silent zero this script exists to refuse.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  await sleep(DELAY);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,image/svg+xml,*/*" } });
    return { ok: res.ok, status: res.status, body: res.ok ? await res.text() : "" };
  } catch (err) {
    return { ok: false, status: 0, body: "", error: String(err && err.message) };
  }
}

// Tag-stripped visible text, one token per line. Every parser below works on this, because
// Glama's class names are hashed per build and change without notice; the visible text does
// not. Parsing the hashed classes would break silently on their next deploy.
function textLines(html) {
  let t = html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, "");
  t = t.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
  t = t.replace(/<[^>]+>/g, "\n");
  t = t
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
  return t.split("\n").map((l) => l.trim()).filter(Boolean);
}

const GRADE = /^[A-F][+-]?$/;
const COHERENCE_DIMS = ["Disambiguation", "Naming Consistency", "Tool Count", "Completeness"];
const TOOL_DIMS = ["Behavior", "Conciseness", "Completeness", "Parameters", "Purpose", "Usage Guidelines"];

// Four coherence dimensions, each "<name>", "<n>", "/5" on consecutive lines. Read from a
// bounded window so the per-tool "Completeness" further down the page cannot be mistaken
// for the server-level one.
function readCoherence(lines, from, to) {
  const out = {};
  for (let i = from; i < Math.min(to, lines.length - 2); i++) {
    if (COHERENCE_DIMS.includes(lines[i]) && /^\d$/.test(lines[i + 1]) && lines[i + 2] === "/5") {
      if (out[lines[i]] === undefined) out[lines[i]] = Number(lines[i + 1]);
    }
  }
  return out;
}

// Six dimensions of one tool, same shape, read forward from the tool's score line.
function readToolDims(lines, from) {
  const out = {};
  for (let i = from; i < Math.min(from + 90, lines.length - 2); i++) {
    if (TOOL_DIMS.includes(lines[i]) && /^\d$/.test(lines[i + 1]) && lines[i + 2] === "/5") {
      if (out[lines[i]] === undefined) out[lines[i]] = Number(lines[i + 1]);
      if (Object.keys(out).length === TOOL_DIMS.length) break;
    }
  }
  return out;
}

const idx = (lines, s, from = 0) => { for (let i = from; i < lines.length; i++) if (lines[i] === s) return i; return -1; };

// ---------------------------------------------------------------------------
// /mcp/servers/<owner>/<repo>/score
// ---------------------------------------------------------------------------
function parseServerScore(html) {
  const L = textLines(html);
  const out = { surface: "server", tools: [] };

  const pc = L.findIndex((l, i) => l === "Profile completion" && L[i - 1] === "%" && /^\d+$/.test(L[i - 2] || ""));
  if (pc > 1) out.profile_completion_pct = Number(L[pc - 2]);

  const rel = idx(L, "Latest release: v");
  if (rel >= 0) out.glama_release_version = L[rel + 1];

  const coh = idx(L, "Server Coherence");
  const tdq = idx(L, "Tool Definition Quality");
  if (coh >= 0) {
    if (GRADE.test(L[coh + 1] || "")) out.coherence_grade = L[coh + 1];
    out.coherence = readCoherence(L, coh, tdq > coh ? tdq : coh + 200);
  }
  if (tdq >= 0) {
    if (GRADE.test(L[tdq + 1] || "")) out.definition_quality_grade = L[tdq + 1];
    const avg = idx(L, "Average", tdq);
    if (avg > 0 && /^[\d.]+$/.test(L[avg + 1] || "")) out.definition_quality_mean = Number(L[avg + 1]);
    const across = idx(L, "/5 across", tdq);
    if (across > 0) { out.tools_scored = Number(L[across + 1]); out.tools_total = Number(L[across + 3]); }
    const low = L.slice(tdq, tdq + 40).find((l) => /^Lowest: [\d.]+\/5\.?$/.test(l));
    if (low) out.definition_quality_min = Number(low.match(/([\d.]+)/)[1]);
  }

  const maint = idx(L, "Maintenance");
  if (maint >= 0 && GRADE.test(L[maint + 1] || "")) {
    out.maintenance_grade = L[maint + 1];
    const stop = L.findIndex((l, i) => i > maint + 1 && /^This repository is licensed under$/.test(l));
    out.maintenance_checklist = L.slice(maint + 2, stop > 0 ? stop - 1 : maint + 14);
  }
  const lic = idx(L, "This repository is licensed under");
  if (lic > 0 && GRADE.test(L[lic - 1] || "")) out.license_grade = L[lic - 1];
  else if (lic > 0) out.license_grade = L[lic - 2];
  if (lic > 0) out.license = L[lic + 1];

  // Tool Scores: "<tool_name>", "<grade>", "<n.n>/5.0", then the six dimensions.
  const ts = idx(L, "Tool Scores");
  if (ts >= 0) {
    for (let i = ts; i < L.length - 2; i++) {
      if (/^[a-z][a-z0-9_]+$/.test(L[i]) && GRADE.test(L[i + 1]) && /^[\d.]+\/5\.0$/.test(L[i + 2])) {
        out.tools.push({
          name: L[i], grade: L[i + 1],
          score: Number(L[i + 2].split("/")[0]),
          dimensions: readToolDims(L, i + 3),
        });
        i += 2;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// /mcp/connectors/<namespace>/<name>
// Same rubric, different layout: a "TDQS" block with a "Scored <ts>" freshness stamp, then
// the four coherence dimensions, then one block per tool under "Available Tools".
// ---------------------------------------------------------------------------
function parseConnector(html) {
  const L = textLines(html);
  const out = { surface: "connector", tools: [] };

  const t0 = idx(L, "TDQS");
  if (t0 >= 0) {
    if (GRADE.test(L[t0 + 1] || "")) out.tdqs_grade = L[t0 + 1];
    if (/^[\d.]+$/.test(L[t0 + 2] || "")) out.tdqs_score = Number(L[t0 + 2]);
    const sc = idx(L, "Scored", t0);
    if (sc > 0) out.scored_at = L[sc + 1];
    const ac = idx(L, "across", t0);
    if (ac > 0 && /^\d+$/.test(L[ac + 1] || "")) out.tools_total = Number(L[ac + 1]);
    out.coherence = readCoherence(L, t0, idx(L, "Available Tools", t0) > 0 ? idx(L, "Available Tools", t0) : t0 + 200);
  }

  // Tool header signature on this surface: name, human title, grade, "Inspect".
  for (let i = 0; i < L.length - 3; i++) {
    if (/^[a-z][a-z0-9]*_[a-z0-9_]+$/.test(L[i]) && GRADE.test(L[i + 2]) && L[i + 3] === "Inspect") {
      const tq = idx(L, "TDQS", i + 3);
      const tool = { name: L[i], title: L[i + 1], grade: L[i + 2] };
      if (tq > 0 && /^[\d.]+$/.test(L[tq + 2] || "")) {
        tool.score = Number(L[tq + 2]);
        tool.dimensions = readToolDims(L, tq + 3);
      }
      out.tools.push(tool);
    }
  }
  return out;
}

// Glama's published formula, recomputed locally so a change in their arithmetic is visible
// rather than silently absorbed:
//   definition quality = 60% mean of tool scores + 40% MINIMUM tool score
//   overall            = 70% definition quality + 30% coherence (mean of the four dims)
// 40% of the score is the single worst-described tool. That is the lever.
function derive(rec) {
  const scores = (rec.tools || []).map((t) => t.score).filter((n) => typeof n === "number");
  const dims = Object.values(rec.coherence || {});
  const d = {};
  if (scores.length) {
    d.tool_mean = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3);
    d.tool_min = Math.min(...scores);
    d.worst_tool = rec.tools.find((t) => t.score === d.tool_min)?.name;
    d.definition_quality = +(0.6 * d.tool_mean + 0.4 * d.tool_min).toFixed(3);
  }
  if (dims.length === 4) d.coherence_mean = +(dims.reduce((a, b) => a + b, 0) / 4).toFixed(3);
  if (d.definition_quality !== undefined && d.coherence_mean !== undefined) {
    d.overall = +(0.7 * d.definition_quality + 0.3 * d.coherence_mean).toFixed(3);
    d.tier = d.overall >= 3.5 ? "A" : d.overall >= 3.0 ? "B" : d.overall >= 2.0 ? "C" : d.overall >= 1.0 ? "D" : "F";
  }
  return d;
}

// ---------------------------------------------------------------------------

// gh is authenticated here and the anonymous GitHub API is rate limited, so shell out
// rather than fetch: an empty list from a throttled anonymous call reads exactly like
// "nothing indexed".
let repos = [];
try {
  repos = execFileSync("gh", ["repo", "list", OWNER, "--limit", "200", "--json", "name", "--jq", ".[].name"], { encoding: "utf8" })
    .split("\n").map((x) => x.trim()).filter((n) => n.startsWith("mcp-")).sort();
} catch (err) {
  console.error(`FATAL: gh failed (${err && err.message}); refusing to report zero as a finding`);
  process.exit(2);
}
if (!repos.length) { console.error("FATAL: gh returned no mcp-* repos; refusing to report zero as a finding"); process.exit(2); }

// Positive control 1 (reachability): this repo is known listed since 2026-09-05. If the
// probe cannot see it, the probe is broken and every "absent" below is meaningless.
const CONTROL = "mcp-statement-of-account";
// Negative control: a repository that does not exist. Glama's badge route answers HTTP 200
// with a placeholder SVG for unlisted and even imaginary repos, so "badge 200" is NOT a
// listing test. Round 1 of this script used exactly that test and reported 3 of 33 listed
// when the truth was 1: mcp-change-order's badge is byte-identical to this control's.
// Pasting one of those into awesome-mcp-servers would be publishing a badge for a server
// that 404s. The listing test is the PAGE.
const NEGATIVE_CONTROL = "glama-watch-negative-control-does-not-exist";

async function pageExists(name) {
  await sleep(DELAY);
  try {
    const res = await fetch(`https://glama.ai/mcp/servers/${OWNER}/${name}`, { method: "HEAD", headers: { "user-agent": UA } });
    return res.status;
  } catch { return 0; }
}

const placeholder = await get(`https://glama.ai/mcp/servers/${OWNER}/${NEGATIVE_CONTROL}/badges/score.svg`);
const placeholderLen = placeholder.ok ? placeholder.body.length : -1;

const listed = [], absent = [];
for (const name of repos) {
  ((await pageExists(name)) === 200 ? listed : absent).push(name);
}
if (!listed.includes(CONTROL)) {
  console.error(`FATAL: positive control ${CONTROL} reads as absent, so this probe is broken. Not writing a result.`);
  process.exit(3);
}

// Only a badge that differs from the placeholder is safe to publish anywhere.
const badges = {};
for (const name of listed) {
  const b = await get(`https://glama.ai/mcp/servers/${OWNER}/${name}/badges/score.svg`);
  badges[name] = {
    status: b.status,
    bytes: b.ok ? b.body.length : 0,
    is_placeholder: b.ok && b.body.length === placeholderLen,
    safe_to_publish: b.ok && b.body.length !== placeholderLen,
    url: `https://glama.ai/mcp/servers/${OWNER}/${name}/badges/score.svg`,
  };
}

const servers = {};
for (const name of listed) {
  const r = await get(`https://glama.ai/mcp/servers/${OWNER}/${name}/score`);
  if (!r.ok) { servers[name] = { surface: "server", error: `score page HTTP ${r.status}` }; continue; }
  const rec = parseServerScore(r.body);
  // The last time Glama actually ran the server is embedded in the OVERVIEW page, not the
  // score page, so it costs one extra request per listed server. It is worth it: Glama's
  // help text claims "automatically synced at least once per day" and for an unclaimed
  // server that claim has not held, so freshness is the number that decides whether any
  // tool-description work can show up here at all.
  const overview = await get(`https://glama.ai/mcp/servers/${OWNER}/${name}`);
  if (overview.ok) {
    // The payload is embedded as an escaped JSON string, so the quotes arrive as \" in the
    // HTML source. Matching a bare "observedAt" finds nothing and reads as "never synced".
    const obs = overview.body.match(/observedAt\\?",\\?"([^"\\]+)/);
    if (obs) rec.observed_at = obs[1];
    const rel = overview.body.match(/releaseVersion\\?",\\?"([^"\\]+)/);
    if (rel) rec.observed_release_version = rel[1];
    // The newest timestamp anywhere in the embedded record. Distinct from observed_at on
    // purpose: Glama can touch a record without re-running the server, and it does. Our one
    // server record was touched 2026-09-08 while its tool schemas were last actually read on
    // 2026-09-05. Only observed_at moves when a tool description changes, so only observed_at
    // tells you whether a rewrite has been scored yet.
    const stamps = [...overview.body.matchAll(/(20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)/g)].map((m) => m[1]).sort();
    if (stamps.length) rec.record_touched_at = stamps[stamps.length - 1];
    rec.claimed = !/Unclaimed servers have limited discoverability/.test(overview.body);
  }
  rec.derived = derive(rec);
  servers[name] = rec;
}

// Positive control 2 (parser): a 200 that parses to nothing is the failure mode this whole
// file is written against. If the known-good page yields no rubric, fail loudly.
const ctl = servers[CONTROL] || {};
if (!(ctl.tools || []).length || Object.keys(ctl.coherence || {}).length < 4) {
  console.error(
    `FATAL: the score page for ${CONTROL} fetched but parsed to ${(ctl.tools || []).length} tools and ` +
    `${Object.keys(ctl.coherence || {}).length} coherence dimensions. Glama's markup has changed. ` +
    `Not writing a result, because zeros here would read as "the score collapsed".`
  );
  process.exit(4);
}

const connectors = {};
let connectorNames = [];
let listingPage = [];
if (!NO_CONNECTORS) {
  const listing = await get(`https://glama.ai/mcp/connectors?query=namespace%3A${encodeURIComponent(NAMESPACE)}`);
  if (listing.ok) {
    listingPage = [...new Set(
      [...listing.body.matchAll(new RegExp(`/mcp/connectors/${NAMESPACE.replace(/\./g, "\\.")}/([a-zA-Z0-9._-]+)`, "g"))]
        .map((m) => m[1])
    )].sort();
  }
  // The anonymous listing renders 20 rows and paginates behind an API key we do not have,
  // and which 20 it renders rotates between requests. Taking one page as the total would
  // undercount and would look like connectors disappearing. So the known set is cumulative:
  // union this page with everything previous runs recorded.
  let previous = [];
  try {
    previous = JSON.parse(readFileSync(`${ROOT}/data/glama_watch.json`, "utf8")).connectors_listed || [];
  } catch { /* first run */ }
  connectorNames = [...new Set([...previous, ...listingPage])].sort();
  if (!FAST) {
    for (const n of connectorNames) {
      const r = await get(`https://glama.ai/mcp/connectors/${NAMESPACE}/${n}`);
      if (!r.ok) { connectors[n] = { surface: "connector", error: `HTTP ${r.status}` }; continue; }
      const rec = parseConnector(r.body);
      rec.derived = derive(rec);
      connectors[n] = rec;
    }
  }
}

// A compact, diffable slice. The next loop compares THIS between runs to answer
// "did the tool-description work move the number", without re-reading the whole record.
const movement = {};
for (const [k, v] of Object.entries({ ...servers, ...connectors })) {
  if (v.error) continue;
  movement[k] = {
    surface: v.surface,
    grade: v.tdqs_grade || v.definition_quality_grade || null,
    tdqs: v.tdqs_score ?? v.definition_quality_mean ?? null,
    tool_mean: v.derived?.tool_mean ?? null,
    tool_min: v.derived?.tool_min ?? null,     // 40% of the definition-quality score
    worst_tool: v.derived?.worst_tool ?? null, // fix this tool first
    overall: v.derived?.overall ?? null,
    coherence_mean: v.derived?.coherence_mean ?? null,
    freshness: v.scored_at || v.observed_at || null,
  };
}

const out = {
  at: new Date().toISOString(),
  checked: repos.length,
  listed,
  absent_count: absent.length,
  absent,
  badge_url_pattern: `https://glama.ai/mcp/servers/${OWNER}/<repo>/badges/score.svg`,
  badges,
  control: CONTROL,
  negative_control: NEGATIVE_CONTROL,
  negative_control_badge_bytes: placeholderLen,
  connector_namespace: NAMESPACE,
  connector_count: connectorNames.length,
  connector_count_note:
    "Cumulative across runs. The anonymous listing page renders at most 20 rows and rotates " +
    "which 20, so a single page is a floor, not a total.",
  connectors_on_listing_page: listingPage.length,
  connectors_listed: connectorNames,
  formula: {
    definition_quality: "0.6 * mean(tool scores) + 0.4 * min(tool scores)",
    overall: "0.7 * definition_quality + 0.3 * mean(coherence dimensions)",
    tiers: "A >= 3.5, B >= 3.0, C >= 2.0, D >= 1.0, F < 1.0",
    note: "40% of the definition-quality score is the single worst-described tool.",
  },
  servers,
  connectors,
  movement,
  note:
    "Two pipelines. /mcp/servers is the GitHub path and Glama documents it as OAuth-submission only " +
    "(glama.ai/mcp/methodology 1.1); we hold 1 unclaimed record of 33 repos and it has not been " +
    "re-observed since 2026-09-05T18:06:49Z. /mcp/connectors is the official-registry mirror, needs no " +
    "account, carries the same TDQS, and re-scores about daily. Measure tool-description work there. " +
    "The awesome-mcp-servers CI gate matches the literal string glama.ai/mcp/servers/ and so is NOT " +
    "satisfied by a connector URL. A listing is proven by the PAGE returning 200, never by the badge: " +
    "the badge route answers 200 with a placeholder SVG for repos that do not exist. Publish a badge " +
    "only where badges[<repo>].safe_to_publish is true.",
};
writeFileSync(`${ROOT}/data/glama_watch.json`, JSON.stringify(out, null, 2));

if (JSON_OUT) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`glama servers:    ${listed.length} of ${repos.length} mirror repos indexed${listed.length ? ": " + listed.join(", ") : ""}`);
  console.log(`glama connectors: ${connectorNames.length} under ${NAMESPACE}${FAST ? " (grades not fetched, --fast)" : ""}`);
  const rows = Object.entries(movement).sort((a, b) => (a[1].overall ?? 9) - (b[1].overall ?? 9));
  for (const [k, m] of rows) {
    console.log(
      `  ${m.surface === "server" ? "S" : "C"} ${k.padEnd(46)} ${String(m.grade ?? "-").padEnd(2)} ` +
      `overall=${String(m.overall ?? "-").padEnd(5)} mean=${String(m.tool_mean ?? "-").padEnd(5)} ` +
      `min=${String(m.tool_min ?? "-").padEnd(4)} worst=${m.worst_tool ?? "-"} @${m.freshness ?? "-"}`
    );
  }
}
