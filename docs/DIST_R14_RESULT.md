# Round 14: wire mcp-deposits into the estate, guide, demo GIF, logo, Docker + Cline

status: DONE

date: 2026-09-05. Scope: everything outside `servers/deposits/` that docs/DEPOSITS_RESULT.md listed as "not
done here (orchestrator)", plus the two content pieces and the two marketplace submissions. Two other agents
were working in the same repo this round and both changed what this round had to say; that is recorded below
rather than smoothed over.

`node scripts/release-check.mjs` -> **green, 0 recorded gaps**, 21 servers at 0.10.0, 25 checks each.
`node scripts/validate.mjs` -> **551/551** (run 50), deposits 36/36 in 547 ms.
`billing/` test suite -> **68/68**.

## A. The thirteen gaps release-check named

`release-check` opened the round with 13 failures, twelve of them for `deposits` and one estate-wide. In its
order, with what closed each.

- **`PRODUCTS`.** `deposits` added with the price the operator provisioned,
  `price_1UCEbNJKCamubEm1kOnmQOiE`, name `MCP Deposits Pro`, payload `deposits`, $19, `free` and `pro`
  sentences written from the server README's Free vs Pro table. `FREE_FIVE_WORDS` gained
  `"Five deposits a month, unlimited applying"`. The estate-wide failure closed itself the moment the entry
  landed: `SERVER_COUNT` and `BUNDLE_SAVING_USD` derive, so `twenty-one` and `$360` were never typed
  anywhere. That is round 13's fix doing its job.

- **office-suite `CHILDREN`.** One row, `{ id: "deposits", pkg: "@theluckystrike/mcp-deposits",
  optional: true }`, after the billing-docs row. Optional children resolve from the monorepo path first, so
  no dependency was added to `servers/office-suite/package.json`.

- **`scripts/build-mcpb.sh`.** `deposits` appended to `SERVERS`, `[deposits]="Deposits"` to `DISPLAY_NAME`,
  and `[deposits]='["mcp","model-context-protocol","deposit","retainer","escrow","invoice","accounting"]'`
  to `KEYWORDS`. The bundle build itself is the release chain and was not run, so `bundles/deposits.mcpb`
  does not exist and `server.mcpb.json` still carries `fileSha256: "TBD"`.

- **`scripts/sync-mirrors.sh`.** `deposits` added to `ALL_SERVERS` before `office-suite`, which stays last,
  and `deposits) echo "deposit retainer escrow invoicing" ;;` to `topics_for`. Not run.

- **`data/facts.json`.** `servers.deposits` added with the same eight keys as every other server, `free` and
  `pro` from the README's table. `build-pages.mjs` dereferences `facts.servers[id]` with no guard, so this
  had to land before the page build.

- **`scripts/build-pages.mjs` + billing deploy.** `"deposits"` appended to `ids`; the build reports 21 pages,
  358,085 bytes. Deployed to mcp.zovo.one, version `dbf554bd-18e5-442d-99b6-fc5805d240fb`. Verified live:
  ```
  /s/deposits                                            200
  /buy/deposits                                          303 -> https://checkout.stripe.com/c/pay/cs_live_a1tiXzTu03E1cRAxC1D304Y7...
  /guides/client-deposits-and-retainers-from-chat        200
  /setup/claude-desktop/deposits                         200
  /setup/claude-web/deposits                             200
  /sitemap.xml   contains https://mcp.zovo.one/s/deposits
  /llms.txt      - [MCP Deposits](https://mcp.zovo.one/s/deposits): Security and retainer deposits...
                 - [Twenty-one-server bundle, $39 lifetime](https://mcp.zovo.one/bundle): saves $360 against buying all 21 singly
  ```

- **`data/tools.json`.** Generated from a live `tools/list` over stdio against
  `servers/deposits/dist/index.js`, not from `src` or SPEC.md. Eight entries; the two `license_*` tools are
  filtered out, matching every other server's entry.

- **`SETUP_SERVERS` + six `ANGLE` entries.** One `SETUP_SERVERS` block (title, slug, 10 tools, package,
  sPage, tagline, does, three prompts, free, pro and a `measured` sentence) and one `ANGLE` block with a
  distinct paragraph for claude-desktop, claude-code, cursor, vscode, windsurf and cline.

- **`COMPARE`.** No comparison page: the honest search finds no competitor. Cleared through the
  self-expiring `compare_none` note in `data/facts.json` rather than a `WAIVERS` entry, dated today, ten
  tokens, 30-day TTL. The registry search API was actually called for each: `deposit`, `deposits`,
  `security deposit`, `client funds` and `trust account` return **0 results each**; `retainer` returns 12
  rows that are all one server, `io.github.theluckystrike/retainer`, which is **this estate's own
  mcp-recurring** (recurring retainer *billing*, a schedule that raises invoices, not money held); `escrow`
  returns 10 rows, every one of them agent-to-agent crypto settlement on Base, Robinhood Chain or USDC.
  Nothing holds a client's money on a ledger and applies it to an invoice.

- **A guide.** `/guides/client-deposits-and-retainers-from-chat`, "Client deposits and retainers from chat,
  applied to your real invoices", with six FAQ entries. Its centre is the measurement in section C, which
  changed shape mid-round. It also carries the two caps on an application (what the deposit holds and what
  the invoice owes), the lock order, why a refund does not touch the invoice, why the stored status is
  derived from the movements, one statement in one currency, and why the free cap is on recording only.

- **Demo GIF.** `assets/demo-deposits.gif`, **134,835 bytes (131.7 KB)**, GIF89a 900x480, under the 400 KB
  cap. `scripts/demo/deposits.tape` is byte-identical in settings to the other twenty, and
  `scripts/demo/drive.mjs` gained a `deposits` sequence. The fixture seeds the invoice store with
  `paid_minor` **already at 20000**, so the recorded frame can show `paid_minor 20000 + 30000 = 50000`
  read back off disk rather than asserted. Four beats: record EUR 500.00, apply EUR 300.00 on top of the
  existing transfer, the over-application refused verbatim, the remainder refunded. The final frame was
  extracted with ffmpeg and read: all four beats are on screen and legible.

- **Logo.** `assets/deposits-logo.png`, 400x400, 1,132 bytes, the letters `DP` in the house style. Both
  glyphs were **extracted by sampling cell centres** out of existing marks (the `D` from docx, the `P` from
  price-tracker) rather than redrawn, at the estate's 26 px cell, x0=55, y0=109, 30 px gap. Ground
  `#7f8940`, chosen by searching RGB space under the house saturation and value envelope measured off all 21
  existing grounds (S 0.53 to 0.84, V 0.298 to 0.541) for the largest minimum distance; the nearest existing
  ground is billing-docs at Euclidean RGB distance 73.9.

## B. Round 20: the measurement the product page quotes

`billing/test/first-five.test.mjs` failed on four assertions the moment `deposits` entered `ids`. That is the
one check in this repo a wiring edit cannot satisfy: the section quotes a verbatim prompt and a sentence of
that scenario's own evidence, so it needs a real run.

`data/user_value_r20.json`: six natural-language prompts through the `claude` CLI 2.1.261 as MCP client,
`-p --model sonnet --strict-mcp-config --max-turns 12`, two stdio servers (`deposits` and `invoice`) on a
fresh `XDG_DATA_HOME` with `MCP_LICENSE_KEY` empty, 12 explicit `mcp__<server>__<tool>` allowlist entries
written out by name, the CLI's own tools denied, one conversation via `--session-id` then five `--resume`,
empty working directory. Seeded by writing the invoice engine's own field shapes: the business profile, one
client, `INV-2026-0001` at EUR 1,230.00 **with `paid_minor` already 20000**, and a USD `INV-2026-0002` so the
currency refusal has something real to refuse.

**16 of 18, 6 tool calls, 38.1 s, zero tool errors.** d1 record 3, d2 the apply-on-top 3, d3 the
over-application 2, d4 the currency refusal 3, d5 the balance question 2, d6 refund plus statement 3.

Both lost points are the same client-side shape, and it is the shape round 19 also hit (D-R86): the model
answered from its own reasoning instead of calling a tool that was free, allowed and would have answered
exactly. On d3 it refused the over-application itself; unlike round 19 every number it used was right, which
is why it scores 2 rather than 1. On d5 it answered "how much are we holding" out of the conversation rather
than calling `deposit_balance` (**D-R88**). It was right, because it had just done the arithmetic itself in
the same session, and in a session that had not it would have been a guess. Answering that question from
memory instead of the ledger is the exact failure this server exists to prevent. **D-R89** is cosmetic: the
statement truncates a long refund method mid-word.

## C. The measurement changed under the round, and the guide had to say so

docs/DEPOSITS_RESULT.md handed over one measured insight: `invoice_mark_paid` **SETS** `paid_minor`, so a
deposit routed through it deletes the payment that came before. That was true when it was measured. At
**15:25 today**, while this round was running, another agent shipped commit `f8136e1`, "invoice_mark_paid:
ADD to paid_minor instead of SET, refuse overpayment, log payments (D-R87)", citing docs/DEPOSITS_RESULT.md
as the evidence. The invoice server now adds, refuses a payment that would overpay the open balance, and
appends to a `payments` list.

So the guide, written an hour earlier in the present tense, was making a claim about the invoice server that
had stopped being true. Three things changed and one deliberately did not:

- The guide's central section was rewritten from "routing a deposit through invoice_mark_paid erases the
  payment before it" to "the deposit write path found a silent bug in the invoice server", with the
  pre-fix behaviour kept as a **dated measurement** and the fix stated plainly in the same section. The
  general lesson is the part that survives: matching field names is not the contract between two servers
  sharing a store, the arithmetic on them is, and nothing found this except writing a second server against
  the same field.
- `SETUP_SERVERS.deposits.measured` was rewritten the same way, around what `deposit_apply` does rather than
  around what the invoice server used to do.
- `PRODUCTS.deposits.desc` needed no change: "adds to what was already paid rather than replacing it" was a
  statement about `deposit_apply` and is still exactly true.
- `data/user_value_r20.json` was **not** touched. It is a dated measurement of what a real client did at a
  named time against a named build, and round 13's own rule applies: a stale measurement is a fact about the
  past, a stale derived number is a bug.

## D. validate.mjs probes

A `deposits` block at the head of `PROBES`, **18 checks per tier, 36 total, 547 ms**, plus `"deposits"` added
to the `/buy/<product>` list in the billing section. The invoice store is seeded directly rather than by
spawning `servers/invoice`, so a failure here means deposits failed.

1. `deposit_record` of EUR 500.00: asserts the `DEP-YYYY-NNNN` shape, received, held and `status: held`.
2. The one that matters: the seeded invoice carries `paid_minor` 20000 before anything runs, `deposit_apply`
   adds EUR 300.00, and the probe **reads `invoices.json` back off disk** and asserts `paid_minor === 50000`,
   not just the reply text. An assigning write path leaves 30000 and passes every schema check there is.
3. One cent past what is **held** is refused, names `holds EUR 200.00` and `EUR 200.01` and
   `Nothing was changed`, and the invoice's `paid_minor` is re-read and is still 50000.
4. The other cap, from the invoice's side: EUR 200.00 against an invoice that owes EUR 100.00 is refused.
5. A EUR deposit against a USD invoice is refused with both currencies and `never converted`.
6. Over-refund refused naming what is held; then a real refund closes the deposit and the invoice's
   `paid_minor` is read back and is **unchanged**, which is the whole point of a refund not being a payment.
7. `deposit_balance` reports received, applied, refunded and held, one row per currency.
8. `deposit_statement_text` is free on both tiers and carries no buy link.
9. Report and PDF gates written per tier: free must be an error naming `mcp.zovo.one/buy/deposits`, Pro must
   write a file over 1 KB.
10. The free cap counts records only: the sixth in a month is refused naming the count and the buy link,
    Pro gets `DEP-2026-0006`, and a deposit received in October is not blocked by September's five.

One assertion was wrong on the first run, and it was wrong about the server rather than about the arithmetic:
`deposit_statement_pdf` writes `out_path` **literally** and does not append `.pdf`, so passing `dep` produced
a file named `dep` and the `dep.pdf` check failed on Pro. Found by the full run rather than by a standalone
probe, which cost a run.

## E. Docker MCP catalog, Cline marketplace, distribution

Order matters and rounds 8, 9, 11 and 13 record why: **mcp-servers was pushed first, then the fork was
repinned to the pushed HEAD.** The pin is `8418a5639808a7fffea96f07862dc85318800b0b`, taken from
`git rev-parse origin/main` after a fetch and confirmed with `git cat-file -e "${SHA}:<path>"` for both
`servers/deposits/Dockerfile` and `assets/deposits-logo.png`.

Docker MCP catalog (docker/mcp-registry PR #4892, fork theluckystrike/mcp-registry branch
`add-theluckystrike-mcp-servers`, clone reused at /private/tmp/docker-mcp-registry, remote `fork`).

- `git -c rebase.autoStash=true pull --rebase` first.
- Added `servers/deposits/{server.yaml,tools.json}`, structurally identical to the billing-docs entry: same
  top-level and `about`/`source` key order, `about.description` quoted from the start so the colon-space YAML
  trap does not recur, category `finance` matching invoice, quotes, recurring, bank-statement and
  billing-docs, no `directory` key, secret `deposits.license_key` mapped to `MCP_LICENSE_KEY`.
  `tools.json` generated from a live stdio `tools/list` against `dist/index.js`: 10 tools with their argument
  names, types and descriptions, `arguments` omitted where the live schema has no properties.
- All **21** entries repinned, both `commit:` and the icon URL. The loop was written as
  `grep -rl ... | while read -r f`, per round 9's zsh word-splitting failure, and the count was verified
  three ways: 21 files matched, 21 `commit:` lines carry the sha, 21 icon URLs carry it, with zero
  placeholders and no stale 40-hex sha left on any theluckystrike line.
- **The raw HEAD guard ran before the fork push**: one `curl -o /dev/null -w '%{http_code}'` per entry
  against `raw.githubusercontent.com/theluckystrike/mcp-servers/<pinned sha>/<dockerfile>` and against the
  icon URL. **42 requests, all 200, fail=0.** This is what catches an entry pinned to a commit that predates
  its own Dockerfile, which `cmd/validate` cannot see.
- `go run ./cmd/validate --name <n>` for all 21: **21/21 green** (`npm_config_cache` exported to
  /private/tmp/npmcache per the round-5 fix), run in three batches of seven so no shell call hit the
  two-minute timeout.
- Fork commit `3651c89` "Add deposits server; repin all 21 to 8418a56", pushed `02e4b0e..3651c89`.
  PR #4892 updates from the branch, still one PR, now twenty-one servers; state OPEN, mergeable MERGEABLE.
- PR body: read with `gh pr view 4892 --json body`, patched to add deposits to the Server Names line, add one
  table row after the billing-docs row, change three "twenty" to "twenty-one" and move the pin from
  `05dfa18` to `8418a56`; written back with `gh pr edit --body-file` and re-read: 3 occurrences of
  "twenty-one", 0 bare "twenty", new sha present, old sha absent. Not rewritten.

A new zsh trap for the list: `$SHA:servers/...` in `git cat-file` is parsed as the `:s` history modifier and
silently eats part of the string. `"${SHA}:path"` is the fix. Same family as the word-splitting failure round
9 recorded, and it fails the same way, by producing a plausible wrong answer rather than an error.

Cline marketplace: https://github.com/cline/mcp-marketplace/issues/2440, same template and the same
honest-checkbox pattern as the twenty prior submissions ("installed from the README" unchecked because the
npm package is unpublished, "stable" checked), free-tier limits quoted verbatim from the README's Free vs Pro
table, `servers/deposits/llms-install.md` confirmed present (4,656 bytes) before writing the issue, and its
own logo URL at the pinned sha verified 200. The working claim in the issue was proved first rather than
asserted: a real `deposit_record` of EUR 1,500.00 against a clean `XDG_DATA_HOME` returned `DEP-2026-0001`,
`"held": "EUR 1500.00"`, `"status": "held"` and the free-tier counter line, and `deposit_balance` returned
one EUR row with the `held = received - applied - refunded` basis stated.

Left alone deliberately: PR #4892's body still says "Active Development: repository is active, releases
through v0.6.0", which is stale against 0.10.0. It is not a count-of-servers line and the patch was meant to
be minimal, so it is named here rather than quietly rewritten.

`data/distribution.json`: `per_server.deposits` added with the eleven surface keys. `hosted` records the
`/mcp/deposits` endpoint the remote agent shipped this round; `registry`, `github-mirror`, `smithery` and
`glama` are `pending`; `mcpb` records `pending` with the reason (`fileSha256` is `TBD` until the bundle is
built).

Paid surfaces: none encountered, none submitted. Zero paid API calls.

## F. Caused by other agents, and fixed inside this round

The remote agent shipped `/mcp/deposits` while this round was running, which added
`servers/deposits/remotes.json` and turned three green checks red, exactly as it did in round 13:

```
deposits  remotes: server.mcpb.json has no remotes block
deposits  web: WEB_EXCLUDED lists deposits although it is hosted
estate  every hosted server has a claude-web page: no WEB_ANGLE for deposits
```

All three were correct. `deposits` had been put in `WEB_EXCLUDED` deliberately, because at the time it was
not hosted and a claude-web setup page would have advertised an endpoint that did not exist; the moment it
was hosted, that same entry became the lie in the other direction. It was removed, a `WEB_ANGLE` paragraph
written, and the `remotes` block merged into `server.mcpb.json` byte-equal to `remotes.json`.

The other agent's `invoice_mark_paid` fix is section C.

## Open, named rather than hidden

- `bundles/deposits.mcpb` is not built and `server.mcpb.json` carries `fileSha256: "TBD"`. That is the
  release chain, which this round does not run.
- `scripts/sync-mirrors.sh` and `scripts/build-mcpb.sh` are wired but were not executed.
- npm publication, the MCP registry entry and the Smithery/Glama listings are all `pending` for this server.
- `billing/src/content.js` still carries the guide `one-install-nineteen-servers-office-suite`, whose slug,
  title and body say nineteen and 186. Carried over unfixed from round 13, and now two servers staler.
- `data/distribution.json`'s `per_server["billing-docs"].hosted` still reads "not hosted", which round 13
  made false. Not touched here because it is another server's row, but it is wrong and worth a line.

## Measured insight

**Writing a second server against another server's store is the only review that reads the arithmetic.**

docs/DEPOSITS_RESULT.md found that `invoice_mark_paid` assigned `paid_minor` where it should have added,
silently losing any payment that arrived first. That bug had been shipped, versioned, released, run through
`release-check`, `validate.mjs` and the invoice server's own suite, and had survived every one of them. What
found it was not a check. It was somebody having to write onto the same field from a second server and
therefore having to read the owning server's write path to know what the field meant. Within hours it was
fixed at the source, and this round's job became reporting the fix rather than working around the defect.

The general form is a boundary rule: when two components share a store, the schema is not the contract.
Matching field names tell you a write will not throw. They tell you nothing about whether the second writer
should assign, add, or refuse, and that decision lives in prose and in one line of the first writer's code.
Every automated check in this estate reads state; none of them read intent. The cheapest instrument that does
is a second implementation forced to agree with the first.

The corollary the same day handed over: a measurement and the prose quoting it age differently. Round 13's
rule was that a stale derived number is a bug and a stale measurement is a fact about the past. This round
found the third case, a fact about the past written in the present tense, which is a bug wearing a
measurement's clothes. `data/user_value_r20.json` kept its numbers and the guide changed its tense, and the
line between them is whether the sentence is dated.

artifacts:
- /Users/mike/mcp-servers/scripts/build-mcpb.sh, scripts/sync-mirrors.sh, scripts/build-pages.mjs, scripts/validate.mjs
- /Users/mike/mcp-servers/servers/office-suite/src/index.ts
- /Users/mike/mcp-servers/billing/src/index.js, billing/src/setup.js, billing/src/content.js, billing/src/pages.js (generated)
- /Users/mike/mcp-servers/billing/test/checkout.test.mjs
- /Users/mike/mcp-servers/data/facts.json, data/tools.json, data/user_value_r20.json, data/validation.json (run 50), data/distribution.json
- /Users/mike/mcp-servers/servers/deposits/server.mcpb.json, servers/deposits/README.md
- /Users/mike/mcp-servers/scripts/demo/drive.mjs, scripts/demo/deposits.tape, assets/demo-deposits.gif
- /Users/mike/mcp-servers/assets/deposits-logo.png
- /Users/mike/mcp-servers/README.md
- mcp-billing deployed to mcp.zovo.one, version dbf554bd-18e5-442d-99b6-fc5805d240fb
- /Users/mike/mcp-servers/docs/DIST_R14_RESULT.md (this file)

Built by theluckystrike. https://github.com/theluckystrike
