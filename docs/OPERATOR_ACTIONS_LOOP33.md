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

## 2 and below

Filled in at loop close from the agents' human-gated findings, ranked the same way. Each entry
carries the exact URL, the exact fields, and what it unblocks. An item with no measured value
behind it does not go on this list.
