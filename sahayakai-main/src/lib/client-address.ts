/**
 * The caller's address, as our own infrastructure saw it.
 *
 * Production reaches Cloud Run two ways (ingress is `all`), and each appends to X-Forwarded-For:
 *   - through the global HTTPS load balancer: `<whatever the client sent>, <client>, <load balancer>`
 *   - straight to the run.app URL:            `<whatever the client sent>, <client>`
 * Entries the client sent are unverified, so the first entry is never used: anyone could pick a
 * fresh address per request and walk around a per-address rate limit. The last entry is wrong
 * too behind the load balancer, because it is the load balancer's own address, and keying on it
 * puts every visitor in one bucket, so a handful of requests would lock everyone out. So we drop
 * our load balancer's addresses (TRUSTED_PROXY_ADDRESSES, set for both regions in cloudbuild.yaml)
 * from the right-hand end and take the last entry left.
 *
 * x-real-ip is not read: nothing in front of us sets it, so only a client could.
 * Every route reads the address through here (gate-client-address-from-one-helper).
 */
export function clientAddress(
    req: Pick<Request, 'headers'>,
    env: Record<string, string | undefined> = process.env,
): string {
    const ours = new Set((env.TRUSTED_PROXY_ADDRESSES ?? '').split(/[\s,;]+/).filter(Boolean));
    const hops = (req.headers.get('x-forwarded-for') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    while (hops.length > 1 && ours.has(hops[hops.length - 1])) hops.pop();
    return hops.pop() ?? 'unknown';
}
