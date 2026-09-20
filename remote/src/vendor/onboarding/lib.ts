/**
 * The onboarding engine, as a stable public API for other servers in this repo.
 *
 * `src/index.ts` is the MCP server (tools, licensing, tool copy). What is re-exported here
 * is the hire and template types, the task statuses, the progress arithmetic and the
 * store accessors, so a sibling server can read the same `HIRE-<YYYY>-<NNNN>` series in
 * the same data directory under the same lock without a second copy of the code.
 *
 * There is no money here to re-export: onboarding has no amounts. `today()` and
 * `isIsoDate()` come from `@theluckystrike/mcp-quotes/lib` and are not copied.
 *
 * Nothing here touches the network or the licence store at import time.
 *
 * Stability: the names below are the contract. `@theluckystrike/mcp-onboarding/dist/*.js`
 * deep imports are not.
 */

export type { Owner, TaskStatus } from "./onboarding.js";
export {
  MAX_HIRES, MAX_ROWS, MAX_TASKS, MAX_TEMPLATES, MAX_TEXT, OWNERS, TASK_STATUSES,
  dueDate, normaliseText, progress, slugRole,
} from "./onboarding.js";

export {
  dataDir, findHire, findTemplate, lockPath, nextId, nextTaskId, readStore,
  resolveHire, resolveTemplate, storePath, writeStore,
} from "./store.js";
