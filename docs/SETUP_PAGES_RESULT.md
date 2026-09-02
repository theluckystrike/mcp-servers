# Setup pages run - 2026-09-03

status: DONE

## What shipped

43 URLs under `/setup`, served by the billing Worker at mcp.zovo.one:

- `/setup` - index, the client comparison table (config file, top-level key, the one thing that breaks)
- `/setup/<client>` - 6 client hubs
- `/setup/<client>/<server>` - 36 pages, 6 clients x 6 servers

Content and page builders live in `billing/src/setup.js` (`CLIENTS`, `SETUP_SERVERS`, `ANGLE`, `FAQ`,
`setupPage`, `clientHub`, `setupIndex`, `setupUrls`). `billing/src/index.js` routes `/setup*` through
the existing `page()` helper and injects the meta description, canonical, a `TechArticle` block and,
on the 36 leaf pages, a `FAQPage` block after `</title>`, the same way `/s/:id` and `/guides/:slug` do.

Copy is generated from three sources so no two pages read alike: the client row (paths, key, CLI,
verified caveat), the server row (three prompts taken verbatim from that README's "What you can say"
table, free/pro limits, one measured number from `docs/USER_VALUE_R4.md`), and `ANGLE[server][client]`,
36 sentences written one per pair. Each page carries one H1 `<Server title> in <Client name>`, the
exact config path table and JSON or CLI for that client, the hosted-endpoint alternative with the
bearer line, the client caveat, a 3-question FAQ matching the JSON-LD, and links to `/s/<server>`,
`/guides`, both neighbouring client pages and the client's own MCP documentation.

## Verified client facts

Every row below was read off the client's own public documentation with curl on 2026-09-03. Three of
my starting assumptions were wrong and were removed rather than shipped.

| Client | Config file | Key | CLI | Verified caveat used on the page |
|---|---|---|---|---|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), `%APPDATA%\Claude\claude_desktop_config.json` (Windows) | `mcpServers` | none, Settings > Developer > Edit Config | Paths must be absolute; a stdio server "inherit[s] only a limited subset of environment variables (the exact set is platform-dependent)". A full quit and restart is required. `.mcpb` (renamed from `.dxt`) installs by opening the file, or Settings > Extensions > Advanced settings > Install Extension; Claude Desktop "includes a built-in Node.js environment" |
| Claude Code | `~/.claude.json` (local, user), `.mcp.json` (project root) | `mcpServers` | `claude mcp add`, `--transport http/sse`, `--header`, `-t`/`-H`, `add-json`, `list`, `get`, `/mcp` | `--` separates Claude Code's options from the server command. Default scope is `local` and is per-directory. A server from a cloned repo sits at pending approval until the workspace is trusted |
| Cursor | `<project>/.cursor/mcp.json`, `~/.cursor/mcp.json` | `mcpServers` | none documented | `type` is marked **required** in the current field table (`stdio` for a local server). `envFile` is stdio-only; remote HTTP/SSE servers do not support it. Managed from the **Customize** page |
| VS Code | `.vscode/mcp.json`, user-profile `mcp.json` | `servers` | `code --add-mcp '{...}'`, MCP: Add Server | The key is `servers`, not `mcpServers`. `inputs` array for secrets, referenced as `${input:id}`. Adding or changing a server raises a trust confirmation before it starts. The newer Agent Host does not read `.vscode/mcp.json` directly |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` | none documented | That file applies to the **legacy Cascade agent only**; the Devin Local agent (default for new tabs) reads the Devin CLI config files. Hard cap: "Cascade has a limit of 100 total tools". Deeplink `windsurf://windsurf-mcp-registry?serverName=<name>` |
| Cline | `~/.cline/mcp.json` (CLI); extension file opened from the panel | `mcpServers` | `cline mcp`, `cline config mcp --json` | Omitting `type` "defaults to the legacy `sse` transport for backward compatibility", so a hosted endpoint needs `"type": "streamableHttp"` written in. Per-server `disabled` flag and `autoApprove` array |

Removed because they could not be verified today, rather than shipped as fact:

- Cursor `cursor://anysphere.cursor-deeplink/mcp/install?name=...&config=<base64>`. The current
  deeplink reference documents only `prompt`, `command` and `rule` links. The pages say so and point
  at the config block instead.
- Cursor tool-count cap. No number is published. Windsurf's 100-tool cap **is** published, so the
  tool-budget argument is made only on the Windsurf pages, where it is real.
- Cline `cline_mcp_settings.json` under `saoudrizwan.claude-dev/settings/`. That path is no longer in
  the docs, which deliberately say only "the MCP settings JSON used by the extension". The pages route
  the reader through the panel and give `~/.cline/mcp.json` for the CLI.
- Claude Desktop Linux path: not published (macOS and Windows only), so the table has two rows.
- "nvm needs an absolute node path" is stated as the consequence of the two facts that *are*
  documented (absolute paths, limited env inheritance), not as a quoted claim.
- VS Code "enable agent mode": no longer a documented step; replaced with the trust confirmation.

Two doc URLs now redirect to renamed products; the pages link the redirect targets
(`docs.devin.ai/desktop/cascade/mcp`, `docs.cline.bot/mcp/mcp-overview`).

## URLs, status, word counts

All 43 return HTTP 200 with the expected `<title>`. Word counts are of rendered text with tags
stripped, code blocks included.

| Page group | Count | Words |
|---|---|---|
| `/setup` index | 1 | 258 |
| `/setup/<client>` hubs | 6 | 258-297 |
| `/setup/<client>/<server>` | 36 | 490-551 |

Per client, across its six server pages: claude-desktop 523-548, claude-code 532-550, cursor 490-519,
vscode 533-551, windsurf 504-528, cline 505-551. Longest meta description 154 characters, under the
155 the injector slices at.

`/sitemap.xml` now carries 56 `<loc>` entries (was 13): home, `/guides`, 5 product pages, 6 guides,
43 setup URLs. `/llms.txt` gained a "Setup, per client" section, one line per client naming its config
file and key plus all six of its page links. `/` links `/setup` from a new "Setup guides per client"
section, and every `/s/<id>` page carries a "Set it up in your client" row linking that server's six
client pages.

## Quality gate

Run over the 43 live pages concatenated (`live.html`, 346,350 bytes) and over `billing/src/setup.js`:

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|
                 revolutionary|blazing|cutting-edge|leverage'  -> 0
    grep -c $'\xe2\x80\x94'  (em dash)                          -> 0
    grep -cP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' (emoji)   -> 0
    grep -nP '[^\x00-\x7F]' billing/src/setup.js (non-ASCII)    -> no match
    grep -o 'FAQPage' live.html | wc -l                         -> 36
    grep -o 'rel="canonical"' live.html | wc -l                 -> 43

## Deploy and submission

    cd billing && npm test                 -> 18 pass, 0 fail
    wrangler deploy                        -> Version 8ce172d3-ab63-4993-a4da-d56292573cb4
    curl x43                               -> 43 x HTTP 200, titles as expected
    POST https://api.indexnow.org/IndexNow -> HTTP 200, 43 URLs, one request
    GET  /22fad93b71a88e2e60acae203c4288ae.txt -> HTTP 200

Zero paid API calls. Nothing paid submitted. Doc verification was curl against public pages only.

## Numbers sourced, not invented

Every measured claim comes from `docs/USER_VALUE_R4.md` or from the server source:

- invoice: INV-2026-0001, subtotal EUR 275.00, 23% VAT EUR 63.25, total EUR 338.25, file begins
  `%PDF-1.3` at 2,495 bytes.
- expense-tracker: EUR 61.50 stored as `amount_minor 6150`, `vat_rate 23`, rebilled at net
  `unit_price` 50.00 so the invoice does not tax it twice.
- time-tracker: one tool call per sentence, 7.7 s and 14.6 s.
- spreadsheet: the group-by ranking was 5 calls and 71 s via a python fallback, now one `sheet_query`.
- office-suite: startup line `proxying [...], 49 tools`; 51 tools with its own license pair; the
  audited bundle conversation scored 12/12.
- claude-code caveat: 1 of 3 fresh first prompts made zero tool calls although `initialize` answered
  in 1.05 s; `claude mcp list` first is the workaround.
- price-tracker: D-R9, `price_check` skipped in favour of a general fetcher, stated as a limitation on
  every price-tracker page rather than hidden.
- Tool counts (`grep -c registerTool` plus the license pair): 13, 10, 10, 12, 14, and 51 for the suite.

## RESULT.md

```
status: DONE
evidence:
  43 URLs live, all HTTP 200 with expected titles (curl loop over setupUrls())
  36 leaf pages 490-551 words, 6 hubs 258-297, index 258
  sitemap.xml 56 <loc> (43 are /setup), llms.txt 6 per-client setup lines
  home links /setup; every /s/<id> links its 6 client pages
  quality gate over 346,350 live bytes: hype 0, em dash 0, emoji 0, non-ASCII in setup.js 0
  36 FAQPage blocks, 43 canonicals, longest meta description 154 chars
  npm test 18 pass 0 fail; wrangler deploy 8ce172d3-ab63-4993-a4da-d56292573cb4
  IndexNow POST 200 for all 43 URLs in one request; keyLocation 200
artifacts:
  billing/src/setup.js (new)
  billing/src/index.js (routes, sitemap, llms.txt, home link, /s/<id> link)
  docs/SETUP_PAGES_RESULT.md
  data/distribution.json (guides note updated, setup surface added)
cost: 42 wall minutes
failures:
  4 of my 6 assumed client mechanisms were stale or unverifiable and were cut before writing:
  Cursor's MCP deeplink, Cursor's tool cap, Cline's cline_mcp_settings.json path and its
  marketplace. Windsurf's and Cline's doc URLs both redirect to renamed products.
  First draft measured 731-931 words per page against a 350-550 target; five trim passes
  brought it to 490-551 by cutting client prose that repeated the hub page, not by cutting facts.
insight:
  The differentiating facts are the ones that are wrong somewhere else. Four of six clients use
  mcpServers and VS Code uses servers; five default to a sane transport and Cline falls back to
  legacy sse; one publishes a tool cap (Windsurf, 100) and the client everyone assumes has one
  (Cursor) publishes none. A generated page per pair is only worth serving because those four
  facts differ; had they matched, 36 pages would have been one page with a client dropdown.
```
