export async function acceptFulfillmentJob(storage, incoming) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(incoming.sessionId || "") ||
      !/^MCPL1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(incoming.key || "") ||
      typeof incoming.product !== "string" ||
      (incoming.tenant && !/^anon_[0-9a-f]{32}$/.test(incoming.tenant))) {
    return { error: "invalid fulfillment job", status: 400 };
  }
  let job = await storage.get("job");
  if (job && (job.sessionId !== incoming.sessionId || job.key !== incoming.key ||
      job.product !== incoming.product || job.tenant !== incoming.tenant)) {
    return { error: "fulfillment identity conflict", status: 409 };
  }
  if (!job) {
    job = { ...incoming, licenseSaved: false, bound: !incoming.tenant, attempts: 0 };
    // Schedule before the durable write, so a crash after writing cannot strand it.
    await storage.setAlarm(Date.now() + 60_000);
    await storage.put("job", job);
  }
  return { job };
}

export async function processFulfillment(storage, env, job) {
  try {
    const wasComplete = job.licenseSaved && job.bound;
    if (!job.licenseSaved) {
      await env.LICENSES.put(`session:${job.sessionId}`, job.key,
        { metadata: { product: job.product } });
      job.licenseSaved = true;
      await storage.put("job", job);
    }
    if (!job.bound) {
      await env.REMOTE_DATA.put(`bind:${job.tenant}`, job.key);
      job.bound = true;
      await storage.put("job", job);
    }
    await storage.deleteAlarm();
    // Alarm recovery has no page request or webhook to log its final transition.
    if (!wasComplete) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`mcp-session-log-v1:${job.sessionId}`));
      const sessionRef = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 12);
      console.log(JSON.stringify({ event: "checkout_fulfillment", source: "durable_object",
        session_ref: sessionRef, product: job.product, fulfillment_status: "complete",
        license_saved: true, hosted_binding: job.tenant ? "saved" : "not_requested" }));
    }
    return { complete: true, licenseSaved: true, bound: job.bound };
  } catch (error) {
    job.attempts += 1;
    job.lastError = String(error?.message || error)
      .replace(/cs_(?:live|test)_[A-Za-z0-9]+/g, "[session]")
      .replace(/MCPL1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[license]")
      .replace(/anon_[0-9a-f]{32}/g, "[tenant]").slice(0, 200);
    await storage.put("job", job);
    const delay = Math.min(60_000 * 2 ** Math.min(job.attempts - 1, 6), 3_600_000);
    await storage.setAlarm(Date.now() + delay);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`mcp-session-log-v1:${job.sessionId}`));
    const sessionRef = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 12);
    console.error(JSON.stringify({ kind: "fulfillment_retry_scheduled", session_ref: sessionRef,
      attempts: job.attempts, error: job.lastError }));
    return { complete: false, licenseSaved: job.licenseSaved, bound: job.bound,
      retryScheduled: true };
  }
}
