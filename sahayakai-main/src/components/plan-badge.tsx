'use client';

import Link from 'next/link';
import { Crown, Sparkles, Gem, Circle } from 'lucide-react';
import { useSubscription } from '@/hooks/use-subscription';
import { useLanguage } from '@/context/language-context';
import { PLAN_DISPLAY_NAMES } from '@/lib/plan-config';
import { cn } from '@/lib/utils';

type PlanKey = keyof typeof PLAN_DISPLAY_NAMES;

const PLAN_STYLES: Record<PlanKey, { className: string; Icon: React.ComponentType<{ className?: string }> }> = {
    free: {
        className: 'bg-muted text-muted-foreground hover:bg-muted/80',
        Icon: Circle,
    },
    pro: {
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 hover:bg-blue-200',
        Icon: Sparkles,
    },
    gold: {
        className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 hover:bg-amber-200',
        Icon: Gem,
    },
    premium: {
        className: 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-900 dark:from-purple-950 dark:to-pink-950 dark:text-purple-200 hover:from-purple-200 hover:to-pink-200',
        Icon: Crown,
    },
};

interface PlanBadgeProps {
    /** Compact mode: just the chip, no upgrade CTA. Default false. */
    compact?: boolean;
    className?: string;
}

/**
 * Shows the user's current plan as a clickable badge linking to /pricing.
 * Free users see an "Upgrade" CTA next to the chip.
 */
export function PlanBadge({ compact = false, className }: PlanBadgeProps) {
    const { plan, loading } = useSubscription();
    const { t } = useLanguage();
    if (loading) return null;

    const key = (plan as PlanKey) in PLAN_STYLES ? (plan as PlanKey) : 'free';
    const { className: styleClass, Icon } = PLAN_STYLES[key];
    const label = t(PLAN_DISPLAY_NAMES[key]);

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <Link
                href="/pricing"
                aria-label={`${t("Current plan:")} ${label}. ${t("Manage subscription.")}`}
                className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
                    styleClass,
                )}
            >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
            </Link>
            {!compact && key === 'free' && (
                <Link
                    href="/pricing"
                    className="text-xs font-medium text-primary hover:underline"
                >
                    {t("Upgrade")}
                </Link>
            )}
        </div>
    );
}
