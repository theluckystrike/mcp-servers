#!/usr/bin/env node
// Renders servers/*/README.md into billing/src/pages.js so mcp.zovo.one serves a product page per server.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { marked } from "marked";
const ids = ["time-tracker", "price-tracker", "spreadsheet", "invoice", "expense-tracker", "currency", "timezone", "docx", "resume", "recurring", "clauses", "pdf", "calendar", "kanban", "image", "bank-statement", "quotes", "barcode", "zip", "billing-docs", "deposits"];
const facts = JSON.parse(readFileSync("data/facts.json", "utf8"));
const out = {};

/** Append ?src=<src> to every untagged /buy/<product> href in a block of rendered HTML. */
function tagBuyLinks(html, src) {
  return html.replace(/(href="(?:https:\/\/mcp\.zovo\.one)?\/buy\/[a-z0-9-]+)"/g, `$1?src=${src}"`);
}

/**
 * Every generated page's CTA block gets a bundle mention, regardless of whether that
 * server's README happens to say anything about the bundle already: some do, some
 * (e.g. time-tracker) do not link to /buy at all. Rather than depend on README wording,
 * this appends one sentence, tagged src=store.s.<id>.bundle so its clicks are told apart
 * from a same-server buy click on /stats/clicks.
 */
function addBundleCta(html, id) {
  const bundleLink = `<a href="https://mcp.zovo.one/buy/bundle?src=store.s.${id}.bundle">the nineteen-server bundle for $39</a>`;
  const taggedHref = new RegExp(`(<p>[^<]*<a href="https://mcp\\.zovo\\.one/buy/${id}\\?src=store\\.s\\.${id}"[\\s\\S]*?<\\/a>[^<]*)(<\\/p>)`);
  if (taggedHref.test(html)) {
    return html.replace(taggedHref, (m, before, after) => `${before} Or ${bundleLink}.${after}`);
  }
  return html + `\n<p>Or ${bundleLink}.</p>`;
}


// ---------------------------------------------------------------------------
// "First five minutes": generated from the measurement rounds in data/.
//
// Nothing in this section is hand-written per server. Every prompt shown on a /s/<id>
// page is a verbatim string from a data/user_value_r*.json scenario, the sentence under
// it is a sentence of that scenario's evidence field (`note`), the round and date name
// where it came from, and the free-tier line is data/facts.json servers.<id>.free.
// billing/test/first-five.test.mjs re-reads the round files and fails if any quoted
// prompt is not found in one of them.
// ---------------------------------------------------------------------------
const ROUND_FILE = /^user_value(?:_r(\d+))?\.json$/;
const MIN_SENTENCE_CHARS = 40;

function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Every scored, prompt-carrying scenario in every round file, flattened. */
function loadScenarios(dir = "data") {
  const rows = [];
  for (const file of readdirSync(dir).sort()) {
    const m = ROUND_FILE.exec(file);
    if (!m) continue;
    const doc = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
    const round = typeof doc.round === "number" ? doc.round : Number(m[1] || 1);
    const date = String(doc.at || "").slice(0, 10);
    for (const s of doc.scenarios || []) {
      // r4 and r9 carry no prompt, r4 carries no score: those rows cannot be quoted.
      if (typeof s.prompt !== "string" || typeof s.score !== "number") continue;
      // Older rounds name the server only through `surface` ("hosted/price-tracker").
      const server = s.server || (typeof s.surface === "string" ? s.surface.split("/").pop() : null);
      if (!server) continue;
      rows.push({ file, round, date, server, id: s.id, prompt: s.prompt, score: s.score, note: typeof s.note === "string" ? s.note : "" });
    }
  }
  return rows;
}

/**
 * Split evidence into sentences and return the first one that actually says something.
 * Notes routinely open with a bare call count ("One convert.", "One call.") or a marker
 * ("HONESTY SCENARIO."), so anything under MIN_SENTENCE_CHARS is skipped. The split only
 * fires on a period followed by whitespace and a sentence opener, so decimals and version
 * numbers ("49.00 EUR", "1.154028") stay intact. A leading all-caps marker some notes
 * carry ("HONESTY SCENARIO.") is a label for the round log, not something a reader of a
 * product page can act on, so it is dropped before the split.
 */
function evidenceSentence(note) {
  const parts = String(note).trim().replace(/^[A-Z][A-Z0-9 -]{3,}\.\s+/, "").split(/(?<=\.)\s+(?=["'(A-Z0-9])/).map((p) => p.trim()).filter(Boolean);
  return parts.find((p) => p.length >= MIN_SENTENCE_CHARS) || parts[0] || "";
}

/**
 * The round to quote for a server: highest mean score across the scenarios that round ran
 * for it, then the most 3s, then the most recent round. Ties are broken deterministically
 * so a rebuild with unchanged data produces an unchanged page.
 */
function pickRound(rows) {
  const byRound = new Map();
  for (const r of rows) (byRound.get(r.round) || byRound.set(r.round, []).get(r.round)).push(r);
  const ranked = [...byRound.entries()].map(([round, v]) => ({
    round,
    rows: v,
    mean: v.reduce((a, b) => a + b.score, 0) / v.length,
    threes: v.filter((x) => x.score === 3 && x.note).length,
  }));
  ranked.sort((a, b) => b.mean - a.mean || b.threes - a.threes || b.round - a.round);
  return ranked[0];
}

/** Up to three quotable prompts for one server, plus the round they came from. */
function selectPrompts(rows) {
  const won = pickRound(rows);
  if (!won) return null;
  const quotable = won.rows.filter((r) => r.note);
  const threes = quotable.filter((r) => r.score === 3).slice(0, 3);
  // A server whose best round has no 3 (or no evidence beside one) still gets a prompt,
  // with its score stated rather than implied.
  const picked = threes.length ? threes : quotable.slice().sort((a, b) => b.score - a.score).slice(0, 1);
  return { round: won.round, date: won.rows[0].date, perfect: threes.length > 0, picked };
}

/**
 * The rendered section. `free` is data/facts.json servers.<id>.free, verbatim.
 * Returns "" for a server no round has ever covered, rather than an empty heading.
 */
function firstFiveMinutes(id, scenarios, free) {
  const rows = scenarios.filter((s) => s.server === id);
  if (!rows.length) return { html: "", entries: [], round: null, date: null };
  const sel = selectPrompts(rows);
  if (!sel || !sel.picked.length) return { html: "", entries: [], round: null, date: null };
  const source = `measured in round ${sel.round}, ${sel.date}`;
  const lead = sel.perfect
    ? (sel.picked.length === 1
      ? `One prompt that scored 3 of 3, ${source}. Paste it in as it is written.`
      : `${sel.picked.length === 2 ? "Two" : "Three"} prompts that scored 3 of 3, ${source}. Paste one in as it is written.`)
    : `The best-scoring prompt for this server, ${source}. It scored ${sel.picked[0].score} of 3. Paste it in as it is written.`;
  const blocks = sel.picked.map((r) => {
    const did = evidenceSentence(r.note);
    const score = sel.perfect ? "" : ` Score ${r.score} of 3.`;
    return `<pre>${escHtml(r.prompt)}</pre>\n<p class="muted">What it did, ${source}: ${escHtml(did)}${score}</p>`;
  }).join("\n");
  const freeLine = free ? `\n<p class="muted">On the free tier for this path: ${escHtml(free)}</p>` : "";
  return {
    html: `\n<h2>First five minutes</h2>\n<p>${escHtml(lead)}</p>\n${blocks}${freeLine}\n`,
    entries: sel.picked.map((r) => ({ round: r.round, date: r.date, file: r.file, id: r.id, score: r.score, prompt: r.prompt, evidence: evidenceSentence(r.note) })),
    round: sel.round,
    date: sel.date,
  };
}

const scenarios = loadScenarios("data");

// ---------------------------------------------------------------------------
// /changelog: one section per docs/RELEASE_V*.md, newest first. Every sentence
// rendered on the page is copied verbatim from that release's own file: the version
// and date from its header line, the evidence line as a short paragraph, the insight
// line as one quoted sentence, and the GitHub release link from its artifacts. Nothing
// here is composed or paraphrased. billing/test/changelog.test.mjs re-reads docs/ and
// fails if any version present there is missing from the page, or if the order drifts.
// ---------------------------------------------------------------------------

/** First run of consecutive non-blank, non-heading, non-fence lines starting at `from`. */
function firstParagraph(lines, from) {
  let i = from;
  while (i < lines.length && (lines[i].trim() === "" || /^#{1,6}\s/.test(lines[i]) || lines[i].trim().startsWith("```"))) {
    if (lines[i].trim().startsWith("```")) { i++; while (i < lines.length && !lines[i].trim().startsWith("```")) i++; }
    i++;
  }
  const para = [];
  while (i < lines.length && lines[i].trim() !== "" && !/^#{1,6}\s/.test(lines[i]) && !lines[i].trim().startsWith("```")) {
    para.push(lines[i].trim());
    i++;
  }
  return para.join(" ").trim();
}

/** The section body between a `## <name>` heading and the next `## ` heading (or EOF). */
function section(content, name) {
  const re = new RegExp(`^##\\s+${name}\\s*$`, "im");
  const m = re.exec(content);
  if (!m) return null;
  const rest = content.slice(m.index + m[0].length);
  const next = rest.search(/^##\s+/im);
  return next === -1 ? rest : rest.slice(0, next);
}

/** First real sentence of a paragraph, reusing the same split rule as evidenceSentence. */
function firstSentence(text) {
  const parts = String(text).trim().split(/(?<=\.)\s+(?=["'(A-Z0-9])/).map((p) => p.trim()).filter(Boolean);
  return parts[0] || "";
}

function parseRelease(file, content) {
  const header = /^#\s*Release\s+(v[0-9]+\.[0-9]+\.[0-9]+)(?:\s*\((\d{4}-\d{2}-\d{2})\))?/im.exec(content);
  if (!header) return null;
  const version = header[1];
  const date = header[2] || null;

  // Inline format (v0.9.3+): "evidence: ...", "insight: ...", "artifacts: ..." each one line.
  const inlineEvidence = /^evidence:\s*(.+)$/im.exec(content);
  const inlineInsight = /^insight:\s*(.+)$/im.exec(content);

  let evidence = "";
  let insightSentence = "";
  if (inlineEvidence) {
    evidence = inlineEvidence[1].trim();
  } else {
    const sec = section(content, "evidence");
    if (sec) evidence = firstParagraph(sec.split("\n"), 0);
  }
  if (inlineInsight) {
    insightSentence = firstSentence(inlineInsight[1].trim());
  } else {
    const sec = section(content, "insight");
    if (sec) insightSentence = firstSentence(firstParagraph(sec.split("\n"), 0));
  }

  const linkMatch = /https:\/\/github\.com\/\S*releases\/tag\/\S+/.exec(content);
  const releaseUrl = linkMatch ? linkMatch[0].replace(/[.,)]+$/, "") : null;

  return { file, version, date, evidence, insightSentence, releaseUrl };
}

/** Sort key: version string split into numeric parts, descending. */
function versionKey(v) {
  return v.replace(/^v/, "").split(".").map(Number);
}
function cmpVersionDesc(a, b) {
  const pa = versionKey(a.version), pb = versionKey(b.version);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pb[i] || 0) - (pa[i] || 0);
    if (d) return d;
  }
  return 0;
}

const releaseFiles = readdirSync("docs").filter((f) => /^RELEASE_V[0-9]+\.md$/.test(f)).sort();
const releases = releaseFiles
  .map((f) => parseRelease(f, readFileSync(`docs/${f}`, "utf8")))
  .filter(Boolean)
  .sort(cmpVersionDesc);

const CHANGELOG = { releases, serverCount: ids.length, currentVersion: releases[0]?.version || null };

for (const id of ids) {
  if (!existsSync(`servers/${id}/README.md`)) { console.error(`skip ${id}: no README yet`); continue; }
  const md = readFileSync(`servers/${id}/README.md`, "utf8");
  // Conversion instrument (docs/CONVERSION_INSTRUMENT.md): a /buy link that reaches the
  // storefront from a README carried no src, so its clicks landed in <product>.unknown.
  // Tag every one of them with the page that rendered it. Links that already carry a
  // query string are left alone, so this stays idempotent.
  const tagged = tagBuyLinks(marked.parse(md.replace(/<!--[\s\S]*?-->/g, "")), `store.s.${id}`);
  const f = facts.servers[id];
  const ff = firstFiveMinutes(id, scenarios, f.free);
  if (!ff.entries.length) console.error(`warn ${id}: no round has ever covered it, no First five minutes section`);
  // The bundle sentence is folded in last so it stays the final line of the page even
  // when a README has no /buy paragraph of its own to fold it into.
  const body = addBundleCta(tagged + ff.html, id);
  out[id] = { title: f.title, tagline: f.tagline, description: f.does, html: body, first_five: ff.entries, first_five_round: ff.round, first_five_date: ff.date };
}
writeFileSync(
  "billing/src/pages.js",
  "// generated by scripts/build-pages.mjs, do not edit\nexport const PAGES = " + JSON.stringify(out) +
  ";\nexport const CHANGELOG = " + JSON.stringify(CHANGELOG) + ";\n",
);
console.log("pages:", Object.keys(out).join(", "), "bytes", JSON.stringify(out).length);
console.log("changelog releases:", releases.map((r) => r.version).join(", "));
