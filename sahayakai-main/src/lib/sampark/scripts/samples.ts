/**
 * Realistic sample facts for previews, the class-gate tests and the
 * verify-voice script: Hillview Demo School (the slice-1 demo school, plan §3.2).
 * PTM on Saturday 10 October 2026 at 10:00 in the school hall for Class 7 B;
 * Annual Day; a rain/landslide closure on Thursday 8 October 2026 with buses
 * not running (Darjeeling schools really closed on 8–10 October 2025).
 *
 * The school's spoken names are per-language data of the school record, not
 * template words — which is why they sit here as a sample record rather than in
 * the call-script JSON.
 */

import type { ClosureFacts, EventFacts, PtmFacts, PurposeId, SamparkSchool, CampaignFacts } from '@/types/sampark';

import type { AudienceLabel } from './types';

export const SAMPLE_SCHOOL: SamparkSchool = {
    orgId: 'hillview-demo',
    spokenName: {
        English: 'Hillview Demo School',
        Hindi: 'हिलव्यू डेमो स्कूल',
        Bengali: 'হিলভিউ ডেমো স্কুল',
        Nepali: 'हिलभ्यू डेमो स्कुल',
    },
    displayName: 'Hillview Demo School, Siliguri',
    mode: 'practice',
    isDemo: true,
    callingWindow: { startHour: 10, endHour: 20, offDays: [0] },
    holidays: [],
    venues: [],
    defaultLanguage: null,
    crm: null,
    emergencyBypassConsent: false,
    createdAt: '2026-09-30T00:00:00.000Z',
    updatedAt: '2026-09-30T00:00:00.000Z',
};

export const SAMPLE_PTM: PtmFacts = { kind: 'ptm_invite', date: '2026-10-10', time: { hour: 10, minute: 0 }, venueId: 'school_hall' };
export const SAMPLE_EVENT: EventFacts = {
    kind: 'event_invite',
    eventType: 'annual_day',
    date: '2026-10-10',
    time: { hour: 10, minute: 0 },
    venueId: 'school_hall',
};
export const SAMPLE_CLOSURE: ClosureFacts = { kind: 'emergency_closure', date: '2026-10-08', reason: 'rain_landslide', busesRunning: false };

export const SAMPLE_SECTION_AUDIENCE: AudienceLabel = { kind: 'section', grade: 7, section: 'B' };

/** The sample facts for an available purpose. */
export function sampleFactsFor(purpose: PurposeId): CampaignFacts {
    switch (purpose) {
        case 'ptm_invite':
            return SAMPLE_PTM;
        case 'event_invite':
            return SAMPLE_EVENT;
        case 'emergency_closure':
            return SAMPLE_CLOSURE;
        default:
            throw new Error(`No sample facts for purpose ${purpose}`);
    }
}
