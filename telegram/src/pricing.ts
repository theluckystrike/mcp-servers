// Telegram Stars pricing for the fleet's digital-goods invoices.
//
// Currency tag is XTR. `amount` is an integer count of Stars (1 XTR = 1 Star).
// Per Telegram's "Bot Payments API for Digital Goods and Services" guide
// (core.telegram.org/bots/payments-stars): set `currency: "XTR"`, leave
// provider_token empty, and use createInvoiceLink to get a reusable link.
//
// Conversion basis: ~1 Star is worth about $0.013 USD to the buyer (Telegram's
// own pricing table shows the developer netting about that per Star). The guide
// tells developers to round up to absorb the app-store fee and the one-time
// Star purchase cost, so we price to clean integer Star bundles that clear the
// estate's $19 single / $39 bundle price point:
//
//   single $19 -> 1500 Stars (19.00 / 0.013 = 1462, rounded up to a clean 1500)
//   bundle $39 -> 3000 Stars (39.00 / 0.013 = 3000, exactly)
//
// Invoices for digital goods must use currency XTR and an empty provider_token.

export const STAR_USD = 0.013;

export interface PricePlan {
  key: "single" | "bundle";
  title: string;
  description: string;
  usd: number;
  stars: number;
  /** Stable payload string recorded on the invoice and matched on success. */
  payload: string;
}

export const PRICES: PricePlan[] = [
  {
    key: "single",
    title: "One server, lifetime",
    description: "Unlock a single MCP server of your choice, lifetime license.",
    usd: 19,
    stars: 1500,
    payload: "mcp-single-1500",
  },
  {
    key: "bundle",
    title: "All servers, lifetime",
    description: "Unlock the full fleet, every hosted server, lifetime license.",
    usd: 39,
    stars: 3000,
    payload: "mcp-bundle-3000",
  },
];

export const planForPayload = (payload: string): PricePlan | undefined =>
  PRICES.find((p) => p.payload === payload);

/** USD-equivalent of an invoice amount in Stars, for logging and docs. */
export const starsUsd = (stars: number): string =>
  `$${((stars * STAR_USD) / 1).toFixed(2)}`;

/**
 * Which product a paid invoice payload unlocks: "*" (bundle, every server) or
 * the single server name. Single payloads carry the chosen server so a one-server
 * key never silently unlocks the fleet. Unknown payloads return undefined.
 */
export function productForPayload(payload: string): string | undefined {
  if (payload === "mcp-bundle-3000") return "*";
  const m = /^mcp-single-([a-z0-9][a-z0-9-]*)$/.exec(payload);
  return m ? m[1] : undefined;
}

/** Provider-token-free XTR invoice parameters (pure; asserted by offline-test). */
export interface InvoiceParams {
  title: string;
  description: string;
  payload: string;
  provider_token: "";
  currency: "XTR";
  prices: { label: string; amount: number }[];
}

/** Build invoice parameters for a plan; `server` names the product for single buys. */
export function invoiceParams(plan: PricePlan, server?: string): InvoiceParams {
  if (plan.key === "bundle") {
    return {
      title: "All servers, lifetime",
      description: plan.description,
      payload: plan.payload,
      provider_token: "",
      currency: "XTR",
      prices: [{ label: plan.title, amount: plan.stars }],
    };
  }
  const name = server && /^[a-z0-9][a-z0-9-]*$/.test(server) ? server : "your-choice";
  return {
    title: `${name}, lifetime`,
    description: `Unlock the ${name} MCP server, lifetime license.`,
    payload: `mcp-single-${name}`,
    provider_token: "",
    currency: "XTR",
    prices: [{ label: plan.title, amount: plan.stars }],
  };
}
