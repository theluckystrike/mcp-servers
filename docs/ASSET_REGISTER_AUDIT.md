# mcp-asset-register: Part 2 CLI run and the remaining Part 1 gaps

Date 2026-09-05. Scope: `servers/asset-register/src`, `servers/asset-register/test` and this
file. `remote/`, billing, scripts and the asset-register manifests belong to other agents;
nothing there was touched. Pulled `--rebase --autostash` before editing; the working tree
carried unrelated in-progress changes from other agents (bundles, billing, `remote/src/vendor`)
which are left as found.

Part 1 harness: `servers/asset-register/test/_client.mjs`, as in `docs/ASSET_REGISTER_RESULT.md`.

Part 2 harness: the real `claude` CLI (2.1.261) as an MCP client, `--model sonnet`, against
`/private/tmp/uv-assetreg/mcp.json`, which registers `asset-register` and `expense-tracker`
together with `--strict-mcp-config`, fresh `XDG_DATA_HOME=/private/tmp/uv-assetreg/data` and
`XDG_CONFIG_HOME=/private/tmp/uv-assetreg/cfg` placed in each server's own env block inside
`mcp.json` (never `CLAUDE_CONFIG_DIR`, never the CLI's own environment), and an explicit
per-tool allowlist of every `mcp__asset-register__*` / `mcp__expense-tracker__*` tool plus
`license_status`/`license_activate` on each. A shared business profile was written directly to
`data/mcp-servers/profile/business.json` before the run: name "Nova Studio",
`default_currency PLN`, `default_tax_rate 23`, `timezone Europe/Warsaw`. The asset-register
server's env block carried a Pro key (`node scripts/sign-license.mjs asset-register`) so
prompt 3's journal path and prompt 6's report could actually run; expense-tracker stayed on
free tier throughout, which is enough for `expense_add`. Each of the six prompts is one
bounded `-p` call with `--resume <session-id>` chaining the same conversation, request timeout
240 s (every call completed in under 15 s). Machine day: Saturday 2026-09-05. `claude`
resolves to a shell function that prints a MOTD banner to stdout before the JSON-RPC-shaped
`--output-format json` line; the JSON is always the last non-empty line of the captured
output, so results were read from that line, not from `json.load` on the whole stream.

Prompts 4 and 5 each needed one extra round trip: the model asked for the exact purchase date
("What exact date in August...") and the exact disposal date ("What date in November...")
before calling a tool, rather than guessing silently. Those confirmations are counted as part
of prompts 4 and 5, not as new prompts, the same convention `PER_DIEM_AUDIT.md` used for its
prompt 2.

---

## Part 2 - six prompts through the claude CLI

Scores are 0-3, checked against `assets.json` and `data.json` (expense-tracker) on disk and
against `servers/asset-register/src/tables/pl-kst.json` and `src/depreciation.ts`'s
cumulative-rounding rule, not against the model's prose. All hand-checks were also cross-run
through `buildSchedule`/`accumulatedTo` directly in `node` against `dist/depreciation.js`.

| # | Prompt | Score | Verified |
| --- | --- | --- | --- |
| 1 | "I bought a laptop for PLN 6,000 on 2 September, add it" | 3 | `asset_add`. Store: `ASSET-2026-0001`, category `487` (Computers and computer sets, 30 percent, matches `pl-kst.json`), `cost_minor: 600000`, `purchase_date`/`in_service_date: 2026-09-02`, `method: straight-line`, `life_years: 3.3333`. The model reported 5 periods and a first charge of 2026-10, matching `buildSchedule`'s month-following rule exactly |
| 2 | "What is the monthly depreciation and how long does it run?" | 3 | Answered PLN 150.00/month from 2026-10 through 2029-12, then PLN 12.50/month for 2030, 51 months total, PLN 6,000.00 fully written off by end of 2030. `monthlyRows` on the stored schedule gives exactly `[15000]*48` then `[1250]*12`, i.e. PLN 150.00 for periods 1-4 (48 months) and PLN 12.50 for period 5 (12 months), 51 months, sum 600000. No tool call was strictly needed to restate what prompt 1 already returned, and the model still cited the correct figures rather than re-deriving them from memory |
| 3 | "Post September's depreciation to my expenses" | 3 | Refused: "There's no September depreciation to post... the first charge is October 2026 (PLN 150.00), not September." No `asset_journal` payload, no `expense_add` call, no `data.json` file was created at all (`ls data/mcp-servers/expense-tracker/data.json` finds nothing). This is not a gap in the model or the tool: the laptop entered service 2026-09-02, so by the Polish month-following rule (art. 16h ust. 1 pkt 1) the first charge month IS October, and a September posting would have invented a number. The brief's ordering (add on 2 September, then ask to post September) is exactly the case this convention is built to refuse, and the refusal is the correct answer, checked against `schedule.first_charge_month === "2026-10"` |
| 4 | "I also bought an office chair for PLN 900 and a car for PLN 80,000 in August" (+ "1 August 2026 for both") | 3 | Two `asset_add` calls. Store: `ASSET-2026-0002` chair, category `808` (office furniture, 20 percent), `cost_minor: 90000`; `ASSET-2026-0003` car, category `741` (passenger cars, 20 percent, `declining_allowed: false`), `cost_minor: 8000000`; both `purchase_date`/`in_service_date: 2026-08-01`, first charge `2026-09`. Reported rates PLN 15.00/month (chair, 900*0.20/12) and PLN 1,333.33/month (car, 80000*0.20/12) both match `linear = base * rate / 100` divided by 12 exactly |
| 5 | "I sold the laptop in November for PLN 4,000, what is the gain or loss?" (+ "15 November 2026") | 3 | `asset_dispose`. Answered a loss of PLN 1,700.00: accumulated PLN 300.00 (Oct + Nov at PLN 150.00), NBV PLN 5,700.00, proceeds PLN 4,000.00. `accumulatedTo(schedule, "2026-11")` returns `30000` minor units (2 months at 15000), `600000 - 30000 = 570000` NBV, `400000 - 570000 = -170000`, a PLN 1,700.00 loss. Exact match |
| 6 | "What is my net book value by category?" | 3 | `asset_report` (Pro; the license key was active for this run). Answered: category 741 (car) cost PLN 80,000.00, accumulated PLN 5,333.33, NBV PLN 74,666.67; category 808 (chair) cost PLN 900.00, accumulated PLN 60.00, NBV PLN 840.00; total cost PLN 80,900.00, accumulated PLN 5,393.33, NBV PLN 75,506.67; laptop correctly excluded as disposed, its PLN 1,700.00 loss named separately rather than folded into NBV. Hand-check: car base 1,600,000/yr, 4 months (Sept-Dec) charged = 533,333 minor = PLN 5,333.33; chair base 18,000/yr, 4 months = 6,000 minor = PLN 60.00. Both match to the cent |

Scorecard: **3.00 / 3** (18 of 18).

### Prompt 6 and the Pro-gated report, verified directly

The license key given to the CLI session was Pro throughout, so `asset_report` answered
directly rather than being refused; the model did not need to compute the category totals
"by hand" from `asset_list`. To capture the exact refusal text the brief asks about, a fresh
free-tier client (`servers/asset-register/test/_client.mjs`, no license key, same shared
profile) called `asset_report` directly:

    Error: "the register report" is a Pro feature. Pro is a one-time $19 for this server,
    lifetime. Buy at https://mcp.zovo.one/buy/asset-register?src=asset-register.asset_report ,
    then run license_activate with the key shown after checkout. Keys verify offline; nothing
    is sent anywhere. Or all 22 servers for $39:
    https://mcp.zovo.one/buy/bundle?src=asset-register.asset_report.bundle

This matches `unit.test.mjs`'s free-tier assertions and RESULT.md probe 25: the tool name, the
one-time price, both purchase URLs (per-tool and suite bundle), and the instruction to run
`license_activate` are all present. On a free tier, "what is my net book value by category"
would route the model to `asset_list` (free and unlimited) and require it to sum per-category
cost, accumulated depreciation and NBV itself; that arithmetic is exactly what `asset_report`
does server-side, so a free-tier run trades a Pro refusal for the model doing grouping and
addition by hand, which is a correctness risk this suite would not want to depend on for a
number that ends up on a balance sheet. Nothing in `asset_report` needs to change: the
refusal text is complete and the tool answered correctly once licensed.

### Not a defect: prompt 3's refusal instead of a posting

The brief's prompt 3 reads as if a September charge should exist and be posted
(`asset_journal` payload then `expense_add`). It does not exist: the laptop from prompt 1 was
put into service 2026-09-02, and the Polish month-following convention (art. 16h ust. 1 pkt 1,
asserted in `depreciation.ts` and covered by `unit.test.mjs`'s first test) means the first
charge is October, not September. The model read `first_charge_month: "2026-10"` off its own
prior tool call and refused to invent a September number rather than posting one anyway. This
is the convention working as designed, not a routing failure, and the expense store staying
empty after this prompt is the correct outcome to check for.

---

## Part 1 - probes not yet covered in docs/ASSET_REGISTER_RESULT.md

RESULT.md's 30-row table already covers most of the gaps named in this task's brief: residual
over cost (row 10), negative cost and a fractional one (row 11), disposal before the
in-service date (row 12), life of zero (row 13), a category outside the bundled table (row
15), a corrupt `assets.json` and a corrupt `counter.json` (rows 18-19), and two processes
racing the tenth free asset (row 21). One gap was NOT yet covered: a register with 200 stored
assets. No existing test stored more than 10 (the free-tier cap test) or 40 (the concurrency
id-uniqueness test), so nothing exercised `asset_list`/`asset_report` at a size where a
quadratic id scan, a currency-grouping bug or a rounding drift across many rows would show up.

A defect-hunting test was added for this gap; it did not find a defect, but it is now a
permanent assertion rather than an unverified claim.

| # | Probe | Result | What happens |
| --- | --- | --- | --- |
| — | residual over cost | PASS, re-verified | `adversarial.test.mjs` "a residual at or over cost is refused, and nothing is stored"; unchanged since RESULT.md row 10 |
| — | negative cost | PASS, re-verified | `adversarial.test.mjs` "a negative or zero cost is refused, and so is a fractional one"; unchanged since RESULT.md row 11 |
| — | disposal before in-service | PASS, re-verified | `adversarial.test.mjs` "a disposal before the in-service date is refused by name and nothing is written"; unchanged since RESULT.md row 12 |
| — | life zero | PASS, re-verified | `adversarial.test.mjs` "a useful life of zero or a negative one is refused rather than dividing the cost by nothing"; unchanged since RESULT.md row 13 |
| — | unknown category | PASS, re-verified | `adversarial.test.mjs` "a category outside the bundled table is refused by name and says the table is partial, not empty"; unchanged since RESULT.md row 15 |
| — | 200 assets | **NEW test added, PASS** | `unit.test.mjs` "200 assets: the register scales, ids stay unique, and list/report totals still add up to the cent". 150 PLN (`pl`/`487`) plus 50 USD (`us`/`5-year`, declining-balance) assets added under a Pro key. `asset_list` returns `count: 200`, 200 unique ids, `totals_by_currency` for PLN and USD each equal to their own group's cost with `accumulated + nbv === cost` per currency. `asset_report` groups all 200 into exactly two category rows (150 `pl`/`487`, 50 `us`/`5-year`) with the same identity holding per row. No defect found: ids stayed unique across two year-scoped counters, currencies stayed unmixed, and the per-row cost/accumulated/nbv identity held at scale |
| — | corrupt store | PASS, re-verified | `corrupt.test.mjs`, both `assets.json` and `counter.json`; quarantined byte for byte, `asset_schedule` on an unstored asset still answers; unchanged since RESULT.md rows 18-19 |
| — | two processes on the free cap | PASS, re-verified | `concurrency.test.mjs` "two processes cannot both slip past the tenth free asset"; exactly 10 stored, 6 refused, one lock around the check-and-write; unchanged since RESULT.md row 21 |

---

## Final test summary

    npm run build -w servers/asset-register   tsc clean, no output
    npm test -w servers/asset-register        # tests 46 / # pass 46 / # fail 0 / # skipped 0
    node scripts/sync-versions.mjs --check    0 file(s) written

46 tests across `unit` (17, one new), `adversarial` (14), `corrupt` (2), `concurrency` (3) and
`contract` (10). One test file changed: `test/unit.test.mjs` (the 200-asset probe appended).
No source file in `src/` was changed in this pass: no defect was found that required one.

---

## RESULT.md block

    status: DONE
    evidence:
    - npm run build -w servers/asset-register: tsc clean
    - npm test -w servers/asset-register: # tests 46 / # pass 46 / # fail 0 / # skipped 0
    - node scripts/sync-versions.mjs --check: 0 file(s) written
    - Part 2: claude CLI 2.1.261, sonnet, asset-register + expense-tracker, per-tool
      allowlist, fresh XDG dirs in mcp.json's server env, shared profile (Nova Studio,
      Europe/Warsaw, PLN, 23%), asset-register Pro key active, 6 prompts (2 with a
      clarifying round trip), 3.00/3, both stores verified on disk: ASSET-2026-0001 laptop
      PLN 6,000.00 -> disposed 2026-11-15 for a PLN 1,700.00 loss; ASSET-2026-0002 chair and
      ASSET-2026-0003 car added correctly; September posting correctly refused (first charge
      is October) and the expense store stayed empty; net book value by category matched
      buildSchedule/accumulatedTo hand-checks to the cent; asset_report's Pro refusal
      separately verified against a fresh free-tier client
    - Part 1 gap-fill: 7 of 8 probes named in the brief (residual over cost, negative cost,
      disposal before in-service, life zero, unknown category, corrupt store, two processes
      on the free cap) were already asserted in docs/ASSET_REGISTER_RESULT.md's 30-row table
      and re-verified passing; the 8th (200 assets) had no existing test and one was added
      in test/unit.test.mjs
    artifacts:
    - /Users/mike/mcp-servers/servers/asset-register/test/unit.test.mjs
    - /Users/mike/mcp-servers/docs/ASSET_REGISTER_AUDIT.md
    cost: 34 wall minutes
    failures:
    - None found in this pass. The 200-asset probe was a genuine gap (nothing had stored
      more than 40 assets before), and it passed on the first run: ids stayed unique across
      two year-scoped counters, currencies stayed unmixed in asset_list and asset_report, and
      the cost/accumulated/nbv identity held per currency and per category at 200 rows
    insight:
    - Prompt 3 is the sharpest moment in the six-prompt run, and it is a trap the brief set
      deliberately: the laptop was added on 2 September and the very next prompt asks to
      post "September's" depreciation, but the Polish month-following convention means the
      first charge is October. The model read first_charge_month off its own prior tool
      output and refused rather than posting an invented number, and the expense store
      stayed empty. A model (or a server) that posted a September charge here would have
      been wrong in a way that looks right until someone checks the statute date, which is
      exactly the failure mode ASSET_REGISTER_RESULT.md's convention design was built to
      prevent. The same discipline showed up smaller in prompts 4 and 5: the model asked for
      an exact date rather than assuming one, even though the disposal math is genuinely
      date-invariant within November (accumulated depreciation is monthly, not daily)

Built by theluckystrike. https://github.com/theluckystrike
