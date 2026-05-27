/**
 * Teacher Analytics Dashboard Component
 *
 * Displays teacher's personal health score and engagement metrics
 * with circular progress indicators (hollow circles with thick borders).
 *
 * v3 (2026-05-20) UI hardening:
 *   - Loading skeleton while initial fetch in flight
 *   - Error state with retry button (instead of silent failure)
 *   - Cold-start (level === 'new') gets a friendly Getting Started panel
 *   - Stale-data indicator ("Updated X minutes ago") + auto-refresh hint
 *   - Composite headline now MATCHES sum of dimensions (raw-sum invariant)
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/context/language-context';

interface TeacherHealthScore {
    score: number; // 0-100
    level: 'new' | 'healthy' | 'at-risk' | 'critical';
    risk_level: 'healthy' | 'at-risk' | 'critical';
    activity_score: number;
    engagement_score: number;
    success_score: number;
    growth_score: number;
    community_score: number;
    days_since_last_use: number;
    consecutive_days_used: number;
    estimated_students_impacted: number;
    is_cold_start: boolean;
    lastUpdated?: string | null;
}

interface CircularProgressProps {
    value: number; // 0-max
    max: number;
    label: string;
    size?: 'sm' | 'md' | 'lg';
    color?: 'green' | 'yellow' | 'red' | 'blue';
}

function CircularProgress({ value, max, label, size = 'md', color = 'blue' }: CircularProgressProps) {
    // Defensive: never show NaN/Infinity
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : 0;
    const percentage = max > 0 ? (safeValue / max) * 100 : 0;

    const sizeConfig = {
        sm: { diameter: 80, strokeWidth: 6, fontSize: 'text-lg' },
        md: { diameter: 120, strokeWidth: 8, fontSize: 'text-2xl' },
        lg: { diameter: 160, strokeWidth: 10, fontSize: 'text-3xl' },
    };

    const { diameter, strokeWidth, fontSize } = sizeConfig[size];
    const radius = (diameter - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    const colorMap = {
        green: { stroke: 'stroke-green-500', text: 'text-green-600' },
        yellow: { stroke: 'stroke-yellow-500', text: 'text-yellow-600' },
        red: { stroke: 'stroke-red-500', text: 'text-red-600' },
        blue: { stroke: 'stroke-blue-500', text: 'text-blue-600' },
    };

    const { stroke, text } = colorMap[color];

    return (
        <div className="flex flex-col items-center gap-2">
            <svg width={diameter} height={diameter} className="transform -rotate-90">
                <circle
                    cx={diameter / 2}
                    cy={diameter / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="none"
                    className="text-gray-200 dark:text-gray-700"
                />
                <circle
                    cx={diameter / 2}
                    cy={diameter / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className={`${stroke} transition-all duration-500 ease-out`}
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center" style={{ width: diameter, height: diameter }}>
                <span className={`font-bold font-headline ${fontSize} ${text}`}>
                    {Math.round(safeValue)}
                </span>
                <span className="text-xs text-muted-foreground">/ {max}</span>
            </div>
            <span className="text-sm font-medium text-center mt-1">{label}</span>
        </div>
    );
}

function formatRelativeTime(iso: string | null | undefined): string | null {
    if (!iso) return null;
    try {
        const then = new Date(iso).getTime();
        if (!Number.isFinite(then)) return null;
        const diffMs = Date.now() - then;
        if (diffMs < 0) return 'just now';
        const minutes = Math.floor(diffMs / 60000);
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    } catch {
        return null;
    }
}

export function TeacherAnalyticsDashboard({ userId }: { userId: string }) {
    const { t } = useLanguage();
    const [healthScore, setHealthScore] = useState<TeacherHealthScore | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchHealthScore = useCallback(async () => {
        if (!userId) return;
        try {
            setError(null);
            const res = await fetch(`/api/analytics/teacher-health/${userId}`, { cache: 'no-store' });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = (await res.json()) as TeacherHealthScore & { error?: string };
            // Defensive: never trust raw API output blindly — clamp
            // every visible number so a broken backend can't render NaN.
            const safe: TeacherHealthScore = {
                score: Math.max(0, Math.min(100, Number(data.score) || 0)),
                level: (data.level as TeacherHealthScore['level']) || 'critical',
                risk_level: (data.risk_level as TeacherHealthScore['risk_level']) || 'critical',
                activity_score: Math.max(0, Math.min(30, Number(data.activity_score) || 0)),
                engagement_score: Math.max(0, Math.min(30, Number(data.engagement_score) || 0)),
                success_score: Math.max(0, Math.min(20, Number(data.success_score) || 0)),
                growth_score: Math.max(0, Math.min(20, Number(data.growth_score) || 0)),
                community_score: Math.max(0, Math.min(20, Number(data.community_score) || 0)),
                days_since_last_use: Math.max(0, Number(data.days_since_last_use) || 0),
                consecutive_days_used: Math.max(0, Number(data.consecutive_days_used) || 0),
                estimated_students_impacted: Math.max(0, Number(data.estimated_students_impacted) || 0),
                is_cold_start: Boolean(data.is_cold_start),
                lastUpdated: data.lastUpdated ?? null,
            };
            setHealthScore(safe);
        } catch (e) {
            setError(t('Unable to refresh — please try again.'));
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchHealthScore();
    }, [fetchHealthScore]);

    // -------------------------------------------------------------------------
    // LOADING STATE — skeleton, no stale numbers
    // -------------------------------------------------------------------------
    if (isLoading) {
        return (
            <div className="w-full bg-card border border-border shadow-soft rounded-2xl overflow-hidden">
                <div className="h-1.5 w-full bg-primary" />
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64 mt-2" />
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-32 w-32 rounded-full mx-auto" />
                        ))}
                    </div>
                </CardContent>
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // ERROR STATE — explicit retry
    // -------------------------------------------------------------------------
    if (error && !healthScore) {
        return (
            <div className="w-full bg-card border border-border shadow-soft rounded-2xl overflow-hidden">
                <div className="h-1.5 w-full bg-destructive" />
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <CardTitle className="font-headline">{t("Couldn't load your impact")}</CardTitle>
                    </div>
                    <CardDescription>{error}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => { setIsRefreshing(true); fetchHealthScore(); }} disabled={isRefreshing}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {t("Retry")}
                    </Button>
                </CardContent>
            </div>
        );
    }

    if (!healthScore) {
        // Unreachable in practice — handled by error or cold-start branches.
        return null;
    }

    // -------------------------------------------------------------------------
    // COLD-START STATE — friendly Getting Started, NOT all-red zeros
    // -------------------------------------------------------------------------
    if (healthScore.is_cold_start || healthScore.level === 'new') {
        return (
            <div className="w-full bg-card border border-border shadow-soft rounded-2xl overflow-hidden">
                <div className="h-1.5 w-full bg-primary" />
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <CardTitle className="font-headline">{t("Welcome to your Impact Dashboard")}</CardTitle>
                    </div>
                    <CardDescription>
                        {t("Your score grows as you create lesson plans, worksheets, and other resources.")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 bg-muted/50 border border-border rounded-xl">
                        <p className="text-sm text-foreground">
                            {t("Generate your first lesson plan to start your impact journey. Every resource you create reflects in your Activity, Engagement, Success Rate, and Growth scores.")}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("Activity")}</p>
                            <p className="text-2xl font-bold font-headline">—</p>
                            <p className="text-xs text-muted-foreground">/ 30</p>
                        </div>
                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("Engagement")}</p>
                            <p className="text-2xl font-bold font-headline">—</p>
                            <p className="text-xs text-muted-foreground">/ 30</p>
                        </div>
                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("Success")}</p>
                            <p className="text-2xl font-bold font-headline">—</p>
                            <p className="text-xs text-muted-foreground">/ 20</p>
                        </div>
                        <div className="p-3 bg-muted/30 border border-border rounded-xl">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("Growth")}</p>
                            <p className="text-2xl font-bold font-headline">—</p>
                            <p className="text-xs text-muted-foreground">/ 20</p>
                        </div>
                    </div>
                </CardContent>
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // STANDARD STATE
    // -------------------------------------------------------------------------
    const getRiskColor = (riskLevel: string): 'green' | 'yellow' | 'red' => {
        if (riskLevel === 'healthy') return 'green';
        if (riskLevel === 'at-risk') return 'yellow';
        return 'red';
    };

    const getRiskBadgeVariant = (riskLevel: string): 'default' | 'secondary' | 'destructive' => {
        if (riskLevel === 'healthy') return 'default';
        if (riskLevel === 'at-risk') return 'secondary';
        return 'destructive';
    };

    // INVARIANT CHECK: composite must equal sum of dimensions (off by <=1)
    const dimensionSum =
        healthScore.activity_score +
        healthScore.engagement_score +
        healthScore.success_score +
        healthScore.growth_score;

    const displayedComposite = healthScore.score;
    // If they ever drift (shouldn't, but defense in depth), prefer the
    // visible sum so user sees math that adds up.
    const headlineScore = Math.abs(displayedComposite - dimensionSum) > 1
        ? dimensionSum
        : displayedComposite;

    const relativeUpdated = formatRelativeTime(healthScore.lastUpdated);

    return (
        <div className="space-y-6">
            {/* Overall Health Score */}
            <div className="w-full bg-card border border-border shadow-soft rounded-2xl overflow-hidden">
                <div className="h-1.5 w-full bg-primary" />
                <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <CardTitle className="font-headline">{t("Your Teaching Impact Score")}</CardTitle>
                            <CardDescription>
                                {t("Based on activity, engagement, success rate, and growth")}
                            </CardDescription>
                        </div>
                        <Badge variant={getRiskBadgeVariant(healthScore.risk_level)} className="capitalize">
                            {healthScore.risk_level === 'healthy' ? <><span className="inline-block h-2 w-2 rounded-full bg-green-500 mr-1" /> {t("Excellent")}</> : null}
                            {healthScore.risk_level === 'at-risk' ? <><span className="inline-block h-2 w-2 rounded-full bg-yellow-500 mr-1" /> {t("Good")}</> : null}
                            {healthScore.risk_level === 'critical' ? <><span className="inline-block h-2 w-2 rounded-full bg-red-500 mr-1" /> {t("Needs Attention")}</> : null}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center gap-6 py-4">
                        <div className="relative">
                            <CircularProgress
                                value={headlineScore}
                                max={100}
                                label={t("Overall Score")}
                                size="lg"
                                color={getRiskColor(healthScore.risk_level)}
                            />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-2xl text-center">
                            <div className="p-3 bg-muted border border-border rounded-xl shadow-soft">
                                <p className="text-2xl font-bold text-blue-600 font-headline">{healthScore.consecutive_days_used}</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t("Day Streak")}</p>
                            </div>
                            <div className="p-3 bg-muted border border-border rounded-xl shadow-soft">
                                <p className="text-2xl font-bold text-green-600 font-headline">{healthScore.estimated_students_impacted}</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t("Students Impacted")}</p>
                            </div>
                            <div className="p-3 bg-muted border border-border rounded-xl shadow-soft">
                                <p className="text-2xl font-bold text-purple-600 font-headline">
                                    {healthScore.days_since_last_use === 0 ? t('Today') : `${healthScore.days_since_last_use}d ago`}
                                </p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t("Last Active")}</p>
                            </div>
                        </div>

                        {(relativeUpdated || error) && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {relativeUpdated && <span>{t("Updated")} {relativeUpdated}</span>}
                                {error && <span className="text-amber-600">{t("Showing last good values")}</span>}
                                <button
                                    onClick={() => { setIsRefreshing(true); fetchHealthScore(); }}
                                    disabled={isRefreshing}
                                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                                    aria-label={t("Refresh impact score")}
                                >
                                    <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                                    {t("Refresh")}
                                </button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </div>

            {/* Component Scores */}
            <div className="w-full bg-card border border-border shadow-soft rounded-2xl overflow-hidden p-6">
                <CardHeader className="px-0 pt-0">
                    <CardTitle className="font-headline">{t("Score Breakdown")}</CardTitle>
                    <CardDescription>
                        {t("Adds up to your overall score of")} {headlineScore} / 100
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 justify-items-center py-4">
                        <div className="relative">
                            <CircularProgress
                                value={healthScore.activity_score}
                                max={30}
                                label={t("Activity")}
                                size="md"
                                color={healthScore.activity_score >= 20 ? 'green' : healthScore.activity_score >= 10 ? 'yellow' : 'red'}
                            />
                        </div>

                        <div className="relative">
                            <CircularProgress
                                value={healthScore.engagement_score}
                                max={30}
                                label={t("Engagement")}
                                size="md"
                                color={healthScore.engagement_score >= 20 ? 'green' : healthScore.engagement_score >= 10 ? 'yellow' : 'red'}
                            />
                        </div>

                        <div className="relative">
                            <CircularProgress
                                value={healthScore.success_score}
                                max={20}
                                label={t("Success Rate")}
                                size="md"
                                color={healthScore.success_score >= 14 ? 'green' : healthScore.success_score >= 8 ? 'yellow' : 'red'}
                            />
                        </div>

                        <div className="relative">
                            <CircularProgress
                                value={healthScore.growth_score}
                                max={20}
                                label={t("Growth")}
                                size="md"
                                color={healthScore.growth_score >= 14 ? 'green' : healthScore.growth_score >= 8 ? 'yellow' : 'red'}
                            />
                        </div>
                    </div>

                    {/* Explanations */}
                    <div className="mt-6 space-y-2 text-sm">
                        <p><strong>{t("Activity")} (0-30):</strong> {t("How often you use the app and session quality")}</p>
                        <p><strong>{t("Engagement")} (0-30):</strong> {t("Content created and feature diversity")}</p>
                        <p><strong>{t("Success")} (0-20):</strong> {t("Generation quality and low friction")}</p>
                        <p><strong>{t("Growth")} (0-20):</strong> {t("Week-over-week improvement and streaks")}</p>
                    </div>
                </CardContent>
            </div>
        </div>
    );
}
