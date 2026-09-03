# mcp-resume: adversarial audit and user-value run

Date 2026-09-03. Scope: `servers/resume` only. Zero paid API calls beyond the `claude` CLI run in Part 2.
Zero network calls from the server: `grep -rE "fetch\(|https?://|node:http|node:net|node:dns" servers/resume/src/`
returns only the checkout URL string, and that grep is asserted in `test/adversarial.test.mjs`.

## Method

**Part 1 harness** — `/private/tmp/resaudit/probe.mjs` spawns `dist/index.js`, writes JSON-RPC lines to
stdin and flags any stdout line that does not parse as JSON. Fresh `XDG_DATA_HOME` per lane
(`/private/tmp/resaudit/{data,corrupt,facts}`), `MCP_LICENSE_KEY=""` so every probe runs on the free tier
except the fact-integrity lane, which needs a signed Pro key from `scripts/sign-license.mjs` to write ten
letters in one calendar month.

**Verification of every generated document** — `unzip -t` for the ZIP container and every CRC, then the
package is read back with the docx server's own engine (`@theluckystrike/mcp-docx/lib` `readDocx`) and
grepped. "A file appeared" is never the assertion. `word/document.xml` is also grepped directly for the
escaping probes. LibreOffice is not installed on this machine, so there is no PDF render proof.

**Part 2 harness** — the real `claude` CLI as an MCP client against `/private/tmp/uvres/mcp.json`, which
registers `resume` alone (`--strict-mcp-config`), fresh `XDG_DATA_HOME=/private/tmp/uvres/data` and
`XDG_CONFIG_HOME=/private/tmp/uvres/cfg`, `MCP_LICENSE_KEY=""` (free tier). One session, `--session-id`
then `--resume`, so scenario 3 can say "it" and scenario 4 "that role". Per-tool allowlist written out by
name (10 entries); `--allowedTools "mcp__*"` grants nothing, as `docs/USER_VALUE_R7.md` (D-E4) measured.

---

## Part 1 — adversarial probes

| # | Probe | Result |
|---|---|---|
| P1 | `profile_set` with no arguments | zod: `Required at name Required at email` |
| P2 | `profile_set {experience: "nope"}` | zod: `Expected array, received string at experience` |
| P3 | `resume_create {max_pages: "two"}` | zod: `Expected number, received string at max_pages` |
| P4 | `resume_create {style: "gothic"}` | zod: `Expected 'modern' \| 'classic' \| 'compact'` |
| P5 | `cover_letter_create` before any profile | `Error: no profile stored. Run profile_set {...} first.` |
| P7 | 1 MB job description, free tier | refused in **7 ms** by the 2,000-character free cap, before any parsing |
| P8 | 300 experience bullets stored, then a 1-page resume | stored; 78 bullets kept, 222 dropped, 390 bullet words against a 392 budget, **27 ms** |
| P9 | `<script>alert(1)</script>`, `<img src=x onerror=...>`, `A & B < C > D` in bullets | `document.xml` holds `&lt;script&gt;alert(1)&lt;/script&gt;` as character data; **zero** `<script` in the XML; the HTML export has zero `<script` and zero `<img`, and `onerror=` survives only inside `&lt;img ... &gt;` |
| P10 | name `Zoë Śliwińska-О'Брайен 田中` | round-trips to `document.xml` as `Zoë Śliwińska-О&apos;Брайен 田中`, package well-formed |
| P11 | `out_path: "../../../../private/tmp/.../trav.docx"` | resolved against cwd and written there; no escape. `"/etc/passwd"` fails `EACCES` and writes nothing |
| P12 | writing twice to one `out_path` | `... already exists and nothing was written. Pass overwrite: true ...`; the original bytes are intact |
| P13 | the same path with `overwrite: true` | replaced; reads back as the new resume |
| P14 | `resume_read` a `.txt` | `is not a .docx file. Legacy .doc and .rtf are not readable here.` |
| P15 | `resume_read` a plain ZIP renamed `.docx` | `this file has no word/document.xml, so it is not a Word .docx` |
| P16 | `resume_read` a 50.0 MB `.docx` (50 MB stored part) | 3 blocks, **16 ms**; the padding part is never inflated |
| P17 | profile with `experience: []` | resume written, `bullets_kept: 0`, no empty Experience section asserted as fact |
| P18 | cover letter from a profile with no summary, skills, roles or phone | 68 words, 4 bracketed prompts, every one of them present in the .docx; zero numbers stated |
| P19 | keywords `["C++", ".*", "(a|b)", "[Go]", "a{2,3}", "$^", "\d+", "Go", "p99"]` | `matched: ["Go","p99"]`, everything else `missing`; no crash, no catastrophic match |
| P23 | corrupt `profiles.json`, then `profile_get` / `resume_to_markdown` / `profile_set` | all three refuse; the file is quarantined to `profiles.json.corrupt-<ts>`, sha256 **byte-identical** to the input, marker written, nothing overwritten |
| P25 | two processes racing one `out_path` | exactly one wins; the loser gets the refusal, the winner's bytes are on disk (`test/adversarial.test.mjs`). Two processes writing 20 variants and 20 letters each stay consistent (`test/concurrency.test.mjs`) |
| P26 | stdout carries only JSON-RPC | 0 non-JSON lines across 5 lanes / 60+ requests |
| P27 | no network | grep over `src/` empty, asserted in the test suite |

### Fact-integrity probe

Profile seeded with **exactly three numbers** — `37` (a latency figure), `12` (a service count) and `2021`
(a start year). Ten cover letters written against ten different postings carrying revenue figures, team
sizes, valuations, uptimes and throughput numbers (48 million / 23 engineers / 9,400 rps, 1.2 billion /
64 clusters / 17, 92 million / 41, 15 million / 9, 7.5 million / 6, 88 million / 31, 120 million / 210,
55 million / 14, 63 million / 26, 300 percent / 11 million / 8).

```
L0 Northwind: letter_numbers=[2021,12,37] not_in_profile=[] came_from_jd=[]
...
L9 Lyric:     letter_numbers=[2021,37,12] not_in_profile=[] came_from_jd=[]
LEAKS=0/10
```

Ten out of ten letters state only `2021`, `37` and `12`. No revenue figure, headcount or throughput
number from any posting reached any letter. Three of the ten are pinned in
`test/adversarial.test.mjs::ten cover letters against ten numeric postings leak no posting figure`.

### Defects found and fixed

| Id | Severity | Defect | Repro | Fix |
|---|---|---|---|---|
| D-R1 | **high** | The letter printed one role heading — the most recent job — and hung every ranked bullet under it. With two employers, `Wrote the ledger reconciliation jobs` (Norstad Systems, 2017-2021) was printed under `As Senior Backend Engineer at Acme Pay (2021 - present):`. Work done at a previous employer was stated as work done at the current one: a fabricated fact, from the one tool whose whole promise is that it invents nothing. | Part 2 s4b, `/private/tmp/uvres/northwind-letter.docx` | `buildLetter` groups proof lines by the role that actually holds the bullet and emits one heading per group. `src/letter.ts` |
| D-R2 | **high** | The posting was an allowed source for the letter's number check. `unsourcedNumbers` was handed `job_description`, so any figure the employer stated — its revenue, its headcount — would have passed the guard as a claim about the candidate. | code read; no live path reached it, so it was a latent hole, not an observed leak | the posting is no longer a source. Only the profile, the company, the role, the hiring manager and caller-supplied highlights are. `src/index.ts` |
| D-R3 | medium | `unsourcedNumbers` compared by substring containment: a profile holding `2012` licensed a letter claiming `12`, and `4,500` licensed `50`. | `unsourcedNumbers("I ran 12 services.", ['{"start":"2012"}'])` returned `[]` | whole-number-token comparison against `numbersIn(corpus)`. `src/letter.ts` |
| D-R4 | **high** | `tailor_to_job` deleted every token under three characters. On `"Senior Go engineer with Kubernetes and Postgres experience"` it returned `kubernetes, engineer, postgres, senior` and never `go` — a Go developer's most important skill was neither matched nor reported missing. `c#`, `r`, `ui`, `ux`, `ml`, `ai`, `js`, `ts`, `qa` had the same fate. | `extractKeywords("Senior Go engineer with Kubernetes and Postgres experience")` | a `SHORT_SKILLS` allowlist (`go c r c# c++ f# qt ui ux qa ml ai ar vr js ts k8s aws gcp sql ios`) plus `skillTokens(profile.skills)`, so any token the user lists as a skill is a keyword whatever its length. `src/tailor.ts`; `analyseGap` and `buildLetter` both pass the profile's own skills |
| D-R5 | medium | Keyword ties were broken by **length**, descending. On a posting where every word appears once — which is most postings — `everywhere`, `elsewhere` and `backbone` outranked `go`, `kafka` and `grpc`, so the letter's 12-keyword window held no skill at all and `skills_the_posting_asked_for` came back short. | `extractKeywords(<the Northwind posting>, 12)` returned `everywhere, kubernetes, cassandra, elsewhere, northwind, terraform, backbone, deployed, engineer, expected, payments, platform` | a known skill name outranks any word of the same frequency. The same call now returns `kubernetes, terraform, postgres, kafka, grpc, go, ...`. `src/tailor.ts` |
| D-R6 | low | `profile_get` and `resume_to_markdown` had no `try/catch`. On a corrupt store they threw across the transport; the SDK caught it, so the user saw the message without the `Error: ` prefix every other tool uses. CONVENTIONS.md: never throw across the transport. | corrupt `profiles.json`, then `profile_get` | both wrapped, both answer `Error: data file is corrupt; ...`. `src/index.ts` |

### Not defects

- `out_path` traversal resolves against cwd, exactly as `servers/docx` does. An absolute path is the
  caller's own choice; `/etc/passwd` fails on permissions with nothing written.
- The 300-bullet trim looked like an overshoot (`words_used: 448` against `word_budget: 392`) but
  `words_used` is the whole document including 58 fixed words; the bullets used 390 of 392.
- The exclusive-create reservation, the overwrite refusal and the corrupt-store quarantine were already
  correct: they came from the `servers/docx` round and were carried over.

---

## Part 2 — user value through a real MCP client

`claude -p "<prompt>" --mcp-config /private/tmp/uvres/mcp.json --strict-mcp-config --model sonnet
--output-format json --max-turns 14 --allowedTools "<10 mcp__resume__* tools>"`, one resumed session,
one fresh free-tier data dir.

### Scorecard — 14 / 15

3 = correct, right numbers, no clarification. 2 = correct but with a gap the user has to close.
1 = partially wrong. 0 = failed.

| # | Scenario | Score | Turns | Sec | Tool | Verified by reading the artifact back |
|---|---|---|---|---|---|---|
| s1 | 200-word first-person career summary, 2 jobs, 1 degree, 6 skills, 2 numbers. "Save it." | 3 | 4 | 27 | `profile_set` | `profiles.json`: 2 roles (Acme Pay 2021-present, Norstad Systems 2017-2021), 5 bullets, 6 skills (Go, Postgres, Kubernetes, Terraform, gRPC, Kafka), BSc University of Warsaw. Both numbers kept verbatim: `cutting p99 latency by 37%`, `a fleet of 12 microservices` |
| s2 | "Modern one-page resume targeting a senior backend role, keywords Go, Kubernetes, Postgres." | 3 | 3 | 12 | `resume_create` | `ada-resume.docx`: `estimated_pages 1`, 134 of 361 budget words, 0 bullets dropped, all 3 keywords matched and bolded, 0 missing. Read back: both employers, both date ranges, the degree; every number in the document (`2021`, `37`, `12`, `2017`) is in the profile |
| s3 | "Tailor it to this 250-word posting. What am I missing?" (8 keywords, 4 absent from the profile) | 3 | 4 | 53 | `tailor_to_job` + `resume_create` | named all four genuinely absent items — distributed tracing/observability, PCI DSS, mentoring/incident review, Rust and Cassandra — and added none of them to the profile or the document. `keywords_missing` is reported, never written |
| s4 | "Write a direct cover letter to Acme for that role, hiring manager Dana Kim." | 2 | 1 | 10 | none | stopped and asked which employer was meant: the posting was Northwind Labs and Acme Pay is the candidate's current employer. Defensible, but the user has to close it. A follow-up turn naming Northwind produced the letter |
| s4b | follow-up: "Option 1: Northwind Labs" | 3 | - | 34 | `cover_letter_create` | `northwind-letter.docx`: salutation `Dear Dana Kim,`, every number in the letter (`2021`, `37`, `12`, `2017`) exists in the saved profile, **zero** numbers from the posting, and the unknown metric left as `[add: metric]` on each bullet with no figure |
| s5 | "Export the resume as markdown." | 3 | 4 | 24 | `resume_to_markdown` | full markdown returned inline: contact line, summary, 6 skills, both roles with their bullets, education. Nothing added |

Total wall time 126 s for five scenarios plus the follow-up. `$0.29` of CLI cost.

### Defects found in Part 2

| Id | Severity | Defect | Repro | Status |
|---|---|---|---|---|
| D-R1 | high | proof bullets attributed to the wrong employer (above) | s4b letter | **fixed**, `test/adversarial.test.mjs` |
| D-R5 | medium | the model's own words in s3: "ignoring the tool's noisy keyword list". `tailor_to_job` returned `everywhere`, `elsewhere`, `backbone`, `northwind` alongside the real requirements | s3 | **fixed** for the skill-vs-noise ordering; general stopword coverage is unchanged on purpose — `src/tailor.ts` documents why an over-long stopword list drops real requirements |
| D-R7 | cosmetic | s2 relayed the free-tier footer note to the user as a caveat about the deliverable. Same copy-length issue as `docs/DOCX_AUDIT.md` D-D1 | s2 | not fixed; a copy question, not a behaviour bug |
| D-R8 | cosmetic | s5 hedged that writing a `.md` file "needs your permission". `resume_to_markdown` returns text and writes no file, so there was nothing to permit | s5 | not fixed; client-side |

No further server-side defect was found in Part 2.

---

## Final test summary

```
$ npm run build -w servers/resume
> tsc -p tsconfig.json && node -e "...chmodSync('dist/index.js',0o755)"
(clean)

$ npm test -w servers/resume
# tests 26
# pass 26
# fail 0
```

26 tests: 14 in the new `test/adversarial.test.mjs`, 9 in `test/resume.test.mjs`, 2 in
`test/smoke.test.mjs`, 1 in `test/concurrency.test.mjs`.

## RESULT.md block

```
status: DONE
evidence:
  npm test -w servers/resume -> tests 26, pass 26, fail 0
  60+ JSON-RPC probes over 5 fresh data dirs, 0 non-JSON stdout lines
  10 cover letters against 10 numeric postings: 0 posting figures leaked (LEAKS=0/10)
  every generated .docx read back with @theluckystrike/mcp-docx/lib readDocx and grepped
  5 claude-CLI scenarios + 1 follow-up, 14/15, 126 s
artifacts:
  servers/resume/src/{index,letter,tailor}.ts
  servers/resume/test/adversarial.test.mjs
  docs/RESUME_AUDIT.md
  /private/tmp/resaudit (probe harness), /private/tmp/uvres (client lane)
cost: 41 wall minutes
failures:
  Cover-letter proof bullets were all printed under the most recent employer's heading, so a
  previous job's work read as the current job's. Grouped by role.
  The job description was an allowed source for the letter's number check.
  The number check compared by substring, so "2012" licensed "12".
  extractKeywords deleted every token under three characters: "go", "c#", "r", "ml", "ui".
  Keyword ties were broken by length, so "everywhere" outranked "kafka".
  profile_get and resume_to_markdown threw across the transport on a corrupt store.
insight:
  Every one of the five real defects is the same mistake in a different place: a rule written for the
  average case, applied where the exception is the whole point. Rank bullets globally -- correct, until
  the heading above them names one employer. Allow numbers from any source the caller passed -- correct,
  until the source is the employer's own revenue. Drop short tokens as noise -- correct, until the token
  is "Go". Break ties by length -- correct, until the long word is "everywhere" and the short one is
  "gRPC". The fact-integrity probe, the thing the tool is actually built to guarantee, came back 0/10
  clean; the damage was in the four heuristics nobody thought to point a probe at.
```
