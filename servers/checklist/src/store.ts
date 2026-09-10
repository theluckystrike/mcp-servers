import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJsonFile } from "@theluckystrike/mcp-timezone/lib";
import { normaliseText, type Run, type Template } from "./checklist.js";

/**
 * Checklists live in this server's OWN data directory,
 * `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/checklist/`, in `templates.json`,
 * `runs.json` and `counter.json`. Nothing else is written anywhere.
 *
 * NO SIBLING STORE IS READ. The job a run is against is named by its id and nothing more;
 * the work-order, delivery-schedule and packing-list stores are not opened. Each of those
 * servers' `dataDir()` creates its directory as a side effect of a read, and a checklist run
 * that refused to exist until its job could be found on this machine would refuse every job
 * raised on another one. The one file this server reads and never writes is the shared
 * business profile, for the name at the top of a printed report.
 *
 * A RUN IS SELF-CONTAINED. Its items are copied out of the template at start, so reading a
 * run never touches `templates.json` and deleting a template does not rewrite what somebody
 * already signed. See src/checklist.ts for why that is the central rule of this server.
 *
 * Reads go through the timezone engine's `readJsonFile`, so a store that is not JSON is
 * quarantined byte-for-byte as `<file>.corrupt-<timestamp>` with a `.corrupt` marker beside
 * it, and every later call fails loudly instead of reading a file that is still on disk as
 * "no checklists" and letting a second run be started against a job already signed off.
 */

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "checklist");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function lockPath(): string { return join(dataDir(), ".lock"); }

function read<T>(file: string, empty: T): T {
  return readJsonFile<T>(join(dataDir(), file), empty);
}

/** Atomic: per-process temp name, then rename over the target. */
function write(file: string, value: unknown): void {
  const p = join(dataDir(), file);
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, p);
}

export function getTemplates(): Template[] { return read<Template[]>("templates.json", []); }
export function setTemplates(v: Template[]): void { write("templates.json", v); }
export function getRuns(): Run[] { return read<Run[]>("runs.json", []); }
export function setRuns(v: Run[]): void { write("runs.json", v); }

/**
 * Allocate the next id in a counter series. The counter is written BEFORE the record is
 * stored, so a crash burns a number rather than reusing one, and the ids already in the
 * store are scanned as well, so a restored or hand-edited store cannot reissue a number that
 * is already on a report somebody signed.
 */
export function nextId(key: string, pad: number, existing: string[]): string {
  const counters = read<Record<string, number>>("counter.json", {});
  let n = counters[key] ?? 0;
  const used = new Set(existing);
  do { n += 1; } while (used.has(`${key}-${String(n).padStart(pad, "0")}`));
  counters[key] = n;
  write("counter.json", counters);
  return `${key}-${String(n).padStart(pad, "0")}`;
}

/** Allocate the next item id within one template. Item ids never repeat inside one. */
export function nextItemId(used: string[]): string {
  const taken = new Set(used);
  let n = used.length;
  let id: string;
  do { n += 1; id = `I${String(n).padStart(2, "0")}`; } while (taken.has(id));
  return id;
}

/**
 * Resolve a template by exact id (case-insensitive), then by exact name, then -- only if
 * nothing exact matched -- by partial name. More than one partial candidate is refused with
 * the list rather than silently picking the first, so a run cannot be started from the wrong
 * checklist.
 */
export function findTemplate(list: Template[], ref: string): Template | undefined {
  const needle = normaliseText(ref).toLowerCase();
  const byId = list.find((t) => t.id.toLowerCase() === needle);
  if (byId) return byId;
  const exact = list.filter((t) => t.name.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  const pool = exact.length ? exact : list.filter((t) => t.name.toLowerCase().includes(needle));
  if (pool.length > 1) {
    throw new Error(`"${ref}" matches more than one checklist: ${pool.map((t) => `${t.id} (${t.name})`).join(", ")}. Pass the exact id.`);
  }
  return pool[0];
}

export function resolveTemplate(list: Template[], ref: string): Template {
  if (!list.length) throw new Error("there is no checklist yet. Run checklist_create with a name, then checklist_item_add for each step.");
  const t = findTemplate(list, ref);
  if (!t) throw new Error(`no checklist matches "${ref}". Ids look like CL-0001. Run checklist_list to see them.`);
  return t;
}

/** The same resolution for a run: exact id, then exact title, then partial title or reference. */
export function findRun(list: Run[], ref: string): Run | undefined {
  const needle = normaliseText(ref).toLowerCase();
  const byId = list.find((r) => r.id.toLowerCase() === needle);
  if (byId) return byId;
  const exact = list.filter((r) => r.title.toLowerCase() === needle || (r.reference ?? "").toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  const pool = exact.length ? exact : list.filter((r) => r.title.toLowerCase().includes(needle) || (r.reference ?? "").toLowerCase().includes(needle));
  if (pool.length > 1) {
    throw new Error(`"${ref}" matches more than one run: ${pool.map((r) => `${r.id} (${r.title}, ${r.status})`).join(", ")}. Pass the exact id.`);
  }
  return pool[0];
}

export function resolveRun(list: Run[], ref: string): Run {
  if (!list.length) throw new Error("there is no checklist run yet. Run run_start with a checklist and a title.");
  const r = findRun(list, ref);
  if (!r) throw new Error(`no run matches "${ref}". Ids look like RUN-2026-0001. Run run_list to see them.`);
  return r;
}
