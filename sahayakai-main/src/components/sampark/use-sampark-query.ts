"use client";

/**
 * Minimal data hook for the Sampark console.
 *
 * - Fetches when `deps` change (and on `reload()`), aborting the previous request.
 * - Keeps the last good data while a reload is in flight, so refreshes do not flash.
 * - Optional silent polling (`pollMs`) for campaigns that are rendering or calling.
 *
 * Pages render inside <AuthGate>, so `auth.currentUser` is set before the
 * first fetch and apiFetch can attach the Bearer token.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface SamparkQuery<T> {
    data: T | undefined;
    error: Error | null;
    loading: boolean;
    reload: () => void;
    /** Replace the data locally (e.g. with the server's response to an action). */
    setData: (next: T | ((prev: T | undefined) => T)) => void;
}

export function useSamparkQuery<T>(
    fetcher: ((signal: AbortSignal) => Promise<T>) | null,
    deps: readonly unknown[],
    opts: { pollMs?: number | null } = {},
): SamparkQuery<T> {
    const [data, setDataState] = useState<T | undefined>(undefined);
    const [error, setError] = useState<Error | null>(null);
    const [loading, setLoading] = useState<boolean>(fetcher !== null);
    const [tick, setTick] = useState(0);

    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;
    const inflight = useRef<AbortController | null>(null);

    const run = useCallback((silent: boolean) => {
        const f = fetcherRef.current;
        if (!f) {
            setLoading(false);
            return;
        }
        inflight.current?.abort();
        const ctrl = new AbortController();
        inflight.current = ctrl;
        if (!silent) setLoading(true);
        f(ctrl.signal)
            .then((next) => {
                if (ctrl.signal.aborted) return;
                setDataState(next);
                setError(null);
            })
            .catch((err: unknown) => {
                if (ctrl.signal.aborted) return;
                if (err instanceof DOMException && err.name === 'AbortError') return;
                // A failed silent poll keeps the data on screen; a failed load shows the error.
                if (!silent) setError(err instanceof Error ? err : new Error(String(err)));
            })
            .finally(() => {
                if (!ctrl.signal.aborted) setLoading(false);
            });
    }, []);

    useEffect(() => {
        run(false);
        // `deps` is the caller's dependency list for `fetcher` (read through a ref).
    }, [...deps, tick, run]);

    const pollMs = opts.pollMs ?? null;
    useEffect(() => {
        if (!pollMs) return;
        const id = setInterval(() => run(true), pollMs);
        return () => clearInterval(id);
    }, [pollMs, run]);

    useEffect(() => () => inflight.current?.abort(), []);

    const reload = useCallback(() => setTick((n) => n + 1), []);
    const setData = useCallback((next: T | ((prev: T | undefined) => T)) => {
        setDataState((prev) => (typeof next === 'function' ? (next as (p: T | undefined) => T)(prev) : next));
    }, []);

    return { data, error, loading, reload, setData };
}
