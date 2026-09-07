# The registry namespace experiment (2026-09-07)

## What was proven

Domain-authenticated publishing to the MCP registry works from this machine with no human
step. Measured end to end:

    $ curl https://mcp-billing.lipmichal.workers.dev/.well-known/mcp-registry-auth
    v=MCPv1; k=ed25519; p=KY+O0ut45badUE3n6TtwlXj09gkKnTd+/pkY56Y0A9Q=

    $ mcp-publisher login http --domain mcp-billing.lipmichal.workers.dev --private-key <hex>
    ✓ Successfully logged in

The granted token carries:

    auth_method: http
    auth_method_sub: mcp-billing.lipmichal.workers.dev
    permissions: [{ action: publish, resource: dev.workers.lipmichal.mcp-billing/* }]

So the registry grants publish rights on the namespace formed by reversing the verified
domain. The verification file is now served by the billing worker on both mcp.zovo.one and
the workers.dev hostname, from one route in billing/src/index.js.

## Why it matters

Registry search matches the name only and returns results in strict ASCII order on the
whole `namespace/local-name` string. That was verified on every token tested by checking
`names == sorted(names)` against the live API, so a rank prediction is arithmetic on real
data, not an estimate.

Rank the first row of each namespace would take, measured against the live result set:

| Token | `com.<domain>` | `dev.pages.<x>` | `io.github.theluckystrike` | Rows on page 1 |
|---|---|---|---|---|
| schedule | 3 | 7 | 60 | 62 |
| delivery | 2 | 2 | 25 | 27 |
| excel | 3 | 6 | 101 | 100 |
| pdf | 6 | 39 | 101 | 100 |
| time | 17 | 45 | 101 | 100 |
| invoice | 36 | 52 | 86 | 100 |

A rank of 101 out of 100 means the server does not appear on page one at all. So on four
of these six tokens the current namespace is invisible, and a `com.` namespace would put
the same servers in the top six on three of them.

This does not contradict the earlier finding that naming is exhausted at about 51 percent
findable share. That measurement held the namespace fixed and it is correct within
`io.github.theluckystrike`. The namespace is the axis it did not vary.

## What blocks it, precisely

Only the choice of domain, and only because of one missing credential scope.

The Cloudflare API token on this machine (`CLOUDFLARE_API_TOKEN` in the shell profile)
can read zones and deploy Workers, but cannot write DNS records or Workers routes:

    POST /zones/<id>/dns_records        -> 10000 Authentication error
    POST /zones/<id>/workers/routes     -> 10000 Authentication error

The wrangler OAuth token holds `zone:read` but no DNS scope, and it expired 2026-04-24.
The Cloudflare account is at its Pages project limit, so a fresh `<name>.pages.dev` cannot
be created either. No registrar API credential (Porkbun, Namecheap, GoDaddy) exists on this
machine.

The one namespace reachable today is `dev.workers.lipmichal.mcp-billing`, and it should not
be used. It would rank far better than the current one, but it publishes an auto-generated
handle derived from the operator's email as the public identity of the whole fleet, against
the standing rule that the public identity is always theluckystrike.

## The single action that finishes this

Create a Cloudflare API token with **Zone → DNS → Edit** on one zone, and put it in the
shell profile as `CLOUDFLARE_DNS_TOKEN`. Then `scripts/namespace-claim.sh <domain>` does
the rest with no further input: it writes the TXT record, logs in, and prints the granted
namespace.

Recommended zone, on two grounds. Rank: any `.com` the operator already holds sorts in the
same block, and the second label barely moves it, so `com.abwex` and `com.b2berp` are within
one place of each other. Coherence: `b2berp.com` reads as a back-office brand and this is a
back-office fleet, so `com.b2berp/invoice-pdf-billing-generator` is honest to a reader.
`bestremotetools.com` is the alternative if a tools framing is preferred.

## How to roll it out when the decision is made

Do not migrate the catalogue. Publishing 118 manifests a second time under a new namespace
doubles the estate's footprint on the one channel that delivers humans, and duplicate rows
compete with each other in the same sorted list. Publish one server under the new namespace
only, leave it a fortnight, and compare its measured rank and its referral traffic against
the `io.github` row for the same server. `data/traffic.json` and the GitHub referrer API
both already separate registry-sourced visits, so the comparison is measurable.
