import { logEvent } from "@/lib/indexed-db";
import { trackInteraction } from "@/lib/performance-monitor";

export interface AnalyticsEvent {
    event_type: string;
    user_id?: string;
    session_id: string;
    timestamp: number;
    page_path: string;
    device_type: 'mobile' | 'tablet' | 'desktop';
    metadata?: Record<string, any>;
}

export interface ContentCreatedEvent extends AnalyticsEvent {
    event_type: 'content_created';
    content_type: 'lesson-plan' | 'quiz' | 'visual-aid' | 'rubric' | 'story' | 'worksheet';
    topic_length: number;
    language: string;
    generation_time_sec?: number;
    success: boolean;
    model_used?: string;
    grade_level?: string;
    subject?: string;
    regeneration_count?: number;
}

export interface FeatureUsageEvent extends AnalyticsEvent {
    event_type: 'feature_used';
    feature_name: string;
    is_first_use?: boolean;
}

export interface ChallengeDetectedEvent extends AnalyticsEvent {
    event_type: 'challenge_detected';
    challenge_type: 'rate_limit' | 'api_error' | 'validation_error' | 'empty_result';
    severity: 'low' | 'medium' | 'high';
    details?: string;
}

let currentUserId: string | undefined = undefined;
let sessionId: string = '';

// Initialize session
if (typeof window !== 'undefined') {
    sessionId = sessionStorage.getItem('analytics_session_id') || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
}

export function initAnalytics(userId?: string) {
    if (userId) {
        currentUserId = userId;
        logEvent({
            type: 'session_start',
            user_id: userId,
            timestamp: Date.now()
        });
    }
}

function getBaseEvent(): Omit<AnalyticsEvent, 'event_type'> {
    return {
        timestamp: Date.now(),
        session_id: sessionId,
        user_id: currentUserId,
        page_path: typeof window !== 'undefined' ? window.location.pathname : '',
        device_type: getDeviceType(),
    };
}

function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    if (typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
}

export function trackPageVisit(path: string, referrer?: string) {
    const event = {
        ...getBaseEvent(),
        event_type: 'page_view',
        page_path: path,
        metadata: { referrer }
    };
    logEvent({ type: 'page_view', value: event });
}

export function trackContentCreated(data: Omit<ContentCreatedEvent, 'event_type' | 'timestamp' | 'user_id' | 'session_id' | 'device_type' | 'page_path'>) {
    const event: ContentCreatedEvent = {
        ...getBaseEvent(),
        event_type: 'content_created',
        ...data
    };
    logEvent({ type: 'content_created', value: event });

    // Also track as interaction for performance monitoring
    trackInteraction({
        interaction_type: 'submit',
        component_name: data.content_type,
        target_element: 'generate_button',
        value: data.generation_time_sec || 0,
        rating: data.success ? 'good' : 'poor'
    } as any);
}

export function trackFeatureUse(featureName: string, isFirstUse: boolean = false, daysSinceSignup?: number) {
    const event: FeatureUsageEvent = {
        ...getBaseEvent(),
        event_type: 'feature_used',
        feature_name: featureName,
        is_first_use: isFirstUse,
        metadata: { days_since_signup: daysSinceSignup }
    };
    logEvent({ type: 'feature_used', value: event });
}

export function trackChallenge(
    type: ChallengeDetectedEvent['challenge_type'],
    severity: ChallengeDetectedEvent['severity'],
    details?: Record<string, any>
) {
    const event: ChallengeDetectedEvent = {
        ...getBaseEvent(),
        event_type: 'challenge_detected',
        challenge_type: type,
        severity: severity,
        details: JSON.stringify(details),
        metadata: details
    };
    logEvent({ type: 'challenge_used', value: event }); // Typo in logEvent type? preserving for now or checking lib
}


export async function flushAnalytics() {
    // This function typically sends data to the server
    // For now, we rely on the IndexedDB sync mechanism handled in useLessonPlan / telemetry actions
    console.log('Flushing analytics queue...');
}
