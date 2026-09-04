# mcp-barcode: Part 2 CLI run and remaining Part 1 gaps

Date 2026-09-04. Scope: `servers/barcode` only (src, test) plus this file. `remote/`, billing,
scripts, `servers/barcode/README.md` and `remotes.json` belong to other agents; nothing there was
touched. Working tree was already even with `origin/main` on this path, so no rebase was needed
before editing.

Part 1 harness for the eight named gaps: direct calls through `servers/barcode/test/_client.mjs`
against `dist/index.js`, and the pinned functions in `src/payloads.ts`. Part 2 harness: the real
`claude` CLI (2.1.260) as an MCP client, `--model sonnet`, against a fresh
`/private/tmp/uv-barcode2/mcp.json` registering `barcode` and `invoice` together with
`--strict-mcp-config`, fresh `XDG_DATA_HOME=/private/tmp/uv-barcode2/data` and
`XDG_CONFIG_HOME=/private/tmp/uv-barcode2/cfg` in each server's own env block inside `mcp.json`
(not the CLI's environment), free tier, and an explicit per-tool allowlist of every
`mcp__barcode__*` / `mcp__invoice__*` tool plus `license_status`/`license_activate` on each. A
shared business profile was written directly to `data/mcp-servers/profile/business.json` before
the run: name "Nova Studio", `iban PL61109010140000071219812874`, `default_currency EUR`,
`default_tax_rate 23`, `payment_terms_days 14`, `timezone Europe/Warsaw`. Each of the six prompts
is one bounded `-p` call with `--continue` chaining the same conversation, request timeout well
under 180 s. Machine day: Friday 2026-09-04.

---

## Part 2 - six prompts through the claude CLI

Scores are 0-3, checked against `codes.json` and `invoices.json` on disk and by decoding or
re-encoding the artifact, not against the model's prose.

| # | Prompt | Score | Verified |
| --- | --- | --- | --- |
| 1 | "Make a QR for https://mcp.zovo.one as SVG" | 3 | One `qr_create`. Reply's inline SVG is `viewBox="0 0 33 33"` (version 4). Re-encoded the same URL with `qrcode` 1.5.4 directly (`errorCorrectionLevel: M, margin: 4, width: 300`, the tool's own defaults): identical `viewBox` and identical module path string, byte for byte. Register: 1 row, `kind text`, `symbology qr`, `format svg`, `summary https://mcp.zovo.one` |
| 2 | "Payment QR for EUR 1,230.00 to my IBAN with reference INV-2026-0001" | 1 | No tool was called (`num_turns: 2`, one assistant message, zero tool_use blocks). The model asked the user for IBAN and beneficiary name, saying "I need two things I don't have on file" — both are already in the shared profile it had just used implicitly on prompt 1's server process. `invoice_payment_qr` accepts `amount` and `reference` alone and pulls `iban`/`name` from the shared profile with no `invoice_id` needed; the model did not use it, and `qr_payment_sepa` (which does need explicit `iban`/`name`, by design) is the tool it appears to have considered instead. Register unchanged at 1 row. Not a code defect: every function involved behaves exactly as documented; this is a tool-selection miss, and the fix that would remove it is a description change, noted below |
| 3 | "Create an invoice for Acme, 10 hours at EUR 90, then give me its payment QR" | 3 | `invoice_from_hours` then `invoice_payment_qr {invoice_id}` (chained across the two servers, one call each). Invoice store: `INV-2026-0001`, client Acme (auto-created), 10h x EUR 90 = EUR 900.00 subtotal, 23% VAT (profile default) = EUR 1,107.00 total. QR: register row `kind invoice`, `summary` "BCD 002 1 SCT Nova Studio PL61109010140000071219812874 EUR1107.00 INV-2026-0001" — beneficiary, IBAN and amount all read from the shared profile and the invoice total, not restated by the caller. The EPC line order (BCD, version, char set, SCT, empty BIC, name, IBAN, EUR1107.00, empty purpose, empty reference, remittance=INV-2026-0001) matches `epcPayload`'s field order exactly |
| 4 | "EAN-13 barcode for 590123412345 as PNG 600 px" (12 digits, no format given otherwise) | 3 | Correctly refused: PNG is Pro-only and the free tier said so by name, with the SVG alternative and the two upgrade prices, and asked before doing anything else. No file, register unchanged. Confirmed separately (not through the CLI, to isolate the two gates) that the same 12-digit value on `format: "svg"` computes the check digit without being asked: `EAN13 fcbff566: 5901234123457 ... Check digit 7 was computed and added`, matching row 7 of docs/BARCODE_RESULT.md |
| 5 | "WiFi QR for network Studio with password hunter2" | 3 | Correctly refused before drawing anything: `"hunter2" is only 7 characters — WPA requires 8-63`, and asked for a real password or a different auth mode rather than padding or truncating it into range. Register unchanged |
| 6 | "How many codes have I made this month and how many are left free?" | 3 | `code_list`. Reply: "2 codes this month ... out of a free allowance of 20/month, so 18 remain," naming both prior codes (the URL QR, the invoice payment QR). `codes.json` on disk holds exactly those 2 rows, both dated 2026-09, matching the reply exactly |

Scorecard: **16 / 18 (2.67 / 3)**. The one point lost (prompt 2) is a tool-selection miss by the
model, not a wrong answer from any tool: no file was written, no allowance was spent, and nothing
on disk is inconsistent with what happened. `invoice_payment_qr`'s description says "the amount
and reference from invoice_id or from the arguments," which is true but reads as invoice-first;
a caller asking for a bare payment QR with an amount and a reference in hand has no obvious signal
that this is the tool that also serves that request without an invoice at all. Filed as an
observation, not a code change: the function is correct, only the description undersells one of
its two paths.

---

## Part 1 - the eight named gaps

| # | Probe | Result | What happens |
| --- | --- | --- | --- |
| 1 | IBAN with a valid ISO 7064 checksum but the wrong length for its country | PASS, already correct | Constructed `PL151111111111111111` (20 characters, check digits computed by the same mod-97-10 algorithm so `ibanChecksum` returns 1) and confirmed the checksum passes in isolation. Through `qr_payment_sepa` it is refused before the checksum is even reached: `an PL IBAN is 28 characters; "PL151111111111111111" is 20.` `validateIban` checks the country's registered length before it checks the checksum, so a checksum that would validate can never paper over the wrong length |
| 2 | BIC given in lowercase | PASS, already correct | `qr_payment_sepa` with `bic: "deutdeff"` is accepted: `validateBic` uppercases before the format regex runs, so the accepted EPC record carries `DEUTDEFF` |
| 3 | Remittance text at 141 characters | PASS, already correct | Refused: `the remittance text is 141 characters; EPC069-12 allows 140.` 140 exactly is accepted. This boundary was already asserted at the `epcPayload` unit level (`test/unit.test.mjs`); it is now also asserted through the full tool call in `test/adversarial.test.mjs`, including that a rejected call leaves the register untouched |
| 4 | Amount given as the string `"1,230.00"` | PASS, already correct | Refused at the protocol layer before any server code runs: `Input validation error: Invalid arguments for tool qr_payment_sepa: Expected number, received string at amount`. The schema declares `amount: z.number()`, so a formatted string is never silently parsed (and never misread as 1.23 by stripping the comma) — it is refused outright, and the register cost is zero |
| 5 | `barcode_batch` with 501 rows | PASS, already covered | `test/adversarial.test.mjs` already asserts this: `${items.length} rows were given; one call draws at most 500. Split the list. Nothing was written.` No change needed |
| 6 | `out_path` traversal (`nested/../../up.svg`) | PASS, already covered | Already asserted in `test/adversarial.test.mjs`: resolved via `path.resolve`, not taken literally, and the response names the resolved path in full. Not sandboxed, by the documented decision |
| 7 | Corrupt `codes.json` | PASS, already covered | Already asserted in `test/adversarial.test.mjs`: quarantined byte-for-byte to `codes.json.corrupt-<stamp>`, a marker written, no fresh file created, and both `code_list` and any write fail with the same reason afterwards |
| 8 | Two processes hitting the monthly cap at the same time | PASS, already covered | Already asserted in `test/concurrency.test.mjs`: 30 concurrent calls against a 20-code allowance draw exactly 20 and refuse exactly 10, and the register holds exactly 20 rows. This is the fix from docs/BARCODE_RESULT.md's probe 20 (`reserve()` making the count and the row one critical section); nothing regressed it |

Four of the eight (#5-#8) were already probed and fixed in the prior pass and needed no new code;
they are listed here only to confirm the fix still holds. Four (#1-#4) were not yet in the test
suite as explicit assertions, though the underlying validation logic was already correct — no
source change was needed for any of the eight. All four were added as new tests in
`test/adversarial.test.mjs`:

- `an IBAN with a valid checksum but the wrong length for its country is refused on length, not silently accepted`
- `a lowercase BIC is normalized and accepted, not refused for case`
- `remittance text one character over the EPC limit is refused; exactly at the limit is accepted`
- `amount given as a formatted string is refused by the protocol, not parsed as a number`

---

## Final test summary

    npm run build -w servers/barcode   tsc clean, no output
    npm test -w servers/barcode        # tests 42 / # pass 42 / # fail 0

42 tests across `unit.test.mjs`, `adversarial.test.mjs` (now 15 assertions: 11 from the prior
pass plus the 4 above), `concurrency.test.mjs`, `contract.test.mjs` and `smoke.test.mjs`.

---

## RESULT.md block

    status: DONE
    evidence:
    - npm run build -w servers/barcode: tsc clean
    - npm test -w servers/barcode: # tests 42 / # pass 42 / # fail 0
    - Part 2: claude CLI 2.1.260, sonnet, barcode + invoice, per-tool allowlist, fresh XDG dirs
      in mcp.json's server env, shared profile (Nova Studio, IBAN PL61109010140000071219812874,
      Europe/Warsaw), 6 prompts, 2.67/3 (16/18), all six verified against codes.json/invoices.json
      on disk and prompt 1's SVG re-encoded byte-for-byte with the qrcode library directly
    - Part 1 gap-fill: 8 named probes (wrong-length-but-valid-checksum IBAN, lowercase BIC,
      141-char remittance, string amount, batch of 501, out_path traversal, corrupt register,
      two-process cap race). All 8 already correct on the shipped build; 4 were not yet asserted
      as tests and are now added; the other 4 were already covered by the prior pass and still pass
    artifacts:
    - /Users/mike/mcp-servers/servers/barcode/test/adversarial.test.mjs
    - /Users/mike/mcp-servers/docs/BARCODE_AUDIT.md
    cost: 35 wall minutes
    failures:
    - None found in server code. The one point lost in Part 2 (prompt 2) was a model
      tool-selection miss, not a wrong answer from any tool: it asked the user for an IBAN and
      name already present in the shared profile instead of calling invoice_payment_qr with
      just amount and reference, which reads both from the profile with no invoice required.
      No file was written and no allowance was spent, so nothing on disk is inconsistent with
      what happened; the description of invoice_payment_qr reads invoice-first, which likely
      steered the model away from its no-invoice path.
    insight:
    - The four Part 1 gaps that needed no code change (wrong-length IBAN, lowercase BIC, the
      remittance boundary, a formatted-string amount) are not evidence the risk was imaginary:
      each is a place where a slightly different implementation choice (checksum before length,
      case-sensitive regex, an off-by-one boundary, silent numeric coercion) would have shipped
      a real defect, and each was only confirmed correct by constructing the adversarial input
      and reading the actual refusal message, not by reading the code and reasoning that it
      looked right. The four that were "already covered" (batch 501, traversal, corrupt
      register, the concurrency race) are the ones a previous pass already forced into being
      correct the hard way, by measuring a failure first; this pass measuring them again and
      finding them still correct is what "the fix held" means, not a reason to skip
      re-measuring next time.

Built by theluckystrike. https://github.com/theluckystrike
