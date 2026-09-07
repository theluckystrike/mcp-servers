# Glama round 1 — is the awesome-mcp-servers PR really hard-blocked?

Agent: directory agent, loop 29. All probes run 2026-09-07 between 03:20Z and 03:50Z.
Every number below names the command that produced it. Nothing here is carried over from a
prior agent's summary; the prior record was re-tested from scratch and is corrected in two
places.

---

## Headline

1. **Glama HAS indexed one of this account's repos**, unclaimed, with a live score badge.
   The prior record ("none of our servers are on Glama at all") is now wrong.
2. It is **1 of 33** mirror repos. It was indexed **33 minutes after the repo was created**,
   with zero stars, and the other 32 — carrying byte-identical `glama.json` and a `Dockerfile`
   — have not been indexed in the 1 to 5 days since.
3. **The `glama.json` in this repo is correct.** It validates against Glama's published
   schema exactly. A malformed file is NOT the reason for non-discovery. No fix was needed
   and none was made.
4. **There is no unauthenticated submission path on Glama.** Re-verified this loop, four
   different ways.
5. **The awesome-mcp-servers CI check is a plain string match on the diff, with no HTTP
   verification, and it uses `.some()`, not `.every()`.** Read from source, quoted below.
6. Verdict on the PR: see the last section. Short form — it can pass without a human, but
   only by waiting for an event this project cannot trigger.

---

## 1. What Glama has actually indexed

### The one that is listed

```
curl -A "<Chrome UA>" -o /dev/null -w '%{http_code}' \
  https://glama.ai/mcp/servers/theluckystrike/mcp-statement-of-account
-> 200

curl -A "<Chrome UA>" -o /dev/null -w '%{http_code}' \
  https://glama.ai/mcp/servers/theluckystrike/mcp-statement-of-account/badges/score.svg
-> 200   content-type: image/svg+xml   4358 bytes
```

The badge is a real rendered score, not a placeholder: the SVG carries three grade glyphs,
two filled `#37a169` (green) and one `#f5a623` (amber). The page itself shows
**license A, maintenance A, quality "Not graded"** (TDQS not yet computed).

The listing is **Unclaimed** — the page says verbatim *"Unclaimed servers have limited
discoverability"* and offers a "Looking for Admin?" claim flow. No Glama account was ever
created for this project, which is the proof that discovery here was crawler-driven.

Glama's internal record id for it is `xqty9uhzj7`, with a record timestamp of
`2026-09-05T17:43:09.930064Z` (extracted from the server-side data embedded in the page HTML).

```
gh api repos/theluckystrike/mcp-statement-of-account -q '.created_at, .stargazers_count'
-> 2026-09-05T17:10:18Z
-> 0
```

**Repo created 17:10:18Z, Glama record 17:43:09Z — 33 minutes, at zero stars.**

### The other one (different project, same account)

`https://glama.ai/mcp/servers/theluckystrike/bln-mcp-grammar-server` — 200, badge 200,
Glama id `tws9fj5lxe`, record timestamp `2026-08-31T04:35:21.787402Z`. This is the
BeLikeNative grammar server, not part of this monorepo. Listed as **B** quality. Also
unclaimed.

### The author listing — exactly two, and neither is in the PR

```
curl -A "<Chrome UA>" "https://glama.ai/mcp/servers?query=author%3Atheluckystrike" \
  | grep -o '/mcp/servers/theluckystrike/[a-zA-Z0-9._-]*' | sort -u
-> /mcp/servers/theluckystrike/bln-mcp-grammar-server
-> /mcp/servers/theluckystrike/mcp-statement-of-account
```

### All 33 mirror repos probed, one by one

Loop over `gh repo list theluckystrike --limit 200 --json name -q '.[].name' | grep '^mcp'`,
`curl`-ing `https://glama.ai/mcp/servers/theluckystrike/<repo>`:

| Repo | Glama | Repo created |
|---|---|---|
| mcp-statement-of-account | **200** | 2026-09-05 |
| the other 32 (mcp-servers, mcp-time-tracker, mcp-invoice, mcp-spreadsheet, mcp-price-tracker, mcp-expense-tracker, mcp-office-suite, mcp-currency, mcp-timezone, mcp-docx, mcp-resume, mcp-recurring, mcp-clauses, mcp-pdf, mcp-calendar, mcp-kanban, mcp-image, mcp-bank-statement, mcp-quotes, mcp-barcode, mcp-zip, mcp-billing-docs, mcp-deposits, mcp-per-diem, mcp-asset-register, mcp-cash-book, mcp-amortization, mcp-petty-cash, mcp-work-order, mcp-catalogue, mcp-change-order, mcp-registry) | 404 | 2026-09-02 .. 2026-09-06 |

**1 of 33 = 3.0%.**

### The four servers in PR 13473, specifically

```
mcp-time-tracker    page=404  badge=404
mcp-invoice         page=404  badge=404
mcp-spreadsheet     page=404  badge=404
mcp-price-tracker   page=404  badge=404
```

None of the four are on Glama. No honest badge can be added to those four entries today.

### Connectors — a second Glama surface that we ARE already on, for free

Searching Glama for `theluckystrike` returns, besides the two server records, four
**remote connector** records under the `io.github.theluckystrike` namespace:

- `https://glama.ai/mcp/connectors/io.github.theluckystrike/bank-statement-csv-categorize-reconcile-ledger`
- `https://glama.ai/mcp/connectors/io.github.theluckystrike/deposits`
- `https://glama.ai/mcp/connectors/io.github.theluckystrike/excel-spreadsheet-xlsx-csv`
- `https://glama.ai/mcp/connectors/io.github.theluckystrike/kanban-todo-tasks-projects-board`

Each carries `githubRepositoryFullName: theluckystrike/mcp-servers` and a remote URL of
`https://mcp.zovo.one/mcp/<name>`. These come from the **official MCP registry**
(`registry.modelcontextprotocol.io`), which this project already publishes to:

```
curl "https://registry.modelcontextprotocol.io/v0/servers?search=theluckystrike&limit=100"
-> 100 of 100 returned entries are io.github.theluckystrike/*
```

So Glama mirrors the official registry into `/mcp/connectors` with **no Glama account
required**. That is a real, already-working, free Glama presence.

**Defect found, not mine to fix:** every one of those four connectors renders a red dot with
`title="Server is not responding"`. Cause, measured:

```
curl -o /dev/null -w '%{http_code}' https://mcp.zovo.one/mcp/spreadsheet
-> 401
{"error":"unauthorized","message":"This endpoint needs a token. Put it in the Authorization
header, or in the URL if your client cannot set headers."}
```

Glama's health prober hits the auth wall and marks the connector dead. This is a live
distribution defect on a surface we already occupy. It belongs to whoever owns
`remote/` and `billing/`, and is handed to the loop coordinator, not touched here.

---

## 2. Is our `glama.json` the right shape? Yes. Verified against the schema.

```
curl https://glama.ai/mcp/schemas/server.json
{"$id":"https://glama.ai/mcp/schemas/server.json",
 "$schema":"http://json-schema.org/draft-07/schema#",
 "properties":{"maintainers":{"description":"GitHub usernames that have permission to
   maintain the server","items":{"description":"GitHub username","type":"string"},
   "type":"array","uniqueItems":true}},
 "required":["maintainers"],"type":"object"}
```

`maintainers` is the **only** property the schema defines and the only required key. Our file:

```
cat glama.json
{"$schema":"https://glama.ai/mcp/schemas/server.json","maintainers":["theluckystrike"]}
```

That is exactly conformant. Nothing to add, nothing to remove. Verified byte-identical on the
mirror repos too:

```
curl https://raw.githubusercontent.com/theluckystrike/<repo>/main/glama.json
-> 200, identical content, for mcp-statement-of-account, mcp-time-tracker,
   mcp-invoice, mcp-spreadsheet, mcp-price-tracker
curl https://raw.githubusercontent.com/theluckystrike/<repo>/main/Dockerfile
-> 200 for all five
```

**So the indexed repo and the four unindexed repos are configured identically.** Config is
not the discriminator. `glama.json` was NOT modified by this agent, because it is correct.

Note on what `glama.json` actually does: the schema is only a maintainer-permission
declaration. It is a *claim* file, not a *submission* file. Nothing in Glama's schema or
documentation says its presence causes indexing, and the 1-of-33 result is evidence that it
does not.

---

## 3. Is there any submission path that needs no account? No.

Four independent checks, all this loop:

**a. The directory API is key-gated.**
```
curl "https://glama.ai/api/mcp/v1/servers?query=theluckystrike"
-> HTTP 401
{"error":{"code":"unauthorized","message":"This endpoint requires an API key.
 Create one at https://glama.ai/settings/api-keys. ..."}}
```

**b. The "Add Server" button is a JS button with no form action, and the only modal chunks
the page preloads are `SignUpModal` and `FeedbackModal`.**
```
grep -o 'Add Server' + 1200 chars of context in the fetched /mcp/servers HTML
-> <button ... type="button"><span>Add Server</span></button>
grep -oE '/client/[A-Za-z0-9_.-]*Modal[A-Za-z0-9_.-]*\.js'
-> /client/FeedbackModal-CgZiHVsh.js
-> /client/Modal-Ce_8r1bM.js
-> /client/SignUpModal-4W5zKZBO.js
```
There is no `AddServerModal` chunk served to an anonymous visitor. An anonymous click on
"Add Server" gets the sign-up modal.

**c. There is no public submit route.**
```
/mcp/servers/new     301 -> /mcp/servers?query=author%3Anew   (just the search page)
/mcp/servers/submit  301 -> /mcp/servers?query=author%3Asubmit
/mcp/submit          404
/mcp/add             404
/mcp/docs            404
/docs                404
/api                 404
```

**d. There is no Glama issue tracker for server submissions.**
```
gh repo list glama-ai --limit 30
-> tool-definition-quality-score, lightport, rjsf-validator-cfworker
```
Three repos, none of them the directory. No "submit your server here" issue queue.

**The one GitHub-based discovery mechanism that DOES work with no Glama account is the
official MCP registry** (`registry.modelcontextprotocol.io`), which Glama mirrors into
`/mcp/connectors`. We are already on it — but connectors live at `glama.ai/mcp/connectors/...`,
and the awesome-mcp-servers check requires the string `glama.ai/mcp/servers/`. Connectors do
not satisfy that check.

### What actually triggers a `/mcp/servers` listing — best supported hypothesis

The one datapoint we have is precise: **repo created 2026-09-05T17:10:18Z, Glama record
2026-09-05T17:43:09.930064Z, 0 stars.** A 33-minute lag at zero stars is far too fast for a
periodic re-scan of a 82,518-server registry and far too fast for star-driven ranking. It
looks like a **new-repository event firehose** (GitHub events or a "recently created repos
matching MCP signals" search) that caught that one creation and missed the other 32.

This is a hypothesis with n=1 and it is recorded as a hypothesis, not a finding. What it
implies, if true, is worth writing down for whoever owns the mirror pipeline: **repos created
from now on have a real chance of being indexed within the hour, and repos that already exist
and were missed will probably never be picked up by that path.** No action was taken on it —
deleting and recreating existing public repos to bait a crawler is destructive and is not
something this agent will do.

---

## 4. The awesome-mcp-servers check, read from source

Workflow: `.github/workflows/check-glama.yml` in `punkpeye/awesome-mcp-servers`, read via
`gh api repos/punkpeye/awesome-mcp-servers/contents/.github/workflows/check-glama.yml`.

The entire Glama gate is one line:

```js
const hasGlama = newAddedLines.some(line =>
  line.includes('glama.ai/mcp/servers/') && line.includes('/badges/score.svg'));
```

Three things follow, and all three matter:

1. **It is `.some()`, not `.every()`.** One badged line among four unbadged ones flips the
   label from `missing-glama` to `has-glama`.
2. **It never makes an HTTP request.** It does not check that the badge resolves, that the
   server exists on Glama, or that the score passes. It is a substring test on the diff.
3. **It only labels.** `check-submission` reports `conclusion: SUCCESS` today even with
   `missing-glama` applied. The label is the signal to the human maintainer; the check itself
   is already green.

This means the gate is trivially satisfiable by pasting a badge URL for a server that is not
listed. **That was not done, and must not be done.** A fabricated badge would render as a
broken image in a list with 13,000+ entries and would be a lie in a public README under the
operator's own handle.

It also means a legitimate shortcut exists: `mcp-statement-of-account` genuinely is listed
with a genuinely live badge, so adding it as a fifth entry would honestly flip the label
while four entries stayed unbadged. **That was deliberately not done either.** It would hand
the operator a green `has-glama` label that misrepresents the state of four of the five
entries, and the maintainer of that repo is Frank Fiegel, who is also Glama's founder and
will not be fooled by it. Optimising a gate rather than the thing the gate measures is
exactly the failure mode this project has been bitten by before.

### Current PR state, read fresh, not from the record

```
gh pr view 13473 --repo punkpeye/awesome-mcp-servers --json state,labels,statusCheckRollup
```

- state: **OPEN**
- labels: **`missing-glama`**, `has-emoji`, `valid-name`
- checks: `check-submission` **SUCCESS** (2026-09-07T01:08:05Z), `welcome` SKIPPED
- bot comments: two, both dated 2026-09-02T13:19:09Z — `<!-- glama-check -->` and
  `<!-- emoji-check -->`

**The emoji blocker is genuinely fixed.** The record said the PR carried `missing-emoji`;
it now carries `has-emoji`. `missing-glama` is the only red label left. No maintainer has
commented; there is no human review activity on the PR at all.

The exact badge format the bot asks for:
```
[![OWNER/REPO MCP server](https://glama.ai/mcp/servers/OWNER/REPO/badges/score.svg)](https://glama.ai/mcp/servers/OWNER/REPO)
```

### What was done on the PR this loop

One comment posted, correcting this agent's own earlier comment on the same PR, which had
stated that a Glama account login was required:
`https://github.com/punkpeye/awesome-mcp-servers/pull/13473#issuecomment-5564754541`

It gives the maintainer the indexed sibling URL and its live badge, the `curl` evidence that
all four PR repos carry identical `glama.json` and `Dockerfile`, the 404s for the four, and
asks him to choose between holding the PR open until the crawler reaches them or splitting it
into one PR per server as each is indexed. It also flags the 401 that is killing our four
connector health checks. That is one comment, with new verifiable evidence, correcting a
false statement this agent made 2h40m earlier. No files in the PR were touched; no badge was
added; no fifth entry was added.

---

## 5. Verdict: can PR 13473 ever pass without a human?

**Yes in principle, no in practice on any schedule this project controls.**

Broken into the three things that would have to be true:

| Requirement | Human needed? | Evidence |
|---|---|---|
| PR has a permitted category emoji per entry | **No — already done** | label `has-emoji` |
| Entry link text contains `/` | **No — already done** | label `valid-name` |
| At least one added line contains a `glama.ai/mcp/servers/.../badges/score.svg` URL | **No, if a listing exists** | the badge is just text in the diff; an agent can push it |
| A `/mcp/servers` listing must exist for one of the four repos | **This is the whole blocker** | 4/4 are 404 |
| The PR must then be merged | **Yes, always** | a human maintainer merges; no automerge in the workflow |

So:

- **Getting the label green needs no human**, the moment any one of the four repos is indexed.
  An agent can watch `https://glama.ai/mcp/servers/theluckystrike/mcp-<name>/badges/score.svg`
  for a 200 and push the badges itself.
- **Causing the indexing needs either a human or luck.** The deterministic path — the
  "Add Server" button — is behind a Glama sign-up, which this agent is forbidden to complete
  and which the operator must click himself. The non-deterministic path — the crawler — has
  demonstrably worked once for this account, unprompted, with no account, in 33 minutes. It
  is real, it is free, and it is not steerable.
- **Merging always needs the maintainer.** No workflow in that repo merges anything. Even a
  fully green PR sits until Frank Fiegel merges it. That part was never automatable and is not
  a Glama problem.

**Practical recommendation:** treat this PR as a watch item, not a work item. Poll the four
badge URLs each loop; the moment one returns 200, push that badge and comment. Do not spend
further loops trying to force Glama indexing from the outside — this loop tested every
externally reachable surface Glama exposes and there is nothing left to try that does not
start with creating an account.

The human step to end the uncertainty in one click is written up in
`docs/HUMAN_GATED_PACK.md` under the Glama section added this loop.

---

## 6. Things that were checked and found NOT to be true

Recording these so no future loop re-spends the calls:

- "Our `glama.json` might be malformed and that is why nothing is indexed" — **false.**
  It matches the published schema exactly, and the one repo that IS indexed has the identical
  file.
- "The mirror repos might not be public yet" — **false.** All 33 are `isPrivate=false`.
- "The mirror repos might be missing the Dockerfile Glama needs" — **false.** All probed
  repos serve a root `Dockerfile` over `raw.githubusercontent.com` with HTTP 200.
- "None of our servers are on Glama at all" — **false as of 2026-09-05.**
  `mcp-statement-of-account` is listed with a live badge.
- "The PR is blocked on emoji as well as Glama" — **false as of 2026-09-07.**
  Only `missing-glama` remains.
- "There might be an npm route into Glama" — **no.** `registry.npmjs.org/mcp-<name>` returns
  404 for statement-of-account, time-tracker, invoice, spreadsheet and price-tracker; nothing
  from this project is on npm under those names, so npm is not how the one listing happened.
- "Glama might have a public GitHub issue tracker for submissions" — **no.** The `glama-ai`
  org has three repos and none of them is the directory.
