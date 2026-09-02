#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, isAbsolute, resolve as pathResolve } from "node:path";
import { randomBytes } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createLicenseGate } from "@theluckystrike/mcp-license";
const PRODUCT = "time-tracker";
const FREE_WINDOW_DAYS = 7;
const FREE_RATED_PROJECTS = 2;
const gate = createLicenseGate({ product: PRODUCT });
function dataDir() {
    const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
    return join(base, "mcp-servers", PRODUCT);
}
function dbPath() { return join(dataDir(), "data.json"); }
const EMPTY = { version: 1, running: null, entries: [], projects: {} };
function load() {
    try {
        const raw = JSON.parse(readFileSync(dbPath(), "utf8"));
        return {
            version: 1,
            running: raw.running ?? null,
            entries: Array.isArray(raw.entries) ? raw.entries : [],
            projects: raw.projects && typeof raw.projects === "object" ? raw.projects : {},
        };
    }
    catch {
        return { ...EMPTY, entries: [], projects: {} };
    }
}
function save(db) {
    const dir = dataDir();
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    const p = dbPath();
    const tmp = `${p}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(db, null, 2));
    renameSync(tmp, p);
}
/* ------------------------------------------------------------- primitives */
function newId() { return randomBytes(4).toString("hex"); }
function iso(d) { return d.toISOString(); }
function parseTime(s, what) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime()))
        throw new Error(`${what} is not a valid date/time: ${s}`);
    return d;
}
/** Local-timezone day key, YYYY-MM-DD. */
function dayKey(isoStr) {
    const d = new Date(isoStr);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** Start of local day N days back, as a Date. */
function localDayStart(daysBack = 0) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysBack);
    return d;
}
function toCents(v) { return Math.round(v * 100); }
function money(cents, currency) {
    const sign = cents < 0 ? "-" : "";
    const a = Math.abs(cents);
    return `${sign}${currency} ${Math.floor(a / 100)}.${String(a % 100).padStart(2, "0")}`;
}
function hours(seconds) { return (seconds / 3600).toFixed(2); }
function hms(seconds) {
    const s = Math.max(0, Math.round(seconds));
    const p = (n) => String(n).padStart(2, "0");
    return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
function amountCents(seconds, rateCents) {
    return Math.round((seconds * rateCents) / 3600);
}
function rateForEntry(db, e) {
    if (typeof e.rateCents === "number")
        return e.rateCents;
    return db.projects[e.project]?.rateCents ?? 0;
}
function currencyFor(db, project) {
    return db.projects[project]?.currency ?? "USD";
}
function table(headers, rows) {
    const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => (r[i] ?? "").length)));
    const line = (cells) => cells.map((c, i) => (c ?? "").padEnd(widths[i])).join("  ").trimEnd();
    return [line(headers), line(widths.map(w => "-".repeat(w))), ...rows.map(line)].join("\n");
}
function csvCell(v) {
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
const ok = (text) => ({ content: [{ type: "text", text }] });
const err = (text) => ({ content: [{ type: "text", text: `Error: ${text}` }], isError: true });
/** Gated feature: not an error, the user must see the upgrade path. */
const gated = (feature) => ok(gate.upgradeText(feature));
function guard(fn) {
    return async (a) => {
        try {
            return await fn(a);
        }
        catch (e) {
            return err(e instanceof Error ? e.message : String(e));
        }
    };
}
function windowFor(from, to, pro) {
    const fromMs = from ? parseTime(from, "from").getTime() : -Infinity;
    const toMs = to ? parseTime(to, "to").getTime() : Infinity;
    if (pro)
        return { fromMs, toMs, clamped: false };
    const floor = localDayStart(FREE_WINDOW_DAYS - 1).getTime();
    return { fromMs: Math.max(fromMs, floor), toMs, clamped: fromMs < floor };
}
function select(db, w, project) {
    return db.entries
        .filter(e => {
        const t = new Date(e.start).getTime();
        if (t < w.fromMs || t > w.toMs)
            return false;
        if (project && e.project.toLowerCase() !== project.toLowerCase())
            return false;
        return true;
    })
        .sort((a, b) => a.start.localeCompare(b.start));
}
const FREE_WINDOW_NOTE = `\n\nNote: the free tier shows the last ${FREE_WINDOW_DAYS} days. ` + gate.upgradeText("full history");
/* ---------------------------------------------------------------- server */
const server = new McpServer({ name: "time-tracker", version: "0.1.0" }, { capabilities: { tools: {}, resources: {}, prompts: {} } });
gate.registerTools(server);
function stopRunning(db, endDate, note) {
    const r = db.running;
    const start = new Date(r.start);
    const seconds = Math.max(0, Math.round((endDate.getTime() - start.getTime()) / 1000));
    const entry = {
        id: newId(), project: r.project, task: r.task, tags: r.tags,
        start: iso(start), end: iso(endDate), seconds, note, billable: true,
        ...(typeof r.rateCents === "number" ? { rateCents: r.rateCents } : {}),
    };
    db.entries.push(entry);
    db.running = null;
    return entry;
}
server.registerTool("timer_start", {
    title: "Start timer",
    description: "Start tracking time on a project. Only one timer runs at a time: starting a new one stops and logs the previous one.",
    inputSchema: {
        project: z.string().min(1).describe("Project or client name, e.g. 'acme-website'"),
        task: z.string().optional().describe("What you are working on right now"),
        tags: z.array(z.string()).optional().describe("Free-form tags, e.g. ['dev','meeting']"),
        rate: z.number().nonnegative().optional().describe("Hourly rate for this timer only; defaults to the project rate"),
    },
}, guard(async ({ project, task, tags, rate }) => {
    const db = load();
    const now = new Date();
    let stopped = null;
    if (db.running)
        stopped = stopRunning(db, now, "auto-stopped by timer_start");
    db.running = {
        id: newId(), project, task, tags: tags ?? [],
        ...(typeof rate === "number" ? { rateCents: toCents(rate) } : {}),
        start: iso(now),
    };
    save(db);
    const lines = [`Started timer for "${project}"${task ? ` - ${task}` : ""} at ${db.running.start}.`];
    if (stopped)
        lines.unshift(`Stopped "${stopped.project}" after ${hms(stopped.seconds)} (entry ${stopped.id}).`);
    return ok(lines.join("\n"));
}));
server.registerTool("timer_stop", {
    title: "Stop timer",
    description: "Stop the running timer and log it as a time entry. Returns the duration and the entry id.",
    inputSchema: { note: z.string().optional().describe("Optional note stored with the entry") },
}, guard(async ({ note }) => {
    const db = load();
    if (!db.running)
        return ok("No timer is running. Start one with timer_start.");
    const e = stopRunning(db, new Date(), note);
    save(db);
    const rc = rateForEntry(db, e);
    const cur = currencyFor(db, e.project);
    const amount = rc > 0 ? `  ${money(amountCents(e.seconds, rc), cur)}` : "";
    return ok(`Stopped "${e.project}"${e.task ? ` - ${e.task}` : ""}. Duration ${hms(e.seconds)} (${hours(e.seconds)} h).${amount}\nEntry id ${e.id}.`);
}));
server.registerTool("timer_status", {
    title: "Timer status",
    description: "Show the running timer, how long it has been running, and today's total so far.",
    inputSchema: {},
}, guard(async () => {
    const db = load();
    const todayStart = localDayStart(0).getTime();
    let todaySec = db.entries.filter(e => new Date(e.start).getTime() >= todayStart).reduce((a, e) => a + e.seconds, 0);
    const lines = [];
    if (db.running) {
        const sec = Math.round((Date.now() - new Date(db.running.start).getTime()) / 1000);
        todaySec += sec;
        lines.push(`Running: "${db.running.project}"${db.running.task ? ` - ${db.running.task}` : ""} for ${hms(sec)} (since ${db.running.start}).`);
    }
    else {
        lines.push("No timer running.");
    }
    lines.push(`Today: ${hms(todaySec)} (${hours(todaySec)} h) across ${db.entries.filter(e => new Date(e.start).getTime() >= todayStart).length} logged entries.`);
    return ok(lines.join("\n"));
}));
server.registerTool("entry_add", {
    title: "Add time entry",
    description: "Log time you already worked. Give start plus either end or minutes.",
    inputSchema: {
        project: z.string().min(1).describe("Project or client name"),
        task: z.string().optional().describe("What the work was"),
        start: z.string().describe("ISO 8601 start time, e.g. 2026-09-02T09:00:00"),
        end: z.string().optional().describe("ISO 8601 end time (or use minutes)"),
        minutes: z.number().positive().optional().describe("Duration in minutes (alternative to end)"),
        note: z.string().optional().describe("Optional note"),
        tags: z.array(z.string()).optional().describe("Optional tags"),
        billable: z.boolean().optional().describe("Default true; set false for non-billable work"),
        rate: z.number().nonnegative().optional().describe("Hourly rate override for this entry"),
    },
}, guard(async (a) => {
    const start = parseTime(a.start, "start");
    let end;
    if (a.end)
        end = parseTime(a.end, "end");
    else if (typeof a.minutes === "number")
        end = new Date(start.getTime() + a.minutes * 60000);
    else
        throw new Error("give either end or minutes");
    const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
    if (seconds <= 0)
        throw new Error("end must be after start");
    const db = load();
    const e = {
        id: newId(), project: a.project, task: a.task, tags: a.tags ?? [],
        start: iso(start), end: iso(end), seconds, note: a.note,
        billable: a.billable !== false,
        ...(typeof a.rate === "number" ? { rateCents: toCents(a.rate) } : {}),
    };
    db.entries.push(e);
    save(db);
    return ok(`Added entry ${e.id}: "${e.project}"${e.task ? ` - ${e.task}` : ""}, ${hms(seconds)} (${hours(seconds)} h), ${e.billable ? "billable" : "non-billable"}.`);
}));
server.registerTool("entry_list", {
    title: "List time entries",
    description: "List logged time entries as a compact table. Free tier shows the last 7 days.",
    inputSchema: {
        from: z.string().optional().describe("ISO date/time lower bound"),
        to: z.string().optional().describe("ISO date/time upper bound"),
        project: z.string().optional().describe("Filter by project name"),
        limit: z.number().int().positive().optional().describe("Maximum rows, newest first (default 50)"),
    },
}, guard(async (a) => {
    const db = load();
    const pro = gate.isPro();
    const w = windowFor(a.from, a.to, pro);
    const all = select(db, w, a.project);
    const limit = a.limit ?? 50;
    const rows = all.slice(-limit).reverse();
    if (rows.length === 0)
        return ok(`No entries found.${!pro && w.clamped ? FREE_WINDOW_NOTE : ""}`);
    const totalSec = rows.reduce((s, e) => s + e.seconds, 0);
    const body = table(["id", "day", "start", "project", "task", "hours", "bill", "tags", "note"], rows.map(e => [
        e.id, dayKey(e.start), new Date(e.start).toTimeString().slice(0, 5),
        e.project, e.task ?? "", hours(e.seconds), e.billable ? "y" : "n",
        e.tags.join(","), e.note ?? "",
    ]));
    const tail = `\n\n${rows.length} entries, ${hours(totalSec)} h total.`;
    return ok(body + tail + (!pro && w.clamped ? FREE_WINDOW_NOTE : ""));
}));
server.registerTool("entry_delete", {
    title: "Delete time entry",
    description: "Delete one time entry by id.",
    inputSchema: { id: z.string().describe("Entry id from entry_list") },
}, guard(async ({ id }) => {
    const db = load();
    const i = db.entries.findIndex(e => e.id === id);
    if (i < 0)
        return err(`no entry with id ${id}`);
    const [e] = db.entries.splice(i, 1);
    save(db);
    return ok(`Deleted entry ${id} ("${e.project}", ${hours(e.seconds)} h).`);
}));
server.registerTool("entry_edit", {
    title: "Edit time entry",
    description: "Change fields of an existing entry. Only the fields you pass are changed.",
    inputSchema: {
        id: z.string().describe("Entry id from entry_list"),
        project: z.string().optional(),
        task: z.string().optional(),
        start: z.string().optional().describe("ISO 8601"),
        end: z.string().optional().describe("ISO 8601"),
        minutes: z.number().positive().optional().describe("New duration in minutes, keeps start"),
        note: z.string().optional(),
        tags: z.array(z.string()).optional(),
        billable: z.boolean().optional(),
        rate: z.number().nonnegative().optional().describe("Hourly rate override for this entry"),
    },
}, guard(async (a) => {
    const db = load();
    const e = db.entries.find(x => x.id === a.id);
    if (!e)
        return err(`no entry with id ${a.id}`);
    if (a.project !== undefined)
        e.project = a.project;
    if (a.task !== undefined)
        e.task = a.task;
    if (a.note !== undefined)
        e.note = a.note;
    if (a.tags !== undefined)
        e.tags = a.tags;
    if (a.billable !== undefined)
        e.billable = a.billable;
    if (a.rate !== undefined)
        e.rateCents = toCents(a.rate);
    if (a.start !== undefined)
        e.start = iso(parseTime(a.start, "start"));
    if (a.end !== undefined)
        e.end = iso(parseTime(a.end, "end"));
    if (a.minutes !== undefined)
        e.end = iso(new Date(new Date(e.start).getTime() + a.minutes * 60000));
    const seconds = Math.round((new Date(e.end).getTime() - new Date(e.start).getTime()) / 1000);
    if (seconds <= 0)
        return err("end must be after start");
    e.seconds = seconds;
    save(db);
    return ok(`Updated entry ${e.id}: "${e.project}"${e.task ? ` - ${e.task}` : ""}, ${hours(e.seconds)} h, ${e.billable ? "billable" : "non-billable"}.`);
}));
server.registerTool("project_set_rate", {
    title: "Set project rate",
    description: "Set the hourly rate used to turn tracked hours into money for a project.",
    inputSchema: {
        project: z.string().min(1).describe("Project or client name"),
        hourly_rate: z.number().nonnegative().describe("Hourly rate, e.g. 85"),
        currency: z.string().optional().describe("Currency code, default USD"),
    },
}, guard(async (a) => {
    const db = load();
    const isNew = !(a.project in db.projects);
    if (isNew && !gate.isPro() && Object.keys(db.projects).length >= FREE_RATED_PROJECTS) {
        return gated(`more than ${FREE_RATED_PROJECTS} projects with rates`);
    }
    db.projects[a.project] = { rateCents: toCents(a.hourly_rate), currency: (a.currency ?? "USD").toUpperCase() };
    save(db);
    const m = db.projects[a.project];
    return ok(`Rate for "${a.project}" set to ${money(m.rateCents, m.currency)} per hour.`);
}));
const GROUPS = ["project", "day", "task", "tag"];
function groupsOf(e, by) {
    if (by === "project")
        return [e.project];
    if (by === "day")
        return [dayKey(e.start)];
    if (by === "task")
        return [e.task && e.task.trim() ? e.task : "(no task)"];
    return e.tags.length ? e.tags : ["(no tag)"];
}
function aggregate(db, entries, by) {
    const m = new Map();
    for (const e of entries) {
        const rc = rateForEntry(db, e);
        const cur = currencyFor(db, e.project);
        for (const k of groupsOf(e, by)) {
            const b = m.get(k) ?? { key: k, seconds: 0, billableSeconds: 0, cents: 0, currency: cur };
            b.seconds += e.seconds;
            if (e.billable) {
                b.billableSeconds += e.seconds;
                b.cents += amountCents(e.seconds, rc);
            }
            m.set(k, b);
        }
    }
    return [...m.values()].sort((a, b) => b.seconds - a.seconds);
}
server.registerTool("report", {
    title: "Time report",
    description: "Total tracked hours and money for a period, grouped by project, day, task or tag. Free tier covers the last 7 days.",
    inputSchema: {
        from: z.string().describe("ISO date/time start of the period"),
        to: z.string().describe("ISO date/time end of the period"),
        group_by: z.enum(GROUPS).describe("project | day | task | tag (tag is Pro)"),
        format: z.enum(["table", "json", "csv"]).optional().describe("table (default), json or csv"),
        project: z.string().optional().describe("Optional project filter"),
    },
}, guard(async (a) => {
    const pro = gate.isPro();
    if (a.group_by === "tag" && !pro)
        return gated("group_by tag");
    const db = load();
    const w = windowFor(a.from, a.to, pro);
    const entries = select(db, w, a.project);
    const buckets = aggregate(db, entries, a.group_by);
    const totalSec = buckets.reduce((s, b) => s + b.seconds, 0);
    const totalCents = buckets.reduce((s, b) => s + b.cents, 0);
    const currency = buckets[0]?.currency ?? "USD";
    const fmt = a.format ?? "table";
    const note = !pro && w.clamped ? FREE_WINDOW_NOTE : "";
    if (fmt === "json") {
        return ok(JSON.stringify({
            from: Number.isFinite(w.fromMs) ? iso(new Date(w.fromMs)) : null,
            to: Number.isFinite(w.toMs) ? iso(new Date(w.toMs)) : null,
            group_by: a.group_by,
            rows: buckets.map(b => ({
                key: b.key, hours: Number(hours(b.seconds)), seconds: b.seconds,
                billable_hours: Number(hours(b.billableSeconds)), amount_cents: b.cents, currency: b.currency,
            })),
            total: { hours: Number(hours(totalSec)), seconds: totalSec, amount_cents: totalCents, currency },
            tier: pro ? "pro" : "free",
        }, null, 2) + note);
    }
    if (fmt === "csv") {
        const lines = [["key", "hours", "billable_hours", "amount", "currency"].join(",")];
        for (const b of buckets)
            lines.push([b.key, hours(b.seconds), hours(b.billableSeconds), (b.cents / 100).toFixed(2), b.currency].map(csvCell).join(","));
        lines.push(["TOTAL", hours(totalSec), "", (totalCents / 100).toFixed(2), currency].map(csvCell).join(","));
        return ok(lines.join("\n") + note);
    }
    if (buckets.length === 0)
        return ok(`No time tracked in that period.${note}`);
    const body = table([a.group_by, "hours", "billable h", "amount"], buckets.map(b => [b.key, hours(b.seconds), hours(b.billableSeconds), b.cents > 0 ? money(b.cents, b.currency) : "-"]));
    return ok(`${body}\n\nTotal ${hours(totalSec)} h, ${money(totalCents, currency)}.${note}`);
}));
server.registerTool("export_csv", {
    title: "Export entries to CSV",
    description: "Write time entries to a CSV file you can hand to a bookkeeper or import into a spreadsheet. Free tier exports the last 7 days.",
    inputSchema: {
        from: z.string().optional().describe("ISO date/time lower bound"),
        to: z.string().optional().describe("ISO date/time upper bound"),
        project: z.string().optional().describe("Optional project filter"),
        path: z.string().optional().describe("Target file path; defaults to a file in the local data directory"),
    },
}, guard(async (a) => {
    const pro = gate.isPro();
    const db = load();
    const w = windowFor(a.from, a.to, pro);
    const entries = select(db, w, a.project);
    const header = ["id", "project", "task", "start", "end", "hours", "seconds", "billable", "rate", "currency", "amount", "tags", "note"];
    const lines = [header.join(",")];
    for (const e of entries) {
        const rc = rateForEntry(db, e);
        const cur = currencyFor(db, e.project);
        lines.push([
            e.id, e.project, e.task ?? "", e.start, e.end, hours(e.seconds), String(e.seconds),
            e.billable ? "true" : "false", (rc / 100).toFixed(2), cur,
            e.billable ? (amountCents(e.seconds, rc) / 100).toFixed(2) : "0.00",
            e.tags.join(" "), e.note ?? "",
        ].map(csvCell).join(","));
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const target = a.path
        ? (isAbsolute(a.path) ? a.path : pathResolve(process.cwd(), a.path))
        : join(dataDir(), `time-entries-${stamp}.csv`);
    const dir = dirname(target);
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    writeFileSync(tmp, lines.join("\n") + "\n");
    renameSync(tmp, target);
    const note = !pro && w.clamped ? FREE_WINDOW_NOTE : "";
    return ok(`Wrote ${entries.length} entries to ${target}${note}`);
}));
server.registerTool("invoice_summary", {
    title: "Invoice summary",
    description: "Turn tracked time into invoice line items for one project: hours, rate, amount per task, plus the total.",
    inputSchema: {
        project: z.string().min(1).describe("Project or client to invoice"),
        from: z.string().describe("ISO date/time start of the billing period"),
        to: z.string().describe("ISO date/time end of the billing period"),
    },
}, guard(async (a) => {
    if (!gate.isPro())
        return gated("invoice_summary");
    const db = load();
    const w = windowFor(a.from, a.to, true);
    const entries = select(db, w, a.project).filter(e => e.billable);
    if (entries.length === 0)
        return ok(`No billable time for "${a.project}" in that period.`);
    const currency = currencyFor(db, entries[0].project);
    const lines = aggregate(db, entries, "task");
    const totalSec = lines.reduce((s, b) => s + b.seconds, 0);
    const totalCents = lines.reduce((s, b) => s + b.cents, 0);
    const rows = lines.map(b => {
        const rate = b.seconds > 0 ? Math.round((b.cents * 3600) / b.seconds) : 0;
        return [b.key, hours(b.seconds), money(rate, b.currency), money(b.cents, b.currency)];
    });
    const body = table(["description", "hours", "rate", "amount"], rows);
    const days = [...new Set(entries.map(e => dayKey(e.start)))].sort();
    return ok(`Invoice summary - ${a.project}\n` +
        `Period ${dayKey(a.from)} to ${dayKey(a.to)} (${days.length} working days, ${entries.length} entries)\n\n` +
        `${body}\n\nTOTAL ${hours(totalSec)} h  ${money(totalCents, currency)}`);
}));
/* ------------------------------------------------------- resource + prompt */
function daySummary(db, key) {
    const entries = db.entries.filter(e => dayKey(e.start) === key);
    const sec = entries.reduce((s, e) => s + e.seconds, 0);
    if (entries.length === 0)
        return `${key}: nothing tracked.`;
    const byProject = aggregate(db, entries, "project");
    const cents = byProject.reduce((s, b) => s + b.cents, 0);
    const cur = byProject[0]?.currency ?? "USD";
    const detail = byProject.map(b => `  ${b.key}: ${hours(b.seconds)} h${b.cents > 0 ? ` (${money(b.cents, b.currency)})` : ""}`).join("\n");
    return `${key}: ${hours(sec)} h across ${entries.length} entries${cents > 0 ? `, ${money(cents, cur)}` : ""}\n${detail}`;
}
server.registerResource("today", "timetracker://today", {
    title: "Today's tracked time",
    description: "Summary of time tracked today, by project, including any running timer.",
    mimeType: "text/plain",
}, async (uri) => {
    const db = load();
    const key = dayKey(new Date().toISOString());
    let text = daySummary(db, key);
    if (db.running) {
        const sec = Math.round((Date.now() - new Date(db.running.start).getTime()) / 1000);
        text += `\nRunning now: ${db.running.project}${db.running.task ? ` - ${db.running.task}` : ""} for ${hms(sec)}`;
    }
    return { contents: [{ uri: uri.href, mimeType: "text/plain", text }] };
});
server.registerPrompt("daily_standup", {
    title: "Daily standup",
    description: "Write a standup update from the time tracked yesterday and today.",
    argsSchema: { audience: z.string().optional().describe("Who the update is for, e.g. 'client' or 'team'") },
}, ({ audience }) => {
    const db = load();
    const today = dayKey(new Date().toISOString());
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = dayKey(y.toISOString());
    const tasks = db.entries
        .filter(e => dayKey(e.start) === today || dayKey(e.start) === yesterday)
        .map(e => `- ${dayKey(e.start)} ${e.project}: ${e.task ?? "(no task)"} ${hours(e.seconds)} h${e.note ? ` - ${e.note}` : ""}`)
        .join("\n") || "(no entries)";
    const text = `Write a short standup update${audience ? ` for ${audience}` : ""} from my tracked time.\n\n` +
        `YESTERDAY\n${daySummary(db, yesterday)}\n\nTODAY\n${daySummary(db, today)}\n\n` +
        `ENTRIES\n${tasks}\n\n` +
        `Format: "Yesterday:" bullets of what was done, "Today:" what is in progress, ` +
        `"Blockers:" only if a note implies one. Keep it under 120 words, plain language, no filler.`;
    return { messages: [{ role: "user", content: { type: "text", text } }] };
});
/* ------------------------------------------------------------------ boot */
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write(`mcp-time-tracker ready (${gate.isPro() ? "pro" : "free"}), data in ${dataDir()}\n`);
}
main().catch(e => {
    process.stderr.write(`fatal: ${e instanceof Error ? e.stack : String(e)}\n`);
    process.exit(1);
});
