/**
 * Class gate (hardening, 7 Oct 2026): every event time the campaign API accepts can be said
 * in every parent language.
 *
 * Before this gate the API accepted 20:00 to 21:00, which no language's day periods cover, so
 * a campaign was created and then refused at approval (SCRIPT_UNAVAILABLE). The gate walks the
 * whole schema domain (every hour 0–23 × :00/:30), and for each time the schema accepts it
 * renders a PTM invitation in all four languages: the render must succeed.
 */

import { CampaignFactsSchema } from '@/server/sampark/campaigns';
import { defaultVenues } from '@/server/sampark/school';
import { renderNoticeScript } from '@/lib/sampark/scripts/render';
import { PARENT_LANGUAGES, type PtmFacts } from '@/types/sampark';

import { testSchool } from '../voice/_fixtures';

describe('gate-h5: every accepted time is sayable', () => {
    const school = testSchool({ venues: defaultVenues() });
    const venueId = school.venues[0].id;
    const accepted: PtmFacts[] = [];
    for (let hour = 0; hour < 24; hour++) {
        for (const minute of [0, 30] as const) {
            const facts = { kind: 'ptm_invite' as const, date: '2026-10-08', time: { hour, minute }, venueId };
            if (CampaignFactsSchema.safeParse(facts).success) accepted.push(facts);
        }
    }

    it('accepts a working day of times, and nothing after 19:30', () => {
        expect(accepted.length).toBeGreaterThan(20);
        expect(accepted.every((f) => f.time.hour <= 19)).toBe(true);
    });

    it.each(PARENT_LANGUAGES)('%s can say every accepted time', (language) => {
        for (const facts of accepted) {
            expect(() =>
                renderNoticeScript({ purpose: 'ptm_invite', facts, school, language, variant: 'default', audience: { kind: 'school' } }),
            ).not.toThrow();
        }
    });
});
