# The whole product, walked as a stranger would (2026-09-08)

Run by the orchestrator with no repo access, no credentials and no local build: only the
public release page and the public hosted endpoint, exactly what a person who has just read
a directory listing has.

| Step | Result |
|---|---|
| Download `invoice.mcpb` from the public v0.21.0 release URL | HTTP 200, 7,023,082 bytes, a real zip |
| Unzip and boot it the way Claude Desktop does | `initialize` returns `{"name":"mcp-invoice","version":"0.21.0"}` |
| List tools | 13 |
| Set a business profile, then create invoices until the free tier stops | 4 calls succeed, the fifth is refused |
| The refusal | "You have already created 3 invoices in 2026-09. The free tier allows 3 invoices per calendar month." It then names the Pro price, the lifetime terms and the exact next command, and says keys verify offline with nothing sent anywhere |
| The upgrade link it prints | Carries `?src=invoice.unlimited_invoices`, so an in-product click is now attributable rather than filed as unknown |
| Following that link with a browser user agent | HTTP 303 to `https://checkout.stripe.com/c/pay/cs_live_...` |
| The zero-install path, `GET /mcp/connect` | HTTP 200, a page carrying 36 ready-to-paste URLs, one per hosted server |
| `POST` to the invoice ready URL, no headers, no key | HTTP 200, 13 tools |

Nothing in that chain is broken. The free tier does real work, the boundary is stated
plainly at the moment it binds, the upgrade is one click, the payment page is live, and
there is a path that needs no install at all.

That matters for one reason. The measured problem is that 22 people reached this project in
fourteen days and none of them bought anything. It would be easy to read that as a broken
funnel. It is not a broken funnel. Every step above works today, for a stranger, with no
account. What is missing is people, and that is where the effort belongs.

Two caveats worth keeping honest. The npm install command still returns 404 for everyone
and will until a person signs in, though every page that prints it now says so. And this
walk did not complete a payment, because that would charge a real card, so the step after
Stripe's page is still unverified end to end.
