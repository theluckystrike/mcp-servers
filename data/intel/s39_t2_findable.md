STATUS: in progress

# S39 T2 - Findable-share token measurement

Method: for each tracked token, fully paginated GET
`https://registry.modelcontextprotocol.io/v0/servers?search=<token>&limit=100`,
walking `metadata.nextCursor` to exhaustion. Record the page number and 1-based
position within the page of every `io.github.theluckystrike/*` row.

Source of token list: `/Users/mike/mcp-servers/data/organic.json` `servers[].query_set`
(14 servers, 72 slots, 71 unique tokens).

Evidence appended below as the run proceeds.

