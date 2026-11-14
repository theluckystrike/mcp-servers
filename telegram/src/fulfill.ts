// Fulfillment for XTR (Stars) payments.
//
// The bot does not mint keys. It forwards the two payment updates (pre_checkout_query and
// the message carrying successful_payment) to the billing worker's POST /telegram/webhook,
// which mints through the same Ed25519 path, KV namespace and ledger as Stripe, idempotent
// on telegram_payment_charge_id (billing/src/telegram-stars.js). The worker answers with a
// Bot API method in webhook-reply form, which the bot executes.
//
// Env:
//   TELEGRAM_WEBHOOK_SECRET  shared secret, sent as X-Telegram-Bot-Api-Secret-Token
//   BILLING_TELEGRAM_URL     default https://mcp.zovo.one/telegram/webhook

import { mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..");
export const DEFAULT_BILLING_URL = "https://mcp.zovo.one/telegram/webhook";

/** Bot API method in webhook-reply form, as returned by the billing worker. */
export interface WorkerReply {
  method?: string;
  ok?: boolean;
  error_message?: string;
  text?: string;
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) =>
  Promise<{ status: number; json: () => Promise<unknown> }>;

export interface ForwardOptions {
  url?: string;
  secret?: string;
  fetchImpl?: FetchLike;
  attempts?: number;
  delayMs?: number;
}

/**
 * POST one Telegram update to the billing worker. Retries 5xx and network errors (the
 * worker is idempotent on the charge id, so a retry never mints twice). Throws when every
 * attempt fails or the secret is missing.
 */
export async function forwardUpdate(update: unknown, opts: ForwardOptions = {}): Promise<WorkerReply> {
  const secret = opts.secret ?? process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) throw new Error("TELEGRAM_WEBHOOK_SECRET not set");
  const url = opts.url ?? process.env.BILLING_TELEGRAM_URL ?? DEFAULT_BILLING_URL;
  const doFetch: FetchLike = opts.fetchImpl ?? ((u, init) => fetch(u, init));
  const attempts = opts.attempts ?? 4;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await doFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
        body: JSON.stringify(update),
      });
      if (res.status < 500) {
        if (res.status !== 200) throw Object.assign(new Error(`billing worker refused update: ${res.status}`), { final: true });
        return (await res.json()) as WorkerReply;
      }
      lastErr = new Error(`billing worker ${res.status}`);
    } catch (err) {
      if ((err as { final?: boolean }).final) throw err;
      lastErr = err;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, (opts.delayMs ?? 1000) * 2 ** i));
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Local record of a payment the worker could not confirm, for manual follow-up. */
export function recordPendingPayment(out: {
  ts: string;
  provider: "telegram-stars";
  telegram_payment_charge_id: string;
  user_id: string;
  payload: string;
  stars: number;
  error: string;
}): string {
  const dir = join(REPO_ROOT, "ledger");
  mkdirSync(dir, { recursive: true });
  const line = JSON.stringify(out);
  appendFileSync(join(dir, "xtr-pending.jsonl"), line + "\n");
  return line;
}
