/**
 * AtithiVani post-stay feedback types — intentionally decoupled from school-call types
 * (`src/types/sampark.ts` school/guardian/student concepts never enter here).
 */

export type AtithiLanguage = 'en' | 'hi' | 'bn';

export type AtithiCarrier = 'vobiz' | 'plivo' | 'exotel' | 'elevenlabs' | 'simulated';

export type AtithiPolicyBlockReason =
    | 'invalid_number'
    | 'suppressed'
    | 'test_phone_only'
    | 'max_attempts_reached'
    | 'checkout_window_expired';

export type AtithiPolicyVerdict =
    | { kind: 'allow'; language: AtithiLanguage }
    | { kind: 'defer'; until: Date; reason: string }
    | { kind: 'block'; reason: AtithiPolicyBlockReason };

export interface AtithiGuestStay {
    tenantId: string;
    hotelName: string;
    guestId: string;
    stayId: string;
    guestName: string;
    phoneE164: string;
    language: AtithiLanguage;
    /** ISO timestamp when the guest checked out. */
    checkedOutAt: string;
    /** Number of post-stay feedback calls already attempted for this stay. */
    attemptCount: number;
    /** True if the guest opted out of feedback calls. */
    optedOut: boolean;
}

export interface AtithiCallContext {
    productContext: 'atithivani';
    tenantId: string;
    hotelName: string;
    guestId: string;
    stayId: string;
    guestName: string;
    lang: AtithiLanguage;
}

export type AtithiSentiment = 'positive' | 'neutral' | 'negative';

export interface AtithiFeedbackResult {
    callId: string;
    tenantId: string;
    hotelName: string;
    stayId: string;
    guestId: string;
    language: AtithiLanguage;
    carrier: AtithiCarrier;
    overallRating: number | null;
    sentiment: AtithiSentiment;
    roomCleanliness: string | null;
    hospitality: string | null;
    highlights: string[];
    issues: string[];
    callbackRequested: boolean;
    optedOut: boolean;
    recordingUrl: string | null;
    savedAt: string;
}
