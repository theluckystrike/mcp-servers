import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJsonFile } from "@theluckystrike/mcp-timezone/lib";
import { normaliseReference, type Deliverable, type Schedule } from "./schedule.js";

/**
 * Delivery schedules live in this server's OWN data directory,
 * `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/delivery-schedule/`, in `schedules.json`
 * and `counter.json`. Nothing else is written anywhere.
 *
 * NO SIBLING STORE IS READ. The quote, work order or change order a schedule delivers is
 * named by its id, and its date is stated here on the schedule. This server does not open
 * the quotes, work-order or change-order store to find it: each of those `dataDir()`
 * functions CREATES its directory as a side effect of a read, and a schedule that refused
 * to exist until its reference could be found on this machine would refuse every job that
 * was quoted on another one. `milestone_payload` returns `invoice_create` and
 * `quote_create` arguments; it creates neither document.
 *
 * NO STATUS AND NO TOTAL IS STORED. A deliverable holds its due date, its value and its
 * dated status history; the current status, the delivered date, the lateness and every
 * total are derived on every call. A stored status is a second copy of what the history
 * already decides, and the copy is the one that gets believed after somebody corrects a
 * date.
 *
 * Reads go through the timezone engine's `readJsonFile`, so a store that is not JSON is
 * quarantined byte-for-byte as `<file>.corrupt-<timestamp>` with a `.corrupt` marker
 * beside it, and every later call fails loudly instead of reading a file that is still on
 * disk as "no schedules" and reporting a job with nothing late on it.
 */

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "delivery-schedule");
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

export function getSchedules(): Schedule[] { return read<Schedule[]>("schedules.json", []); }
export function setSchedules(v: Schedule[]): void { write("schedules.json", v); }

/**
 * Allocate the next id in the `DS-<YYYY>-<NNNN>` series.
 *
 * The counter is per year and is written BEFORE the record is stored, so a crash burns a
 * number rather than reusing one. Ids already in the store are also scanned, so a restored
 * or hand-edited store cannot reissue a number that is already on a schedule a client has.
 */
export function nextId(year: string, existing: string[]): string {
  const counters = read<Record<string, number>>("counter.json", {});
  const key = `DS-${year}`;
  let n = counters[key] ?? 0;
  const used = new Set(existing);
  do { n += 1; } while (used.has(`${key}-${String(n).padStart(4, "0")}`));
  counters[key] = n;
  write("counter.json", counters);
  return `${key}-${String(n).padStart(4, "0")}`;
}

/**
 * Allocate the next deliverable id within one schedule, and move that schedule's counter.
 *
 * D-DS1: the number comes from the counter, never from `deliverables.length`. With the
 * length, deleting D04 made the next deliverable D04 again, so a document or an email
 * naming D04 quietly pointed at a different piece of work. The counter only goes up, so a
 * gap in the D series is the record that one was removed. Ids already present are scanned
 * too, so a hand-edited or restored schedule cannot reissue one either.
 *
 * The caller holds the lock and writes the schedule, so the moved counter is saved with
 * the deliverable it was moved for.
 */
export function nextDeliverableId(s: Schedule): string {
  const used = new Set(s.deliverables.map((d) => d.id));
  const highest = s.deliverables.reduce((m, d) => {
    const n = Number(/^D(\d+)$/.exec(d.id)?.[1] ?? 0);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  let n = Math.max(s.deliverable_counter ?? 0, highest);
  let id: string;
  do { n += 1; id = `D${String(n).padStart(2, "0")}`; } while (used.has(id));
  s.deliverable_counter = n;
  return id;
}

/** The schedule against one reference, or undefined. One reference carries one schedule. */
export function byReference(list: Schedule[], reference: string): Schedule | undefined {
  const ref = normaliseReference(reference);
  return list.find((s) => s.reference === ref);
}

/**
 * Resolve a schedule by exact id, then by the reference it delivers, then by exact title,
 * then -- only if nothing exact matched -- by partial title. More than one partial
 * candidate is refused with the list rather than silently picking the first, so a
 * deliverable cannot be booked onto the wrong job.
 */
export function findSchedule(list: Schedule[], ref: string): Schedule | undefined {
  const needle = String(ref).trim().toLowerCase();
  const byId = list.find((s) => s.id.toLowerCase() === needle);
  if (byId) return byId;
  const ofRef = byReference(list, ref);
  if (ofRef) return ofRef;
  const exact = list.filter((s) => s.title.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  const pool = exact.length ? exact : list.filter((s) => s.title.toLowerCase().includes(needle));
  if (pool.length > 1) {
    throw new Error(`"${ref}" matches more than one schedule: ${pool.map((s) => `${s.id} (${s.title}, ${s.reference})`).join(", ")}. Pass the exact id.`);
  }
  return pool[0];
}

export function resolveSchedule(list: Schedule[], ref: string): Schedule {
  if (!list.length) throw new Error("there is no delivery schedule yet. Run delivery_schedule_create with the quote, work order or change order it delivers, its date, the client and a title.");
  const s = findSchedule(list, ref);
  if (!s) throw new Error(`no delivery schedule matches "${ref}". Ids look like DS-2026-0001, and a schedule also answers to the reference it delivers. Run delivery_schedule_list to see them.`);
  return s;
}

/** Resolve a deliverable by exact id, then by exact description, then by partial. */
export function resolveDeliverable(s: Schedule, ref: string): Deliverable {
  if (!s.deliverables.length) throw new Error(`${s.id} has no deliverables yet. Add one with deliverable_add: a description, a due date, and its value in minor units if it is separately priced.`);
  const needle = String(ref).trim().toLowerCase();
  const byId = s.deliverables.find((d) => d.id.toLowerCase() === needle);
  if (byId) return byId;
  const exact = s.deliverables.filter((d) => d.description.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  const pool = exact.length ? exact : s.deliverables.filter((d) => d.description.toLowerCase().includes(needle));
  if (pool.length > 1) {
    throw new Error(`"${ref}" matches more than one deliverable on ${s.id}: ${pool.map((d) => `${d.id} (${d.description}, due ${d.due_date})`).join(", ")}. Pass the exact id.`);
  }
  if (!pool.length) throw new Error(`no deliverable on ${s.id} matches "${ref}". Ids look like D01. Run delivery_schedule_get to see them.`);
  return pool[0];
}
