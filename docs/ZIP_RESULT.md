# mcp-zip: build and adversarial audit

Date 2026-09-04. Scope: `servers/zip` only (src, test, docs, manifests) plus this file and `package-lock.json`
for the one dependency added. Nothing in office-suite, `scripts/validate.mjs`, the pages, the hosting layer or
Stripe was touched; the orchestrator wires those. Zero paid API calls and zero network at runtime:
`grep -rEn "fetch\(|https?://|node:http|node:net|node:dns" servers/zip/src/` returns nothing (exit 1). The only
URL the server emits is the checkout link inside the licence gate's upgrade text.

The server is `@theluckystrike/mcp-zip` 0.8.0, 9 tools, no resources, no prompts. Dependencies: `fflate` 0.8.3
(pure JS, no native build, no dependencies of its own), `zod`, the MCP SDK and `@theluckystrike/mcp-license`.
The zip container format, the central-directory reader and every safety decision are written here, in
`src/zipfile.ts`.

## Design decisions worth stating

**fflate compresses; this server reads the format itself.** The library choice was fflate against a
STORE/DEFLATE writer on `node:zlib`. The container is written here either way, because every guard in this
server is a decision made from the central directory *before* anything is inflated, and an API that hands back
`{name: bytes}` has already decompressed the bomb by the time you can look at it. What is left is the
compressor, which is the part not to write by hand: `node:zlib`'s raw-deflate calls are async-first and the
sync ones each build a native stream (200 of them for 200 small files), while fflate's `deflateSync` is pure JS
with no native handle and packs 200 files in 74 ms. The cost is stated in the README rather than hidden: fflate
builds in one buffer, so inputs over 512 MB are refused rather than streamed, and ZIP64 is refused by name.

**Refusing a bomb costs no decompression.** Sizes, ratios, names and external attributes all come out of the
central directory. A 500 MB bomb that is 497.8 KB on disk is refused in 3 ms with `out_dir` not even created.

**The ratio ceiling is the second guard, not the first.** A real, legitimate CSV export measured **82.69x**, so
a ceiling "safely below a bomb" would refuse real work and teach the caller to disable it. The total declared
uncompressed size is the primary cap. See the measured insight.

**`out_path` and `out_dir` are not sandboxed.** They are the caller's own filesystem, the same rule `pdf`,
`quotes` and `barcode` use. What is guaranteed is that a directory, a missing parent and an existing file are
each refused with a sentence before anything is read, and that entries from inside an archive can never land
outside `out_dir`.

**Reading is free on both tiers.** The archive somebody sent you is exactly the one that most needs inspecting,
and metering `zip_list` would put a paywall in front of the safety check. The free tier meters writing only.

**Passwords are refused, not ignored.** The classic zip cipher is broken and AES zip encryption is a vendor
extension no two tools agree on. A `password` argument exists on the writing tools purely so that passing one
produces a refusal rather than an archive the caller believes is encrypted.

---

## Part 1 - adversarial probes

Harness: `servers/zip/test/_client.mjs` spawns `node servers/zip/dist/index.js` on a fresh
`XDG_DATA_HOME`/`XDG_CONFIG_HOME`, writes JSON-RPC lines to stdin and records every stdout line. Pro runs use
`node scripts/sign-license.mjs zip`. `servers/zip/test/_zipgen.mjs` writes raw zip bytes, because fflate cannot
produce the archives this server has to refuse. Every row below is asserted in
`servers/zip/test/{unit,adversarial,concurrency,contract,smoke}.test.mjs`.

| # | Probe | Result | What happens |
| --- | --- | --- | --- |
| 1 | crafted zip bomb: 200 MB of zeros in a 199.2 KB file | PASS | `zip_list` flags it (`ratio - 203842 compressed bytes declare 209715200 uncompressed, a ratio of 1028.8x against a ceiling of 100x`); `zip_extract` refuses the whole archive and **does not create `out_dir`**; `skip_unsafe: true` extracts 0 files and names the skip; with `max_ratio` raised to 100000 the total-size cap still refuses it (`declare 200.0 MB uncompressed, over the 50.0 MB ceiling`). Nothing on disk after all three |
| 2 | traversal entry `../../escaped.txt` | PASS | refused by name before anything is inflated, together with the absolute-path and symlink entries in the same archive: `3 of the 4 selected entries would be unsafe to write, so nothing was extracted`. Nothing lands beside `out_dir` either |
| 3 | absolute-path entry `/etc/cron.d/pwn` | PASS | refused as `absolute path`. `C:\Windows\evil.dll` is refused as both `absolute path` and `backslash separator` |
| 4 | symlink entry (unix mode 0xA1FF) | PASS | refused; with `skip_unsafe: true` only the safe entry is written and **no link and no file** appears at the symlink's name. A symlink is never recreated |
| 5 | duplicate names | PASS | packing two files that claim one entry name is refused with the count (`report.csv (2 files)`) and nothing is written; an archive that already holds two entries of one name is flagged by `zip_list` (`2 entries share this name; unpacking the archive leaves whichever one was written last`) |
| 6 | corrupt central directory | PASS | `zip_list`, `zip_extract`, `zip_extract_text` and `zip_add` all refuse with `the central directory is corrupt: entry 2 of 2 does not start with the central-directory signature`, and the `zip_add` attempt leaves the archive byte-identical |
| 7 | 0-byte file | PASS | as an archive: `is empty (0 bytes). An empty file is not a zip archive; even an archive with no entries is 22 bytes`. As an entry: packs, lists and extracts back as 0 bytes without breaking the archive |
| 8 | header that lies about its size | PASS | a 100,000-byte entry declared as 10 bytes is refused: `fails its CRC check`. See the insight - the bounded inflate returns 10 bytes and throws nothing, so the checksum is the only instrument that catches it |
| 9 | two processes, one data dir, 40 archives | PASS | 40 rows, 40 distinct ids, 0 rows left `pending`, 40 files on disk. The failure this catches is a lost register row |
| 10 | two processes racing for the last free slots (30 attempts, 10 slots left) | PASS | exactly 10 drawn, 20 refused, register holds exactly 20, exactly 10 files on disk. The counterfactual is below |
| 11 | `password` argument | PASS | refused by name (`Zip passwords are not supported`) and no file is written under a name the caller believes is encrypted. An encrypted entry in someone else's archive is refused on read, never guessed |
| 12 | `out_path` is a directory | PASS | `is a directory, not a file`, and `.zip` is **not** appended onto the directory name to write a file beside it (the defect `barcode` shipped; the stat runs on the path exactly as given) |
| 13 | `out_path` parent missing / already exists | PASS | `the directory ... does not exist`; `already exists (8 bytes)` with the original bytes still there afterwards, and `overwrite: true` then replaces it |
| 14 | extraction would replace existing files | PASS | refused with the clashing paths named and the old bytes intact; `overwrite: true` then replaces them |
| 15 | `dry_run` | PASS | reports the plan (`Dry run: 3 files`), does not create `out_dir`, and the real run then writes exactly that plan |
| 16 | `zip_extract_text` on a binary entry | PASS | `holds a zero byte at offset 4, so it is a binary file, not text` rather than printing noise into the conversation |
| 17 | `zip_extract_text` on a missing entry / a glob | PASS | a missing name is refused with the entry count; a glob matching exactly one entry is accepted; a glob matching several is refused with examples |
| 18 | `zip_add` name clash | PASS | refused (`Pass replace: true`) and the archive is byte-identical afterwards; `replace: true` then swaps the entry and the other entries survive the rebuild |
| 19 | `zip_add` on an archive holding a traversal entry | PASS | refused: rebuilding would mean re-emitting it, and an archive written here never carries one. The original is untouched |
| 20 | globs | PASS | `patterns: ["**/*.csv"]` with `exclude: ["**/node_modules/**"]` packs 2 of 4 files; a pattern matching nothing is refused rather than writing an empty archive |
| 21 | free monthly cap | PASS | the 21st archive is refused with `isError: false` plus the checkout link, no file is written (not even the 0-byte reservation) and the register still holds exactly 20 rows. A row dated 2001 does not count against this month |
| 22 | free entry cap | PASS | 205 files refused with the count named, nothing written; a Pro key draws the same archive immediately |
| 23 | corrupt register | PASS | quarantined byte-for-byte to `archives.json.corrupt-<stamp>`, a `.corrupt` marker written, no fresh `archives.json` created, and `zip_history` fails afterwards too, not only the writes |
| 24 | `zip_bundle_month` | PASS | reads the sibling servers' default output folders, names every one it looked in including the missing ones, takes only the files modified in the month asked for (a 2001-dated invoice is counted in the folder line and left out of the archive), and refuses with the folder list rather than writing an empty bundle when a month is empty |
| 25 | stdout carries JSON-RPC only | PASS | asserted across `initialize`, `tools/list`, a success, a refusal and a protocol error |
| 26 | version contract | PASS | `package.json` 0.8.0 = generated `src/version.ts` = `serverInfo.version` = `server.json` = `server.mcpb.json`, and `scripts/sync-versions.mjs --check` passes for the whole repo |
| 27 | a Pro key signed for another product | PASS | reports `free`; `license_status` shows `pro` only for a key signed for `zip` |

### The defects the probes caused

**1. `zip_extract_text` made a file unreadable by asking for less of it (P1).** The read ceiling was computed
from `max_chars` (`hit.size > cap * 4`), so `max_chars: 100` on a 4.9 KB entry returned
`is 4.9 KB, far past the 100-character ceiling` instead of the first 100 characters. Asking for a smaller
excerpt is not a reason to refuse the file. The read ceiling is now the fixed `MAX_TEXT_CHARS` and `max_chars`
only trims what is printed.

**2. The first race counterfactual measured nothing (test-authoring defect).** Splitting the free-cap count and
the register append into two locked sections did **not** overrun the allowance: the window between them is a
few microseconds of `randomBytes`. Three runs all drew exactly 10 of 10, which would have read as "the split
lock is fine". It is not; the window in a real implementation holds the work. With 5 ms in it - the time to read
the files and build the archive - the same split-lock build drew **15, 25 and 19 archives against an allowance
of 10**, a 50 to 150 percent overrun, while the shipped one-critical-section build drew exactly 10 every time.
A concurrency probe with no work inside the window is not a probe.

**3. Two authoring corrections worth recording.** A control-character regex written as literal bytes made
`src/zipfile.ts` binary to `grep` (the file was fine; every search over it silently found nothing until the
class was written as `\u0000-\u001f`). And a "not a zip" probe used an 18-byte string, which was refused by the
length check rather than the signature search, so it asserted the wrong refusal.

---

## Part 2 - the measured tables

### Compression ratio by file type, level 6

| file | type | bytes | zipped | ratio |
| --- | --- | --- | --- | --- |
| 12-page invoice generated with `mcp-pdf` | PDF | 15,125 | 14,118 | 1.07x |
| 400-paragraph contract generated with `mcp-docx` | DOCX | 9,897 | 7,311 | 1.35x |
| 4,000 rows of billing CSV, unique values | CSV | 321,329 | 134,049 | 2.40x |
| this server's `src/index.ts` | source | 39,498 | 11,938 | 3.31x |
| the repo's `package-lock.json` | JSON | 138,835 | 33,223 | 4.18x |
| 20,000 lines of an application log | log | 1,603,390 | 106,261 | 15.09x |
| 4,000 rows of billing CSV, 40 repeated clients | CSV | 338,549 | 4,094 | 82.69x |
| 50 MB of zero bytes | bomb | 52,428,800 | 51,294 | 1022x |

### Timings, over stdio, cold store

| operation | measured |
| --- | --- |
| `zip_create`, 200 files, 4.0 MB | 74 ms |
| `zip_list`, 200 entries | 2 ms |
| `zip_extract`, 200 entries | 47 ms |
| `zip_extract_text`, one entry | 1 ms |
| refuse a 500 MB bomb (497.8 KB on disk) | 3 ms |
| whole suite, 38 tests, five files | 3.9 s |

---

## Free vs Pro, as shipped

| | Free | Pro |
| --- | --- | --- |
| Archives per calendar month | 20 | Unlimited |
| Archive size | 25 MB | Unlimited |
| Entries per archive | 200 | Unlimited |
| `zip_list`, `zip_extract`, `zip_extract_text` | Unlimited | Unlimited |
| Bomb, traversal and symlink guards | Yes | Yes |

---

## Measured insight

**A bounded output buffer looks like a complete zip-bomb guard, and the way it is incomplete is silent.**

The obvious way to inflate an entry safely is to cap the output: take the uncompressed size out of the central
directory, allocate exactly that, and let the decompressor fill it. Memory is bounded by a number the archive
declared, before anything runs. It reads like the whole answer.

Measured, on fflate 0.8.3:

    inflateSync(deflateSync(Buffer.alloc(100000, "A")), { out: new Uint8Array(10) })
    -> Uint8Array(10), no exception

Ten bytes, no error, no flag. So an archive whose header declares 10 bytes for a 100 KB entry does not blow up
the process, which is what the buffer was for; it writes a **10-byte file and reports success**. The caller gets
a truncated document with a plausible name and nothing anywhere says so. For a contract, a CSV of billing rows
or a database export, that is worse than the crash the buffer was protecting against, because the crash is
noticed.

The buffer answers "how much memory can this entry cost me". It cannot answer "are these the bytes of the
file", and only the CRC-32 the central directory already carries can. Both are now checked on every entry
before it reaches the disk, and a mismatch refuses the entry by name
(`fails its CRC check (header ..., data ...)`), which is how a lying header became a sentence instead of quiet
data loss.

The general rule this leaves: **a guard derived from attacker-supplied metadata bounds the damage, it does not
validate the data.** The declared size, the declared ratio and the declared entry count are all things the
archive says about itself, and every one of them is worth acting on *before* decompressing, which is exactly
why this server reads the central directory itself. But a value that came from the file can only ever be
checked against another value that came from the file, and the checksum is the one that was designed for that
job. Two instruments, two questions. The one that looked sufficient is the one that fails quietly.

Built by theluckystrike. https://github.com/theluckystrike
