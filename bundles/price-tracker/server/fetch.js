export const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
export const TIMEOUT_MS = 12_000;
export const MAX_BYTES = 2 * 1024 * 1024;
export class FetchError extends Error {
    status;
    blocked;
    constructor(message, status, blocked = false) {
        super(message);
        this.status = status;
        this.blocked = blocked;
        this.name = "FetchError";
    }
}
function blockedText(url, status) {
    return (`the shop blocked this automated request (HTTP ${status}) for ${url}. ` +
        `Big retailers do this to non-browser traffic. Two ways round it: open the page in your browser, ` +
        `read the price, and record it with price_add_manual {url, price, currency}; ` +
        `or watch a smaller shop / a product page that is not behind a bot wall.`);
}
/** Fetch a page as a desktop browser would. Throws FetchError with user-facing text. */
export async function fetchPage(url, timeoutMs = TIMEOUT_MS) {
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        throw new FetchError(`"${url}" is not a valid URL. Include https://`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new FetchError(`only http and https URLs are supported (got ${parsed.protocol})`);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
        res = await fetch(parsed.toString(), {
            redirect: "follow",
            signal: ctrl.signal,
            headers: {
                "user-agent": USER_AGENT,
                accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "accept-language": "en-US,en;q=0.9",
                "accept-encoding": "gzip, deflate, br",
                "cache-control": "no-cache",
                "upgrade-insecure-requests": "1",
            },
        });
    }
    catch (e) {
        clearTimeout(timer);
        const msg = e?.name === "AbortError"
            ? `the page did not answer within ${Math.round(timeoutMs / 1000)}s`
            : `could not reach ${parsed.hostname} (${e?.message ?? "network error"})`;
        throw new FetchError(msg);
    }
    clearTimeout(timer);
    if (res.status === 403 || res.status === 429 || res.status === 401 || res.status === 503) {
        throw new FetchError(blockedText(parsed.toString(), res.status), res.status, true);
    }
    if (!res.ok)
        throw new FetchError(`the page returned HTTP ${res.status} for ${parsed.toString()}`, res.status);
    const html = await readCapped(res);
    if (/captcha|are you a human|enable javascript and cookies|access denied|unusual traffic/i.test(html.slice(0, 4000))) {
        throw new FetchError(blockedText(res.url || parsed.toString(), res.status), res.status, true);
    }
    const requestedUrl = parsed.toString();
    const finalUrl = res.url || requestedUrl;
    return { html, requestedUrl, finalUrl, status: res.status, redirected: finalUrl !== requestedUrl };
}
async function readCapped(res) {
    const body = res.body;
    if (!body)
        return (await res.text()).slice(0, MAX_BYTES);
    const reader = body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        if (!value)
            continue;
        total += value.byteLength;
        if (total > MAX_BYTES) {
            chunks.push(value.slice(0, Math.max(0, value.byteLength - (total - MAX_BYTES))));
            try {
                await reader.cancel();
            }
            catch { /* ignore */ }
            break;
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}
