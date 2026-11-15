/**
 * The caller's address for rate limiting: the LAST X-Forwarded-For entry, which
 * Google's front end appends on Cloud Run. Earlier entries are whatever the
 * client sent, so keying a limiter on the first entry lets any caller reset it
 * by rotating the header.
 */
export function trustedClientAddress(req: { headers: { get(name: string): string | null } }): string {
    const last = req.headers
        .get('x-forwarded-for')
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .pop();
    return last || req.headers.get('x-real-ip')?.trim() || 'local';
}
