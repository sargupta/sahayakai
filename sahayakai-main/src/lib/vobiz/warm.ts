/**
 * Wake the telephony sidecar before the parent picks up.
 *
 * The sidecar scales to zero to keep idle cost near nothing, and a cold start
 * takes about 10s (measured 2026-10-05: 10.7s to the first 200). If the parent
 * answers while the sidecar is still cold, Vobiz opens the media socket into
 * nothing and the parent hears silence, so most of them hang up.
 *
 * Keeping one instance warm costs about Rs 300/day at the sidecar's
 * instance-based rate. The ring is free: a phone rings for 5-15s before anyone
 * answers, so pinging the sidecar the moment we start dialling hides most or
 * all of the cold start behind the ring.
 *
 * Fire-and-forget by design. The ping must never delay or fail the call: the
 * HTTP request alone is enough to make Cloud Run start an instance, whether or
 * not we wait for the reply.
 */
export const WARM_PATH = '/readyz';
const WARM_TIMEOUT_MS = 15_000;

export function telephonyBaseUrl(): string | null {
    const base = process.env.VOBIZ_STREAM_BASE_URL || process.env.NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL;
    return base ? base.replace(/\/+$/, '') : null;
}

export function warmTelephony(fetchImpl: typeof fetch = fetch): void {
    const base = telephonyBaseUrl();
    if (!base) return;
    try {
        fetchImpl(`${base}${WARM_PATH}`, {
            method: 'GET',
            signal: AbortSignal.timeout(WARM_TIMEOUT_MS),
        }).catch(() => {
            // A failed warm-up only costs latency; the call proceeds regardless.
        });
    } catch {
        // Same: never let warming break dialling.
    }
}
