# VS Code MCP gallery: the subfolder hypothesis is refuted (2026-09-10)

Round 1 (`docs/VSCODE_GALLERY_R1.md`) proposed that VS Code's MCP picker excludes this
project because every one of our registry entries points at a subfolder of a monorepo, and
because zero of the 252 gallery entries carried `repository.subfolder`. That measurement was
wrong, the hypothesis is dead, and the experiment entry published to test it did not appear.
This round repaired the instrument, proved the absence instead of assuming it, and found the
one submission route that actually exists.

## 1. The instrument was broken in two separate ways, and both are fixed

**The 400 was a deprecated endpoint, not a service fault.** `https://api.mcp.github.com/v0/servers`
returns the header `deprecation: true`, and its `metadata.next_cursor` is the raw hex id of the
last row in the page:

    cursor       2f7187b8a3fa4815b7c191f9ed063021
    last row id  2f7187b8a3fa4815b7c191f9ed063021   io.github.dynatrace-oss/dynatrace-managed-mcp

Feeding that value back gives `400 Invalid cursor parameter`, and so does every other form of
it tested: dashed as a UUID, base64, base64 of the dashed form, and small integers. It is not
a rate limit and not connection stickiness; a second request on the same keep-alive connection
fails identically. The parameter names `page`, `after` and `offset` are silently ignored and
return page one again. `limit` is capped at 100 regardless of the value sent.

The current version answers correctly. `https://api.mcp.github.com/v0.1/servers` issues an
opaque `metadata.nextCursor` of the form `mcp.cursor.<base64>` and pages cleanly:

    page 1 got 100 total 252 cursor mcp.cursor.eyJ2IjoxLCJraW5kIjo
    page 2 got 100 total 252 cursor mcp.cursor.eyJ2IjoxLCJraW5kIjo
    page 3 got 52  total 252 cursor
    TOTAL ROWS 252

**The v0 endpoint also silently drops the field the whole hypothesis rested on.** Its
`repository` object is a legacy shape carrying `id`, `readme`, `url` and `source` and *no*
`subfolder` key, for every row, including rows that demonstrably have one. `com.supabase/mcp`
reads as `subfolder: null` on v0 and `subfolder: packages/mcp-server-supabase` on v0.1. The
"0 of 252" in R1 measured the v0 schema, not the gallery.

**There is also a direct membership test**, which removes pagination from the question
entirely: `GET /v0.1/servers/<url-encoded name>/versions/latest` returns 200 for a gallery
member and 404 for a non-member.

    microsoft/markitdown                                     200   (positive control)
    com.bestremotetools/office-suite-all-servers-one-install  404   (the R1 experiment)
    com.bestremotetools/archive-zip-unzip-bomb-guard          404   (its subfolder twin)
    io.github.theluckystrike/amortization                     404   (hosted remote, ours)

`scripts/vscode-gallery-watch.mjs` now uses v0.1, pages to completion, and runs those three
probes with the control as a fail-closed gate. A zero from it is now measured, not assumed.

## 2. The verdict

**REFUTED.** Fourteen of the 252 gallery entries point at a monorepo subfolder:

| Entry | Stars | Subfolder |
|---|---|---|
| io.github.netdata/mcp-server | 80,474 | docs/netdata-ai/mcp |
| com.microsoft/azure | 3,659 | servers/Azure.Mcp.Server |
| com.supabase/mcp | 2,901 | packages/mcp-server-supabase |
| io.github.getsentry/sentry-mcp | 845 | packages/mcp-server |
| io.github.SAP/fiori-mcp-server | 158 | packages/fiori-mcp-server |
| com.workos/mcp | 46 | mcp |
| **com.soracom/knowledge** | **4** | **servers/knowledge** |
| **ai.certscore/mcp-light** | **0** | **packages/certscore-mcp** |
| **co.axiom/mcp** | **0** | **apps/mcp** |
| **com.mailrith/mailrith** | **0** | **packages/mcp-server** |

(plus com.microsoft/microsoft-fabric, com.microsoft/nuget, dev.svelte/mcp, io.github.Sendmux/sendmux-mcp)

`com.soracom/knowledge` is the same shape as ours down to the directory name: a `servers/<name>`
subfolder of a monorepo, four stars. `ai.certscore/mcp-light` has zero stars, a subfolder, and
was published to the registry on **2026-09-09** — the same day as our experiment entry. One is in
the gallery and one is not.

Registry-wide the field points the wrong way for the hypothesis. Against a 20,000-row pull of
`registry.modelcontextprotocol.io/v0.1/servers?version=latest`:

    gallery members     n=169   subfolder 7.7%   remotes 66.3%   icons 28.4%   title 76.9%
    non-members         n=19831 subfolder 6.1%   remotes 57.9%   icons  7.7%   title 55.9%

A subfolder is *slightly more* common inside the gallery than outside it.

The experiment itself also failed on its own terms: `com.bestremotetools/office-suite-all-servers-one-install`
was published 2026-09-09 11:49Z pointing at the standalone repo `theluckystrike/mcp-office-suite`
with no subfolder, and after two completed syncs (`data.last_oss_snapshot_at 2026-09-10T13:27:07Z`)
it returns 404 from the membership probe.

## 3. So do not migrate the catalogue

R1's contingency was to repoint all 89 registry entries at the 32 one-server mirrors, and warned
that doing so would put a single squashed force-pushed commit in front of every server and cement
Glama's Maintenance C. **That migration is now unnecessary and should not be done.** It was only
ever justified by the subfolder hypothesis, and the hypothesis is dead. The Glama commit-history
problem should be solved or not solved on Glama's own merits, with no VS Code consideration in it.

## 4. What the real separator is, as far as it can be read

It is not a field. Every readable axis was checked and none of them cuts:

| Axis | Finding |
|---|---|
| Stars | Members range 0 to 182,341, median 10.5, 38 have zero. Rows are sorted by `stargazerCount` descending, which is presentation, not a filter |
| Subfolder | 14 members have one; base rate is higher inside the gallery than outside |
| Organisation | 60 of 252 are personal accounts |
| Namespace | 114 of 252 are `io.github.*`, ours included |
| Namespace matching the repo owner | 40 members do not match, e.g. `one.faf` on `wolfe-jam`, `dev.slideforge` on `smartdatabrokers` |
| Package type | npm 93, pypi 34, mcpb 22, oci 21, nuget 4 — mcpb, our format, is present |
| Remote endpoint | 148 members have one, 104 have only packages; not required |
| `server.json` at the repo root | 5 of 9 sampled member repos do not have one |
| Publication month | Member rate is ~1% in every month from 2026-06 to 2026-09 |
| One entry per repo | No: `avadev/mcp` holds 8 members, `antohins/seo-tools-mcp` holds 8 |

252 rows against a registry of at least 20,000 is a 1.3% slice with no readable discriminator.
That is the signature of a hand-maintained list, and GitHub says so directly.

## 5. There is a submission route after all, and it is free

R1 recorded "no form, no pull request, no request path". That is wrong. In
`github/github-mcp-server` discussion #1257, a GitHub engineer states:

> right now the GitHub MCP registry is a curated list. This will change in a couple days when we
> enable sync with the open source registry. In order to get your server added, you have to
> publish it to the open source registry first.  — @hstaudacher, 2025-11-10

and later:

> the GitHub MCP Registry now has the ability to sync versions from the open source registry, but
> onboarding a new server is still a manual curation process today. Once a server has been
> onboarded, newly published versions from the OSS registry should sync from there.  — @trent-j, 2026-05-19

The thread has since become the de facto queue: publishers post an "Onboarding request" comment
with a metadata table. It is a public discussion, free, needs no account beyond an existing GitHub
login, and is open for comments (closed and answered, but not locked; the most recent request is
2026-09-09).

**A request was posted this round** and is verifiable:
https://github.com/github/github-mcp-server/discussions/1257#discussioncomment-18387359

**Its measured yield is poor, and that number belongs in the record.** Of the eleven servers whose
onboarding was requested in that thread, the membership probe returns 200 for two and 404 for nine:

    one.faf/claude-faf-mcp                  200
    one.faf/faf-mcp                         200
    to.derive/derive                        404
    ai.kinlab/kin                           404
    me.identik/electronica                  404
    io.github.mnemoverse/mcp-memory-server   404
    io.github.rafaelgaspar/longhorn-mcp      404
    io.github.AkashGoenka/coldstart          404
    io.github.edithatogo/fyi-mcp             404
    io.github.happy520ai/unified-ai-system   404
    io.github.shabaaspay/shabaaspay-payto    404

Both successes belong to the one publisher a GitHub employee engaged with personally across eight
months of follow-ups. Every request from the 2026-07 to 2026-09 cohort is still unfulfilled. The
same complaint is filed independently as `modelcontextprotocol/registry` issue #1107, with three
other publishers confirming it in the comments.

So the route is real and free, its cost is one comment, and its expected value is low. It has been
used once; it should not be re-posted, and no further engineering should be spent on this surface
until the thread shows evidence that the queue is moving.

## Commands behind every number here

    node scripts/vscode-gallery-watch.mjs
    curl -s -D - "https://api.mcp.github.com/v0/servers?limit=100" -o /tmp/g1.json      # deprecation: true
    curl -s "https://api.mcp.github.com/v0.1/servers?limit=100"                          # mcp.cursor.<base64>
    curl -s -o /dev/null -w '%{http_code}' \
      "https://api.mcp.github.com/v0.1/servers/<url-encoded name>/versions/latest"       # 200 in, 404 out
    curl -s "https://api.mcp.github.com/"                                                # sync + last_oss_snapshot_at
    gh api graphql -f query='{repository(owner:"github",name:"github-mcp-server"){discussion(number:1257){comments(first:30){nodes{author{login} body}}}}}'
