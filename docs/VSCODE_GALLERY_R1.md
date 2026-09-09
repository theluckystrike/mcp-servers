# Why these servers are absent from VS Code's MCP gallery (2026-09-09)

## The surface

VS Code ships an MCP gallery in its built-in picker. Its `product.json` points
`mcpGallery.serviceUrl` at `https://api.mcp.github.com`, and that service syncs from the
official MCP registry. It is the highest-reach registry-backed surface this project can
reach, and it needs no submission: there is no form and no pull request. It holds 252
servers today against more than 2,211 distinct servers in the registry, and none of them
is ours.

## What the cut is not

Each gallery record carries the GitHub repository data behind it, so the obvious
explanations can be tested rather than guessed. All are false:

| Hypothesis | Test | Result |
|---|---|---|
| It favours popular repositories | star counts across all 252 | 38 have **zero stars**, 103 have fewer than five, median 10.5 |
| It favours organisations | `is_in_organization` | 60 of 252 are personal accounts |
| It favours a namespace | name prefixes | 114 of 252 are `io.github.*`, the same prefix as ours |
| It is an alphabetical prefix | name range | spans `ai.bittlebits` to `zapier/zapier-mcp` |
| It favours a language | `primary_language` | TypeScript 81, Python 40, JavaScript 31, and 64 with none |
| It only holds older entries | registry publication month | 44 were published this month, the current one |

## What the cut appears to be

**Every one of the 252 gallery entries points at a repository with no `subfolder`. Every
one of this project's 89 registry entries has one.**

    gallery entries with repository.subfolder : 0 of 252
    registry sample with repository.subfolder : 19 of 100 (19%)

If subfolder had nothing to do with selection, roughly 48 of the 252 would carry one. The
probability of drawing zero at a 19 percent rate is about 9 x 10^-24.

The mechanism is plausible on the face of it. Every gallery record embeds repository-level
data: the README, the topics, the star count, the open-graph image, the primary language.
That enrichment is a property of a repository, not of a directory inside one. A server that
lives in `servers/<name>/` of a monorepo has no README, no topics and no language of its
own, so there is nothing for the gallery to show.

This is a correlation with an obvious mechanism, not a proven cause. The registry sample
and the gallery do not overlap, so no direct paired test was possible.

## The experiment

Rather than argue about it, one entry was published to test it:

    com.bestremotetools/office-suite-all-servers-one-install
    repository: https://github.com/theluckystrike/mcp-office-suite   (no subfolder)

It is deliberately in the same namespace as an entry that does carry a subfolder
(`com.bestremotetools/delivery-schedule-milestones-late-report`), so the comparison holds
the namespace fixed and varies only the thing under test. office-suite was chosen because
it declares no hosted endpoint, and the registry binds each hosted URL to exactly one
server name, so it could not collide.

Check `node scripts/vscode-gallery-watch.mjs` over the next few days. If the no-subfolder
entry appears and the subfolder one does not, the hypothesis holds.

## What it would mean

This project already has 33 one-server-per-repository public mirrors. If the hypothesis
holds, every registry entry can point at its own mirror instead of a monorepo subfolder,
which is a metadata change shipped at the next release, and the whole catalogue becomes
eligible for the VS Code picker.

There is a real tension to settle first. Glama grades the same mirrors Maintenance C partly
because `sync-mirrors.sh` force-pushes them as a single squashed commit, so it sees "1
commit in the last 12 weeks". Pointing the registry at mirrors would make that thin history
the public face of every server. Whichever way that is resolved, it should be resolved once
for both surfaces rather than separately.
