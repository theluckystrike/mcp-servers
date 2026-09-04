# Round 11: wire mcp-zip into the estate, demo GIF, Docker MCP catalog + Cline marketplace

status: DONE

evidence:

## A. Wiring the 19th server into the estate

`servers/zip` existed as a self-contained unit (docs/ZIP_RESULT.md) with nothing outside it touched. The same
seven wiring points round 9 used for barcode.

- **office-suite CHILDREN** (`servers/office-suite/src/index.ts`): one row appended,
  `{ id: "zip", pkg: "@theluckystrike/mcp-zip", optional: true }`. Optional children resolve from the monorepo
  path first, so no dependency was added to `servers/office-suite/package.json`. Rebuilt and read back over
  stdio: office-suite lists **186 tools** and the stderr line reads
  `proxying [... barcode, zip], 184 tools`; the seven zip tools come through as
  `zip_create, zip_list, zip_extract, zip_add, zip_extract_text, zip_bundle_month, zip_history`.

- **scripts/build-mcpb.sh**: `zip` appended to `SERVERS`, `[zip]="Zip"` to `DISPLAY_NAME`, and
  `[zip]='["mcp","model-context-protocol","zip","archive","compression","unzip","extract"]'` to `KEYWORDS`.
  The bundle build itself was NOT run (release chain, out of scope), so `bundles/zip.mcpb` does not exist and
  `data/distribution.json` records `mcpb: pending`.

- **scripts/sync-mirrors.sh**: `zip` added to `ALL_SERVERS` (before `office-suite`, which stays last) and
  `zip) echo "zip archive compression unzip" ;;` to `topics_for`. Not run this round.

- **data/facts.json**: `servers.zip` added with the same eight keys as every other server, free/pro copied
  from the README's Free vs Pro table verbatim (20 archives a calendar month, 25 MB and 200 entries each,
  reading never metered). `build-pages.mjs` dereferences `facts.servers[id]` with no guard, so this had to
  exist before the page build.

- **scripts/build-pages.mjs + billing deploy**: `"zip"` appended to `ids`; `node scripts/build-pages.mjs` ->
  `pages: ... barcode, zip bytes 298697` (19 pages). `cd billing && npx wrangler deploy` ->
  `Uploaded mcp-billing (13.93 sec)`, version `3160f0ab-eee5-4d6d-bb98-28c3182e82f6`, custom domain
  mcp.zovo.one. Verified live:
  ```
  /s/zip      200   <title>MCP Zip for Claude, Cursor and any MCP client</title>
  /buy/zip    303 -> https://checkout.stripe.com/c/pay/cs_live_b1ikaFMUlmyguDHbTwptJXHVdN8eN7w3...
  /sitemap.xml  contains https://mcp.zovo.one/s/zip
  /llms.txt   - [MCP Zip](https://mcp.zovo.one/s/zip): Make a zip, look inside one, and unpack one...
  ```
  `billing/src/index.js` already carried the zip Stripe product, so no billing source was edited; only the
  generated `billing/src/pages.js`, whose whole diff is the one zip page.

- **data/tools.json**: `zip` appended, generated from a live `tools/list` over stdio against
  `servers/zip/dist/index.js`, not from `src` or `SPEC.md`. Seven entries; the two `license_*` tools are
  filtered out, matching every other server's entry in the file.

- **scripts/validate.mjs**: a `zip` probe added at the head of `PROBES` (13 checks per tier, 26 total), and
  `"zip"` added to the `/buy/<product>` list in the billing section (1 check). A 60-line raw stored-entry zip
  writer sits above `PROBES`, in this file rather than imported from `servers/zip/test/_zipgen.mjs`, because
  another agent owns `servers/zip/test` this round and the probe has to own the bytes it crafts. The probe:
  1. `zip_create` packs two temp files (a 62.5 KB repetitive CSV and a 38 B note) and names both entries.
  2. `zip_list` gives every entry a ratio (`148.61x` on that pair).
  3. `zip_extract` with `dry_run: true` reports `Dry run: 2 files` and `out_dir` does not exist afterwards.
  4. the real extract then writes exactly that plan and `note.txt` comes back byte-identical.
  5. a crafted archive holding `safe.txt` and `../escaped.txt` is refused
     (`1 of the 2 selected entries ... would be unsafe to write`), nothing lands beside `out_dir`, and the
     safe entry is not written either.
  6. `zip_extract_text` reads one entry inline.
  7. the free entry cap, written per tier: free refuses 201 files with `isError: false`, the count named and
     `mcp.zovo.one/buy/zip`, and `many.zip` does not exist; Pro packs all 201.
  8. `zip_history`, per tier: both name `bundle.zip`, free additionally matches
     `\d+ of 20 free archives used in \d{4}-\d{2}` and Pro must NOT contain `free archive`.

  `node scripts/validate.mjs` -> **458/458** (run 50 in `data/validation.json`), zip **26/26 in 372 ms**,
  remote 55/55, billing 25/25, 19 units.

## B. Demo GIF

`assets/demo-zip.gif`, **128,767 bytes (125.7 KB)**, under the 400 KB cap.

```
$ file assets/demo-zip.gif
assets/demo-zip.gif: GIF image data, version 89a, 900 x 480
$ ffprobe ... assets/demo-zip.gif
width=900 height=480 nb_frames=271
```

`scripts/demo/zip.tape` is byte-identical in settings to the other eighteen (900x480, Dracula, FontSize 13,
40ms typing, `Sleep 10s`). `scripts/demo/drive.mjs` gained a `zip` sequence, the same raw zip writer as the
validator (the archive "somebody sent you" has to hold a traversal entry and a bomb, and no honest packer
produces either), and a `cwd` option on the spawned child. No Pro key: every beat in this demo is free.

Three beats, chosen so every line is a fact: `zip_create` packs `**/*.csv` and `**/*.txt` out of a folder while
excluding `**/node_modules/**` (2 entries, 431 B from 62.6 KB); `zip_extract` on a crafted archive holding
`../../.ssh/authorized_keys` and a 200 MB zeros entry is refused with both reasons named and the driver then
prints `out_dir was never created; nothing was inflated`; `zip_extract_text` reads one entry back inline. The
final frame was extracted with ffmpeg and read back: all three beats are on screen and legible.

The measured constraint that shaped it: the transcript is 24 terminal rows against roughly 29 that fit in
900x480 at FontSize 13, and it only fits because the demo runs in a **short** working directory. The first
draft, five beats in the default per-run sandbox
(`mkdtempSync(join(tmpdir(), "mcp-demo-"))`, 62 characters before the file name on macOS), measured **45 rows**
at 113 columns: the `zip_create` argument line alone was 251 characters, three rows on its own. `zip` takes
paths from the caller and echoes the resolved path back, so the fix was the child's cwd, not the printing:
`mkdtempSync("/tmp/zip-demo-")` (18 characters resolved) passed as `spawn(..., { cwd })`, with
`process.chdir` in the driver so the relative arguments in the transcript mean what they say. Four beats in
the short directory then measured **35 rows**, and dropping `zip_list`, whose output is a superset of what the
`zip_extract` refusal prints, took the shipped three-beat transcript to **24**.

Linked from `servers/zip/README.md` (`![zip demo](../../assets/demo-zip.gif)`, between the intro paragraph and
`## Install`, where quotes and barcode place theirs) and from the root `README.md` demo table, one row for
mcp-zip immediately before the mcp-office-suite bundle row, same four-column format as the other eighteen.

## C. Logo

`assets/zip-logo.png` (400x400, 1,458 bytes), the letters `ZP` in the house style of the existing eighteen
marks: a two-letter 5x7 bitmap in white at 26 px per cell on a flat ground, first letter at x0=55, y0=109,
30 px gap, which leaves a symmetric 55 px margin left and right and 109 px top and bottom. The ground is
`#7a2f4a`; the eighteen existing grounds were sampled off the files first so the new one is not a near
duplicate of any of them.

## D. Docker MCP catalog and Cline marketplace

Order mattered and rounds 8 and 9 recorded why: **mcp-servers was pushed first, then the fork was repinned to
the pushed HEAD.** Two pushes to origin/main before the catalog work, in order: `c788233` (wiring), `9513023`
(demo GIF, logo, README links). The catalog pin is `9513023`, the first commit that contains
`servers/zip/Dockerfile` and `assets/zip-logo.png` together.

Docker MCP catalog (docker/mcp-registry PR #4892, fork theluckystrike/mcp-registry branch
`add-theluckystrike-mcp-servers`, clone reused at /private/tmp/docker-mcp-registry, remote `fork`).
- `git -c rebase.autoStash=true pull --rebase` first: up to date at `ef3f429`.
- Added `servers/zip/{server.yaml,tools.json}`. `about.description` quoted from the start, so the colon-space
  YAML trap did not recur. `tools.json` generated from a live stdio `tools/list` against
  `servers/zip/dist/index.js`: 9 tools with their argument names, types and descriptions.
- No `directory` key, matching quotes, barcode, recurring and bank-statement: `servers/zip/Dockerfile` builds
  from the repo root as context and copies its workspace siblings `packages/mcp-license` and
  `servers/timezone`.
- All 19 entries repinned, both `commit` and the icon URL, to
  `95130230c70b066b416d13209571a41d9191a6b2` (origin/main HEAD from `git rev-parse origin/main` after the
  push, not from `git ls-remote` guesswork). The repin loop was written as
  `grep -rl ... | while read -r f` from the start, per round 9's zsh word-splitting failure, and the count was
  verified three ways (19 files matched, 19 `commit:` lines carry the sha, 19 icon URLs carry it).
- **The raw HEAD guard ran before the fork push**, one
  `curl -o /dev/null -w '%{http_code}'` per entry against
  `raw.githubusercontent.com/theluckystrike/mcp-servers/<pinned sha>/<dockerfile>` and against the icon URL.
  38 requests, all 200, `raw-check fail=0`. This is what catches an entry pinned to a commit that predates its
  own Dockerfile, which `cmd/validate` cannot see.
- `go run ./cmd/validate --name <n>` for all 19: **19/19 green** (`npm_config_cache` exported to
  /private/tmp/npmcache per the round-5 fix).
- Fork commit `ef26f59` "Add zip server; repin all 19 to 9513023", pushed to
  `add-theluckystrike-mcp-servers`. PR #4892 updates from the branch, still one PR, now nineteen servers;
  state OPEN, mergeable MERGEABLE.
- PR body: read with `gh pr view 4892 --json body`, patched to add the zip row, change eighteen to nineteen in
  the four places it appears, move the pin from `bc2d1a1` to `9513023`, and close the stray blank line that
  had orphaned the barcode row from the table since round 9; written back with `gh pr edit --body-file`. Not
  rewritten.

Cline marketplace: https://github.com/cline/mcp-marketplace/issues/2430 (zip), same template and the same
honest-checkbox pattern as the eighteen prior submissions ("installed from the README" unchecked because the
npm package is unpublished, "stable" checked), free-tier limits quoted verbatim from the README's Free vs Pro
table, `servers/zip/llms-install.md` confirmed present before writing the issue, and its own dedicated logo
URL so it needed no icon caveat.

`data/distribution.json`: `per_server.zip` added with the ten surface keys, notes appended to
`surfaces["docker-mcp-catalog"].note` and `surfaces["cline-marketplace"].note`, `updated_at` bumped. `hosted`
records `published https://mcp.zovo.one/mcp/zip` because `/mcp` already lists a zip endpoint with 12 tools
(the remote agent owns `remote/**`); `registry` is `pending`, checked against
registry.modelcontextprotocol.io, which returns `{"servers":[],"metadata":{"count":0}}` for it.

Paid surfaces: none encountered, none submitted. Zero paid API calls.

artifacts:
- /Users/mike/mcp-servers/servers/office-suite/src/index.ts
- /Users/mike/mcp-servers/scripts/build-mcpb.sh, scripts/sync-mirrors.sh, scripts/build-pages.mjs, scripts/validate.mjs
- /Users/mike/mcp-servers/data/facts.json, data/tools.json, data/validation.json (run 50), data/distribution.json
- /Users/mike/mcp-servers/billing/src/pages.js (generated), deployed as mcp-billing version 3160f0ab-eee5-4d6d-bb98-28c3182e82f6
- /Users/mike/mcp-servers/scripts/demo/drive.mjs, scripts/demo/zip.tape, assets/demo-zip.gif
- /Users/mike/mcp-servers/assets/zip-logo.png
- /Users/mike/mcp-servers/servers/zip/README.md, /Users/mike/mcp-servers/README.md
- /private/tmp/docker-mcp-registry servers/zip/{server.yaml,tools.json} (new) plus 18 server.yaml repins, fork commit ef26f59
- https://github.com/docker/mcp-registry/pull/4892 (updated in place, 19 entries)
- https://github.com/cline/mcp-marketplace/issues/2430
- /Users/mike/mcp-servers/docs/DIST_R11_RESULT.md (this file)

cost: 33 wall minutes

failures:
- The first `zip_history` and entry-cap assertions were written as one regex covering both tiers, which is the
  tautology round 9 recorded. Rewritten per tier before the first full run, with each branch asserting text the
  other branch fails: Pro's history line contains `Pro:` and no allowance sentence, so the Pro branch asserts
  the ABSENCE of `free archive` while free asserts `\d+ of 20 free archives used in \d{4}-\d{2}`.
- The crafted-zip helper wrote the external attributes as `0o100644 << 16`, which overflows int32 to
  -2119958528 and threw `The value of "value" is out of range` out of `writeUInt32LE`. Fixed with `>>> 0`.
  It surfaced as an exception in the probe, not as a failed check, which is why the standalone harness ran
  first.
- The first demo attempt made the child's paths relative without giving the child a cwd, so every call was
  resolved against /Users/mike/mcp-servers and every one of the four beats came back
  `... does not exist`. Every line was a refusal and the transcript was 11 rows, which looks like a pass on a
  row count alone.
- `git pull --rebase` refuses while the working tree carries unrelated modified `bundles/**` and
  `data/validation.json` from other agents. Worked around each time with
  `git stash push -u -- bundles data/validation.json` / `pull` / `stash pop`, staging only my own paths.

insight: **A demo GIF has a hard row budget, and the thing that overruns it is the path, not the prose.**

The transcript here is 24 rows against roughly 29 that fit in the standard 900x480 frame, and the first draft
came to 45. Ten of those rows were not content at all: they were the 62-character
`$TMPDIR` sandbox path, printed once in each argument line and again in each result line, wrapping single
logical lines into two and three. Every other server's demo hides this, because
its arguments are values (an amount, an IBAN, a CSV string) and only the driver ever sees a path. A server whose
whole interface *is* paths puts the sandbox on screen four times.

So the lever was the working directory, not the script. `mkdtempSync(join(tmpdir(), "mcp-demo-"))` produces
`/var/folders/nd/3cp8d1r97q9fn3chr1rd48qh0000gn/T/mcp-demo-HgkEXE`; `mkdtempSync("/tmp/zip-demo-")` resolves
to `/private/tmp/zip-demo-EEZ3n3`, 18 characters, and it has to be the **child's** cwd rather than the
driver's, because the server resolves and echoes back whatever it is given. That one change bought 10 rows on a
four-beat transcript, more than the beat that still had to go afterwards.

The general rule: when a fixed-size visual artifact overruns, measure the rows the *environment* contributes
before cutting the content. The verification is free and it is the only one that counts here, since the GIF is
judged on its last frame: extract frame N with ffmpeg and read it. A row count computed from the text will
also tell you it fits, and it will be wrong about which rows are on screen the moment anything wraps.

Built by theluckystrike. https://github.com/theluckystrike
