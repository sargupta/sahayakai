/**
 * Subscription plan configuration — single source of truth for feature limits.
 *
 * MVP: Free + Pro only. Gold/Premium defined but not sold until admin dashboard is built.
 * All limits are per calendar month unless noted otherwise.
 * -1 = unlimited.
 */

import type { PlanType } from './plan-utils';

// Features that can be gated with usage limits
export type GatedFeature =
    | 'lesson-plan'
    | 'quiz'
    | 'worksheet'
    | 'rubric'
    | 'instant-answer'
    | 'teacher-training'
    | 'virtual-field-trip'
    | 'visual-aid'
    | 'avatar'
    | 'parent-message'
    | 'voice-to-text'   // cloud fallback only (browser SpeechRecognition is free)
    | 'exam-paper'
    | 'assistant';       // VIDYA chat interface

export interface PlanLimits {
    /** Per-feature monthly limits. -1 = unlimited. */
    limits: Record<GatedFeature, number>;
    /** Instant Answer has a separate daily limit (in addition to monthly). -1 = no daily cap. */
    instantAnswerDailyLimit: number;
    /** VIDYA assistant daily limit. -1 = no daily cap. */
    assistantDailyLimit: number;
    /** Which Gemini model to use for AI generation */
    model: 'gemini-2.0-flash-lite' | 'gemini-2.0-flash';
    /** Can export content as PDF/DOCX */
    canExport: boolean;
    /** Can view detailed impact dashboard */
    canViewDetailedAnalytics: boolean;
    /** Can access student absence records */
    canAccessAbsenceRecords: boolean;
    /** Can use AI parent messaging */
    canUseParentMessaging: boolean;
    /**
     * Monthly quota for cloud TTS / ASR voice minutes. Browser Speech APIs stay
     * free for everyone, so this only gates Sarvam/ElevenLabs-backed cloud
     * minutes. -1 = unlimited. 0 = browser-only, no cloud voice.
     */
    voiceCloudMinutesPerMonth: number;
}

export const PLAN_CONFIG: Record<PlanType, PlanLimits> = {
    free: {
        limits: {
            'lesson-plan': 10,
            'quiz': 5,
            'worksheet': 5,
            'rubric': 5,
            'instant-answer': -1,   // controlled by daily limit instead
            'teacher-training': 5,
            'virtual-field-trip': 3,
            'visual-aid': 2,
            'avatar': 1,
            'parent-message': 0,    // not available on free
            'voice-to-text': -1,    // browser-first, cloud fallback unlimited for now
            'exam-paper': 3,
            'assistant': -1,        // unlimited monthly, controlled by daily limit
        },
        instantAnswerDailyLimit: 20,
        assistantDailyLimit: 50,
        model: 'gemini-2.0-flash-lite',
        canExport: false,
        canViewDetailedAnalytics: false,
        canAccessAbsenceRecords: false,
        canUseParentMessaging: false,
        voiceCloudMinutesPerMonth: 0,
    },
    pro: {
        limits: {
            'lesson-plan': 25,
            'quiz': 15,
            'worksheet': -1,
            'rubric': -1,
            'instant-answer': -1,
            'teacher-training': -1,
            'virtual-field-trip': -1,
            'visual-aid': 8,
            'avatar': 2,
            'parent-message': -1,
            'voice-to-text': -1,
            'exam-paper': 10,
            'assistant': -1,
        },
        instantAnswerDailyLimit: -1,
        assistantDailyLimit: -1,
        model: 'gemini-2.0-flash',
        canExport: true,
        canViewDetailedAnalytics: true,
        canAccessAbsenceRecords: true,
        canUseParentMessaging: true,
        voiceCloudMinutesPerMonth: 300,
    },
    gold: {
        limits: {
            'lesson-plan': -1,
            'quiz': -1,
            'worksheet': -1,
            'rubric': -1,
            'instant-answer': -1,
            'teacher-training': -1,
            'virtual-field-trip': -1,
            'visual-aid': 15,
            'avatar': 5,
            'parent-message': -1,
            'voice-to-text': -1,
            'exam-paper': -1,
            'assistant': -1,
        },
        instantAnswerDailyLimit: -1,
        assistantDailyLimit: -1,
        model: 'gemini-2.0-flash',
        canExport: true,
        canViewDetailedAnalytics: true,
        canAccessAbsenceRecords: true,
        canUseParentMessaging: true,
        voiceCloudMinutesPerMonth: 1500,
    },
    premium: {
        limits: {
            'lesson-plan': -1,
            'quiz': -1,
            'worksheet': -1,
            'rubric': -1,
            'instant-answer': -1,
            'teacher-training': -1,
            'virtual-field-trip': -1,
            'visual-aid': -1,
            'avatar': -1,
            'parent-message': -1,
            'voice-to-text': -1,
            'exam-paper': -1,
            'assistant': -1,
        },
        instantAnswerDailyLimit: -1,
        assistantDailyLimit: -1,
        model: 'gemini-2.0-flash',
        canExport: true,
        canViewDetailedAnalytics: true,
        canAccessAbsenceRecords: true,
        canUseParentMessaging: true,
        voiceCloudMinutesPerMonth: -1,
    },
};

/** Get the minimum plan required for a given feature (first plan where limit > 0). */
export function getMinimumPlan(feature: GatedFeature): PlanType {
    const plans: PlanType[] = ['free', 'pro', 'gold', 'premium'];
    for (const plan of plans) {
        if (PLAN_CONFIG[plan].limits[feature] !== 0) return plan;
    }
    return 'premium';
}

/** Get the model to use for a given plan. */
export function getModelForPlan(plan: PlanType): string {
    return PLAN_CONFIG[plan].model;
}

/** Human-readable plan names for UI. */
export const PLAN_DISPLAY_NAMES: Record<PlanType, string> = {
    free: 'Free',
    pro: 'Pro',
    gold: 'School Gold',
    premium: 'School Premium',
};

/**
 * Premium Anchored Pricing Ladder (SARGVISION, 2026).
 *
 * Positioning: SahayakAI is an Enterprise AI Teacher Copilot. Sticker anchors
 * at the top of Indian prosumer AI SaaS (₹599/mo — same band as Notion
 * Business / Canva Pro team seats), and we publish honest launch discounts
 * on monthly plus a standard 16% annual incentive on top.
 *
 *   Sticker monthly   : ₹599/mo/teacher    (never paid — premium anchor)
 *   Sticker annual    : ₹7,188/yr/teacher  (12 × sticker monthly)
 *   Launch monthly    : ₹199/mo/teacher    (~67% off, "Launch pricing 2026")
 *   Launch annual     : ₹1,999/yr/teacher  (~72% off sticker, ≈ ₹167/mo,
 *                       16% cheaper than monthly × 12 — standard SaaS
 *                       annual discount à la Slack / Notion / Canva.)
 *                       Saves ₹389/yr vs monthly.
 *   School Gold       : ₹2,999/teacher/yr  (min 20 teachers, principal PO)
 *                       — 58% off sticker. Gold is 50% more per-seat than
 *                       individual annual because it bundles school admin
 *                       dashboard, bulk onboarding, WhatsApp Business,
 *                       priority support, and 5× voice cloud (1500 min).
 *                       Mirrors the Slack Pro → Business+, Notion Plus →
 *                       Business, Canva Pro → Teams premium.
 *   School Premium    : custom, floor ₹1,999/teacher/yr for chains / govt
 *
 * All amounts stored in paise for Razorpay + rupees for display. Plan IDs in
 * Razorpay dashboard must be updated whenever these numbers change (see
 * `src/lib/razorpay.ts` and env vars RAZORPAY_PLAN_PRO_MONTHLY / _ANNUAL).
 */
/**
 * Sticker anchor update (2026-04-24). Previous anchors (₹599/mo, ₹7,188/yr)
 * implied post-launch prices at 3× current — not credible and read as bait.
 * New anchors put the "launch price → normal price" step at ~2×, which is
 * the maximum a buyer will believe you would raise to. Volume (gold) rate
 * anchored at ~1.7× current — also more defensible.
 *
 * IMPORTANT: Razorpay-facing amounts (`paise`, `rupees`) are UNCHANGED.
 * Only display/anchor fields (`stickerRupees`, `stickerLabel`, `discountPct`,
 * `badge`) are updated. No Razorpay dashboard update required.
 */
export const PLAN_PRICING = {
    pro: {
        monthly: {
            paise: 19900,
            rupees: 199,
            stickerRupees: 399,
            discountPct: 50,
            label: '₹199/month',
            stickerLabel: '₹399/month',
            badge: 'Launch pricing · save ₹200/mo',
        },
        annual: {
            paise: 199900,
            rupees: 1999,
            stickerRupees: 3999,
            discountPct: 50,
            effectivePerMonthRupees: 167,
            label: '₹1,999/year',
            stickerLabel: '₹3,999/year',
            badge: 'Save ₹2,000/year · ₹167/month billed annually',
        },
    },
    gold: {
        annual: {
            paise: 299900,
            rupees: 2999,
            stickerRupees: 4999,
            discountPct: 40,
            minSeats: 20,
            onboardingRupees: 10000,
            label: '₹2,999/teacher/year',
            stickerLabel: '₹4,999/teacher/year',
            badge: 'School rate · min 20 teachers',
            // Volume ladder — surfaced as a small table under the Gold price.
            volumeTiers: [
                { minSeats: 20, maxSeats: 49, rupees: 2999, label: '20–49 teachers' },
                { minSeats: 50, maxSeats: 99, rupees: 2499, label: '50–99 teachers' },
                { minSeats: 100, maxSeats: 249, rupees: 1999, label: '100–249 teachers' },
                { minSeats: 250, maxSeats: null as number | null, rupees: null as number | null, label: '250+ teachers (custom quote)' },
            ] as const,
        },
    },
    premium: {
        annual: {
            floorRupees: 1999,
            label: 'From ₹1,999/teacher/year',
            badge: 'Chains, premium schools, govt tenders · custom quote',
        },
    },
} as const;
