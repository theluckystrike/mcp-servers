1. `remote/src/shims/fs.ts:75` — High — Paths are raw map keys; traversal segments are not rejected, and names ending `.tmp` are silently excluded from persistence. Trigger: `sheet_load` with `name="../data.json"` or `"x.tmp"`. Fix: normalize paths, enforce `/sheets/` confinement, and reject reserved suffixes.

2. `remote/src/index.ts:102` — High — License IDs allow `:`, making tenant KV prefixes ambiguous during sweep. Trigger: valid IDs `a` and `a:spreadsheet`; sweeping `lic:a` deletes documents belonging to the latter. Fix: encode key components or restrict IDs to a delimiter-free format.

3. `remote/src/shims/fs.ts:127` — High — `appendFileSync` does not enforce `maxBytes`. Trigger: repeatedly invoke a handler that appends to one file. Fix: restore the prior value and run the same aggregate-cap check as `writeFileSync`.

4. `remote/src/shims/fs.ts:38` — Medium — Binary quota counts decoded bytes, while KV stores base64 plus JSON; download copies are also excluded at `index.ts:392`. Trigger: fill the sheet quota with XLSX values, then repeatedly export the same data. Fix: quota serialized KV bytes and outstanding download bytes, with deduplication.

5. `remote/src/shims/fs.ts:100` — Medium — Every write rescans and UTF-8-encodes every file; no file-count cap exists. Trigger: create thousands of empty or small sheets, then write another sheet. Fix: cap file count and maintain an incremental byte counter.

6. `remote/src/index.ts:356` — High — The body limit is checked only after `req.text()` buffers the full chunked body. Trigger: POST a large body without `Content-Length`. Fix: consume the stream incrementally and abort after 256 KB.

7. `remote/src/index.ts:135` — High — Request and token-mint counters use non-atomic KV read-modify-write. Trigger: send 11 concurrent token requests from one IP; each can observe the same count. Fix: serialize counters in a Durable Object or another atomic store.

8. `remote/src/index.ts:373` — High — Tenant requests and sweep are not serialized: concurrent requests lose whole-document updates, and sweep can delete other endpoint data while a tenant is active. Trigger: concurrent `sheet_load` calls, or a request racing the 35-day sweep. Fix: serialize per tenant and use a generation/lease checked before deletion.

9. `remote/src/index.ts:290` — Medium — The admin sweep route does not require POST. Trigger: `GET /mcp/admin/sweep` with the secret. Fix: reject non-POST methods before checking the secret.

10. `remote/src/index.ts:292` — Low — The sweep secret uses ordinary string equality. Trigger: repeated prefix-varying requests with timing measurements. Fix: authenticate a fixed-length HMAC using `crypto.subtle.verify`.

11. `remote/src/index.ts:48` — High — No SSRF enforcement exists at the reviewed worker boundary. Trigger: `price_check` with `http://2130706433/` or `http://[::ffff:127.0.0.1]/`. Fix: wrap outbound fetch with canonical DNS/IP validation before requests and after every redirect.

12. `remote/src/shims/fs.ts:163` — High — File descriptors are global, and `readSync(..., position=null)` always reads from offset zero. Trigger: a chunked reader loops until EOF using a null position. Fix: store descriptors and advancing offsets in request-local context and clear them on teardown.

Verdict

Do not deploy for multi-tenant use until isolation, quota, sweep, and resource-exhaustion findings are fixed. Download and anonymous tokens use 128-bit CSPRNG output.