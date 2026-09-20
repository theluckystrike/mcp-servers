// S50-B: honest first-five rounds driver. Spawns a server's dist/index.js over stdio,
// runs the given scenarios' tool calls for real, prints results as JSON to stdout.
// Usage: node scripts/demo/run-round.mjs <server-dir> <plan.json>
// plan.json: [{ id, prompt, calls: [[tool, args], ...] }, ...]
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [, , serverDir, planPath] = process.argv;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const plan = JSON.parse(readFileSync(planPath, "utf8"));

const child = spawn("node", [join(ROOT, "servers", serverDir, "dist", "index.js")], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env, XDG_DATA_HOME: process.env.ROUND_DATA_HOME || process.env.XDG_DATA_HOME },
});
let buf = "";
const pending = new Map();
let nextId = 1;
child.stdout.on("data", (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    try { const m = JSON.parse(line); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } } catch {}
  }
});
function rpc(method, params) {
  const id = nextId++;
  return new Promise((res, rej) => {
    pending.set(id, res);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error(`timeout ${method}`)); } }, 10000);
  });
}
const tool = (name, args) => rpc("tools/call", { name, arguments: args }).then((m) => {
  const c = m.result?.content?.[0];
  return c?.type === "text" ? c.text : JSON.stringify(m.result?.content ?? m.result ?? m);
});

await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "run-round", version: "0" } });
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

const out = [];
let captured = {};
const subst = (v) => typeof v === "string" && captured[v] !== undefined ? captured[v] : v;
for (const sc of plan) {
  const results = [];
  for (const [name, rawArgs, cap] of sc.calls) {
    const args = JSON.parse(JSON.stringify(rawArgs, (k, v) => subst(v)));
    const txt = await tool(name, args);
    try { const j = JSON.parse(txt); const id = j?.id ?? j?.created?.id ?? j?.started?.id; if (id) captured[cap || "$" + name.split("_")[1]] = id; } catch {}
    results.push({ tool: name, args, out: txt });
  }
  out.push({ id: sc.id, prompt: sc.prompt, results });
}
console.log(JSON.stringify(out, null, 1));
child.kill();
