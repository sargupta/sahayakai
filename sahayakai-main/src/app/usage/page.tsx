'use client';

import { useSubscription } from '@/hooks/use-subscription';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    CalendarDays, FileSignature, PencilRuler, ClipboardCheck,
    Sparkles, GraduationCap, Globe2, Images, User, MessageCircle,
    Mic, Loader2, ArrowRight, Crown, Infinity,
} from 'lucide-react';
import Link from 'next/link';

const FEATURE_META: Record<string, { icon: React.ElementType; label: string; href: string }> = {
    'lesson-plan':       { icon: CalendarDays,   label: 'Lesson Plans',       href: '/lesson-plan' },
    'quiz':              { icon: FileSignature,   label: 'Quizzes',            href: '/quiz-generator' },
    'worksheet':         { icon: PencilRuler,     label: 'Worksheets',         href: '/worksheet-wizard' },
    'rubric':            { icon: ClipboardCheck,  label: 'Rubrics',            href: '/rubric-generator' },
    'instant-answer':    { icon: Sparkles,        label: 'Instant Answers',    href: '/' },
    'teacher-training':  { icon: GraduationCap,   label: 'Teacher Training',   href: '/teacher-training' },
    'virtual-field-trip':{ icon: Globe2,          label: 'Virtual Field Trips', href: '/virtual-field-trip' },
    'visual-aid':        { icon: Images,          label: 'Visual Aids',        href: '/visual-aid-designer' },
    'avatar':            { icon: User,            label: 'AI Avatars',         href: '/avatar-generator' },
    'parent-message':    { icon: MessageCircle,   label: 'Parent Messages',    href: '/messages' },
    'voice-to-text':     { icon: Mic,             label: 'Voice to Text',      href: '/' },
};

function getBarColor(pct: number): string {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
}

function getBarBg(pct: number): string {
    if (pct >= 90) return 'bg-red-100 dark:bg-red-950';
    if (pct >= 70) return 'bg-amber-100 dark:bg-amber-950';
    return 'bg-emerald-100 dark:bg-emerald-950';
}

export default function UsagePage() {
    const { user } = useAuth();
    const { usage, plan, isPro, loading } = useSubscription();

    if (!user || loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const limited: { key: string; used: number; limit: number; pct: number }[] = [];
    const unlimited: { key: string; used: number }[] = [];

    for (const [feature, info] of Object.entries(usage)) {
        if (info.limit === -1) {
            unlimited.push({ key: feature, used: info.used });
        } else if (info.limit > 0) {
            const pct = Math.round((info.used / info.limit) * 100);
            limited.push({ key: feature, used: info.used, limit: info.limit, pct });
        }
    }

    limited.sort((a, b) => b.pct - a.pct);

    const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1, 1);
    const resetLabel = resetDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Usage</h1>
                    <p className="text-xs text-muted-foreground">Resets {resetLabel}</p>
                </div>
                <Badge
                    variant="outline"
                    className={isPro
                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    }
                >
                    {isPro && <Crown className="h-3 w-3 mr-1" />}
                    {planLabel}
                </Badge>
            </div>

            {/* Limited features — stacked cards */}
            {limited.map((f) => {
                const meta = FEATURE_META[f.key];
                const Icon = meta?.icon ?? Sparkles;
                const remaining = f.limit - f.used;
                return (
                    <Card key={f.key} className="overflow-hidden">
                        <CardContent className="py-4 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <Link
                                    href={meta?.href ?? '#'}
                                    className="flex items-center gap-2.5 text-sm font-medium hover:underline"
                                >
                                    <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                                    {meta?.label ?? f.key}
                                </Link>
                                <span className="text-lg font-semibold tabular-nums">
                                    {f.used}<span className="text-muted-foreground text-sm font-normal">/{f.limit}</span>
                                </span>
                            </div>
                            <div className={`h-2.5 w-full rounded-full overflow-hidden ${getBarBg(f.pct)}`}>
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${getBarColor(f.pct)}`}
                                    style={{ width: `${Math.max(Math.min(f.pct, 100), 1)}%` }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {remaining <= 0
                                    ? <span className="text-red-600 font-medium">Limit reached — resets {resetLabel}</span>
                                    : remaining <= 2
                                        ? <span className="text-amber-600">{remaining} remaining</span>
                                        : `${remaining} remaining`
                                }
                            </p>
                        </CardContent>
                    </Card>
                );
            })}

            {/* Unlimited features */}
            {unlimited.length > 0 && (
                <Card>
                    <CardContent className="py-4">
                        <p className="text-xs font-medium text-muted-foreground mb-3">UNLIMITED ON YOUR PLAN</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {unlimited.map((f) => {
                                const meta = FEATURE_META[f.key];
                                const Icon = meta?.icon ?? Sparkles;
                                return (
                                    <div key={f.key} className="flex items-center gap-2.5 text-sm">
                                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="truncate">{meta?.label ?? f.key}</span>
                                        <Infinity className="h-3.5 w-3.5 ml-auto text-emerald-500 shrink-0" />
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Upgrade CTA */}
            {!isPro && (
                <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/50">
                    <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-5">
                        <div>
                            <p className="text-sm font-semibold">Need more?</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Higher limits, better AI, export, parent messaging
                            </p>
                        </div>
                        <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700 shrink-0">
                            <Link href="/pricing">
                                View Plans <ArrowRight className="h-4 w-4 ml-1" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
