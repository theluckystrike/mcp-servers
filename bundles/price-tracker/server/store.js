import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
export function dataDir() {
    const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
    return join(base, "mcp-servers", "price-tracker");
}
export function dbPath() { return join(dataDir(), "watches.json"); }
export function load() {
    try {
        const raw = readFileSync(dbPath(), "utf8");
        const db = JSON.parse(raw);
        if (!db || !Array.isArray(db.watches))
            return { version: 1, watches: [] };
        return { version: 1, watches: db.watches };
    }
    catch {
        return { version: 1, watches: [] };
    }
}
export function save(db) {
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
