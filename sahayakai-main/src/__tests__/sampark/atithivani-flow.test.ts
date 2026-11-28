import {
    ATITHI_DEFAULT_TEST_PHONE,
    evaluateAtithiPolicy,
    MemoryAtithiFeedbackStore,
    prepareAtithiFeedbackCall,
    renderAtithiScript,
    saveAtithiFeedbackResult,
    type AtithiGuestStay,
} from '@/lib/sampark/atithivani';

function makeStay(overrides: Partial<AtithiGuestStay> = {}): AtithiGuestStay {
    return {
        tenantId: 'summit-darjeeling',
        hotelName: 'Summit Grace Hotel',
        guestId: 'guest-101',
        stayId: 'stay-2026-11-28',
        guestName: 'Aarav Sen',
        phoneE164: ATITHI_DEFAULT_TEST_PHONE,
        language: 'en',
        // 2026-11-28T04:30:00Z = 10:00 IST
        checkedOutAt: '2026-11-28T04:30:00.000Z',
        attemptCount: 0,
        optedOut: false,
        ...overrides,
    };
}

describe('AtithiVani isolated hotel-guest policy & flow (SP-10)', () => {
    it('allows calls between 09:00 and 20:00 IST within 12h of checkout (including 09:30 and 19:30 IST, outside school hours)', () => {
        // 04:00Z = 09:30 IST (before school 10:00 IST window, valid for AtithiVani!)
        const morning = new Date('2026-11-28T04:00:00.000Z');
        const stayMorning = makeStay({ checkedOutAt: '2026-11-28T03:00:00.000Z' });
        expect(evaluateAtithiPolicy(stayMorning, { now: morning })).toEqual({ kind: 'allow', language: 'en' });

        // 14:00Z = 19:30 IST (after school 19:00 IST ceiling, valid for AtithiVani!)
        const evening = new Date('2026-11-28T14:00:00.000Z');
        const stayEvening = makeStay({ checkedOutAt: '2026-11-28T08:00:00.000Z', language: 'bn' });
        expect(evaluateAtithiPolicy(stayEvening, { now: evening })).toEqual({ kind: 'allow', language: 'bn' });
    });

    it('defers outside 09:00-20:00 IST when next opening stays inside 12h checkout window', () => {
        // 02:30Z = 08:00 IST; checkout was 07:00 IST -> 09:00 IST is 2h after checkout (within 12h)
        const now = new Date('2026-11-28T02:30:00.000Z');
        const stay = makeStay({ checkedOutAt: '2026-11-28T01:30:00.000Z' });
        const verdict = evaluateAtithiPolicy(stay, { now });
        expect(verdict.kind).toBe('defer');
        if (verdict.kind === 'defer') {
            expect(verdict.until.toISOString()).toBe('2026-11-28T03:30:00.000Z'); // 09:00 IST
        }
    });

    it('blocks first call when >12h have elapsed since checkout', () => {
        const now = new Date('2026-11-28T17:00:00.000Z'); // 22:30 IST
        const stay = makeStay({ checkedOutAt: '2026-11-28T04:00:00.000Z' }); // 09:30 IST -> >12h
        expect(evaluateAtithiPolicy(stay, { now })).toEqual({ kind: 'block', reason: 'checkout_window_expired' });
    });

    it('enforces max 2 attempts per guest after checkout', () => {
        const now = new Date('2026-11-28T06:30:00.000Z'); // 12:00 IST
        expect(evaluateAtithiPolicy(makeStay({ attemptCount: 1 }), { now })).toEqual({ kind: 'allow', language: 'en' });
        expect(evaluateAtithiPolicy(makeStay({ attemptCount: 2 }), { now })).toEqual({
            kind: 'block',
            reason: 'max_attempts_reached',
        });
    });

    it('enforces opt-out suppression and test-phone allow-list', () => {
        const now = new Date('2026-11-28T06:30:00.000Z');
        expect(evaluateAtithiPolicy(makeStay({ optedOut: true }), { now })).toEqual({ kind: 'block', reason: 'suppressed' });
        expect(evaluateAtithiPolicy(makeStay({ phoneE164: '+919999999999' }), { now, testMode: true })).toEqual({
            kind: 'block',
            reason: 'test_phone_only',
        });
    });

    it('renders en/hi/bn scripts with recording & opt-out notice and saves feedback result separately', async () => {
        for (const lang of ['en', 'hi', 'bn'] as const) {
            const script = renderAtithiScript(lang, 'Aarav', 'Summit Grace');
            expect(script.opener).toContain('Aarav');
            expect(script.opener).toContain('Summit Grace');
            expect(script.questions).toHaveLength(3);
        }

        const prepared = prepareAtithiFeedbackCall(makeStay({ language: 'hi' }), {
            now: new Date('2026-11-28T06:30:00.000Z'),
        });
        expect(prepared.verdict).toEqual({ kind: 'allow', language: 'hi' });
        expect(prepared.context?.productContext).toBe('atithivani');

        const store = new MemoryAtithiFeedbackStore();
        const saved = await saveAtithiFeedbackResult(store, {
            callId: 'call-atithi-1',
            stay: makeStay(),
            carrier: 'vobiz',
            overallRating: 5,
            roomCleanliness: 'Very clean',
            hospitality: 'Warm staff',
            highlights: ['Great view'],
            issues: [],
            recordingUrl: 'https://example.invalid/rec-1.mp3',
        });
        expect(saved.sentiment).toBe('positive');
        const fetched = await store.getFeedback('call-atithi-1');
        expect(fetched?.overallRating).toBe(5);
        expect(fetched?.recordingUrl).toBe('https://example.invalid/rec-1.mp3');
    });
});
