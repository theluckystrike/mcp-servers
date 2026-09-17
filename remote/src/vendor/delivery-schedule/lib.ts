/**
 * The delivery schedule engine, as a stable public API for other servers in this repo.
 *
 * `src/index.ts` is the MCP server (tools, licensing, tool copy). What is re-exported
 * here is the record types, the status machine, the lateness arithmetic, the two payload
 * builders and the store accessors, so a sibling server can read the same
 * `DS-<YYYY>-<NNNN>` series in the same data directory under the same lock without a
 * second copy of the code, and without a second opinion about what "late" means.
 *
 * The money and VAT arithmetic is NOT re-exported: it lives in
 * `@theluckystrike/mcp-invoice/lib` and this server keeps no copy of it. Import
 * `computeTotals`, `currencyDecimals`, `formatMoney`, `roundHalfUp`, `addDays` and
 * `daysBetween` from there, and `today` / `isIsoDate` from
 * `@theluckystrike/mcp-quotes/lib`.
 *
 * Nothing here touches the network or the licence store at import time.
 *
 * Stability: the names below are the contract.
 * `@theluckystrike/mcp-delivery-schedule/dist/*.js` deep imports are not.
 */

export type {
  Counts, CurrencyTotal, Deliverable, DeliverableView, LateRow, Lateness, MilestoneItem,
  ReferenceKind, Schedule, Status, StatusEvent,
} from "./schedule.js";
export {
  DONE_STATUSES, FAR_FUTURE, LATENESS, MAX_DELIVERABLES, MAX_MINOR, MAX_ROWS, MAX_VAT,
  OPEN_STATUSES, REFERENCE_KINDS, STATUSES, TRANSITIONS,
  byWorst, countsOf, currentStatus, deliverableKey, inferReferenceKind, invoiceItems,
  isComplete, isLate, isOpenDeliverable, isOpenSchedule, kindLabel, latenessOf, major,
  milestoneItems, milestoneTotals, normaliseCurrency, normaliseReference, normaliseText,
  quoteItems, reachedAt, rowsOf, statusAsOf, statusLabel, totalsByCurrency,
  transitionError, valueOf, viewOf,
} from "./schedule.js";

export {
  byReference, dataDir, findSchedule, getSchedules, lockPath, nextDeliverableId, nextId,
  resolveDeliverable, resolveSchedule, setSchedules,
} from "./store.js";

export { VERSION } from "./version.js";
