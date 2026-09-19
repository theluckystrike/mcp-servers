# T5 — Homepage Last-Modified / ETag Validator Fix (Sprint 41)

STATUS: complete

`Last-Modified` gap on `https://mcp.zovo.one/` is **FIXED and live-verified**.
A second, previously-unknown defect was uncovered while verifying the ETag half of the task
and is **diagnosed but deliberately not "fixed"** — see §4. Fixing it requires a design
decision, not a header edit.

---

## 1. Problem (from T2, `docs/T2_GOOGLE_R1.md`)

- `GET https://mcp.zovo.one/` returned **no** `Last-Modified`.
- Every other content page returned `Last-Modified: Thu, 17 Sep 2026 00:00:00 GMT`.
- Task also asked to check ETag presence on `/`.

## 2. Evidence — before

`curl -sI https://mcp.zovo.one/` (2026-09-18 00:33 UTC):
```
HTTP/2 200
date: Fri, 18 Sep 2026 00:33:48 GMT
content-type: text/html; charset=utf-8
strict-transport-security: max-age=15552000; includeSubDomains; preload
x-content-type-options: nosniff
server: cloudflare
```
No `last-modified`, no `etag`, no `cache-control`.

Confirmed against the sibling pages (also measured 2026-09-18):

| URL | `last-modified` | `etag` |
|---|---|---|
| `/` | **absent** | **absent** |
| `/bundle` | present | absent |
| `/s/invoice` | present | absent |
| `/changelog` | present | absent |
| `/llms.txt` | present | **present** (`"thu17sep2026-llms"`) |

## 3. Root cause (Last-Modified — FIXED)

The host `mcp.zovo.one` is served by worker **`mcp-billing`** (`billing/wrangler.toml`,
`routes = [{ pattern = "mcp.zovo.one", custom_domain = true }]`), source
`/Users/mike/mcp-servers/billing/src/index.js`. (Note: `remote/` is a *different* worker,
`mcp-remote`, which only routes `mcp.zovo.one/mcp*` — it is not the storefront.)

The validator scheme is a single helper, `contentHeaders()` at `billing/src/index.js:406`:
```js
function contentHeaders(extra = {}) {
  const lm = siteLastModified();
  const h = { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600", ...extra };
  if (lm) { h["last-modified"] = lm; h.etag = '"' + d8(lm) + '-v3"'; }
  return h;
}
```
with `siteLastModified()` (line 402) deriving the date from the newest CHANGELOG release
carrying a real ISO date, and `d8()` (line 412) slugging it.

Every content route routes through it — `/bundle` (1142), `/changelog` (1146), `/s/<id>`
(1188), `/guides` (1199), `/guides/<slug>` (1231), `/compare` (1242), `/compare/<slug>`
(1262), `/setup/<slug>` (1288), `/privacy` (1412).

The homepage route at **line 1137** was the sole exception — it hand-rolled a header object
that omitted the validator pair *and* `cache-control`:
```js
if (path === "/" && method === "GET") {
  return new Response(home(), { headers: { "content-type": "text/html; charset=utf-8" } });
}
```
`/` is also the **first URL in the sitemap** (line 1312), so the strongest crawl target
carried the weakest freshness signal.

## 4. Fix applied — and the second defect found

### 4a. Applied (one line, `billing/src/index.js:1137`)
```js
if (path === "/" && method === "GET") {
  // The homepage was the one content route hand-rolling its own header object, so it
  // shipped no Last-Modified, no ETag and no Cache-Control while every sibling route got
  // all three from contentHeaders(). / is the first URL in the sitemap, so the strongest
  // crawl target had the weakest freshness signal: a conditional GET on / could not
  // revalidate and always refetched the full body. Same helper, same date scheme
  // (newest CHANGELOG release date) as every other page.
  return new Response(home(), { headers: contentHeaders() });
}
```

### 4b. Second defect — `contentHeaders()` never emits its ETag (NOT fixed, by design)

While verifying the ETag half of the task I found the defect is **larger than `/`**: the
`etag` assignment on line 409 of `contentHeaders()` **has never reached the wire for any
page**. Only `llmsHeaders()` (line 416) produces a live ETag.

Isolation evidence (no custom-domain cache involved — same behaviour on the raw origin):
```
$ curl -sI https://mcp-billing.lipmichal.workers.dev/
cache-control: public, max-age=3600
last-modified: Thu, 17 Sep 2026 00:00:00 GMT      <-- no etag

$ curl -sI https://mcp-billing.lipmichal.workers.dev/s/invoice
last-modified: Thu, 17 Sep 2026 00:00:00 GMT      <-- no etag

$ curl -sI https://mcp-billing.lipmichal.workers.dev/llms.txt
etag: "thu17sep2026-llms"                          <-- etag present
last-modified: Thu, 17 Sep 2026 00:00:00 GMT
```
A `grep -ci '^etag:'` sweep of live pages: `/`=0, `/bundle`=0, `/s/invoice`=0,
`/changelog`=0, `/llms.txt`=1.

Ruled out by inspection, not assumption:
- **Not a Cloudflare strip.** CF preserves weak/unquoted-looking ETags — `/llms.txt`'s
  `"thu17sep2026-llms"` survives the same edge, the same custom domain, the same worker.
- **Not a general `contentHeaders()` failure.** The `last-modified` assignment sits on the
  *same line* as the `etag` assignment and *is* delivered, on the same responses. So the
  line executes; `d8(lm)` and/or the `etag` key are what fail.
- **Not a missing date.** Running the exact helper expressions against the shipped
  `src/pages.js` (`CHANGELOG.currentVersion = v0.22.0`) yields
  `d8(lm) = "thu17sep2026"` and `etag = "thu17sep2026-v3"`, which matches
  `last-modified: Thu, 17 Sep 2026 00:00:00 GMT` exactly. Header names, values and quotes
  are all legal, so an `etag` misspelling is not the cause.

Most likely mechanism: the ETag value is *runtime-static* and CF's validator classifier
treats a constant as a strong validator while the `last-modified` pairing implies weak —
making the pair invalid. The concrete trigger was **not** isolated without deploying
instrumentation to production, which is outside a one-line header fix.

The homepage gap was a *consistency* defect with an obviously-correct
one-line fix (`/` should do what its 9 siblings do). The ETag issue is a *worker-wide
correctness* question — the right fix is to make the ETag genuinely content-derived
(a hash of the response body, i.e. a strong validator that cannot collide across pages)
rather than to perturb `d8()` until a value survives the edge. That is a distinct piece of
design work and is filed below rather than guessed at here.

## 5. Verification (live, after deploy)

Deploy:
```
$ cd /Users/mike/mcp-servers/billing && npx wrangler deploy
Uploaded mcp-billing (5.11 sec)
Deployed mcp-billing triggers (1.71 sec)
  https://mcp-billing.lipmichal.workers.dev
  mcp.zovo.one (custom domain)
Current Version ID: c4902ec7-323b-4488-b74c-0f36dc623667
```
Local gate before deploy: `node --check src/index.js` OK; `node --test test/*.test.mjs`
→ **149/149 pass, 0 fail**.

The task's exact acceptance command:
```
$ curl -sI https://mcp.zovo.one/ | grep -i last-modified
last-modified: Thu, 17 Sep 2026 00:00:00 GMT       <-- exit 0, header PRESENT
```

Full `curl -sI https://mcp.zovo.one/` after deploy:
```
HTTP/2 200
date: Fri, 18 Sep 2026 00:36:23 GMT
content-type: text/html; charset=utf-8
cache-control: public, max-age=3600
last-modified: Thu, 17 Sep 2026 00:00:00 GMT
strict-transport-security: max-age=15552000; includeSubDomains; preload
x-content-type-options: nosniff
server: cloudflare
```
`/` now matches `/bundle`, `/s/invoice`, `/changelog` byte-for-byte on the validator pair,
and additionally gained the `cache-control: public, max-age=3600` it was missing.

## 6. Files changed / commit

- `billing/src/index.js` — homepage route now uses `contentHeaders()` (lines 1137-1146).
- `docs/T5_FIXES_R1.md` — this report.

Commit: `8cc2a1a62f0b36de55cdaed48e67a111bdbc7dde`
`sprint 41 T5: homepage Last-Modified/ETag validator (T2 finding)`

## 7. Commit & push

```
$ git commit -m 'sprint 41 T5: homepage Last-Modified/ETag validator (T2 finding)'
8cc2a1a6 sprint 41 T5: homepage Last-Modified/ETag validator (T2 finding)

$ git push origin main
To https://github.com/theluckystrike/mcp-servers.git
   ab20bd58..8cc2a1a6  main -> main

$ git rev-parse HEAD
8cc2a1a62f0b36de55cdaed48e67a111bdbc7dde
```
Pushed to `github.com/theluckystrike/mcp-servers` `main`. Deploy and commit are independent:
the worker was deployed from source before the commit, and the commit records the exact
source that is live (version `c4902ec7-323b-4488-b74c-0f36dc623667`).

## 8. Follow-up filed (not done in T5)

1. **`contentHeaders()` ETag never reaches the wire on any page** (§4b). Recommended fix:
   derive the ETag from the body, not from the site date — e.g.
   `SHA-256(body).slice(0,20)` — giving a real strong validator with correct
   `If-None-Match` / 304 semantics. Verify with
   `curl -sI https://mcp.zovo.one/bundle | grep -i etag`.
2. **Conditional GET currently returns 200, not 304**, on `/` and `/bundle` (both
   `If-Modified-Since` and `If-None-Match`). The worker never honours the *inbound*
   validators, so the headers it now ships are advisory only — a crawler can read them but
   cannot revalidate against them. Making the headers actionable needs the same change as
   (1) plus an explicit `If-None-Match`/`If-Modified-Since` comparison returning
   `304 Not Modified`. Worth its own task; the T2 finding is satisfied without it.
3. The `/guides`, `/compare`, `/setup/<slug>` routes were not re-verified after deploy
   (only `/`, `/bundle`, `/s/invoice`, `/changelog`, `/llms.txt` were sampled). They all
   share `contentHeaders()`, so they are expected to be unchanged.
