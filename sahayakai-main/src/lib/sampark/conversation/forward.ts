/**
 * Forwarding Athithi Vani's ElevenLabs webhooks — Sampark as the one receiver for the shared agent.
 *
 * The unified SARGVISION agent ("Riya SARGVISION Unified (Sampark + Athithi Vani)") serves two
 * products, and an ElevenLabs agent posts its post-call webhooks to ONE URL (the workspace default
 * or the agent's own override). Pointed here, every Athithi Vani hotel call's result would be
 * dropped as "not ours"; pointed at Athithi, every Sampark result would be. So Sampark receives
 * everything and passes the hotel product's events on, byte for byte, to Athithi Vani's own
 * `/elevenlabs/post-call` (SAMPARK_ATHITHI_WEBHOOK_URL).
 *
 * The body and the `ElevenLabs-Signature` header are forwarded unchanged, so Athithi verifies the
 * signature itself (both services hold the same ELEVENLABS_WEBHOOK_SECRET, which is per webhook)
 * and nothing here re-signs or vouches for anything. Only events that already passed our own
 * signature check are forwarded.
 *
 * Which events are Athithi's:
 *   - `product_context` == "athithi" in the conversation's dynamic variables (every Athithi call
 *     sends it; the agent routes on it), or
 *   - the event's agent is listed in SAMPARK_ATHITHI_AGENT_IDS (a hotel-only agent sharing the
 *     workspace webhook).
 *
 * An event from the shared agent that carries NO product_context is never forwarded: it stays with
 * Sampark, which handles it exactly as before forwarding existed ("not yet linked" 503 while young,
 * ignored after). A `call_initiation_failure` often arrives without client data, and a Sampark
 * call is linked to its conversation only when the start request returns, so its own failure can
 * arrive unlinked. Forwarded, Athithi would answer 200 and Sampark would lose it for good; and
 * Athithi gains nothing, because an event without client data carries none of Athithi's signed ids
 * (it could only log it).
 *
 * How the result is reported back to ElevenLabs:
 *   2xx from Athithi            -> 200 (done)
 *   4xx from Athithi            -> 200, logged as an error: retrying cannot change the answer, and
 *                                  repeated failures can get the shared webhook auto-disabled,
 *                                  which would stop Sampark's own results too
 *   5xx / timeout / network     -> 503, so ElevenLabs retries
 */

export const ATHITHI_PRODUCT_CONTEXT = 'athithi' as const;
export const FORWARD_TIMEOUT_MS = 10_000;

export interface ForwardConfig {
    url: string;
    agentIds: ReadonlySet<string>;
}

/** The forwarding target, or null when forwarding is off. Only an https URL is accepted (http only for localhost). */
export function readForwardConfig(env: Record<string, string | undefined> = process.env): ForwardConfig | null {
    const raw = env.SAMPARK_ATHITHI_WEBHOOK_URL?.trim() ?? '';
    if (!raw) return null;
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return null;
    }
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    const agentIds = new Set(
        (env.SAMPARK_ATHITHI_AGENT_IDS ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
    );
    return { url: url.toString(), agentIds };
}

/** `product_context` from the conversation's dynamic variables, or null when the event does not carry it. */
export function productContextOf(rawBody: string): string | null {
    try {
        const json = JSON.parse(rawBody) as {
            data?: { conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> } };
        };
        const value = json?.data?.conversation_initiation_client_data?.dynamic_variables?.product_context;
        return typeof value === 'string' && value.trim() ? value.trim().toLowerCase().slice(0, 40) : null;
    } catch {
        return null;
    }
}

export interface ForwardFacts {
    productContext: string | null;
    agentId: string;
    ourAgentId: string;
}

/** Should this verified event go to Athithi Vani instead of being handled here? */
export function isAthithiEvent(facts: ForwardFacts, config: ForwardConfig): boolean {
    if (facts.productContext === ATHITHI_PRODUCT_CONTEXT) return true;
    if (facts.productContext !== null) return false;
    if (facts.agentId !== facts.ourAgentId) return config.agentIds.has(facts.agentId);
    // Unattributable on the shared agent: Sampark's to settle (see the header).
    return false;
}

export type ForwardOutcome =
    | { delivered: true; httpStatus: number }
    | { delivered: false; permanent: true; httpStatus: number }
    | { delivered: false; permanent: false; httpStatus: number | null; reason: 'timeout' | 'network' | 'server_error' };

/** POST the verified body, unchanged, with its signature header. Never throws. */
export async function forwardWebhook(
    config: ForwardConfig,
    rawBody: string,
    signatureHeader: string,
    deps: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<ForwardOutcome> {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? FORWARD_TIMEOUT_MS);
    try {
        const res = await fetchImpl(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'ElevenLabs-Signature': signatureHeader },
            body: rawBody,
            signal: controller.signal,
            redirect: 'error',
        });
        if (res.status >= 200 && res.status < 300) return { delivered: true, httpStatus: res.status };
        if (res.status >= 400 && res.status < 500) return { delivered: false, permanent: true, httpStatus: res.status };
        return { delivered: false, permanent: false, httpStatus: res.status, reason: 'server_error' };
    } catch (err) {
        const aborted = (err as { name?: string })?.name === 'AbortError';
        return { delivered: false, permanent: false, httpStatus: null, reason: aborted ? 'timeout' : 'network' };
    } finally {
        clearTimeout(timer);
    }
}

/** The response Sampark gives ElevenLabs for a forwarded event. */
export function forwardResponse(outcome: ForwardOutcome): { status: 200 | 503; body: { ok: boolean; forwarded: boolean } } {
    if (outcome.delivered) return { status: 200, body: { ok: true, forwarded: true } };
    if (outcome.permanent) return { status: 200, body: { ok: true, forwarded: false } };
    return { status: 503, body: { ok: false, forwarded: false } };
}
