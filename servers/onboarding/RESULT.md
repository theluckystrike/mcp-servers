status: DONE

evidence: |
  Selected by computed registry position, not by hunch. `node scripts/token-demand.mjs
  checklist snag handover onboarding` fully paginated the live registry:
  checklist 6 rows / 6 servers / 5 namespaces, 6 rows sorting before
  `io.github.theluckystrike/`, landing rank 7;
  snag 2 rows, landing rank 2; handover 5 rows, landing rank 3; onboarding 6 rows,
  landing rank 7. All four are on page one and all four are carried by the three registry
  names this server ships, which is the point: registry search matches the NAME substring
  only, so one codebase under three names is findable on four tokens rather than one.

  Demand, qualified to the office meaning of the word:
  `gh api "search/repositories?q=checklist+mcp+in:name,description"` total_count 191,
  `q=checklist` total_count 51379. checklist is one of the few candidate tokens whose bare
  and qualified counts agree (contamination 1.0x), so no correction was needed.
  It is the top-scoring candidate of the 70 probed in data/token_demand_r1.json.

  Suites, `node --test test/*.test.mjs` in servers/checklist:
  58 tests, 58 pass, 0 fail (unit 15, contract 18, adversarial 17, paths 6, concurrency 2).

  The livelock case is exercised, not assumed: test/paths.test.mjs calls `run_report` with
  out_path "/proc/nope/report.txt" whenever /proc exists, asserts the call returns an error,
  and asserts it returned inside 10 seconds. On this machine (darwin) there is no /proc, so
  that branch is skipped and the /sys, /dev, ENOTDIR, URL, existing file, extension and
  tilde branches all run.

artifacts: |
  servers/checklist/{src,test}, README.md, SPEC.md, llms-install.md, Dockerfile,
  server.json, server.mcpb.json, server.snag.json, server.onboarding.json,
  smithery.yaml, glama.json, LICENSE.

cost: one loop, no paid API call, no network call in the shipped code.

failures: |
  Two behaviour defects were found by the suites and fixed in src, not in the tests.
  First, `run_sign_off` on an OPEN run answered "an open run cannot go straight to
  signed_off", which is true and useless: it now reports which steps are outstanding,
  because the status machine and the signable test can never disagree (signable is only
  ready when nothing is pending, and nothing pending means the run is already complete).
  Second, the status machine's article was hardcoded to "a", producing "a open run"; it is
  now derived. One test assertion was wrong rather than the code: a 200-character section is
  refused at the schema, which is better than the silent 60-character trim the test assumed.

insight: |
  The snapshot rule is the whole server and it is the one property that would be invisible
  if it broke. A run copies its checklist's steps at start and records the version it copied.
  Without that, editing a checklist rewrites history: a handover certificate signed for ten
  checks silently becomes a certificate for eleven, and no field anywhere in the record shows
  that it happened, so no reader could ever detect it. The contract suite therefore asserts
  it on the raw runs.json bytes and not only through the API. The second measured thing:
  `na` must count as ANSWERED and never as PASSED. Merging the two is how a checklist reports
  full marks for a job where half the steps did not apply, and the arithmetic test that
  catches it is that pass + fail + na + pending must equal the item count while
  answered + pending must equal it too, which only holds if na sits on the answered side.
