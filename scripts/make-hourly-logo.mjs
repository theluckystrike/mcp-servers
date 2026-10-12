// One-off: generate assets/hourly-rate-logo.png (400x400) without ImageMagick.
// Minimal PNG encoder: RGB, no interlace, zlib via node:zlib. Glyphs via 5x7 bitmaps.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const W = 400, H = 400;

// 5x7 bitmap font for the glyphs we need
const GLYPHS = {
  "$": ["..X..","XXXXX","X.X..",".XXX.","..X.X","XXXXX","..X.."],
  "/": ["....X","...X.","..X..",".X...","X....","X....","X...."],
  "h": ["X...X","X...X","X...X","XXXXX","X...X","X...X","X...X"],
};
const TEXT = "$/h";
const SCALE = 14;            // 5x7 -> 70x98 per glyph
const GAP = 3 * SCALE;       // gap between glyphs
const textW = TEXT.length * 5 * SCALE + (TEXT.length - 1) * GAP;
const textH = 7 * SCALE;
const x0 = Math.floor((W - textW) / 2);
const y0 = Math.floor((H - textH) / 2);

// pixel buffer, RGB
const px = Buffer.alloc(W * H * 3);
const set = (x, y, r, g, b) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = r; px[i+1] = g; px[i+2] = b;
};

// background: vertical gradient deep indigo -> slate
for (let y = 0; y < H; y++) {
  const t = y / H;
  const r = Math.round(24 + t * 20);
  const g = Math.round(24 + t * 26);
  const b = Math.round(46 + t * 34);
  for (let x = 0; x < W; x++) set(x, y, r, g, b);
}

// draw text in warm amber
const drawGlyph = (ch, ox) => {
  const rows = GLYPHS[ch];
  for (let ry = 0; ry < 7; ry++) for (let rx = 0; rx < 5; rx++) {
    if (rows[ry][rx] !== "X") continue;
    for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) {
      set(ox + rx * SCALE + dx, y0 + ry * SCALE + dy, 255, 191, 64);
    }
  }
};
let cx = x0;
for (const ch of TEXT) { drawGlyph(ch, cx); cx += 5 * SCALE + GAP; }

// thin rule under the text, same amber, 60% width
const ruleY = y0 + textH + 2 * SCALE;
for (let x = Math.floor(W * 0.2); x < Math.floor(W * 0.8); x++)
  for (let dy = 0; dy < 4; dy++) set(x, ruleY + dy, 255, 191, 64);

// encode PNG
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolor RGB
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0; // no filter
  px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync("assets/hourly-rate-logo.png", png);
console.log("wrote assets/hourly-rate-logo.png", png.length, "bytes");
