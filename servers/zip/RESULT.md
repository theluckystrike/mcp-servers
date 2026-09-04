status: DONE

evidence:
- `npm run build --workspace @theluckystrike/mcp-zip` -> clean (tsc strict, NodeNext, declaration).
- `cd servers/zip && npm test` -> `# tests 38 / # pass 38 / # fail 0 / duration_ms 3890`, five files (unit, adversarial, concurrency, contract, smoke).
- `node scripts/sync-versions.mjs --check` -> passes; serverInfo.version 0.8.0 = package.json = server.json = server.mcpb.json (asserted in test/contract.test.mjs).
- `grep -rEn "fetch\(|https?://|node:http|node:net|node:dns" servers/zip/src/` -> no match, exit 1.
- Compression ratios measured on real files (level 6): PDF from mcp-pdf 1.07x, DOCX from mcp-docx 1.35x, varied CSV 2.40x, index.ts 3.31x, package-lock.json 4.18x, app log 15.09x, repetitive CSV 82.69x, 50 MB of zeros 1022x.
- Timings over stdio: zip_create 200 files / 4.0 MB 74 ms; zip_list 200 entries 2 ms; zip_extract 200 entries 47 ms; zip_extract_text 1 ms; refuse a 500 MB bomb (497.8 KB on disk) 3 ms.
- Counterfactual on the free-cap race: a build with the count and the register row under two separate locks and 5 ms of work between them drew 15, 25 and 19 archives against an allowance of 10 in three runs; the shipped one-critical-section build drew exactly 10 in every run.
- fflate 0.8.3 `inflateSync(data, {out: new Uint8Array(10)})` on a 100,000-byte stream returned 10 bytes and threw nothing.

artifacts:
- servers/zip/src/{index,zipfile,paths,store,lib,version}.ts
- servers/zip/test/{_client.mjs,_zipgen.mjs,unit,adversarial,concurrency,contract,smoke}.test.mjs
- servers/zip/{README.md,SPEC.md,RESULT.md,server.json,server.mcpb.json,smithery.yaml,glama.json,llms-install.md,Dockerfile,LICENSE,package.json,tsconfig.json}
- docs/ZIP_RESULT.md

cost: 58 wall minutes.

failures:
- zip_extract_text sized the read from max_chars (`hit.size > cap * 4`), so `max_chars: 100` refused a 4.9 KB entry outright instead of returning the first 100 characters. Asking for less of a file made the file unreadable. The read ceiling is now the fixed MAX_TEXT_CHARS and max_chars only trims what is printed.
- The first counterfactual for the free-cap race did not reproduce an overrun: splitting the lock alone leaves a window of a few microseconds. The overrun only appears once the window holds the work a real call does; with 5 ms in it the same split-lock build overran the allowance by 50 to 150 percent. A race probe with no work in the window measures nothing.

insight: A bounded output buffer looks like a complete zip-bomb guard and is not one. fflate's `inflateSync` with a fixed `out` buffer TRUNCATES silently: a 100,000-byte entry inflated into a 10-byte buffer returns 10 bytes and throws nothing, so an archive whose header lies about a size would extract as a short file reported as a success. The buffer bounds the memory; only the CRC-32 in the central directory proves the bytes are the file. The two checks are not redundant, they answer different questions, and the one that looks sufficient is the one that fails quietly.
