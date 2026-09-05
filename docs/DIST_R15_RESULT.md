# Round 15: wire mcp-per-diem into the estate, guide, demo GIF, logo, Docker + Cline

status: DONE

date: 2026-09-05. Scope: everything outside `servers/per-diem/` that docs/PER_DIEM_RESULT.md listed as "not
done here (orchestrator)", plus the two content pieces and the two marketplace submissions. The remote agent
shipped `/mcp/per-diem` while this round was running, which is recorded in section F rather than smoothed
over.

`node scripts/release-check.mjs` -> **green, 0 recorded gaps**, 22 servers at 0.11.0, 26 checks each.
`node scripts/validate.mjs` -> **594/594** (run 50), per-diem 38/38 in 362 ms.
`billing/` test suite -> **73/73**.

## A. The seventeen gaps release-check named

`release-check` opened the round with 17 failures, fifteen of them for `per-diem` and two estate-wide. In its
order, with what closed each.

- **`PRODUCTS`.** `per-diem` added with the price the operator provisioned,
  `price_1UCH5MJKCamubEm1wSrTiopx`, name `MCP Per Diem Pro`, payload `per-diem`, $19, `free` and `pro`
  sentences written from the server README's Free vs Pro table. The `desc` names all three schemes and
  states in the same sentence that the HMRC overseas per-city rates are not bundled and are refused by name
  rather than guessed: that gap is a property of the product, so it belongs on the product line, not only in
  the README. `FREE_FIVE_WORDS` gained `"Five trips a month, unlimited rate lookups"`, which is the whole
  free-tier shape in six words: the cap is on saving, never on pricing.
  Both estate-wide failures closed themselves the moment the entry landed: `SERVER_COUNT` and
  `BUNDLE_SAVING_USD` derive, so `twenty-two` and `$379` were never typed anywhere. One hand-written
  assertion did have to move, `billing/test/checkout.test.mjs`'s `/^Twenty-one MCP servers/`, which is the
  one place in the repo the count is deliberately spelled out rather than derived, so the test can catch a
  broken `countWord`.

- **office-suite `CHILDREN`.** One row, `{ id: "per-diem", pkg: "@theluckystrike/mcp-per-diem",
  optional: true }`, after the deposits row. Optional children resolve from the monorepo path first, so no
  dependency was added to `servers/office-suite/package.json`.

- **`scripts/build-mcpb.sh`.** `per-diem` appended to `SERVERS`, `[per-diem]="Per Diem"` to `DISPLAY_NAME`,
  and `[per-diem]='["mcp","model-context-protocol","per-diem","travel","allowance","delegacja","expenses"]'`
  to `KEYWORDS`. The bundle build itself is the release chain and was not run, so `bundles/per-diem.mcpb`
  does not exist and `server.mcpb.json` still carries `fileSha256: "TBD"`.

- **`scripts/sync-mirrors.sh`.** `per-diem` added to `ALL_SERVERS` before `office-suite`, which stays last,
  and `per-diem) echo "per-diem travel-allowance expenses tax" ;;` to `topics_for`. Not run.

- **`data/facts.json`.** `servers["per-diem"]` added with the same eight keys as every other server, `free`
  and `pro` from the README's table. `build-pages.mjs` dereferences `facts.servers[id]` with no guard, so
  this had to land before the page build.

- **`scripts/build-pages.mjs` + billing deploy.** `"per-diem"` appended to `ids`; the build reports 22 pages,
  373,001 bytes. Deployed to mcp.zovo.one, version `72dd8ceb-5750-4268-b0bb-53c1baefb537`. Verified live:
  ```
  /s/per-diem                                                  200
  /buy/per-diem                                                303 -> https://checkout.stripe.com/f/pay/cs_live_a1eh0AVvwOmKDm...
  /guides/per-diem-and-travel-allowances-from-chat             200
  /setup/claude-desktop/per-diem                               200
  /setup/claude-web/per-diem                                   200
  /sitemap.xml   contains https://mcp.zovo.one/s/per-diem
  /llms.txt      - [MCP Per Diem](https://mcp.zovo.one/s/per-diem): Statutory travel allowances...
                 - [Twenty-two-server bundle, $39 lifetime](https://mcp.zovo.one/bundle): saves $379 against buying all 22 singly
  ```

- **`data/tools.json`.** Generated from a live `tools/list` over stdio against
  `servers/per-diem/dist/index.js`, not from `src` or SPEC.md. Six entries; the two `license_*` tools are
  filtered out, matching every other server's entry.

- **`SETUP_SERVERS` + six `ANGLE` entries + `WEB_ANGLE`.** One `SETUP_SERVERS` block (title, slug, 8 tools,
  package, sPage, tagline, does, three prompts, free, pro and a `measured` sentence) and one `ANGLE` block
  with a distinct paragraph for claude-desktop, claude-code, cursor, vscode, windsurf and cline. `per-diem`
  was **not** put in `WEB_EXCLUDED`: `remotes.json` already existed when the round opened, so the release
  check treated the server as hosted from the first run, and an exclusion would have been the lie in the
  other direction. A `WEB_ANGLE` paragraph was written instead. See section F.

- **`COMPARE`.** No comparison page, cleared through the self-expiring `compare_none` note in
  `data/facts.json` rather than a `WAIVERS` entry, dated today, ten tokens, 30-day TTL. The registry search
  API was actually called for each. `per-diem`, `per diem`, `travel allowance`, `travel expenses`,
  `delegacja`, `subsistence` and `hmrc` return **0 results each**. `dieta` returns one row,
  `io.github.mcp-dir/dieta-mcp`, which is nutrition tracking: the Polish word means diet in the food sense
  too. `mileage` returns only this estate's own expense-tracker.
  **`gsa` returned something real, and it is named in the note rather than hidden.**
  `com.1102tools/gsa-perdiem-mcp` (pypi, stdio, 6 to 7 tools, 1.0.8, published 2026-08-24) is a live reader
  of the GSA per diem API for US federal travel. It is not a competitor this estate can write a comparison
  page against: it looks a US rate up over the network and returns it, with no Polish or UK scheme, no
  elapsed-hours or partial-day arithmetic, no meal deduction, no saved trip and no export, and it wants an
  api.data.gov key for any volume. A comparison page would be setting a rate lookup against a calculator.
  The note says exactly that, and it expires in 30 days, so if that server grows arithmetic or a second
  scheme the gap is re-probed rather than excused forever.

- **A guide.** `/guides/per-diem-and-travel-allowances-from-chat`, "Per diem and travel allowances from chat,
  on the rate tables the tax authorities publish", with seven FAQ entries. It carries the three schemes and
  what each counts as a day, a worked Polish domestic answer to the minor unit, the Oman prefix-match
  measurement, the honest HMRC overseas gap in its own section rather than in a footnote, why `trip_export`
  writes nothing, why currencies are never added, and why the free cap is on saving rather than on pricing.

- **Demo GIF.** `assets/demo-per-diem.gif`, **177,763 bytes (173.6 KB)**, GIF89a 900x480, under the 400 KB
  cap. `scripts/demo/per-diem.tape` is byte-identical in settings to the other twenty-one, and
  `scripts/demo/drive.mjs` gained a `per-diem` sequence whose fixture writes the shared business profile
  where `readSharedProfile` actually looks, so the traveller on the recorded trip is read rather than typed.
  Four beats, all real `tools/call` output: the 58-hour Krakow calculation down to `PLN 258.75`, the UK band
  at `GBP 25.00 less lunch GBP 8.33 = GBP 16.67`, the Oman refusal verbatim, and `trip_record` returning
  `TRIP-2026-0001` with the free-tier counter line. The final frame was extracted with ffmpeg and read: all
  four beats are on screen and legible.

- **Logo.** `assets/per-diem-logo.png`, 400x400, 1,129 bytes, the letters `PD` in the house style. Both
  glyphs were **extracted by sampling cell centres** out of existing marks (the `P` from price-tracker, the
  `D` from docx) rather than redrawn, at the estate's 26 px cell, x0=55, y0=109, 30 px gap. Ground
  `#418a8a`, chosen by searching RGB space under the house saturation and value envelope measured off all 22
  existing grounds (S 0.527 to 0.836, V 0.298 to 0.541) for the largest minimum distance; the nearest
  existing ground is barcode at Euclidean RGB distance 70.9.
  One correction to the record while measuring: `assets/deposits-logo.png` is `#748940`, not the `#7f8940`
  round 14 wrote down. The measured value was used for the search and the round-14 doc was left alone.

## B. Round 22: the measurement the product page quotes

`billing/test/first-five.test.mjs` needs a real run before a new server can have a First five minutes
section, and `build-pages.mjs` warns rather than inventing one.

`data/user_value_r22.json`: six natural-language prompts through the `claude` CLI as MCP client,
`-p --model sonnet --strict-mcp-config --max-turns 12`, one stdio server on a fresh `XDG_DATA_HOME` with
`MCP_LICENSE_KEY` empty so the run measures the **free** tier, six explicit `mcp__per-diem__<tool>` allowlist
entries written out by name, the CLI's own tools denied, one conversation via `--session-id` then five
`--resume`, empty working directory. The shared business profile was seeded the way
`servers/per-diem/test/_client.mjs` seeds it (Nova Studio, PLN), so the traveller resolves from the profile
rather than from the prompt.

**17 of 18, 8 tool calls, 123.6 s, zero clarifying turns.** p1 PL domestic 3, p2 UK band 3, p3 US GSA 3,
p4 Oman 3, p5 record and list 3, p6 the Pro report 2. Every figure was re-run over stdio from a second
client afterwards and read back off `trips.json`; all six verifications matched to the minor unit.

**D-R90** is the lost point and it is the same family as D-R88: `perdiem_report` refused correctly as Pro,
and the model relayed the $19 price and the `license_activate` step but **dropped the buy URL the refusal
actually returned**, then computed the withheld report itself out of the free `trip_list`. It was right only
because there was one trip in one currency. A gate that returns a URL and a model that paraphrases the gate
without the URL is a conversion path that silently ends nowhere.
**D-R91** is harness-side and low: the allowlist omitted `license_status` and `license_activate`, so one turn
was spent reaching for a denied tool. Those two belong in any documented per-tool allowlist.

A naming trap worth writing down: the round file was first written as `data/user_value_r22_per_diem.json`,
and `build-pages.mjs` silently did not see it. `ROUND_FILE` is `/^user_value(?:_r(\d+))?\.json$/`, which the
suffixed name does not match, so the build printed `warn per-diem: no round has ever covered it` and produced
a page with no First five minutes section, and the billing suite failed four assertions rather than one.
Renaming it to `data/user_value_r22.json` fixed all five. The suffixed files in `data/` (`_bank`,
`_deposits`, `_quotes`) are therefore invisible to the page build by design or by accident, and every one of
them has a plain-named sibling.

## C. validate.mjs probes

A `per-diem` block at the head of `PROBES`, **19 checks per tier, 38 total, 362 ms**, plus `"per-diem"` added
to the `/buy/<product>` list in the billing section. The shared business profile is seeded directly rather
than by spawning `servers/invoice`, so a failure here means per-diem failed.

1. `perdiem_rates` carries the authority, the Dz.U. instrument, the `isap.sejm.gov.pl` source URL, the
   effective date and the currency: the provenance is asserted, not just the number.
2. The worked example from the unit tests: 58 hours in Poland with breakfast free on day one and two nights
   is `PLN 258.75`, `subsistence_minor` 12375 and `lodging_minor` 13500, over 58 elapsed hours.
3. The day lines rather than the total: day one is 3375 after an 1125 breakfast deduction, and day three,
   a 10-hour remainder, pays a **whole** diet with `over 8 hours` in its `basis`. A total can be right with
   the ladder wrong.
4. The one that matters: `perdiem_calc {scheme:"pl", destination:"Oman"}` is refused by name, says
   `not verified here`, and the assertion also requires that the text carries **no** `42.00` and **no** `EUR`,
   so the exact regression that shipped once cannot come back and pass.
5. The other honest gap: `Paris` under the `uk` scheme is refused with `NOT BUNDLED` naming the overseas
   scale rates.
6. `trip_record` allocates `TRIP-2026-0001`, totals `PLN 258.75`, and takes the traveller from the shared
   profile (`Nova Studio`).
7. The free-tier counter line is present on free and absent on Pro.
8. `trip_list` is free on both tiers and carries no buy link.
9. Both Pro gates per tier: free must name `mcp.zovo.one/buy/per-diem`; Pro must return
   `"tool": "expense_add"` payloads with `"amount": 123.75` and `"amount": 135` (**major** units), the
   `No vat_rate is set` sentence and the `does not write into the expense ledger` sentence.
10. The free cap counts saved trips only: the sixth in a month is refused naming the count and the buy link,
    Pro gets `TRIP-2026-0006`, a trip starting in July is not blocked by June's five, and **pricing** a trip
    still works with the month's five already saved, which is the tier boundary this server chose.

One assertion was wrong on the first run and it was wrong about the server rather than the arithmetic:
`trip_export` splits a trip into one payload per **category**, subsistence and lodging, so there is no single
`258.75` in the answer at all. Asserting the combined total would have been asserting a shape the server
never emits. Found by the run rather than by reading, which cost one run.

## D. Docker MCP catalog, Cline marketplace, distribution

DOCKER_CLINE_PLACEHOLDER

`data/distribution.json`: `per_server["per-diem"]` added with the eleven surface keys. `hosted` records the
`/mcp/per-diem` endpoint the remote agent shipped this round, which is what the round-14 hosted-row check
requires the moment `remotes.json` exists; `registry`, `github-mirror`, `smithery` and `glama` are `pending`;
`mcpb` records `pending` with the reason (`fileSha256` is `TBD` until the bundle is built).

Paid surfaces: none encountered, none submitted. Zero paid API calls.

## E. The gap this round did not close, and would not paper over

docs/PER_DIEM_RESULT.md handed over one undelivered brief item: the HMRC overseas per-city scale rates, about
250 cities times eight figures, are not bundled. Nothing in this round changed that, and nothing in this
round hid it. It is stated on the product line in `PRODUCTS`, in `data/facts.json`, in its own section of the
guide, in a FAQ answer, and in a `validate.mjs` probe that asserts the refusal. The alternative, wiring the
server and letting the gap live only in the README, would have shipped a storefront that is more confident
than the software.

## F. Caused by other agents, and absorbed inside this round

`servers/per-diem/remotes.json` already existed when the round opened, which made the release check treat the
server as hosted from the first run: `hosted-row`, `endpoint` and `web` were all failing for the right
reason. The brief said to put `per-diem` in `WEB_EXCLUDED` until it was hosted; that instruction was correct
when it was written and had stopped being correct, because `WEB_EXCLUDED` on a hosted server is itself a
check failure (`WEB_EXCLUDED lists per-diem although it is hosted`). A `WEB_ANGLE` paragraph was written
instead, `distribution.json.hosted` was set to `published https://mcp.zovo.one/mcp/per-diem`, and the
`endpoint` check closed on its own when the remote agent shipped `/mcp/per-diem` mid-round. The remote lane
is 80/80 in run 50.

## Open, named rather than hidden

- `bundles/per-diem.mcpb` is not built and `server.mcpb.json` carries `fileSha256: "TBD"`. That is the
  release chain, which this round does not run.
- `scripts/sync-mirrors.sh` and `scripts/build-mcpb.sh` are wired but were not executed.
- npm publication, the MCP registry entry and the Smithery/Glama listings are all `pending` for this server.
- `billing/src/content.js` still carries the guide `one-install-nineteen-servers-office-suite`, whose slug,
  title and body say nineteen and 186. Carried over unfixed from rounds 13 and 14, and now three servers
  staler.
- `data/distribution.json`'s `per_server["billing-docs"].hosted` still reads "not hosted", which round 13
  made false. Named again here; still another server's row.

## Measured insight

**A gap only stays honest if it is stated where the buying decision is made.**

This server ships three complete rate tables and one deliberately empty one. The empty one is the HMRC
overseas table, and it is empty for a good reason that is easy to state and easy to lose: roughly 2,000
tax-relief figures could not be read out of public regulation text with confidence, and an invented one would
be wrong and look authoritative. `servers/per-diem` handles that correctly at the point of use: the tool
refuses by name and hands back the source URL.

The wiring layer is where that kind of honesty leaks, because every surface it touches is a compression of
the server into fewer words. A one-line product `desc`, a tagline, a keyword list, a First five minutes
section, a 400 KB GIF. Each compression is a chance to drop the sentence that makes the number safe, and
nothing in the toolchain notices: `release-check` asserts an entry **exists**, never that it is candid, and a
`compare_none` note passes on a well-formed date and a token array whether the prose above it is true or not.
The registry search this round is the case in point. It found `com.1102tools/gsa-perdiem-mcp`, a real per
diem server, and the check would have gone green on a note that said "nothing found", because the check reads
the shape of the note and not its claim.

So the rule this round used: **the gap goes on the line where money changes hands, not only in the README.**
It is in `PRODUCTS.desc`, which is what Stripe shows at checkout, in `facts.json`, in the guide's own H2, in
a FAQ answer, and in a probe that fails if the refusal ever stops naming it. The competitor that does exist
is named in the note that excuses the missing comparison page, with the reason it is not comparable, so a
reader can disagree with the judgement rather than being told there was nothing to judge. Automated checks
can only test that a claim is present. Whether it is honest is still a thing a person has to decide, once per
surface, and the cheapest place to make that decision is the moment the surface is written.

artifacts:
- /Users/mike/mcp-servers/scripts/build-mcpb.sh, scripts/sync-mirrors.sh, scripts/build-pages.mjs, scripts/validate.mjs
- /Users/mike/mcp-servers/servers/office-suite/src/index.ts
- /Users/mike/mcp-servers/billing/src/index.js, billing/src/setup.js, billing/src/content.js, billing/src/pages.js (generated)
- /Users/mike/mcp-servers/billing/test/checkout.test.mjs
- /Users/mike/mcp-servers/data/facts.json, data/tools.json, data/user_value_r22.json, data/validation.json (run 50), data/distribution.json
- /Users/mike/mcp-servers/scripts/demo/drive.mjs, scripts/demo/per-diem.tape, assets/demo-per-diem.gif
- /Users/mike/mcp-servers/assets/per-diem-logo.png
- mcp-billing deployed to mcp.zovo.one, version 72dd8ceb-5750-4268-b0bb-53c1baefb537
- /Users/mike/mcp-servers/docs/DIST_R15_RESULT.md (this file)

Built by theluckystrike. https://github.com/theluckystrike
