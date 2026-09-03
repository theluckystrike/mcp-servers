status: DONE

## What was built

servers/clauses -- `@theluckystrike/mcp-clauses` 0.4.0, product id `clauses`, registry name
`io.github.theluckystrike/contract-clause-library-proposal-template-docx`. A clause library with 25 generic
freelance starter clauses, ranked search, variable fill, and assembly into .docx through
`@theluckystrike/mcp-docx@^0.3.2` (`/lib` entry point, no second copy of the document engine).

Tools (12): clause_add, clause_get, clause_update, clause_delete, clause_list, clause_search, clause_import,
clause_export, contract_assemble, variables_list, license_status, license_activate.
Resource: `clauses://categories`. Prompt: `draft_contract`.

Free: 25 starters + 10 own clauses, search with category filter, 8 clauses per assembled document, markdown
import/export. Pro: unlimited clauses, jurisdiction and tag filters, JSON import/export, unlimited assembly,
clause version history on clause_update.

## evidence

```
$ npm run build -w servers/docx -w servers/clauses
> @theluckystrike/mcp-docx@0.3.2 build
> tsc -p tsconfig.json --declaration && node -e "..."
> @theluckystrike/mcp-clauses@0.4.0 build
> tsc -p tsconfig.json && node -e "..."
(no diagnostics)

$ npm test -w servers/clauses
# tests 15
# pass 15
# fail 0
# duration_ms 774.233458
```

Per file: library.test.mjs 11 tests (starter set is 25, ids unique, every declared variable is used by its own
body, search ranks payment-terms first for "payment", variable extraction order/dedupe, fill with bracketed
prompts, assemble numbering + disclaimer + open items, markdown round trip over all 25, hand-written markdown,
JSON round trip, id collision); smoke.test.mjs 3 tests (stdio initialize/tools/list/resources/prompts, ranked
search, 5-clause assembly read back with `readDocx` asserting "Beta Corp", "not legal advice", "1. Scope of
Work", "5. Termination", "4500 EUR", a bracketed prompt and no surviving `{{`; free 11th own clause refused with
the buy/clauses URL while search stays free; free 9-clause assembly refused; Pro takes 11 clauses, 9-clause
assembly, tag filter and version history; markdown import free, JSON export/import round trip in Pro);
concurrency.test.mjs 1 test (two processes on one XDG_DATA_HOME, 24 concurrent clause_add then 24 concurrent
clause_update: 25 + 24 clauses on disk, no duplicate ids, one history entry each).

```
$ node scripts/validate.mjs
validation db: run 50: 205/205   (unchanged; the validator has no `clauses` probe yet)
```

## artifacts

- /Users/mike/mcp-servers/servers/clauses/src/{index,store,starter,library,assemble}.ts
- /Users/mike/mcp-servers/servers/clauses/test/{library,smoke,concurrency}.test.mjs
- /Users/mike/mcp-servers/servers/clauses/{package.json,tsconfig.json,README.md,LICENSE,server.json,server.mcpb.json,smithery.yaml,glama.json,Dockerfile,llms-install.md}
- /Users/mike/mcp-servers/assets/clauses-logo.png (400x400 RGB, "CL" monogram, #1E3A4C on #EFE3CD, 3055 bytes)

## cost

18 wall minutes to green tests, 26 including README, llms-install.md, logo and this file. Zero paid API calls,
zero network calls.

## failures

1. The first smoke run failed on `[late_fee_percent]`: the docx read back as `[latefeepercent]`. Cause is not in
   this server -- `inlineRuns` in the docx engine parses `_..._` as an italic marker, so the underscore pair in a
   snake_case variable name is consumed and dropped on the way into document.xml. Fixed here rather than in the
   shared engine (changing italic parsing would break every markdown caller): `promptFor()` renders a missing
   variable as `[late fee percent]`, spaces instead of underscores. The `unfilled` array still returns the real
   variable names, so a caller can still map a prompt back to a variable. A regression test pins it.
2. `npm run build -w servers/clauses --prefix /Users/mike/mcp-servers` from inside the workspace directory fails
   with "No workspaces found" -- `--prefix` does not relocate workspace resolution. Run npm from the repo root.

## insight

The docx engine silently destroys snake_case text. `{{late_fee_percent}}` filled with a value is safe, but the
same name printed literally -- which is exactly what a "this fact is still missing" prompt does -- loses its
underscores between `buildDocx` and Word, with no error and no warning anywhere. Measured: `[late_fee_percent]`
in, `[latefeepercent]` out; `[a_b]` survives (a single underscore has no closing partner) but any name with two
or more underscores does not. Every server in this repo that prints a variable name, a file path, an identifier
or a snake_case key into a .docx has the same defect, and only a test that reads the .docx back can see it --
asserting on the block list passed to `buildDocx` passes clean.
