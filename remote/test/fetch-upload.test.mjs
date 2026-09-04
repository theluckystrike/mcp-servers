/**
 * The `url` alternative every upload shim gained (Extension 10).
 *
 * D-R74 measured the ceiling on the base64 upload path: a 13 KB paste took sixteen
 * minutes and never emitted the tool call. The fix moves the bytes off the model's
 * output budget and onto the worker's fetch, which makes the worker a server-side
 * fetcher on behalf of an anonymous caller - an SSRF surface. This file is the guard's
 * test, and it is a unit test on purpose: every case below runs against the real
 * `remote/src/shims/fetch-upload.ts` with an injected fetch, so no case depends on the
 * network or on a deploy.
 *
 * Node 22 strips the TypeScript types on import, so the module under test is the module
 * that ships - not a copy, not an extract.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import {
  fetchUpload, guardFetchTarget, isOwnZone, exactlyOne, UploadFetchError,
  MAX_REDIRECTS, FETCH_TIMEOUT_MS, URL_ARG_DESCRIPTION,
} from "../src/shims/fetch-upload.ts";

/** A Response-like object good enough for the helper: headers, status, body stream. */
function res(body, { status = 200, headers = {}, chunkSize = 4096 } = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ""));
  const h = new Headers(headers);
  let i = 0;
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: h,
    body: new ReadableStream({
      pull(c) {
        if (i >= buf.length) { c.close(); return; }
        c.enqueue(new Uint8Array(buf.subarray(i, i + chunkSize)));
        i += chunkSize;
      },
    }),
    async arrayBuffer() { return buf; },
  };
}

/** A fetch that records every URL it was asked for and answers from a table. */
function fakeFetch(table) {
  const seen = [];
  const f = async (url) => {
    seen.push(url);
    const r = table[url] ?? table["*"];
    if (!r) throw new Error(`unexpected fetch of ${url}`);
    return typeof r === "function" ? r(url) : r();
  };
  f.seen = seen;
  return f;
}

const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(64, 0x20), Buffer.from("\n%%EOF\n")]);
const verifyPdf = (b) => {
  if (!b.subarray(0, 1024).toString("latin1").includes("%PDF-")) throw new Error("not a PDF");
};

async function refusal(fn) {
  try { await fn(); } catch (e) { return e; }
  assert.fail("expected a refusal, got a success");
}

// ---------------------------------------------------------------- guard cases

test("10.0.0.1 is refused, and nothing is fetched", async () => {
  const f = fakeFetch({ "*": () => res(PDF) });
  const e = await refusal(() => fetchUpload("http://10.0.0.1/x.pdf", { maxBytes: 1e6, label: "PDF", fetchImpl: f }));
  assert.ok(e instanceof UploadFetchError, e.constructor.name);
  assert.match(e.message, /not a public address/);
  assert.equal(f.seen.length, 0, "the guard runs before the first hop");
});

test("169.254.169.254 (cloud metadata) is refused", async () => {
  const f = fakeFetch({ "*": () => res(PDF) });
  const e = await refusal(() => fetchUpload("http://169.254.169.254/latest/meta-data/", { maxBytes: 1e6, label: "PDF", fetchImpl: f }));
  assert.match(e.message, /not a public address/);
  assert.equal(f.seen.length, 0);
});

test("[::1] is refused, IPv6 parsed to bytes not matched by regex", async () => {
  const f = fakeFetch({ "*": () => res(PDF) });
  const e = await refusal(() => fetchUpload("http://[::1]:8080/x.pdf", { maxBytes: 1e6, label: "PDF", fetchImpl: f }));
  assert.match(e.message, /not a public address/);
  assert.equal(f.seen.length, 0);
});

test("the worker's own zone is refused with the D-R73 reason", async () => {
  const f = fakeFetch({ "*": () => res(PDF) });
  for (const u of ["https://mcp.zovo.one/mcp/sample/product", "https://zovo.one/x.pdf", "https://www.zovo.one/x.pdf"]) {
    const e = await refusal(() => fetchUpload(u, { maxBytes: 1e6, label: "PDF", fetchImpl: f }));
    assert.match(e.message, /own zone/, u);
    assert.match(e.message, /522/, u);
  }
  assert.equal(f.seen.length, 0);
  assert.equal(isOwnZone("mcp.zovo.one"), true);
  assert.equal(isOwnZone("zovo.one"), true);
  assert.equal(isOwnZone("raw.githubusercontent.com"), false, "non-vacuity: a public host is not the own zone");
});

test("a redirect into a private range is refused on the hop, not only on the first URL", async () => {
  const f = fakeFetch({
    "https://public.example/file.pdf": () => res("", { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } }),
    "*": () => res(PDF),
  });
  const e = await refusal(() => fetchUpload("https://public.example/file.pdf", { maxBytes: 1e6, label: "PDF", fetchImpl: f }));
  assert.match(e.message, /not a public address/);
  assert.deepEqual(f.seen, ["https://public.example/file.pdf"], "the private hop was never fetched");
});

test("a redirect chain longer than 3 hops is refused", async () => {
  const f = fakeFetch({
    "*": (u) => res("", { status: 302, headers: { location: `${u}/a` } }),
  });
  const e = await refusal(() => fetchUpload("https://public.example/f", { maxBytes: 1e6, label: "PDF", fetchImpl: f }));
  assert.match(e.message, new RegExp(`redirected more than ${MAX_REDIRECTS} times`));
  assert.equal(f.seen.length, MAX_REDIRECTS + 1, "4 requests: the original and 3 hops");
});

test("non-http(s) schemes are refused", async () => {
  for (const u of ["file:///etc/passwd", "ftp://example.com/x.pdf", "data:application/pdf;base64,JVBERi0="]) {
    const e = await refusal(() => fetchUpload(u, { maxBytes: 1e6, label: "PDF", fetchImpl: fakeFetch({ "*": () => res(PDF) }) }));
    assert.match(e.message, /must be http or https/, u);
  }
});

test("localhost and the internal name patterns are refused", async () => {
  for (const h of ["localhost", "foo.localhost", "metadata.google.internal", "db.internal", "printer.local"]) {
    const e = await refusal(() => fetchUpload(`http://${h}/x`, { maxBytes: 1e6, label: "PDF", fetchImpl: fakeFetch({ "*": () => res(PDF) }) }));
    assert.match(e.message, /not a public address/, h);
  }
});

test("the inet_aton literal forms of 127.0.0.1 are all refused", async () => {
  for (const h of ["127.0.0.1", "2130706433", "0x7f000001", "0177.0.0.1", "[::ffff:127.0.0.1]", "192.168.0.1", "172.16.0.1", "100.64.0.1"]) {
    const e = await refusal(() => fetchUpload(`http://${h}/x`, { maxBytes: 1e6, label: "PDF", fetchImpl: fakeFetch({ "*": () => res(PDF) }) }));
    assert.match(e.message, /not a public address/, h);
  }
});

test("non-vacuity: a public URL is allowed by the same guard", () => {
  guardFetchTarget(new URL("https://raw.githubusercontent.com/a/b/c.pdf"));
  guardFetchTarget(new URL("http://93.184.216.34/x"));
});

// ---------------------------------------------------------------- size cap

test("a declared content-length over the cap is refused before the body is read", async () => {
  const f = fakeFetch({ "*": () => res(PDF, { headers: { "content-length": "5000000" } }) });
  const e = await refusal(() => fetchUpload("https://public.example/big.pdf", { maxBytes: 1024 * 1024, label: "PDF", fetchImpl: f }));
  assert.match(e.message, /hosted cap is 1 MB per PDF/);
  assert.match(e.message, /Nothing was fetched or stored/);
});

test("a lying content-length is caught on the stream, and nothing is truncated into storage", async () => {
  const big = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(300_000, 0x41)]);
  const f = fakeFetch({ "*": () => res(big, { headers: { "content-length": "10" }, chunkSize: 16384 }) });
  const e = await refusal(() => fetchUpload("https://public.example/big.pdf", { maxBytes: 100_000, label: "PDF", fetchImpl: f }));
  assert.match(e.message, /over the 98 KB cap per PDF/);
  assert.match(e.message, /reading stopped at/);
});

test("a body with no content-length at all is still capped on the stream", async () => {
  const big = Buffer.alloc(300_000, 0x41);
  const f = fakeFetch({ "*": () => res(big, { chunkSize: 8192 }) });
  const e = await refusal(() => fetchUpload("https://public.example/big.bin", { maxBytes: 65_536, label: "file", fetchImpl: f }));
  assert.match(e.message, /over the 64 KB cap per file/);
});

// ---------------------------------------------------------------- magic bytes

test("wrong magic bytes are refused after the fetch and before anything is staged", async () => {
  const f = fakeFetch({ "*": () => res("<!doctype html><title>not a pdf</title>") });
  const e = await refusal(() => fetchUpload("https://public.example/page.html", { maxBytes: 1e6, label: "PDF", verify: verifyPdf, fetchImpl: f }));
  assert.match(e.message, /not a PDF/);
});

test("an empty body is refused", async () => {
  const f = fakeFetch({ "*": () => res("") });
  const e = await refusal(() => fetchUpload("https://public.example/empty.pdf", { maxBytes: 1e6, label: "PDF", verify: verifyPdf, fetchImpl: f }));
  assert.match(e.message, /zero bytes/);
});

test("a non-200 is reported as a fetch failure, not as a bad file", async () => {
  const f = fakeFetch({ "*": () => res("nope", { status: 404 }) });
  const e = await refusal(() => fetchUpload("https://public.example/missing.pdf", { maxBytes: 1e6, label: "PDF", verify: verifyPdf, fetchImpl: f }));
  assert.match(e.message, /HTTP 404/);
});

// ---------------------------------------------------------------- happy path

test("a public PDF is fetched whole, and the host and byte count come back", async () => {
  const f = fakeFetch({ "*": () => res(PDF, { headers: { "content-type": "application/pdf" }, chunkSize: 7 }) });
  const got = await fetchUpload("https://raw.githubusercontent.com/o/r/main/f.pdf", { maxBytes: 1e6, label: "PDF", verify: verifyPdf, fetchImpl: f });
  assert.equal(got.bytes, PDF.length);
  assert.ok(got.buf.equals(PDF), "the bytes are whole and unmodified across chunk boundaries");
  assert.equal(got.host, "raw.githubusercontent.com");
  assert.equal(got.redirects, 0);
  assert.equal(got.contentType, "application/pdf");
});

test("up to 3 redirects between public hosts are followed and the final host is reported", async () => {
  const f = fakeFetch({
    "https://a.example/f": () => res("", { status: 301, headers: { location: "https://b.example/f" } }),
    "https://b.example/f": () => res("", { status: 302, headers: { location: "https://c.example/f" } }),
    "https://c.example/f": () => res(PDF),
  });
  const got = await fetchUpload("https://a.example/f", { maxBytes: 1e6, label: "PDF", verify: verifyPdf, fetchImpl: f });
  assert.equal(got.redirects, 2);
  assert.equal(got.host, "c.example");
  assert.equal(got.bytes, PDF.length);
});

test("a hung server is abandoned on the timeout", async () => {
  const f = async (_u, init) => new Promise((_res, rej) => {
    init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
  const e = await refusal(() => fetchUpload("https://slow.example/f.pdf", { maxBytes: 1e6, label: "PDF", fetchImpl: f, timeoutMs: 60 }));
  assert.match(e.message, /did not answer within/);
  assert.equal(FETCH_TIMEOUT_MS, 10_000, "the shipped timeout is 10 s");
});

// ---------------------------------------------------------------- exactly one

test("exactlyOne demands exactly one source", () => {
  assert.equal(exactlyOne({ content: "a", content_base64: undefined, url: undefined }), "content");
  assert.equal(exactlyOne({ content: undefined, content_base64: undefined, url: "https://x/y" }), "url");
  assert.throws(() => exactlyOne({ content: undefined, content_base64: undefined, url: undefined }), /give exactly one of content, content_base64, url/);
  assert.throws(() => exactlyOne({ content: "a", content_base64: undefined, url: "https://x/y" }), /not 2 \(content and url were both given\)/);
});

test("every url argument carries the same recommendation sentence", () => {
  assert.equal(URL_ARG_DESCRIPTION, "url: fetch a public file instead of pasting base64 (recommended above about 10 KB)");
});
