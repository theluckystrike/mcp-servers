1. `remote/src/index.ts:173` — P1 — `/mcp/token` is unauthenticated and unlimited, so callers can mint new tenants to reset hourly limits and free-tier quotas while generating unlimited KV records. Fix: rate-limit token issuance by IP/device and require a durable abuse-control identity or challenge.

2. `remote/src/index.ts:204` — P1 — rate limiting counts HTTP requests, while the MCP transport accepts JSON-RPC batches containing many tool calls, allowing one charged request to execute an arbitrary number of operations. Fix: reject batches or debit the limiter for every JSON-RPC request in the batch.

3. `remote/src/index.ts:101` — P1 — the KV read-increment-write counter is non-atomic and eventually consistent, so parallel requests can repeatedly observe the same value and exceed both limits. Fix: implement counters in a Durable Object or Cloudflare Rate Limiting binding.

4. `remote/wrangler.toml:6` — P2 — `workers_dev = true` exposes a second hostname that bypasses zone-specific WAF, bot, and rate-limit controls applied to `mcp.zovo.one`. Fix: disable `workers_dev` or apply equivalent controls inside the Worker.

5. `remote/src/shims/license.ts:15` — P1 — `withFileLock` is a no-op while each request mutates an isolated snapshot; concurrent or cross-colo requests can overwrite state, return duplicate invoice numbers, and lose paid-customer data. Fix: serialize each tenant/server through a Durable Object with transactional state updates.

6. `remote/src/index.ts:116` — P1 — every request loads, parses, copies, serializes, and rewrites the tenant’s entire document; unbounded histories and files create O(document-size) CPU and KV write amplification until writes exceed KV limits. Fix: impose tenant quotas and store records independently or in a Durable Object.

7. `remote/src/index.ts:225` — P1 — the Worker hands the request to the SDK without an application body-size limit, while schemas permit unbounded strings and arrays such as `invoice_create.items`. Fix: reject oversized bodies before parsing and add `.max()` limits to every persisted string and array.

8. `remote/src/shims/fs.ts:27` — P2 — arbitrary virtual paths and file contents are accepted without count, path, or size limits; tools such as `export_csv` can create many duplicate files or overwrite reserved database paths. Fix: normalize paths, reserve database filenames, restrict export destinations, and enforce per-file and aggregate quotas.

9. `remote/src/vendor/price-tracker/fetch.ts:43` — P1 — price tools fetch any HTTP(S) URL and follow redirects before validating the destination, enabling Worker-origin SSRF and request amplification against attacker-selected services. Fix: permit only public destinations, reject private/link-local ranges after DNS resolution, and validate every redirect hop.

10. `remote/src/vendor/price-tracker/index.ts:327` — P2 — a Pro tenant can accumulate unlimited watches and refresh all of them in one call, causing unbounded sequential network requests and exceeding Worker subrequest or execution limits. Fix: cap watches and refresh batch size, then process remaining work through bounded queues.

11. `remote/src/vendor/time-tracker/index.ts:766` — P1 — stored project, task, and note fields are concatenated into the `daily_standup` prompt as instructions, allowing one shared-license user to persist prompt injection for another user. Fix: encode stored values as explicitly untrusted structured data and keep them outside instructional prompt text.

12. `remote/src/vendor/price-tracker/index.ts:146` — P1 — attacker-controlled webpage titles are returned as tool text and persisted as watch labels, creating indirect prompt injection whenever an agent checks or lists prices. Fix: return external fields as provenance-marked structured content and prohibit treating them as executable instructions.

13. `remote/src/index.ts:68` — P2 — the remote verifier omits the canonical verifier’s nonempty `p`/`id`, required safe-integer `iat`, and positive safe-integer `exp` checks; a signed nonnumeric `exp` is accepted indefinitely. Fix: import one shared verifier or replicate its complete payload-shape validation.

14. `remote/src/index.ts:91` — P3 — license tenancy depends only on signed `payload.id`; duplicate IDs map unrelated licenses to the same KV documents and rate bucket. Fix: derive the tenant identifier from a SHA-256 hash of the complete verified license payload and enforce issuer-side uniqueness.

15. `remote/src/index.ts:190` — P2 — download records are not tenant-bound or authenticated and remain replayable for one hour, so disclosure through model transcripts, logs, or browser history exposes invoice data across tenants. Fix: require the originating tenant’s bearer token and delete records after first successful download.

16. `remote/src/index.ts:230` — P2 — any request made after files exist refreshes an anonymous token, including read-only calls, while the tenant document itself has no TTL and remains orphaned after token expiry. Fix: refresh only after a committed mutation and apply matching expiration or indexed cleanup to tenant data.

Verdict  
No unsigned token can select another tenant’s KV key, and the anonymous/download tokens have 128 bits of randomness.  
P1 issues permit quota bypass, resource abuse, SSRF, concurrent data loss, and stored-data prompt injection.