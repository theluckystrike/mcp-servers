status: DONE

## evidence

```
$ npm install            (root, workspaces)
added 60 packages, and changed 2 packages in 3s

$ npm run build -w servers/image
> tsc -p tsconfig.json --declaration && node -e "...chmodSync('dist/index.js',0o755)"
(clean, 1.02s wall)

$ npm test -w servers/image
1..20
# tests 20
# pass 20
# fail 0
# duration_ms 3825.084583
(3.97s wall)
```

Compiled output 64 KB. Dependency added: `jimp` 1.6.1 (pure JS, no native module, no postinstall).

Test files and what they hold. Every fixture is generated with jimp inside the tests (`test/_client.mjs`):
deterministic noise images (noise is what makes a JPEG quality change visible in bytes), a half-transparent PNG,
a JPEG with an APP1 EXIF segment spliced in after SOI, and an 8x8 PNG whose IHDR is patched to declare 20000x20000.

- `test/image.test.mjs` 10 tests: resize `inside` 400x100 -> 200x50 and width-only 400x100 -> 100x25, `cover`
  -> 200x200, `exact` -> 320x240, and `cover` without both sides refused with nothing written; convert PNG -> JPEG
  (FFD8 header, quality reported) -> PNG (89 50 4E 47) at the same dimensions, plus BMP, GIF and TIFF round trips,
  a transparent PNG to JPEG reported as flattened with the transparent half verified white and opaque, and
  `quality: 50` on a PNG output reported as ignored; compress 300x220 JPEG q100 -> q40 with the exact byte counts
  asserted against the files on disk, a PNG output told that quality does not apply, and `max_width: 160` producing
  160x117 and fewer bytes; crop 50x40 at (10,20) with the cropped pixel (0,0) asserted equal to the source pixel
  (10,20) - a resample would fail that - and a rectangle past the edge refused; watermark changing >50 of 20,000
  sampled pixels while the top-left corner is untouched; strip metadata removing both `Exif\0\0` and the
  `SECRET-GPS-PLACE` payload from the copy while the original keeps them; the 4 KB bomb refused by `image_info` and
  `image_resize` with `declares 20000x20000` and nothing written, plus a text file refused on magic bytes; five
  tools refusing an `out_path` equal to their input, including with `overwrite: true`; dominant colours 75/25 on a
  synthetic two-colour PNG (`#ff0000` 75.0%, `#0000ff`) and refused as free; batch resize writing all three files.
  sha256 of the source is asserted unchanged after every one of those operations.
- `test/smoke.test.mjs` 6 tests: initialize, tools/list (12 tools, all with descriptions, none with an emoji),
  resources/list, prompts/list + prompts/get, `image_info` cross-checked against the real file size, resize and
  thumbnails of 3 at 128 px (128x96, 51x128, 128x96 - the portrait one proves the ratio is kept), `image://recent`
  showing both operations with 3 outputs, a free 6-file batch refused as an answer with the checkout URL and no
  file written then the same 6 on Pro, a 2200x2000 source refused by the free 4 MP cap while `image_info` still
  answers 4.4 MP, the free watermark refusing with no profile and drawing "Acme Consulting" once a profile exists
  while custom text is refused as Pro, and exclusive create refused then satisfied with `overwrite: true`.
- `test/concurrency.test.mjs` 4 tests: two processes on one data dir, 20 concurrent resizes, all 20 records and 20
  distinct outputs in the register and the source byte-identical; two processes racing one `out_path` -> exactly
  one refused, the winner's file complete; a 3-file thumbnail batch colliding on file 3 leaving no file 1 or 2
  behind and the blocking file untouched; a corrupt register quarantined with a marker while the image is still
  written and the answer says the history could not be updated.

## artifacts

- /Users/mike/mcp-servers/servers/image/src/index.ts (10 image tools + 2 licence tools, `image://recent`, `prepare_for_web` prompt)
- /Users/mike/mcp-servers/servers/image/src/imageio.ts (50 MB / 10,000 px guards, header dimension probe for PNG/JPEG/GIF/BMP/TIFF, exclusive-create reservations, output-is-input refusal)
- /Users/mike/mcp-servers/servers/image/src/store.ts (operation register, corrupt-file quarantine)
- /Users/mike/mcp-servers/servers/image/test/{image,smoke,concurrency}.test.mjs, test/_client.mjs
- /Users/mike/mcp-servers/servers/image/{package.json,tsconfig.json,README.md,LICENSE,llms-install.md,glama.json,smithery.yaml,Dockerfile,server.json,server.mcpb.json,remotes.json}
- /Users/mike/mcp-servers/assets/image-logo.png (400x400, "IM" monogram, white on #5b3e8a)

Package `@theluckystrike/mcp-image` 0.6.0, registry name
`io.github.theluckystrike/image-resize-convert-compress-watermark`, mcpb asset
`https://github.com/theluckystrike/mcp-servers/releases/download/v0.6.0/image.mcpb` with `fileSha256: "TBD"` for the
release step. Dependencies: `jimp` only, plus the SDK, zod and `@theluckystrike/mcp-license`.

## cost

41 wall minutes.

## failures

- `tsc` failed on `InstanceType<typeof Jimp>` with TS2719, "two different types with this name exist, but they are
  unrelated". jimp ships tshy dual (ESM and CJS) declarations and the constructor's instance type resolves through a
  different one than `Jimp.read` does. Fixed by deriving the alias from the function that actually produces the
  values: `type Img = Awaited<ReturnType<typeof Jimp.read>>`. No `any`, no `skipLibCheck` change.
- One test failure on the first run: `image_convert` to TIFF wrote `a.tiff.tif`, because the reservation appends the
  canonical extension when the path does not already end in it and `.tiff".endsWith(".tif")` is false. Fixed by
  appending only when `formatFromExt(out_path)` is not already the requested format.
- Palette quantisation was tried for PNG compression and abandoned on measurement, not on taste. See insight.

## insight

`quality` is a JPEG parameter and there is no lossless equivalent, so a PNG "compress" has to either resize or lie.
Measured on a 300x220 noise PNG: plain re-encode 39,262 bytes, re-encode after `quantize({colors: 16})` 115,451
bytes - quantising made it 2.9x **larger**. The encoder writes RGBA either way, and reducing the palette destroys
the row-to-row similarity that deflate was exploiting, so the filtered rows compress worse than the original ones.
The honest design is therefore to let `out_path`'s extension pick the codec and to have the tool name which knob did
the work in its own answer (`Method: JPEG quality 40` against `Quality 40 does not apply to a PNG output`), rather
than accepting a number and silently doing nothing with it.

The second measured thing: a size guard placed after the decode is not a guard. A 4 KB PNG declaring 20000x20000
allocates 1.6 GB of RGBA inside `Jimp.read`, so the process is gone before any check on `image.width` runs. Reading
the declared dimensions straight out of the container header - PNG IHDR at byte 16, the JPEG SOF segment walk, the
GIF logical screen descriptor, the BMP info header, the first TIFF IFD - is about 90 lines and is the only place
where refusing is free. The decoded size is still checked afterwards, because the header probe can return null on an
unusual TIFF and a guard that only sometimes runs is not one.
