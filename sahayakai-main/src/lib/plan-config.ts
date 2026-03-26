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
    | 'voice-to-text';  // cloud fallback only (browser SpeechRecognition is free)

export interface PlanLimits {
    /** Per-feature monthly limits. -1 = unlimited. */
    limits: Record<GatedFeature, number>;
    /** Instant Answer has a separate daily limit (in addition to monthly). -1 = no daily cap. */
    instantAnswerDailyLimit: number;
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
        },
        instantAnswerDailyLimit: 20,
        model: 'gemini-2.0-flash-lite',
        canExport: false,
        canViewDetailedAnalytics: false,
        canAccessAbsenceRecords: false,
        canUseParentMessaging: false,
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
        },
        instantAnswerDailyLimit: -1,
        model: 'gemini-2.0-flash',
        canExport: true,
        canViewDetailedAnalytics: true,
        canAccessAbsenceRecords: true,
        canUseParentMessaging: true,
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
        },
        instantAnswerDailyLimit: -1,
        model: 'gemini-2.0-flash',
        canExport: true,
        canViewDetailedAnalytics: true,
        canAccessAbsenceRecords: true,
        canUseParentMessaging: true,
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
        },
        instantAnswerDailyLimit: -1,
        model: 'gemini-2.0-flash',
        canExport: true,
        canViewDetailedAnalytics: true,
        canAccessAbsenceRecords: true,
        canUseParentMessaging: true,
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

/** Plan prices in paise (for Razorpay) and rupees (for display). */
export const PLAN_PRICING = {
    pro: {
        monthly: { paise: 14900, rupees: 149, label: '₹149/month' },
        annual: { paise: 139900, rupees: 1399, label: '₹1,399/year' },
    },
} as const;
