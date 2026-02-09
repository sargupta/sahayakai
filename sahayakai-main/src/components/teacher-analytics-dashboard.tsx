/**
 * Teacher Analytics Dashboard Component
 * 
 * Displays teacher's personal health score and engagement metrics
 * with circular progress indicators (hollow circles with thick borders)
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface TeacherHealthScore {
    score: number; // 0-100
    risk_level: 'healthy' | 'at-risk' | 'critical';
    activity_score: number;
    engagement_score: number;
    success_score: number;
    growth_score: number;
    days_since_last_use: number;
    consecutive_days_used: number;
    estimated_students_impacted: number;
}

interface CircularProgressProps {
    value: number; // 0-100
    max: number; // Usually 100, but can be different (e.g., 30 for activity)
    label: string;
    size?: 'sm' | 'md' | 'lg';
    color?: 'green' | 'yellow' | 'red' | 'blue';
}

function CircularProgress({ value, max, label, size = 'md', color = 'blue' }: CircularProgressProps) {
    const percentage = (value / max) * 100;

    // Size configurations
    const sizeConfig = {
        sm: { diameter: 80, strokeWidth: 6, fontSize: 'text-lg' },
        md: { diameter: 120, strokeWidth: 8, fontSize: 'text-2xl' },
        lg: { diameter: 160, strokeWidth: 10, fontSize: 'text-3xl' },
    };

    const { diameter, strokeWidth, fontSize } = sizeConfig[size];
    const radius = (diameter - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    // Color configurations
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
                {/* Background circle (hollow) */}
                <circle
                    cx={diameter / 2}
                    cy={diameter / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="none"
                    className="text-gray-200 dark:text-gray-700"
                />

                {/* Progress circle (hollow, thick border) */}
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

            {/* Value display (centered) */}
            <div className="absolute flex flex-col items-center justify-center" style={{ width: diameter, height: diameter }}>
                <span className={`font-bold ${fontSize} ${text}`}>
                    {Math.round(value)}
                </span>
                <span className="text-xs text-muted-foreground">/ {max}</span>
            </div>

            {/* Label */}
            <span className="text-sm font-medium text-center mt-1">{label}</span>
        </div>
    );
}

export function TeacherAnalyticsDashboard({ userId }: { userId: string }) {
    const [healthScore, setHealthScore] = useState<TeacherHealthScore | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchHealthScore() {
            try {
                const res = await fetch(`/api/analytics/teacher-health/${userId}`);
                if (res.ok) {
                    const data = await res.json();
                    setHealthScore(data);
                }
            } catch (error) {
                console.error('Failed to fetch health score:', error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchHealthScore();
    }, [userId]);

    if (isLoading) {
        return (
            <Card>
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
            </Card>
        );
    }

    if (!healthScore) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Analytics Dashboard</CardTitle>
                    <CardDescription>No analytics data available yet. Start using the app to see your impact!</CardDescription>
                </CardHeader>
                <CardContent>
                    <button
                        onClick={async () => {
                            setIsLoading(true);
                            try {
                                const res = await fetch('/api/analytics/seed', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ userId })
                                });

                                if (!res.ok) throw new Error("Seed failed: " + res.statusText);

                                // Force reload to see new data
                                window.location.reload();
                            } catch (e) {
                                console.error("Demo Seed Failed", e);
                                setIsLoading(false);
                                alert("Failed to seed data. Please check console.");
                            }
                        }}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                    >
                        Populate Demo Data
                    </button>
                </CardContent>
            </Card>
        );
    }

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

    return (
        <div className="space-y-6">
            {/* Overall Health Score */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Your Teaching Impact Score</CardTitle>
                            <CardDescription>
                                Based on activity, engagement, success rate, and growth
                            </CardDescription>
                        </div>
                        <Badge variant={getRiskBadgeVariant(healthScore.risk_level)} className="capitalize">
                            {healthScore.risk_level === 'healthy' ? '🟢 Excellent' : ''}
                            {healthScore.risk_level === 'at-risk' ? '🟡 Good' : ''}
                            {healthScore.risk_level === 'critical' ? '🔴 Needs Attention' : ''}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center gap-6 py-4">
                        <div className="relative">
                            <CircularProgress
                                value={healthScore.score}
                                max={100}
                                label="Overall Score"
                                size="lg"
                                color={getRiskColor(healthScore.risk_level)}
                            />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-2xl text-center">
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="text-2xl font-bold text-blue-600">{healthScore.consecutive_days_used}</p>
                                <p className="text-sm text-muted-foreground">Day Streak</p>
                            </div>
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="text-2xl font-bold text-green-600">{healthScore.estimated_students_impacted}</p>
                                <p className="text-sm text-muted-foreground">Students Impacted</p>
                            </div>
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="text-2xl font-bold text-purple-600">
                                    {healthScore.days_since_last_use === 0 ? 'Today' : `${healthScore.days_since_last_use}d ago`}
                                </p>
                                <p className="text-sm text-muted-foreground">Last Active</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Component Scores */}
            <Card>
                <CardHeader>
                    <CardTitle>Score Breakdown</CardTitle>
                    <CardDescription>
                        Your score is calculated from four key areas
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 justify-items-center py-4">
                        <div className="relative">
                            <CircularProgress
                                value={healthScore.activity_score}
                                max={30}
                                label="Activity"
                                size="md"
                                color={healthScore.activity_score >= 20 ? 'green' : healthScore.activity_score >= 10 ? 'yellow' : 'red'}
                            />
                        </div>

                        <div className="relative">
                            <CircularProgress
                                value={healthScore.engagement_score}
                                max={30}
                                label="Engagement"
                                size="md"
                                color={healthScore.engagement_score >= 20 ? 'green' : healthScore.engagement_score >= 10 ? 'yellow' : 'red'}
                            />
                        </div>

                        <div className="relative">
                            <CircularProgress
                                value={healthScore.success_score}
                                max={20}
                                label="Success Rate"
                                size="md"
                                color={healthScore.success_score >= 14 ? 'green' : healthScore.success_score >= 8 ? 'yellow' : 'red'}
                            />
                        </div>

                        <div className="relative">
                            <CircularProgress
                                value={healthScore.growth_score}
                                max={20}
                                label="Growth"
                                size="md"
                                color={healthScore.growth_score >= 14 ? 'green' : healthScore.growth_score >= 8 ? 'yellow' : 'red'}
                            />
                        </div>
                    </div>

                    {/* Explanations */}
                    <div className="mt-6 space-y-2 text-sm">
                        <p><strong>Activity (0-30):</strong> How often you use the app and session quality</p>
                        <p><strong>Engagement (0-30):</strong> Content created and feature diversity</p>
                        <p><strong>Success (0-20):</strong> Generation quality and low friction</p>
                        <p><strong>Growth (0-20):</strong> Week-over-week improvement and streaks</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
