#!/bin/bash
# Probe 2.0: one request per token (limit=100, single page, 40s timeout, 3 tries).
cd ~/mcp-servers || exit 1
node --input-type=module - <<'EOF' > /tmp/reprobe-result.json 2>/tmp/reprobe-progress.log
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const plan = JSON.parse(readFileSync('/tmp/reprobe-plan2.json', 'utf8'));
const fetch1 = (url) => {
  for (let t = 0; t < 3; t++) {
    try {
      return JSON.parse(execFileSync('curl', ['-sS', '-m', '40', '-H', 'User-Agent: zovo-organic-probe/1.0', url], { encoding: 'utf8', maxBuffer: 30e6 }));
    } catch (e) { console.error(`retry ${t + 1}: ${e.message.slice(0, 80)}`); }
  }
  return {};
};
const result = {};
for (const { server, tokens } of plan) {
  const per = {};
  let competitors = [];
  for (const tok of tokens) {
    const body = fetch1(`https://registry.modelcontextprotocol.io/v0/servers?search=${encodeURIComponent(tok)}&limit=100`);
    const rows = body.servers || [];
    const ours = rows.filter(r => (r.server?.name || '').startsWith('io.github.theluckystrike/')).length;
    competitors = competitors.concat(rows.filter(r => !(r.server?.name || '').startsWith('io.github.theluckystrike/')).map(r => r.server?.name).filter(Boolean));
    per[tok] = { rows: rows.length, ours };
    console.error(`${server}/${tok}: rows=${rows.length} ours=${ours}`);
  }
  result[server] = { per, competitorCount: competitors.length, sample: [...new Set(competitors)].slice(0, 3) };
}
console.log(JSON.stringify(result, null, 1));
console.error('ALL_DONE');
EOF
echo "PROBE2_EXIT=$?"
