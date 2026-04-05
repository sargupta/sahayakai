'use client';

import { useSubscription } from '@/hooks/use-subscription';
import Link from 'next/link';

interface UsageRemainingBadgeProps {
    /** The feature key from plan-config (e.g., 'lesson-plan', 'quiz') */
    feature: string;
}

/**
 * Inline badge showing "X remaining" for a gated feature.
 * Drop this into any feature page header to give teachers awareness.
 *
 * - Hidden when loading, unlimited, or feature not found
 * - Green text when plenty left
 * - Amber when ≤30% remaining
 * - Red when depleted, links to /pricing
 */
export function UsageRemainingBadge({ feature }: UsageRemainingBadgeProps) {
    const { usage, loading, isPro } = useSubscription();

    if (loading) return null;

    const info = usage[feature];
    if (!info || info.limit <= 0) return null; // unlimited or unavailable

    const remaining = info.limit - info.used;
    const pct = Math.round((info.used / info.limit) * 100);

    if (remaining <= 0) {
        return (
            <Link
                href="/pricing"
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 hover:bg-red-200 transition-colors"
            >
                Limit reached
            </Link>
        );
    }

    if (pct >= 70) {
        return (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {remaining} remaining
            </span>
        );
    }

    // Plenty left — subtle display
    return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs text-muted-foreground">
            {remaining} remaining
        </span>
    );
}
