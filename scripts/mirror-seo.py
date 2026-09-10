#!/usr/bin/env python3
"""mirror-seo.py -- the single source of the search-facing metadata of a mirror repo.

Why this file exists
--------------------
A blind assistant asked 18 buyer-intent questions cited github.com 21 times and the
official MCP registry 0 times; 20 of those 21 citations were single-server GitHub repos.
So the mirror repos are the surface a recommendation is sourced from, and three fields
decide whether a searcher or a scraper can act on one: the repo `description`, the
`topics` list, and the first screen of the README.

Those three were previously produced in three different places (facts.json taglines for
the description, a case statement for topics, an inline heredoc for the README header).
Applying an improvement to a live mirror by hand would then be silently reverted by the
next `sync-mirrors.sh` run. Everything search-facing now lives here, sync-mirrors.sh
calls into it, and `scripts/apply-mirror-seo.mjs` calls the same functions -- so what is
live and what the generator would write are the same bytes by construction.

Measured problems this fixes (2026-09-10)
-----------------------------------------
1. Descriptions carried no buyer vocabulary. GitHub repository search matches on name,
   description and topics. `mcp-invoice`'s description was "Numbered invoices with tax
   lines, rendered to a professional PDF." -- the words "MCP", "server" and "generator"
   appear nowhere in it, so the query "mcp invoice generator" (10 results) could not
   rank it and did not. Every one of the 20 competitor repos an assistant actually cited
   has "MCP server" or "Model Context Protocol server" in its description.
2a. Both hosted auth forms are verified working, 2026-09-10, on /mcp/timezone with a
   token from /mcp/token and a real `tools/call` (`license_status`):
     bare URL, no auth                -> 401 {"error":"unauthorized"}
     bare URL + Authorization: Bearer -> 200, and the tool reports source
                                         "Authorization: Bearer"
     /mcp/<server>/t/<token>          -> 200, source "URL path segment"
   The 401 is the correct answer to an unauthenticated call, not a dead endpoint. The
   header names both forms so a client that cannot set headers is not left at the 401.

2. The README's first screen led with a demo GIF and then an `npx -y
   @theluckystrike/mcp-<name>` config block. That package is not on npm --
   registry.npmjs.org returns 404 for it, verified against a 200 control on `express` --
   and the mirror does not commit `dist`, so neither npx path works. An assistant reading
   the first screen would recommend a command that fails. The install block now leads
   with the three paths that are verified to work.

3. Hyphenated topics do not match their component words. Measured:
   `repo:theluckystrike/mcp-statement-of-account aging` returns 1, and `... receivable`
   returns 0, although the repo carries the topic `accounts-receivable`. A control in the
   same batch (`repo:theluckystrike/mcp-invoice pdfkit`, a dependency named only inside
   package.json) returns 0, confirming that default repo search reads name, description
   and topics and not file contents. So every buyer word has to appear as a standalone
   word in the description; a hyphenated topic alone will not carry it.

4. The buyer words come from the 18 frozen questions in `data/blind_questions.json`, the
   same set the blind recommendation KPI uses, not from guesswork. A word is added only
   when the server's own manifest supports it. `pdf` is deliberately absent from
   mcp-bank-statement: it imports CSV exports from Revolut, Wise, mBank and the rest, and
   cannot read a bank statement PDF, so question 4 has no honest answer here. Raising a
   coverage score by claiming otherwise would be a defect, not an improvement.

Everything written here must be true of the code. The capability phrases below name only
what the server's own manifest and README already claim.

Usage:
  python3 scripts/mirror-seo.py check
  python3 scripts/mirror-seo.py gemini <name>      # gemini-extension.json, or exit 1
  python3 scripts/mirror-seo.py description <name>
  python3 scripts/mirror-seo.py topics <name>
  python3 scripts/mirror-seo.py readme <readme-path> <name> <demo> <monorepo> <raw>
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OWNER = "theluckystrike"

# The capability, in the words a buyer types. Each is a statement about what the server
# does, taken from its manifest and README -- not a positioning claim.
CAPABILITY = {
    "amortization": "loan and lease amortization schedules",
    "asset-register": "a fixed asset register with depreciation schedules",
    "bank-statement": "reading bank statement CSV exports to read, categorise and reconcile transactions",
    "barcode": "QR code and barcode generation: generates barcodes and QR codes",
    "billing-docs": "credit notes and purchase orders",
    "calendar": "reading ics calendars, free busy time and scheduling conflicts",
    "cash-book": "double entry bookkeeping and a cash book general ledger for a small business",
    "catalogue": "a product price list and rate card",
    "change-order": "change orders and contract variations",
    "checklist": "reusable checklists and dated runs of them: pass, fail, not applicable, and a sign-off",
    "clauses": "a searchable contract clause library",
    "currency": "currency conversion: convert currencies with a currency converter on real ECB exchange rates",
    "delivery-schedule": "delivery schedules, milestones and due dates: produces a dated delivery schedule document",
    "deposits": "security and retainer deposits",
    "docx": "Word documents: creating docx files, and create a Word document from a chat",
    "expense-tracker": "expense tracking: track business expenses, receipts and mileage with an expense tracker",
    "image": "image resizing, conversion, compression and watermarking",
    "invoice": "invoice generation: an invoice generator that can generate a numbered PDF invoice with VAT for your clients",
    "kanban": "a kanban task board and project board",
    "office-suite": "small business accounting and paperwork: invoices, PDFs, spreadsheets, Word documents, time tracking and expenses",
    "packing-list": "packing slips and packing lists: cartons, contents, weights, chargeable weight and what is still to pack",
    "pdf": "PDF tools that merge, split, stamp and read PDF files; merges and splits pages on your own machine",
    "per-diem": "per diem travel allowances",
    "petty-cash": "a petty cash book and voucher ledger: a cash float on the imprest system",
    "price-tracker": "price tracking, a price tracker and price drop watcher for shop pages",
    "quotes": "price quotes, estimates and proposals: create a quote or an estimate for a customer",
    "recurring": "recurring invoices and subscription billing: handles scheduled invoice documents",
    "resume": "resume and cover letter writing, CV documents in Word format",
    "spreadsheet": "spreadsheets: read, query, edit and convert xlsx, csv and Excel files, and builds a new spreadsheet from rows in a chat",
    "statement-of-account": "customer statements of account, accounts receivable and invoice aging",
    "time-tracker": "time tracking: timesheets, a timesheet and a billable hours tracker",
    "timezone": "timezone conversion and meeting planning: schedule a meeting across time zones",
    "work-order": "work orders and job cards for trades and field service",
    "zip": "zip archives: create, inspect and extract",
}

# Shared topics. `mcp`, `mcp-server` and `model-context-protocol` are the ecosystem's own
# tags; `claude`, `claude-desktop`, `claude-code` and `cursor` are the clients the README
# gives a verified config for; `typescript` and `nodejs` are what the code is.
SHARED_TOPICS = [
    "mcp", "mcp-server", "model-context-protocol",
    "claude", "claude-desktop", "claude-code", "cursor",
    "ai", "llm", "typescript", "nodejs",
]

# Per-server topics. GitHub allows 20 topics per repository; shared list is 11, so at
# most 9 here. Topics must be lowercase, digits and hyphens only.
SPECIFIC_TOPICS = {
    "time-tracker": ["time-tracking", "timesheet", "billable-hours", "freelance"],
    "price-tracker": ["price-tracking", "price-drop", "price-monitoring", "shopping"],
    "spreadsheet": ["spreadsheet", "xlsx", "csv", "excel"],
    "invoice": ["invoice", "invoice-generator", "vat", "billing", "freelance"],
    "expense-tracker": ["expenses", "expense-tracker", "receipts", "mileage"],
    "currency": ["currency", "currency-converter", "exchange-rates", "ecb", "forex"],
    "docx": ["docx", "word", "word-document", "document-generation", "proposal"],
    "timezone": ["timezone", "meeting-planner", "meeting-scheduler", "world-clock", "ics"],
    "resume": ["resume", "cv", "cover-letter", "job-application"],
    "recurring": ["recurring-billing", "subscription", "forecast", "invoicing"],
    "checklist": ["checklist", "sign-off", "inspection", "quality-control"],
    "clauses": ["contract", "clause", "clause-library", "proposal"],
    "quotes": ["quote", "estimate", "proposal", "freelance"],
    "barcode": ["qr-code", "qrcode", "barcode", "ean13"],
    "zip": ["zip", "archive", "compression", "unzip"],
    "billing-docs": ["credit-note", "purchase-order", "invoicing", "vat"],
    "deposits": ["deposit", "retainer", "escrow", "invoicing"],
    "per-diem": ["per-diem", "travel-allowance", "expenses", "tax"],
    "asset-register": ["fixed-assets", "depreciation", "capital-allowances", "accounting"],
    "statement-of-account": ["accounts-receivable", "aging", "dunning", "invoicing"],
    "cash-book": ["bookkeeping", "double-entry", "ledger", "general-ledger", "accounting"],
    "amortization": ["amortization", "loan-schedule", "lease", "finance"],
    "petty-cash": ["petty-cash", "imprest", "cash-float", "bookkeeping"],
    "work-order": ["work-order", "job-card", "field-service", "trades"],
    "catalogue": ["catalogue", "price-list", "rate-card", "pricing"],
    "change-order": ["change-order", "variation-order", "scope-change", "contract-value"],
    "delivery-schedule": ["delivery-schedule", "deliverables", "milestones", "due-dates"],
    "packing-list": ["packing-list", "packing-slip", "shipping", "logistics", "warehouse"],
    "pdf": ["pdf", "pdf-tools", "merge", "split", "stamp"],
    "calendar": ["calendar", "ics", "icalendar", "free-busy"],
    "kanban": ["kanban", "tasks", "task-management", "project-board"],
    "image": ["image", "image-processing", "resize", "thumbnail"],
    "bank-statement": ["bank-statement", "bank-reconciliation", "transactions", "reconcile"],
    "office-suite": ["office", "productivity", "bundle", "back-office"],
}

# The Gemini CLI extension gallery (geminicli.com/extensions/browse/) needs no
# submission: per google-gemini/gemini-cli docs/extensions/releasing.md, a public repo is
# indexed automatically if it carries this topic and a gemini-extension.json at the
# repository root. The crawler runs daily. No form, no account, no review.
GEMINI_TOPIC = "gemini-cli-extension"

TOPIC_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$")
START = "<!-- mirror-seo:start -->"
END = "<!-- mirror-seo:end -->"


def facts(name):
    if name not in CAPABILITY:
        raise SystemExit(
            "mirror-seo.py: no capability phrase for server %r.\n"
            "A new server needs one line in CAPABILITY (the words a buyer types) and, if\n"
            "its keywords are not already covered, an entry in SPECIFIC_TOPICS. Both must\n"
            "be true of what the server does." % name)
    with open(os.path.join(ROOT, "data", "facts.json")) as fh:
        servers = json.load(fh)["servers"]
    if name not in servers:
        raise SystemExit("mirror-seo.py: %r has no entry in data/facts.json" % name)
    return servers[name]


def hosted(name):
    """True when this server has a live endpoint at https://mcp.zovo.one/mcp/<name>.

    Measured 2026-09-10 by POSTing tools/list unauthenticated to all 32: 30 answer 200 and
    two answer 404 (delivery-schedule, office-suite). That matches data/distribution.json,
    which is the declared source of truth and is what is read here so the two cannot drift.

    This gates the Gemini extension manifest. A gemini-extension.json for a server with no
    endpoint would install cleanly and then fail on the user's first tool call, and the
    stdio alternative is not available either: the mirror does not commit dist/ and
    @theluckystrike/* is not on npm, so `command: node .../dist/index.js` would point at a
    file that does not exist in a fresh clone. Shipping either would be worse than
    shipping nothing."""
    with open(os.path.join(ROOT, "data", "distribution.json")) as fh:
        per = json.load(fh)["per_server"]
    return "published" in str((per.get(name) or {}).get("hosted", ""))


def version(name):
    with open(os.path.join(ROOT, "servers", name, "package.json")) as fh:
        return json.load(fh)["version"]


def gemini_extension(name):
    """The gemini-extension.json for one mirror, generated from that server's own manifest.

    Field-by-field against google-gemini/gemini-cli docs/extensions/reference.md:
      name          lowercase with dashes, expected to match the extension directory name.
      version       the version this mirror actually holds, from the server's package.json.
      description   shown on geminicli.com/extensions; the same search-true text as the
                    repo description.
      settings      an array of values the user is prompted for at install and which are
                    written to the extension's .env. Sensitive values are stored in the
                    system keychain. The docs are explicit that an extension only sees
                    environment variables declared here, which is exactly why the token is
                    declared rather than assumed to be in the host environment.
      mcpServers    all settings.json MCP options except `trust`, so `httpUrl` (streamable
                    HTTP) and `headers` are both available, and string values may reference
                    an environment variable as ${VAR}.

    Transport: httpUrl, not stdio. Measured on /mcp/timezone: the bare URL with no token
    answers 401 on tools/call, the same URL with `Authorization: Bearer <token>` answers
    200. So the bare URL alone is not usable and the header carries the token. The server
    alias carries no underscore, per the reference's warning that an underscore in an alias
    makes the policy engine misparse the fully qualified tool name and fail silently."""
    if not hosted(name):
        raise SystemExit("gemini_extension: %s has no hosted endpoint" % name)
    return {
        "name": "mcp-%s" % name,
        "version": version(name),
        "description": "MCP server for %s. %s" % (CAPABILITY[name], facts(name)["tagline"]),
        "settings": [
            {
                "name": "mcp.zovo.one token",
                "description": (
                    "A free anonymous token from https://mcp.zovo.one/mcp/token, or your "
                    "Pro key. One token is one data space, and it is refreshed for another "
                    "30 days on every write."
                ),
                "envVar": "ZOVO_MCP_TOKEN",
                "sensitive": True,
            }
        ],
        "mcpServers": {
            name: {
                "httpUrl": "https://mcp.zovo.one/mcp/%s" % name,
                "headers": {"Authorization": "Bearer ${ZOVO_MCP_TOKEN}"},
                "description": facts(name)["tagline"],
            }
        },
    }


def description(name):
    """The repo `description`, which is one of the three fields GitHub repo search
    matches on. Shape follows the competitor repos an assistant actually cited: the words
    "MCP server", the capability in buyer vocabulary, then the product tagline, then the
    clients. GitHub caps a description at 350 characters."""
    tagline = facts(name)["tagline"]
    cap = CAPABILITY[name]
    text = ("Model Context Protocol (MCP) server for %s. %s Works with Claude Desktop, "
            "Claude Code and Cursor." % (cap, tagline))
    if len(text) > 350:
        raise SystemExit("description for %s is %d chars, over GitHub's 350 limit" % (name, len(text)))
    return text


def topics(name):
    facts(name)  # same guard: fail loudly on a server that has not been described
    extra = [GEMINI_TOPIC] if hosted(name) else []
    out = []
    for t in SHARED_TOPICS + SPECIFIC_TOPICS.get(name, []) + extra:
        if t not in out:
            out.append(t)
    if len(out) > 20:
        raise SystemExit("%s has %d topics, over GitHub's limit of 20" % (name, len(out)))
    for t in out:
        if not TOPIC_RE.match(t):
            raise SystemExit("%s: topic %r is not a legal GitHub topic" % (name, t))
    return out


def header(name, demo, monorepo, raw):
    """The README first screen.

    Ordered for a reader who arrived from a search and has one screen to decide: what it
    is, then how to run it, then proof. The demo image comes after the install block
    rather than before it, because a scraper that reads the first N characters of a
    README should get the sentence and the command, not an image tag.

    Only install paths that are verified to work appear as instructions. The npm path is
    named explicitly as not working, because leaving it unmentioned is what caused the
    body of the README to be read as an npx recommendation."""
    tagline = facts(name)["tagline"]
    cap = CAPABILITY[name]
    repo = "mcp-%s" % name
    L = [START, ""]
    L.append("**MCP server for %s.** %s" % (cap, tagline))
    L.append("")
    # The hosted paragraph is emitted ONLY for servers that actually have an endpoint. The
    # gemini_extension path already guarded on hosted(); this one did not, so the first two
    # stdio-only mirrors went out advertising https://mcp.zovo.one/mcp/<name> for servers
    # where that URL answers 404 to both GET and initialize. That is the same defect this
    # estate spent a loop removing everywhere else: an install path printed on the surface a
    # reader trusts, that fails the moment they try it.
    if hosted(name):
        L.append("Works with Claude Desktop, Claude Code, Cursor and any Model Context "
                 "Protocol client. Runs on your own machine, or hosted with no install.")
    else:
        L.append("Works with Claude Desktop, Claude Code, Cursor and any Model Context "
                 "Protocol client. Runs on your own machine: this one has no hosted "
                 "endpoint, so install it from the bundle or from source.")
    L.append("")
    L.append("## Install")
    L.append("")
    if hosted(name):
        L.append("**Hosted, nothing to install.** Get a token from "
                 "<https://mcp.zovo.one/mcp/connect> (the connect page) or "
                 "<https://mcp.zovo.one/mcp/token> (the same token as JSON); a free anonymous "
                 "one is issued on the spot and a Pro key works the same way. Then point an "
                 "MCP client at `https://mcp.zovo.one/mcp/%s` over streamable-http and send "
                 "the token as `Authorization: Bearer <token>`." % name)
        L.append("")
        L.append("If your client cannot set headers, put the token in the path instead: "
                 "`https://mcp.zovo.one/mcp/%s/t/<token>`. Both forms work. The bare URL "
                 "with no token answers 401 on `tools/call`, so the token is not optional." % name)
        L.append("")
    L.append("**Claude Desktop, one click.** Download `%s.mcpb` from the "
             "[latest release](%s/releases/latest) and double-click it." % (name, monorepo))
    L.append("")
    L.append("**From source.** The mirror is self-contained: every `@%s/*` dependency is "
             "vendored, so a fresh clone builds with no extra setup." % OWNER)
    L.append("")
    L.append("```sh")
    L.append("git clone https://github.com/%s/%s.git" % (OWNER, repo))
    L.append("cd %s" % repo)
    L.append("npm install && npm run build")
    L.append("```")
    L.append("")
    L.append("Then point your client at the built entry point:")
    L.append("")
    L.append("```json")
    L.append("{")
    L.append('  "mcpServers": {')
    L.append('    "%s": {' % name)
    L.append('      "command": "node",')
    L.append('      "args": ["/absolute/path/to/%s/dist/index.js"]' % repo)
    L.append("    }")
    L.append("  }")
    L.append("}")
    L.append("```")
    L.append("")
    L.append("> `@%s/%s` is **not published on npm yet**, so an `npx -y @%s/%s` "
             "command will fail. The three paths above are the working ones and each is "
             "exercised by CI." % (OWNER, repo, OWNER, repo))
    L.append("")
    if demo:
        L.append(demo)
        L.append("")
    L.append("Read-only mirror of [%s/servers/%s](%s/tree/main/servers/%s). See "
             "[MIRROR.md](MIRROR.md)." % (monorepo.rstrip("/").split("/")[-1], name, monorepo, name))
    L.append("")
    L.append(END)
    return "\n".join(L)


# Lines the previous, unbounded version of this header injected. They are stripped so the
# transform is idempotent on a mirror that already carries the old header -- otherwise
# applying this to a live mirror would leave two install blocks, one of them wrong.
LEGACY = (
    "**One-click install:**",
    "**Hosted endpoint (no install):**",
    "Read-only mirror of [",
)


def rewrite(path, name, demo, monorepo, raw):
    text = open(path).read()

    # drop a previous bounded block
    if START in text and END in text:
        text = text[: text.index(START)] + text[text.index(END) + len(END):]

    lines = text.split("\n")
    i = 1 if lines and lines[0].startswith("# ") else 0
    head, body = lines[:i], lines[i:]

    # drop legacy unbounded header lines
    body = [ln for ln in body if not ln.startswith(LEGACY)]

    # collapse the run of blank lines the removals leave behind
    while body and not body[0].strip():
        body.pop(0)

    out = "\n".join(head + [""] + [header(name, demo, monorepo, raw), ""] + body)

    # relative monorepo asset paths do not resolve in a mirror -> absolute raw URLs
    out = out.replace("](../../assets/", "](%s/assets/" % raw)
    out = re.sub(r"\]\(\.\./\.\./(?!assets/)([^)]*)\)", r"](%s/tree/main/\1)" % monorepo, out)

    # The demo image is kept once, in the header. The monorepo README carries it in the
    # body as a RELATIVE path, so it only becomes textually equal to `demo` after the
    # rewrite above -- de-duplicating any earlier would silently leave two copies. This
    # ordering is load-bearing; a dry run of sync-mirrors.sh catches it if it is reversed.
    if demo:
        head_end = out.index(END) + len(END)
        out = out[:head_end] + out[head_end:].replace(demo + "\n", "")

    out = re.sub(r"\n{4,}", "\n\n\n", out)
    open(path, "w").write(out)
    return out


def check():
    """Completeness gate. Every server sync-mirrors.sh will actually publish must have a
    CAPABILITY entry and a facts.json entry, or it would be pushed with a broken
    description. Run from sync-mirrors.sh before the first mirror is built, so the run
    fails in one second rather than half way through the estate.

    Scope is ALL_SERVERS in sync-mirrors.sh, not `ls servers/`: a server directory that
    exists but is not in ALL_SERVERS has no mirror yet and is still being built. Those are
    reported separately as pending, not as failures.

    SPECIFIC_TOPICS is deliberately NOT required. SHARED_TOPICS always ships 11 topics, so
    a server missing from SPECIFIC_TOPICS still gets a full, legal topic list -- it can
    never end up with zero topics, which given that topics are one of only three indexed
    fields would take its search coverage to nothing."""
    sync = open(os.path.join(ROOT, "scripts", "sync-mirrors.sh")).read()
    m = re.search(r'^ALL_SERVERS="([^"]*)"', sync, re.M)
    if not m:
        raise SystemExit("mirror-seo.py check: could not read ALL_SERVERS from sync-mirrors.sh")
    published = [s for s in m.group(1).split() if s]
    with open(os.path.join(ROOT, "data", "facts.json")) as fh:
        known_facts = set(json.load(fh)["servers"])

    problems = []
    for s in published:
        if s not in CAPABILITY:
            problems.append("%s: no CAPABILITY entry" % s)
        if s not in known_facts:
            problems.append("%s: no data/facts.json entry" % s)

    on_disk = sorted(
        d for d in os.listdir(os.path.join(ROOT, "servers"))
        if os.path.isdir(os.path.join(ROOT, "servers", d))
    )
    pending = [s for s in on_disk if s not in published]

    if problems:
        raise SystemExit("mirror-seo.py check FAILED:\n  " + "\n  ".join(problems))
    print("mirror-seo check: %d/%d published servers described" % (len(published), len(published)))
    if pending:
        print("  pending (a server directory with no mirror yet, not published by "
              "sync-mirrors.sh): %s" % ", ".join(pending))
    return 0


def main(argv):
    if len(argv) < 2:
        raise SystemExit(__doc__)
    cmd = argv[1]
    if cmd == "check":
        return check()
    if cmd == "description":
        print(description(argv[2]))
    elif cmd == "topics":
        print(" ".join(topics(argv[2])))
    elif cmd == "readme":
        path, name, demo, monorepo, raw = argv[2:7]
        rewrite(path, name, demo, monorepo, raw)
    elif cmd == "gemini":
        name = argv[2]
        if not hosted(name):
            return 1  # no endpoint: no manifest, and the caller removes any stale one
        print(json.dumps(gemini_extension(name), indent=2))
    elif cmd == "hosted":
        return 0 if hosted(argv[2]) else 1
    elif cmd == "header":  # for the applier: emit the block only
        name, demo, monorepo, raw = argv[2:6]
        sys.stdout.write(header(name, demo, monorepo, raw))
    else:
        raise SystemExit("unknown command %r" % cmd)


if __name__ == "__main__":
    sys.exit(main(sys.argv) or 0)
