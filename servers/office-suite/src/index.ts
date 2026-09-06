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
import { VERSION } from "./version.js";

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
  { id: "currency", pkg: "@theluckystrike/mcp-currency", optional: true },
  { id: "docx", pkg: "@theluckystrike/mcp-docx", optional: true },
  { id: "timezone", pkg: "@theluckystrike/mcp-timezone", optional: true },
  { id: "resume", pkg: "@theluckystrike/mcp-resume", optional: true },
  { id: "recurring", pkg: "@theluckystrike/mcp-recurring", optional: true },
  { id: "clauses", pkg: "@theluckystrike/mcp-clauses", optional: true },
  { id: "pdf", pkg: "@theluckystrike/mcp-pdf", optional: true },
  { id: "calendar", pkg: "@theluckystrike/mcp-calendar", optional: true },
  { id: "kanban", pkg: "@theluckystrike/mcp-kanban", optional: true },
  { id: "image", pkg: "@theluckystrike/mcp-image", optional: true },
  { id: "bank-statement", pkg: "@theluckystrike/mcp-bank-statement", optional: true },
  { id: "quotes", pkg: "@theluckystrike/mcp-quotes", optional: true },
  { id: "barcode", pkg: "@theluckystrike/mcp-barcode", optional: true },
  { id: "zip", pkg: "@theluckystrike/mcp-zip", optional: true },
  { id: "billing-docs", pkg: "@theluckystrike/mcp-billing-docs", optional: true },
  { id: "deposits", pkg: "@theluckystrike/mcp-deposits", optional: true },
  { id: "per-diem", pkg: "@theluckystrike/mcp-per-diem", optional: true },
  { id: "asset-register", pkg: "@theluckystrike/mcp-asset-register", optional: true },
  { id: "statement-of-account", pkg: "@theluckystrike/mcp-statement-of-account", optional: true },
  { id: "cash-book", pkg: "@theluckystrike/mcp-cash-book", optional: true },
  { id: "amortization", pkg: "@theluckystrike/mcp-amortization", optional: true },
  { id: "petty-cash", pkg: "@theluckystrike/mcp-petty-cash", optional: true },
  { id: "work-order", pkg: "@theluckystrike/mcp-work-order", optional: true },
  { id: "catalogue", pkg: "@theluckystrike/mcp-catalogue", optional: true },
  { id: "change-order", pkg: "@theluckystrike/mcp-change-order", optional: true },
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

/**
 * A child's stderr is a pipe with a finite OS buffer. Nothing read it, so a child that
 * logged more than the buffer before answering blocked in write() and the tools/call in
 * flight never returned. Drain it into our own stderr, one prefixed line per child.
 */
function drainStderr(child: { def: ChildDef; transport: StdioClientTransport }): void {
  const stream = child.transport.stderr;
  if (!stream) return;
  let buf = "";
  stream.on("data", (chunk: Buffer | string) => {
    buf += chunk.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      process.stderr.write(`[${child.def.id}] ${line}\n`);
    }
    if (buf.length > 8192) { process.stderr.write(`[${child.def.id}] ${buf}\n`); buf = ""; }
  });
  stream.on("error", () => { /* the child is gone; onclose handles it */ });
}

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
  drainStderr(child);
  await loadChildCapabilities(child);
  wireCrashHandling(child);
  return child;
}

/** One restart on an unexpected close. A second close is reported, not retried again. */
function wireCrashHandling(child: Child): void {
  // The SDK Client installs its own transport.onclose, and that is what rejects every
  // in-flight request when the child dies. Overwriting it left a proxied tools/call
  // pending until the caller's timeout, and a retry could repeat a completed mutation.
  const previous = child.transport.onclose;
  child.transport.onclose = () => {
    try { previous?.call(child.transport); } catch { /* the client's own teardown */ }
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
  drainStderr(child);
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

/* ------------------------------------------------- renamed-tool text rewrite */

/**
 * D-R29: when two children register the same tool name the bundle exposes prefixed names
 * (business_set -> invoice_business_set / docx_business_set), but the child's own prose
 * still says "Run business_set ...", naming a tool that does not exist on the bundle.
 * Rewrite whole-word occurrences of the child's tool names in the text it returns, per
 * child, so every name a user reads is a name they can call.
 */
function renameMapFor(child: Child): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of child.tools) if (t.name !== t.childName) m.set(t.childName, t.name);
  return m;
}

function rewriteToolNames(text: string, renames: Map<string, string>): string {
  if (!renames.size) return text;
  let out = text;
  for (const [from, to] of renames) {
    // Whole word only: business_set must not match invoice_business_set, and a name
    // already rewritten in an earlier pass must not be rewritten again.
    out = out.replace(new RegExp(`(?<![A-Za-z0-9_])${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_])`, "g"), to);
  }
  return out;
}

function rewriteContent(content: unknown, renames: Map<string, string>): unknown {
  if (!renames.size || !Array.isArray(content)) return content;
  return content.map((c: any) =>
    c && c.type === "text" && typeof c.text === "string" ? { ...c, text: rewriteToolNames(c.text, renames) } : c,
  );
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
  // Partial activation is a failure: one child on Pro and one still free is exactly the
  // state a user cannot see and will not report. Every connected child must accept the key.
  const rows: { server: string; accepted: boolean; detail: string }[] = [];
  for (const child of children) {
    try {
      const r = await child.client.callTool({ name: "license_activate", arguments: { key } });
      const text = Array.isArray(r.content) ? r.content.map((c: any) => c.text ?? "").join("\n") : "";
      rows.push({ server: child.def.id, accepted: r.isError !== true, detail: text.trim() });
    } catch (e) {
      rows.push({ server: child.def.id, accepted: false, detail: `Error: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
  const failed = rows.filter(r => !r.accepted);
  const table = rows.map(r => `${r.accepted ? "OK     " : "FAILED "} ${r.server}: ${r.detail}`).join("\n");
  const head = failed.length === 0
    ? `Activated on all ${rows.length} servers in the bundle.`
    : `Error: ${failed.length} of ${rows.length} servers did not accept the key (${failed.map(r => r.server).join(", ")}). The bundle is only Pro where the table says OK; fix the key or the failing server and run license_activate again.`;
  return { content: [{ type: "text", text: `${head}\n\n${table}` }], isError: failed.length > 0 };
}

/* ---------------------------------------------------------------- server */

const server = new Server(
  { name: "office-suite", version: VERSION },
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
    return { content: rewriteContent(r.content, renameMapFor(child)), isError: r.isError === true };
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
  }
});

/**
 * D-R29: one place that says which bundle tool is which child tool, so a client that sees
 * invoice_business_set can find out it is invoice's own business_set without guessing.
 */
const TOOLS_MAP_URI = "office://tools_map";

function toolsMapText(): string {
  const rows = [...toolIndex.values()]
    .map(t => ({ exposed: t.name, child: `${t.childId}.${t.childName}`, renamed: t.name !== t.childName }))
    .sort((a, b) => a.exposed.localeCompare(b.exposed));
  return JSON.stringify({
    bundle: "office-suite",
    servers: children.map(c => c.def.id),
    renamed: rows.filter(r => r.renamed).map(r => ({ exposed: r.exposed, child: r.child })),
    tools: rows.map(r => ({ exposed: r.exposed, child: r.child })),
    note: "Two children registering the same tool name are both prefixed with their server id. Call the exposed name; the child column is the tool the call is forwarded to.",
  }, null, 2);
}

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources: unknown[] = [{
    uri: TOOLS_MAP_URI,
    name: "tools_map",
    title: "Bundle tool map",
    description: "Every tool this bundle exposes, mapped to the child server and child tool name it forwards to, including the tools renamed because two children shared a name.",
    mimeType: "application/json",
  }];
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
  if (uri === TOOLS_MAP_URI) {
    return { contents: [{ uri, mimeType: "application/json", text: toolsMapText() }] };
  }
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
  const renamed = [...toolIndex.values()].filter(t => t.name !== t.childName);
  process.stderr.write(
    `mcp-office-suite ready, proxying [${children.map(c => c.def.id).join(", ")}], ${toolIndex.size} tools\n`,
  );
  if (renamed.length) {
    process.stderr.write(
      `office-suite: renamed ${renamed.length} colliding tools: ${renamed.map(t => `${t.childId}.${t.childName} -> ${t.name}`).join(", ")}` +
      ` (see the ${TOOLS_MAP_URI} resource; child responses are rewritten to use the exposed names)\n`,
    );
  }
}

main().catch(e => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
