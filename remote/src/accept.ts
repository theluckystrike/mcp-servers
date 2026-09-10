/**
 * Accept-header content negotiation for the Streamable HTTP transport.
 *
 * MCP's Streamable HTTP transport requires a POSTing client to accept both
 * `application/json` and `text/event-stream`, and the SDK enforces that with a literal
 * substring test:
 *
 *   node_modules/@modelcontextprotocol/sdk/dist/esm/server/webStandardStreamableHttp.js:468
 *     if (!acceptHeader?.includes('application/json') || !acceptHeader.includes('text/event-stream'))
 *
 * A substring test is not content negotiation. `Accept: * / *` is a media range that admits
 * every media type, including both of the required ones, and RFC 9110 section 12.5.1 says
 * a request with no Accept header at all is to be treated as accepting anything. Both were
 * answered 406 on every hosted endpoint. That matters because `curl` sends `Accept: * / *`
 * by default, so every naive health prober, every directory checker and every hand-typed
 * test of `initialize` saw a 406 and could read the endpoint as dead - the same failure
 * class as the 401-on-initialize that had four of these servers published as DOWN.
 *
 * This module decides, per RFC 9110 section 12.5.1, whether the caller's Accept admits both
 * required types. When it does, the worker rewrites the header to the literal string the
 * SDK's substring test is looking for before handing the request to the transport; the SDK
 * is wrapped, never forked. When it does not - `Accept: text/html`, or `application/json`
 * with no mention of event streams - nothing is rewritten and the SDK still answers 406.
 * Nothing else about the request is touched, and the auth boundary is entirely separate.
 */

/** The exact header value the SDK's substring test accepts. */
export const REQUIRED_ACCEPT = "application/json, text/event-stream";

/** The two media types a Streamable HTTP client has to admit. */
export const REQUIRED_TYPES = ["application/json", "text/event-stream"] as const;

/**
 * Does `accept` admit `type`, per RFC 9110 section 12.5.1?
 *
 * Media ranges are ranked by specificity - `type/subtype` beats `type/*` beats `* / *` -
 * and the most specific matching range decides, so `* / *, application/json;q=0` correctly
 * reports that JSON is NOT acceptable. Among ranges of equal specificity the highest q
 * wins. A q of 0 means "not acceptable"; an unparseable q is read as 0 rather than 1, so a
 * malformed header can only ever make this stricter.
 */
export function acceptsType(accept: string, type: string): boolean {
  const topLevel = type.slice(0, type.indexOf("/"));
  let bestSpecificity = 0;
  let bestQ = 0;
  for (const part of accept.split(",")) {
    const params = part.split(";").map((s) => s.trim());
    const range = (params.shift() ?? "").toLowerCase();
    if (!range) continue;
    const specificity = range === type ? 3 : range === `${topLevel}/*` ? 2 : range === "*/*" ? 1 : 0;
    if (specificity === 0) continue;
    let q = 1;
    for (const p of params) {
      const m = /^q=(.*)$/i.exec(p);
      if (!m) continue;
      const n = Number(m[1]);
      q = Number.isFinite(n) ? n : 0;
    }
    if (specificity > bestSpecificity) { bestSpecificity = specificity; bestQ = q; }
    else if (specificity === bestSpecificity && q > bestQ) { bestQ = q; }
  }
  return bestQ > 0;
}

/**
 * The Accept header to hand the SDK transport, or null to leave the request untouched.
 *
 * Returns REQUIRED_ACCEPT only when the caller's Accept genuinely admits both required
 * types but does not spell them out (a wildcard range, or no Accept header at all). A
 * header that already contains both literals is left alone - the SDK passes it already,
 * and rewriting it would change what the caller asked for. A header that does not admit
 * both is left alone too, so the 406 the spec calls for still happens.
 */
export function negotiateAccept(accept: string | null | undefined): string | null {
  // RFC 9110 12.5.1: "A request without any Accept header field implies that the user
  // agent will accept any media type in response."
  if (accept === null || accept === undefined || accept.trim() === "") return REQUIRED_ACCEPT;
  if (REQUIRED_TYPES.every((t) => accept.includes(t))) return null;
  if (REQUIRED_TYPES.every((t) => acceptsType(accept, t))) return REQUIRED_ACCEPT;
  return null;
}

/**
 * Apply negotiateAccept to a Headers object, returning a copy when a rewrite is needed and
 * the original when it is not. The caller's own headers object is never mutated: the worker
 * reads Authorization off the untouched request after this runs.
 */
export function negotiatedHeaders(headers: Headers): Headers {
  const next = negotiateAccept(headers.get("accept"));
  if (next === null) return headers;
  const copy = new Headers(headers);
  copy.set("accept", next);
  return copy;
}
