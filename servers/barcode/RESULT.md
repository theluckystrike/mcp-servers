status: DONE

evidence:
- `npm run build --workspace @theluckystrike/mcp-barcode` -> clean (tsc strict, NodeNext, declaration).
- `cd servers/barcode && node --test test/*.test.mjs` -> `# tests 38 / # pass 38 / # fail 0 / duration_ms 2825`.
- `node scripts/sync-versions.mjs --check` -> passes; serverInfo.version 0.7.0 = package.json = server.json = server.mcpb.json (asserted in test/contract.test.mjs).
- `grep -rEn "fetch\(|https?://|node:http|node:net|node:dns" servers/barcode/src/` -> only the SVG XML namespace string.
- Encoder cross-check against jsbarcode 3.12.3 in a scratch directory: EAN-13, EAN-8, UPC-A and Code 128 module strings identical (the two initial Code 128 mismatches located a missing table row, fixed).
- EPC payment code rendered at L, M, Q, H and at 96 px, decoded back with jsQR: 5 of 5 exact.
- Timings: 50 Code 128 SVG 57 ms; 50 QR SVG 82 ms; batch of 100 PNGs 453 ms; one 2000 px QR PNG 188 ms / 58,824 bytes.

artifacts:
- servers/barcode/src/{index,symbology,payloads,render,store,lib,version}.ts
- servers/barcode/test/{_client.mjs,unit,adversarial,concurrency,smoke,contract}.test.mjs
- servers/barcode/{README.md,SPEC.md,RESULT.md,server.json,server.mcpb.json,smithery.yaml,glama.json,llms-install.md,Dockerfile,LICENSE,package.json,tsconfig.json}
- docs/BARCODE_RESULT.md

cost: 62 wall minutes.

failures:
- Code 128 table transcribed by hand was missing the row at value 39, shifting 67 of 107 rows. Every structural invariant passed. Found by comparing module strings with jsbarcode; table regenerated from the verified patterns and the comparison pinned in test/unit.test.mjs.
- Free monthly cap could be exceeded: the count was read under one lock and the register row written under another, so two processes drew 23 codes against an allowance of 20. Count and row are now one critical section; a failed write releases the slot.
- out_path pointing at an existing directory with no extension had ".svg" appended and wrote a file beside the directory, reporting success. The stat now runs on the path as given.
- Test authoring: a 2,953-byte payload of "A" encodes as alphanumeric (version 33), not byte mode; the ceiling probe needed lowercase to exercise version 40.

insight: A wrong symbology table looks exactly like a right one. The hand-transcribed Code 128 table passed width, parity, duplicate and stop-pattern checks because a table missing one row is still a permutation of valid rows, yet 67 of 107 values encoded as their neighbour and a scanner would have returned a different string with no error anywhere. Self-consistency cannot catch a shift; an external oracle can, and cost two minutes (`npm pack jsbarcode`, encode six values both ways, diff the module strings). Five of six matched at once and the two that did not localised the missing row exactly.
