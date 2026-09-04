# mcp-barcode: build and adversarial audit

Date 2026-09-04. Scope: `servers/barcode` only (src, test, docs, manifests) plus this file. Nothing in
office-suite, `scripts/validate.mjs`, the pages, the hosting layer or Stripe was touched; the orchestrator wires
those. Zero paid API calls and zero network at runtime: `grep -rEn "fetch\(|https?://|node:http|node:net|node:dns"
servers/barcode/src/` returns only the SVG XML namespace string. The only URL the server emits is the checkout
link inside the licence gate's upgrade text.

The server is `@theluckystrike/mcp-barcode` 0.7.0, 10 tools, no resources, no prompts. Dependencies:
`qrcode` 1.5.4 (pure JS, PNG through its own pngjs path, no canvas and no native build), `jimp` (already a
workspace dependency via `servers/image`) for barcode PNGs, `zod`, the MCP SDK and `@theluckystrike/mcp-license`.
The Code 128 and EAN/UPC encoders are written here, in `src/symbology.ts`.

## Design decisions worth stating

**The linear encoders are local, the QR encoder is not.** A QR encoder is Reed-Solomon over GF(256) plus mask
selection: writing that by hand to save one pure-JS dependency would be new arithmetic nobody has scanned. Code
128 and EAN-13 are lookup tables and a modulus, so they are here, where their failure modes can be refused with
a sentence instead of a stack trace.

**The tables are verified against an independent implementation, not against my memory.** The first transcription
of the Code 128 table was wrong: one row was missing at value 39, which shifted every later value by one, and the
symbol still had the right structure. See the measured insight at the end. Every table now matches `jsbarcode`
3.12.3 byte for byte (that comparison was run once, in a scratch directory outside the repo; the module strings
it produced are pinned in `test/unit.test.mjs` as `TRUTH`), and `verifyTables()` re-checks the structural
invariants at module load and in the suite.

**PNG needs `out_path`; the server never returns base64.** A 2,000 px PNG is 58 KB, which is roughly 80,000
tokens of base64 in a conversation. `format: "png"` with no `out_path` is refused with that reason.

**out_path is not sandboxed.** It is the caller's own filesystem, the same rule `quotes` and `expense-tracker`
use. What is guaranteed is that a directory, a missing parent, a wrong extension and an existing file are each
refused with a sentence, before anything is encoded, and that the target is untouched.

**Free is the SVG tier, not a small-PNG tier.** For the thing most people do with a code (put it in a document
and print it) SVG is the better file. The numbers are in the README.

---

## Part 1 - adversarial probes

Harness: `servers/barcode/test/_client.mjs` spawns `node servers/barcode/dist/index.js` on a fresh
`XDG_DATA_HOME`/`XDG_CONFIG_HOME`, writes JSON-RPC lines to stdin and records every stdout line. Pro runs use
`node scripts/sign-license.mjs barcode`. Every row is asserted in
`servers/barcode/test/{unit,adversarial,concurrency,smoke,contract}.test.mjs`.

| # | Probe | Result | What happens |
| --- | --- | --- | --- |
| 1 | `qr_create` with no arguments | PASS | zod: `Required at text`. `barcode_create {symbology}` gives `Required at value`; `qr_payment_sepa {name}` gives `Required at iban`; an unknown symbology is refused by the enum. Register still reads `0 of 20 free codes used` |
| 2 | 10 KB payload (`"a" x 10240`) | PASS | `the payload is 10240 bytes. The largest QR code (version 40, error correction L) holds 2953 bytes ... Nothing was written.` No file at `out_path`. The 2,953-byte payload one below the ceiling encodes, as version 40 |
| 3 | invalid IBAN (one digit changed) | PASS | `the IBAN check digits do not validate (ISO 7064 mod 97 gives 28, not 1), so "DE89370400440532013001" is a typo or an invented number.` mod 97 is computed digit by digit; a 34-character IBAN is a 70-digit number and `Number()` would round it to a different, still-plausible value |
| 4 | amount 0, amount -5 | PASS | `amount 0 is outside the EPC069-12 range 0.01 to 999999999.99 EUR. A zero or negative amount is not a payment request; leave amount out and the payer types it in.` |
| 5 | amount 1e15, and the exact maximum | PASS | `1e15` refused by name; `999999999.99` accepted and drawn. `10.005` is refused rather than rounded to a cent the caller did not ask for |
| 6 | non-EUR currency | PASS | `an EPC payment QR code is euro only (it encodes a SEPA credit transfer), and currency was "USD". No code was created.` A non-SEPA IBAN (TR...) is refused the same way |
| 7 | EAN-13 with the wrong check digit | PASS | `"5901234123450" ends in 0, but the first 12 digits give 7. Pass 5901234123457, or pass the first 12 digits and the check digit is computed. Nothing was written.` Same for EAN-8 and UPC-A. A 12-digit input gets `7` appended and the message says so |
| 8 | `out_path` is a directory | PASS after a fix | `out_path /tmp/.../adir is a directory, not a file. Give it a file name ... Nothing was written.` The fix is below: the first version appended `.svg` to the directory name and wrote a file beside it |
| 9 | `out_path` parent missing | PASS | `the directory /tmp/.../nope does not exist, so ... cannot be written.` |
| 10 | `out_path` traversal (`nested/../../up.svg`) | PASS | resolved, not taken literally, and written to the resolved path, which the response names in full. Not sandboxed, by decision, like the rest of the suite |
| 11 | `out_path` already exists | PASS | `keep.svg already exists (8 bytes). Pass overwrite: true to replace it` and the original bytes are still there afterwards. `overwrite: true` then replaces it |
| 12 | `out_path` extension disagrees with `format` | PASS | `out_path ends in ".png" but the requested format is svg.` No file is created |
| 13 | `format: "png"` with no `out_path` | PASS | refused with the reason (binary, never pasted into the conversation) |
| 14 | `size: 8` and `size: 99999` | PASS | `below 32 px; a QR code that small has modules under one printed dot`, and `above 4000 px, which is a 4 m wall poster at 25 dpi`. No PNG left in the directory |
| 15 | corrupt `codes.json` | PASS | moved byte-for-byte to `codes.json.corrupt-<stamp>`, a `.corrupt` marker written, no fresh `codes.json` created, and `code_list` fails afterwards too, not only the writes |
| 16 | `codes.json` that parses but is the wrong shape (`{"codes":[]}`) | PASS | treated as corrupt. A JSON file that parses to an object where an array belongs is as unusable as one that does not parse, and reporting it as "no codes yet" is the same data loss |
| 17 | free cap: 20 rows seeded, then one more | PASS | `The free tier generates 20 codes per calendar month and 20 have been generated in 2026-09` plus the checkout link, `isError: false`. A row dated 2001 does not count. A Pro key draws it immediately |
| 18 | a capped call must leave nothing behind | PASS | no file at `out_path`, and the register still holds exactly 20 rows |
| 19 | two processes, one data dir, 40 concurrent codes | PASS | 40 rows, 40 unique ids, 20 of them Code 128. The failure this catches is a lost register row |
| 20 | two processes racing for the last free slots (30 attempts, allowance 20) | **FAIL, then fixed** | measured 23 codes drawn against an allowance of 20. Cause and fix below |
| 21 | `barcode_batch` on the free tier | PASS | refused with the upgrade text and no file written. Pro: 501 rows refused (`at most 500`), `items: []` refused |
| 22 | a batch with one bad row among four | PASS | `Wrote 3 of 4`, the refused row named with its reason and its index, the three good files on disk. `stop_on_error: true` stops and lists what was already written |
| 23 | stdout carries JSON-RPC only | PASS | asserted over `initialize`, `tools/list`, a success and two error paths. `console.*` is redirected to stderr and any non-protocol stdout write is diverted |
| 24 | version contract | PASS | `package.json` 0.7.0 = generated `src/version.ts` = `serverInfo.version` = `server.json` = `server.mcpb.json`, and `scripts/sync-versions.mjs --check` passes for the whole repo |
| 25 | a Pro key signed for another product | PASS | reports `free`; `license_status` shows `pro` only for a key signed for `barcode` |

### The defects the probes caused

**1. The free monthly cap could be exceeded by two processes (probe 20, P0).** The cap was read under one lock
and the register row was appended under another. Two servers on one data directory both read 19 and both wrote:
**23 codes were drawn against an allowance of 20**, a 15% overrun, and every one of them was the thing being sold.
Fixed by making the count and the row one critical section (`reserve()` in `src/index.ts` now appends the row it
just counted), with `release()` giving the slot back when the file write fails afterwards, so a bad `out_path`
still costs no allowance. `out_path` validation and encoding both moved ahead of the reservation for that reason.
The probe now measures exactly 20 drawn and 10 refused across 30 concurrent calls.

**2. A directory `out_path` with no extension became a new file beside it (probe 8, P1).** `checkOutPath`
appended `.svg` before it stat-ed anything, so `out_path: "~/labels"` (a directory) wrote `~/labels.svg` and
reported success. The caller would never learn that `out_path` was not the thing they meant. Fixed by stat-ing
the path exactly as given, before any extension is appended.

**3. The Code 128 table was missing a row (found before any probe ran, by comparison, P0).** See the insight.

---

## Free vs Pro, as shipped

| | Free | Pro |
| --- | --- | --- |
| Codes per calendar month | 20 | Unlimited |
| SVG output | Yes | Yes |
| PNG output | No | Yes, 32 to 4000 px |
| `barcode_batch` | No | Yes, up to 500 rows a call |
| QR, WiFi, vCard, SEPA payment, Code 128, EAN-13, EAN-8, UPC-A | Yes | Yes |

## Measured timings (M-series laptop, cold store, per call over stdio)

| operation | measured |
| --- | --- |
| 50 x Code 128 SVG, written to disk | 57 ms total, 1.1 ms each |
| 50 x QR SVG, written to disk | 82 ms total, 1.6 ms each |
| `barcode_batch`, 100 Code 128 PNGs | 453 ms total, 4.5 ms each |
| one 2,000 px QR PNG (2 KB payload) | 188 ms, 58,824 bytes |
| whole suite, 38 tests, five files | 2.8 s |

---

## Measured insight

**A wrong symbology table does not look wrong. It looks like a barcode.**

The Code 128 pattern table was transcribed by hand, 107 rows of six digits. It passed every structural invariant
worth writing: each row 11 modules wide, each row starting with a bar, three bars and three spaces, even bar
parity, no duplicates, the stop pattern 13 modules. A symbol built from it rendered as a clean barcode with a
correct-looking checksum, because the checksum is computed over the *values*, and the values were all present.

It was still wrong. Row 39 was missing, so every value from 39 upward encoded as its neighbour: 67 of the 107
rows produced the wrong bars. `-` and every character above code 71 in subset B, and every digit pair above 39 in
subset C, would have printed as something else. A scanner would have read the label happily and returned a
different string, which for a shelf label or a shipping code is silent, expensive and discovered late.

Nothing internal could have caught it. Parity, width and duplicate checks all pass on a table that is merely
*shifted*, because a shifted table is still a permutation of the same valid rows. The check that caught it took
two minutes: `npm pack jsbarcode` into a scratch directory, encode six values with both implementations, and
compare the module strings. Five of six matched immediately, EAN-13, EAN-8 and UPC-A byte for byte; the two Code
128 mismatches localised the missing row exactly, at value 39.

The general rule this leaves: **a table transcribed from a specification needs an external oracle, not a
self-check.** Self-consistency tests measure whether the table is well formed, and a well-formed wrong table is
precisely the dangerous case. The comparison is cheap and one-off; the pinned module strings in
`test/unit.test.mjs` keep it for free from here on. The one place where an independent implementation still
disagrees is benign and understood: for an odd digit at the end of a numeric payload, `jsbarcode` switches to
subset A and this encoder switches to subset B. Both encode the same character with the same value, both
checksums are valid, and both symbols decode to the same string.

The same reasoning covers the QR side, where the encoder is a dependency rather than local code: an EPC payment
record was rendered at all four error correction levels and at 96 px, and decoded back with `jsQR` (also packed
into the scratch directory, not added to the repo). All five decoded to the payload byte for byte, which is what
"a banking app can scan this" actually means.
