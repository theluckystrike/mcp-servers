import { mintLicense, verifyLicenseKey, hex } from "./license.js";

const PRODUCTS = {
  "time-tracker": { desc: "Track billable time from chat: timers, entries, reports, CSV, invoice-ready totals.", free: "Free: unlimited timers, last 7 days of reports, 2 rated projects.", pro: "Pro: full history, invoice summaries, group by tag, unlimited projects.", name: "MCP Time Tracker Pro", price: "price_1UBDU5JKCamubEm1wPMZI8Zf", usd: 19, pkg: "@theluckystrike/mcp-time-tracker", bin: "mcp-time-tracker", payload: "time-tracker" },
  "price-tracker": { desc: "Check and watch product prices on ordinary shop pages, with history and target alerts.", free: "Free: unlimited price checks, 3 watches, 10 observations each.", pro: "Pro: unlimited watches, full history, refresh all, pending alerts.", name: "MCP Price Tracker Pro", price: "price_1UBDU6JKCamubEm1ufsEKwSS", usd: 19, pkg: "@theluckystrike/mcp-price-tracker", bin: "mcp-price-tracker", payload: "price-tracker" },
  spreadsheet: { desc: "Read, query, add columns to and convert xlsx and csv files without corrupting them.", free: "Free: read, query and stats up to 5,000 rows; writes capped at 200 rows.", pro: "Pro: no limits.", name: "MCP Spreadsheet Pro", price: "price_1UBDU7JKCamubEm1LZTfrsMd", usd: 19, pkg: "@theluckystrike/mcp-spreadsheet", bin: "mcp-spreadsheet", payload: "spreadsheet" },
  invoice: { desc: "Numbered invoices with tax lines, rendered to a professional PDF, all local.", free: "Free: 3 invoices a month with a small footer line.", pro: "Pro: unlimited, no branding, logo, overdue report, custom prefix.", name: "MCP Invoice Pro", price: "price_1UBDU8JKCamubEm1Ybcp5IUs", usd: 19, pkg: "@theluckystrike/mcp-invoice", bin: "mcp-invoice", payload: "invoice" },
  bundle: { desc: "Every server above, one key, lifetime. Saves $37 against buying four.", free: "", pro: "", name: "MCP Servers Bundle (all servers, lifetime)", price: "price_1UBDU9JKCamubEm1dWgRjtoW", usd: 39, pkg: null, bin: null, payload: "*" },
};

const REPO = "https://github.com/theluckystrike/mcp-servers";

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{color-scheme:light dark}
body{font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;max-width:760px;margin:0 auto;padding:40px 20px}
h1{font-size:28px;margin:0 0 8px}h2{font-size:19px;margin:32px 0 8px}
.muted{opacity:.7}
table{border-collapse:collapse;width:100%;margin:20px 0}
td,th{text-align:left;padding:10px 8px;border-bottom:1px solid rgba(128,128,128,.3);vertical-align:middle}
a.buy{display:inline-block;padding:8px 16px;border:1px solid currentColor;border-radius:6px;text-decoration:none;font-weight:600;white-space:nowrap}
pre{background:rgba(128,128,128,.12);padding:12px;border-radius:6px;overflow-x:auto;font-size:13px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.key{font-size:15px;word-break:break-all;user-select:all}
footer{margin-top:48px;font-size:14px;opacity:.7}
</style></head><body>${body}
<footer>Built by <a href="${REPO}">theluckystrike</a>. Support: support@zovo.one</footer>
</body></html>`;
}

function home() {
  const rows = Object.entries(PRODUCTS).map(([id, p]) =>
    `<tr><td><strong>${esc(p.name)}</strong><br>${esc(p.desc)}<br><span class="muted">${esc(p.free)} ${esc(p.pro)}</span>${p.pkg ? `<br><span class="muted">Install: <code>npx -y ${esc(p.pkg)}</code> &middot; <a href="${REPO}/tree/main/servers/${esc(id)}#readme">docs</a></span>` : ""}</td>
<td>$${p.usd}</td><td><a class="buy" href="/buy/${id}">Buy</a></td></tr>`).join("\n");
  return page("MCP Servers Pro licenses", `<h1>MCP Servers Pro licenses</h1>
<p>Practical MCP servers for Claude, Cursor and any MCP client. Every server has a genuinely useful free tier; Pro is a one-time payment for a lifetime key. Keys verify offline; nothing is sent anywhere after checkout. Refunds within 14 days: support@zovo.one.</p>
<table><tr><th>Product</th><th>Price</th><th></th></tr>${rows}</table>
<h2>How activation works</h2>
<p>After payment you get a key like <code>MCPL1.xxx.yyy</code>. In Claude, run <code>license_activate</code> with the key, or set the environment variable <code>MCP_LICENSE_KEY</code>.</p>
<p>Source and docs: <a href="${REPO}">${REPO}</a></p>`);
}

async function stripe(env, path, params, method = "POST") {
  const init = { method, headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } };
  if (method === "POST") {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = new URLSearchParams(params).toString();
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, init);
  const json = await res.json();
  if (!res.ok) throw new Error(`stripe ${path}: ${json?.error?.message || res.status}`);
  return json;
}

async function createCheckout(env, host, productId) {
  const p = PRODUCTS[productId];
  const s = await stripe(env, "checkout/sessions", {
    mode: "payment",
    "line_items[0][price]": p.price,
    "line_items[0][quantity]": "1",
    success_url: `https://${host}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `https://${host}/`,
    allow_promotion_codes: "true",
    "metadata[product]": productId,
    "payment_intent_data[statement_descriptor_suffix]": "MCP PRO",
    "payment_intent_data[metadata][product]": productId,
  });
  return s;
}

/** Idempotent mint: the key for a session is derived once and cached in KV. */
async function keyForSession(env, session) {
  const cached = await env.LICENSES.get(`session:${session.id}`);
  if (cached) return cached;
  const productId = session.metadata?.product;
  const p = PRODUCTS[productId];
  if (!p) throw new Error(`unknown product in session metadata: ${productId}`);
  const email = session.customer_details?.email || session.customer_email || "";
  const { key } = await mintLicense(env.LICENSE_PRIVATE_KEY_PEM, {
    product: p.payload,
    id: hex(6),
    iat: session.created || Math.floor(Date.now() / 1000),
    email,
  });
  // Store-if-absent: re-read to keep a concurrent webhook and /success in agreement.
  const again = await env.LICENSES.get(`session:${session.id}`);
  if (again) return again;
  await env.LICENSES.put(`session:${session.id}`, key, { metadata: { product: productId, email } });
  return key;
}

function installSnippet(productId) {
  const p = PRODUCTS[productId];
  if (!p.pkg) {
    return `<pre><code># Bundle: the key works for every server. Example install:
claude mcp add time-tracker -- npx -y @theluckystrike/mcp-time-tracker
claude mcp add price-tracker -- npx -y @theluckystrike/mcp-price-tracker
claude mcp add spreadsheet -- npx -y @theluckystrike/mcp-spreadsheet
claude mcp add invoice -- npx -y @theluckystrike/mcp-invoice</code></pre>`;
  }
  return `<pre><code># Claude Code
claude mcp add ${p.bin.replace(/^mcp-/, "")} -- npx -y ${p.pkg}

# Claude Desktop (claude_desktop_config.json)
{
  "mcpServers": {
    "${p.bin.replace(/^mcp-/, "")}": { "command": "npx", "args": ["-y", "${p.pkg}"] }
  }
}</code></pre>`;
}

function successPage(key, productId, session) {
  const p = PRODUCTS[productId];
  return page("Your MCP Pro license key", `<h1>Payment received</h1>
<p>${esc(p.name)} - $${p.usd} one-time, lifetime.</p>
<h2>Your license key</h2>
<pre class="key"><code>${esc(key)}</code></pre>
<p class="muted">Save this. It is also on the receipt email address ${esc(session.customer_details?.email || "you used")}. Reloading this page always shows the same key.</p>
<h2>Activate it</h2>
<p>In Claude: run <code>license_activate</code> with this key.</p>
<p>Alternative, set an environment variable before starting the server:</p>
<pre><code>MCP_LICENSE_KEY=${esc(key)}</code></pre>
<h2>Install</h2>
${installSnippet(productId)}
<p>Docs: <a href="${REPO}">${REPO}</a></p>`);
}

async function verifySig(env, body, header) {
  const parts = Object.fromEntries(String(header || "").split(",").map((kv) => kv.split("=").map((x) => x.trim())).filter((a) => a.length === 2));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const enc = new TextEncoder();
  const mac = await crypto.subtle.importKey("raw", enc.encode(env.STRIPE_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", mac, enc.encode(`${t}.${body}`)));
  const expected = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  if (diff !== 0) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > 300) return false;
  return true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.host;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method === "HEAD" ? "GET" : request.method;

    if (path === "/health") {
      // signer check: mint a throwaway key in-runtime and verify it. No secrets leak.
      let signer = "unavailable";
      try {
        const probe = await mintLicense(env.LICENSE_PRIVATE_KEY_PEM, { product: "health-probe", id: "000000000000", iat: 0 });
        signer = (await verifyLicenseKey(probe.key, "health-probe")).ok ? "ok" : "verify-failed";
      } catch (e) {
        signer = `error: ${e.message}`;
      }
      return Response.json({
        ok: signer === "ok",
        service: "mcp-billing",
        signer,
        products: Object.keys(PRODUCTS),
        stripe_mode: (env.STRIPE_SECRET_KEY || "").includes("_live_") || (env.STRIPE_SECRET_KEY || "").startsWith("rk_live") ? "live" : "test",
        time: new Date().toISOString(),
      });
    }

    if (path === "/" && method === "GET") {
      return new Response(home(), { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (path.startsWith("/buy/") && method === "GET") {
      const id = decodeURIComponent(path.slice("/buy/".length));
      if (!PRODUCTS[id]) return new Response(page("Not found", `<h1>Unknown product</h1><p><a href="/">Back to products</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
      try {
        const session = await createCheckout(env, host, id);
        return new Response(null, { status: 303, headers: { Location: session.url, "cache-control": "no-store" } });
      } catch (e) {
        return new Response(page("Checkout error", `<h1>Checkout could not start</h1><p>${esc(e.message)}</p><p><a href="/">Back</a></p>`), { status: 502, headers: { "content-type": "text/html; charset=utf-8" } });
      }
    }

    if (path === "/success" && method === "GET") {
      const sid = url.searchParams.get("session_id");
      if (!sid) return Response.redirect(`https://${host}/`, 303);
      try {
        const session = await stripe(env, `checkout/sessions/${encodeURIComponent(sid)}`, null, "GET");
        if (session.payment_status !== "paid") {
          return new Response(page("Payment not complete", `<h1>Payment not complete</h1><p>Status: ${esc(session.payment_status)}. If you just paid, reload in a few seconds.</p><p><a href="/">Back to products</a></p>`), { status: 402, headers: { "content-type": "text/html; charset=utf-8" } });
        }
        const key = await keyForSession(env, session);
        return new Response(successPage(key, session.metadata?.product, session), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      } catch (e) {
        return new Response(page("Error", `<h1>Could not load your session</h1><p>${esc(e.message)}</p><p>Email support@zovo.one with your receipt.</p>`), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
      }
    }

    if (path === "/webhook" && method === "POST") {
      const body = await request.text();
      if (!(await verifySig(env, body, request.headers.get("stripe-signature")))) {
        return new Response("bad signature", { status: 400 });
      }
      let event;
      try {
        event = JSON.parse(body);
      } catch {
        return new Response("bad json", { status: 400 });
      }
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        if (session.payment_status === "paid") {
          try {
            await keyForSession(env, session);
          } catch (e) {
            return new Response(`mint failed: ${e.message}`, { status: 500 });
          }
        }
      }
      return Response.json({ received: true });
    }

    if (path === "/verify" && method === "GET") {
      const key = url.searchParams.get("key") || "";
      const product = url.searchParams.get("product") || "";
      const r = await verifyLicenseKey(key, product || null);
      return Response.json(
        r.ok ? { ok: true, product: r.payload.p, id: r.payload.id, iat: r.payload.iat, exp: r.payload.exp ?? null }
             : { ok: false, product: null, id: null, reason: r.reason },
        { status: r.ok ? 200 : 400 }
      );
    }

    return new Response(page("Not found", `<h1>Not found</h1><p><a href="/">Back to products</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  },
};
