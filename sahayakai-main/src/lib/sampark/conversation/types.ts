/**
 * Riya conversation calls — domain types.
 *
 * Deliberately NOT a `SamparkCall`. A notice call's outcome is classified from the
 * hangup duration against the length of pre-rendered audio (`audioSeconds`,
 * HeardLevel) and from keypad digits; a live agent conversation has neither. Forcing
 * one into the other would make the overview count conversations as "heard" or
 * "hung up early" on numbers that mean nothing for them. Conversation calls live in
 * their own collection with their own lifecycle; they share the school record,
 * guardian snapshot, consent, suppressions, calling window, pause, test phone and
 * audit log with notice calls.
 *
 * PII: like every Sampark record, a call stores the phone's peppered hash and last
 * four digits only. The variables Riya was given are stored because staff must be
 * able to see exactly what was said; they hold the child's first name and the school
 * facts, nothing else.
 */

import type { CallDestination, ParentLanguage, PurposeId, SamparkMode } from '@/types/sampark';

import type { RiyaPurpose, RiyaVariables } from './riya-purposes';

export type ConversationProviderKind = 'simulated' | 'elevenlabs';

export type ConversationCallState =
    | 'initiating'        // record created, provider being contacted
    | 'initiated'         // provider accepted the call (conversation id known); ringing or talking
    | 'completed'         // terminal: a conversation took place and ended
    | 'no_answer'         // terminal: provider reported no answer
    | 'busy'              // terminal: provider reported busy
    | 'failed'            // terminal: provider refused before anything rang (safe to retry by a person)
    | 'unknown';          // terminal until a person looks: we cannot tell whether the phone rang. NEVER auto-redialled.

export const TERMINAL_CONVERSATION_STATES: readonly ConversationCallState[] = ['completed', 'no_answer', 'busy', 'failed', 'unknown'];

export function isTerminalConversationState(s: ConversationCallState): boolean {
    return TERMINAL_CONVERSATION_STATES.includes(s);
}

/** Answers the agent's data-collection extracted, restricted to the known keys and bounded. */
export type RiyaDataCollection = Partial<Record<RiyaDataCollectionKey, string | null>>;

/** The data-collection ids configured on the agent (export of 15 Oct 2026), plus two recommended additions. */
export const RIYA_DATA_COLLECTION_KEYS = [
    'good_time_to_talk',
    'ptm_attendance',
    'ptm_preferred_time',
    'ptm_meeting_mode',
    'event_attendance',
    'late_return_date',
    'exam_absence_date',
    'expected_return_date',
    'child_at_school_during_closure',
    // Recommended additions (not on the agent yet): used when present, never required.
    'recipient_confirmed',
    'stop_requested',
] as const;
export type RiyaDataCollectionKey = (typeof RIYA_DATA_COLLECTION_KEYS)[number];

export interface ConversationTranscriptTurn {
    role: 'agent' | 'user';
    message: string;
    timeInCallSecs: number | null;
}

export interface ConversationCall {
    /** Server-generated: hash(orgId | idempotency key). Also the record id. */
    id: string;
    orgId: string;
    provider: ConversationProviderKind;
    /** The school's mode when the call was placed. */
    mode: SamparkMode;
    destination: CallDestination;
    riyaPurpose: RiyaPurpose;
    /** The Sampark catalogue purpose whose policy applied. */
    purpose: PurposeId;
    guardianId: string;
    studentId: string;
    phoneHash: string;
    phoneLast4: string;
    language: ParentLanguage;
    /** Exactly what the agent was given (no phone numbers, no ids). */
    variables: RiyaVariables;
    /** The line staff approved in the preview. */
    announcement: string;
    /** sha256 of the canonical facts: two calls about the same announcement share it. */
    factsHash: string;
    state: ConversationCallState;
    /** A call still 'initiating' after this is swept to 'unknown' (never re-dialled). */
    leaseUntil: string;
    /** Provider ids. ElevenLabs: conversation_id and the SIP call id. */
    providerConversationId: string | null;
    providerCallId: string | null;
    /** Agent and phone-number ids used (configuration ids, not secrets) — so a misrouted call is provable. */
    agentId: string | null;
    agentPhoneNumberId: string | null;
    durationSeconds: number | null;
    /** Provider statuses / reasons, short machine strings only (never transcript text). */
    providerStatus: string | null;
    terminationReason: string | null;
    failureReason: string | null;
    callSuccessful: 'success' | 'failure' | 'unknown' | null;
    dataCollection: RiyaDataCollection;
    /** The listener asked Riya to stop calling (data collection or a phrase match), pending office confirmation. */
    stopRequested: boolean;
    /** Stored only when SAMPARK_RIYA_STORE_TRANSCRIPTS === 'true'; deleted after transcriptExpiresAt. */
    transcript: ConversationTranscriptTurn[] | null;
    transcriptExpiresAt: string | null;
    /** Ids of webhook events already applied (dedupe), bounded. */
    appliedEvents: string[];
    lastEventAt: string | null;
    /** A person looked at an 'unknown' call (it then no longer blocks another attempt). */
    reviewedAt: string | null;
    reviewedBy: string | null;
    reviewNote: 'did_not_ring' | 'rang' | 'cannot_tell' | null;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    endedAt: string | null;
}

/** The console's view of a call. Transcript only on the detail endpoint. */
export type ConversationCallView = Omit<ConversationCall, 'phoneHash' | 'appliedEvents' | 'transcript'> & {
    guardianDisplayName: string | null;
    studentDisplayName: string | null;
};
