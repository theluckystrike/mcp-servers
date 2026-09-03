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
