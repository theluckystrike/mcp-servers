# Honesty gates, round 1

Loop 32. Four gates in `billing/test/` were red at HEAD and had been for days. This is what
each one was actually telling us, which side was wrong, what changed, and why nobody saw
them go red in the first place.

The last question is the important one. `billing/test/` is not an npm workspace, so root
`npm test` never ran it. The gate whose entire job is to stop the home page restating a
stale check count had itself gone stale, inside the directory nothing executes. A test
nothing runs is not a test; it is a comment that takes longer to write.

Before: **95 of 106 passing** in `billing/test/`, 11 failing, and the suite outside every
gate. After: **106 of 107 passing**, and the suite runs in `scripts/release-check.mjs`.
The one remaining failure is a single string in `billing/src/content.js`, a file not owned
this loop; the exact edit is at the end and has been verified to close it.

(107, not 106: splitting one assertion in two added a test, and `BILLING_TEST_COUNT` caught
that immediately - the gate fired on its own author within the same hour. It is 107 now.)

---

## The four

### 1. `a crawler on an alias is sent to a page that exists`, the TEST was stale

```
- 'https://mcp.zovo.one/s/bundle'      (expected)
+ 'https://mcp.zovo.one/s/office-suite' (actual)
```

The assertion pinned `/s/bundle`, on the strength of its own comment: *"/s/office-suite is
not in PAGES, so the fallback must be the product it resolves to."* That comment was true
when it was written and is not true now. `GET /s/office-suite` answers **200** today, and
the route already prefers an alias's own page when one exists:

```js
Location: `https://${host}/s/${encodeURIComponent(PAGES[asked] ? asked : id)}`
```

So the test was failing on the better behaviour. Every directory submission in
`docs/HUMAN_GATED_PACK.md` ships `/buy/office-suite` as office-suite's homepage; a crawler
that follows one now lands on the office-suite page instead of being bounced to the bundle.

**Changed:** the test, not the site. The property in its own title, *sent to a page that
exists*, is now what it asserts: it follows the redirect and requires HTTP 200 and a page
that is not the not-found body, for every entry in `PRODUCT_ALIASES` rather than for one
hand-named alias. A pinned path is exactly the thing that went stale here, so the rewrite
does not pin one.

### 2. `llms.txt lists every product with a URL and a description`, BOTH were stale

The failing assertion required the literal `servers/office-suite)`, the tail of
`https://github.com/theluckystrike/mcp-servers/tree/main/servers/office-suite`. Commit
`51136af` moved that link to `https://mcp.zovo.one/s/office-suite`, a page that did not
exist when the assertion was written and does now. The test was failing on an improvement.

Fixing only the regex exposed the real defect underneath. `llms.txt` builds its product
lines from `Object.entries(PAGES)`, and office-suite is in `PAGES` now, so the aggregator
was emitted **twice**, under two different titles, for one URL:

```
- [MCP Office Suite (bundle server)](https://mcp.zovo.one/s/office-suite): One install that exposes every tool of all 31 servers, 292 of them. Install: ...
- [MCP Office Suite](https://mcp.zovo.one/s/office-suite): one config entry that runs every sibling server ... its Pro unlock is the $39 bundle key ...
```

34 product lines for a 32-product catalogue. This is the file assistant crawlers actually
read, in the measured week ClaudeBot fetched 311 of 312 URLs and Googlebot took 2, so a
duplicate entry with two different descriptions is a defect in the one document that has an
audience.

**Changed: both.**

*Site (`billing/src/index.js`, `/llms.txt`):* office-suite is skipped in the `PAGES` loop
and written once, by hand, below the bundle. The hand-written line is the one kept because
it carries the fact no generated tagline carries: **there is no $19 office-suite key, its
Pro unlock is the $39 bundle key.** An assistant that recommended buying office-suite on
its own would send a buyer to a checkout that mints a key every child rejects. The install
path the dropped line carried was folded into the surviving line, so no fact was lost.

*Test:* the regex now requires exactly one `/s/office-suite` product line, requires it to
name the bundle key, and fetches `/s/office-suite` to prove the URL it links resolves. The
count assertion (`length === SINGLE_PRODUCT_IDS.length + 1`) is replaced by a set
comparison against every single product, every alias with a page, and the bundle. A count
could only say the catalogue was wrong; the set says which line is missing or doubled.

### 3. `VALIDATION and BILLING_TEST_COUNT match the files they claim to report`, the SITE was stale

This is the gate that exists because the home page once claimed "399 of 399 automated
checks" and "25 unit tests" while the real figures were 951 and 99. It was red on both
fields it guards.

| Constant | Was | Source of truth | Now |
|---|---|---|---|
| `VALIDATION.at` | `2026-09-06` | last run in `data/validation.json` | `2026-09-09` |
| `VALIDATION.medianMs` | `504` | median of that run's per-server `ms` | `469` |
| `BILLING_TEST_COUNT` | `104` | `test(` declarations in `billing/test/` | `106` |

`pass`, `total` and `servers` (951 / 951 / 32) were already right. The home page was
telling buyers the estate was last validated three days ago and that the billing service
had two fewer tests than it has.

**Changed:** the site. `billing/src/index.js` lines 205 and 212. The gate was correct in
every particular; it just had nothing running it.

### 4. `the bundle description names the count, the one key and the saving`, the TEST was stale

```
The input did not match /^Thirty MCP servers/. Input:
'Thirty-one MCP servers for Claude, one lifetime key, saves $550 against buying singly'
```

The description is derived and correct: 31 servers, `31 x $19 - $39 = $550`. The failure is
the literal `/^Thirty MCP servers/`, which was there for a good reason, the assertion
above it compares `checkoutDescription("bundle")` with a string rebuilt from the same
constants, which passes even when both are wrong, so something had to anchor it to the
outside world. A spelled-out English word is the worst possible anchor: it goes stale the
day a server ships, which is what happened.

**Changed:** the test, and the anchor is now the estate on disk, `servers/*/package.json`
minus office-suite, which is where `scripts/release-check.mjs` reads the count from too, so
the two sides of the comparison have genuinely different sources. Two assertions replace
the literal:

- `SERVER_COUNT` equals the number of server directories that actually ship;
- `countWord()` is a spelled-out word, not a numeral. `countWord()` falls back to
  `String(SERVER_COUNT)` when `NUMBER_WORD` runs out of entries at 46, and the home page H1
  renders it, so "46 local-first MCP servers" would otherwise ship silently.

This is weaker in exactly one way, it no longer proves the word is *"Thirty-one"*, and
stronger in every other, because it now fails on a real condition (a server on disk with no
product row) instead of on the calendar.

---

## A fifth, same class, found while auditing

`guide-redirect.test.mjs:30` asserted `assert.match(html, /198 tools/)` as a spot check that
the new slug serves the guide body. The header comment of that same file explains that the
guide was moved to a version-free slug *because* "nineteen servers, 186 tools" aged out -
and then the test pinned 198, which aged out the same way (the measured figure is 292). It
now asserts `GUIDES[NEW_SLUG].title` appears in the body: read from the guide, so it cannot
disagree with it.

---

## The six that were not on the list

Raised mid-loop. The orchestrator's diagnosis was that `delivery-schedule` is missing its
"First five minutes" section, that this was a consequence of adding the thirty-first server
after the last user-value round, and that the other five were probably the same cause -
with an instruction to check rather than assume. Checked:

**Five of the six are that one cause.** `delivery-schedule` has `first_five: []`,
`first_five_round: null` and no `<h2>First five minutes</h2>`. Four assertions in
`first-five.test.mjs` and one in `copy-button.test.mjs` fail on it.

There is a trap underneath that made those failures read as five unrelated defects. Every
one of those tests does:

```js
const section = pg.html.slice(pg.html.indexOf("<h2>First five minutes</h2>"));
```

`indexOf` returns `-1` when the heading is absent, and `slice(-1)` returns **the last
character of the page**, not the empty string. So a page with no section was being checked
against one character of unrelated markup, and reported back as *"names round null"*,
*"lead sentence disagrees with the scores"*, *"no source line"*. The absence was never what
got printed. `first-five.test.mjs` now reads the section through a helper that asserts the
heading is present first, so an absent section is reported as an absent section.

**The sixth is a different cause, and it is the site.** `guide-figures.test.mjs` fails on
the month-end-close guide quoting `292`, a number `data/user_value_r27.json` does not
contain. It has nothing to do with `delivery-schedule` - that server is not mentioned in the
guide. The guide opens:

> This guide is one month, closed in nine sentences, through the office-suite bundle: one
> stdio server, **thirty-one child servers, 292 tools** on a single connection [...] It is
> not a worked example written afterwards. Every prompt below is quoted exactly as it was
> typed, and **every figure is the figure that run produced**.

Round 27's own method block says: *"proxying all **24 children** [...] A live `tools/list`
against the built bundle returns **224 tools**."* Somebody refreshed the intro to today's
bundle size and left the sentence promising that every figure came from the run. The guide
now claims a configuration the run did not use, in the same paragraph where it promises it
did not do that. The gate is exactly right and the site is exactly wrong.

### The judgement call: assert the measurement, do not manufacture one

Two options were on the table: scope the assertion to pages that have round data and report
the uncovered ones visibly, or have `build-pages.mjs` emit a short honest section for a
server with no round yet.

**Chosen: the first**, for three reasons.

1. **The second one fabricates.** `build-pages.mjs` has exactly one contract - everything in
   that section was measured, and a reader can go and check it. A generator that writes a
   paragraph for a server nobody has exercised breaks that contract in order to satisfy a
   test, which is the failure mode these gates exist to catch. The section is missing
   because the measurement is missing. The honest render of a missing measurement is
   nothing, not a paragraph about nothing.
2. **It would not have worked without changing the tests anyway.** `first_five.length >= 1`,
   the round line, the date line and the free-tier line all still fail against an
   evidence-free section. Option two is option one *plus* an edit to a generator, a
   regenerated `pages.js`, and a "we have not tested this" notice on a live sales page.
3. **A missing round should stay uncomfortable.** Writing the paragraph discharges the
   feeling that something is owed without doing the thing that is owed, which is running a
   round against `delivery-schedule`.

The scoping is derived, not an exemption list: `MEASURED` is built from the round files
themselves, so a server enters it the moment a round covers it and nobody has to remember to
delete an entry.

And the assertion came out **stronger**, not weaker. It was:

> every page has a First five minutes section

It is now:

> a page carries a First five minutes section **exactly when** a round has exercised it

which fails in both directions. The old form could only catch a generator that forgot to
write a section. The new one also catches a page that grew one for a server no round has
touched - fabricated evidence on a page with a Buy button - which nothing checked before.

The "report it visibly" half is a named gap in `scripts/release-check.mjs`, using the
mechanism that file already has for exactly this: a cell that reads `gap`, a line printed by
name in its own section on every run, and no block on the release.

```
server             ... product first-five setup compare ...
delivery-schedule  ... ok      gap        FAIL  FAIL

1 named gap(s), printed rather than passed, not blocking:
  delivery-schedule  first-five: no user_value round has exercised delivery-schedule, so its
  product page carries no measured evidence. Run a round against it and regenerate with
  node scripts/build-pages.mjs; do not write the section by hand.
```

That check also fails, as a blocker rather than a gap, in the two dishonest directions: a
measured server whose page lost its section, and an unmeasured server whose page has one.

### Handover: one string, in a file not owned this loop

`billing/src/content.js`, guide `month-end-close-with-mcp-servers`:

```
-  thirty-one child servers, 292 tools on a single connection
+  twenty-four child servers, 224 tools on a single connection
```

Both replacement figures are round 27's own (`24 children`, `224 tools`, from its `method`
block). Verified by simulation against the real gate's comparison logic: missing figures go
from `['292']` to `[]`, and `billing/test/` goes to **107 of 107**. Do not instead update
the round file or relax the gate - the guide is a report of one run, and the run used a
24-child bundle.

Two smaller things in the same guide, not gated by anything and not fixed here:

- it links `/guides/one-install-office-suite-bundle`, which is **not a live slug** (the
  guide is `one-install-office-suite`), so an internal link in a published guide 404s;
- "thirty-one child servers" is wrong for the same reason as 292, but spelled as a word, so
  the figures gate cannot see it. That is a general hole: `figures()` matches digits only,
  and this estate writes counts as words on purpose.

---

## Wiring it into something that runs

Root `npm test` is:

```
npm run test --workspaces --if-present && node --test test/*.test.mjs
```

which reaches `packages/*`, `servers/*` and the root `test/` directory. `billing/test` (106
tests) and `remote/test` (30) have never been in it.

The gate went into **`scripts/release-check.mjs`**, not into `package.json`. Two reasons:
`release-check` is already the thing that fails a release when something is half-wired, and
it is a file this loop owns, whereas `package.json` is not. It finds the uncovered
directories by walking the tree and subtracting what the root script covers, reading the
workspace globs and the `node --test` invocations out of `package.json` itself, rather than
by holding a list of them, so a test directory added next month is picked up instead of
being born outside every gate.

A second check went in beside it: `--if-present` silently skips a workspace with no `test`
script. All 33 have one (all identical: `node --test test/*.test.mjs`), and this fails the
day one loses it and its tests stop running with no output change.

**A gate nobody has seen fail is not a gate.** Control test, run twice. The second run is
the one that matters, because the fault was injected into the honesty gate itself:
`assert.equal(VALIDATION.pass, pass)` changed to `pass + 1` in `checkout-r1.test.mjs`.

```
### baseline
  estate  test suites ...: billing/test: 1 failing (every figure in the guide appears in data/user_value_r27.json)

### with the deliberate break
FAIL  test suites outside the npm workspaces are green (billing/test, remote/test)
  estate  test suites ...: billing/test: 2 failing (VALIDATION and BILLING_TEST_COUNT match the files
  they claim to report; every figure in the guide appears in data/user_value_r27.json)
release-check exit while broken: 1

### restored
  estate  test suites ...: billing/test: 1 failing (every figure in the guide appears in data/user_value_r27.json)
```

The count moved 1 to 2, the injected fault was named, and restoring the assertion returned
it to 1. An earlier pass of the same control (`PRODUCTS.bundle.usd` 39 to 41 in
`checkout.test.mjs`, while six content failures were still open) moved it 6 to 7 the same
way. `remote/test` is green throughout and contributes nothing to the failure string, so the
pass path is observed as well as the fail path.

`release-check` exits 1 in every state above. It was already exiting 1 before this change,
on two pre-existing `delivery-schedule` failures (`setup: not in SETUP_SERVERS`, `compare:
no entry`), so this gate did not newly block a release that was green.

One thing this control cannot show until the `content.js` string lands: the uncovered-suites
check returning `ok`. It reports `billing/test: 1 failing` because that one failure is real.
Simulation against the gate's own comparison logic confirms it goes green the moment the
guide quotes round 27's figures.

**Still open, and it needs an owner with `package.json`:** root `npm test` still does not
run these suites. A developer running `npm test` locally still sees green while
`billing/test` is red. One line closes it:

```json
"test": "npm run test --workspaces --if-present && node --test test/*.test.mjs && node --test billing/test/*.test.mjs remote/test/*.test.mjs"
```

---

## Audit: the same class elsewhere

### Test suites outside the root run

| Directory | Tests | State | Gated now |
|---|---|---|---|
| `billing/test` | 107 | 106 pass, 1 fail (one `content.js` string) | yes, `release-check` |
| `remote/test` | 30 | 30 pass | yes, `release-check` |
| `bundles/**` | 0 `.test.mjs` | vendored builds | n/a, skipped by design |

No other directory outside `packages/*` and `servers/*` holds a `.test.mjs`.

### Numbers rendered onto the live site from a hardcoded string

Gated, and therefore safe:

- `PRODUCTS.bundle.desc`, "$550", "thirty-one". Gated by `release-check`'s
  *PRODUCTS.bundle names the right count and saving*, which recomputes both.
- `HOSTED_SERVERS`, drives the "paste this URL, no install" line on every product page.
  Gated by `hosted-servers.test.mjs` against the manifests.
- `VALIDATION`, `BILLING_TEST_COUNT`, gated, and were red; fixed above.
- README's generated sections, gated by `build-readme.mjs --check`.

Ungated. Each of these is a number a reader sees, typed by hand, with nothing that fails
when it drifts:

1. **`OFFICE_SUITE_TOOLS = 292`** (`billing/src/index.js:107`). Hand-measured off a running
   v0.21.0 bundle on 2026-09-07 and rendered into `/llms.txt`. `data/tools.json` sums to
   291 tools across 31 children; the difference is the merged `license_status` /
   `license_activate` pair, which is consistent, but nothing asserts that relation. Adding
   a server moves it and no test notices. A gate comparing it against
   `sum(tools.json) + 1` would close it.
2. **`data/tests.json` freshness**, `{tests: 1518, pass: 1507, at: 2026-09-06, release:
   v0.20.0}`. The release is v0.21.0 and `delivery-schedule` has shipped since, so the
   figure is understated. Measured this loop: root `npm test` is **1,563 passing of 1,574**,
   11 skipped, exit 0. The README is telling readers 1,507. `README.md:156` renders it ("1,507 unit tests") and
   `build-readme --check` gates *README against `tests.json`*, but nothing gates
   *`tests.json` against reality*. It is written only when a human runs
   `scripts/record-tests.mjs` against a test log. This is the same shape as the
   `VALIDATION` defect, one file further out, and it is the only one of these that the
   README's generated-section gate makes look green.
3. **`billing/src/content.js`: twelve present-tense "30 servers" strings** while the
   catalogue is 31. Live guide, FAQ and comparison copy, e.g. *"Of the 30 servers in this
   repository, 28 make no network call"*, *"The 30 servers published from ..."*, *"whose 30
   servers run 1,518 tests with 1,507 passing"*. Not this loop's file. Note the contrast
   with the "186 tools" references in the same file, which are **not** stale: every one is
   dated and attributed ("run on 2026-09-04 against the nineteen-server build"), which is
   how a measured figure should be written so that it never needs updating.
4. **`billing/src/setup.js`**, "it now spans 31 servers" and three "292 tools", hardcoded
   in rendered setup copy.
5. **`billing/src/pages.js`**, office-suite's tagline hardcodes both "all 31 servers" and
   "292 of them"; it is a generated file, but generated from prose, not from
   `tools.json`.
6. **Two server counts on one site.** `/changelog` renders `CHANGELOG.serverCount` = **32**
   ("Current version v0.21.0, 32 servers") while the home page H1 renders `SERVER_COUNT` =
   **31** ("Thirty-one local-first MCP servers"). Both are defensible, 32 counts the
   office-suite aggregator, 31 counts what is for sale, but a reader who visits both pages
   sees the estate disagree with itself, and neither number explains which convention it
   is using.
7. **Release tags in prose.** `checkout-r1.test.mjs` already forbids a pinned
   `releases/tag/` link anywhere on the storefront, and that gate is green. The pinned
   versions that remain (`v0.20.0` x15 in `content.js`) are inside dated measurement
   sentences, which is the correct form.

### Two more holes worth naming

- **`figures()` in `guide-figures.test.mjs` matches digits only.** The month-end-close guide
  says "thirty-one child servers" for a run that used 24. The gate cannot see it, and this
  estate deliberately writes counts as English words in customer-facing copy (`countWord()`
  exists for that), so every word-form count on the site is outside every figure gate.
- **Internal guide links are not checked.** The month-end-close guide links
  `/guides/one-install-office-suite-bundle`, which is not a slug in `GUIDES`. Nothing
  asserts that a `/guides/...`, `/s/...` or `/compare/...` link inside rendered copy
  resolves. The `llms.txt` gate now does this for one URL; the same check over every
  internal href in `PAGES`, `GUIDES` and `COMPARE` would be cheap and would have caught it.

### The process finding

Four of the six stale things fixed here were stale **test literals**, not stale site
copy: `/s/bundle`, `servers/office-suite)`, `/^Thirty MCP servers/`, `/198 tools/`. All four
were pinned strings written as anchors against a derived value going wrong. Every one of
them went wrong itself, first, and in the same way. The replacement in each case reads the
anchor from a second, genuinely independent source, the filesystem, the manifests, the
live route's own response, rather than from a value typed at the moment the test was
written.

That is the rule worth keeping: **an anchor typed into a test is a number on the live site
with extra steps.** It rots on the same schedule, and it rots where nobody is looking.

## Follow-up: the one the audit called the worst

The audit named `data/tests.json` as the worst remaining case, because `README.md` renders
it and `build-readme --check` gates the README against it, while nothing gated it against
reality. A green gate was actively hiding a stale number.

Measured and corrected 2026-09-09:

    data/tests.json before : 1,507 pass at 2026-09-06T07:49, no total recorded
    root npm test now      : 1,563 pass, 0 fail, of 1,574
    README before          : "Before anything ships: 1,507 unit tests"
    README now             : "Before anything ships: 1,563 unit tests"

So the public figure was 56 tests behind, and the mechanism that was supposed to keep it
honest could not see it. `scripts/record-tests.mjs` already exists to write that file from a
real run; it simply had not been run since the v0.20.0 release chain.

A trap worth recording for whoever runs it next: `record-tests.mjs` takes a log FILE PATH as
its argument and does not read stdin. Piping a test run into it (`npm test | node
scripts/record-tests.mjs`) makes it exit on its usage message, which closes the pipe and
leaves the suite writing into nothing. Run the suite to a file first, then pass that path.
