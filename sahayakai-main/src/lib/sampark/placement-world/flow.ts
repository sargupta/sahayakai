/**
 * Placement World outbound Plivo caller & signed webhook delivery (SP-11).
 *
 * Caller ID is read from `PLACEMENT_WORLD_PLIVO_CALLER_ID` (or `plivoConfig.fromNumber`);
 * synthetic `+919800000206` is the fallback for unit tests only so no real number is committed.
 */

import crypto from 'node:crypto';

import { placePlivoCall, type PlivoConfig, type PlivoPlaceResult } from '@/lib/plivo/client';

import type {
    PlacementCandidate,
    PlacementOutcomeStatus,
    PlacementScreeningAnswers,
    PlacementWebhookPayload,
} from './types';

export const PLACEMENT_WORLD_PLIVO_CALLER_ID =
    process.env.PLACEMENT_WORLD_PLIVO_CALLER_ID?.trim() || '+919800000206';
export const PLACEMENT_WORLD_TEST_PHONE =
    process.env.RIYA_REAL_TEST_NUMBER?.trim() || '+919800000101';

export interface PlacePlacementCallInput {
    plivoConfig: Omit<PlivoConfig, 'fromNumber'> & { fromNumber?: string };
    candidate: PlacementCandidate;
    answerUrl: string;
    hangupUrl: string;
    ringUrl?: string;
    ringTimeout?: number;
    timeLimit?: number;
    testMode?: boolean;
    allowedTestPhones?: readonly string[];
    fetchImpl?: typeof fetch;
}

function normalizeE164(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+91${digits}`;
    return digits ? `+${digits}` : '';
}

export async function placePlacementWorldCall(input: PlacePlacementCallInput): Promise<PlivoPlaceResult> {
    const testMode = input.testMode ?? true;
    const allowed = new Set((input.allowedTestPhones ?? [PLACEMENT_WORLD_TEST_PHONE]).map(normalizeE164));
    const target = normalizeE164(input.candidate.phoneE164);
    if (testMode && !allowed.has(target)) {
        return { ok: false, failure: { category: 'invalid_destination' } };
    }

    const fromNumber = input.plivoConfig.fromNumber?.trim() || PLACEMENT_WORLD_PLIVO_CALLER_ID;
    const cfg: PlivoConfig = {
        authId: input.plivoConfig.authId,
        authToken: input.plivoConfig.authToken,
        baseUrl: input.plivoConfig.baseUrl,
        fromNumber,
    };

    return placePlivoCall(
        cfg,
        {
            to: target,
            answerUrl: input.answerUrl,
            hangupUrl: input.hangupUrl,
            ...(input.ringUrl ? { ringUrl: input.ringUrl } : {}),
            ringTimeout: input.ringTimeout ?? 30,
            timeLimit: input.timeLimit ?? 600,
        },
        input.fetchImpl,
    );
}

export function buildPlacementWebhookPayload(params: {
    callId: string;
    carrierCallId?: string | null;
    callerId?: string;
    candidate: PlacementCandidate;
    status: PlacementOutcomeStatus;
    answers?: Partial<PlacementScreeningAnswers>;
    recordingUrl?: string | null;
    completedAt?: string;
}): PlacementWebhookPayload {
    return {
        event: 'placement_world.screening.completed',
        version: 1,
        callId: params.callId,
        carrierCallId: params.carrierCallId ?? null,
        callerId: params.callerId?.trim() || PLACEMENT_WORLD_PLIVO_CALLER_ID,
        candidateId: params.candidate.candidateId,
        language: params.candidate.language,
        status: params.status,
        answers: {
            availableForInterviews: params.answers?.availableForInterviews ?? null,
            preferredLocation: params.answers?.preferredLocation ?? null,
            shiftFlexible: params.answers?.shiftFlexible ?? null,
            experienceSummary: params.answers?.experienceSummary ?? null,
            expectedMonthlySalary: params.answers?.expectedMonthlySalary ?? null,
            noticePeriod: params.answers?.noticePeriod ?? null,
            callbackRequestedAt: params.answers?.callbackRequestedAt ?? null,
        },
        recordingUrl: params.recordingUrl ?? null,
        completedAt: params.completedAt ?? new Date().toISOString(),
    };
}

export function signPlacementWebhook(secret: string, rawBody: string): string {
    return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

export async function sendPlacementWebhookResult(params: {
    webhookUrl: string;
    signingSecret: string;
    payload: PlacementWebhookPayload;
    fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; status: number | null }> {
    const rawBody = JSON.stringify(params.payload);
    const sig = signPlacementWebhook(params.signingSecret, rawBody);
    const fetchFn = params.fetchImpl ?? fetch;
    try {
        const res = await fetchFn(params.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Placement-Signature': `sha256=${sig}`,
            },
            body: rawBody,
            signal: AbortSignal.timeout(10_000),
        });
        return { ok: res.ok, status: res.status };
    } catch {
        return { ok: false, status: null };
    }
}
