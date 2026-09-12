# RENAME TEST R1 - mcp-invoice -> mcp-invoice-generator

Prepared 2026-09-11. Status: PREPARED, NOT EXECUTED. The executor is
`scripts/rename-invoice-test.sh`; this document is its evidence pack. Baseline measurements
live in `data/rename_test_baseline.json` (measured 2026-09-11T18:20:01Z; every figure below
carries the command that produced it, repeated there).

## What is being tested

docs/GH_SEARCH_R2.md left one experiment proposed and unrun: on the smallest GitHub
repository-search fields the rank-one repos carry the FULL query phrase in the repo name at
zero stars, while the estate sits below full name coverage. The test: rename ONE mirror repo,
`theluckystrike/mcp-invoice` to `theluckystrike/mcp-invoice-generator`, on the query
`mcp invoice generator` (field size 11, the smallest and clearest). GitHub redirects the old
name (web, git and API all follow a rename), so inbound links keep working.

What does NOT change, verified in the files themselves:

- Registry name `io.github.theluckystrike/invoice-pdf-billing-generator`
  (`servers/invoice/server.json` line 3). Immutable per registry rules. The task brief said
  `io.github.theluckystrike/invoice`; the file on disk says `invoice-pdf-billing-generator`.
  Either way it is untouched - the registry manifest's `repository.url` points at the
  MONOREPO (`github.com/theluckystrike/mcp-servers`), not the mirror, so the registry does
  not even see the rename.
- npm package name `@theluckystrike/mcp-invoice` (`servers/invoice/package.json` line 2).
  A separate surface; nothing about a GitHub rename touches it.
- Hosted endpoint `https://mcp.zovo.one/mcp/invoice`, websiteUrl `https://mcp.zovo.one/s/invoice`.
- Repo metadata: description, topics, homepage, stars, releases and tags all survive a
  GitHub rename server-side. Nothing to migrate.

## Baseline deviation that changes the success criterion

Measured 2026-09-11T18:0xZ (command in the baseline file), `theluckystrike/mcp-invoice` is
rank 6 of 11 for `mcp invoice generator` - PRESENT in the top 10. GH_SEARCH_R2.md, measured
the same day, recorded it "absent from both top tens". The brief's success criterion as
dictated ("appears in the top-10 where mcp-invoice was absent") is therefore satisfied
before the treatment and cannot measure anything. The sharpened criterion below replaces it;
the dictated one is kept in the protocol section for the record.

One more baseline fact that sharpens the isolation: the live description of mcp-invoice
already contains the phrase "invoice generator" (see baseline row 6). The description axis
is saturated; the rename moves the name axis and nothing else.

## Blast radius

Search: `/usr/bin/grep -rln "mcp-invoice" /Users/mike/mcp-servers` (grep is a broken shell
function on this machine; /usr/bin/grep only) returns 427 files, but over 400 of them match
only the npm package name `@theluckystrike/mcp-invoice` in src/dist/test/vendor code, which
a GitHub rename does not touch. The URL form `github.com/theluckystrike/mcp-invoice` appears
in exactly 8 files (12 lines), counted with
`/usr/bin/grep -rn "github.com/theluckystrike/mcp-invoice\b" ... | cut -d: -f1 | sort | uniq -c`.

Classes: (a) breaks hard on rename, (b) survives via GitHub redirect but should be updated,
(c) historical record that must NOT be edited, (n) not affected (package-name surface).

| file | hit | class | why |
|---|---|---|---|
| scripts/sync-mirrors.sh:191 | `REPO="mcp-$NAME"` | (a) | Derives the repo name from the server directory name. After a rename, `gh repo view`/`git push`/`gh repo edit`/topics PUT all follow the redirect TODAY, so a sync would silently push to the renamed repo while stamping the OLD name into MIRROR.md, release notes and the printed URL. Worse: if the redirect ever dies (anyone creates a new `mcp-invoice`), `gh repo view` fails and the script CREATES a fresh empty `mcp-invoice` and pushes the mirror there, splitting the surface permanently. Needs the override map. |
| scripts/apply-mirror-seo.mjs:74 | ``repo = `mcp-${name}` `` | (a) | Same derivation, same hazard class, for the metadata-refresh path (description/topics/homepage/README/gemini-extension.json writes). Needs the same override. |
| scripts/mirror-seo.py:304 | `repo = "mcp-%s" % name` in `header()` | (a) | Writes the clone URL `git clone https://github.com/<owner>/mcp-<name>.git` (lines 343-344, 355, 363) into every mirror README header. Without the override, the next sync stamps the old name into the renamed repo's own README. Needs the same override. Line 237 (`"name": "mcp-%s"` in the gemini-extension.json manifest) is the GALLERY identity, not a URL - deliberately left stable; renaming a gallery identity risks orphaning the listing for zero search gain (gallery keys on topic + manifest, not repo name). |
| scripts/gh-search-rank.mjs:131 | matches estate repos by `owner.login === "theluckystrike"` | (n) | Owner-keyed, not name-keyed. Survives the rename untouched and will report `our_repo: theluckystrike/mcp-invoice-generator` automatically. The measurement instrument needs no change - verified by reading the matcher. |
| scripts/build-readme.mjs:44 + README.md:52 | ``[mcp-${id}](servers/${id}/README.md)`` | (b) cosmetic | Monorepo README table display text; the link is repo-relative and cannot break. Defer until the rename is judged permanent, then regenerate. Not part of the test. |
| data/distribution.json:354 | `per_server.invoice."github-mirror": "synced https://github.com/theluckystrike/mcp-invoice"` | (b) | Live current-state file consumed by scripts/kpi.mjs, scripts/digest.mjs, scripts/build-readme.mjs. Update this ONE field post-rename. The dated round-note PROSE elsewhere in the file (lines 17, 32, 52 mention mcp-invoice historically) is append-only log text - class (c), leave it. |
| docs/HUMAN_GATED_PACK.md:523,693,753,887 (+706) | submission field lists carrying the repo URL (line 706 is the mcp.directory form of the same name) | (b) | The operator's pending-submission checklist. Redirects cover the old URL, but the point of the experiment is the canonical name; the operator should submit the new one. Updated by the execution script. |
| .scratch-distribution/awesome-mcp-servers-8/servers/invoice.yaml:4 | `url: https://github.com/theluckystrike/mcp-invoice` | (b) low | Scratch checkout of the awesome-list fork. Only matters if another PR is opened from it; update then. |
| data/mirror_sync.json:142-143 | loop-32 sync report, dated 2026-09-09 | (c) | Dated snapshot. No live consumer found (`/usr/bin/grep -rn mirror_sync scripts/ dashboard/` empty). Do not edit. |
| data/glama_r2.json, data/gh_search_r1.json, data/dist_r26.json, data/ledger.json, data/validation.json, data/tools.json, data/facts.json | round data / package-name prose | (c) | Dated measurement records or npm-package-name mentions. Do not edit. |
| docs/MIRRORS_RESULT.md, docs/GLAMA_R2.md, docs/DIST_R26_RESULT.md, docs/GH_SEARCH_R1.md, docs/GH_SEARCH_R2.md, docs/RELEASE_V*.md, docs/codex-review*.log, all other docs hits | dated RESULT and round docs | (c) | Historical record. Editing them would falsify the log. Do not edit. |
| servers/invoice/server.json, package.json, smithery.yaml, server.npm-package.json, README.md, llms-install.md, SPEC.md, src/, dist/, test/ | registry manifest + npm package name | (n) | Registry name immutable; package name a separate surface; monorepo-relative paths only. Zero repo-URL hits under servers/ (verified: the 8-file URL list above contains no servers/ path). |
| .github/workflows/npm-publish-oidc.yml:93, scripts/registry-check.sh:7, scripts/build-mcpb.sh:9, scripts/gen-spec.mjs, scripts/demo/drive.mjs, remote/, billing/, index.html | npm package names and dependency prose | (n) | All reference `@theluckystrike/mcp-invoice` the PACKAGE. Unaffected by construction. |
| bundles/*.mcpb, bundles/invoice/* | packaged artifacts | (c) | Built zips and their staging tree. Regenerated on the next normal bundle build; never hand-edited. |
| glama.json | zero invoice hits (verified) | (n) | Maintainers-only file; nothing to change. |

External surfaces keyed on the old URL (awesome-list PR lines, cline/directory issues,
Glama's 404s) are third-party content; the redirect covers them and no edit channel exists
anyway. No action.

## The override design for the mirror generator (design only - another agent implements)

New file `data/mirror_repo_overrides.json`, one object mapping server directory name to
mirror repo name, absent keys meaning the default:

```json
{
  "invoice": "mcp-invoice-generator"
}
```

Three consumers, one lookup each, default preserved:

1. `scripts/sync-mirrors.sh`, at line 191 replace `REPO="mcp-$NAME"` with a lookup:
   ```bash
   mirror_repo_name() {
     python3 -c 'import json,sys,os
   p=os.path.join(os.environ.get("ROOT","."), "data/mirror_repo_overrides.json")
   o=json.load(open(p)) if os.path.exists(p) else {}
   print(o.get(sys.argv[1], "mcp-" + sys.argv[1]))' "$1"
   }
   REPO="$(mirror_repo_name "$NAME")"
   ```
   Every downstream use (`gh repo view/create/edit`, git remote, topics PUT, MIRROR.md,
   release notes, homepage flag) already interpolates `$REPO`, so this one line is the
   whole patch. `$REPO` remains the ONLY place the name is derived - verified by reading
   the loop body.
2. `scripts/apply-mirror-seo.mjs`, line 74:
   ```js
   const overrides = existsSync("data/mirror_repo_overrides.json")
     ? JSON.parse(readFileSync("data/mirror_repo_overrides.json", "utf8")) : {};
   // inside the loop:
   const repo = overrides[name] ?? `mcp-${name}`;
   ```
3. `scripts/mirror-seo.py`, `header()` line 304:
   ```python
   _ov = json.load(open("data/mirror_repo_overrides.json")) if os.path.exists("data/mirror_repo_overrides.json") else {}
   repo = _ov.get(name, "mcp-%s" % name)
   ```
   The gemini manifest `"name"` field (line 237) does NOT read the override - recorded
   above as a deliberate identity-stability decision.

The execution script REFUSES to rename until all three files contain the string
`mirror_repo_overrides` (grep gate). Renaming first and patching later leaves a window
where a routine fleet sync targets the old name through the redirect and re-stamps old-name
clone URLs into the renamed repo's README - the exact desync the override exists to prevent.

## Execution script

`scripts/rename-invoice-test.sh`, executable, idempotent, every step echoing. Order:
preflight -> override file + generator-hook gate -> rename -> redirect verification ->
data-file updates -> one-mirror re-sync -> post-sync verification -> T0 measurement.
Rollback: `ROLLBACK=1 scripts/rename-invoice-test.sh` renames back and reverts the data
files. The script is NOT run here.

## Measurement protocol

Schedule, anchored at rename completion T0 (the script stamps T0 itself):

| read | when | purpose |
|---|---|---|
| T0 | immediately post-rename | confirms the rename itself did not change ranking (index still holds the old document) and catches an instantaneous failure |
| T+3d | T0 + 3 days | early reindex signal; GH_SEARCH_R2 showed description reindex inside ~1 day, rename reindex lag is unmeasured |
| T+7d | T0 + 7 days | primary read, matching GH_SEARCH_R2's proposed one-week window |
| T+14d | T0 + 14 days | confirmation read; a single read can be index jitter, two consecutive reads cannot |

Exact queries at every read (identical to baseline, saved as
`data/rename_test_t{0,3d,7d,14d}.json` in the baseline schema):

```
gh api -X GET search/repositories -f q='mcp invoice generator' -f per_page=10 --jq '.total_count, (.items[] | [.full_name, .stargazers_count, .description])'
gh api -X GET search/repositories -f q='mcp quotes' -f per_page=10 --jq '.total_count, (.items[] | [.full_name, .stargazers_count, .description])'
gh api -X GET search/repositories -f q='mcp deposits' -f per_page=10 --jq '.total_count, (.items[] | [.full_name, .stargazers_count, .description])'
```
plus the estate-rank locator per query (per_page=100 form, as in the baseline file), and
the redirect health probe: `gh api repos/theluckystrike/mcp-invoice --jq .full_name` must
print `theluckystrike/mcp-invoice-generator` at every read.

## Success criterion

Manipulation check (must hold at every read, else the treatment failed mechanically):
the estate entry on `mcp invoice generator` is `theluckystrike/mcp-invoice-generator`,
name token coverage 1.000 (baseline 0.667), description and stars unchanged.

Primary (sharpened, replaces the dictated one - see the deviation section):
`theluckystrike/mcp-invoice-generator` holds rank 3 or better on `mcp invoice generator`
at BOTH T+7d and T+14d, up from baseline rank 6 - i.e. it takes one of the three zero-star
full-coverage slots (baseline ranks 2-4: Qoxiz20/Invoice-MCP-generator,
n0119566/mcp-invoice-generator, CSOAI-ORG/invoice-generator-ai-mcp). Rank 1 is NOT required:
its holder carries 9 stars at 0.667 coverage, and stars on this field are not the variable
under test.

Controls (guard against false movement from market drift), all must hold at T+7d and T+14d:

- `theluckystrike/mcp-quotes` on `mcp quotes`: top-100 rank within +/-10 of baseline 69,
  still absent from the top 10; total_count within +/-25% of baseline 399.
- `theluckystrike/mcp-deposits` on `mcp deposits`: top-10 rank within +/-2 of baseline 3;
  total_count within +/-25% of baseline 24.
- `mcp invoice generator` total_count within +/-50% of baseline 11 (small fields drift
  fast; a field doubling invalidates cross-read rank comparison).

If a control breaches its band, the read is INDETERMINATE, not failed - record and wait
for the next read.

Dictated criterion, for the record: "theluckystrike/mcp-invoice-generator appears in the
top-10 for `mcp invoice generator` where mcp-invoice was absent, with controls unchanged."
Satisfied at baseline (rank 6, measured 2026-09-11T18:0xZ); retained so the record shows
why it was superseded.

Null result handling: if T+14d shows the renamed repo still at rank 5-6 (or gone), the
full-phrase-name hypothesis is dead at n=1 on the cleanest field available. Roll back with
`ROLLBACK=1 scripts/rename-invoice-test.sh`, and record the outcome in a GH_SEARCH_R3 round
so the next naming proposal starts from this measurement and not from the n=2 observation
again.
