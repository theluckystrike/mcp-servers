STATUS: in progress

# S39 T2 - Findable-share token measurement

Method: for each tracked token, fully paginated GET
`https://registry.modelcontextprotocol.io/v0/servers?search=<token>&limit=100`,
walking `metadata.nextCursor` to exhaustion. Record the page number and 1-based
position within the page of every `io.github.theluckystrike/*` row.

Source of token list: `/Users/mike/mcp-servers/data/organic.json` `servers[].query_set`
(14 servers, 72 slots, 71 unique tokens).

Evidence appended below as the run proceeds.

## Command per claim

List walked (fully paginated):

```
python3 scripts/s39_findable_probe.py /tmp/s39_tokens.json /tmp/reg_search.json
```

Per-page request shape:

```
curl -s "https://registry.modelcontextprotocol.io/v0/servers?search=<token>&limit=100"
```

`metadata.nextCursor` present on page 1 (verified for token `time`), so the walk
is mandatory: `time` has 492 rows across 5 pages.

## Raw hit log (page, 1-based position within page)

```
time            pages=5  rows=492  hits p3:75-100, p4:1-100, p5:1-2   (no page-1 hit)
```

Interpretation: token `time` matches 492 competitors. Our 130 rows land on page 3
position 75 onward -- pushed 275 rows down by star-sorted competitors, entirely
off page 1.


