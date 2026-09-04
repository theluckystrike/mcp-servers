/**
 * Public surface for other servers in this repo (invoice, quotes) that want a payment QR
 * code without spawning this server. Everything here is pure: no MCP, no stdio.
 */
export {
  encodeCode128, encodeEan13, encodeEan8, encodeUpcA, encodeLinear, eanCheckDigit, verifyTables,
} from "./symbology.js";
export type { Encoded, Symbology } from "./symbology.js";
export {
  wifiPayload, vcardPayload, epcPayload, validateIban, validateBic, normalizeIban, ibanChecksum,
  EPC_MIN_EUR, EPC_MAX_EUR,
} from "./payloads.js";
export type { EpcInput, VCardInput, WifiAuth } from "./payloads.js";
export { linearSvg, linearPng, checkOutPath, writeAtomic, expandPath, LINEAR_DEFAULTS, MAX_PX, MIN_PX } from "./render.js";
export type { Format, LinearOptions } from "./render.js";
export {
  dataDir, lockPath, registerPath, getCodes, setCodes, addCode, countInMonth, summarize, CorruptDataError,
} from "./store.js";
export type { CodeRecord } from "./store.js";
export { VERSION } from "./version.js";
