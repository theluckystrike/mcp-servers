#!/usr/bin/env node
// Shared scaffold for the luckystrike finance/productivity MCP suite (stdio MCP servers).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export function money(n) { return Math.round(n * 100) / 100; }

export async function serve(name, version, tools) {
  const server = new McpServer({ name, version });
  for (const t of tools) {
    const { z } = await import('zod');
    const zod = {};
    const props = t.schema?.properties ?? {};
    const req = new Set(t.schema?.required ?? []);
    for (const [k, v] of Object.entries(props)) {
      let s;
      if (v.type === 'number') s = z.number();
      else if (v.type === 'array') s = z.array(z.any());
      else if (v.type === 'object') s = z.object({}).passthrough();
      else s = z.string();
      if (v.description) s = s.describe(v.description);
      zod[k] = req.has(k) ? s : s.optional();
    }
    server.tool(t.name, t.desc, zod, t.handler);
  }
  await server.connect(new StdioServerTransport());
}
