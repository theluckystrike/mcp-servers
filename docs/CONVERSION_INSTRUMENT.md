# Conversion instrument: cap message -> click -> checkout session

Every free-tier cap message on every server (stdio and hosted) ends with an upgrade
link. Before this instrument, nothing separated "the message was never read" from
"the message was read and the link did not convert" - both looked like zero. This
document is the click counter that sits between the two.

## The tag: `src=<product>.<tool-or-slug>`

Every `/buy/<product>` link a cap message produces now carries a `src` query
parameter, `<product>.<slug>`, for example `src=pdf.custom_stamp_text` or
`src=time-tracker.rate_limit`.

- `<product>` is the server id, already known at every gate call site.
- `<slug>` is either an explicit tool name passed to `upgradeText(feature, toolName)`,
  or, when the call site does not pass one, the `feature` text itself, slugified
  (`slugifySrc`: lowercase, non-alphanumeric runs collapsed to `_`, trimmed, capped at
  60 chars, empty falls back to `unknown`). Either way every distinct cap message gets
  a stable, traceable tag with no per-call-site rollout required - the majority of
  existing `gate.upgradeText("...")` calls across the servers were left unchanged and
  still tag correctly from their feature text (`gate.upgradeText("statement_export")`
  tags `bank-statement.statement_export`; `gate.upgradeText("custom stamp text")` tags
  `pdf.custom_stamp_text`). New call sites, or ones that want a tag distinct from their
  prose, pass the tool name explicitly as the second argument.

Implemented in two places with the same slug rule:
- `packages/mcp-license/src/index.ts` - `slugifySrc`, `hostedUpgradeText(feature,
  product, tenant, toolName?)`, and `gate.upgradeText(feature, toolName?)` for the
  stdio gate. `license_status`'s `upgradeUrl` is unchanged (not a cap message).
- `remote/src/shims/license.ts` - the same `slugifySrc` and `upgradeText`, plus
  `buyUrl(product, src?)` / `bundleUrl(src?)` so the hosted `?tenant=` link also
  carries `&src=`.
- `remote/src/index.ts`, the 429 rate-limit response (`rateLimit`): the tool has not
  been parsed off the request body yet at that gate, so the tag is product-level,
  `<product>.rate_limit`.

## The counter: billing worker, `/buy/<product>`

`billing/src/index.js`, the `/buy/<product>` route, before the 303 redirect to
Stripe Checkout:

1. Reads `?src=`. A well-formed tag matches `validSrc` (`^[a-z0-9][a-z0-9._-]{0,90}$`
   - lowercase, digits, dot, underscore, hyphen; no colon, so it can never collide with
     the `click:<src>:<day>` key separator). A missing or malformed tag falls back to
     `<product>.unknown` rather than being dropped, so every click is still counted.
2. Skips the same requests the Stripe metadata probe tag already excludes: the
   existing `probeTag` (an explicit `x-mcp-probe: 1` header, or a scripted user agent -
   curl/python/node/wget/go-http/undici/axios/httpie/empty). One flag, one exclusion
   rule, reused rather than duplicated.
3. Otherwise, `ctx.waitUntil(recordClick(env, src))` - off the redirect's critical path,
   the same pattern the hosted rate limiter already uses for its counter write.

`recordClick` writes two KV entries in **REMOTE_DATA** (not LICENSES):
- `click:<src>:<yyyy-mm-dd>` - a daily bucket, `expirationTtl` 120 days, read-then-write
  (the same already-accepted approximate-under-concurrency counter the hosted rate
  limiter uses; an undercount from two simultaneous clicks landing on the same src in
  the same second is not a new failure mode).
- `click:<src>:total` - no TTL, a running lifetime count.

**Why REMOTE_DATA, not LICENSES**: clicks are hosted-traffic telemetry, the same
bucket `rl:`, `tok:`, `anon:`, `bind:` counters already live in, not a licensing
record. LICENSES stays reserved for `session:` and `lic:` keys the mint path depends
on, so a telemetry write can never race a fulfilment write in the KV namespace that
actually gates who is Pro.

## The read: `GET /stats/clicks`

Plain JSON, no auth - the counters carry no personal data, only a src tag and a
count. `cache-control: no-store`.

```json
{
  "generated_at": "2026-09-04T12:00:00.000Z",
  "by_src": {
    "pdf.custom_stamp_text": { "total": 12, "last7d": 3 },
    "time-tracker.rate_limit": { "total": 5, "last7d": 5 }
  },
  "total_clicks": 17,
  "clicks_7d": 8
}
```

`clickStats` walks `REMOTE_DATA.list({ prefix: "click:" })` (a real runtime KV
binding call, not only a `wrangler kv key list --remote` CLI feature - this endpoint
works from a live request), and for every key reads either the `total` bucket
verbatim or adds the daily bucket into `last7d` when its date falls in the trailing
7 days from the current UTC day. Buckets older than 7 days are skipped entirely, not
just excluded from `last7d` - they never get a KV read.

## KPI rows (`scripts/kpi.mjs`)

Two new Monetization rows, fed by a `fetch("https://mcp.zovo.one/stats/clicks")`
alongside the script's existing Stripe and KV calls:

- **Upgrade link clicks (humans, 7d)** - `clicks_7d` summed across every src.
- **Click to checkout-session ratio** - `100 * human_sessions / clicks_7d` as a
  percentage. This mixes two windows (`human_sessions` is the last 100 Stripe
  checkout sessions ever created, `clicks_7d` is a genuine trailing 7 days), so it is
  documented as an approximation, not a window-matched ratio - the same caveat the
  script already carries on `Pro tenants on hosted endpoints`. Fixing it properly
  needs Stripe session timestamps filtered to the last 7 days, which is a follow-up,
  not blocking: the ratio is still directionally useful as-is (a link with clicks and
  no sessions points at the redirect or Stripe page, not the message).

## Tests

- `packages/mcp-license/test/click-instrument.test.mjs` - `slugifySrc`, that
  `gate.upgradeText` tags the stdio buy link with `src=<product>.<slug>`, that an
  explicit tool name wins over the feature text, and that `hostedUpgradeText` keeps
  both `tenant=` and `src=`.
- `billing/test/clicks.test.mjs` - `validSrc` boundary cases (including the colon
  rejection that protects the KV key format), `recordClick` against an in-memory KV
  mock (daily bucket and total both increment, independently per src), and
  `clickStats` (aggregation, the 7-day cutoff, and the empty case).

## Verified live, 2026-09-04

Deployed `billing` (`npm run deploy`) and `remote` (`npx wrangler deploy`, vendor tree
already current) first, then, against the live endpoints:

1. Minted an anonymous hosted token: `GET https://mcp.zovo.one/mcp/token` ->
   `anon_f12050163e7a09da3ed58e0a1acc3602`.
2. `POST /mcp/time-tracker` `tools/call` `entry_list` with `from: "2020-01-01"` (outside
   the 7-day free window, with no entries stored) tripped the free-tier cap on the
   first call and returned:
   > "No entries found.\n\nNote: the free tier shows the last 7 days. ... Buy at
   > `https://mcp.zovo.one/buy/time-tracker?tenant=anon_f12050163e7a09da3ed58e0a1acc3602&src=time-tracker.full_history`
   > - that link carries your token, ..."

   (the rate-limit 429 was also confirmed reachable in principle - `RATE_LIMIT_FREE` is
   600 calls/hour, too high to trip inside this budget, so the per-tool cap above is
   the one actually exercised end to end.)
3. Baseline: `GET https://mcp.zovo.one/stats/clicks` -> `{"by_src":{},"total_clicks":0,"clicks_7d":0}`.
4. `GET` the tagged link above with a real browser `User-Agent` (Chrome on macOS, not
   curl's default UA, so the click was not treated as scripted) -> `303` to a live
   `checkout.stripe.com/c/pay/cs_live_...` session.
5. `GET /stats/clicks` again: KV write propagation took about 10 seconds (confirmed
   unchanged at t+0s, then present at t+10s and every 10s poll through t+60s):
   `{"by_src":{"time-tracker.full_history":{"total":1,"last7d":1}},"total_clicks":1,"clicks_7d":1}`.

## Update 2026-09-04: the slug is the tool, and the storefront is tagged

The first cut let a call site fall back to the slugified feature prose. That was stable
and traceable, but it could not answer "which tool produced this message", and the
storefront's own links carried no `src` at all - which is where the `recurring.unknown`
and `resume.unknown` rows on `/stats/clicks` came from.

**Servers.** `scripts/codemod-upgrade-src.mjs` passes the enclosing `registerTool` name as
the `toolName` argument to every `gate.upgradeText` / `gated` call inside a handler: 73
call sites across 19 servers. It masks strings, template literals, comments and regex
bodies in one pass, then uses paren matching for the handler spans, and is idempotent - a
call that already names a tool is never touched. Four servers kept their cheapest gate in
a shared helper (`barcode`'s `reserve`/`tierCheckFormat`, `zip`'s `reserveSlot`,
`image`'s `proSizeCheck`/`proBatchCheck`, `spreadsheet`'s `writeCapRefusal`); the tool name
is threaded through those signatures by hand.

38 call sites are deliberately left on the feature-text slug and listed by the codemod:
they sit in helpers shared by several tools (`pdf`'s `freePageText`, `time-tracker`'s
free-window note, `bank-statement`'s `windowNote`), where no single tool name is correct
without threading a parameter through code that has no other reason to change.

**Contract.** Two halves. `test/upgrade-src-contract.test.mjs` runs the codemod in
`--check` mode over all 20 servers, so a new untagged in-handler gate fails on the day it
is written. The nine per-server contract suites that already trip a real cap assert the
returned message carries `https://mcp.zovo.one/buy/<product>?src=<product>.<tool>` for the
tool that produced it, at no extra server spawn.

**Storefront.** Every `/buy` href the billing worker renders carries `src=store.<page>`:
`store.home`, `store.s.<id>` (product page CTA, JSON-LD offer url, and the README-derived
links, which `scripts/build-pages.mjs` tags at build time so the 19 READMEs stay
untouched), `store.guide.<slug>`, `store.compare.<slug>`, `store.setup.<client>`. Guides,
comparisons and setup pages had no `/buy` link at all before this, so nothing they earned
could be attributed; each now carries one tagged CTA. `billing/test/store-src.test.mjs`
fails on any untagged `/buy` href and checks the emitted tags pass `validSrc`.

**Vendor tree.** Two `remote/build-vendor.mjs` patches were anchored across a call the
codemod changed and stopped applying. Both are re-anchored on the prose they rewrite;
`node remote/build-vendor.mjs` prints zero DRIFT.

Verified live after deploying billing and remote: `store.home`, `store.s.pdf`,
`store.setup.claude-desktop`, `store.guide.invoice-pdf-from-chat` and `store.compare.pdf`
all render on the live site, and `node scripts/validate.mjs` is 471/471.
