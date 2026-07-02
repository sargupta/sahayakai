'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/auth-context';

export interface UsageInfo {
    used: number;
    limit: number; // -1 = unlimited
}

export interface SubscriptionData {
    plan: string;
    canExport: boolean;
    canViewDetailedAnalytics: boolean;
    canAccessAbsenceRecords: boolean;
    canUseParentMessaging: boolean;
    model: string;
    usage: Record<string, UsageInfo>;
}

export function useSubscription() {
    const { user } = useAuth();
    const [data, setData] = useState<SubscriptionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Monotonic request sequence: only the latest refresh may apply state.
    const requestSeqRef = useRef(0);
    // Tracks whether the hook is still mounted (guards post-unmount setState).
    const mountedRef = useRef(true);

    const refresh = useCallback(async () => {
        const seq = ++requestSeqRef.current;
        const isCurrent = () => mountedRef.current && seq === requestSeqRef.current;

        if (!user) {
            if (isCurrent()) {
                setData(null);
                setLoading(false);
            }
            return;
        }

        const controller = new AbortController();

        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/usage', {
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal,
            });
            if (!res.ok) throw new Error('Failed to fetch usage');
            const json = await res.json();
            if (isCurrent()) {
                setData(json);
                setError(null);
            }
        } catch (err) {
            if ((err as { name?: string })?.name === 'AbortError') return;
            if (isCurrent()) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            }
        } finally {
            if (isCurrent()) {
                setLoading(false);
            }
        }
    }, [user]);

    useEffect(() => {
        mountedRef.current = true;
        refresh();
        return () => {
            mountedRef.current = false;
            // Invalidate any in-flight request so its result is ignored.
            requestSeqRef.current++;
        };
    }, [refresh]);

    const isPro = data?.plan === 'pro' || data?.plan === 'gold' || data?.plan === 'premium';

    return {
        plan: data?.plan ?? 'free',
        canExport: data?.canExport ?? false,
        canViewDetailedAnalytics: data?.canViewDetailedAnalytics ?? false,
        canAccessAbsenceRecords: data?.canAccessAbsenceRecords ?? false,
        canUseParentMessaging: data?.canUseParentMessaging ?? false,
        model: data?.model ?? '',
        usage: data?.usage ?? {},
        isPro,
        loading,
        error,
        refresh,
    };
}
