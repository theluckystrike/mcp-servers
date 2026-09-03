# mcp-resume

Store your CV facts once. Then say "tailor my resume to this posting and write the cover letter" and get two real
`.docx` files: a resume whose bullets are reordered by relevance to the posting, trimmed to fit the page count you
asked for, with the posting's keywords in bold where you actually have them -- and a one-page cover letter that
states nothing you did not put in your profile. Where a fact is missing, the letter leaves a bracketed prompt like
`[add: metric]` instead of inventing a number. It also reads an existing resume `.docx` back into the profile shape,
exports markdown for an ATS box, and writes printable HTML. Everything runs locally: no upload, no account, no
native dependency.

![resume demo](../../assets/demo-resume.gif)

**A resume that fits the page and a cover letter that cannot lie about you.**

## 60-second install

npm publish for `@theluckystrike/mcp-resume` is pending. Until then, the `.mcpb` one-click bundle or a clone+build
is the working path -- both are verified below.

**One-click (.mcpb):** download `resume.mcpb` from the latest release and double-click it in Claude Desktop:
https://github.com/theluckystrike/mcp-servers/releases/latest

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "resume": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-resume"]
    }
  }
}
```

**Claude Code:**

```sh
claude mcp add resume -- npx -y @theluckystrike/mcp-resume
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "resume": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-resume"]
    }
  }
}
```

The `npx` form above starts working the moment the package is published. Until then, use the .mcpb bundle above, or
build from source with exactly these three commands:

```sh
git clone https://github.com/theluckystrike/mcp-servers.git && cd mcp-servers
npm install
npm run build -w packages/mcp-license -w servers/docx -w servers/resume
```

Then point your client's `command` at `node` with one arg: the absolute path to `servers/resume/dist/index.js`.
`servers/docx` is in that build list because this server shares the document engine with
[mcp-docx](../docx) rather than carrying a second copy of it.

To run in Pro mode set `MCP_LICENSE_KEY` in the same config block, or call `license_activate` once with your key.

## Tools

| Tool | What it does |
| --- | --- |
| `profile_set` | Store the facts every output is built from: name, email, phone, location, links, summary, skills, roles with bullets, education, certifications, languages. One profile per data directory; Pro adds named variants |
| `profile_get` | Return the stored profile as JSON, exactly as the other tools see it |
| `resume_create` | Write the resume as `.docx`. Bullets are ranked by keyword hits and recency, then trimmed to `max_pages` against a measured word budget; matched keywords are bolded, missing ones are reported and never added. Styles: `modern`, `classic`, `compact` |
| `cover_letter_create` | A one-page letter in four parts -- opening, fit, proof, close -- drawn only from the profile. Tones: `formal`, `direct`, `warm`. Unknowns come back as `[add: ...]` prompts |
| `tailor_to_job` | Gap analysis against a posting: the keywords it actually asks for, which of them your profile already covers, which it does not, a coverage figure, and rewrites that only reorder facts you already stated |
| `resume_read` | Read an existing resume `.docx` back into the profile shape, section by heading. Best effort; nothing is saved unless `save: true` |
| `resume_to_markdown` | The resume as markdown, for an application form or an ATS box |
| `resume_to_html` | Printable HTML with a print stylesheet. Open it and print to PDF |
| `license_status` | Show free or Pro mode |
| `license_activate` | Activate a Pro key (verified offline) |

Resource: `resume://profile` returns the stored profile as JSON.
Prompt: `apply_to_job` chains `tailor_to_job`, `resume_create` and `cover_letter_create` against one posting, and
makes the model report the gaps back to you instead of filling them in.

## The cover letter does not invent facts

This is the part that matters, so it is enforced rather than requested:

- Every proof line in the letter is a **verbatim bullet from your profile**. The letter never paraphrases a
  bullet into a stronger claim.
- A `highlights` entry you pass is checked against the profile first. If the profile does not support it, it is
  printed as `[add: "..." is not in your profile - add it there or drop it]`, not as a claim.
- Before the file is written, every digit run in the letter is checked against your profile and the arguments you
  passed. A number that traces to neither is a refusal, not a warning -- the tool returns an error and writes nothing.
  The job description is deliberately **not** an allowed source: the employer's revenue, headcount and throughput
  figures are theirs, and the letter will never restate one as yours. Comparison is on whole numbers, so a profile
  holding `2012` does not license a letter claiming `12`.
- Each proof bullet is printed under the role it actually belongs to. A letter that quotes work from two employers
  prints two headings; work from an earlier job is never listed under your current one.
- A bullet that carries no figure gets ` [add: metric]` appended, so the letter asks you for the result instead of
  guessing one.
- Missing keywords from `tailor_to_job` never become skills. The response says so in plain words.

## What you can say

| You say | Tool |
| --- | --- |
| "Here is my CV: Ada Rowe, backend engineer, Acme Pay since 2021, ..." | `profile_set` |
| "Read my old resume at ~/Documents/cv.docx and set up my profile." | `resume_read` |
| "How well do I match this posting?" | `tailor_to_job` |
| "Make me a one-page resume for this Staff Engineer role." | `resume_create` |
| "Write the cover letter for Zeta Systems, direct tone." | `cover_letter_create` |
| "Give me the plain-text version for the application form." | `resume_to_markdown` |
| "I need a PDF to attach." | `resume_to_html`, then print to PDF |
| "Apply me to this job." | the `apply_to_job` prompt |

## Worked example

```
You: Tailor my resume to this posting and write the letter. One page.

  tailor_to_job { job_description: "...payments platform, PostgreSQL, Kubernetes..." }
  -> matched: payments, postgresql, kubernetes   missing: rust
  -> coverage 75%

  resume_create { style: "modern", target_role: "Staff Engineer",
                  keywords: ["postgresql", "kubernetes", "rust"], max_pages: 1 }
  -> estimated_pages 1, words_used 402 of a 384-word budget for bullets
  -> bullets_dropped: ["Wrote the deployment pipeline"]
  -> keywords_missing: ["rust"]  (not added anywhere)
  -> ~/.local/share/mcp-servers/resume/documents/ada-rowe-resume.docx

  cover_letter_create { company: "Zeta Systems", role: "Staff Engineer", tone: "formal" }
  -> fills_required: ["[add: metric]"]
  -> ~/.local/share/mcp-servers/resume/documents/zeta-systems-staff-engineer-cover-letter.docx
```

## How page trimming works

There is no page-layout engine in pure JavaScript, so this server does not pretend to measure one. It uses a word
budget instead: a full A4 page at 11pt Calibri with 2cm margins holds about 520 words of body text, and a resume
spends roughly a seventh of that page on headings, blank lines and the contact block. The net figure is **450 words
per page** (540 for the `compact` style). The contact block, summary, skills, role headers, education,
certifications and languages are counted first; whatever budget is left goes to experience bullets, highest score
first. Every role keeps its first bullet before any role gets a second one, so trimming never leaves a job on the
page with nothing under it. The response reports the budget, the words used, the estimated page count and every
bullet it dropped, so you can see the decision rather than discover it in Word.

Recency is part of that score, and it is read off array order, not off `start`/`end` text. `profile_set` enforces
the ordering that makes that safe: however you list roles when you call it, the stored profile always ends up
newest-first -- an open role with no `end` first, then by `end` descending, then by `start` descending. Enter roles
in any order; the stored order (and the cover-letter bullet ranking in `cover_letter_create`) is always correct.

## Free vs Pro

| | Free | Pro ($19 one-time) |
| --- | --- | --- |
| Profile, `resume_create`, `resume_to_markdown`, `resume_to_html` | Yes, unlimited | Yes, unlimited |
| Resume styles | `modern` | `modern`, `classic`, `compact` |
| Cover letters | 3 per calendar month | Unlimited |
| `tailor_to_job` | Postings up to 2,000 characters | Any length |
| Profile variants | One profile | Named variants (`backend`, `management`, ...) |
| Letterhead colour | Default | Your own `accent_color` |
| Footer credit | "Generated with mcp-docx by theluckystrike" | Removed |

**Get Pro:** https://mcp.zovo.one/buy/resume ($19 one-time, or $39 for the whole bundle).

## Privacy

All data stays local. Your CV never leaves the machine: the server reads and writes files on your computer, stores
the profile under your data directory, and makes no network request of any kind -- not for licensing (keys are
verified offline), not for fonts, not for telemetry.

## Pairs with

- [mcp-docx](../docx/README.md) -- this server imports its document engine (`@theluckystrike/mcp-docx/lib`); install docx too when you also want proposals, contracts and markdown-to-Word.
- [office-suite](../office-suite/README.md) -- several servers behind one install, one config entry.

## Troubleshooting

- **`npx` hangs or fails to find the package**: npm publish for this package is pending. Use the `.mcpb` bundle or
  the clone-and-build path above until it lands.
- **"no profile stored"**: run `profile_set` once, or `resume_read {path, save: true}` from an existing resume.
- **The resume dropped a bullet I wanted**: raise `max_pages`, or pass the posting's words in `keywords` so the
  bullet outranks the others. `bullets_dropped` in the response names every one that did not fit.
- **Short skill names**: `tailor_to_job` keeps two- and one-character skills -- `Go`, `C`, `R`, `C#`, `C++`, `F#`,
  `Qt`, `UI`, `UX`, `QA`, `ML`, `AI`, `AR`, `VR`, `JS`, `TS`, `K8s`, `AWS`, `GCP`, `SQL`, `iOS` -- plus any short
  word that appears in your own `skills` list, and ranks a known skill above a longer word of the same frequency.
- **A keyword I have is reported missing**: matching is on word boundaries, so `go` does not match `Google` and
  `k8s` does not match `Kubernetes`. Add the exact word to your skills if it is true.
- **`resume_read` put a role in `unparsed`**: resumes have no schema. Nothing is dropped silently -- fix the fields
  and pass them to `profile_set`.
- **There is no `resume_to_pdf`**: every pure-JavaScript route from Word to PDF needs a native dependency or a
  cloud API. `resume_to_html` writes semantic HTML with a print stylesheet; print that to PDF.
- **Node version**: requires Node >= 18. Check with `node -v`.

MIT licensed. Support: support@zovo.one

Built by [theluckystrike](https://github.com/theluckystrike).

## One business profile for the whole suite

Your identity is stored once, at `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/profile/business.json`,
and every server in the suite reads it: the invoice issuer, the docx letterhead, the recurring
issuer, expense-tracker's default VAT rate, time-tracker's and timezone's home zone, and the
resume and contract letterheads. Set it once with `business_set` (invoice or docx) - you never
repeat it anywhere else. An email address is only ever taken from that profile or from an explicit
argument; when none is stored, documents show `[add: email]` and the tool says so rather than
letting anyone improvise an address.
