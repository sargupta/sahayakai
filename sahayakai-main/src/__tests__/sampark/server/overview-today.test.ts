/** @jest-environment node */
/**
 * The Today screen's overview fields beyond the H9 buckets: the campaign the hero
 * card shows, today's calling band, what is coming up, the stop list split into
 * families who asked and numbers to fix, the feed's outcome classes and retry time,
 * the hour chart's range, and the trend's honesty when the call read is cut off.
 * (Which calls the charts show is the dashboard gate's job.)
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { callOutcomeClass } from '@/lib/sampark/call-outcome';
import { emptyCounts } from '@/lib/sampark/dispatch/counts';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { SamparkRepo } from '@/lib/sampark/ports';
import type { SamparkCtx } from '@/server/sampark/http';
import { getOverview, OVERVIEW_CALL_LIMIT } from '@/server/sampark/overview';
import type { CallOutcome, CallState, Intent, SamparkCall, SamparkSchool, Suppression } from '@/types/sampark';

import { campaign, guardian, ORG, school, testClock, WED_11_IST } from '../engine/_fixtures';

const HOUR = 3600 * 1000;
const NONE: CallOutcome = { heard: 'none', digits: '', confirmed: false, declined: false, optOut: 'none' };

async function env(overrides: Partial<SamparkSchool> = {}, at: Date = WED_11_IST) {
    const repo = createMemorySamparkRepo();
    await repo.upsertSchool(school(overrides));
    const ctx: SamparkCtx = { repo, clock: testClock(at) };
    return { repo, ctx };
}

let seq = 0;
async function addCall(
    repo: SamparkRepo,
    at: Date,
    patch: { state?: CallState; outcome?: CallOutcome; carrier?: SamparkCall['carrier']; guardianId?: string; intent?: Partial<Intent> } = {},
): Promise<SamparkCall> {
    const id = `i${seq++}`;
    const iso = at.toISOString();
    const intent: Intent = {
        id, dedupeKey: `t:${id}`, orgId: ORG, campaignId: 'c1', purpose: 'ptm_invite', guardianId: patch.guardianId ?? 'g1', studentIds: [],
        language: 'Nepali', status: 'approved', blockReason: null, attempts: 0, maxAttempts: 3, notBefore: null,
        expiresAt: '2027-01-01T00:00:00.000Z', lastCallId: null, createdAt: iso, updatedAt: iso,
    };
    await repo.createIntentIfAbsent(intent);
    const call: SamparkCall = {
        id: `call-${id}`, orgId: ORG, intentId: id, campaignId: 'c1', purpose: 'ptm_invite', guardianId: patch.guardianId ?? 'g1',
        phoneHash: 'hash:g1', phoneLast4: '4410', language: 'Nepali', variant: 'default', attempt: 1, state: 'dialing',
        leaseUntil: iso, carrier: patch.carrier ?? 'simulated', providerCallId: null, outcome: NONE, durationSeconds: null,
        billedSeconds: null, costPaise: null, audioSeconds: 30, createdAt: iso, updatedAt: iso, endedAt: null, failureReason: null,
    };
    expect(await repo.claimIntentForDial(ORG, id, call, at)).toBe('claimed');
    const state = patch.state ?? 'completed';
    await repo.updateCall(ORG, call.id, { state, outcome: patch.outcome ?? NONE });
    if (patch.intent) await repo.updateIntent(ORG, id, patch.intent);
    return { ...call, state, outcome: patch.outcome ?? NONE };
}

function suppression(phoneHash: string, source: Suppression['source'], officeVerification: Suppression['officeVerification'] = 'pending'): Suppression {
    return { orgId: ORG, phoneHash, phoneLast4: '0000', scope: 'all', source, officeVerification, createdAt: '2026-10-01T00:00:00.000Z', callId: null };
}

describe('overview — the Today screen', () => {
    it('liveCampaign prefers a campaign calling now, then one scheduled, then the newest preparing audio', async () => {
        const { repo, ctx } = await env();
        expect((await getOverview(ctx, ORG)).liveCampaign).toBeNull();

        await repo.createCampaign(campaign({ id: 'old-render', status: 'rendering', createdAt: '2026-10-01T00:00:00.000Z' }));
        await repo.createCampaign(campaign({ id: 'new-render', status: 'rendering', createdAt: '2026-10-02T00:00:00.000Z' }));
        await repo.createCampaign(campaign({ id: 'done', status: 'completed', createdAt: '2026-10-06T00:00:00.000Z' }));
        expect((await getOverview(ctx, ORG)).liveCampaign?.id).toBe('new-render');

        await repo.createCampaign(campaign({ id: 'sched', status: 'scheduled', mode: 'practice', createdAt: '2026-09-30T00:00:00.000Z' }));
        expect((await getOverview(ctx, ORG)).liveCampaign?.id).toBe('sched');

        const counts = { ...emptyCounts(), guardians: 36, blocked: 4, confirmedYes: 19 };
        await repo.createCampaign(campaign({ id: 'calling', status: 'dispatching', mode: 'practice', holdReason: 'school_paused', counts, createdAt: '2026-09-29T00:00:00.000Z' }));
        const live = (await getOverview(ctx, ORG)).liveCampaign;
        expect(live).toMatchObject({ id: 'calling', status: 'dispatching', mode: 'practice', holdReason: 'school_paused', counts, purpose: 'ptm_invite' });
        expect(live?.facts.kind).toBe('ptm_invite');
        expect(live?.audience).toEqual({ sections: [] });
    });

    it('windowToday is the clamped band on an open day, and null on an off-day or a holiday', async () => {
        const open = await env({ callingWindow: { startHour: 8, endHour: 22, offDays: [0] } });
        expect((await getOverview(open.ctx, ORG)).windowToday).toEqual({
            opensAt: '2026-10-07T04:30:00.000Z', // 10:00 IST: a window is never wider than 10:00–20:00
            closesAt: '2026-10-07T14:30:00.000Z', // 20:00 IST
        });
        const offDay = await env({ callingWindow: { startHour: 10, endHour: 19, offDays: [3] } }); // Wednesday off
        expect((await getOverview(offDay.ctx, ORG)).windowToday).toBeNull();
        const holiday = await env({ holidays: ['2026-10-07'] });
        expect((await getOverview(holiday.ctx, ORG)).windowToday).toBeNull();
    });

    it('upcoming groups consecutive holidays into one break and lists active campaigns by date', async () => {
        const { repo, ctx } = await env({ holidays: ['2026-10-01', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-21', '2026-12-25'] });
        await repo.createCampaign(campaign({ id: 'ptm', status: 'dispatching', facts: { kind: 'ptm_invite', date: '2026-10-10', time: { hour: 10, minute: 0 }, venueId: 'hall' } }));
        await repo.createCampaign(campaign({ id: 'draft', status: 'draft', facts: { kind: 'ptm_invite', date: '2026-10-09', time: { hour: 10, minute: 0 }, venueId: 'hall' } }));
        await repo.createCampaign(campaign({ id: 'past', status: 'scheduled', facts: { kind: 'ptm_invite', date: '2026-10-06', time: { hour: 10, minute: 0 }, venueId: 'hall' } }));
        const o = await getOverview(ctx, ORG);
        expect(o.upcoming).toEqual([
            { kind: 'campaign', date: '2026-10-10', campaignId: 'ptm', purpose: 'ptm_invite', status: 'dispatching', facts: expect.objectContaining({ date: '2026-10-10' }) },
            { kind: 'holidays', from: '2026-10-16', to: '2026-10-18', days: 3 },
            { kind: 'holidays', from: '2026-10-21', to: '2026-10-21', days: 1 },
            { kind: 'holidays', from: '2026-12-25', to: '2026-12-25', days: 1 },
        ]);
    });

    it('askedToStop leaves out numbers the carrier flagged; numbersFlagged counts those; reversed entries count for neither', async () => {
        const { repo, ctx } = await env();
        await repo.upsertGuardians(ORG, ['a', 'b', 'c', 'd'].map((id) => guardian(id)));
        await repo.upsertSuppression(suppression('hash:a', 'keypad'));
        await repo.upsertSuppression(suppression('hash:b', 'carrier_invalid_number'));
        await repo.upsertSuppression(suppression('hash:c', 'office', 'reversed'));
        await repo.upsertSuppression(suppression('hash:unknown-number', 'carrier_invalid_number'));
        const o = await getOverview(ctx, ORG);
        expect(o.guardians.suppressed).toBe(2); // a and b: meaning unchanged
        expect(o.guardians.askedToStop).toBe(1); // a only
        expect(o.numbersFlagged).toBe(2); // b and the entry with no guardian
    });

    it('the feed classifies outcomes and shows a retry time only while the call is the intent’s latest', async () => {
        const { repo, ctx } = await env();
        await repo.upsertGuardians(ORG, [guardian('g1', { displayName: 'Bikash Rai' })]);
        const t = (min: number) => new Date(WED_11_IST.getTime() - min * 60_000);
        const retry = '2026-10-07T07:41:00.000Z';
        const waiting = await addCall(repo, t(9), { state: 'no_answer', intent: { status: 'retry_wait', notBefore: retry } });
        const superseded = await addCall(repo, t(8), { state: 'busy', intent: { status: 'retry_wait', notBefore: retry, lastCallId: 'call-other' } });
        const confirmed = await addCall(repo, t(7), { outcome: { heard: 'full', digits: '1', confirmed: true, declined: false, optOut: 'none' } });
        const stop = await addCall(repo, t(6), { outcome: { heard: 'full', digits: '99', confirmed: false, declined: false, optOut: 'confirmed' } });
        const early = await addCall(repo, t(5), { outcome: { heard: 'early_hangup', digits: '', confirmed: false, declined: false, optOut: 'none' } });
        const ringing = await addCall(repo, t(4), { state: 'ringing' });
        const lost = await addCall(repo, t(3), { state: 'unknown' });

        const o = await getOverview(ctx, ORG);
        const byId = new Map(o.recent.map((r) => [r.id, r]));
        expect(o.recent.map((r) => r.id)).toEqual([lost, ringing, early, stop, confirmed, superseded, waiting].map((c) => c.id));
        expect(byId.get(waiting.id)).toMatchObject({ outcomeClass: 'no_answer', retryAt: retry, guardianDisplayName: 'Bikash Rai', phoneLast4: '4410', language: 'Nepali' });
        expect(byId.get(superseded.id)).toMatchObject({ outcomeClass: 'no_answer', retryAt: null });
        expect(byId.get(confirmed.id)?.outcomeClass).toBe('confirmed');
        expect(byId.get(stop.id)).toMatchObject({ outcomeClass: 'opted_out', outcome: { optOut: 'confirmed' } });
        expect(byId.get(early.id)).toMatchObject({ outcomeClass: 'hung_up', outcome: { heard: 'early_hangup' } });
        expect(byId.get(ringing.id)?.outcomeClass).toBe('on_call');
        expect(byId.get(lost.id)?.outcomeClass).toBe('failed');
        expect(JSON.stringify(o.recent)).not.toMatch(/\+91|phoneHash|hash:/);
    });

    it('callOutcomeClass: a stop request outranks a key, an open call is on the call, and heard needs the whole message or 1 or 2', () => {
        const o = (p: Partial<CallOutcome>): CallOutcome => ({ ...NONE, ...p });
        expect(callOutcomeClass({ state: 'in_progress', outcome: o({ confirmed: true, digits: '1' }) })).toBe('on_call');
        expect(callOutcomeClass({ state: 'completed', outcome: o({ confirmed: true, digits: '19', optOut: 'requested' }) })).toBe('opted_out');
        expect(callOutcomeClass({ state: 'completed', outcome: o({ declined: true, digits: '2', heard: 'partial' }) })).toBe('declined');
        expect(callOutcomeClass({ state: 'completed', outcome: o({ heard: 'full' }) })).toBe('heard');
        expect(callOutcomeClass({ state: 'completed', outcome: o({ heard: 'partial', digits: '3' }) })).toBe('hung_up');
        expect(callOutcomeClass({ state: 'busy', outcome: o({}) })).toBe('no_answer');
        expect(callOutcomeClass({ state: 'cancelled', outcome: o({}) })).toBe('failed');
    });

    it('hours cover the calling window and widen to an early emergency call; the current mode only', async () => {
        const { repo, ctx } = await env({ callingWindow: { startHour: 10, endHour: 14, offDays: [0] } });
        await addCall(repo, new Date(WED_11_IST.getTime() - 4 * HOUR)); // 07:00 IST
        await addCall(repo, WED_11_IST, { outcome: { heard: 'full', digits: '', confirmed: false, declined: false, optOut: 'none' } });
        const o = await getOverview(ctx, ORG);
        expect(o.activityMode).toBe('practice');
        expect(o.hours.map((h) => h.hour)).toEqual([7, 8, 9, 10, 11, 12, 13]);
        expect(o.hours.find((h) => h.hour === 7)).toEqual({ hour: 7, calls: 1, heard: 0 });
        expect(o.hours.find((h) => h.hour === 11)).toEqual({ hour: 11, calls: 1, heard: 1 });
        expect(o.todayByLanguage.Nepali).toEqual({ calls: 2, heard: 1 });
        expect(o.todayByLanguage.Hindi).toEqual({ calls: 0, heard: 0 });
    });

    it('a trend day the call read may not reach is marked incomplete', async () => {
        const { repo, ctx } = await env();
        // OVERVIEW_CALL_LIMIT calls, all from the last two days: the read is cut off, so days
        // before the oldest call read are unknown (and the oldest day itself may be short).
        const start = WED_11_IST.getTime() - 26 * HOUR;
        const step = Math.floor((26 * HOUR) / OVERVIEW_CALL_LIMIT);
        for (let i = 0; i < OVERVIEW_CALL_LIMIT; i++) await addCall(repo, new Date(start + i * step));
        const o = await getOverview(ctx, ORG);
        expect(o.trend.map((d) => d.complete)).toEqual([false, false, false, false, false, false, true]);
        expect(o.trend.reduce((s, d) => s + d.calls, 0)).toBe(OVERVIEW_CALL_LIMIT);
    });
});
