'use client';

import { useSubscription } from '@/hooks/use-subscription';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    CalendarDays, FileSignature, PencilRuler, ClipboardCheck,
    Sparkles, GraduationCap, Globe2, Images, User, MessageCircle,
    Mic, Loader2, ArrowRight, Crown, Infinity,
} from 'lucide-react';
import Link from 'next/link';

// Map feature keys to icons and readable labels
const FEATURE_META: Record<string, { icon: React.ElementType; label: string; href: string }> = {
    'lesson-plan':       { icon: CalendarDays,   label: 'Lesson Plans',       href: '/lesson-plan' },
    'quiz':              { icon: FileSignature,   label: 'Quizzes',            href: '/quiz-generator' },
    'worksheet':         { icon: PencilRuler,     label: 'Worksheets',         href: '/worksheet-wizard' },
    'rubric':            { icon: ClipboardCheck,  label: 'Rubrics',            href: '/rubric-generator' },
    'instant-answer':    { icon: Sparkles,        label: 'Instant Answers',    href: '/' },
    'teacher-training':  { icon: GraduationCap,   label: 'Teacher Training',   href: '/teacher-training' },
    'virtual-field-trip':{ icon: Globe2,          label: 'Virtual Field Trips', href: '/virtual-field-trip' },
    'visual-aid':        { icon: Images,          label: 'Visual Aids',        href: '/visual-aid-generator' },
    'avatar':            { icon: User,            label: 'AI Avatars',         href: '/avatar-generator' },
    'parent-message':    { icon: MessageCircle,   label: 'Parent Messages',    href: '/messages' },
    'voice-to-text':     { icon: Mic,             label: 'Voice to Text',      href: '/' },
};

function getBarColor(pct: number): string {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
}

function getPlanBadgeColor(plan: string): string {
    switch (plan) {
        case 'pro': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'gold': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'premium': return 'bg-purple-100 text-purple-700 border-purple-200';
        default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
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

    // Split features into limited vs unlimited
    const limited: { key: string; used: number; limit: number; pct: number }[] = [];
    const unlimited: { key: string; used: number }[] = [];

    for (const [feature, info] of Object.entries(usage)) {
        if (info.limit === -1) {
            unlimited.push({ key: feature, used: info.used });
        } else if (info.limit > 0) {
            const pct = Math.round((info.used / info.limit) * 100);
            limited.push({ key: feature, used: info.used, limit: info.limit, pct });
        }
        // limit === 0 means not available on this plan — skip
    }

    // Sort limited: most consumed first
    limited.sort((a, b) => b.pct - a.pct);

    const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
    const monthName = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">Usage</h1>
                    <p className="text-sm text-muted-foreground">{monthName} — resets on the 1st</p>
                </div>
                <Badge variant="outline" className={`text-sm px-3 py-1 ${getPlanBadgeColor(plan)}`}>
                    {isPro && <Crown className="h-3.5 w-3.5 mr-1" />}
                    {planLabel} Plan
                </Badge>
            </div>

            {/* Limited features */}
            {limited.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Monthly Limits</CardTitle>
                        <CardDescription>Features with a usage cap on your current plan</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {limited.map((f) => {
                            const meta = FEATURE_META[f.key];
                            const Icon = meta?.icon ?? Sparkles;
                            return (
                                <div key={f.key} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Link
                                            href={meta?.href ?? '#'}
                                            className="flex items-center gap-2 text-sm font-medium hover:underline"
                                        >
                                            <Icon className="h-4 w-4 text-muted-foreground" />
                                            {meta?.label ?? f.key}
                                        </Link>
                                        <span className="text-sm tabular-nums text-muted-foreground">
                                            {f.used} / {f.limit}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${getBarColor(f.pct)}`}
                                            style={{ width: `${Math.max(Math.min(f.pct, 100), 1)}%` }}
                                        />
                                    </div>
                                    {f.pct >= 90 && (
                                        <p className="text-[11px] text-red-600">
                                            {f.pct >= 100 ? 'Limit reached' : 'Almost at limit'} — upgrade for more
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* Unlimited features */}
            {unlimited.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Unlimited</CardTitle>
                        <CardDescription>No cap on your current plan</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                            {unlimited.map((f) => {
                                const meta = FEATURE_META[f.key];
                                const Icon = meta?.icon ?? Sparkles;
                                return (
                                    <div key={f.key} className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Icon className="h-4 w-4" />
                                        <span>{meta?.label ?? f.key}</span>
                                        <Infinity className="h-3.5 w-3.5 ml-auto opacity-40" />
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Upgrade CTA for free users */}
            {!isPro && (
                <Card className="border-amber-200 bg-amber-50/50">
                    <CardContent className="flex items-center justify-between py-5">
                        <div className="space-y-1">
                            <p className="text-sm font-semibold">Need more?</p>
                            <p className="text-xs text-muted-foreground">
                                Pro gives you higher limits, better AI model, export, and parent messaging.
                            </p>
                        </div>
                        <Button asChild size="sm" className="shrink-0">
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
