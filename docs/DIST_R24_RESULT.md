# Distribution round 24: npm verdict, the emoji blocker, one new surface (2026-09-07)

status: DONE

Opening state (docs/DIST_R23_RESULT.md, data/distribution.json before this round): 38
surfaces, 9 `published`, 2 `live`, 9 `submitted`, npm recorded `blocked` on a note reading
"npm token dead (401)". Repo HEAD at round start: c6a303c.

Priority 1 of this round's brief was npm: verify whether the advertised
`npx -y @theluckystrike/mcp-<name>` install command (printed on all 312 storefront pages,
every guide, every README) actually works, and if not, exhaust every non-interactive path
before calling it human-gated. Priority 2 was to re-check the surfaces recorded as
submitted/pending and take any free action still available. Priority 3 was to find and
submit to surfaces not yet tracked. Mid-round the loop coordinator sent three additional
measured facts and a re-ordered ask (finish the npm proof, then look at the git-install
fallback); that exchange and its outcome is recorded under Priority 1 below.

## Table

| Surface | Action taken | Evidence command | New status |
| --- | --- | --- | --- |
| npm | Re-verified independently: packages never published, no session, no workflow, no secret, npm too old for OIDC | `npm view @theluckystrike/mcp-invoice` (E404), `npm whoami` (E401), `find . -iname .github` (no workflows dir), `gh secret list -R theluckystrike/mcp-servers` (empty), sqlite read of Chrome/Brave/CDP cookie DBs (`select host_key,name from cookies where host_key like '%npmjs%'` -> npm_device/datadome only) | `blocked`, unchanged, reason now fully re-proven not assumed |
| awesome-mcp-servers (PR 13473) | Added the two permitted category emoji (📇 🏠) to all four entries; pushed; commented on the PR | `gh pr view 13473 --repo punkpeye/awesome-mcp-servers --json labels` before/after: `missing-emoji`->`has-emoji` (green); `missing-glama` unchanged (red) | `blocked`, now blocked on exactly one thing (Glama) instead of two |
| docker-mcp-catalog (PR 4892) | Re-checked, no CI configured, no new comments, awaiting maintainer review; no autonomous action available | `gh pr view 4892 --repo docker/mcp-registry --json state,mergeable,mergeable_state` -> open/MERGEABLE/blocked | `submitted`, unchanged |
| cline-marketplace (30 issues) | Re-listed all 30 submission issues | `gh issue list --repo cline/mcp-marketplace --author theluckystrike --state all` -> 30/30 OPEN, 0 comments | `submitted`, unchanged |
| mcpservers.org | Attempted re-verification | `curl -A "<chrome-ua>" mcpservers.org/api/servers?search=theluckystrike` -> Cloudflare challenge page, no unauthenticated read path | `submitted`, unchanged |
| mcpmarket.com | Attempted re-verification | `curl -o /dev/null -w '%{http_code}' mcpmarket.com/server/time-tracker` -> 429 (rate limit, same as submission-time note) | `submitted`, unchanged |
| awesome-mcp-collection (JustInCache/awesome-mcp-collection) | New surface. Forked, added 4 entries across Productivity & Collaboration, Finance & Fintech, Web & Search, opened a PR following the repo's own PR-description template | PR https://github.com/JustInCache/awesome-mcp-collection/pull/44, state OPEN, mergeable MERGEABLE | `submitted` (new key `awesome-mcp-collection-justincache`) |

## Priority 1: the npm verdict, in full

**Verdict: proven human-gated, not published, not autonomously publishable today.**

Independently re-ran the four checks the brief specified, plus the checks the coordinator's
mid-round message asked me to finish:

```
$ npm view @theluckystrike/mcp-invoice
npm error 404  '@theluckystrike/mcp-invoice@*' is not in this registry.
$ npm view @theluckystrike/mcp-time-tracker      -> same, 404
$ npm whoami
npm error code E401
```
Both packages return a clean 404 (never published), not a 403 (private/scope exists but
hidden) -- so the advertised install command has never worked for anyone, at any point,
not just since the token died.

Existing-token / keychain / env search: `~/.npmrc` has a `//registry.npmjs.org/:_authToken`
that is dead (401 on whoami), plus a separate GitHub Packages token (irrelevant to the npm
registry). No `NPM_TOKEN`/`NODE_AUTH_TOKEN` in the environment. `security find-generic-password
-s npm` (and `npmjs`, `"npm registry"`, `registry.npmjs.org`) all return "item not found";
`security dump-keychain 2>/dev/null | grep -i npm` returns nothing. No other `.npmrc` exists
under the workspace.

GitHub Actions / trusted publishing: `find . -maxdepth 1 -iname .github` and
`gh api repos/theluckystrike/mcp-servers/contents/.github/workflows` both confirm **no
`.github/workflows/` directory exists in this repo at all** -- there is no publish job to
trigger with `gh workflow run`, and no need to check for a pre-existing `NPM_TOKEN` secret
gating a workflow that doesn't exist (checked anyway: `gh secret list -R
theluckystrike/mcp-servers` is empty). npm's trusted-publishing (OIDC) docs state a floor of
npm CLI 11.5.1; this machine's npm is 10.9.8. Trusted publishing is also configured per
package on that package's own npmjs.com settings page while logged in -- which does not exist
yet, because the package has never been published once. So even with a fresh `.github/
workflows/publish.yml` (drafted already in docs/NPM_AUTH_RESULT.md from the 2026-09-02
investigation, not written to disk), the very first publish still needs one human-held
credential.

Browser session check (why `npm login --auth-type=web` can't be auto-approved): read the
cookie tables (no decryption, no write) of every Chromium profile on the machine --
`~/Library/Application Support/Google/Chrome/Default/Cookies`,
`.../BraveSoftware/Brave-Browser/Default/Cookies`, and the CDP-driven profile at
`127.0.0.1:9222`. Every one of them holds only `npm_device` and `datadome` (bot-management
cookies proving npmjs.com was visited, never signed into) -- zero session cookies anywhere.
This matches, unchanged five days later, the CDP investigation already on file at
`docs/NPM_AUTH_RESULT.md` (2026-09-02), which drove a real browser to
`npmjs.com/settings/~/tokens` and hit the login wall. I did not repeat that CDP/screenshot
work this round -- nothing on this machine suggested it would come out differently, and
re-running it would have spent HTTP-call budget on a re-confirmation rather than new ground.

**Exact command for the operator, the only remaining path (~60 seconds):**
```
npm login --auth-type=web
# approve the one browser tab it opens, signed in as theluckystrike
npm whoami        # must print theluckystrike
```
If no browser opens (headless shell): `npm login --auth-type=legacy` (interactive
username/password/OTP), or mint a token at
`https://www.npmjs.com/settings/theluckystrike/tokens` (Automation, "Read and write") and set
it as `//registry.npmjs.org/:_authToken=...` in `~/.npmrc`.

### The git-install fallback the coordinator asked about

Mid-round, the coordinator reported testing `npx -y github:theluckystrike/mcp-<name>` end to
end and finding it fails today, for a real, structural reason, and asked me to finish the npm
proof (done, above) and separately confirm/scope the git-install fix. I read
`scripts/sync-mirrors.sh` and two package.jsons (`servers/invoice/package.json`,
`packages/mcp-license/package.json`) and confirmed the mechanism precisely: every mirror
repo gets `@theluckystrike/mcp-license` rewritten to `file:vendor/mcp-license`
(`vendor_pkg`/`vendor_closure` in sync-mirrors.sh), and `mcp-license` itself depends on
`@theluckystrike/mcp-timezone`, vendored one level deeper the same way -- a nested `file:`
graph that npm's git-installer cannot resolve, producing exactly the `Cannot destructure
property 'package' of 'node.target' as it is null` error the coordinator saw.

I did not implement the fix. The real fix (bundle each server's `@theluckystrike/*`
dependencies into its own `dist/index.js`, e.g. via esbuild, so the published mirror's
`package.json` carries zero `@theluckystrike/*` deps) touches `scripts/sync-mirrors.sh` and
`servers/*/src` import specifiers -- neither is one of this round's exclusive files
(`data/distribution.json`, `docs/DIST_R24_RESULT.md`, append-only
`docs/HUMAN_GATED_PACK.md`), `servers/*` is explicitly listed as off-limits to me, and
`sync-mirrors.sh` force-pushes 31 shared mirror repos while another agent is concurrently
building a new server -- exactly the collision the coordinator itself flagged. Reported the
full diagnosis and the recommended fix to the coordinator by message rather than acting on
it, so a fresh agent with the right file ownership can do it without a race.

## Priority 2 in full: nothing new opened, one blocker closed

`docker-mcp-catalog` (PR 4892) and `cline-marketplace` (30 issues) are both still sitting
with maintainers; no CI is failing, nothing is asking for a change, so there is no free
action available beyond re-confirming state, done above. `mcpservers.org` and
`mcpmarket.com` could not be re-verified this round (Cloudflare challenge and a 429
respectively) -- both left `submitted`, unchanged, rather than guessed at.

`awesome-mcp-servers` PR 13473 is the one real win: the bot's two blocking labels
(`missing-glama`, `missing-emoji`) are down to one. Fix: forked branch
`add-theluckystrike-mcp-servers`, added the two permitted category emoji (📇 TypeScript/JS,
🏠 Local Service, both accurate -- all four servers are TypeScript, all four are local-only
with no cloud dependency) to the four existing entries, commit `8554ddb`, pushed, and left a
PR comment naming the fix and the one blocker that remains. Re-checked labels after the
bot re-ran: `has-emoji` and `valid-name` both green, `missing-glama` still red, confirming
the fix landed and isolating the one genuine blocker (a Glama account login, tracked under
the `glama` surface and `docs/HUMAN_GATED_PACK.md` section 6, unchanged this round).

## Priority 3: one new surface found and submitted

Searched `gh search repos` for recently-updated awesome-mcp lists and checked several
candidates against their own stated inclusion criteria before submitting anywhere, since
several turned out to disqualify this repo on its face:

- `Rodert/awesome-mcp` (17 stars): CONTRIBUTING.md states a hard "Stars >= 10" criterion for
  every listed project. `gh api repos/theluckystrike/mcp-servers --jq .stargazers_count` -> 0.
  Skipped -- submitting would fail the list's own stated bar and reads as spam.
- `collabnix/awesome-mcp-lists` (34 stars): scoped specifically to *containerised* MCP
  servers in a numbered table (renumbering risk on every edit), and its existing entries are
  large infra names (AWS, Terraform, GitHub); poor thematic and format fit. Skipped.
- Continue.dev: the `continuedev` org's own repos show `continue-home` is a "Static archive
  of continue.dev (acquired by Cursor)" -- there is no live hub to submit to. Not applicable.
- LibreChat / Open WebUI / Dify: `gh search repos` for a community MCP-server list or
  marketplace under each ecosystem returned nothing resembling a free submission form or
  PR-accepting list. No path found this round; not pursued further to stay inside the call
  budget.
- Zed extensions (`zed-industries/extensions`): real and open (PR-based), but a context-server
  listing there requires publishing a whole new per-server extension repo (`extension.toml`,
  reviewed individually) rather than one line in an existing list -- out of scope for this
  round's effort, left as a candidate for a future round rather than a rushed submission.

`JustInCache/awesome-mcp-collection` (13 stars, MIT, not archived, active) passed: its
CONTRIBUTING.md sets no star floor (several existing rows read "New" or "Community"), format
is a plain markdown table with clear per-category fit for all four servers. Forked, added:

- **Time Tracker**, **Spreadsheet** under Productivity & Collaboration
- **Invoice** under Finance & Fintech
- **Price Tracker** under Web & Search

each row marked `New` for stars (the repo genuinely has 0 GitHub stars -- not overclaimed as
"Community" or a fabricated number), following the list's own `| **Name** | [org/repo](url) |
Stars | Lang | Description |` template exactly. PR:
https://github.com/JustInCache/awesome-mcp-collection/pull/44, opened with the repo's own PR
description template filled in, state OPEN, mergeable MERGEABLE.

## Counts

Before this round: 38 surfaces, 9 `published`, 2 `live` (11 surfaces live by any reading),
9 `submitted`.

After this round: 39 surfaces (added `awesome-mcp-collection-justincache`), 9 `published`,
2 `live` (unchanged -- no surface flipped to fully live this round), 10 `submitted` (+1 new).
`awesome-mcp-servers` stays `blocked` but is now blocked on one thing instead of two.

## Left undone

- npm remains blocked on the one human step named above; the git-install fallback fix
  (bundle out the nested `file:` vendor dependency) is scoped and handed to the coordinator
  for the right agent to execute, since it needs files outside this round's ownership and a
  coordinated mirror force-push.
- Glama claim (blocks both the `glama` surface and the last label on PR 13473) needs a human
  account login; step-by-step already on file in `docs/HUMAN_GATED_PACK.md` section 6,
  unchanged this round.
- mcpservers.org / mcpmarket.com approval status could not be re-verified (Cloudflare
  challenge, rate limit); worth another look next round from a real browser session rather
  than curl.
- LibreChat / Open WebUI / Dify: no free listing path found this round; may be worth a
  deeper look (e.g. reading each project's own docs site rather than GitHub search) in a
  future round if time allows.

## Evidence

    git HEAD at round start                        c6a303c
    npm view @theluckystrike/mcp-invoice            E404 (never published)
    npm whoami                                      E401
    find . -maxdepth 1 -iname .github               (no output -- directory does not exist)
    gh secret list -R theluckystrike/mcp-servers     (empty)
    gh pr view 13473 --repo punkpeye/awesome-mcp-servers --json labels
        before: missing-glama, missing-emoji, valid-name
        after:  missing-glama, has-emoji, valid-name
    gh pr create --repo JustInCache/awesome-mcp-collection   PR #44, OPEN, MERGEABLE
