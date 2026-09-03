# mcp-clauses: adversarial audit and user-value run

Date 2026-09-03. Scope: `servers/clauses` only. Zero paid API calls beyond the Part 2 `claude` CLI run.
Zero network calls from the server itself: `grep -rE "fetch\(|https?://|node:http|node:net|node:dns" src/`
returns nothing, and that grep is asserted in `test/adversarial.test.mjs`.

## Method

**Part 1 harness** -- `/private/tmp/clausesaudit/probe.mjs` spawns `dist/index.js`, writes JSON-RPC lines to
stdin and flags every stdout line that does not parse as JSON. One fresh `XDG_DATA_HOME` per lane
(`data` free, `pdata` Pro, `sdata` starter integrity, `cdata` corrupt store), `MCP_LICENSE_KEY=""` for the
free lanes and a key from `scripts/sign-license.mjs clauses` for the Pro lanes. Every generated `.docx` is
read back with `unzip -p <file> word/document.xml`, never asserted on the tool's own answer.

One probe was dropped: `clause_export` to `/etc/passwd` **hangs this sandbox** rather than returning
`EACCES`, so it says nothing about the server. The traversal and overwrite probes cover the same ground.

**Part 2 harness** -- the real `claude` CLI as an MCP client against `/private/tmp/uvc31/mcp.json`, which
registers `clauses` alone (`--strict-mcp-config`), fresh `XDG_DATA_HOME=/private/tmp/uvc31/data` and
`XDG_CONFIG_HOME=/private/tmp/uvc31/cfg`, `MCP_LICENSE_KEY=""` (free tier). One session,
`--session-id` then `--resume`, so scenario 3 can say "that contract". Per-tool allowlist written out by
name (12 entries, every tool the server exposes) -- `--allowedTools "mcp__*"` grants nothing, as
`docs/USER_VALUE_R7.md` D-E4 already measured.

---

## Part 1 -- adversarial probes

| # | Probe | Before | Fixed | After |
|---|---|---|---|---|
| 1 | `clause_add` with no arguments | PASS | - | zod: `Required at title Required at body Required at category` |
| 2 | `clause_add {body: 12}` | PASS | - | zod: `Expected string, received number at body` |
| 3 | `contract_assemble` with neither ids nor categories | PASS | - | `Error: pass clause_ids or categories` |
| 4 | `contract_assemble {clause_ids:["nope-xyz"]}` | PASS | - | `Error: no clause matches "nope-xyz"`, nothing written |
| 5 | `variables_list` with an unknown id | PASS | - | same refusal |
| 6 | 1 MB clause body, added then assembled | PASS | - | added in 11 ms, assembled to a well-formed 11 KB `.docx` in 61 ms |
| 7 | `category` of 10 000 characters | **FAIL (stored verbatim)** | yes | capped at 40 characters; the whole 10 KB string used to be echoed in every `clause_list` and in `clauses://categories` |
| 8 | body carrying `<script>`, `onerror=`, `]]>` | PASS | - | `&lt;script&gt;alert(1)&lt;/script&gt;` as character data; **zero** raw `<script` in `document.xml`. A markdown assembly keeps the text verbatim, which is what a `.md` file is |
| 9 | duplicate clause title | PASS | - | `a clause titled "Script Clause" already exists; use clause_update, or give a different title` |
| 10 | variables with regex metacharacters and nested braces (`{{a.b-c}}`, `{{{nested}}}`, `{{ spaced }}`, value `$1 & <x>`) | PASS | - | all three filled; the literal `$1` survives the replacer (not read as a capture group), `&`/`<` escaped, no surviving `{{` |
| 11 | `out_path` traversal `../../../../private/tmp/...` | PASS | - | resolved against cwd and written there; no escape. An absolute path is the caller's own choice, as with any file tool |
| 12 | `contract_assemble` twice onto the same `out_path` | **FAIL (silent clobber)** | yes | `... already exists and nothing was written. Pass overwrite: true to replace it, or give a different out_path.` |
| 13 | the same path with `overwrite: true` | n/a | new | replaced; the first document's bytes are gone only when asked for |
| 14 | `clause_export` onto an existing file | **FAIL (silent clobber)** | yes | destroyed a file holding `ORIGINAL KEEP`. Now refused with the same message; `overwrite: true` replaces it |
| 15 | `clause_export` traversal | PASS | - | resolved against cwd, written there |
| 16 | `clause_import` of a markdown file with no `##` heading | PASS | - | `Error: no clauses found in ...` |
| 17 | `clause_import` of a heading with no body | PASS | - | same refusal, nothing added |
| 18 | `clause_import` of a missing `.json` file (free tier) | **FAIL (wrong answer)** | yes | answered with the Pro upsell for a file that does not exist. Now `Error: no such file: <path>` |
| 19 | `clause_import` of JSON with `__proto__` / `constructor.prototype` keys (Pro) | PASS | - | 2 clauses added, `{}.polluted` and `{}.p2` both `undefined`; `parseClauseJson` copies named fields only |
| 20 | `clause_import` of malformed JSON | PASS | - | the parse error is returned, nothing written |
| 21 | `clause_import` of JSON with wrong field types | PASS | - | `every clause needs a title and a body` |
| 22 | 500 own clauses (Pro) | PASS | - | 500 adds in **449 ms**, 525 clauses, 525 unique ids, search still ranks `late-fees` first for "payment late" |
| 23 | 60-clause assembly (Pro) | PASS | - | one `.docx`, no surviving `{{` |
| 24 | corrupt `data.json`, then `clause_add` and `clause_list` | PASS | - | quarantined to `data.json.corrupt-<ts>`, sha256 **byte-identical** to the input, marker written, both calls refuse, nothing overwritten |
| 25 | two processes on one data dir, 24 concurrent adds then 24 concurrent updates | PASS | - | 49 clauses, no duplicate ids, one history entry each (`test/concurrency.test.mjs`) |
| 26 | stdout carries only JSON-RPC | PASS | - | 0 non-JSON lines across 4 lanes; asserted in `test/adversarial.test.mjs` |
| 27 | no network | PASS | - | grep over `src/` empty; asserted in the same test |
| 28 | starter set integrity | PASS | - | exactly **25** clauses, `own = 0`, every one `starter: true` with `note: "generic template, not legal advice"`, 23 of 25 carry at least one variable -- the two without are `entire-agreement` and `severability`, which are pure boilerplate with no per-client fact |

### The two that mattered

**Silent overwrite (12/14).** `contract_assemble` treated an explicit `out_path` as "the caller's to
overwrite" and `clause_export` ended in a bare `writeFileSync`. Assembling a second contract onto the path
of a signed one destroyed it with nothing in the answer to say so -- and this is a tool an assistant drives,
so the path is often one the user only half-specified. Both now reserve the destination with an exclusive
create (`openSync(..., "wx")`), which also survives two processes racing on the same derived path, and both
name the `overwrite: true` flag in the refusal. This matches the fix already made in `servers/docx`
(`docs/DOCX_AUDIT.md`, defects 12/14).

**A 10 000 character category (7).** `slugCategory` lower-cased and de-spaced its input and stored whatever
was left. The category is a grouping key printed in every `clause_list` row, in `clause_search` results and
in the `clauses://categories` resource, so one paste accident poisoned every listing the client would ever
read. Capped at 40 characters.

### Edits made

| File | Change |
|---|---|
| `src/index.ts` | `outputPath(..., overwrite)` reserves an explicit `out_path` with `openSync(..., "wx")` and refuses an existing file; `overwrite` added to `contract_assemble` |
| `src/index.ts` | `clause_export` refuses an existing destination; `overwrite` added |
| `src/index.ts` | `slugCategory` caps a category at 40 characters (`MAX_CATEGORY`) |
| `src/index.ts` | `clause_import` reports a missing file before the Pro gate reads it |
| `src/index.ts` | the `category` argument description names the full canonical category list, not the first six (see U-1) |
| `test/adversarial.test.mjs` | new file, 10 tests covering probes 1-28 |

---

## Part 2 -- user value through a real MCP client

`claude -p "<prompt>" --mcp-config /private/tmp/uvc31/mcp.json --strict-mcp-config --model sonnet
--output-format json --max-turns 14 --allowedTools "<12 mcp__clauses__* tools>"`, one resumed session, one
fresh free-tier data dir seeded with the 25 starters and nothing else.

### Scorecard -- 15 / 15

3 = correct, right numbers, no clarification needed. 2 = correct but with a gap the user has to close.
1 = partially wrong. 0 = failed.

| # | Scenario | Score | Turns | Sec | Tools | Verified |
|---|---|---|---|---|---|---|
| s1 | "Which clauses do you have about payment and late fees?" | 3 | 3 | 11.8 | `clause_search` | named `late-fees` and `payment-terms` with their variables, and flagged `kill-fee` / `rush-fee` as adjacent rather than pretending they answer the question |
| s2 | Freelance web design contract for Acme Corp, 30% upfront, 2%/month late fee, IP on final payment, confidentiality, 14 days notice, Polish law, 4 500 EUR, save as Word | 3 | 9 | 49.9 | `clause_search`, `variables_list`, `contract_assemble` | `word/document.xml`: `Acme Corp`, `4500`, `EUR`, `Poland`, `30 percent`, `2 percent`, `14 days`, `not legal advice`, headings `1. Scope of Work` .. `7. Governing Law`, **zero** `{{` |
| s3 | "What variables are still open in that contract?" | 3 | 1 | 8.7 | (none; read from s2's `unfilled`) | listed exactly the five the document brackets -- `contractor`, `project`, `deliverables`, `payment_days`, `confidentiality_years` -- and matched `[contractor] [project] [deliverables] [payment days] [confidentiality years]` in the XML |
| s4 | "Add my own clause: rush fee, less than 48 hours notice, 25% surcharge, category fees." | 3 | 3 | 13.2 | `clause_add` | `data.json`: `rush-fee-48-hour-notice`, category `fees`, body carries `{{client}}` and `25%`; 26 clauses, 1 own |
| s5 | "Export my library as markdown." | 3 | 3 | 9.7 | `clause_export` | `library.md`, 12 275 bytes, opens with the disclaimer, 26 `##` headings, round-trips through `parseMarkdown` |

Total cost of the five turns: $0.299. No tool returned an error in any scenario.

### User-value defects

**U-1 (fixed, server-side): the category vocabulary is invisible to the client.** The `category` argument's
description listed only `CATEGORY_ORDER.slice(0, 6)`. In s4 the model took the user's word "fees" at face
value and created a **new** category next to the existing `payment` one; a `categories`-based assembly sorts
any unknown category last, so a rush-fee clause filed under `fees` would land after Governing Law. The
description now names all twelve canonical categories and says that anything else sorts last. Repro: fresh
data dir, `clause_add {category:"fees"}`, then `clause_list` -- `fees` appears with rank 12.

**U-2 (not fixed, client behaviour): s3 answered from memory, not from the library.** It spent zero tool
calls and re-read s2's `unfilled` array out of the transcript. The answer was correct, and correct only
because the session was resumed; in a fresh session the same question needs `clause_get` or
`variables_list`. Nothing in the server can force a call, and `variables_list` already exists for it.

**U-3 (not fixed, by design): the starter set already contains a `Rush Fee` clause** (category `payment`),
so s4's user-written one is the second. The model titled its own `Rush Fee (48-Hour Notice)`, so the
duplicate-title refusal never fired. The refusal is correct behaviour; a library that silently kept two
clauses called `Rush Fee` would be worse.

---

## Final test summary

```
$ npm run build -w servers/docx -w servers/clauses
(no diagnostics)

$ npm test -w servers/clauses
# tests 25
# pass 25
# fail 0
# duration_ms 2522.797
```

25 tests: `library.test.mjs` 11, `smoke.test.mjs` 3, `concurrency.test.mjs` 1, `adversarial.test.mjs` 10
(hostile arguments; 10 k category and 1 MB body; script/HTML escaping read back out of `document.xml`;
regex-metacharacter and nested-brace variables; `out_path` overwrite refusal and `overwrite: true`;
`clause_export` overwrite refusal and missing-file import; prototype-key JSON import; 500 clauses with a
60-clause assembly; starter-set integrity; stdout/network).

## RESULT.md block

```
status: DONE
evidence: 28 adversarial probes over 4 fresh data dirs + 5 claude-CLI scenarios; npm test 25/25;
  every .docx assertion read from word/document.xml, never from the tool's answer
artifacts: servers/clauses/src/index.ts, servers/clauses/test/adversarial.test.mjs,
  docs/CLAUSES_AUDIT.md, /private/tmp/clausesaudit/, /private/tmp/uvc31/
cost: 29 wall minutes; $0.299 of claude CLI usage in Part 2; zero paid API calls elsewhere
failures: 4 server defects found and fixed -- silent overwrite of an explicit out_path,
  silent overwrite of a clause_export destination, a 10 000 character category stored verbatim,
  a missing-file import answered with a Pro upsell
insight: the 4 defects are all "the answer was true about the tool and false about the disk".
  Nothing crashed, no schema was violated, and every one of them was invisible to an assertion on
  the tool's own text -- they only appear when the test reads the file back. The two overwrite bugs
  are the same shape as docx defects 12/14, which means the pattern is the repo's, not one server's:
  every writing tool here defaults to clobber, and the audit that reads the answer instead of the
  file will pass all of them.
```
