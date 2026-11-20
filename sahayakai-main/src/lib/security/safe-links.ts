/**
 * Link and route guards for user-generated content (group posts, DM resources).
 *
 * - A group-post attachment URL is rendered as <a href>. React does not block
 *   `javascript:` URLs, so only absolute https: URLs are accepted.
 * - A shared DM resource is opened with router.push(`/${route}`). A route such
 *   as "/evil.example" becomes "//evil.example", an open redirect, so a route
 *   must be one in-app slug.
 */
export function isSafeHttpsUrl(value: unknown): value is string {
    if (typeof value !== 'string' || value.length > 2048) return false;
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}

const ROUTE_SLUG = /^[a-z0-9-]{1,64}$/;

export function isSafeAppRouteSlug(value: unknown): value is string {
    return typeof value === 'string' && ROUTE_SLUG.test(value);
}
