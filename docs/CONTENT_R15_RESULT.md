# Content round 15: "First five minutes" on every /s/<id> page - 2026-09-05

status: DONE

## What shipped

Every one of the nineteen `/s/<id>` product pages now ends with a "First five minutes"
section: up to three prompts a reader can paste straight into their client, each with one
sentence saying what the server actually did with it, the round and date the measurement
came from, and one line on what the free tier covers for that path.

Nothing in the section is hand-written per server. It is generated in
`scripts/build-pages.mjs` from `data/user_value*.json` and `data/facts.json`, so it moves
when a new round lands and cannot drift from the measurements by hand-editing.

- `scripts/build-pages.mjs`: four new pure functions plus one call site.
  - `loadScenarios()` flattens every scored, prompt-carrying scenario across all sixteen
    round files. Rounds 4 and 9 carry no usable `prompt` field and are skipped; rounds 4
    to 10 name the server only through `surface` ("hosted/price-tracker"), so the server
    is read from `server` when present and from the tail of `surface` otherwise.
  - `pickRound(rows)` chooses the round to quote: highest mean score for that server,
    then the most 3s that carry evidence, then the most recent round. All three keys are
    deterministic, so an unchanged `data/` rebuilds an unchanged page.
  - `selectPrompts(rows)` takes up to three prompts that scored 3 in that round. A server
    whose best round holds no 3 falls back to its single best-scoring prompt, and the page
    then states that score. No server needs the fallback today; the branch exists because
    the next round can produce one.
  - `evidenceSentence(note)` reduces the scenario's evidence field to one sentence. The
    split only fires on a period followed by whitespace and a sentence opener, so decimals
    and rates ("49.00 EUR", "1.154028") survive intact. Sentences under 40 characters are
    skipped, because notes routinely open with a bare call count ("One convert.", "One
    call.") that tells a reader nothing; a leading all-caps log marker ("HONESTY
    SCENARIO.") is dropped for the same reason. The sentence is otherwise verbatim, which
    is what keeps the promise that no number appears that the evidence does not contain.
  - `firstFiveMinutes(id, scenarios, free)` renders the section and returns the same facts
    as structured data, which is stored on the page object as `first_five`,
    `first_five_round` and `first_five_date` for the test to read.
- `billing/src/pages.js` regenerated. 336,327 bytes on disk, up from 301,573. Every page carries
  the section; 48 prompts across 19 servers.
- The bundle sentence is now folded in after the new section (`addBundleCta(tagged +
  ff.html, id)`), so on the READMEs with no `/buy` paragraph of their own the CTA stays
  the last line of the page rather than being buried above the prompts.
- `billing/test/first-five.test.mjs` (new, 9 tests). It re-reads `data/` itself rather
  than importing anything from the generator, so it is a second opinion and not an echo.

`billing/src/index.js` was not touched: the section is inside `pg.html`, which the
existing `/s/<id>` route already renders.

## What the test asserts

The load-bearing one is traceability:

- every prompt string read back out of the rendered `<pre>` blocks exists verbatim in
  some `data/user_value_r*.json` (compared against the JSON-encoded form on disk, so a
  prompt carrying a quote or a newline has to match the real bytes);
- the metadata list and the rendered list are the same prompts, in the same order;
- each prompt's stated score equals the score that scenario has in the round the page
  names, and every quoted prompt comes from that one round;
- the sentence under each prompt is a substring of that scenario's own `note`;
- the round each page names is a joint-best-scoring round for that server;
- a page quoting anything below 3 states the score, a page quoting only 3s does not;
- each section carries "measured in round N, YYYY-MM-DD" and the free-tier line matches
  `data/facts.json` `servers.<id>.free` character for character;
- no markup leaked into a copy block.

## Per server: prompts, source round, scores

| server | prompts | source | scores | file |
| --- | --- | --- | --- | --- |
| `time-tracker` | 3 | round 5, 2026-09-03 | 3, 3, 3 | `data/user_value_r5.json` |
| `price-tracker` | 3 | round 14, 2026-09-04 | 3, 3, 3 | `data/user_value_r14.json` |
| `spreadsheet` | 3 | round 14, 2026-09-04 | 3, 3, 3 | `data/user_value_r14.json` |
| `invoice` | 2 | round 2, 2026-09-02 | 3, 3 | `data/user_value_r2.json` |
| `expense-tracker` | 2 | round 5, 2026-09-03 | 3, 3 | `data/user_value_r5.json` |
| `currency` | 3 | round 14, 2026-09-04 | 3, 3, 3 | `data/user_value_r14.json` |
| `timezone` | 1 | round 10, 2026-09-03 | 3 | `data/user_value_r10.json` |
| `docx` | 3 | round 14, 2026-09-04 | 3, 3, 3 | `data/user_value_r14.json` |
| `resume` | 3 | round 14, 2026-09-04 | 3, 3, 3 | `data/user_value_r14.json` |
| `recurring` | 2 | round 15, 2026-09-04 | 3, 3 | `data/user_value_r15.json` |
| `clauses` | 2 | round 15, 2026-09-04 | 3, 3 | `data/user_value_r15.json` |
| `pdf` | 3 | round 12, 2026-09-04 | 3, 3, 3 | `data/user_value_r12.json` |
| `calendar` | 3 | round 12, 2026-09-04 | 3, 3, 3 | `data/user_value_r12.json` |
| `kanban` | 3 | round 13, 2026-09-04 | 3, 3, 3 | `data/user_value_r13.json` |
| `image` | 3 | round 11, 2026-09-04 | 3, 3, 3 | `data/user_value_r11.json` |
| `bank-statement` | 2 | round 11, 2026-09-04 | 3, 3 | `data/user_value_r11.json` |
| `quotes` | 3 | round 12, 2026-09-04 | 3, 3, 3 | `data/user_value_r12.json` |
| `barcode` | 3 | round 13, 2026-09-04 | 3, 3, 3 | `data/user_value_r13.json` |
| `zip` | 1 | round 17, 2026-09-05 | 3 | `data/user_value_r17.json` |
48 prompts in total, every one of them a 3. Three servers give fewer than three prompts
because their best round ran fewer than three scenarios with evidence against them
(`invoice` round 2, `expense-tracker` round 5, `recurring`, `clauses` and `bank-statement`
two each; `timezone` round 10 and `zip` round 17 one each).

`invoice` quotes round 2 and `time-tracker` round 5 rather than a recent hosted round
because those are the rounds those servers scored best in, which is what the section
claims. The date on the page is the round's own `at` date, so a reader can see the quote
is from an early local round and go read it.

## Quality gate

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|revolutionary|blazing|cutting-edge|leverage' scripts/build-pages.mjs billing/test/first-five.test.mjs -> 0
    grep -cP '\xe2\x80\x94' scripts/build-pages.mjs billing/test/first-five.test.mjs                                      -> 0
    grep -cP '[^\x00-\x7F]' scripts/build-pages.mjs billing/test/first-five.test.mjs (non-ASCII, catches emoji)           -> 0
    node --check scripts/build-pages.mjs                                                                                 -> syntax OK

The same three greps over the 19 rendered sections themselves (the text that reaches a
reader, not the generator) -> 0, 0, 0.

## Verification

    node scripts/build-pages.mjs   -> 19 pages, 336250 bytes
    cd billing && npm test         -> 62 pass, 0 fail (was 53; +9 for first-five.test.mjs)
    wrangler deploy                -> Version 4b74af47-5497-49e8-9b7e-9871e921e801

All 19 pages: HTTP 200 with exactly one "First five minutes" section.

Three pages, one generated block quoted from each:

`GET https://mcp.zovo.one/s/time-tracker`

    <pre>Export my Nova time as CSV for last month.</pre>
    <p class="muted">What it did, measured in round 5, 2026-09-03: export_csv {from 2026-08-01, to 2026-08-31, project: Nova} -&gt; 'Wrote 0 entries' plus the free-tier note.</p>

`GET https://mcp.zovo.one/s/calendar`

    <pre>Where do I have a free two-hour block next week between 9 and 17 Warsaw time?</pre>
    <p class="muted">What it did, measured in round 12, 2026-09-04: One free_busy with zone Europe/Warsaw passed through: 13h 45m booked inside working hours, 26h 15m free, six busy blocks, the two overlapping Wednesday events collapsed into one 10:00-12:00 busy block.</p>

`GET https://mcp.zovo.one/s/barcode`

    <pre>EAN-13 barcode for 590123412345.</pre>
    <p class="muted">What it did, measured in round 13, 2026-09-04: 5901234123457, 'Check digit 7 was computed and added', 95 modules plus an 11-module quiet zone each side, inline SVG.</p>

IndexNow:

    GET  https://mcp.zovo.one/22fad93b71a88e2e60acae203c4288ae.txt -> HTTP 200 (keyLocation)
    POST https://api.indexnow.org/IndexNow, urlList = the 19 /s/<id> URLs -> HTTP 200

## Content sourcing

- `data/user_value.json` and `data/user_value_r2..r17.json` for every prompt, score and
  evidence sentence. Sixteen files read, nine of them quoted on a live page (rounds 2, 5, 10, 11, 12, 13, 14, 15 and 17).
- `data/facts.json` `servers.<id>.free` for the free-tier line, verbatim and asserted.
- `servers/*/README.md` for the rest of each page, unchanged this round.

Zero paid API calls. Outbound requests were the Cloudflare deploy, 22 curl reads of
mcp.zovo.one, and one IndexNow POST.

## RESULT.md

```
status: DONE
evidence:
  19 /s/<id> pages live with a generated "First five minutes" section, 48 quoted prompts
  in total, every prompt string traceable to a scenario in data/user_value*.json and
  asserted by billing/test/first-five.test.mjs. billing npm test 62 pass 0 fail.
  Deploy version 4b74af47-5497-49e8-9b7e-9871e921e801. IndexNow POST 200 for 19 URLs,
  keyLocation 200.
artifacts:
  scripts/build-pages.mjs (loadScenarios, pickRound, selectPrompts, evidenceSentence,
    firstFiveMinutes; bundle CTA now folded in after the new section)
  billing/src/pages.js (regenerated, 336327 bytes)
  billing/test/first-five.test.mjs (9 tests)
  docs/CONTENT_R15_RESULT.md
next:
  Nothing quotes a below-3 prompt today, so the fallback branch is covered by the test's
  logic and not by a live page. A round that scores a server below 3 across the board
  will exercise it, and the score-stated wording should be read on a real page then.
```
