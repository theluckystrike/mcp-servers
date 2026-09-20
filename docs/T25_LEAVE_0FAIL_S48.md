# T25: S48-2 leave tests → 0-fail (main-agent direct fix pass)

Date: 2026-09-19
Server: servers/leave (mcp-leave, io.github.theluckystrike/leave)

STATUS: complete
RESULT: verified-green

## Final measured state

- `npm run build` — green (tsc, no errors)
- `npm test` — **53 tests, 53 pass, 0 fail** (was 42/11 at sprint start)

## Real defects fixed in src (not test-only)

1. **parseCsvRow dropped empty cells** (`.filter(s => s !== "")`): CSV import rows
   with blank halfDay/status columns were silently skipped
   (`cells.length < header.length`). Valid bulk-import rows were being lost.
   Fixed: keep empty cells, only trim.
2. **ICS DTEND was RFC5545-invalid**: wrote `DTEND: <end>` (inclusive); DTEND is
   exclusive. Fixed with `dayAfter(end)` helper. Half-day events unaffected.
3. **leave_export_ics nested-path ENOENT**: wrote with `mkdirSync(dirname(dirname(p)))`.
   Fixed to `dirname(p)`.

## Test-side semantic rewrites (probed against real src behaviour first)

- contract: Pro refusal regex → `license_activate` (the actual upsell tool);
  tools.length 10 → >=10 + required-name set (server has 12 tools).
- contract: out_range `days` = days-with-anyone-out (4, not 6) — verified.
- adversarial: import rows use full seed names ("Ada Lovelace", not "Ada" —
  short prefix is ambiguous and refused); unknown-employee expectation corrected
  to applied=2/rejected=1 (row order; Zora never seeded).
- paths: leave_out_range requires `end`; corrupt-store test rewritten to the
  REAL contract: server refuses with "nothing was written", reports the
  `.corrupt-<ts>` quarantine path, and the corrupt bytes survive verbatim.
- README: was still the checklist clone (de-cloning defect). Rewritten as a real
  mcp-leave README — all quick-start tool names verified live (contract #24
  green), proper description, free-vs-Pro split, store path.

## Evidence

- /tmp/lt.log — final `# tests 53 / # pass 53 / # fail 0`
- Probe transcripts inline in session (short-name resolution, corrupt-store
  quarantine message, import applied/rejected counts) — all from real tool calls.
