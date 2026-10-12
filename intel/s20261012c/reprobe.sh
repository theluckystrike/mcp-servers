#!/bin/bash
# Re-probe expired compare_none tokens against the official MCP registry (2026-10-12).
# 2 pages x 100 per token, cursor-followed. Emits JSON: per server, per token hit counts
# and any competitor-looking names (anything not io.github.theluckystrike).
cd ~/mcp-servers || exit 1
node - <<'EOF' > /tmp/reprobe-plan.json
const fj = require('./data/facts.json');
const out = [];
for (const [k, v] of Object.entries(fj.compare_none || {})) {
  const age = (Date.now() - new Date(v.date + 'T00:00:00Z').getTime()) / 86400000;
  if (age > 30) out.push({ server: k, tokens: v.tokens });
}
console.log(JSON.stringify(out));
EOF
node --input-type=module - <<'EOF' > /tmp/reprobe-result.json
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const plan = JSON.parse(readFileSync('/tmp/reprobe-plan.json', 'utf8'));
const result = {};
for (const { server, tokens } of plan) {
  const per = {};
  let competitors = [];
  for (const tok of tokens) {
    let rows = [];
    let cursor = null;
    for (let page = 0; page < 2; page++) {
      const url = `https://registry.modelcontextprotocol.io/v0/servers?search=${encodeURIComponent(tok)}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      let body;
      try {
        body = JSON.parse(execFileSync('curl', ['-sS', '-m', '25', '-H', 'User-Agent: zovo-organic-probe/1.0', url], { encoding: 'utf8', maxBuffer: 20e6 }));
      } catch { body = {}; }
      const servers = body.servers || [];
      rows = rows.concat(servers);
      cursor = body.cursor || body.nextCursor || null;
      if (!cursor || servers.length === 0) break;
    }
    const ours = rows.filter(r => (r.server?.name || '').startsWith('io.github.theluckystrike/')).length;
    const comp = rows
      .filter(r => !(r.server?.name || '').startsWith('io.github.theluckystrike/'))
      .map(r => r.server?.name).filter(Boolean);
    per[tok] = { rows: rows.length, ours };
    competitors = competitors.concat(comp);
  }
  result[server] = { per, competitorCount: competitors.length, sample: [...new Set(competitors)].slice(0, 3) };
  console.error(`${server}: competitors=${competitors.length}`);
}
console.log(JSON.stringify(result, null, 1));
EOF
echo "DONE exit=$?"
