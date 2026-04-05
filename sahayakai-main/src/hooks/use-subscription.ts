'use client';

import { useState, useEffect, useCallback } from 'react';
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

    const refresh = useCallback(async () => {
        if (!user) {
            setData(null);
            setLoading(false);
            return;
        }

        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/usage', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to fetch usage');
            const json = await res.json();
            setData(json);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        refresh();
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
