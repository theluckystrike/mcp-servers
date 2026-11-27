/**
 * The offer text a free hosted caller reads. Pure: no KV, no request state, so it is
 * tested directly by remote/test/offer-text.test.mjs.
 *
 * s1116 funnel audit (data/s1116/FUNNEL.md). The line under every successful free call
 * named a rate limit and a retention period a normal free user never reaches, linked the
 * $39 bundle instead of the $19 server in use, was identical on every call, and was added
 * even under a cap note that already carried the $19 link. /stats/clicks has never counted
 * a click with a tool-origin src (2026-11-16 snapshot). The line now names what this
 * server's free tier withholds and links this server's own checkout first.
 */
const HOST = "https://mcp.zovo.one";
const BUY = `${HOST}/buy`;

function query(tenant, src) {
  const p = [];
  if (tenant) p.push(`tenant=${encodeURIComponent(tenant)}`);
  p.push(`src=${encodeURIComponent(src)}`);
  return `?${p.join("&")}`;
}

/** The line appended to a successful free-tier tool call. */
export function successTrailer({ product, freeLimits, tenant, single, bundle, count }) {
  const limits = freeLimits ? `Free tier on ${product}: ${freeLimits}.` : `This is the free tier of ${product}.`;
  return `${limits} Pro lifts these limits for a one-time $${single}, lifetime: ` +
    `${BUY}/${product}${query(tenant, `${product}.success`)}` +
    ` (or all ${count} servers for $${bundle}: ${BUY}/bundle${query(tenant, `${product}.success.bundle`)}).`;
}

/** True when a response already carries a checkout link, so it does not get a second offer. */
export function carriesOffer(body) {
  return typeof body === "string" && body.includes(`${BUY}/`);
}

/**
 * The post-payment step for a caller with no token (the keyless free tier). It used to say
 * "send the key as Authorization: Bearer <key>", which a claude.ai or Claude Desktop custom
 * connector cannot do: those clients take a URL and nothing else. The key works in the
 * path form, /mcp/<server>/t/<key> (authenticate() accepts an MCPL1 key there), so that
 * is the step named first.
 */
export function noTokenBuyStep(product, url) {
  return `Buy at ${url} . After payment, set this connector's URL to ${HOST}/mcp/${product}/t/<key>, ` +
    `using the key shown on the confirmation page (a client that can set headers may send "Authorization: Bearer <key>" instead). `;
}

/** license_activate on a keyless call: there is no connection to bind, so say where the key goes. */
export function keylessActivateText(product) {
  return "This call carried no token, so there is no connection to turn Pro on for. " +
    `Put the key in this connector's URL instead: ${HOST}/mcp/${product}/t/<key> ` +
    `(or send it as "Authorization: Bearer <key>" where the client can set headers). ` +
    `For a free connection that keeps data, get a token at ${HOST}/mcp/connect and reconnect with the /mcp/${product}/t/<token> URL it prints.`;
}

/**
 * Server instructions sent on initialize. The stored text says "all 58 others" while every
 * other surface sells 49 servers, and its bundle link has no tenant, so a purchase through
 * it left the connection on the free tier. Both are corrected at serve time.
 */
export function instructionsFor(text, { product, tenant, count }) {
  if (!text) return text;
  let out = text.replace(/\ball \d+ others\b/g, `the other ${count - 1}`);
  if (tenant) {
    out = out.split(`${BUY}/bundle?src=instr.${product}`)
      .join(`${BUY}/bundle?tenant=${encodeURIComponent(tenant)}&src=instr.${product}`);
  }
  return out;
}
