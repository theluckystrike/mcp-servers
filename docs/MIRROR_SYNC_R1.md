# Mirror sync round 1 — the full re-sync, and the five defects it was hiding

Agent: mirror-sync, loop 32. Every number below names the command it came from. One of my own
pre-flight results was wrong for about twenty minutes before the harness that produced it was
fixed; that is written up too, in section 4d, because the way it was wrong is the useful part.

Scope: `scripts/sync-mirrors.sh`, this file, `data/mirror_sync.json`, and the mirror
repositories under `github.com/theluckystrike/mcp-*`. No file under `servers/`, `packages/`,
`billing/` or `remote/` was touched. No worker was deployed. No force-push was used on any
existing public repository, and nothing was deleted or renamed.

## The four answers, up front

1. **Did `REQUIRE_CLEAN=1 scripts/sync-mirrors.sh timezone` run?** Yes. It pushed, tagged
   `v0.21.0`, and a fresh clone passed `npm install && npm run build && npm test` (61 tests,
   0 failures) and a real `docker build`. **Its CI run went red**, and that is a real,
   pre-existing defect in `servers/timezone/src/index.ts`, not in the mirror (section 2).
   It is still red, deliberately.
2. **Is the no-squash path safe against a real remote?** Yes, on this evidence: three
   `LOCAL_REMOTE` rehearsals including a diverged remote (section 5), then thirty-two real
   pushes, every one a plain fast-forward with post-push `ls-remote` verification. Thirty of
   the thirty-one pre-existing mirrors now have 2 commits, `mcp-timezone` 3 and
   `mcp-statement-of-account` 4. Nothing was squashed and no history was lost.
3. **Does `mcp-delivery-schedule` exist?** Yes. The full run created it, as predicted. It has
   1 commit (it is new), tag `v0.21.0`, 84 tracked files and a green CI run.
4. **Do 30 mirrors still ship a Dockerfile that cannot build?** No — **0 of 32 do**. All
   thirty-two carry the corrected self-contained one (`grep -c 'COPY servers'` is 0 on every
   fresh clone). Confirmed by running it, not only by reading it: `mcp-timezone` builds all
   the way to an image, and two further spot-checks got past every `COPY` before this
   machine's container DNS timed out on the npm registry. Section 8 states that limit plainly
   rather than claiming all thirty-two were built.

---

## Headline

1. **The sync ran and all thirty-two mirrors are synced: 31 healthy, 1 red.** The one red is
   `mcp-timezone`, on a server defect that is not mine to fix and that I declined to hide.
2. **A blind full sync would have put a red badge on nine of thirty-two.** The single-mirror
   gate failed, so the whole estate was measured locally before any of the other thirty-one
   were touched. That measurement is what turned nine reds into one.
3. **Four defects were in `sync-mirrors.sh` and are fixed.** All four are the shape the
   previous round named and thought exhausted: a mirror test asserting something a mirror does
   not contain. They are `RESULT.md` in a required-file list (six servers), a table of monorepo
   paths reached through a variable (one), a Pro-key helper wrapped by a second local helper
   (one, eleven failing tests), and a path escaping the repository altogether (one).
4. **The fifth is a real server defect.** `outPathOf()` hangs forever on Linux for an
   `out_path` under `/proc`. `servers/calendar` has the same code and the same latent hang.
5. **A real `docker build` succeeds from a mirror clone.** Measured on three of them.

---

## 1. The gate: one mirror, and why it paused the run

The order `REPO_SIGNALS_R1.md` recommended was followed exactly.

    REQUIRE_CLEAN=1 scripts/sync-mirrors.sh timezone
    -> released v0.21.0
    -> pushed https://github.com/theluckystrike/mcp-timezone

Then a fresh clone, which is the only evidence that counts:

    git clone https://github.com/theluckystrike/mcp-timezone.git
    git rev-list --count HEAD          -> 3          (history kept, not squashed)
    git tag                            -> v0.21.0
    git ls-files | wc -l               -> 55
    grep -n '^COPY' Dockerfile         -> COPY package.json tsconfig.json ./
                                          COPY vendor ./vendor
                                          COPY src ./src        (no `COPY servers`)
    npm install && npm run build && npm test
    -> # tests 61  # pass 56  # fail 0  # skipped 5
    docker build -t mirror-timezone-test:v1 .
    -> exit 0, image built

Everything passed except the one thing that cannot be checked from a laptop:

    gh run list --repo theluckystrike/mcp-timezone
    completed  failure  sync from monorepo 054f341...  ci  main  push  34331343286  45s

**That is the gate failing, and it is why the full sync did not follow immediately.** The
other thirty-one mirrors were left untouched until the cause was known and the rest of the
estate had been measured locally (section 3). The sync then ran, and section 7 is its result.

---

## 2. The timezone CI failure, measured to the instruction

    not ok 7 - an unwritable out_path fails cleanly and writes nothing
      duration_ms: 20324
      error: 'timeout on tools/call'

Twenty seconds is the test client's own cap (`adversarial.test.mjs:44`), so the server never
answered. It is not a mirror artefact:

    diff servers/timezone/test/adversarial.test.mjs <clone>/test/adversarial.test.mjs -> identical
    diff servers/timezone/src/index.ts             <clone>/src/index.ts              -> identical

The test calls `ics_create` with `out_path: "/proc/nope/x.ics"`. The server reaches

    // servers/timezone/src/index.ts:142
    function outPathOf(p: string): string {
      const abs = isAbsolute(p) ? p : pathResolve(process.cwd(), p);
      const dir = dirname(abs);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      return abs;
    }

and the third line never returns. Probed directly on Linux:

    docker run --rm node:22-alpine node -e '...'
    mkdir /proc/nope non-recursive   ERR ENOENT   0ms
    mkdir /tmp/a/b   recursive       OK           2ms
    mkdir /proc/nope recursive       <no return, killed at 120s, exit 137>

**procfs answers `mkdir` with ENOENT rather than EPERM or EEXIST.** Node's recursive mkdir
reads ENOENT as "the parent is missing, create it and retry", but the parent `/proc` is
already there, so it retries forever. macOS never shows this: `/proc` does not exist and the
first `mkdir` fails on the read-only root, so the call returns an error and the test passes.

This is a user-facing defect, not a test artefact: any `out_path` under a pseudo-filesystem
hangs the server process for good. `servers/calendar/src/index.ts:80` has the identical
`mkdirSync(dir, { recursive: true })` and the same latent hang; it has no test that reaches it.

**Left red deliberately.** The generator could mark the test skipped and the badge would go
green, and that would be the exact defect the loop brief forbids: hiding real behaviour to
move a score. The honest skips in this script all exist because a mirror genuinely lacks a
monorepo resource. This one fails because the server hangs. It belongs to whoever owns
`servers/timezone`, and it is a two-line fix (bound the mkdir, or do not create parents for
an absolute caller-supplied path).

---

## 3. What a blind full sync would have done

After the gate failed, every generated tree was built and run locally instead of pushing to
thirty-one more public repositories. Nine of thirty-two failed:

| server | failing | cause | whose |
|---|---|---|---|
| amortization | 1 | `RESULT.md` in a required-file list | generator, fixed (5d) |
| catalogue | 1 | same | generator, fixed (5d) |
| change-order | 1 | same | generator, fixed (5d) |
| petty-cash | 11 | same, plus a Pro-key helper wrapped by a local helper | generator, fixed (5d, 5b) |
| work-order | 1 | same | generator, fixed (5d) |
| delivery-schedule | 2 | same, plus a table of monorepo paths | generator, fixed (5d, 5a2e) |
| invoice | 1 | a path escaping the repository | generator, fixed (5a2f) |
| timezone | 1 | the `/proc` livelock | **server, open** |
| expense-tracker | 1 | harness ran as root; `/etc/passwd` was writable | harness, not real |
| resume | 2 | harness image had no `zip` | harness, not real |

The last two rows are the honest record of my own harness being wrong. `node:22-alpine` has
no `zip` binary, which `resume` shells out to, and the container ran as uid 0, which makes
every "an unwritable path is refused" assertion pass a write it should have refused. The
harness was rebuilt on `node:22-bookworm` with `zip` installed and a non-root user, which is
what `ubuntu-latest` actually is.

---

## 4. The four generator defects, one at a time

All four are the class `REPO_SIGNALS_R1.md` section 4 named: *a mirror test asserting
something a mirror does not contain*. That round found two and predicted no more. There were
four more, and the reason they hid is worth recording: each reaches the monorepo by a route
the existing passes do not pattern-match.

### (a) `RESULT.md`, six servers — new step 5d

Step 1 excludes `RESULT.md` from a mirror, correctly: it is the build agent's work log and
carries absolute local paths (`/Users/mike/mcp-servers/...`), wall-clock cost and internal
failure notes. Six contract suites then assert it exists:

    test("the required files are all present", () => {
      for (const f of ["package.json", ..., "SPEC.md", "RESULT.md", ...])
        assert.ok(existsSync(join(HERE, f)), `missing ${f}`);

    -> not ok 37 - the required files are all present
       error: 'missing RESULT.md'

Affects amortization, catalogue, change-order, delivery-schedule, petty-cash, work-order.
The whole block is **not** skipped — that would throw away a real check of twenty other
files. Only the one entry is dropped, so the assertion stays meaningful and becomes true.
The other shape, `join(HERE, "RESULT.md")` in the em-dash sweep, needed nothing: that list
ends `.filter(existsSync)`, so a missing file drops out on its own.

### (b) A table of monorepo paths, delivery-schedule — new step 5a2e

5a2c and 5a2d both match a *literal* `join(REPO, "scripts"` or `join(REPO, "servers"`. This
block reaches the same files through a loop variable, so neither sees it:

    const cases = [["scripts/build-mcpb.sh", /.../, "SERVERS list"], ...];
    for (const [file, re, what] of cases) readFileSync(join(REPO, file), "utf8");

It asserts the estate registered this server in `build-mcpb.sh`, `sync-mirrors.sh`,
`build-pages.mjs` and two sibling servers. Every one is a monorepo file. It is a genuinely
useful check *in the monorepo*, and there is nothing in a mirror it could truthfully assert,
so it is skipped rather than rewritten. delivery-schedule is the only server where such a
block is still live; amortization and petty-cash carry the same literals inside blocks an
earlier pass already skipped, and this pass leaves those alone.

### (c) A Pro-key helper wrapped by a local helper, petty-cash — step 5b, made transitive

This is the same defect as `REPO_SIGNALS_R1.md`'s (b), one level deeper, and it was the
worst of the four: **eleven of forty-four tests failing on a public repository.**

Step 5b neutralises `proKey()` in `test/_client.mjs` to return `""`, then skips every block
that names a Pro-tier helper. petty-cash's blocks never name one:

    async function withFloat(t, opts = { key: proKey() }, over = {}) { ... }   // module scope
    test("a voucher dated before the float opened is refused", async (t) => {
      const { c } = await withFloat(t);                                        // no `proKey` here

With the key empty those tests ran on the free tier, where `float_report` answers a different
shape, and failed with `Cannot read properties of undefined (reading '0')` — 11 of 44 on a
fresh clone against 44 of 44 in the monorepo. 5b now expands the Pro-tier identifier set over
module-scope definitions to a fixpoint, since a wrapper can wrap a wrapper.

Checked for over-skipping rather than assumed: every one of the 21 newly skipped blocks calls
`withFloat` or `workedMonth`, both of which default to `{ key: proKey() }`, and every
`withFloat` call site in the file uses that default or passes `proKey()` explicitly. Across
all thirty-two servers the change moved the skip count for exactly two: petty-cash +21 and
delivery-schedule +1. Nothing else moved.

### (d) A path that escapes the repository, invoice — new step 5a2f

    const SERVERS = join(here, "..", "..");            // servers/ in the monorepo
    const exp = await import(join(SERVERS, "expense-tracker", "dist", "money.js"));

5a2b rewrites the *three*-level form (the repo root) and leaves this two-level one alone. In a
mirror it points at whatever sits **next to the clone**, outside the repository.

This one is the reason section 3 says one of my results was wrong for twenty minutes. The
first harness staged all thirty-two generated trees side by side, which *recreates* `servers/`,
so the import resolved and the test passed for a reason no real clone will ever have. It
surfaced only by accident: the trees were built in alphabetical order, so when `invoice` ran,
`time-tracker/dist/day.js` did not exist yet and the false pass became a visible ENOENT.
**A mirror must be verified isolated.** The harness now gives each tree its own parent
directory containing nothing but the clone, and the final run in section 6 used that.

Own-folder uses are rewritten to the mirror root, so the second D-R15 block — which imports
only invoice's own `money.js` — stays live and keeps its meaning. Only the block that reaches
a sibling is skipped.

---

## 5. Rehearsal, and the safety properties that held

A change to this script is only allowed to reach a public repository after `LOCAL_REMOTE`
rehearsal. Three runs, as the header requires:

    LOCAL_REMOTE=$R REQUIRE_CLEAN=1 scripts/sync-mirrors.sh petty-cash delivery-schedule
    -> run 1, empty remote: created, committed, tagged v0.21.0
    -> run 2, nothing changed:
         "content already identical to fd45b88; no commit"
         "tag v0.21.0 already on mcp-delivery-schedule, left as it is"

    # someone commits STRAY.md straight onto the mirror, then:
    LOCAL_REMOTE=$R REQUIRE_CLEAN=1 scripts/sync-mirrors.sh delivery-schedule
    -> 89588e9 sync from monorepo 12ff99a...
       a6b0b5c someone edited the mirror directly      <- kept
       fd45b88 sync from monorepo 12ff99a...           <- kept
    -> STRAY.md: absent          (generated tree wins, history kept, no force-push)

Working-tree guard, checked rather than assumed. Other agents moved `billing/` during this
round; a mirror is built from the working tree, so that is worth a command, not a shrug:

    git status --porcelain -- servers packages | wc -l   -> 0

so `REQUIRE_CLEAN=1` skipped nothing, and nothing half-finished reached a public repository.

---

## 6. Verification method

Three environments, because each catches what the others cannot:

1. **The monorepo**, to establish what a suite is supposed to score. petty-cash: 44 of 44.
2. **A fresh clone on macOS, isolated**, one tree per parent directory with no siblings
   (section 4d). This is what a person cloning the repository gets.
3. **Linux, `node:22-bookworm` with `zip`, as a non-root user**, which is what
   `ubuntu-latest` is. macOS alone would have missed the `/proc` livelock entirely.

`docker run` on this machine appears to hang for several minutes on first use; it is pulling
the image, and `docker build` is unaffected. A `docker run` that seems wedged is worth one
`docker images` check before being treated as broken.

Result of the final pre-flight, all thirty-two generated trees, isolated:

    macOS, fresh clone       -> 32 of 32 with 0 failures
    Linux, non-root, w/ zip  -> 31 of 32 with 0 failures
                                mcp-timezone 1 failure, the /proc livelock of section 2

Per server on Linux (tests / pass / fail / skipped):

    server                  tests  pass  fail  skip
    amortization              49    34     0    15
    asset-register            49    38     0    11
    bank-statement            53    39     0    14
    barcode                   48    40     0     8
    billing-docs              50    25     0    25
    calendar                  60    53     0     7
    cash-book                 46    29     0    17
    catalogue                 43    31     0    12
    change-order              49    31     0    18
    clauses                   39    32     0     7
    currency                  45    42     0     3
    delivery-schedule         53    35     0    18
    deposits                  40    31     0     9
    docx                      34    30     0     4
    expense-tracker           58    56     0     2
    image                     45    24     0    21
    invoice                   54    48     0     6
    kanban                    29    22     0     7
    office-suite               5     5     0     0
    pdf                       48    13     0    35
    per-diem                  36    26     0    10
    petty-cash                44    13     0    31
    price-tracker             64    59     0     5
    quotes                    33     6     0    27
    recurring                 39    36     0     3
    resume                    38    34     0     4
    spreadsheet               63    60     0     3
    statement-of-account      47    20     0    27
    time-tracker              32    15     0    17
    timezone                  61    55     1     5
    work-order                43    29     0    14
    zip                       45    40     0     5

---

## 7. The estate after the sync

    REQUIRE_CLEAN=1 scripts/sync-mirrors.sh
    -> 32 pushed, 0 failed, 0 skipped
    -> "=== sync-mirrors summary: all mirrors synced"

Nothing was skipped, so nothing needs recording as skipped. `mcp-timezone` reported
"content already identical to 6459243; no commit" on its first pass through the loop, which
is the idempotence guard working: its content had not changed since the gate run earlier the
same day, so no noise commit was made, and the later push in the table is the one that
carried the monorepo's newer SHA.

Every row below is from a **fresh clone** made after the sync, not from the sync's own output:

| mirror | commits | tag | CI | Dockerfile | files |
|---|---|---|---|---|---|
| `mcp-amortization` | 2 | v0.21.0 | green | self-contained | 104 |
| `mcp-asset-register` | 2 | v0.21.0 | green | self-contained | 57 |
| `mcp-bank-statement` | 2 | v0.21.0 | green | self-contained | 72 |
| `mcp-barcode` | 2 | v0.21.0 | green | self-contained | 56 |
| `mcp-billing-docs` | 2 | v0.21.0 | green | self-contained | 88 |
| `mcp-calendar` | 2 | v0.21.0 | green | self-contained | 55 |
| `mcp-cash-book` | 2 | v0.21.0 | green | self-contained | 148 |
| `mcp-catalogue` | 2 | v0.21.0 | green | self-contained | 100 |
| `mcp-change-order` | 2 | v0.21.0 | green | self-contained | 84 |
| `mcp-clauses` | 2 | v0.21.0 | green | self-contained | 77 |
| `mcp-currency` | 2 | v0.21.0 | green | self-contained | 54 |
| `mcp-delivery-schedule` | 1 | v0.21.0 | green | self-contained | 84 |
| `mcp-deposits` | 2 | v0.21.0 | green | self-contained | 103 |
| `mcp-docx` | 2 | v0.21.0 | green | self-contained | 61 |
| `mcp-expense-tracker` | 2 | v0.21.0 | green | self-contained | 55 |
| `mcp-image` | 2 | v0.21.0 | green | self-contained | 52 |
| `mcp-invoice` | 2 | v0.21.0 | green | self-contained | 61 |
| `mcp-kanban` | 2 | v0.21.0 | green | self-contained | 54 |
| `mcp-office-suite` | 2 | v0.21.0 | green | self-contained | 180 |
| `mcp-pdf` | 2 | v0.21.0 | green | self-contained | 53 |
| `mcp-per-diem` | 2 | v0.21.0 | green | self-contained | 59 |
| `mcp-petty-cash` | 2 | v0.21.0 | green | self-contained | 164 |
| `mcp-price-tracker` | 2 | v0.21.0 | green | self-contained | 55 |
| `mcp-quotes` | 2 | v0.21.0 | green | self-contained | 71 |
| `mcp-recurring` | 2 | v0.21.0 | green | self-contained | 69 |
| `mcp-resume` | 2 | v0.21.0 | green | self-contained | 77 |
| `mcp-spreadsheet` | 2 | v0.21.0 | green | self-contained | 58 |
| `mcp-statement-of-account` | 4 | v0.20.0, v0.21.0 | green | self-contained | 114 |
| `mcp-time-tracker` | 2 | v0.21.0 | green | self-contained | 55 |
| `mcp-timezone` | 3 | v0.21.0 | **red** | self-contained | 55 |
| `mcp-work-order` | 2 | v0.21.0 | green | self-contained | 100 |
| `mcp-zip` | 2 | v0.21.0 | green | self-contained | 55 |

    32 mirrors: 31 green CI, 1 red, 32 self-contained Dockerfiles, 32 with a CI workflow,
    32 tagged v0.21.0, 31 with more than one commit (delivery-schedule is new, so it has one).

Evidence commands, per mirror, all re-runnable:

    git clone https://github.com/theluckystrike/mcp-<name>.git
    git -C mcp-<name> rev-list --count HEAD          # commits
    git -C mcp-<name> tag                            # tag
    git -C mcp-<name> ls-files | wc -l               # tracked files
    grep -c 'COPY servers' mcp-<name>/Dockerfile     # 0 = the corrected Dockerfile
    test -f mcp-<name>/.github/workflows/ci.yml      # CI present

and the CI conclusion for all thirty-two in a single API call rather than thirty-two:

    gh api graphql -f query='query { r0: repository(owner:"theluckystrike", name:"mcp-time-tracker")
      { name defaultBranchRef { target { ... on Commit { oid statusCheckRollup { state } } } } } ... }'
    -> SUCCESS x31, FAILURE x1 (mcp-timezone)

---

## 8. Docker, measured rather than read

`REPO_SIGNALS_R1.md` reported that 30 of 31 mirrors shipped a Dockerfile whose first `COPY`
takes a `servers/` directory a mirror does not have. **That is now 0 of 32.** The generated
Dockerfile builds from the repository itself, because a mirror is self-contained:

    FROM node:22-alpine AS build
    COPY package.json tsconfig.json ./
    COPY vendor ./vendor
    COPY src ./src
    RUN npm install --no-audit --no-fund && npm run build

Confirmed by running it on fresh clones, not by reading the file:

    git clone https://github.com/theluckystrike/mcp-timezone.git && cd mcp-timezone
    docker build -t mirror-timezone-test:v1 .
    -> exit 0; "naming to docker.io/library/mirror-timezone-test:v1 done"

Two more were cloned and built to spot-check the rest of the estate. Both reached
`RUN npm install` -- that is, **every `COPY` in the corrected Dockerfile succeeded**, which is
exactly what the old one could not do -- and then failed on the network, not on the file:

    cd mcp-delivery-schedule && docker build .
    -> #12 [build 6/6] RUN npm install ...
       npm error code ETIMEDOUT
       npm error network request to https://registry.npmjs.org/@modelcontextprotocol%2fsdk failed
    -> ERROR at Dockerfile:9

The old broken Dockerfile failed at its FIRST `COPY servers ./servers`, at line 5, before any
network call. Reaching line 9 is therefore itself the evidence that the corrected file is in
place and its build context is right; the ETIMEDOUT is this machine's container DNS, the same
fault that makes one `npm view` take 80 seconds here. The same ETIMEDOUT happened on both spot-checks and on a retry, always at line 9 and never at
a COPY, so what is being measured there is this laptop's container networking, not the mirror.
The unambiguous evidence that the corrected Dockerfile builds end to end is the mcp-timezone
run above, which completed and produced an image; the previous round additionally verified
that image answering initialize and tools/list over stdio.

**Honest limit on this claim:** one mirror was built all the way through to an image
(`mcp-timezone`); two more got past every COPY and then hit the network. Nobody should read
"32 of 32 build" into that. What is measured for all thirty-two is that the file on disk is
the corrected one (`grep -c 'COPY servers' -> 0` on every clone) and that CI installs, builds
and tests each of them on Linux from a clean checkout, which exercises the same
`npm install && npm run build` the Dockerfile runs.

A build takes about four minutes, and longer on this machine because container DNS is slow
(`npm view zod version` from inside a container measured 80 s). A `docker build` that looks
wedged on `npm install` is usually just that; it is worth waiting rather than killing.

---

## 9. What changed in `scripts/sync-mirrors.sh`

- **5d** (new): drop `RESULT.md` from a required-file list, keeping the rest of the assertion.
- **5a2e** (new): skip a block that reads monorepo files through a table of path strings.
- **5a2f** (new): rewrite own-folder uses of `join(here, "..", "..")` to the mirror root, skip
  blocks that reach a sibling through it, and skip the whole file when the escape is
  consumed at module scope.
- **5b** (changed): the Pro-tier identifier set now expands over module-scope definitions to
  a fixpoint, so a helper that wraps a Pro-key helper is itself recognised.

Nothing else in the script was touched. Squashing is still off, the push is still a plain
fast-forward, `REQUIRE_CLEAN=1` still refuses a dirty server, and no force-push path was
added or widened.

## 10. For whoever owns `servers/timezone`

One defect, open, with the evidence in section 2:

    servers/timezone/src/index.ts:145   if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    servers/calendar/src/index.ts:86    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

On Linux this never returns when `dir` is under `/proc`, so `ics_create` with such an
`out_path` hangs the server process for good and `mcp-timezone`'s CI is red because of it.
The mirror is not the problem and cannot honestly hide it. Two ways out, both in the server:
bound the call, or do not create parent directories for an absolute caller-supplied path and
let the write fail with its own error.

## 11. What was NOT done, and why

- **The timezone test was not skipped in the mirror.** Section 2.
- **`RESULT.md` was not published to make the assertion true.** It carries absolute local
  paths and internal notes; excluding it is right, and the test was the thing that was wrong.
- **No release was moved.** An existing tag keeps pointing at the tree that actually was
  that version.
- **No repository, tag or release was deleted or renamed.**

---

## 12. What the next loop should know

- **`mcp-timezone` is red and should stay red until the server is fixed.** Section 2 and
  section 9. Fixing `outPathOf` turns it green with no change to this script.
- **The "one commit in the last 12 weeks" Maintenance line should now move on every mirror.**
  Thirty-one of thirty-two have at least two real commits; `mcp-delivery-schedule` has one
  because it was created today.
- **Every mirror is now tagged `v0.21.0` with a GitHub release**, so the "No stable releases
  found" line and the frozen `latestReleaseVersion` prediction in `REPO_SIGNALS_R1.md`
  section 2 are now testable across the whole estate rather than on one repository.
- **The `join(here, "..", "..")` class is worth a standing check.** Three of the five defects
  this round were a test reaching outside the mirror by a route no existing pass matched. A
  cheap guard for the next round: after generating, grep every tree for `join(REPO, "servers"`,
  `join(REPO, "scripts"` and `join(here, "..", "..")` in a live block, and fail the build if
  any survives. That is a five-line check that would have caught (a), (b) and (d) before a push.
- **Verify a mirror isolated.** Staging every generated tree side by side recreates `servers/`
  and manufactures false passes. Section 4d.
- **Two skip counts moved a lot and that is honest but worth watching**: `mcp-petty-cash` now
  skips 31 of 44 and `mcp-quotes` 27 of 33, because those suites are mostly Pro-tier and a
  mirror cannot hold the signing key. Their CI is green but it proves less than the others'.
  If that matters, the fix is a test-only free-tier fixture in the monorepo, not a change here.
