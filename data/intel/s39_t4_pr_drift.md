# S39 T4 — PR Drift Sweep

STATUS: complete
Swept: 2026-09-17 (post-13:35Z). Operator: theluckystrike (gh CLI keyring auth).
Workdir: /Users/mike/mcp-servers

## Headline

- **Zero CONFLICTING, zero BEHIND, zero DIRTY across every reachable open PR.** No rebase was
  needed, so the PR-13963 rebase procedure was not re-run this sweep. The procedure's
  precondition (`mergeStateStatus` in CONFLICTING/BEHIND) never fired.
- All 16 reachable open PRs report `MERGEABLE`.
- CI green on every PR that has CI. Two repos have no CI configured at all (see notes).
- One PR is `UNSTABLE` on a stale cached rollup with zero actual check runs — detail below.
- **No new maintainer comments and no new labels since 2026-09-17 morning.** The four
  `punkpeye` triage-nudge comments are all dated 2026-09-15, i.e. already known.

## Per-PR table

| PR | repo | state | mergeable | mergeStateStatus | checks | action | evidence |
|----|------|-------|-----------|------------------|--------|--------|----------|
| 14559 | punkpeye/awesome-mcp-servers | OPEN | MERGEABLE | CLEAN | check-submission pass | none needed | `gh pr view 14559 --repo punkpeye/awesome-mcp-servers --json state,mergeable,mergeStateStatus` |
| 14560 | punkpeye/awesome-mcp-servers | OPEN | MERGEABLE | CLEAN | check-submission pass | none needed | `gh pr view 14560 ...` (same command shape) |
| 14561 | punkpeye/awesome-mcp-servers | OPEN | MERGEABLE | CLEAN | check-submission pass | none needed | `gh pr view 14561 ...` |
| 14562 | punkpeye/awesome-mcp-servers | OPEN | MERGEABLE | CLEAN | check-submission pass | none needed | `gh pr view 14562 ...` |
| 14563 | punkpeye/awesome-mcp-servers | OPEN | MERGEABLE | CLEAN | check-submission pass | none needed | `gh pr view 14563 ...` |
| 14564 | punkpeye/awesome-mcp-servers | OPEN | MERGEABLE | CLEAN | check-submission pass | none needed | `gh pr view 14564 ...` |
| 14565 | punkpeye/awesome-mcp-servers | OPEN | MERGEABLE | CLEAN | check-submission pass | none needed | `gh pr view 14565 ...` |
| 13963 | punkpeye/awesome-mcp-servers | OPEN | MERGEABLE | CLEAN | check-submission pass | none needed | `gh pr view 13963 ...` |
| 13964 | punkpeye/awesome-mcp-servers | OPEN | MERGEABLE | CLEAN | check-submission pass | none needed | `gh pr view 13964 ...` |
| 13965 | punkpeye/awesome-mcp-servers | OPEN | MERGEABLE | CLEAN | check-submission pass | none needed | `gh pr view 13965 ...` |
| 13966 | punkpeye/awesome-mcp-servers | OPEN | MERGEABLE | CLEAN | check-submission pass | none needed | `gh pr view 13966 ...` |
| 52 | Albertchamberlain/Awesome-MCP | OPEN | MERGEABLE | UNSTABLE | none reported on branch | none needed (see note 2) | `gh pr checks 52 --repo Albertchamberlain/Awesome-MCP` |
| 68 | wundercorp/awesome-mcp | OPEN | MERGEABLE | CLEAN | validate pass | none needed | `gh pr checks 68 --repo wundercorp/awesome-mcp` |
| 112 | collabnix/awesome-mcp-lists | OPEN | MERGEABLE | CLEAN | no checks reported | none needed | `gh pr checks 112 --repo collabnix/awesome-mcp-lists` |
| 117 | collabnix/awesome-mcp-lists | OPEN | MERGEABLE | CLEAN | no checks reported | none needed | `gh pr checks 117 --repo collabnix/awesome-mcp-lists` |
| 144 | habitoai/awesome-mcp-servers | OPEN | MERGEABLE | CLEAN | CodeRabbit pass | none needed | `gh pr checks 144 --repo habitoai/awesome-mcp-servers` |

`gh pr checks` command actually run, one per repo, for the pass/fail column:

```
gh pr checks <N> --repo <repo>
```

## Maintainer comments / labels — new since 2026-09-17 morning

**None. Zero new maintainer comments and zero label changes.**

Verbatim check: every comment on every swept PR is dated 2026-09-15 or earlier, except the
GitHub Actions bot badge/emoji notices that fire automatically on push. Full inventory:

| PR | latest comment author | latest comment timestamp | verdict |
|----|-----------------------|--------------------------|---------|
| 14559 | github-actions (glama-badge-check) | 2026-09-17T06:28:29Z | bot, pre-sweep, not maintainer |
| 14560 | github-actions (glama-badge-check) | 2026-09-17T06:28:29Z | bot |
| 14561 | github-actions (glama-badge-check) | 2026-09-17T06:28:33Z | bot |
| 14562 | github-actions (glama-badge-check) | 2026-09-17T06:28:37Z | bot |
| 14563 | github-actions (glama-badge-check) | 2026-09-17T06:28:38Z | bot |
| 14564 | github-actions (glama-badge-check) | 2026-09-17T06:28:42Z | bot |
| 14565 | github-actions (glama-badge-check) | 2026-09-17T06:28:47Z | bot |
| 13963 | punkpeye | 2026-09-15T19:00:42Z | PRE-EXISTING, not new |
| 13964 | github-actions (glama-badge-check) | 2026-09-17T12:44:23Z | bot |
| 13965 | github-actions (glama-badge-check) | 2026-09-17T12:44:37Z | bot |
| 13966 | github-actions (glama-badge-check) | 2026-09-17T12:44:42Z | bot |
| 52 | (no comments) | — | — |
| 68 | (no comments) | — | — |
| 112 | (no comments) | — | — |
| 117 | (no comments) | — | — |
| 144 | theluckystrike (self) | 2026-09-08T05:59:13Z | own reply, pre-existing |

Evidence command:

```
gh pr view <N> --repo <repo> --json comments -q '.comments[] | "\(.author.login)|\(.createdAt)|\(.body|gsub("\n";" ")|.[0:220])"'
```

Labels, unchanged and all pre-existing (punkpeye PRs only; every other repo has no labels):

| PR | labels |
|----|--------|
| 14559, 14563, 14564, 14565 | has-emoji, valid-name, has-glama |
| 14560, 14561, 14562, 13963, 13964, 13965, 13966 | has-emoji, valid-name, has-glama |
| 52, 68, 112, 117, 144 | none |

Evidence command:

```
gh pr view <N> --repo <repo> --json labels -q '[.labels[].name]'
```

## Verbatim triage-nudge comments on the 13963-13966 set (pre-existing, 2026-09-15)

Recorded verbatim because they are the only human maintainer feedback in the set and they
define what blocks a merge. All four ask for the same thing: Glama listing claimed by the
owner with a quality score, then the score badge added to the README entry.

### 13963 — punkpeye, 2026-09-15T19:00:42Z

```
<!-- triage-nudge:25afc275 -->
Thanks for the contribution! The server looks great, but before I can merge this, the Glama listing needs to be claimed by the owner and have a quality score set. Right now the badge shows the server exists on Glama but it hasn't been claimed yet. Could you please claim it at https://glama.ai/mcp/servers/theluckystrike/mcp-statement-of-account and make sure the quality score is evaluated? Once that's done, I can merge this PR.
```

### 13964 — punkpeye, 2026-09-15T21:18:05Z

```
<!-- triage-nudge:965f9764 -->
Hi @theluckystrike, thanks for submitting this server! There's still one outstanding item before this can be merged:

- **Add the Glama badge**: Your server isn't listed on Glama yet. Please submit it at https://glama.ai/mcp/servers, then update your PR to include the Glama score badge in the entry, following the format shown in other entries (e.g. `[![Glama](glama-badge-url)](glama-url)`).

Could you take a look when you get a chance? Let me know if you have any questions.
```

### 13965 — punkpeye, 2026-09-15T17:48:41Z

```
<!-- triage-nudge:cd0fcb59 -->
Thanks for the submission! To get this merged, your server needs to be listed on Glama with a quality score. Please:

1. Submit your server at https://glama.ai/mcp/servers and claim it (as the owner).
2. Make sure it passes the checks and has a quality score set.
3. Then update this PR to add the Glama score badge after the GitHub URL, following the entry format documented in the README.

Let me know once that's done!
```

### 13966 — punkpeye, 2026-09-15T18:39:52Z

```
<!-- triage-nudge:514e5786 -->
Thank you for your PR! Unfortunately, the server is not yet listed on Glama, which is required for inclusion in this list. Please submit it at https://glama.ai/mcp/servers, make sure it passes checks (starts and responds to introspection), and then update your PR to add the Glama score badge. Once that's done, I'll be happy to merge this. Let me know if you have any questions!
```

Note the 13963 badge comment says the listing "exists on Glama but it hasn't been claimed yet"
while 13964/13965/13966 say the server "isn't listed on Glama yet". The 13964-13966 branches
now carry a `glama-badge-check` bot comment dated 2026-09-17T12:44 confirming the badge is
present in the diff, so the listing landed after the nudge. The remaining gate is owner-claim
plus quality score, which is a human/account action, not a drift fix.

## Notes

1. **PR count reconciliation.** The task named 13 open PRs. punkpeye/awesome-mcp-servers holds
   11 open PRs from theluckystrike (14559-14565 and 13963-13966). A PR 14566 does not exist —
   `gh pr list --repo punkpeye/awesome-mcp-servers --author theluckystrike --state open`
   returns numbers 13963-13966 and 14559-14565 only, with no gap and no 14566. Adding the five
   cross-repo PRs (52, 68, 112, 117, 144) gives **16 reachable open PRs**, and all 16 are
   swept above. The "13" in the brief appears to be a stale count from an earlier sweep.

2. **Albertchamberlain/Awesome-MCP #52 UNSTABLE is a stale cached rollup, not a real failure.**
   `mergeStateStatus` says UNSTABLE, but `gh pr checks 52 --repo Albertchamberlain/Awesome-MCP`
   returns `no checks reported on the 'add-zovo-mcp-estate' branch`, and
   `--json statusCheckRollup` returns an empty list. There is no failing check to fix. The
   likely cause is that the branch was force-pushed in the 09:11Z session and the old rollup
   was never re-evaluated. `mergeable` is MERGEABLE, so the PR is not blocked on conflict.
   Action taken: none — there is nothing to rebase and nothing red to repair. Worth a re-poll
   on a later sweep to confirm the rollup clears.

3. **collabnix/awesome-mcp-lists has no CI on contributor branches.** Both #112 and #117 report
   `no checks reported`. The repo's README is workflow-regenerated — bot PR #111
   ("Add newly discovered MCP tools from GitHub", author `app/github-actions`, OPEN, MERGEABLE,
   CLEAN, created 2026-09-07T03:15:03Z, updated 2026-09-14T03:42:37Z) is the regenerating job.
   #112 has not been touched since 2026-09-07T03:56:37Z, so it has been sitting for ten days
   while the bot keeps rewriting the same README. This is the highest-risk pair in the set
   because a bot rewrite landing on top of a hand-added line is exactly the conflict shape the
   13963 rebase procedure exists to repair — but as of this sweep upstream still reports both
   MERGEABLE/CLEAN, so no action is taken. Re-check #112 first next sweep.

4. **No rebase performed, so no force-push was issued this sweep.** Per the brief, the rebase
   path is gated on a CONFLICTING/BEHIND state; that gate was false for all 16 PRs. Force-
   pushing a MERGEABLE branch would only invalidate green CI for no benefit.

5. **Freshness of the sweep.** All `gh pr view` state reads were taken after the last recorded
   push in the set (13964-13966 at 12:44Z, 13963 at 12:56Z, collabnix #117 at 13:35Z), so no
   push landed mid-sweep that could have invalidated a state read.

## Verification

```
gh pr list --repo punkpeye/awesome-mcp-servers --author theluckystrike --state open \
  --json number,mergeable -q '.[] | "\(.number)|\(.mergeable)"'
```

Returns 11 rows, every one MERGEABLE, numbers 13963-13966 and 14559-14565.

```
for n in 14559 14560 14561 14562 14563 14564 14565 13963 13964 13965 13966; do \
  gh pr view $n --repo punkpeye/awesome-mcp-servers \
  --json state,mergeable,mergeStateStatus -q '"\(.state) \(.mergeable) \(.mergeStateStatus)"'; done
```

Returns `OPEN MERGEABLE CLEAN` on all 11 lines — no CONFLICTING, no BEHIND anywhere.
