# Independent checkout watchdog

`mcp-billing-external-watchdog` checks the public, status-only
`/health/checkout-monitor` endpoint every ten minutes on a separate Cloudflare
Worker. It sends a high-priority ntfy alert when the endpoint is unhealthy,
repeats at most hourly while the problem persists, and sends a recovery message.
Its dedicated KV namespace stores the last alert state. The ntfy topic is a
Worker secret and does not appear in source, config, logs, or alert contents.

The deployed Cron expression is `3-53/10 * * * *` in UTC. The `STATE` KV binding
points at the dedicated `mcp-billing-watchdog-state` namespace. Keep its ID in
`wrangler.jsonc` synchronized with the actual namespace before deployment.

To rotate the notification channel, generate a new random topic, place it in a
protected JSON file as `{"NTFY_TOPIC":"..."}`, then deploy with
`wrangler deploy --config billing/watchdog/wrangler.jsonc --secrets-file <file>`.
Never commit the topic or pass it on a command line. The operator must subscribe
to the new topic in the [ntfy web app](https://ntfy.sh/app) or phone app and
confirm that a test message reaches their device.

Run `node --test billing/watchdog/test/worker.test.mjs` and
`wrangler deploy --dry-run --config billing/watchdog/wrangler.jsonc` before a
release. The production Worker has no public HTTP route; the Cron trigger is
its only entry point.

This is independent of the billing Worker's code and KV namespace, but both
Workers still rely on Cloudflare Cron. ntfy is a third-party push channel with
no guaranteed delivery, and an unclaimed topic can be read or written by
anyone who learns its long random name. Alerts contain only status and the
public health URL. A person must subscribe before push delivery is proved.
