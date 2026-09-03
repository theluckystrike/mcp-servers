#!/usr/bin/env node
// Consolidates every user-value round into data/user_value_index.json: trend, per-server matrix, seam-defect ledger.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const rounds = [];
const files = ["user_value.json", ...readdirSync(`${ROOT}/data`).filter((f) => /^user_value_r\d+\.json$/.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))];
const num = (v) => (typeof v === "number" ? v : undefined);
for (const f of files) {
  const d = JSON.parse(readFileSync(`${ROOT}/data/${f}`, "utf8"));
  const n = f === "user_value.json" ? 1 : Number(f.match(/\d+/)[0]);
  const t = d.totals || {};
  let score = num(t.score) ?? num(t[`r${n}`]);
  let max = num(t.max);
  if (score === undefined && t.bundle && t.remote) { score = (t.bundle.score ?? 0) + (t.remote.score ?? 0) + (t.stdio?.score ?? 0); max = (t.bundle.max ?? 0) + (t.remote.max ?? 0) + (t.stdio?.max ?? 0); }
  const scen = d.scenarios || [];
  const perServer = {};
  for (const s of scen) { const key = s.server || (s.surface && !/bundle|remote|stdio/.test(s.surface) ? s.surface : null); if (!key) continue; const sc = num(s.score) ?? num(s[`r${n}`]); if (sc === undefined) continue; perServer[key] = perServer[key] || { score: 0, max: 0 }; perServer[key].score += sc; perServer[key].max += 3; }
  for (const [k, v] of Object.entries(t.per_server || {})) if (v && typeof v.score === "number") perServer[k] = { score: v.score, max: v.max ?? v.score };
  for (const [k, v] of Object.entries(t.by_server || {})) if (v && typeof v.score === "number") perServer[k] = { score: v.score, max: v.max ?? v.score };
  rounds.push({ round: n, file: f, score, max, pct: score !== undefined && max ? Math.round((100 * score) / max) : null, scenarios: scen.length, per_server: perServer, at: d.at || null, method: (d.method || "").slice(0, 160) });
}
// defect ledger from docs
const docs = readdirSync(`${ROOT}/docs`).filter((f) => /^USER_VALUE(_R\d+)?\.md$|_AUDIT\.md$/.test(f));
const ledger = {};
for (const f of docs) {
  const text = readFileSync(`${ROOT}/docs/${f}`, "utf8");
  const sections = text.split(/\n(?=#{1,3} )/);
  for (const sec of sections) {
    const fixSection = /^#{1,3} [^\n]*(fix|Fixes|fixed|closed)/i.test(sec);
    for (const m of sec.matchAll(/\b(D-[A-Z]{0,2}\d+[a-z]?)\b[^\n]{0,140}/g)) {
      const id = m[1]; const line = m[0].replace(/\s+/g, " ");
      ledger[id] = ledger[id] || { id, first_seen: f, severity: (line.match(/\b(high|medium|low|P[0-3])\b/i) || [])[1] || "", title: line.slice(0, 140), status: "open" };
      if (fixSection || /\b(fixed|closed|now caps|now refuses|now returns|no longer)\b/i.test(line)) ledger[id].status = "fixed";
      if (/\b(client-side|not fixed|open by design|accepted risk|harness)\b/i.test(line) && ledger[id].status !== "fixed") ledger[id].status = "open (client or accepted)";
    }
  }
}
const servers = [...new Set(rounds.flatMap((r) => Object.keys(r.per_server)))].sort();
const matrix = servers.map((s) => { const cells = rounds.map((r) => r.per_server[s] ? `${r.per_server[s].score}/${r.per_server[s].max}` : ""); const best = rounds.filter((r) => r.per_server[s]).map((r) => r.per_server[s].score / (r.per_server[s].max || 1)); return { server: s, cells, best_pct: best.length ? Math.round(100 * Math.max(...best)) : null, last_round: rounds.filter((r) => r.per_server[s]).map((r) => r.round).pop() ?? null }; });
const out = { generated_at: new Date().toISOString(), rounds, servers, matrix, ledger: Object.values(ledger).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })), counts: { defects: Object.keys(ledger).length, fixed: Object.values(ledger).filter((d) => d.status === "fixed").length } };
writeFileSync(`${ROOT}/data/user_value_index.json`, JSON.stringify(out, null, 2));
console.log(`rounds ${rounds.length}, servers ${servers.length}, defects ${out.counts.defects} (${out.counts.fixed} fixed)`);
