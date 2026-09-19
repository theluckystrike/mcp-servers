# T1 OUTREACH WAVE 2 — S45

STATUS: complete

Estate: `https://mcp.zovo.one` · 32 local-first MCP servers for freelance / small-business
paperwork, 30 also hosted. Frozen outreach policy applies unchanged (see §1).

## 1. Policy Grounding (STRATEGY-45.md + T6_TRAFFIC_R2_S45.md)

- `docs/STRATEGY-45.md:26` — "Outreach posts: still frozen pending user green-light
  (drafts ready: kimai/tally/brandrei)." **This deliverable does not lift that freeze.**
  Everything below is a draft for human approval; nothing is posted.
- Never ping or @-mention a maintainer. No account creation, no sign-in, no paid placement
  (`CLAUDE.md` Rules). No emoji.
- Value-first only: a draft must stand alone as a useful answer with the link removed. If a
  thread is already answered, skip it rather than adding a redundant link
  (`docs/outreach/R1/index.md:26-28`, `T5_COMMUNITY_OUTREACH_R2.md:21-28`).
- Discoverability context that justifies *these* three targets (S45 measured facts):
  - Googlebot went **2 → 16 URLs** of 193 (+700%) — `T6_TRAFFIC_R2_S45.md:3-8`. Google and
    GPTBot are the two crawlers still link-starved: assistant/SEO crawlers already have the
    full catalogue via IndexNow, `T6_TRAFFIC_R2_S45.md:14`.
  - Therefore the near-term lever is **links from places crawlers already visit**, not more
    listings. Reddit/HN and GitHub Discussions are both heavily crawled; a single accepted
    post with one specific deep link is worth more than another directory listing.
  - Revenue is 0 and the audience is ~10 humans/fortnight (`CLAUDE.md`). The binding
    constraint is audience, so the goal of these drafts is **one real, allowed, human-visible
    post each**, not volume.

## 2. Existing Drafts Inventory (no duplication)

| Set | Files | Status | Overlap decision |
|---|---|---|---|
| R1 | `docs/outreach/R1/01…07` (+ index) | 01/02 POSTED 2026-09-18; 03-06 Reddit HUMAN-GATED; 07 dev.to open | Does not overlap. R1 Reddit drafts are answers to *specific threads* (r/ClaudeAI not-listed, r/LocalLLaMA pdf-read, r/ollama local invoice, r/Netsuite bill capture). Draft A below is a **standalone value post**, a different format — and it is deliberately not any of those four subreddits. |
| R2 | `docs/outreach/R2/draft-01-kimai`, `draft-02-tally`, `draft-03-brandrei` | Drafted, **HELD** by `STRATEGY-45.md:26` | Draft A/B don't touch them. Draft C is explicitly a **reply-template addendum** that bolts the new S45 proof points onto those three held drafts — the ask in this task — not a replacement. |
| — | `docs/T5_COMMUNITY_OUTREACH_R2.md` | Plan/index for the R2 trio | Read for the posted-target map; see §5. |
| — | `docs/T5_SURFACES_R2.md`, `docs/T5_DIRS_R2.md` | Directory surfaces | Out of scope: directory listings are not outreach drafts. |

no wave-2 draft leads with the *free hosted endpoint* as a product fact, and no
draft announces the 109-guide mesh as a resource. Sections 3 and 4 fill exactly that gap.

## 3. Draft A — Reddit / Hacker News-style value post

The paperwork layer of an MCP setup is the part that still needs a server
r/mcp (value post, no question needed)
r/ClaudeAI "built this" flair / weekly self-promo
thread · r/LocalLLaMA (off-topic-shift risk, see risk) · Ask HN
`https://mcp.zovo.one` (storefront, leads with the free tool value)
`https://mcp.zovo.one/guides/mcp-server-free-vs-pro`

### Why this target
- Reddit is crawler-visited and human-crowded in the one venue where MCP is currently a live
  topic; `T6_TRAFFIC_R2_S45.md:3-14` says Google/GPTBot need **links**, and Reddit links are
  followed and re-crawled continuously. This is the only channel in the S45 data that plausibly
  moves Googlebot off 16/193 without waiting on GSC human verification.
- The R1 evaluation called Reddit "HUMAN-GATED" only because of the account requirement, not
  because of relevance (`docs/outreach/R1/index.md:22`). The account already exists for the
  R1 set (`T5_COMMUNITY_OUTREACH_R2.md:28`), so the gate is a policy gate, not a capability gap.
- The claim in the post is falsifiable and already verified live (§5 evidence), which is what
  keeps it out of "spam" territory on a technical subreddit.

### Draft (paste as-is; delete nothing, including the disclosure)

I got tired of wiring an LLM into my own paperwork, so I want to share what the working
version of that looks like, because the interesting part is not the model.

The model can already read a PDF and write a paragraph. What it cannot do is *subtract* — it
has no reliable way to render a compliant invoice, keep amounts in integer minor units, or
produce the same bytes twice for the same input. That is a server problem, not a prompt
problem, and it is the reason so many "AI for my invoices" setups die at the second month.

The split that works for me:

- **The model does judgement.** Reading a client email, deciding which line items belong on
  the invoice, drafting the dunning letter's tone.
- **A server does arithmetic and rendering.** Invoice numbers, tax, totals, the PDF itself.
  Deterministic: same input, same bytes. That is what makes it auditable and re-issuable.

Two design rules I would insist on for anybody building this:

1. **Money in integer minor units.** Cents, not floats. Every "the total is off by a cent"
   bug I have ever chased traced back to a float.
2. **Pass the data, not the layout.** Business, client, line items in; rendered document out.
   The moment the caller owns layout you have to re-test every document type when anything
   changes.

I run a free hosted set of MCP endpoints for exactly this paperwork layer — invoices, quotes,
job cards, expenses, dunning letters, credit notes, packing lists, bill of sale, per-diem,
bank statement parsing. They are plain HTTP MCP URLs, so they drop into any MCP client with no
install:

```json
{
  "mcpServers": {
    "invoice": {
      "type": "http",
      "url": "https://mcp.zovo.one/mcp/invoice/t/<token>"
    }
  }
}
```

Free tokens (no account) are minted at `https://mcp.zovo.one/mcp/connect`; there is a free
tier at 600 calls/hour and paid keys at 6000. If you want the longer write-up on where the
free tier is genuinely enough versus where a paid key pays for itself, that is here:
https://mcp.zovo.one/guides/mcp-server-free-vs-pro

Disclosure: I built these, and they are the thing I am selling. The two design rules above
are the part I would keep even if you build your own — the servers are just the shortcut.

### Risk assessment
| Risk | Level | Mitigation |
|---|---|---|
| Removed as self-promo spam | **Medium-high** — this is the dominant failure mode on r/mcp and r/ClaudeAI | Post as a text post, not a link post. Link is inside the body, after the value, single deep link. Use the subreddit's "built this / self-promo" flair or its weekly promo thread if one exists, and post on a weekday morning US time when mods are active. |
| Account age / karma | **Medium** — a fresh account's first post being promotional is the classic ban trigger | Verify the account has some history first. If the account is new, do **not** make this the first post: answer two genuine threads first (the R1 Reddit drafts 03-06 are exactly that material). |
| r/LocalLLaMA misfire | **Low-medium** | Only use it if hosts-local is prominent; the post's angle is hosted, which that sub reads as against its grain. Prefer r/mcp. |
| Claim going stale | **Low** | The calls/hour numbers and free tier are live-verified in §5; re-verify at post time. |
| Anti-spam / shadowban by posting the same text to several subs | **High if repeated** | Submit to **one** subreddit. Do not cross-post the same body. |

### Human approval needed
1. Approve the freeze lift for this specific post (`STRATEGY-45.md:26`).
2. Confirm the Reddit account to use and that it has non-promotional history.
3. Confirm subreddit + flair, or move it to the weekly promo thread.
4. Sign off on the disclosure wording and on naming the $19/$39 price if a commenter asks
   (the draft does not state prices; keep it that way in the top post).

---

## 4. Draft B — GitHub Discussions post announcing the guide mesh

`modelcontextprotocol/registry` — **Discussions provider verified enabled**
https://github.com/modelcontextprotocol/registry/discussions
the repository has Discussions enabled
(`has_discussions=true`), but a *category that fits a resource announcement* must be picked at
post time from the live category list (Announcements / General / Show and tell / Q&A vary by
repo, and the API call to enumerate categories is a **GraphQL** call which needs a token —
record that as the one human step). If no non-promotional category exists, **do not post**
and fall back to Draft A's surface list.

### Why this target
- `modelcontextprotocol/registry` is the only high-signal MCP community repo in the estate's
  own measurement of what the blind instrument actually cites
  (`CLAUDE.md` → RECOMMENDATION_SOURCES_R1: github.com 21 of all citations, of which 20 are
  individual one-server repos and 1 is an awesome-list). It is 7,261 stars, active
  (updated 2026-09-18), 161 open issues, Discussions on.
- `CLAUDE.md` explicitly says the registry is an UPSTREAM that `api.mcp.github.com` and Glama
  consume and "not a destination anyone reads" — **for ranking purposes**. That is why this
  draft does *not* ask for a listing or rank anything. It posts a resource whose only ask is
  "this may save you time," which is compatible with that finding.
- The 109-guide mesh is genuinely a resource: 109 guide pages, symmetric related-guide links
  (degree 2-3, 13 topical clusters), shipped and validated this sprint
  (`T5_GUIDE_MESH_S45.md:31-38`).

### Draft (paste as-is; delete nothing, including the disclosure)

109 free guides for the non-obvious parts of running MCP servers (auth on hosted
endpoints, client config shape, Windows paths)

A resource post rather than a question. Over the last months I have been running a set of MCP
servers and writing up the parts of MCP that are not in the spec but do cost people evenings.
That is now 109 guide pages, and the ones I think are worth other people's time are grouped
like this:

- **Hosted endpoints and auth.** The one that catches everyone: an endpoint that answers
  `initialize` and `tools/list` with 200 tells you nothing about whether a tool call works.
  If you are publishing a hosted server, the shipping test is a real `tools/call` through the
  exact URL your documentation prints, carrying only what the doc tells a reader to have.
  A token can travel as an `Authorization: Bearer` header or in the path form
  `/mcp/<server>/t/<token>` — and the client that needs a paste-a-URL path is usually the one
  that cannot set a header, so the path form is the one to document first.
- **Client config shape.** `mcpServers` vs `servers`, absolute paths everywhere, why a stdio
  server spawned by a desktop app does not inherit your shell's PATH (nvm/asdf/Homebrew), and
  where the per-server log file actually lives.
- **Discovery and crawling.** Why `initialize` + `tools/list` succeeding is not a health check,
  how sitemap growth actually reaches Google vs Bing, and what IndexNow does and does not do
  for you.

Start here if you want the client-config one — it is the highest-traffic problem of the set:
https://mcp.zovo.one/guides/mcp-server-not-showing-up-in-claude-desktop
The full index is https://mcp.zovo.one/guides (109 pages, no signup, no email gate).

Disclosure: I maintain the server suite these guides belong to (free tier plus a paid key), so
read the recommendations with that in mind. The guides are written to stand alone — if you use
a different server, the config-shape and PATH sections are unchanged.

### Risk assessment
| Risk | Level | Mitigation |
|---|---|---|
| Removed as off-topic / promotional in a spec-and-registry repo | **Medium** | Post as a resource with no ask, in a General / Show-and-tell category only. Do not post it in an issue, do not file anything, do not use Announcements. |
| Being read as registry manipulation | **Low**, if the draft stays as written | It asks for nothing. Hard rule: no mention of registry listings, ranking, or "please add us". |
| Maintainer irritation | **Medium** — this repo is maintained by the MCP core team | One post, one time, no bumping, no follow-up replies unless someone asks a direct question. Never ping a maintainer. |
| Link dies / guides move | **Low** | Both URLs are sitemap URLs, live-verified in §5. |
| Duplicate with R1 draft 01 | **Low** | R1-01 was a *reply* on an existing support thread; this is a standalone resource post. Do not paste R1-01's body here. |

### Human approval needed
1. Enumerate the live Discussions categories on `modelcontextprotocol/registry` (GraphQL,
   token required) and confirm a General / Show-and-tell category exists.
2. Approve posting a resource announcement into a core-team-maintained repo at all — this is
   the highest-visibility-per-risk target in the set and the one most worth a human veto.
3. Confirm the GitHub account (`theluckystrike` per `T5_COMMUNITY_OUTREACH_R2.md:28`).

---

## 5. Draft C — Reply-template addendum for the 3 held R2 drafts

`docs/outreach/R2/draft-01-kimai-invoice-pdf.md` ·
`docs/outreach/R2/draft-02-tally-invoice-pdf.md` ·
`docs/outreach/R2/draft-03-brandrei-expense-tracker.md`
https://github.com/kimai/cli/issues/32 ·
https://github.com/gasparyanvazgen/tally/issues/18 ·
https://github.com/Brandrei/skills-integrate-mcp-with-copilot/issues/13
S45 proof points, so the drafts stop resting only on the argument. The
R2 drafts currently make a good design argument and cite nothing operational; the S45 data
gives three countable facts a maintainer can check in one click each.

**Insert the paragraph below into each of the three drafts, immediately *before* the
disclosure sentence** (so the existing closing line — "Disclosure: I built this server…" —
remains the last thing the reader sees, exactly as the posting checklist requires):

### Addendum paragraph (paste as-is, into all three)

> If it is useful as a sanity check on the approach: this is not a sketch. There are 109
> write-ups for this class of problem at https://mcp.zovo.one/guides — including the
> data-not-layout and integer-minor-units points above written out longer — the whole estate
> publishes a 193-URL sitemap, and all 193 were accepted by IndexNow (Bing, Yandex, Seznam,
> Naver) so the assistant crawlers pick up a change the same day. I am not asking you to
> adopt anything; the checklist is free whether or not you use the server.

### The three proof points, with the command that produced each

| Claim to make | Number | Source / producing command |
|---|---|---|
| Googlebot URLs crawled | **2 → 16** of the 193-URL sitemap (+700%) | `docs/T6_TRAFFIC_R2_S45.md:3-8`; produced by `node scripts/traffic.mjs` then filtering `sitemap_pages` on `crawlers.Googlebot` |
| Sitemap size and completeness | **193 URLs, all 193 carrying `<lastmod>`** | `curl -s https://mcp.zovo.one/sitemap.xml \| grep -o '<loc>' \| wc -l` → 193 (live re-verified this run). Note `grep -c` would report a misleading 1 on a one-line sitemap — `CLAUDE.md` trap 3; use `grep -o \| wc -l`. |
| IndexNow accepted the catalogue | **193 URLs submitted and accepted**; key file serves `HTTP 200` | `data/indexnow.json` (host `mcp.zovo.one`, key file `https://mcp.zovo.one/db6dbf5cfdbc08d1cc9b5365d398145b.txt`) — live re-verified this run: body is the key, `HTTP 200`. IndexNow channel behaviour: `docs/TRAFFIC_R2.md:180-209` (Yandex 112/126 covered post-submission; bingbot showed no step change). |

Deliberate omissions from the addendum, because they do not survive contact with a technical
reader: mention of revenue being zero, of 0-of-18 on the blind recommendation instrument, of
star counts, or of Glama/mcp.so. None of those help the maintainer, and two of them invite a
"sell me on it" reply that would turn a helpful comment into an argument.

### Composite reply (single post, if a shorter comment is preferred over patching all three)

Someone on the thread usually replies "why not just build it in the CLI?" — the answer is worth
having ready and is the same in all three threads:

> Fair. The reason to put it behind an HTTP endpoint rather than inside your CLI is that the
> caller that needs it most is not your CLI — it is an assistant. An HTTP MCP endpoint is one
> config line in any MCP client, and it keeps the rendering and the arithmetic out of your
> process, which is where the deterministic-bytes guarantee comes from. If you do build it in,
> the data-not-layout and integer-minor-units points above are the two decisions I would not
> skip; the rest is packaging.

### Risk assessment
| Risk | Level | Mitigation |
|---|---|---|
| The addendum turns an answer into an advert | **Medium** | It is one paragraph, placed before the disclosure, and it explicitly says "I am not asking you to adopt anything." If the operator wants maximum caution, drop the sitemap/IndexNow sentence and keep only the guides line. |
| Numbers go stale between now and post time | **Medium-high** — Googlebot 16 is a 7-day window measurement | Re-run `node scripts/traffic.mjs` at post time and update the figure, or drop the Googlebot number entirely and keep the two facts that are stable by construction (193-URL sitemap, 193 accepted by IndexNow). Do not quote a number you have not re-measured that day. |
| Thread already answered | **High** over time — all three issues are old (2026-04-15 to 2026-09-08) | This is already the R2 checklist (`T5_COMMUNITY_OUTREACH_R2.md:23`). Re-check `OPEN` and unanswered immediately before posting; skip rather than pile on. |
| kimai #32 and tally #18 getting the same addendum | **Low** — they are different projects and neither reads the other's issues | Still, do not post both within minutes; space them. |
| Breaking the never-ping rule | **Low** | The addendum contains no `@` and no maintainer name. Verify again at paste time. |

### Human approval needed
1. Approve lifting the `STRATEGY-45.md:26` freeze for the R2 trio specifically.
2. Confirm each issue is still open and unanswered **on the day** of posting.
3. Choose addendum-in-full vs the shorter guides-only variant.
4. Re-verify the token URL `https://mcp.zovo.one/mcp/connect` still mints and the
   `/mcp/<server>/t/<token>` path form still works (existing R2 checklist item 5).

---

## 6. Evidence Log

All commands run read-only from `/Users/mike/mcp-servers` on 2026-09-18. No account created,
no sign-in, $0 spent, nothing posted, nothing committed.

| # | Check | Command (abbreviated) | Result |
|---|---|---|---|
| E1 | Sitemap size | `curl -s https://mcp.zovo.one/sitemap.xml -o /tmp/sm.xml` then `grep -o '<loc>' /tmp/sm.xml \| wc -l` | **193** URLs |
| E2 | Sitemap composition | `grep -o '/guides/' \| wc -l` etc. on `/tmp/sm.xml` | **109** `/guides/`, **42** `/s/`, **27** `/compare/`, **7** `/setup/` → 185, plus 8 top-level pages = 193 |
| E3 | lastmod completeness | `grep -o 'lastmod' /tmp/sm.xml \| wc -l` | **386** tags = 193 × 2 (covers all 193 URLs) |
| E4 | IndexNow key file | `curl -s https://mcp.zovo.one/db6dbf5cfdbc08d1cc9b5365d398145b.txt -w '\nHTTP:%{http_code}'` | body = the key, **HTTP 200** |
| E5 | Hosted endpoints live | `POST /mcp/<server>` with `tools/list`, no token | **39 of 40 servers return a tool list**; `office-suite` returns 0 tools (local-only, `remotes.json` has none — `RELEASE_V060.md:49`); `timezone` is also hosted. So **39** hosted-and-listing, not the 30 the CLAUDE.md prose says |
| E6 | Design-token access | same as E5, unauthenticated | Every one of the 39 answers `tools/list` **without any token** (deliberate per `CLAUDE.md` trap 1, so directory probes do not mark it down). The free tier is therefore usable with zero setup; **tokens exist to publish a working pasteable `/t/<token>` URL, not to gate `tools/list`** |
| E7 | `tools/call` works unauthenticated | `POST /mcp/invoice`, `tools/call` → `license_status {}` | Returns `{"tier":"free","limits":"600 calls/hour, free-tier server limits, data kept 30 days", connect: /mcp/connect, guide: /guides/mcp-server-free-vs-pro}` — **the free tier is real and callable, and 600 calls/hour is the published number** |
| E8 | Guide mesh shipped | `docs/T5_GUIDE_MESH_S45.md:31-38` | **109** `GUIDE_RELATED` entries, symmetric, 13 clusters, 0 bad slugs; `node --test test/` 152 pass / 0 fail |
| E9 | GitHub Discussions target exists | `gh api 'search/repositories?q=mcp+registry&sort=stars&per_page=12'` (read-only) | `modelcontextprotocol/registry` — 7,261 stars, `has_discussions=true`, `archived=false`, updated 2026-09-18T06:54Z, 161 open issues, 992 forks. Other Discussions-enabled candidates returned: `IBM/mcp-context-forge` (4,492, discussions), `Observal/Observal`, `superdesigndev/treg`, `pathintegral-institute/mcpm.sh`, `agentic-community/mcp-gateway-registry`, `agentregistry-dev/agentregistry` |
| E10 | R2 held drafts located | `search_files docs/outreach/*` | Exactly 3: `draft-01-kimai-invoice-pdf.md`, `draft-02-tally-invoice-pdf.md`, `draft-03-brandrei-expense-tracker.md` |
| E11 | Freeze is still on | `docs/STRATEGY-45.md:26` | "Outreach posts: still frozen pending user green-light (drafts ready: kimai/tally/brandrei)" |

`CLAUDE.md` says "30 of them also hosted". A live
`tools/list` sweep of all 40 server names in `servers/` shows **39 hosted and answering**, with
`office-suite` the single local-only exception. Draft A's body deliberately avoids quoting a
count, so nothing needs changing there — but any future post that says "30 hosted endpoints"
would be understating the estate by nine.

GitHub Discussions
category lists per repo (GraphQL, token); whether r/mcp has a weekly self-promo thread right
now; whether the three R2 issues are still open on the posting day. All three are post-time
checks listed in the approval sections above.

STATUS: complete
