import { DurableObject } from "cloudflare:workers";
import { acceptFulfillmentJob, processFulfillment } from "./fulfillment-engine.js";

// One object per Stripe Session. Its stored job is the recovery source when a KV write
// fails, and its alarm retries without relying on another Stripe delivery or page load.
export class FulfillmentState extends DurableObject {
  async fetch(request) {
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
    const incoming = await request.json();
    const accepted = await acceptFulfillmentJob(this.ctx.storage, incoming);
    if (accepted.error) return Response.json({ error: accepted.error }, { status: accepted.status });
    const result = await processFulfillment(this.ctx.storage, this.env, accepted.job);
    return Response.json(result, { status: result.complete ? 200 : 503 });
  }

  async alarm() {
    const job = await this.ctx.storage.get("job");
    if (job && (!job.licenseSaved || !job.bound)) {
      await processFulfillment(this.ctx.storage, this.env, job);
    }
  }
}
