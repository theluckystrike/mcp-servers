# Tool description quality, round 2 (loop 33, 2026-09-10)

Agent A6. Every number names the command or file that produced it. Round 1 scored tool
descriptions with a local heuristic; **this round used Glama's own published per-tool scores**,
read from all 25 connector pages by `node scripts/glama-watch.mjs`. That removes the largest
source of error in round 1, and it immediately corrected two beliefs the round-1 work rested on.

---

## Headline

1. **Glama's connector pages score the HOSTED endpoint's tool descriptions, not
   `packages/mcp-license`.** The connector page for amortization renders `license_activate` as
   *"Turn Pro on for this hosted connection using a key from checkout..."* - the string in
   `remote/src/shims/license.ts:259-261` - while `packages/mcp-license/src/index.ts:215` says
   something entirely different. On the same page `loan_journal` is byte-identical to
   `servers/amortization/src/index.ts`. So ordinary tools flow `servers/*/src` ->
   `remote/build-vendor.mjs` -> connector page, and the two licence tools do not.
   **The 31x shared lever for the connector surface is `remote/src/shims/license.ts`.**
2. **`packages/mcp-license` needs no work.** On the `/mcp/servers` surface, which is built from
   the GitHub repo and therefore reads that file, `license_activate` scores **4.3-4.4** and
   `license_status` **4.4-4.7** (`data/glama_watch.json`, `servers.mcp-office-suite.tools` and
   `servers.mcp-statement-of-account.tools`). Round 1's rewrite of that file worked. It was
   simply never the text the connector pages were reading.
3. **Glama has re-scored the tools, but not the aggregate.** All 25 connectors still stamp
   `Scored 2026-09-08` and still publish their 2026-09-08 TDQS number, yet the per-tool table
   beneath it has been recomputed: `license_activate` is **3.8 on 25 of 25** connectors, where
   round 2 measured min 1.4, max 3.1, mean 2.26. The stamp and the headline TDQS are a cached
   aggregate; the rubric table under them is fresh. That is the answer to the open question.
4. **The fleet-wide minimum tool is no longer shared.** Round 2's `license_activate` capped
   20 of 20 connectors. It now caps 2 of 25, at 3.8. The new fleet minimum is
   **`quote_create` at 2.7** (quotes), and the floor is now a different, server-specific tool
   on almost every server. The one-string-fixes-everything era is over; this round is
   23 individual fixes plus three shared ones.

---

## What was measured

```
node scripts/glama-watch.mjs        -> data/glama_watch.json, full rubric on 25 connectors
```

| | value |
|---|---|
| connectors listed | 25 |
| published TDQS, mean / min | **3.44** / **2.6** (petty-cash), all stamped `2026-09-08` |
| overall derived from the live per-tool scores, mean / min | **3.873** / **3.352** (petty-cash) |
| fleet minimum tool, before | `quote_create` **2.7** (Behavior 2, Completeness 2, Parameters 2, Usage Guidelines 2) |
| tools scoring under 3.5 across the fleet | 23 |
| descriptions rewritten this round | **26** |

The gap between the published mean (3.44) and the mean derived from the live
tool scores (3.873) is round 1's work, already earned and not yet published
by Glama.

---

## Per connector: the floor before, and the predicted floor after

`predicted worst after` is **Glama's own current score for the lowest tool this round did not
rewrite**. It is what becomes the new 40-percent floor if every rewritten tool clears it. It is a
prediction, not a measurement; the next `glama-watch` run after a deploy settles it.

| server | published TDQS | derived overall | worst tool before | score | rewritten | predicted worst after |
|---|---|---|---|---|---|---|
| quotes | 3.7 | 3.847 | `quote_create` | 2.7 | quote_create, license_activate | `quote_decline` @ 3.5 |
| cash-book | 3.4 | 3.59 | `ledger_lines` | 2.9 | ledger_lines, month_close, license_activate | `trial_balance` @ 3.6 |
| per-diem | 3.1 | 3.627 | `trip_export` | 2.9 | trip_export, trip_delete, trip_record, license_activate | `perdiem_rates` @ 3.8 |
| recurring | 3.6 | 3.88 | `schedule_history` | 3 | schedule_history, schedule_update, license_activate | `schedule_upcoming` @ 3.6 |
| time-tracker | 3.6 | 4.009 | `invoice_summary` | 3.1 | invoice_summary, license_activate | `entry_add` @ 3.8 |
| amortization | 3.4 | 3.837 | `loan_journal` | 3.2 | loan_journal, loan_list, loans_report, license_activate | `loan_create` @ 3.6 |
| asset-register | 3.5 | 4.015 | `asset_report` | 3.2 | asset_report, license_activate | `asset_list` @ 3.6 |
| billing-docs | 3.7 | 3.922 | `purchase_order_create` | 3.2 | purchase_order_create, license_activate | `credit_note_list` @ 3.8 |
| image | 3.6 | 3.81 | `image_delete_upload` | 3.2 | image_batch_resize, license_activate, image_delete_upload | `image_thumbnails` @ 3.7 |
| resume | 3.2 | 3.714 | `resume_to_html` | 3.2 | resume_to_html, license_activate, doc_delete_upload | `profile_get` @ 4 |
| catalogue | 3.4 | 3.844 | `catalogue_report` | 3.3 | catalogue_report, sku_set, license_activate | `rate_set` @ 3.6 |
| deposits | 3.3 | 3.923 | `deposit_balance` | 3.3 | deposit_balance, license_activate | `deposit_list` @ 3.6 |
| statement-of-account | 3.4 | 3.703 | `dunning_text` | 3.3 | dunning_text, license_activate | `statement_build` @ 3.5 |
| timezone | 3.4 | 3.771 | `convert_time` | 3.4 | convert_time, license_activate | `find_meeting_slots` @ 3.8 |
| clauses | 3.5 | 4.138 | `clause_update` | 3.5 | license_activate | `clause_update` @ 3.5 |
| expense-tracker | 3.7 | 3.968 | `expense_export` | 3.5 | license_activate | `expense_export` @ 3.5 |
| petty-cash | 2.6 | 3.352 | `float_report` | 3.5 | license_activate | `float_report` @ 3.5 |
| bank-statement | 3.7 | 4.03 | `transactions_list` | 3.6 | license_activate | `transactions_list` @ 3.6 |
| calendar | 3.9 | 3.978 | `free_busy` | 3.6 | license_activate | `free_busy` @ 3.6 |
| spreadsheet | 3.7 | 4.256 | `sheet_stats` | 3.6 | license_activate | `sheet_stats` @ 3.6 |
| pdf | 3.3 | 4.05 | `pdf_watermark_business` | 3.6 | license_activate | `pdf_watermark_business` @ 3.6 |
| work-order | 3.7 | 4.12 | `work_order_create` | 3.6 | license_activate | `work_order_create` @ 3.6 |
| barcode | 3.1 | 3.865 | `license_activate` | 3.8 | license_activate | `qr_create` @ 3.8 |
| currency | 2.8 | 3.554 | `fx_rates_for` | 3.8 | license_activate | `fx_rates_for` @ 3.8 |
| price-tracker | 3.7 | 4.012 | `license_activate` | 3.8 | license_activate | `price_history` @ 4.2 |

Predicted new fleet minimum: **`clause_update` at 3.5**, up from `quote_create` at 2.7.
Eleven connectors keep their existing floor because their worst tool was already 3.5 or better;
on those the only change is `license_activate`, which lifts the mean term on all 25.

---

## What was rewritten

| tool | file | chars before | chars after |
|---|---|---|---|
| `license_activate` | remote/src/shims/license.ts | 204 | 219 |
| `quote_create` | servers/quotes/src/index.ts | 202 | 216 |
| `ledger_lines` | servers/cash-book/src/index.ts | 215 | 211 |
| `month_close` | servers/cash-book/src/index.ts | 179 | 202 |
| `trip_export` | servers/per-diem/src/index.ts | 186 | 218 |
| `trip_delete` | servers/per-diem/src/index.ts | 197 | 214 |
| `trip_record` | servers/per-diem/src/index.ts | 169 | 215 |
| `schedule_history` | servers/recurring/src/index.ts | 176 | 212 |
| `schedule_update` | servers/recurring/src/index.ts | 198 | 220 |
| `invoice_summary` | servers/time-tracker/src/index.ts | 194 | 220 |
| `loan_journal` | servers/amortization/src/index.ts | 190 | 218 |
| `loan_list` | servers/amortization/src/index.ts | 199 | 217 |
| `loans_report` | servers/amortization/src/index.ts | 202 | 206 |
| `asset_report` | servers/asset-register/src/index.ts | 204 | 219 |
| `purchase_order_create` | servers/billing-docs/src/index.ts | 192 | 214 |
| `resume_to_html` | servers/resume/src/index.ts | 186 | 214 |
| `catalogue_report` | servers/catalogue/src/index.ts | 197 | 214 |
| `sku_set` | servers/catalogue/src/index.ts | 173 | 219 |
| `deposit_balance` | servers/deposits/src/index.ts | 182 | 217 |
| `dunning_text` | servers/statement-of-account/src/index.ts | 205 | 208 |
| `image_batch_resize` | servers/image/src/index.ts | 212 | 217 |
| `convert_time` | servers/timezone/src/index.ts | 219 | 209 |
| `doc_from_markdown` | servers/docx/src/index.ts | 197 | 220 |
| `client_add` | servers/invoice/src/index.ts | 187 | 213 |
| `image_delete_upload` | remote/src/shims/image-upload.ts | 62 | 189 |
| `doc_delete_upload` | remote/src/shims/docx-upload.ts | 44 | 187 |

0 tool names, 0 parameter names, 0 schemas and 0 behaviour changed. Every description is at or
under the estate's own 220-character ceiling.

### Two factual defects found by reading the code

- **`per-diem trip_export` claimed "one payload per currency".** It does not. `payloads.push`
  in `servers/per-diem/src/index.ts` emits one payload for subsistence and, when
  `split_lodging` is set, a second for lodging - both in the trip's single currency. The
  description now says exactly that.
- **The same wrong phrase is still live in `remote/src/index.ts:1164`**, in the hosted
  `outputs` metadata for per-diem: *"trip_export returns the exact expense_add ARGUMENTS for a
  trip, one payload per currency"*. That file is A4's, and it is server metadata rather than a
  tool description, so it was left alone. **It should be corrected.** Note the identical phrase
  at line 1172 for `asset_journal` IS correct - that tool really does group across assets by
  currency.

---

## The trap, and how it was handled

`remote/build-vendor.mjs` applies ~113 exact-string patches and throws on a miss. Before any
edit, all 23 target tool names were grepped against it with `/usr/bin/grep`. Six matched
something, and in every case it was **not** the tool's own `description`: `ledger_lines` appears
inside `ledger_export`'s patched description; `image_batch_resize` has its `paths` parameter and
its result heading patched; `resume_to_html` has a `publishFile` insertion; `loan_journal`,
`dunning_text` and `quote_create` appear only in comments. No patch needed changing.

Two descriptions were nevertheless written to stay true on **both** transports rather than
relying on a patch: `image_batch_resize` no longer names `out_dir` (which the hosted build
documents as "accepted and ignored"), and `resume_to_html` no longer names `out_path`.

`node remote/build-vendor.mjs` was run after every batch of edits and exits **0** each time.

---

## Verification

| check | result |
|---|---|
| `node remote/build-vendor.mjs` | exit 0, before and after every batch |
| 220-char contract test, all 32 servers | pass |
| positive control for that test | a 231-char description injected into `zip_history` and rebuilt produced **`not ok 3 - every tool description is non-empty, single-paragraph and within the ceiling` / `tool descriptions over 220 chars`**. Restored, re-ran: 0 failures. The gate is not silently passing everything. |
| per-server `node --test servers/*/test/contract.test.mjs` | 0 failures on 31 of 32 |
| root `npm test` baseline, before any edit | 34 suites, 1574 tests, 1563 pass, **0 fail**, 0 `not ok` |
| root `npm test`, final | 34 suites, 1545 tests, 1531 pass, **3 fail** |

**The 3 remaining failures are not this agent's.** None mentions a description or a character
count; all three are A5's new `packing-list` server not yet registered estate-wide:

```
not ok 1  - SERVER_COUNT matches the number of servers that actually sell Pro
not ok 37 - the estate lists this server everywhere a new server has to be registered
not ok 20 - D-R60: PROFILE_READERS matches every server that actually imports readSharedProfile
```

The failure set moved three times during this loop while nothing of this agent's changed, which
is worth recording: an intermediate run showed **17** failures, all of the form
`+ 'upgrade_to_pro'` / `+ 'pricing://<server>'` in per-server prompt and resource lists, because
`packages/mcp-license/src/index.ts` gained an `upgrade_to_pro` prompt and a `pricing://<product>`
resource at 20:48:46 today - between this agent's baseline run and its first verification run.
A later run showed 6, as A4 landed the matching test updates; the final run shows 3. The tree is
moving under concurrent agents, so a raw `npm test` count is not attributable to any one of them
without reading the assertions.

Boundary note: this agent edited **descriptions only** in three files it does not own -
`remote/src/shims/license.ts`, `remote/src/shims/image-upload.ts` and
`remote/src/shims/docx-upload.ts`. No logic was touched in any of them. That was necessary
because, per headline 1, those files are where the connector-scored licence and upload
descriptions actually live. `packages/mcp-license` was read but **not modified**.

---

## Reading the connector page as a reader, not as a score

Fetched and diffed: our `glama.ai/mcp/connectors/io.github.theluckystrike/amortization`, a rival
connector `io.github.glennl201/leaseiq-pro` in the same two categories, and a `/mcp/servers` page
for a server the blind test actually named, `cordfuse/barcoding-mcp`.

**No field we control is empty.** Our connector page carries two `<dt>` rows the rival's does
not - `Repository` and `GitHub Stars` - and none that it has and we lack. The hosted URL row is
populated (`<input readonly value="https://mcp.zovo.one/mcp/amortization">`; it looks blank only
to a tag-stripping parser, which drops input values). Categories are assigned - Finance, Payments
& Billing - and match the rival's exactly. Status is `Healthy`, last tested 2026-09-10 13:40.

**What a connector page lacks, it lacks for everyone.** A `/mcp/servers` page renders the
repository README in full: install commands (`npx @cordfuse/barcoding-mcp`), a Docker/GHCR
section, a repo layout, environment variables, a Maintenance panel, a Schema tab and a Source
tab. A connector page renders **one sentence** of prose, taken from `server.json.description`,
plus the rubric. That sentence is the only text we control that a reader sees before the tool
list, and it is also the card text under "Related MCP Connectors". Ours reads *"Loan and lease
schedules: payment, interest, early settlement and the journal, to the minor unit."* - accurate,
and no worse than the rival's. Changing it needs a registry re-publish with a version bump,
which is not this agent's file.

**The finding that matters, and it is negative:** the connectors index holds **19,647** entries
(`glama.ai/mcp/connectors`, "Updated 2026-09-10 13:30"), 2,592 of them in Finance alone. Its
sort options are Featured, Search Relevance, GitHub Stars, Name and Date Updated. **TDQS is not
one of them.** Raising the score does not move a row up that listing. It changes what a reader
sees once already on the page, and it is plausibly an input to "Search Relevance" and to an
assistant reading the page - but nobody should expect the score alone to produce traffic.

Two levers on that listing that we do control and are not using: `GitHub Stars` (0 on every
repo) and `Date Updated` (moved by publishing a registry version). Both belong to other agents.

**One coherence point is unreachable by design.** Glama docks our Naming Consistency to 4/5 with
*"the second part varies between verbs (activate, create, delete, list) and nouns (status,
journal, schedule, report)"*; the rival scores 5/5 for a uniform `verb_noun` pattern. Fixing
that means renaming tools, which loop 33 hard rule 2 forbids. Recorded so no later loop
re-derives it.

---

## Correction to the `/mcp/servers` count, from a parallel probe

`scripts/glama-watch.mjs` reported **6 of 34** mirror repos listed today, up from 1. **That is
an instrument artifact.** Its listing probe is `HEAD /mcp/servers/<owner>/<repo>`, and it has a
negative control on the badge route only, not on the page route. The page route flaps: a
deliberately nonexistent repo returned `404,200,404,404,404` over five consecutive requests.

Glama's own sitemap is deterministic and carries its own positive control:

```
curl -s --compressed https://glama.ai/sitemaps/mcp-servers/{1..9}.xml
/usr/bin/grep -h -o 'https://glama.ai/mcp/servers/theluckystrike[^<]*' | sort -u
-> bln-mcp-grammar-server, mcp-office-suite, mcp-statement-of-account
```

So the true count is **2 of 34 mirrors** (3 repos overall), up from 1. Movement is real -
`mcp-office-suite` is new since loop 31 - but it is 1 -> 2, not 1 -> 6.
`scripts/glama-watch.mjs` needs its `pageExists()` replaced with the sitemap sweep; four of the
six "listed" entries it wrote today already carry `error: score page HTTP 404`, which was the
visible tell. **Every "listed" count in today's `data/glama_watch.json` is inflated.** The
per-connector rubric data in the same file is unaffected - it comes from pages that returned
real content, and this document's numbers all derive from that half.

---

## What is left

- The floor is now `clause_update` at 3.5 and a cluster at 3.5-3.6. Round 1 already established
  the binding constraint: six scored dimensions do not fit in 220 characters, and what gets cut
  is the "what it refuses" and "which sibling to prefer" clauses that Behavioral Transparency and
  Usage Guidelines score. Moving past roughly 3.8 fleet-wide needs that ceiling revisited, which
  is a shared quality gate and not a description agent's call.
- `petty-cash` is the worst connector at 2.6 published / 3.352 derived, and its floor tool
  (`float_report`, 3.5) is already respectable - its problem is coherence, not one bad tool.
- Nothing here is deployed. These descriptions reach Glama only when the hosted worker is
  redeployed; a `glama-watch` run about a day later measures whether the prediction in the table
  above held.
