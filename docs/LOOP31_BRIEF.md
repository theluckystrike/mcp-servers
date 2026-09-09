# Loop 31 brief (2026-09-09)

Loop 29 and 30 briefs still apply. This records what is new and what it changes.

## Where the audience actually is, unchanged and now stable across three days

The official MCP registry is the only channel that measurably delivers people: 21 of the
project's 48 GitHub views in 14 days and 10 of its 25 unique visitors. Assistant crawlers
have reached 100 percent coverage of the sitemap and produced 3 user-initiated fetches and
0 referrals in six days. Google has discovered 66 of the pages and indexed none. Stars are
still 0. Do not propose building more servers; the constraint is being found, not supply.

## The lever discovered this loop, and it is the best one available

Glama publishes its scoring formula in full on every server's score page, and this project
has exactly one server indexed there, mcp-statement-of-account, sitting at 75 percent.

    Overall = Tool Definition Quality (70%) + Server Coherence (30%)
    Tool Definition Quality per tool, 1-5, over six dimensions:
      Purpose Clarity 25%, Usage Guidelines 20%, Behavioral Transparency 20%,
      Parameter Semantics 15%, Conciseness and Structure 10%, Contextual Completeness 10%
    Server score = 60% MEAN of tool scores + 40% MINIMUM of tool scores
    Server Coherence: Disambiguation, Naming Consistency, Tool Count, Completeness

Read the weighting again: **40 percent of the score is the single worst-described tool.**
Our indexed server averages 3.7 with a lowest of 2.9, and is graded B on definitions and
A- overall on coherence, held down by that minimum.

This matters beyond Glama. A tool description is what an assistant reads when deciding
whether to call a server, so the same text is the product's first impression in every
client. It is also entirely within our control, needs no account, no credential and no
human, and applies to all 32 servers rather than to one listing.

Named gaps on the indexed server, quoted from its own score page:
- Disambiguation 4/5: statement_aging and statements_report both cover aged receivables.
- Naming Consistency 4/5: suffixes mix verbs, gerunds and nouns.
- Completeness 4/5: no batch generation, no explicit client listing.
- Maintenance C: "No stable releases found", and it reports the latest release as v0.14.0
  while the project is at v0.21.0. Worth checking why Glama sees a stale version.

## Hard rules, in addition to earlier loops

1. A tool description must describe what the tool actually does. Improving a score by
   overstating behaviour is a defect, not a win. Every claim must be checked against the code.
2. Never change a tool NAME without checking every caller: office-suite proxies all 31
   servers, other servers hand payloads to each other by tool name, and the validation
   database asserts specific names. A rename is a breaking change to a published product.
3. No paid APIs, no paid listings, no accounts, no OAuth sign-in.
4. Own only your assigned files. Do not deploy; the orchestrator deploys.
5. Every number names the command or file it came from.

## Coupling discovered mid-loop: descriptions are load-bearing in two places

`remote/build-vendor.mjs` vendors each server's source into the hosted worker and applies
about 113 exact-string patches while doing so. Several match a tool's `description`
verbatim, because the hosted copy must say something different: the local zip server says
"List the archives this server created", the hosted one says "created for your token",
since a hosted tenant has no data directory.

Those patches throw on a failed match. Editing a description in `servers/<name>/src` without
updating its counterpart breaks the hosted build:

    Error: patch did not apply: zip zip_history description

So the rule for anyone editing tool text: grep `remote/build-vendor.mjs` for the tool first,
using `/usr/bin/grep` because plain `grep` is shadowed here and can silently return nothing,
and update both sides. `node remote/build-vendor.mjs` exiting cleanly is the check that
proves the hosted half still works, and it catches more than a stdio boot test does.
