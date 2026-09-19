# DIST_R6_NOTES — r5/r6 distribution round

Date: 2026-09-17
Workdir: `/Users/mike/mcp-servers`
Continues: r5 (evidence at `.hermes/cache/delegation/subagent-summary-0-20260917_133326_645467.txt`
and `.hermes/cache/delegation/live/deleg_a6f83cb8/task-0.log`).
r5 hit its iteration cap before persisting `data/distribution_r5.json` and
`docs/DIST_R5_NOTES.md`; this document carries r5's verified outcomes forward and
adds r6's work.

---

## 0. Verified counts (the short version)

| Metric | Value | How verified |
|---|---|---|
| PRs open against `punkpeye/awesome-mcp-servers` | **7** (#14559–#14565) | `gh pr view ... --json state` |
| PRs carrying all three green labels | **7** | labels = `has-emoji,valid-name,has-glama` on all 7 |
| PRs with `check-submission` SUCCESS | **7** | `--json statusCheckRollup` |
| Glama mirrors indexed | **8** | badge SVG `<title>` = "rated A/B on Glama" |
| Glama mirrors probed | **42** | census loop over `servers/*/` |
| Surfaces 0->1 this round | **0** | no new surface flipped; see negative findings |
| PRs repaired after a real defect | **7** | merged-line bug, force-pushed, re-verified green |

No paid listings purchased. No accounts created. No sign-ins.

---

## 1. The PR defect found in r5's branches, and its repair

r5 force-pushed 7 branches after fixing a placement bug, but **did not re-verify
labels after the force-push**. That re-verification was this round's first job.

### What the readback showed first

```
gh pr view <n> -R punkpeye/awesome-mcp-servers --json state,labels,mergeable,mergeStateStatus
```
All 7: `state=OPEN mergeable=MERGEABLE mss=CLEAN`, labels
`has-emoji,valid-name,has-glama`. So no labeled-failure to fix — on the surface.

### But the diff was wrong

Checking the actual patch instead of trusting the labels:

```
gh pr diff 14560 -R punkpeye/awesome-mcp-servers | /usr/bin/grep '^+'
```
The added line read:

```
+- - [theluckystrike/mcp-bill-of-sale](...) ... integer minor units.[henfrydls/actual-budget-mcp](https://github.com/henfrydls/actual-budget-mcp) ...
```

Our entry and the upstream neighbour `henfrydls/actual-budget-mcp` were
**concatenated onto one line with no separator**. Root cause: the r5 insertion
prepended our bullet to the existing last line instead of inserting a new line,
so it ate the newline and destroyed the neighbour entry's own list-item marker.

Confirmed on disk by fetching the PR head, not by trusting diff rendering:

```
gh repo clone punkpeye/awesome-mcp-servers /tmp/awms-check -- --depth 1
cd /tmp/awms-check && git fetch origin pull/14560/head:pr14560 --depth 1
git checkout pr14560
python3 - <<'PY'
lines=open('README.md',encoding='utf-8').read().split('\n')
for i,l in enumerate(lines):
    if 'mcp-bill-of-sale' in l:
        print('LINE',i+1,'len',len(l))
        print('tail:',repr(l[-260:]))
PY
```
Output: `LINE 2504 len 1198`, tail ending in
`...or ghcr.io/henfrydls/actual-budget-mcp`. One line, two entries, 1198 chars.

This also explains r5's 3 `missing-emoji` labels (#14560–#14562): the emoji
checker saw a single unrecognized blob rather than two valid entries.

### The repair

Rebuilt all 7 branches from `origin/main` (`393b4e9`, shallow) using
`/tmp/awms_insert.py`, which inserts the bullet as its **own** line after the
last bullet of the target section and asserts:

- the anchor regex `^### .*<a name="<anchor>">` matches **exactly one** line
  (this is the r5 TOC trap — the TOC link also contains the anchor string);
- the server name is **absent** from the target section slice before inserting;
- the insertion line is followed by a `- [` bullet or a heading;
- the line before is an intact `- [` bullet (not a merged blob);
- the entry appears exactly once;
- the previously-last bullet still exists verbatim in the output.

Per-branch result:

```
=== mcp-office-suite ===   insert: OK anchor=other-tools-and-integrations inserted_line=4536 next='## Frameworks'
                           ASSERT OK diff: +1 -0
=== mcp-bill-of-sale ===   insert: OK anchor=finance--fintech inserted_line=2505 next='### ... Gaming'
                           ASSERT OK diff: +1 -0
=== mcp-credit-note ===    ASSERT OK diff: +1 -0
=== mcp-dunning-letters === ASSERT OK diff: +1 -0
=== mcp-job-card ===       ASSERT OK diff: +1 -0
=== mcp-packing-list ===   ASSERT OK diff: +1 -0
=== mcp-checklist ===      ASSERT OK diff: +1 -0
ALL BRANCHES BUILT
```

Every branch is now `+1 -0` — one clean appended line, nothing removed.

Note on branch mechanics: do **not** `git fetch` the fork. The fork is a fork of
a very large repo and the fetch hung past the 180s foreground timeout. Push to it
only. `git fetch origin main --depth 1` is enough.

Force-push (all rc 0):

```
git push --force fork add-mcp-office-suite:add-mcp-office-suite     # +c24728a...42b1e62
git push --force fork add-mcp-bill-of-sale:add-mcp-bill-of-sale     # +938570a...3e186dc
git push --force fork add-mcp-credit-note:add-mcp-credit-note       # +0c3c482...8859317
git push --force fork add-mcp-dunning-letters:...                   # +893514c...085079c
git push --force fork add-mcp-job-card:...                          # +5593bbb...2ffa67f
git push --force fork add-mcp-packing-list:...                      # +fbd13b6...494ceaf
git push --force fork add-mcp-checklist:...                         # +7143754...c95e7b3
```

### Post-force-push re-verification (the thing r5 skipped)

```
gh pr view <n> -R punkpeye/awesome-mcp-servers --json state,labels,mergeable,mergeStateStatus,statusCheckRollup
```

| PR | server | state | mergeable | labels | check-submission | diff |
|---|---|---|---|---|---|---|
| 14559 | mcp-office-suite | OPEN | MERGEABLE | has-emoji,valid-name,has-glama | SUCCESS | +1 -0 |
| 14560 | mcp-bill-of-sale | OPEN | MERGEABLE | has-emoji,valid-name,has-glama | SUCCESS | +1 -0 |
| 14561 | mcp-credit-note | OPEN | MERGEABLE | has-emoji,valid-name,has-glama | SUCCESS | +1 -0 |
| 14562 | mcp-dunning-letters | OPEN | MERGEABLE | has-emoji,valid-name,has-glama | SUCCESS | +1 -0 |
| 14563 | mcp-job-card | OPEN | MERGEABLE | has-emoji,valid-name,has-glama | SUCCESS | +1 -0 |
| 14564 | mcp-packing-list | OPEN | MERGEABLE | has-emoji,valid-name,has-glama | SUCCESS | +1 -0 |
| 14565 | mcp-checklist | OPEN | MERGEABLE | has-emoji,valid-name,has-glama | SUCCESS | +1 -0 |

All 7 green. No maintainer comment on any of them; the only comments are the
bot's (`glama-badge-check`, plus the now-stale `emoji-check` messages from before
the repaired push — the labels show the current state is green).

---

## 2. Glama badge poll (the two expected flips did NOT flip)

r5 predicted `mcp-amortization` and `mcp-petty-cash` as "the next organic flips".
They did not flip.

```
UA='Mozilla/5.0 ... Chrome/126.0 Safari/537.36'
for r in mcp-amortization mcp-petty-cash mcp-statement-of-account; do
  curl -s -A "$UA" -o /tmp/badge_$r.svg -w '%{http_code}' \
    "https://glama.ai/mcp/servers/theluckystrike/$r/badges/score.svg"
  /usr/bin/grep -o '<title>[^<]*</title>' /tmp/badge_$r.svg | head -1
done
```

Result:

```
mcp-amortization        http=200 bytes=2880  <title>This MCP server is not listed on Glama</title>
mcp-petty-cash          http=200 bytes=2880  <title>This MCP server is not listed on Glama</title>
mcp-statement-of-account http=200 bytes=4228 <title>mcp-statement-of-account - MCP server rated A on Glama</title>
```

Both targets are the **placeholder** (2880 bytes, "not listed"). The third line is
the positive control: a genuinely-rated mirror returns a different title, so the
check discriminates between "listed" and "placeholder". **HTTP 200 on both is
not a listing.** Correctly, no badge line was added to any PR for these two.

### Full census

```
bash /tmp/glama_census.sh     # loops servers/*/, classifies by SVG title
TOTAL=42  INDEXED=8  PLACEHOLDER=34  OTHER=0
```

Indexed (8, each `<title>` = "rated A/B on Glama"):

- mcp-bill-of-sale — A
- mcp-checklist — A
- mcp-credit-note — A
- mcp-packing-list — A
- mcp-statement-of-account — A
- mcp-dunning-letters — B
- mcp-job-card — B
- mcp-office-suite — B

Unchanged from r5's 8. **Zero new organic flips this round.**

---

## 3. Follow-up queries (proving the live claims are real, not 200s)

Badge `<title>` is strong but it is still one endpoint. Independent confirmation:

### Glama search index

```
curl -s -A "$UA" -o /tmp/g1.html "https://glama.ai/mcp/servers?query=theluckystrike"
curl -s -A "$UA" -o /tmp/g2.html "https://glama.ai/mcp/servers?query=zzzznotarealquery"
/usr/bin/grep -o 'theluckystrike' /tmp/g1.html | wc -l
/usr/bin/grep -o 'theluckystrike' /tmp/g2.html | wc -l
```

```
CONTROL(zzzz) theluckystrike_hits=0  bytes=47640
REAL          theluckystrike_hits=147 bytes=123328
```

The control returning **0** is what makes this evidence: the page does not simply
echo the query string. Distinct slugs referenced in the real page:

```
/mcp/servers/theluckystrike/mcp-bill-of-sale
/mcp/servers/theluckystrike/mcp-checklist
/mcp/servers/theluckystrike/mcp-credit-note
/mcp/servers/theluckystrike/mcp-dunning-letters
/mcp/servers/theluckystrike/mcp-job-card
/mcp/servers/theluckystrike/mcp-office-suite
/mcp/servers/theluckystrike/mcp-packing-list
/mcp/servers/theluckystrike/mcp-statement-of-account
```

Exactly the 8 indexed mirrors (a ninth slug, `bln-mcp-grammar-server`, is a
different owner's server that happens to share the namespace string; it is not
ours and is not counted).

### Glama server page bodies

```
mcp-bill-of-sale        page_http=200 repo_refs_in_body=45  bytes=304186
mcp-office-suite        page_http=200 repo_refs_in_body=152 bytes=1828493
mcp-statement-of-account page_http=200 repo_refs_in_body=43 bytes=294938
```

---

## 4. Submitted vs human-gated vs not-indexed

### Submitted (open, green, awaiting human merge)

- `punkpeye/awesome-mcp-servers` PRs #14559–#14565 — 7 single-server PRs, all
  `has-emoji,valid-name,has-glama`, `check-submission=SUCCESS`, `MERGEABLE/CLEAN`.
  Merge is human-gated by the maintainer (punkpeye reviews one server per PR).
- `toolsdk-ai/toolsdk-mcp-registry` PR #514 — still OPEN, unmerged, unchanged
  since 2026-09-12 (`gh pr view 514 ... -> state=OPEN mss=UNKNOWN`).

### Already live (organic, no account used)

- Glama: 8 server pages, verified this round by badge title + search index +
  page body.

### Human-gated (recorded, untouched — exact URLs)

| Surface | URL | Why gated |
|---|---|---|
| npm | https://www.npmjs.com/login | probe 403 without session; trusted publishing needs the package to exist first (ENEEDAUTH) |
| smithery | https://smithery.ai/auth/cli | auth/cli 404; server pages 404 |
| Glama claiming | https://glama.ai/mcp/servers | claiming requires sign-in |
| cursor.directory | https://cursor.directory/plugins/new | 429 rate-limited this round |
| mcp.directory | https://mcp.directory/submit | account/submission by operator |
| allmcps.com | https://allmcps.com/submit | free form needs contact email + ownership claim |
| mcpserverfinder.com | mailto:info@mcpserverfinder.com | email-only route |
| opentools.ai | https://opentools.ai/signin | search now requires sign-in (new since r4) |
| mcp.so | https://mcp.so/submit | free route needs an account |

### Not indexed / blocked (re-probed this round)

- `api.mcp.github.com/v0/servers?search=theluckystrike` — 200, **455** results,
  ours. The search param does not filter to us; still absent.
- `mcp.so/search?q=theluckystrike` — 200 but the only `theluckystrike` occurrence
  is the echoed query parameter itself; not indexed.
- `mcpservers.org` — 403 (Cloudflare).
- `pulsemcp` — 403.
- `mcpmarket.com` — 200 this round (was 403 in r5); still no submission route
  found and not indexed, so recorded as unverified rather than live.

---

## 5. Issues encountered

1. **The merged-line defect in all 7 branches** — the substantive finding. Fixed
   and re-verified as described in section 1. Note for future rounds: labels being
   green is necessary but not sufficient; read the actual patch.
2. **`git fetch fork` hangs** (>180s) — the fork carries a large history. Push to
   it only; base branches on `origin/main`.
3. **A shell census loop collapsed to one iteration** — the inline
   `for d in servers/mcp-*` glob matched nothing (dirs have no `mcp-` prefix).
   Fixed by iterating `ls -d servers/*/` and adding the prefix in the URL builder.
4. **`grep -P` is unavailable** on this macOS host (BSD grep); the emoji scan was
   done in Python instead.
5. **Oversized inline shell payloads are blocked** by the agent's command parser.
   Long scripts must be written to a file and run with `bash <file>`.

## 6. Next round's first moves

- Poll the two Glama badge URLs again (`mcp-amortization`, `mcp-petty-cash`); if
  either flips to a real "rated" title, open the one-line badge PR immediately.
- Re-read PR #14559–#14565 labels; if a maintainer requests changes, fix and
  force-push with the placement assert.
- Re-probe `mcpmarket.com` and the 403 surfaces; they come back.

## Round 6b — merged-list verification (second agent, appended)

- mcpHQ PR #61: MERGED 2026-09-17T06:10:44Z. Verified: `curl raw.githubusercontent.../data/servers.json | grep -o 'mcp.zovo.one/mcp/[a-z-]*'` -> 1 hit `mcp/invoice`.
- MobinX PR #420: MERGED 2026-09-14; README line 539 links mcp.zovo.one. abordage PR #106: MERGED 2026-09-14 (repositories.yaml). AIAnytime PR #83: MERGED 2026-09-05, still live.
- Verified-live inbound surfaces: 12 -> 14.
- Open: DhanushNehru #85, mcpHQ #62 (endpoint corrected from 404 office-suite to verified expense-tracker before shipping).
- Defect caught: office-suite endpoint 404 — replaced pre-PR by the agent's own curl check.
- Gap noted: README-facing entries often link github.com/theluckystrike/mcp-servers rather than the domain; MobinX and mcpHQ carry the domain in machine-readable form.
- Albertchamberlain/Awesome-MCP: viable next surface (toolchain installed, entry not yet written).

## npm publish check (2026-09-17, orchestrator)
- Dry-run publish of servers/invoice succeeds locally (16 files, @theluckystrike/mcp-invoice@0.22.0).
- Real publish: PUT https://registry.npmjs.org/@theluckystrike%2fmcp-invoice -> 404; `npm whoami` -> E401 Unauthorized.
- Conclusion: the authToken in ~/.npmrc is revoked/invalid. npm publish is HUMAN-GATED until a fresh token is created (https://www.npmjs.com/settings/theluckystrike/tokens/new -> granular token with publish permission, then replace the _authToken line in ~/.npmrc). After that, `cd servers/<name> && npm publish` for each of the 42 servers makes them npx-installable — the single missing piece of the blind-R3 winner shape (name=capability + one-command install).

## Albertchamberlain/Awesome-MCP PR #52 (appended)
- OPEN, MERGEABLE: https://github.com/Albertchamberlain/Awesome-MCP/pull/52
- Entry zovo-mcp-servers in data/catalog.yaml (+README line), cites live mcp.zovo.one/mcp/invoice.
- Blocking defect found and fixed: upstream main's catalog.yaml had unresolved conflict markers breaking YAML (baseline 6/6 tests failing); resolved keeping both sides (BulkPublish, ReadyAgents) -> validate OK 43 entries, 6/6 tests.
- CI: action_required (first-time-contributor gate, maintainer must Approve and run) — same state as #51/#50/#48/#42.
- 15/15 named hosted endpoints verified 200 with MCP initialize handshake; office-suite 404 excluded.
- Leftover: duplicate fork theluckystrike/Awesome-MCP-2 needs delete_repo scope to remove.
