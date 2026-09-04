# mcp-zip: Part 2 CLI run and remaining Part 1 gaps

Date 2026-09-04. Scope: `servers/zip` only (src, test) plus this file. `remote/`, billing,
scripts, `servers/zip/README.md` and `remotes.json` belong to other agents; nothing there was
touched. Working tree was already even with `origin/main` on this path (`git pull --rebase
--autostash` reported "Already up to date"), so no rebase conflict before editing.

Part 2 harness: the real `claude` CLI (2.1.260) as an MCP client, `--model sonnet`, against a
fresh `/private/tmp/uv-zip2/mcp.json` registering `zip` and `invoice` together with
`--strict-mcp-config`, fresh `XDG_DATA_HOME`/`XDG_CONFIG_HOME` in each server's own env block
inside `mcp.json` (not the CLI's environment), free tier, and an explicit per-tool allowlist of
every `mcp__zip__*` / `mcp__invoice__*` tool plus `license_status`/`license_activate` on each.
A working directory `/private/tmp/uv-zip2/files` was staged before the run with three invoice
files (`INV-2026-000{1,2,3}.pdf`, plain text bodies per the task's own allowance), a fourth,
non-September invoice (`INV-2026-0099-august.pdf`) to make "the three September invoices" an
actual filter rather than "everything here", a CSV export (`september-export.csv`), and a
client-supplied `client-files.zip` built with `servers/zip/test/_zipgen.mjs` holding
`readme.txt`, `quote.csv` and one `../../evil.txt` traversal entry. Each of the six prompts is
one bounded `-p` call with `--continue` chaining the same conversation, request timeout 180 s
(none came close). Machine day: Friday 2026-09-04.

---

## Part 2 - six prompts through the claude CLI

Scores are 0-3, checked against `archives.json` on disk, `unzip -l`/`unzip -p` on the actual
archive bytes, and `cmp` against the source files, not against the model's prose.

| # | Prompt | Score | Verified |
| --- | --- | --- | --- |
| 1 | "Zip the three September invoices into september-invoices.zip" | 3 | `zip_create` with `paths` naming exactly the three September files. `unzip -l` on the result lists exactly `INV-2026-0001.pdf`, `INV-2026-0002.pdf`, `INV-2026-0003.pdf` (123 bytes uncompressed); the August decoy `INV-2026-0099-august.pdf` is correctly excluded. `archives.json` gained one row: `op zip_create`, `entries 3`, `bytes 481` |
| 2 | "What is inside client-files.zip and is it safe to extract?" | 3 | `zip_list` was called (no write, no register change). Reply named all three entries and flagged `../../evil.txt` by name as "a path-traversal entry that would write outside the extraction directory", and stated correctly that `zip_extract` refuses the whole archive by default. Register still held only the prompt-1 row |
| 3 | "Extract it into ./client but skip anything dangerous" | 3 | `zip_extract` with `skip_unsafe: true`. `find client -type f` shows exactly `readme.txt` and `quote.csv`; `cmp` against the original entry bytes ("Client files, please review." and "item,price\nwidget,9.99\n") matches byte for byte. `find /private/tmp -name evil.txt` returns nothing anywhere on disk, inside or beside `./client` |
| 4 | "Add the CSV export to september-invoices.zip" | 3 | `zip_add`. `unzip -l` on the result now lists 4 entries, the three PDFs plus `september-export.csv`; `unzip -p ... september-export.csv \| cmp - september-export.csv` matches byte for byte, so the CSV went in unmodified. `archives.json` gained a second row: `op zip_add`, `entries 4`, `bytes 701` |
| 5 | "Show me the first lines of the CSV inside the archive without extracting" | 3 | `zip_extract_text` (confirmed by re-asking the same conversation to name the exact tool call: `mcp__zip__zip_extract_text` with `{path: ".../september-invoices.zip", entry: "september-export.csv"}`). Reply's content (header row plus the three invoice rows: Acme, Globex, Initech) matches `september-export.csv` on disk verbatim, and no new file appeared anywhere under the working directory |
| 6 | "How many archives have I made this month and how many are left free?" | 3 | `zip_history` (or the register read behind it). Reply: "You've used 2 of 20 free archives this month (2026-09), so 18 remain," and correctly explained that `client-files.zip` (read-only inspection and skip-unsafe extraction, never a write through `zip_create`/`zip_add`) does not count. `archives.json` on disk holds exactly 2 rows, matching the reply exactly |

Scorecard: **18 / 18 (3.00 / 3)**. No tool-selection misses, no wrong refusals, no file written
outside where it was asked for, and the one dangerous entry in the client-supplied archive never
touched disk at any point across three separate calls into it (list, extract, and the later
history question that referenced it only in prose).

---

## Part 1 - the eight named gaps

`docs/ZIP_RESULT.md` already probes 27 adversarial cases; the eight named here are the ones not
yet asserted as explicit tests, or asserted at a looser boundary than the one named.

| # | Probe | Result | What happens |
| --- | --- | --- | --- |
| 1 | 201 entries on the free tier | PASS, tightened | `docs/ZIP_RESULT.md` already asserted 205 files over the 200-entry cap; that leaves the exact boundary (200 accepted, 201 refused) unproven. Added: 200 files pack (`200 entries`, file written), 201 files refuse by name (`That is 201 files. The free tier writes archives of up to 200 entries`) and write nothing |
| 2 | a 26 MB archive on the free tier | PASS, new test | The free ceiling is measured on the archive fflate actually produces, not the input size, so the test packs 26 MB of `randomBytes` (incompressible, so the zipped output stays close to 26 MB). Refused: `The free tier writes archives up to 25.0 MB`, nothing written; a Pro key writes the same archive past 25 MB |
| 3 | duplicate entry names | PASS, already covered | `docs/ZIP_RESULT.md` probe 5 and `test/adversarial.test.mjs`'s `"duplicate entry names"` test already assert both directions: packing two files that claim one entry name is refused with the count, and an archive that already holds two entries of one name is flagged by `zip_list`. No change needed |
| 4 | an entry with a 4 GB declared size and a 100-byte body | PASS, new test, real finding | `zip_list`'s per-entry ratio guard has a floor (`RATIO_FLOOR_BYTES = 1024`) so a tiny well-compressed file is never flagged as a bomb; a 100-byte compressed entry sits under that floor even at a 40,000,000x ratio, so `zip_list` genuinely reports "Nothing suspicious" for this entry. That floor is a display decision, not the safety boundary: `zip_extract`'s total-declared-size cap is a second, unfloored guard, and it refuses this entry outright (`declare 3.7 GB uncompressed, over the ... ceiling`). Raising `max_total_mb` past 4 GB does not open a hole either — the entry is store-method, so the size check that runs before the CRC catches the lie directly: `"huge.bin" declared 4000000000 bytes and produced 100`. Nothing is ever written. See the observation below; no code change was needed because a second, independent guard already covers it, but the finding is worth recording because `zip_list`'s "Nothing suspicious" line is misleading in isolation for this shape of entry |
| 5 | a corrupt CRC entry | PASS, already covered | `test/unit.test.mjs`'s `"a header that lies about its size is caught"` already builds an entry with `declaredCrc: 1` against a correct body and asserts `readEntry` throws `/fails its CRC check/`. No change needed |
| 6 | a zip with a comment | PASS, new test | `makeZip(..., { comment: "..." })` from `_zipgen.mjs` (the harness already supported it; no test exercised it). `zip_list` and `zip_extract` both work exactly as on an uncommented archive: the EOCD comment length field is read and skipped, never mistaken for entry data. Extracted bytes for both entries matched their originals exactly |
| 7 | `out_dir` that is a file | FAIL, fixed | Real defect: `zip_extract` never checked whether `out_dir` was a plain file before calling `mkdirSync(outDir, { recursive: true })`. Node's `mkdirSync` on an existing file throws a raw `EEXIST: file already exists, mkdir '...'`, which `wrap()` still turns into a refusal rather than a crash, but the message is nothing like the rest of the server's house style (compare `out_path ... is a directory, not a file` for `zip_create`). Fixed in `src/index.ts`: `out_dir` is now stat-ed before anything else runs, and a plain file there is refused with `out_dir ... is a file, not a directory. Give a directory to unpack into, for example ...-extracted. Nothing was extracted.` The original file is left untouched |
| 8 | two processes on the monthly cap | PASS, already covered | `docs/ZIP_RESULT.md` probes 9 and 10 and `test/concurrency.test.mjs`'s two tests already assert this at both a non-contended scale (40 archives, one register, no lost rows) and a contended one (30 processes racing 10 remaining slots, exactly 10 drawn). No change needed |

Three of the eight (#3, #5, #8) needed no new test at all; they were already explicit assertions.
Four (#1, #2, #4, #6) were correct behavior with no prior explicit test and are now added. One
(#7) was a real defect, fixed with a one-line guard plus a test.

---

## The one defect: `out_dir` as a file

**Before**: `zip_extract` resolved `out_dir` with `expandPath` and went straight to
`mkdirSync(outDir, { recursive: true })`. If a plain file already sat at that path, `mkdirSync`
threw `EEXIST: file already exists, mkdir '/path'`, caught by `wrap()` and returned as
`Error: EEXIST: file already exists, mkdir '/path'` — technically a refusal, not a crash, but a
raw Node errno string instead of a sentence, and inconsistent with `zip_create`'s `out_path`
check (`out_path ... is a directory, not a file`), which stats the path and explains itself
before anything is attempted.

**After**, in `servers/zip/src/index.ts`:

    const outDir = expandPath(a.out_dir);
    if (existsSync(outDir) && !statSync(outDir).isDirectory()) {
      return fail(`out_dir ${outDir} is a file, not a directory. Give a directory to unpack into, for example ${outDir}-extracted. Nothing was extracted.`);
    }

This runs before entries are even inspected, so a bad `out_dir` costs nothing: no archive
reading, no register interaction, and the original file is provably untouched (asserted with a
byte comparison in the new test).

---

## Final test summary

    npm run build -w servers/zip   tsc clean, no output
    npm test -w servers/zip        # tests 43 / # pass 43 / # fail 0

43 tests across `unit.test.mjs`, `adversarial.test.mjs` (now 23 tests: 17 from the prior pass
plus 6 new: the 200/201 entry boundary, the 26 MB free-tier size cap, the comment-bearing
archive, the 4 GB declared-size entry, and `out_dir` as a file), `concurrency.test.mjs`,
`contract.test.mjs` and `smoke.test.mjs`.

---

## RESULT.md block

    status: DONE
    evidence:
    - npm run build -w servers/zip: tsc clean
    - npm test -w servers/zip: # tests 43 / # pass 43 / # fail 0
    - Part 2: claude CLI 2.1.260, sonnet, zip + invoice, per-tool allowlist, fresh XDG dirs
      in mcp.json's server env, working dir with 3 September invoices + 1 August decoy + a CSV
      export + a crafted client-files.zip with a ../../evil.txt entry, 6 prompts, 3.00/3
      (18/18), all six verified against archives.json on disk, unzip -l/-p on the actual
      archive bytes and cmp against the source files (not the model's prose)
    - Part 1 gap-fill: 8 named probes (201 entries, 26 MB archive, duplicate names, 4 GB
      declared size / 100-byte body, corrupt CRC, a zip with a comment, out_dir as a file,
      two-process monthly cap race). 3 already covered by the prior pass (duplicate names,
      corrupt CRC, the concurrency race) and still pass; 4 needed new tests but no code change
      (the 200/201 boundary, the 26 MB size cap, the comment archive, the 4 GB entry); 1
      (out_dir as a file) was a real defect, fixed with a one-line stat check plus a test
    artifacts:
    - /Users/mike/mcp-servers/servers/zip/src/index.ts
    - /Users/mike/mcp-servers/servers/zip/test/adversarial.test.mjs
    - /Users/mike/mcp-servers/docs/ZIP_AUDIT.md
    cost: 35 wall minutes
    failures:
    - out_dir given as an existing plain file crashed mkdirSync with a raw EEXIST errno string
      instead of a house-style sentence. wrap() still caught it (no protocol crash, isError:
      true), but the message named neither the reason nor a next step. Fixed with a stat check
      mirroring zip_create's out_path guard, run before any entry is inspected.
    insight:
    - A guard with a floor to avoid false positives (RATIO_FLOOR_BYTES, so a tiny well-
      compressed file is not flagged as a bomb) can make a display tool (zip_list) report
      "Nothing suspicious" on an entry that is, numerically, a 40,000,000x ratio. That is not
      a safety hole by itself, because the guard that actually gates a write (zip_extract's
      total-declared-size cap, and the store-method size check that runs ahead of the CRC) is
      unfloored and still refuses the same entry — but it means "zip_list said it was fine" is
      not, on its own, sufficient evidence that an entry is safe to extract with a raised
      max_total_mb. The two guards answer different questions (is this worth flagging in a
      human-facing list vs. is this safe to actually write), and only the second one is load-
      bearing. The same principle from docs/ZIP_RESULT.md's insight applies one level up: a
      threshold tuned against one failure mode (false positives on small legitimate files)
      is not automatically a threshold that also catches every attack shape, and the way to
      know it still does is to measure the guard that is actually load-bearing, not the one
      that is easiest to read.

Built by theluckystrike. https://github.com/theluckystrike
