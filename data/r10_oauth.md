# R10 — MCP OAuth 2.1 in the remote worker

STATUS: complete

## What shipped
- `remote/src/index.ts`: RFC 9728 `/.well-known/oauth-protected-resource`, RFC 8414
  `/.well-known/oauth-authorization-server`, RFC 7591 `POST /oauth/register`
  (deterministic client_id from canonical-JSON SHA-256, public client), `GET
  /oauth/authorize` + `/oauth/authorize/consent` (PKCE S256, state, consent page,
  anon-token mint, KV auth code, 10-min TTL, single-use), `POST /oauth/token`
  (code + code_verifier check, returns the existing anon token so `authenticate()`
  is unchanged), and the 401 now carries `WWW-Authenticate` with
  `resource_metadata="https://mcp.zovo.one/.well-known/oauth-protected-resource"`.
- `remote/wrangler.toml`: added routes `mcp.zovo.one/.well-known/*` and
  `mcp.zovo.one/oauth*` — without these the paths fell through to the billing
  worker (only `mcp.zovo.one/mcp*` was routed to mcp-remote).
- `remote/test/oauth.test.mjs`: 8 tests (discovery docs, client_id stability across
  key order, RFC 7636 App. B vector, router contract, single-use/TTL contract).

## Fixes made while completing the failed child's partial work
- oauthClientId originally hashed raw JSON.stringify — key order changed the id.
  Now hashes canonical JSON with sorted keys (test caught it).
- Test file rewrite bugs fixed (slice/replace evaluation issues) during TDD.

## Verification
- `npm test` in remote/ (node22): 77 pass / 0 fail.
- Deployed (wrangler, version 0433cf28). Live curls:
  - /.well-known/oauth-protected-resource → 200 JSON, resource=https://mcp.zovo.one
  - /.well-known/oauth-authorization-server → 200, all endpoints + S256 only
  - POST /oauth/register → client_id 59b7f877144e59d517f5d54bf1bacb85
  - authorize → 200 consent page; consent → 302 with code+state
  - token exchange (correct verifier) → access_token anon_…, expires_in 2592000
  - access token on POST /mcp/invoice → 200 (authenticate() unchanged works)
  - code replay → invalid_grant; wrong verifier → invalid_grant "PKCE verification failed."
  - unauthenticated POST /mcp/invoice → 401 + WWW-Authenticate resource_metadata

## Notes
- deepseek provider hit lifetime spend cap ($34.00) mid-task (deleg_f8e59260) —
  completed by orchestrator directly.
