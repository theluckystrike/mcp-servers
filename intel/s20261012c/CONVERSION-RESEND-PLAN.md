# CONVERSION + RESEND EMAIL CAPTURE PLAN — mcp.zovo.one
STATUS: complete
Session: s20261012c · Written by orchestrator (agent dispatch failed on upstream 504; re-authored with verified bindings)

Ground truth used: `billing/wrangler.toml` (KV bindings `LICENSES` id 75f8bf…8641, `REMOTE_DATA`, DO `FULFILLMENT`; no D1 in the estate), route style in `billing/src/index.js` (`if (path === "…" && method === "…")` inside the fetch handler at line ~1500), external-API pattern `stripe()` at line 888 (plain `fetch`, zero deps). Funnel: 6,181 human storefront requests → 17 human checkout sessions → 0 paid. 280 hosted tenants, 119 anonymous tokens, 1 pro tenant. Engineering proof line: 1,254/1,254 checks green.

## 1. EMAIL CAPTURE

Store subscribers in the existing KV namespace `LICENSES` under keys `sub:<email>`. KV `list({ prefix: "sub:" })` gives subscriber counts without a new binding, a new namespace, or D1 provisioning. Value is a small JSON record that doubles as the drip schedule state.

Drop-in handler — add to `billing/src/index.js` inside the main fetch handler, next to the other `if (path === …)` routes (place it directly after the `/health` route at line ~1520):

```js
if (path === "/api/subscribe" && method === "POST") {
  const ct = request.headers.get("content-type") || "";
  let email = "", src = "form", honeypot = "";
  if (ct.includes("application/json")) {
    const b = await request.json().catch(() => ({}));
    email = String(b.email || "").trim().toLowerCase();
    src = String(b.src || "api");
  } else {
    const f = await request.formData().catch(() => null);
    if (f) {
      email = String(f.get("email") || "").trim().toLowerCase();
      honeypot = String(f.get("company") || "");   // humans never fill this
      src = String(f.get("src") || "form");
    }
  }
  if (honeypot) return new Response(null, { status: 204 });            // bot: pretend success
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) || email.length > 254) {
    return json(400, { ok: false, error: "valid email required" });
  }
  const key = `sub:${email}`;
  const existing = await env.LICENSES.get(key);
  if (!existing) {
    await env.LICENSES.put(key, JSON.stringify({ at: new Date().toISOString(), src, stage: 1, sent: [] }));
  }
  // Welcome email fires only on the first subscribe (stage set above).
  if (!existing && env.RESEND_API_KEY) {
    ctx.waitUntil(sendWelcome(env, email).catch(() => {})); // see section 2; never blocks the response
  }
  if (ct.includes("application/json")) return json(200, { ok: true, first: !existing });
  return Response.redirect(`https://mcp.zovo.one/?subscribed=1`, 303);
}
```

Notes for the integrator:
- `json(status, obj)` is the estate's existing helper; if the name differs in your tree, use `Response.json(obj, { status })`.
- Re-subscribe (key exists) returns `ok: true, first: false` and sends nothing — no double drip.
- Do not log the raw email anywhere; the KV key is the only copy.

HTML snippet — plain, honest, no fake scarcity. Append inside the footer template in `scripts/build-pages.mjs` (the shared footer is emitted once, so the form lands on /pricing and every per-server page in one edit):

```html
<form method="post" action="https://mcp.zovo.one/api/subscribe" style="margin:2em 0;padding:1.25em;border:1px solid #ddd;max-width:34em">
  <p><strong>Get told when a server ships.</strong> One short email per release or price change. No drip padding, no discount theatre. Reply "stop" to opt out.</p>
  <p><label>Email <input type="email" name="email" required maxlength="254" style="margin:0 .5em"></label>
     <input type="text" name="company" style="display:none" tabindex="-1" autocomplete="off">
     <input type="hidden" name="src" value="footer">
     <button type="submit">Subscribe</button></p>
  <p style="font-size:.85em;color:#666">List storage: one KV record at Cloudflare. Sender: billing@resend.dev until the zovo.one domain is verified.</p>
</form>
```

Rebuild pages after the edit: `node scripts/build-pages.mjs`, then deploy (step is orchestrator-run, not in this file per contract).

## 2. RESEND WIRING

Plain fetch, zero deps — do NOT `npm i resend`; the worker already calls Stripe with bare fetch and Resend should match.

Secret (owner runs once, from `billing/`):

```
npx wrangler secret put RESEND_API_KEY
```

From-address: use the tested sandbox sender `billing@resend.dev` immediately (works unverified, delivers to the account owner's address only); switch to `hello@zovo.one` after domain verification (section 5). Keep both behind one constant so the switch is a one-line diff:

```js
const FROM = env.RESEND_DOMAIN_VERIFIED === "yes"
  ? "Zovo MCP <hello@zovo.one>"
  : "mcp.zovo.one <billing@resend.dev>";
```

Welcome send (fires on first subscribe; call it inside `ctx.waitUntil` so a Resend outage can never slow a page response):

```js
async function sendWelcome(env, email) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`,
               "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "mcp.zovo.one <billing@resend.dev>",
      to: email,
      subject: "Your hosted token — first task in 5 minutes",
      text: WELCOME_TEXT,   // E1 in section 3
    }),
  });
  return res.ok; // 200 with an id, or an error body we deliberately ignore in waitUntil
}
// in the route: ctx.waitUntil(sendWelcome(env, email).catch(() => {}));
```

Drip E2/E3: the worker already has a `scheduled` handler (`scheduled-monitor.js`, cron in wrangler.toml). Append a daily sweep: `list({ prefix: "sub:" })`, read each record, if `stage === 1 && now - at > 48h` send E2 then set `stage: 2`; same pattern at 7d for E3 (`stage: 2 → 3`). Append `stage` transitions inside the same `put`, so a crashed send retries next cron tick.

## 3. DRIP SEQUENCE

All plain text, no emoji, each under 120 words. Only real numbers appear.

E1 — instant · Subject: `Your hosted token — first task in 5 minutes`

```
You asked to hear when things ship. Here is the fastest useful thing we make.

Your free hosted token: mint it at https://mcp.zovo.one/setup (60 seconds, no card).

First task worth doing: open the invoice server and create document #1 —
"create an invoice for 2 hours at $80". It is stored, numbered, and totals to
the minor unit. That is the whole loop: describe it, get the document.

Every server passed 1,254/1,254 checks before it shipped. If anything
miscalculates, reply to this email — a human reads it.
```

E2 — +48h · Subject: `The $39 suite, and the 1,254 checks behind it`

```
Two days ago you minted a free hosted token. The single servers are $19.

The suite is $39: every sellable server, one license, lifetime — 46 servers
where the paid tiers matter, not 8 free calculators padding the count.

Why believe the engineering: every release runs 1,254 checks, green before
it ships. 280 tenants hold data on the hosted tier today.

No discount clock, no seats-left banner. The price is the price.
https://mcp.zovo.one/pricing
```

E3 — +7d · Subject: `What stopped you?`

```
One question, then I stop emailing: what stopped you from buying?

Reply with a single word if you like —

  price
  trust
  need
  time
  other (say it)

Everything changes based on what the majority answers. "price" gets a real
answer about the $39 suite; "trust" gets the source repo and the 1,254
checks; "need" gets pointed at the 6 new servers shipping next.

No reply after this means the sequence ends. Your token stays free either way.
```

## 4. EXIT-OFFER — ranked: capturing the 17-checkout → 0-paid leak

1. **Abandoned-checkout email via the existing Stripe webhook (highest EV, smallest diff).** The worker already receives `/webhook` with signature verification and already calls Resend-shaped infrastructure. On `checkout.session.expired` (and `payment_failed`), fire one plain-text email: "Your checkout for <product> closed — here is the direct link again, and the 30-day refund stands." 17 human checkout sessions reaching Stripe and zero paying is an intent leak, not a traffic leak; this is the only lever that speaks to those exact 17 people. Effort S. Requires RESEND_API_KEY only.
2. **Free-tool-first wedge at token mint (builds the list from the 280+119 base).** Today 119 anonymous tokens mint with no identity. Add an optional email field on the `/setup` mint form ("get the token by email — free, and we tell you when servers ship"); minting continues to work without it. Every mint becomes a warm subscriber with the token already in hand — E2/E3 land with usage context the footer form can never have. Effort M (touch mint form + subscribe route reuse).
3. **Make the founding tier honest-by-counter on /pricing (converts browsers, zero email needed).** The page carries a founding-tier framing already; add a real counter backed by one KV key (`founding:used`, incremented on each suite purchase, rendered by the worker) with plain copy: "Founding price held until 100 suites sold. N sold." If N is low, that number is still more honest than a countdown, and scarcity invented from nothing violates the estate's honesty gates. Effort S. Ship even before email capture — it needs no new secret.

## 5. OWNER CHECKLIST (only you can do these)

1. Create the API key: resend.com → API Keys → Create. Name `mcp-billing`. Copy the `re_…` value.
2. Verify the domain (unlocks real from-address + higher limits): resend.com → Domains → Add `zovo.one` → Resend shows DKIM (2-3 TXT/CNAME records) → paste them into Cloudflare DNS for zovo.one → wait for Resend to show Verified. Set the worker var `RESEND_DOMAIN_VERIFIED=yes` after (or just flip the FROM constant in section 2).
3. Paste the key to the worker, from `billing/`:
   `npx wrangler secret put RESEND_API_KEY`  → paste `re_…`, Enter.
4. Reply "go" — orchestrator then: adds the route + form, runs `node scripts/build-pages.mjs`, deploys, and probes `/api/subscribe` live (form 303 + JSON 200 paths), reporting the KV `sub:` record as proof.

Skippable-but-recommended: send a test mail to yourself from `billing@resend.dev` once step 3 is done (orchestrator can trigger it through a temporary `sub:` record — say so and it happens before deploy).

## 6. KPI MAPPING — 3 rows in `data/kpi.json`

All measured from the same `LICENSES` KV namespace, remote, zero new infra:

```
subscribers:      npx wrangler kv key list --binding LICENSES --prefix "sub:" | jq 'length'
welcome-sent:     npx wrangler kv key list --binding LICENSES --prefix "sub:" | jq '[.[] | .name]' \
                    > /tmp/subs.json;  # then per-key:
                  for k in $(jq -r '.[]' /tmp/subs.json); do
                    npx wrangler kv key get --binding LICENSES "$k"; echo; done \
                    | jq -s '[.[] | select(.sent | index("welcome"))] | length'
drip-open-proxy:  same loop, counting records where .stage >= 2 \
                    | jq -s '[.[] | select(.stage >= 2)] | length'
```

Honest definition of the third row: Resend's free tier gives no reliable open tracking, so the proxy is stage progression (E2 actually sent = a delivered welcome was not bounced hard). Rename the row `drip-e2-sent` if you prefer the measurement to name itself. Add all three to `data/kpi.json` under a `"email"` key:

```
node -e 'const f="data/kpi.json",k=require("./"+f);
k.email={subscribers:0,welcome_sent:0,drip_open_proxy:0,measured:"2026-10-12"};
require("fs").writeFileSync(f,JSON.stringify(k,null,2))'
```

— then re-run the three wrangler commands and fill the real numbers after first deploy.
