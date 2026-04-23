/**
 * Organisation-level analytics aggregator.
 *
 * Pure functions that turn an array of per-teacher TeacherAnalytics docs
 * into the shape the principal dashboard renders. Keep this stateless and
 * dependency-free so it unit-tests cleanly and can run server- or
 * client-side if we ever want realtime updates.
 *
 * The health-score computation itself is delegated to calculateHealthScore
 * (src/lib/analytics/impact-score.ts), so the per-teacher scoring stays in
 * one place.
 */

import { calculateHealthScore, type TeacherAnalytics } from './impact-score';
import { estimateTimeSaved, type TimeSavedResult, type ContentType } from './time-saved-heuristic';

export interface OrgMemberSummary {
    userId: string;
    displayName?: string;
    administrativeRole?: string;
}

export interface OrgAnalyticsInput {
    orgId: string;
    orgName: string;
    totalSeats: number;
    isDemoData?: boolean;
    members: OrgMemberSummary[];
    analyticsByUserId: Record<string, TeacherAnalytics | null>;
    /**
     * Optional: counts of content_created events broken down by type,
     * aggregated across all teachers in the window. If omitted, falls back
     * to a proportional split based on each teacher's content_created_total
     * and their feature usage mix.
     */
    contentByType?: Partial<Record<ContentType, number>>;
    editsCount?: number;
    windowDays: number;
}

export interface WeeklyActiveMetric {
    count: number;
    totalTeachers: number;
    percentOfTotal: number;
    prevPeriodCount: number;
    delta: number;
}

export interface ContentGeneratedMetric {
    totalThisWindow: number;
    totalAllTime: number;
    byType: Partial<Record<ContentType, number>>;
}

export interface HealthDistributionMetric {
    avg: number;
    median: number;
    healthyCount: number;
    atRiskCount: number;
    criticalCount: number;
    byUser: Array<{ userId: string; score: number; riskLevel: 'healthy' | 'at-risk' | 'critical' }>;
}

export interface FeatureAdoptionEntry {
    feature: string;
    percentTeachers: number;
    teacherCount: number;
}

export interface TopTeacherEntry {
    userId: string;
    displayName?: string;
    contentThisWindow: number;
    daysSinceLastUse: number;
}

export interface AtRiskTeacherEntry {
    userId: string;
    displayName?: string;
    administrativeRole?: string;
    score: number;
    daysSinceLastUse: number;
    riskLevel: 'at-risk' | 'critical';
}

export interface OrgAnalyticsOutput {
    org: {
        id: string;
        name: string;
        totalTeachers: number;
        seatsUsed: number;
        isDemoData: boolean;
    };
    window: {
        days: number;
    };
    weeklyActive: WeeklyActiveMetric;
    contentGenerated: ContentGeneratedMetric;
    estimatedTimeSaved: TimeSavedResult;
    featureAdoption: FeatureAdoptionEntry[];
    healthDistribution: HealthDistributionMetric;
    topTeachers: TopTeacherEntry[];
    atRiskTeachers: AtRiskTeacherEntry[];
    emptyState: {
        showEmptyState: boolean;
        reason?: 'too-few-teachers' | 'too-little-data';
    };
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
        : sorted[mid];
}

/**
 * Split a total content count across types using each teacher's feature mix.
 * Used as a fallback when the caller doesn't have a pre-aggregated breakdown.
 */
function inferContentByType(
    members: OrgMemberSummary[],
    analytics: Record<string, TeacherAnalytics | null>,
): Partial<Record<ContentType, number>> {
    const counts: Partial<Record<ContentType, number>> = {};
    for (const m of members) {
        const a = analytics[m.userId];
        if (!a) continue;
        const contentThisWindow = (a.content_created_last_7_days ?? 0);
        if (contentThisWindow === 0) continue;
        const features = a.features_used_last_30_days ?? [];
        const contentTypesUsed = features.filter((f): f is ContentType =>
            ['lesson-plan', 'quiz', 'worksheet', 'visual-aid', 'rubric', 'exam-paper', 'instant-answer', 'field-trip'].includes(f),
        );
        if (contentTypesUsed.length === 0) {
            counts['lesson-plan'] = (counts['lesson-plan'] ?? 0) + contentThisWindow;
            continue;
        }
        const perType = contentThisWindow / contentTypesUsed.length;
        for (const t of contentTypesUsed) {
            counts[t] = (counts[t] ?? 0) + Math.round(perType);
        }
    }
    return counts;
}

export function aggregateOrgAnalytics(input: OrgAnalyticsInput): OrgAnalyticsOutput {
    const teacherMembers = input.members.filter(m => m.userId);
    const totalTeachers = teacherMembers.length;
    const withAnalytics = teacherMembers
        .map(m => ({ member: m, analytics: input.analyticsByUserId[m.userId] }))
        .filter((x): x is { member: OrgMemberSummary; analytics: TeacherAnalytics } => !!x.analytics);

    // Empty state detection: <3 teachers OR <10 total events in the window
    const totalEventsProxy = withAnalytics.reduce(
        (sum, { analytics }) =>
            sum + (analytics.sessions_last_7_days ?? 0) + (analytics.content_created_last_7_days ?? 0),
        0,
    );
    const showEmptyState = totalTeachers < 3 || totalEventsProxy < 10;
    const emptyStateReason: OrgAnalyticsOutput['emptyState']['reason'] = totalTeachers < 3
        ? 'too-few-teachers'
        : totalEventsProxy < 10
        ? 'too-little-data'
        : undefined;

    // Weekly active
    const WEEKLY_ACTIVE_SESSION_THRESHOLD = 1;
    const activeThisWeek = withAnalytics.filter(
        x => (x.analytics.sessions_last_7_days ?? 0) >= WEEKLY_ACTIVE_SESSION_THRESHOLD,
    );
    const activeLastWeek = withAnalytics.filter(
        x => (x.analytics.sessions_days_8_to_14 ?? 0) >= WEEKLY_ACTIVE_SESSION_THRESHOLD,
    );
    const weeklyActive: WeeklyActiveMetric = {
        count: activeThisWeek.length,
        totalTeachers,
        percentOfTotal: totalTeachers === 0 ? 0 : Math.round((activeThisWeek.length / totalTeachers) * 100),
        prevPeriodCount: activeLastWeek.length,
        delta: activeThisWeek.length - activeLastWeek.length,
    };

    // Content generated
    const contentByType = input.contentByType ?? inferContentByType(teacherMembers, input.analyticsByUserId);
    const contentGenerated: ContentGeneratedMetric = {
        totalThisWindow: Object.values(contentByType).reduce<number>((sum, n) => sum + (n ?? 0), 0),
        totalAllTime: withAnalytics.reduce((sum, x) => sum + (x.analytics.content_created_total ?? 0), 0),
        byType: contentByType,
    };

    // Time saved
    const estimatedTimeSaved = estimateTimeSaved({
        contentByType,
        editsCount: input.editsCount,
    });

    // Feature adoption (% of teachers who used each feature in the window)
    const featureUseCounts: Record<string, number> = {};
    for (const { analytics } of withAnalytics) {
        for (const feature of analytics.features_used_last_30_days ?? []) {
            featureUseCounts[feature] = (featureUseCounts[feature] ?? 0) + 1;
        }
    }
    const featureAdoption: FeatureAdoptionEntry[] = Object.entries(featureUseCounts)
        .map(([feature, teacherCount]) => ({
            feature,
            teacherCount,
            percentTeachers: totalTeachers === 0 ? 0 : Math.round((teacherCount / totalTeachers) * 100),
        }))
        .sort((a, b) => b.percentTeachers - a.percentTeachers)
        .slice(0, 8);

    // Health distribution
    const scores = withAnalytics.map(({ member, analytics }) => {
        const score = calculateHealthScore(analytics);
        return { userId: member.userId, member, analytics, score: score.score as number, riskLevel: score.risk_level as 'healthy' | 'at-risk' | 'critical' };
    });

    const scoreValues = scores.map(s => s.score);
    const healthDistribution: HealthDistributionMetric = {
        avg: scoreValues.length === 0 ? 0 : Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length),
        median: median(scoreValues),
        healthyCount: scores.filter(s => s.riskLevel === 'healthy').length,
        atRiskCount: scores.filter(s => s.riskLevel === 'at-risk').length,
        criticalCount: scores.filter(s => s.riskLevel === 'critical').length,
        byUser: scores.map(s => ({ userId: s.userId, score: s.score, riskLevel: s.riskLevel })),
    };

    // Top teachers
    const topTeachers: TopTeacherEntry[] = [...withAnalytics]
        .sort((a, b) => (b.analytics.content_created_last_7_days ?? 0) - (a.analytics.content_created_last_7_days ?? 0))
        .slice(0, 3)
        .map(x => ({
            userId: x.member.userId,
            displayName: x.member.displayName,
            contentThisWindow: x.analytics.content_created_last_7_days ?? 0,
            daysSinceLastUse: x.analytics.days_since_last_use ?? 0,
        }));

    // At-risk teachers (list for the principal to reach out to)
    const atRiskTeachers: AtRiskTeacherEntry[] = scores
        .filter(s => s.riskLevel !== 'healthy')
        .sort((a, b) => a.score - b.score) // worst first
        .slice(0, 8)
        .map(s => ({
            userId: s.userId,
            displayName: s.member.displayName,
            administrativeRole: s.member.administrativeRole,
            score: s.score,
            daysSinceLastUse: s.analytics.days_since_last_use ?? 0,
            riskLevel: s.riskLevel as 'at-risk' | 'critical',
        }));

    return {
        org: {
            id: input.orgId,
            name: input.orgName,
            totalTeachers,
            seatsUsed: totalTeachers,
            isDemoData: input.isDemoData ?? false,
        },
        window: { days: input.windowDays },
        weeklyActive,
        contentGenerated,
        estimatedTimeSaved,
        featureAdoption,
        healthDistribution,
        topTeachers,
        atRiskTeachers,
        emptyState: {
            showEmptyState,
            reason: emptyStateReason,
        },
    };
}
