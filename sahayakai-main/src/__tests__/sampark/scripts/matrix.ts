/**
 * Shared render matrix for the Sampark script class gates: every available
 * purpose × every variant × a spread of facts (every event type, closure
 * reason, bus state, the special half hours, both audience kinds).
 */

import { availablePurposes } from '@/lib/sampark/catalogue';
import { variantsFor, type AudienceLabel, type ScriptVariant } from '@/lib/sampark/scripts/render';
import { SAMPLE_SCHOOL } from '@/lib/sampark/scripts/samples';
import type { CampaignFacts, ClosureReason, EventType, PurposeId, SamparkSchool, SpokenTime } from '@/types/sampark';

export const EVENT_TYPES: EventType[] = ['annual_day', 'sports_day', 'science_fair', 'cultural_programme', 'parent_workshop'];
export const CLOSURE_REASONS: ClosureReason[] = ['rain_landslide', 'heavy_rain', 'bandh', 'local_emergency'];
export const TIMES: SpokenTime[] = [
    { hour: 10, minute: 0 },
    { hour: 10, minute: 30 },
    { hour: 12, minute: 0 },
    { hour: 13, minute: 30 },
    { hour: 14, minute: 30 },
    { hour: 16, minute: 0 },
    { hour: 18, minute: 30 },
];
export const AUDIENCES: AudienceLabel[] = [
    { kind: 'school' },
    { kind: 'section', grade: 7, section: 'B' },
    { kind: 'section', grade: 1, section: 'A' },
    { kind: 'section', grade: 12, section: 'F' },
];
export const VENUE_IDS = ['school_hall', 'main_ground', 'auditorium'];

/** A school with one venue of its own, so school-supplied names are exercised too. */
export const MATRIX_SCHOOL: SamparkSchool = {
    ...SAMPLE_SCHOOL,
    venues: [
        {
            id: 'library',
            names: { English: 'the library', Hindi: 'पुस्तकालय', Bengali: 'লাইব্রেরি', Nepali: 'पुस्तकालय' },
        },
    ],
};

export interface MatrixCase {
    purpose: PurposeId;
    variant: ScriptVariant;
    facts: CampaignFacts;
    audience: AudienceLabel;
    label: string;
}

function factsFor(purpose: PurposeId): CampaignFacts[] {
    const venues = [...VENUE_IDS, 'library'];
    switch (purpose) {
        case 'ptm_invite':
            return TIMES.flatMap((time, i) => [{ kind: 'ptm_invite', date: '2026-10-10', time, venueId: venues[i % venues.length] } as CampaignFacts]);
        case 'event_invite':
            return EVENT_TYPES.map(
                (eventType, i) =>
                    ({ kind: 'event_invite', eventType, date: `2026-11-${String(i + 1).padStart(2, '0')}`, time: TIMES[i % TIMES.length], venueId: venues[i % venues.length] }) as CampaignFacts,
            );
        case 'emergency_closure':
            return CLOSURE_REASONS.flatMap((reason) =>
                [true, false].map((busesRunning) => ({ kind: 'emergency_closure', date: '2026-10-08', reason, busesRunning }) as CampaignFacts),
            );
        default:
            throw new Error(`matrix: no facts for ${purpose}`);
    }
}

export function renderMatrix(): MatrixCase[] {
    const cases: MatrixCase[] = [];
    for (const spec of availablePurposes()) {
        for (const variant of variantsFor(spec.id)) {
            factsFor(spec.id).forEach((facts, i) => {
                const audience = AUDIENCES[i % AUDIENCES.length];
                cases.push({ purpose: spec.id, variant, facts, audience, label: `${spec.id}/${variant}/#${i}/${audience.kind}` });
            });
        }
    }
    return cases;
}
