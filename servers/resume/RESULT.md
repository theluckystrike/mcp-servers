status: DONE

evidence:
```
$ npm run build -w servers/docx && npm run build -w servers/resume
> @theluckystrike/mcp-docx@0.3.2 build
> tsc -p tsconfig.json --declaration && node -e "...chmodSync('dist/index.js',0o755)"
> @theluckystrike/mcp-resume@0.4.0 build
> tsc -p tsconfig.json && node -e "...chmodSync('dist/index.js',0o755)"
(clean, 2 s, no output)

$ npm test -w servers/docx -w servers/resume
> @theluckystrike/mcp-docx@0.3.2 test
# tests 22   # pass 22   # fail 0
> @theluckystrike/mcp-resume@0.4.0 test
# tests 12   # pass 12   # fail 0
(2 s)

$ node scripts/validate.mjs
validation db: /Users/mike/mcp-servers/data/validation.json run 50: 184/184
(docx 16/16 unchanged after the package.json and lib.ts edits)
```

Resume test breakdown (12 cases, 3 files):
- `test/resume.test.mjs` (9): profile round trip field-for-field plus variant isolation; word-bounded
  keyword matching ("go" does not match "Google") with matched/missing/bolding and no double-wrapping;
  page budget (kept words <= budget, every role keeps its first bullet, kept+dropped accounts for all 6
  bullets, nothing trimmed at 3 pages, a keyword bullet outranks a later one); "every number in the letter
  exists in the profile" with a positive control that the checker can fail (`"I saved them 42 million"` ->
  `["42"]`); bracketed prompts on a thin profile and `[add: metric]` on a bullet with no figure;
  unsupported highlight bracketed not asserted; tailor matched/missing/coverage plus a rewrite proved to be
  a pure reordering (same multiset of words as the source bullet); markdown export; blocks-to-profile read.
- `test/smoke.test.mjs` (2): stdio initialize -> tools/list (10 tools) -> resources/list -> prompts/list ->
  profile_set -> profile_get -> resources/read -> resume_create -> the .docx read back with
  `@theluckystrike/mcp-docx/lib` `readDocx` asserting "Ada Rowe", "Acme Pay", "University of Warsaw" present
  and the missing keyword "Rust" absent -> resume_to_markdown -> resume_to_html -> resume_read ->
  cover_letter_create (letter .docx read back, verbatim bullet asserted, every digit run traced) ->
  tailor_to_job. Second case: free tier refuses `classic`, refuses a variant, refuses a 2,001-character
  posting, allows exactly 3 cover letters and refuses the 4th; the same data dir with a signed Pro key
  then accepts the 4th letter, `classic`, a long posting and a variant. stdout carried no non-JSON line.
- `test/concurrency.test.mjs` (1): two processes on one data dir write 20 profile variants concurrently --
  all 20 present in profiles.json and each holds its own data -- then write 20 cover letters concurrently:
  20 records, 20 distinct paths, all 20 files on disk.

artifacts:
- servers/resume/ (src/index.ts, src/profile.ts, src/render.ts, src/letter.ts, src/tailor.ts, src/read.ts;
  test/resume.test.mjs, test/smoke.test.mjs, test/concurrency.test.mjs; package.json, tsconfig.json,
  README.md, LICENSE, server.json, server.mcpb.json, smithery.yaml, glama.json, Dockerfile,
  llms-install.md, RESULT.md)
- servers/docx/src/lib.ts (the engine as a public API) and servers/docx/package.json ("exports" plus
  `--declaration` on the build so the subpath ships types)
- assets/resume-logo.png (400x400, "CV", #6E2233)
1,882 lines across src and test.

cost: 43 wall minutes.

failures:
1. `"exports"` alone would have published a subpath with no types: the docx tsconfig sets
   `"declaration": false` and tsconfig.json was outside the write scope. Fixed inside package.json by
   putting `--declaration` on the build script -- a CLI flag overrides tsconfig -- so `dist/lib.d.ts` exists
   for the `"types"` condition. docx's own 22 tests stayed green with declaration emit on.
2. The first keyword extractor dropped a unigram once it appeared inside a surviving bigram. On a short
   posting that deleted "postgresql" and "rust" in favour of the junk bigrams "postgresql required" and
   "essential rust", and coverage against an unchanged profile fell from 44% to 11%. Unigrams are now always
   kept, bigrams only when the posting repeats them, and "required/essential/must/core/preferred" went into
   the stopword list.
3. `suggestRewrites` tested "does the bullet already lead with the keyword" against the first 60 characters,
   which is a truncation, not a clause: a keyword straddling character 60 read as absent and a keyword in a
   short single-clause bullet read as present. Now it tests clause 0.
4. The first concurrency run passed on variants and failed on letters -- `cover_letter_create` reads the
   default profile and the test had only written variants. Test corrected, not the code: a variant is not a
   default profile and must not silently stand in for one.

insight:
The page budget is not the constraint people assume. Measured on the fixture profile (4 roles' worth of
bullets, 6 bullets, 89 words of bullet text): at `max_pages: 1` the fixed content -- contact line, summary,
4 skills, 2 role headers, education, certifications, languages, headings -- already consumes 66 of the 450
words, leaving 384 for bullets, and nothing gets trimmed. Trimming only starts biting at about 12 bullets.
The real one-page failure mode is the opposite of the one the tool was built for: profiles are too thin,
not too fat, and the honest output is `[add: metric]` rather than a shorter list. That is also why the
letter's number check has never fired in testing on real input -- there are almost no numbers in a raw
profile to begin with, which is the actual gap a resume tool should be telling its user about.
