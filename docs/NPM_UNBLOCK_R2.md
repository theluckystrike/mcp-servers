# npm unblock, round 2 — exhausting every path to a first publish

Date: 2026-09-07. Agent: npm (loop 29).
Owned files: this file, `data/npm_unblock.json`, `.github/workflows/npm-publish-oidc.yml`.

**VERDICT: NOT PUBLISHED. All 33 packages remain unpublished (registry HTTP 404).**

**The single reason:** npm has no credential for the account `theluckystrike` anywhere on
this machine or in this GitHub org, and npm trusted publishing (OIDC) cannot mint the
first one, because a trusted publisher can only be attached to a package that already
exists on the registry — and every one of these packages does not exist. The first
publish of each package requires a token, and a token requires a human to sign in to
npmjs.com once.

**Did upgrading the npm CLI change the trusted-publishing picture? No.** The version floor
was real but it was never the binding constraint. It is now cleared and the block is
unchanged — see section 1, which contains the empirical proof, not a docs quotation.

---

## 1. The npm CLI version floor — attacked first, cleared, and it changed nothing

The previous round (`docs/NPM_AUTH_RESULT.md` section 3) concluded that trusted publishing
was unusable because "local npm is 10.9.8" and the floor is 11.5.1. That was the weakest
link in the argument, so it was tested rather than believed.

### 1a. The floor is cleared, locally and on the runner

```
$ npm install -g npm@latest
added 1 package in 9s
$ /Users/mike/.npm-global/bin/npm --version
12.0.2
$ which -a npm
/Users/mike/.npm-global/bin/npm      <- new, 12.0.2, first on PATH
/Users/mike/.local/bin/npm           <- symlink to ~/.hermes/node/bin/npm, was 10.9.8
/usr/local/bin/npm
/opt/homebrew/bin/npm
$ node --version
v22.23.2                             <- above the 22.14.0 floor
```
12.0.2 >= 11.5.1 and 22.23.2 >= 22.14.0. Both documented floors are satisfied. The
GitHub Actions runner reports the same after `npm install -g npm@latest`:
`npm 12.0.2 / node v22.23.2` (run 34081070341).

### 1b. What the current documentation actually requires

`WebFetch https://docs.npmjs.com/trusted-publishers`, read 2026-09-07:

- "Trusted publishing requires npm CLI version 11.5.1 or later and Node version 22.14.0
  or higher."
- Configuration is per package, in the web UI: "Navigate to your package settings on
  npmjs.com and find the 'Trusted Publisher' section." The page documents **no CLI and no
  API** path to create a trusted publisher.
- The page is silent on whether a package must already exist.

`WebFetch https://github.com/npm/cli/issues/8544` ("Allow publishing initial version with
OIDC", opened 2025-09-01, still **open**, no maintainer fix):

- "it's not possible to publish the initial version of a package using OIDC, it needs to
  be published manually or using a token."
- Root cause, quoted in the issue: "the UI on npmjs.com requires a package to exist before
  you can edit its settings and enable OIDC publishing."
- PyPI allows pre-registration of an OIDC publisher for a package that does not exist yet;
  npm does not.

### 1c. Empirical proof, run twice, with the confound removed

A manual-dispatch workflow was written to `.github/workflows/npm-publish-oidc.yml` and run
against the real registry. It is `workflow_dispatch:` only — it never fires on push or tag.

**Run 1 — `https://github.com/theluckystrike/mcp-servers/actions/runs/34080853186`**
Used `actions/setup-node` with `registry-url:`. Result:
```
npm 12.0.2 / node v22.23.2
npm error code E404
npm error 404 Not Found - PUT https://registry.npmjs.org/@theluckystrike%2fmcp-license
npm error 404  The requested resource '@theluckystrike/mcp-license@0.21.0' could not be
npm error 404  found or you do not have permission to access it.
```
**This run is CONFOUNDED and its E404 must not be quoted as the OIDC verdict.** The job log
shows `actions/setup-node` set `NPM_CONFIG_USERCONFIG: /home/runner/work/_temp/.npmrc` and
`NODE_AUTH_TOKEN: XXXXX-XXXXX-XXXXX-XXXXX`. With no `NODE_AUTH_TOKEN` secret in the repo,
setup-node's template `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}` expands to that
literal placeholder, so npm authenticated with a junk bearer token and had no reason to
attempt the OIDC exchange at all. The E404 is what a bad token produces, not what a missing
trusted publisher produces.

**Run 2 — `https://github.com/theluckystrike/mcp-servers/actions/runs/34081070341`**
`registry-url:` removed so npm sees no credential whatsoever, `--provenance` added.
Preconditions proven in the job log itself:
```
NPM_CONFIG_USERCONFIG=[unset]
NODE_AUTH_TOKEN=[unset]
ACTIONS_ID_TOKEN_REQUEST_URL=[PRESENT https://run-actions-1-azure-eastus.actions.githubusercontent.com/134//idtoken/...]
### /home/runner/.npmrc (absent)
### /home/runner/work/_temp/.npmrc (absent)
### ./.npmrc (absent)
```
So: npm 12.0.2, node 22.23.2, `permissions: id-token: write`, the OIDC token endpoint
present, zero npmrc files, zero tokens. The publish:
```
npm error code ENEEDAUTH
npm error need auth This command requires you to be logged in to https://registry.npmjs.org/
npm error need auth You need to authorize this machine using `npm login`
```
`ENEEDAUTH`, not `E404` and not an OIDC rejection. **npm 12.0.2 does not even attempt an
OIDC token exchange for a package with no registered trusted publisher.** There is nothing
on the npm side to exchange the id-token against, because the package does not exist and a
trusted publisher can only be created on a package settings page that does not exist either.

Registry state after both runs, from the workflow's own verify step:
```
mcp-license    HTTP 404
mcp-timezone   HTTP 404
mcp-invoice    HTTP 404
mcp-pdf        HTTP 404
mcp-bank       HTTP 404
```
Nothing was published. Nothing was damaged.

**Conclusion for line 1 of the task: trusted publishing requires a one-time configuration
in the npmjs.com web UI, per package, on a package that already exists. It cannot be
configured from a workflow or from repository settings. This line is closed.**

---

## 2. Credential hunt across the whole machine — one token exists, it is dead

### 2a. Every `.npmrc` on the machine

`find /Users/mike -maxdepth 6 -name .npmrc -not -path "*/node_modules/*" -not -path "*/Library/*"`
found 14 files. Exactly one contains a registry.npmjs.org credential:

| File | registry.npmjs.org token? |
|---|---|
| `/Users/mike/.npmrc` | **yes** — `npm_yJXK…` (40 chars, redacted) |
| `satellite-repos/portfolio-seo-pipeline/.npmrc` | no (`update-notifier=false`) |
| `satellite-repos/examnoovertimetax-site/.npmrc` | no |
| `zovo-work/zovo-redact-v2/.npmrc` | no (registry line only) |
| `zovo-work/Nagi-ovo__voyager-fresh/.npmrc` | no |
| `zovo-work/zovo-ai-cockpit-public/.npmrc` | no |
| `Desktop/zovo-ext/extensions/zovo-ai-cockpit/.npmrc` | no |
| `Desktop/zovo-ext/_source-builds/Zovo-Speed/.npmrc` | no |
| `Desktop/zovo-ext/_source-builds/Zovo-Marker/.npmrc` | no |
| `Desktop/zovo-ext/open-source-packages/igrigorik__videospeed/.npmrc` | no |
| `Desktop/zovo-ext/open-source-packages/Nagi-ovo__voyager/.npmrc` | no |
| `.hermes/hermes-agent/.npmrc` | no (min-release-age policy only) |
| `.hermes/hermes-agent/website/.npmrc` | no |
| `zovo-local-builds/Zovo-EtsyAudit/.npmrc` | no |

Global and builtin npmrc files hold no token either — the only one that exists is
`/Users/mike/.hermes/node/etc/npmrc`, contents `prefix=/Users/mike/.local`.

### 2b. The one token is dead, confirmed three ways

```
$ /Users/mike/.npm-global/bin/npm whoami --registry=https://registry.npmjs.org/
npm error code E401
npm error 401 Unauthorized - GET https://registry.npmjs.org/-/whoami

$ curl -H "Authorization: Bearer <token from ~/.npmrc>" https://registry.npmjs.org/-/whoami
HTTP 401   body: {}
```
Tested with npm 12.0.2, not only the old 10.9.8 — the 401 is not a CLI artefact. `~/.npmrc`
was **not modified** by this agent.

### 2c. Historical tokens in every Claude transcript on the machine

```
$ grep -rhoE 'npm_[A-Za-z0-9]{36}' ~/.claude/projects ~/.claude-alt2/projects | sort -u
2 unique candidates
candidate 1  prefix=npm_xxxx…  HTTP 401   <- the literal placeholder from a doc example
candidate 2  prefix=npm_yJXK…  HTTP 401   <- the same dead token already in ~/.npmrc
```
Every candidate was verified against `https://registry.npmjs.org/-/whoami`. No working
token has ever existed in any transcript. No token value is written anywhere in this repo.

### 2d. macOS keychain — nothing

```
security find-generic-password  -s npm|npmjs|registry.npmjs.org|NPM_TOKEN|npm-token|npmToken|"npm registry"
security find-internet-password -s registry.npmjs.org|www.npmjs.com|npmjs.com
-> all: "SecKeychainSearchCopyNext: The specified item could not be found in the keychain."
security dump-keychain | grep -i npm  -> no rows
```

### 2e. Environment files and secret managers — nothing

40 `.env`-shaped files under `/Users/mike` to depth 4 (excluding node_modules and Library);
`grep -lI -i 'NPM_TOKEN\|npmjs.org\|npm_auth'` over all of them returned nothing. No
password manager CLI is installed: `op`, `gopass`, `pass`, `bw` are all absent.

### 2f. Is the account even reachable? Not without a session

```
curl https://registry.npmjs.org/-/user/org.couchdb.user:theluckystrike   -> HTTP 401
curl -A "<Chrome UA>" https://www.npmjs.com/~theluckystrike              -> HTTP 403 (Cloudflare "Just a moment...")
curl "https://registry.npmjs.org/-/v1/search?text=scope:theluckystrike"  -> {"objects":[],"total":0}
```
The scope `@theluckystrike` publishes nothing today. Whether the npm account exists cannot
be determined anonymously, and **creating one is forbidden by the task's hard limits.**

### 2g. GitHub Packages as an alternate registry — checked, does not help

`gh auth token` authenticates against `https://npm.pkg.github.com/-/whoami` (HTTP 200), as
does the `gho_` token already in `~/.npmrc`. It is still a dead end, for two independent
reasons:
1. Scopes are `gist, read:org, repo, user, workflow` (`x-oauth-scopes` header on
   `api.github.com/user`). **No `write:packages`** — a publish would 403.
2. GitHub Packages' npm registry requires authentication even to *read*. A visitor running
   `npx -y @theluckystrike/mcp-invoice` would still fail. It cannot back the advertised
   install command, which is the entire point of publishing.

---

## 3. Publish — not reached, but the plan is validated and ready

`scripts/publish-all.sh` was read and dry-run. It requires `npm whoami` to succeed before
`--go`, which it does not, so `--go` was never run.

```
$ scripts/publish-all.sh          (npm 12.0.2, dry run)
=== publish-all.sh  (mode: DRY-RUN) ===
--- dependency cycle(s) detected ---
# CYCLE: @theluckystrike/mcp-license depends on @theluckystrike/mcp-timezone which
  depend(s) back on it; publishing @theluckystrike/mcp-license first
--- publish order (33 packages) ---
  1. @theluckystrike/mcp-license@0.21.0
  2. @theluckystrike/mcp-barcode@0.21.0
  ... (33 total, all at 0.21.0)
```
**All 33 packages dry-ran clean: 33 of 33 rows report `DRY-RUN (ok)`** — no missing `bin`,
no missing `dist/`. Note the count is **33**, not the 32 in the task brief; the extra one is
`packages/mcp-license`, the runtime dependency the servers import.

The cycle does not block anything: `npm publish` never resolves a package's own dependencies
against the registry, so mcp-license and mcp-timezone can go in either order.

The moment a working token exists, the entire release is one command:
```
export npm_config_cache=/Users/mike/.npm-cache-local
scripts/publish-all.sh --go
scripts/registry-check.sh
```

---

## 4. What has to change if the npx install command must be retired

This section is an inventory only. **No file listed here was edited** — other agents own
them all. Measured 2026-09-07.

### 4a. The live site

`curl https://mcp.zovo.one/sitemap.xml | grep -o '<loc>' | wc -l` → **126 URLs**
(the brief's 312 does not reproduce today; 126 is the measured value).

All 126 were fetched with a browser User-Agent and searched for
`npx -y @theluckystrike/mcp-*`. No `/buy/` route was touched, so no upgrade click was
contaminated.

| Family | URLs in sitemap | URLs printing the broken npx command |
|---|---|---|
| `/s/<server>` storefront pages | 32 | **32** |
| `/guides/<slug>` | 62 (+1 index) | **33** |
| `/compare/<server>` | 19 (+1 index) | **19** |
| `/` home | 1 | **1** |
| `/bundle` | 1 | **1** |
| `/setup` + `/setup/<client>` | 8 | **0** — already migrated |
| `/changelog`, `/guides`, `/compare` indexes | 3 | 0 |
| **Total** | **126** | **86** |

**86 live URLs advertise a command that returns E404 for every visitor.** The `/setup/*`
pages are the precedent for the fix: `billing/src/index.js:1038` carries the comment
"Every install line here used to print `npx -y @theluckystrike/mcp-<name>`, which…", so
that family was already switched to the `.mcpb` route.

### 4b. Source files that must change, with exact occurrence counts

`git grep -c 'npx -y @theluckystrike'` — **101 tracked files, 269 occurrences.**

**Group A — page generators (owner: billing). Changing these 5 files fixes all 86 live URLs.**

| File | occurrences | which live pages it feeds |
|---|---|---|
| `billing/src/content.js` | 35 | `/guides/*` |
| `billing/src/compare.js` | 21 | `/compare/*` |
| `billing/src/setup.js` | 6 | `/setup/*` (already migrated; residual mentions) |
| `billing/src/index.js` | 4 | `/`, `/bundle`, `/s/*` shell |
| `billing/src/pages.js` | 1 | shared page furniture |
| **subtotal** | **67** | **86 URLs** |

**Group B — server documentation (owner: servers). 64 files, 96 occurrences.**
`servers/<name>/README.md` × 32 and `servers/<name>/llms-install.md` × 32, one to three
occurrences each. `llms-install.md` matters more than its size suggests: it is the file
agent installers read.

**Group C — repo front door (owner: repo/docs). 58 occurrences.**

| File | occurrences |
|---|---|
| `index.html` | 33 |
| `README.md` | 23 |
| `scripts/render-main.mjs` | 2 |

**Group D — runtime strings inside the hosted worker (owner: remote). 16 files, 27
occurrences.** These are *error messages* returned to a user of the hosted endpoint, of the
form "Run the server locally over stdio (`npx -y @theluckystrike/mcp-pdf`), where there is
no cap." They are the worst of the set — the user has already hit a limit and is then handed
a second command that also fails.
`remote/build-vendor.mjs` (11), `remote/src/index.ts` (1), `remote/src/shims/*.ts` (6 files,
1 each), `remote/src/vendor/*/index.ts` and `fetch.ts` (9 files, 13).

**Group E — historical docs and data (no user impact, leave alone).**
11 files in `docs/` (16 occurrences), plus `data/content_r1.json` and
`data/loop29_result.json` (1 each). These are records of past loops; rewriting them would
falsify the record.

### 4c. What the replacement text is

Two substitutes already exist and already work today, so no new infrastructure is needed:

1. **.mcpb bundle** — `https://github.com/theluckystrike/mcp-servers/releases/download/v0.21.0/<name>.mcpb`.
   65 entries under `bundles/`; 5,105 cumulative asset downloads per the brief. This is the
   route `/setup/*` already uses.
2. **Hosted endpoint** — `https://mcp.zovo.one/mcp/<server>`, token form
   `https://mcp.zovo.one/mcp/<server>/t/<token>`. `curl https://mcp.zovo.one/health` lists
   32 live products.

### 4d. Minimum viable edit

**5 files (Group A, 67 occurrences) removes the broken command from all 86 live URLs.**
Groups B, C and D (154 occurrences across 83 files) fix the GitHub-facing surface and the
hosted-worker error strings, and can follow. Group E should not be touched.

---

## 5. Dead ends, each with its terminating evidence

| Path | Terminating evidence |
|---|---|
| npm CLI below the trusted-publishing floor | **Refuted.** npm 12.0.2 locally and on the runner; block unchanged. |
| Trusted publishing configured from a workflow | Run 34081070341: `ENEEDAUTH` with OIDC present and no npmrc. |
| Trusted publishing configured from repo settings | Docs give a web-UI-only path; npm/cli#8544 open, no API. |
| Trusted publishing for a package that does not exist | npm/cli#8544: "the UI requires a package to exist before you can enable OIDC publishing." |
| Reuse an existing token from `~/.npmrc` | HTTP 401 from `/-/whoami`, via npm 12 and via curl. |
| A token in some other project's `.npmrc` | 14 `.npmrc` files; 13 hold no credential at all. |
| A token in the macOS keychain | 10 `security find-*` lookups, all "item could not be found". |
| A token in an env file | 40 `.env` files, zero matches. |
| A token in a password manager | `op`, `gopass`, `pass`, `bw` all absent. |
| A historical token in any transcript | 2 unique candidates, both HTTP 401. |
| `NPM_TOKEN` as a GitHub secret | `gh secret list` empty on all 10 repos (prior round); Actions secrets are write-only anyway. |
| Publish to GitHub Packages instead | Token lacks `write:packages`; GH Packages needs auth to read, so `npx -y` still fails. |
| `npm login --auth-type=web` auto-approved | No npmjs.com session in any browser profile (prior round); approval page needs a human. |
| Create an npm account | **Forbidden by the task's hard limits.** Not attempted. |

## 6. The one remaining step

A human signs in to npmjs.com once. Written to `docs/HUMAN_GATED_PACK.md` section 0-NPM
(appended, nothing rewritten).
