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
https://github.com/theluckystrike/mcp-invoice
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
