'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';

interface UpgradePromptProps {
    feature: string;
    used: number;
    limit: number;
    /** If true, renders as a compact inline banner instead of a card */
    inline?: boolean;
}

/**
 * Shown when a user hits their usage limit.
 * Positive framing: celebrates what they've done, then nudges upgrade.
 */
export function UpgradePrompt({ feature, used, limit, inline }: UpgradePromptProps) {
    const featureLabel = feature.replace(/-/g, ' ');

    if (inline) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950">
                <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-amber-800 dark:text-amber-200">
                    You&apos;ve created {used} {featureLabel}s this month.{' '}
                    <Link href="/pricing" className="font-medium underline underline-offset-2">
                        Upgrade to Pro
                    </Link>{' '}
                    for more.
                </span>
            </div>
        );
    }

    return (
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:border-amber-800 dark:from-amber-950 dark:to-orange-950">
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                <Sparkles className="h-8 w-8 text-amber-600" />
                <div>
                    <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                        Great work this month!
                    </h3>
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                        You&apos;ve created {used} {featureLabel}s — that&apos;s {used} lessons your students benefited from.
                        Upgrade to Pro for higher limits and better AI quality.
                    </p>
                </div>
                <Button asChild className="bg-amber-600 hover:bg-amber-700">
                    <Link href="/pricing">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Upgrade to Pro — ₹149/month
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}
