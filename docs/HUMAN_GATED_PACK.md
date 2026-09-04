# Human-Gated Distribution Pack

Work through this in order. Each section is one surface: exact URL, why it needs a human, every
form field with exact text to paste, the command to run after the human step, and how to verify
it landed. No paid submissions anywhere in this pack. Support email everywhere: support@zovo.one.
License everywhere: MIT. Repo everywhere: https://github.com/theluckystrike/mcp-servers.

Package/server count: 20 (19 standalone servers + the office-suite bundle). All at version 0.9.0.
Icons live at `assets/<name>-logo.png` in the repo root, except **office-suite has no dedicated
logo file** (not in `assets/`) — use `assets/office-suite-logo.png` only after creating it, or
reuse `assets/invoice-logo.png` as a placeholder the way earlier rounds reused logos for missing
servers (noted in memory, e.g. quotes reused invoice's logo before its own existed).

---

## 0. Per-server field reference (used by every section below)

| Server | Short desc (<=100 chars, registry-safe) | Long description | Category | Homepage |
|---|---|---|---|---|
| time-tracker | Track billable time from your AI chat: timers, entries, reports, CSV export. All data stays local. | Track billable time without leaving your AI chat. Timers, entries, reports, CSV export and invoice line items, all stored locally. | Productivity | https://mcp.zovo.one/buy/time-tracker |
| price-tracker | Check a shop page price now, keep a watch list, see history and target alerts. All data stays local. | Ask your AI what something costs right now, track price drops and get told when a target price is hit. All data stays local. | Finance | https://mcp.zovo.one/buy/price-tracker |
| spreadsheet | Open, inspect, filter, edit and convert xlsx and csv files from your AI chat. Processing is local. | Open, inspect, query, edit and convert xlsx and csv files locally from your AI assistant. | Productivity | https://mcp.zovo.one/buy/spreadsheet |
| invoice | Create PDF invoices from your AI chat: clients, numbering, VAT, overdue reports. All data is local. | Make real, sendable PDF invoices from a sentence. Clients, numbering that never repeats, VAT lines, discounts and overdue reports, all stored locally. | Finance | https://mcp.zovo.one/buy/invoice |
| expense-tracker | Log expenses, receipts and mileage from chat: auto-categorise, split VAT, summarise, export, rebill. | Local expenses, receipts and mileage ledger for freelancers: categorise, split VAT, summarise, export to CSV or xlsx and rebill straight into an invoice. | Finance | https://mcp.zovo.one/buy/expense-tracker |
| currency | Convert currencies and read exchange rate history from the European Central Bank. No API key,. | Live and historical exchange rates from the European Central Bank, in your AI chat. Convert amounts, read rate history, and hand invoice tools the FX rates they need. No API key, cached locally, works offline. | Finance | https://mcp.zovo.one/buy/currency |
| docx | Create real Word .docx files from your AI chat: proposals, quotes, contracts, statements of work. | Turn a chat into a real Word document: proposals, quotes, contracts, statements of work and letters as .docx files, plus reading and filling existing .docx templates. Everything stays on your machine. | Productivity | https://mcp.zovo.one/buy/docx |
| timezone | Time zone conversion, meeting-slot finding across countries, DST checks and .ics invites. All. | Time zones, meeting slots and calendar invites for people who work with clients abroad. Convert times, find hours that suit everyone, check DST, write .ics. All local. | Productivity | https://mcp.zovo.one/buy/timezone |
| resume | Tailor a resume and write a cover letter as real Word .docx files, from facts you stored once. Nothing is invented. | Turn your CV facts into a tailored Word resume and a cover letter that invents nothing: keyword matching against the posting, page-fit trimming, and bracketed prompts wherever a fact is missing. | Career/Productivity | https://mcp.zovo.one/buy/resume |
| recurring | Recurring invoices on a schedule: define once, generate the due PDFs into your invoice server, forecast revenue. All data is local. | Bill the same clients every month without remembering to. Define a recurring invoice once, then generate the real PDFs that are due, with month-end safe dates, an audit log and a revenue forecast. | Finance | https://mcp.zovo.one/buy/recurring |
| clauses | A personal library of reusable contract and proposal clauses, assembled into a real Word .docx with variables filled and missing facts flagged. Generic templates, not legal advice. | 25 generic freelance clause starters with {{variables}}, ranked search, one-call assembly into a real Word .docx with every missing fact left as a bracketed prompt. | Legal/Productivity | https://mcp.zovo.one/buy/clauses |
| pdf | Merge, split, extract, rotate, reorder and stamp PDF pages from your AI chat: mark an invoice PAID, pull pages out of a scan, join documents into one. | Merge, split, extract, rotate, reorder and stamp PDF files from chat. Everything stays on your machine. | Productivity | https://mcp.zovo.one/buy/pdf |
| calendar | Read the .ics your calendar exports: events in a window, free-busy, double bookings, export, meeting to timesheet. | Read the .ics your calendar already exports: what is on this week, when you are actually free, what is double-booked, and turn a meeting into billable time. All local. | Productivity | https://mcp.zovo.one/buy/calendar |
| image | Resize, convert, compress, crop, thumbnail and watermark images from your AI chat: prepare a photo for the web, make thumbnails, strip EXIF. Files stay on your machine. | Resize, convert, compress, crop, thumbnail and watermark images from chat: no upload, no account, no native dependency. | Media/Productivity | https://mcp.zovo.one/buy/image |
| bank-statement | Import a bank CSV, categorise it, summarise it per currency and reconcile it against your expenses. | Import a bank CSV export, categorise it, summarise it per currency, find recurring charges and reconcile it against your expense ledger. Everything stays on your machine. | Finance | https://mcp.zovo.one/buy/bank-statement |
| kanban | A local task board per project: columns, due dates, estimates, priorities, overdue, weekly review. | A local task board per project: columns, due dates, estimates, priorities and a link into your time tracker. All data stays on your machine. | Productivity | https://mcp.zovo.one/buy/kanban |
| quotes | Quotes and estimates for freelancers: VAT line items, a validity date, a pasteable text version, an A4 PDF, and accept turns it into an invoice. | Send a client a real quote in seconds: line items with VAT, a validity date, a plain-text version to paste into email and an A4 PDF. Accepting a quote turns it into an invoice with the same numbers. | Finance | https://mcp.zovo.one/buy/quotes |
| barcode | QR codes and barcodes offline: URLs, WiFi joins, vCards, EPC SEPA payment codes a banking app can scan, Code 128, EAN-13, EAN-8 and UPC-A, as SVG or PNG. | QR codes and barcodes from chat: URLs, WiFi joins, vCards, SEPA payment QR that a banking app can scan, Code 128 and EAN-13, as SVG or PNG. No network, no account. | Utilities | https://mcp.zovo.one/buy/barcode |
| zip | Create, inspect and extract zip archives offline: glob a directory into a zip, list entries with sizes and ratios, and unpack with traversal, symlink and zip-bomb guards. | Create, inspect and extract zip archives from chat: glob a directory into a zip, list what is inside with a bomb and traversal check, extract safely, read one text entry without unpacking. No network. | Utilities | https://mcp.zovo.one/buy/zip |
| office-suite | One MCP server for the whole freelancer office: time tracking, price watching, spreadsheets and PDF invoicing. Proxies four servers behind one install. | One install for the whole freelancer office. Proxies time-tracker, price-tracker, spreadsheet and invoice (and can be extended) behind a single MCP config entry. | Productivity | https://mcp.zovo.one/buy/office-suite |

Tags (common, from package.json keywords, use a relevant subset per server): `mcp`,
`model-context-protocol`, plus the server's own domain words already in its package.json
`keywords` array (e.g. time-tracker: `time-tracking, timesheet, invoicing, freelance`).

Pricing statement (paste verbatim where a pricing field exists): **Free tier with real limits,
$19 one-time lifetime Pro unlock (offline license key, no subscription), $39 one-time bundle for
all servers. Card payment via Stripe Checkout at mcp.zovo.one.**

Icon path: `assets/<name>-logo.png` (repo root). Confirmed present for all 19 standalone servers;
**office-suite has none** — flag this to the operator before submitting office-suite anywhere that
requires an icon upload.

---

## 1. npm — publish the 20 packages

**URL:** https://www.npmjs.com/~theluckystrike (profile) — login itself happens at whatever URL
`npm login --auth-type=web` prints (a one-time npmjs.com device-auth page, not a fixed URL you can
bookmark).

**Why human-gated:** the saved npm token is dead (401). No browser profile on this machine holds an
npmjs.com session (Chrome default, Brave CDP, Safari all anonymous), and npmjs.com's Cloudflare
challenge blocks headless Chrome unless given a normal desktop UA, which this environment cannot
reliably supply. `npm login --auth-type=web` opens a real browser and needs one human click to
approve the device code. There is no field to fill in beyond what npm's own page prompts for.

**Step 1 (human):**
```
npm login --auth-type=web
```
Approve the login in the browser tab it opens. Confirm with:
```
npm whoami
```
should print `theluckystrike`.

**Step 2 (command to run after login):**
`scripts/publish-all.sh --go` exists but **only covers 4 of the 20 packages**
(`SERVERS=(time-tracker price-tracker spreadsheet invoice)` is hardcoded in the script). It builds,
tests, npm-publishes those four, tags them in git, and runs `mcp-publisher publish` on each
`server.json`. Run it first:
```
cd /Users/mike/mcp-servers
scripts/publish-all.sh --go
```

Then publish the remaining 16 packages by hand. **Publish order matters**: some servers depend on
sibling `@theluckystrike/*` packages at runtime (npm range, not just at build time), so publish
base servers before anything that depends on them, and office-suite last:

```
cd /Users/mike/mcp-servers
export npm_config_cache="${npm_config_cache:-/Users/mike/.npm-cache-local}"
npm run build

# base servers with no @theluckystrike/* runtime dependency
for n in currency timezone docx pdf calendar expense-tracker image bank-statement \
         kanban barcode zip quotes; do
  (cd "servers/$n" && npm publish --access public)
done

# depend on docx and/or invoice (already published in step 1 above)
for n in resume recurring clauses; do
  (cd "servers/$n" && npm publish --access public)
done

# depends on 12 siblings above — publish last
(cd servers/office-suite && npm publish --access public)
```

**Open question worth checking before this step:** `packages/mcp-license` is itself named
`@theluckystrike/mcp-license` in its own `package.json` and is **not** published to npm today,
yet several servers (`resume`, `recurring`, `clauses`, `office-suite`, and likely all of them)
list it as a runtime `dependencies` entry at `^0.9.0`. If the build does not bundle
`mcp-license`'s compiled output into each server's `dist/index.js`, a fresh `npm install` of any
of these packages will 404 on `@theluckystrike/mcp-license`. Check one server's `dist/index.js`
for the license-verification code before trusting a public `npx` install; if it is not bundled,
publish `packages/mcp-license` first, ahead of everything else in this section.

**Verify it landed:**
```
npm view @theluckystrike/mcp-time-tracker version
npm view @theluckystrike/mcp-office-suite version
```
should print `0.9.0` for each of the 20 packages. Then a clean-machine smoke test:
```
npx -y @theluckystrike/mcp-time-tracker --help 2>&1 | head -5
```
should start without an npm 404. Also re-run `scripts/registry-check.sh` — the registry entries
already reference these npm package names, so a successful `npm view` plus a registry search hit
at https://registry.modelcontextprotocol.io/v0/servers?search=theluckystrike confirms both sides
are now consistent.

---

## 2. Smithery

**URL:** https://smithery.ai/auth/cli (direct fetch of this URL returns 404 outside the CLI flow —
it is only meaningful as the target the `smithery` CLI itself opens, not a page to visit directly).

**Why human-gated:** `npx -y @smithery/cli auth login` prints a one-time
`https://smithery.ai/auth/cli?s=<session>` URL that must be opened in a real browser and approved
by a human (GitHub OAuth). There is no email/password form and no way to script the OAuth consent
click. Once that one login is done, the CLI holds a bearer key and everything after is scriptable.

**Step 1 (human):**
```
npx -y @smithery/cli auth login
```
Open the printed URL (`https://smithery.ai/auth/cli?s=<session>`), approve via GitHub. `smithery.yaml`
in each server directory is already validated against the CLI schema (name + target, loose).

**Step 2 (command to run after login), once per server:**
```
cd /Users/mike/mcp-servers/servers/<name>
npx -y @smithery/cli deploy
```
(or `publish`/`register` — confirm the exact subcommand with `npx -y @smithery/cli --help` once
logged in; the CLI version pinned in this repo's notes is 4.11.1 and its subcommand surface should
be re-checked at login time since it was not exercised this session). Repeat for all 20
server directories (19 standalone + office-suite), each has its own `smithery.yaml`.

Fields Smithery's own `smithery.yaml` schema wants (already filled per server, verify before
deploy): `name`, `target` (loose in this repo's validated config) — no long-form web submission
form exists; the CLI is the entire intake.

**Verify it landed:** https://smithery.ai/server/@theluckystrike/<name> (or search
https://smithery.ai/search?q=theluckystrike) should list each server; `npx -y @smithery/cli list`
after login should also enumerate what is registered under the account.

---

## 3. cursor.directory

**URL:** https://cursor.directory/plugins/new

**Why human-gated:** `/plugins/new` redirects straight to `/login`, which offers GitHub or Google
OAuth only — no plain form fields to fill and no email/password option. `/mcp` on this site
redirects to the homepage (no separate MCP submission path exists). This session re-fetched the
page and got HTTP 429 (rate-limited) on top of the login redirect noted in prior rounds — both are
consistent with "still login-gated," not evidence it opened up.

**Step 1 (human):** open https://cursor.directory/plugins/new, sign in with GitHub or Google.

**Step 2 (form fields, unverified beyond the login wall — the actual submission form has never
been reached without an account, so treat every field below as likely-but-unconfirmed):**
- Name: `<server display name>`, e.g. `Time Tracker` (or the mcp-<name> form used elsewhere)
- Description: use the short desc from the table in section 0
- Repo URL: `https://github.com/theluckystrike/mcp-servers/tree/main/servers/<name>`
- Category: per the table in section 0
- Icon/logo upload: `assets/<name>-logo.png`

**Step 3 (command):** none — this is a manual web form per server, no CLI exists for cursor.directory.

**Verify it landed:** search https://cursor.directory/mcp?q=<name> or browse the plugins list for
the entry; it should show the repo link and description you typed.

---

## 4. Claude Desktop / Claude.ai directory (Connectors Directory)

**URL:** unresolved. There is no `data/distribution.json` entry for this surface (it is not one of
the 32 surfaces already tracked there), and this session could not find a public self-serve
submission form. A direct fetch of Anthropic's own custom-connectors support article
(support.claude.com "Getting started with custom connectors using remote MCP") confirms a
"Connectors Directory" exists inside the product ("Browse skills, connectors, and plugins in one
directory") but documents no developer submission URL or form — only a HackerOne link for
reporting *malicious* servers, which is not a listing path. Two direct URL guesses
(`claude.ai/directory/submit`) returned HTTP 403.

**Why human-gated:** no scriptable form was found at all; if a submission path exists it likely
requires a signed-in claude.ai session (human login) the same way the other directories do.

**What to do:** before spending operator time here, have a human sign into claude.ai, open
Settings -> Connectors (or the in-app directory browse view), and look for a "Submit your
connector" / developer-facing link from inside the logged-in UI — that is the most likely place a
submission entry point would surface, since none exists on the public web. If found, record the
exact URL and fields back into `data/distribution.json` under a new `claude-directory` key so the
next round does not re-search this. Treat all fields below as **unverified / likely, not
confirmed**, based on the pattern every other directory in this pack uses:
- Name, one-line description (<=100 chars, use the short desc from section 0)
- Long description (use the long description from section 0)
- Repo/homepage URL
- Icon (assets/<name>-logo.png)
- Category/tags
- Support contact: support@zovo.one

**Command / verify:** not applicable until the form itself is located.

---

## 5. Vercel login

**URL:** https://vercel.com/login (device-flow login only; no fixed submission form — this is a
deploy credential, not a directory listing).

**Why human-gated:** this is not an MCP-server directory at all — it is the deploy blocker behind
the **zovo.one footer backlink** to mcp.zovo.one (the organic-traffic surface, tracked under
`estate-backlinks` / the `extension-insiders` project, not `mcp-servers`). Per memory
(`vercel-api-access.md`): the OAuth device flow works headless, but the CLI **deletes `auth.json`
when the token is expired** on any failed call, so the current token must be treated as dead and a
fresh device-flow login run by a human before any `vercel` CLI command is attempted again. Per the
mcp-servers-monorepo memory note (Loop 8/9), the zovo.one footer anchor to mcp.zovo.one was
committed (`extension-insiders` commit `0abd1977`, `MegaFooter.tsx` + `api/render.ts` SSR
skeleton) but the Vercel deploy was **never confirmed live** because the CLI token was invalid at
the time.

**Step 1 (human):**
```
vercel login
```
Complete the device-flow approval in the browser. **Before running any other `vercel` command,
copy the resulting `~/.vercel/auth.json` (or the platform-equivalent path) to a backup** — a later
expired-token failure will delete it again.

**Step 2 (command to run after login):** from the `extension-insiders` project directory (not this
repo):
```
vercel deploy --prod
```
or, if the project is already git-connected, trigger via `git push` to the branch Vercel watches,
then confirm the deployment finished with:
```
vercel ls
```

**Verify it landed:** fetch https://zovo.one and confirm the footer contains a link to
`https://mcp.zovo.one` (`curl -s https://zovo.one | grep -o 'mcp.zovo.one'`). This is out of scope
for this repo's own git history — do not commit anything here for this section, it lives in the
`extension-insiders` project.

---

## 6. Glama claim

**URL:** https://glama.ai/mcp/servers?query=theluckystrike (search/browse) and
https://glama.ai/settings/api-keys (API key, needs an account).

**Why human-gated:** Glama has no unauthenticated "add server" endpoint. The crawler discovers
servers automatically from `glama.json` (already committed at the repo root and in every
`servers/<name>/` directory, `maintainers: theluckystrike`), but *claiming* a listing (to control
its page, add a score badge, etc.) requires the "Add Server" button, which needs a signed-in Glama
account, and the directory API needs a key minted from account settings while logged in. A fresh
fetch this session confirmed the "Add Server" button is present in the nav but has no visible form
fields without an account, and confirmed at least one theluckystrike-maintained server (BeLikeNative
Grammar Server, a different project) is already indexed by the crawler — consistent with crawler
discovery working but claim/API access needing login.

**Step 1 (human):** create/sign into a Glama account, click "Add Server" (or find the specific
"claim this listing" control on each server's own Glama page once the crawler has indexed it), and
generate an API key at https://glama.ai/settings/api-keys if programmatic access is wanted
afterward.

**Step 2 (fields, if a manual add/claim form appears — unverified beyond the button existing):**
- Repo URL: `https://github.com/theluckystrike/mcp-servers` (or the `tree/main/servers/<name>`
  subpath if Glama wants per-server repo links)
- Name / description: per the table in section 0
- Maintainer: `theluckystrike` (already declared in each `glama.json`)

**Step 3 (command, only relevant after an API key exists):** none scripted in this repo yet; if a
key is obtained, the Glama directory API (documented at glama.ai once logged in) can presumably be
used to confirm/refresh listings, but no such script exists here — this would be a new script to
write, not an existing one to run.

**Verify it landed:** https://glama.ai/mcp/servers?query=theluckystrike should list each of the 20
servers with a claimed/verified badge instead of only crawler-discovered rows. This also unblocks
the `awesome-mcp-servers` PR #13473, which is hard-blocked specifically on "must be listed and
passing on Glama with a score badge per entry" — so this step has a second payoff beyond Glama
itself.

---

## Appendix: sources checked

- `data/distribution.json` (32 surfaces tracked; npm/smithery/cursor.directory/glama entries read
  directly; Claude-directory and Vercel are not tracked keys in this file)
- `docs/DIST_R4_RESULT.md`, `DIST_R5_RESULT.md`, `DIST_R6_RESULT.md`, `DIST_R10_RESULT.md` (round
  notes confirming smithery/cursor.directory/glama status unchanged across rounds 3-11)
- `servers/*/server.json`, `servers/*/package.json` (descriptions, versions, dependencies)
- `servers/office-suite/README.md`
- `data/facts.json` (pricing, Stripe products)
- `docs/how-it-works.html`
- `scripts/publish-all.sh` (confirmed hardcoded 4-server `SERVERS` array)
- `assets/` (confirmed 19 of 20 logo files present, office-suite missing)
- memory: `mcp-servers-monorepo.md`, `vercel-api-access.md`
- live fetches this session: `smithery.ai/auth/cli` (404 outside CLI flow), `cursor.directory/plugins/new`
  (429, consistent with prior login-redirect finding), `glama.ai/mcp/servers?query=theluckystrike`
  (confirmed crawler-indexed content, Add Server button present, no field list visible),
  `npmjs.com/login` (403 to the fetcher), `support.claude.com` custom-connectors article (no
  developer submission path documented), two Claude-directory URL guesses (403 each)
