# NAMING_R5_RESULT.md -- registry ordering mechanism measured, no publish, round 5, 2026-09-05

status: DONE (mechanism measured live; 0 new names published; numbers below explain why)

## Brief

This round targeted 14 capped tokens named in the brief: time, excel, pdf, watermark,
ics, vat, cv, contract, markdown, email, crm, board, dst, nda. Step 1 was to measure the
registry's ordering and paging mechanism and test whether a hypothetical name starting
with "a" could reach page 1. Step 2 was to publish one honest multi-word name per token
only if that measurement said a name could reach page 1. Step 3 was to re-probe and
recompute findable share. Cap: 35 wall minutes, curl -s -m 15 inline, at most 120 total
registry requests, no background jobs, no paid submissions, no emojis, no em dashes.

## Step 1 -- the mechanism, measured

**Ordering.** The registry sorts and paginates strictly by the full server name string
(`<namespace>/<local-name>`), ASCII/case-sensitive, where uppercase A-Z sorts before
lowercase a-z. It is not relevance-ranked and not recency-ranked. Confirmed by paginating
the `pdf` token to exhaustion (`limit=100` + cursor, 4 pages, 323 total records: 100 +
100 + 100 + 23) and finding our own `io.github.theluckystrike/*` entries sit in one
contiguous block at ranks 261-300 -- exactly where alphabetic sort places them, not
scattered by relevance.

**Pagination.** Cursor-based: `metadata.nextCursor` returns `"<name>:<version>"` of the
last row on the page; the next page starts immediately after it. `metadata.count` on
each page is the raw row count returned (up to `limit`), not a distinct-server count --
the same server name recurs once per stored version (e.g. `com.hellobasestation/pdfkit`
appears 3 times on page 1 of `pdf`).

**What `search=` actually matches.** Tested with two controls:
- `search=hellobasestation` (a substring that exists only in a NAMESPACE, not in any
  local name) returned exactly the 3 `com.hellobasestation/pdfkit` records -- proving
  the match scans the full name string, namespace included.
- `search=offline` (a word that appears in our own pdf server's DESCRIPTION -- "all
  offline" -- but not in its registry NAME) returned 3 unrelated servers and did not
  surface ours.

  Conclusion: `search=` matches a substring anywhere in the `name` field only, never the
  description. This matters directly: our invoice and quotes servers both say "VAT" in
  their description text, but neither server's registry NAME contains the substring
  "vat", so neither is findable for `search=vat` today, and adding VAT to a description
  would change nothing.

**The "a" hypothesis, tested and rejected.** A hypothetical name starting with "a" was
proposed as a way to sort first. It cannot, for a structural reason: sort compares the
whole string `<namespace>/<local-name>`, and our namespace segment
(`io.github.theluckystrike`) is fixed and compared BEFORE the local-name segment is ever
reached. Changing the local name only reorders us within our own namespace's cluster; it
cannot move us ahead of any other namespace. Direct evidence: the first 10 results for
`pdf` are `ai.pdfassistant/*`, `app.docwand/*`, `app.replit.*`, `com.allpdfmagic/*`,
`com.docpenny/*` (x2), `com.exactpdf/*`, `com.hellobasestation/*` (x2) -- every one of
those namespaces (`ai.*`, `app.*`, `com.*`) sorts before `io.github.theluckystrike/*` as
a whole string regardless of what follows our slash. An "a"-prefixed local name on our
namespace would still read `io.github.theluckystrike/aaa...`, which sorts after all of
those, unchanged.

**Page-1-reach test, per token.** For each capped token (page-1 count == 100 with a
`nextCursor`, meaning more than 100 total records exist), the test is: does our fixed
namespace prefix `io.github.theluckystrike/` sort before the 100th (last) name currently
shown on page 1? If not, at least 100 records already precede us for that token and no
local name can change that -- because only the local name is ours to choose, and the
comparison never gets past the namespace segment before losing.

| token | page1 count | capped (>100 total)? | our rank | 100th name on page 1 | our prefix beats it? | new name can reach page 1? |
|---|---|---|---|---|---|---|
| time | 100 | yes | none | io.github.I4cTime/q-ring | no | no |
| excel | 100 | yes | none | io.github.sbroenne/mcp-server-excel | no | no |
| pdf | 100 | yes (323 total) | none on page1 (rank 261 of 323) | io.github.Nizoka/pdfnative-mcp | no | no |
| watermark | 35 | no | 28 | -- (uncapped) | -- | already on page 1 (from an earlier round) |
| ics | 100 | yes | none | com.olympus-bets/olympus-bets-analytics | no | no |
| vat | 100 | yes | none | io.github.privatelawattorneys/wiki-private-law | no | no |
| cv | 100 | yes | none | io.github.musharna/plantcv-mcp | no | no |
| contract | 100 | yes | 93 | -- | -- | already on page 1 (from an earlier round) |
| markdown | 100 | yes | none | io.github.pvliesdonk/markdown-vault-mcp | no | no |
| email | 100 | yes | none | io.github.blipemail/email | no | no |
| crm | 75 | no (75 total) | none | -- (uncapped) | -- | yes, structurally -- see below |
| board | 100 | yes | none | co.pipeboard/meta-ads-mcp | no | no |
| dst | 100 | yes | none | io.github.mindstone/mcp-server-google-workspace | no | no |
| nda | 100 | yes | none | dev.futur-panda/laguarde | no | no |

11 of the 14 tokens (time, excel, pdf, ics, vat, cv, markdown, email, board, dst, nda)
are structurally unreachable: each already has 100+ records sorting before
`io.github.theluckystrike/*`, confirmed by direct comparison against the 100th entry
currently on page 1. No possible local name changes that outcome.

`crm` is the one exception: its total pool is only 75 records (uncapped, no
`nextCursor`), so page 1 shows the entire corpus and a new record from us WOULD appear on
page 1 by definition. Computing the insertion point against the full 75-name sorted list
(our record would land between `io.github.theYahia/retailcrm-mcp` and
`io.studiomeyer/crm`, since uppercase `Y` sorts before lowercase `t` in `theYahia`, and
`io.github` sorts before `io.studiomeyer`) puts us at rank 72 of 76 -- p = min(1, 10/72)
= 0.139. Reachable, but marginal, and moot: no server we ship honestly does customer
relationship management. Invoice, quotes and bank-statement bill and track already-named
clients; none manages a contact pipeline, deal stages or relationship history. Naming one
of them "crm" would be a false claim, not an honest fit, so it is excluded on the same
honesty rule NAMING_R4 used to exclude `sepa`.

`watermark` (rank 28 of 35) and `contract` (rank 93 of 100) already carry a match from
earlier rounds (image/thumbnails-era and clauses/terms-era variants respectively) -- they
are not empty slots this round, so there is nothing new to publish against them.

## Step 2 -- publish decision

Zero new names published. The measurement in the table above shows conclusively that 11
of the 14 tokens cannot be reached by any local name under our fixed namespace, 2 already
have a match from earlier rounds, and the 1 structurally-reachable exception (`crm`) has
no honestly-fitting server to attach it to. Per the brief's own conditional ("If the
measurement shows names cannot reach page 1 on capped tokens, publish nothing and say so
with the numbers"), nothing was published this round.

## Step 3 -- re-probe and findable share

Since nothing was published, before and after are identical by construction; the
re-probe was run anyway to confirm no external drift occurred during the round.

Using the NAMING_R4 formula (p = min(1, 10/our_rank) if matched on page 1 else 0, mean
over the token set) applied to just these 14 tokens:

- Matched: 2 of 14 (watermark p=0.357, contract p=0.108; all other 12 are 0)
- **Findable share over the 14-token set: 3.32%, before and after (unchanged)**

The full 100-token tracked set's findable share (measured in INTEL_R8 on 2026-09-04 at
51.26%, 74 of 100 matched) is also unchanged this round, since none of its inputs
changed.

## Files

- `data/naming_r5.json` (method, per-token page-1-reach test, findable share)
- `docs/NAMING_R5_RESULT.md` (this file)
- No new `servers/<x>/server.<slug>.json` files (nothing honest and reachable to publish)
- No `data/distribution.json` changes (no new registry names)

## RESULT.md schema block

```
status: DONE
evidence: Measured the registry's ordering (full-name ASCII sort, case-sensitive),
  pagination (cursor = last name:version), and search matching (substring on the NAME
  field only, confirmed via a namespace-only-substring positive control and a
  description-only-substring negative control) via bounded curl GETs. Tested the "name
  starting with a" hypothesis directly against pdf's first 10 results and rejected it:
  the namespace segment is fixed and compared before the local-name segment, so no local
  name can move us ahead of another namespace. For each of the 14 capped tokens, compared
  our namespace prefix against the 100th (last) name on page 1: 11 of 14 are structurally
  unreachable (100+ names already precede us regardless of local name); 2
  (watermark, contract) already have a match from earlier rounds; 1 (crm) is reachable
  (uncapped, 75 total, computed insertion rank 72 of 76) but has no honestly-fitting
  server.
artifacts: data/naming_r5.json, docs/NAMING_R5_RESULT.md
cost: well under 35 wall minutes; approximately 20 registry GETs total (curl -s -m 15,
  sequential, no background jobs); zero paid APIs; zero paid submissions
failures: none blocking; 0 new names published this round by design, per the brief's own
  conditional on the measurement
insight: the registry's search is a flat name-substring-plus-alpha-sort, not a
  relevance engine, and our namespace segment (io.github.theluckystrike) is itself the
  dominant factor in whether we can ever appear on page 1 for a generic single-word
  token -- for most such tokens, over 100 unrelated names already sort ahead of our
  namespace string alone, before the chosen local name is even considered. The naming
  lever therefore only works on tokens with a small enough total pool (well under 100)
  or where fewer competing namespaces happen to sort ahead of ours for that specific
  word; multi-word novelty in the local name cannot overcome a namespace-level deficit.
```
