# mcp-checklist

Checklists you build once and run many times, and the dated record of each run that
somebody signs. A checklist is a named list of steps, optionally grouped into sections, each
one required or optional. A run is one pass of that checklist against a job: every step is
marked pass, fail or not applicable, with who marked it and on what day, and a note that
says what was found. `run_sign_off` then puts a name and a date on it and freezes it.

## The one rule that decides everything else

**A run copies its checklist when it starts.** If somebody edits the checklist afterwards,
adds a step or deletes one, every run already in progress keeps the list it started with,
and the version it was copied from is recorded on the run.

That is not a caching convenience. A checklist somebody ticked and signed has to be the list
they actually saw. A run that read its steps live from the checklist would mean a signed
handover certificate for eleven checks when the person signing it saw ten, with no field in
the record showing that it had happened. It also means deleting a checklist leaves its runs
readable and complete, which is what you want the year afterwards when somebody asks what
was checked.

Two smaller rules follow from it:

- **Nothing derived is stored.** The pass, fail and outstanding counts, the percentage, and
  whether a run can be signed off are worked out on every call from the run's own steps. A
  stored "complete" flag is a fact about the afternoon somebody last looked, and `complete`
  here is a reading: it appears when the last step is answered and goes away again when one
  is put back to pending.
- **Not applicable is not a pass.** `na` counts as ANSWERED and never as passed. A step that
  was looked at and dismissed is a different fact from a step that passed, and merging the
  two is how a checklist reports full marks for a job where half the steps did not apply.

## What blocks a signature

A required step that is unanswered, a required step that failed, an unanswered optional
step, or a run with no steps. `force: true` signs anyway, and the exceptions stay on the
record and print on the report under "Signed with exceptions". They are not lost, and they
are not silent.

## Install

**One-click (.mcpb):** download `checklist.mcpb` from the latest release and double-click it
in Claude Desktop: https://github.com/theluckystrike/mcp-servers/releases/latest

npm publish for `@theluckystrike/mcp-checklist` is pending, so the `npx` line below returns
404 today. Build from source in the meantime; see `llms-install.md`.

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "checklist": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-checklist"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add checklist -- npx -y @theluckystrike/mcp-checklist
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project), same entry as Claude Desktop.

## Tools

| Tool | What it does |
| --- | --- |
| `checklist_create` | Create a reusable checklist: a name, a category, a description |
| `checklist_item_add` | Add a step: the text, a section heading, and whether it is required |
| `checklist_item_remove` | Remove a step and bump the version. Runs already under way keep it |
| `checklist_show` | One checklist, grouped by section, with a blank printable copy on request |
| `checklist_list` | Every checklist with its version, step count and how many runs came from it |
| `checklist_delete` | Delete a checklist. Its runs stay readable, because each carries its own copy |
| `run_start` | Start a dated run against a job. The steps are copied into it at this point |
| `run_check` | Mark one step pass, fail or na, with who and when and what was found |
| `run_show` | The run: every step with its answer, the counts, the failures, and what blocks sign-off |
| `run_list` | Runs newest first, filtered by checklist, status, reference, or only those with failures |
| `run_sign_off` | Sign off with a name and a date, which freezes the run |
| `run_status` | Reopen a complete run, or abandon one when the job did not happen |
| `run_report` | The run as text on every tier. Pro also writes it to `out_path` as a .txt file |
| `run_delete` | Delete a run. A signed-off one is refused |
| `license_status` | Which tier this install is on and where the key came from |
| `license_activate` | Store a Pro key for this server |

There is also a resource, `checklist://contract`, carrying the snapshot rule, the item
states, the run status machine, what blocks a sign-off and where this server writes; and a
prompt, `run_the_checklist`, that walks the whole job in order.

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Checklists you keep | 3 | unlimited |
| Runs of them | unlimited | unlimited |
| Steps per checklist | up to 500 | up to 500 |
| `run_show`, `run_list`, the counts | yes | yes |
| The run report as text | yes | yes |
| Writing the report to a file with `out_path` | no | yes |

The meter is on how many DIFFERENT checklists you keep, not on how many jobs you check. A
trade with one pre-delivery check, one handover sheet and one snag list runs its whole year
inside the free tier. Runs are never capped, because capping the running of a checklist would
cap the only thing a checklist is for. Deleting a checklist frees a slot.

**Get Pro:** https://mcp.zovo.one/buy/checklist (one-time), or all servers for one price at
https://mcp.zovo.one/buy/bundle

## Privacy

All data stays local, in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/checklist/`. There is
no network call anywhere in this server, no API key, and no account. The only file it reads
that it does not own is the shared business profile, for the name and address at the top of a
printed report, and it never writes to it.

Built by [theluckystrike](https://github.com/theluckystrike). Support: support@zovo.one
