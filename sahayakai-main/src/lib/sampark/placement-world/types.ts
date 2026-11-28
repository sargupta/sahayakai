/**
 * Placement World screening call types (SP-11).
 */

export type PlacementLanguage = 'en' | 'hi' | 'bn';

export type PlacementEdgeCase = 'wrong_person' | 'call_back_later' | 'no_answer' | 'refuses';

export type PlacementOutcomeStatus = 'completed' | PlacementEdgeCase;

export interface PlacementCandidate {
    candidateId: string;
    candidateName: string;
    phoneE164: string;
    language: PlacementLanguage;
    roleTitle?: string;
    /** Spoken ONLY at the end of the call (closing stage), never in the opener. */
    feeTerms?: string;
}

export interface PlacementScreeningAnswers {
    availableForInterviews: boolean | null;
    preferredLocation: string | null;
    shiftFlexible: boolean | null;
    experienceSummary: string | null;
    expectedMonthlySalary: string | null;
    noticePeriod: string | null;
    callbackRequestedAt: string | null;
}

export interface PlacementWebhookPayload {
    event: 'placement_world.screening.completed';
    version: 1;
    callId: string;
    carrierCallId: string | null;
    callerId: string;
    candidateId: string;
    language: PlacementLanguage;
    status: PlacementOutcomeStatus;
    answers: PlacementScreeningAnswers;
    recordingUrl: string | null;
    completedAt: string;
}
