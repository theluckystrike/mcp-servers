import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
export function dataDir() {
    const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
    return join(base, "mcp-servers", "price-tracker");
}
export function dbPath() { return join(dataDir(), "watches.json"); }
/**
 * A database file that exists but cannot be read or parsed.
 *
 * Only ENOENT means "no data yet". Any other read failure, or a file whose
 * bytes are not the JSON shape this server wrote, is a fault: returning an
 * empty database there makes the next mutation silently overwrite the whole
 * price history (Codex v3 item 1, P0). The unreadable bytes are moved aside to
 * <file>.corrupt-<timestamp> so nothing is destroyed, the fault is logged to
 * stderr, and every tool - mutating ones included - fails with this error until
 * the process is restarted against a healthy file.
 */
export class StoreError extends Error {
    constructor(message) { super(message); this.name = "StoreError"; }
}
/** Sticky: set on the first unreadable load, cleared only by a restart. */
let fault = null;
/** Test seam: forget a recorded fault. */
export function resetStoreFault() { fault = null; }
function quarantine(p) {
    const dest = `${p}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    try {
        renameSync(p, dest);
        try {
            writeFileSync(`${p}.corrupt`, JSON.stringify({ quarantined: dest, at: new Date().toISOString(), hint: "the original data file failed to parse; it was moved, nothing was overwritten; restore it manually or delete this marker to start fresh" }) + "\n");
        }
        catch { /* marker is best effort */ }
        return dest;
    }
    catch {
        return null;
    }
}
function markerQuarantined(p) {
    try {
        const t = readFileSync(`${p}.corrupt`, "utf8").trim();
        if (!t)
            return `${p}.corrupt-*`;
        try {
            const j = JSON.parse(t);
            return typeof j.quarantined === "string" && j.quarantined ? j.quarantined : t;
        }
        catch {
            return t;
        }
    }
    catch {
        return null;
    }
}
function raise(message) {
    fault = message;
    process.stderr.write(`price-tracker: ${message}\n`);
    throw new StoreError(message);
}
export function load() {
    if (fault)
        throw new StoreError(fault);
    const p = dbPath();
    const q = markerQuarantined(p);
    if (q)
        raise(`the price database was quarantined earlier at ${q}; nothing was written. Restore it manually or delete ${p}.corrupt to start fresh.`);
    let raw;
    try {
        raw = readFileSync(p, "utf8");
    }
    catch (e) {
        const err = e;
        if (err.code === "ENOENT")
            return { version: 1, watches: [] };
        raise(`cannot read the price database at ${p} (${err.code ?? err.message}). Refusing to continue: writing now would replace your saved watches with an empty file. Fix the file permissions, then try again.`);
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (e) {
        const dest = quarantine(p);
        raise(`the price database at ${p} is not valid JSON (${e.message}). The unreadable file was kept as ${dest ?? "(could not be renamed)"} so nothing is lost. No watch can be read or changed until this is resolved; restart the server to start a new database, or repair the saved file and put it back.`);
    }
    const db = parsed;
    if (!db || typeof db !== "object" || !Array.isArray(db.watches)) {
        const dest = quarantine(p);
        raise(`the price database at ${p} is JSON but not a price-tracker database (no "watches" array). The file was kept as ${dest ?? "(could not be renamed)"} so nothing is lost. No watch can be read or changed until this is resolved; restart the server to start a new database, or repair the saved file and put it back.`);
    }
    return { version: 1, watches: db.watches };
}
export function save(db) {
    if (fault)
        throw new StoreError(fault);
    const dir = dataDir();
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    const p = dbPath();
    const tmp = `${p}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(db, null, 2));
    renameSync(tmp, p);
}
export function newId() { return randomBytes(4).toString("hex"); }
export function nowIso() { return new Date().toISOString(); }
/** Canonical form used to match URLs: scheme+host+path+query, no hash, no trailing slash. */
export function canonicalUrl(u) {
    try {
        const url = new URL(u.trim());
        url.hash = "";
        let s = url.toString();
        if (s.endsWith("/") && url.pathname !== "/")
            s = s.slice(0, -1);
        return s;
    }
    catch {
        return u.trim();
    }
}
export function findWatch(db, key) {
    const k = key.trim();
    const byId = db.watches.find((w) => w.id === k);
    if (byId)
        return byId;
    const c = canonicalUrl(k);
    return db.watches.find((w) => canonicalUrl(w.url) === c);
}
export function latest(w) {
    return w.observations.length ? w.observations[w.observations.length - 1] : undefined;
}
export function previous(w) {
    return w.observations.length > 1 ? w.observations[w.observations.length - 2] : undefined;
}
export function pctChange(from, to) {
    const a = Number(from), b = Number(to);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0)
        return null;
    return ((b - a) / a) * 100;
}
