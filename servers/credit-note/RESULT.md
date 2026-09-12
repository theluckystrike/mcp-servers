status: DONE
evidence:
- rm -rf dist && /Users/mike/mcp-servers/node_modules/.bin/tsc -p tsconfig.json: clean, 0.847s total, exit 0
- node --test test/*.test.mjs: # tests 16 / # pass 16 / # fail 0 (2.53s)
- stdio probe (initialize + tools/list + tools/call credit_note_create over one spawned dist/index.js):
  serverInfo "mcp-credit-note" 0.1.0; 10 tools listed (8 credit_note_* + license_status, license_activate);
  create returned "id: CN-DRAFT-2026-0001 | status: draft | total: EUR 92.21 | total_minor: 9221"
  (hand check: 3 x 2499 = 7497 gross, tax round-half-up(7497 x 23 / 100) = 1724, total 9221)
- stdio probe negative control: a byte-identical second create on the same sandbox was refused with
  "CN-DRAFT-2026-0001 is already this credit note, to the byte ... Nothing was written."
- grep -rEn "fetch(|https?://|node:http|node:net|node:dns|console." src: one hit, the GitHub URL in the
  free-tier footer string literal; no network call, no stdout write
- emoji and em-dash scan over src, test, README.md: zero hits
- store-file test: after create/update/finalize/render/summary/create/delete, the data dir holds exactly
  ["counter.json", "notes.json"] and no sibling server's directory exists
artifacts:
- /Users/mike/mcp-servers/servers/credit-note/src/index.ts (8 tools + license gate)
- /Users/mike/mcp-servers/servers/credit-note/src/{note,money,store,jsonstore,render,lib,version}.ts
- /Users/mike/mcp-servers/servers/credit-note/test/{_client,unit,smoke.test}.mjs (16 tests)
- /Users/mike/mcp-servers/servers/credit-note/{package.json,tsconfig.json,server.json,smithery.yaml,Dockerfile,LICENSE,README.md,RESULT.md}
- /Users/mike/mcp-servers/servers/credit-note/dist/ (built)
cost: 30 wall minutes
failures:
- First test run 14/16. Both failures were in the tests, not the server: a regex expected
  "credits a total of zero" where the message says "these lines credit a total of zero", and
  c.json() was called on credit_note_render whose HTML answer is document text, not JSON.
  Fixed the regex; switched the render assertion to c.call. Re-run: 16/16.
insight:
- Tax rounded per line then summed is not tax on the subtotal: the worked note (7497 @ 23%, 999 @ 23%,
  1200 @ 0%) totals 1954 in tax, while 9696 x 23% = 2230. The 23% line's base is 8496, the 23% lines
  only, and the suite asserts that base to the minor unit.
