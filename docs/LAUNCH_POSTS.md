# Launch posts

Drafts for the operator to post personally on human-only surfaces. Every number below is cited
next to its source doc in an HTML comment. Nothing here is auto-posted.

---

## 1. Show HN

**Title:** Show HN: Five local MCP servers for freelancer work (time, invoices, expenses, spreadsheets, prices), one-time Pro

**Body:**

I built five Model Context Protocol servers that run on your own machine over stdio: time tracking,
invoicing, expense/mileage tracking, spreadsheet read/query/convert, and price watching. A sixth,
office-suite, proxies all five behind one config line.
<!-- servers list and office-suite proxy: README.md lines 12-19, 48-49 -->

They're free to use with limits, $19 one-time per server or $39 for the bundle, lifetime, no
subscription. License keys verify offline with Ed25519, no phone-home.
<!-- pricing/licensing: README.md line 9, line 29; data/facts.json pricing block -->

What's measured, not claimed: 186 unit tests across the six servers plus the shared license
package (protocol smoke tests over real stdio, adversarial cases: bad input, path traversal,
concurrent writers), a 121-check validation database that's currently green at 121/121, and five
rounds of user-value testing where a real Claude client ran actual prompts end to end, not unit
tests. The most recent full run scored 26/30 on ten fresh scenarios it had never seen before; the
round before that went from 13/24 to 20/24 after fixing the defects that round found, including a
6-call chain that assembled a cross-currency invoice at EUR 338.25 correctly on its own.
<!-- 186 unit tests, 121-check db: README.md "Validation" section -->
<!-- 121/121 run 29: docs/USER_VALUE_R5.md "Verbatim test summaries" -->
<!-- 26/30 fresh scenarios: docs/USER_VALUE_R5.md scorecard heading -->
<!-- 13/24 -> 20/24: docs/USER_VALUE_R4.md "Scorecard" heading -->
<!-- EUR 338.25 six-call invoice: docs/USER_VALUE_R4.md scenario a3 -->

What's honest about limits: none of the six packages are on npm yet (the publish token is dead),
so install today is a `.mcpb` double-click bundle or a clone-and-build, not `npx`. Price-tracker
correctly extracted 5 of 12 real retailer URLs in a spot check; the other 7 hit bot walls, a
timeout, or a redirect, and the tool says so instead of guessing. The hosted endpoints render invoices as HTML documents (print to PDF); the local server writes a real PDF.
<!-- npm not published: README.md "npm status" -->
<!-- 5 of 12 retailers, 41.7%: docs/CONTENT_RESULT.md "Content sourcing" -->
<!-- hosted invoice HTML under .pdf name: docs/USER_VALUE_R4.md defect D-R8 -->

Repo: https://github.com/theluckystrike/mcp-servers
Buy Pro / hosted endpoints: https://mcp.zovo.one

### Anticipated questions

**Offline license keys, what stops someone from sharing one?**
Nothing cryptographic stops copying a key file, the same as most one-time-purchase CLI tools.
The keys are Ed25519-signed so they can't be forged, and verification never phones home, so there's
no server-side revocation either. This is a tradeoff for privacy and no-account use, not an attempt
at DRM. <!-- Ed25519 offline verify, no phone-home: README.md line 29 -->

**Why one-time instead of a subscription?**
These are utilities people run occasionally inside a chat client, not a service with ongoing hosting
cost per user (the optional hosted endpoints are the exception and are metered separately). One-time
pricing matches that shape. <!-- pricing model: data/facts.json pricing block, "one-time, lifetime" -->

**Why local/stdio instead of just hosting it?**
Local means your time entries, invoices, and receipts sit in a file on your disk, not in a database
I operate. The hosted endpoints exist for clients that can't spawn a local process, and they say
plainly what they retain and for how long (see below). <!-- README.md "Hosted endpoints" section -->

**What happens on refund?**
The license key still works after a refund is issued manually; there's no remote kill switch, since
verification is offline by design. If you want a key deactivated you'd have to ask and I'd have to
trust it, which is the same limitation as the piracy question above. <!-- inferred directly from README.md offline/no-phone-home design, no separate refund doc -->

**Why do the registry listings use long, keyword-stuffed names instead of the plain names?**
Registry search matches on whole words, and a name built only from `time-tracker` didn't turn up for
searches like "timesheet" or "billable hours". The extra words in names like
`time-tracker-timesheet-billable-hours` are all words the tool descriptions already use; the npm
package names, directory names, and checkout URLs are unchanged. <!-- README.md "Registry names" section -->

**What does the hosted version retain, and for how long?**
A free anonymous token is 30-day KV TTL, refreshed on each request. Download links for generated
files (invoice PDFs, CSV exports, converted spreadsheets) are valid for one hour. Spreadsheet data
loaded remotely lives only in that request's virtual filesystem. <!-- README.md "Hosted endpoints" section -->

---

## 2. r/ClaudeAI and r/mcp posts

### Variant A (r/ClaudeAI)

I've been building and stress-testing a set of local MCP servers for freelance admin work (time
tracking, invoicing, expenses, a spreadsheet reader, a price watcher), and the most interesting part
wasn't writing the tools, it was watching a real Claude session use them across a whole invented
workflow in one conversation.

One run: I told it to stop a timer, log another 2.5 hours, and add a Media Markt receipt as
billable. Later in the same conversation I said "invoice Acme for this week's hours and the
rebillable expenses, 23% VAT, due in 14 days, PDF." It chained six tool calls on its own: pulled the
time entries, applied the VAT rate to the receipt, converted the expense into an invoice line,
created the invoice, marked the expense rebilled, and rendered the PDF. Final number: subtotal
EUR 275.00, 23% VAT is EUR 63.25, total EUR 338.25, and I checked the PDF bytes and the JSON store
myself rather than trusting the summary it gave me.
<!-- transcript and numbers: docs/USER_VALUE_R4.md scenario a3, "Independent verification" table -->

Not everything worked first try: a plain price-check question skipped the price server entirely
and answered from a generic web fetch instead, because the tool's own description didn't argue hard
enough for itself over a general-purpose fetcher. Posting that as a fix-it note, not a pitch.
<!-- price_check skipped for WebFetch: docs/USER_VALUE_R4.md defect D-R9 -->

Repo, if useful: https://github.com/theluckystrike/mcp-servers

### Variant B (r/mcp)

Sharing some findings from running real prompts (not unit tests) against a small bundle of MCP
servers I wrote: time tracker, invoice, expense tracker, spreadsheet, price watcher.

The thing that stood out is where a generic tool beats a purpose-built one by default. In one test,
a natural-language price question got answered by a plain web fetch instead of the price-tracking
server, because on capability alone a generic fetcher looks just as good to the model. The fix isn't
in the price logic, it's in making the tool's own description claim the case explicitly. Same
pattern showed up with a spreadsheet query tool losing to `Read` and shell commands for several
calls before the model tried it.
<!-- price_check vs WebFetch: docs/USER_VALUE_R4.md defect D-R9; sheet_query vs Read/Bash: docs/USER_VALUE_R5.md defect D-R11 -->

On the win side, a longer multi-tool conversation (start a timer, log time, add a billable receipt,
then ask for an invoice with VAT) chained six tool calls correctly on its own and produced a real
invoice: EUR 275.00 subtotal, 23% VAT, EUR 338.25 total, actual PDF bytes on disk that I verified
against the JSON store afterward, not against the model's own summary.
<!-- EUR 338.25 chain: docs/USER_VALUE_R4.md scenario a3 -->

If you're testing your own MCP servers this way (real client, real prompts, checking the actual
files/stores after), curious what else people have found breaks that unit tests never would.

Repo: https://github.com/theluckystrike/mcp-servers

---

## 3. dev.to article outline

**Title:** What five rounds of testing MCP servers through a real client taught us

**Abstract (40 words):** Unit tests passed at 100% while a real Claude session still lost tool
calls to generic fetchers, abandoned a task rather than notice the right tool was sitting in its
own allowlist, and hit a hard cap that taught it to route around a paywall instead of asking for
one. Five rounds of prompts, not assertions, found all three.

H2s:

1. Why unit tests and a live client scored differently on the same servers
2. Round one baseline: 28 of 39 scenarios, and what "correct but needed a second turn" means
3. The paywall as a race: what happened when a free-tier cap met a model that wanted the answer anyway
4. Tool selection losses: when a generic fetcher or shell command beats a purpose-built tool
5. The fix that isn't in the tool logic: making a description argue for itself
6. One multi-server chain, six tool calls, and how we verified the total against the file store instead of the model's prose
7. What registry search taught us about naming: word-rich names vs short directory names
8. From 13/24 to 26/30: what closing a defect list actually moves, and what it doesn't

<!-- round 1 28/39: docs/USER_VALUE_R2.md RESULT.md "total 37/39 (round 1: 28/39)" -->
<!-- paywall/cap: docs/USER_VALUE_R2.md insight section, "freeing alerts_pending... moved price-tracker 1->3" -->
<!-- tool selection losses: docs/USER_VALUE_R4.md D-R9, docs/USER_VALUE_R5.md D-R11 -->
<!-- description-only fix: docs/USER_VALUE_R5.md D-R11 fix direction and "Round-5 fixes" section -->
<!-- six-call chain, verified against store: docs/USER_VALUE_R4.md scenario a3 and "Independent verification" -->
<!-- registry naming: README.md "Registry names" section -->
<!-- 13/24 and 26/30: docs/USER_VALUE_R4.md scorecard heading, docs/USER_VALUE_R5.md scorecard heading -->

---

## 4. LinkedIn post (freelancers, no hashtags, no emojis)

If you freelance and your admin lives across a timer app, a spreadsheet, an invoicing tool, and a
notes app for receipts, I built and tested a small set of tools that instead run inside a chat
client you may already use: track time, log expenses and mileage, query a spreadsheet without
corrupting it, watch a price, and generate an invoice with tax lines and a real PDF. In one test
conversation, asking to invoice a client for the week's hours plus a billable receipt with VAT
produced a correct EUR 338.25 total across six chained steps in a single request, verified
afterward against the actual invoice file rather than taken on trust. They run locally on your own
machine, are free to use with limits, and unlock fully for a one-time payment rather than another
monthly line item. If that sounds useful for your own admin, the project is open source and linked
in the comments.
<!-- EUR 338.25 six-step chain: docs/USER_VALUE_R4.md scenario a3 -->
<!-- local, free with limits, one-time payment: README.md lines 7-9 -->
