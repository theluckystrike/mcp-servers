// usage: node smoke.mjs stdio <calls.json> <outdir> -- <cmd> [args...]
//        node smoke.mjs http  <calls.json> <outdir> <url>
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const [mode, callsFile, outdir, ...rest] = process.argv.slice(2);
const calls = JSON.parse(readFileSync(callsFile, "utf8"));
mkdirSync(outdir, { recursive: true });
const msgs = [
  { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "1" } } },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ...calls.map((c, i) => ({ jsonrpc: "2.0", id: 10 + i, method: "tools/call", params: { name: c.name, arguments: c.arguments } })),
];
const results = {};
function record(m) {
  if (m.id === undefined) return;
  const label = m.id === 1 ? "initialize" : m.id === 2 ? "tools_list" : `call_${calls[m.id - 10].name}`;
  results[label] = m;
  writeFileSync(`${outdir}/${label}.json`, JSON.stringify(m, null, 2));
}
function report() {
  const tools = results.tools_list?.result?.tools?.map((t) => t.name) ?? [];
  console.log("server:", JSON.stringify(results.initialize?.result?.serverInfo), "tools:", tools.length, tools.join(","));
  let ok = 0;
  for (const c of calls) {
    const r = results[`call_${c.name}`];
    const sc = r?.result?.structuredContent;
    const good = r?.result && !r.result.isError && sc && sc.more?.includes("utm_source=mcp") && sc.source && sc.as_of;
    if (good) ok++;
    console.log(good ? "OK  " : "FAIL", c.name, "|", (sc?.summary ?? JSON.stringify(r?.result ?? r?.error)).slice(0, 220));
  }
  console.log(`calls ok ${ok}/${calls.length}`);
  process.exit(ok === calls.length && tools.length > 0 ? 0 : 1);
}
if (mode === "stdio") {
  const cmd = rest.slice(rest.indexOf("--") + 1);
  const p = spawn(cmd[0], cmd.slice(1), { stdio: ["pipe", "pipe", "inherit"] });
  let buf = "";
  const want = new Set([1, 2, ...calls.map((_, i) => 10 + i)]);
  p.stdout.on("data", (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const m = JSON.parse(line); record(m); want.delete(m.id);
      if (want.size === 0) { p.kill(); report(); }
    }
  });
  for (const m of msgs) p.stdin.write(JSON.stringify(m) + "\n");
  setTimeout(() => { p.kill(); report(); }, 120000);
} else {
  const url = rest[0];
  for (const m of msgs) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify(m) });
    const text = await res.text();
    if (m.id !== undefined) {
      try { record(JSON.parse(text)); } catch { results[`raw_${m.id}`] = text; console.log("non-JSON", res.status, text.slice(0, 200)); }
    }
  }
  report();
}
