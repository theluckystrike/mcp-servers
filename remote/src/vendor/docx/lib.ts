/**
 * The document engine, as a stable public API for other servers in this repo.
 *
 * `src/index.ts` is the MCP server (tools, licensing, storage). Everything below it --
 * the block model, the .docx writer, the .docx reader, the markdown parser, the ZIP
 * container and the XML sanitiser -- is generic and is re-exported here so a sibling
 * server (servers/resume) can build Word documents without a second copy of the code.
 *
 * Nothing in this module touches the filesystem, the network or the licence store at
 * import time. `buildDocx` is the only async entry point.
 *
 * Stability: the names below are the contract. `src/*.js` deep imports are not.
 */

/* ------------------------------------------------------------- block model */
export type { Block, Run } from "./blocks.js";
export { blockText, inlineRuns } from "./blocks.js";

/* -------------------------------------------------------- writing a .docx */
export type { BuildOptions, DocStyle } from "./build.js";
export { buildDocx, toHtml } from "./build.js";

/* ------------------------------------------------------------- markdown in */
export { MAX_LIST_LEVEL, parseMarkdown } from "./md.js";

/* -------------------------------------------------------- reading a .docx */
export type { FillResult, NumFormats } from "./wordxml.js";
export {
  assertDocx, documentXml, escapeXml, fillDocx, numberingFormats,
  placeholdersIn, readDocx, stripInvalidXml, unescapeXml,
} from "./wordxml.js";

/* --------------------------------------------------------- ZIP container */
export type { ZipEntry } from "./zip.js";
export { crc32, readZip, writeZip } from "./zip.js";

/* ------------------------------------------------- letterhead sender shape */
export type { Business } from "./store.js";

import type { Business } from "./store.js";

/**
 * The minimum `Business` a caller needs to pass `buildDocx` a letterhead. The invoice
 * fields carry defaults so a server that has no invoicing concept does not have to
 * invent a tax rate to print a document.
 */
export function letterhead(o: Partial<Business> & { name: string }): Business {
  return {
    default_currency: "EUR",
    default_tax_rate: 0,
    payment_terms_days: 14,
    invoice_prefix: "DOC",
    ...o,
  };
}
