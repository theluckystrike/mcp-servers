import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
export function dataDir() {
    const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
    const dir = join(base, "mcp-servers", "invoice");
    mkdirSync(dir, { recursive: true });
    return dir;
}
function readJson(file, fallback) {
    try {
        return JSON.parse(readFileSync(join(dataDir(), file), "utf8"));
    }
    catch {
        return fallback;
    }
}
function writeJson(file, value) {
    const p = join(dataDir(), file);
    const tmp = `${p}.tmp`;
    writeFileSync(tmp, JSON.stringify(value, null, 2));
    renameSync(tmp, p);
}
export const DEFAULT_BUSINESS = {
    name: "", default_currency: "EUR", default_tax_rate: 0,
    payment_terms_days: 14, invoice_prefix: "INV",
};
export function getBusiness() {
    return { ...DEFAULT_BUSINESS, ...readJson("business.json", {}) };
}
export function setBusiness(b) { writeJson("business.json", b); }
export function hasBusiness() { return existsSync(join(dataDir(), "business.json")); }
export function getClients() { return readJson("clients.json", []); }
export function setClients(c) { writeJson("clients.json", c); }
export function getInvoices() { return readJson("invoices.json", []); }
export function setInvoices(i) { writeJson("invoices.json", i); }
/**
 * Allocate the next invoice number: <prefix>-<YYYY>-<NNNN>.
 * The counter file is written before the invoice is stored, so a crash burns a number
 * rather than reusing one. Existing invoice numbers are also scanned so a restored or
 * hand-edited invoices.json can never hand back a number that is already on a document.
 */
export function nextNumber(prefix, year) {
    const counters = readJson("counter.json", {});
    const key = `${prefix}-${year}`;
    let n = counters[key] ?? 0;
    const used = new Set(getInvoices().map((i) => i.number));
    do {
        n += 1;
    } while (used.has(`${key}-${String(n).padStart(4, "0")}`));
    counters[key] = n;
    writeJson("counter.json", counters);
    return `${key}-${String(n).padStart(4, "0")}`;
}
export function findClient(ref) {
    const clients = getClients();
    const needle = ref.trim().toLowerCase();
    return clients.find((c) => c.id === ref) ?? clients.find((c) => c.name.toLowerCase() === needle)
        ?? clients.find((c) => c.name.toLowerCase().includes(needle));
}
export function invoicesInMonth(month) {
    return getInvoices().filter((i) => i.issue_date.slice(0, 7) === month);
}
