/**
 * Pure price extraction from an HTML string.
 *
 * Prices are returned (and stored everywhere in this server) as DECIMAL STRINGS
 * in the major unit, with "." as the decimal separator and no thousands
 * separators: "1299.00", "12.99", "9990". Never floats, never minor units.
 */

export interface Extracted {
  /** decimal string, major unit, "." decimal separator, no grouping */
  price: string;
  /** ISO 4217 code when known, else null */
  currency: string | null;
  /** page / product title when found */
  title: string | null;
  /** which strategy produced the price */
  source: string;
}

const SYMBOL_TO_CODE: Record<string, string> = {
  "$": "USD", "US$": "USD", "C$": "CAD", "CA$": "CAD", "A$": "AUD", "AU$": "AUD",
  "R$": "BRL", "NZ$": "NZD", "HK$": "HKD",
  "€": "EUR", "£": "GBP", "¥": "JPY", "₹": "INR", "₽": "RUB",
  "₩": "KRW", "₪": "ILS", "₺": "TRY", "₴": "UAH", "zł": "PLN",
  "Kč": "CZK", "kr": "SEK", "CHF": "CHF", "R": "ZAR",
};

const CODES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "NZD", "CHF", "SEK", "NOK", "DKK", "PLN",
  "CZK", "HUF", "RON", "BGN", "TRY", "RUB", "UAH", "INR", "CNY", "HKD", "SGD", "KRW",
  "BRL", "MXN", "ZAR", "AED", "SAR", "ILS", "THB", "MYR", "IDR", "PHP", "VND", "TWD",
];

const SYMBOL_CLASS = "[$\\u20ac\\u00a3\\u00a5\\u20b9\\u20bd\\u20a9\\u20aa\\u20ba\\u20b4]";
const NUMBER_RE = "\\d{1,3}(?:[.,\\u00a0\\u202f ]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?";

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  euro: "€", pound: "£", yen: "¥", dollar: "$", cent: "¢",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => safeCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => safeCode(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
}

function safeCode(n: number): string {
  return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
}

/** Strip tags, scripts and styles, collapse whitespace. */
export function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]*>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

/**
 * Normalize a raw price token to a decimal string.
 * Handles "1.299,00" (EU), "1,299.00" (US), "1 299,00", "1299", "12,99".
 * Returns null if the token holds no digits.
 */
export function normalizeNumber(raw: string): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.replace(/[  \s']/g, "").replace(/[^\d.,-]/g, "");
  const neg = /^-/.test(s);
  s = s.replace(/-/g, "");
  if (!/\d/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let intPart: string;
  let fracPart = "";

  if (lastComma >= 0 && lastDot >= 0) {
    const decPos = Math.max(lastComma, lastDot);
    intPart = s.slice(0, decPos).replace(/[.,]/g, "");
    fracPart = s.slice(decPos + 1).replace(/[.,]/g, "");
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? "," : ".";
    const pos = lastComma >= 0 ? lastComma : lastDot;
    const groups = s.split(sep);
    const tail = s.slice(pos + 1);
    const allGroupsAreThousands = groups.slice(1).every((g) => g.length === 3);
    // "1,299" / "1.299" / "1.234.567" -> grouping; "12,99" / "12.995" -> decimal
    if (allGroupsAreThousands && groups[0].length <= 3 && groups[0].length > 0 && (groups.length > 2 || tail.length === 3)) {
      intPart = s.replace(/[.,]/g, "");
    } else {
      intPart = s.slice(0, pos).replace(/[.,]/g, "");
      fracPart = tail.replace(/[.,]/g, "");
    }
  } else {
    intPart = s;
  }

  if (intPart === "") intPart = "0";
  intPart = intPart.replace(/^0+(?=\d)/, "");
  if (!/^\d+$/.test(intPart)) return null;
  if (fracPart !== "" && !/^\d+$/.test(fracPart)) return null;
  if (fracPart.length > 2) fracPart = fracPart.slice(0, 2);
  const out = fracPart ? `${intPart}.${fracPart}` : intPart;
  if (out === "0" || out === "0.00") return null;
  return neg ? `-${out}` : out;
}

/** Map a symbol or code found in text to an ISO code. */
export function currencyFrom(token: string | null | undefined, url?: string): string | null {
  if (!token) return null;
  const t = token.trim();
  const upper = t.toUpperCase();
  if (CODES.includes(upper)) return upper;
  if (SYMBOL_TO_CODE[t]) {
    const code = SYMBOL_TO_CODE[t];
    if (t === "$" && url) {
      try {
        const host = new URL(url).hostname;
        if (/\.ca$/.test(host)) return "CAD";
        if (/\.au$/.test(host)) return "AUD";
        if (/\.nz$/.test(host)) return "NZD";
      } catch { /* ignore */ }
    }
    return code;
  }
  if (SYMBOL_TO_CODE[upper]) return SYMBOL_TO_CODE[upper];
  return null;
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return decodeEntities(m[2] ?? m[3] ?? m[4] ?? "").trim();
}

function metaTags(html: string): string[] {
  return html.match(/<meta\b[^>]*>/gi) ?? [];
}

function metaContent(html: string, keyAttr: string, keyValue: string): string | null {
  for (const tag of metaTags(html)) {
    const k = attr(tag, keyAttr);
    if (k && k.toLowerCase() === keyValue.toLowerCase()) {
      const c = attr(tag, "content");
      if (c) return c;
    }
  }
  return null;
}

export function extractTitle(html: string): string | null {
  const og = metaContent(html, "property", "og:title") ?? metaContent(html, "name", "og:title");
  if (og) return og.trim();
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) {
    const t = decodeEntities(m[1]).replace(/\s+/g, " ").trim();
    if (t) return t;
  }
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    const t = visibleText(h1[1]);
    if (t) return t;
  }
  return null;
}

/* ---------------- JSON-LD ---------------- */

function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1].replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "");
    try { out.push(JSON.parse(raw)); } catch { /* skip malformed block */ }
  }
  return out;
}

function walk(node: unknown, visit: (o: Record<string, unknown>) => void, depth = 0): void {
  if (!node || depth > 12) return;
  if (Array.isArray(node)) { for (const n of node) walk(n, visit, depth + 1); return; }
  if (typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  visit(o);
  for (const v of Object.values(o)) walk(v, visit, depth + 1);
}

function typeOf(o: Record<string, unknown>): string[] {
  const t = o["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
}

function fromJsonLd(html: string, url: string): Extracted | null {
  const blocks = jsonLdBlocks(html);
  if (!blocks.length) return null;
  let productName: string | null = null;
  const candidates: { price: string; currency: string | null; name?: string; rank: number }[] = [];

  for (const block of blocks) {
    walk(block, (o) => {
      const types = typeOf(o).map((t) => t.replace(/^https?:\/\/schema\.org\//i, ""));
      const isProduct = types.some((t) => /^Product|Vehicle|Book|SoftwareApplication|IndividualProduct|ProductGroup$/i.test(t));
      const isOffer = types.some((t) => /Offer/i.test(t));
      if (isProduct && typeof o.name === "string" && !productName) productName = o.name.trim();
      if (!isOffer && !isProduct && !("price" in o) && !("lowPrice" in o)) return;
      const currency = currencyFrom(
        (typeof o.priceCurrency === "string" ? o.priceCurrency : null) ??
        (typeof (o as any).currency === "string" ? (o as any).currency : null),
        url
      );
      const priceRaw = o.price ?? (o as any).lowPrice ?? (o as any).highPrice;
      if (priceRaw === undefined || priceRaw === null) return;
      const price = normalizeNumber(String(priceRaw));
      if (!price) return;
      const rank = "price" in o ? 0 : 1; // exact price beats lowPrice
      candidates.push({ price, currency, rank });
    });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.rank - b.rank || Number(a.price) - Number(b.price));
  const best = candidates[0];
  return {
    price: best.price,
    currency: best.currency ?? currencyFromText(html, url),
    title: productName ?? extractTitle(html),
    source: "json-ld",
  };
}

/* ---------------- microdata / meta ---------------- */

function fromMicrodata(html: string, url: string): Extracted | null {
  const re = /<([a-zA-Z][\w-]*)\b([^>]*\bitemprop\s*=\s*["']?[^"'>]*\bprice\b[^"'>]*["']?[^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tagName = m[1].toLowerCase();
    const tag = `<${m[1]}${m[2]}>`;
    const prop = (attr(tag, "itemprop") ?? "").toLowerCase();
    if (!/\bprice\b|\blowprice\b/.test(prop)) continue;
    const content = attr(tag, "content") ?? attr(tag, "value");
    let raw = content;
    if (!raw && tagName !== "meta") {
      const after = html.slice(m.index + m[0].length, m.index + m[0].length + 400);
      raw = visibleText(after.split(new RegExp(`</${tagName}>`, "i"))[0] ?? after);
    }
    const price = normalizeNumber(raw ?? "");
    if (!price) continue;
    const cur =
      currencyFrom(metaContent(html, "itemprop", "priceCurrency"), url) ??
      currencyFrom(attrNear(html, m.index, "priceCurrency"), url) ??
      currencyFrom(firstCurrencyToken(raw ?? ""), url) ??
      currencyFromText(html, url);
    return { price, currency: cur, title: extractTitle(html), source: tagName === "meta" ? "meta-itemprop" : "microdata" };
  }
  return null;
}

function attrNear(html: string, index: number, itemprop: string): string | null {
  const window = html.slice(Math.max(0, index - 1500), index + 1500);
  const re = new RegExp(`<[^>]*itemprop\\s*=\\s*["']?${itemprop}["']?[^>]*>`, "i");
  const m = window.match(re);
  if (!m) return null;
  return attr(m[0], "content") ?? null;
}

function fromOpenGraph(html: string, url: string): Extracted | null {
  const keys = ["og:price:amount", "product:price:amount", "og:product:price:amount", "twitter:data1"];
  for (const key of keys) {
    const amount = metaContent(html, "property", key) ?? metaContent(html, "name", key);
    if (!amount) continue;
    const price = normalizeNumber(amount);
    if (!price) continue;
    const curKey = key.replace(/amount$/, "currency");
    const cur =
      currencyFrom(metaContent(html, "property", curKey) ?? metaContent(html, "name", curKey), url) ??
      currencyFrom(firstCurrencyToken(amount), url) ??
      currencyFromText(html, url);
    return { price, currency: cur, title: extractTitle(html), source: "opengraph" };
  }
  return null;
}

/* ---------------- class / id / data-* hints ---------------- */

const HINTS = [
  "a-offscreen", "priceblock_ourprice", "priceblock_dealprice", "priceblock",
  "product-price", "productprice", "offer-price", "current-price", "sales-price",
  "price-item--sale", "price--sale", "price__current", "price-current", "our-price",
  "now-price", "final-price", "pdp-price", "price-box", "price-tag", "money", "price",
];

function fromDataAttrs(html: string, url: string): Extracted | null {
  const re = /\bdata-(?:product-)?price(?:-amount|-value)?\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = decodeEntities(m[2] ?? m[3] ?? "");
    const price = normalizeNumber(raw);
    if (!price) continue;
    const curM = html.match(/\bdata-(?:product-)?currency(?:-code)?\s*=\s*("([^"]*)"|'([^']*)')/i);
    const cur =
      currencyFrom(curM ? (curM[2] ?? curM[3]) : null, url) ??
      currencyFrom(firstCurrencyToken(raw), url) ??
      currencyFromText(html, url);
    return { price, currency: cur, title: extractTitle(html), source: "data-attr" };
  }
  return null;
}

function fromClassHints(html: string, url: string): Extracted | null {
  for (const hint of HINTS) {
    const re = new RegExp(`<([a-zA-Z][\\w-]*)\\b[^>]*\\b(?:class|id)\\s*=\\s*["'][^"']*\\b${hint}\\b[^"']*["'][^>]*>`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const after = html.slice(m.index + m[0].length, m.index + m[0].length + 600);
      const text = visibleText(after);
      const hit = firstPriceInText(text, url);
      if (hit) return { price: hit.price, currency: hit.currency ?? currencyFromText(html, url), title: extractTitle(html), source: `class:${hint}` };
    }
  }
  return null;
}

/* ---------------- regex fallback ---------------- */

function tokenRe(flags: string): RegExp {
  const codes = CODES.join("|");
  return new RegExp(
    `(${SYMBOL_CLASS}|z\\u0142|K\\u010d|${codes})\\s*(${NUMBER_RE})|(${NUMBER_RE})\\s*(${SYMBOL_CLASS}|z\\u0142|K\\u010d|${codes})`,
    flags
  );
}

function firstPriceInText(text: string, url: string): { price: string; currency: string | null } | null {
  const m = tokenRe("i").exec(text);
  if (m) {
    const sym = m[1] ?? m[4];
    const num = m[2] ?? m[3];
    const price = normalizeNumber(num);
    if (price) return { price, currency: currencyFrom(sym, url) };
  }
  const bare = text.match(new RegExp(NUMBER_RE));
  if (bare) {
    const price = normalizeNumber(bare[0]);
    if (price) return { price, currency: null };
  }
  return null;
}

function firstCurrencyToken(s: string): string | null {
  const m = s.match(new RegExp(`${SYMBOL_CLASS}|z\\u0142|\\b(?:${CODES.join("|")})\\b`, "i"));
  return m ? m[0] : null;
}

function currencyFromText(html: string, url: string): string | null {
  const text = visibleText(html).slice(0, 200_000);
  const m = text.match(new RegExp(`${SYMBOL_CLASS}|z\\u0142|\\b(?:${CODES.join("|")})\\b`));
  return m ? currencyFrom(m[0], url) : null;
}

function fromRegexFallback(html: string, url: string): Extracted | null {
  const text = visibleText(html.slice(0, 200 * 1024));
  const re = tokenRe("gi");
  let m: RegExpExecArray | null;
  let best: { price: string; currency: string | null; value: number } | null = null;
  while ((m = re.exec(text))) {
    const sym = m[1] ?? m[4];
    const num = m[2] ?? m[3];
    const price = normalizeNumber(num);
    if (!price) continue;
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0 || value > 5_000_000) continue;
    if (!best || value > best.value) best = { price, currency: currencyFrom(sym, url), value };
  }
  if (!best) return null;
  return { price: best.price, currency: best.currency, title: extractTitle(html), source: "regex-fallback" };
}

/* ---------------- entry point ---------------- */

/** Extract a price from an HTML document. Returns null when nothing is found. */
export function extractPrice(html: string, url = ""): Extracted | null {
  if (typeof html !== "string" || html.length === 0) return null;
  const strategies = [fromJsonLd, fromMicrodata, fromOpenGraph, fromDataAttrs, fromClassHints, fromRegexFallback];
  for (const fn of strategies) {
    try {
      const r = fn(html, url);
      if (r && r.price) return r;
    } catch { /* a broken page must never throw */ }
  }
  return null;
}
