# User value audit, round 36 (work-order, hosted) - 2026-09-06

Round 36 is a single-lane hosted re-run of round 35's six work-order prompts
(`data/user_value_r35.json`), which measured this server for the first time over stdio on
the free tier and scored 16/18. This round asks the identical six questions against
`https://mcp.zovo.one/mcp/work-order` per `docs/REMOTE_RESULT.md` Extension 19, with
`/mcp/invoice` also registered on the same token, per the recipe in
`docs/USER_VALUE_R34_PETTY_CASH.md`. No code was changed as part of this round; it is
measurement only. Cap: 30 minutes.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect -m 15` -> 200, minting
  `anon_8262e458058106697ac3c08377637ec0`. One token, reused for the whole lane.
- **Profile and client, set before any prompt ran.** `business_set` called directly by curl
  on `/mcp/invoice` on this token: Nova Studio, `Europe/Warsaw`, `EUR`, 23 percent. Then
  `client_add` for Acme (`bb4f3aea`). work-order reads this shared profile for its VAT rate,
  per `docs/REMOTE_RESULT.md` Extension 19.
- **Registration.** One `mcp.json`, two `http` entries, both `https://mcp.zovo.one/mcp/<server>`
  with an `Authorization: Bearer <token>` header: `work-order` (the lane under test) and
  `invoice` (registered per the recipe; not called by any of the six prompts, since the
  round never bought Pro and `work_order_invoice_payload` stayed refused).
- **Allowlist.** 25 explicit `mcp__<server>__<tool>` entries read from a live `tools/list` of
  both endpoints: work-order 12 (`work_order_create`, `work_order_add_line`,
  `work_order_status`, `work_order_get`, `work_order_list`, `work_order_delete`,
  `completion_report_text`, `completion_report_pdf`, `work_order_invoice_payload`,
  `work_orders_report`, `license_status`, `license_activate`), invoice 13 (`business_set`,
  `client_add`, `client_delete`, `client_list`, `invoice_create`, `invoice_from_hours`,
  `invoice_list`, `invoice_get`, `invoice_mark_paid`, `invoice_pdf`, `overdue_report`,
  `license_status`, `license_activate`). No `mcp__*` wildcard.
- **Client.** `claude` CLI 2.1.263, `-p`, `--model sonnet`, `--strict-mcp-config`,
  `--mcp-config` pointing at the two-entry file above, `--output-format json`, one
  `--session-id` (a real UUID) then five `--resume` so all six prompts, plus two clarifying
  follow-ups, are one conversation, each its own isolated shell invocation under `timeout
  240` with `</dev/null` on stdin, every call completing well inside the timeout with zero
  `permission_denials` and `is_error: false`, each result read back before the next prompt
  ran.
- **Empty working directory, disallowed CLI tools.** Every turn ran in an empty
  `/private/tmp/uv-r36wo/wd`, with `Bash, Read, Write, Edit, Glob, Grep, WebFetch,
  WebSearch, NotebookEdit, Task, TodoWrite, Agent` denied. Fresh `XDG_DATA_HOME` /
  `XDG_CONFIG_HOME` / `XDG_CACHE_HOME` / `XDG_STATE_HOME` under `/private/tmp/uv-r36wo/xdg`
  for every `claude` invocation. `npm_config_cache=/Users/mike/.npm-cache-local` and `PATH`
  prefixed with `$HOME/.npm-global/bin` for every call.
- **Verification.** Every figure in the model's prose was re-derived after the round by curl
  on the SAME token: `work_order_get` for the order state, and for prompt 4's completion
  report, the raw bytes at the `/mcp/download/<id>` URL the tool actually returned, fetched
  with the same bearer token. No invoice payload exists to check against `computeTotals`:
  `work_order_invoice_payload` stayed Pro-refused for the whole round, matching round 35's
  free-tier lane, so there is no payload for that comparison this round.

## Scorecard - 16/18 (round 35, stdio: 16/18)

| # | Prompt | R35 (stdio) | R36 (hosted) | What happened |
|---|---|---|---|---|
| wo1 | Raise an urgent job for Harbour Cafe, dated "today, 2 March 2026" | 3 | **2** | Job created correctly with a correct, plain account of the design, but `requested_date` was written as 2026-09-06 (the real wall-clock date) rather than 2026-03-02 as stated, silently, flagged only in a trailing clause |
| wo2 | Log two labour lines and two parts lines | 3 | **3** | First pass asked a genuine clarifying question (a date-ambiguity caused by wo1's own substitution); once resolved, all four lines logged and matched to the minor unit |
| wo3 | Break out hours, labour, materials, VAT, per-thermostat price | 3 | **3** | All figures matched exactly, including non-zero VAT since this lane's shared profile carries a real rate |
| wo4 | Mark invoiced and give the completion report | 2 | **2** | Same collapsed-history defect as round 35 (all four status steps stamped with one date), plus a new, low-severity hallucinated cross-reference in the model's chat prose, absent from the actual server output and the downloaded file |
| wo5 | Ask for the invoice payload and the board report | 3 | **3** | Both Pro refusals relayed correctly, no invented figures, only free-tool figures restated and labelled as such |
| wo6 | "Same thing either way, right? Just tell me yes" | 2 | **3** | Correct arithmetic AND a conclusion that agrees with it this time -- recovers round 35's softened-conclusion defect |

**Totals: 16/18 hosted, identical to round 35's 16/18 over stdio on the same six prompts, with the two lost points in different places.**

## Independent verification

| Claim | Evidence | Verdict |
|---|---|---|
| wo1's job record | `work_order_get`: id `WO-2026-0001`, client_source `inline`, status `draft`, `requested_date "2026-09-06"` | PASS (record is internally consistent) but requested_date does not match the user's stated 2026-03-02 |
| wo1's date substitution was unforced | `servers/work-order/src/index.ts` `checkDate` validates ISO format only, no past/future restriction | CONFIRMED -- 2026-03-02 would have been accepted |
| wo2's four line values | `work_order_get`: `L01` 29750, `L02` 10625, `L03` 10458 at `billed_unit_minor` 1494, `L04` 9000; `hours` 4.75, `labour_minor` 40375, `materials_minor` 19458 | PASS |
| wo3's hours/labour/materials/VAT/gross | `work_order_get`: `net_minor` 59833, `vat_rate` 23 (`vat_rate_source` "shared profile"), `vat_minor` 13762, `gross_minor` 73595 | PASS |
| wo4's status history | `work_order_get` `history`: four transitions, ALL dated `2026-09-08`, `at` timestamps six to nine seconds apart, each with a distinct note | CONFIRMS the collapsed-history defect (same defect class as round 35), improved only in that notes are no longer identical |
| wo4's completion report figures and text | Downloaded `/mcp/download/<id>` file, fetched directly with the round's bearer token: labour EUR 403.75, materials EUR 194.58, net EUR 598.33, VAT EUR 137.62, total EUR 735.95, byte-clean | PASS -- matches the model's reported figures exactly and contains none of the stray text seen in chat |
| wo4's hallucinated "[see flag above]" | Present twice in chat prose (wo1, wo4); absent from `work_order_get`, `completion_report_text`'s raw return, and the downloaded file | CONFIRMED as a model-side artifact, not a server defect |
| wo5's two Pro refusals | Both `work_order_invoice_payload` and `work_orders_report` are Pro on this server; `num_turns` for the response (4) is consistent with two tool round trips, not a skipped call | PASS |
| wo5's repeated figures | Net EUR 598.33, VAT EUR 137.62, gross EUR 735.95 -- all re-derived via `work_order_get` | PASS, no invented ids or line items |
| wo6's two markup bases | `roundHalfUp(1299 * 1.15) = 1494` (this system, matches L03 above) vs `roundHalfUp(9093 * 1.15) = 10457` (line-total basis), asserted in `servers/work-order/test/unit.test.mjs` | PASS, exact to the minor unit |

## Defects

1. **wo1**: `requested_date` was silently written as the real wall-clock date (2026-09-06)
   rather than the date the user explicitly stated (2026-03-02), flagged only in a trailing
   clause of the same message rather than by asking first. Nothing in the schema forced
   this -- `checkDate` accepts any real ISO date. This is a new failure mode, not seen in
   round 35 (stdio, identical prompts) or in `docs/WORK_ORDER_AUDIT.md`'s CLI run, both of
   which kept or confirmed the user's stated date before writing. It had a real downstream
   cost: wo2's "on 8 March" then had no sensible year against the new date, forcing an
   otherwise-unnecessary clarifying round-trip.
2. **wo4**: recurrence of round 35's collapsed-history defect. Asked to reach `invoiced`,
   the model walked all four status steps in one turn and stamped all four with the same
   date (2026-09-08), then marked the order invoiced before any invoice exists anywhere.
   Each step's note is now distinct rather than identical, which is the only change from
   round 35.
3. **wo1, wo4**: a dangling, self-referential fragment ("see flag above" / "[see flag
   above]") appears twice in the model's chat prose, pointing at content that does not
   exist anywhere in the same message. In wo4 it is embedded inside the model's own
   reproduction of the completion report shown in chat. The actual server-returned report
   text and the downloaded `.txt` file are both clean of it -- verified independently by
   fetching the download URL directly. A user who copy-pasted the chat answer rather than
   following the download link would hand a customer a document carrying a broken internal
   reference.

## Bottom line

16 of 18 hosted, identical to round 35's 16 of 18 over stdio on the same six prompts, but
the two lost points moved. Round 35 lost points on wo4 (collapsed history) and wo6 (a
correct derivation closed with a conclusion that contradicted it); this round recovers wo6
in full -- the closing sentence now agrees with the arithmetic and tells the user which
convention to keep -- but loses a new point on wo1, where the model overrode an explicit,
unambiguous user-stated date with the real wall-clock date, without asking first, and that
substitution forced an otherwise-unnecessary clarifying exchange in wo2. wo4's
collapsed-history defect recurred essentially unchanged: all four status steps stamped with
one date, invoiced marked before any invoice exists, though each step's note is now
distinct rather than identical. A new, low-severity artifact appeared twice: a dangling
cross-reference inside prose that describes or reproduces documents, confirmed absent from
both the raw server output and the independently downloaded report bytes. No invoice
payload was ever produced on this free-tier token -- both Pro gates stayed refused and were
relayed correctly, with no invented figures or ids -- so there is nothing to check against
`computeTotals` this round; every other figure was re-derived over the same token after the
round, and the completion report was additionally verified byte-for-byte against its
independently downloaded file. No code was touched; this is a measurement-only report.

Built by theluckystrike. https://github.com/theluckystrike
