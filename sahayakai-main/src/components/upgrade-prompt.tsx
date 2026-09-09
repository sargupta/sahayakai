'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/language-context';

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
 *
 * No price is shown here — pricing is quoted per school/teacher, so the CTA
 * routes to /pricing rather than publishing a figure. Colors come from the
 * app token system (primary / card / muted / foreground); the landing-only
 * saffron scale is intentionally not used inside the authenticated app.
 */
export function UpgradePrompt({ feature, used, limit, inline }: UpgradePromptProps) {
    const { t } = useLanguage();
    const featureLabel = feature.replace(/-/g, ' ');

    if (inline) {
        return (
            <div className="flex items-center gap-3 rounded-surface-md border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <span className="text-foreground">
                    You&apos;ve created {used} {featureLabel}s this month.{' '}
                    <Link href="/pricing" className="font-medium text-primary underline underline-offset-2">
                        {t("Upgrade to Pro")}
                    </Link>{' '}
                    for more.
                </span>
            </div>
        );
    }

    return (
        <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                <Sparkles className="h-8 w-8 text-primary" />
                <div>
                    <h3 className="font-headline text-lg font-semibold text-foreground">
                        {t("Great work this month!")}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        You&apos;ve created {used} {featureLabel}s — that&apos;s {used} lessons your students benefited from.
                        Upgrade to Pro for higher limits and better AI quality.
                    </p>
                </div>
                <Button asChild className="shadow-soft">
                    <Link href="/pricing">
                        <Sparkles className="mr-2 h-4 w-4" />
                        {t("Upgrade to Pro")}
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}
