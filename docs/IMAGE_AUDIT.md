# mcp-image: adversarial audit and user-value run

Date 2026-09-04. Scope: `servers/image` only. Zero paid API calls. Zero network calls: the
server makes none (a line scan of `src/` for `fetch(`, `node:http`, `node:net`, `node:dns` and
bare URLs returns nothing outside the checkout and repository strings, asserted in
`test/adversarial.test.mjs`), and the run itself called no external service. The `claude` CLI in
part 2 is the user's own subscription client, not a paid API key.

## Method

**Part 1 harness** -- `/private/tmp/imgaudit/probe.mjs`, run twice (free lane, Pro lane with a key
from `scripts/sign-license.mjs image`), driving `servers/image/dist/index.js` over stdio JSON-RPC
through the repository's own `test/_client.mjs`, which **throws on any stdout line that does not
parse as JSON**. Fresh `XDG_DATA_HOME` per lane, cwd set to the output directory. Fixtures are
built by `/private/tmp/imgaudit/fixtures.mjs`:

| Fixture | What it is |
|---|---|
| `a.png`, `a.jpg` | deterministic noise, 300x200 PNG and 400x300 JPEG |
| `alpha.png` | half-transparent PNG |
| `one.png` | 1x1 PNG |
| `big60.jpg` | valid JPEG padded to 62,914,560 bytes (60.0 MB) |
| `bomb.png` / `.jpg` / `.gif` / `.bmp` / `.tif` | 181 B - 694 B files whose container header declares **20000x20000** |
| `corruptchunk.png` | `a.png` with 30 bytes inside IDAT flipped |
| `orient6.jpg` | 400x200 JPEG with an APP1 EXIF block, Orientation = 6 |
| `anim.gif` | hand-built 2-frame GIF89a with a NETSCAPE loop block |
| `depth16.png` | hand-built 32x32 PNG, **bit depth 16**, colour type 2 |
| `cmyk.jpg` | `a.jpg` run through `sips --matchTo "Generic CMYK Profile.icc"`; SOF0 carries **4 components** |
| `four_mp.jpg` | 2000x2000, 7.1 MB, for the memory probe |
| `notimage.png` | 21 bytes of text with an image extension |

**Input integrity** -- sha256 of all 16 fixtures is taken before the first probe and after the last
one in every lane and diffed.

**Part 2 harness** -- the real `claude` CLI as MCP client: `claude -p "<prompt>" --mcp-config
/private/tmp/uv70/mcp.json --strict-mcp-config --model sonnet --output-format json --max-turns 14
--allowedTools "<12 tools written out by name>"`, one session (`--session-id` then five
`--resume`). `image` is the only server registered. `MCP_LICENSE_KEY=""`, `XDG_DATA_HOME` and
`XDG_CONFIG_HOME` fresh under `/private/tmp/uv70` -- **set in the server's `env` block inside
`mcp.json`, not on the CLI process**. The first attempt exported them on the CLI itself and unset
`CLAUDE_CONFIG_DIR`; all six prompts died with `Failed to authenticate: OAuth session expired and
could not be refreshed`, which is the other half of `docs/CALENDAR_AUDIT.md` H-1. That lane was
discarded and re-run, not scored.

The three source images were generated with jimp before the run: `photo.jpg` 4000x3000 (20.4 MB,
with an APP1 EXIF block carrying a `SECRET-GPS-PLACE` payload), `logo.png` 512x512 with a real
alpha channel (a purple disc inside a gold ring on transparency), `avatar.jpg` 300x300.

---

## Part 1 -- adversarial probes

| # | Probe | Before | Fixed | After |
|---|---|---|---|---|
| A1 | `image_info` with no arguments | PASS | - | zod: `Required at path` |
| A2 | `image_resize {width: "200"}` | PASS | - | zod: `Expected number, received string at width` |
| A3 | `image_crop` with no `height` | PASS | - | zod: `Required at height` |
| A4 | `image_convert {format: "webp"}` | PASS | - | zod: `Invalid enum value. Expected 'png' \| 'jpeg' \| 'bmp' \| 'gif' \| 'tiff'` |
| A5 | `image_batch_resize {paths: []}` | PASS | - | zod: `Array must contain at least 1 element(s)` |
| A6 | `image_resize` with neither width nor height | PASS | - | `give width, height, or both. Nothing was written.` |
| B1 | 60 MB input | PASS | - | refused on `statSync` before a byte is read: `is 60.0 MB; this server refuses inputs over 50.0 MB` |
| B2 | PNG declaring 20000x20000 | PASS | - | `declares 20000x20000 pixels in its PNG header ... would allocate 1526 MB of RGBA. Nothing was decoded.` |
| B3-B6 | the same bomb as **JPEG, GIF, BMP and TIFF** | PASS | - | all four refused on the header, by name, nothing written. The SOF walk, the GIF logical screen descriptor, the BMP info header and the first TIFF IFD all fire |
| B7 | a text file named `.png` | PASS | - | refused on magic bytes: `does not start with the magic bytes of a PNG, JPEG, BMP, GIF or TIFF` |
| C1/C2 | PNG with 30 flipped bytes inside IDAT | PASS | - | `could not be decoded as PNG: unrecognised content at end of stream`, on both `image_info` and `image_resize`, nothing written |
| C3/C4 | JPEG with EXIF **Orientation 6** | **FAIL (silent disagreement)** | yes | see D-I3 |
| C5/C6 | **animated GIF**, 2 frames | **FAIL (frames dropped silently)** | yes | see D-I2 |
| **C6b** | **truncated animated GIF** | **FAIL (transport killed)** | yes | see **D-I1** |
| C7/C8 | **16-bit PNG** | PASS | - | decoded 32x32 and re-encoded as an 8-bit-per-channel JPEG. jimp's pngjs downsamples 16 -> 8 on read; the pixels survive, the extra precision does not. Nothing here can write 16-bit, so there is nothing to lose downstream |
| C9/C10 | **CMYK JPEG** (4-component SOF0, Adobe APP14) | PASS | - | decoded 400x300 and converted. Mean absolute channel difference against the RGB original is **27.4 / 255**, which is the CMYK gamut round trip `sips` performed, not a decoder failure -- an inverted or mis-transformed decode is 200+ |
| D1 | 1x1 resized to 4000 wide | **FAIL (silent upscale)** | yes | see D-I4 |
| D2/D3 | `width: 0`, `width: -50` | PASS | - | zod: `Number must be greater than or equal to 1 at width` |
| D4/D5 | `quality: 0`, `quality: 101` | PASS | - | zod: `>= 1`, `<= 100` |
| D6/D7 | crop 100x100 at (290,190) and 10x10 at (5000,5000) on a 300x200 image | PASS | - | `runs past the edge of a 300x200 image (it would need 390x290). Nothing was written. A crop is not clamped here` |
| E1 | watermark text with a newline | PASS | - | `Watermarked "PAID IN FULL"` -- the pre-existing `\s+ -> " "` collapse is the right one; no `PAIDIN FULL` |
| E2 | 500-character watermark | **FAIL (drawn off the page)** | yes | see D-I6 |
| E3 | `"OPŁACONE 已付款"` | **FAIL (stroke deleted, CJK invisible)** | yes | see D-I5 |
| E4 | `"已付款"` alone | **FAIL (reported as drawn)** | yes | see D-I5 |
| E5/E6 | `opacity: 5`, `opacity: 0` | PASS | - | zod: `<= 1`, `>= 0.05` |
| F1 | `out_path` traversal `../../../../private/tmp/.../trav.png` | PASS | - | resolved against cwd and written there; no escape. An absolute path is the caller's own choice, as with any file tool |
| F2-F4 | write, refuse, then `overwrite: true` | PASS | - | `already exists and nothing was written. Pass overwrite: true` |
| F5/F6 | `out_path` equal to the input, `overwrite: true`, on resize and compress | PASS | - | refused: `is also an input of this operation, so writing it would destroy the source` |
| F7 | `out_path` with no extension | PASS | - | written as the input's format under the name given |
| G1/G2 | batch of 3 with a **missing file in the middle**, both `image_batch_resize` and `image_thumbnails` | PASS | - | `nope.png does not exist`, and the output directory is **empty** in both cases. Every source is loaded, then every output reserved, before the first byte is written |
| H1 | `image_dominant_colors` on the free tier | **FAIL (useless gate)** | yes | see D-I9 |
| I1 | two processes on one data dir, 20 concurrent resizes | PASS | - | `test/concurrency.test.mjs`: 20 records, 20 distinct outputs, source byte-identical |
| I2 | two processes racing one `out_path` | PASS | - | exactly one refused; the winner's file complete |
| I3 | corrupt operation register | PASS | - | quarantined to `operations.json.corrupt-<ts>` with a marker; the image is still written and the answer says the history could not be updated |
| I4 | stdout carries JSON-RPC only | **FAIL** | yes | see **D-I1** |
| I5 | no network | PASS | - | line scan of `src/` is empty |
| I6 | inputs byte-identical | PASS | - | all 16 fixtures sha256-identical in both lanes, after every probe above |
| I7 | memory peak, 4 MP compress | PASS | - | `/usr/bin/time -l` on `image_compress {four_mp.jpg (2000x2000, 6.8 MB), quality 70, max_width 1600}`: **434,946,048 B maximum resident set size**, 894 ms wall. 4 MP of RGBA is 16 MB, so the peak is ~27x the pixel buffer -- that is jimp holding the decoded bitmap, the resized bitmap and the JPEG encoder's own buffers at once |

### Defects and fixes

**D-I1 (critical): a decoder warning on stdout killed the connection.** `omggif` prints
`Warning, gif stream shorter than expected.` with `console.log` when a GIF's block stream ends
early. `console.log` is stdout, stdout is the JSON-RPC transport, and the probe client -- which
throws on any non-JSON stdout line, exactly as a strict MCP client would -- **died mid-run**:

```
Error: non-JSON on stdout: Warning, gif stream shorter than expected.
    at Socket.<anonymous> (servers/image/test/_client.mjs:43:53)
```

Every request after that point is lost. `jpeg-js` warns the same way on a malformed JPEG. This
was not reachable through the existing tests because none of them fed the GIF decoder a damaged
file. Fix: `process.stdout.write` is wrapped before the transport is created and diverts anything
that does not begin `{` or `[` to stderr, and `console.log/info/warn/debug` are bound to stderr
outright. The protocol still goes out through the original handle. `test/adversarial.test.mjs`
feeds a truncated animated GIF through two calls and then asserts a third call still answers.

**D-I2: an animated GIF lost every frame but the first, silently.** A 2-frame GIF returned
`"width": 4, "height": 4` from `image_info` with no mention of animation, and `image_convert`
wrote a still and reported success. Fix: `gifFrameCount()` walks the GIF block stream and counts
image descriptors; `image_info` reports `frames` and an `animation_note`, and resize, convert and
crop all print `anim.gif is an animated GIF with 2 frames. Only the first frame was read; the
output is a still. This server does not write animation.` The behaviour is unchanged -- first
frame -- but it is now stated.

**D-I3: EXIF orientation is applied, and nothing said so.** `orient6.jpg` has a SOF0 declaring
**400x200** and Orientation 6. jimp applies the tag on read, so `image_info` answered `200x400`.
That is the correct answer -- it is what the user sees -- but it contradicts every other tool that
reads the header, and the copies this server writes carry no EXIF block, so the *second* question
("will it get turned again?") was unanswerable. Fix: `LoadedImage` carries the declared header
dimensions, and when they disagree `image_info` adds `declared_in_header: "400x200"` and an
`orientation_note` saying the turn was applied on read and that a copy written here has no EXIF
block and will not be turned a second time.

**D-I4: an upscale was reported as a plain resize.** `image_resize {1x1 -> width: 4000}` answered
`Resized 1x1 to 4000x4000` and wrote a 65.7 KB file of one interpolated colour. Fix: any resize
whose output exceeds the source on either side says `the extra pixels are interpolated, not new
detail`, and `image_batch_resize` marks the affected rows `(ENLARGED past the source resolution)`.
Part 2 s6 is the case that matters: a 300 px avatar in a "resize everything to 800 wide" batch.

**D-I5: watermark text outside the font was deleted, and the answer claimed it was drawn.** The
bundled jimp bitmap fonts carry Latin-1 only and draw a missing glyph as nothing at all.
Measured: `measureText(SANS_32_WHITE, "已付款")` is **0 px**. So `image_watermark {text:
"已付款"}` composited a 1 px plate onto the photo and answered `Watermarked "已付款"` -- a
watermark that is not there, reported as done. `"OPŁACONE"` came back as `OPLACONE` on the pixels
while the answer quoted the Polish spelling, so the user is told a word was drawn that was not.
Fix: `sanitizeWatermarkText()` transliterates every character the loaded font has no glyph for
(an explicit table for Ł, đ, ħ, œ, ŋ, Ø, Æ, ß and the typographic quotes and dashes, plus NFD with
the combining marks stripped for the rest), counts what it replaced, lists what it had to drop,
and the answer quotes **the text that went on the pixels**. Text with nothing renderable left is
refused with the dropped characters named and nothing written.

**D-I6: a 500-character watermark was drawn off the edge and reported as success.** The font
ladder stops at the 8 px face, where 200 characters measure 1,000 px of text in 282 px of room.
Fix: the measured width is compared against the room actually available and the overflow is
named -- `measures 1000 pt at 8 px type, the smallest face this server has, in 282 px of room on a
300x200 image, so it would be drawn off the right edge` -- with nothing written. The silent
200-character truncation is now reported too.

**D-I7 (from part 2, critical for the product): the free tier capped the wrong number.**
`FREE_MAX_PIXELS` was checked against the **source**, so a 12 MP phone photo was refused by every
write tool -- including the one job this server exists for, taking a camera-sized file down to a
page-sized one. Fix: the cap moved to the **output**. `image_resize`, `image_compress`,
`image_crop`, `image_thumbnails` and `image_batch_resize` compute the target size first and check
that; the refusal now names it and says what to do: `The output would be 4000x3000 (12 MP), from a
4000x3000 source. ... Resize it smaller in the same call (width, height or max_width) and this is
free.` Writing 12 MP back out is still Pro. Measured effect: a 3-file batch of 2400x1800 photos to
800 px wide goes from refused to free.

**D-I8: `image_strip_metadata` was size-capped, which made the privacy tool refuse every camera
photo.** It writes exactly the pixels it read, so an output cap on it is an input cap by another
name, and part 2 s4 -- "strip the metadata from photo.jpg" -- was answered with an upsell. Fix: no
size cap on that tool at any tier. The 50 MB / 10,000 px input guards still bound the cost.

**D-I9: dominant colours were gated to nothing, and the model filled the gap by inventing them.**
The free tier returned only the checkout line. In part 2 s5 the model relayed it correctly and
then volunteered `#E8A93A` and `#5B3B8C` "from viewing the image earlier" -- it had never seen the
image; the real values are `#e8b23a` and `#5b3e8a`. A refusal does not stop the caller wanting an
answer. Fix: the free tier returns the **top 3** measured colours with their pixel counts and
names its own cap; Pro goes to 16. `CONVENTIONS.md` asks for a genuinely useful free tier, and
three measured colours beat a gate that gets answered with a guess.

**D-I10: `image_dominant_colors` reported `share_percent: 0` five times on a photograph.** With
10,920 distinct 5-bit buckets in 26,600 sampled pixels no colour reaches 0.05%, so every row
rounded to zero and the answer looked broken. Fix: each colour carries its raw `pixels` count, and
when the top colour is under 1% the payload says `No colour covers even 1% of the image: ... This
is a photograph or a gradient, not a palette - the hex codes above are the most common shades, not
brand colours.`

**D-I11 (from part 2): `image_compress` had no size target, so the caller brute-forced one.**
Asked for "under 250 KB", the model ran `image_compress` **five times** at quality 80, 75, 40, 20,
12 and 9, left five intermediate files on disk, spent 15 turns, and finished by asking permission
to clean up its own mess. Fix: `max_bytes`. The tool binary-searches JPEG quality down from
`quality` until the encoded buffer fits, reports the quality it landed on and how many encodes it
took, refuses `max_bytes` on a lossless output (naming `max_width` as the knob that still works),
and refuses a target no quality can reach rather than writing something over it. Measured on the
same 20.4 MB photo: **one call, 8 encodes, 3.1 s**, `240.9 KB ... Method: JPEG quality 8 (searched
down from 80 in 8 encodes to fit 250.0 KB) and a resize to 1600 px wide`.

**Not defects, recorded so they are not re-litigated.** `out_path` traversal resolves against the
cwd and writes there, like any file tool given an absolute path. A 16-bit PNG is downsampled to 8
bits by the decoder and nothing here can write 16-bit, so there is no precision to lose later. A
CMYK JPEG decodes correctly. `image_thumbnails` writing `<name>-thumb.<ext>` is a fixed naming
scheme, not a bug, but it is why part 2 s3 cost a stray file -- see the scorecard.

### Edits made

| File | Change |
|---|---|
| `src/index.ts` | stdout guard + `console.*` bound to stderr, before the transport exists (D-I1) |
| `src/index.ts` | `framesNote()` on resize, convert and crop; `frames` / `animation_note` in `image_info` (D-I2) |
| `src/index.ts` | `declared_in_header` / `orientation_note` in `image_info` (D-I3) |
| `src/index.ts` | `upscaleNote()`, and an `(ENLARGED ...)` row marker in `image_batch_resize` (D-I4) |
| `src/index.ts` | `sanitizeWatermarkText()` + `TRANSLIT` table; empty-after-sanitising and overflow both refused (D-I5, D-I6) |
| `src/index.ts` | `proSizeCheck(src, feature, outW, outH)` + `fitInside()`: the free cap is on the output (D-I7) |
| `src/index.ts` | no size cap on `image_strip_metadata` (D-I8) |
| `src/index.ts` | `FREE_MAX_COLORS = 3`; free tier answers with three colours and names the cap (D-I9) |
| `src/index.ts` | `pixels` per colour and a "no palette" note under 1% (D-I10) |
| `src/index.ts` | `max_bytes` on `image_compress`, binary-searched, with both refusals (D-I11) |
| `src/imageio.ts` | `gifFrameCount()`; `declared` and `frames` on `LoadedImage` |
| `test/adversarial.test.mjs` | new file, 17 tests |
| `test/smoke.test.mjs` | the 4 MP test rewritten for the output-based cap |
| `README.md` | free/pro table rewritten around the output cap; `max_bytes`; dominant colours 3 vs 16 |

---

## Part 2 -- user value through a real MCP client

One server, one conversation, free tier throughout. Score: 3 = correct, right numbers, no
clarification; 2 = correct but leaves the user a gap; 1 = partially wrong; 0 = failed. Every
number below is read off the files, not off the model's prose.

### Scorecard -- 13 / 18 as shipped

| # | Prompt | Score | Turns | Sec | Tools called | Verified |
|---|---|---|---|---|---|---|
| s1 | "Make a web version of photo.jpg, 1600 px wide, under 250 KB." | 2 | 15 | 68 | `image_info`, `image_compress` x6 | `photo-web-q9.jpg` is **1600x1200, 252,079 B = 246.2 KB**, under the target, and the EXIF `SECRET-GPS-PLACE` payload is gone. But it took six encodes at quality 80/75/40/20/12/9, left **six files** in the folder, and the turn ended asking permission to delete five of them and rename the sixth. D-I11 |
| s2 | "Convert the logo to JPEG on a white background." | 3 | 5 | 18 | `image_convert` | `logo.jpg` **512x512, 22,990 B**; pixel (2,2), transparent in the source, is **rgba(255,255,255,255)**. The tool flattens onto white by itself and says so, so "on a white background" needed no extra step |
| s3 | "Crop the avatar to a centered square and make 64 and 128 px thumbnails." | 2 | 11 | 80 | `image_info`, `image_crop`, `image_thumbnails`, `image_resize` x2 | `avatar-square.jpg` 300x300, `avatar-128.jpg` **128x128**, `avatar-64.jpg` **64x64** -- all correct, and it noticed the source was already square rather than pretending to crop. The deduction is the stray `avatar-square-thumb.jpg`: `image_thumbnails` writes one fixed name per input, so two sizes into one directory collide, and the model abandoned it for `image_resize` after the first size. It could not clean up either |
| s4 | "Strip the metadata from photo.jpg." | 1 | 3 | 17 | `image_strip_metadata` | **Nothing was written.** The free tier refused a 12 MP source, and the model correctly relayed a choice between downscaling the user's original and buying Pro. The privacy tool refusing every phone photo is the worst single answer in the run. D-I8 |
| s5 | "What are the dominant colours of the logo?" | 2 | 3 | 14 | `image_dominant_colors` | The gate fired and was relayed exactly, with the checkout URL and a refusal to buy on the user's behalf -- that part is right. Then it offered `#E8A93A` and `#5B3B8C` "from viewing the image earlier", which it never did; the measured values are `#e8b23a` (23.2%) and `#5b3e8a` (74.5%). D-I9 |
| s6 | "Batch resize all three to 800 wide into /private/tmp/uv70/web/." | 3 | 3 | 20 | `image_batch_resize` | `web/photo-800x600.jpg` **800x600**, `web/logo-800x800.png` **800x800**, `web/avatar-800x800.jpg` **800x800**, one call. It also flagged unprompted that the logo and the avatar were enlarged past their source resolution -- which the tool did not say at the time. D-I4 |

**Totals: 40 tool calls, 217 s, 13 / 18.** All three sources sha256-identical before and after the
whole conversation (`55a9fee8...` photo, `398dfdd1...` logo, `4faebef1...` avatar).

### Regression after the fixes

Same prompts, fresh session, fresh `XDG_DATA_HOME`, free tier, on the fixed build:

| # | Prompt | Was | Now | Turns | Sec | Verified |
|---|---|---|---|---|---|---|
| s1 | "Make a web version of photo.jpg, 1600 px wide, under 250 KB." | 2 | **2** | 15 -> **11** | 68 -> **47** | `photo-web-out.jpg` **1600x1200, 232,621 B = 227.2 KB**, no EXIF. Two `image_compress` calls instead of six and **two** files on the disk instead of six; the model's own report names quality 8, which is where the `max_bytes` search lands. Still a 2, for the one leftover file from the first untargeted call. The fixture is the reason the quality had to go so low: this "photo" is deterministic diagonal noise, near-worst-case for JPEG, and the model said so unprompted |
| s4 | "Strip the metadata from photo.jpg." | 1 | **3** | 3 | 17 | `photo-stripped.jpg` **4000x3000, 21,363,053 B**, and the `SECRET-GPS-PLACE` EXIF payload is **gone**. One call, no upsell, and it relayed the re-encode caveat |
| s5 | "What are the dominant colours of the logo?" | 2 | **3** | 3 | 9 | Three measured colours, exact: `#5b3e8a` **74.5%**, `#e8b23a` **23.2%**, `#624486` 0.2%, and the answer names the free cap and what Pro adds. Nothing invented |

The three sources are sha256-identical to the pre-run values (`55a9fee8...`, `398dfdd1...`,
`4faebef1...`). Carrying the unchanged scenarios (s2 3, s3 2, s6 3), the whole-conversation
equivalent is **16 / 18**, against 13 / 18 as shipped.

---

## Final test summary

```
$ npm run build -w servers/image
(clean)

$ npm test -w servers/image
1..37
# tests 37
# pass 37
# fail 0
# duration_ms 15460.752875
```

`test/adversarial.test.mjs` is new, 17 tests: the four-container bomb guard, the 60 MB refusal, the
corrupt IDAT, EXIF orientation reporting, animated-GIF frame counting, **the truncated-GIF stdout
guard**, the 16-bit PNG, the upscale note, four watermark text cases, the output-based free cap,
the no-partial-batch guarantee, the dominant-colour note, the free three-colour answer,
`max_bytes` with both of its refusals, the size-capless metadata strip, a full write-tool pass with
sha256 asserted unchanged, and the network scan.

## RESULT.md block

```
status: DONE
evidence: npm test -w servers/image -> 37 tests, 37 pass, 0 fail, 15.5 s.
  Part 1: 45 probes over two lanes, 16 fixtures, all sha256-identical after every probe.
  Part 2: 6 prompts through the claude CLI, 40 tool calls, 217 s, 13/18 as shipped; the three
  re-run after the fixes score 8/9 against 5/9, whole-conversation equivalent 16/18.
  Memory peak on a 4 MP compress: 434,946,048 B RSS, 894 ms.
artifacts: docs/IMAGE_AUDIT.md, servers/image/src/{index,imageio}.ts,
  servers/image/test/adversarial.test.mjs, servers/image/test/smoke.test.mjs, servers/image/README.md
cost: 55 wall minutes
failures: 11 defects, D-I1 to D-I11, all fixed. D-I1 killed the transport outright; D-I5 reported a
  watermark that was not on the pixels; D-I7 and D-I8 made the free tier refuse the product's own job.
insight: The free tier was measuring the wrong number, and it took a real client to show it.
  FREE_MAX_PIXELS was checked against the SOURCE, so every 12 MP phone photo was refused - including
  "take this down to 1600 px", which is the entire reason the server exists. Nothing in 20 unit tests
  caught it, because every fixture in them was small; the 4 MP test used a 2200x2000 PNG, comfortably
  above the cap and comfortably below anything a camera produces. The cap belongs on what gets
  WRITTEN. Second: stdout is not yours. A pure-JS image stack pulls in five decoders, and one of
  them (omggif) prints a warning with console.log on a truncated file - a bare line of English in the
  middle of the JSON-RPC stream, which killed the probe client mid-run and would kill any strict MCP
  client the same way. The guard has to be installed before the transport exists, and it has to catch
  process.stdout.write, not only console.log.
```
