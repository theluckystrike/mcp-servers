/**
 * The text that goes INSIDE a QR code when the code is not just a URL.
 *
 * Each of these is a wire format a scanner app parses: get a character wrong and the phone
 * shows a string of gibberish instead of a "Join network" or "Pay EUR 120" prompt, and
 * there is no error message anywhere. So each builder escapes what the format says to
 * escape and validates what the format says to validate, before anything is drawn.
 */

/* ------------------------------------------------------------------- WiFi */

export type WifiAuth = "WPA" | "WEP" | "nopass";

/**
 * MECARD-style WIFI:...; string, the format both iOS and Android camera apps read.
 * Backslash, semicolon, comma, colon and quote are escaped with a backslash; an SSID
 * containing a semicolon is otherwise truncated at that character by the scanner.
 */
export function wifiPayload(o: { ssid: string; password?: string; auth?: WifiAuth; hidden?: boolean }): string {
  const ssid = String(o.ssid ?? "").trim();
  if (!ssid) throw new Error("ssid is required: a WiFi QR code with no network name joins nothing.");
  if (Buffer.byteLength(ssid, "utf8") > 32) throw new Error(`ssid is ${Buffer.byteLength(ssid, "utf8")} bytes; an 802.11 SSID is at most 32.`);
  const auth: WifiAuth = o.auth ?? (o.password ? "WPA" : "nopass");
  if (auth !== "nopass" && !o.password) {
    throw new Error(`auth is "${auth}" but no password was given. Pass password, or auth: "nopass" for an open network.`);
  }
  if (auth === "nopass" && o.password) {
    throw new Error(`auth is "nopass" but a password was given. Pass auth: "WPA" (or "WEP"), or drop the password.`);
  }
  if (auth === "WPA" && o.password && (o.password.length < 8 || o.password.length > 63)) {
    throw new Error(`a WPA passphrase is 8 to 63 characters; this one is ${o.password.length}. The code would scan and the join would fail.`);
  }
  const esc = (s: string) => s.replace(/([\;,:"])/g, "\\$1");
  const parts = [`WIFI:T:${auth}`, `S:${esc(ssid)}`];
  if (auth !== "nopass") parts.push(`P:${esc(o.password as string)}`);
  if (o.hidden) parts.push("H:true");
  return parts.join(";") + ";;";
}

/* ------------------------------------------------------------------ vCard */

export interface VCardInput {
  name: string;
  org?: string;
  title?: string;
  phone?: string;
  email?: string;
  url?: string;
  address?: string;
  note?: string;
}

/**
 * vCard 3.0, which is what phone contact apps import from a QR code. Version 4.0 is newer
 * and is read by fewer of them, and a contact card that does not import is worthless.
 * RFC 6350 escaping: backslash, comma, semicolon, newline.
 */
export function vcardPayload(o: VCardInput): string {
  const name = String(o.name ?? "").trim();
  if (!name) throw new Error("name is required for a vCard.");
  const esc = (s: string) => String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  const parts = name.split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : name;
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${esc(last)};${esc(first)};;;`, `FN:${esc(name)}`];
  if (o.org) lines.push(`ORG:${esc(o.org)}`);
  if (o.title) lines.push(`TITLE:${esc(o.title)}`);
  if (o.phone) lines.push(`TEL;TYPE=CELL:${esc(o.phone)}`);
  if (o.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(o.email)}`);
  if (o.url) lines.push(`URL:${esc(o.url)}`);
  // The ADR value is itself semicolon-delimited, so a free-text address goes in the
  // street field with its own semicolons escaped.
  if (o.address) lines.push(`ADR;TYPE=WORK:;;${esc(o.address)};;;;`);
  if (o.note) lines.push(`NOTE:${esc(o.note)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

/* -------------------------------------------------------------- SEPA / EPC */

/** IBAN length by country, ISO 13616 registry. An IBAN of the wrong length is not an IBAN. */
const IBAN_LENGTH: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29, BY: 28,
  CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18,
  FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22,
  IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20,
  LU: 20, LV: 21, LY: 25, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18,
  NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24, SC: 31, SE: 24,
  SI: 19, SK: 24, SM: 27, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
};

/** SEPA scheme countries, the only ones an EPC credit transfer can be addressed to. */
const SEPA = new Set([
  "AD", "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB", "GI",
  "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT", "LU", "LV", "MC", "MT", "NL", "NO", "PL",
  "PT", "RO", "SE", "SI", "SK", "SM", "VA",
]);

export function normalizeIban(iban: string): string {
  return String(iban ?? "").replace(/\s+/g, "").toUpperCase();
}

/**
 * ISO 7064 mod 97-10. The check is done digit by digit rather than with BigInt because a
 * 34-character IBAN becomes a 70-digit number and Number() would round it into a
 * different, still-plausible value.
 */
export function ibanChecksum(iban: string): number {
  const s = normalizeIban(iban);
  const moved = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = ch >= "0" && ch <= "9" ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem;
}

export function validateIban(iban: string, opts: { sepaOnly?: boolean } = {}): string {
  const s = normalizeIban(iban);
  if (!s) throw new Error("iban is required.");
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(s)) {
    throw new Error(`"${iban}" is not an IBAN: it must be two country letters, two check digits, then letters and digits only.`);
  }
  const cc = s.slice(0, 2);
  const want = IBAN_LENGTH[cc];
  if (want === undefined) throw new Error(`"${cc}" is not an IBAN country code in the ISO 13616 registry.`);
  if (s.length !== want) throw new Error(`an ${cc} IBAN is ${want} characters; "${s}" is ${s.length}.`);
  if (ibanChecksum(s) !== 1) {
    throw new Error(
      `the IBAN check digits do not validate (ISO 7064 mod 97 gives ${ibanChecksum(s)}, not 1), so "${s}" is a typo or an invented number. ` +
      `A payment QR code carrying it would send money to nobody, or to somebody else. Nothing was written.`,
    );
  }
  if (opts.sepaOnly && !SEPA.has(cc)) {
    throw new Error(`${cc} is not in the SEPA scheme, so an EPC (SEPA credit transfer) QR code cannot address it.`);
  }
  return s;
}

export function validateBic(bic: string): string {
  const s = String(bic ?? "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(s)) {
    throw new Error(`"${bic}" is not a BIC: 8 or 11 characters, four bank letters, two country letters, then location and branch.`);
  }
  return s;
}

export const EPC_MIN_EUR = 0.01;
export const EPC_MAX_EUR = 999999999.99;

export interface EpcInput {
  iban: string;
  name: string;
  amount?: number;
  currency?: string;
  bic?: string;
  remittance?: string;
  reference?: string;
  purpose?: string;
}

/**
 * EPC069-12 ("EPC QR", "GiroCode"), version 002, UTF-8, SEPA credit transfer.
 *
 * Version 002 is used rather than 001 because 001 makes the BIC mandatory, and no euro-area
 * bank has needed a BIC for a SEPA transfer since February 2016. The whole payload is capped
 * at 331 bytes by the specification: banking apps reject a longer one outright, so the cap
 * is checked here in bytes, not characters, before a code is drawn.
 */
export function epcPayload(o: EpcInput): { text: string; iban: string; amount?: number } {
  const currency = String(o.currency ?? "EUR").toUpperCase();
  if (currency !== "EUR") {
    throw new Error(
      `an EPC payment QR code is euro only (it encodes a SEPA credit transfer), and currency was "${currency}". ` +
      `No code was created. For any other currency, put the payment details in a plain qr_create text code instead.`,
    );
  }
  const iban = validateIban(o.iban, { sepaOnly: true });
  const name = String(o.name ?? "").trim();
  if (!name) throw new Error("name is required: the EPC record carries the beneficiary's name and a bank will not accept an empty one.");
  if (name.length > 70) throw new Error(`the beneficiary name is ${name.length} characters; EPC069-12 allows 70.`);
  const bic = o.bic ? validateBic(o.bic) : "";

  let amountField = "";
  if (o.amount !== undefined && o.amount !== null) {
    const a = Number(o.amount);
    if (!Number.isFinite(a)) throw new Error(`amount ${JSON.stringify(o.amount)} is not a number.`);
    if (a < EPC_MIN_EUR || a > EPC_MAX_EUR) {
      throw new Error(
        `amount ${a} is outside the EPC069-12 range ${EPC_MIN_EUR} to ${EPC_MAX_EUR} EUR. ` +
        (a < EPC_MIN_EUR
          ? `A zero or negative amount is not a payment request; leave amount out and the payer types it in.`
          : `Nothing was written.`),
      );
    }
    const cents = Math.round(a * 100);
    if (Math.abs(a * 100 - cents) > 1e-6) {
      throw new Error(`amount ${a} has more than two decimals; euro amounts carry cents, so pass ${(cents / 100).toFixed(2)} if that is what you meant.`);
    }
    amountField = `EUR${(cents / 100).toFixed(2)}`;
  }

  const reference = String(o.reference ?? "").trim();
  const remittance = String(o.remittance ?? "").trim();
  if (reference && remittance) {
    throw new Error(
      `EPC069-12 carries EITHER a structured creditor reference (reference) OR free remittance text (remittance), never both. ` +
      `Pass one of them.`,
    );
  }
  if (reference.length > 35) throw new Error(`the structured reference is ${reference.length} characters; EPC069-12 allows 35.`);
  if (remittance.length > 140) throw new Error(`the remittance text is ${remittance.length} characters; EPC069-12 allows 140.`);
  const purpose = String(o.purpose ?? "").trim().toUpperCase();
  if (purpose && !/^[A-Z]{4}$/.test(purpose)) throw new Error(`purpose is a four-letter ISO 20022 purpose code, for example GDDS; "${o.purpose}" is not.`);

  // A newline inside any field would end the record early and shift every field after it.
  for (const [k, v] of Object.entries({ name, remittance, reference })) {
    if (/[\r\n]/.test(v)) throw new Error(`${k} contains a line break, which would corrupt the EPC record. Remove it.`);
  }

  const lines = ["BCD", "002", "1", "SCT", bic, name, iban, amountField, purpose, reference, remittance];
  // Trailing empty fields are dropped; the specification allows the record to stop early.
  while (lines.length > 7 && lines[lines.length - 1] === "") lines.pop();
  const text = lines.join("\n");
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > 331) {
    throw new Error(`the EPC record is ${bytes} bytes; the specification caps it at 331 and banking apps refuse a longer one. Shorten the remittance text or the name.`);
  }
  return { text, iban, amount: o.amount === undefined || o.amount === null ? undefined : Number(o.amount) };
}
