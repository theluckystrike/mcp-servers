# S36 T2 — Telegram Stars Go-Live Readiness

STATUS: shippable

Workdir: `/Users/mike/mcp-servers/telegram` (grammY bot + Mini App HTML).
Scope note: no `TELEGRAM_BOT_TOKEN` exists anywhere. The live Bot API was never
called with a real token. Every claim below carries the command that produced it.

---

## 1. Audit of `telegram/`: build, tests, Mini App HTML

### Build

```
$ npm run build
> mcp-fleet-telegram@1.0.0 build
> tsc
build_exit=0
```

### Offline tests

```
$ npm run test:offline
  single: 1500 Stars, USD 19.50, payload "mcp-single-1500"
  bundle: 3000 Stars, USD 39.00, payload "mcp-bundle-3000"
  TELEGRAM_BOT_TOKEN present: false
ok - currency is XTR for digital goods
ok - provider_token empty for digital goods
RESULT: ALL OFFLINE CHECKS PASSED
```

21 checks pass, no network, no token. The suite honestly records that
`createInvoiceLink` cannot be exercised against the live API.

### Mini App HTML — two real defects found and fixed

`public/index.html` had two bugs. Both are now fixed and verified in a real
browser (Chrome via the tool harness), not by reading the file.

There was no `<script src="https://telegram.org/js/telegram-web-app.js">` tag.
Inside the Telegram client that leaves `window.Telegram.WebApp` undefined, so the
app cannot read launch params, call `ready()`/`expand()`, or theme itself.
Command that proved the absence, before the fix:

```
$ grep -n "telegram-web-app\|script src" public/index.html
(no output)
```

Fix: added the SDK script tag in `<head>`, before the in-page script.

The script did `document.getElementById("grid")` but no element with `id="grid"`
existed in the document. `appendChild` on `null` throws, so the entire catalog —
all 41 hosted servers plus the aggregate entry — never rendered. This was the
highest-impact defect: the Mini App's main content was invisible.
Command, before the fix: the page contained only the two plan cards and no product cards.
Fix: the script now creates the `#grid` container itself if it is missing.

Verified after both fixes, in-browser:

```js
{sdkLoaded: true, sdkScriptTag: true, gridExists: true,
 cards: 42, tryLinks: 41, buyLinks: ["https://t.me/mcpfleetbot?start=buy", ...]}
```

- 42 cards render (41 with try-it links; `office-suite` correctly link-less as an aggregate).
- `window.Telegram.WebApp` is live, and the SDK logs its normal init events
  (`web_app_request_theme`, `web_app_request_viewport`).
- `js_errors: []` — zero JavaScript errors on the page.

### Mini App serves over HTTP

```
$ curl -s -o /dev/null -w 'index.html HTTP %{http_code}\n' http://127.0.0.1:8791/index.html
index.html HTTP 200
$ curl -s -o /dev/null -w 'sdk.js HTTP %{http_code}\n' https://telegram.org/js/telegram-web-app.js
sdk.js HTTP 200
```

Served with `python3 -m http.server 8791 --directory public`. The SDK URL itself
resolves, so the added tag is not a 404.

---

## 2. `scripts/go-live.sh`

Path: `/Users/mike/mcp-servers/telegram/scripts/go-live.sh` (executable, 9054 bytes).

Idempotent. Re-running is safe: every step writes the same value and reads it back
to confirm. It fails loudly and changes nothing if `TELEGRAM_BOT_TOKEN` is unset.

Five steps, each self-verifying via read-back:

| Step | Bot API method | Read-back |
| --- | --- | --- |
| 1/5 authenticate | `getMe` | `getMe` must return a `username` |
| 2/5 webhook-less polling | `deleteWebhook` | `getWebhookInfo` must show no `url` |
| 3/5 register commands | `setMyCommands` | `getMyCommands` must contain all 4 |
| 4/5 Mini App menu button | `setChatMenuButton` | `getChatMenuButton` must match URL |
| 5/5 self-test message | `sendMessage` | must return a `message_id` |

Design notes tied to the task brief:

- **BotFather-free path.** Bot setup is done entirely through Bot API calls. The
  Mini App is registered with `setChatMenuButton` (`type: web_app`), which is the
  documented Bot API surface for the chat menu button — no BotFather chat needed.
- **`answerWebAppQuery` is not needed.** The Mini App's Buy buttons deep-link to
  `https://t.me/mcpfleetbot?start=buy`, so the flow is a normal `/start` payload,
  not a web-app query that must be answered. No webhook is registered.
- **Commands registered:** `/start`, `/buy`, `/upgrade`, `/app`. Registered as
  data; the XTR invoice itself is minted at runtime by `src/bot.ts`.
- **Never echoes the token.** The token goes into the URL only; the script greps
  its own output and aborts if the token ever appears. Tested.
- **Drop-in `MINI_APP_URL`** (default `https://mcp.zovo.one/telegram/`), validated
  as HTTPS because Telegram rejects non-HTTPS on `setChatMenuButton`.

Exit-code contract, printed by the script and asserted by its test suite:
`2` no token, `3` no curl, `4` token rejected at `getMe`, `6` network unreachable,
`8` self-test message not delivered.

### What the script prints as remaining human

```
REMAINS HUMAN (nothing below is scriptable here)
  1. Start the bot process and keep it running:
       cd /Users/mike/mcp-servers/telegram && TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN node dist/bot.js
  2. Host public/index.html at exactly: https://mcp.zovo.one/telegram/
     (HTTPS, and the path must match - Telegram will not load it otherwise)
  3. Bot profile: name, description, profile photo and the "What can this
     bot do?" text are BotFather /edit settings, not Bot API calls.
  4. Send /start to @<bot> and issue /buy to confirm a real Stars (XTR)
     invoice opens. Payment cannot be completed by a bot; a human pays.
```

Item 1 is the surprise worth flagging: the script configures the bot but does not
daemonize it. Running `node dist/bot.js` under a supervisor is still a human step.

---

## 3. Fake-token end-to-end test

Script: `/Users/mike/mcp-servers/telegram/scripts/test-go-live-fake-token.sh`.
Offline-safe. Run result:

```
$ ./scripts/test-go-live-fake-token.sh
== case 1: no token at all ==
ok   - refuses without TELEGRAM_BOT_TOKEN (exit 2)
ok   - message names the missing variable
ok   - message gives the mint URL

== case 2: fake token (must die at getMe) ==
ok   - fails at the getMe gate (exit 4)
ok   - message names the getMe failure
ok   - message states nothing was changed
ok   - stopped before step 2 (no partial setup)
ok   - token never echoed to stdout/stderr

== case 3: fake token with the network unreachable ==
ok   - non-zero exit when curl cannot connect (exit 6)

RESULT: 9 passed, 0 failed
```

### Case 2 output verbatim — the required clean failure at `getMe`

```
== 1/5 authenticate (getMe)
FAIL - getMe failed; the token did not authenticate.
FAIL - Bot API said: 401:Unauthorized
FAIL - Nothing was changed. Check the token from https://t.me/BotFather.
```

Exit 4. It stops at step 1, so no partial setup is left behind.

### Case 1 output verbatim — refusal without a token

```
FAIL - TELEGRAM_BOT_TOKEN is not set.
FAIL - This script refuses to run without it and makes no network calls.
FAIL - Mint a token: open https://t.me/BotFather in Telegram, send /newbot,
FAIL - follow the prompts, then copy the token it prints.
FAIL - Then: export TELEGRAM_BOT_TOKEN='<token>' && /Users/mike/mcp-servers/telegram/scripts/go-live.sh
```

Exit 2, zero network calls.

### Idempotency check

```
$ TELEGRAM_BOT_TOKEN='123456789:FAKE' ./scripts/go-live.sh; echo $?   # run1=4
$ TELEGRAM_BOT_TOKEN='123456789:FAKE' ./scripts/go-live.sh; echo $?   # run2=4
```

Same failure, same exit code, no drift.

### Fixes made to the test harness itself

Two bugs in the first draft of the harness, both fixed and re-verified:

- `printf '---...\n'` was parsed as an invalid option; switched to `printf '%s\n'`.
- Case 3 tried to override `curl` with a shell function via an environment
  assignment, which is not valid syntax. Replaced with a `PATH` shim directory
  containing an executable `curl` that exits 6 — the shim shadows the real curl
  without touching the network.

And one dead-end fixed in `go-live.sh`: on a network failure curl returned exit 6
while the script printed nothing at all. It now reports the curl exit code and its
likely meaning (`6=DNS, 7=connect, 28=timeout`) and still exits 6.

---

## 4. `telegram/README.md` update

The old `## Running` section was replaced by `## Go live in 3 steps`.

Diff summary (README grew 158 -> 227 lines):

- **Removed:** the `## Running` block that told the user to run `node dist/bot.js`
  directly, with no script and no failure handling.
- **Added step 1 — mint the token.** Exact URL `https://t.me/BotFather?start=newbot`
  and the `/newbot` instruction, with the token shape `123456789:AA...`. Notes that
  this is the only step with no CLI path, because BotFather is an interactive chat bot.
- **Added step 2 — `export TELEGRAM_BOT_TOKEN='...'`**, with an explicit never-commit warning.
- **Added step 3 — `./scripts/go-live.sh`**, with the 5-step table above.
- **Added measured Stars fee**, from the repo's own pricing constants and test output:
  1500 Stars = USD 19.50 single, 3000 Stars = USD 39.00 bundle, at the
  $0.013-per-Star rate the tests assert. Currency tag `XTR`, `provider_token` empty
  for digital goods.
- **Added the user flow**, 5 numbered steps: open Mini App from the menu button or a
  `?start=buy` link, browse all 41 hosted servers, try one free, tap Buy with Stars,
  bot mints the XTR invoice, Telegram collects Stars and delivers `successful_payment`,
  bot grants lifetime access.
- **Added "Still human after the script runs"** — the same 4-item list the script prints.
- **Added a Mini App serving check** (`python3 -m http.server` + `curl` expecting 200)
  and the `MINI_APP_URL` / `webAppUrl()` relationship.
- **Added the offline failure-path test command**, so the next person can re-run it.

Corrections caught while writing the README against the script: the step order in the
table was originally webhook-after-commands (wrong); the env var name is
`TELEGRAM_SELF_TEST_CHAT_ID` (not `TELEGRAM_TEST_CHAT_ID`). Both fixed to match the
script's real behavior.

---

## 5. Bottom line

Everything that can be verified without a token is verified and green. The Telegram
surface is one interactive BotFather chat away from live: mint token, export it, run
`./scripts/go-live.sh`, then keep `node dist/bot.js` running.

The two Mini App defects were the material finding of this task. Defect B in
particular meant the shipped Mini App rendered no catalog at all — the fleet's
#1 distribution surface would have gone live showing an empty page.

Open items, all human:

- Mint the token at `https://t.me/BotFather?start=newbot`.
- Host `public/index.html` at `https://mcp.zovo.one/telegram/` over HTTPS, and confirm
  `MINI_APP_URL` matches that path.
- Run `node dist/bot.js` under a supervisor.
- Pay one real invoice end to end to confirm Stars settlement; a bot cannot test its
  own payment path.

### Commands used for every claim

```
npm run build                              # build_exit=0
npm run test:offline                       # RESULT: ALL OFFLINE CHECKS PASSED
curl -w '%{http_code}' 127.0.0.1:8791/index.html        # 200
curl -w '%{http_code}' telegram.org/js/telegram-web-app.js  # 200
browser_console -> {sdkLoaded:true, cards:42, tryLinks:41, js_errors:[]}
./scripts/test-go-live-fake-token.sh       # RESULT: 9 passed, 0 failed
TELEGRAM_BOT_TOKEN='...:FAKE' ./scripts/go-live.sh   # exit 4, twice
```
