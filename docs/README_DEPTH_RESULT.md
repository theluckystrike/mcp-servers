# README depth pass — 2026-09-02

Brought the four shipped server READMEs from 3.3-5.2 KB to the 11-14 KB band measured against the
20-repo cohort (median 12,990 bytes), keeping every existing section (demo GIF, 60-second install, tool
table, free/pro table, links) and adding: What you can say (10 mapped prompts), Worked example (real
numbers from `docs/USER_VALUE_R2.md`), How it stores data, Limits and honest caveats, Troubleshooting,
Pairs with, and a 5-question FAQ. No emojis, no em dashes, no banned hype words.

## Byte counts

| Server | Before | After |
| --- | --- | --- |
| time-tracker | 4,391 | 11,010 |
| price-tracker | 6,232 | 12,739 |
| spreadsheet | 6,228 | 13,252 |
| invoice | 5,306 | 12,184 |

All four now inside the 11-14 KB target band (cohort median 12,990 B).

## Checks run

- `wc -c servers/*/README.md` — see table above.
- `grep -inE "seamless|powerful|effortless|unlock|supercharge"` over all four files: no matches.
- `grep -n $'\xe2\x80\x94'` (U+2014 em dash) over all four files: no matches.
- Emoji scan (`grep -nP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]'`): no matches.
- Every relative link (`../*`) resolved with `os.path.normpath` against a file that exists on disk,
  including the new `servers/office-suite/README.md` cross-link.
- Every `https://` link hit with `curl -sI`/`curl -sIL`: the `mcp.zovo.one/guides/*` pages return 200
  directly; the `mcp.zovo.one/buy/*` checkout links return 303 (expected — they redirect to the payment
  page) and 200 when redirects are followed; `github.com/theluckystrike*` returns 200/301/302, all
  normal for a profile page, a `.git` clone URL and a `/releases/latest` redirect. The
  `books.toscrape.com/catalogue/...` string in the price-tracker worked example is a placeholder inside
  a transcript, not a rendered markdown link.

## Source of numbers used

Worked examples reuse figures verbatim from `docs/USER_VALUE_R2.md`: time-tracker 2.5 h x EUR 90/h =
EUR 225.00; invoice 12 h x 90 EUR + 300 EUR setup, 23% VAT = EUR 1697.40; spreadsheet North-region top-5
by units (Turing 650, Hopper 567, Linus T 551, Lovelace 486, Liskov 290) and the 401-line Revenue CSV
write; price-tracker books.toscrape.com GBP 51.77 at `low` (regex-fallback) confidence.

## Fix folded in

`servers/time-tracker/README.md`'s `invoice_summary` row and Free vs Pro table were already showing the
"free for last 7 days, Pro for any period" behavior from the D-11 fix in `docs/USER_VALUE_R2.md` — the
note that they still read "Pro-only" was stale by the time this pass ran; no further change was needed
there beyond adding it to the new sections (tool table description, Worked example, Limits).
