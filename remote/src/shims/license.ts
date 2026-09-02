/**
 * Request-scoped replacement for @theluckystrike/mcp-license. The bearer token is
 * verified once at the edge (worker index.ts), so the gate only reads the decision.
 * withFileLock is a no-op: a single request owns its virtual filesystem, and KV
 * writes are last-write-wins per tenant.
 */
import { z } from "zod";
import { ctx } from "./ctx.js";

export const CHECKOUT_BASE = "https://mcp.zovo.one";
export const PRICE_SINGLE_USD = 19;
export const PRICE_BUNDLE_USD = 39;
export const STALE_MS = 30_000;

export async function withFileLock<T>(_lockPath: string, fn: () => Promise<T> | T): Promise<T> {
  return await fn();
}

export interface LicenseGate {
  product: string;
  isPro(): boolean;
  status(): Record<string, unknown>;
  upgradeText(feature: string): string;
  registerTools(server: { registerTool: Function }): void;
}

export function createLicenseGate(opts: { product: string }): LicenseGate {
  const product = opts.product;
  const upgradeUrl = `${CHECKOUT_BASE}/buy/${product}`;
  const gate: LicenseGate = {
    product,
    isPro: () => ctx().isPro,
    status: () => ({
      product,
      tier: ctx().isPro ? "pro" : "free",
      transport: "remote streamable-http",
      tenant: ctx().tenant,
      source: "Authorization: Bearer",
      upgradeUrl,
    }),
    upgradeText: (feature: string) =>
      `"${feature}" is a Pro feature. Pro is a one-time $${PRICE_SINGLE_USD} (or $${PRICE_BUNDLE_USD} for every server, lifetime). ` +
      `Buy at ${upgradeUrl} , then send the key as "Authorization: Bearer <key>" to this endpoint.`,
    registerTools(server) {
      server.registerTool("license_status",
        { title: "License status", description: "Show whether this endpoint runs in free or Pro mode for your token, and where to upgrade.", inputSchema: {} },
        async () => ({ content: [{ type: "text", text: JSON.stringify(gate.status(), null, 2) }] }));
      server.registerTool("license_activate",
        { title: "Activate license", description: "On the remote endpoint a licence is not stored server-side: send the key in the Authorization header instead.", inputSchema: { key: z.string().describe("License key from checkout") } },
        async () => ({
          content: [{ type: "text", text:
            "On the remote endpoint keys are not stored. Reconnect with the header " +
            "\"Authorization: Bearer MCPL1....\" and this endpoint runs in Pro mode for that key." }],
        }));
    },
  };
  return gate;
}
