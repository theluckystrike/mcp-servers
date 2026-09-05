# release-check

`scripts/release-check.mjs` is the reader the wiring lists never had.

## Why it exists

A server is not shipped when its folder is finished. It has to appear in roughly twenty
places outside that folder before a release is honest: two registry manifests plus a
second registry name, the office-suite proxy, three build scripts, two data files, the
Stripe product table, the setup pages for seven clients, a guide, a comparison page, a
demo GIF, a logo, and the container and marketplace descriptors.

Every release so far found at least one of those missing, and always by hand, always late:

- v0.7.0: `quotes` carried a registry description over 100 characters and 422'd.
- v0.8.0: `barcode`'s mcpb manifest was 106 characters and had no `remotes` block,
  although `servers/barcode/remotes.json` had existed since the endpoint went live.
- v0.9.0: `zip` shipped with one registry name until the release went looking for a
  second one.
- Twice, the claude-web setup pages lagged the hosting they describe.

The pattern is the same each time: the wiring depended on an agent remembering a list.
This script reads the lists instead.

## Running it

```
npm run release:check
node scripts/release-check.mjs
```

It is also the first step of `scripts/build-mcpb.sh`, before `sync-versions.mjs` and
before any bundle is built, so a half-wired server cannot become a `.mcpb`. To build
bundles anyway while iterating on one server:

```
RELEASE_CHECK=0 /opt/homebrew/bin/bash scripts/build-mcpb.sh
```

It is read-only: it never writes, never builds, never calls the network. It imports the
billing modules only to read their exported tables.

## What it checks

Per server (`servers/<x>` with a `package.json`, `office-suite` excepted, since it is the
bundle rather than a product: no Stripe price, no comparison page, no second name):

| id | assertion |
| --- | --- |
| `version` | `package.json` version equals the release version, and every `@theluckystrike/*` range is `^<release>` |
| `manifests` | `server.json` and `server.mcpb.json` both exist |
| `desc` | every manifest description is under 100 characters (the registry 422s above it) and does not end in a machine truncation (`,.`, `..`, a trailing comma) |
| `names` | at least one additional registry name manifest (`server.variant.json` or `server.<token>.json`), and it does not repeat the primary name |
| `remotes` | if `remotes.json` exists, `server.mcpb.json.remotes` equals it by value |
| `hosted-row` | `data/distribution.json` `per_server.<x>.hosted` equals `published https://mcp.zovo.one/mcp/<x>` when `servers/<x>/remotes.json` exists, and is anything other than a `published ...` string when it does not |
| `endpoint` | if hosted, `remote/src/index.ts` routes `/mcp/<x>` |
| `web` | if hosted, `billing/src/setup.js` does not put it in `WEB_EXCLUDED` and it has a `WEB_ANGLE` entry |
| `children` | `servers/office-suite/src/index.ts` `CHILDREN` lists it |
| `mcpb-lists` | `scripts/build-mcpb.sh` `SERVERS`, `DISPLAY_NAME` and `KEYWORDS` all carry it |
| `mirrors` | `scripts/sync-mirrors.sh` `ALL_SERVERS` and `topics_for` both carry it |
| `pages` | `scripts/build-pages.mjs` `ids` carries it |
| `facts` | `data/facts.json` has `servers.<x>` |
| `tools` | `data/tools.json` has a non-empty entry |
| `product` | `billing/src/index.js` `PRODUCTS` has it with a real Stripe price id |
| `setup` | `SETUP_SERVERS` has it and `ANGLE` has a sentence for all six installed clients |
| `compare` | `billing/src/compare.js` `COMPARE` has a page |
| `guide` | at least one `GUIDES` entry mentions the server |
| `gif` `logo` | `assets/demo-<x>.gif` and `assets/<x>-logo.png` |
| `docker` `smithery` `glama` `llms` `spec` `contract` | `Dockerfile`, `smithery.yaml`, `glama.json`, `llms-install.md`, `SPEC.md`, `test/contract.test.mjs` |

`hosted-row` exists because `data/distribution.json` is hand-edited prose next to a
machine fact: the exact string `published https://mcp.zovo.one/mcp/<x>` is the only value
that means "this server is live at its own endpoint," and a round that lands hosting mid-flight
(billing-docs, deposits) tends to leave that row with a narrative sentence instead
("shipped by the remote agent during round 14; remotes.json merged...") that reads fine to a
person but breaks the `hostedServers` count in `scripts/kpi.mjs` and any other reader doing a
string match. The check reads truth from `servers/<x>/remotes.json` the same way `remotes`,
`endpoint` and `web` do, and its failure message names the exact string to put in
`data/distribution.json` rather than just flagging the mismatch.

Estate-wide:

- `PRODUCTS.bundle` names the right server count and the right saving, both computed from
  the servers on disk and the per-server price (19 x $19 - $39 = $322). Per-server prices
  must be uniform for that arithmetic to mean anything, so that is asserted too.
- Every hosted server has a claude-web page.
- No list carries a server that does not exist, so a deleted or renamed server cannot
  leave a dangling row in `build-mcpb`, `sync-mirrors`, `PRODUCTS`, `SETUP_SERVERS` or
  `COMPARE`.

The release version is `servers/office-suite/package.json`'s. It is the umbrella package
every child is vendored into, so nothing can ship at a version it disagrees with. The root
`package.json` is the private workspace shell and stays at 0.1.0 by design.

`server.npm-package.json` is skipped by the description check: it is a package fragment
(`{"npm": {...}}`), has no registry name, and is deliberately pinned at 0.1.0 because no
`@theluckystrike` package is on npm.

## Waivers

Two kinds of thing fail this script.

A **wiring gap** is a one-line omission. It blocks, because it is fixed in the minute it
is found.

A **content gap** is a document somebody has to write. Blocking the whole release chain on
one would only get this script deleted from `build-mcpb.sh`, so those are recorded in the
`WAIVERS` table at the bottom of the script, by server and check, with the reason. A
waived failure prints `gap` and does not block.

Everything else about a waiver still blocks:

- the same check failing on a server that is **not** in the table blocks, so the list
  cannot grow silently, which is how known-gap tables usually rot;
- a waiver whose check now **passes** is reported `STALE` and blocks, so the entry has to
  be deleted when the work lands;
- a waiver naming a server that no longer exists blocks.

Both behaviours were checked against a control before this was committed: removing
`servers/barcode/server.variant.json` failed the `names` check and exited 1, and writing a
placeholder `servers/kanban/SPEC.md` made the `spec` waiver report `STALE` and exit 1.

The `compare` check has a second, narrower escape valve that is not a waiver: a server
whose registry search genuinely turns up no competitor can carry a dated
`compare_none.<server>` note in `data/facts.json` (`{ date, tokens }`) instead of a
`COMPARE` page. The check accepts the note for 30 days from its date; past that it fails
again with an "expired" message so the registry gets re-probed rather than the gap staying
silently excused forever. A waiver never re-checks itself this way, which is why this is a
note in a data file the check reads, not another WAIVERS row.

### Open at 2026-09-04 (0 gaps, 0 waivers)

| check | servers | why |
| --- | --- | --- |
| (none) | -- | `spec` and `contract` landed for bank-statement, calendar, image, kanban and pdf since the table above was last written; `scripts/gen-spec.mjs`'s `CURATED` table now covers all nineteen servers. `compare`/zip is no longer a waiver either: `data/facts.json` `compare_none.zip` records the dated, honest registry search (docs/CONTENT_R12_RESULT.md) that found no genuine competitor, and the `compare` check accepts that note for 30 days from its date before it expires and fails again, so a competitor appearing later gets re-probed rather than staying silently excused. `WAIVERS` in `scripts/release-check.mjs` is now empty. |

`node scripts/release-check.mjs` exits 0 with `release-check: green (0 recorded gap(s))`.

## What the first run found and fixed

Twenty-four checks over nineteen servers, 456 cells. Nineteen wiring failures, all real,
all fixed in the commits beside this document:

1. **Nine registry descriptions over 100 characters** in `server.json`
   (barcode 153, calendar 114, clauses 180, image 177, pdf 150, quotes 144,
   recurring 131, resume 115, zip 170). `server.json` carries the same registry name and
   schema as the manifest that gets published; it is held back only because no
   `@theluckystrike` package is on npm yet. Every one of those would 422 the day it is.
2. **Five descriptions cut mid-sentence by an earlier machine fix**: `calendar`
   ("... double bookings, export,."), `pdf` ("... mark an invoice."), `recurring`
   ("... into your invoice server,."), `resume` ("... you stored once..") and `currency`
   ("... from the European Central Bank. No API key,."). All were under 100 and so passed
   the length check every previous release ran; they read as damage in a registry listing.
   Rewritten as sentences.
3. **`barcode` had one registry name.** Same defect v0.9.0 found in `zip`, in the server
   added immediately before it. Added `servers/barcode/server.variant.json`,
   `io.github.theluckystrike/qr-code`, description 87 characters.
4. **Five servers had no `topics_for` line in `sync-mirrors.sh`** (pdf, calendar, kanban,
   image, bank-statement), so their mirrors were pushed with only the five shared topics
   and none of their own. Silent: the `case` simply falls through.

Everything else in the wiring was already correct: all nineteen servers were in
`CHILDREN`, all three `build-mcpb` lists, `build-pages` ids, `facts.json`, `tools.json`,
`PRODUCTS`, `SETUP_SERVERS` with six angles each, and every hosted server had both its
`/mcp/<x>` route and its claude-web page.

## Adding a server

Run `node scripts/release-check.mjs` after the server folder is finished. The failing
column names the file and the list to edit. That is the whole checklist; there is no
second copy of it in a document that can go stale.
