# Repository signals round 1 — Glama Maintenance, and what a mirror is allowed to claim

Agent: repository-signals, loop 31. All probes run 2026-09-09 between 06:30Z and 07:10Z.
Every number names the command or file it came from. Nothing is carried over from an earlier
agent's summary without being re-measured; two earlier claims are corrected below.

Scope: `scripts/sync-mirrors.sh`, this file, `data/repo_signals.json`, and the mirror
repositories under `github.com/theluckystrike/mcp-*`. No server source was touched — another
agent owns tool descriptions this loop, and that turned out to matter (section 6).

---

## Headline

1. **Three of Glama's twelve Maintenance lines were fixable without lying, and all three are
   fixed on the one indexed repo.** `mcp-statement-of-account` now has a green CI run, a real
   `v0.20.0` release, and three commits instead of one.
2. **"Latest release: v0.14.0" is not a stale crawl.** Glama re-synced that record on
   2026-09-08T13:40:06Z — two days after the mirror's `package.json` moved to 0.20.0 — and
   still reports 0.14.0. The field is frozen at profile creation and is not re-read from the
   repository. A real GitHub release is the only lever we hold on it.
3. **Squashing is now off.** `sync-mirrors.sh` commits on top of the mirror's existing history
   and fast-forward pushes; force-push survives only for a repository with no `main` yet and
   behind an explicit `SQUASH=1`. Proven end-to-end against a local bare remote, three runs,
   including one where the remote had diverged.
4. **A re-sync of all 31 server mirrors is NOT safe to run right now, and the reason is not
   the script.** At 06:57Z, 21 of 32 servers had uncommitted `src/index.ts` edits and every one
   of them had been rebuilt, so their `dist` carries the in-flight text. `servers/timezone`'s
   own contract suite fails 2 of 6 in the monorepo at this moment. A sync now publishes code
   that fails its own tests to public repositories. The script will now say so out loud.
5. **CI paid for itself before it was even green anywhere else.** Adding it surfaced two real
   defects the mirrors had shipped silently: a test that reads a sibling server's source that a
   mirror does not contain, and a test whose Pro key is set up by another test the mirror skips.
   Both are fixed in the generator.

---

## 1. The twelve Maintenance lines, one at a time

Quoted verbatim from `https://glama.ai/mcp/servers/theluckystrike/mcp-statement-of-account/score`
(fetched with a browser UA, 200, 157019 bytes, saved and parsed offline).

| # | Glama says | True? | What was done |
|---|---|---|---|
| 1 | No community issues in the last 6 months | **True** | Nothing. See section 5 — it is true by design and the design is probably right. |
| 2 | 1 commit in the last 12 weeks | **Was true, no longer** | The mirror had exactly one commit because the generator force-pushed a fresh `git init` every time. Squashing removed (section 3). The repo now has 3 commits. |
| 3 | No stable releases found | **Was true, no longer** | No mirror had ever carried a tag. `v0.20.0` created, non-draft, non-prerelease, marked Latest (section 2). |
| 4 | No critical vulnerability alerts | True, and good | Nothing to do. |
| 5 | No high-severity vulnerability alerts | True, and good | Nothing to do. |
| 6 | No code scanning findings | True, and good | Nothing to do. |
| 7 | CI status not available | **Was true, no longer** | No mirror had a workflow. One added, generated for every mirror; two green runs (section 4). |
| 8 | Has a permissive license (MIT) | True, and good | Nothing to do. |
| 9 | Has README | True, and good | Nothing to do. |
| 10 | No recent usage | **True** | Glama counts tool calls made through its own "Try in Browser". Not reachable from here; recorded as human/traffic-gated. |
| 11 | Has valid glama.json | True, and good | Verified byte-for-byte against Glama's own example (section 7). |
| 12 | Author not verified | **True** | Needs a GitHub sign-in on Glama. Appended to `docs/HUMAN_GATED_PACK.md` as section 13. |

Three more lines sit above the Maintenance block, in the 75% "Profile completion" panel:
**"Has a Glama release — Latest release: v0.14.0"** (section 2), **"No related servers"**
(admin-gated, same sign-in as #12), and the score itself.

---

## 2. "No stable releases found", and the v0.14.0 mystery

### Why Glama saw v0.14.0, measured rather than guessed

The obvious story — Glama indexed the repo early and never came back — is **wrong**. The record
carries its own sync timestamp:

    updatedAt = 2026-09-08T13:40:06.281292Z     (embedded in the score page payload)

The mirror's `package.json` has said `0.20.0` since 2026-09-06T08:22:12Z (`git log` on the
mirror). So Glama re-read this repository *after* that and still publishes 0.14.0. The version
is not being re-derived from the repository on each sync.

What 0.14.0 actually is, from the registry:

    curl "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.theluckystrike/statement-of-account&limit=100"
    -> 0.14.0  publishedAt 2026-09-05T17:04:59Z   (first ever publication of this server)
    -> 0.21.0  publishedAt 2026-09-07T02:08:23Z   isLatest=true

and the repository was created 2026-09-05T17:10:18Z, indexed by Glama at 17:43:09Z (`GLAMA_R1.md`).
So 0.14.0 is the project's version during the 33 minutes between repo creation and indexing. It
is a snapshot taken once, at profile creation, and never refreshed.

The control that says what *would* refresh it: this account's other indexed server,
`bln-mcp-grammar-server`, has a real GitHub release `v1.0.0`, and Glama reports
`latestReleaseVersion 1.0.0` for it — matching the release, not a snapshot.

    gh release list --repo theluckystrike/bln-mcp-grammar-server   -> v1.0.0
    glama score page for it                                        -> "Latest release: v1.0.0"

**Conclusion: a real GitHub release on the mirror is the only lever this project holds over that
field, and over the "No stable releases found" line beneath it.** Prediction, falsifiable at
Glama's next sync of this record: the Maintenance line flips, and `latestReleaseVersion` becomes
0.20.0 or is superseded at the next version tag. If it does not move, the field is Glama-internal
and nothing we push can change it — record that and stop trying.

### Is a mirror release honest?

Yes, and the notes are written so that it stays that way. A mirror is a byte-for-byte copy of
`servers/<name>` at a monorepo commit, plus vendored `dist` of its `@theluckystrike` dependencies.
It genuinely contains the code of that release. The release body writes **no changelog of its
own**; it points at the monorepo release, which is where the notes and the `.mcpb` bundle live,
and on this first one it says explicitly which files on the tag are newer than v0.20.0:

    https://github.com/theluckystrike/mcp-statement-of-account/releases/tag/v0.20.0

The tag is `v0.20.0`, not `v0.21.0`, because **v0.20.0 is what this mirror's `src/` and `vendor/`
actually contain**. Tagging it v0.21.0 to match the monorepo would have been the exact kind of
score-chasing lie the loop brief forbids. It will reach 0.21.0 the next time the orchestrator
re-syncs it, and the script will tag it then.

### What the generator now does

`sync-mirrors.sh` step 8: read the version out of the mirror's `package.json`, and if
`refs/tags/v<version>` is not already on the remote, tag it, push the tag, and create the
release. An existing tag is **left where it is** rather than moved, so a tag keeps pointing at
the tree that actually was that version. `NO_RELEASE=1` turns the whole step off.

---

## 3. Squashing: removed, and why that is now the important part of this round

The old step 6 was `git init` in a temp dir, `git add -A`, one commit, `git push --force`. Every
mirror therefore had exactly one commit no matter how much work went into it. That is not a
Glama artefact to be gamed with empty commits — it is a true statement about a repository whose
history was being deleted on every sync.

The orchestrator's finding mid-round raises what is at stake: if the registry entries are
re-pointed from monorepo subfolders to these mirrors (`docs/VSCODE_GALLERY_R1.md`), the mirrors
become the repository a VS Code user lands on, and its commit history is part of what they see.

**Recommendation: keep squashing off. It is implemented and proven.** The risks, named:

| Risk | Handling |
|---|---|
| Fetch fails and the script "helpfully" falls back to force-push, destroying the history this change exists to keep | It does not fall back. A failed fetch fails that mirror and pushes nothing. |
| Someone pushes to a mirror between our fetch and our push | The history-mode push is a plain fast-forward, no `--force`. A race fails loudly instead of overwriting. |
| The generated tree stops being authoritative — a hand edit on the mirror survives | It does not. `git add -A` against an index reset to the remote tip stages deletions too; run 3 below removed a file added directly on the remote. |
| Repos grow, since each sync commits vendored `dist` again | Measured sizes today are 121–217 KB. A few hundred KB a month. Not a constraint. |
| Old tags end up on orphaned commits | Only under `SQUASH=1`. In history mode every tag stays reachable. |
| A no-op sync creates a noise commit | It does not: identical content is detected and nothing is committed or pushed. |

### The proof, three runs against a local bare remote

The script now takes `LOCAL_REMOTE=<dir>`, which points `origin` at a local bare repository and
skips every `gh` call. It is the only supported way to rehearse a change to this script before a
public repository is touched.

    LOCAL_REMOTE=$R scripts/sync-mirrors.sh timezone      # run 1, empty remote
    -> 8fdd8d7 sync from monorepo aa35f65...  + tag v0.21.0

    LOCAL_REMOTE=$R scripts/sync-mirrors.sh timezone      # run 2, nothing changed
    -> "content already identical to 8fdd8d7; no commit"
    -> "tag v0.21.0 already on mcp-timezone, left as it is"
    -> remote still one commit

    # someone commits STRAY.md straight onto the mirror
    LOCAL_REMOTE=$R scripts/sync-mirrors.sh timezone      # run 3, remote diverged
    -> 26423ab parent=72de980 sync from monorepo aa35f65...
       72de980 parent=8fdd8d7 someone edited the mirror directly
       8fdd8d7 parent=      sync from monorepo aa35f65...
    -> STRAY.md: absent   (generated tree wins, history kept)

The same operations were then exercised against GitHub for real on `mcp-statement-of-account`:
fast-forward pushes `926110e -> a3a0ab7 -> 4a27981`, a pushed tag, and a created release. No
force-push was used on any public repository this round.

---

## 4. CI

Every mirror is self-contained — each `@theluckystrike/*` dependency is vendored under `vendor/`
with its `dist` committed — so its suite runs from a fresh clone with nothing but npm. The
generator now writes `.github/workflows/ci.yml`: `actions/checkout@v5`, `actions/setup-node@v5`,
Node 22 (matching the Dockerfile base image), then `npm install --no-audit --no-fund`,
`npm run build`, `npm test`. No lockfile is committed, so `npm install` is the honest step.

Measured on `mcp-statement-of-account`:

    gh run list  --repo theluckystrike/mcp-statement-of-account
    34320638505  success  a3a0ab7   (v4 actions, 17s)
    34321250634  success  4a27981   (v5 actions, 22s)

The v4 run carried a runner annotation — *"Node.js 20 is deprecated ... actions/checkout@v4,
actions/setup-node@v4"* — which is why the generator emits v5. The v5 run is clean.

### Two real defects CI found, both now fixed in the generator

**(a) A mirror test read a sibling server's source.** `statement-of-account`'s contract suite
reads `servers/invoice/src/store.ts`, `servers/billing-docs/src/store.ts` and
`servers/deposits/src/store.ts` to check that the record shapes it seeds still match what those
servers declare. A mirror vendors a sibling's `dist`, never its `src`. Measured on a fresh clone
of the live mirror before any change:

    npm install && npm run build && npm test
    -> not ok 27 - the seeded record shapes still match what the sibling servers declare
       ENOENT: .../soa/servers/invoice/src/store.ts
    -> # tests 47  # pass 20  # fail 1  # skipped 26

Step 5a2b only rewrote the *literal* own-name form `join(REPO, "servers", "<name>", ...)`. New
step **5a2d** also rewrites the own folder reached through a constant
(`const PRODUCT = "pdf"; join(REPO, "servers", PRODUCT, ...)`, used by bank-statement, calendar,
image, kanban and pdf) and marks skipped any block that still reaches a sibling, or that uses a
module-scope constant holding a sibling path (kanban's `TT_ENTRY`). Nine servers carry the
pattern: amortization, bank-statement, calendar, cash-book, image, kanban, pdf, petty-cash,
statement-of-account. After the fix, same clone: **47 tests, 0 failures.**

**(b) A skipped test was the setup for a live one.** `timezone`'s concurrency suite signs a Pro
key into `process.env.CONC_KEY` inside its first test; step 5a2c skips that test because it runs
the monorepo's `scripts/sign-license.mjs`. The second test read the now-empty key, ran on the
free tier, and asserted 10 counted writes:

    fresh clone of the generated mcp-timezone tree
    -> not ok 17 - two processes writing ics counters do not lose a count
       expected 10 counted writes, found 3
    monorepo, same file: node --test test/concurrency.test.mjs -> 2 pass, 0 fail

New step **5c**: an environment variable assigned *only* inside skipped blocks cannot be set at
run time, so every block that reads one is skipped too — and if it is read at module scope (the
`client()` helper here), every remaining test in that file is. Restricted to names that no live
block and no module-scope line assigns, so a suite setting its own `XDG_DATA_HOME` per test is
untouched. Iterated to a fixpoint. After the fix the generated tree runs **61 tests, 0
generator-caused failures**; the 2 that remain are section 6's in-flight description edits and
fail identically in the monorepo.

The three skip passes now also recognise a block another pass already marked `test.skip(`,
instead of absorbing it into its predecessor and skipping that one by mistake.

---

## 5. The lines that are true and stay true

**"No community issues in the last 6 months."** Issues are enabled on all 31 server mirrors
(`gh repo list --json hasIssuesEnabled`), and `MIRROR.md` tells people to file in the monorepo,
which guarantees the tracker stays empty. That is the right trade — one issue tracker for one
codebase — and manufacturing issues to move a grade would be exactly the defect the brief names.
Recorded, not fixed. If it ever becomes worth reconsidering, the question is whether Glama
penalises an empty-but-open tracker more than a disabled one; that is unknown and was not guessed.

**"No recent usage."** Glama's own tip says to seed it with "Try in Browser" on the server page.
That is a browser action on Glama's site, not something this project can reach.

---

## 6. Are the mirrors current, and is a re-sync safe?

**Currency.** 30 of the 31 server mirrors were pushed in one run on 2026-09-06 08:18–08:23Z, at
monorepo v0.20.0. `mcp-timezone` was pushed 2026-09-08T09:44:31Z (the Dockerfile fix). The
monorepo is at v0.21.0 (`gh release list --repo theluckystrike/mcp-servers`). So every mirror
except timezone is one release behind, and 30 of 31 still ship the Dockerfile whose first `COPY`
takes a `servers/` directory a mirror does not have — confirmed by diffing the live
`mcp-statement-of-account` Dockerfile against the generated one.

**A gap: `servers/delivery-schedule` has no mirror at all.**

    ls servers | wc -l                                    -> 32
    gh repo list ... | grep '^mcp-' | wc -l               -> 33   (31 server mirrors + mcp-servers + mcp-registry)
    comm: servers with no mirror                          -> delivery-schedule

The next full run creates it, since the script creates a repository it cannot find.

**Safety — the answer is no, not right now, and the reason is a live one.** The mirror tree is
built from the **working tree**, not from a commit, so uncommitted edits are published. At 06:57Z:

    git status --porcelain | grep '^ M servers/'   -> 21 servers with modified src/index.ts
    all 21 have dist/index.js NEWER than src/index.ts, i.e. they have been rebuilt

`mcp-license` depends on `mcp-timezone`, and every server depends on `mcp-license`, so **every**
mirror's vendored closure currently contains rebuilt in-flight code. And that code does not pass
its own tests:

    servers/timezone $ node --test test/contract.test.mjs
    -> # tests 6  # pass 3  # fail 2
       "every tool description is non-empty, single-paragraph, and within the hard ceiling"
       "a tool that takes a file path or a URL opens with an imperative sentence"

Those are the description agent's ratchet tests reacting to its own edits, and they are that
agent's to close. But syncing on top of them would publish, to 31 public repositories, code that
fails its own contract suite — and now that CI exists, it would do so with a red badge.

Two guards were added rather than relying on anyone remembering this:

- Before building, the script prints every uncommitted change under `servers/<name>`.
- After vendoring, it prints every vendored package that is dirty, and says whether that
  package's `dist` is newer than its dirty source — the case where the edit actually reaches the
  mirror. `REQUIRE_CLEAN=1` turns either into a skip. Its first run refused a real sync:

      REQUIRE_CLEAN=1 scripts/sync-mirrors.sh petty-cash
      NOTE: vendored mcp-billing-docs has uncommitted changes in servers/billing-docs
        and its dist is NEWER than that source, so the mirror carries the edit
      REQUIRE_CLEAN=1: skipping mcp-petty-cash

**When it is safe, and the order to run it in.** Once the description work is committed and
`npm test` is green at the monorepo root:

    REQUIRE_CLEAN=1 scripts/sync-mirrors.sh timezone      # one mirror, already the newest
    # then: fresh-clone it, npm install && npm run build && npm test, and watch gh run list
    REQUIRE_CLEAN=1 scripts/sync-mirrors.sh               # the rest, including delivery-schedule

The first full run in history mode adds one commit to each mirror and creates 31 tags and
releases at whatever version is current. That is a lot of GitHub API calls in one loop; if it
trips a secondary rate limit, `NO_RELEASE=1` gets the content out and the releases can follow.

---

## 7. `glama.json`, and what is left for a human

The file in every mirror is:

    {
      "$schema": "https://glama.ai/mcp/schemas/server.json",
      "maintainers": [
        "theluckystrike"
      ]
    }

Glama's score page prints the required shape itself, in the "Author not verified" panel:

    {
      "$schema": "https://glama.ai/mcp/schemas/server.json",
      "maintainers": [
        "your-github-username"
      ]
    }

Same two keys, same schema URL, same array-of-username shape, and Glama's own checklist agrees —
line 11 of the Maintenance block reads "Has valid glama.json". **Nothing about the file is
wrong and nothing was changed.** The remaining step is the operator signing in to Glama with
GitHub and claiming the listing, which also unlocks "Add related servers" and the manual
"Sync Server" button. Written up as section 13 of `docs/HUMAN_GATED_PACK.md`.

---

## 8. What changed, exactly

`scripts/sync-mirrors.sh`:

- step 1c writes `.github/workflows/ci.yml` into every mirror
- step 3b warns when a vendored package is dirty and has been rebuilt; `REQUIRE_CLEAN=1` skips
- step 5a2d rewrites own-folder-via-constant paths and skips sibling-source blocks
- step 5c skips a test whose environment is set up by a skipped test
- steps 5a2c and 5b no longer mis-attribute an already-skipped block
- step 6/7a commits on top of the mirror's history and fast-forward pushes; force-push only for
  a repository with no `main`, or `SQUASH=1`; the push is verified against `ls-remote`
- step 8 tags and releases the version the mirror actually holds; `NO_RELEASE=1` disables
- a per-server dirty-working-tree warning, and `LOCAL_REMOTE=<dir>` for rehearsal

Mirror repositories (their commits, not the monorepo's): `mcp-statement-of-account` gained the
CI workflow, the self-contained Dockerfile, the sibling-source test fix, and release `v0.20.0`.
No other mirror was touched.
