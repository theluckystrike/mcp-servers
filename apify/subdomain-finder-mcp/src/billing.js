/**
 * Pay-per-event billing. One custom event, `tool-call`, charged after each successful tools/call.
 * initialize, tools/list, prompts, resources and pings are free so that clients and
 * Store reviewers can always discover the tools.
 * The event price itself is NOT defined here: it is set in Apify Console (see PUBLISH.md)
 * and .actor/pay_per_event.json is only a reference copy.
 */
import { Actor, log } from 'apify';

export const TOOL_EVENT = 'tool-call';

export function remainingToolCalls() {
    try {
        return Actor.getChargingManager().calculateMaxEventChargeCountWithinLimit(TOOL_EVENT);
    } catch {
        return Number.POSITIVE_INFINITY; // no pricing info (local run): do not block
    }
}

export async function chargeToolCall() {
    try {
        const result = await Actor.charge({ eventName: TOOL_EVENT });
        log.info('Charged tool-call', { chargedCount: result?.chargedCount });
        return result;
    } catch (error) {
        // The result is already computed; do not turn a billing hiccup into a failed tool call.
        log.error('Charging tool-call failed', { error: String(error) });
        return undefined;
    }
}
