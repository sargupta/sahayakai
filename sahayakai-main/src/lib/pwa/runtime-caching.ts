/**
 * Service-worker caching policy for same-origin API traffic.
 *
 * WHY THIS FILE EXISTS
 *
 * On 2026-09-01 the PWA was reported failing across unrelated features while
 * the same account worked fine in a normal browser tab. Root cause: the
 * service worker was caching authenticated API responses.
 *
 * `defaultCache` from `@serwist/next/worker` ships this rule, and it was
 * compiled into the deployed `public/sw.js`:
 *
 *     { matcher: ({sameOrigin, url:{pathname}}) =>
 *                  sameOrigin && pathname.startsWith("/api/"),
 *       method: "GET",
 *       handler: new NetworkFirst({ cacheName: "apis",
 *         plugins: [new ExpirationPlugin({maxEntries: 16, maxAgeSeconds: 86400})],
 *         networkTimeoutSeconds: 10 }) }
 *
 * Three things make that unsafe for this app:
 *
 *   1. The Cache API is NOT the HTTP cache. `Cache-Control: no-store` does not
 *      stop a service worker writing the response. Verified in a live browser:
 *      `/api/health`, served with `no-store, must-revalidate`, still landed in
 *      a cache entry.
 *   2. Cache entries are keyed on the request URL. Our responses do not set
 *      `Vary: Authorization`, so `/api/usage` is a single entry no matter who
 *      is signed in — on a shared staffroom device one teacher's plan and
 *      usage can be served to the next.
 *   3. NetworkFirst falls back to the cached copy once the network exceeds
 *      `networkTimeoutSeconds` (10s). On a weak connection the app silently
 *      serves stale entitlements instead of failing honestly.
 *
 * `/api/usage` drives `plan`, `isPro` and every `can*` flag in
 * `src/hooks/use-subscription.ts`. When it is stale or falls back, the hook
 * degrades to `plan: 'free'` with all capabilities off, and several unrelated
 * features go dead at once. That is the reported symptom.
 *
 * THE MECHANISM. Serwist is first-match-wins, so the fix is a network-only
 * rule matching every same-origin `/api/**`, registered ahead of everything
 * else by `buildRuntimeCaching`. No later rule can reach API traffic.
 *
 * An earlier draft of this file instead deleted offending entries out of
 * `defaultCache`. That was wrong: serwist's `/api/auth/*` rule is a
 * `NetworkOnly`, which never writes to a cache, and removing it changed auth
 * behaviour for no benefit. Removal has to guess which handlers cache;
 * ordering does not have to guess. `findApiCachingViolations` keeps the
 * guarantee honest by failing the test suite if any rule is ever registered
 * ahead of ours.
 *
 * NOTE: none of this reproduces locally. `next.config.ts` sets
 * `disable: process.env.NODE_ENV === 'development'`, so the service worker
 * only exists in production builds.
 */

/**
 * Minimal structural view of a Serwist runtime-caching entry.
 *
 * `matcher` is deliberately `unknown` rather than Serwist's union: this module
 * must accept `RuntimeCaching` from any Serwist version without the two type
 * definitions having to stay assignable to each other in both directions.
 * Narrowing happens at the point of use in `entryMatches`.
 */
export interface CachingEntryLike {
    matcher: unknown;
    method?: string;
    handler?: unknown;
}

/** The argument Serwist hands a function matcher. */
export interface MatcherOptions {
    url: URL;
    request: { method: string; url: string; destination?: string; headers?: Headers };
    sameOrigin: boolean;
    event?: unknown;
}

type FunctionMatcher = (options: MatcherOptions) => unknown;

/**
 * Same-origin `/api/**` is never cacheable. Every route under it is either
 * scoped to the signed-in teacher or cheap enough that a cache buys nothing.
 */
export function isNeverCacheableApi(url: URL, sameOrigin: boolean): boolean {
    return sameOrigin && url.pathname.startsWith("/api/");
}

/**
 * Probe URLs used to decide whether a caching rule reaches API traffic.
 * Kept deliberately broad: the point is to catch a rule that matches ANY
 * API shape, not to enumerate our routes.
 */
const PROBE_PATHS = [
    "/api/usage",
    "/api/user/profile",
    "/api/health",
    "/api/config",
    "/api/content/list",
    "/api/ai/quiz",
    "/api/jobs/abc123",
];

const PROBE_ORIGIN = "https://www.sahayakai.com";

/** Replicates Workbox/Serwist route matching closely enough to audit a rule. */
export function entryMatches(entry: CachingEntryLike, url: URL, method = "GET"): boolean {
    // Serwist defaults an entry's method to GET, and only considers an entry
    // for requests using that method.
    if ((entry.method ?? "GET").toUpperCase() !== method.toUpperCase()) return false;

    const sameOrigin = url.origin === PROBE_ORIGIN;
    const { matcher } = entry;

    // RegExp matchers are tested against the full href, which is why an
    // unanchored pattern such as /\/api\/(config|user|health)/ also swallows
    // /api/user/profile.
    if (matcher instanceof RegExp) return matcher.test(url.href);
    if (typeof matcher === "string") return url.href === matcher || url.pathname === matcher;

    if (typeof matcher === "function") {
        try {
            return Boolean(
                (matcher as FunctionMatcher)({
                    url,
                    request: { method, url: url.href, destination: "", headers: new Headers() },
                    sameOrigin,
                    event: undefined,
                }),
            );
        } catch {
            // A matcher that needs richer context than we can synthesise is
            // treated as non-matching rather than crashing the worker build.
            return false;
        }
    }
    return false;
}

/** True when this entry would handle at least one same-origin API request. */
export function reachesApiTraffic(entry: CachingEntryLike): boolean {
    return PROBE_PATHS.some((p) => entryMatches(entry, new URL(p, PROBE_ORIGIN)));
}

/**
 * The rule that must sit ahead of every other: same-origin `/api/**` is
 * served from the network and never written to a cache.
 *
 * `handler` is supplied by the worker (it needs a real `NetworkOnly`
 * instance); this module stays free of any `serwist` import so it can be
 * unit-tested without a worker environment.
 */
export function apiNetworkOnlyMatcher({ url, sameOrigin }: MatcherOptions): boolean {
    return isNeverCacheableApi(url, sameOrigin);
}

/**
 * Assemble the worker's runtime-caching list.
 *
 * Order is the whole contract: the API rule first, then our own asset rules,
 * then whatever `defaultCache` provides. Serwist stops at the first matching
 * entry, so nothing below the first rule can ever handle an API request.
 */
export function buildRuntimeCaching<T extends CachingEntryLike>(
    apiRule: T,
    custom: readonly T[],
    defaults: readonly T[],
): T[] {
    return [apiRule, ...custom, ...defaults];
}

/**
 * Every entry that would handle same-origin API traffic before the
 * network-only rule does. Must always be empty.
 *
 * This is the class gate: it does not look for one known-bad rule, it asks
 * whether ANY rule — ours, a future one of ours, or one a serwist upgrade
 * introduces — can reach an API request first.
 */
export function findApiCachingViolations<T extends CachingEntryLike>(entries: readonly T[]): T[] {
    const apiRuleIndex = entries.findIndex(
        (e) => typeof e.matcher === "function" && (e.matcher as FunctionMatcher) === apiNetworkOnlyMatcher,
    );
    // No network-only rule registered at all is the worst case, so report
    // every API-reaching entry rather than silently passing.
    const cutoff = apiRuleIndex === -1 ? entries.length : apiRuleIndex;
    return entries.slice(0, cutoff).filter(reachesApiTraffic);
}
