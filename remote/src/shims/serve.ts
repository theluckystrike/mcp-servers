// Hosted shim for the serve() scaffold used by the twelve 2026-10 wave servers
// (budget, payroll, pomodoro, receipts, stripe-billing, tax-calc, loan-calculator,
// hourly-rate, duplicate-invoice-check, office-suite, supplier-statement-check,
// three-way-match). The stdio scaffold builds an McpServer and connects a
// StdioServerTransport; hosted, there is no stdio transport - the worker calls
// createServer() per request, so serve() here registers the same tools on a fresh
// McpServer and RETURNS it instead of connecting.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function money(n: number): number {
  return Math.round(n * 100) / 100;
}

export function serve(
  name: string,
  version: string,
  tools: Array<{
    name: string;
    desc: string;
    schema?: { properties?: Record<string, { type?: string; description?: string }>; required?: string[] };
    handler: (args: any) => Promise<any> | any;
  }>,
): McpServer {
  const server = new McpServer({ name, version });
  for (const t of tools) {
    const zod: Record<string, any> = {};
    const props = t.schema?.properties ?? {};
    const req = new Set(t.schema?.required ?? []);
    for (const [k, v] of Object.entries(props)) {
      let s: any;
      if (v.type === "number") s = z.number();
      else if (v.type === "array") s = z.array(z.any());
      else if (v.type === "object") s = z.object({}).passthrough();
      else s = z.string();
      if (v.description) s = s.describe(v.description);
      zod[k] = req.has(k) ? s : s.optional();
    }
    server.tool(t.name, t.desc, zod, t.handler as any);
  }
  return server;
}
