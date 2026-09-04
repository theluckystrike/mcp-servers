/**
 * pngjs, with its synchronous inflate replaced, for the hosted image endpoint.
 *
 * jimp decodes PNG through @jimp/js-png -> pngjs -> `PNG.sync.read`, and pngjs's
 * `lib/sync-inflate.js` does not call zlib: it re-implements the sync path by
 * subclassing node's internal `zlib.Inflate` with `util.inherits` and calling
 * `zlib.Inflate.call(this, opts)`. On Workers `node:zlib`'s Inflate is a real ES class,
 * so that line throws `Class constructor Inflate cannot be invoked without 'new'` and
 * every PNG decode fails - while encoding, which uses `zlib.deflateSync` directly,
 * works fine.
 *
 * `wrangler.toml`'s [alias] points the `pngjs` specifier at this module. It is the real
 * pngjs: the package's own modules are imported by file path (so the alias does not
 * apply to them) and only `PNG.sync.read` is replaced, with the same parser-sync flow
 * and `zlib.inflateSync` in place of the internal re-implementation. Nothing else about
 * pngjs changes, and the encoder is untouched.
 */
import { Buffer } from "node:buffer";
import { inflateSync } from "node:zlib";
import pngModule from "../../../node_modules/pngjs/lib/png.js";
import SyncReader from "../../../node_modules/pngjs/lib/sync-reader.js";
import FilterSync from "../../../node_modules/pngjs/lib/filter-parse-sync.js";
import Parser from "../../../node_modules/pngjs/lib/parser.js";
import bitmapper from "../../../node_modules/pngjs/lib/bitmapper.js";
import formatNormaliser from "../../../node_modules/pngjs/lib/format-normaliser.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

/** pngjs/lib/parser-sync.js, with zlib.inflateSync for both the interlaced and the
 *  non-interlaced branch instead of pngjs's own Inflate subclass. */
function readSync(buffer: Uint8Array, options: Any = {}): Any {
  let err: Error | undefined;
  let metaData: Any;
  let gamma: number | undefined;
  const inflateDataList: Uint8Array[] = [];

  const reader = new (SyncReader as Any)(buffer);
  const parser = new (Parser as Any)(options, {
    read: reader.read.bind(reader),
    error: (e: Error) => { err = e; },
    metadata: (m: Any) => { metaData = m; },
    gamma: (g: number) => { gamma = g; },
    palette: (p: Any) => { metaData.palette = p; },
    transColor: (t: Any) => { metaData.transColor = t; },
    inflateData: (d: Uint8Array) => { inflateDataList.push(d); },
    simpleTransparency: () => { metaData.alpha = true; },
  });

  parser.start();
  reader.process();
  if (err) throw err;

  const inflatedData = inflateSync(Buffer.concat(inflateDataList as Any));
  inflateDataList.length = 0;
  if (!inflatedData || !inflatedData.length) throw new Error("bad png - invalid inflate data response");

  const unfilteredData = (FilterSync as Any).process(inflatedData, metaData);
  const bitmapData = (bitmapper as Any).dataToBitMap(unfilteredData, metaData);
  metaData.data = (formatNormaliser as Any)(bitmapData, metaData, options.skipRescale);
  metaData.gamma = gamma || 0;
  return metaData;
}

const PNG = (pngModule as Any).PNG;
PNG.sync = { read: readSync, write: PNG.sync.write };

export { PNG };
export default { PNG };
