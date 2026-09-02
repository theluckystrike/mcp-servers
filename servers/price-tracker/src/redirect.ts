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

  // A different path depth family: a product URL is deep, a listing is shallow.
  if (want.length !== got.length) return reason(`the path depth changed from ${want.length} to ${got.length} segments`);

  // Landed inside a category / listing path the request was not already in.
  const wantSet = new Set(want.map((s) => s.toLowerCase()));
  const listing = got.find((s) => CATEGORY_SEGMENTS.has(s.toLowerCase()) && !wantSet.has(s.toLowerCase()));
  if (listing) return reason(`it is a "${listing}" listing page`);

  const t = (title ?? "").trim();
  if (t) {
    if (NOT_FOUND.test(t)) return reason(`the page title is "${t}"`);
    // Strip a "Name - Shop" suffix before judging genericness.
    const head = t.split(/\s+[|–—-]\s+/)[0].trim();
    if (GENERIC_TITLE.test(head) || GENERIC_TITLE.test(t)) return reason(`the page title is "${t}"`);
    const brand = shopName(finalUrl);
    if (brand && t.toLowerCase().replace(/[^a-z0-9]+/g, "") === brand.toLowerCase().replace(/[^a-z0-9]+/g, "")) {
      return reason(`the page title is only the shop name, "${t}"`);
    }
  }

  return { ok: true };
}
