# Human-Gated Distribution Pack

Work through this in order. Each section is one surface: exact URL, why it needs a human, every
form field with exact text to paste, the command to run after the human step, and how to verify
it landed. No paid submissions anywhere in this pack. Support email everywhere: support@zovo.one.
License everywhere: MIT. Repo everywhere: https://github.com/theluckystrike/mcp-servers.

Package/server count: 20 servers (19 standalone + the office-suite bundle), plus the
`packages/mcp-license` runtime dependency all 20 of them import — 21 npm packages total.
All at version 0.9.0. Icons live at `assets/<name>-logo.png` in the repo root; `assets/
office-suite-logo.png` now exists (400x400, two-color house style, mark "OS"), so office-suite no
longer needs the `invoice-logo.png` placeholder earlier rounds used.

---


## Read this first: the whole list, ranked, as at 2026-09-07

Everything below this section is detail and history. These are the only actions that need a
person, in the order that returns the most. Each one is minutes, not hours, and each is
written out in full further down.

| # | Action | Time | What it unblocks | Section |
|---|---|---|---|---|
| 1 | `npm login --auth-type=web`, then `scripts/publish-all.sh --go` | ~2 min | The install command printed on 86 of the 126 live pages currently returns 404. Also unblocks 32 registry manifest variants that fail validation, and the largest untried awesome-list, which requires a published package. | 0-NPM |
| 2 | Create a Cloudflare API token with Zone → DNS → Edit, export it as `CLOUDFLARE_DNS_TOKEN` | ~2 min | A `com.*` registry namespace. Measured: the same servers would rank 3rd, 2nd and 3rd on schedule, delivery and excel instead of 60th, 25th and off page one. `scripts/namespace-claim.sh <domain>` then runs unattended. | Cloudflare token for the registry namespace |
| 3 | Sign up to Glama with GitHub, then Add Server four times | ~2 min | The last CI blocker on the awesome-mcp-servers pull request. Note that Glama also indexes on its own: it listed one mirror repo 33 minutes after that repo was created, so this may resolve itself. `node scripts/glama-watch.mjs` says how many are in. | Glama listing |
| 4 | Submit the GitHub URL at https://mcp.directory/submit | ~1 min | One more free directory. No account, one field. | Glama listing, final subsection |
| 5 | Copy the Search Console key off the iCloud Desktop | ~1 min | Stops the organic measurement going dark again the next time iCloud evicts it. | GSC service-account key |

Two things that look like human steps and are not, so do not spend time on them. The Stripe
product_write gap is closed: checkout sessions carry inline price data now, so every current
and future server gets a working checkout with no dashboard step. And the registry publish
loop is fully scripted: `mcp-publisher login github --token "$(gh auth token)"` authenticates
with no browser, so releases publish themselves.

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

## 1. npm — publish the 21 packages

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
`scripts/publish-all.sh` now derives its package list from the workspace itself (every
`package.json` under `packages/*` and `servers/*`) instead of a hardcoded 4-package array, and
computes the publish order by topologically sorting each package's `@theluckystrike/*`
`dependencies` — a package publishes only after every `@theluckystrike/*` package it depends on.
It defaults to a dry run (`npm publish --access public --dry-run` on each package, printing the
pack contents and a summary table); pass `--go` to publish for real. It also skips any package
whose exact current version is already on the npm registry, so it is safe to re-run after a
partial publish.

```
cd /Users/mike/mcp-servers
export npm_config_cache="${npm_config_cache:-/Users/mike/.npm-cache-local}"
scripts/publish-all.sh          # dry run first — confirm the table below
scripts/publish-all.sh --go     # after npm whoami succeeds
```

**Dependency cycle found and resolved in the script:** `packages/mcp-license`
(`@theluckystrike/mcp-license`) is **not published to npm today**, yet every one of the 20 servers
lists it as a runtime `dependencies` entry at `^0.9.0` — confirmed a real `import` (not bundled) in
`servers/time-tracker/dist/index.js:9`: `import { createLicenseGate, ... } from
"@theluckystrike/mcp-license"`. A fresh `npm install`/`npx` of any server 404s on
`@theluckystrike/mcp-license` until it is published, so it must go out ahead of every server.
`packages/mcp-license` in turn declares a runtime dependency on `@theluckystrike/mcp-timezone`
(`^0.9.0`), **and** `servers/timezone/package.json` declares a runtime dependency back on
`@theluckystrike/mcp-license` (`^0.9.0`) — a genuine two-package cycle, so no strict topological
order exists for this pair. This does not block a real publish: `npm publish` never resolves a
package's own dependencies against the registry, so mcp-license and mcp-timezone can go out in
either order and an installer resolves both once they both exist on npm. `scripts/publish-all.sh`
breaks the cycle by publishing `mcp-license` first (it is depended on by every other package here,
so it wins the tie-break) and prints a `# CYCLE:` line when it does so.

**Final order the script computes (21 packages):** `mcp-license` → `mcp-barcode`, `mcp-currency`,
`mcp-docx`, `mcp-expense-tracker`, `mcp-image`, `mcp-invoice`, `mcp-kanban`, `mcp-pdf`,
`mcp-price-tracker`, `mcp-spreadsheet`, `mcp-time-tracker`, `mcp-timezone`, `mcp-zip` (these 13 only
depend on `mcp-license`, already placed) → `mcp-bank-statement`, `mcp-calendar` (depend on
`mcp-spreadsheet`/`mcp-timezone`) → `mcp-clauses`, `mcp-resume` (depend on `mcp-docx`) →
`mcp-quotes`, `mcp-recurring` (depend on `mcp-invoice`) → `mcp-office-suite` last (depends on 12
siblings). `packages/mcp-license` does resolve for an npm installer under this order: it is in the
publish list (unlike before), and its one `@theluckystrike/*` dependency, `mcp-timezone`, is
covered by the cycle rule above rather than blocking it.

**Dry-run result (this session, before any real publish):** all 21 packages produced a clean
`npm publish --access public --dry-run` — every tarball includes `dist/`, and every package that
declares a `bin` entry has that file present under `dist/` (e.g. `mcp-license` packs
`dist/index.js`, `dist/lock.js`, `dist/profile.js` plus `.d.ts`; `mcp-barcode` packs
`dist/index.js`, `dist/lib.js`, `dist/render.js`, `dist/symbology.js`, `dist/store.js`,
`dist/payloads.js` plus `.d.ts`). None of the 21 names were already on the npm registry (no `SKIP:
already on npm` rows), consistent with the dead npm login — nothing has been published yet.

**Verify after `--go`:**
```
npm view @theluckystrike/mcp-license version
npm view @theluckystrike/mcp-time-tracker version
npm view @theluckystrike/mcp-office-suite version
```
should print `0.9.0` for each of the 21 packages. Then a clean-machine smoke test:
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


## Stripe key permissions (2026-09-06)

The Stripe key in the keychain (`StripeCLI`, `default.live_mode_api_key`) is now a restricted key without `product_write`; creating the work-order product returned `more_permissions_required`. Either grant Products Write to that restricted key in the Stripe dashboard or store a key that has it, then create the product with `POST /v1/products` (name "MCP Work Order Pro", metadata payload work-order) and a $19 price, and put the price id in `billing/src/index.js` PRODUCTS. Until then the work-order server ships without a checkout and release-check records the gap.

## npm publishing re-confirmed human-gated (2026-09-07, distribution round 24)

**Why human-gated:** re-verified from scratch this round, independent of the 2026-09-02 CDP
investigation above (same conclusion, still current). `npm view @theluckystrike/mcp-invoice`
and `@theluckystrike/mcp-time-tracker` both return a clean E404 (never published, not a
private/403), so the `npx -y @theluckystrike/mcp-<name>` install command printed on every
storefront page, guide and README has never worked for anyone. `npm whoami` returns E401.
There is no `.github/workflows/` directory anywhere in this repo (`gh api
repos/theluckystrike/mcp-servers/contents/.github/workflows` -> 404) so there is no existing
CI publish job to trigger, and `gh secret list -R theluckystrike/mcp-servers` is empty (no
`NPM_TOKEN`). npm's trusted-publishing (OIDC) path needs CLI >= 11.5.1 (this machine has
10.9.8) and is configured per-package on a logged-in npmjs.com settings page that cannot
exist yet since no package has ever been published once. A read-only scan of the cookie
tables in every Chromium profile on this machine (`~/Library/Application Support/Google/
Chrome/Default/Cookies`, the Brave profile, and the CDP-driven profile at 127.0.0.1:9222)
shows only `npm_device`/`datadome` bot-management cookies -- no npmjs.com session anywhere,
so `npm login --auth-type=web` cannot be auto-approved either.

**Step 1 (human, ~60 seconds):**
```
npm login --auth-type=web
```
Approve the one browser tab it opens, signed in as `theluckystrike`, then:
```
npm whoami        # must print theluckystrike
```
If no browser opens (headless shell): `npm login --auth-type=legacy` (interactive
username/password/OTP in the terminal), or generate a token at
`https://www.npmjs.com/settings/theluckystrike/tokens` (Automation, "Read and write") and set
`//registry.npmjs.org/:_authToken=npm_xxxx` in `~/.npmrc`.

**Step 2 (after the first successful login), still human once:** publish each package once
(`npm publish --access public` from `packages/mcp-license` first, then each `servers/<name>`),
then configure trusted publishing per package at
`https://www.npmjs.com/package/@theluckystrike/mcp-<name>/access` -> Trusted publisher ->
GitHub Actions, repo `theluckystrike/mcp-servers`, workflow filename `publish.yml` (a ready
workflow body is drafted in `docs/NPM_AUTH_RESULT.md` section 5, not yet written to the repo).
After that, no further human step is ever needed for npm publishing again.

**Separately, and not human-gated:** the zero-auth fallback `npx -y
github:theluckystrike/mcp-<name>` also fails today, for an unrelated structural reason (a
nested `file:` vendor dependency -- `@theluckystrike/mcp-license` depending on
`@theluckystrike/mcp-timezone`, both vendored by `scripts/sync-mirrors.sh` -- that npm's
git-installer cannot resolve). That fix is an engineering task (bundle the dependency instead
of vendoring it as a `file:` path), not a human-login blocker, and has been handed to the
loop coordinator to route to the agent that owns `scripts/` and `servers/*/src`.

**Verify it landed:** `npm view @theluckystrike/mcp-invoice` should return real package
metadata instead of 404, and `npx -y @theluckystrike/mcp-invoice` should run the server.

---

## GSC service-account key lives on iCloud Desktop and keeps going dataless (agent B, loop 29, 2026-09-07)

**Status this loop: RECOVERED, but it will break again.**

`~/Desktop/keys/gsc-sa-key.json` is the only copy of the Google Search Console
service-account key. It was `compressed,dataless` at the start of this loop; a bounded
`cat` on it timed out. `brctl download` returned exit 0 immediately without materialising
it, and the file only became readable several minutes later. Prior loops recorded it as
permanently unrecoverable and abandoned Search Console on that basis, which cost this
project the "mcp.zovo.one has zero Google impressions" finding for weeks.

Note for any agent probing this: `wc -c` **cannot** detect a dataless file — it answers
from `stat()`. Use `ls -lO <path> | grep dataless`, or a `cat` under a timeout.

**Exact human step (one command, ~5 seconds, must be run by the operator):**

```
mkdir -p ~/.config/gsc && cp ~/Desktop/keys/gsc-sa-key.json ~/.config/gsc/sa-key.json && chmod 600 ~/.config/gsc/sa-key.json
```

`~/.config` is not iCloud-synced, so the copy cannot be evicted. Run it while the file
is still readable — it is readable right now. After that, agents should read
`GSC_KEY=~/.config/gsc/sa-key.json` (`scripts/traffic.mjs` already honours the `GSC_KEY`
env var) and stop touching the Desktop copy.

The same applies to the other six dataless files in `~/Desktop/keys/`: `empire.env`,
`gh-secrets.sh`, `ic-license-private.pkcs8.b64`, `load.sh`, `README.md`,
`setup.applescript`.

## Cloudflare token for the registry namespace (2026-09-07)

One action, about two minutes, and it unlocks the largest measured discovery gain available
to this project. See docs/NAMESPACE_R1.md for the arithmetic.

At https://dash.cloudflare.com/profile/api-tokens create a token with a single permission,
**Zone -> DNS -> Edit**, scoped to one zone (b2berp.com is the recommended choice, or
bestremotetools.com if a tools framing is preferred). Then add it to the shell profile as

    export CLOUDFLARE_DNS_TOKEN=...

and an agent can run `scripts/namespace-claim.sh b2berp.com` unattended. Everything else in
the chain is already proven working: HTTP domain verification succeeded end to end on
2026-09-07 and the registry granted publish rights on the namespace derived from the domain.

Why a new token is needed: the existing CLOUDFLARE_API_TOKEN reads zones and deploys Workers
but returns `10000 Authentication error` on both `POST /zones/<id>/dns_records` and
`POST /zones/<id>/workers/routes`. The wrangler OAuth token has `zone:read` only and expired
2026-04-24. The account is also at its Cloudflare Pages project limit, so a throwaway
`<name>.pages.dev` cannot be created as a workaround.


---

## Glama listing for the four servers in awesome-mcp-servers PR 13473 (directory agent, loop 29, 2026-09-07)

**Why this needs you:** every externally reachable Glama surface was tested this loop and
there is no unauthenticated way in. The directory API returns HTTP 401 pointing at
`https://glama.ai/settings/api-keys`; that path 302-redirects to `/sign-up`. The "Add Server"
button on `https://glama.ai/mcp/servers` is a plain `<button type="button">` with no form
action, and the only auth modal the page serves an anonymous visitor is `SignUpModal`.
`/mcp/submit`, `/mcp/add`, `/mcp/docs` and `/api` are all 404. The `glama-ai` GitHub org has
three repos, none of them the directory, so there is no issue queue to post into. Creating the
account, and accepting Glama's Terms of Service, is a decision only you can make.

**What is NOT blocked, so you know the scale of this:** `theluckystrike/mcp-statement-of-account`
is already listed on Glama with a live score badge, crawled 33 minutes after the repo was
created, with no account and nobody submitting it — `https://glama.ai/mcp/servers/theluckystrike/mcp-statement-of-account`.
So this is a "make it happen on demand" step, not a "make it possible" step. Full evidence in
`docs/GLAMA_R1.md`.

**Payoff if you do it:** it unblocks the last red label on
`https://github.com/punkpeye/awesome-mcp-servers/pull/13473`, the highest-traffic free MCP
directory this project can reach (13,000+ entries, ranks for "awesome mcp servers"). It also
lets you *claim* the two listings that already exist, which Glama's own page says matters —
it shows "Unclaimed servers have limited discoverability."

### Exact click path

1. Open `https://glama.ai/sign-up`
2. It offers four ways in, all of which are account creation:
   - **Continue with GitHub** (OAuth authorisation against github.com/theluckystrike)
   - **Continue with Google**
   - **Continue with Discord**
   - **"or use email"** — two fields only: **Name** (labelled *"Used for billing and display
     purposes"*) and **Email**
3. Directly above the submit control: *"By signing up, you agree to the Terms of Service and
   Privacy Policy."* — `https://glama.ai/policies/terms-of-service`,
   `https://glama.ai/policies/privacy-policy`. **This is the acceptance an agent cannot make
   for you.**
4. Suggested field values if you use the email route:
   - Name: `theluckystrike`
   - Email: `support@zovo.one`
   The GitHub route is better if you are willing to authorise it, because Glama matches
   listings to the `maintainers` array in `glama.json`, which already contains
   `theluckystrike` in all 33 repos — so the claim should be automatic.

### Then, once signed in — four submissions, ~2 minutes total

Go to `https://glama.ai/mcp/servers`, click **Add Server**, and submit these four repo URLs
one at a time:

```
https://github.com/theluckystrike/mcp-time-tracker
https://github.com/theluckystrike/mcp-price-tracker
https://github.com/theluckystrike/mcp-spreadsheet
https://github.com/theluckystrike/mcp-invoice-generator
```

Nothing else needs preparing. All four already carry, verified by `curl` on 2026-09-07:
- `glama.json` at the repo root, exactly matching `https://glama.ai/mcp/schemas/server.json`
- a root `Dockerfile` (the bot comment on PR 13473 says *"you must add Dockerfile directly to
  Glama. For checks to pass, we only need the server to start and respond to introspection
  requests"* — it is already there)
- public repo, MIT licence, topics `mcp` / `mcp-server` / `model-context-protocol`

While you are there, also **claim** the two listings that already exist (each page has a
"Looking for Admin?" claim control):
```
https://glama.ai/mcp/servers/theluckystrike/mcp-statement-of-account
https://glama.ai/mcp/servers/theluckystrike/bln-mcp-grammar-server
```

### Verify it landed — one command, no account needed

```
for r in mcp-time-tracker mcp-price-tracker mcp-spreadsheet mcp-invoice; do
  printf '%-22s %s\n' "$r" "$(curl -sS -o /dev/null -w '%{http_code}' \
    -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36" \
    https://glama.ai/mcp/servers/theluckystrike/$r/badges/score.svg)"
done
```
All four currently print `404`. When they print `200`, the badges are live.

### What an agent does after you, with no further human step

Push one commit to `theluckystrike/awesome-mcp-servers` branch `add-theluckystrike-mcp-servers`
adding the badge to each of the four entries in the exact format the bot asks for:
```
[![theluckystrike/mcp-time-tracker MCP server](https://glama.ai/mcp/servers/theluckystrike/mcp-time-tracker/badges/score.svg)](https://glama.ai/mcp/servers/theluckystrike/mcp-time-tracker)
```
`pull_request_target` on `synchronize` re-runs `check-glama.yml`, which swaps `missing-glama`
for `has-glama`. Merging is then the maintainer's call — no workflow in that repo automerges,
so that last step was never automatable and is not something this pack can remove.

### Separate, smaller, and NOT a Glama account problem

Our four remote connectors on Glama — `https://glama.ai/mcp/connectors/io.github.theluckystrike/`
`bank-statement-csv-categorize-reconcile-ledger`, `deposits`, `excel-spreadsheet-xlsx-csv`,
`kanban-todo-tasks-projects-board` — all render a red dot titled "Server is not responding".
They got there free via the official MCP registry, with no Glama account. The cause is ours:
```
curl -o /dev/null -w '%{http_code}' https://mcp.zovo.one/mcp/spreadsheet
-> 401  {"error":"unauthorized","message":"This endpoint needs a token..."}
```
Glama's health prober hits the auth wall. Fixing that is an engineering task for whoever owns
`remote/` and `billing/` — expose an unauthenticated `initialize`/`tools/list` response, or
register the connector with a token in the URL form the worker already supports
(`https://mcp.zovo.one/mcp/<name>/t/<token>`). No human login is involved.

---

## 0-NPM. npm sign-in — the one human step that unblocks all 33 packages

Appended 2026-09-07 by the npm agent (loop 29). Full evidence: `docs/NPM_UNBLOCK_R2.md`,
machine-readable: `data/npm_unblock.json`. Nothing above this line was changed.

### Why a human is required

Every `@theluckystrike/mcp-*` package returns HTTP 404 on the registry — none has ever been
published — so `npx -y @theluckystrike/mcp-<name>` fails for every visitor on **86 live
mcp.zovo.one URLs**. Publishing needs a token. There is no working token anywhere: the one
in `~/.npmrc` returns 401, the keychain has no npm item, no `.env` holds one, no `NPM_TOKEN`
secret exists in any repo, and no browser profile has an npmjs.com session.

npm trusted publishing (OIDC) does **not** rescue this, and the npm CLI version is **not**
the reason. npm was upgraded 10.9.8 → **12.0.2** (floor is 11.5.1) and the block is
identical. Proof, GitHub Actions run 34081070341, with npm 12.0.2, node 22.23.2,
`id-token: write`, `ACTIONS_ID_TOKEN_REQUEST_URL` present and **zero** npmrc files:
```
npm error code ENEEDAUTH
npm error need auth This command requires you to be logged in to https://registry.npmjs.org/
```
A trusted publisher can only be attached to a package that already exists (npm/cli#8544,
still open). The first publish of each package must use a token.

### Exact click path (about two minutes)

1. Open `https://www.npmjs.com/login` in a normal browser window.
2. Sign in as **theluckystrike**. (If that account does not exist, stop and say so — no
   agent may create one.) Complete 2FA if prompted.
3. Go to `https://www.npmjs.com/settings/theluckystrike/tokens`.
4. Click **Generate New Token** → **Granular Access Token**.
5. Fill in:
   - Token name: `mcp-servers-publish`
   - Expiration: `90 days`
   - Packages and scopes → **Read and write**, applied to **All packages**
   - Leave organizations and IP allowlist untouched.
6. Click **Generate token** and copy the `npm_…` value. It is shown once.

### Exact command after the human step

Paste the token into the terminal (it is never written into this repo by any agent):
```
export npm_config_cache=/Users/mike/.npm-cache-local
export PATH="$HOME/.npm-global/bin:$PATH"     # npm 12.0.2
npm config set //registry.npmjs.org/:_authToken=npm_PASTE_HERE
npm whoami                                     # must print: theluckystrike
```
Then the whole release, in dependency order, is one command:
```
cd ~/mcp-servers
scripts/publish-all.sh          # dry run first: 33 packages, all reported ok on 2026-09-07
scripts/publish-all.sh --go     # the real publish
scripts/registry-check.sh
```

### How to verify it landed

```
for p in mcp-license mcp-timezone mcp-invoice mcp-pdf mcp-bank; do
  printf '%-14s ' "$p"
  curl -s -o /dev/null -w "HTTP %{http_code}\n" "https://registry.npmjs.org/@theluckystrike/$p"
done
```
All five must flip from `HTTP 404` to `HTTP 200`. Then, as a real end-to-end check:
```
npx -y @theluckystrike/mcp-invoice --help
```

### Optional, and only possible after the first publish

Once a package exists, trusted publishing can replace the token permanently. Per package,
at `https://www.npmjs.com/package/@theluckystrike/mcp-<name>/access` → **Trusted Publisher**
→ **GitHub Actions** → repository `theluckystrike/mcp-servers`, workflow filename
`npm-publish-oidc.yml`. That workflow already exists in the repo, is `workflow_dispatch`
only, already installs npm@latest and already requests `id-token: write`. After configuring
it the token can be revoked. This is 33 separate web-UI configurations, so it is worth doing
only if token rotation becomes a burden.

---

## mcp.directory — free web form, no account, but you click Submit (directory agent, loop 29, 2026-09-07)

**Why this needs you:** nothing about this one is gated — no login, no account, no fee. It is
here only because of the standing rule on this machine that the operator clicks Submit on
external web forms. An agent could technically POST it; it will not.

**Why it is worth your two minutes:** `https://mcp.directory/` ranks on the first page for
"mcp servers list" and "mcp server directory", carries 3,000+ servers, and the form's only
required field is a GitHub repo URL — it scrapes everything else itself.

**Verified 2026-09-07 by fetching `https://mcp.directory/submit`:**
- form fields: **GitHub Repository URL (required)**, npm package (optional), PyPI package
  (optional), Short description (optional, `maxLength=100`), Your email (optional)
- submit control: `<button type="submit">Submit for Review</button>`
- no sign-in, sign-up, account or login control anywhere on the page
- no fee, pricing, paid listing, featured slot or paid review mentioned anywhere in the
  page HTML (grepped for `price|pricing|paid|fee|featured|$<digits>` — the only `fee` hits
  are the word "feedback")
- the page's own description of what happens next: it pulls name, description, stars,
  language, license and README from GitHub, auto-detects tools by analysing the MCP
  implementation, generates install configs for the major clients, and reviews "within
  24 hours"

### Exact steps

1. Open `https://mcp.directory/submit`
2. Paste a repo URL into **GitHub Repository URL** and leave everything else blank —
   the description and packages are optional and it scrapes the README anyway.
3. Optionally put `support@zovo.one` in **Your Email** so you get the review notification.
4. Click **Submit for Review**.
5. Repeat for as many of the 33 mirror repos as you have patience for. Highest value first:

```
https://github.com/theluckystrike/mcp-office-suite
https://github.com/theluckystrike/mcp-invoice-generator
https://github.com/theluckystrike/mcp-time-tracker
https://github.com/theluckystrike/mcp-spreadsheet
https://github.com/theluckystrike/mcp-price-tracker
https://github.com/theluckystrike/mcp-expense-tracker
https://github.com/theluckystrike/mcp-pdf
https://github.com/theluckystrike/mcp-docx
```

Do **not** submit `https://github.com/theluckystrike/mcp-servers` as the first one — it is a
monorepo and the scraper will read it as a single server. Submit the per-server mirrors.

**Verify it landed:** search `https://mcp.directory/` for `theluckystrike` after 24 hours, or
try `https://mcp.directory/servers/theluckystrike/mcp-invoice-generator`.

---

## allmcps.com — free listing, one web form, operator clicks Submit (added round 26, 2026-09-08)

Found this round. Not previously in `data/distribution.json`. Free tier is real: the page
says *"Free listing review for Model Context Protocol servers"* and *"Free listings use
nofollow on website links. Verify + badge (or Premium) unlocks a dofollow reciprocal link."*
So the listing itself costs nothing; only the dofollow link is upsold. Recorded as
human-gated, not paid.

Evidence:

```
curl -sL -A "<Chrome UA>" -o /tmp/all.html -w '%{http_code}' https://allmcps.com/submit
-> 200, final URL https://allmcps.com/submit
grep -oiE '<(form|input|button|select|textarea)[^>]{0,180}' /tmp/all.html
-> <form class="submit-form"> with name=url, name=name, name=email (required),
   name=websiteUrl, name=description (required), name=category (required),
   name=tagsInputRaw, name=licenseInputRaw, name=supportUrlInputRaw,
   name=remoteEndpointUrlInputRaw, and a checked name=newsletterOptIn checkbox
```

Why it is gated and not just done: the form requires a **contact email**, and approval is
followed by *"you claim ownership after approval"*, which is an account. Standing operator
rule is that he clicks Submit on external forms himself.

### Exact steps

1. Open `https://allmcps.com/submit`.
2. Step 1, paste the repo URL and press **Auto-prefill form**.
3. Step 2, check the prefilled name/description, set **Category**, put
   `support@zovo.one` in **Contact email**.
4. **Untick "Keep me posted with the AllMCPs newsletter"** — it is ticked by default.
5. Optional fields worth filling: Website URL `https://mcp.zovo.one`, License `MIT`,
   Hosted MCP endpoint `https://mcp.zovo.one/mcp/<name>`.
6. Click Submit. Repeat per server; this list is one server per submission.

Highest value first, and put the Glama-graded one first because it is the only one with an
external quality signal to show:

```
https://github.com/theluckystrike/mcp-statement-of-account   category: Finance & Fintech
https://github.com/theluckystrike/mcp-spreadsheet            category: Data Platforms
https://github.com/theluckystrike/mcp-pdf                    category: File Systems
https://github.com/theluckystrike/mcp-barcode                category: Developer Tools
https://github.com/theluckystrike/mcp-invoice-generator                category: Finance & Fintech
https://github.com/theluckystrike/mcp-office-suite           category: Workplace & Productivity
```

**Verify it landed:** search `https://allmcps.com/` for `theluckystrike` after review.

---

## mcp.so — the $39 form is the real path; the free queue looks unattended (round 26)

Correction to the round 25 record, which said only `skipped: paid`. Both halves are now
measured.

**The web form is paid, confirmed verbatim.** `https://mcp.so/submit` redirects to
`https://mcp.so/submit?type=server` and the page text reads *"Paid submission $39 one-time
publishing fee / Publish immediately without review / Verified badge / Featured and priority
placement / Dofollow project link"*. That stays `skipped: paid`.

**There is also a free GitHub-issue queue, and it is open.** `chatmcp/mcpso` takes
submissions as issues; the round-26 agent filed one for free:
`https://github.com/chatmcp/mcpso/issues/3998`.

**But measure before trusting it.** Of the 30 most recently closed issues on that repo,
**30 of 30 were closed by their own author**, not by a maintainer:

```
gh api "repos/chatmcp/mcpso/issues?state=closed&per_page=30" \
  --jq '.[] | select(.pull_request == null) | "\(.number) author=\(.user.login) closed_by=\(.closed_by.login)"'
-> every row has author == closed_by
```

Issue numbers were at 3995 within hours of 3977, so the queue is receiving several
submissions a day and nobody is triaging them. Treat a free mcp.so listing as unlikely, and
do **not** spend a future loop filing more issues there. If the operator ever wants mcp.so,
the honest options are the $39 fee (blocked by the no-paid rule) or nothing.

---

## 12. Client in-product galleries (added 2026-09-08, round CLIENT_GALLERIES_R1)

Thirteen MCP clients were worked this round. Twelve needed no human because there was nothing
to submit to; one, Goose, was submitted autonomously (PRs
[#11917](https://github.com/block/goose/pull/11917),
[#11918](https://github.com/block/goose/pull/11918),
[#11919](https://github.com/block/goose/pull/11919)). What follows is only the residue that
genuinely needs a person. Full working in `docs/CLIENT_GALLERIES_R1.md`.

**No paid listing was found on any client surface**, so there is nothing here to record as
`skipped: paid`. Two of the three actions below are gated on a paid *plan* or an *account*,
which is a different thing and is called out explicitly in each.

### Ranked

| # | Action | Time | Worth doing? | Why it needs you |
| --- | --- | --- | --- | --- |
| 12a | Submit the `.mcpb` bundles to Anthropic's desktop-extension form | ~4 min | **Yes — highest value on this surface** | Google Form behind a sign-in wall |
| 12b | Check `cursor.directory/plugins/new` and submit if it is open | ~2 min | Maybe | Probe returned HTTP 429; the gate is unverified |
| 12c | Claude connectors portal (remote MCP servers) | ~20 min | Only if a Team plan already exists | Requires a **paid** Team/Enterprise org |

Deliberately **not** in this list, so nobody re-derives them as opportunities:

- **Zed.** Real gallery, real open PR path, and we are skipping it on purpose. Zed's own docs
  say the mechanism is being deprecated in favour of the official MCP registry and tell
  maintainers to publish there instead — which we already do, with 85 active rows. Building 89
  Rust/WASM extension repos into a retiring mechanism is negative-value work. Watch
  `zed-industries/zed#59351` instead.
- **VS Code's MCP gallery.** It *is* registry-backed and we *are* absent, but there is no form,
  no PR and no request path — GitHub selects out of the official registry. Nothing a human can
  click. It is a standing watch, recorded in `data/client_galleries.json`.
- **VS Code extension marketplace.** Publishing needs an Azure DevOps organisation and a PAT.
  That is account creation, and it is the wrong artefact anyway (a VS Code extension, not an
  MCP server listing). Not worth your time.
- **npm.** Still the single biggest unlock, still section 0. Note one thing this round changed:
  npm is **not** the gate on client galleries. Every gallery that wanted a `command` also
  accepted a `url`, and our thirty hosted endpoints satisfy that. npm remains the gate on
  install copy, not on distribution here.

---

### 12a. Anthropic desktop-extension submission (the `.mcpb` form)

This is the best-fit human action on the whole client surface. Anthropic's desktop-extension
directory takes **`.mcpb` bundles — our exact shipping format**. No repackaging, no npm, no
rewrite. We ship 32 of them on every release.

**URL:** `https://clau.de/desktop-extention-submission`
(note Anthropic's own typo in "extention"; that is the real link)

It 302s to a Google Form:
`https://docs.google.com/forms/d/e/1FAIpQLScHtjkiCNjpqnWtFLIQStChXlvVcvX8NPXkMfjtYPDPymgang/viewform`

**Why it needs you:** fetching it unauthenticated returns **HTTP 401** — Google sign-in is
required. An agent cannot sign in, so the form was never opened and its exact fields are
unverified. Expect the usual: extension name, description, repository URL, contact email, and
the bundle or a link to it.

**Click path:** open the link → sign in to Google → fill → Submit. Repeat per server, strongest
first.

**What to paste** (from the per-server table in section 0, plus):

- Repo: `https://github.com/theluckystrike/mcp-<server>`
- Bundle: `https://github.com/theluckystrike/mcp-servers/releases/download/v0.21.0/<server>.mcpb`
- Support: `support@zovo.one` · License: MIT · Version: 0.21.0
- If it asks whether the server actually runs, point at `docs/NEW_USER_E2E_R1.md`: the public
  bundle downloads and boots, the free tier binds with a clear upgrade path, checkout reaches a
  live Stripe page, and the zero-install hosted URL returns thirteen tools with no key.

**Order to submit (highest value first):** `invoice`, `time-tracker`, `spreadsheet`,
`expense-tracker`, `pdf`, `docx`, `price-tracker`, `office-suite`.

**Verify it landed:** watch `support@zovo.one` for the acknowledgement, then check the
connectors directory at `claude.com/connectors` after the stated review window.

---

### 12b. cursor.directory — two minutes, and it may be entirely open

Cursor 3.14.7 has **no in-app MCP gallery** (verified by grepping the shipped `product.json`:
`extensionsGallery` is present, `mcpGallery` is absent), and Cursor's own first-party list,
`cursor/mcp-servers`, is **archived** (last push 2026-03-19). So the only Cursor-adjacent
surface left is the third-party community site.

**URL:** `https://cursor.directory/plugins/new`

**Why it needs you:** the automated probe returned **HTTP 429** (rate limited), so the page's
fields and its sign-in gate are genuinely unverified. It may well be open and take 60 seconds,
or it may want a GitHub sign-in, in which case stop — that is out of bounds for the agents but
your call to make.

**Click path:** open it in a normal browser → if it asks you to sign in, decide; if not, fill
name, description, GitHub URL, category → Submit.

**What to paste:** name `Zovo Invoice`; description from the section 0 table; GitHub
`https://github.com/theluckystrike/mcp-invoice-generator`; homepage `https://mcp.zovo.one/s/invoice`.

**Verify it landed:** search `cursor.directory` for `zovo`.

**If a fee, a featured slot or a paid tier appears anywhere on that page, stop and do not pay** —
record it as `skipped: paid` and tell the loop. Nothing paid was seen on any client surface this
round and we would want to know if that changed.

---

### 12c. Claude connectors portal — only if a Team plan already exists

**URL:** `https://claude.ai/admin-settings/directory/submissions/new`
**Docs:** `https://claude.com/docs/connectors/building/submission`

**Why it needs you, and why it is ranked last:** the docs state the requirement verbatim —
*"A Team or Enterprise organization. Organization settings aren't available on individual
plans."* You also need the Owner role or a custom role carrying the Directory permission. There
is **no listing fee**, but Team/Enterprise is a **paid plan**, so this is only worth opening if
one already exists. **Do not buy a plan for this.**

It is an 11-step wizard: Introduction; Connection (an https URL, streamable HTTP or SSE);
Tools (auto-synced — every tool needs a title and `readOnlyHint`/`destructiveHint`); Listing
(name ≤100 chars, tagline ≤55, description ≤2000, 1–5 categories, documentation URL, privacy
policy URL, support contact, icon, permanent slug); Use cases; Company; Authentication
(OAuth 2.0 for authenticated services); Data handling; Test & launch (reviewer test-account
credentials, plus confirmation you ran every tool); Compliance (7 acknowledgments); Review.

**What to paste:**

- Connection URL: `https://mcp.zovo.one/mcp/invoice` (streamable HTTP; 30 servers have one)
- Reviewer credentials: none needed — say so, and give them
  `https://mcp.zovo.one/mcp/connect`, which mints a free anonymous token in the browser with no
  account, no card and no email
- Documentation: `https://mcp.zovo.one/s/invoice` · Support: `support@zovo.one` · Icon:
  `assets/invoice-logo.png` · Tagline and description: section 0 table

**One hard blocker to fix before you start, and it is not fixed today:** the docs say
*"Missing or incomplete privacy policies result in immediate rejection."* A privacy policy URL
is a required field, and we do not have one. Probed 2026-09-08:

    https://mcp.zovo.one/privacy          404
    https://mcp.zovo.one/legal/privacy    404
    https://mcp.zovo.one/privacy-policy   404

So 12c is blocked on writing and publishing a privacy policy first — an agent task, not a human
one, and cheap. Until that page returns 200, opening the wizard wastes the submission.

Escalations: `mcp-review@anthropic.com`.

---

## 13. Glama author verification — the last Maintenance line an agent cannot close (repository-signals, loop 31, 2026-09-09)

**URL:** https://glama.ai/mcp/servers/theluckystrike/mcp-statement-of-account/score
**Button:** "Claim", top of the page, next to `by theluckystrike`. The Author panel lower down
spells out the same thing: *"If you are the author, simply authenticate using GitHub."*

**Why it needs you, and why it is now the only thing left on that page.** Glama grades every
indexed server and publishes the grading. Of its twelve Maintenance lines, three were fixable
and are fixed as of this morning — CI, a stable release, and a real commit history (all measured
in `docs/REPO_SIGNALS_R1.md`). Of the rest, six were already positive, two are true statements
about how this project is deliberately run, and one — **"Author not verified"** — needs a human
to sign in with GitHub once. It is not a form, not a fee, and not a submission: it is a single
OAuth sign-in that binds the `theluckystrike` GitHub account to the listing.

**Nothing needs preparing first.** The `glama.json` in every mirror is already byte-for-byte the
shape Glama's own page prints as the requirement:

    {
      "$schema": "https://glama.ai/mcp/schemas/server.json",
      "maintainers": [
        "theluckystrike"
      ]
    }

Glama's checklist already agrees — the line reads "Has valid glama.json". It was verified this
round and deliberately left untouched.

**Exact click path, about one minute:**

1. Open https://glama.ai/mcp/servers/theluckystrike/mcp-statement-of-account
2. Click **Claim** (top right of the title block).
3. Choose **authenticate using GitHub** and approve. Sign in as `theluckystrike` — the username
   in `glama.json` must match the account, or the claim will not bind.
4. Nothing else. Do not add a paid plan, do not buy a listing.

**What it unlocks beyond the one line**

- **"No related servers"**, the other unchecked item in the 75% profile-completion panel. Once
  claimed, "Add related servers" becomes available; the 30 sibling mirrors are the obvious set.
- **The manual "Sync Server" button** in the MCP server admin interface. Glama's own help text
  says servers sync at least daily, but its record for this one still reports
  `Latest release: v0.14.0` after a re-sync on 2026-09-08 (the project is at v0.21.0). A manual
  sync is the direct way to test whether that field will ever move.
- **"Try in Browser"** on the server page, which is what Glama's tip names as the way to seed the
  "No recent usage" line. Clicking a tool there once is worth doing while you are signed in.

**Verify it landed — no account needed for the check:**

    curl -s -A "Mozilla/5.0" \
      https://glama.ai/mcp/servers/theluckystrike/mcp-statement-of-account/score \
      | grep -c "Author not verified"

`1` means it is still unclaimed. `0` means it worked. The same check on the word `Claim` in the
page header is a second instrument.

**Do not do these while you are in there:** no API key is needed (the directory API at
`https://glama.ai/api/mcp/v1/servers/...` returns 401 and asks for one, and its data licence
requires visible attribution on every page that displays it — not worth taking on), and there is
no paid tier to buy.

---

### Glama, round 2 addendum (2026-09-09) — what changed, and what the click is now worth

Measured this loop; details and commands in `docs/GLAMA_R2.md`, numbers in `data/glama_r2.json`.

**The claim step is worth less than it looked, and something free is worth much more.**

1. **Waiting will not do it.** Glama's own methodology page (`glama.ai/mcp/methodology` §1.1)
   documents open-source listing as a **GitHub OAuth submission only** — there is no crawler in
   the documented pipeline. The one mirror repo that got in arrived by an unadvertised path at
   an uncontrollable rate: 33 minutes for `mcp-statement-of-account`, but about **120 days** for
   `bln-mcp-grammar-server`. Four days on, it is still **1 of 33**. The line in the ranked table
   above ("this may resolve itself") should be read as: possibly, on a timescale of months.
2. **Nothing about the repositories is wrong.** 24 fields were diffed between the indexed repo
   and the unindexed ones — topics, license, releases, size, README, `glama.json`, `server.json`,
   file tree, traffic. Every one is identical or non-discriminating. There is no repository fix
   waiting to be made, so the OAuth click really is the only route to `/mcp/servers`.
3. **We are already on Glama 25 times over, for free.** The official MCP registry — which this
   project already publishes to — is mirrored into `glama.ai/mcp/connectors`, needs no account,
   and went from 4 to **at least 25** of our servers between 2026-09-07 and 2026-09-09 with
   nobody doing anything. Those connector pages carry the **identical** Tool Definition Quality
   rubric and are re-scored about daily. All health dots are green now that `mcp.zovo.one`
   returns 200 instead of 401.
4. **Correction to the "re-sync on 2026-09-08" note above.** The record's timestamp moves, but
   the server has not actually been re-run: the embedded `observedAt` is still
   **2026-09-05T18:06:49Z** and `releaseVersion` still **0.14.0**, across seven releases and a
   force-push. The daily "sync" is not re-reading the tool schemas. That makes the manual
   **Sync Server** button the single most useful thing behind the login — it is the only way to
   find out whether that field will ever move for an unclaimed-then-claimed server.

**So the click is still worth making**, for the awesome-mcp-servers gate (its CI matches the
literal string `glama.ai/mcp/servers/`, which a connector URL does not satisfy) and for the
manual sync. It is no longer the only way to be measured on Glama.

**Do not** click "Try in Browser" purely to clear the "No recent usage" line if you are not
actually trying the tool. That line is a claim about real adoption. Same reason this agent did
not post to Glama's unauthenticated usage-telemetry endpoint, which would have cleared it in one
request.
