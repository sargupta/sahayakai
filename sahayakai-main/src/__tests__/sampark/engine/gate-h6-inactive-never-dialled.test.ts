/**
 * @jest-environment node
 *
 * CLASS GATE H6 (dispatch side) — a child who has left, or a guardian who is no
 * longer of record, is never dialled (EDGE_CASES.md §2 gap 6).
 *
 * Intents are materialised days before they are dialled, and the CRM moves on in
 * between: a child leaves the school, a custody change takes a guardian off a
 * child's record. Before the hardening sprint the dispatcher never looked again.
 * The class: at the moment of dialling, the children a call is about are re-read,
 * and only those still active and still naming this guardian (or another guardian
 * on the same number) count — for every campaign purpose.
 *
 *   - every child gone or inactive → blocked 'student_inactive', never dialled;
 *   - children still at school but none naming this guardian → 'not_guardian_of_record';
 *   - a sibling who left drops out of the call but the call goes ahead, and the
 *     gate only ever sees the children of record;
 *   - a child whose record names the same mobile under another guardian id (the
 *     one-call-per-number bundle) stays on the call, so the gate sees its flags.
 */
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { campaignDedupeKey, intentIdFor } from '@/lib/sampark/intents';
import * as gateModule from '@/lib/sampark/policy/gate';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { Campaign, CampaignFacts, Intent, PurposeId } from '@/types/sampark';

import { campaign, DEFAULT_OPTS, deps, guardian, ORG, prefs, school, scriptedCarrier, seedFamilies, student, testClock } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
// The real gate, recorded: the tests read which children each dispatch-stage verdict was given.
jest.mock('@/lib/sampark/policy/gate', () => {
    const actual = jest.requireActual('@/lib/sampark/policy/gate');
    return { ...actual, evaluateGate: jest.fn(actual.evaluateGate) };
});

const gate = gateModule.evaluateGate as unknown as jest.Mock;
beforeEach(() => gate.mockClear());

const PURPOSES: { purpose: PurposeId; facts: CampaignFacts }[] = [
    { purpose: 'ptm_invite', facts: { kind: 'ptm_invite', date: '2026-10-10', time: { hour: 10, minute: 0 }, venueId: 'hall' } },
    { purpose: 'event_invite', facts: { kind: 'event_invite', eventType: 'annual_day', date: '2026-10-10', time: { hour: 10, minute: 0 }, venueId: 'hall' } },
    { purpose: 'emergency_closure', facts: { kind: 'emergency_closure', date: '2026-10-07', reason: 'heavy_rain', busesRunning: false } },
];

const idFor = (campaignId: string, gid: string) => intentIdFor(campaignDedupeKey(campaignId, gid));

async function materialised(c: Campaign, n = 2) {
    const repo = createMemorySamparkRepo();
    const clock = testClock();
    await seedFamilies(repo, n);
    await repo.createCampaign(c);
    expect((await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated')).created).toBe(n);
    const carrier = scriptedCarrier(() => 'full');
    return { repo, clock, carrier, d: deps(repo, clock, carrier) };
}

describe.each(PURPOSES)('class gate H6 — $purpose', ({ purpose, facts }) => {
    const camp = () => campaign({ id: `camp-${purpose}`, mode: 'practice', purpose, facts });

    it('a child who leaves after materialisation is never dialled (student_inactive)', async () => {
        const { repo, carrier, d } = await materialised(camp());
        await repo.upsertStudents(ORG, [student('s001', { guardianIds: ['g001'], active: false })]);
        const report = await runDispatchTick(d, DEFAULT_OPTS);
        expect(report.blocked).toBe(1);
        expect(carrier.requests.map((r) => r.call.guardianId)).toEqual(['g002']);
        expect(await repo.getIntent(ORG, idFor(`camp-${purpose}`, 'g001'))).toMatchObject({ status: 'blocked', blockReason: 'student_inactive', attempts: 0 });
    });

    it('a guardian who stops being of record is never dialled (not_guardian_of_record)', async () => {
        const { repo, carrier, d } = await materialised(camp());
        // Custody change: the child's record now names someone else, on another number.
        await repo.upsertGuardians(ORG, [guardian('g900', { studentIds: ['s001'], phoneHash: 'hash:g900' })]);
        await repo.upsertStudents(ORG, [student('s001', { guardianIds: ['g900'] })]);
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.requests.map((r) => r.call.guardianId)).toEqual(['g002']);
        expect(await repo.getIntent(ORG, idFor(`camp-${purpose}`, 'g001'))).toMatchObject({ status: 'blocked', blockReason: 'not_guardian_of_record' });
    });
});

describe('class gate H6 — who the gate is told the call is about', () => {
    async function siblings() {
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await repo.upsertSchool(school());
        await repo.upsertStudents(ORG, [student('s001', { guardianIds: ['g001'] }), student('s002', { guardianIds: ['g001'] })]);
        await repo.upsertGuardians(ORG, [guardian('g001', { studentIds: ['s001', 's002'] })]);
        await repo.upsertPreferences([prefs('g001')]);
        const c = campaign({ mode: 'practice' });
        await repo.createCampaign(c);
        await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');
        expect((await repo.getIntent(ORG, idFor('camp-ptm', 'g001')))?.studentIds).toEqual(['s001', 's002']);
        const carrier = scriptedCarrier(() => 'full');
        gate.mockClear();
        return { repo, clock, carrier, d: deps(repo, clock, carrier) };
    }

    const dispatchStudents = () =>
        gate.mock.calls.filter(([input]) => input.stage === 'dispatch').map(([input]) => input.students.map((s: { id: string }) => s.id));

    it('a sibling who left drops out of the call; the call still goes, and the gate sees only the child of record', async () => {
        const { repo, carrier, d } = await siblings();
        await repo.upsertStudents(ORG, [student('s002', { guardianIds: ['g001'], active: false })]);
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.requests).toHaveLength(1);
        expect(dispatchStudents()).toEqual([['s001']]);
    });

    it('a child missing from the snapshot counts as gone', async () => {
        const { repo, carrier, d } = await siblings();
        const intent = (await repo.getIntent(ORG, idFor('camp-ptm', 'g001')))!;
        const ghost: Intent = { ...intent, id: 'ghost-intent', dedupeKey: 'ghost', studentIds: ['s-missing'] };
        await repo.createIntentIfAbsent(ghost);
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(await repo.getIntent(ORG, 'ghost-intent')).toMatchObject({ status: 'blocked', blockReason: 'student_inactive' });
        expect(carrier.requests.map((r) => r.call.intentId)).toEqual([intent.id]);
    });

    it('a child whose record names the same mobile under another guardian id stays on the call, so its flags reach the gate', async () => {
        const { repo, carrier, d } = await siblings();
        // Entab-style: s002's record names g002, a second id for the same parent and the same mobile.
        await repo.upsertGuardians(ORG, [guardian('g002', { studentIds: ['s002'], phoneHash: 'hash:g001' })]);
        await repo.upsertStudents(ORG, [student('s002', { guardianIds: ['g002'] })]);
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.requests).toHaveLength(1);
        expect(dispatchStudents()).toEqual([['s001', 's002']]);
    });

    it('…but not when that other guardian is on a different number, and not when every child of record has left', async () => {
        const { repo, carrier, d } = await siblings();
        await repo.upsertGuardians(ORG, [guardian('g002', { studentIds: ['s002'], phoneHash: 'hash:g002' })]);
        await repo.upsertStudents(ORG, [student('s001', { guardianIds: ['g001'], active: false }), student('s002', { guardianIds: ['g002'] })]);
        await runDispatchTick(d, DEFAULT_OPTS);
        expect(carrier.requests).toHaveLength(0);
        expect(dispatchStudents()).toEqual([]);
        expect(await repo.getIntent(ORG, idFor('camp-ptm', 'g001'))).toMatchObject({ status: 'blocked', blockReason: 'not_guardian_of_record' });
    });
});
