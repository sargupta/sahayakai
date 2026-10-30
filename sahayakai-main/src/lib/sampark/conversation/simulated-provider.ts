/**
 * The simulated Riya provider — Practice mode. No network; nothing rings.
 *
 * It returns what ElevenLabs would: the outbound-call answer, then the webhook events
 * that would follow. The service feeds those events through the SAME reducer real
 * webhooks use (state.ts), so Practice exercises the real lifecycle code, duplicate
 * delivery included.
 *
 * Scenarios are chosen by staff in Practice to rehearse the edge cases; real modes
 * never accept one.
 */

import { z } from 'zod';

import type { OutboundCallResult } from './elevenlabs-client';
import type { RiyaPurpose } from './riya-purposes';
import type { RiyaWebhookEvent } from './webhook';

export const SIMULATION_SCENARIOS = [
    'answered_positive',
    'answered_cannot_attend',
    'no_answer',
    'busy',
    'wrong_person',
    'stop_requested',
    'callback_requested',
    'interrupted',
    'provider_rejected',
    'provider_timeout',
] as const;
export type SimulationScenario = (typeof SIMULATION_SCENARIOS)[number];
export const SimulationScenarioSchema = z.enum(SIMULATION_SCENARIOS);

export const SIMULATED_AGENT_ID = 'agent_simulated0000000000000000';

export interface SimulatedRun {
    start: OutboundCallResult;
    events: RiyaWebhookEvent[];
}

function positiveData(purpose: RiyaPurpose): Record<string, string> {
    switch (purpose) {
        case 'ptm_invitation': return { good_time_to_talk: 'yes', ptm_attendance: 'can_attend' };
        case 'event_invitation': return { good_time_to_talk: 'yes', event_attendance: 'yes' };
        case 'emergency_closure': return { good_time_to_talk: 'yes', child_at_school_during_closure: 'no' };
        default: return { good_time_to_talk: 'yes' };
    }
}

export function simulateRiyaCall(callId: string, purpose: RiyaPurpose, scenario: SimulationScenario, nowSeconds: number): SimulatedRun {
    const conversationId = `sim_${callId.slice(0, 24)}`;
    const base = { agentId: SIMULATED_AGENT_ID, conversationId, eventTimestamp: nowSeconds };
    const accepted: OutboundCallResult = { kind: 'accepted', conversationId, sipCallId: `simsip_${callId.slice(0, 16)}` };
    const postCall = (over: Partial<Extract<RiyaWebhookEvent, { kind: 'post_call' }>>): RiyaWebhookEvent => ({
        kind: 'post_call',
        eventId: `post_call:${conversationId}`,
        ...base,
        userId: callId,
        status: 'done',
        durationSeconds: 48,
        terminationReason: 'end_call tool was called.',
        callSuccessful: 'success',
        dataCollection: positiveData(purpose),
        transcript: [
            { role: 'agent', message: "Hello, I'm Riya, an AI assistant calling on behalf of the school with a school-related update. This conversation is transcribed by our service providers. Is this a good time to talk?", timeInCallSecs: 0 },
            { role: 'user', message: 'Yes, go ahead.', timeInCallSecs: 5 },
        ],
        ...over,
    });

    switch (scenario) {
        case 'answered_positive':
            return { start: accepted, events: [postCall({})] };
        case 'answered_cannot_attend':
            return {
                start: accepted,
                events: [postCall({
                    dataCollection: purpose === 'ptm_invitation'
                        ? { good_time_to_talk: 'yes', ptm_attendance: 'cannot_attend', ptm_preferred_time: 'Saturday after 11 AM' }
                        : { good_time_to_talk: 'yes', event_attendance: 'no' },
                })],
            };
        case 'no_answer':
            return { start: accepted, events: [{ kind: 'initiation_failure', eventId: `initiation_failure:${conversationId}`, ...base, failureReason: 'no-answer' }] };
        case 'busy':
            return { start: accepted, events: [{ kind: 'initiation_failure', eventId: `initiation_failure:${conversationId}`, ...base, failureReason: 'busy' }] };
        case 'wrong_person':
            return {
                start: accepted,
                events: [postCall({
                    durationSeconds: 14,
                    callSuccessful: 'failure',
                    dataCollection: { good_time_to_talk: 'yes', recipient_confirmed: 'no' },
                    transcript: [
                        { role: 'agent', message: 'Am I speaking with the parent or guardian of the student?', timeInCallSecs: 6 },
                        { role: 'user', message: 'No, wrong number.', timeInCallSecs: 9 },
                        { role: 'agent', message: "I'm sorry for the trouble. Have a good day.", timeInCallSecs: 11 },
                    ],
                })],
            };
        case 'stop_requested':
            return {
                start: accepted,
                events: [postCall({
                    durationSeconds: 11,
                    callSuccessful: 'failure',
                    dataCollection: { good_time_to_talk: 'no' },
                    transcript: [{ role: 'user', message: 'Please stop calling me.', timeInCallSecs: 4 }],
                })],
            };
        case 'callback_requested':
            // The parent is busy and asks for a call later: Practice for the callback calendar.
            return {
                start: accepted,
                events: [postCall({
                    durationSeconds: 19,
                    callSuccessful: 'success',
                    dataCollection: { good_time_to_talk: 'no', callback_requested_time: 'in 20 minutes' },
                    transcript: [
                        { role: 'agent', message: "Hello, I'm Riya, an AI assistant calling on behalf of the school with a school-related update. This conversation is transcribed by our service providers. Is this a good time to talk?", timeInCallSecs: 0 },
                        { role: 'user', message: "I'm busy right now. Can you call me back in 20 minutes?", timeInCallSecs: 6 },
                        { role: 'agent', message: "Of course. The school will call you back. Thank you.", timeInCallSecs: 12 },
                    ],
                })],
            };
        case 'interrupted':
            return { start: accepted, events: [postCall({ durationSeconds: 7, terminationReason: 'Call ended by remote party', callSuccessful: 'unknown', dataCollection: { good_time_to_talk: 'no_answer' } })] };
        case 'provider_rejected':
            return { start: { kind: 'rejected', category: 'provider_rejected', httpStatus: 200 }, events: [] };
        case 'provider_timeout':
            return { start: { kind: 'unknown', category: 'timeout', httpStatus: null }, events: [] };
    }
}
