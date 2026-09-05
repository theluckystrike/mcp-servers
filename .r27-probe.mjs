import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const env = { ...process.env,
  XDG_DATA_HOME: "/private/tmp/uv-r27/xdg/data", XDG_CONFIG_HOME: "/private/tmp/uv-r27/xdg/config",
  XDG_CACHE_HOME: "/private/tmp/uv-r27/xdg/cache", XDG_STATE_HOME: "/private/tmp/uv-r27/xdg/state",
  MCP_LICENSE_KEY: "" };
const t = new StdioClientTransport({ command: "node", args: ["/Users/mike/mcp-servers/servers/office-suite/dist/index.js"], env, stderr: "pipe" });
const c = new Client({ name: "probe", version: "1" }, { capabilities: {} });
await c.connect(t);
const calls = JSON.parse(process.argv[2]);
for (const [name, args] of calls) {
  const r = await c.callTool({ name, arguments: args });
  console.log("### " + name);
  console.log(r.content.map(x => x.text).join("\n"));
}
await c.close();
