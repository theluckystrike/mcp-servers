# Distribution round 3: the four surfaces round 2 marked submittable (2026-09-12)

Round 2 (`docs/DISTRIBUTION_R2.md`) closed with a list of free, agent-submittable surfaces not yet
used. This round takes the four that are pull-request catalogues: Chat2AnyLLM/awesome-mcp-servers,
zencoderai/zenagents-library, jaw9c/awesome-remote-mcp-servers and
Appnova-EU-OU/awesome-remote-mcp-servers. Machine-readable rows are in `data/distribution_r3.json`.
Working copies live in `.scratch-distribution/` (gitignored), which holds forks cloned under
`github.com/theluckystrike/`; no project remote was touched.

**4 surfaces attempted, 4 pull requests opened, all 4 verified OPEN by reading them back with
`gh pr view`. 8 servers submitted to each: invoice, pdf, time-tracker, expense-tracker,
spreadsheet, currency, quotes, bank-statement. 0 paid surfaces, 0 accounts created, 0 logins,
0 stars given.**

## Submitted, with the real numbers

| Surface | Submission | Verified state | Entries | Files in PR |
|---|---|---|---|---|
| Chat2AnyLLM/awesome-mcp-servers | [#22](https://github.com/Chat2AnyLLM/awesome-mcp-servers/pull/22) | OPEN | 8 yaml entries + rebuilt dist | 13 |
| zencoderai/zenagents-library | [#31](https://github.com/zencoderai/zenagents-library/pull/31) | OPEN | 8 json entries, 99 to 107 | 1 |
| jaw9c/awesome-remote-mcp-servers | [#769](https://github.com/jaw9c/awesome-remote-mcp-servers/pull/769) | OPEN | 8 table rows | 1 |
| Appnova-EU-OU/awesome-remote-mcp-servers | [#614](https://github.com/Appnova-EU-OU/awesome-remote-mcp-servers/pull/614) | OPEN | 8 json manifests | 8 |

Read-back command for each: `gh pr view <url> --json state,title,files`. All four returned
`OPEN` with the expected file lists at 2026-09-12.

Every PR body carries one plain sentence disclosing that the submitter is the author of the
servers. No PR ticks a checkbox whose check was not actually run; the two repos without a
validation command say so in text and quote what was run instead.

## Per-surface findings

### Chat2AnyLLM/awesome-mcp-servers (PR #22)

Submission path per CONTRIBUTING: one `servers/<slug>.yaml` per server, then `make ci`, commit
including `dist/`. The schema (`schema/mcp-server.schema.json`) accepts two shapes; the entry
copied is `servers/process-street-mcp.yaml`, merged 2026-09-03: the documented
slug/title/description/url/tags/category/author/license block plus an `installations` block with
a remote http endpoint.

Finding worth keeping: **the build silently drops documented-format entries that have no
`installations`, `npm` or `docker` field.** `normalize_server` in `scripts/build.py` returns None
for them, so `servers/bulkpublish.yaml` (PR #15, merged) never reaches `dist/servers.json`
(`grep -c '"slug": "bulkpublish"' dist/servers.json` on upstream main returns 0). The
installations block is what makes an entry land in the built catalog; ours carry one, with the
hosted URL in the `/mcp/<server>/t/<token>` path form and the token requirement stated in the
description.

Validation run, quoted from the run:

- `python scripts/validate.py`: `All valid: 402 server(s), 2 source(s).` (394 files before, 8 added)
- `python -m unittest discover -s tests -v`: `Ran 3 tests in 0.002s` / `OK`
- `python scripts/build.py`: wrote `dist/servers.json` with `396 servers`; each new slug checked
  present with `grep -c '"slug": "<slug>"' dist/servers.json` returning 1 for all 8
- `python scripts/update_readme.py`: README stats moved 388 to 396, nothing else changed

Environment note disclosed in the PR: under the macOS system Python 3.9.6 the `test` step of
`make ci` fails to import `scripts/build.py`, which uses the `dict | None` annotation from Python
3.10. The passing run used Python 3.13 (`/opt/homebrew/bin/python3.13`, fresh venv with
`requirements.txt`: pyyaml, jsonschema).

### zencoderai/zenagents-library (PR #31)

`mcp-library.json` is the live product: `.github/workflows/upload-json-to-gcloud.yml` copies it
to `gs://zencoder-public/` on every push to main that touches json. Observed schema: a dict keyed
by lowercase name; entries carry `name`, `description`, `link`, `icon` (64x64 PNG, base64, one
line), `author`, `configs` (a list of stdio `command`/`args`/`env` objects).

Two honest absences, stated in the PR body:

- **No url-based remote config precedent.** All 99 existing entries are stdio; ours bridge the
  hosted endpoint with `npx mcp-remote` (`npm view mcp-remote version` returned 0.13.5) and the
  `/t/<token>` URL, with the token requirement in each description.
- **Submission precedent is thin but real**: PR #17 ("Add taskmaster and context7 MCPs to
  library") was a cross-repository fork PR merged 2025-07-04. Whether that author is affiliated
  with Zencoder is not knowable from here.

There is no validation command for this file in the repo, so the check was
`python3 -c 'import json; json.load(open("mcp-library.json"))'` after editing plus an assertion
script (`.scratch-distribution/insert_zenagents.py`) that verified the count (99 to 107) and each
new entry's fields. The edit was a text-level splice, not a json re-dump, because the file's
formatting (compact inline `args` arrays, one mis-indented `github` key) is not reproducible by
`json.dumps`; the diff is 104 added lines and 0 deletions. Icons are the project's own
`assets/<server>-logo.png` resized 400 to 64 px with `sips -z 64 64`.

### jaw9c/awesome-remote-mcp-servers (PR #769)

The lottery ticket as billed: 1,113 stars, last push 2026-06-23 (`gh repo view
jaw9c/awesome-remote-mcp-servers --json pushedAt,stargazerCount`), and our PR number 769 reflects
a queue hundreds deep. Format is one markdown table
`| Name | Category | URL | Authentication | Maintainer |`; CONTRIBUTING's "must be OAuth 2.0" is
contradicted by the README's own authentication section and by dozens of merged `API Key` rows, so
the rows carry `API Key`. Eight rows appended after the last table row (Wolfram, line 176),
matching how recent merged additions landed.

Pre-opening verification, quoted in the PR body: POST initialize to each printed URL returned
HTTP 200 with `protocolVersion 2025-03-26` and the tools capability, all 8 of 8, via
`curl -X POST https://mcp.zovo.one/mcp/<server> -H 'Content-Type: application/json' -H 'Accept:
application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize",...}'`.
The bare URL needs a token for `tools/call`; the API Key column and the PR body both say where
the token comes from.

### Appnova-EU-OU/awesome-remote-mcp-servers (PR #614)

Alive (pushed 2026-09-11) and the most rigorous of the four: a draft-07 schema with
`additionalProperties: false`, a PR template with a seven-item checklist, and a CI workflow
(`.github/workflows/validate-pr.yml`) whose four checks were replicated locally before ticking:

- `check-jsonschema --schemafile schemas/server.schema.json servers/productivity/theluckystrike-*.json`:
  `ok -- validation done`, 8 of 8
- `curl -s -o /dev/null -w '%{http_code}' -I -L --max-time 15 <git_url>`: HTTP 200, 8 of 8
- `author_github` present in all 8 files (enforced by the schema, confirmed in the files)
- duplicate scan across the registry: 0 duplicate (git_url, name) pairs among 39 entries
  (31 existing + 8 new)

Entry shape copied from the existing `servers/productivity/ejwhite7-brandkit-mcp.json`, with
`homepage` carrying the product page (`https://mcp.zovo.one/s/<server>`). The schema has no
remote-endpoint field, so the hosted URL sits in the description text.

## What this round does not claim

All four PRs are OPEN, not merged. jaw9c and Appnova both carry 600-plus open PRs and may never
merge; Chat2AnyLLM merges outside PRs routinely (four on 2026-09-03) and zenagents-library has
done it at least once. The verified state above is a snapshot at 2026-09-12; re-run the read-back
command before quoting it later.
