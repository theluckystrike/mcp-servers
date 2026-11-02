// usage: node stdio_check.mjs <calls.json> -- <command...>  ; writes JSON lines of responses to stdout
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const i = process.argv.indexOf('--');
const calls = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const cmd = process.argv.slice(i + 1);
const p = spawn(cmd[0], cmd.slice(1), { stdio: ['pipe', 'pipe', 'inherit'] });
const msgs = [
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'check', version: '1' } } },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  ...calls.map((c, k) => ({ jsonrpc: '2.0', id: 10 + k, method: 'tools/call', params: c })),
];
const want = new Set(msgs.filter((m) => m.id != null).map((m) => m.id));
let buf = '';
const timer = setTimeout(() => { console.error('timeout'); p.kill(); process.exit(2); }, 120000);
p.stdout.on('data', (d) => {
  buf += d;
  let n;
  while ((n = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, n); buf = buf.slice(n + 1);
    if (!line.trim()) continue;
    const m = JSON.parse(line);
    console.log(JSON.stringify(m));
    want.delete(m.id);
    if (!want.size) { clearTimeout(timer); p.kill(); process.exit(0); }
  }
});
for (const m of msgs) p.stdin.write(JSON.stringify(m) + '\n');
