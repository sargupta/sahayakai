/**
 * Teacher Activity Tracker
 * 
 * Tracks individual teacher engagement with health scoring and challenge detection
 */

import { trackInteraction } from '@/lib/performance-monitor';

// ============================================================================
// TYPES
// ============================================================================

export interface TeacherActivityData {
    // Identity
    user_id: string;
    name?: string;
    location_type?: 'rural' | 'urban';
    preferred_language: string;
    estimated_students: number;

    // Current session
    session_start: number;
    pages_visited: string[];
    features_used: string[];
    content_created_count: number;

    // Recent history (from Firestore)
    sessions_last_7_days: number;
    sessions_days_8_to_14: number;
    content_created_last_7_days: number;
    content_created_days_8_to_14: number;
    features_used_last_30_days: string[];

    // Performance metrics
    avg_generation_time_sec: number;
    avg_regenerations_per_content: number;
    successful_generations: number;
    total_attempts: number;

    // Engagement signals
    days_since_last_use: number;
    consecutive_days_used: number;
    days_since_signup: number;
    content_created_total: number;
    exported_content_count: number;
    shared_to_community_count: number;
}

export interface TeacherHealthScore {
    user_id: string;
    score: number;
    risk_level: 'healthy' | 'at-risk' | 'critical';

    // Component scores
    activity_score: number;
    engagement_score: number;
    success_score: number;
    growth_score: number;

    // Insights
    days_since_last_use: number;
    consecutive_days_used: number;
    challenges_detected: string[];
    recommended_interventions: string[];

    // Impact
    estimated_students_impacted: number;
    timestamp: number;
}

// ============================================================================
// SESSION TRACKING
// ============================================================================

class TeacherActivityTracker {
    private sessionData: {
        user_id: string;
        session_id: string;
        session_start: number;
        pages_visited: Set<string>;
        features_used: Set<string>;
        content_created: number;
    } | null = null;

    /**
     * Start tracking a teacher session
     */
    startSession(userId: string, metadata?: {
        name?: string;
        location_type?: 'rural' | 'urban';
        preferred_language?: string;
    }) {
        this.sessionData = {
            user_id: userId,
            session_id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            session_start: Date.now(),
            pages_visited: new Set(),
            features_used: new Set(),
            content_created: 0,
        };

        // Track session start
        this.logEvent('teacher_session_start', {
            user_id: userId,
            session_id: this.sessionData.session_id,
            ...metadata,
        });
    }

    /**
     * Track page visit
     */
    trackPageVisit(page: string) {
        if (!this.sessionData) return;
        this.sessionData.pages_visited.add(page);
    }

    /**
     * Track feature usage
     */
    trackFeatureUse(feature: string, metadata?: Record<string, any>) {
        if (!this.sessionData) return;
        this.sessionData.features_used.add(feature);

        this.logEvent('teacher_feature_use', {
            user_id: this.sessionData.user_id,
            session_id: this.sessionData.session_id,
            feature,
            ...metadata,
        });
    }

    /**
     * Track content creation
     */
    trackContentCreated(contentType: string, metadata?: {
        language?: string;
        grade_level?: string;
        success?: boolean;
        generation_time_sec?: number;
        regeneration_count?: number;
    }) {
        if (!this.sessionData) return;
        this.sessionData.content_created++;

        this.logEvent('teacher_content_created', {
            user_id: this.sessionData.user_id,
            session_id: this.sessionData.session_id,
            content_type: contentType,
            ...metadata,
        });
    }

    /**
     * Track challenge/friction point
     */
    trackChallenge(challengeType: string, details?: Record<string, any>) {
        if (!this.sessionData) return;

        this.logEvent('teacher_challenge_detected', {
            user_id: this.sessionData.user_id,
            session_id: this.sessionData.session_id,
            challenge_type: challengeType,
            severity: this.getChallengeSeverity(challengeType),
            ...details,
        });
    }

    /**
     * End session and calculate summary
     */
    endSession() {
        if (!this.sessionData) return;

        const duration = Date.now() - this.sessionData.session_start;
        const durationMinutes = Math.round(duration / 60000);

        this.logEvent('teacher_session_end', {
            user_id: this.sessionData.user_id,
            session_id: this.sessionData.session_id,
            duration_minutes: durationMinutes,
            pages_visited_count: this.sessionData.pages_visited.size,
            pages_visited: Array.from(this.sessionData.pages_visited),
            features_used_count: this.sessionData.features_used.size,
            features_used: Array.from(this.sessionData.features_used),
            content_created: this.sessionData.content_created,
        });

        this.sessionData = null;
    }

    /**
     * Log structured event to Cloud Logging
     */
    private logEvent(eventType: string, data: Record<string, any>) {
        // Send to metrics endpoint
        fetch('/api/teacher-activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event_type: eventType,
                timestamp: Date.now(),
                data,
            }),
            keepalive: true,
        }).catch(err => {
            console.error('[Teacher Activity] Failed to log event:', err);
        });
    }

    private getChallengeSeverity(challengeType: string): 'low' | 'medium' | 'high' {
        const highSeverity = ['slow_generation', 'language_barrier', 'connectivity_issues'];
        const mediumSeverity = ['poor_content_quality', 'onboarding_stalled'];

        if (highSeverity.includes(challengeType)) return 'high';
        if (mediumSeverity.includes(challengeType)) return 'medium';
        return 'low';
    }
}

// ============================================================================
// HEALTH SCORING
// ============================================================================

export function calculateTeacherHealthScore(data: TeacherActivityData): TeacherHealthScore {
    const activity = calculateActivityScore(data);
    const engagement = calculateEngagementScore(data);
    const success = calculateSuccessScore(data);
    const growth = calculateGrowthScore(data);

    const total = activity + engagement + success + growth;

    return {
        user_id: data.user_id,
        score: total,
        risk_level: getRiskLevel(total),
        activity_score: activity,
        engagement_score: engagement,
        success_score: success,
        growth_score: growth,
        days_since_last_use: data.days_since_last_use,
        consecutive_days_used: data.consecutive_days_used,
        challenges_detected: detectChallenges(data),
        recommended_interventions: getInterventions(data),
        estimated_students_impacted: data.estimated_students,
        timestamp: Date.now(),
    };
}

function calculateActivityScore(data: TeacherActivityData): number {
    let score = 0;

    // Daily usage (15 points)
    if (data.sessions_last_7_days >= 5) score += 15;
    else if (data.sessions_last_7_days >= 3) score += 10;
    else if (data.sessions_last_7_days >= 1) score += 5;

    // Session quality (10 points) - estimated from content created
    if (data.content_created_last_7_days >= 5) score += 10;
    else if (data.content_created_last_7_days >= 3) score += 6;
    else if (data.content_created_last_7_days >= 1) score += 3;

    // Recency (5 points)
    if (data.days_since_last_use === 0) score += 5;
    else if (data.days_since_last_use <= 2) score += 3;
    else if (data.days_since_last_use <= 5) score += 1;

    return Math.min(score, 30);
}

function calculateEngagementScore(data: TeacherActivityData): number {
    let score = 0;

    // Content creation (15 points)
    const contentLastWeek = data.content_created_last_7_days;
    if (contentLastWeek >= 5) score += 15;
    else if (contentLastWeek >= 3) score += 10;
    else if (contentLastWeek >= 1) score += 5;

    // Feature diversity (10 points)
    const featuresUsed = data.features_used_last_30_days.length;
    if (featuresUsed >= 4) score += 10;
    else if (featuresUsed >= 2) score += 6;
    else if (featuresUsed >= 1) score += 3;

    // Community engagement (5 points)
    if (data.shared_to_community_count > 0) score += 5;
    else if (data.exported_content_count > 0) score += 2;

    return Math.min(score, 30);
}

function calculateSuccessScore(data: TeacherActivityData): number {
    let score = 0;

    // Content quality (15 points)
    const successRate = data.total_attempts > 0
        ? data.successful_generations / data.total_attempts
        : 0;
    if (successRate >= 0.9) score += 15;
    else if (successRate >= 0.7) score += 10;
    else if (successRate >= 0.5) score += 5;

    // Low friction (5 points)
    if (data.avg_regenerations_per_content <= 1.2) score += 5;
    else if (data.avg_regenerations_per_content <= 2) score += 2;

    return Math.min(score, 20);
}

function calculateGrowthScore(data: TeacherActivityData): number {
    let score = 0;

    // Week-over-week growth (10 points)
    const thisWeek = data.content_created_last_7_days;
    const lastWeek = data.content_created_days_8_to_14;

    if (thisWeek > lastWeek && thisWeek >= 3) score += 10;
    else if (thisWeek >= lastWeek && thisWeek >= 2) score += 6;
    else if (thisWeek >= 1) score += 3;

    // Streak building (10 points)
    if (data.consecutive_days_used >= 7) score += 10;
    else if (data.consecutive_days_used >= 3) score += 6;
    else if (data.consecutive_days_used >= 1) score += 3;

    return Math.min(score, 20);
}

function getRiskLevel(score: number): 'healthy' | 'at-risk' | 'critical' {
    if (score >= 70) return 'healthy';
    if (score >= 40) return 'at-risk';
    return 'critical';
}

function detectChallenges(data: TeacherActivityData): string[] {
    const challenges: string[] = [];

    if (data.avg_generation_time_sec > 12) challenges.push('slow_generation');
    if (data.avg_regenerations_per_content > 2.5) challenges.push('poor_content_quality');
    if (data.days_since_signup >= 3 && data.content_created_total < 2) challenges.push('onboarding_stalled');

    const thisWeek = data.sessions_last_7_days;
    const lastWeek = data.sessions_days_8_to_14;
    if (lastWeek >= 3 && thisWeek < 2) challenges.push('engagement_declining');

    if (data.content_created_total >= 3 && data.exported_content_count === 0) challenges.push('not_using_output');
    if (data.days_since_last_use >= 7 && data.content_created_total >= 3) challenges.push('abandonment_risk');

    return challenges;
}

function getInterventions(data: TeacherActivityData): string[] {
    const challenges = detectChallenges(data);
    const interventions: string[] = [];

    for (const challenge of challenges) {
        switch (challenge) {
            case 'slow_generation':
                interventions.push('send_performance_tips_email', 'suggest_offline_mode');
                break;
            case 'poor_content_quality':
                interventions.push('send_prompting_guide', 'schedule_demo_call');
                break;
            case 'onboarding_stalled':
                interventions.push('send_quick_start_guide', 'trigger_welcome_call');
                break;
            case 'engagement_declining':
                interventions.push('send_new_feature_notification', 'share_success_story');
                break;
            case 'not_using_output':
                interventions.push('send_export_tutorial', 'schedule_feedback_call');
                break;
            case 'abandonment_risk':
                interventions.push('send_we_miss_you_email', 'offer_one_on_one_support');
                break;
        }
    }

    return interventions;
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let tracker: TeacherActivityTracker | null = null;

export function getTeacherActivityTracker(): TeacherActivityTracker {
    if (!tracker) {
        tracker = new TeacherActivityTracker();
    }
    return tracker;
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const startTeacherSession = (userId: string, metadata?: any) =>
    getTeacherActivityTracker().startSession(userId, metadata);

export const trackTeacherPageVisit = (page: string) =>
    getTeacherActivityTracker().trackPageVisit(page);

export const trackTeacherFeature = (feature: string, metadata?: any) =>
    getTeacherActivityTracker().trackFeatureUse(feature, metadata);

export const trackTeacherContent = (contentType: string, metadata?: any) =>
    getTeacherActivityTracker().trackContentCreated(contentType, metadata);

export const trackTeacherChallenge = (challengeType: string, details?: any) =>
    getTeacherActivityTracker().trackChallenge(challengeType, details);

export const endTeacherSession = () =>
    getTeacherActivityTracker().endSession();
