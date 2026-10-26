/** @jest-environment node */
/**
 * GATE (dashboard activity by mode) — the Today charts and feed show the calls of the
 * school's current mode, and only those; the families' numbers stay real calls only.
 *
 * The bug class: a chart or feed on the Today screen that mixes buckets. A Test-mode
 * rehearsal drawn into "calls by hour" next to "Calls to families today" reads as
 * families reached when only the school's own phone rang (H9's bug, one screen over).
 * The rule the overview keeps:
 *   - `today` and `familyTrend` count only real calls to a guardian, in every mode;
 *   - `hours`, `todayByLanguage`, `recent` and `trend` show exactly the bucket of the
 *     school's mode (live → families, test → test phone, practice → simulated), and the
 *     response says which (`activityMode`) so the console can label them honestly.
 *
 * (a) For each mode, with all three buckets seeded today and on earlier days (distinct
 *     sizes, hours, languages and outcomes, so any mixing changes a number), every
 *     activity field equals the mode's bucket and nothing else, and the family fields
 *     equal the family bucket.
 * (b) Every field of SamparkOverview is classified below. A new field fails this gate
 *     until its author decides which calls it shows — the class of bug cannot come back
 *     through a field nobody thought about.
 * (c) End to end: a Test campaign dispatched by the real dispatcher fills the Test
 *     charts and leaves every family number at zero.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { callHeardKeyFact } from '@/lib/sampark/call-outcome';
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { istParts } from '@/lib/sampark/policy/ist';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { SamparkCtx } from '@/server/sampark/http';
import { activityBucket, callBucket, getOverview, RECENT_LIMIT } from '@/server/sampark/overview';
import {
    PARENT_LANGUAGES,
    type CallOutcome,
    type CarrierKind,
    type Intent,
    type ParentLanguage,
    type SamparkCall,
    type SamparkMode,
    type SamparkOverview,
} from '@/types/sampark';

import { campaign, DEFAULT_OPTS, deps, ORG, school, scriptedCarrier, seedFamilies, testClock, testModeSchool, WED_11_IST } from '../engine/_fixtures';

const ENV = process.env.SAMPARK_LIVE_DIAL_ENABLED;
afterEach(() => {
    if (ENV === undefined) delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    else process.env.SAMPARK_LIVE_DIAL_ENABLED = ENV;
});

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

const OUTCOMES: CallOutcome[] = [
    { heard: 'full', digits: '1', confirmed: true, declined: false, optOut: 'none' },
    { heard: 'partial', digits: '2', confirmed: false, declined: true, optOut: 'none' },
    { heard: 'full', digits: '99', confirmed: false, declined: false, optOut: 'confirmed' },
    { heard: 'none', digits: '', confirmed: false, declined: false, optOut: 'none' },
    { heard: 'full', digits: '', confirmed: false, declined: false, optOut: 'none' },
];

type Bucket = ReturnType<typeof callBucket>;

/**
 * Each bucket gets a different number of calls, spread over different hours (from 10:00
 * IST on WED_11_IST's day), languages and outcomes. Family calls alternate between an
 * explicit 'guardian' destination and none (records from before phase 2a).
 */
const PLAN: Record<Bucket, { carrier: CarrierKind; destination: SamparkCall['destination'] | 'absent' | 'mixed'; today: number; earlier: number }> = {
    family: { carrier: 'vobiz', destination: 'mixed', today: 3, earlier: 2 },
    test: { carrier: 'vobiz', destination: 'test_phone', today: 5, earlier: 4 },
    practice: { carrier: 'simulated', destination: 'mixed', today: 7, earlier: 1 },
};

const DAY_START = new Date(WED_11_IST.getTime() - HOUR); // 10:00 IST

function intent(id: string, at: string): Intent {
    return {
        id, dedupeKey: `gate:${id}`, orgId: ORG, campaignId: 'c1', purpose: 'ptm_invite', guardianId: `g-${id}`, studentIds: [],
        language: 'Hindi', status: 'approved', blockReason: null, attempts: 0, maxAttempts: 3, notBefore: null,
        expiresAt: '2027-01-01T00:00:00.000Z', lastCallId: null, createdAt: at, updatedAt: at,
    };
}

function call(id: string, at: string, carrier: CarrierKind, destination: SamparkCall['destination'] | 'absent', language: ParentLanguage, outcome: CallOutcome): SamparkCall {
    const c: SamparkCall = {
        id: `call-${id}`, orgId: ORG, intentId: id, campaignId: 'c1', purpose: 'ptm_invite', guardianId: `g-${id}`, phoneHash: `hash:${id}`,
        phoneLast4: '0000', language, variant: 'default', attempt: 1, state: 'dialing', leaseUntil: at, carrier,
        providerCallId: null, outcome, durationSeconds: 30, billedSeconds: 60, costPaise: null, audioSeconds: 30,
        createdAt: at, updatedAt: at, endedAt: at, failureReason: null,
    };
    if (destination !== 'absent') c.destination = destination;
    return c;
}

/** Seed every bucket through the real claim path; returns the stored calls (state 'completed'). */
async function seedAllBuckets(mode: SamparkMode) {
    const repo = createMemorySamparkRepo();
    await repo.upsertSchool(school({ mode }));
    const ctx: SamparkCtx = { repo, clock: testClock(WED_11_IST) };
    const stored: SamparkCall[] = [];
    let n = 0;
    const offsets: Record<Bucket, number> = { family: 0, test: 1, practice: 2 };
    for (const bucket of Object.keys(PLAN) as Bucket[]) {
        const plan = PLAN[bucket];
        const add = async (at: Date, i: number) => {
            const id = `${bucket}-${n++}`;
            const destination = plan.destination === 'mixed' ? (i % 2 ? 'guardian' : 'absent') : plan.destination;
            const language = PARENT_LANGUAGES[(i + offsets[bucket]) % PARENT_LANGUAGES.length];
            const c = call(id, at.toISOString(), plan.carrier, destination, language, OUTCOMES[(i + offsets[bucket]) % OUTCOMES.length]);
            await repo.createIntentIfAbsent(intent(id, c.createdAt));
            expect(await repo.claimIntentForDial(ORG, id, c, at)).toBe('claimed');
            await repo.updateCall(ORG, c.id, { state: 'completed' });
            stored.push({ ...c, state: 'completed' });
        };
        // Today: one call every 17 minutes from 10:00 + the bucket's offset, so buckets fill different hours.
        for (let i = 0; i < plan.today; i++) await add(new Date(DAY_START.getTime() + (offsets[bucket] * 25 + i * 17) * 60_000), i);
        // Earlier days: one call a day, going back.
        for (let i = 0; i < plan.earlier; i++) await add(new Date(WED_11_IST.getTime() - (i + 1) * DAY), i);
    }
    return { ctx, stored };
}

const istDate = (iso: string) => istParts(new Date(iso)).date;
const istHour = (iso: string) => istParts(new Date(iso)).hour;

function expectActivityIs(o: SamparkOverview, calls: SamparkCall[], todayDate: string) {
    const todays = calls.filter((c) => istDate(c.createdAt) === todayDate);

    // hours: per hour, exactly this bucket's calls (and none outside it).
    expect(o.hours.reduce((s, h) => s + h.calls, 0)).toBe(todays.length);
    for (const h of o.hours) {
        const inHour = todays.filter((c) => istHour(c.createdAt) === h.hour);
        expect(h).toEqual({ hour: h.hour, calls: inHour.length, heard: inHour.filter(callHeardKeyFact).length });
    }

    // todayByLanguage: per language.
    for (const lang of PARENT_LANGUAGES) {
        const inLang = todays.filter((c) => c.language === lang);
        expect(o.todayByLanguage[lang]).toEqual({ calls: inLang.length, heard: inLang.filter(callHeardKeyFact).length });
    }

    // recent: the newest of this bucket today, and only those.
    const ids = new Set(todays.map((c) => c.id));
    expect(o.recent.length).toBe(Math.min(RECENT_LIMIT, todays.length));
    for (const r of o.recent) expect(ids.has(r.id)).toBe(true);
    const newest = [...todays].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT_LIMIT).map((c) => c.id);
    expect(o.recent.map((r) => r.id)).toEqual(newest);

    // trend: per day, this bucket.
    expectTrendIs(o.trend, calls);
}

function expectTrendIs(trend: SamparkOverview['trend'], calls: SamparkCall[]) {
    expect(trend).toHaveLength(7);
    for (const day of trend) {
        const onDay = calls.filter((c) => istDate(c.createdAt) === day.date);
        expect(day).toEqual({
            date: day.date,
            calls: onDay.length,
            heard: onDay.filter(callHeardKeyFact).length,
            confirmed: onDay.filter((c) => c.outcome.confirmed).length,
            optOuts: onDay.filter((c) => c.outcome.optOut !== 'none').length,
            complete: true,
        });
    }
}

describe('gate — the Today charts and feed show only the current mode, and families stay real', () => {
    it.each<SamparkMode>(['live', 'test', 'practice'])('in %s mode every activity field is that mode’s bucket, every family field is real calls', async (mode) => {
        const { ctx, stored } = await seedAllBuckets(mode);
        const o = await getOverview(ctx, ORG);
        const todayDate = istDate(WED_11_IST.toISOString());

        expect(o.activityMode).toBe(mode);
        const bucket = activityBucket(mode);
        expect(bucket).toBe(mode === 'live' ? 'family' : mode);
        expectActivityIs(o, stored.filter((c) => callBucket(c) === bucket), todayDate);

        // The family numbers never move with the mode.
        const family = stored.filter((c) => callBucket(c) === 'family');
        const familyToday = family.filter((c) => istDate(c.createdAt) === todayDate);
        expect(o.today.calls).toBe(familyToday.length);
        expect(o.today.heardKeyFact).toBe(familyToday.filter(callHeardKeyFact).length);
        expectTrendIs(o.familyTrend, family);

        // The seed really is mixed, so a leak would have shown: every bucket has calls today.
        for (const b of ['family', 'test', 'practice'] as const) {
            expect(stored.filter((c) => callBucket(c) === b && istDate(c.createdAt) === todayDate).length).toBe(PLAN[b].today);
        }
    });

    it('every overview field is classified: family-only, current mode, or not call-derived', async () => {
        const { ctx } = await seedAllBuckets('test');
        const o = await getOverview(ctx, ORG);
        // If this fails, a field was added to SamparkOverview: decide which calls it shows,
        // add it to one list, and cover it in the test above if it is call-derived.
        const FAMILY_ONLY = ['today', 'familyTrend'];
        const ACTIVITY_MODE = ['activityMode', 'hours', 'todayByLanguage', 'recent', 'trend'];
        const REHEARSAL = ['rehearsal'];
        const NOT_CALL_DERIVED = [
            'school', 'windowOpenNow', 'nextWindowOpensAt', 'windowToday', 'asOf', 'guardians', 'numbersFlagged',
            'liveCampaign', 'upcoming', 'pause', 'activeCampaigns', 'lastImport',
        ];
        expect(Object.keys(o).sort()).toEqual([...FAMILY_ONLY, ...ACTIVITY_MODE, ...REHEARSAL, ...NOT_CALL_DERIVED].sort());
    });

    it('a Test campaign dispatched for real fills the Test charts and leaves every family number at zero', async () => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        const repo = createMemorySamparkRepo();
        const clock = testClock(WED_11_IST);
        await seedFamilies(repo, 3, { school: testModeSchool() });
        const t = campaign({ id: 'camp-test', mode: 'test' });
        await repo.createCampaign(t);
        await materialiseCampaignIntents({ repo, clock }, t, school(testModeSchool()), 'vobiz');
        const vobiz = scriptedCarrier(() => 'key1', 'vobiz');
        for (let i = 0; i < 3; i++) {
            await runDispatchTick(deps(repo, clock, vobiz), DEFAULT_OPTS);
            clock.advance(60_000);
        }
        const dialled = vobiz.requests.length;
        expect(dialled).toBeGreaterThan(0);

        const o = await getOverview({ repo, clock }, ORG);
        expect(o.activityMode).toBe('test');
        expect(o.today).toEqual({ calls: 0, heardKeyFact: 0, confirmedYes: 0, optOuts: 0 });
        expect(o.familyTrend.every((d) => d.calls === 0)).toBe(true);
        expect(o.hours.reduce((s, h) => s + h.calls, 0)).toBe(dialled);
        expect(o.trend[o.trend.length - 1].calls).toBe(dialled);
        expect(o.recent.length).toBe(Math.min(RECENT_LIMIT, dialled));
        for (const r of o.recent) {
            expect(r.destination).toBe('test_phone');
            expect(r.outcomeClass).toBe('confirmed');
        }
    });
});
