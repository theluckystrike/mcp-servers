status: DONE

evidence: |
  Built to the estate standard from a computed registry position rather than a hunch.
  `node scripts/token-demand.mjs packing` fully paginated the live registry:
  2 rows, 2 distinct servers, 2 namespaces, 1 page, 1 row sorting before
  `io.github.theluckystrike/`, so a name of ours lands at rank 3 of 3 and is on page one by
  construction. GitHub repo search, qualified to the office meaning of the word
  ("packing list" rather than the bare token, which is byte packing):
  `gh api "search/repositories?q=packing+list+mcp+in:name,description"` total_count 4, and
  `q=packing+list` total_count 1803 against 15288 for the bare token, a contamination factor
  of 8.5x that would have overstated demand had the bare count been used.

  Suites, `node --test test/*.test.mjs` in servers/packing-list:
  58 tests, 58 pass, 0 fail (unit 14, contract 17, adversarial 19, paths 6, concurrency 2).
  Root `npm test` before this server existed: 1574 tests, 1563 pass, 0 fail.

  The livelock case is exercised, not assumed: test/paths.test.mjs calls
  `packing_slip` with out_path "/proc/nope/slip.txt" whenever /proc exists, asserts the call
  returns an error, and asserts it returned inside 10 seconds. On this machine (darwin)
  there is no /proc, so that branch is skipped and the /sys, /dev, ENOTDIR, URL, existing
  file, extension and tilde branches all run.

artifacts: |
  servers/packing-list/{src,test}, README.md, SPEC.md, llms-install.md, Dockerfile,
  server.json, server.mcpb.json, server.slip.json, server.consignment.json,
  smithery.yaml, glama.json, LICENSE.

cost: one loop, no paid API call, no network call in the shipped code.

failures: |
  Four contract assertions failed on the first run and all four were defects in this
  server, not in the suite: the package description was 102 characters against the
  registry's 100-character 422; two registry manifest descriptions were 116 and 102; the
  no-money assertion matched the word "mcp-invoice" inside a doc comment that says the money
  engine is deliberately NOT imported, so it now matches import lines only; and RESULT.md
  did not exist yet.

insight: |
  A packing slip is the one business document in this estate that must NOT carry money, and
  enforcing that turned out to be a test rather than a convention: `@theluckystrike/mcp-invoice`
  is absent from package.json, no money function name appears in non-comment source, and the
  unit suite asserts no currency symbol reaches the rendered slip. The second measured thing
  is the chargeable weight. Every carrier bills max(gross, volumetric), and volumetric depends
  on a divisor that is a tariff term, not a constant: on the worked shipment the shipment
  chargeable weight is 20.000 kg at divisor 5000 and 20.400 kg at 4000, and only the second
  carton changes basis. A server that hardcoded 5000 would have under-billed that shipment
  by 400 g and nobody would have found it until the carrier's account was reconciled.
