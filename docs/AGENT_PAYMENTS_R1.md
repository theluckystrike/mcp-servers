# Agent-native payments for the hosted MCP endpoints — research, design, verdict

Round 1, 2026-09-10. Agent A4, loop 33.
Scope: `remote/`, `packages/mcp-license/`. Nothing deployed.

---

## Verdict, first

**No. There is no agent-native payment rail reachable from this repo today without an
account, and more importantly there is nobody on the other end of one if there were.**

Two independent blockers, either of which is sufficient:

1. **The demand side is empty.** No mainstream MCP client settles an HTTP 402. Claude,
   ChatGPT and Cursor all require the user to separately install a third-party bridge and
   hand it the private key of a funded wallet. That is a *larger* human step than clicking
   a Stripe link, not a smaller one. Adding an x402 challenge would convert a funnel with
   one human step into a funnel with four.
2. **The supply side needs custody, which is a person's decision.** Accepting x402 requires
   a wallet address to receive USDC. Generating a keypair needs no account, but holding
   customer funds in a self-custodied stablecoin wallet is a financial and tax decision
   (the operator is Poland-resident) and cannot be taken autonomously.

A third, softer blocker: the price model does not fit. x402's live market is metered
micropayments — the median price across 28,376 indexed x402 resources is **$0.01/call**.
This estate sells a **$19 one-time lifetime licence**. A rail designed to charge a cent per
call is not the rail for a product bought once.

**What was shipped instead**, and it is worth more than the research: the paid path is now
discoverable and explainable *from inside the conversation*, and one measured content-
negotiation defect that made every hosted endpoint look dead to a naive prober is fixed.
See "What was shipped".

---

## 1. Research, primary sources only

### 1.1 The MCP specification defines no payment primitive

Current protocol version **`2026-07-28`** (`https://modelcontextprotocol.io/specification/versioning`,
fetched 2026-09-10: "The **current** protocol version is **2026-07-28**").

| Check | Result |
|---|---|
| `grep -rniE 'payment|monetiz|x402|micropay|paywall|price|pricing|billing' docs/specification/2026-07-28/` | 4 hits, **all** in `client/elicitation.mdx`, all naming payment as a motivating use case |
| same over `docs/specification/draft/` | 4 hits, identical lines |
| same over `schema/2026-07-28/` and `schema/draft/` | **0** |
| `ls seps/` (merged SEPs) | 43 merged; `2007` is in none |
| `git log --all -i --grep=payment --grep=x402 --grep=monetiz` on the spec repo | **0 commits** |
| All PRs ever (`repos/modelcontextprotocol/modelcontextprotocol/pulls?state=all --paginate`) | 1,631; exactly **one** payment PR |
| Items labelled `SEP`, all states | 223; payment-related: **1** |
| Open SEPs today | 40; payment-related: **0** |

**SEP-2007 "Payment Support for MCP Servers"** —
<https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2007>.
Opened **2025-12-23** by `shivankgoel`, labelled `SEP` on 2026-01-27, **closed unmerged
2026-06-24** (`merged: false`, `merged_at: null`). Closing comment by `localden`, verbatim:

> "This SEP has not received a sponsor in the past 6 months and is considered dormant. This
> is not a permanent decision, and if in the future there is additional support, this SEP
> can be revived."

It lapsed on **sponsorship, not technical rejection**, and is the most developed design on
record. What it proposed (none of it exists on `main`):

- server capability `"payment": { "protocols": ["x402"] }`
- a `payment` array on each Tool in `tools/list`, entries
  `{ "protocol": "x402", "paymentRequirement": { "x402Version": 2, "accepts": [...] } }`
- payment challenge as JSON-RPC error code **`-32402`**, payload under `error.data.payment`
- retry via `tools/call` `params.payment.paymentRequest.authorization`
- settlement in `result.payment.paymentResponse.settlement`

Two superseded duplicate issues: **#2008** (opened and closed 2025-12-23) and **#2009**
(closed 2025-12-27, "transitioning to a new PR-based workflow for SEPs"). #2009 used a
`payments/list` method and error `-32803` — neither number survives. A later non-SEP RFC,
**issue #3229** (opened 2026-08-11, closed 2026-08-23), proposed `capabilities.x402_metering`
and error `-4020`; it was never labelled `SEP` and never produced a PR.

Live demand exists and is unowned: discussion **#2436** (2026-03-23, open, 28 comments)
"MCP needs a standard payment layer"; **#2831** (2026-06-01, open, **0 comments**) claims an
audit of 14,519 registry entries in which **0** expose pricing machine-readably, and has
never been answered.

**Registry**: `server.json` `ServerDetail` properties are exactly `$schema, _meta,
description, icons, name, packages, remotes, repository, title, version, websiteUrl`.
`grep -rniE 'payment|monetiz|x402|pricing|price|billing'` over the registry's `schemas/`
and `docs/reference/server-json/`: **0**. Monetisation could only ride in free-form `_meta`.

**TypeScript SDK**: `grep -rniE 'x402|payment|32402|32803|pricing|micropay' packages/*/src/`
→ **0**. `gh search code --repo modelcontextprotocol/typescript-sdk x402` → **0 files**.

### 1.2 The one merged thing in the spec that addresses payment

**SEP-1036, URL mode elicitation**, merged and live at
`/specification/2026-07-28/client/elicitation.mdx`. Introduced in `2025-11-25`. Verbatim:

> "URL mode elicitation enables servers to direct users to external URLs for out-of-band
> interactions that must not pass through the MCP client. This is essential for auth flows,
> **payment processing**, and other sensitive or secure operations."
>
> "Servers **MUST NOT** use form mode elicitation to request sensitive information such as
> passwords, API keys, access tokens, or **payment credentials**."

A URL-mode `elicitation/create` request carries exactly three parameters: **`mode`**
(`"url"`), **`message`**, **`url`**. The client answers `{ "action": "accept" }`, which means
only that the user consented to open the URL — the interaction completes out of band and the
server discovers the outcome itself.

**This is the actual, merged, current convention for payment in MCP: send the user to a URL.**
It is what this estate already does, and it is the format the descriptor below adopts.

### 1.3 x402 — live, but not for us

Canonical repo is **`x402-foundation/x402`** (6,596 stars, Apache-2.0), not `coinbase/x402`,
which is now a development fork. Protocol **v2.0, dated 2025-12-09**. Packages `@x402/core`,
`@x402/mcp`, `@x402/express`, `@x402/fetch` all at **2.25.0**, published 2026-09-03/04.

The task brief's stated wire format is **v1 and superseded**. v2 moved everything to headers:

| | v1 (legacy) | v2 (current) |
|---|---|---|
| Challenge | 402 + JSON body | 402 + `PAYMENT-REQUIRED` header (base64) |
| Client pays | `X-PAYMENT` | `PAYMENT-SIGNATURE` |
| Settlement | `X-PAYMENT-RESPONSE` | `PAYMENT-RESPONSE` |

A real v2 challenge, captured live from a paywalled worker and base64-decoded (not a doc
sample):

```json
{ "x402Version": 2, "error": "Payment required",
  "resource": { "url": "...", "description": "...", "mimeType": "application/json" },
  "accepts": [{ "scheme": "exact", "network": "eip155:8453", "amount": "5000",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0x7555c45f48eFDFE4151c76f066727735a429c7e6",
    "maxTimeoutSeconds": 300, "extra": { "name": "USD Coin", "version": "2" } }] }
```

Networks are CAIP-2 in v2 (`eip155:8453`), replacing v1's `"base-sepolia"` strings.

**Seller requirements, probed live:**

| Facilitator | Probe | Networks | Verdict |
|---|---|---|---|
| `x402.org/facilitator` | HTTP 200, no auth | **testnets only** | no account, but testnet |
| `facilitator.payai.network` | HTTP 200, no auth, serves `eip155:8453` | Base/Polygon/Arbitrum/Solana **mainnet** | **NO-ACCOUNT-POSSIBLE**, free tier capped by total settlements |
| `api.cdp.coinbase.com/platform/v2/x402` | **HTTP 401** | Base, Polygon, Solana | ACCOUNT-REQUIRED + paid past 1,000 settlements/mo |

So the prior operator finding — *x402 is the only live rail* — **still holds**, and it is now
more true than it was: there is a mainnet path (PayAI) that needs no account and no KYC.
The blocker is not the facilitator. It is the wallet and the buyer.

**Buyer requirements:** a funded wallet holding USDC **and its private key**. Coinbase's own
guide has the user run a local MCP bridge with `"env": { "EVM_PRIVATE_KEY": "<wallet with
USDC>" }`. npm confirms the whole ecosystem is third-party bridges you install and fund
yourself: `@hpp-io/x402-mcp-bridge`, `@zeam-labs/x402-mcp-bridge`, `@piprail/mcp`,
`cascade-protocol/x402-proxy`. **No mainstream client auto-pays.**

x402 v2 does treat MCP as a first-class transport (`specs/transports-v2/mcp.md`): payment
required is a tool result with `isError: true` plus `structuredContent`, the client retries
with payment in `_meta["x402/payment"]`, settlement returns in
`_meta["x402/payment-response"]`. Official `@x402/mcp` 2.25.0 covers both sides. So the
integration is technically easy. It is the buyers that do not exist.

Adoption is real, not vapour: PayAI's discovery catalog indexes **28,376** x402-payable
resources; a 200-resource sample is Solana mainnet 155, Base mainnet 44, **median price
$0.01**.

### 1.4 Every other agent-payment standard

| Standard | Live? | Seller verdict |
|---|---|---|
| **Stripe MPP** (mpp.dev, Stripe + Tempo), GA 2026-03-18, IETF standards-track | yes, and 402-native | ACCOUNT-REQUIRED, full KYC |
| **Stripe x402** (`docs.stripe.com/payments/machine/x402`) | yes | ACCOUNT-REQUIRED: Stripe KYC **+** a CDP account **+** stablecoin approval; non-US must email `machine-payments@stripe.com` |
| **ACP** (OpenAI + Stripe + Meta), spec folder 2026-04-17 | spec only; ChatGPT surface partner-gated | ANNOUNCED, NOT LIVE for non-partners |
| **Google AP2** v0.2.0 (2026-04-28, donated to FIDO) | spec only, **PSPs are mocked** | ANNOUNCED, NOT LIVE |
| **Visa TAP** | repo dead since 2025-10-28 | ANNOUNCED, NOT LIVE — moves no money |
| **Mastercard Agent Pay** | issuer pilots only | ANNOUNCED, NOT LIVE |
| **L402 / Lightning** (`lightninglabs/aperture`, pushed 2026-09-10) | yes | seller FUNDS-REQUIRED: a funded LND node |

AP2 and TAP are trust/authorization layers, not rails: they move no money. Only **x402** and
**L402** let an independent developer go from clone to received payment.

Note also: **Stripe's MCP server (`mcp.stripe.com`) is a developer tool, not a rail.** It
calls the Stripe API *as you* with your own credentials. It has no "an agent pays you"
capability. Stripe's agent-pays product is Machine payments, and it is 402-based.

---

## 2. Design, against the code that actually exists

Read: `remote/src/index.ts` (2,000 lines), `remote/src/shims/license.ts`,
`remote/src/shims/ctx.ts`, `packages/mcp-license/src/index.ts`.

### What the code gives us

- The hosted worker derives a tenant from the bearer token (`authenticate()`), and an
  anonymous tenant is `anon:<32 hex>` from a token minted at `/mcp/token`.
- A purchase from a hosted connection is bound by the **billing** worker writing
  `bind:<anonToken>` = the minted `MCPL1` key. This worker only ever **reads** it
  (`decideBinding()`), verifies it with the same Ed25519 public key it verifies a pasted key
  with, and runs the request in Pro mode **against the same anonymous document**. This is
  the whole "no key to paste" promise.
- The confirmed constraint holds: **the shim cannot reach KV or the signing key.** The
  `license_activate` path records `ctx().bindKey` and the worker verifies and writes
  `bind:<anonToken>` *after* the tool call returns. Any design needing a verified side
  effect must do the same.

### What an x402 design would have had to look like, and why it was not built

To accept an x402 v2 challenge inside a tool call the worker would have to: issue an
`isError` result carrying `structuredContent` with a `PaymentRequired`; accept a retry
carrying `_meta["x402/payment"]`; call a facilitator's `/verify` and `/settle` **from the
request path** (two outbound HTTPS calls on the caller's clock); and only then run the tool.
Settlement is a verified side effect, so per the constraint above it would be recorded on
`RequestCtx` and acted on in the worker after the call — which for a *pre-payment* gate is
the wrong order: the tool would have to run before the money was confirmed, or the request
would have to round-trip twice.

That is all buildable. It was not built because **`payTo` has no legitimate value.** Every
other field can be filled from constants; `payTo` is a wallet the operator does not have and
that an autonomous agent must not create on his behalf. And with `agent_settleable` demand
at effectively zero, the first paying caller would not have arrived anyway.

### What was built instead

The real discontinuity in this funnel is not "the agent cannot pay". It is **"the assistant
does not know what to say"**. At a free-tier cap the caller received English prose with a URL
buried in it. A model has to parse that sentence to find a price, and nothing tells it
whether trying to pay is even possible. So:

1. **One machine-readable descriptor**, built once and emitted everywhere a price is named.
2. **An MCP `resource`** — `pricing://<product>` — so an assistant can *look up* the price
   rather than remember it.
3. **An MCP `prompt`** — `upgrade_to_pro` — that tells the assistant to quote the resource's
   fields and forbids it inventing a price, a discount, a trial or a refund policy.
4. The descriptor says **`agent_settleable: false`** and **`rails.x402.supported: false`**
   with an explicit "do not retry with a payment payload", so an x402-capable client stops
   immediately instead of retrying into a wall.
5. The one part of the descriptor that follows a real merged convention is the
   **`elicitation`** block: the verbatim `mode` / `message` / `url` parameter shape of a
   URL-mode `elicitation/create` request (§1.2). A client that supports URL mode can lift it
   as-is. No format was invented where one existed; where none existed, the object is
   versioned and namespaced (`zovo.one/mcp-payment-descriptor/1`) so a revived SEP-2007
   replaces it rather than colliding with it.

---

## 3. What was shipped

All changes are in `remote/` and `packages/mcp-license/`. Nothing deployed.

### 3.1 Content negotiation: `Accept: */*` no longer answers 406

*(Assigned mid-task by the orchestrator. Separate defect, same failure class as the
401-on-initialize that had four servers published as DOWN.)*

**Root cause, located.** Not our code. The SDK tests the Accept header with a literal
substring match:

```
node_modules/@modelcontextprotocol/sdk/dist/esm/server/webStandardStreamableHttp.js:468
  if (!acceptHeader?.includes('application/json') || !acceptHeader.includes('text/event-stream'))
```

A substring test is not content negotiation. `*/*` is a media range that admits every media
type including both required ones, and RFC 9110 §12.5.1 says a request with no Accept header
"implies that the user agent will accept any media type". Both were answered 406. `curl`
sends `Accept: */*` by default, so every naive health prober and every hand-typed test of
`initialize` saw a 406.

**Measured before, live, on three servers** (`invoice`, `cash-book`, `pdf` — identical):

| Accept | `initialize` | `tools/list` |
|---|---|---|
| *(no Accept header)* | **406** | 200 |
| `*/*` | **406** | 200 |
| `application/json` | 406 | 200 |
| `application/json, text/event-stream` | 200 | 200 |
| `text/html` | 406 | 200 |

**Both of the orchestrator's questions, answered by measurement:**

1. *Does this path ever use SSE?* **No.** `tools/list` returns 200 JSON on all five variants
   including `text/html`, because the worker answers it from module scope
   (`remote/src/index.ts`, the `tools/list` fast path) and never reaches the transport. The
   transport itself is built `sessionIdGenerator: undefined, enableJsonResponse: true`, and
   in the end-to-end test below every answer's content-type is `application/json`. The
   required `text/event-stream` was never going to be used.
2. *Ours or the SDK's?* **The SDK's.** So it is wrapped, not forked.

**The fix** — `remote/src/accept.ts`, wired at one line in `remote/src/index.ts`:
the worker rewrites the Accept header to the literal the SDK wants **only** when the
caller's Accept genuinely admits both types per RFC 9110 §12.5.1 (specificity-ranked media
ranges, `q=0` honoured, an unparseable `q` read as 0 so a malformed header can only ever be
stricter). Nothing else is loosened. The caller's own Headers object is never mutated, and
`authenticate()` still reads the untouched request — the auth boundary is not involved.

**Measured after**, end-to-end through the real SDK transport (this is a permanent test,
`remote/test/accept.test.mjs`, not a one-off script):

| Accept | before | after | content-type (after) |
|---|---|---|---|
| *(none)* | 406 | **200** | application/json |
| `*/*` | 406 | **200** | application/json |
| `""` | 406 | **200** | application/json |
| `application/json` | 406 | 406 | — |
| `application/json, text/event-stream` | 200 | 200 | application/json |
| `text/html` | 406 | 406 | — |
| `*/*, application/json;q=0` | 406 | 406 | — |

`application/json` alone is deliberately still refused: that client stated it does not accept
event streams, which is a choice, not a wildcard. The suite also reads the SDK's predicate
**out of the installed SDK**, so an SDK upgrade that changes the check fails the suite instead
of silently reintroducing the 406.

### 3.2 The machine-readable payment descriptor

`packages/mcp-license/src/payment.ts` and `remote/src/payment.ts` — **byte-identical**, and a
test on each side asserts it (the hosted shim replaces the package, so it cannot be imported;
this is the same mirroring convention `SERVER_COUNT` already uses). Pure, dependency-free,
no clock, takes every constant as an argument.

Emitted in three places:

- the worker's **429 rate-limit body** (`payment:`), for a free caller only — a Pro caller
  over an hourly ceiling is not being asked for money, so no descriptor is attached;
- **`license_status`** on both transports, under `payment`;
- the **`pricing://<product>` resource** on the hosted endpoints.

Shape (real output, read live from a running server):

```json
{ "schema": "zovo.one/mcp-payment-descriptor/1",
  "status": "informational", "product": "invoice", "tier": "free",
  "price": { "amount": "19.00", "currency": "USD", "model": "one_time",
             "grants": "lifetime Pro on the invoice server", "url": "https://.../buy/invoice?..." },
  "alternative": { "amount": "39.00", "grants": "lifetime Pro on all 31 servers", "url": "..." },
  "checkout": { "processor": "stripe", "completed_in": "browser" },
  "agent_settleable": false,
  "agent_settleable_reason": "... MCP 2026-07-28 defines no payment primitive (SEP-2007 closed unmerged 2026-06-24) ...",
  "rails": { "x402": { "supported": false, "note": "... Do not retry with a payment payload." } },
  "elicitation": { "mode": "url", "message": "...", "url": "..." },
  "human_step": "Open the checkout URL in a browser and pay by card. ...",
  "after_payment": "...", "context_url": "https://mcp.zovo.one/guides/mcp-server-free-vs-pro" }
```

`after_payment` differs by transport and both branches are true of the code: hosted says
"same connection, nothing to paste" because the URL carries the anon token and the billing
worker binds it; stdio says "run `license_activate`". Every checkout URL keeps its
`src=<product>.<tool>` conversion tag, and the bundle offer keeps its own `.bundle` tag, so
the click instrument still separates the $19 and $39 offers.

### 3.3 The `pricing` resource and the `upgrade_to_pro` prompt — hosted only

Registered by the licence-gate shim, so all 30 hosted endpoints get them and **no tool
description changes** (descriptions are a build input for `remote/build-vendor.mjs`;
resources and prompts are not). Both are feature-detected, so a host that only implements
`registerTool` is skipped rather than thrown at.

Verified live on a real stdio server before the scope was narrowed:

```
resources: open-invoices invoices://open | pricing pricing://invoice
prompts:   monthly_invoicing | upgrade_to_pro
pricing://invoice -> {"schema":"zovo.one/mcp-payment-descriptor/1","status":"informational",
                      "agent_settleable":false,"price":"19.00","x402":false,"elicitation_mode":"url"}
```

**Why hosted only.** Registering them on the stdio gate adds one resource and one prompt to
all 31 local servers at once, and **17 suites under `servers/*/test` assert those lists with
`deepEqual`**, while `scripts/gen-spec.mjs` derives docs from the same lists. Measured: doing
it broke exactly those 17 tests. Both fixes live outside my assigned files. The hosted
endpoints are where an assistant meets a cap with no config file to fall back on, so that is
where the surfaces went; a test in `packages/mcp-license/test/` now pins the stdio gate to
its two tools so this cannot be reintroduced by accident.

### 3.4 A pre-existing break in `node remote/build-vendor.mjs`

`build-vendor.mjs` **exited 1 at HEAD**, before any change of mine. Root cause: two patch
sites expected `mkdirSync(dirname(...), { recursive: true })` where `servers/clauses` and
`servers/zip` now call `ensureDirBounded(dirname(...))` — a source change that landed without
the vendor build being re-run. `npm test` does not run `build-vendor`, so the estate read as
green while the worker could not be built or deployed at all.

Enumerated exhaustively (a probe copy of the script that recorded misses instead of throwing
on the first): exactly **two** — `clauses clause_export download`, `zip zip_extract write
loop publishes`. Both expectations updated in `remote/build-vendor.mjs`; the substitution is
mechanical and the vendored replacement drops the directory creation either way, as it did
before. `node remote/build-vendor.mjs` now exits **0**.

---

## 4. Verification

Every claim above has a command behind it.

| What | Command | Result |
|---|---|---|
| vendor build | `node remote/build-vendor.mjs` | **exit 0** (was exit 1 at HEAD) |
| remote suite | `cd remote && node --test test/*.test.mjs` | **51 pass, 0 fail** (30 before this work) |
| licence suite | `node --test packages/mcp-license/test/payment-descriptor.test.mjs` | **11 pass, 0 fail** |
| root suite | `npm test` | 1487 pass, **3 fail** — see below |
| Accept matrix, before | `curl` × 5 Accept variants × 3 servers × 2 methods | table in §3.1 |
| Accept matrix, after | `remote/test/accept.test.mjs`, real SDK transport | table in §3.1 |
| resource + prompt live | stdio spawn of `servers/invoice/dist/index.js` | output in §3.3 |

**The 3 root-suite failures are not from this work and are not in my files.** All three trace
to a `servers/packing-list` directory created at 20:58 today by another agent, mid-flight:
`SERVER_COUNT is 31 but 32 servers build a licence gate`; `PROFILE_READERS drifted from the
grep` (`packing-list` grepped, not declared); `scripts/sync-mirrors.sh does not list
delivery-schedule`. Baseline before this work was 1563 pass / 0 fail. `SERVER_COUNT` lives in
two files I own and would be a one-line bump to 32, but the other two fixes are in
`servers/` and `scripts/`, so it was left to whoever is adding that server rather than raced.

---

## 5. What is still human-gated, with the exact step

1. **Accepting x402 at all.** Blocking step: a person decides whether to self-custody a
   wallet and receive USDC on Base, and supplies the `payTo` address. Everything else is
   free and needs no account (`facilitator.payai.network` serves Base mainnet at HTTP 200
   with no auth and states "No accounts, no API keys, no card on file"). Do not do this
   autonomously, and note that it buys access to a market whose median price is $0.01/call
   while this estate sells at $19 one-time.
2. **Stripe Machine payments / MPP.** Blocking step: Stripe KYC, plus a Coinbase CDP
   account, plus stablecoin approval; for a Poland-resident seller stablecoin access needs a
   manual approval email to `machine-payments@stripe.com`. Out of scope by the no-account
   rule.
3. **`pricing` and `upgrade_to_pro` on the 31 stdio servers.** Blocking step: the same two
   registrations moved into `packages/mcp-license/src/index.ts` (the code is in
   `remote/src/shims/license.ts` and copies across unchanged), plus updating the 17
   `deepEqual` list assertions under `servers/*/test` and re-running `scripts/gen-spec.mjs`.
   Both outside my assigned files.
4. **`/buy/<product>` lands on a bare payment form.** Measured: `curl -sIL
   'https://mcp.zovo.one/buy/invoice?src=probe'` → **HTTP 303 straight to
   `checkout.stripe.com`**, 0 bytes of context. The brief asked for a landing page that
   carries context; `/buy/` is served by `billing/src/index.js`, which A3 owns, so this is
   recorded and handed over rather than changed. The in-session mitigation is shipped: the
   context now lives in the conversation (`pricing://<product>`, `upgrade_to_pro`,
   `context_url`), which for an agent is better than any landing page.
5. **Reviving SEP-2007.** It lapsed on sponsorship, not on technical merit, and `localden`
   explicitly left the door open. If a payment field is ever wanted in `tools/list`, that PR
   is the revival point and `-32402` is the error code to build toward. This is a
   human/community step, not an autonomous one.

---

## Appendix A — the tokenless endpoint: should it self-provision?

*Assigned separately by the orchestrator. Reported separately. **No code was changed.***

### Answer: no. And one premise of the question is factually wrong.

### A.0 Correction: the 401 body already names `/mcp/connect`

The question's candidate fix — "the 401 body should name `/mcp/connect` explicitly, which it
currently does not" — is not true of the code. Measured live, 2026-09-10:

```
POST /mcp/invoice  tools/call  ->  401
  options[0].how : "GET https://mcp.zovo.one/mcp/token, or open https://mcp.zovo.one/mcp/connect for ready-made URLs"
  connect        : "https://mcp.zovo.one/mcp/connect"
```

It names it twice, and has for some time. The funnel agent has since rewritten
`unauthorizedBody()` so that `message` — the one field a client actually surfaces — leads
with `/mcp/connect` and names the exact symptom. That is the right fix and it is already in
the tree. The remaining gap was never "the body does not say"; it was "nothing renders the
body".

### A.1 Does the transport issue or honour `Mcp-Session-Id` today? No.

- `remote/src/index.ts` builds every transport with `sessionIdGenerator: undefined`. The SDK
  is explicit: `if (this.sessionIdGenerator === undefined) { // ... session management is
  disabled }` (`webStandardStreamableHttp.js:726`), and "In stateless mode (no
  sessionIdGenerator), each request must use a fresh transport" (:172).
- Measured: a live `initialize` on `/mcp/invoice` returns **200 with no `mcp-session-id`
  response header at all**, and `protocolVersion: "2025-06-18"`.

Under 2025-06-18 a session id is optional for the server; a client MUST echo one only if the
server issued it. So the carrier is available in principle — but this worker issues none, and
turning it on is not free: Cloudflare isolates hold nothing between requests, so the worker
would have to mint the id and persist the mapping in KV itself. At that point it *is* a
token — just one the user cannot see, cannot save, cannot copy to a second client, and cannot
carry to checkout.

### A.2 What breaks. Three things, and the third is fatal.

1. **The data silently vanishes.** Every one of these servers is a store: state lives at
   `${tenant}:${server}` in KV with a 30-day TTL refreshed on write (`ANON_TTL`), and the
   orphan sweep deletes by the `${tenant}:` prefix after 35 idle days. A tenant keyed to a
   non-resumable session means invoices written in one conversation are unreachable in the
   next, with **no error and no explanation**. A user who is told "unauthorized" can fix it.
   A user whose ledger is empty every morning cannot. That is worse than an honest 401.
2. **The abuse and cost gate disappears.** Today a token costs a deliberate act, capped at
   `TOKEN_MINTS_PER_IP = 10` per hour per IP, and tokenless discovery is separately capped at
   `DISCOVERY_LIMIT = 120`/hour/IP. Self-provisioning on first contact removes the mint gate:
   every prober that POSTs a `tools/call` creates a `tok:` record plus a tenant document with
   a 30-day TTL, reclaimed only after 35 days. Assistant crawlers already sweep this estate
   (311 of 312 URLs).
3. **It breaks the only conversion mechanism that exists.** This is the decisive one. A
   hosted purchase is bound by the billing worker writing `bind:<anonToken>` = the minted
   `MCPL1` key; this worker reads it, verifies it, and runs the request in Pro mode *against
   the same anonymous document*. That binding is what makes the hosted upgrade need no key
   paste — the single thing the checkout URL's `?tenant=` parameter and every cap message in
   the estate promise. A tenant that dies with the session cannot be bound to: the user pays,
   and on the next connection is a different tenant, on the free tier, with their data gone.

### A.3 Does self-provisioning undermine the licence model? Checked in code: no, but see A.2.

The orchestrator's read is right on its own terms. `decideBinding()` and `rateLimit()` key
off `auth.tenant` and `auth.limit` regardless of how the tenant arose; the free tier is
already keyless by design (`/mcp/token` mints to anyone, no account, no email). Nothing about
identity provenance is load-bearing for the caps. The objection is not that a free tenant is
too generous — it is A.2.3: a tenant that cannot persist cannot be *sold* to.

### A.4 The honest alternative for a surface that can only publish one URL

The constraint is real: a registry `remotes[]` entry, a directory row and an awesome-list can
only ever carry `https://mcp.zovo.one/mcp/<server>`. So make that URL end the interaction in
the user's hands rather than in a dead end.

**Recommended, and NOT implemented — it collides with in-flight work.** On a **tokenless
`tools/call` only**, mint a token under the existing per-IP ceiling and return it *in the 401
body* as `ready_to_use: { token, url: ".../mcp/<server>/t/<token>", how }`. This is an
**offer, not a grant**: still HTTP 401, nothing served, and the token is exactly what
`GET /mcp/token` hands to anyone who asks — no new capability, just no scavenger hunt. It
keeps everything A.2 says self-provisioning destroys: the token is visible, savable, portable
to a second client, and bindable at checkout.

Why it is not in the tree: `unauthorizedBody()` and its call site were rewritten by the funnel
agent *during this task*, and `remote/test/unauthorized-body.test.mjs` pins the exact
signature `unauthorizedBody(product: string)` and the exact call-site string
`return json(unauthorizedBody(product), 401,`. Adding a second parameter breaks that suite.
Per the instruction to coordinate before touching what the funnel agent has edited, this is
handed over as a proposal rather than applied. It is ~15 lines: an optional `offer` parameter
spliced into the body, and a mint at the call site guarded by
`!hasCredential && rpc.method === "tools/call"` (a crawler never reaches that branch, because
`initialize` and `tools/list` are already answered tokenless).

Two smaller notes for whoever picks it up:

- The 401 body is **not a JSON-RPC envelope** (`{"error": "unauthorized", ...}`, no `jsonrpc`,
  no `id`). A conforming client parsing the response body as JSON-RPC finds nothing it
  recognises, which is part of why "nothing renders the body". Making it a real JSON-RPC
  error object would conflict with the existing top-level `error` string, so it is a
  deliberate decision, not a one-line change.
- `www-authenticate: Bearer realm="mcp.zovo.one", error="invalid_token"` is already sent.
  Under the MCP authorization spec that header is the hook a client uses to start OAuth
  automatically — the only mechanism that genuinely solves "one URL, many users" for a
  registry. It needs an authorization server, which is a human step, and is out of scope
  here; recorded so it is not rediscovered.
