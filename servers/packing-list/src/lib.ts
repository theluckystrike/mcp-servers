/**
 * The packing engine, as a stable public API for other servers in this repo.
 *
 * `src/index.ts` is the MCP server (tools, licensing, tool copy). What is re-exported here
 * is the record types, the status machine, the weight arithmetic, the shortfall and the
 * store accessors, so a sibling server can read the same `PL-<YYYY>-<NNNN>` series in the
 * same data directory under the same lock without a second copy of the code, and without a
 * second opinion about what a carton weighs.
 *
 * There is deliberately NO money here to re-export. A packing slip carries no prices; the
 * invoice against the same order is a different document and lives in
 * `@theluckystrike/mcp-invoice`. `today()` and `isIsoDate()` come from
 * `@theluckystrike/mcp-quotes/lib` and are not copied.
 *
 * Nothing here touches the network or the licence store at import time.
 *
 * Stability: the names below are the contract. `@theluckystrike/mcp-packing-list/dist/*.js`
 * deep imports are not.
 */

export type {
  Carton, CartonReport, ExpectedLine, PackedLine, PackingList, ReferenceKind,
  ShipmentTotals, ShortfallRow, Status, StatusEvent,
} from "./packing.js";
export {
  CLOSED_STATUSES, DEFAULT_DIVISOR, DIVISORS, MAX_CARTONS, MAX_CM, MAX_GRAMS, MAX_LINES,
  MAX_QUANTITY, MAX_ROWS, OPEN_STATUSES, REFERENCE_KINDS, STATUSES, TRANSITIONS,
  cartonReport, inferReferenceKind, isOpen, kg, linesIn, matchKey, netGrams, normaliseReference,
  normaliseSku, normaliseText, readyToShip, referenceKey, shipmentTotals, shortfall, slipText,
  transitionError, volumeCm3, volumetricGrams,
} from "./packing.js";

export {
  byReference, dataDir, findList, getLists, lockPath, nextId, nextSeq, resolveList, setLists,
} from "./store.js";
