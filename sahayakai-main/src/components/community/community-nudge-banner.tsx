"use client";

import { Users, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/context/language-context';
import Link from 'next/link';

interface CommunityNudgeBannerProps {
    onDismiss: () => void;
    onExplore: () => void;
}

export function CommunityNudgeBanner({ onDismiss, onExplore }: CommunityNudgeBannerProps) {
    const { t } = useLanguage();

    return (
        <Card className="border border-primary/20 bg-primary/5 shadow-soft animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardContent className="p-4 md:p-5 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                        {t("Teachers across Bharat are sharing resources")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {t("Join groups and share resources")}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                        <Button
                            size="sm"
                            className="h-8 text-xs gap-1"
                            asChild
                        >
                            <Link href="/community" onClick={onExplore}>
                                {t("Explore Community")} <ArrowRight className="h-3 w-3" />
                            </Link>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-muted-foreground"
                            onClick={onDismiss}
                        >
                            {t("Maybe Later")}
                        </Button>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={onDismiss}
                    aria-label="Dismiss"
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
            </CardContent>
        </Card>
    );
}
