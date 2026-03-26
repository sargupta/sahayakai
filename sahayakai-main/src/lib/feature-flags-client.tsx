'use client';

/**
 * Client-side Feature Flags Context
 * ----------------------------------
 * Fetches flag state from /api/config/flags (server evaluates per-user).
 * Re-fetches every 5 minutes. Provides hooks for components.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

// ─── Types (client-safe subset) ─────────────────────────────────────────────

interface ClientFlagState {
  subscriptionEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  features: Record<string, boolean>;
  /** True while the initial fetch is in progress */
  loading: boolean;
  /** Timestamp of last successful fetch */
  fetchedAt: number;
}

const DEFAULT_STATE: ClientFlagState = {
  subscriptionEnabled: false, // safe default: no paywall
  maintenanceMode: false,
  maintenanceMessage: '',
  features: {},
  loading: true,
  fetchedAt: 0,
};

const REFETCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Context ────────────────────────────────────────────────────────────────

const FeatureFlagContext = createContext<ClientFlagState>(DEFAULT_STATE);

export function FeatureFlagProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ClientFlagState>(DEFAULT_STATE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch('/api/config/flags', { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setState({
        subscriptionEnabled: data.subscriptionEnabled ?? false,
        maintenanceMode: data.maintenanceMode ?? false,
        maintenanceMessage: data.maintenanceMessage ?? '',
        features: data.features ?? {},
        loading: false,
        fetchedAt: Date.now(),
      });
    } catch (err) {
      console.warn('[FeatureFlags] Client fetch failed, keeping current state:', err);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchFlags();
    intervalRef.current = setInterval(fetchFlags, REFETCH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchFlags]);

  return (
    <FeatureFlagContext.Provider value={state}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useFeatureFlags(): ClientFlagState {
  return useContext(FeatureFlagContext);
}

export function useIsFeatureEnabled(featureName: string): boolean {
  const { features, loading } = useContext(FeatureFlagContext);
  // While loading, default to enabled (don't hide features during fetch)
  if (loading) return true;
  // Not listed = enabled by default (matches server logic)
  return features[featureName] ?? true;
}

export function useIsSubscriptionEnabled(): boolean {
  const { subscriptionEnabled, loading } = useContext(FeatureFlagContext);
  if (loading) return false; // safe: don't show paywall during load
  return subscriptionEnabled;
}

export function useMaintenanceBanner(): { active: boolean; message: string } {
  const { maintenanceMode, maintenanceMessage } = useContext(FeatureFlagContext);
  return { active: maintenanceMode, message: maintenanceMessage };
}
