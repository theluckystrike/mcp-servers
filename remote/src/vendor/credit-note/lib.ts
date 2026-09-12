/**
 * The credit note engine, as a stable public API for other servers in this repo.
 *
 * `src/index.ts` is the MCP server (tools, licensing, storage). Everything below it --
 * the model, the line computation, the store and the renderers -- is generic and is
 * re-exported here so a sibling server can read a credit note without a second copy of
 * the rules.
 *
 * Nothing in this module touches the network.
 *
 * Stability: the names below are the contract. `dist/*.js` deep imports are not.
 */
export {
  MAX_LINES, MAX_MINOR, MAX_NAME, MAX_ROWS, MAX_TEXT, REASONS,
  computeLines, findNote, isIsoDate, reasonLabel, taxLinesOf, today, totalsOf,
} from "./note.js";
export type { CreditLine, CreditNote, LineInput, Reason, TaxLine } from "./note.js";
export { currencyDecimals, formatAmount, formatMoney, formatQuantity, formatRate, roundHalfUp } from "./money.js";
export { dataDir, getNotes, lockPath, nextId, setNotes } from "./store.js";
export { CorruptDataError, markerBody, markerPath, readJsonFile } from "./jsonstore.js";
export { escapeHtml, renderHtml, renderMarkdown } from "./render.js";
export { VERSION } from "./version.js";
