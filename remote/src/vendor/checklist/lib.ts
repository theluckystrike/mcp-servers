/**
 * The checklist engine, as a stable public API for other servers in this repo.
 *
 * `src/index.ts` is the MCP server (tools, licensing, tool copy). What is re-exported here
 * is the template and run types, the run status machine, the progress arithmetic, the
 * sign-off test and the store accessors, so a sibling server can read the same `CL-NNNN` and
 * `RUN-<YYYY>-<NNNN>` series in the same data directory under the same lock without a second
 * copy of the code, and without a second opinion about whether a run is complete.
 *
 * There is no money here to re-export: a checklist has no amounts. `today()` and
 * `isIsoDate()` come from `@theluckystrike/mcp-quotes/lib` and are not copied.
 *
 * Nothing here touches the network or the licence store at import time.
 *
 * Stability: the names below are the contract. `@theluckystrike/mcp-checklist/dist/*.js`
 * deep imports are not.
 */

export type {
  ItemState, Progress, Run, RunEvent, RunItem, RunStatus, Template, TemplateItem,
} from "./checklist.js";
export {
  CLOSED_RUN_STATUSES, ITEM_STATES, MAX_ITEMS, MAX_ROWS, MAX_SECTION, MAX_TEMPLATES,
  OPEN_RUN_STATUSES, RUN_STATUSES, RUN_TRANSITIONS,
  bySection, isOpenRun, normaliseSection, normaliseText, progress, runReport,
  runTransitionError, signable, slugCategory, templateText,
} from "./checklist.js";

export {
  dataDir, findRun, findTemplate, getRuns, getTemplates, lockPath, nextId, nextItemId,
  resolveRun, resolveTemplate, setRuns, setTemplates,
} from "./store.js";
