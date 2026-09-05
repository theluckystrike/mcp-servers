# Content round 16: one-install office-suite guide, refresh setup pages - 2026-09-05

status: DONE

## What shipped

Edited only `billing/src/content.js`, `billing/src/setup.js` and this result file. No changes to
`servers/office-suite/*` or `billing/src/pages.js` (pages.js is generated from server READMEs and
is untouched by GUIDES/SETUP_SERVERS, so no regeneration was needed for this round).

1. New guide `one-install-nineteen-servers-office-suite` in `GUIDES` (`billing/src/content.js`):
   what the office-suite bundle is, the `.mcpb` and the `npx` install line, the 186-tool namespace
   arithmetic (222 child tools minus 36 duplicate `license_status`/`license_activate` pairs), the
   two prefixed tools (`invoice_business_set`, `docx_business_set`), all six round-17 cross-server
   prompts quoted verbatim with what happened and their scores, the measured reach numbers (20/20
   correct child+tool, 83% first-prompt reach, 13/18 total), the three fixed defects (D-R83/84/85),
   and a "when to install single servers instead" section anchored on Windsurf's 100-tool Cascade
   ceiling versus 186 tools in the bundle. `GUIDE_INDEX.description` updated to mention it.
2. `office-suite` already existed in `SETUP_SERVERS` and `ANGLE` (`billing/src/setup.js`) from an
   earlier round, at stale round-8 numbers (5 children, 49-51 tools, 12/12 score). Refreshed in
   place, no new entries added:
   - `SETUP_SERVERS["office-suite"]`: `toolCount` 51 -> 186, `does`, `prompts` (three from round 17:
     the Nova time-tracker+invoice sentence, the logo-resize+stamp three-child sentence, the
     one-call zip bundle), and `measured` rewritten with the round-17 scorecard.
   - `ANGLE["office-suite"]` refreshed for all six pages this bundle gets: claude-desktop,
     claude-code, cursor, vscode, windsurf, cline. Windsurf's angle now says the bundle does not fit
     Cascade's 100-tool ceiling at 186 tools and recommends single servers instead, replacing the
     old "leaves room for one more server" claim that was true at 49 tools and false at 186.
   - Four stale "five child processes" / "49 tools" mentions elsewhere in `setup.js` (the
     `WEB_EXCLUDED` comment, the `WEB_ANGLE` block comment, the claude-code FAQ generator's
     office-suite branch, and `hostedBlock`'s office-suite branch) corrected to nineteen, and the
     hosted-route sentences now name the three hosted children (time-tracker, price-tracker,
     invoice) instead of leaving "three of the five" dangling.

No pages were added under `/setup/<client>/office-suite` for claude-web: `WEB_EXCLUDED` already
lists office-suite there (it starts nineteen child processes, not one URL) and nothing about that
changed.

## Source of every fact

- `docs/USER_VALUE_R17.md`: 19 children, 186 tools, 222 sum, 36 collapsed duplicate license pairs,
  the two prefixed names, all six prompts and their scores/notes, the scorecard totals (13/18, 20
  calls, 226.5 s), the first-prompt reach numbers (5/6 = 83%, strict 3/6 = 50%), the D-R83/84/85
  fix descriptions in the "Fixes (post-round)" section.
- `servers/office-suite/README.md`: install commands (`.mcpb`, `npx`, `claude mcp add`), the
  business_set rename explanation, the per-child data directory path.
- `billing/src/setup.js` (before this round's edit): the existing `CLIENTS`, `ANGLE` and
  `SETUP_SERVERS` shape, and the windsurf 100-tool Cascade ceiling figure already used for every
  other server's windsurf angle (`caveat` on the `windsurf` client entry).

## Quality gate

Run over `billing/src/content.js` and `billing/src/setup.js`:

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|revolutionary|blazing|cutting-edge|leverage' -> 0 (both files)
    grep -cP '\xe2\x80\x94' (em dash)                                                              -> 0 (both files)
    grep -cP '[^\x00-\x7F]' (non-ASCII, catches emoji too)                                          -> 0 (both files)
    node --check billing/src/content.js                                                            -> syntax OK
    node --check billing/src/setup.js                                                               -> syntax OK

An earlier draft used the `&mdash;` HTML entity as a list-item separator in the six-prompt section;
that renders as a literal em dash in the browser even though the raw grep is ASCII-clean, so all
seven occurrences were rewritten as plain colons before the quality gate above was run.

## Verification

    cd billing && npm test                        -> 62 pass, 0 fail
    git -c rebase.autoStash=true pull --rebase origin main   -> already up to date
    wrangler deploy                                -> Version ff249a54-8f8c-42fe-bdb1-1c3d34859828

    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/guides/one-install-nineteen-servers-office-suite  -> 200
    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/setup/claude-desktop/office-suite                  -> 200
    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/setup/claude-code/office-suite                     -> 200
    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/setup/cursor/office-suite                          -> 200
    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/setup/vscode/office-suite                          -> 200
    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/setup/windsurf/office-suite                        -> 200
    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/setup/cline/office-suite                           -> 200
    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/guides                                             -> 200

Content spot-checked in the live HTML of the new guide:

    grep -o "186 tools" live/guide.html            -> match
    grep -o "invoice_business_set" live/guide.html -> match
    grep -o "13 of 18" live/guide.html             -> match

And in the live windsurf setup page:

    grep -o "Cascade's ceiling of 100" -> match (the "install single servers instead" angle)

Rendered word count of the new guide (script/style stripped): 1705.

IndexNow:

    POST https://api.indexnow.org/IndexNow (key from data/indexnow.key, 8 URLs: the new guide, all
    six refreshed setup pages, and /guides) -> HTTP 200

## Content sourcing

No new claims beyond what round 17 already measured and verified against the on-disk stores
(`docs/USER_VALUE_R17.md`'s own "Independent verification of the numbers" table). Every number in
the new guide and the refreshed setup pages traces to that file or to `servers/office-suite/README.md`.

Zero paid API calls.
