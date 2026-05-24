/**
 * Client-side feature flag context. Fetches `/api/feature-flags/me` once
 * on mount + provides a `useFeatureFlag(key)` hook for components.
 *
 * Design:
 *   - Render with all-defaults (every flag enabled — matches server
 *     "not configured = enabled" semantics) DURING SSR + before fetch
 *     resolves. This avoids hydration mismatches.
 *   - Fetch in `useEffect`. On success → update state, components
 *     re-render with live values.
 *   - On fetch failure → defaults stand. No retry today (the API has
 *     fail-safe defaults; transient blips are tolerated).
 *
 * Server-side flag reads (in API routes / RSC) still use
 * `isFeatureEnabled` from `@/lib/feature-flags` directly. This client
 * context is ONLY for components that render in the browser.
 *
 * Adding a new flag:
 *   1. Add the key to CLIENT_READABLE_FLAGS in
 *      `src/app/api/feature-flags/me/route.ts`
 *   2. Add the key + default to FLAG_DEFAULTS below
 *   3. Use `useFeatureFlag('<key>')` from this module
 *
 * See docs/FEATURE_FLAGS.md.
 */

'use client';

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { getAuthToken } from '@/lib/get-auth-token';

/**
 * Client-readable flag keys + their default values. Keep in sync with
 * the whitelist in `src/app/api/feature-flags/me/route.ts`. Defaults
 * match the server-side "not configured = enabled" rule.
 */
const FLAG_DEFAULTS = {
    communityPersonas: true,
    assessmentScannerDemoMode: true,
    vidyaIntentCacheGate: true,
    vidyaGreetingSuppressor: true,
    ncertChapterValidation: true,
    geminiFlash2_0: true,
    demoMode: true,
} as const;

export type ClientFlagKey = keyof typeof FLAG_DEFAULTS;
type FlagState = Record<ClientFlagKey, boolean>;

interface FeatureFlagsContextValue {
    /** Current flag values. Always populated (defaults until fetch resolves). */
    flags: FlagState;
    /** True until the first /api/feature-flags/me response (success OR failure). */
    loading: boolean;
    /** True if the most recent fetch failed (defaults are stand-in). */
    error: boolean;
    /** Manually refetch (e.g. after a settings change). Rarely needed. */
    refresh: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
    const [flags, setFlags] = useState<FlagState>(FLAG_DEFAULTS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const mountedRef = useRef(true);

    const fetchFlags = async () => {
        try {
            const token = await getAuthToken();
            if (!token) {
                // Unauthenticated — keep defaults, mark not-loading.
                if (mountedRef.current) {
                    setLoading(false);
                }
                return;
            }
            const res = await fetch('/api/feature-flags/me', {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as { flags: Partial<FlagState> };
            if (mountedRef.current) {
                // Merge defaults with server response (server may not return
                // all keys; defaults fill any gaps).
                setFlags({ ...FLAG_DEFAULTS, ...data.flags });
                setError(false);
            }
        } catch (err) {
            // Defaults already populated. Just mark error state.
            // eslint-disable-next-line no-console
            console.warn('[feature-flags] fetch failed; using defaults', err);
            if (mountedRef.current) {
                setError(true);
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        mountedRef.current = true;
        fetchFlags();
        return () => {
            mountedRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const value = useMemo<FeatureFlagsContextValue>(
        () => ({
            flags,
            loading,
            error,
            refresh: fetchFlags,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [flags, loading, error],
    );

    return (
        <FeatureFlagsContext.Provider value={value}>
            {children}
        </FeatureFlagsContext.Provider>
    );
}

/**
 * Read a single client-side feature flag. Returns the default (enabled)
 * during SSR + before the first fetch resolves. Components that render
 * differently when the flag is OFF can also read `loading` from the
 * context if they want to wait for the real value before deciding.
 */
export function useFeatureFlag(key: ClientFlagKey): boolean {
    const ctx = useContext(FeatureFlagsContext);
    if (!ctx) {
        // Provider not mounted — fall back to default. Useful so isolated
        // tests can render components without wrapping.
        return FLAG_DEFAULTS[key];
    }
    return ctx.flags[key];
}

/** Read the full flag map + state. Use sparingly — prefer single-flag hook. */
export function useFeatureFlags(): FeatureFlagsContextValue {
    const ctx = useContext(FeatureFlagsContext);
    if (!ctx) {
        return {
            flags: FLAG_DEFAULTS,
            loading: false,
            error: false,
            refresh: async () => {},
        };
    }
    return ctx;
}
