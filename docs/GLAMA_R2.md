# Glama round 2 — why 1 of 33, and what to do instead

Agent: Glama-indexing agent, loop 31. All probes run 2026-09-09. Every number names the
command or file that produced it. Two claims from round 1 are corrected here, and one
measurement in the round-1 tooling was wrong in a way that mattered.

---

## Headline

1. **Nothing in the repositories discriminates.** 24 comparable fields were diffed between
   the indexed repo and the unindexed ones. Every one is identical or non-discriminating.
2. **Glama's own methodology page says there is no crawler for open-source servers.** Listing
   is documented as a GitHub-OAuth submission by a maintainer with write access. Our record
   exists anyway, unclaimed. So an unadvertised path exists, it is not the documented one,
   and it is not steerable.
3. **The creation-to-listing lag is 33 minutes for one repo and about 120 days for the
   other.** A filter does not produce a 5,000x spread. A queue does.
4. **The official MCP registry is the one public, no-account signal that reaches Glama** —
   and it already works. Connectors under our namespace went from 4 on 2026-09-07 to at
   least **25** on 2026-09-09, with nobody doing anything.
5. **Connectors carry the identical TDQS rubric and re-score daily.** The tool-description
   work is measurable today, on 25 servers, not on 1.
6. **`license_activate` is the minimum-scoring tool on 20 of 20 connectors.** 40 percent of
   the definition-quality score is the minimum tool score, so one shared description in one
   file caps the entire fleet. This is the biggest single lever found in this loop.
7. **Round 1's badge probe was not a listing test.** It reported 3 of 33 this morning. The
   truth is 1 of 33. Details in section 5 — this one nearly published a fake badge.

---

## 1. The discrimination table

Take the indexed repo and diff everything Glama could plausibly see.

```
gh repo list theluckystrike --limit 200 --json name,description,homepageUrl,repositoryTopics,\
  stargazerCount,watchers,diskUsage,createdAt,pushedAt,isArchived,isPrivate,isFork,\
  hasIssuesEnabled,hasDiscussionsEnabled,licenseInfo,primaryLanguage,latestRelease
gh api repos/theluckystrike/<repo>/git/trees/main?recursive=1
gh api repos/theluckystrike/<repo>/commits?per_page=100
gh api repos/theluckystrike/<repo>/traffic/popular/referrers
gh api repos/theluckystrike/<repo>/traffic/clones
curl https://raw.githubusercontent.com/theluckystrike/<repo>/main/{package.json,server.json,Dockerfile,glama.json}
```

| Field | `mcp-statement-of-account` (indexed) | the 32 unindexed | Discriminates? |
|---|---|---|---|
| `glama.json` | schema-valid, `maintainers:[theluckystrike]` | byte-identical | no |
| `Dockerfile` present | yes | yes | no |
| `Dockerfile` **builds** in its own repo | **no** | **no** | no (see §3) |
| topics | 9, incl. `mcp`, `mcp-server`, `model-context-protocol` | 8–10, same three always present | no |
| license | MIT | MIT on all 33 | no |
| stars / watchers | 0 / 0 | 0 / 0 on all 33 | no |
| GitHub releases | none | none | no |
| tags | none | none | no |
| issues enabled | yes | yes (31/32) | no |
| discussions enabled | no | no on all 33 | no |
| homepage | `mcp.zovo.one/s/statement-of-account` | same pattern per server | no |
| description | one sentence | one sentence | no |
| size | 217 KB | 107–404 KB | no |
| created | 2026-09-05T17:10:18Z | 2026-09-02 .. 2026-09-06 | no |
| pushed | 2026-09-06T08:22:12Z | 2026-09-06T08:18–08:23 | no |
| commits | 1 force-pushed orphan | 1 force-pushed orphan | no |
| file tree | `src/ test/ vendor/ server.json smithery.yaml llms-install.md remotes.json SPEC.md` | same scaffold | no |
| `package.json` name / keywords | `@theluckystrike/mcp-*`, `mcp` + `model-context-protocol` | same convention | no |
| `package.json` version | 0.20.0 | 0.20.0 | no |
| declared `repository.url` | `github.com/theluckystrike/mcp-servers` | **the same on all 33** | no — but see H2 |
| `server.json` | present, official registry schema | present | no |
| README | 8,743 bytes | 4,994–16,998 bytes | no |
| in official MCP registry | yes | yes, all of them | no |
| GitHub traffic referrers | `[]` | `[]` | no |
| GitHub traffic clones (14d) | 68 / 28 uniques | 272–325 / 68–92 uniques | no |
| `glama.ai/mcp/servers` page | **HTTP 200** | **HTTP 404** on all 32 | the outcome, not a cause |

The mirrors are machine-generated from one template by `scripts/sync-mirrors.sh`, so this is
what you would expect: they are as close to identical as 33 repositories can be. There is no
property of `mcp-statement-of-account` that a directory could have selected on.

Two side-findings worth recording:

- **Every mirror is a single force-pushed orphan commit.** `gh api .../commits` returns
  exactly one commit per repo, all `sync from monorepo 8929dba8...`. Glama's Maintenance
  grade for our indexed server is **C**, and one of its three complaints is literally
  *"1 commit in the last 12 weeks"*. The mirror strategy is manufacturing that C.
- **The monorepo itself is not indexed either.** `glama.ai/mcp/servers/theluckystrike/mcp-servers`
  → 404. It is the best-looking repository of the lot: 77 MB, real history, 30 releases,
  MIT, 10 topics. If repository quality were the filter, it would be in and the mirrors out.

---

## 2. Ranked hypotheses

### H1 — Crawl-queue position. **Best supported.**

An unadvertised, low-rate ingestion has not reached the other 32.

For:
- None of the 24 fields above discriminates.
- `glama.ai/mcp/methodology` §1.1, verbatim: *"Before a server is listed, the submitting
  maintainer authenticates through GitHub OAuth. Glama verifies that the submitter has write
  or admin access to the repository they are listing."* There is no crawler in the documented
  pipeline at all. Yet our record exists, and its own score page carries an **"Author not
  verified"** checklist item and a **Claim** flow — which only make sense if servers can be
  listed without a verified submitter. So the documented rule is not the whole rule.
- The lag is wildly inconsistent for identically configured repositories:

  | repo | created | Glama record | lag |
  |---|---|---|---|
  | `mcp-statement-of-account` | 2026-09-05T17:10:18Z | 2026-09-05T17:43:09.930064Z | **33 minutes** |
  | `bln-mcp-grammar-server` | 2026-05-03T05:45:00Z | 2026-08-31T04:35:21.787402Z | **~120 days** |

Against: n=2 listed records. This cannot be proven from outside Glama.

**Actionable: no.** Nothing this project can emit enters that queue. Round 1 already
established there is no unauthenticated add endpoint and that fetching an unindexed page does
not trigger indexing; neither was retested.

### H2 — Duplicate-source collapse. Plausible, unproven.

All 33 mirrors declare `repository.url = github.com/theluckystrike/mcp-servers` in **both**
`package.json` and `server.json`. A pipeline that canonicalises on the declared upstream would
collapse all 33 into one record.

For: it predicts exactly one survivor, which is what we see.
Against: the survivor should then be the first one seen (`mcp-time-tracker`, created
2026-09-02), not the 27th created; and `mcp-servers` itself is 404, so the canonical repo did
not win either.

**Actionable: yes, by someone else.** See recommendation 4.

### H3 — Build failure withholds distribution. Defect confirmed, **not the cause**.

`glama.ai/mcp/methodology` §1.3: *"If the AI-inferred Dockerfile fails to produce a working
build, the server's profile page is preserved but distribution is withheld: the server does
not appear in search results, category listings, or recommendations."*

Measured:

```
git clone --depth 1 https://github.com/theluckystrike/mcp-invoice && cd mcp-invoice && docker build .
-> ERROR: failed to compute cache key: ... "/packages": not found
   Dockerfile:6  >>> COPY packages ./packages
```

**Every mirror ships the monorepo's Dockerfile**, which does `COPY packages ./packages` and
`COPY servers ./servers` — neither directory exists in a mirror. It cannot build in the
repository it is shipped in.

Against, and decisive: `mcp-statement-of-account` ships the *same* broken Dockerfile and is
listed, scored, and returned by the author search. Glama's AI-inferred Dockerfile evidently
succeeded there. And "distribution withheld" means absent from search, not a 404 on the page.

So this is a real defect that is **not** why the 32 are missing. Round 1 recorded *"the mirror
repos might be missing the Dockerfile Glama needs — false, all serve HTTP 200"*. Serving is
not building. Corrected here.

### H4 — The official registry drives `/mcp/servers`. **Falsified.**

`bln-mcp-grammar-server` is listed at `/mcp/servers` and is **not** in the official registry:

```
curl "https://registry.modelcontextprotocol.io/v0/servers?search=grammar&limit=20"
-> 4 results, all io.github.CSOAI-ORG/grammar-fix-ai-mcp
```

And conversely all 33 mirrors *are* in the registry, and 32 have no server page. The registry
drives `/mcp/connectors` only — which turns out to be the good news, see §4.

### H5 — A topic, a release, a description, stars, size, README shape. **Falsified.**

See the table. Do not spend another loop on repository cosmetics for Glama.

### H6 — Fetching an unindexed page queues it. **Falsified in a prior round**, not retested.

---

## 3. The referrer check the brief expected to settle it

It does not settle it, and this is worth recording so no future loop re-spends the calls.

```
gh api repos/theluckystrike/<repo>/traffic/popular/referrers
mcp-statement-of-account -> []
mcp-time-tracker         -> []
mcp-invoice              -> []
mcp-spreadsheet          -> []
mcp-price-tracker        -> []
```

**`glama.ai` has never appeared as a referrer on any repository, including the indexed one.**
That is not evidence of absence: GitHub's referrer table records `Referer` headers from human
web browsing, and a crawler clones the repo or reads `raw.githubusercontent.com`, neither of
which produces one. Clone traffic does not discriminate either — every mirror is cloned
heavily (68–325 clones in 14 days) and the indexed repo is not an outlier.

**Positive proof the crawler did visit that one repo** comes from Glama's own page instead:
the embedded record carries `"observedAt","2026-09-05T18:06:49.992918Z"` and a
`toolSchemaChangelog` entry reading *"8 tool updates v0.14.0"*. Enumerating 8 tools requires a
clone, a build and a live `tools/list`. There is no equivalent evidence for the other 32.

---

## 4. Discovery is a different pipeline from sync, and only one of them is enterable

| | `/mcp/servers` | `/mcp/connectors` |
|---|---|---|
| built from | GitHub clone + Firecracker sandbox build | the official MCP registry, mirrored |
| documented entry | GitHub OAuth submission (methodology §1.1) | *"Glama operates as a superset of that registry"* (§3) |
| needs a Glama account | yes, per the docs | **no** |
| public signal we can emit | **none** | **publish to `registry.modelcontextprotocol.io`, which we already do** |
| our coverage | 1 of 33 mirrors, unclaimed | **at least 25 servers** |
| growth 09-07 → 09-09 | 1 → 1 | **4 → 25** |
| carries the TDQS rubric | yes | **yes, identical** |
| re-score cadence, measured | last observed 2026-09-05T18:06:49Z | all 20 fetched: **scored 2026-09-08** |

### The daily-sync claim, measured

The score page says: *"Servers are automatically synced at least once per day, but you can
also sync manually at any time... click the 'Sync Server' button in the MCP server admin
interface."*

For our unclaimed server that has not held. `observed_at` is still **2026-09-05T18:06:49Z**
and `releaseVersion` is still **0.14.0**, across seven releases (v0.15.0 → v0.21.0, the last
at 2026-09-07T02:04:49Z) and the 2026-09-06T08:22 force-push. The project is at v0.21.0 and
Glama still sees v0.14.0 — which answers the question round 1's brief raised about the stale
version. It is stale because the server has not been re-run since the hour it was discovered.

The connector records, by contrast, all carry `Scored 2026-09-08` timestamps.

**Falsifiable prediction for loop 32:** if `observed_at` on `mcp-statement-of-account` is
still 2026-09-05 after the tool descriptions change, then the `/mcp/servers` record cannot
measure this work at all and only the connector surface can. `scripts/glama-watch.mjs` now
records both numbers every run.

### One caveat that stops this being a complete answer

The `punkpeye/awesome-mcp-servers` CI check matches the literal string
`glama.ai/mcp/servers/`. A connector URL does not satisfy it. That gate still needs a
`/mcp/servers` listing, and that still needs the operator's OAuth click.

---

## 5. What was tested, and one test that changed a deliverable

### The badge endpoint is not a listing test

The inherited `scripts/glama-watch.mjs` probed `.../badges/score.svg` and treated HTTP 200 as
"indexed". Run this morning it reported **3 of 33** — `mcp-change-order` and `mcp-recurring`
had apparently appeared. They had not.

```
curl -o /dev/null -w '%{http_code} %{size_download}' \
  https://glama.ai/mcp/servers/theluckystrike/<x>/badges/score.svg

definitely-not-a-real-repo-xyz123  -> 200  2880 bytes
mcp-change-order                   -> 200  2880 bytes   <- byte-identical to the fake repo
mcp-statement-of-account           -> 200  4558 bytes

curl -I .../mcp/servers/theluckystrike/mcp-change-order          -> 404
curl -I .../mcp/servers/theluckystrike/mcp-statement-of-account  -> 200
```

**Glama's badge route serves a placeholder SVG for repositories that do not exist.** Taking
that 200 at face value would have put a badge for a 404 server into a public PR under the
operator's handle — precisely the fabrication this loop was told not to commit, arrived at by
accident rather than intent.

Fixed. The script now probes the **page** with `HEAD`, and separately fingerprints the
placeholder against a deliberately nonexistent repo so every badge carries a
`safe_to_publish` flag. **The count is 1 of 33.**

### The remote-endpoint defect from round 1 is fixed

Round 1 found all four connectors rendering a red dot and *"Server is not responding"* because
`https://mcp.zovo.one/mcp/<name>` returned HTTP 401. Now:

```
https://mcp.zovo.one/mcp/spreadsheet            -> 200
https://mcp.zovo.one/mcp/statement-of-account   -> 200
https://mcp.zovo.one/mcp/asset-register         -> 200
```

and the connector listing contains **zero** occurrences of `not responding`; every health dot
is green (`#12b981`). Whoever owns `remote/` fixed it. That is what unblocked 25 connectors
from being scored.

---

## 6. The biggest lever this loop found, and it is not about indexing

Across the 20 connectors whose full rubric was read, **`license_activate` is the
lowest-scoring tool on 20 of 20**.

```
license_activate   n=20  min=1.4  max=3.1  mean=2.26
license_status     n=20  min=3.8  max=4.4  mean=4.12   <- same file, three lines apart
```

Glama's published formula is `0.6 * mean(tool scores) + 0.4 * min(tool scores)`, so **40
percent of every server's definition-quality score is this one tool**. And because
`packages/mcp-license` is vendored into every server, it is literally one string:

`packages/mcp-license/src/index.ts:214-216`

```
server.registerTool("license_activate",
  { title: "Activate license",
    description: "Activate a Pro license key (format MCPL1.xxx.yyy). Verified offline and saved locally.",
```

Glama's per-dimension complaints about it: Usage Guidelines 1/5, Purpose 2/5, Behavior 2/5,
Completeness 2/5, Conciseness 2/5. Its sibling `license_status`, written in the same style on
the line above, scores 4.1 — so this is the text, not the surface.

Modelled effect of lifting `license_activate` to 3.5 and changing nothing else:

| | now | modelled |
|---|---|---|
| fleet mean overall | **3.562** | **3.874** |
| A-tier connectors | **12 / 20** | **20 / 20** |

That is a model, not a measurement: it assumes only the license tool score moves and coherence
is unchanged. It is also subject to the loop's first hard rule — the rewritten description
must describe what `license_activate` actually does. But no other single edit in reach touches
20 servers.

Per-connector numbers are in `data/glama_r2.json` under `fleet_score.per_connector`.

---

## 7. Rejected levers

- **Reporting tool usage to Glama's unauthenticated telemetry endpoint.** The API reference
  says *"The usage telemetry endpoint is unauthenticated so MCP clients can report tool usage
  without a Glama account"*, and the score checklist penalises *"No recent usage"*. The usage
  did not happen. Reporting it would be a fabricated adoption claim. Not done.
- **Adding `mcp-statement-of-account` as a fifth entry to PR 13473** to flip the label.
  Rejected in round 1 and still right.
- **Deleting and recreating the 32 repos** to bait a creation-time crawler. Destructive, and
  the 120-day lag on `bln-mcp-grammar-server` shows creation time is not the trigger anyway.
- **Creating a Glama account.** Forbidden. It stays in `HUMAN_GATED_PACK.md` as an operator
  click.

---

## 8. Recommendations

1. **Tool-description agent:** rewrite `license_activate` in
   `packages/mcp-license/src/index.ts:214-216`. Fleet minimum on 20 of 20 connectors; 40
   percent of the score is the minimum. Measurable in about a day on the connector surface.
2. **Loop coordinator:** retarget Glama effort from `/mcp/servers` to `/mcp/connectors`. The
   registry path needs no account, already carries 25 servers, carries the identical TDQS, and
   re-scores daily. `/mcp/servers` is not enterable autonomously. Do not spend another loop
   trying.
3. **Owner of `scripts/sync-mirrors.sh`:** the Dockerfile copied into every mirror cannot
   build there (measured, §2 H3). Emit a mirror-local Dockerfile, or ship none and let Glama
   infer one.
4. **Owner of `servers/*/server.json` + the registry publish:** test H2 on **one** server —
   publish a registry entry whose `repository.url` names the mirror repo rather than the
   monorepo, and watch whether a `/mcp/servers` record appears. This is the only remaining
   no-account experiment that could open the server surface, and it needs no human.
5. **Anyone touching awesome-mcp-servers:** never treat a 200 from a badge URL as proof of a
   listing. Read `badges[<repo>].safe_to_publish` from `data/glama_watch.json`.

---

## 9. The watch script

`scripts/glama-watch.mjs` was rewritten to record the rubric, not a count.

- **Listing probe is now the page** (`HEAD /mcp/servers/<owner>/<repo>`), not the badge.
- **Negative control:** a badge is fetched for a repository that does not exist and its byte
  length is stored, so any badge matching it is flagged `is_placeholder` and
  `safe_to_publish: false`.
- **Positive control 1 (unchanged):** `mcp-statement-of-account` must read as listed, or the
  script exits 3 without writing. A throttled `gh` exits 2.
- **Positive control 2 (new):** if the control's score page fetches 200 but parses to zero
  tools or fewer than four coherence dimensions, the script exits **4** without writing —
  because zeros there would read as "the score collapsed" rather than "the parser broke".
  Verified by stubbing the fetch to return an empty page: exits 4, leaves the previous result
  file untouched.
- **Captured per server:** profile completion, coherence grade and all four dimensions,
  definition-quality grade / mean / min / tools scored, maintenance grade and its checklist,
  license grade, every tool's grade, score and all six dimensions, `observed_at`,
  `record_touched_at`, `claimed`.
- **Captured per connector:** TDQS grade and score, `scored_at`, the four coherence
  dimensions, and every tool's grade, score and six dimensions.
- **Derived locally** from Glama's published formula so a change in their arithmetic is
  visible rather than silently absorbed, including `worst_tool` — the tool holding the server
  down through the 40 percent minimum term.
- **`movement`**: a compact per-server slice for diffing between loops.
- Connector tracking is cumulative, because the anonymous listing page renders at most 20 rows
  and rotates which 20; one page is a floor, not a total.
- Every request is paced (default 900 ms, `GLAMA_WATCH_DELAY_MS` to override). Glama's
  documented limit is 100 requests per second; this runs near 1.

```
node scripts/glama-watch.mjs                 full sweep -> data/glama_watch.json
node scripts/glama-watch.mjs --fast          skip per-connector pages
node scripts/glama-watch.mjs --no-connectors servers only
```
