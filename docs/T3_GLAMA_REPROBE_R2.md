# T3 — Glama Re-probe R2 (post 16 short-slug registry publishes)

STATUS: complete

## 1. Re-probe all 42 Glama pages

Method (validated in T6): Chrome UA, `-m 20`, `-o /dev/null -w "%{http_code} %{size_download}"`.
404 at exactly 52 bytes = not indexed; 200 at 260KB+ = indexed.

```
$ for d in <42 dirs>; do curl -A "<Chrome UA>" -sS -m 20 -o /dev/null -w "%{http_code} %{size_download}" https://glama.ai/mcp/servers/theluckystrike/mcp-$d; done
amortization         404 52        job-card             200 308654
asset-register       404 52        kanban               404 52
bank-statement       404 52        maintenance-log      200 261426
barcode              404 52        mileage-log          200 281930
bill-of-sale         200 312481    office-suite         200 1828493
billing-docs         404 52        packing-list         200 369182
calendar             404 52        pdf                  404 52
cash-book            404 52        per-diem             404 52
catalogue            404 52        petty-cash           404 52
change-order         404 52        price-tracker        404 52
checklist            200 383847    quotes               404 52
clauses              404 52        recurring            404 52
credit-note          200 306895    resume               404 52
currency             404 52        service-agreement    200 282496
delivery-schedule    404 52        spreadsheet          404 52
deposits             404 52        statement-of-account 200 295026
docx                 404 52        supplier-list        200 287555
dunning-letters      200 308951    time-tracker         404 52
expense-tracker      404 52        timezone             404 52
image                404 52        work-order           404 52
invoice              404 52        zip                  404 52
--- controls ---
mcp-doesnotexist     404 52        (negative control, correct)
mcp-bill-of-sale     200 312481    (positive control, correct)
```

**Indexed: 12 of 42 — identical to the R1/R2 baseline.** The 12 indexed are exactly:
bill-of-sale, checklist, credit-note, dunning-letters, job-card, maintenance-log,
mileage-log, office-suite, packing-list, service-agreement, statement-of-account,
supplier-list.

**Newly indexed since baseline: 0.** The 16 short-slug registry publishes (2026-09-18,
version 0.22.1) have still not been picked up by Glama's crawler. Glama's crawl schedule
remains the binding delay; the registry's own index lag is 1-3 min and is not the constraint.

## 2. Newly indexed dirs + badge verification

None. No dir moved from 404 to 200 since the 12-dir baseline, so there is no badge SVG to
fetch and verify for any newly indexed repo. (The 12 already-indexed dirs all carry valid
badges from prior rounds; no change this round.)

## 3. Badge additions to READMEs

None. Per task rule: "If none, do NOT commit anything and say so." No README was modified
and no commit was made this round.

## 4. Registry short-slug liveness check (16 slugs)

```
$ for s in <16 slugs>; do curl -sS -m 20 -o /dev/null -w "%{http_code}" https://registry.modelcontextprotocol.io/v0.1/servers/io.github.theluckystrike%2F$s/versions/latest; done
bank-statement 200   barcode 200   billing-docs 200   clauses 200
currency 200        docx 200       expense-tracker 200 image 200
kanban 200          office-suite 200 pdf 200         quotes 200
recurring 200       resume 200     timezone 200      zip 200
```

**All 16 short-slug registry entries still live (200).** No registry regression.

## 5. Commit + push

No commit. No newly indexed dirs -> no badge lines to add -> nothing to push. Stated
explicitly per task rule.

## RESULT

```yaml
task: T3 glama re-probe R2
status: complete
estate: /Users/mike/mcp-servers

glama:
  probe_method: "curl -m 20 -A <Chrome UA> -o /dev/null -w '%{http_code} %{size_download}' https://glama.ai/mcp/servers/theluckystrike/mcp-<dir>"
  indexed_baseline: 12
  indexed_now: 12
  newly_indexed: 0
  changed_vs_baseline: false
  not_indexed_response: "404, exactly 52 bytes"
  indexed_response: "200, 261KB-1.8MB"
  negative_control: "mcp-doesnotexist -> 404 52 (correct)"
  positive_control: "mcp-bill-of-sale -> 200 312481 (correct)"
  blocked_on: "Glama crawler schedule; 16 short slugs published 2026-09-18 not yet crawled"

badges:
  newly_indexed_dirs: []
  badges_added_this_round: 0
  badges_now: 12   # unchanged, all pre-existing valid badges

registry:
  short_slugs_checked: 16
  live: 16/16
  version: 0.22.1

git:
  commit_made: false
  reason: "no newly indexed dirs -> no badge lines to add -> nothing to commit/push"
  pushed: false

cost_usd: 0
accounts_created: 0
failures: []
insight: "Glama's crawler has still not indexed any of the 16 short-slug registry entries
  published 2026-09-18 (probe ~same day). Indexed count is frozen at 12/42. The registry
  entries are all live (16/16, 200), so the delay is purely Glama's crawl cadence, not a
  registry or manifest problem. Re-probe again in 24-72h; when any of the 16 moves to 200,
  fetch its /badges/score.svg (>4000 bytes, no 'not listed'), add the badge line after the
  '# mcp-<repo>' H1, and commit 'sprint 42 T3: glama badges for newly indexed mirrors'."
```
