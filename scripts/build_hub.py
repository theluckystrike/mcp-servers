#!/usr/bin/env python3
"""Generate the public MCP hub (58 server pages + index + index.json) for the
claudecodeguides.com Jekyll site.

Why this site: mcp.zovo.one cannot be deployed (no valid Cloudflare token), and it has
2/289 URLs indexed. claudecodeguides.com is a Jekyll site on GitHub Pages with a custom
domain, ~1,950 URLs already in its sitemap and a real crawl history, so it is the only
surface in the estate that can be updated today AND is already crawled.

Usage:
  git clone --depth 1 https://github.com/theluckystrike/claude-skills-guide.git csg
  python3 scripts/build_hub.py --site /path/to/csg
"""
import argparse
import json
import os
import re
import sys

CATEGORIES = [
    ("Invoicing and billing", [
        "invoice", "quotes", "recurring", "credit-note", "dunning-letters",
        "statement-of-account", "duplicate-invoice-check", "bill-of-sale",
        "change-order", "deposits", "stripe-billing", "billing-docs", "office-suite",
    ]),
    ("Documents and files", [
        "pdf", "docx", "spreadsheet", "image", "zip", "barcode", "catalogue",
        "packing-list", "resume", "clauses", "service-agreement", "checklist",
    ]),
    ("Money and accounting", [
        "amortization", "asset-register", "bank-statement", "budget", "cash-book",
        "currency", "expense-tracker", "goods-receipt", "loan-calculator", "payroll",
        "petty-cash", "receipts", "tax-calc", "three-way-match",
        "supplier-statement-check", "purchase-requisition", "mileage-log",
        "per-diem", "hourly-rate",
    ]),
    ("Time and operations", [
        "time-tracker", "kanban", "job-card", "work-order", "leave", "pomodoro",
        "maintenance-log", "calendar", "timezone", "delivery-schedule", "onboarding",
        "supplier-list", "price-tracker",
    ]),
    ("Web and SEO", ["backlink-checker"]),
]

VERBS = {
    "create": "Create", "add": "Add", "list": "List", "get": "Get", "set": "Set",
    "update": "Update", "delete": "Delete", "remove": "Remove", "report": "Report",
    "generate": "Generate", "calc": "Calculate", "calculate": "Calculate",
    "export": "Export", "import": "Import", "find": "Find", "search": "Search",
    "check": "Check", "render": "Render", "build": "Build", "parse": "Parse",
    "convert": "Convert", "send": "Send", "mark": "Mark", "record": "Record",
    "render_pdf": "Render PDF", "summary": "Summarise", "verify": "Verify",
    "validate": "Validate", "preview": "Preview", "merge": "Merge", "split": "Split",
}
NOT_VERBS = {"loans", "loan", "asset", "invoice", "expense", "time", "tax", "payroll"}


def humanise_tool(tool):
    parts = tool.split("_")
    if len(parts) >= 2 and parts[0] in VERBS and parts[0] not in NOT_VERBS:
        return VERBS[parts[0]] + " " + " ".join(parts[1:])
    return None


def slugify(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


def clean_long(desc, long_desc):
    """README first paragraphs are sometimes install notes, not prose."""
    bad = ("npm publish", "one-click", "```", "|", "<", "http")
    if not long_desc or len(long_desc) < 90 or long_desc.lower().startswith(bad):
        return desc
    if any(long_desc.lower().startswith(b) for b in bad):
        return desc
    return long_desc


def meta_desc(text, limit=150):
    """Frontmatter description: cut on a word boundary, never mid-word."""
    t = (text or "").replace('"', "'").strip()
    if len(t) <= limit:
        return t
    cut = t[: limit - 1].rsplit(" ", 1)[0].rstrip(" ,;:")
    return cut + "…"


GUIDE_FOR = {
    "bank-statement": "convert-bank-statement-to-csv",
    "purchase-requisition": "create-purchase-order-chatgpt",
    "spreadsheet": "edit-excel-file-claude",
    "docx": "fill-word-template-ai",
    "invoice": "generate-invoice-pdf-claude",
    "quotes": "generate-quote-pdf-cursor",
    "currency": "mcp-server-currency-conversion",
    "expense-tracker": "mcp-server-expense-tracking",
    "time-tracker": "mcp-server-time-tracking",
    "mileage-log": "track-mileage-ai-assistant",
}


def page_body(s, cat, siblings, total=58, base="https://claudecodeguides.com", layout="default",
              canonical_base=""):
    tools = s["tools"]
    rows = []
    for t in tools:
        gloss = humanise_tool(t)
        rows.append("| `%s` | %s |" % (t, gloss) if gloss else "| `%s` | see tool reference |" % t)
    tool_table = (
        "| Tool | What it does |\n| --- | --- |\n" + "\n".join(rows)
        if rows
        else "_The tool list is published in the server manifest (`server.json`) and the repository README._"
    )
    host = "https://mcp.zovo.one/mcp/" + s["id"]
    hosted_live = bool(s.get("hosted_live"))
    hosted_n = sum(1 for x in siblings if x.get("hosted_live"))
    if hosted_live:
        install_hosted = (
            "- **Hosted, nothing to install:** open https://mcp.zovo.one/mcp/connect - it mints "
            "a free token and prints a ready URL, `%s/t/<token>`. Paste that into your client. "
            "The bare `%s` hands out the tool list but answers tool calls with HTTP 401, which is "
            "why the tokenised URL is the one to use." % (host, host)
        )
    else:
        install_hosted = (
            "- **Hosted endpoint:** not open for this server yet - use the `.mcpb` bundle "
            "or build from source below. The other %d servers in the suite are already hosted."
            % hosted_n
        )
    guide_slug = GUIDE_FOR.get(s["id"])
    guide_md = ""
    if guide_slug:
        gp = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                          "content", "aeo", guide_slug + ".md")
        m = re.search(r'^title:\s*"?([^"\n]+)', open(gp, encoding="utf-8").read(), re.M) if os.path.exists(gp) else None
        label = m.group(1).strip() if m else "step-by-step guide"
        guide_md = "\n- **Walk-through with real output:** [%s](/mcp/guides/%s/)" % (label, guide_slug)
    related = [x for x in siblings if x["id"] != s["id"]][:4]
    rel_md = "\n".join(
        "- [%s MCP server](/mcp/%s/) — %s" % (r["human"], r["slug"], r["description"][:110])
        for r in related
    )
    mcpb_line = (
        "- **Claude Desktop, one click:** [download the `.mcpb` bundle](%s)"
        % s["mcpb"]
        if s["mcpb"]
        else "- **Claude Desktop:** build from the repository and add it to `claude_desktop_config.json`."
    )
    faq = [
        (
            "Is the %s MCP server free?" % s["human"],
            "Yes. Running %s locally is free and unlimited, and the code is MIT licensed. "
            "%s"
            " No subscription and no account are required."
            % (
                s["human"],
                (
                    "There is a one-time $%d Pro licence for the hosted endpoint, which removes "
                    "the saved-report cap." % s["price_usd"]
                    if hosted_live
                    else "This server is local-only today, so there is nothing to pay for."
                ),
            ),
        ),
        (
            "Does %s need an API key?" % s["human"],
            "No. The server works offline against local files."
            + (
                " If you use the hosted endpoint, the connection is authenticated with a "
                "scoped token instead of a per-tool API key."
                if hosted_live
                else ""
            ),
        ),
        (
            "Where does the data go?",
            "Local installs keep everything on your machine. The hosted endpoint stores records in "
            "an isolated per-tenant namespace, and only for servers you actually call.",
        ),
        (
            "Which clients can use it?",
            "Any MCP client: Claude Desktop (via the .mcpb bundle), Claude Code, Cursor, Windsurf, "
            "VS Code with an MCP extension, or your own agent over the Streamable HTTP transport.",
        ),
    ]
    faq_md = "\n".join(
        "### %s\n\n%s\n" % (q, a) for q, a in faq
    )
    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "SoftwareApplication",
                "name": "%s MCP server" % s["human"],
                "applicationCategory": "BusinessApplication",
                "operatingSystem": "macOS, Windows, Linux",
                "description": s["description"],
                "softwareVersion": s["version"],
                "url": base + "/mcp/%s/" % s["slug"],
                "codeRepository": "https://github.com/theluckystrike/mcp-servers/tree/main/servers/%s" % s["id"],
                "license": "https://opensource.org/licenses/MIT",
                "offers": {
                    "@type": "Offer",
                    "price": "0",
                    "priceCurrency": "USD",
                    "description": (
                        "Free tier: unlimited local use. Optional one-time Pro licence for the hosted endpoint."
                        if hosted_live
                        else "Free: unlimited local use, MIT licensed. No hosted tier for this server yet."
                    ),
                },
                "isPartOf": {
                    "@type": "ItemList",
                    "name": "Back-office MCP server collection",
                    "url": base + "/mcp/",
                },
            },
            {
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": q,
                        "acceptedAnswer": {"@type": "Answer", "text": a},
                    }
                    for q, a in faq
                ],
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": base + "/"},
                    {"@type": "ListItem", "position": 2, "name": "MCP servers", "item": base + "/mcp/"},
                    {"@type": "ListItem", "position": 3, "name": s["human"], "item": base + "/mcp/%s/" % s["slug"]},
                ],
            },
        ],
    }
    return """---
layout: %(layout)s
title: "%(title)s MCP server: install, tools and pricing"
description: "%(descshort)s"
permalink: /mcp/%(slug)s/
%(canon)sdate: 2026-10-28
---

# %(human)s MCP server

<script type="application/ld+json">
%(ld)s
</script>

%(long)s

**Category:** %(cat)s &middot; **Tools:** %(ntools)d &middot; **Version:** %(ver)s &middot; **Licence:** MIT

## Install it

%(install_hosted)s
%(mcpb)s%(guide)s
- **From source:** `git clone https://github.com/theluckystrike/mcp-servers` then build `servers/%(sid)s`.
- **npm:** the package `%(npm)s` is staged and publishes shortly; the `.mcpb` bundle is the supported install until then.

## Tools it exposes

%(tools)s

## Pricing

Free to run locally, forever. The **Pro licence is $%(price)d, one time, lifetime** — it changes only the
hosted endpoint's saved-report cap, never the tools. All %(total)d servers together are
[$%(bundle)d as a bundle](/mcp/#pricing) instead of $%(full)d bought one at a time.

[Buy the %(human)s Pro licence — $%(price)d](%(buy)s?src=hub.%(slug)s)

## Questions people actually ask

%(faq)s

## Related servers in the same category

%(related)s

---

[All %(total)d back-office MCP servers](/mcp/) &middot; [how the collection is organised](/mcp/#how-it-fits-together)
""" % {
        "title": s["human"],
        "descshort": meta_desc(s["description"]),
        "slug": s["slug"],
        "ld": json.dumps(ld, indent=1, ensure_ascii=False),
        "human": s["human"],
        "long": clean_long(s["description"], s["long_description"]),
        "cat": cat,
        "ntools": len(tools),
        "ver": s["version"],
        "host": host,
        "install_hosted": install_hosted,
        "mcpb": mcpb_line,
        "sid": s["id"],
        "npm": s["npm"],
        "tools": tool_table,
        "price": s["price_usd"],
        "buy": s["buy_url"],
        "faq": faq_md,
        "related": rel_md,
        "guide": guide_md,
        "canon": (
            "canonical_url: %s/mcp/%s/\ncanonical: %s/mcp/%s/\n"
            % (canonical_base, s["slug"], canonical_base, s["slug"])
        ) if canonical_base else "",
        "total": total,
        "layout": layout,
        "bundle": 39,
        "full": 58 * 19,
    }


def index_page(cat_map, total, bundle, base="https://claudecodeguides.com", layout="default"):
    sections = []
    for cat, rows in cat_map:
        lines = ["### " + cat, "", "| Server | Tools | What it does | Price |", "| --- | --- | --- | --- |"]
        for s in rows:
            lines.append(
                "| [%s](/mcp/%s/) | %d | %s | [Pro $%d](%s?src=hub.table.%s) |"
                % (
                    s["human"],
                    s["slug"],
                    len(s["tools"]),
                    (s["description"] or "")[:120].replace("|", "/"),
                    s["price_usd"],
                    s["buy_url"],
                    s["slug"],
                )
            )
        sections.append("\n".join(lines))
    table = "\n\n".join(sections)
    ld = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Back-office MCP servers",
        "numberOfItems": total,
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i + 1,
                "name": s["human"] + " MCP server",
                "url": base + "/mcp/%s/" % s["slug"],
            }
            for i, s in enumerate([s for _, rows in cat_map for s in rows])
        ],
    }
    return """---
layout: %(layout)s
title: "%(total)d MCP servers for invoicing, documents and back-office work"
description: "Complete map of %(total)d MIT-licensed MCP servers for Claude, Cursor and Claude Code: invoices, VAT, PDFs, spreadsheets, time tracking, expenses. Free locally, $%(bundle)d one-time for all of them hosted."
permalink: /mcp/
date: 2026-10-28
---

<script type="application/ld+json">
%(ld)s
</script>

# %(total)d MCP servers for back-office work

Every server on this page is MIT licensed, runs against local files, and speaks the Model
Context Protocol, so Claude Desktop, Claude Code, Cursor, Windsurf and your own agent can all
use the same tool. Nothing here needs an account to try.

**The map:** pick the row for your task, open the server page for the exact tool names and
install steps. Prices are one-time; there is no subscription anywhere in this collection.

%(table)s

## Pricing

| What you get | Price | Notes |
| --- | --- | --- |
| Any single server, local | Free | MIT, unlimited, offline |
| Any single server, hosted + Pro | $%(price)d one time | Removes the saved-report cap on the hosted endpoint |
| All %(total)d servers | **$%(bundle)d one time** | The bundle, lifetime, every future server included |

[Buy all %(total)d servers for $%(bundle)d](https://mcp.zovo.one/buy/bundle?src=csg.mcp.index.pricing)
&middot; [Browse a single server first](#the-map)

## How it fits together

The collection is deliberately boring: one process per job, one SQLite/JSON store per server,
no shared cloud. That is why a 3-person company can run it on a laptop and a 300-person company
can run the hosted endpoints without a data-processing agreement — the data does not leave
the tenant you choose.

Servers fall into five groups: **invoicing and billing**, **documents and files**, **money and
accounting**, **time and operations**, and **web/SEO**. They are designed to be combined: an
invoice server writes the PDF, a spreadsheet server reads the export, a time-tracker server
supplies the billable hours.

## Questions people actually ask

### Are these official Anthropic MCP servers?

No. They are independent, MIT-licensed servers published on the official MCP registry
(`io.github.theluckystrike/*`) and on GitHub. Anthropic does not maintain or endorse them.

### Do I need a paid Claude plan?

No. Any MCP-capable client works, including the free Claude Desktop app, Claude Code, Cursor,
Cline and VS Code with an MCP extension. The servers are standard stdio or Streamable HTTP.

### What is actually paid, then?

Only the hosted endpoint. Local use of every server is free forever. The Pro licence is
$%(price)d one time per server (or $%(bundle)d for all %(total)d) and exists to pay for the
hosting, not to unlock tools.

### Where is the source?

[github.com/theluckystrike/mcp-servers](https://github.com/theluckystrike/mcp-servers) — one
directory per server, MIT licensed, with the registry manifest next to the code.
""" % {"total": total, "bundle": bundle, "price": 19, "table": table, "layout": layout, "ld": json.dumps(ld, indent=1, ensure_ascii=False)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True, help="path to a clone of claude-skills-guide")
    ap.add_argument("--base-url", default="https://claudecodeguides.com")
    ap.add_argument("--canonical-base", default="",
                    help="emit canonical: <base>/mcp/<slug>/ so a weaker mirror does not compete")
    ap.add_argument("--layout", default="default")
    ap.add_argument("--catalog", default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "mcp_catalog.json"))
    args = ap.parse_args()

    cat = json.load(open(args.catalog, encoding="utf-8"))
    servers = cat["servers"]
    by_id = {s["id"]: s for s in servers}
    total = len(servers)

    out_dir = os.path.join(args.site, "mcp")
    os.makedirs(out_dir, exist_ok=True)

    placed, cat_map = set(), []
    for name, ids in CATEGORIES:
        rows = [by_id[i] for i in ids if i in by_id]
        placed.update(r["id"] for r in rows)
        if rows:
            cat_map.append((name, rows))
    leftover = [s for s in servers if s["id"] not in placed]
    if leftover:
        cat_map.append(("More servers", leftover))

    written = 0
    for name, rows in cat_map:
        for s in rows:
            body = page_body(s, name, [x for _, rs in cat_map for x in rs], total, args.base_url, args.layout,
                             args.canonical_base)
            p = os.path.join(out_dir, s["slug"] + ".md")
            open(p, "w", encoding="utf-8").write(body)
            written += 1
    # fix the "%(total)d" placeholders that survived inside prose
    open(os.path.join(out_dir, "index.md"), "w", encoding="utf-8").write(
        index_page(cat_map, total, cat["bundle_price_usd"], args.base_url, args.layout)
    )
    json.dump(cat, open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    print("wrote %d server pages + index.md + index.json into %s" % (written, out_dir))
    print("categories:", [(n, len(r)) for n, r in cat_map])


if __name__ == "__main__":
    sys.exit(main())
