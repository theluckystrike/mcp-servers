# Client galleries round 1: the in-product picker as a distribution surface (2026-09-08)

status: DONE

Every distribution round so far has worked web directories and awesome-lists — surfaces a
person reaches only if they are already searching the web for MCP servers. This round works
the higher-intent surface: the picker inside the client. A user who opens "add an MCP server"
in VS Code, Cursor, Cline, Windsurf, Zed, LM Studio, Goose or Claude Desktop has already
decided to install something. Nobody on this project had systematically worked those surfaces.

Thirteen named clients plus three found along the way. The four questions asked of each:
does a user browse a gallery there; is that gallery fed by the official MCP registry (in which
case our 85 active rows may already be visible and nobody has looked); what does its own
submission path require; and can that path be completed today with no account, no OAuth, no
fee and no human clicking an external form.

---

## The three findings that matter

**1. VS Code's MCP gallery IS registry-backed, and we are not in it — but not for the reason
anyone would guess.** VS Code 1.129.0 ships `mcpGallery.serviceUrl = https://api.mcp.github.com`
(read straight out of the shipped binary, below). That service self-reports that it syncs from
the official registry:

```
$ curl -s https://api.mcp.github.com/
{"status":"ok", ...
 "sync":{"enabled":true,"strategy":"v2","pipeline_status":"complete", ...},
 "data":{"status":"ready_for_testing","updated_at":"2026-09-08T05:03:14Z",
         "last_oss_snapshot_at":"2026-09-08T04:58:17Z"}}
```

`last_oss_snapshot_at` is 40 minutes before the probe, so the pipeline is live, not stale. But
the gallery holds exactly **250 servers**, against thousands in the official registry, and none
of ours is among them (all three pages enumerated, `grep luckystrike` → 0 hits). So the
GitHub/VS Code gallery is a *slice* of the official registry, not a mirror of it. Being in the
official registry is necessary and not sufficient.

**2. The namespace lever does not transfer to client galleries.** The coordinator asked
specifically whether a registry-backed picker inherits the official registry's strict ASCII
sort on the full server name — the thing that makes `io.github.theluckystrike/*` rank 21st
where `com.bestremotetools/*` ranks 3rd. Measured answer: **no.** The one live registry-backed
gallery re-ranks by popularity, and every other gallery with an order re-ranks by something
else again. Page 1 of the VS Code gallery, in API order:

```
1 microsoft/markitdown          6 io.github.github/github-mcp-server
2 io.github.netdata/mcp-server  7 oraios/serena
3 io.github.upstash/context7    8 coplaydev/unity-mcp
```

ASCII-sorted? `False`. Case-insensitively sorted? `False`. That is a popularity ranking with
namespaces interleaved freely — `microsoft/`, `io.github.`, `com.`, `oraios/` all mixed. The
other orderings found: Goose sorts render-time on the human **display name**
(`.sort((a,b) => a.name.localeCompare(b.name))`), Dify sorts on `install_count DESC`, Smithery
on relevance, Windsurf on a verified-publisher tier. So the naming ceiling recorded in
`data/registry_rank.json` is a *registry-search* problem, not a client-picker problem, and the
namespace claim should be justified on registry search alone. In Goose specifically we would
control our own sort position outright, via the display name we choose.

**3. Packaging, not process, is the gate — and it is already half-open.** Nearly every gallery
wants either a `command` (`npx`/`uvx`, which we cannot produce: npm is human-gated and the
advertised `npx` 404s) or a `url` for a streamable-http endpoint. **We have thirty of the
second kind and nobody had used them.** 30 of our 89 registry rows declare a `remotes[]` block
at `https://mcp.zovo.one/mcp/<server>`, and they answer a real MCP handshake, tested as a
stranger with a freshly minted anonymous token:

```
$ TOK=$(curl -s https://mcp.zovo.one/mcp/token | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")
$ curl -s -X POST https://mcp.zovo.one/mcp/invoice -H "Authorization: Bearer $TOK" \
    -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}'
{"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{"listChanged":true},...},
 "serverInfo":{"name":"mcp-invoice","version":"0.21.0"}},"jsonrpc":"2.0","id":1}   HTTP 200
```

Same run for `time-tracker` and `spreadsheet`: both HTTP 200 with a correct `initialize`
result. That is what unblocked the one real submission this round.

---

## What was done

| Client | Action | Result |
| --- | --- | --- |
| Goose | Opened 3 pull requests, one server per PR, on `block/goose` | [#11917 Zovo Invoice](https://github.com/block/goose/pull/11917), [#11918 Zovo Time Tracker](https://github.com/block/goose/pull/11918), [#11919 Zovo Spreadsheet](https://github.com/block/goose/pull/11919) — all OPEN, MERGEABLE, 1 file, +20 lines each |
| Everything else | Nothing submitted | No other client has a path that is both open and applicable today; reasons per row below |

Nothing was submitted anywhere that required an account, a sign-in, a fee, or a human. No
paid listing was encountered at any point in this round, so there is nothing to record as
`skipped: paid`.

---

## The table

Four questions per client. "Visible" means: did I query that client's own catalogue and find
`io.github.theluckystrike/*` or `zovo` in it.

| Client | Gallery a user browses? | Registry-backed? | Already visible? | Its own submission path | Autonomous today? |
| --- | --- | --- | --- | --- | --- |
| **VS Code** | Yes, two of them | **Yes** (`api.mcp.github.com`) + one hand-curated list | **No** — 250-row slice, 0 hits | None. Inclusion is by GitHub's own selection out of the official registry; there is no form | No — nothing to submit to |
| **Cursor** | No in-app gallery in 3.14.7 | No | n/a | `cursor.directory/plugins/new` (third-party); `cursor/mcp-servers` is **archived** | No |
| **Cline** | Yes | No (own API) | **No** — 199 items, 0 hits | GitHub issue on `cline/mcp-marketplace` | Already done: 30 issues open since earlier rounds, 0 comments |
| **Windsurf** | Yes (Cascade MCP store) | Enterprise custom registries only | Unknowable — no public catalogue endpoint | None documented; listings read as BD partnerships | No |
| **Zed** | Yes | Not yet — **but it is migrating to the official registry** | No | New per-server Rust/WASM extension repo + PR | No — and **deliberately skip**, see below |
| **Continue** | **Dead** | n/a | n/a | n/a | n/a |
| **JetBrains** | No catalogue, manual JSON only | No | n/a | Only the IDE-plugin marketplace, which is a different thing | No |
| **LM Studio** | No catalogue | No | n/a | None — but also **no gatekeeper**: `lmstudio://add_mcp?...` deeplink | n/a — nothing to submit; free lever on our own site |
| **Open WebUI** | No — admin pastes a URL | No | n/a | None for MCP servers | No |
| **LibreChat** | No — yaml + add-by-URL panel | No; its docs send users to Smithery | **No** (and not on Smithery either) | None | No |
| **Dify** | Marketplace exists, but not for MCP servers | No | **No** (`total: 0`) | PR to `langgenius/dify-plugins` | No in practice |
| **Goose** | Yes | No (own `servers.json`) | **No** — 59 entries, 0 hits | **PR editing one file** | **Yes — done, 3 PRs** |
| **Claude Desktop connectors** | Yes | No, Anthropic-curated | No public API | Portal (paid org) or a Google Form | No — both human-gated |

Three surfaces found along the way that were not on the list:

| Surface | What it is | Status |
| --- | --- | --- |
| **GitHub MCP Registry** (`api.mcp.github.com`) | Not a client, but the backing service for VS Code's gallery — and, per its own docs, for other downstream clients | Registry-backed, 250 rows, we are absent |
| **Smithery** | Not a client either, but the site LibreChat's own docs tell users to discover servers on | Absent: `registry.smithery.ai/servers?q=theluckystrike` → 20 results, 0 ours |
| **Claude Code** | No gallery at all; `claude mcp add` takes a command or a URL | Nothing to submit to |

---

## Per-client detail and evidence

### VS Code — the important one

Two distinct surfaces, read out of the shipped application rather than from documentation:

```
$ python3 -c "import json;d=json.load(open('/Applications/Visual Studio Code.app/Contents/Resources/app/product.json'));print(d['version']);print(d['mcpGallery']);print(d['extensionsGallery']['mcpUrl'])"
1.129.0
{'serviceUrl': 'https://api.mcp.github.com', 'itemWebUrl': 'https://github.com/mcp/{name}', ...}
https://main.vscode-cdn.net/mcp/servers.json
```

**Surface A, the MCP gallery** — `api.mcp.github.com`, covered in finding 1 above. Enumerated
in full (3 pages of 100, `metadata.total` = 250):

```
$ # all 250 names pulled, then:
theluckystrike hits: []
```

Why we are absent is worth being honest about, because the obvious explanations are all
falsifiable and I falsified them:

- *Not a star filter.* Four zero-star repos are in it — `anilloutombam/mcp-failure-lab`,
  `devchad-cmd/skilldb-sdk`, `MasterPlayspots/motionspec`, `prest/prest-mcp-adapter`, all
  `stargazers_count=0` via `gh api repos/<r>`. Ours is zero-star too, so that is not the cut.
- *Not a one-server-per-repo rule.* 250 rows resolve to 233 distinct repository URLs;
  `avadev/mcp` contributes 8 and `antohins/seo-tools-mcp` contributes 8. Our 89-from-one-repo
  shape is not disqualifying on its face.
- *Not an mcpb rejection.* 14 packages on page 1 are `.mcpb` GitHub-release URLs (Context7
  ships one), so the format is carried through the sync intact.
- *Not staleness on our side.* `io.github.theluckystrike/invoice-pdf-billing-generator` is
  `0.21.0`, `status: active`, with `remotes[0].url = https://mcp.zovo.one/mcp/invoice`,
  published 2026-09-07 — before the gallery's 2026-09-08 snapshot.

What survives is one hypothesis I could not close, and I am labelling it a hypothesis rather
than dressing it as a result: **the 250 is a ranked cut, and we sit below the line.** It is
consistent with the ordering being popularity-first (finding 2) and with `total` being a round
250. The one supporting negative: zero rows on page 1 are mcpb-only-with-no-remote, which is
the shape 59 of our 89 rows have. The action that follows is not a submission — there is no
form — it is to be worth ranking, and to re-probe. A one-line watch is cheap.

**Surface B, the curated list** — `main.vscode-cdn.net/mcp/servers.json`, gzipped, 37 entries:
`github, figma, notion, linear, playwright, sentry, duckdb, posthog, stripe, paypal, convex,
…, codacy`. Hand-picked by Microsoft, no submission path, and not a realistic target.

VS Code's *extension* marketplace is a third surface and a genuine one, but publishing there
needs an Azure DevOps organisation and a Personal Access Token — account creation, so out of
bounds. Recorded in the human-gated pack rather than attempted.

### Goose — the one real submission

Goose's directory at `block.github.io/goose/extensions` is fed by one file. Traced end to end
rather than assumed: `documentation/src/pages/extensions/index.tsx` → `src/utils/mcp-servers.ts`
(`const SERVERS_URL = "/servers.json"`) → `documentation/static/servers.json` in `block/goose`.
Not registry-backed: `gh api 'search/code?q=registry.modelcontextprotocol.io+repo:block/goose'`
→ `total_count: 0`.

```
$ curl -sL https://raw.githubusercontent.com/block/goose/main/documentation/static/servers.json
HTTP:200 bytes:30531   → 59 entries, "theluckystrike" 0 hits, "zovo" 0 hits
```

It accepts remote entries — 12 of the 59 have no `command`, only a `url` — and there is an
exact precedent for our shape in `rendex-mcp`: a `streamable-http` URL plus an `Authorization`
header, `endorsed: false`, `show_install_command: false`. Ours is strictly friendlier than that
precedent, because the token needs no dashboard, no card and no email.

Community PRs from outside contributors do get merged, checked before submitting rather than
hoped for: `james-see` (#10650), `jamiew` (#10638), `san-npm` (#9861), `mlava` (#9433),
`tgonzalezc5` (#8487), `Dan425953` (#8541). And #10650 changed exactly one file and added one
entry — so **one server per PR is this repo's demonstrated convention**, and I followed it
rather than batching. Three separate PRs, three of the strongest and most distinct servers
(invoicing, time tracking, spreadsheets — no overlap between them), out of thirty that would
have qualified. Each PR body says plainly that two siblings exist as separate PRs and offers
to close any of them if the maintainers would rather take one.

Every listed URL was called as a stranger before it was written into someone else's directory:
`GET` returns 200 with a self-describing body, and `POST initialize` with a freshly minted
anonymous token returns a correct MCP result (transcript in finding 3). A `POST` with no token
returns 401, which is correct protocol behaviour and not a fault.

I did not use the ready-made `https://mcp.zovo.one/mcp/<server>/t/<token>` URLs from
`/mcp/connect`, even though they need no header, because that page says in terms that the token
*is* the data space and the URLs should be treated as private. Publishing one into a public
directory would hand every Goose user the same shared data space. The header form plus
"mint your own" is the only correct thing to list.

### Zed — deliberately doing nothing, and why

Zed has a real gallery (`zed.dev/extensions?filter=context-servers`) and a real PR path, and
this round declines it on purpose. Zed's own documentation, `docs/src/extensions/mcp-extensions.md`,
opens with:

> "We plan to deprecate MCP server extensions in favor of the official MCP registry
> (https://registry.modelcontextprotocol.io/). To keep your MCP server available in Zed,
> publish it to the official registry as well."

Tracking issue `zed-industries/zed#59351`, "Migrate MCP extensions to use the MCP registry", is
OPEN, updated 2026-06-15. The current mechanism would cost one new GitHub repo containing a
Rust/WASM crate *per server*, plus a PR each, into `extensions.toml` (1,467 entries, every one
a git submodule) — and Zed's docs restrict it to servers shipped "as binaries or via NPM",
which our mcpb bundles are neither. Building that into a mechanism its owners have announced
they are retiring, in favour of a registry we are already in, is work with a negative expected
return. The correct action is to watch #59351 and let the migration deliver us. Recorded here
so a future round does not rediscover the PR path and mistake it for an opportunity.

### Cline — already submitted, still queued

30 submission issues open under `theluckystrike`, from earlier rounds, 0 comments on any:

```
$ gh issue list --repo cline/mcp-marketplace --author theluckystrike --state all --limit 40
30 issues, all OPEN, all with 0 comments
```

The queue does move — #2437 was closed 2026-09-05, #2315 on 2026-08-24 — so these are queued,
not ignored. And the catalogue confirms none of ours has landed yet:

```
$ curl -s https://api.cline.bot/v1/mcp/marketplace   → 199 items
  "theluckystrike" in catalog: False
```

Not registry-backed; Cline runs its own API. No further autonomous action exists — commenting
on 30 open issues to chase a maintainer would be spam, which the loop rules forbid.

### Cursor

Cursor 3.14.7 has no in-app MCP gallery. Grepping the shipped app for gallery machinery finds
`extensionsGallery` (VS Code extensions, pointed at `marketplace.cursorapi.com`) and **no**
`mcpGallery` key, and the only MCP URLs in the bundle are `https://cursor.com/docs/mcp` and an
OAuth callback. The old first-party list, `cursor/mcp-servers`, is **archived**
(`gh repo view cursor/mcp-servers --json isArchived` → `true`, last push 2026-03-19), so that
PR path is closed. What remains is `cursor.directory`, a third-party community site whose
submit page is at `/plugins/new`; it returned HTTP 429 when probed, so its exact fields are
unverified and it is recorded in the human-gated pack as needing one human look rather than
written up as fact.

### Windsurf

Gallery exists — the MCP store in the Cascade panel, with a blue check for "official" servers
made by the parent service company, i.e. curated. Registry support exists but is
enterprise-scoped only: "Enterprise teams can configure custom MCP registries… Custom registries
must follow the official MCP registry schema", which is a self-hosted feed for one customer org,
not a listing anyone can join. No public catalogue endpoint exists to check our presence
against: `windsurf.com/api/mcp/servers` and `windsurf.com/mcp-store` both return HTTP 200 with
`content-type: text/html` — SPA shells, not catalogues, and a good example of why a 200 is not
evidence. `server.codeium.com/api/mcp/servers` → 404. No submission path found. Note the docs
now 307 to `docs.devin.ai`.

### Continue — remove from the target list

`dig +short hub.continue.dev` → empty (NXDOMAIN). `continue.dev` resolves to GitHub Pages and
serves `<title>Continue (acquired by Cursor)</title>`. The hub that hosted MCP blocks is gone.
The `continuedev/continue` repo is still pushed, but there is no hub to submit to.

### JetBrains

No catalogue. `Settings | Tools | AI Assistant | Model Context Protocol` takes manual JSON
(command, args, env, working dir); the only automation is "Import from Claude", which re-reads
an existing Claude Desktop config. JetBrains' own MCP help pages mention
`registry.modelcontextprotocol.io`, `mcp.so` and Smithery zero times, and punt discovery to
`github.com/modelcontextprotocol/servers`. The JetBrains Marketplace hosts IDE *plugins* that
happen to wrap MCP servers — a different artefact, needing a JetBrains Account and vendor
approval, and it does not populate the AI Assistant picker. Nothing to submit to.

### LM Studio

No catalogue and no gatekeeper. `lmstudio.ai/mcp` 301s to `lmstudio.ai/docs/app/mcp`, which
says servers are added "by editing the app's `mcp.json` file or via the 'Add to LM Studio'
Button, when available", following Cursor's `mcp.json` notation, and it documents remote HTTP
servers with headers. There is nothing to submit — but there is a free lever: any site can
render an "Add to LM Studio" button, and ours does not. The deeplink shape reported is
`lmstudio://add_mcp?name=<name>&config=<encoded JSON>`; **I have not verified the exact
encoding**, so it is written up as a lead, not a recipe. It needs one page change on
mcp.zovo.one, which is outside this round's file ownership.

### Open WebUI, LibreChat, Dify — no gallery to enter, and none needed

All three already accept a pasted hosted URL, which is exactly what we have:

- **Open WebUI** has had native MCP since v0.6.31 — `Settings > Admin > Integrations >
  External Tool Servers > + Add Connection`, Type `MCP (Streamable HTTP)`, paste URL and auth.
  Its community site `openwebui.com/tools` HTTP 302s to a login gate and carries Python
  Tools/Functions, not MCP servers.
- **LibreChat** takes `mcpServers:` in `librechat.yaml` plus an in-app MCP Settings panel where
  the user types a URL. Its docs outsource discovery to Smithery, where we are also absent.
- **Dify** adds MCP servers by URL under `Tools > MCP`. Its marketplace lists Dify *plugins*,
  and the two most-installed MCP plugins are generic clients that accept any pasted
  streamable-HTTP URL (`junjiem/mcp_see_agent`, 141,214 installs; `junjiem/mcp_sse`, 117,999) —
  so our endpoints already work in Dify today with no listing at all. We are absent from that
  marketplace (`query: "theluckystrike"` → `{"plugins":[],"total":0}`), and the only path in is
  a packaged `.difypkg` Python plugin whose PR template requires attesting that you tested it
  on Dify Cloud — an account, therefore out of bounds, and the artefact would be a wrapper
  plugin rather than an MCP-server listing anyway.

Cross-check that none of the three is registry-backed:
`gh api -X GET search/code -f q='"registry.modelcontextprotocol.io" repo:danny-avila/LibreChat repo:open-webui/open-webui repo:langgenius/dify'` → `total_count: 0`.

The leverage for these three is not a submission. It is per-client copy-paste setup snippets on
mcp.zovo.one and in the 33 mirror READMEs — a content change, not a distribution one.

### Claude Desktop connectors

A real curated directory, Anthropic-run, no public catalogue API, so our presence cannot be
checked. Two submission paths, both gated, both written out in full in the human-gated pack:
the remote-MCP portal needs a Team or Enterprise organisation (a paid plan) and an Owner role,
and the `.mcpb` desktop-extension path — which is *exactly* our format — is a Google Form
behind a sign-in wall (`clau.de/desktop-extention-submission` → 302 → `docs.google.com/forms/…`
→ HTTP 401). Nothing submitted.

---

## Two side answers the coordinator asked for

**The `0.14.0` row is not a stale republish.** The registry keeps one row per published version
and only flags one as latest; a search without `version=latest` returns the whole history.

```
$ curl -s ".../v0/servers?search=io.github.theluckystrike/aging&limit=100"
  rows: 8   versions: ['0.14.0','0.15.0','0.16.0','0.17.0','0.18.0','0.19.0','0.20.0','0.21.0']
  isLatest: io.github.theluckystrike/aging 0.21.0
$ curl -s ".../v0/servers?search=io.github.theluckystrike/aging&version=latest&limit=100"
  io.github.theluckystrike/aging 0.21.0 active
```

Across all 89 latest rows: 85 at `0.21.0` `active`, and 4 at `0.1.1` `deprecated` —
`invoice`, `price-tracker`, `spreadsheet`, `time-tracker`, all deprecated 2026-09-02, which is
the naming round deliberately retiring the old short names. No manifest silently failed to
republish.

**`com.bestremotetools` is not yet in the VS Code gallery** — expected, it was claimed today.
For scale, that gallery already carries 62 `com.*` rows against 114 `io.github.*` rows, so the
namespace is not itself a barrier to entry there; and per finding 2 it would not change our
position in the ordering if it were.

---

## What this round changes about the plan

The client-picker thesis half-survives. The surface is real and high-intent, but twelve of the
thirteen clients turn out to have either no gallery, no submission path, or a human gate — and
the one registry-backed gallery that could have carried all 85 rows for free applies a cut we
sit below. So the picker is not a distribution channel we can simply walk into.

What did come out of it is more useful than another directory row:

1. **The hosted endpoints are an unused asset.** Thirty working streamable-http URLs existed and
   no distribution round had ever used one. They are what made the Goose submission possible,
   they are what make Open WebUI, LibreChat, Dify and LM Studio work with zero listing, and they
   sidestep the npm block entirely. The npm gap is real; it is not the gate on this surface.
2. **The namespace claim should be justified on registry search alone.** No client picker
   inherits the ASCII sort. Nothing here argues against the claim, but nothing here argues for
   it either, and a future round should not double-count the benefit.
3. **VS Code's gallery is worth a standing watch, not a campaign.** One probe per loop against
   `api.mcp.github.com` for `luckystrike`, and against `metadata.total` to see whether the 250
   cut is loosening. If we ever appear there, that is 85 rows in front of the largest MCP client
   population there is, for nothing.
