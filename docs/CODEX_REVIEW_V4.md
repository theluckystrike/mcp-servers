1. [servers/currency/src/rates.ts:39](/Users/mike/mcp-servers/servers/currency/src/rates.ts:39) — P1 — The six-decimal cross rate is used for conversion, producing `KWD 12.000` instead of `KWD 11.667`. Fix: multiply by `toPerEur / fromPerEur` at full precision and round only the target minor units. Trigger: `convertAmount({VND:30000,KWD:0.35}, 1000000, "VND", "KWD")`.

2. [servers/currency/src/ecb.ts:111](/Users/mike/mcp-servers/servers/currency/src/ecb.ts:111) — P1 — The fetch timer stops after headers while the lock expires after 30 seconds, so a stalled body lets another process replace the lock and an older response can overwrite a newer rate file with a later `fetched_at`. Fix: enforce the timeout through body consumption and use a lock lease longer than the operation. Trigger: process A receives headers then stalls 31 seconds; process B refreshes during an ECB publication; A finishes last.

3. [servers/currency/src/index.ts:110](/Users/mike/mcp-servers/servers/currency/src/index.ts:110) — P1 — Any cache miss is labelled “weekend or TARGET holiday,” including a weekday absent because the cache could not refresh. Fix: compare the request with the cache’s latest date and report unavailable history instead of inferring a non-publication. Trigger: history ends `2026-09-01`, refresh fails, `rate_on({date:"2026-09-02"})`.

4. [servers/timezone/src/tz.ts:283](/Users/mike/mcp-servers/servers/timezone/src/tz.ts:283) — P1 — ISO wall-clock fields are passed to `Date.UTC` without range or round-trip validation, so nonexistent dates roll forward. Fix: validate all fields and require the resulting wall components to equal the input. Trigger: `convert_time({time:"2026-02-30 09:00",from_zone:"Europe/Warsaw",to_zones:["UTC"]})` becomes March 2.

5. [servers/timezone/src/tz.ts:208](/Users/mike/mcp-servers/servers/timezone/src/tz.ts:208) — P1 — Wall times with zero or two matching instants are accepted without a policy: a DST gap moves by one hour and a fold selects the second occurrence. Fix: enumerate matching instants, reject gaps, and require `earlier` or `later` for folds. Trigger: Warsaw `2026-03-29 02:30` and `2026-10-25 02:30`.

6. [servers/timezone/src/zones.ts:202](/Users/mike/mcp-servers/servers/timezone/src/zones.ts:202) — P1 — Fixed abbreviations are mapped to DST-observing zones, so `EST` becomes EDT during summer. Fix: map fixed abbreviations to fixed offsets or reject them as ambiguous. Trigger: `convert_time({time:"2026-07-01 09:00",from_zone:"EST",to_zones:["UTC"]})` returns 13:00 UTC instead of 14:00 UTC.

7. [servers/timezone/src/index.ts:184](/Users/mike/mcp-servers/servers/timezone/src/index.ts:184) — P1 — `overlap` bases results on the UTC date containing local midnight, moving positive-offset requests to the preceding day. Fix: construct each boundary from the requested local calendar date, then convert it to UTC. Trigger: `overlap({zones:["Europe/Warsaw","America/New_York"],date:"2026-09-10"})` reports September 9 times.

8. [servers/timezone/src/tz.ts:465](/Users/mike/mcp-servers/servers/timezone/src/tz.ts:465) — P1 — Slot search discards the time portion of `firstDayUtc`, so the ranking can return meetings already past. Fix: reject slots whose start precedes the supplied lower-bound instant. Trigger: `findSlots([{name:"A",zone:"UTC",startMin:540,endMin:1020}],60,1,new Date("2026-09-07T16:00:00Z"))` ranks 12:30 UTC.

9. [servers/timezone/src/tz.ts:553](/Users/mike/mcp-servers/servers/timezone/src/tz.ts:553) — P1 — Attendee addresses are emitted without CR/LF rejection and `CN` uses TEXT escaping instead of parameter quoting, permitting content-line injection or rejected invites. Fix: validate calendar addresses, reject controls, and quote RFC 5545 parameter values. Trigger: `attendees:["a@example.com\\r\\nORGANIZER:mailto:x@example.com"]`.

10. [servers/timezone/src/tz.ts:411](/Users/mike/mcp-servers/servers/timezone/src/tz.ts:411) — P1 — Business-day inputs matching the date-shaped regex are not calendar-validated and normalize to other dates. Fix: apply a strict ISO-date round-trip validator to endpoints and holidays. Trigger: `businessDays("2026-02-30","2026-02-30","UTC")` returns `2026-03-02`.

11. [servers/docx/src/wordxml.ts:17](/Users/mike/mcp-servers/servers/docx/src/wordxml.ts:17) — P1 — Placeholder values containing XML 1.0 control characters are escaped but not rejected, producing a DOCX that Word repairs or refuses. Fix: reject or remove disallowed XML code points before escaping. Trigger: `fillDocx(template,{client:"Acme\\u0000Ltd"})`.

12. [servers/docx/src/wordxml.ts:256](/Users/mike/mcp-servers/servers/docx/src/wordxml.ts:256) — P1 — Replacing one placeholder moves the entire paragraph into the first text run and blanks the rest, removing run formatting and hyperlink placement. Fix: apply replacements to character spans while retaining unaffected run boundaries and properties. Trigger: normal run `"Pay "` followed by bold run `"{{amount}}"`.

13. [servers/docx/src/build.ts:91](/Users/mike/mcp-servers/servers/docx/src/build.ts:91) — P2 — Every ordered-list block uses one numbering instance, so later lists continue the earlier sequence. Fix: allocate a numbering reference or restart override per list block. Trigger: numbered `["a","b"]`, a paragraph, then numbered `["c"]`; Word labels `c` as 3.

14. [servers/docx/src/build.ts:61](/Users/mike/mcp-servers/servers/docx/src/build.ts:61) — P1 — Table width comes only from the header count, so cells beyond that count are discarded. Fix: require equal row widths or preserve the maximum column count. Trigger: `table:{headers:["Item"],rows:[["Consulting","USD 100"]]}` drops `USD 100`.

15. [servers/docx/src/index.ts:345](/Users/mike/mcp-servers/servers/docx/src/index.ts:345) — P1 — Template output checks existence before an unlocked write, so concurrent calls with `overwrite:false` can overwrite each other. Fix: reserve the path with exclusive creation or lock the existence check and write together. Trigger: two processes fill different values into the same `out_path`.

Verdict  
0 P0, 14 P1, 1 P2.  
Money, meeting times, invites, and DOCX contents can differ from the requested inputs.