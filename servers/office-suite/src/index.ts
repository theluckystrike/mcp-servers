#!/usr/bin/env node
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

/**
 * Children this bundle proxies. Each is a normal @theluckystrike/mcp-<id> stdio
 * server. Inside this monorepo (npm workspaces) the sibling is a source
 * checkout at ../../<id>/dist/index.js; once published, resolving the
 * package's own "main"/"bin" entry via require.resolve works whether this
 * package was installed from npm or linked as a workspace.
 */
interface ChildDef { id: string; pkg: string; optional?: boolean }

const CHILDREN: ChildDef[] = [
  { id: "time-tracker", pkg: "@theluckystrike/mcp-time-tracker" },
  { id: "price-tracker", pkg: "@theluckystrike/mcp-price-tracker" },
  { id: "spreadsheet", pkg: "@theluckystrike/mcp-spreadsheet" },
  { id: "invoice", pkg: "@theluckystrike/mcp-invoice" },
  { id: "expense-tracker", pkg: "@theluckystrike/mcp-expense-tracker", optional: true },
];

/** Resolve the absolute path to a sibling server's dist/index.js. */
function resolveChildEntry(id: string, pkg: string): string | null {
  const monorepo = join(here, "..", "..", id, "dist", "index.js");
  if (existsSync(monorepo)) return monorepo;
  try {
    // Resolve the installed package's own entry point (its package.json "main").
    return require.resolve(pkg);
  } catch {
    return null;
  }
}

interface ProxyTool {
  childId: string;
  name: string; // name as exposed on the bundle (may be prefixed)
  childName: string; // name as known to the child
  definition: { name: string; description?: string; inputSchema?: unknown; [k: string]: unknown };
}

interface Child {
  def: ChildDef;
  entry: string;
  client: Client;
  transport: StdioClientTransport;
  restarted: boolean;
  tools: ProxyTool[];
  hasResources: boolean;
  hasPrompts: boolean;
}

const children: Child[] = [];
const toolIndex = new Map<string, ProxyTool>(); // bundle tool name -> proxy tool
const resourceOwner = new Map<string, Child>(); // resource uri -> owning child
const promptOwner = new Map<string, Child>(); // prompt name -> owning child

function childEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  return env;
}

async function connectChild(def: ChildDef): Promise<Child | null> {
  const entry = resolveChildEntry(def.id, def.pkg);
  if (!entry) {
    if (def.optional) {
      process.stderr.write(`office-suite: optional child ${def.id} not found, skipping\n`);
      return null;
    }
    throw new Error(`could not resolve entry for required child ${def.id} (${def.pkg})`);
  }
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry],
    env: childEnv(),
    stderr: "pipe",
  });
  const client = new Client({ name: `office-suite-proxy-${def.id}`, version: "0.1.0" }, { capabilities: {} });
  await client.connect(transport);
  const child: Child = { def, entry, client, transport, restarted: false, tools: [], hasResources: false, hasPrompts: false };
  await loadChildCapabilities(child);
  wireCrashHandling(child);
  return child;
}

/** One restart on an unexpected close. A second close is reported, not retried again. */
function wireCrashHandling(child: Child): void {
  child.transport.onclose = () => {
    process.stderr.write(`office-suite: child ${child.def.id} connection closed\n`);
    if (!child.restarted) {
      child.restarted = true;
      restartChild(child).catch(e =>
        process.stderr.write(`office-suite: restart of ${child.def.id} failed: ${e instanceof Error ? e.message : String(e)}\n`),
      );
    } else {
      process.stderr.write(`office-suite: child ${child.def.id} closed again; not restarting a second time\n`);
    }
  };
}

async function restartChild(child: Child): Promise<void> {
  process.stderr.write(`office-suite: restarting child ${child.def.id} (one attempt)\n`);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [child.entry],
    env: childEnv(),
    stderr: "pipe",
  });
  const client = new Client({ name: `office-suite-proxy-${child.def.id}`, version: "0.1.0" }, { capabilities: {} });
  await client.connect(transport);
  child.client = client;
  child.transport = transport;
  wireCrashHandling(child);
  process.stderr.write(`office-suite: child ${child.def.id} restarted\n`);
}

/** license_status / license_activate collide by design: every child registers them. */
const LICENSE_TOOLS = new Set(["license_status", "license_activate"]);

async function loadChildCapabilities(child: Child): Promise<void> {
  const { tools } = await child.client.listTools();
  for (const t of tools) {
    if (LICENSE_TOOLS.has(t.name)) continue; // handled by the aggregate versions below
    let exposedName = t.name;
    if (toolIndex.has(exposedName)) {
      // Same tool name from two children: prefix both to disambiguate.
      const existing = toolIndex.get(exposedName)!;
      if (existing.childId !== child.def.id) {
        const prefixedExisting = `${existing.childId}_${existing.childName}`;
        toolIndex.delete(exposedName);
        existing.name = prefixedExisting;
        toolIndex.set(prefixedExisting, existing);
        exposedName = `${child.def.id}_${t.name}`;
      }
    }
    const proxyTool: ProxyTool = { childId: child.def.id, name: exposedName, childName: t.name, definition: t as ProxyTool["definition"] };
    child.tools.push(proxyTool);
    toolIndex.set(exposedName, proxyTool);
  }
  try {
    await child.client.listResources();
    child.hasResources = true;
  } catch { child.hasResources = false; }
  try {
    await child.client.listPrompts();
    child.hasPrompts = true;
  } catch { child.hasPrompts = false; }
}

/* -------------------------------------------------------- aggregate license */

async function aggregateLicenseStatus(): Promise<{ content: { type: "text"; text: string }[] }> {
  const results: Record<string, unknown> = {};
  for (const child of children) {
    try {
      const r = await child.client.callTool({ name: "license_status", arguments: {} });
      const text = Array.isArray(r.content) ? r.content.map((c: any) => c.text ?? "").join("\n") : "";
      try { results[child.def.id] = JSON.parse(text); } catch { results[child.def.id] = text; }
    } catch (e) {
      results[child.def.id] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return { content: [{ type: "text", text: JSON.stringify({ product: "bundle", checkoutUrl: "https://mcp.zovo.one/buy/bundle", children: results }, null, 2) }] };
}

async function forwardLicenseActivate(key: string): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  const lines: string[] = [];
  let anyOk = false;
  for (const child of children) {
    try {
      const r = await child.client.callTool({ name: "license_activate", arguments: { key } });
      const text = Array.isArray(r.content) ? r.content.map((c: any) => c.text ?? "").join("\n") : "";
      if (!r.isError) anyOk = true;
      lines.push(`${child.def.id}: ${text}`);
    } catch (e) {
      lines.push(`${child.def.id}: Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { content: [{ type: "text", text: lines.join("\n") }], isError: !anyOk };
}

/* ---------------------------------------------------------------- server */

const server = new Server(
  { name: "office-suite", version: "0.1.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [
    ...[...toolIndex.values()].map(t => ({ ...t.definition, name: t.name })),
    {
      name: "license_status",
      description: "Show whether each server in the bundle (time-tracker, price-tracker, spreadsheet, invoice, expense-tracker) runs free or Pro, and where to upgrade the whole bundle.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "license_activate",
      description: "Activate a Pro license key for every server in the bundle at once (format MCPL1.xxx.yyy).",
      inputSchema: { type: "object", properties: { key: { type: "string", description: "License key from the checkout confirmation page" } }, required: ["key"] },
    },
  ];
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  if (name === "license_status") return aggregateLicenseStatus();
  if (name === "license_activate") {
    const key = (args as { key?: string } | undefined)?.key;
    if (typeof key !== "string" || !key) return { content: [{ type: "text", text: "Error: key is required" }], isError: true };
    return forwardLicenseActivate(key);
  }
  const tool = toolIndex.get(name);
  if (!tool) return { content: [{ type: "text", text: `Error: unknown tool "${name}"` }], isError: true };
  const child = children.find(c => c.def.id === tool.childId);
  if (!child) return { content: [{ type: "text", text: `Error: owning server for "${name}" is not connected` }], isError: true };
  try {
    const r = await child.client.callTool({ name: tool.childName, arguments: (args ?? {}) as Record<string, unknown> });
    return { content: r.content, isError: r.isError === true };
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources: unknown[] = [];
  for (const child of children) {
    if (!child.hasResources) continue;
    try {
      const { resources: rs } = await child.client.listResources();
      for (const r of rs) { resourceOwner.set(r.uri, child); resources.push(r); }
    } catch { /* skip a child that stopped supporting resources */ }
  }
  return { resources };
});

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: [] }));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const uri = req.params.uri;
  const child = resourceOwner.get(uri);
  if (!child) throw new Error(`unknown resource "${uri}"`);
  return child.client.readResource({ uri });
});

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  const prompts: unknown[] = [];
  for (const child of children) {
    if (!child.hasPrompts) continue;
    try {
      const { prompts: ps } = await child.client.listPrompts();
      for (const p of ps) { promptOwner.set(p.name, child); prompts.push(p); }
    } catch { /* skip */ }
  }
  return { prompts };
});

server.setRequestHandler(GetPromptRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const child = promptOwner.get(name);
  if (!child) throw new Error(`unknown prompt "${name}"`);
  return child.client.getPrompt({ name, arguments: args });
});

/* ------------------------------------------------------------------ boot */

async function main() {
  for (const def of CHILDREN) {
    const child = await connectChild(def);
    if (child) children.push(child);
  }
  if (children.length === 0) throw new Error("no child servers connected");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `mcp-office-suite ready, proxying [${children.map(c => c.def.id).join(", ")}], ${toolIndex.size} tools\n`,
  );
}

main().catch(e => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
