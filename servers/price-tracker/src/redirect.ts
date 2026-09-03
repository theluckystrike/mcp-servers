/**
 * Redirect sanity check.
 *
 * A shop that no longer sells an item usually answers with a 301/302 to a
 * category listing or the home page instead of a 404. The fetch succeeds, the
 * page carries a price, and the extractor happily returns the cheapest item on
 * a completely different page. For a price watcher that is the worst possible
 * failure: it alerts on a number that was never the price of the product.
 *
 * So: after the fetch, compare the final URL against the requested one and
 * refuse anything that has left the product path.
 */

export interface RedirectVerdict {
  /** true when the final page still looks like the requested product page */
  ok: boolean;
  /** user-facing reason when ok is false */
  reason?: string;
}

/** Path segments of a URL, ignoring empty segments and a trailing slash. */
export function pathSegments(u: string): string[] {
  try {
    return new URL(u).pathname.split("/").filter(Boolean);
  } catch {
    return [];
  }
}

/** Path words that mean "a listing of many products", not "one product". */
const CATEGORY_SEGMENTS = new Set([
  "c", "cat", "category", "categories", "catalog", "catalogue", "collections",
  "collection", "shop", "store", "browse", "products", "search", "department",
  "departments", "deals", "sale", "all",
]);

/** Path words that carry no product identity: markers, locales, and the listing words above. */
const GENERIC_PATH_SEGMENTS = new Set([
  "p", "dp", "gp", "d", "i", "itm", "item", "items", "product", "prod", "pd",
  "detail", "details", "buy", "shop", "en", "us", "uk", "gb", "eu", "www", "site",
]);

/** A locale segment such as "en", "en-us", "en_gb", "us/en". */
const LOCALE_SEG = /^[a-z]{2}([-_][a-z]{2})?$/i;

/** true when a path segment says nothing about which product was requested. */
function genericSegment(seg: string): boolean {
  const s = seg.toLowerCase();
  return GENERIC_PATH_SEGMENTS.has(s) || CATEGORY_SEGMENTS.has(s) || LOCALE_SEG.test(s);
}

/**
 * The product identifier of a request: the longest purely alphanumeric segment
 * (SKU / ASIN / item number). Slug segments carry hyphens and are excluded, and
 * anything shorter than 5 characters is too weak to identify a product.
 */
export function productToken(u: string): string | null {
  const cands = pathSegments(u).filter((s) => /^[A-Za-z0-9]+$/.test(s) && s.length >= 5 && !genericSegment(s));
  if (!cands.length) return null;
  return cands.reduce((a, b) => (b.length > a.length ? b : a));
}

/**
 * true when the final URL still carries the identity of the requested one:
 * every non-generic segment of the request survives, or the product identifier
 * token appears anywhere in the final URL (path or query).
 */
export function keepsProductIdentity(requestedUrl: string, finalUrl: string): boolean {
  const want = pathSegments(requestedUrl).filter((s) => !genericSegment(s));
  const gotSet = new Set(pathSegments(finalUrl).map((s) => s.toLowerCase()));
  if (want.length > 0 && want.every((s) => gotSet.has(s.toLowerCase()))) return true;
  const token = productToken(requestedUrl);
  if (token && finalUrl.toLowerCase().includes(token.toLowerCase())) return true;
  return false;
}

/**
 * Path words that route to ONE product. A redirect that introduces one of
 * these is not a listing when the requested product's identity survives
 * (Codex v3 item 35): /item/12345 -> /products/widget?sku=12345 is the same
 * product under a canonical route, not a category page.
 */
const PRODUCT_ROUTE_SEGMENTS = new Set(["products", "product", "p", "dp"]);

/** Titles that no real product page has. */
const GENERIC_TITLE = /^(products?|home|homepage|home\s*page|shop|store|search|search\s+results?|categor(y|ies)|all\s+products|welcome|index)$/i;
const NOT_FOUND = /not\s*found|404|page\s+unavailable|no\s+longer\s+available/i;

function host(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./i, ""); } catch { return ""; }
}

/** "shop.example.com" -> "example", used to spot a title that is only the shop name. */
function shopName(u: string): string {
  const h = host(u);
  const parts = h.split(".").filter((p) => p && p !== "com" && p !== "co" && p !== "shop");
  return parts.length ? parts[parts.length - 1] : h;
}

function sameUrl(a: string, b: string): boolean {
  const norm = (u: string) => {
    try {
      const x = new URL(u);
      x.hash = "";
      let s = `${x.protocol}//${x.host}${x.pathname}${x.search}`;
      if (s.endsWith("/") && x.pathname !== "/") s = s.slice(0, -1);
      return s.toLowerCase();
    } catch { return u.trim().toLowerCase(); }
  };
  return norm(a) === norm(b);
}

/**
 * Decide whether `finalUrl` is still the page the user asked for.
 *
 * Only redirects are judged: if the final URL matches the requested one, the
 * verdict is always ok, whatever the title says.
 */
export function checkRedirect(requestedUrl: string, finalUrl: string, title: string | null): RedirectVerdict {
  if (!finalUrl || sameUrl(requestedUrl, finalUrl)) return { ok: true };

  const reason = (why: string): RedirectVerdict => ({
    ok: false,
    reason:
      `the shop redirected to ${finalUrl}, which is not a product page (${why}). ` +
      `The item is probably gone or renamed. Open ${requestedUrl} in your browser to find the current page, ` +
      `then watch that URL, or record the price with price_add_manual {url, price, currency}.`,
  });

  const want = pathSegments(requestedUrl);
  const got = pathSegments(finalUrl);

  // Landed on the home page.
  if (got.length === 0 && want.length > 0) return reason("it is the shop home page");

  // Slug canonicalisation: /p/<id> -> /<slug>/p/<id>, /dp/<asin> -> /<name>/dp/<asin>,
  // or the same path with tracking query parameters. The product identity survives, so the
  // depth rule must not fire; only the listing / generic-title signals below still apply.
  const sameProduct = keepsProductIdentity(requestedUrl, finalUrl);

  // A different path depth family: a product URL is deep, a listing is shallow.
  if (!sameProduct && want.length !== got.length) {
    return reason(`the path depth changed from ${want.length} to ${got.length} segments`);
  }

  // Landed inside a category / listing path the request was not already in.
  const wantSet = new Set(want.map((s) => s.toLowerCase()));
  const t = (title ?? "").trim();
  const head = t.split(/\s+[|\u2013\u2014-]\s+/)[0].trim();
  const namedProduct = !!t && !NOT_FOUND.test(t) && !GENERIC_TITLE.test(t) && !GENERIC_TITLE.test(head);
  const listing = got.find((s) => {
    const seg = s.toLowerCase();
    if (!CATEGORY_SEGMENTS.has(seg) || wantSet.has(seg)) return false;
    // A product route plus a surviving product identity plus a real product
    // title is a canonical product URL, not a listing.
    if (PRODUCT_ROUTE_SEGMENTS.has(seg) && sameProduct && namedProduct) return false;
    return true;
  });
  if (listing) return reason(`it is a "${listing}" listing page`);

  if (t) {
    if (NOT_FOUND.test(t)) return reason(`the page title is "${t}"`);
    // "Name - Shop" was already reduced to its head above.
    if (GENERIC_TITLE.test(head) || GENERIC_TITLE.test(t)) return reason(`the page title is "${t}"`);
    const brand = shopName(finalUrl);
    if (brand && t.toLowerCase().replace(/[^a-z0-9]+/g, "") === brand.toLowerCase().replace(/[^a-z0-9]+/g, "")) {
      return reason(`the page title is only the shop name, "${t}"`);
    }
  }

  return { ok: true };
}
