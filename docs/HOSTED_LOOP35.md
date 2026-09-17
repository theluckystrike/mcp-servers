# HOSTED_LOOP35 - hosted endpoints for checklist, packing-list, delivery-schedule

Loop 35 wired the three servers that were missing from the remote worker onto it as
`/mcp/checklist`, `/mcp/packing-list` and `/mcp/delivery-schedule`, taking hosted coverage
from 34 of 37 to 37 of 37. Unlike loop 34, this loop DEPLOYED: one `wrangler deploy`, one
full `scripts/validate.mjs` run after it landed, and a live proof per endpoint - a real
mutating tools/call through the advertised URL shape with a minted token, plus a no-token
401 control per endpoint.

## Why the three were missing

The worker route table (`remote/src/index.ts` SERVERS) carried 34 endpoints;
`ls -d servers/*/` carries 38 directories; `createLicenseGate` is present in 37
`servers/*/src/index.ts`
(`/usr/bin/grep -l 'createLicenseGate' servers/*/src/index.ts | wc -l` -> 37; office-suite
is the 38th and is the stdio proxy bundle, not a sellable endpoint). The three in the
37 and not in the 34 were checklist, packing-list and delivery-schedule
(`comm -23 <(dirs) <(worker keys)`). All three are older servers at 0.21.0 whose wiring
gaps were named in docs/WIRING_LOOP34.md ("the pre-loop setup/compare gaps the loop brief
names on checklist, packing-list and delivery-schedule"); loop 34 vendored and routed only
the four servers it built, and the shim SERVER_COUNT 33 -> 37 drift fix that loop recorded
is what made the gap visible in the KPI. This loop closes it. No build-vendor.mjs patch
existed for any of the three
(`/usr/bin/grep -n 'checklist\|packing-list\|delivery-schedule' remote/build-vendor.mjs`
-> empty, pre-edit).

## Verdicts

| server | hosted | proof artifact (live) |
| --- | --- | --- |
| checklist | PASS - behaves as the stdio build; out_path reduced to a bare name, report published as a one-hour download | `CL-0001` from checklist_create; second request's checklist_list reads `total: 1`; no-token control 401 |
| packing-list | PASS - same out_path rule for packing_slip | `PL-2026-0001` from packing_list_create; packing_list_list reads `total: 1`; no-token control 401 |
| delivery-schedule | PASS - no file outputs exist, so no publish rule | `DS-2026-0001` from delivery_schedule_create; delivery_schedule_list reads `count: 1`; no-token control 401 |

The readSharedProfile question (all three read the shared business profile) has the loop34
answer: `remote/src/shims/license.ts` exports it, reading `/profile/business.json`, which
`remote/src/index.ts` hydrates from the `${tenant}:profile` KV document into EVERY
endpoint's request. Verified locally below (the issuer on a checklist report and a
delivery-schedule document comes from writeSharedProfile) and on the live packing-list
proof (`business_profile_missing: true` on a token with no profile - the endpoint read the
profile document and found it empty, rather than failing).

## Vendored files (remote/build-vendor.mjs SERVERS)

- `checklist`: index.ts, version.ts, checklist.ts, lib.ts, store.ts
- `packing-list`: index.ts, version.ts, lib.ts, packing.ts, store.ts
- `delivery-schedule`: index.ts, version.ts, lib.ts, schedule.ts, store.ts

## Patches added, with why

`patchChecklistIndex` (checklist index.ts), eight substitutions:

1. expandPath reduced to the bare document name (1-64 of letters, digits, underscore,
   dash; any .txt extension dropped). The hosted endpoint has no disk; a path argument is
   only the stem the download is named with. Same rule as bill-of-sale,
   statement-of-account, work-order, catalogue. The stdio URL_SCHEME_RE refusal goes with
   the rest of the stdio expandPath: a URL fails the name regex and the refusal explains
   the name rule.
2. outputPath targets `/out/<name><ext>` instead of `join(dataDir(), "documents", <id>)`
   and makes `/out` with the shim's mkdirSync (already imported by the stdio source for
   ensureDirBounded, so no import patch). The exclusive-create on an explicit name and the
   `-2`, `-3` dedupe on a derived one are unchanged.
3. The occupied-name error no longer quotes a virtual path (`a file named <name> was
   already produced in this request...`, the bill-of-sale wording).
4. run_report description: "Pro also writes it to out_path as a .txt file." becomes "Pro
   also gets it back as a .txt download link valid for one hour, named by out_path."
5. out_path schema description: name, not location ("Where to write the .txt file..."
   became "Name for the downloaded .txt file...").
6. run_report pro_note: "Pass out_path to write this to a .txt file." becomes "Pass
   out_path to get this report back as a .txt download link valid for one hour."
7. The `checklist://contract` resource reported `dir: dataDir()` - the worker's virtual
   homedir, a path no caller can open (the D-R60 species). It now reads "not a directory
   on this endpoint: the checklists and their runs are one document held per token...".
8. The same resource's description said "the one directory this server writes"; now "the
   one document this server writes".

`patchPackingListIndex` (packing-list index.ts), the same eight for packing_slip: the
report/slip asymmetry is only in the wording ("slip" for "report", and the description's
"Refuses a URL and refuses to overwrite unless told to" became "...named by out_path; an
existing name is refused unless told to overwrite", because the URL branch is gone and the
name regex carries the refusal).

`patchDeliveryScheduleIndex` (delivery-schedule index.ts), four substitutions plus one
assertion:

1. ASSERTED, not assumed (the change-order pattern): no `expandPath` and no `out_path`
   anywhere in the source. delivery_schedule_document returns the document INLINE and
   milestone_payload returns invoice_create/quote_create ARGUMENTS, so there is nothing to
   publish and nothing to reduce to a name; a later stdio release that grows a path
   argument fails this build rather than shipping a path.
2. The `deliveryschedule://contract` resource's `dir: dataDir()` becomes "not a directory
   on this endpoint: the schedules are one document held per token, and the schedule
   document comes back inline - delivery_schedule_document writes nothing".
3. The same resource's description: "the one directory this server writes" becomes "the
   one document this server writes".
4. Two sender notes named a local install: "Run business_set {name, address} in the
   invoice server once." and "Run business_set {default_tax_rate} in the invoice server,
   or pass tax_rate." now name `https://mcp.zovo.one/mcp/invoice`, the caller's own
   endpoint. The payload note "Call invoice_create in the invoice server with the
   arguments above" is unchanged: hosted, the invoice server is the caller's own
   /mcp/invoice endpoint and the sentence stays true.

The stores needed no patch: templates.json/runs.json/counter.json (checklist),
packing-lists.json/counter.json (packing-list) and schedules.json/counter.json
(delivery-schedule) are one document per token under the homedir shim, written tmp +
rename. The report and the slip publish on writeAtomic's rename through the fs shim
(`publish: (p) => p.startsWith("/out/")` in both SERVERS entries), so the download
endpoint serves rendered documents only, never the JSON store. `strip: ["/out/"]`,
`persistPublished` unset (a report and a slip are transient downloads, not tenant state).

No existing patch was loosened; patches dispatch by server name and the three new patch
functions run only for their own entries.

## Shim reuse / gaps

- fs shim: reused unchanged. The two file-writing tools use closeSync, existsSync,
  mkdirSync, openSync "wx", renameSync, writeFileSync - all present - and publish on the
  rename, the bill-of-sale path.
- os shim: reused unchanged (`homedir()` = /home/mcp; the stores land under
  `/home/mcp/.local/share/mcp-servers/<name>/` inside the tenant document).
- license shim: reused unchanged for createLicenseGate, withFileLock (no-op per request),
  readSharedProfile. SERVER_COUNT was already 37 (loop 34); untouched here.
- EXTRA_IMPORTS: two entries - checklist and packing-list each get
  `import { Buffer } from "node:buffer"` (Buffer.byteLength reports the byte count of the
  written report/slip; neither stdio source imports it). delivery-schedule needs none.
- LIB_RESOLUTIONS: three entries. `checklist: ["quotes", "timezone"]`,
  `packing-list: ["quotes", "timezone"]` (today/isIsoDate from index.ts; readJsonFile from
  store.ts), `delivery-schedule: ["invoice", "quotes", "timezone"]` (formatMoney and
  today/isIsoDate from index.ts; readJsonFile from store.ts). All asserted on the written
  bytes by the build; all three dependency libs were already vendored.
- VENDORED_LIBS passes for all three (no `./pdf.js` re-export anywhere).
- No new shim was written. No storage pattern needed one.

## Worker wiring (remote/src/index.ts)

- Three factory imports, three SERVERS entries (checklist and packing-list with
  publish/strip on /out/; delivery-schedule factory-only), three TOOLS entries, three
  indexDoc endpoint entries.
- No sharedDoc anywhere: checklist's run reference and packing-list's order reference are
  NAMES ("Named only; no sibling store is opened" is the run_start schema's own words;
  packing_expect's description says nothing is read from the quotes, work order or invoice
  store), and delivery-schedule opens a reference by id and returns payloads. The shared
  business profile is hydrated into every endpoint already and is not a sharedDoc.
- BUILD_VERSION bumped 2026-09-12.1 -> 2026-09-12.2 (the tools/list cache key).

## Tests

- /tmp/hosted-loop35-smoke.test.mjs (NOT committed - remote/test/ is outside this agent's
  loop-35 ownership; wave C can port it in). Boots each vendored createServer over the
  SDK's InMemoryTransport inside the request context, the hosted-loop34.test.mjs pattern
  including the timezone/lib.js data: stub. 4 tests, 4 pass:
  - checklist: the exact 16 stdio tool names; create -> item_add x2 -> run_start (steps
    copied in) -> run_check x2 -> run_sign_off; the free inline report carries the shared
    profile's issuer name; Pro out_path "bx21-feb-report" writes `/out/bx21-feb-report.txt`
    and publishes exactly one download; "/tmp/evil/report" reduces to the stem "report"
    (the bill-of-sale rule) and "bad name!" is refused; a second call sees the run.
  - packing-list: the exact 14 tool names; create (WO- infers work_order) -> expect ->
    carton_add (800 g tare, 100x30x20 cm) -> pack_item (4 x 2500 g) -> carton_report
    (net 10,000 g, gross 10,800 g, volumetric 12,000 g at divisor 5000, chargeable
    12,000 g) -> shortfall complete and ready_to_ship -> packed -> shipped with carrier;
    the Pro slip publishes `/out/wo-44-slip.txt`; the slip text carries no prices.
  - delivery-schedule: the exact 12 tool names; create -> DS id; the one-schedule-per-
    reference refusal; deliverable_add 90,000 minor EUR reads "EUR 900.00" (the vendored
    invoice engine's formatMoney); a due date before the reference date refused;
    late_report as at 2026-08-12 reads days_late 2 and value_at_risk 90,000, and as at the
    due date itself reads due_today not late; delivered then accepted; the Pro document
    comes back INLINE with the sign-off block and ZERO downloads published;
    milestone_payload totals 90,000 + 23% = 110,700 minor, drift zero, invoice items in
    MAJOR units (900) and quote items in MINOR (90000), quote_create.ready true.
  - delivery-schedule free tier: the two Pro tools refuse on a free context, nothing
    written.
- `node remote/build-vendor.mjs` exits cleanly (all patches applied or the build throws):
  `vendored checklist/packing-list/delivery-schedule` lines present, exit 0.
- `npm test` in remote/: 64 tests, 64 pass, 0 fail - vendor-paths.test.mjs scans the three
  new vendored trees generically and passes.
- `wrangler deploy --dry-run`: `Total Upload: 6825.51 KiB / gzip: 1548.67 KiB`
  (6659.94 KiB at loop 34), no build errors.
- scripts/validate.mjs was NOT edited (outside this agent's ownership): its tools/list
  sweep at line 2175 is a static list of 34 names, so the three new endpoints are not yet
  swept by it. Recorded for wave C.

## Deploy and post-deploy validation

One deploy, then one validation run after it landed (CLAUDE.md trap 8):

    cd /Users/mike/mcp-servers/remote && npx wrangler deploy
    # Uploaded mcp-remote (8.43 sec); route mcp.zovo.one/mcp* active;
    # Current Version ID: 1eb02999-50ee-4719-bcb4-6200daef3853
    sleep 30
    cd /Users/mike/mcp-servers && node scripts/validate.mjs
    # validation db: data/validation.json run 50: 1135/1135

Check count before/after: 1135/1135 (run of record before the deploy) -> 1135/1135 (run 50,
after). Unchanged by design: the sweep list is static and the three endpoints are proven by
the live probes below instead. Every pre-existing hosted endpoint, remote 134/134 and
billing 36/36 included, passed against the DEPLOYED worker, so the deploy broke nothing.

## Live proof (the shipping test)

Token: ONE mint, `curl -s 'https://mcp.zovo.one/mcp/connect?mint=1'` ->
`anon_cd36a4abfd4da3d8161eff530e31908c`, reused for every call (the mint route is limited
to 10/IP/hour and an exhausted mint returns an EMPTY token, which reads as a spurious 401).

Per endpoint: a real mutating tools/call through `https://mcp.zovo.one/mcp/<server>` with
`Authorization: Bearer <token>`, then the identical call with NO token as the control.

- checklist: `checklist_create {name: "Loop 35 hosted proof", category: "proof"}` ->
  `"id": "CL-0001"` (verbatim artifact id). Control: 401. Persistence: a separate
  `checklist_list` request reads `"total": 1` - the write reached KV, not just the request.
- packing-list: `packing_list_create {reference: "WO-2026-0044", consignee: "Loop 35
  Proof Co", date: "2026-09-12"}` -> `"id": "PL-2026-0001"`, `reference_kind:
  "work_order"` inferred, `business_profile_missing: true`. Control: 401. Persistence:
  `packing_list_list` reads `"total": 1`.
- delivery-schedule: `delivery_schedule_create {reference: "WO-2026-0044",
  reference_date: "2026-09-01", client: "Loop 35 Proof Co", title: "Hosted endpoint
  proof", currency: "EUR"}` -> `"id": "DS-2026-0001"`, `value: "EUR 0.00"` from the
  vendored invoice engine's formatMoney. Control: 401. Persistence:
  `delivery_schedule_list` reads `"count": 1`.

## Files touched

- remote/build-vendor.mjs (SERVERS x3, patchChecklistIndex, patchPackingListIndex,
  patchDeliveryScheduleIndex, EXTRA_IMPORTS x2, LIB_RESOLUTIONS x3, dispatch x3)
- remote/src/index.ts (imports x3, SERVERS x3, TOOLS x3, indexDoc endpoints x3,
  BUILD_VERSION 2026-09-12.2)
- docs/HOSTED_LOOP35.md (this file), data/hosted_loop35.json

Not touched (named for wave C / the orchestrator, none of it this agent's to edit):
servers/<x>/remotes.json for the three (invoice shape, still absent - the mcpb manifests
therefore cannot merge a remotes block yet), scripts/validate.mjs (add the three names to
the line-2175 tools/list sweep), data/distribution.json per_server.hosted rows (the
reconciliation HOSTED_LOOP34 sequences post-deploy; the loop34 hosted-row waivers in
scripts/release-check.mjs do not cover these three, whose rows were never added), the
storefront product/setup pages and llms.txt lines for the three endpoints, and
servers/office-suite (deliberately never hosted: it is the stdio proxy bundle).
