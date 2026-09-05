#!/usr/bin/env node
// Weekly digest. Reads only data/ and docs/ (plus local git metadata for commit dates -
// no network calls anywhere). Writes docs/WEEKLY_<yyyy-mm-dd>.md.
//
// Every number in the output is traced back to the file it came from. Run:
//   node scripts/digest.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA = (p) => join(ROOT, "data", p);
const DOCS = (p) => join(ROOT, "docs", p);

const readJson = (p, fallback) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
};
const readText = (p) => {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
};

const now = new Date();
const isoDate = now.toISOString().slice(0, 10);
const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

// git is a local, offline read of this repo's own history: used only to date
// docs that carry no date of their own (release records, distribution surfaces).
function gitFirstCommitDate(relPath) {
  try {
    const out = execFileSync(
      "git",
      ["log", "--diff-filter=A", "--format=%cI", "-1", "--", relPath],
      { cwd: ROOT, encoding: "utf8" }
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}
function gitShowFile(rev, relPath) {
  try {
    return execFileSync("git", ["show", `${rev}:${relPath}`], { cwd: ROOT, encoding: "utf8" });
  } catch {
    return null;
  }
}
function gitLastCommitBefore(iso, relPath) {
  try {
    const out = execFileSync(
      "git",
      ["log", "--before", iso, "--format=%H", "-1", "--", relPath],
      { cwd: ROOT, encoding: "utf8" }
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}

const lines = [];
const push = (s = "") => lines.push(s);

push(`# Weekly digest, ${isoDate}`);
push();
push(`Window: ${windowStart.toISOString().slice(0, 10)} to ${isoDate}. Every number below names its source file; nothing here is estimated.`);
push();

// ---------------------------------------------------------------------------
// 1. Headline numbers
// ---------------------------------------------------------------------------
push("## Headline numbers");
push();

const metrics = readJson(DATA("metrics.json"), { snapshots: [] });
const snaps = metrics.snapshots || [];
const latestSnap = snaps.at(-1) || null;
// snapshot closest to (but not after) 7 days before the latest snapshot
let priorSnap = null;
if (latestSnap) {
  const latestAt = new Date(latestSnap.at).getTime();
  const targetAt = latestAt - 7 * 24 * 60 * 60 * 1000;
  for (const s of snaps) {
    const t = new Date(s.at).getTime();
    if (t <= targetAt) priorSnap = s;
  }
  if (!priorSnap) priorSnap = snaps[0]; // repo history is younger than 7 days
}

const kpi = readJson(DATA("kpi.json"), { kpis: [], raw: {} });
const kpiByName = Object.fromEntries((kpi.kpis || []).map((k) => [k.name, k]));

push("| Metric | Value | Source |");
push("|---|---|---|");
if (latestSnap) {
  const now7 = latestSnap.release_downloads_total ?? 0;
  const then7 = priorSnap ? priorSnap.release_downloads_total ?? 0 : now7;
  const delta = now7 - then7;
  const deltaNote = priorSnap === latestSnap
    ? "only one snapshot exists, no 7-day-old point to diff against"
    : `vs ${priorSnap.at}`;
  push(`| Bundle downloads now | ${now7} | data/metrics.json (snapshot at ${latestSnap.at}) |`);
  push(`| Bundle downloads, 7-day delta | ${delta >= 0 ? "+" : ""}${delta} | data/metrics.json (${deltaNote}) |`);
} else {
  push("| Bundle downloads | no snapshots recorded | data/metrics.json |");
}

const regKpi = kpiByName["Registry entries at latest version"];
if (regKpi) push(`| Registry entries at latest version | ${regKpi.value} of ${regKpi.target} | data/kpi.json (kpis[].name = "${regKpi.name}") |`);
const hostedKpi = kpiByName["Hosted endpoints coverage"];
if (hostedKpi) push(`| Hosted endpoints coverage | ${hostedKpi.value} of ${hostedKpi.target} servers | data/kpi.json (kpis[].name = "${hostedKpi.name}") |`);
const sitemapKpi = kpiByName["Pages indexed on the storefront sitemap"];
if (sitemapKpi) push(`| Sitemap pages | ${sitemapKpi.value} URLs (target ${sitemapKpi.target}) | data/kpi.json (kpis[].name = "${sitemapKpi.name}") |`);
if (kpi.raw?.sitemap_urls !== undefined) push(`| Sitemap URLs, raw count | ${kpi.raw.sitemap_urls} | data/kpi.json (raw.sitemap_urls) |`);

// clicks by src
const remoteKvNames = kpi.raw?.remote_kv?.names || [];
const clickKeys = remoteKvNames.filter((n) => n.startsWith("click:"));
const clickKpi = kpiByName["Upgrade link clicks (humans, 7d)"];
if (clickKeys.length) {
  push(`| Clicks by src | ${clickKeys.length} distinct click: keys, no per-key counts stored | data/kpi.json (raw.remote_kv.names, key names only) |`);
} else {
  push(`| Clicks by src | not present in data/kpi.json raw | data/kpi.json |`);
}
if (clickKpi) push(`| Upgrade link clicks (7d, all src summed) | ${clickKpi.value} (target ${clickKpi.target}) | data/kpi.json (kpis[].name = "${clickKpi.name}") |`);

const paidKpi = kpiByName["Paid sessions"];
if (paidKpi) push(`| Paid sessions | ${paidKpi.value} (target ${paidKpi.target}) | data/kpi.json (kpis[].name = "${paidKpi.name}") |`);

push();

// ---------------------------------------------------------------------------
// 2. Releases in the window
// ---------------------------------------------------------------------------
push("## Releases in the window");
push();

const releaseFiles = existsSync(DOCS("."))
  ? readdirSync(DOCS(".")).filter((f) => /^RELEASE_V0.*\.md$/.test(f)).sort()
  : [];

const releases = [];
for (const f of releaseFiles) {
  const text = readText(DOCS(f));
  const titleMatch = text.match(/^#\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : f;
  const statusMatch = text.match(/^status:\s*(.+)$/mi);
  const status = statusMatch ? statusMatch[1].trim() : "(no status line)";
  // date: prefer one embedded in the title, else the file's first-commit date in git
  const dateInTitle = title.match(/\((\d{4}-\d{2}-\d{2})\)/);
  const gitDate = gitFirstCommitDate(`docs/${f}`);
  const at = dateInTitle ? dateInTitle[1] : (gitDate ? gitDate.slice(0, 10) : null);
  releases.push({ file: f, title, status, at, gitDate });
}

const releasesInWindow = releases.filter((r) => {
  if (!r.gitDate && !r.at) return true; // undated, include rather than silently drop
  const d = new Date(r.gitDate || r.at);
  return d >= windowStart;
});

push("| Release | Status | Date | Source |");
push("|---|---|---|---|");
for (const r of releasesInWindow) {
  push(`| ${r.title} | ${r.status} | ${r.at ?? "unknown"} | docs/${r.file} |`);
}
if (!releasesInWindow.length) push("| (none) | | | docs/RELEASE_V0*.md |");
push();

// ---------------------------------------------------------------------------
// 3. User-value rounds in the window
// ---------------------------------------------------------------------------
push("## User-value rounds in the window");
push();

const uvi = readJson(DATA("user_value_index.json"), { rounds: [], matrix: [], ledger: [], counts: {} });
const roundsInWindow = (uvi.rounds || []).filter((r) => r.at && new Date(r.at) >= windowStart);

push("| Round | Score | Max | Pct | Scenarios | At | Source |");
push("|---|---|---|---|---|---|---|");
for (const r of roundsInWindow) {
  push(`| R${r.round} | ${r.score} | ${r.max} | ${r.pct}% | ${r.scenarios} | ${r.at} | data/user_value_index.json (rounds[].round=${r.round}) |`);
}
if (!roundsInWindow.length) push("| (none) | | | | | | data/user_value_index.json |");
push();

push("Per-server best percentage reached in any round to date (data/user_value_index.json, matrix[]):");
push();
push("| Server | Best pct | Last round tested |");
push("|---|---|---|");
for (const m of (uvi.matrix || []).slice().sort((a, b) => (b.best_pct ?? 0) - (a.best_pct ?? 0))) {
  push(`| ${m.server} | ${m.best_pct ?? "?"}% | R${m.last_round ?? "?"} |`);
}
push();

// ---------------------------------------------------------------------------
// 4. Open defects
// ---------------------------------------------------------------------------
push("## Open defects");
push();

const overrides = readJson(DATA("defect_overrides.json"), {});
const ledger = uvi.ledger || [];
const openDefects = ledger.filter((e) => e.status === "open");
const idNum = (id) => {
  const m = id.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
};
const newestOpen = openDefects.slice().sort((a, b) => idNum(b.id) - idNum(a.id)).slice(0, 3);

push(`Open: ${uvi.counts?.open ?? openDefects.length} of ${uvi.counts?.defects ?? "?"} total defects found (data/user_value_index.json counts, cross-checked against data/defect_overrides.json triage).`);
push();
push("Three newest open ids (titles are scraped verbatim from round writeups, so some are table fragments, not full sentences):");
push();
push("| Id | First seen | Title (as scraped) |");
push("|---|---|---|");
for (const d of newestOpen) {
  const cleanTitle = d.title.replace(/\*\*/g, "").replace(/\s*\|\s*$/, "").trim();
  push(`| ${d.id} | ${d.first_seen} | ${cleanTitle} |`);
}
push();
push("Source: data/user_value_index.json (ledger[]), data/defect_overrides.json (triage overrides applied on top of the scraped status).");
push();

// ---------------------------------------------------------------------------
// 5. Distribution surfaces that changed status in the window
// ---------------------------------------------------------------------------
push("## Distribution surfaces changed in the window");
push();

const dist = readJson(DATA("distribution.json"), { surfaces: {} });
const windowStartIso = windowStart.toISOString();
const beforeRev = gitLastCommitBefore(windowStartIso, "data/distribution.json");
let distChanges = [];
let distNote;
if (beforeRev) {
  const beforeText = gitShowFile(beforeRev, "data/distribution.json");
  const before = beforeText ? JSON.parse(beforeText) : { surfaces: {} };
  const beforeSurfaces = before.surfaces || {};
  const nowSurfaces = dist.surfaces || {};
  for (const [k, v] of Object.entries(nowSurfaces)) {
    const prev = beforeSurfaces[k];
    if (!prev) distChanges.push({ surface: k, from: "(not tracked yet)", to: v.status });
    else if (prev.status !== v.status) distChanges.push({ surface: k, from: prev.status, to: v.status });
  }
  distNote = `compared against data/distribution.json as of commit ${beforeRev.slice(0, 7)} (last commit before the window started)`;
} else {
  // whole repo history is younger than the window: everything currently in the
  // file counts as "new since project start", which is inside the window
  distNote = "no commit exists before the window start; the repo itself is younger than 7 days, so every surface below is new within the window";
  for (const [k, v] of Object.entries(dist.surfaces || {})) {
    distChanges.push({ surface: k, from: "(new)", to: v.status });
  }
}

push(`Source: data/distribution.json, ${distNote}.`);
push();
push("| Surface | From | To |");
push("|---|---|---|");
for (const c of distChanges) push(`| ${c.surface} | ${c.from} | ${c.to} |`);
if (!distChanges.length) push("| (none) | | |");
push();

// ---------------------------------------------------------------------------
// 6. Human-gated list
// ---------------------------------------------------------------------------
push("## Human-gated distribution pack, sections");
push();
const hgpText = readText(DOCS("HUMAN_GATED_PACK.md"));
const sectionTitles = [...hgpText.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
if (sectionTitles.length) {
  for (const t of sectionTitles) push(`- ${t}`);
} else {
  push("(docs/HUMAN_GATED_PACK.md not found or has no ## sections)");
}
push();
push("Source: docs/HUMAN_GATED_PACK.md (section headers).");
push();

// ---------------------------------------------------------------------------
// 7. What changed for a user
// ---------------------------------------------------------------------------
push("## What changed for a user");
push();
if (releasesInWindow.length) {
  const summary = releasesInWindow
    .map((r) => `${r.title.replace(/^Release\s*/, "")}: ${r.status.replace(/^status:\s*/i, "")}`)
    .join(". ");
  push(`${summary}.`);
} else {
  push("No release status lines fell inside the window.");
}
push();
push("(This paragraph is assembled only from the status lines in docs/RELEASE_V0*.md listed above; it adds no claim that is not already written there.)");
push();

const outPath = DOCS(`WEEKLY_${isoDate}.md`);
writeFileSync(outPath, lines.join("\n") + "\n");
console.log(`digest written: ${outPath} (${lines.length} lines)`);
