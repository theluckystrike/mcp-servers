# Docker MCP catalog, round 2: one server submitted, verified end to end (2026-09-09)

Round 1 established two things: the sixteen-server pull request was the wrong shape and we closed
it ourselves, and no Dockerfile in this project could build until the mirror Dockerfile was
rewritten. This round re-verified that fix from a clean clone, learned the registry's actual
current contract from its own code rather than from notes, and opened a single-server pull
request that passes every check the repository's CI runs.

**Pull request: https://github.com/docker/mcp-registry/pull/5030 — `Add timezone MCP server`,
one file, 23 lines added.**

## 1. The build was re-verified, not inherited

Nothing here is taken on the previous round's word. A fresh `git clone --depth 1` of
`github.com/theluckystrike/mcp-timezone` landed on `54bff6bb65bd865bdbf43d7547e493b510c96be9`,
"Dockerfile: build from this repository, not from a monorepo layout it does not have", and was
built with the cache disabled:

    docker build --no-cache -t mcp-timezone:r2 .

Exit 0. The two expensive stages were the only ones that took real time:

    #13 [build 6/6]   RUN npm install --no-audit --no-fund && npm run build   DONE 43.3s
    #15 [stage-1 6/6] RUN npm install --omit=dev --no-audit --no-fund         DONE 36.9s
    total of all stage DONE times                                                 84.4s

Resulting image, from `docker image inspect`:

    id     sha256:d0b317845d62791b8bf3e54f6de36b2481e6cb956396ab46f0f3d2f1d56bc19f
    size   324MB (70,442,278 bytes compressed layers), arm64/linux
    cmd    ["node","dist/index.js"]

Round 1 recorded "about four minutes". These 84.4 seconds are the sum of the per-stage `DONE`
times printed by buildkit, not wall clock, and the run was not timed end to end, so the two
numbers are from different instruments and neither contradicts the other. What is certain is that
the build completed with exit 0 from a clean clone with the cache disabled.

## 2. A real MCP handshake, with the network switched off

Three JSON-RPC lines were piped into the container. The `--network none` is deliberate: it is the
evidence behind the `disableNetwork: true` in the catalog entry.

    ( cat handshake.jsonl; sleep 4 ) | docker run -i --rm --network none mcp-timezone:r2

stderr:

    mcp-timezone ready (free), 490 places, data in /root/.local/share/mcp-servers/timezone

`initialize` answered, verbatim:

    {"result":{"protocolVersion":"2024-11-05",
      "capabilities":{"tools":{"listChanged":true},"resources":{"listChanged":true},"prompts":{"listChanged":true}},
      "serverInfo":{"name":"mcp-timezone","version":"0.20.0"}},
     "jsonrpc":"2.0","id":1}

`tools/list` answered 11 tools: `license_status`, `license_activate`, `now`, `convert_time`,
`overlap`, `find_meeting_slots`, `dst_changes`, `business_days`, `contacts_set`, `contacts_list`,
`ics_create`.

Listing tools is not the same as doing work, so four `tools/call` requests were issued in the same
offline container. Abridged, but each is real output:

    now(["Europe/Warsaw","America/New_York"])
      Europe/Warsaw:    2026-09-09 08:36 Wed (GMT+2, UTC+02:00)
      America/New_York: 2026-09-09 02:36 Wed (EDT,   UTC-04:00)

    dst_changes({zone:"Europe/Warsaw", year:2026})
      2026-03-29T01:00:00.000Z  UTC+01:00 -> UTC+02:00 (+60 min)
      2026-10-25T01:00:00.000Z  UTC+02:00 -> UTC+01:00 (-60 min)

    find_meeting_slots(Warsaw + New York)
      9 slot(s) fit all 2 participants (60 min, 5 day(s)).
      1. 2026-09-09T13:30:00.000Z fairness 3.00h  A 15:30-16:30 | B 09:30-10:30

    license_status()
      {"product":"timezone","tier":"free","reason":"no license found",
       "upgradeUrl":"https://mcp.zovo.one/buy/timezone"}

The version string still reads `0.20.0` because the mirrors were last synced before v0.21.0. That
is a known and recorded gap, not a new one, and it does not affect the submission: the entry pins
the commit, not the version.

## 3. Persistence was measured before it was claimed

The server writes contacts, the licence file and the monthly `.ics` counter under
`$XDG_DATA_HOME` or `~/.local/share/mcp-servers/timezone`. In a container with no volume that is
an ephemeral layer, so `contacts_set` would silently not survive a restart. Rather than assert
either way, both cases were run:

    container A, -v mcp-timezone-data:/root/.local/share/mcp-servers/timezone
      contacts_set{name:"Maria", zone:"America/Sao_Paulo"}
      -> Saved Maria: America/Sao_Paulo, 09:00-17:00 local.

    container B, brand new, same named volume
      contacts_list
      -> 1 contact(s): Maria: America/Sao_Paulo, ... works 09:00-17:00

    container C, no volume
      contacts_list
      -> No contacts saved yet.

So the entry declares that one named volume and nothing else. It is a Docker named volume, not a
host bind mount: the server never sees a path on the user's filesystem.

## 4. What the registry actually requires today

Round 1 recorded "a `server.yaml` plus a `tools.json`, and there is a `task validate` and possibly
a `task build`". Read against the repository's own code, that is close but wrong in two places.

- **`tools.json` is optional and, for this server, better left out.** `cmd/build/main.go` uses it
  only to *skip* running the container: "When this file is found next to your `server.yaml`, the
  `task build -- --tools your-server-name` lists the tools by reading the file instead of running
  the server." It exists for servers that cannot list tools without credentials. Ours can, so
  omitting it means CI proves the container really answers `tools/list` instead of reading our
  claim about it. `cmd/catalog` never reads it either; every generated `catalog.yaml` has
  `tools: []` and a `toolsUrl` that Docker's own pipeline fills in.
- **`readme.md` is a remote-server file.** 82 of 328 entries have one, and `cmd/remote-wizard`
  is the only thing that writes one. Local entries are a lone `server.yaml`.

What CI runs is not `task validate` alone. `.github/workflows/ci.yaml` builds the tooling from
`main`, then hands the changed servers to `scripts/ci-validation.sh`, which runs, per server:

    validate --name <name>
    build --tools --pull-community <name>
    catalog <name>
    clean <name>

plus `go test ./...` against the PR branch. `task` was not installed on this machine, which does
not matter: every task is a one-line `go run ./cmd/<x>`, which is exactly what CI compiles.

The entry was generated, not hand-written, as instructed:

    go run ./cmd/create --category productivity https://github.com/theluckystrike/mcp-timezone

That command built the image from the pinned git URL, ran it, reported `11 tools found.`, and
wrote `servers/timezone/server.yaml`. It guessed the catalog name `timezone` (there is an existing
`servers/time`, the reference server, but no `timezone`), pinned commit `54bff6b`, pulled six tags
from the repository topics and found the icon. It left three `TODO` placeholders — title,
description and a `config` block — which were replaced by hand. The `config` block was deleted
outright: this server has no secrets, no environment variables and no parameters.

## 5. Validation, run rather than noted

All four CI steps were executed locally against the real Docker daemon.

`go run ./cmd/validate --name timezone`:

    ✅ Name is valid
    ✅ Directory is valid
    ✅ Title is valid
    ✅ YAML formatting is valid
    ✅ Commit is pinned
    ✅ Secrets are valid
    ✅ Config env is valid
    ✅ License is valid
    ✅ Icon is valid
    ✅ Remote validation skipped (not a remote server)
    ✅ OAuth dynamic configuration is valid

Exit 0. Two of those are not free passes. "YAML formatting is valid" is `npx --yes prettier
--check` on the file, which had to be satisfied by hand. "Icon is valid" fetches
`avatars.githubusercontent.com/u/51033404?v=4` and decodes it: 460x460 PNG, 155,912 bytes, inside
the 512x512 and 2MB limits. "License is valid" is a GitHub API call that read `MIT` off the mirror
repository.

`go run ./cmd/build --tools --pull-community timezone`:

    #13 naming to docker.io/mcp/timezone:latest done
    11 tools found.
    ✅ Image built as mcp/timezone

`go run ./cmd/catalog timezone` wrote `catalogs/timezone/catalog.yaml`, which resolved to the
title, the description, `disableNetwork: true`, the named volume, `license: MIT License`,
`owner: theluckystrike` and `source:` pinned to the commit tree URL. `go run ./cmd/clean timezone`
and `go test ./...` both passed.

### The pull request's own CI cannot be made to pass by us, and that is not specific to us

`gh pr checks 5030` reports "no checks reported". The reason is exact and was looked up rather
than guessed. The workflow run exists:

    https://github.com/docker/mcp-registry/actions/runs/34320631981
    ci.yaml  add-mcp-timezone  theluckystrike/mcp-registry  conclusion: action_required

`action_required` is GitHub's status for a fork pull request whose workflows a maintainer has not
yet approved. Every other server PR opened on 2026-09-09 sits in the same state:

    2026-09-09T06:46  action_required  add-mcp-timezone            theluckystrike/mcp-registry
    2026-09-09T06:09  action_required  add-tasklite                shimon-ks/mcp-registry
    2026-09-09T05:37  action_required  add-proofstack              lttxzmj/mcp-reg
    2026-09-09T05:22  action_required  add-codecalc                suavecito585/mcp-registry
    2026-09-09T05:15  success          automation/update-pin-...   docker/mcp-registry

Only branches on `docker/mcp-registry` itself run without approval. There is no action available
to us or to the operator that starts that run; a Docker maintainer has to click it. This is why
every CI step was executed locally against a real Docker daemon instead of being left to CI: the
four commands in section 5 are precisely what `scripts/ci-validation.sh` would run, and they all
returned 0 here.

## 6. The entry, and why each line is honest

```yaml
name: timezone
image: mcp/timezone
type: server
meta:
  category: productivity
  tags: [claude, cursor, ics, meeting-planner, model-context-protocol, timezone]
about:
  title: Timezone Meeting Planner
  description: Convert times between places, find the slots that sit inside everyone's working
    hours, check DST changes, count business days and write .ics invites. Resolves IANA zones,
    city, country and abbreviation names from a 490-place table compiled into the image, so it
    needs no network and no credentials. Free to use; a paid Pro key lifts the free limits on
    participant count, search horizon, saved contacts and monthly .ics files.
  icon: https://avatars.githubusercontent.com/u/51033404?v=4
source:
  project: https://github.com/theluckystrike/mcp-timezone
  commit: 54bff6bb65bd865bdbf43d7547e493b510c96be9
run:
  volumes:
    - mcp-timezone-data:/root/.local/share/mcp-servers/timezone
  disableNetwork: true
```

- The title cannot contain "MCP" or "Server" (`isTitleValid` rejects both) and every word must be
  capitalised, so `Timezone Meeting Planner`.
- "490-place table" is the number the server prints on startup, from `PLACE_COUNT =
  TABLE.byName.size`.
- "needs no network" survived a grep for `fetch(`, `http.request`, `https.request`, `axios` and
  `net.connect` across `src/` and both vendored packages: zero hits. It was then demonstrated
  under `--network none`.
- **The paid tier is stated in the catalog description itself, not buried.** The free limits are
  named in the pull request body with their exact values, read out of `src/index.ts`:
  `FREE_MAX_PARTICIPANTS = 3`, `FREE_MAX_DAYS = 5`, `FREE_MAX_CONTACTS = 5`,
  `FREE_ICS_PER_MONTH = 3`. All eleven tools list and run on the free tier; nothing is hidden
  behind the key, and a search longer than five days is shortened rather than refused
  (`src/index.ts:322-327`). `license_activate` verifies offline, which is why `disableNetwork`
  does not break it.

## 7. The finding that matters more than the pull request

The registry's merge queue is close to stalled, and this was measured, not felt.

- `repos/docker/mcp-registry/commits/main` last moved on **2026-08-21**, nineteen days ago.
- There are **1,145 pages of open pull requests at one per page** — 1,145 open PRs. Ours is #5030;
  #5029, #5028 and #5027 were all opened the same day, all adding servers.
- Over the 1,088 commits of history between 2026-03-20 and 2026-08-21, `git log --diff-filter=A`
  on `servers/*/server.yaml` finds exactly **one** new server entry merged: `servers/incident-io`
  on 2026-04-01 (#2203), and it was a *remote* server. No new **local** server entry has been
  merged into this repository in the entire window.

This does not change what to do — a correctly shaped single-server PR is still the only way in,
and it is now open and passing — but it does change what to expect. Round 1's premise that "the
forty most recent merges each added one server" describes an older period; today the forty most
recent merges are pin-bump bot commits and edits to existing entries. Treat the Docker catalog as
a slow lottery ticket, not a distribution channel with a delivery date, and do not spend another
loop on a second submission until this one moves.

## 8. Not done, and deliberately

- **No `readme.md`.** A provided `servers/timezone/readme.md` overrides the auto-generated Docker
  Hub overview page (that is exactly what #4743 fixed for circleci), so it is a real lever on the
  listing copy. It was left out to keep the diff to one file, which is the shape that gets merged.
  Add it as a follow-up commit if a reviewer engages.
- **The monorepo Dockerfile cycle is still unfixed.** `packages/mcp-license` and
  `servers/timezone` import each other, so the monorepo Dockerfiles still cannot build linearly.
  The submission does not depend on it — the catalog builds from the mirror — but the next server
  submitted will hit the same wall unless it is also mirrored.
- **Nothing was deployed and no other file in this repository was touched.**
