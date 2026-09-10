# Operator actions, loop 33

The existing `docs/HUMAN_GATED_PACK.md` is 1,037 lines and nobody is going to work through it.
This is the short version: what only a human can do, ranked by measured value, with the exact
step. Everything else in this loop was done autonomously.

Ranking rule: an item earns its place by how much it moves the one number that matters, which
is whether an assistant names one of our servers when asked a buyer's question. That number is
currently **0 of 18**.

---

## 1. npm sign-in. One browser login, unblocks 33 packages.

**Why it is first.** `npx` is the default install command in every MCP client's own
documentation and in most of the twenty competitor repositories an assistant actually cited
this week. We publish zero npm packages, so every "how do I install this" answer about our
servers has to reach for something less familiar. npm weekly downloads: 0, against a target
of 100 per package.

**Why an agent cannot do it.** Proven, not assumed. npm CLI 12.0.2 was upgraded and a real
GitHub Actions OIDC workflow was run twice against the live registry. It returns `ENEEDAUTH`:
npm does not attempt an OIDC exchange unless a trusted publisher is already registered, and
npmjs.com requires a package to EXIST before you can enable OIDC on it. So the first publish
of every package needs one browser sign-in. Verified again today:

    npm whoami
    npm error code E401
    npm error 401 Unauthorized - GET https://registry.npmjs.org/-/whoami

The scope is unclaimed: `https://registry.npmjs.org/@theluckystrike/mcp-invoice` returns 404.

**The step.**

1. In this session's terminal, type: `! npm login --auth-type=web`
2. Complete the sign-in in the browser that opens.
3. Say so, and the publish of all 33 packages runs from `scripts/publish-all.sh` with no
   further human involvement.

Note there is a trap already recorded: do NOT add `registry-url:` to `actions/setup-node`
when testing OIDC, because it writes `_authToken=${NODE_AUTH_TOKEN}` into a temporary .npmrc,
which with no secret expands to the literal placeholder, npm authenticates with junk, and the
OIDC path is never reached. That is why an earlier run looked like a registry rejection when
it was a configuration error.

---

---

## 2. Search Console: make the service account an Owner. One click, and it converts a human step into an autonomous one.

**Why it is second.** It is the only item on this list that gives an agent a capability it does
not have. Google's Indexing API can request crawling directly instead of waiting for a ration,
and it is currently refused:

    403 PERMISSION_DENIED  "Failed to verify the URL ownership"

The service account `zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com` is present on the
property as `siteFullUser`, which can read, and the Indexing API needs `Owner`.

**Why it matters right now.** A full 154-URL inspection census returns 1 indexed, 1 ever
crawled, 115 "Discovered, currently not indexed", and every one of those with
`lastCrawlTime: null`. Google has fetched one page of the site. It has not judged the content
and declined it; it has never looked. Meanwhile 129 of the 429 indexed `zovo.one` pages carry a
followed link into the host and every single one points at the bare root, which is exactly the
one URL that got crawled.

**The step.** Search Console, property `sc-domain:zovo.one`, Settings, Users and permissions,
change that service account from Full to **Owner**.

**Honest expectation.** This is not guaranteed to work. Three deep links placed a day earlier
have live targets that are still uncrawled, and a sibling subdomain shows the same rationing
shape, so this looks like ordinary new-host behaviour rather than something specific that can
be unlocked. The Indexing API is worth having because it is the only lever that asks directly
rather than waiting.

---

## 3. Bing Webmaster sign-in. The only route to the ChatGPT-facing index number.

We now know the site IS in Brave, which is the index Claude's web search retrieves from, at a
depth of exactly one URL of 154. Bing is the index ChatGPT search retrieves from and its number
is **unmeasurable without a sign-in**. Scripted Bing queries cannot prove absence: it ignores
`site:` and answers the head term only, so a zero from it means nothing and was correctly
recorded as unmeasured rather than as absence.

**The step.** `https://www.bing.com/webmasters/`, verify `mcp.zovo.one`, then Settings, API
access, API Key. With the key an agent can read the number without further help.

154 URLs were submitted to IndexNow this loop and accepted, 200 from bing.com, yandex.com,
seznam.cz and naver. Accepted is not indexed, and the re-measure date is 2026-09-24.

---

## 4. A wallet address, only if you want agents to be able to pay.

Agent-native payment was researched and the answer is no for now. The MCP specification has no
payment primitive and the proposal for one closed unmerged. x402 is live and a no-account
facilitator exists, but two things block it: it needs a `payTo` wallet address, which is a
custody decision nobody but you can take, and decisively **no mainstream MCP client settles a
402**, so Claude, ChatGPT and Cursor would each need a separately funded bridge, which is a
larger human step than clicking a link. Median x402 price is a cent per call against a
nineteen dollar one-time product.

**No action recommended.** It is listed so the decision is recorded rather than rediscovered.

---

## 5. One editorial waiver, worth about a paragraph of thought.

`punkpeye/awesome-remote-mcp-servers` is the best-fitting list found this loop: remote-only,
which is exactly what we are, and it merges daily. It needs two things that standing rules
forbid: a per-entry emoji marker, and a star on the repo from the submitting account.

Both are cosmetic rather than paid. If you waive them it is one pull request. If not, it stays
skipped and the rule holds. Either answer is fine; it needs to be yours.
