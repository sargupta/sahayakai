/**
 * AtithiVani flow orchestration & feedback result persistence (SP-10).
 * Strictly isolated from school-call stores and school-policy gates.
 */

import { evaluateAtithiPolicy, type AtithiPolicyOptions } from './policy';
import { renderAtithiScript, type AtithiScript } from './script';
import type {
    AtithiCallContext,
    AtithiCarrier,
    AtithiFeedbackResult,
    AtithiGuestStay,
    AtithiLanguage,
    AtithiPolicyVerdict,
    AtithiSentiment,
} from './types';

export interface AtithiFeedbackStore {
    saveFeedback(result: AtithiFeedbackResult): Promise<void>;
    getFeedback(callId: string): Promise<AtithiFeedbackResult | null>;
    listStayFeedback(stayId: string): Promise<AtithiFeedbackResult[]>;
}

export class MemoryAtithiFeedbackStore implements AtithiFeedbackStore {
    private readonly records = new Map<string, AtithiFeedbackResult>();

    async saveFeedback(result: AtithiFeedbackResult): Promise<void> {
        this.records.set(result.callId, {
            ...result,
            highlights: [...result.highlights],
            issues: [...result.issues],
        });
    }

    async getFeedback(callId: string): Promise<AtithiFeedbackResult | null> {
        return this.records.get(callId) ?? null;
    }

    async listStayFeedback(stayId: string): Promise<AtithiFeedbackResult[]> {
        return [...this.records.values()].filter((r) => r.stayId === stayId);
    }
}

export interface PreparedAtithiCall {
    verdict: AtithiPolicyVerdict;
    context: AtithiCallContext | null;
    script: AtithiScript | null;
}

export function prepareAtithiFeedbackCall(stay: AtithiGuestStay, opts: AtithiPolicyOptions): PreparedAtithiCall {
    const verdict = evaluateAtithiPolicy(stay, opts);
    if (verdict.kind !== 'allow') {
        return { verdict, context: null, script: null };
    }
    return {
        verdict,
        context: {
            productContext: 'atithivani',
            tenantId: stay.tenantId,
            hotelName: stay.hotelName,
            guestId: stay.guestId,
            stayId: stay.stayId,
            guestName: stay.guestName,
            lang: stay.language,
        },
        script: renderAtithiScript(stay.language, stay.guestName, stay.hotelName),
    };
}

export interface RawAtithiCallOutcome {
    callId: string;
    stay: AtithiGuestStay;
    carrier: AtithiCarrier;
    overallRating?: number | null;
    sentiment?: AtithiSentiment;
    roomCleanliness?: string | null;
    hospitality?: string | null;
    highlights?: string[];
    issues?: string[];
    callbackRequested?: boolean;
    optedOut?: boolean;
    recordingUrl?: string | null;
    savedAt?: string;
}

function clampRating(rating: number | null | undefined): number | null {
    if (typeof rating !== 'number' || !Number.isFinite(rating)) return null;
    const rounded = Math.round(rating);
    if (rounded < 1 || rounded > 5) return null;
    return rounded;
}

function inferSentiment(rating: number | null, issues: string[], explicit?: AtithiSentiment): AtithiSentiment {
    if (explicit) return explicit;
    if (issues.length > 0 || (rating !== null && rating <= 2)) return 'negative';
    if (rating !== null && rating >= 4) return 'positive';
    return 'neutral';
}

export async function saveAtithiFeedbackResult(
    store: AtithiFeedbackStore,
    outcome: RawAtithiCallOutcome,
): Promise<AtithiFeedbackResult> {
    const overallRating = clampRating(outcome.overallRating);
    const issues = (outcome.issues ?? []).map((s) => s.trim()).filter(Boolean);
    const highlights = (outcome.highlights ?? []).map((s) => s.trim()).filter(Boolean);
    const record: AtithiFeedbackResult = {
        callId: outcome.callId,
        tenantId: outcome.stay.tenantId,
        hotelName: outcome.stay.hotelName,
        stayId: outcome.stay.stayId,
        guestId: outcome.stay.guestId,
        language: outcome.stay.language as AtithiLanguage,
        carrier: outcome.carrier,
        overallRating,
        sentiment: inferSentiment(overallRating, issues, outcome.sentiment),
        roomCleanliness: outcome.roomCleanliness?.trim() || null,
        hospitality: outcome.hospitality?.trim() || null,
        highlights,
        issues,
        callbackRequested: Boolean(outcome.callbackRequested),
        optedOut: Boolean(outcome.optedOut),
        recordingUrl: outcome.recordingUrl?.trim() || null,
        savedAt: outcome.savedAt ?? new Date().toISOString(),
    };
    await store.saveFeedback(record);
    return record;
}
