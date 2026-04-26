/**
 * Per-user server-side cache wrapper.
 *
 * Wraps Next.js `unstable_cache` with the boilerplate already filled in for
 * actions whose result is keyed by the calling user's uid. The wrapped function
 * still receives the uid as its first argument so its body reads naturally.
 *
 * Usage:
 * ```ts
 * const getRecommendations = cachedPerUser(
 *   async (uid: string) => { ... expensive lookup ... },
 *   { key: 'recs', ttlSeconds: 300 },
 * );
 *
 * // call:
 * const recs = await getRecommendations('user-123');
 * // → cached for 300s under tag `recs:user-123`
 * ```
 *
 * To invalidate a single user's cached entry from elsewhere (e.g. after a
 * follow/connect mutation), call `revalidateTag(`recs:${uid}`)` from `next/cache`.
 */
import { unstable_cache, revalidateTag } from 'next/cache';

export interface CachedPerUserOptions {
    /** Stable key prefix — combined with uid to form the cache + tag id. */
    key: string;
    /** Time-to-live in seconds. */
    ttlSeconds: number;
}

export function cachedPerUser<R, A extends unknown[]>(
    fn: (uid: string, ...args: A) => Promise<R>,
    opts: CachedPerUserOptions,
): (uid: string, ...args: A) => Promise<R> {
    return async (uid: string, ...args: A) => {
        const tag = `${opts.key}:${uid}`;
        const cached = unstable_cache(
            async () => fn(uid, ...args),
            [opts.key, uid, ...args.map((a) => JSON.stringify(a))],
            { revalidate: opts.ttlSeconds, tags: [tag] },
        );
        return cached();
    };
}

/** Invalidate a single user's cached entry by key. */
export function invalidateUserCache(key: string, uid: string): void {
    revalidateTag(`${key}:${uid}`);
}
