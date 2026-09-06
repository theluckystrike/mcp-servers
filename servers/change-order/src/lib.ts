/**
 * The change order engine, as a stable public API for other servers in this repo.
 *
 * `src/index.ts` is the MCP server (tools, licensing, tool copy). What is re-exported
 * here is the record types, the status machine, the delta arithmetic, the two payload
 * builders, the running contract value and the store accessors, so a sibling server can
 * read the same `CO-<YYYY>-<NNNN>` series in the same data directory under the same lock
 * without a second copy of the code, and without a second opinion about what a change
 * order is worth.
 *
 * The money and VAT arithmetic is NOT re-exported: it lives in
 * `@theluckystrike/mcp-invoice/lib` and this server keeps no copy of it. Import
 * `computeTotals`, `currencyDecimals`, `formatMoney` and `roundHalfUp` from there, and
 * `today` / `isIsoDate` from `@theluckystrike/mcp-quotes/lib`.
 *
 * Nothing here touches the network or the licence store at import time.
 *
 * Stability: the names below are the contract. `@theluckystrike/mcp-change-order/dist/*.js`
 * deep imports are not.
 */

export type {
  ChangeOrder, ContractValue, DeltaItem, Line, LineKind, ReferenceKind, Status, StatusEvent,
} from "./order.js";
export {
  CLOSED_STATUSES, LINE_KINDS, MAX_LINES, MAX_MINOR, MAX_QUANTITY, MAX_ROWS, MAX_VAT,
  OPEN_STATUSES, REFERENCE_KINDS, STATUSES, TRANSITIONS,
  addedMinor, belowZeroError, changedMinor, contractValue, deltaItems, deltaTotals, inferReferenceKind,
  invoiceItems, isOpen, lineDeltaMinor, major, netDeltaMinor, normaliseCurrency,
  normaliseReference, normaliseText, orderKey, productMinor, quoteItems, quoteReady,
  reachedAt, removedMinor, transitionError, valueIfApproved,
} from "./order.js";

export {
  byReference, dataDir, findOrder, getOrders, lockPath, nextId, nextLineId, resolveOrder, setOrders,
} from "./store.js";
