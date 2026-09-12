/**
 * The dunning engine, as a stable public API for other servers in this repo.
 *
 * `src/index.ts` is the MCP server (tools, licensing, storage). Everything below it --
 * the ladder, the aging, the late fee, the letters and the register store -- is generic
 * and is re-exported here so a sibling server can read the register without a second copy
 * of the rules.
 *
 * The money formatting is NOT re-exported: it lives in
 * `@theluckystrike/mcp-asset-register/lib`.
 *
 * Nothing in this module touches the network.
 *
 * Stability: the names below are the contract. `dist/*.js` deep imports are not.
 */
export {
  addDays, accruedFeeMinor, BUCKETS, bucketFor, daysBetween, daysLate, DEFAULT_GAPS,
  invoiceKey, isIsoDate, isPaid, MAX_MINOR, MAX_ROWS, nextAction, outstandingMinor, paidMinor,
  stageDates, stagesSent, STAGE_NAMES, STAGES, today,
} from "./engine.js";
export type { ChasedInvoice, LetterSent, NextAction, Payment, Stage, Bucket } from "./engine.js";
export { renderLetter } from "./letters.js";
export type { RenderedLetter, Sender } from "./letters.js";
export { dataDir, getInvoices, lockPath, nextId, resolveInvoice, setInvoices } from "./store.js";
export { VERSION } from "./version.js";
