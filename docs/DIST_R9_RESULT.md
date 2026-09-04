# Round 9: wire mcp-barcode into the estate, demo GIF, Docker MCP catalog + Cline marketplace

status: DONE

evidence:

## A. Wiring the 18th server into the estate

`servers/barcode` existed as a self-contained unit (docs/BARCODE_RESULT.md) with nothing outside it touched.
Seven wiring points, the same checklist round 8 used for quotes.

- **office-suite CHILDREN** (`servers/office-suite/src/index.ts`): one row appended,
  `{ id: "barcode", pkg: "@theluckystrike/mcp-barcode", optional: true }`. Optional children resolve from the
  monorepo path first, so no dependency was added to `servers/office-suite/package.json`. Rebuilt and read
  back over stdio: office-suite proxies eighteen children and lists **179 tools**, including
  `qr_create, qr_wifi, qr_vcard, qr_payment_sepa, barcode_create, barcode_batch, code_list`
  (`invoice_payment_qr` collides with nothing but is not in the barcode-ish grep because it renders under the
  invoice namespace; the stderr line reads `proxying [... quotes, barcode], 177 tools`).

- **scripts/build-mcpb.sh**: `barcode` appended to `SERVERS`, `[barcode]="Barcode"` to `DISPLAY_NAME`, and
  `[barcode]='["mcp","model-context-protocol","qr","qr-code","barcode","ean13","code128","sepa"]'` to
  `KEYWORDS`. The bundle build itself was NOT run (release chain, out of scope this round), so
  `bundles/barcode.mcpb` does not exist yet and `data/distribution.json` records `mcpb: pending`.

- **scripts/sync-mirrors.sh**: `barcode` added to `ALL_SERVERS` (before `office-suite`, which stays last) and
  `barcode) echo "qr-code barcode ean13" ;;` to `topics_for`. Not pushed this round.

- **data/facts.json**: `servers.barcode` added with the same eight keys as every other server, free/pro copied
  from the README's Free vs Pro table verbatim (20 codes a calendar month and SVG free; Pro adds unlimited
  codes, PNG 32 to 4000 px and `barcode_batch` up to 500 rows). `build-pages.mjs` dereferences
  `facts.servers[id]` with no guard, so this had to exist before the page build.

- **scripts/build-pages.mjs + billing deploy**: `"barcode"` appended to `ids`; `node scripts/build-pages.mjs`
  -> `pages: ... quotes, barcode bytes 286928` (18 pages). `cd billing && npx wrangler deploy` ->
  `Uploaded mcp-billing (8.43 sec)`, version `f607b074-a8fb-4547-a639-dd90584efceb`, custom domain
  mcp.zovo.one. Verified live:
  ```
  /s/barcode     200   <title>MCP Barcode for Claude, Cursor and any MCP client</title>
  /buy/barcode   303 -> https://checkout.stripe.com/c/pay/cs_live_b1XGNd8d...
  /sitemap.xml   contains https://mcp.zovo.one/s/barcode
  /llms.txt      - [MCP Barcode](https://mcp.zovo.one/s/barcode): QR codes and barcodes drawn on your machine...
  ```
  `billing/src/index.js` already carried the barcode Stripe product, so no billing source was edited; only
  the generated `billing/src/pages.js`.

- **data/tools.json**: `barcode` inserted after `quotes`, generated from a live `tools/list` over stdio
  against `servers/barcode/dist/index.js`, not from `src` or `SPEC.md`. Eight entries; the two `license_*`
  tools are filtered out, matching every other server's entry in the file.

- **scripts/validate.mjs**: a `barcode` probe added at the head of `PROBES` (13 checks per tier, 26 total),
  and `"barcode"` added to the `/buy/<product>` list in the billing section (1 check). The probe:
  1. `qr_create` with no `out_path` returns an inline `<svg>`.
  2. `qr_payment_sepa` with `DE89370400440532013000`, EUR 1697.40 and a reference writes the SVG.
  3. The same IBAN with the last digit changed to 1 is refused for its check digit and `bad.svg` does not
     exist afterwards, so the refusal happens before anything is written.
  4. `barcode_create ean13` on twelve digits computes check digit 7 and the response names `5901234123457`.
  5. `barcode_create ean13` on `5901234123450` is refused, names the correct digit, and writes nothing.
  6. The PNG tier gate: free gets `mcp.zovo.one/buy/barcode` and no file, Pro gets a 512 px PNG on disk.
  7. `invoice_payment_qr` best-effort: it either draws the file or names the missing business profile.
  8. `code_list` reports `N code(s) in the register` and the row for the code just drawn, and on free also
     `N of 20 free codes used in YYYY-MM`.

  `node scripts/validate.mjs` -> **426/426** (run 50 in `data/validation.json`), barcode **26/26 in 501 ms**,
  remote 50/50, billing 24/24, 18 units. Remote already carried barcode (another agent owns `remote/**`);
  its two barcode checks pass.

## B. Demo GIF

`assets/demo-barcode.gif`, **176,951 bytes (172.8 KB)**, well under the 400 KB cap.

```
$ file assets/demo-barcode.gif
assets/demo-barcode.gif: GIF image data, version 89a, 900 x 480
$ ffprobe ... assets/demo-barcode.gif
width=900 height=480 avg_frame_rate=25/1 nb_frames=266
```

`scripts/demo/barcode.tape` is byte-identical in settings to the other seventeen (900x480, Dracula,
FontSize 13, 40ms typing, `Sleep 10s`). `scripts/demo/drive.mjs` gained a `barcode` sequence plus the
run-time Pro-key env block (`execFileSync(process.execPath, [scripts/sign-license.mjs, "barcode"])` ->
`MCP_LICENSE_KEY`), the same pattern bank-statement and quotes use, so the PNG beat is genuinely unlocked in
the recording rather than showing upgrade text. Four beats, chosen so every line of output is a fact and not
a wall of SVG: a 512 px PNG QR of the product page (3,226 bytes), an EPC SEPA payment code for EUR 1697.40
(version 5, 37x37 modules, 85 bytes of payload), an EAN-13 from twelve digits (check digit 7 computed), and
the same EAN-13 with a wrong thirteenth digit refused. The last frame was extracted with ffmpeg and read
back to confirm all four beats are on screen and legible.

Linked from `servers/barcode/README.md` (`![barcode demo](../../assets/demo-barcode.gif)`, between the
intro paragraph and `## Install`, where quotes places its GIF) and from the root `README.md` demo table, one
row for mcp-barcode immediately before the mcp-office-suite bundle row, same four-column format as the other
seventeen.

## C. Logos

`assets/barcode-logo.png` (400x400, 1,442 bytes) was generated in the house style of the existing sixteen
marks: a two-letter 5x7 bitmap in white at 26 px per cell on a flat ground, letters at x0=55, y0=109, 30 px
gap, matching the metrics of `assets/invoice-logo.png` measured off the file. The same script produced
`assets/quotes-logo.png`, which round 8 left open: the quotes catalog entry had been reusing
`invoice-logo.png` and now points at its own icon.

## D. Docker MCP catalog and Cline marketplace

Order mattered here and round 8 recorded why: **mcp-servers was pushed first, then the fork was repinned to
the pushed HEAD.** Three pushes to origin/main this round, in order: `d373650` (wiring), `a0c9e34` (demo GIF
and READMEs), `bc2d1a1` (logos). The catalog pin is `bc2d1a1`, which is the first commit that contains
`servers/barcode/Dockerfile`, `assets/barcode-logo.png` and `assets/quotes-logo.png` together.

Docker MCP catalog (docker/mcp-registry PR #4892, fork theluckystrike/mcp-registry branch
`add-theluckystrike-mcp-servers`, clone reused at /private/tmp/docker-mcp-registry, remote `fork`).
- `git -c rebase.autoStash=true pull --rebase` first: up to date at `435dd2c`.
- Added `servers/barcode/{server.yaml,tools.json}`. `about.description` quoted from the start, so the
  colon-space YAML trap did not recur. `tools.json` generated from a live stdio `tools/list` against
  `servers/barcode/dist/index.js`: 10 tools with their argument names, types and descriptions.
- No `directory` key, matching quotes, recurring and bank-statement: `servers/barcode/Dockerfile` builds from
  the repo root as context and copies its workspace sibling `packages/mcp-license`.
- All 18 entries repinned, both `commit` and the icon URL, to
  `bc2d1a112142bdbba34ab57e7d75488c25bc322d` (origin/main HEAD from `git rev-parse origin/main` after the
  push, not from `git ls-remote` guesswork).
- **Round 8's insight was implemented as a check before the fork push**, not left as advice: one
  `curl -o /dev/null -w '%{http_code}'` per entry against
  `raw.githubusercontent.com/theluckystrike/mcp-servers/<pinned sha>/<dockerfile>` and against the icon URL.
  36 requests, all 200, `raw-check fail=0`. This is the guard that catches an entry pinned to a commit that
  predates its own Dockerfile, which `cmd/validate` cannot see.
- `go run ./cmd/validate --name <n>` for all 18: **18/18 green** (`npm_config_cache` exported to
  /private/tmp/npmcache per the round-5 fix).
- Fork commit `ef3f429` "Add barcode server; repin all 18 to bc2d1a1; quotes icon uses its own logo", pushed
  `435dd2c..ef3f429 HEAD -> add-theluckystrike-mcp-servers`. PR #4892 updates from the branch, still one PR,
  now eighteen servers; state OPEN, mergeable MERGEABLE.
- PR body: read with `gh pr view 4892 --json body`, patched to add the barcode row, change seventeen to
  eighteen in the three places it appears, and move the pin from `e89ac6f` to `bc2d1a1`, then written back
  with `gh pr edit 4892 --body-file`. Not rewritten.

Cline marketplace: https://github.com/cline/mcp-marketplace/issues/2428 (barcode), same template and the same
honest-checkbox pattern as the seventeen prior submissions ("installed from the README" unchecked because the
npm package is unpublished, "stable" checked), free-tier limits quoted verbatim from the README's Free vs Pro
table, `servers/barcode/llms-install.md` confirmed present before writing the issue. Unlike round 8 this one
carries a real dedicated logo URL, so it needed no icon caveat.

`data/distribution.json`: `per_server.barcode` added with the ten surface keys, notes appended to
`surfaces["docker-mcp-catalog"].note` and `surfaces["cline-marketplace"].note`, `updated_at` bumped.

Paid surfaces: none encountered, none submitted. Zero paid API calls.

artifacts:
- /Users/mike/mcp-servers/servers/office-suite/src/index.ts
- /Users/mike/mcp-servers/scripts/build-mcpb.sh, scripts/sync-mirrors.sh, scripts/build-pages.mjs, scripts/validate.mjs
- /Users/mike/mcp-servers/data/facts.json, data/tools.json, data/validation.json (run 50), data/distribution.json
- /Users/mike/mcp-servers/billing/src/pages.js (generated), deployed as mcp-billing version f607b074-a8fb-4547-a639-dd90584efceb
- /Users/mike/mcp-servers/scripts/demo/drive.mjs, scripts/demo/barcode.tape, assets/demo-barcode.gif
- /Users/mike/mcp-servers/assets/barcode-logo.png, assets/quotes-logo.png
- /Users/mike/mcp-servers/servers/barcode/README.md, /Users/mike/mcp-servers/README.md
- /private/tmp/docker-mcp-registry servers/barcode/{server.yaml,tools.json} (new) plus 17 server.yaml repins, fork commit ef3f429
- https://github.com/docker/mcp-registry/pull/4892 (updated in place, 18 entries)
- https://github.com/cline/mcp-marketplace/issues/2428
- /Users/mike/mcp-servers/docs/DIST_R9_RESULT.md (this file)

cost: 44 wall minutes

failures:
- First validate run was 425/426. The failing check was `pro: code_list reports the register and the free
  allowance`, asserting `/allowance|free|codes/i` against text that reads `5 code(s) in the register`: the
  server writes `code(s)`, and on Pro there is no allowance sentence at all because there is no cap. The
  first fix loosened the regex to `/allowance|code/i`, which every `code_list` response satisfies by its own
  tool name and is therefore not a test. Replaced with a tier-aware assertion that pins the actual shape
  (`N code(s) in the register` and a `text/qr` row on both tiers, plus `N of 20 free codes used in YYYY-MM`
  on free only). 426/426.
- `git pull --rebase` refused twice with "cannot rebase: You have unstaged changes" because the working tree
  carries unrelated modified `bundles/**` artifacts from another agent. Worked around with
  `git stash -u` / `pull` / `stash pop` and by staging only my own paths; origin/main was up to date each
  time, so nothing was lost.
- The repin loop silently did nothing on its first attempt: `for f in $ENTRIES` under zsh, where an unquoted
  parameter expansion is NOT word-split, so the eighteen newline-separated paths became one filename and
  perl reported `Can't open`. Caught only because the verification `grep -c` printed 1 instead of 18. Redone
  as `grep -rl ... | while read -r f`.

insight: **A tier-parameterised assertion can degrade into a tautology at exactly the tier that needed it.**
The barcode `code_list` check was written as one regex for both tiers, which forced the union of two
different response shapes, and the union of "names the free allowance" and "says nothing about an allowance"
is a pattern that matches the tool's own name. It went green and measured nothing on Pro. This is the same
failure class as a median-imputed ranking row: the assertion is present, the count goes up, and the check
carries no information. The cheap rule that catches it, and the one now applied here, is that a check whose
predicate differs between tiers must be *written* per tier, with each branch asserting text that the other
branch would fail. The confirmation is free: flip the branch, expect red.
