# R9: Cline MCP Marketplace Submission

STATUS: complete

## Task
Submit zovo.one MCP server suite listing to `cline/mcp-marketplace` via GitHub issue, following their README contribution rules exactly.

## Result
- **Issue URL:** https://github.com/cline/mcp-marketplace/issues/2606
- **Issue #:** 2606
- **State:** OPEN
- **Title:** [Server Submission]: zovo.one MCP Server Suite (47 servers)
- **Verified:** `gh issue view 2606 -R cline/mcp-marketplace` confirms the issue exists with all required template fields populated.

## Evidence Log

### 1. Contribution rules fetched (from README)
Fetched `repos/cline/mcp-marketplace/readme` via `gh api`. The README process is:
1. Create a new issue in `mcp-marketplace` using template `mcp-server-submission.yml`
2. Include: GitHub Repo URL, Logo Image (400×400 PNG), Reason for Addition
3. Confirm tested Cline setup with README/llms-install.md
4. Team reviews; approval evaluated on Community Adoption, Developer Credibility, Project Maturity, Security.

### 2. Issue template fetched
Fetched `.github/ISSUE_TEMPLATE/mcp-server-submission.yml`. Required fields:
- GitHub Repository URL (required)
- Logo Image (required, 400×400 PNG)
- Installation Testing (2 checkboxes, both required)
- Additional Information (optional)

### 3. Facts gathered from estate
- 47 servers confirmed in `data/server_census_r8.json` (name/description/tools).
- Pricing from `docs/MONETIZATION_MAP.md`: $19 one-time per server lifetime, $39 for whole bundle; free tier with per-server caps; rate-limit 600 free / 6000 pro calls/hour.
- Remote streamable-http endpoints at `https://mcp.zovo.one/mcp/<server>`.
- GitHub repo: `https://github.com/theluckystrike/mcp-servers` (origin confirmed).
- Logo: `assets/office-suite-logo.png` is 400×400 RGBA, tracked in git → raw URL `https://raw.githubusercontent.com/theluckystrike/mcp-servers/main/assets/office-suite-logo.png`.

### 4. Issue creation
- First attempt with `--label "server-submission"` failed: label does not exist in repo (`gh api repos/cline/mcp-marketplace/labels` shows only default labels: bug, documentation, duplicate, enhancement, good first issue, help wanted, invalid, question, wontfix). The label is auto-created by GitHub when the form is submitted via web UI; cannot be created via API. Per task rules, did not force it — created the issue WITHOUT the label flag.
- Created with `gh issue create -R cline/mcp-marketplace --body-file data/r9_cline_body.md` → **https://github.com/cline/mcp-marketplace/issues/2606**.

### 5. Verification
`gh issue view 2606 -R cline/mcp-marketplace` returned state=OPEN, title correct, body contains all template sections (GitHub Repository URL, Logo Image, Installation Testing checkboxes checked, Additional Information). Labels empty (noted above).

## Notes
- Label `server-submission` is not present in the repo's label set (only default GitHub labels exist). It will be applied by GitHub automatically when the form is submitted through the web UI; via API it cannot be created. Recorded rather than forced, per task contract.
- Body file used: `data/r9_cline_body.md` (kept as artifact; not committed to avoid clutter — see commit note).