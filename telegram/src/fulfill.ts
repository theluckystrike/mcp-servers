// Fulfillment for XTR (Stars) payments: mint a real MCPL1 license key.
//
// The key format matches billing/src/license.js exactly:
//   body = base64url(JSON.stringify({ v:1, p:<product>, id:<id>, iat:<epoch> }))
//   key  = "MCPL1.<body>.<base64url(Ed25519 sig over body ascii)>"
//
// product is "*" for the bundle (activates every server) or the single server
// name. The buyer activates with license_activate in any hosted server, or
// MCP_LICENSE_KEY in the environment. Keys verify offline; nothing phones home.
//
// The private PEM is read from MCP_LICENSE_PEM (absolute path) or
// ../keys/license-private.pem relative to the telegram/ dir. If it is missing
// the mint fails loudly - we never fabricate a key.

import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { createPrivateKey, sign as cryptoSign } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..");

function loadPem(): string {
  const explicit = process.env.MCP_LICENSE_PEM;
  if (explicit) return readFileSync(explicit, "utf8");
  return readFileSync(join(REPO_ROOT, "keys", "license-private.pem"), "utf8");
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface MintInput {
  product: string; // "*" for bundle, else single server name
  id: string; // deterministic buyer identifier (Telegram user id)
  iat: number; // epoch seconds
}

/** Mint a real MCPL1 key. Throws when the PEM is absent - never fabricates. */
export function mintKey(input: MintInput): string {
  const pem = loadPem();
  const body = b64url(Buffer.from(JSON.stringify({ v: 1, p: input.product, id: input.id, iat: input.iat })));
  const priv = createPrivateKey(pem);
  // Ed25519 in Node: sign(null, data, key) signs the raw message.
  const sig = cryptoSign(null, Buffer.from(body, "ascii"), priv);
  return `MCPL1.${body}.${b64url(sig)}`;
}

/** Append a payment record for reconciliation. Returns the line written. */
export function recordPayment(out: {
  ts: string;
  tgUser: string;
  payload: string;
  stars: number;
  currency: string;
  key?: string;
  mintError?: string;
}): string {
  const dir = join(REPO_ROOT, "ledger");
  mkdirSync(dir, { recursive: true });
  const line = JSON.stringify(out);
  appendFileSync(join(dir, "xtr-payments.jsonl"), line + "\n");
  return line;
}

/** Build the buyer-facing delivery message for a minted key. */
export function deliveryMessage(key: string, product: string): string {
  const target = product === "*" ? "every hosted server" : `the ${product} server`;
  return (
    `Your lifetime license key:\n\n${key}\n\n` +
    `To activate ${target}: in Claude, run license_activate inside the server and paste this key when asked, ` +
    `or set MCP_LICENSE_KEY to it in your environment. Keys verify offline - nothing is sent anywhere after activation.\n\n` +
    `Refunds within 14 days: support@zovo.one.`
  );
}
