/**
 * Linear (1D) symbologies, encoded here rather than pulled from a package.
 *
 * Every encoder returns the module array: one boolean per narrowest bar width, true = a
 * dark module. Rendering (SVG or PNG) never knows which symbology produced the array, so
 * a new symbology costs an encoder and nothing else.
 *
 * The tables below are transcribed from ISO/IEC 15417 (Code 128) and ISO/IEC 15420
 * (EAN/UPC). Transcription is the whole risk with a table this size, so both tables are
 * checked against their own structural invariants at module load (verifyTables), and the
 * check runs again in test/tables.test.mjs. A silent typo in one row would print a
 * scannable-looking symbol that decodes to the wrong character.
 */

/**
 * Code 128 element widths, values 0..106. Each row is bar,space,bar,space,bar,space in
 * modules; every row sums to 11 except the stop pattern (106), which carries a seventh
 * element and sums to 13.
 */
const CODE128 = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const START_B = 104;
const START_C = 105;
const CODE_B = 100;
const CODE_C = 99;
const STOP = 106;

export const EAN_L = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011",
];
export const EAN_G = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111",
];
export const EAN_R = EAN_L.map((s) => [...s].map((c) => (c === "1" ? "0" : "1")).join(""));

/** Which of the first six digits use the G set, selected by the leading digit. */
const EAN13_PARITY = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL",
];
/** EAN-8's left half is fixed odd parity; the parity trick is only needed for 13 digits. */
const EAN8_PARITY = "LLLL";

/** Structural invariants that catch a transcribed digit. Throws at load if one fails. */
export function verifyTables(): void {
  CODE128.forEach((p, i) => {
    const w = [...p].map(Number);
    const elements = i === STOP ? 7 : 6;
    const width = i === STOP ? 13 : 11;
    if (w.length !== elements) throw new Error(`code128 row ${i} has ${w.length} elements`);
    if (w.reduce((a, b) => a + b, 0) !== width) throw new Error(`code128 row ${i} is not ${width} modules wide`);
    // Every Code 128 character has an even number of modules in its bars ("even parity"),
    // which is the property the symbology itself uses to reject a misread.
    const bars = w.filter((_, k) => k % 2 === 0).reduce((a, b) => a + b, 0);
    if (i !== STOP && bars % 2 !== 0) throw new Error(`code128 row ${i} has odd bar parity`);
  });
  if (new Set(CODE128).size !== CODE128.length) throw new Error("code128 table has a duplicate row");
  const tables: [string, string[]][] = [["L", EAN_L], ["G", EAN_G], ["R", EAN_R]];
  for (const [name, table] of tables) {
    table.forEach((s, d) => {
      if (s.length !== 7) throw new Error(`ean ${name}${d} is not 7 modules`);
      const dark = [...s].filter((c) => c === "1").length;
      if (name === "L" ? dark % 2 !== 1 : dark % 2 !== 0) throw new Error(`ean ${name}${d} has the wrong parity`);
    });
    if (new Set(table).size !== 10) throw new Error(`ean ${name} table has a duplicate row`);
  }
  // G is R reversed, R is L complemented. One typo anywhere breaks one of these.
  EAN_G.forEach((g, d) => {
    if (g !== [...EAN_R[d]].reverse().join("")) throw new Error(`ean G${d} is not the reverse of R${d}`);
  });
  EAN13_PARITY.forEach((p, d) => {
    if (p.length !== 6 || p[0] !== "L") throw new Error(`ean13 parity row ${d} is malformed`);
  });
}

verifyTables();

export type Symbology = "code128" | "ean13" | "ean8" | "upca";

export interface Encoded {
  symbology: Symbology;
  /** One boolean per module, true = dark. */
  modules: boolean[];
  /** The text printed under the bars. */
  human: string;
  /** The data as encoded, including any check digit this encoder appended. */
  value: string;
  /** Quiet zone in modules on each side, per the symbology's own specification. */
  quiet: number;
  /** Module indexes of guard bars, which run down past the digits. EAN/UPC only. */
  guards: number[];
}

function bits(pattern: string, startDark: boolean): boolean[] {
  const out: boolean[] = [];
  let dark = startDark;
  for (const ch of pattern) {
    const n = Number(ch);
    for (let i = 0; i < n; i++) out.push(dark);
    dark = !dark;
  }
  return out;
}

function fromBinary(s: string): boolean[] { return [...s].map((c) => c === "1"); }

/**
 * Code 128, subsets B and C with automatic switching.
 *
 * Switching is about size, not correctness: subset C packs two digits into one symbol
 * character, so a 20-digit payload is 10 characters instead of 20 and the symbol is
 * measurably narrower. The rule is the one in the specification's annex: start in C when
 * the payload opens with an even run of four or more digits, switch into C mid-payload
 * only when a run of six or more pays for the switch character, and switch back at the
 * first non-digit or odd tail.
 */
export function encodeCode128(text: string): Encoded {
  const bad = [...text].find((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) > 126);
  if (bad !== undefined) {
    throw new Error(
      `Code 128 here encodes printable ASCII (space through ~) only, and the text contains ` +
      `${JSON.stringify(bad)} (code point ${bad.codePointAt(0)}). A QR code carries any text; use qr_create for that.`,
    );
  }
  if (text.length === 0) throw new Error("Code 128 needs at least one character to encode.");

  const digitsAt = (i: number): number => {
    let n = 0;
    while (i + n < text.length && text[i + n] >= "0" && text[i + n] <= "9") n++;
    return n;
  };

  const codes: number[] = [];
  let mode: "B" | "C";
  let i = 0;
  const lead = digitsAt(0);
  if (lead >= 4) { mode = "C"; codes.push(START_C); }
  else { mode = "B"; codes.push(START_B); }

  while (i < text.length) {
    if (mode === "C") {
      if (digitsAt(i) >= 2) { codes.push(Number(text.slice(i, i + 2))); i += 2; continue; }
      codes.push(CODE_B); mode = "B"; continue;
    }
    const run = digitsAt(i);
    // The specification's annex: a run of six or more pays for the switch character, and so
    // does a run of four or more that ends the payload (nothing has to switch back).
    if (run >= 6 || (run >= 4 && i + run === text.length)) {
      const even = run - (run % 2);
      codes.push(CODE_C); mode = "C";
      const end = i + even;
      while (i < end) { codes.push(Number(text.slice(i, i + 2))); i += 2; }
      continue;
    }
    codes.push(text.charCodeAt(i) - 32);
    i++;
  }

  // Checksum: the start value plus each following code times its position, modulo 103.
  let sum = codes[0];
  for (let k = 1; k < codes.length; k++) sum += codes[k] * k;
  codes.push(sum % 103);
  codes.push(STOP);

  const modules: boolean[] = [];
  for (const c of codes) modules.push(...bits(CODE128[c], true));
  return { symbology: "code128", modules, human: text, value: text, quiet: 10, guards: [] };
}

/** EAN/UPC check digit: alternating weights 3 and 1 from the right, complement to 10. */
export function eanCheckDigit(digits: string): number {
  let sum = 0;
  const rev = [...digits].reverse();
  for (let i = 0; i < rev.length; i++) sum += Number(rev[i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

function digitsOnly(code: string, label: string): string {
  const s = String(code).replace(/[\s-]/g, "");
  if (!/^[0-9]+$/.test(s)) throw new Error(`${label} is digits only; "${code}" is not.`);
  return s;
}

/**
 * Take a code that is either full length (check digit included, and then verified) or one
 * digit short (check digit computed). Silently accepting a wrong check digit is the
 * failure this refuses: the label prints, the scanner reads a different product, and
 * nobody finds out until the till.
 */
function withCheck(code: string, full: number, label: string): string {
  const s = digitsOnly(code, label);
  if (s.length === full - 1) return s + String(eanCheckDigit(s));
  if (s.length !== full) {
    throw new Error(`${label} takes ${full} digits (or ${full - 1}, and the check digit is computed); "${s}" has ${s.length}.`);
  }
  const want = eanCheckDigit(s.slice(0, full - 1));
  if (Number(s[full - 1]) !== want) {
    throw new Error(
      `${label} check digit is wrong: "${s}" ends in ${s[full - 1]}, but the first ${full - 1} digits give ${want}. ` +
      `Pass ${s.slice(0, full - 1)}${want}, or pass the first ${full - 1} digits and the check digit is computed. Nothing was written.`,
    );
  }
  return s;
}

function assemble(left: string[], right: string[]): { modules: boolean[]; guards: number[] } {
  const s = ["101", ...left, "01010", ...right, "101"].join("");
  const guards: number[] = [];
  const center = 3 + left.length * 7;
  for (let k = 0; k < 3; k++) guards.push(k, s.length - 3 + k);
  for (let k = 0; k < 5; k++) guards.push(center + k);
  return { modules: fromBinary(s), guards };
}

export function encodeEan13(code: string): Encoded {
  const v = withCheck(code, 13, "EAN-13");
  const parity = EAN13_PARITY[Number(v[0])];
  const left = [...v.slice(1, 7)].map((d, i) => (parity[i] === "L" ? EAN_L : EAN_G)[Number(d)]);
  const right = [...v.slice(7)].map((d) => EAN_R[Number(d)]);
  const { modules, guards } = assemble(left, right);
  return { symbology: "ean13", modules, human: `${v[0]} ${v.slice(1, 7)} ${v.slice(7)}`, value: v, quiet: 11, guards };
}

export function encodeEan8(code: string): Encoded {
  const v = withCheck(code, 8, "EAN-8");
  const left = [...v.slice(0, 4)].map((d, i) => (EAN8_PARITY[i] === "L" ? EAN_L : EAN_G)[Number(d)]);
  const right = [...v.slice(4)].map((d) => EAN_R[Number(d)]);
  const { modules, guards } = assemble(left, right);
  return { symbology: "ean8", modules, human: `${v.slice(0, 4)} ${v.slice(4)}`, value: v, quiet: 7, guards };
}

export function encodeUpcA(code: string): Encoded {
  const v = withCheck(code, 12, "UPC-A");
  const left = [...v.slice(0, 6)].map((d) => EAN_L[Number(d)]);
  const right = [...v.slice(6)].map((d) => EAN_R[Number(d)]);
  const { modules, guards } = assemble(left, right);
  return { symbology: "upca", modules, human: `${v[0]} ${v.slice(1, 6)} ${v.slice(6, 11)} ${v[11]}`, value: v, quiet: 9, guards };
}

export function encodeLinear(symbology: Symbology, value: string): Encoded {
  switch (symbology) {
    case "code128": return encodeCode128(value);
    case "ean13": return encodeEan13(value);
    case "ean8": return encodeEan8(value);
    case "upca": return encodeUpcA(value);
  }
}
