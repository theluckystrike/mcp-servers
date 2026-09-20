import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJsonFile } from "@theluckystrike/mcp-timezone/lib";
import type { Hire, Template } from "./onboarding.js";

/**
 * The onboarding store lives in ONE file, `${HOME}/.mcp-onboarding/store.json`, holding the
 * hires, the role templates and the id counter. Nothing else is written anywhere.
 *
 * NO SIBLING STORE IS READ. A hire is named by its id and nothing more; the work-order,
 * delivery-schedule and packing-list stores are not opened. Each of those servers' `dataDir()`
 * creates its directory as a side effect of a read, and an onboarding tracker that refused to
 * exist until its hire could be found on this machine would refuse every hire raised on another
 * one.
 *
 * Reads go through the timezone engine's `readJsonFile`, so a store that is not JSON is
 * quarantined byte-for-byte as `<file>.corrupt-<timestamp>` with a `.corrupt` marker beside it,
 * and every later call fails loudly instead of reading a file that is still on disk as "no
 * hires" and letting a second hire be added against a name already onboarded.
 */

export interface Store {
  hires: Hire[];
  templates: Template[];
  counter: Record<string, number>;
}

export function dataDir(): string {
  const dir = process.env.MCP_ONBOARDING_HOME
    ? join(process.env.MCP_ONBOARDING_HOME, ".mcp-onboarding")
    : join(homedir(), ".mcp-onboarding");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function storePath(): string { return join(dataDir(), "store.json"); }
export function lockPath(): string { return join(dataDir(), ".lock"); }

const EMPTY: Store = { hires: [], templates: [], counter: {} };

export function readStore(): Store {
  return readJsonFile<Store>(storePath(), EMPTY);
}

/** Atomic: per-process temp name, then rename over the target. */
export function writeStore(v: Store): void {
  const p = storePath();
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(v, null, 2));
  renameSync(tmp, p);
}

/**
 * Allocate the next id in a counter series. The counter is written BEFORE the record is
 * stored, so a crash burns a number rather than reusing one, and the ids already in the store
 * are scanned as well, so a restored or hand-edited store cannot reissue a number that is
 * already on a hire somebody is tracking.
 */
export function nextId(key: string, pad: number, existing: string[]): string {
  const store = readStore();
  let n = store.counter[key] ?? 0;
  const used = new Set(existing);
  do { n += 1; } while (used.has(`${key}-${String(n).padStart(pad, "0")}`));
  store.counter[key] = n;
  writeStore(store);
  return `${key}-${String(n).padStart(pad, "0")}`;
}

/** Allocate the next task id within one template. Task ids never repeat inside one. */
export function nextTaskId(used: string[]): string {
  const taken = new Set(used);
  let n = used.length;
  let id: string;
  do { n += 1; id = `K${String(n).padStart(2, "0")}`; } while (taken.has(id));
  return id;
}

/**
 * Resolve a template by exact id (case-insensitive), then by exact role, then -- only if
 * nothing exact matched -- by partial role. More than one partial candidate is refused with the
 * list rather than silently picking the first, so a hire cannot be onboarded from the wrong
 * template.
 */
export function findTemplate(list: Template[], ref: string): Template | undefined {
  const needle = ref.trim().toLowerCase();
  const byId = list.find((t) => t.id.toLowerCase() === needle);
  if (byId) return byId;
  const exact = list.filter((t) => t.role.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  const pool = exact.length ? exact : list.filter((t) => t.role.toLowerCase().includes(needle));
  if (pool.length > 1) {
    throw new Error(`"${ref}" matches more than one template: ${pool.map((t) => `${t.id} (${t.role})`).join(", ")}. Pass the exact id.`);
  }
  return pool[0];
}

export function resolveTemplate(list: Template[], ref: string): Template {
  if (!list.length) throw new Error("there is no template yet. Run onboarding_template_apply with a role, or add tasks with onboarding_task_add.");
  const t = findTemplate(list, ref);
  if (!t) throw new Error(`no template matches "${ref}". Ids look like T-0001. Run onboarding_hire_list to see the roles in use.`);
  return t;
}

/** Resolve a hire by exact id, then exact name, then partial name. */
export function findHire(list: Hire[], ref: string): Hire | undefined {
  const needle = ref.trim().toLowerCase();
  const byId = list.find((h) => h.id.toLowerCase() === needle);
  if (byId) return byId;
  const exact = list.filter((h) => h.name.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  const pool = exact.length ? exact : list.filter((h) => h.name.toLowerCase().includes(needle));
  if (pool.length > 1) {
    throw new Error(`"${ref}" matches more than one hire: ${pool.map((h) => `${h.id} (${h.name})`).join(", ")}. Pass the exact id.`);
  }
  return pool[0];
}

export function resolveHire(list: Hire[], ref: string): Hire {
  if (!list.length) throw new Error("there is no hire yet. Run onboarding_hire_add first.");
  const h = findHire(list, ref);
  if (!h) throw new Error(`no hire matches "${ref}". Ids look like H-0001. Run onboarding_hire_list to see them.`);
  return h;
}
