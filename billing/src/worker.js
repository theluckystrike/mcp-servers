import app from "./index.js";
import { readMonitorStatus, recordWebhookStatus, runScheduledMonitor } from "./scheduled-monitor.js";

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === "/internal/monitor-status" && request.method === "GET") {
      return readMonitorStatus(env, request);
    }
    if (path !== "/webhook" || request.method !== "POST" ||
        !/^Stripe\//.test(request.headers.get("user-agent") || "")) {
      return app.fetch(request, env, ctx);
    }
    let status = 500;
    try {
      const response = await app.fetch(request, env, ctx);
      status = response.status;
      return response;
    } finally {
      ctx.waitUntil(recordWebhookStatus(env, status).catch(() => {
        console.error(JSON.stringify({ event: "billing_webhook_status_record_failed" }));
      }));
    }
  },
  async scheduled(controller, env, ctx) {
    await runScheduledMonitor(env, controller.scheduledTime, ctx);
  },
};
export { FulfillmentState } from "./fulfillment-state.js";
