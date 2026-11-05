# Publishing the 5 MCP Actors on Apify

Status 2026-11-02: five Actors are built and tested locally. Nothing is pushed. No Apify account exists. `publish-all.sh` has been syntax-checked (`bash -n`) and never run.

| Actor directory | Store name | Price per successful tool call |
|---|---|---|
| `section-179-deduction-calculator-mcp` | Section 179 Deduction Calculator MCP Server | $0.03 |
| `car-loan-interest-deduction-calculator-mcp` | Car Loan Interest Deduction Calculator MCP | $0.03 |
| `subdomain-finder-mcp` | Subdomain Finder MCP: Certificate Transparency | $0.03 |
| `ab-test-sample-size-calculator-mcp` | A/B Test Sample Size Calculator MCP Server | $0.02 |
| `lake-level-mcp` | Lake Level MCP Server: Live US Lake Levels | $0.01 |

## Part 1. Owner steps (about 35 minutes, once)

1. Sign up at https://console.apify.com/sign-up (5 min). Pick the username with care: it becomes part of every Standby URL (`https://USERNAME--ACTOR.apify.actor/mcp`) and of the Store URL `apify.com/USERNAME/ACTOR`.
2. Create the API token (2 min): https://console.apify.com/settings/integrations (Console > Settings > API & Integrations). Create a new token named `publish-mcp`, set an expiry (for example 14 days). Copy it once.
3. Complete billing details and payment method (5 min): Console > Development > My Actors > open any Actor (after the first push) > Publishing tab > Monetization section. Later edits: Development > Insights > Payouts tab > Billing details > Edit. Source: https://docs.apify.com/platform/actors/monetize/monthly-payouts
4. Verify identity (10-15 min): Console > Development > Insights > Payouts tab > Verify identity. Use the exact legal name on the ID, or the company details if it is a company. Without KYC the earnings roll over month to month and are not paid out.
5. Payout method: PayPal or Wise (minimum $20); other methods have a $100 minimum and $10-50 wire fees. Payout invoices are issued on the 11th, paid on days 21-25.
6. In a terminal on this Mac:

```bash
export APIFY_TOKEN=apify_api_xxxxxxxx        # the token from step 2
cd /Users/mike/mcp-servers/apify
./publish-all.sh
```

Steps 3-5 are needed for money to reach the owner. Steps 1, 2 and 6 are enough to push and test the Actors privately.

## Part 2. What `publish-all.sh` does

For each Actor, in order:

1. `GET https://api.apify.com/v2/users/me` with the token to learn the username (stops on HTTP 401/403).
2. `apify login --token ...` (the CLI stores the token in the OS keyring or `~/.apify/auth.json`; undo with `apify logout`).
3. `apify push` from the Actor directory. On the first push it creates the Actor (name, title, description, Standby enabled, source files) and builds it. This is verified in the CLI 1.11.0 source: push sends name, title, description and `actorStandby.isEnabled`, and nothing else.
4. Two `PUT https://api.apify.com/v2/acts/USERNAME~ACTOR` calls with the body from `.actor/store-config.json`: (a) title, description, `seoTitle`, `seoDescription`, `categories`, `actorStandby`; (b) `pricingInfos` (pay per event: `tool-call` plus the synthetic `apify-actor-start`). The field names come from the Apify OpenAPI `UpdateActorRequest` schema. This step is UNTESTED (no account). If the API rejects a part, the script prints the HTTP error and you do that part in the Console (Part 3).
5. Smoke test of the live Standby URL with `test-local.mjs`: initialize, tools/list, one tools/call, 5 parallel calls, GET returns 405. It bills the owner's own account a few cents. A cold Standby start can take up to 2 minutes.

Switches: `DRY_RUN=1`, `ONLY=<actor-dir>`, `STORE_CONFIG=0`, `SMOKE=0`, `MAKE_PUBLIC=1` (also sets `isPublic=true`; default is to stay private so the owner can review first).

## Part 3. Console clicks (pricing and publishing)

Pricing is Console-first. The docs describe pricing as defined "in Apify Console during monetization setup" and charged from code (https://docs.apify.com/platform/actors/monetize/pay-per-event). `.actor/pay_per_event.json` in the templates is only a reference copy: the Python template says "This file is not actually used at Apify platform but serves as a reference". Use the Console path below if step 4b of the script was rejected or you prefer to check by eye. Source: https://github.com/apify/apify-docs/blob/master/sources/platform/actors/monetizing/set-up-monetization.mdx

For each of the 5 Actors:

1. https://console.apify.com > left panel **Development** > **My Actors** > click the Actor.
2. Open the **Publishing** tab.
3. **Monetization** section > **Set up monetization**. Three steps follow.
4. Step **Actor pricing**:
   - Keep `apify-actor-start` at its default $0.00005 (Apify covers the first 5 seconds of compute; recommended).
   - Delete `apify-default-dataset-item` (the normal run writes one self-check item; it must not be billed).
   - Add a custom event: name `tool-call`, title `Tool call`, description `One successful MCP tool call. Listing tools and initializing are free.`, price from the table at the top.
   - Leave **Pay per event + usage** OFF. In Standby, users pay platform usage on top anyway.
   - Set the minimal max cost per run to five calls (for example $0.15 for a $0.03 Actor).
5. Step **Primary event**: select `tool-call`.
6. Step **Review**: confirm.
7. Still on the **Publishing** tab, fill the other required sections: **Display information** (logo, description, SEO name and SEO description from `.actor/store-config.json`, categories), **Sample output** (the self-check dataset item after one run), **Output schema** (already in `.actor/output_schema.json`), **Actor permissions** (limited).
8. Run the Actor once with the **Start** button (it does the free self-check; "Build and run at least once" is a publishing precondition), accept the Store Publishing Terms when asked, then select **Publish on Store**. Source: https://github.com/apify/apify-docs/blob/master/sources/platform/actors/publishing/publish/index.mdx
9. Check: open `https://apify.com/USERNAME/ACTOR` in a private browser window, or `GET https://api.apify.com/v2/acts/USERNAME~ACTOR` and look for `isPublic: true`.

Price change rules (https://github.com/apify/apify-docs/blob/master/sources/platform/actors/monetizing/set-up-monetization.mdx): lowering a price is immediate. Raising a price or adding a paid event is a "significant change": users are notified, it takes effect after 14 days, it cannot be cancelled, and only one per Actor per month. If the Actor has no paying users the wait does not apply. Pick the starting price carefully; it is easier to lower than to raise.

## Part 4. What is code and what is Console-only

| Item | Where it is set | Evidence |
|---|---|---|
| Event charging (`Actor.charge({eventName:'tool-call'})`) | Code: `src/billing.js` | https://docs.apify.com/platform/actors/monetize/pay-per-event |
| Event names, titles, prices, primary event, pricing model | Console monetization setup, or `PUT /v2/acts/{id}` with `pricingInfos` (API field, untested here) | OpenAPI `UpdateActorRequest.pricingInfos`, `PayPerEventActorPricingInfo`, `ActorChargeEvent` in apify/apify-docs `apify-api/openapi/components/schemas` |
| `.actor/pay_per_event.json` | Reference file only, ignored by the platform | apify/actor-templates python-mcp-proxy README |
| `apify push` | Sends name, title, description, Standby flag, source. Does not send pricing, SEO, categories, visibility | apify-cli 1.11.0 `dist/_register-*.js`, `push` implementation |
| Actor title, description, Standby on, memory limits, MCP path (`webServerMcpPath`) | Code: `.actor/actor.json` | https://docs.apify.com/platform/actors/development/actor-definition/actor-json |
| SEO name and SEO description, categories, logo, publish switch | Console (Publishing tab) or `PUT /v2/acts/{id}` (`seoTitle`, `seoDescription`, `categories`, `isPublic`); not in `actor.json` | https://docs.apify.com/academy/actor-marketing-playbook/actor-basics/actor-description, OpenAPI `UpdateActorRequest` |
| Billing details, payout method, KYC | Console only, owner only | https://docs.apify.com/platform/actors/monetize/monthly-payouts |
| User spending limit per run | User sets it; code reads `ACTOR_MAX_TOTAL_CHARGE_USD` through the charging manager | pay-per-event docs, "Respect user spending limits" |

## Part 5. Price per call: suggestion and reasoning

- Apify keeps 20%. Profit is `0.8 x revenue - platform costs`; in Standby the user pays platform usage on top of the event price (https://github.com/apify/apify-docs/blob/master/sources/platform/actors/monetizing/pay_per_event.mdx). The docs are not explicit about whether that usage is then deducted from the developer; treat it as covered by the user, and watch the first payout invoice.
- Net per call: $0.024 at $0.03, $0.016 at $0.02, $0.008 at $0.01.
- Market points from the public Store API on 2026-11-02 (`curl 'https://api.apify.com/v2/store?search=...'`): MCP tool events cost $0.005 to $0.05, typical $0.01-0.03 (see `data/s1102/money.md`); a Store tool-call event at $0.01 (`ali_mora/sa-calendar-apify`); a domain exposure Actor charges $0.02 per subdomain-scan event (`s3nafps/domain-exposure-intel`); lake and reservoir Actors charge $0.01-0.02 per dataset item (`standardwork/kentucky-lake-levels`, `standardwork/lake-reservoir-levels-nationwide`); a French tax calculator charges $0.005 per calculation. Store searches for "section 179", "ab test sample size" returned 0 Actors and "car loan interest" returned no deduction calculator.
- Tax calculators ($0.03): the answer replaces a CPA lookup and rests on rules newer than model training, and the price is below any human alternative. Subdomain finder ($0.03): every call makes live CT and DNS queries. A/B calculator ($0.02): pure computation, but exact statistics that models get wrong. Lake level ($0.01): matches the going rate of the lake Actors, and the data is free elsewhere, so it competes on convenience.
- Compute is tiny: each call is a few milliseconds of CPU, and the Actor needs 256-512 MB.
- Expected income is small. Per `data/s1102/money.md`, the median MCP-named Actor had 1 successful run in 30 days. At 100 calls a month, the $0.03 Actors give about $2.40 each. Treat this as a measurement experiment, not income.

## Part 6. How each Actor runs (design choices)

- Template: the official `ts-mcp-proxy` from https://github.com/apify/actor-templates (fetched 2026-11-02): Express server on `/mcp`, one stdio MCP server wrapped by the MCP SDK client/server, `MCP_COMMAND`, `usesStandbyMode: true`, `webServerMcpPath: "/mcp"`, readiness probe header `x-apify-container-server-readiness-probe`. Changed to plain JavaScript (no TypeScript build), stateless HTTP, one shared child process, billing only for successful `tools/call`.
- Why the server is vendored in `server/` (the compiled `dist` of each satellite repo, minus the Cloudflare Worker files) and run with `node server/stdio.js`, instead of `npx -y github:theluckystrike/<repo>`: the four npm packages are not published (npm registry returns 404), `npx github:` needs git and a network clone plus a TypeScript build at start, which makes cold Standby starts slow and breakable, and a GitHub or npm outage would take the Actor down. The vendored copy is pinned, needs no runtime download and adds 44-88 KB. Cost: re-run `node gen.mjs` after the satellite changes. `MCP_COMMAND` (a JSON array in an environment variable) still overrides the command, for example `["npx","-y","lake-level-mcp"]` for the published package.
- Stateless: Apify Standby scales runs and shuts idle ones down; an in-memory MCP session id would give HTTP 400 after a restart. These tools are pure functions or live reads, so no session is needed.
- Billing: only `tools/call` that returns without `isError` is charged. initialize, tools/list and failures are free. Before a call the Actor asks the charging manager whether the run's spending limit still allows another event.
- Normal (non-Standby) run: a free self-check that starts the server, lists tools, makes one sample call and stores the report in the key-value store (`OUTPUT`) and the dataset. This gives the Store's automated tests and the "run at least once" rule a green run.
- The token never reaches the code: the platform strips the Apify token before forwarding Standby requests, and the stdio child gets only a safe environment allow-list.

## Part 7. What was tested and what was not (2026-11-02, Mac, Node 22, apify-cli 1.11.0)

Tested without an account (`test-all.sh`, results in `data/s1102/apify-work/test-results/`):
- `apify validate-schema`: input, dataset and output schemas valid for all 5.
- `apify run` in Standby mode (`APIFY_META_ORIGIN=STANDBY`): real MCP over HTTP, `initialize`, `notifications/initialized`, `tools/list`, one `tools/call`, 5 parallel calls, GET returns 405. All 5 pass, with live data for lake level (Lake Mead 1,038.85 ft) and CT (example.com).
- `apify run` normal mode: self-check exits 0 and writes OUTPUT for all 5.
- Billing path with `ACTOR_TEST_PAY_PER_EVENT=true` and `ACTOR_MAX_TOTAL_CHARGE_USD=2` on the Section 179 Actor: successful calls call `Actor.charge`, the third call is refused with the spending-limit message. Under parallel load, calls already in flight can pass the check; the platform does not bill beyond the limit.

NOT tested (needs the account or Docker):
- `apify login`, `apify push`, the cloud build, the real Standby gateway (Bearer token, cold start, idle shutdown).
- Real charging: locally Apify only logs charges (price shown as $1 in test mode). Actual billing, the 20% fee and `apify-actor-start` are untested.
- The two `PUT /v2/acts/...` calls (field names from the OpenAPI spec, not from a live call).
- The Docker image build: `apify/actor-node:22` is 141 MB compressed, over the 50 MB temp limit, so it was not pulled. The Dockerfile is the template's pattern in a single stage and runs only `npm install --omit=dev`.
- The Store page appearance, Store search ranking and the Store's automated daily test.

## Part 8. Risks and decisions for the owner

- Traffic: tiny market (money.md). The Store pages rank on Google, and the READMEs are written for that, but no ranking is promised.
- The README links the MIT source repositories on GitHub. It does not link the free hosted Workers endpoints, which would undercut the paid listing. Decide whether to mention them.
- Tool results contain a `more` link to a money site with UTM parameters. Apify Store has policies on promotional content; the link is a plain source link, but read the Store Publishing Terms and Conditions (https://docs.apify.com/legal/store-publishing-terms-and-conditions) before publishing.
- The token has full account power. Use a short expiry and revoke it after the push (Console > Settings > API & Integrations).
- The subdomain finder is passive and read-only, but "subdomain enumeration" can attract misuse reports. The README states the authorised-use rule.
- Do not set `MAKE_PUBLIC=1` until the owner has opened one Actor in the Console and looked at the Store page.
