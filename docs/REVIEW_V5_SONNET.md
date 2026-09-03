# REVIEW_V5_SONNET

Scope: servers/resume/src/*.ts, servers/recurring/src/*.ts, servers/clauses/src/*.ts.

1. servers/recurring/src/period.ts:114-136 (occurrencesBetween, nextOccurrence)
   Severity: P1
   Bug: the k-loop always starts at k=0 (rule.start_date) and walks forward one occurrence at a time up to MAX_OCCURRENCES=5000 before it can reach `lower`/`after`. A short-interval schedule old enough that more than 5000 occurrences separate start_date from today exhausts the cap before ever reaching the present, so it silently returns zero occurrences / next_due null, even though the schedule is active. Consumers (schedule_upcoming, forecast, invoice_generate_due via dueRows, schedule_list next_due) all show nothing due, with no error.
   Fix: compute the starting k analytically from `lower` (e.g. via addDays/addMonths inverse) instead of scanning from k=0, or raise an explicit error when MAX_OCCURRENCES is hit without reaching upper.
   Trigger: a daily schedule ({days:1}) created 2010-01-01 (>5000 days before 2026).
   Verified: `node -e 'import("./servers/recurring/dist/period.js").then(m=>{const rule={every:{days:1},start_date:"2010-01-01"};console.log(m.occurrencesBetween(rule,"2026-09-05","2026-09-01").length, m.nextOccurrence(rule,"2026-09-01"))})'` -> `0 null`.

2. servers/resume/src/render.ts:88-101 (scoreBullets) and servers/resume/src/letter.ts:210-219 (rankBullets)
   Severity: P1
   Bug: `recency = experience.length - ei` scores experience[0] as the most recent role. Nothing in profile_set's schema/description (servers/resume/src/index.ts:112-118) tells the caller experience must be entered most-recent-first. Entering roles chronologically (oldest first, the natural order when filling a form) silently inverts trimming and cover-letter-bullet priority: page-budget trimming and rankBullets keep the oldest job's bullets and drop the current job's.
   Fix: sort experience by parsed start/end date at scoring time instead of trusting array order, or validate/reorder in profile_set.
   Trigger: profile.experience = [{oldest role, long bullet}, {current role, long bullet}], trimToPages with a tight budget.
   Verified: node one-liner against dist/render.js trimToPages with two roles and a 12-word budget kept only the first array entry's bullet (the "older" one in the test), confirming array-order dependence rather than date-based recency.

3. servers/clauses/src/library.ts:149-179 (parseMarkdown)
   Severity: P2
   Bug: metadata lines are recognized by `/^([a-z_]+):/` against HEADER_KEYS with no separating blank line required from the title. A clause body whose first line happens to start with "note:", "category:", "tags:", "variables:", "jurisdiction:" or "language:" (e.g. a body opening with "Note: time is of the essence.") is silently consumed into `meta` and dropped from `body`, losing content on clause_import and on any manual/round-trip markdown edit.
   Fix: only treat leading lines as metadata if separated from body prose by requiring the metadata block, and warn/reject when a recognized key's "value" looks like a sentence rather than a short field (or require an explicit marker before metadata).
   Trigger: `"## Payment Terms\n\nnote: Client must pay within 30 days of invoice date.\n\nLate payments accrue interest.\n"`.
   Verified: `node -e 'import("./servers/clauses/dist/library.js").then(m=>console.log(m.parseMarkdown(...)))'` -> body is `"Late payments accrue interest."`, the "note:" sentence is captured as `note` metadata and vanishes from the printed clause body.

4. servers/clauses/src/library.ts:92-127 (search)
   Severity: P2
   Bug: title/body matching uses plain substring containment (`title.includes(t)`, `body.split(t).length-1`) with no word-boundary check (unlike resume's keywordRegex). A short query term matches inside unrelated words, so a clause that never contains the term as a whole word can outrank or appear alongside one that does.
   Fix: use a word-boundary regex (same approach as servers/resume/src/render.ts:keywordRegex) for both title and body scoring.
   Trigger: search(clauses, "art") against a clause titled "Party Definitions" (body mentions "party"/"contract", no literal "art").
   Verified: node one-liner against dist/library.js search() scored "Party Definitions" 44 (title.includes("art") is true because "party" contains "art", plus substring hits on "contract") ahead of a clause that actually is about "art".

5. servers/clauses/src/index.ts:111-116 (findClause) and servers/recurring/src/store.ts:90-94 (findSchedule)
   Severity: P2
   Bug: both resolve an id/name reference with a final fallback of `.find(x => x.title/client.includes(needle))`, returning the first array match with no ambiguity check. Two records that both contain the same substring (e.g. clauses "Payment Terms" and "Payment Terms (Retainer)", or schedules for "Acme Inc" and "Acme LLC") silently resolve to whichever is first in storage order, so clause_update/contract_assemble or schedule_pause/schedule_delete/schedule_skip can act on the wrong record with no warning.
   Fix: when more than one candidate matches the substring, return an error listing the candidates instead of picking one.
   Verified: by inspection of both identical patterns; both functions are `find` chains ending in `.includes(needle)` with no count-of-matches check.

6. servers/resume/src/letter.ts:42-56 (traceHighlight)
   Severity: P3
   Bug: a caller-supplied highlight is accepted as "traced" if it shares >=60% of its 3+ char tokens with some real profile text, even when the actual claim differs (different metric, different subject). The letter always prints the real profile source text (not the caller's claim), so no fabrication reaches the document, but the letter can silently substitute a different real achievement for the one the caller asked to lead with, with no indication to the caller that a different bullet was used.
   Fix: require the overlap set to include at least one shared non-generic token (a number, a proper noun, or a skill name) in addition to the 0.6 ratio, or lower-bound to exact/near-exact phrase match.
   Trigger: highlight `"Reduced infrastructure costs by 90 percent using automated deployment pipelines"` vs profile bullet `"Reduced deployment time by 40 percent using automated pipelines"`.
   Verified: `node -e` against dist/letter.js traceHighlight -> `{ ok: true, source: 'Reduced deployment time by 40 percent using automated pipelines' }`.

7. servers/recurring/src/index.ts:499-517 (invoice_generate_due duplicate detection) interacting with finding 5
   Severity: P3
   Note: the cross-schedule duplicate warning at index.ts:521-527 keys on `client.trim().toLowerCase()`, which is a different (and more careful) normalization than findSchedule's substring fallback; the two code paths use inconsistent notions of "same client," so a duplicate-invoice warning can fire (or fail to fire) independently of which schedule a fuzzy `id` argument actually resolved to via finding 5. Documented here as a secondary consequence, not independently reproduced.

Verdict: two P1 defects can silently under-report or misprioritize real, active data (a long-lived short-interval recurring schedule going invisible to billing/forecast tools, and cover-letter/resume content trimming that inverts on non-newest-first experience arrays) without any error surfaced to the user. The clauses server has two P2 correctness bugs (markdown import can silently drop body text; keyword search ignores word boundaries) plus a shared P2 ambiguous-reference-resolution pattern across both the clauses and recurring servers.

## Review fixes

1. P1 recurring occurrencesBetween/nextOccurrence (servers/recurring/src/period.ts:119-183): added
   `estimateStartK` (period.ts:119-135), an analytic k estimate (exact minus a 1-step safety margin for
   day-stepped rules; minus a 2-step margin for month-stepped rules, to absorb the day-of-month clamp).
   `occurrencesBetween` (period.ts:146-162) and `nextOccurrence` (period.ts:167-176) now start their bounded
   scan at `estimateStartK(rule, lower/after)` instead of k=0, so a schedule far older than MAX_OCCURRENCES
   still resolves within the unchanged per-run cap. Test:
   servers/recurring/test/period.test.mjs "a schedule far older than MAX_OCCURRENCES still reports occurrences
   and next_due today" (daily since 2010, monthly since 1990, weekly since 2005).

2. P1 resume role ordering: `sortExperienceNewestFirst` (servers/resume/src/profile.ts:47-53, with the
   `roleDateKey` free-text date parser at profile.ts:15-36) sorts an open role (no `end`) first, then by `end`
   descending, then by `start` descending. `profile_set` (servers/resume/src/index.ts:215) now stores
   `sortExperienceNewestFirst(...)` instead of the caller's raw array order, and the `experience` schema field
   (index.ts:178-179) documents the enforced ordering. `scoreBullets` (servers/resume/src/render.ts:80-86) and
   `rankBullets` (servers/resume/src/letter.ts:208-212) are documented as trusting that stored order for
   recency. Tests: servers/resume/test/resume.test.mjs "sortExperienceNewestFirst: an open role beats every
   dated role, then end desc, then start desc" and "page trimming keeps the CURRENT role's bullets even when
   the caller entered experience oldest-first"; servers/resume/test/smoke.test.mjs "profile_set stores
   experience newest-first regardless of the order the caller sent it in" (stdio-level, oldest-first input).

3. P2 clauses clause_import markdown (servers/clauses/src/library.ts:177-190 `looksLikeMetadataValue`, wired
   into `parseMarkdown` at library.ts:203): a `key: value` line right after the title is metadata only if the
   key is recognised AND the value is short and not sentence-shaped (<=8 words, and not ending in `.`/`!`/`?`
   with more than 3 words). A body opening with "note: Client must pay within 30 days of invoice date." now
   stays in the body; a real short metadata line ("note: generic template, not legal advice") is still parsed.
   Test: servers/clauses/test/library.test.mjs "markdown import keeps body prose that opens with a
   metadata-like word (Review V5 P2)".

4. P2 clause_search word boundaries (servers/clauses/src/library.ts:87-99 `wordBoundaryRegex`/
   `countWordMatches`, applied in `search` at library.ts:111-152): title and body terms are scored on a real
   word boundary first (title exact 100, title word 60, body word hits 4 each up to 5); plain substring
   containment is kept only as a fallback at a fraction of the weight (title 5, body 1 per hit) so it never
   outranks a real match. Test: servers/clauses/test/library.test.mjs "search matches on word boundaries:
   \"fee\" does not match inside \"coffee\"" (also covers "art" vs "party"/"contract").

5. P2 ambiguous partial-match resolution, both servers:
   - servers/clauses/src/index.ts:111-133 `findClause`: an exact id or exact title still wins outright; the
     partial-title fallback now throws (candidate list, id + title) when more than one clause matches. Test:
     servers/clauses/test/smoke.test.mjs "clause_get refuses an ambiguous partial title with the candidate
     list; an exact match still wins".
   - servers/recurring/src/store.ts:92-115 `findSchedule`: same shape -- exact id/exact client wins outright,
     the partial-client fallback throws (candidate list, id + client) on more than one match. Test:
     servers/recurring/test/smoke.test.mjs "schedule_get refuses an ambiguous partial client match with the
     candidate list; an exact match still wins".
   Both throw sites are already inside the existing `try { ... } catch (e) { return fail(...) }` wrapping at
   every call site, so no caller needed a signature change.

Not addressed in this pass (out of the P1/P2 scope given): P3 findings 6 (letter.ts traceHighlight overlap
threshold) and 7 (invoice_generate_due duplicate-detection normalization vs finding 5) from the original review.

Suite totals after the fixes (`node --test test/*.test.mjs` in each server):
- servers/recurring: `# tests 34 / # pass 33 / # fail 0 / # cancelled 0 / # skipped 1 / # todo 0`
- servers/resume: `# tests 35 / # pass 34 / # fail 0 / # cancelled 0 / # skipped 1 / # todo 0`
- servers/clauses: `# tests 34 / # pass 33 / # fail 0 / # cancelled 0 / # skipped 1 / # todo 0`

`node scripts/gen-spec.mjs` regenerated all eleven SPEC.md files cleanly (clauses tools=12, recurring
tools=14, resume tools=10, unchanged from before this pass). `node scripts/validate.mjs` stays green:
`validation db: run 50: 247/247`.
