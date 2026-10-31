/**
 * The Sargvision sample class (local test roster): the seed data, the records it builds, and the
 * Riya service rules that let a roster contact's own number ring — only on the local emulator,
 * only for the roster school, only for allow-listed numbers, once per confirmation, within the
 * per-contact cap. No test here reaches the network: every provider call is a jest mock.
 */

import crypto from 'node:crypto';
import { join } from 'node:path';

import { readRoster, sargvisionRecords, validateRoster, type Roster } from '../../../../scripts/sampark/sargvision-roster';
import { createMemoryConversationRepo } from '@/lib/sampark/conversation/repo';
import { decryptPhone, encryptPhone, hashPhone } from '@/lib/sampark/phone';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { SARGVISION_ORG_ID } from '@/lib/sampark/sargvision';
import { getDemoSchool, registerSargvisionRoster, SARGVISION_TEACHER_ID, studentSignals } from '@/lib/sampark/demo/school';
import {
    previewRiyaCall,
    reconcileRiyaCall,
    riyaAvailability,
    sargvisionAfterHoursOverride,
    sargvisionRosterMode,
    startRiyaCall,
    type RiyaDeps,
} from '@/server/sampark/conversation';
import { SamparkServiceError } from '@/server/sampark/errors';
import { sargvisionRosterEnabled } from '@/server/sampark/sargvision';
import type { SamparkSchool } from '@/types/sampark';

import { school as schoolFixture, testClock } from '../engine/_fixtures';
import { setPhoneEnv } from '../server/_helpers';

const ROSTER_FILE = join(__dirname, '..', '..', '..', '..', 'scripts', 'sampark', 'sargvision-roster.json');
const EXPECTED: [string, string][] = [
    ['Abhishek', '+916363740720'],
    ['Nischay', '+918791574175'],
    ['Nandini', '+919548214910'],
    ['Shivadeth', '+918592898442'],
    ['Varunesh', '+918300457646'],
    ['Yash', '+917783043238'],
    ['Sachitt', '+917384273605'],
    ['Shree', '+917400444110'],
    ['Alyssa', '+918431339732'],
];
const WED_11_IST = new Date('2026-10-07T05:30:00Z');
const WED_21_IST = new Date('2026-10-07T15:30:00Z');

const crypt = { encrypt: encryptPhone, hash: hashPhone };

describe('Sargvision roster data', () => {
    beforeAll(setPhoneEnv);

    it('has exactly the nine contacts with their E.164 numbers', () => {
        const roster = readRoster(ROSTER_FILE);
        expect(roster.orgId).toBe(SARGVISION_ORG_ID);
        expect(roster.contacts.map((c) => [c.name, c.phone])).toEqual(EXPECTED);
    });

    it('refuses duplicates, non-mobile numbers and another org', () => {
        const ok: Roster = { orgId: SARGVISION_ORG_ID, contacts: [{ id: 'sv-a', name: 'A', phone: '+916363740720' }] };
        expect(() => validateRoster({ ...ok, orgId: 'hillview-demo' })).toThrow();
        expect(() => validateRoster({ ...ok, contacts: [...ok.contacts, { id: 'sv-a', name: 'B', phone: '+917777777777' }] })).toThrow();
        expect(() => validateRoster({ ...ok, contacts: [{ id: 'sv-b', name: 'B', phone: '+91 63637 40720' }] })).toThrow();
        expect(() => validateRoster({ ...ok, contacts: [{ id: 'sv-b', name: 'B', phone: '+915000000101' }] })).toThrow();
    });

    it('builds the same records every time (idempotent seed), one contact record per person, no parent relation', () => {
        const roster = readRoster(ROSTER_FILE);
        const a = sargvisionRecords(roster, '2026-10-29T15:00:00Z', crypt);
        const b = sargvisionRecords(roster, '2026-10-29T15:00:00Z', crypt);
        expect(a.students.map((s) => s.id)).toEqual(b.students.map((s) => s.id));
        expect(new Set(a.students.map((s) => s.id)).size).toBe(9);
        for (const [i, g] of a.guardians.entries()) {
            expect(g.relation).toBe('other');
            expect(g.studentIds).toEqual([a.students[i].id]);
            expect(decryptPhone(g.phoneEnc)).toBe(EXPECTED[i][1]);
            expect(g.phoneHash).toBe(hashPhone(EXPECTED[i][1]));
            expect(a.students[i].displayName).toBe(EXPECTED[i][0]);
        }
    });
});

describe('demo school with the Sargvision class', () => {
    afterEach(() => registerSargvisionRoster([]));

    it('keeps the original classes and adds Sargvision only when the server sends the roster', () => {
        const before = getDemoSchool();
        expect(before.classes.map((c) => c.id)).not.toContain('SV');
        const originalIds = before.classes.map((c) => c.id);
        registerSargvisionRoster(EXPECTED.map(([name, phone], i) => ({ studentId: `sv-${i}`, guardianId: `sv-${i}-contact`, name, phoneLast4: phone.slice(-4) })));
        const after = getDemoSchool();
        expect(after.classes.map((c) => c.id)).toEqual([...originalIds, 'SV']);
        const sv = after.students.filter((s) => s.classId === 'SV');
        expect(sv.map((s) => s.name)).toEqual(EXPECTED.map(([n]) => n));
        expect(sv.every((s) => s.rosterContact?.orgId === SARGVISION_ORG_ID && studentSignals(s).length === 0)).toBe(true);
        expect(after.teachers.find((t) => t.id === SARGVISION_TEACHER_ID)?.classIds).toContain('SV');
        // No full number reaches the demo school.
        expect(JSON.stringify(after)).not.toContain('8431339732');
    });
});

// ── Service rules ───────────────────────────────────────────────────────────

const ALLOWED = EXPECTED.map(([, p]) => p);
const localEnv = (over: Record<string, string | undefined> = {}): Record<string, string | undefined> => ({
    SAMPARK_ENABLED: 'true',
    SAMPARK_ELEVENLABS_ENABLED: 'true',
    SAMPARK_RIYA_PURPOSES: 'ptm_invitation',
    SAMPARK_LIVE_DIAL_ENABLED: 'true',
    ELEVENLABS_API_KEY: 'sk_test_not_a_real_key_0123456789',
    ELEVENLABS_AGENT_ID: 'agent_1111cloneclonecloneclone111',
    ELEVENLABS_AGENT_PHONE_NUMBER_ID: 'phnum_3333numbernumbernumber333',
    ELEVENLABS_SOURCE_AGENT_ID: 'agent_0000sourcesourcesourcesource00',
    ELEVENLABS_WEBHOOK_SECRET: 'whsec_test_only',
    SAMPARK_FIRESTORE_DATABASE: 'sampark-nonprod',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    NODE_ENV: 'development',
    SAMPARK_RIYA_TEST_ALLOWED_NUMBERS: ALLOWED.join(','),
    SAMPARK_RIYA_TEST_DAILY_CAP: '2',
    ...over,
});

function accepted() {
    let n = 0;
    return jest.fn(async () => new Response(JSON.stringify({ success: true, conversation_id: `conv_sv_${++n}`, sip_call_id: `sip_${n}` }), { status: 200 }));
}

async function setupRoster(opts: { env?: Record<string, string | undefined>; school?: Partial<SamparkSchool>; at?: Date; extraGuardianPhone?: string } = {}) {
    setPhoneEnv();
    const env = opts.env ?? localEnv();
    process.env.SAMPARK_LIVE_DIAL_ENABLED = env.SAMPARK_LIVE_DIAL_ENABLED;
    const repo = createMemorySamparkRepo();
    const calls = createMemoryConversationRepo();
    await repo.upsertSchool(schoolFixture({ orgId: SARGVISION_ORG_ID, displayName: 'Sargvision', mode: 'test', isDemo: false, holidays: [], testPhoneEnc: null, testPhoneHash: null, testPhoneLast4: null, ...opts.school }));
    const roster = readRoster(ROSTER_FILE);
    const extra = opts.extraGuardianPhone ? [{ id: 'sv-outsider', name: 'Outsider', phone: opts.extraGuardianPhone }] : [];
    const recs = sargvisionRecords({ ...roster, contacts: [...roster.contacts, ...extra] }, '2026-10-01T00:00:00Z', crypt);
    await repo.upsertStudents(SARGVISION_ORG_ID, recs.students);
    await repo.upsertGuardians(SARGVISION_ORG_ID, recs.guardians);
    await repo.upsertPreferences(recs.preferences);
    const fetchImpl = accepted();
    const deps: RiyaDeps = { repo, calls, clock: testClock(opts.at ?? WED_11_IST), env, http: { fetchImpl: fetchImpl as unknown as typeof fetch } } as RiyaDeps;
    return { deps, calls, fetchImpl, env };
}

const FACTS = { purpose: 'ptm_invitation' as const, date: '2026-10-10', time: { hour: 10, minute: 0 } };

async function start(deps: RiyaDeps, contactId: string, key = crypto.randomUUID()) {
    const req = { purpose: 'ptm_invitation' as const, guardianId: `${contactId}-contact`, studentId: contactId, facts: FACTS };
    const preview = await previewRiyaCall(deps, SARGVISION_ORG_ID, req);
    return { preview, run: () => startRiyaCall(deps, SARGVISION_ORG_ID, 'dev-user-123', { ...req, idempotencyKey: key, confirmedAnnouncement: preview.announcement ?? 'x' }) };
}

async function code(p: Promise<unknown>): Promise<string> {
    try {
        await p;
    } catch (err) {
        if (err instanceof SamparkServiceError) return err.code;
        throw err;
    }
    throw new Error('expected a refusal');
}

afterEach(() => {
    delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
});

describe('Sargvision roster calls (Riya service)', () => {
    it('rings the chosen contact’s own number, shown in full in the preview, after one confirmation', async () => {
        const s = await setupRoster();
        const { preview, run } = await start(s.deps, 'sv-varunesh');
        expect(preview.ok).toBe(true);
        expect(preview.destination).toBe('guardian');
        expect(preview.destinationE164).toBe('+918300457646');
        expect(s.fetchImpl).not.toHaveBeenCalled(); // a preview never dials
        const r = await run();
        expect(r.call.state).toBe('initiated');
        expect(s.fetchImpl).toHaveBeenCalledTimes(1);
        const body = JSON.parse(String((s.fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
        expect(body.to_number).toBe('+918300457646');
    });

    it('a repeated submission with the same key never dials twice', async () => {
        const s = await setupRoster();
        const key = crypto.randomUUID();
        const { run } = await start(s.deps, 'sv-yash', key);
        await run();
        const again = await run();
        expect(again.duplicate).toBe(true);
        expect(s.fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('caps calls per contact; another contact is unaffected', async () => {
        const s = await setupRoster({ env: localEnv({ SAMPARK_RIYA_TEST_DAILY_CAP: '1' }) });
        await (await start(s.deps, 'sv-shree')).run();
        // The first call is still "initiated", which also holds the school lock; finish it as the webhook would.
        const [first] = await s.calls.listCalls(SARGVISION_ORG_ID, 10);
        await s.calls.mutateCall(SARGVISION_ORG_ID, first.id, (c) => ({ ...c, state: 'completed', endedAt: c.createdAt }));
        await s.deps.repo.releaseLock(`riya:${SARGVISION_ORG_ID}`, first.id).catch(() => undefined);
        expect(await code((await start(s.deps, 'sv-shree')).run())).toMatch(/TEST_CALL_CAP_REACHED|RIYA_CALL_IN_PROGRESS/);
    });

    it('refuses a number that is not on the allow-list', async () => {
        const s = await setupRoster({ env: localEnv({ SAMPARK_RIYA_TEST_ALLOWED_NUMBERS: '+916363740720' }) });
        const { preview, run } = await start(s.deps, 'sv-alyssa');
        expect(preview.refusals.map((r) => r.code)).toContain('NUMBER_NOT_ALLOWED');
        expect(preview.destinationE164).toBeNull();
        expect(await code(run())).toBe('NUMBER_NOT_ALLOWED');
        expect(s.fetchImpl).not.toHaveBeenCalled();
    });

    it('a contact added to the school but not to the allow-list is refused', async () => {
        const s = await setupRoster({ extraGuardianPhone: '+919876543210' });
        expect(await code((await start(s.deps, 'sv-outsider')).run())).toBe('NUMBER_NOT_ALLOWED');
        expect(s.fetchImpl).not.toHaveBeenCalled();
    });

    it('outside the emulator, in production, or for another school the roster rule is off (test phone only)', () => {
        const sv = schoolFixture({ orgId: SARGVISION_ORG_ID, mode: 'test', isDemo: false });
        expect(sargvisionRosterMode(localEnv(), sv)).toBe(true);
        expect(sargvisionRosterMode(localEnv({ FIRESTORE_EMULATOR_HOST: undefined }), sv)).toBe(false);
        expect(sargvisionRosterMode(localEnv({ NODE_ENV: 'production' }), sv)).toBe(false);
        expect(sargvisionRosterMode(localEnv({ SAMPARK_FIRESTORE_DATABASE: undefined }), sv)).toBe(false);
        expect(sargvisionRosterMode(localEnv(), { ...sv, orgId: 'riya-test-local' })).toBe(false);
        expect(sargvisionRosterMode(localEnv(), { ...sv, isDemo: true })).toBe(false);
        expect(sargvisionRosterMode(localEnv(), { ...sv, mode: 'practice' })).toBe(false);
        expect(sargvisionRosterEnabled({ ...localEnv(), SAMPARK_SARGVISION_ROSTER: 'true' })).toBe(true);
        expect(sargvisionRosterEnabled({ ...localEnv({ NODE_ENV: 'production' }), SAMPARK_SARGVISION_ROSTER: 'true' })).toBe(false);
        expect(sargvisionRosterEnabled(localEnv())).toBe(false);
    });

    it('in production the roster school falls back to the test-phone rule and never rings a contact', async () => {
        const s = await setupRoster({ env: localEnv({ NODE_ENV: 'production', FIRESTORE_EMULATOR_HOST: undefined }) });
        const { preview } = await start(s.deps, 'sv-abhishek');
        expect(preview.ok).toBe(false);
        expect(preview.refusals.map((r) => r.code)).toContain('PROVIDER_UNAVAILABLE');
        expect(s.fetchImpl).not.toHaveBeenCalled();
    });

    it('after hours: refused unless the local window is armed; armed, it opens for allow-listed contacts only', async () => {
        const closed = await setupRoster({ at: WED_21_IST });
        const p = await start(closed.deps, 'sv-nandini');
        expect(p.preview.refusals.map((r) => r.code)).toContain('OUTSIDE_CALLING_HOURS');

        const arm = { armedAt: '2026-10-07T15:00:00Z', until: '2026-10-07T17:00:00Z' };
        const open = await setupRoster({ at: WED_21_IST, school: { localAfterHoursTest: arm } });
        const q = await start(open.deps, 'sv-nandini');
        expect(q.preview.ok).toBe(true);
        expect(q.preview.testWindowOverride).toEqual({ until: '2026-10-07T17:00:00.000Z' });
        const avail = riyaAvailability({ ...schoolFixture({ orgId: SARGVISION_ORG_ID, mode: 'test', isDemo: false }), localAfterHoursTest: arm }, localEnv(), WED_21_IST);
        expect(avail.rosterMode).toBe(true);
        expect(avail.localAfterHoursUntil).toBe('2026-10-07T17:00:00.000Z');

        const sv = { ...schoolFixture({ orgId: SARGVISION_ORG_ID, mode: 'test', isDemo: false }), localAfterHoursTest: arm };
        const g = { phoneHash: hashPhone('+919876543210') } as never;
        expect(sargvisionAfterHoursOverride(localEnv(), sv, g, 'guardian', WED_21_IST)).toMatchObject({ active: false, inactiveReason: 'not_allowed_number' });
        expect(sargvisionAfterHoursOverride(localEnv({ NODE_ENV: 'production' }), sv, { phoneHash: hashPhone(ALLOWED[0]) } as never, 'guardian', WED_21_IST)).toMatchObject({ active: false, inactiveReason: 'not_roster_school' });
        expect(sargvisionAfterHoursOverride(localEnv(), sv, { phoneHash: hashPhone(ALLOWED[0]) } as never, 'guardian', new Date('2026-10-07T18:00:00Z'))).toMatchObject({ active: false, inactiveReason: 'expired' });
        expect(sargvisionAfterHoursOverride(localEnv(), { ...sv, localAfterHoursTest: { armedAt: arm.armedAt, until: '2026-10-07T20:00:00Z' } }, { phoneHash: hashPhone(ALLOWED[0]) } as never, 'guardian', WED_21_IST)).toMatchObject({ active: false, inactiveReason: 'longer_than_3_hours' });
    });

    it('a provider refusal is reported truthfully and does not use the contact’s allowance', async () => {
        const s = await setupRoster({ env: localEnv({ SAMPARK_RIYA_TEST_DAILY_CAP: '1' }) });
        s.fetchImpl.mockImplementationOnce(async () => new Response(JSON.stringify({ detail: { status: 'invalid_request', message: 'bad' } }), { status: 400 }));
        const first = await (await start(s.deps, 'sv-sachitt')).run();
        expect(first.call.state).toBe('failed');
        const second = await (await start(s.deps, 'sv-sachitt')).run();
        expect(second.call.state).toBe('initiated');
    });

    it('Check status finds a timed-out call in the provider history by our user id and records its real outcome', async () => {
        const s = await setupRoster({ env: localEnv({ SAMPARK_RIYA_STORE_TRANSCRIPTS: 'true', SAMPARK_RIYA_TRANSCRIPT_DAYS: '7' }) });
        s.fetchImpl.mockImplementationOnce(async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); });
        const first = await (await start(s.deps, 'sv-alyssa')).run();
        expect(first.call.state).toBe('unknown');
        const userId = `${SARGVISION_ORG_ID}~${first.call.id}`;
        const reads = jest.fn(async (url: string) => {
            if (url.includes('/v1/convai/conversations?')) return new Response(JSON.stringify({ conversations: [{ conversation_id: 'conv_other' }, { conversation_id: 'conv_ours' }] }), { status: 200 });
            if (url.endsWith('/conv_other')) return new Response(JSON.stringify({ conversation_id: 'conv_other', status: 'done', user_id: 'someone-else' }), { status: 200 });
            return new Response(JSON.stringify({
                agent_id: 'agent_1111cloneclonecloneclone111', conversation_id: 'conv_ours', status: 'done', user_id: userId,
                transcript: [{ role: 'agent', message: 'Hello, I am Riya.' }, { role: 'user', message: 'Yes, I can come.' }],
                metadata: { call_duration_secs: 26, termination_reason: 'Client disconnected: 1000' },
                analysis: { call_successful: 'success', data_collection_results: { ptm_attendance: { value: 'can_attend' }, good_time_to_talk: { value: 'yes' } } },
            }), { status: 200 });
        });
        const detail = await reconcileRiyaCall({ ...s.deps, http: { fetchImpl: reads as unknown as typeof fetch } }, SARGVISION_ORG_ID, first.call.id);
        expect(detail.call).toMatchObject({ state: 'completed', providerConversationId: 'conv_ours', durationSeconds: 26, dataCollection: { ptm_attendance: 'can_attend', good_time_to_talk: 'yes' } });
        // The same post-call path as a webhook: transcript stored (opt-in, with expiry).
        expect((await s.calls.getCall(SARGVISION_ORG_ID, first.call.id))?.transcript?.map((x) => x.message)).toEqual(['Hello, I am Riya.', 'Yes, I can come.']);
        expect(JSON.stringify(detail)).not.toContain('Yes, I can come.'); // the console never receives it
        // Only GETs: a lookup never places a call.
        expect(reads.mock.calls.every((c) => !(c as unknown as [string, RequestInit])[1] || ((c as unknown as [string, RequestInit])[1].method ?? 'GET') === 'GET')).toBe(true);
    });

    it('Check status on a timed-out call with no matching conversation says so and changes nothing', async () => {
        const s = await setupRoster();
        s.fetchImpl.mockImplementationOnce(async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); });
        const first = await (await start(s.deps, 'sv-shree')).run();
        const reads = jest.fn(async () => new Response(JSON.stringify({ conversations: [] }), { status: 200 }));
        expect(await code(reconcileRiyaCall({ ...s.deps, http: { fetchImpl: reads as unknown as typeof fetch } }, SARGVISION_ORG_ID, first.call.id))).toBe('PROVIDER_NOT_FOUND');
        expect((await s.calls.getCall(SARGVISION_ORG_ID, first.call.id))?.state).toBe('unknown');
    });

    it('an unknown outcome (timeout) is never retried and blocks the same call', async () => {
        const s = await setupRoster();
        s.fetchImpl.mockImplementationOnce(async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); });
        const first = await (await start(s.deps, 'sv-nischay')).run();
        expect(first.call.state).toBe('unknown');
        expect(await code((await start(s.deps, 'sv-nischay')).run())).toMatch(/UNRESOLVED_PREVIOUS_CALL|RIYA_CALL_IN_PROGRESS/);
        expect(s.fetchImpl).toHaveBeenCalledTimes(1);
    });
});
