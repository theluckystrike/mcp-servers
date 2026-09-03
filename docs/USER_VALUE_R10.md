# User value audit, round 10 — 2026-09-03

Round 10 is the **hosted arrival round** (plan v4, task 3). Every earlier round scored the servers
as a local process on this machine. This one scores what a stranger on claude.ai actually gets: six
hosted endpoints, connected by URL with no headers, on a token minted thirty seconds earlier, on the
free tier, with an empty data space.

## Method

- **Arrival.** `curl https://mcp.zovo.one/mcp/connect` -> 200 `text/html`, 7,097 bytes, minting
  `anon_49285ffeb6a7468bb57086eaf8df1e80` and printing a ready URL for all twelve endpoints. Nothing
  else was read to get started.
- **Registration.** In a temp project `/private/tmp/uv52`, six local-scope entries, one command each
  and **no `--header` anywhere**:
  `claude mcp add --transport http --scope local <name> https://mcp.zovo.one/mcp/<name>/t/<token>`
  for `invoice`, `time-tracker`, `expense-tracker`, `timezone`, `docx`, `currency`.
  `claude mcp list`: **all six Connected**, first try, and again after the mid-round redeploy.
- **Allowlist.** 103 entries written from a live `tools/list` POSTed to each endpoint — invoice 12,
  time-tracker 14, expense-tracker 14, timezone 11, docx 14, currency 10 = 75 tools, plus underscore
  variants of the two hyphenated names as insurance (`--allowedTools "mcp__*"` grants nothing, D-E4).
- **Client.** `claude -p --model sonnet --output-format stream-json --verbose --max-turns 18`, one
  `--session-id` then seven `--resume`; scenario 8 is a **brand-new session** on the same six URLs.
- **Free tier, no fixture.** Fresh anonymous token, `tier: free`, `bound: false`. No seed of any
  kind: every row below was created by the model in this run.
- **Clock.** Run start 16:24 UTC, Thursday 2026-09-03. Tool-call counts exclude the client's own
  `ToolSearch` schema lookups.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap to close. 1 = partially wrong, or asked for something the tool
could infer. 0 = failed.

## Scorecard — 19 / 24

| # | Endpoint(s) | Scenario | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|---|
| 1 | invoice | "I am Lucky Strike Software in Warsaw, VAT PL1234567890, EUR, 23% VAT, 14-day terms." | **2** | 1 | 19.6 | One `invoice_business_set`, every fact landed, and the response named the shared profile and the seven servers that read it. Then two deductions: the model wrote the same facts into the CLI's own project memory directory (D-R49) right after being told it need not repeat them anywhere, and **no timezone reached the profile** — "in Warsaw" became an address, `business_set` neither inferred `Europe/Warsaw` nor asked (D-R48), so nothing declared the home zone that r9's D-R35 fix reads. |
| 2 | time-tracker + expense-tracker | "Log 4 hours today on Nova at 90 EUR and a 61.50 EUR Adobe receipt for Nova." | **3** | 2 | 14.3 | `entry_add` -> Nova, 09:00, 4.00 h, EUR 90.00/h, EUR 360.00. `expense_add` -> EUR 61.50 = net EUR 50.00 + VAT EUR 11.50 **at 23%, named as coming from the profile written one sentence earlier**. Both re-read from the endpoints afterwards by curl. |
| 3 | currency + expense-tracker + invoice | "Invoice Nova for that in USD at today's ECB rate and give me the document." | **2** | 6 | 46.2 | The chain is unusually complete: `rates_latest` (1 EUR = 1.1615 USD, dated today), `expense_to_invoice` pulling the receipt through as a net USD line, `invoice_create` -> INV-2026-0001, `invoice_pdf`, then `entry_mark_billed` **and** `expense_mark_rebilled` against the invoice number so nothing can be billed twice. The document is real: 200, `text/html`, 1,906 bytes, carrying the business name, the VAT id and USD 585.78 — the same total as the prose. Deduction: the hours line went in as `unit_price 104.535`, the server rounded it to `104.54` and multiplied, so the line is USD 418.16 where 4 x 90 x 1.1615 = **418.14**, and the total is three cents above the rate the invoice cites, silently (D-R46). |
| 4 | docx | "Write a two-paragraph proposal for Nova's phase 2, 6,000 EUR, as a Word file." | **2** | 1 | 24.1 | One call, and a real Word file: `PK\x03\x04`, the OOXML content-type, `filename="nova-phase-2.docx"`, 10,985 bytes. `word/document.xml` carries the letterhead from the shared profile, `[add: email]` instead of an invented address, **zero `@` characters**, EUR 6,000.00, and the two paragraphs as two real `w:p` runs. Deduction: `proposal_create` requires scope, deliverables and a timeline, so "two paragraphs" came back with a 4-phase timeline the model invented — disclosed, which is why this is 2 (D-R47). |
| 5 | timezone | "Find a one-hour slot next week with Tom in Austin inside 9 to 17 for both of us." | **3** | 2 | 27.6 | `contacts_list` first, then `find_meeting_slots` Mon–Fri with both windows 09:00–17:00 and the bare place name "Austin" resolved server-side. Five slots, all the same hour: **16:00–17:00 Warsaw = 09:00–10:00 Austin**, the only hour two 9-to-17 days share across a 7-hour offset (CEST +02, CDT −05). The model said exactly that — the choice is which day, not which hour. |
| 6 | invoice free cap + checkout | "Add three more clients with invoices so I hit the free limit." | **2** | 4 | 48.9 | Turn one **refused and asked**, because `license_status` returns tier and an upgrade URL and nothing else — no cap, no usage, no pointer — so the model said it could not see an invoice cap (D-R44). Turn two ran it: two invoices created, and the **fourth of the month refused**: "You have already created 3 invoices in 2026-09. The free tier allows 3 invoices per calendar month", with the upgrade line. The whole checkout path then verified: link carries `?tenant=anon_4928...`, `x-mcp-probe:1` -> **303** to `checkout.stripe.com`, and `stripe checkout sessions list --live --limit 1` shows that session with `metadata.tenant` = the token and `client_reference_id` the same. |
| 7 | all six | "What is my tier and how do I upgrade?" | **2** | 5 | 15.6 | Correct in one turn — free on all six, one token, $19 each with a tenant-carrying link, $39 for every server — and it declined to buy anything itself. Two deductions: `whoami` is an HTTP GET, not a tool, so there is no single call that answers the question and the model paid **one `license_status` per server**, five in a row (D-R50); and the $39 price was named with **no link**, though `/buy/bundle` exists and 303s to Stripe with the same tenant metadata (D-R43). |
| 8 | invoice, new session | "What did I invoice this month?" | **3** | 1 | 10.2 | A session that had never seen any earlier turn read all three invoices back from the same URL with one `invoice_list`, totalled the two EUR invoices to EUR 2,460.00 and **kept the USD 585.78 separate** rather than mixing currencies, and flagged the two placeholder clients. Server-side state per anonymous token, at the URL, with nothing pasted. |

**Totals: 19 / 24, 22 tool calls, 206.5 s.** Not comparable to r9's 23/24 — r9 re-scored eight known-weak
sentences against the bundle on disk; this scores eight fresh scenarios against six hosted endpoints
reached by URL. The three 3s are where the hosted path adds nothing to break. **Four of the five
deductions are about what the endpoint tells the model about itself, not about what it computes.**

## Independent verification

Every number below was re-read from the hosted endpoints by `curl` `tools/call`, or from the
downloaded files — not from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| Arrival needs no header | six `/t/<token>` entries, `claude mcp list` all Connected; no `Authorization` header anywhere in the round | PASS |
| Hours as stated | `entry_list {unbilled_only:false}` -> `3ebc2fda 2026-09-03 09:00 Nova 4.00 h y`, 4.00 h total | PASS |
| VAT split from the profile | `expense_list` -> `13e6893d EUR 61.50, net EUR 50.00, vat EUR 11.50, vat_rate 23`, project Nova, billable, rebilled | PASS |
| The invoice document exists | `GET /mcp/download/dcdc8052…` -> 200, `text/html; charset=utf-8`, 1,906 B, contains `Lucky Strike Software`, `PL1234567890`, `USD 585.78` | PASS |
| The invoice arithmetic | `invoice_get INV-2026-0001` -> `unit_price_minor 10454`, `gross_minor 41816`, `total_minor 58578`; the ECB conversion is 418.14 / 585.75 | **FAIL, D-R46** |
| The proposal is a Word file | OOXML content-type, `nova-phase-2.docx`, first bytes `504b 0304`, 10,985 B; `document.xml` has the profile letterhead, `[add: email]`, 0 `@`, `EUR 6,000.00`, no literal `\n` | PASS |
| Meeting math | 2026-09-07: Warsaw UTC+02, Chicago UTC−05, so 14:00 UTC = 16:00 / 09:00, the only shared hour | PASS |
| Free cap | 4th `invoice_create` of the month refused, cap named as 3 per calendar month; re-verified by curl after the redeploy | PASS |
| The checkout link carries the tenant | `303` -> `cs_live_b1XRJc3H…`; Stripe shows `metadata {probe:1, product:invoice, tenant:anon_49285ffe…}`, `client_reference_id` the same. `/buy/bundle?tenant=` -> 303, `metadata.product bundle`, same tenant | PASS |
| State is server-side | a session with no history read three invoices back from the same URL | PASS |
| After the fixes | `license_status` reports `source` as the **real** form on all three (path / query / header), and now carries `bundleUrl`, `price_usd`, `limits`, `guide`; the cap text carries the `/buy/bundle` link; `whoami` reports `token_arrived_via` | PASS |

## Defects

Hosted-specific, server-side, in `remote/` — **all four fixed and deployed this round** (version
`7d3f5812-4360-4c87-88f3-182dbf24fbca`; `servers/` untouched).

**D-R42 (medium) — `license_status` told every caller its token came from an `Authorization` header,
including the URL-token callers who have no header field.** Repro:
`POST /mcp/invoice/t/<token>` `license_status` -> `"source": "Authorization: Bearer"` on a request
with no `Authorization` header at all; same for `?token=`. That is a lie to precisely the audience
the URL forms exist for. Fix: `RequestCtx.authVia` in `remote/src/shims/ctx.ts`; `remote/src/index.ts`
records which of the three forms actually carried the token in `Auth.via` (the header still wins when
both are present) and threads it into the request context; `remote/src/shims/license.ts` reports it.
`GET /mcp/whoami` gained `token_arrived_via` on the same wiring.

**D-R43 (medium) — the $39 every-server price was quoted in every free-cap message and never
linked.** Repro: the 4th `invoice_create` -> "Pro is a one-time $19 (or $39 for every server,
lifetime). Buy at …/buy/invoice?tenant=…" — the $39 has no URL, and scenario 7 relayed that price to
the user with no way to act on it, while `/buy/bundle?tenant=<token>` already 303s to Stripe with
`metadata.tenant` set. Fix: `bundleUrl()` in the license shim, inlined next to the $39 in
`upgradeText` and returned from `license_status` as `bundleUrl`, with `price_usd {single,
every_server}`.

**D-R44 (medium) — `license_status` carried no limit information, so a model asked about "the free
limit" had to discover the caps by tripping them.** Repro: `/private/tmp/uv52/out/s6.jsonl` —
`license_status` returns only product, tier, transport, tenant, source, upgradeUrl, and the model
answered "I don't see a numeric cap on invoice creation itself" and asked two questions instead of
acting. That is the whole of scenario 6's deduction. Fix: `license_status` now also returns `limits`
— stating plainly that the tool does not count usage, that a call over a cap is refused with the cap
named, and where the per-server caps are written — and `guide`. Live usage counters are per-server
state in `servers/*` and out of scope for a remote-only fix.

**D-R45 (low) — `license_activate` told a URL-token caller to reconnect with a header, the one field
their client does not have.** Fix: the description and the response now lead with
`…/mcp/<product>/t/MCPL1….`, keep the header as the alternative, and add that a purchase made from a
`?tenant=` link needs nothing pasted at all, because Pro is already on for that connection and that
data.

**D-R50 (low, partially addressed) — `whoami` is reachable only as an HTTP GET, so "what is my tier"
costs one `license_status` per connected server** (five in a row in scenario 7). The per-endpoint half
is now closed — one `license_status` answers the tier question completely, with the real auth form,
both prices, both links and the limits pointer. A cross-endpoint answer would need `whoami`
registered as a tool on every endpoint, which is a vendored-server change, not a remote-only one.

Not hosted-specific — same on disk, in code this round was not allowed to edit:

**D-R46 (medium, invoice) — `invoice_create` rounds a fractional `unit_price` to minor units and then
multiplies, so a converted hourly line drifts from the rate it names.** Repro:
`items: [{quantity: 4, unit_price: 104.535, tax_rate: 23}]` -> `unit_price_minor 10454`,
`gross_minor 41816`, against 4 x 90 x 1.1615 = 418.14; INV-2026-0001's total is three cents above the
ECB conversion printed on the same invoice. Nothing in the response says a unit price was changed.
Fix direction: keep sub-minor unit prices and round once at the line, or name the rounding the way
the response already explains line-then-sum rounding for the total.

**D-R47 (low, docx) — `proposal_create`'s required sections turn "a two-paragraph proposal" into
three sections of invented content.** Fix direction: make scope/deliverables/timeline optional, or
emit a placeholder the way the letterhead already emits `[add: email]` rather than leaving the model
to fill the gap.

**D-R48 (low, invoice + timezone) — "I am … in Warsaw" set an address but no timezone, and
`business_set` neither infers one nor asks.** The profile came back with no `timezone` field and the
response did not mention it, although `timezone` resolves bare place names perfectly well one
sentence later (scenario 5 passed `zone: "Austin"`). r9's D-R35 fix reads exactly that field.

Client-side:

**D-R49 (low) — the model copied the business facts into the CLI's project memory directory
immediately after the tool said not to repeat them anywhere.** Repro: `out/s1.jsonl`, a `Write` to
`.../projects/-private-tmp-uv52/memory/business_profile.md` and a rewrite of `MEMORY.md`, straight
after `invoice_business_set` returned "You do not need to repeat it anywhere else." Two copies of one
identity, free to drift. Not fixable server-side; the wording is already as explicit as it can be.

## Bottom line

The hosted path itself is sound. A stranger goes from one `curl` to six Connected endpoints with no
headers, states who they are once, and that one sentence then supplies the VAT split on a receipt,
the letterhead on a Word file and the tax rate on an invoice — across six separate endpoints, and
across a session boundary, with nothing pasted and nothing local. The money path is real end to end:
the cap fires on the fourth invoice of the month, the link carries the anonymous token, and Stripe's
live session records that token as `metadata.tenant`, which is what makes Pro switch on for the same
connection and the same data.

What is weak is self-description, and it is weak in one specific way: **the endpoint knows things
about itself that it does not tell the model.** It knew the token arrived in a URL and claimed a
header. It knew the bundle price and withheld the bundle link. It knew the caps and offered no
pointer to them, so the only way to learn the free limit was to hit it. Four of the five deductions
were that, and all four are fixed and deployed. The two that remain are arithmetic and schema
questions in `servers/`, for the round that is allowed to touch them.

## RESULT.md block

```
status: DONE
evidence:
  arrived as a claude.ai user would: GET /mcp/connect minted anon_49285ffe... and printed the URLs;
    six hosted endpoints registered with `claude mcp add --transport http` and NO headers
    (invoice, time-tracker, expense-tracker, timezone, docx, currency), claude mcp list all Connected
  one conversation, 8 scenarios (7 turns + one brand-new session), sonnet, per-tool allowlist of 103
    entries from a live tools/list of each endpoint (75 tools), free tier, fresh token, no fixture
  scored 19/24 in 22 tool calls and 206.5 s
  verified from the endpoints and the files, not the prose: entry 3ebc2fda 4.00 h EUR 90/h;
    expense 13e6893d EUR 61.50 = 50.00 + 11.50 at 23% from the shared profile; invoice document
    200 text/html 1906 B carrying USD 585.78; proposal 504b0304 OOXML nova-phase-2.docx 10985 B with
    the profile letterhead, [add: email] and zero @; 16:00-17:00 Warsaw = 09:00-10:00 Austin;
    4th invoice of the month refused with the 3/month cap named; /buy/invoice?tenant=<token> 303s to
    Stripe and the live session carries metadata.tenant = the token; a brand-new session read all
    three invoices back from the same URL
  4 hosted-specific defects found and FIXED in remote/ (re-vendored, deployed 7d3f5812):
    D-R42 license_status claimed an Authorization header on URL-token calls; D-R43 the $39 bundle
    price had no link though /buy/bundle works; D-R44 license_status carried no limits pointer, so
    the model had to trip the cap to find it; D-R45 license_activate told a headerless client to use
    a header. D-R50 partially addressed. servers/ untouched.
  3 not-hosted-specific defects logged, not fixed (out of edit scope): D-R46 invoice_create rounds a
    fractional unit_price then multiplies (USD 418.16 vs 418.14, total 3 cents over the cited ECB
    rate); D-R47 proposal_create's required sections force invented content; D-R48 an address in
    Warsaw sets no timezone. 1 client-side: D-R49 the model duplicated the profile into CLI memory.
  node scripts/validate.mjs after the deploy: remote 31/31, run 50 252/252; binding.test.mjs 6/6;
    all six entries still Connected, then removed
cost: 35 wall minutes
insight: the hosted path computes correctly and remembers correctly - the same anonymous token carried
  one stated identity across six endpoints and a session boundary, and the cap-to-Stripe-metadata
  path is real. Every deduction but one was the endpoint failing to describe ITSELF: it claimed a
  header it never received, quoted a price it would not link, and hid the caps it enforces, so the
  only way to learn the free limit was to exceed it.
artifacts:
  docs/USER_VALUE_R10.md, data/user_value_r10.json
  remote/src/shims/license.ts, remote/src/shims/ctx.ts, remote/src/index.ts (deployed)
  /private/tmp/uv52/{token.txt,allow.txt,allow.csv,run.sh,show.py,tl_*.json}
  /private/tmp/uv52/out/*.jsonl (9 transcripts), /private/tmp/uv52/{inv1.html,prop.docx,h1.txt,h2.txt}
```
