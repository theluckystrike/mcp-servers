#!/usr/bin/env node
// apply-mirror-seo.mjs -- push the search-facing metadata in scripts/mirror-seo.py to the
// live mirror repos, without waiting for the next full sync-mirrors.sh run.
//
// A full sync rebuilds vendor trees, tags and cuts a release; none of that is needed to
// fix a description, a topic list or a README first screen, and all of it is slow and
// risky. This applies only the three search-facing fields, and it calls the SAME
// mirror-seo.py that sync-mirrors.sh calls, so the next sync writes identical bytes and
// reverts nothing. That is the whole point of the split: a hand edit to a mirror is worse
// than no edit, because the generator silently undoes it.
//
// Usage:
//   node scripts/apply-mirror-seo.mjs --dry-run     # print the diff, change nothing
//   node scripts/apply-mirror-seo.mjs               # apply to all 32 mirrors
//   node scripts/apply-mirror-seo.mjs invoice pdf   # apply to named servers only
//   node scripts/apply-mirror-seo.mjs --stagger 45  # wait 45 minutes between README pushes
//
// Why --stagger exists. Glama's per-repo pages (glama.ai/mcp/servers/<owner>/<repo>) are
// the surface that produces recommendations, and the evidence is that Glama sweeps
// GitHub's recently-pushed list: of 32 mirrors, the one that got a page is office-suite,
// which is last in ALL_SERVERS and therefore last pushed. Pushing all 32 in one burst puts
// them all in that list at the same instant and only the final one is at the head when a
// sweep lands. Staggering gives each mirror its own turn at the head.
//
// This delays only pushes that carry a real change; it never invents one. A mirror whose
// README is already correct is skipped and costs no wait.

import { execFileSync } from "node:child_process";
import { readdirSync, existsSync, writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OWNER = "theluckystrike";
const MONOREPO = `https://github.com/${OWNER}/mcp-servers`;
const RAW = `https://raw.githubusercontent.com/${OWNER}/mcp-servers/main`;
const SEO = join(ROOT, "scripts", "mirror-seo.py");

// data/mirror_repo_overrides.json maps a server name to a renamed mirror repo
// (rename experiment R1: invoice -> mcp-invoice-generator). Missing file = no overrides.
const OVERRIDES = (() => {
  try {
    return JSON.parse(readFileSync(join(ROOT, "data", "mirror_repo_overrides.json"), "utf8"));
  } catch {
    return {};
  }
})();

const DRY = process.argv.includes("--dry-run");
const STAGGER_MIN = process.argv.includes("--stagger")
  ? Number(process.argv[process.argv.indexOf("--stagger") + 1])
  : 0;
const named = process.argv
  .slice(2)
  .filter((a, i, arr) => !a.startsWith("--") && arr[i - 1] !== "--stagger");
const servers = named.length
  ? named
  : readdirSync(join(ROOT, "servers"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

const py = (args) => execFileSync("python3", [SEO, ...args], { encoding: "utf8" }).trim();
const gh = (args, opts = {}) =>
  execFileSync("gh", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...opts });

// The generator picks the demo image the same way; reproduce it exactly or the README
// bytes will differ from what the next sync writes.
function demoFor(name) {
  if (existsSync(join(ROOT, "assets", `demo-${name}.gif`))) {
    return `![${name} demo](${RAW}/assets/demo-${name}.gif)`;
  }
  if (existsSync(join(ROOT, "assets", `${name}-logo.png`))) {
    return `![${name}](${RAW}/assets/${name}-logo.png)`;
  }
  return "";
}

const tmp = mkdtempSync(join(tmpdir(), "mirror-seo-"));
const report = [];

for (const name of servers) {
  const repo = OVERRIDES[name] ?? `mcp-${name}`;
  const full = `${OWNER}/${repo}`;
  const row = { server: name, repo, description: false, topics: false, homepage: false, readme: false };
  let live;
  try {
    live = JSON.parse(gh(["api", `repos/${full}`]));
  } catch {
    row.error = "repo not found";
    report.push(row);
    console.error(`${repo}: repo not found, skipped`);
    continue;
  }

  const desc = py(["description", name]);
  const topics = py(["topics", name]).split(/\s+/).filter(Boolean);
  const home = `https://mcp.zovo.one/s/${name}`;

  row.description = live.description !== desc;
  row.homepage = live.homepage !== home;
  const liveTopics = (live.topics || []).slice().sort();
  row.topics = JSON.stringify(liveTopics) !== JSON.stringify(topics.slice().sort());

  // gemini-extension.json: the Gemini CLI extension gallery indexes a public repo that
  // carries the gemini-cli-extension topic and this file at the repository root, with no
  // submission step. Generated per server by mirror-seo.py, and absent for a server with
  // no hosted endpoint.
  let gemini = null, geminiSha = null, geminiLive = null;
  try {
    gemini = execFileSync("python3", [SEO, "gemini", name], { encoding: "utf8" });
  } catch {
    gemini = null; // no hosted endpoint: no manifest for this server
  }
  try {
    const meta = JSON.parse(gh(["api", `repos/${full}/contents/gemini-extension.json`]));
    geminiSha = meta.sha;
    geminiLive = Buffer.from(meta.content, "base64").toString("utf8");
  } catch {
    geminiLive = null; // not on the mirror yet
  }
  row.gemini = Boolean(gemini) && gemini !== geminiLive;
  row.gemini_stale = !gemini && geminiLive !== null;

  // README: fetch the live one, run the generator's own transform over it, compare.
  let readmeBefore = null, readmeAfter = null, sha = null;
  try {
    const meta = JSON.parse(gh(["api", `repos/${full}/readme`]));
    sha = meta.sha;
    readmeBefore = Buffer.from(meta.content, "base64").toString("utf8");
    const f = join(tmp, `${repo}.md`);
    writeFileSync(f, readmeBefore);
    py(["readme", f, name, demoFor(name), MONOREPO, RAW]);
    readmeAfter = readFileSync(f, "utf8");
    row.readme = readmeAfter !== readmeBefore;
  } catch (e) {
    row.readme_error = String(e.message).slice(0, 120);
  }

  if (DRY) {
    console.log(
      `${repo.padEnd(28)} desc:${row.description ? "CHANGE" : "same  "} ` +
      `topics:${row.topics ? "CHANGE" : "same  "} home:${row.homepage ? "CHANGE" : "same  "} ` +
      `readme:${row.readme ? "CHANGE" : "same  "} ` +
      `gemini:${row.gemini ? "CHANGE" : row.gemini_stale ? "REMOVE" : gemini ? "same  " : "n/a   "}`
    );
    report.push(row);
    continue;
  }

  if (row.description || row.homepage) {
    gh(["repo", "edit", full, "--description", desc, "--homepage", home], { stdio: "ignore" });
  }
  if (row.topics) {
    gh(["api", "-X", "PUT", `repos/${full}/topics`, ...topics.flatMap((t) => ["-f", `names[]=${t}`])],
       { stdio: "ignore" });
  }
  if (row.gemini) {
    gh([
      "api", "-X", "PUT", `repos/${full}/contents/gemini-extension.json`,
      "-f", "message=add gemini-extension.json for the Gemini CLI extension gallery\n\n" +
            "The gallery indexes a public repository that carries the\n" +
            "gemini-cli-extension topic and this manifest at the repository root; there\n" +
            "is no submission step. Transport is httpUrl with the token in an\n" +
            "Authorization header, because the bare endpoint answers 401 on tools/call\n" +
            "and the mirror has no built dist for a stdio command. Generated by\n" +
            "scripts/mirror-seo.py in the monorepo.",
      "-f", `content=${Buffer.from(gemini).toString("base64")}`,
      ...(geminiSha ? ["-f", `sha=${geminiSha}`] : []),
      "-f", "branch=main",
    ], { stdio: "ignore" });
  }
  if (row.gemini_stale) {
    gh([
      "api", "-X", "DELETE", `repos/${full}/contents/gemini-extension.json`,
      "-f", "message=remove gemini-extension.json: this server has no hosted endpoint",
      "-f", `sha=${geminiSha}`, "-f", "branch=main",
    ], { stdio: "ignore" });
  }
  if (row.readme) {
    gh([
      "api", "-X", "PUT", `repos/${full}/contents/README.md`,
      "-f", "message=README: lead with what this server is and an install path that works\n\n" +
            "The first screen now carries the capability sentence, then the three install\n" +
            "paths that are verified to work (hosted endpoint, .mcpb one-click, clone and\n" +
            "build), and says plainly that the npm package is not published so an npx\n" +
            "command will fail. Generated by scripts/mirror-seo.py in the monorepo; a\n" +
            "sync-mirrors.sh run reproduces these bytes.",
      "-f", `content=${Buffer.from(readmeAfter).toString("base64")}`,
      "-f", `sha=${sha}`,
      "-f", "branch=main",
    ], { stdio: "ignore" });
  }
  console.log(
    `${repo.padEnd(28)} ${["description", "topics", "homepage", "readme", "gemini", "gemini_stale"].filter((k) => row[k]).join(",") || "no change"}` +
    (row.readme && STAGGER_MIN ? `  [pushed ${new Date().toISOString()}]` : "")
  );
  report.push(row);

  // Only a README change is a git push, so only a README change earns the wait.
  if (STAGGER_MIN && (row.readme || row.gemini || row.gemini_stale) && name !== servers[servers.length - 1]) {
    console.log(`  waiting ${STAGGER_MIN}m so this mirror holds the head of GitHub's recently-pushed list`);
    execFileSync("sleep", [String(STAGGER_MIN * 60)]);
  }
}

const changed = (k) => report.filter((r) => r[k]).length;
console.log(
  `\n${DRY ? "[dry run] would change" : "changed"}: description ${changed("description")}, ` +
  `topics ${changed("topics")}, homepage ${changed("homepage")}, readme ${changed("readme")}, ` +
  `gemini-extension.json ${changed("gemini")} written / ${changed("gemini_stale")} removed ` +
  `across ${report.length} mirrors`
);
