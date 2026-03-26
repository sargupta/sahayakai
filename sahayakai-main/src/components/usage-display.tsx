'use client';

import { useSubscription } from '@/hooks/use-subscription';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';

/**
 * Compact usage display for the sidebar.
 * Shows the most constrained feature's usage as a progress bar.
 */
export function UsageDisplay() {
    const { usage, plan, loading, isPro } = useSubscription();

    if (loading || !usage) return null;

    // Find the feature closest to its limit (most urgency)
    let topFeature: { name: string; used: number; limit: number; pct: number } | null = null;

    for (const [feature, info] of Object.entries(usage)) {
        if (info.limit === -1) continue; // unlimited
        const pct = Math.round((info.used / info.limit) * 100);
        if (!topFeature || pct > topFeature.pct) {
            topFeature = { name: feature.replace(/-/g, ' '), used: info.used, limit: info.limit, pct };
        }
    }

    if (!topFeature) return null;

    const barColor = topFeature.pct >= 90 ? 'bg-red-500' : topFeature.pct >= 70 ? 'bg-amber-500' : 'bg-green-500';

    return (
        <div className="px-3 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="capitalize">{topFeature.name}</span>
                <span>{topFeature.used}/{topFeature.limit}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${Math.min(topFeature.pct, 100)}%` }}
                />
            </div>
            {!isPro && (
                <Link
                    href="/pricing"
                    className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-amber-600 hover:text-amber-700"
                >
                    <Sparkles className="h-3 w-3" />
                    Upgrade for more
                </Link>
            )}
        </div>
    );
}
