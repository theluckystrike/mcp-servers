# Where MCP server recommendations actually come from

Measured 2026-09-10, loop 33. Derived from `data/blind_recommendation_r1.json` by extracting
every URL the blind instrument cited across all 18 buyer-intent questions and counting hosts.

## The table

| Source host | Citations |
|---|---|
| github.com | 21 |
| glama.ai | 7 |
| mcp.zovo.one (ours) | 4 |
| apify.com | 4 |
| mcpservers.org | 3 |
| mcpbundles.com | 2 |
| 17 other hosts | 1 each |
| **registry.modelcontextprotocol.io** | **0** |

23 distinct source hosts in total.

## The finding

**GitHub is where an assistant finds an MCP server to recommend**, by a factor of three over
the next source, and **Glama is second**. Between them they account for 28 of roughly 55
citations.

**The official MCP registry was cited zero times.** That is the surface this project has
invested most of its effort in: 85+ published names, a namespace claim proved out against
live ranking data, and a documented 443 places gained across ten contested tokens. It
delivers about 10 unique human referrals per fourteen days and, on this measurement, no
assistant recommendations at all.

## What this does and does not prove

It is one run of 18 questions producing about 55 cited URLs. It is a small sample and the
ordering between hosts at 1 to 4 citations means little.

The gap between 21 and 0 does not depend on sample size in the same way. GitHub being the
dominant source and the official registry being absent is a real signal, and it is consistent
with two things already measured here independently: `registry.modelcontextprotocol.io` is
this repo's only human referrer at 10 uniques in 14 days, which is a real but tiny number,
and Glama connectors re-score daily and already list 25 of our servers.

It also does not say the registry is worthless. The registry is what feeds
`api.mcp.github.com`, which feeds the VS Code picker, and it is what Glama mirrors its
connector listings from. Its value is as an upstream that other surfaces consume, not as a
destination a person or an assistant reads. Those are different jobs and the effort was
being spent as though they were the same job.

## What changed because of it

Two agents were escalated mid-loop:

- The GitHub work moved from a secondary front door to the primary one. The 32 one-server
  mirror repos are the actual recommendation surface and their first screen is what an
  assistant reads. Descriptions, topics, homepage and README opening are now judged by
  whether a reader can come away naming the server with an exact install command.
- The Glama work gained a second deliverable: read a connector page as a reader rather than
  as a score, diff it against a connector for a server the blind test did name, and fill any
  field we control and left empty.

## The re-measurement

Re-run the blind test per `docs/BLIND_RECOMMENDATION_PROCEDURE.md` after the GitHub and Glama
changes have had time to be re-crawled. The KPI is the named-in-answer count out of 18, which
is currently zero. Recording the host table again each time also turns this into a time
series on which surfaces produce recommendations, which nobody in this ecosystem appears to
have published.

## Addendum: the URLs, not just the hosts

Counting hosts understates the finding. Extracting the individual URLs shows what SHAPE of
page gets cited.

**Of the 21 github.com citations, 20 are individual one-server repositories and exactly one
is an awesome-list** (`jaw9c/awesome-remote-mcp-servers`). The 20:

    markslorach/invoice-mcp          LightSpeedPlusOne/invovate-mcp-server
    gufao/mcp-server-stirling-pdf    Sohaib-2/pdf-mcp-server
    hanweg/mcp-pdf-tools             bzheng29/expense-tracker-mcp
    shivamprasad1001/expense-mcp-server  GongRzhe/Office-Word-MCP-Server
    SecurityRonin/docx-mcp           aiexplorations/docx-mcp
    inakianduaga/clockify-mcp        wesbos/currency-conversion-mcp
    haris-musa/excel-mcp-server      negokaz/excel-mcp-server
    sbraind/excel-mcp-server         jwalsh/mcp-server-qrcode
    loscolmebrothers/zip-mcp         7gugu/zip-mcp
    minhyeoky/mcp-server-ledger      PhialsBasement/scheduler-mcp

Two things follow. First, the awesome-list strategy that consumed many rounds of this project
produced one citation out of 21 on the host that dominates the measurement. Second, almost
every cited repo is named `<capability>-mcp`, `mcp-<capability>` or `<capability>-mcp-server`.
That is the string a person types and the string a matcher matches.

Ten of the twenty map one-for-one onto servers we already ship: invoice, pdf, expense, docx,
currency, spreadsheet, qrcode, zip, ledger, scheduler. So this is a like-for-like competitor
set, and the comparison is not about capability.

**Of the 7 glama.ai citations, 6 are `/mcp/servers/<owner>/<repo>` and none are
`/mcp/connectors/`.** We have 25 servers on the connectors surface and 1 of 33 on the servers
surface. The surface we are on was cited zero times; the surface we are not on is the one
producing recommendations.

That inverts a conclusion from loop 32, which held that connectors beat the servers directory
because connectors are free, need no account and re-score daily, while the servers directory
is a queue nobody can enter. Both halves of that were true as stated. What was missing is
that being scored is not the same as being read, and only the servers directory is read.

Note also the slug shape: `<owner>/<repo>` is derived from a GitHub repository, not from a
registry entry. Together with the 20-of-21 result above, the likely mechanism is that these
directories index GitHub repos directly. Our 32 one-server mirror repos are exactly that
shape and are the asset to work on.

## Addendum 2: competition density per question

How many distinct MCP servers the instrument could name for each question. A low count means
the market has no settled answer. We ship a server for every question in the thin list.

| n | question | our server |
|---|---|---|
| 1 | quote or estimate template | quotes |
| 1 | petty cash book or cash book ledger | petty-cash, cash-book |
| 2 | currency conversion with real rates | currency |
| 2 | zip and unzip archives | zip |
| 2 | delivery schedule or work order document | delivery-schedule, work-order |
| 2 | usable without installing, by pasting a URL | the hosted wedge |
| 4 | MCP servers that cost money, and how to pay | the paid wedge, no consensus answer |

Saturated, where an incumbent is established and a new page is unlikely to displace it:

| n | question |
|---|---|
| 5 | time tracking and timesheets; small business accounting |
| 4 | pdf merge and split; bank statement; word documents; meeting time zones; barcode and QR |
| 3 | invoice; expenses and mileage; spreadsheet; recurring billing |

The caution that belongs next to this table: a thin market is not automatically a valuable
one. A question may have one answer because almost nobody asks it. Treat the count as a
measure of how cheap a citation is, not of how much the citation is worth, and pair it with
a judgement about whether anyone wants the thing.
