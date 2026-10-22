/**
 * @jest-environment node
 *
 * CLASS GATE 14 — D4 audio says "today" on the closure day and "tomorrow" only
 * on the day before (chosen at the moment of dialling, from the IST calendar),
 * and the intent expires after the closure day.
 */
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { chooseClosureVariant, closureExpiry, istDateString } from '@/lib/sampark/closure';
import { runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { campaignDedupeKey, intentIdFor } from '@/lib/sampark/intents';
import { istInstant } from '@/lib/sampark/policy/ist';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { Campaign } from '@/types/sampark';

import { campaign, DEFAULT_OPTS, deps, ORG, school, scriptedCarrier, seedFamilies, testClock } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const CLOSURE = '2026-10-08'; // Thursday

describe('class gate 14 — chooseClosureVariant around IST midnight', () => {
    it.each([
        ['2026-10-06T18:29:59Z', null], //         10-06 23:59:59 IST — two days before: too early
        ['2026-10-06T18:30:00Z', 'tomorrow'], //   10-07 00:00:00 IST
        ['2026-10-07T18:29:59Z', 'tomorrow'], //   10-07 23:59:59 IST
        ['2026-10-07T18:30:00Z', 'today'], //      10-08 00:00:00 IST
        ['2026-10-08T00:30:00Z', 'today'], //      10-08 06:00 IST
        ['2026-10-08T18:29:59.999Z', 'today'], //  10-08 23:59:59.999 IST
        ['2026-10-08T18:30:00Z', null], //         10-09 00:00 IST — expired
    ])('at %s → %s', (instant, expected) => {
        expect(chooseClosureVariant(CLOSURE, new Date(instant))).toBe(expected);
    });

    it('works across month and year ends', () => {
        expect(chooseClosureVariant('2026-11-01', new Date('2026-10-31T12:00:00Z'))).toBe('tomorrow');
        expect(chooseClosureVariant('2027-01-01', new Date('2026-12-31T18:29:59Z'))).toBe('tomorrow');
        expect(chooseClosureVariant('2027-01-01', new Date('2026-12-31T18:30:00Z'))).toBe('today');
    });

    it('rejects malformed dates', () => {
        expect(chooseClosureVariant('2026-02-30', new Date('2026-02-28T12:00:00Z'))).toBeNull();
        expect(chooseClosureVariant('08/10/2026', new Date())).toBeNull();
        expect(() => closureExpiry('not-a-date')).toThrow();
    });

    it('closureExpiry is 23:59:59.999 IST on the closure day; istDateString follows IST', () => {
        expect(closureExpiry(CLOSURE).toISOString()).toBe('2026-10-08T18:29:59.999Z');
        expect(istDateString(new Date('2026-10-07T18:29:59Z'))).toBe('2026-10-07');
        expect(istDateString(new Date('2026-10-07T18:30:00Z'))).toBe('2026-10-08');
    });
});

describe('class gate 14 — through the dispatcher', () => {
    async function setup(fate: 'no_answer' | 'full' = 'no_answer') {
        const repo = createMemorySamparkRepo();
        const clock = testClock(istInstant('2026-10-07', 20)); // the evening before
        await seedFamilies(repo, 1);
        const c: Campaign = campaign({
            id: 'camp-d4',
            mode: 'practice', // approved in the school's mode (H2)
            purpose: 'emergency_closure',
            facts: { kind: 'emergency_closure', date: CLOSURE, reason: 'rain_landslide', busesRunning: false },
            expiresAt: closureExpiry(CLOSURE).toISOString(),
        });
        await repo.createCampaign(c);
        await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');
        const carrier = scriptedCarrier(() => fate);
        const variantsHeard: string[] = [];
        const d = deps(repo, clock, carrier, {
            audioSecondsFor: async (_s, _i, variant) => {
                variantsHeard.push(variant);
                return 30;
            },
        });
        return { repo, clock, carrier, d, id: intentIdFor(campaignDedupeKey('camp-d4', 'g001')), variantsHeard };
    }

    it('says "tomorrow" the evening before, and "today" when a retry crosses IST midnight', async () => {
        const { repo, clock, carrier, d, id, variantsHeard } = await setup();
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.requests[0].call.variant).toBe('tomorrow');
        expect((await repo.getIntent(ORG, id))?.notBefore).toBe(new Date(clock.now().getTime() + 15 * 60_000).toISOString());

        // 20:15 → second attempt, still the day before.
        clock.advance(15 * 60_000);
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.requests[1].call.variant).toBe('tomorrow');

        // 20:30 retry is due, but by now it is 21:05: the emergency window has closed, so it is deferred to 06:00.
        clock.set(istInstant('2026-10-07', 21, 5));
        const deferred = await runDispatchTick(d, DEFAULT_OPTS);
        expect(deferred.deferred).toBe(1);
        expect((await repo.getIntent(ORG, id))?.notBefore).toBe(istInstant(CLOSURE, 6).toISOString());

        // 06:00 on the closure day — a Thursday, but D4 ignores off-days anyway.
        clock.set(istInstant(CLOSURE, 6));
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.requests[2].call.variant).toBe('today');
        expect(variantsHeard).toEqual(['tomorrow', 'tomorrow', 'today']);
        expect((await repo.getIntent(ORG, id))?.status).toBe('done'); // three attempts, exhausted
    });

    it('an intent is expired, never dialled, once the closure day is over', async () => {
        const { repo, clock, carrier, d, id } = await setup();
        clock.set(new Date(closureExpiry(CLOSURE).getTime() + 1));
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.requests).toHaveLength(0);
        expect((await repo.getIntent(ORG, id))?.status).toBe('expired');
        expect((await repo.getCampaign(ORG, 'camp-d4'))?.status).toBe('completed');
    });

    it('a pending retry on the closure evening expires rather than carrying over', async () => {
        const { repo, clock, carrier, d, id } = await setup();
        clock.set(istInstant(CLOSURE, 20, 50));
        await runDispatchTick(d, DEFAULT_OPTS); // attempt 1 'today', no answer; retry 21:05 → next opening 06:00 tomorrow
        expect(carrier.requests[0].call.variant).toBe('today');
        clock.set(istInstant(CLOSURE, 21, 10));
        await runDispatchTick(d, DEFAULT_OPTS);
        expect((await repo.getIntent(ORG, id))?.status).toBe('expired');
        clock.set(istInstant('2026-10-09', 6));
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.requests).toHaveLength(1);
    });

    it('a closure declared days ahead waits for the day before instead of expiring', async () => {
        const { repo, clock, carrier, d, id } = await setup();
        clock.set(istInstant('2026-10-05', 12));
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.requests).toHaveLength(0);
        expect(await repo.getIntent(ORG, id)).toMatchObject({ status: 'approved', notBefore: istInstant('2026-10-07', 6).toISOString() });
    });
});
