/**
 * @jest-environment node
 */
import { callIdFor } from '@/lib/sampark/intents';
import { createMemorySamparkRepo, SIMULATED_CRASH_AFTER_CLAIM } from '@/lib/sampark/repo/memory';
import type { Intent, SamparkCall } from '@/types/sampark';

import { campaign, guardian, ORG, prefs, school, student, WED_11_IST } from './_fixtures';

function intent(id: string, overrides: Partial<Intent> = {}): Intent {
    return {
        id,
        dedupeKey: `k:${id}`,
        orgId: ORG,
        campaignId: 'camp-ptm',
        purpose: 'ptm_invite',
        guardianId: 'g1',
        studentIds: ['s1'],
        language: 'Nepali',
        status: 'approved',
        blockReason: null,
        attempts: 0,
        maxAttempts: 3,
        notBefore: null,
        expiresAt: '2027-01-01T00:00:00.000Z',
        lastCallId: null,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
        ...overrides,
    };
}

function call(intentId: string, attempt: number, overrides: Partial<SamparkCall> = {}): SamparkCall {
    return {
        id: callIdFor(intentId, attempt),
        orgId: ORG,
        intentId,
        campaignId: 'camp-ptm',
        purpose: 'ptm_invite',
        guardianId: 'g1',
        phoneHash: 'hash:g1',
        phoneLast4: '0000',
        language: 'Nepali',
        variant: 'default',
        attempt,
        state: 'dialing',
        leaseUntil: new Date(WED_11_IST.getTime() + 120_000).toISOString(),
        carrier: 'simulated',
        providerCallId: null,
        outcome: { heard: 'none', digits: '', confirmed: false, declined: false, optOut: 'none' },
        durationSeconds: null,
        billedSeconds: null,
        costPaise: null,
        audioSeconds: 40,
        createdAt: WED_11_IST.toISOString(),
        updatedAt: WED_11_IST.toISOString(),
        endedAt: null,
        failureReason: null,
        ...overrides,
    };
}

describe('memory repo — isolation', () => {
    it('returns copies: mutating a read or a written object never changes stored state', async () => {
        const repo = createMemorySamparkRepo();
        const s = school();
        await repo.upsertSchool(s);
        s.displayName = 'mutated after write';
        const read = await repo.getSchool(ORG);
        expect(read?.displayName).toBe('Hillview Demo School');
        read!.callingWindow.offDays.push(3);
        expect((await repo.getSchool(ORG))?.callingWindow.offDays).toEqual([0]);

        await repo.upsertGuardians(ORG, [guardian('g1', { studentIds: ['s1'] })]);
        const [g] = await repo.listGuardians(ORG);
        g.studentIds.push('evil');
        expect((await repo.getGuardian(ORG, 'g1'))?.studentIds).toEqual(['s1']);

        await repo.upsertPreferences([prefs('g1')]);
        const p = (await repo.getPreferences(ORG, ['g1'])).get('g1')!;
        p.consent.notices.status = 'denied';
        expect((await repo.getPreferences(ORG, ['g1'])).get('g1')?.consent.notices.status).toBe('granted');
    });

    it('patches cannot change id or orgId', async () => {
        const repo = createMemorySamparkRepo();
        await repo.createIntentIfAbsent(intent('i1'));
        await repo.updateIntent(ORG, 'i1', { id: 'other', orgId: 'x', status: 'blocked' } as Partial<Intent>);
        expect(await repo.getIntent(ORG, 'i1')).toMatchObject({ id: 'i1', orgId: ORG, status: 'blocked' });
    });

    it('updates to missing records throw (like a Firestore update)', async () => {
        const repo = createMemorySamparkRepo();
        await expect(repo.updateIntent(ORG, 'nope', { status: 'done' })).rejects.toThrow(/NOT_FOUND/);
        await expect(repo.updateCall(ORG, 'nope', { state: 'failed' })).rejects.toThrow(/NOT_FOUND/);
        await expect(repo.updateCampaign(ORG, 'nope', { status: 'completed' })).rejects.toThrow(/NOT_FOUND/);
    });

    it('createCampaign is create-only', async () => {
        const repo = createMemorySamparkRepo();
        await repo.createCampaign(campaign());
        await expect(repo.createCampaign(campaign())).rejects.toThrow(/ALREADY_EXISTS/);
    });

    it('lists students/guardians per org and filters guardians by id', async () => {
        const repo = createMemorySamparkRepo();
        await repo.upsertStudents(ORG, [student('s2'), student('s1')]);
        await repo.upsertStudents('other-org', [student('x1', { orgId: 'other-org' })]);
        expect((await repo.listStudents(ORG)).map((s) => s.id)).toEqual(['s1', 's2']);
        await repo.upsertGuardians(ORG, [guardian('g1'), guardian('g2'), guardian('g3')]);
        expect((await repo.listGuardians(ORG, ['g3', 'missing', 'g1'])).map((g) => g.id)).toEqual(['g3', 'g1']);
    });
});

describe('memory repo — create-only intents', () => {
    it('createIntentIfAbsent never overwrites', async () => {
        const repo = createMemorySamparkRepo();
        expect(await repo.createIntentIfAbsent(intent('i1', { status: 'blocked', blockReason: 'no_consent' }))).toBe(true);
        expect(await repo.createIntentIfAbsent(intent('i1', { status: 'approved' }))).toBe(false);
        expect(await repo.getIntent(ORG, 'i1')).toMatchObject({ status: 'blocked', blockReason: 'no_consent' });
    });
});

describe('memory repo — listDueIntents', () => {
    it('returns approved/retry_wait intents that are due, oldest first, up to the limit', async () => {
        const repo = createMemorySamparkRepo();
        await repo.createIntentIfAbsent(intent('late', { createdAt: '2026-10-03T00:00:00.000Z' }));
        await repo.createIntentIfAbsent(intent('early', { createdAt: '2026-10-02T00:00:00.000Z' }));
        await repo.createIntentIfAbsent(intent('retry-due', { status: 'retry_wait', notBefore: '2026-10-07T05:00:00.000Z', createdAt: '2026-10-04T00:00:00.000Z' }));
        await repo.createIntentIfAbsent(intent('retry-later', { status: 'retry_wait', notBefore: '2026-10-07T06:00:00.000Z' }));
        await repo.createIntentIfAbsent(intent('done', { status: 'done' }));
        await repo.createIntentIfAbsent(intent('dialing', { status: 'dialing' }));
        expect((await repo.listDueIntents(ORG, WED_11_IST, 10)).map((i) => i.id)).toEqual(['early', 'late', 'retry-due']);
        expect((await repo.listDueIntents(ORG, WED_11_IST, 2)).map((i) => i.id)).toEqual(['early', 'late']);
    });
});

describe('memory repo — claimIntentForDial (the at-most-once primitive)', () => {
    it('claims: writes the call and moves the intent to dialing with attempts and lastCallId', async () => {
        const repo = createMemorySamparkRepo();
        await repo.createIntentIfAbsent(intent('i1'));
        const c = call('i1', 1);
        expect(await repo.claimIntentForDial(ORG, 'i1', c, WED_11_IST)).toBe('claimed');
        expect(await repo.getIntent(ORG, 'i1')).toMatchObject({ status: 'dialing', attempts: 1, lastCallId: c.id });
        expect(await repo.getCall(ORG, c.id)).toMatchObject({ state: 'dialing', attempt: 1 });
    });

    it('refuses a second claim of the same attempt (call exists / intent no longer claimable)', async () => {
        const repo = createMemorySamparkRepo();
        await repo.createIntentIfAbsent(intent('i1'));
        expect(await repo.claimIntentForDial(ORG, 'i1', call('i1', 1), WED_11_IST)).toBe('claimed');
        expect(await repo.claimIntentForDial(ORG, 'i1', call('i1', 1), WED_11_IST)).toBe('not_claimable');
        // Even if the intent were put back to approved, the call record for attempt 1 exists.
        await repo.updateIntent(ORG, 'i1', { status: 'approved', attempts: 0 });
        expect(await repo.claimIntentForDial(ORG, 'i1', call('i1', 1), WED_11_IST)).toBe('not_claimable');
    });

    it.each([
        ['missing intent', null, {}],
        ['terminal intent', { status: 'done' as const }, {}],
        ['intent already dialing', { status: 'dialing' as const }, {}],
        ['not yet due', { status: 'retry_wait' as const, notBefore: '2026-10-07T07:00:00.000Z' }, {}],
        ['wrong attempt number', {}, { attempt: 2 }],
        ['call for another intent', {}, { intentId: 'other' }],
        ['call not in dialing', {}, { state: 'ringing' as const }],
    ])('refuses and writes nothing: %s', async (_label, intentPatch, callPatch) => {
        const repo = createMemorySamparkRepo();
        if (intentPatch) await repo.createIntentIfAbsent(intent('i1', intentPatch));
        const c = { ...call('i1', 1), ...callPatch };
        const before = await repo.getIntent(ORG, 'i1');
        expect(await repo.claimIntentForDial(ORG, 'i1', c, WED_11_IST)).toBe('not_claimable');
        expect(await repo.getIntent(ORG, 'i1')).toEqual(before);
        expect(await repo.getCall(ORG, c.id)).toBeNull();
    });

    it('a retry_wait intent that is due can be claimed for the next attempt', async () => {
        const repo = createMemorySamparkRepo();
        await repo.createIntentIfAbsent(intent('i1', { status: 'retry_wait', attempts: 1, notBefore: '2026-10-07T05:00:00.000Z' }));
        expect(await repo.claimIntentForDial(ORG, 'i1', call('i1', 2), WED_11_IST)).toBe('claimed');
    });

    it('failAfterClaim commits the claim, then throws', async () => {
        const repo = createMemorySamparkRepo({ faults: { failAfterClaim: (id) => id === 'i1' } });
        await repo.createIntentIfAbsent(intent('i1'));
        await repo.createIntentIfAbsent(intent('i2'));
        await expect(repo.claimIntentForDial(ORG, 'i1', call('i1', 1), WED_11_IST)).rejects.toThrow(SIMULATED_CRASH_AFTER_CLAIM);
        expect(await repo.getIntent(ORG, 'i1')).toMatchObject({ status: 'dialing', attempts: 1 });
        expect(await repo.getCall(ORG, callIdFor('i1', 1))).toMatchObject({ state: 'dialing' });
        expect(await repo.claimIntentForDial(ORG, 'i2', call('i2', 1), WED_11_IST)).toBe('claimed');
    });
});

describe('memory repo — calls', () => {
    it('sweeps ringing and in-progress calls past their lease too, but never a terminal one', async () => {
        const repo = createMemorySamparkRepo();
        for (const id of ['r', 'p', 't']) await repo.createIntentIfAbsent(intent(id));
        for (const id of ['r', 'p', 't']) await repo.claimIntentForDial(ORG, id, call(id, 1, { leaseUntil: '2026-10-07T05:31:00.000Z' }), WED_11_IST);
        await repo.updateCall(ORG, callIdFor('r', 1), { state: 'ringing' });
        await repo.updateCall(ORG, callIdFor('p', 1), { state: 'in_progress' });
        await repo.updateCall(ORG, callIdFor('t', 1), { state: 'completed' });
        const later = new Date('2026-10-07T05:35:00.000Z');
        expect((await repo.listExpiredOpenCalls(ORG, later)).map((c) => c.intentId).sort()).toEqual(['p', 'r']);
    });

    it('updateIntentIf moves an intent only from the expected status and call', async () => {
        const repo = createMemorySamparkRepo();
        await repo.createIntentIfAbsent(intent('i1'));
        await repo.claimIntentForDial(ORG, 'i1', call('i1', 1), WED_11_IST);
        const cid = callIdFor('i1', 1);
        expect(await repo.updateIntentIf(ORG, 'i1', { status: 'dialing', lastCallId: 'other' }, { status: 'done' })).toBe(false);
        expect(await repo.updateIntentIf(ORG, 'i1', { status: 'dialing', lastCallId: cid }, { status: 'done' })).toBe(true);
        expect(await repo.updateIntentIf(ORG, 'i1', { status: 'dialing', lastCallId: cid }, { status: 'retry_wait' })).toBe(false);
        expect(await repo.getIntent(ORG, 'i1')).toMatchObject({ status: 'done' });
        expect(await repo.updateIntentIf(ORG, 'missing', { status: 'dialing', lastCallId: cid }, { status: 'done' })).toBe(false);
    });

    it('lists ended-but-unsettled calls past the cut-off, never open, settled or pre-2a (no field) ones', async () => {
        const repo = createMemorySamparkRepo();
        for (const id of ['a', 'b', 'c', 'd', 'e']) await repo.createIntentIfAbsent(intent(id));
        for (const id of ['a', 'b', 'c', 'd', 'e']) await repo.claimIntentForDial(ORG, id, call(id, 1, { settledAt: null }), WED_11_IST);
        await repo.updateCall(ORG, callIdFor('a', 1), { state: 'no_answer', endedAt: '2026-10-07T05:31:00.000Z' });
        await repo.updateCall(ORG, callIdFor('b', 1), { state: 'completed', endedAt: '2026-10-07T05:40:00.000Z' }); // after the cut-off
        await repo.updateCall(ORG, callIdFor('c', 1), { state: 'busy', endedAt: '2026-10-07T05:31:00.000Z', settledAt: '2026-10-07T05:31:01.000Z' });
        await repo.updateCall(ORG, callIdFor('e', 1), { state: 'failed', endedAt: '2026-10-07T05:30:30.000Z', settledAt: undefined });
        // d stays open
        const cutoff = new Date('2026-10-07T05:35:00.000Z');
        expect((await repo.listUnsettledEndedCalls(ORG, cutoff, 10)).map((c) => c.intentId)).toEqual(['a']);
    });

    it('burns a token exactly once', async () => {
        const repo = createMemorySamparkRepo();
        expect(await repo.burnToken('k1', '2026-10-07T06:00:00.000Z')).toBe(true);
        expect(await repo.burnToken('k1', '2026-10-07T06:00:00.000Z')).toBe(false);
        expect(await repo.burnToken('k2', '2026-10-07T06:00:00.000Z')).toBe(true);
    });

    it('lists expired dialing calls, counts non-terminal calls, and counts calls to a phone', async () => {
        const repo = createMemorySamparkRepo();
        for (const id of ['a', 'b', 'c', 'd', 'e']) await repo.createIntentIfAbsent(intent(id));
        // Real-carrier calls count towards the frequency cap; a simulated (Practice) call never does (H1).
        await repo.claimIntentForDial(ORG, 'a', call('a', 1, { carrier: 'vobiz', leaseUntil: '2026-10-07T05:31:00.000Z' }), WED_11_IST);
        await repo.claimIntentForDial(ORG, 'b', call('b', 1, { carrier: 'vobiz', leaseUntil: '2026-10-07T05:40:00.000Z' }), WED_11_IST);
        await repo.claimIntentForDial(ORG, 'c', call('c', 1, { carrier: 'vobiz', purpose: 'emergency_closure', phoneHash: 'hash:g1' }), WED_11_IST);
        await repo.claimIntentForDial(ORG, 'd', call('d', 1, { carrier: 'vobiz', phoneHash: 'hash:other' }), WED_11_IST);
        await repo.claimIntentForDial(ORG, 'e', call('e', 1, { carrier: 'simulated', leaseUntil: '2026-10-07T05:40:00.000Z' }), WED_11_IST);
        await repo.updateCall(ORG, callIdFor('d', 1), { state: 'completed' });
        await repo.updateCall(ORG, callIdFor('e', 1), { state: 'completed' });

        const later = new Date('2026-10-07T05:35:00.000Z');
        expect((await repo.listExpiredOpenCalls(ORG, later)).map((c) => c.intentId)).toEqual(['a', 'c']);
        expect(await repo.countNonTerminalCalls(ORG)).toBe(3);
        const since = new Date('2026-10-01T00:00:00.000Z');
        expect(await repo.countCallsToPhoneSince(ORG, 'hash:g1', since, false)).toBe(3);
        expect(await repo.countCallsToPhoneSince(ORG, 'hash:g1', since, true)).toBe(2);
        expect(await repo.countCallsToPhoneSince(ORG, 'hash:g1', new Date('2026-10-08T00:00:00.000Z'), false)).toBe(0);
        expect((await repo.listCalls(ORG, { campaignId: 'camp-ptm', limit: 2 })).length).toBe(2);
    });
});

describe('memory repo — single-flight lock', () => {
    it('is exclusive until its TTL passes, re-entrant for the holder, and released only by the holder', async () => {
        const repo = createMemorySamparkRepo();
        const t0 = WED_11_IST;
        expect(await repo.acquireLock('L', 'A', t0, 55_000)).toBe(true);
        expect(await repo.acquireLock('L', 'B', new Date(t0.getTime() + 54_000), 55_000)).toBe(false);
        expect(await repo.acquireLock('L', 'A', new Date(t0.getTime() + 10_000), 55_000)).toBe(true);
        await repo.releaseLock('L', 'B');
        expect(await repo.acquireLock('L', 'B', new Date(t0.getTime() + 20_000), 55_000)).toBe(false);
        expect(await repo.acquireLock('L', 'B', new Date(t0.getTime() + 66_000), 55_000)).toBe(true);
        await repo.releaseLock('L', 'B');
        expect(await repo.acquireLock('L', 'C', new Date(t0.getTime() + 67_000), 55_000)).toBe(true);
    });
});
