/**
 * The catalogue engine, as a stable public API for other servers in this repo.
 *
 * `src/index.ts` is the MCP server (tools, licensing, tool copy). What is re-exported
 * here is the record types, the valid-from ladder, the two payload shapes and the store
 * accessors, so a sibling server can read the same price list in the same data directory
 * under the same lock without a second copy of the code, and without a second opinion
 * about which price was in force on a date.
 *
 * The money and VAT arithmetic is NOT re-exported: it lives in
 * `@theluckystrike/mcp-invoice/lib` and this server keeps no copy of it. Import
 * `computeTotals`, `currencyDecimals`, `formatMoney` and `roundHalfUp` from there, the A4
 * renderer `renderDocPdf` from `@theluckystrike/mcp-billing-docs/lib`, and `today` /
 * `isIsoDate` from `@theluckystrike/mcp-quotes/lib`.
 *
 * Nothing here touches the network or the licence store at import time.
 *
 * Stability: the names below are the contract. `@theluckystrike/mcp-catalogue/dist/*.js`
 * deep imports are not.
 */

export type { PriceRow, RateCard, RateRow, ResolvedKind, ResolvedLine, Sku, UsageRow } from "./catalogue.js";
export {
  DEFAULT_TIER, MAX_HOURS, MAX_LINES, MAX_MINOR, MAX_PRICE_ROWS, MAX_QUANTITY, MAX_RATE_ROWS,
  MAX_ROWS, MAX_VAT, ROLE_PATTERN, SKU_PATTERN,
  invoiceItems, lineValueMinor, major, normaliseCurrency, normaliseRole, normaliseSku,
  normaliseText, normaliseTier, pairsOf, priceAsOf, priceRowKey, productKey, quoteItems,
  rateAsOf, rateRowKey, resolutionTotals, rowKey, sortRows, supersededBy,
} from "./catalogue.js";

export {
  dataDir, findRate, findSku, getRates, getRegister, getSkus, lockPath, nextResolutionId,
  resolveRate, resolveSku, setRates, setRegister, setSkus,
} from "./store.js";
