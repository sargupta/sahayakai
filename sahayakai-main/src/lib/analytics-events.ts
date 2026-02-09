/**
 * Analytics Events System
 * 
 * Unified event tracking for social impact metrics and teacher engagement
 */

// ============================================================================
// EVENT TYPES
// ============================================================================

export type AnalyticsEventType =
    // Session events
    | 'session_start'
    | 'session_end'
    | 'page_visit'

    // Content events
    | 'content_created'
    | 'content_edited'
    | 'content_exported'
    | 'content_shared'
    | 'content_regenerated'

    // Feature events
    | 'feature_first_use'
    | 'feature_use'

    // Engagement events
    | 'onboarding_milestone'
    | 'achievement_unlocked'

    // Challenge events
    | 'challenge_detected'

    // Social impact events
    | 'teacher_profile_updated';

// ============================================================================
// EVENT INTERFACES
// ============================================================================

interface BaseEvent {
    event_type: AnalyticsEventType;
    timestamp: number;
    user_id: string;
    session_id?: string;
}

export interface SessionStartEvent extends BaseEvent {
    event_type: 'session_start';
    location_type?: 'rural' | 'urban';
    device_type: 'mobile' | 'desktop' | 'tablet';
    network_quality?: 'high' | 'medium' | 'low';
    preferred_language: string;
}

export interface SessionEndEvent extends BaseEvent {
    event_type: 'session_end';
    duration_minutes: number;
    pages_visited: string[];
    features_used: string[];
    content_created_count: number;
}

export interface PageVisitEvent extends BaseEvent {
    event_type: 'page_visit';
    page: string;
    referrer?: string;
}

export interface ContentCreatedEvent extends BaseEvent {
    event_type: 'content_created';
    content_type: 'lesson-plan' | 'quiz' | 'instant-answer' | 'worksheet' | 'visual-aid' | 'rubric' | 'field-trip';
    language: string;
    grade_level?: string;
    subject?: string;
    success: boolean;
    generation_time_sec: number;
    regeneration_count: number;
    exported: boolean;
    edited: boolean;
    edit_percentage?: number;
}

export interface FeatureUseEvent extends BaseEvent {
    event_type: 'feature_use' | 'feature_first_use';
    feature: string;
    days_since_signup?: number;
}

export interface ChallengeDetectedEvent extends BaseEvent {
    event_type: 'challenge_detected';
    challenge_type:
    | 'slow_generation'
    | 'poor_content_quality'
    | 'language_barrier'
    | 'onboarding_stalled'
    | 'engagement_declining'
    | 'connectivity_issues'
    | 'not_using_output'
    | 'abandonment_risk';
    severity: 'low' | 'medium' | 'high';
    details?: Record<string, any>;
}

export interface TeacherProfileUpdatedEvent extends BaseEvent {
    event_type: 'teacher_profile_updated';
    location_type: 'rural' | 'urban';
    state?: string;
    district?: string;
    subjects_taught: string[];
    grade_levels_taught: string[];
    estimated_students: number;
}

export type AnalyticsEvent =
    | SessionStartEvent
    | SessionEndEvent
    | PageVisitEvent
    | ContentCreatedEvent
    | FeatureUseEvent
    | ChallengeDetectedEvent
    | TeacherProfileUpdatedEvent;

// ============================================================================
// EVENT TRACKER
// ============================================================================

class AnalyticsEventTracker {
    private queue: AnalyticsEvent[] = [];
    private batchTimer: NodeJS.Timeout | null = null;
    private sessionId: string | null = null;
    private userId: string | null = null;

    private config = {
        batchSize: 10,
        batchTimeout: 5000,
        endpoint: '/api/teacher-activity',
        enabled: true, // Can be toggled based on user consent
    };

    /**
     * Initialize tracker with user context
     */
    init(userId: string) {
        this.userId = userId;
        this.sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Track an event
     */
    track<T extends AnalyticsEvent>(event: Omit<T, 'timestamp' | 'user_id' | 'session_id'>) {
        if (!this.config.enabled || !this.userId) return;

        const fullEvent = {
            ...event,
            timestamp: Date.now(),
            user_id: this.userId,
            session_id: this.sessionId || undefined,
        } as unknown as AnalyticsEvent;

        this.queue.push(fullEvent);

        // Immediately send critical events
        if (this.isCriticalEvent(event.event_type)) {
            this.sendBatch();
        } else {
            this.scheduleBatch();
        }
    }

    /**
     * Convenience methods for common events
     */
    trackSessionStart(data: Omit<SessionStartEvent, 'event_type' | 'timestamp' | 'user_id' | 'session_id'>) {
        this.track<SessionStartEvent>({ event_type: 'session_start', ...data });
    }

    trackSessionEnd(data: Omit<SessionEndEvent, 'event_type' | 'timestamp' | 'user_id' | 'session_id'>) {
        this.track<SessionEndEvent>({ event_type: 'session_end', ...data });
        this.sendBatch(); // Force send on session end
    }

    trackPageVisit(page: string, referrer?: string) {
        this.track<PageVisitEvent>({
            event_type: 'page_visit',
            page,
            referrer
        });
    }

    trackContentCreated(data: Omit<ContentCreatedEvent, 'event_type' | 'timestamp' | 'user_id' | 'session_id'>) {
        this.track<ContentCreatedEvent>({ event_type: 'content_created', ...data });
    }

    trackFeatureUse(feature: string, isFirstUse: boolean = false, daysSinceSignup?: number) {
        this.track<FeatureUseEvent>({
            event_type: isFirstUse ? 'feature_first_use' : 'feature_use',
            feature,
            days_since_signup: daysSinceSignup,
        });
    }

    trackChallenge(challenge_type: ChallengeDetectedEvent['challenge_type'], severity: 'low' | 'medium' | 'high', details?: Record<string, any>) {
        this.track<ChallengeDetectedEvent>({
            event_type: 'challenge_detected',
            challenge_type,
            severity,
            details,
        });
    }

    trackTeacherProfile(data: Omit<TeacherProfileUpdatedEvent, 'event_type' | 'timestamp' | 'user_id' | 'session_id'>) {
        this.track<TeacherProfileUpdatedEvent>({ event_type: 'teacher_profile_updated', ...data });
    }

    /**
     * Schedule batch send
     */
    private scheduleBatch() {
        if (this.batchTimer) clearTimeout(this.batchTimer);

        if (this.queue.length >= this.config.batchSize) {
            this.sendBatch();
        } else {
            this.batchTimer = setTimeout(() => this.sendBatch(), this.config.batchTimeout);
        }
    }

    /**
     * Send batched events
     */
    private async sendBatch() {
        if (this.queue.length === 0) return;

        const batch = [...this.queue];
        this.queue = [];

        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        try {
            await fetch(this.config.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events: batch }),
                keepalive: true,
            });
        } catch (error) {
            console.error('[Analytics] Failed to send events:', error);
            // Re-queue with limit
            if (this.queue.length < 50) {
                this.queue.unshift(...batch);
            }
        }
    }

    /**
     * Check if event requires immediate sending
     */
    private isCriticalEvent(eventType: AnalyticsEventType): boolean {
        return [
            'session_end',
            'challenge_detected',
            'teacher_profile_updated',
        ].includes(eventType);
    }

    /**
     * Flush all pending events
     */
    flush() {
        return this.sendBatch();
    }

    /**
     * Enable/disable tracking (for privacy consent)
     */
    setEnabled(enabled: boolean) {
        this.config.enabled = enabled;
        if (!enabled) {
            this.queue = [];
        }
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let tracker: AnalyticsEventTracker | null = null;

export function getAnalyticsTracker(): AnalyticsEventTracker {
    if (!tracker) {
        tracker = new AnalyticsEventTracker();
    }
    return tracker;
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const initAnalytics = (userId: string) =>
    getAnalyticsTracker().init(userId);

export const trackSessionStart = (data: Omit<SessionStartEvent, 'event_type' | 'timestamp' | 'user_id' | 'session_id'>) =>
    getAnalyticsTracker().trackSessionStart(data);

export const trackSessionEnd = (data: Omit<SessionEndEvent, 'event_type' | 'timestamp' | 'user_id' | 'session_id'>) =>
    getAnalyticsTracker().trackSessionEnd(data);

export const trackPageVisit = (page: string, referrer?: string) =>
    getAnalyticsTracker().trackPageVisit(page, referrer);

export const trackContentCreated = (data: Omit<ContentCreatedEvent, 'event_type' | 'timestamp' | 'user_id' | 'session_id'>) =>
    getAnalyticsTracker().trackContentCreated(data);

export const trackFeatureUse = (feature: string, isFirstUse?: boolean, daysSinceSignup?: number) =>
    getAnalyticsTracker().trackFeatureUse(feature, isFirstUse, daysSinceSignup);

export const trackChallenge = (challenge_type: ChallengeDetectedEvent['challenge_type'], severity: 'low' | 'medium' | 'high', details?: Record<string, any>) =>
    getAnalyticsTracker().trackChallenge(challenge_type, severity, details);

export const trackTeacherProfile = (data: Omit<TeacherProfileUpdatedEvent, 'event_type' | 'timestamp' | 'user_id' | 'session_id'>) =>
    getAnalyticsTracker().trackTeacherProfile(data);

export const flushAnalytics = () =>
    getAnalyticsTracker().flush();

export const setAnalyticsEnabled = (enabled: boolean) =>
    getAnalyticsTracker().setEnabled(enabled);
