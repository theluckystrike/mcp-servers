// The encoders and payload builders, with no server in the way.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eanCheckDigit, encodeCode128, encodeEan13, encodeEan8, encodeUpcA, verifyTables,
  epcPayload, ibanChecksum, validateIban, vcardPayload, wifiPayload, linearSvg, LINEAR_DEFAULTS,
} from "../dist/lib.js";

const bits = (e) => e.modules.map((b) => (b ? "1" : "0")).join("");

test("the transcribed symbol tables pass their own structural invariants", () => {
  assert.doesNotThrow(() => verifyTables());
});

/**
 * Ground truth from an independent implementation (jsbarcode 3.12.3, MIT), captured once
 * and pinned here. These are the exact module strings a scanner sees; a single flipped bar
 * would produce a symbol that still looks like a barcode and decodes to something else.
 */
const TRUTH = {
  ean13: "10100010110100111011001100100110111101001110101010110011011011001000010101110010011101000100101",
  ean8: "1010001011010111101111010110111010101001110111001010001001011100101",
  upca: "10100011010111101010111100011010001101000110101010110110011101001100110101110010011101101100101",
};

test("EAN-13 encodes to the module string an independent encoder produces", () => {
  assert.equal(bits(encodeEan13("5901234123457")), TRUTH.ean13);
  assert.equal(encodeEan13("590123412345").value, "5901234123457", "a 12-digit input gets its check digit computed");
});

test("EAN-8 and UPC-A encode to the same module strings as the independent encoder", () => {
  assert.equal(bits(encodeEan8("96385074")), TRUTH.ean8);
  assert.equal(bits(encodeUpcA("036000291452")), TRUTH.upca);
});

test("a wrong EAN check digit is refused, never quietly corrected", () => {
  assert.throws(() => encodeEan13("5901234123450"), /check digit is wrong/);
  assert.throws(() => encodeUpcA("036000291453"), /check digit is wrong/);
  assert.throws(() => encodeEan8("96385075"), /check digit is wrong/);
  assert.throws(() => encodeEan13("59012341234"), /takes 13 digits/);
  assert.throws(() => encodeEan13("59012341234A"), /digits only/);
});

test("the EAN check digit matches the published examples", () => {
  assert.equal(eanCheckDigit("590123412345"), 7);
  assert.equal(eanCheckDigit("400638133393"), 1);
  assert.equal(eanCheckDigit("9638507"), 4);
});

test("Code 128 switches into subset C for a digit run and stays byte-exact", () => {
  // Start B, three characters, Code C, two pairs, check, stop = 10 characters = 112 modules.
  assert.equal(encodeCode128("ABC-1234").modules.length, 112);
  // 19 digits: start C, nine pairs, a switch, one character, check, stop.
  assert.equal(encodeCode128("0123456789012345678").modules.length, 156);
  // Every symbol is a whole number of 11-module characters plus the 13-module stop.
  for (const s of ["A", "Hello World 42", "0123456789", "~ ", "9".repeat(40)]) {
    assert.equal((encodeCode128(s).modules.length - 13) % 11, 0, s);
    assert.equal(bits(encodeCode128(s)).startsWith("11"), true, `${s} must open with a bar`);
    assert.equal(bits(encodeCode128(s)).endsWith("11"), true, `${s} must close on the stop bar`);
  }
});

test("Code 128 refuses what it cannot encode instead of dropping characters", () => {
  assert.throws(() => encodeCode128("café"), /printable ASCII/);
  assert.throws(() => encodeCode128("a\nb"), /printable ASCII/);
  assert.throws(() => encodeCode128(""), /at least one character/);
});

test("the SVG is well formed and scales with module_width", () => {
  const a = linearSvg(encodeEan13("5901234123457"), LINEAR_DEFAULTS);
  const b = linearSvg(encodeEan13("5901234123457"), { ...LINEAR_DEFAULTS, moduleWidth: 4 });
  assert.match(a, /^<svg [^>]*width="234"/);
  assert.match(b, /^<svg [^>]*width="468"/);
  assert.equal(a.trim().endsWith("</svg>"), true);
  assert.equal((a.match(/<rect/g) ?? []).length > 20, true);
});

test("IBAN validation is mod 97 on the moved string, not a length check", () => {
  assert.equal(ibanChecksum("DE89370400440532013000"), 1);
  assert.equal(validateIban("de89 3704 0044 0532 0130 00"), "DE89370400440532013000");
  assert.throws(() => validateIban("DE89370400440532013001"), /check digits do not validate/);
  assert.throws(() => validateIban("DE8937040044053201300"), /is 22 characters/);
  assert.throws(() => validateIban("ZZ8937040044053201300"), /not an IBAN country code/);
  assert.throws(() => validateIban("TR330006100519786457841326", { sepaOnly: true }), /not in the SEPA scheme/);
});

test("the EPC record is the eleven fields in order, euro only, within 331 bytes", () => {
  const { text } = epcPayload({ iban: "DE89370400440532013000", name: "Acme GmbH", amount: 120.5, remittance: "INV-2026-0007" });
  const lines = text.split("\n");
  assert.deepEqual(lines.slice(0, 4), ["BCD", "002", "1", "SCT"]);
  assert.equal(lines[4], "", "BIC is optional under version 002");
  assert.equal(lines[6], "DE89370400440532013000");
  assert.equal(lines[7], "EUR120.50");
  assert.equal(lines[10], "INV-2026-0007");
  assert.throws(() => epcPayload({ iban: "DE89370400440532013000", name: "A", amount: 10, currency: "USD" }), /euro only/);
  assert.throws(() => epcPayload({ iban: "DE89370400440532013000", name: "A", amount: 0 }), /outside the EPC069-12 range/);
  assert.throws(() => epcPayload({ iban: "DE89370400440532013000", name: "A", amount: 1e12 }), /outside the EPC069-12 range/);
  assert.throws(() => epcPayload({ iban: "DE89370400440532013000", name: "A", amount: 10, reference: "RF1", remittance: "x" }), /never both/);
  assert.throws(() => epcPayload({ iban: "DE89370400440532013000", name: "A", amount: 10, remittance: "x".repeat(141) }), /allows 140/);
  assert.throws(() => epcPayload({ iban: "DE89370400440532013000", name: "A\nB", amount: 10 }), /line break/);
});

test("an amount with more than two decimals is refused rather than rounded silently", () => {
  assert.throws(() => epcPayload({ iban: "DE89370400440532013000", name: "A", amount: 10.005 }), /more than two decimals/);
  assert.equal(epcPayload({ iban: "DE89370400440532013000", name: "A", amount: 0.01 }).text.includes("EUR0.01"), true);
});

test("WiFi and vCard payloads escape the characters that would truncate them", () => {
  const w = wifiPayload({ ssid: "My;Net", password: "p4ssw0rd!", auth: "WPA" });
  assert.equal(w, "WIFI:T:WPA;S:My\\;Net;P:p4ssw0rd!;;");
  assert.throws(() => wifiPayload({ ssid: "x", auth: "WPA" }), /no password/);
  assert.throws(() => wifiPayload({ ssid: "x", password: "short", auth: "WPA" }), /8 to 63/);
  assert.throws(() => wifiPayload({ ssid: "" }), /ssid is required/);

  const v = vcardPayload({ name: "Anna Kowalska", org: "Zovo, Ltd", email: "a@b.c" });
  assert.match(v, /BEGIN:VCARD\r\nVERSION:3.0/);
  assert.match(v, /N:Kowalska;Anna;;;/);
  assert.match(v, /ORG:Zovo\\, Ltd/);
  assert.equal(v.endsWith("END:VCARD"), true);
});
