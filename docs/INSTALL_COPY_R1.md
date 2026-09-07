# Install copy, round 1: the site stopped printing an install command that cannot work

Date: 2026-09-07. Agent: install-copy (loop 29).
Owned files: `billing/src/{content,compare,setup,index}.js`, `data/facts.json`, `remote/src/**`,
and this file. `billing/src/pages.js` is generated and was regenerated, never hand edited.

## The defect

Nothing has been published to npm (`docs/NPM_UNBLOCK_R2.md`: all 33 packages HTTP 404, the first
publish needs a human browser login). 86 of the 126 live sitemap URLs printed
`npx -y @theluckystrike/mcp-<name>` anyway, and, worse than the prose, the client configuration
blocks on those pages set `"command": "npx"`. That block does not start a server. It is not a
wording preference, it is the product's first instruction being wrong.

Two paths work today and both lead now:

1. the one-click `.mcpb` bundle from https://github.com/theluckystrike/mcp-servers/releases/latest;
2. the hosted endpoint, `https://mcp.zovo.one/mcp/<server>`, with a token from
   `GET https://mcp.zovo.one/mcp/connect`. 30 servers are hosted, read off the `SERVERS` map in
   `remote/src/index.ts`; office-suite is not, because it spawns 31 local child processes
   (`servers/office-suite/src/index.ts`, `CHILDREN`).

Where a JSON block is genuinely needed, it now prints the `node /absolute/path/.../dist/index.js`
form from a clone and build, which works. The `npx` form stays beneath it, labelled, so every page
becomes correct the moment `npm publish` succeeds and nothing else has to change.

## Occurrence counts, `npx -y @theluckystrike`

`grep -o 'npx -y @theluckystrike' <file> | wc -l`

| File | Before | After | What the remainder is |
|---|---|---|---|
| `billing/src/content.js` | 35 | 4 | 2 inside the `install()` helper (its doc comment and the one labelled line it emits), 2 in the two guides that are *about* npx not working |
| `billing/src/compare.js` | 21 | 3 | 1 in the `ours()` helper, 2 in the recurring+invoice pair block, all labelled |
| `billing/src/setup.js` | 6 | 0 | the npx form is now built by `npxJson()` / `npmPendingBlock()` from `s.pkg`, always under its label |
| `billing/src/index.js` | 4 | 5 | 2 code comments, 1 in `NPM_PENDING_NOTE`, 2 in the "not yet" list item on `/` and `/bundle` |
| `billing/src/pages.js` (generated) | 32 | 42 | regenerated from `servers/*/README.md`, which the servers agent rewrote in commit 0589146; the rise is their added disclosure text, not new install lines |
| `data/facts.json` | 0 | 0 | holds no install string; see below |
| `remote/src/**` | 18 | 2 | both in `index.ts`, one comment and one `stdio_install_npm_pending` value marked NOT WORKING YET |
| `remote/build-vendor.mjs` | 11 | 0 | see the ownership note below |

Live URLs fixed once deployed: **86 of 86** (32 `/s/`, 33 `/guides/`, 19 `/compare/`, `/`, `/bundle`),
plus the 216 `/setup/<client>/<server>` pages, which are not in the sitemap but are where the config
block a person actually pastes comes from.

## Page-count check, nothing lost

Every key is a live URL submitted to IndexNow, so the keys were compared against `HEAD` by import,
not by eye:

```
GUIDES:  HEAD 62 -> now 62; lost=none; added=none; order identical=true
COMPARE: HEAD 19 -> now 19; lost=none; added=none; order identical=true
PAGES:   HEAD 32 -> now 32; lost=none; added=none; order identical=true
SETUP_SERVERS 31 -> 31, CLIENTS 7 -> 7, 216 /setup/<client>/<server> pages render
```

`node --check` passes on all five billing files including the regenerated `pages.js`.
`data/facts.json` parses.

## What changed, by file

### `billing/src/content.js` (35 -> 4)
One `install(slug)` helper replaces 30 hand-written install sections and both two-server pairs
(invoice+deposits, invoice+billing-docs). It prints the bundle, the hosted line for the 30 servers
that have one, the clone-and-build with a `node` config block, then the labelled npx line. 15
trailing paragraphs that pointed at "exactly the same block" or repeated the npm caveat were
rewritten so they still follow what is above them. The office-suite guide keeps its own hand-written
section and gained a working `node` config block. The two guides whose subject *is* npx
(`mcp-on-windows-paths-and-npx`, `install-mcp-servers-without-npm`) were left alone: they were
already correct and are what the new blocks link to.

### `billing/src/compare.js` (21 -> 3)
One `ours(slug)` helper replaces 18 identical `<p>Ours, Claude Code:</p>` blocks; the recurring
page's two-server block and the per-diem comparison table's "Install path" cell were done by hand.
Competitor install lines are their own published commands and were not touched.

### `billing/src/setup.js` (6 -> 0), and two live defects found there
- `serverJson()` emitted `"command": "npx"` for all 216 `/setup/<client>/<server>` pages. It now
  emits `node` plus the absolute path to `dist/index.js`; `npxJson()` prints the old form under a
  label, and `buildBlock()` says how to produce the file the path points at.
- **Doubled hosted URL.** Eight servers carried a full URL in `SETUP_SERVERS[x].hosted`, which
  `hostedBlock()` interpolates into `` `${BASE}/mcp/${s.hosted}` ``, printing
  `https://mcp.zovo.one/mcp/https://mcp.zovo.one/mcp/asset-register`. Fixed.
- **Fifteen hosted servers said they had no endpoint.** `hosted` was `null` for docx, timezone,
  resume, recurring, clauses, pdf, calendar, kanban, image, bank-statement, quotes, billing-docs,
  deposits, per-diem and zip, so their setup pages told a visitor to install locally because there
  was no hosted route. All 31 entries are now the slug, or `null` for office-suite alone, checked
  against `remote/src/index.ts`.
- Stale office-suite counts corrected from the code: twenty children -> 31
  (`servers/office-suite/src/index.ts`), 198 tools -> 292 (`OFFICE_SUITE_TOOLS`,
  `billing/src/index.js`), two name collisions -> four.
- The two "paste what `which npx` prints" pitfalls now name `which node`, which is the command the
  config actually runs.

### `billing/src/index.js` (4 -> 5)
`/` and `/bundle` had npx as step 3 of "Three ways to start" with the caveat in a muted paragraph
underneath. The list is now four steps: hosted URL, `.mcpb`, clone and build, and npx marked
"not yet" on the line itself. `NPM_PENDING_NOTE` now says plainly that a config whose `"command"`
is `"npx"` will not start a server.

### `data/facts.json` (0 -> 0)
**Correction to the brief:** `pages.js` is generated by `scripts/build-pages.mjs` from
`servers/<id>/README.md` rendered through `marked`, plus `facts.json` for the free-tier lines. No
npx string has ever been in `facts.json`, so there was nothing there to change and none was
invented. `pages.js` was regenerated, which is what actually fixes the 32 `/s/` pages. One honest
edit was made: the release gate "Fresh-machine npx start < 5 s" cannot run, because there has never
been a publish; it now names the `.mcpb` and clone paths and says the npx form is blocked. That row
renders into `index.html` through `scripts/render-main.mjs`, which someone else owns and has to run.

### `remote/src/**` (18 -> 2)
The six upload shims, and eleven strings inside the vendored servers, told a user who had just hit a
hosted cap or a Pro gate to run a command that also fails. They now point at the server's `.mcpb`
bundle. `index.ts`'s `stdio_install` field, served at `GET /mcp`, was the npx line; it is now
`one_click_install`, a `stdio_install` that clones and builds, and a
`stdio_install_npm_pending` marked NOT WORKING YET.

## Also fixed this round: the hosted endpoints answered 401 to every prober

`GET /mcp/<server>` with no credential returned 401. That is right for a client with a bad token and
wrong for the two callers who actually send it: a directory's health prober and a person opening the
link. Glama shows four of these servers with a red "Server is not responding" badge sourced from that
401, an awesome-list was skipped this round because its entry requires a public endpoint that
answers, and Cloudflare logged 24,330 401s on this hostname in one week.

A `GET` or `HEAD` with no `Authorization` header **and** no token in the URL now returns 200 and a
small public document: name, URL, protocol, build, a one-line summary, the tool count and list, the
free-tier limits, and where a token comes from. Every field is lifted from `indexDoc()`, the same
document `/mcp` already serves, so the two cannot drift.

The authorisation boundary did not move. Measured on the built worker with a stub KV:

| Request | Before | After |
|---|---|---|
| `GET /mcp/invoice`, no auth header | 401 | **200** |
| `HEAD /mcp/invoice`, no auth header | 401 | **200** |
| `GET /mcp/invoice`, `Authorization: Bearer nope` | 401 | 401 |
| `POST /mcp/invoice`, no auth header | 401 | 401 |
| `POST /mcp/invoice`, `Authorization: Bearer nope` | 401 | 401 |
| `GET /mcp/invoice/t/badtoken` | 401 | 401 |
| `GET /mcp/not-a-server` | 404 | 404 |

All 30 endpoints answer 200 with a non-empty summary and a real tool count. The Streamable HTTP
event stream is unaffected: a real client always sends the header, so it still goes through
`authenticate()`.

## Ownership note that needs a decision

`remote/src/vendor/**` is **generated** by `remote/build-vendor.mjs`, which `npm run deploy -w remote`
runs before `wrangler deploy`. Editing the vendored files alone would have been silently reverted on
the next deploy, so the eleven replacement payloads were changed in `build-vendor.mjs` and the vendor
tree regenerated from it. `build-vendor.mjs` sits just outside the assigned path (`remote/src/`);
flagging it rather than hiding it. Regenerating also pulled in two pieces of pre-existing drift that
belong to nobody's edit: 21 `version.ts` files moved 0.20.0 -> 0.21.0, and `invoice/index.ts` gained
`delivery-schedule` in `PROFILE_READERS`. That is exactly what a deploy would have done.

## Still broken, not mine to fix

Four `/s/` pages still print an **undisclosed** npx config block: **per-diem, asset-register,
change-order, delivery-schedule**. Their `servers/<name>/README.md` files were missed by the
servers agent's pass (commit 0589146) and carry no `.mcpb` line and no "publish is pending" note.
`billing/src/pages.js` renders those READMEs verbatim, so this is fixed by editing those four
READMEs and re-running `node scripts/build-pages.mjs`, not by anything in the billing worker.

## Tests

- `npm test -w remote` (or `cd remote && npm test`): **30 pass, 0 fail**, unchanged from before.
- `cd billing && npm test`: **104 tests, 93 pass, 11 fail**. The same 11 named failures reproduce on
  a clean `git archive HEAD` checkout, so none is new. They are about llms.txt naming office-suite,
  VALIDATION drift, and the "First five minutes" round data, all owned elsewhere.
- `remote/src/index.ts` bundles clean through esbuild (`--bundle --format=esm`), which is the same
  step wrangler runs. No `wrangler deploy` was run, in either worker.
