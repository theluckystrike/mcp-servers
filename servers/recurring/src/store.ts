import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJsonFile } from "@theluckystrike/mcp-invoice/lib";
import type { Every } from "./period.js";

/**
 * Schedules and the generation log live in this server's OWN data directory,
 * `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/recurring/`. The invoices they produce
 * are written into the INVOICE server's directory (.../mcp-servers/invoice/) through
 * the shared engine, so `invoice_list` in that server shows them and they share one
 * number series. Two directories, two locks, always taken in the same order
 * (recurring, then invoice) so two processes can never deadlock.
 *
 * Reads go through the invoice engine's `readJsonFile`, so a corrupt schedules.json is
 * quarantined as `schedules.json.corrupt-<timestamp>` with a `.corrupt` marker and every
 * later call fails loudly instead of being treated as "no schedules".
 */

export interface ScheduleItem {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
}

export interface Schedule {
  id: string;
  client: string;
  items: ScheduleItem[];
  currency?: string;
  every: Every;
  start_date: string;
  end_date?: string;
  anchor_day?: number;
  end_of_month?: boolean;
  due_days?: number;
  notes?: string;
  /** D-R39: why this schedule bills the tax it bills, e.g. "reverse charge, art. 196". Carried onto every generated invoice. */
  tax_note?: string;
  auto_generate: boolean;
  status: "active" | "paused";
  created: string;
  updated: string;
}

export interface HistoryEntry {
  schedule_id: string;
  period: string;            // the occurrence date; the idempotency key with schedule_id
  invoice_number: string;
  issue_date: string;
  due_date: string;
  currency: string;
  total_minor: number;
  pdf_path?: string;
  /** A period the user deliberately skipped: no invoice was ever created for it. */
  skipped?: boolean;
  created: string;
}

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "recurring");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function lockPath(): string { return join(dataDir(), ".lock"); }

function read<T>(file: string, empty: T): T {
  return readJsonFile<T>(join(dataDir(), file), empty);
}

function write(file: string, value: unknown): void {
  const p = join(dataDir(), file);
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, p);
}

export function getSchedules(): Schedule[] { return read<Schedule[]>("schedules.json", []); }
export function setSchedules(s: Schedule[]): void { write("schedules.json", s); }

export function getHistory(): HistoryEntry[] { return read<HistoryEntry[]>("history.json", []); }
export function setHistory(h: HistoryEntry[]): void { write("history.json", h); }

/** The generated-periods index: "<schedule_id>|<period>" for every invoice already made. */
export function generatedKeys(history: HistoryEntry[]): Set<string> {
  return new Set(history.map((h) => `${h.schedule_id}|${h.period}`));
}

/**
 * Resolve a schedule by exact id, then by exact client name, then -- only if nothing
 * exact matched -- by partial client name. An exact id or client match always wins
 * outright, with no ambiguity check: it is a precise reference. The partial-name
 * fallback is not: "Acme Inc" is also a substring match for "Acme Inc (Consulting)", so
 * more than one candidate there is refused with the candidate list instead of silently
 * picking whichever is first in storage order (Review V5 P2), which could otherwise
 * point schedule_pause/schedule_delete/schedule_skip at the wrong client's schedule with
 * no warning.
 */
export function findSchedule(list: Schedule[], ref: string): Schedule | undefined {
  const needle = ref.trim().toLowerCase();
  const byId = list.find((s) => s.id === ref);
  if (byId) return byId;
  const byClient = list.find((s) => s.client.toLowerCase() === needle);
  if (byClient) return byClient;
  const partial = list.filter((s) => s.client.toLowerCase().includes(needle));
  if (partial.length > 1) {
    throw new Error(
      `"${ref}" matches more than one schedule: ${partial.map((s) => `${s.id} (${s.client})`).join(", ")}. ` +
      `Pass the exact id or the exact client name.`,
    );
  }
  return partial[0];
}
