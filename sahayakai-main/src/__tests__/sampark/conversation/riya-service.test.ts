/** @jest-environment node */
/**
 * Riya calls end to end through the server service, on the in-memory repos, with the
 * ElevenLabs network mocked. Stage A/C of the integration plan: every workflow's payload,
 * every refusal, idempotency, unknown outcomes, webhooks (signature, duplicates, order,
 * tenancy), privacy of logs and stored records, and Practice never touching a network.
 */

const logged: unknown[] = [];
jest.mock('@/lib/logger', () => {
    const capture = (...args: unknown[]) => { logged.push(args); };
    return { logger: { info: jest.fn(capture), warn: jest.fn(capture), error: jest.fn(capture), debug: jest.fn(capture) } };
});

import crypto from 'node:crypto';

import { createMemoryConversationRepo } from '@/lib/sampark/conversation/repo';
import type { RiyaFacts } from '@/lib/sampark/conversation/facts';
import { RIYA_PURPOSES, type RiyaPurpose } from '@/lib/sampark/conversation/riya-purposes';
import { encryptPhone, hashPhone } from '@/lib/sampark/phone';
import type { AuditEntry, SamparkRepo } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import {
    getRiyaCall,
    handleRiyaWebhook,
    listRiyaCalls,
    previewRiyaCall,
    reconcileRiyaCall,
    reviewRiyaCall,
    riyaAvailability,
    riyaCallId,
    startRiyaCall,
    type RiyaDeps,
    type RiyaStartInput,
} from '@/server/sampark/conversation';
import { SamparkServiceError } from '@/server/sampark/errors';
import type { SamparkMode, SamparkSchool } from '@/types/sampark';

import { guardian, prefs, school, student, testClock, type TestClock } from '../engine/_fixtures';
import { setPhoneEnv } from '../server/_helpers';

const ORG = 'hillview-demo';
const OTHER_ORG = 'other-school';
const ADMIN = 'admin-uid';
const WED_11_IST = new Date('2026-10-07T05:30:00Z');
const WED_21_IST = new Date('2026-10-07T15:30:00Z');

// Test-only values (not real people, numbers or credentials).
const TEST_PHONE = '+919800000001';
const GUARDIAN_PHONE = '+919811111111';
const AGENT = 'agent_2401m4zy4gyaev48rz65wfmf5yr2';
const PHONE_ID = 'phnum_0000testtesttesttesttest00';
const API_KEY = 'sk_test_not_a_real_key_0123456789';
const WEBHOOK_SECRET = 'whsec_test_only';

const FACTS: Record<RiyaPurpose, RiyaFacts> = {
    event_invitation: { purpose: 'event_invitation', eventType: 'sports_day', date: '2026-10-24', time: { hour: 9, minute: 0 } },
    ptm_invitation: { purpose: 'ptm_invitation', date: '2026-10-10', time: { hour: 10, minute: 0 } },
    holiday_notice: { purpose: 'holiday_notice', dates: ['2026-10-19', '2026-10-20'] },
    exam_schedule_notice: { purpose: 'exam_schedule_notice', entries: [{ subject: 'mathematics', date: '2026-11-02', time: { hour: 9, minute: 30 } }] },
    absence_notice: { purpose: 'absence_notice', date: '2026-10-07' },
    emergency_closure: { purpose: 'emergency_closure', date: '2026-10-08', reason: 'rain_landslide', busesRunning: true },
};

interface Setup {
    deps: RiyaDeps;
    repo: SamparkRepo;
    calls: ReturnType<typeof createMemoryConversationRepo>;
    clock: TestClock;
    fetchImpl: jest.Mock;
    audits: AuditEntry[];
    env: Record<string, string | undefined>;
}

const baseEnv = (): Record<string, string | undefined> => ({
    SAMPARK_ENABLED: 'true',
    SAMPARK_ELEVENLABS_ENABLED: 'true',
    SAMPARK_RIYA_PURPOSES: RIYA_PURPOSES.join(','),
});

const elevenEnv = (): Record<string, string | undefined> => ({
    ...baseEnv(),
    SAMPARK_LIVE_DIAL_ENABLED: 'true',
    ELEVENLABS_API_KEY: API_KEY,
    ELEVENLABS_AGENT_ID: AGENT,
    ELEVENLABS_AGENT_PHONE_NUMBER_ID: PHONE_ID,
    ELEVENLABS_SOURCE_AGENT_ID: 'agent_0000sourcesourcesourcesource00',
    SAMPARK_FIRESTORE_DATABASE: 'sampark-nonprod',
    ELEVENLABS_WEBHOOK_SECRET: WEBHOOK_SECRET,
});

function accepted(conversationId = 'conv_abc123') {
    return jest.fn(async () => new Response(JSON.stringify({ success: true, message: 'ok', conversation_id: conversationId, sip_call_id: 'sip_1' }), { status: 200 }));
}

async function setup(opts: { mode?: SamparkMode; env?: Record<string, string | undefined>; school?: Partial<SamparkSchool>; consent?: Parameters<typeof prefs>[1]; fetchImpl?: jest.Mock; at?: Date } = {}): Promise<Setup> {
    setPhoneEnv();
    const mode = opts.mode ?? 'practice';
    const repo = createMemorySamparkRepo();
    const calls = createMemoryConversationRepo();
    const clock = testClock(opts.at ?? WED_11_IST);
    const env = opts.env ?? (mode === 'test' ? elevenEnv() : baseEnv());
    process.env.SAMPARK_LIVE_DIAL_ENABLED = env.SAMPARK_LIVE_DIAL_ENABLED; // evaluateGate reads it from process.env
    await repo.upsertSchool(school({
        mode,
        holidays: ['2026-10-19', '2026-10-20'],
        ...(mode === 'test' ? { testPhoneEnc: encryptPhone(TEST_PHONE), testPhoneHash: hashPhone(TEST_PHONE), testPhoneLast4: '0001' } : {}),
        ...opts.school,
    }));
    await repo.upsertSchool(school({ orgId: OTHER_ORG, displayName: 'Other School' }));
    await repo.upsertStudents(ORG, [
        student('s1', { spokenFirstName: { English: 'Asha' }, guardianIds: ['g1'] }),
        student('s2', { spokenFirstName: { English: 'Ravi' }, guardianIds: ['g2'] }),
        student('s-flag', { spokenFirstName: { English: 'Mira' }, guardianIds: ['g3'], sensitiveFlags: ['custody_restriction'] }),
    ]);
    const g = (id: string, phone: string, studentIds: string[], over = {}) =>
        guardian(id, { phoneEnc: encryptPhone(phone), phoneHash: hashPhone(phone), phoneLast4: phone.slice(-4), phoneClass: 'mobile', crmLanguage: 'English', studentIds, ...over });
    await repo.upsertGuardians(ORG, [g('g1', GUARDIAN_PHONE, ['s1']), g('g2', '+919822222222', ['s2']), g('g3', '+919833333333', ['s-flag'])]);
    await repo.upsertStudents(OTHER_ORG, [{ ...student('sx', { guardianIds: ['gx'] }), orgId: OTHER_ORG }]);
    await repo.upsertGuardians(OTHER_ORG, [{ ...g('gx', '+919844444444', ['sx']), orgId: OTHER_ORG }]);
    const consent = opts.consent ?? { notices: 'granted', progress: 'granted', recorded_conversation: 'granted' };
    await repo.upsertPreferences(['g1', 'g2', 'g3'].map((id) => prefs(id, consent)));
    const audits: AuditEntry[] = [];
    const original = repo.appendAudit.bind(repo);
    repo.appendAudit = async (orgId, entry) => { audits.push(entry); await original(orgId, entry); };
    const fetchImpl = opts.fetchImpl ?? accepted();
    return { deps: { repo, calls, clock, env, http: { fetchImpl: fetchImpl as unknown as typeof fetch } }, repo, calls, clock, fetchImpl, audits, env };
}

async function startInput(deps: RiyaDeps, purpose: RiyaPurpose = 'ptm_invitation', over: Partial<RiyaStartInput> = {}): Promise<RiyaStartInput> {
    const base = { purpose, guardianId: 'g1', studentId: 's1', facts: FACTS[purpose], ...over };
    const preview = await previewRiyaCall(deps, ORG, { purpose: base.purpose, guardianId: base.guardianId, studentId: base.studentId, facts: base.facts, ...(over.campaignId ? { campaignId: over.campaignId, facts: undefined } : {}) });
    return { ...base, idempotencyKey: crypto.randomUUID(), confirmedAnnouncement: preview.announcement ?? 'x', ...over };
}

async function refusalCode(p: Promise<unknown>): Promise<string> {
    try {
        await p;
    } catch (err) {
        if (err instanceof SamparkServiceError) return err.code;
        throw err;
    }
    throw new Error('expected a refusal');
}

function sign(body: string, t: number): string {
    return `t=${t},v0=${crypto.createHmac('sha256', WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex')}`;
}

function postCall(conversationId: string, data: Record<string, unknown> = {}, ts = Math.floor(WED_11_IST.getTime() / 1000)) {
    return JSON.stringify({
        type: 'post_call_transcription',
        event_timestamp: ts,
        data: {
            agent_id: AGENT, conversation_id: conversationId, status: 'done',
            transcript: [{ role: 'agent', message: 'Hello' }, { role: 'user', message: 'Yes, I can come.' }],
            metadata: { call_duration_secs: 47, termination_reason: 'end_call tool was called.' },
            analysis: { call_successful: 'success', data_collection_results: { ptm_attendance: { value: 'can_attend' }, good_time_to_talk: { value: 'yes' } } },
            ...data,
        },
    });
}

afterEach(() => {
    delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
});

// ── Practice: the dry run ───────────────────────────────────────────────────

describe('Practice mode (simulated provider)', () => {
    it.each(RIYA_PURPOSES)('%s: correct payload, completed lifecycle, no network', async (purpose) => {
        const s = await setup();
        const { call, duplicate } = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps, purpose));
        expect(duplicate).toBe(false);
        expect(call).toMatchObject({ provider: 'simulated', destination: 'guardian', riyaPurpose: purpose, state: 'completed', studentDisplayName: 'Student s1' });
        expect(call.variables.call_purpose).toBe(purpose);
        expect(call.variables.student_name).toBe('Asha');
        expect(s.fetchImpl).not.toHaveBeenCalled();
        expect(call).not.toHaveProperty('phoneHash');
    });

    it.each([
        ['no_answer', 'no_answer'],
        ['busy', 'busy'],
        ['wrong_person', 'completed'],
        ['interrupted', 'completed'],
        ['provider_rejected', 'failed'],
        ['provider_timeout', 'unknown'],
    ] as const)('scenario %s → %s', async (scenario, state) => {
        const s = await setup();
        const { call } = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps, 'ptm_invitation', { scenario }));
        expect(call.state).toBe(state);
    });

    it('PTM: a parent who cannot attend has the attendance answer and preferred time persisted', async () => {
        const s = await setup();
        const { call } = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps, 'ptm_invitation', { scenario: 'answered_cannot_attend' }));
        expect((await s.calls.getCall(ORG, call.id))?.dataCollection).toMatchObject({ ptm_attendance: 'cannot_attend', ptm_preferred_time: 'Saturday after 11 AM' });
    });

    it('wrong person: the outcome records that the listener was not confirmed', async () => {
        const s = await setup();
        const { call } = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps, 'ptm_invitation', { scenario: 'wrong_person' }));
        expect(call.dataCollection.recipient_confirmed).toBe('no');
        expect(call.callSuccessful).toBe('failure');
    });

    it('a stop request in Practice is a rehearsal: audited, never a suppression', async () => {
        const s = await setup();
        const { call } = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps, 'ptm_invitation', { scenario: 'stop_requested' }));
        expect(call.stopRequested).toBe(true);
        expect(await s.repo.listSuppressions(ORG)).toEqual([]);
        expect(s.audits.map((a) => a.action)).toContain('riya_call.stop_requested_rehearsal');
    });

    it('frees the school’s slot once the call settles, so the next call can start', async () => {
        const s = await setup();
        await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps));
        const second = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps, 'ptm_invitation', { guardianId: 'g2', studentId: 's2' }));
        expect(second.call.state).toBe('completed');
    });
});

// ── Refusals ────────────────────────────────────────────────────────────────

describe('refusals (nothing is created or dialled)', () => {
    it('flag off → RIYA_DISABLED', async () => {
        const s = await setup({ env: { SAMPARK_ENABLED: 'true' } });
        expect(await refusalCode(startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps)))).toBe('RIYA_DISABLED');
        expect(riyaAvailability((await s.repo.getSchool(ORG)) as SamparkSchool, s.env)).toMatchObject({ enabled: false, purposes: [] });
    });

    it('only PTM unless the deployment enables more', async () => {
        const s = await setup({ env: { SAMPARK_ENABLED: 'true', SAMPARK_ELEVENLABS_ENABLED: 'true' } });
        expect(await refusalCode(startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps, 'absence_notice')))).toBe('PURPOSE_NOT_ENABLED');
        expect((await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps, 'ptm_invitation'))).call.state).toBe('completed');
    });

    it('Live mode is refused whatever the flags say', async () => {
        const s = await setup({ mode: 'live', env: elevenEnv() });
        expect(await refusalCode(startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps)))).toBe('LIVE_MODE_NOT_AVAILABLE');
        expect(s.fetchImpl).not.toHaveBeenCalled();
    });

    it('Test mode needs live dialling switched on, a valid agent config and a test phone', async () => {
        const off = await setup({ mode: 'test', env: { ...elevenEnv(), SAMPARK_LIVE_DIAL_ENABLED: undefined } });
        expect(await refusalCode(startRiyaCall(off.deps, ORG, ADMIN, await startInput(off.deps)))).toBe('LIVE_DIAL_DISABLED');
        const noCfg = await setup({ mode: 'test', env: { ...elevenEnv(), ELEVENLABS_AGENT_PHONE_NUMBER_ID: undefined } });
        expect(await refusalCode(startRiyaCall(noCfg.deps, ORG, ADMIN, await startInput(noCfg.deps)))).toBe('ELEVENLABS_UNCONFIGURED');
        const noPhone = await setup({ mode: 'test', school: { testPhoneEnc: null, testPhoneHash: null, testPhoneLast4: null } });
        expect(await refusalCode(startRiyaCall(noPhone.deps, ORG, ADMIN, await startInput(noPhone.deps)))).toBe('TEST_PHONE_MISSING');
        for (const s of [off, noCfg, noPhone]) expect(s.fetchImpl).not.toHaveBeenCalled();
    });

    it('another school’s family cannot be named (cross-tenant)', async () => {
        const s = await setup();
        await expect(previewRiyaCall(s.deps, ORG, { purpose: 'ptm_invitation', guardianId: 'gx', studentId: 'sx', facts: FACTS.ptm_invitation })).rejects.toMatchObject({ code: 'RECIPIENT_NOT_FOUND' });
    });

    it('a guardian who is not of record for that student', async () => {
        const s = await setup();
        expect(await refusalCode(startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps, 'ptm_invitation', { guardianId: 'g2', studentId: 's1' })))).toBe('NOT_GUARDIAN_OF_RECORD');
    });

    it('outside calling hours, with the next opening', async () => {
        const s = await setup({ at: WED_21_IST });
        const preview = await previewRiyaCall(s.deps, ORG, { purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: FACTS.ptm_invitation });
        expect(preview.refusals).toContainEqual(expect.objectContaining({ code: 'OUTSIDE_CALLING_HOURS' }));
    });

    it('a suppressed number, missing consent, a custody restriction, a paused school', async () => {
        const s = await setup();
        await s.repo.upsertSuppression({ orgId: ORG, phoneHash: hashPhone(GUARDIAN_PHONE), phoneLast4: '1111', scope: 'routine', source: 'office', officeVerification: 'confirmed', createdAt: WED_11_IST.toISOString(), callId: null });
        const p1 = await previewRiyaCall(s.deps, ORG, { purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: FACTS.ptm_invitation });
        expect(p1.refusals).toContainEqual({ code: 'GATE_BLOCKED', reason: 'suppressed' });

        const s2 = await setup({ consent: { notices: 'unknown', recorded_conversation: 'granted' } });
        expect((await previewRiyaCall(s2.deps, ORG, { purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: FACTS.ptm_invitation })).refusals).toContainEqual({ code: 'GATE_BLOCKED', reason: 'no_consent' });

        const s3 = await setup({ consent: { notices: 'granted' } });
        expect((await previewRiyaCall(s3.deps, ORG, { purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: FACTS.ptm_invitation })).refusals).toContainEqual({ code: 'RECORDING_CONSENT_REQUIRED' });

        const s4 = await setup();
        expect((await previewRiyaCall(s4.deps, ORG, { purpose: 'ptm_invitation', guardianId: 'g3', studentId: 's-flag', facts: FACTS.ptm_invitation })).refusals).toContainEqual({ code: 'GATE_BLOCKED', reason: 'custody_restricted' });

        const s5 = await setup({ school: { pause: { at: WED_11_IST.toISOString(), by: ADMIN, reason: 'exam week', scope: 'all' } } });
        expect((await previewRiyaCall(s5.deps, ORG, { purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: FACTS.ptm_invitation })).refusals).toContainEqual({ code: 'SCHOOL_PAUSED' });
    });

    it('a family whose language is not English', async () => {
        const s = await setup();
        await s.repo.upsertGuardians(ORG, [{ ...((await s.repo.getGuardian(ORG, 'g1'))!), crmLanguage: 'Nepali' }]);
        expect((await previewRiyaCall(s.deps, ORG, { purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: FACTS.ptm_invitation })).refusals).toContainEqual({ code: 'LANGUAGE_NOT_SUPPORTED', language: 'Nepali' });
    });

    it('missing facts and facts the school calendar does not have', async () => {
        const s = await setup();
        const p = await previewRiyaCall(s.deps, ORG, { purpose: 'holiday_notice', guardianId: 'g1', studentId: 's1', facts: { purpose: 'holiday_notice', dates: ['2026-10-23'] } });
        expect(p.refusals).toContainEqual({ code: 'FACTS_INVALID', problems: [{ code: 'NOT_A_SCHOOL_HOLIDAY', date: '2026-10-23' }] });
        const none = await previewRiyaCall(s.deps, ORG, { purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1' });
        expect(none.refusals).toContainEqual({ code: 'FACTS_REQUIRED' });
    });

    it('the announcement must still be the one staff approved', async () => {
        const s = await setup();
        const input = await startInput(s.deps);
        expect(await refusalCode(startRiyaCall(s.deps, ORG, ADMIN, { ...input, confirmedAnnouncement: 'something else' }))).toBe('ANNOUNCEMENT_CHANGED');
        expect(s.calls.calls.size).toBe(0);
    });

    it('scenarios are Practice-only', async () => {
        const s = await setup({ mode: 'test' });
        expect(await refusalCode(startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps, 'ptm_invitation', { scenario: 'busy' })))).toBe('SCENARIO_PRACTICE_ONLY');
        expect(s.fetchImpl).not.toHaveBeenCalled();
    });

    it('refusals are audited without phone numbers', async () => {
        const s = await setup({ mode: 'live', env: elevenEnv() });
        await refusalCode(startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps)));
        expect(s.audits.map((a) => a.action)).toContain('riya_call.refused');
        expect(JSON.stringify(s.audits)).not.toMatch(/\+91\d{10}/);
    });
});

// ── Test mode (ElevenLabs, mocked) ──────────────────────────────────────────

describe('Test mode — ElevenLabs (mocked network)', () => {
    it('dials ONLY the school test phone, with the configured agent and phone-number ids', async () => {
        const s = await setup({ mode: 'test' });
        const { call } = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps));
        expect(s.fetchImpl).toHaveBeenCalledTimes(1);
        const body = JSON.parse(String((s.fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
        expect(body.to_number).toBe(TEST_PHONE);
        expect(body.to_number).not.toBe(GUARDIAN_PHONE);
        expect(body.agent_id).toBe(AGENT);
        expect(body.agent_phone_number_id).toBe(PHONE_ID);
        expect(body.conversation_initiation_client_data.user_id).toBe(`${ORG}~${call.id}`);
        expect(body.conversation_initiation_client_data.dynamic_variables).toMatchObject({ call_purpose: 'ptm_invitation', student_name: 'Asha', school_name: 'Hillview Demo School' });
        expect(call).toMatchObject({ state: 'initiated', destination: 'test_phone', phoneLast4: '0001', providerConversationId: 'conv_abc123', agentId: '…mf5yr2' });
    });

    it('a test phone whose stored hash does not match is never dialled', async () => {
        const s = await setup({ mode: 'test', school: { testPhoneHash: hashPhone('+919899999999') } });
        expect(await refusalCode(startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps)))).toBe('TEST_PHONE_MISMATCH');
        expect(s.fetchImpl).not.toHaveBeenCalled();
    });

    it('the same idempotency key never dials twice', async () => {
        const s = await setup({ mode: 'test' });
        const input = await startInput(s.deps);
        const first = await startRiyaCall(s.deps, ORG, ADMIN, input);
        const again = await startRiyaCall(s.deps, ORG, ADMIN, input);
        expect(again).toMatchObject({ duplicate: true, call: { id: first.call.id } });
        expect(s.fetchImpl).toHaveBeenCalledTimes(1);
        expect(await refusalCode(startRiyaCall(s.deps, ORG, 'someone-else', input))).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('one Riya call in flight per school', async () => {
        const s = await setup({ mode: 'test' });
        await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps));
        expect(await refusalCode(startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps, 'ptm_invitation', { guardianId: 'g2', studentId: 's2' })))).toBe('RIYA_CALL_IN_PROGRESS');
        expect(s.fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('a timeout is UNKNOWN: never retried, blocks the same announcement until a person reviews it', async () => {
        const fetchImpl = jest.fn(async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); });
        const s = await setup({ mode: 'test', fetchImpl });
        const { call } = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps));
        expect(call).toMatchObject({ state: 'unknown', failureReason: 'unknown:timeout' });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(await refusalCode(startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps)))).toBe('UNRESOLVED_PREVIOUS_CALL');
        await reviewRiyaCall(s.deps, ORG, call.id, ADMIN, 'did_not_ring');
        s.deps.http = { fetchImpl: accepted('conv_second') as unknown as typeof fetch };
        expect((await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps))).call.state).toBe('initiated');
    });

    it('a 429 is a refusal (nothing rang): the call fails and the slot is freed', async () => {
        const fetchImpl = jest.fn(async () => new Response('{}', { status: 429 }));
        const s = await setup({ mode: 'test', fetchImpl });
        const { call } = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps));
        expect(call).toMatchObject({ state: 'failed', failureReason: 'rejected:rate_limited:429' });
        s.deps.http = { fetchImpl: accepted() as unknown as typeof fetch };
        expect((await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps, 'ptm_invitation', { guardianId: 'g2', studentId: 's2' }))).call.state).toBe('initiated');
    });

    it('an auth failure is a refusal and does not leak the key', async () => {
        const fetchImpl = jest.fn(async () => new Response('{"detail":"invalid api key"}', { status: 401 }));
        const s = await setup({ mode: 'test', fetchImpl });
        const { call } = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps));
        expect(call.state).toBe('failed');
        expect(JSON.stringify(call)).not.toContain(API_KEY);
    });

    it('on a deployment reading the production database, real Riya calls are refused (preview/staging guard)', async () => {
        const s = await setup({ mode: 'test', env: { ...elevenEnv(), SAMPARK_FIRESTORE_DATABASE: undefined } });
        expect(await refusalCode(startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps)))).toBe('NONPROD_DATABASE_REQUIRED');
        expect(s.fetchImpl).not.toHaveBeenCalled();
        const approved = await setup({ mode: 'test', env: { ...elevenEnv(), SAMPARK_FIRESTORE_DATABASE: undefined, SAMPARK_RIYA_PRODUCTION_DATA_APPROVED: 'true' } });
        expect((await startRiyaCall(approved.deps, ORG, ADMIN, await startInput(approved.deps))).call.destination).toBe('test_phone');
    });

    it('concurrent starts with different keys: exactly one reaches the provider', async () => {
        let release: () => void = () => undefined;
        const gate = new Promise<void>((r) => { release = r; });
        const fetchImpl = jest.fn(async () => { await gate; return new Response(JSON.stringify({ success: true, conversation_id: 'conv_c', sip_call_id: null }), { status: 200 }); });
        const s = await setup({ mode: 'test', fetchImpl });
        const a = startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps));
        const b = startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps, 'ptm_invitation', { guardianId: 'g2', studentId: 's2' }));
        const settledB = await b.then(() => 'started', (e) => (e as SamparkServiceError).code);
        release();
        await a;
        expect(settledB).toBe('RIYA_CALL_IN_PROGRESS');
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('caps test calls per day', async () => {
        const s = await setup({ mode: 'test', env: { ...elevenEnv(), SAMPARK_RIYA_TEST_DAILY_CAP: '1' } });
        const first = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps));
        await handleRiyaWebhook(s.deps, postCall('conv_abc123'), sign(postCall('conv_abc123'), Math.floor(WED_11_IST.getTime() / 1000)));
        expect((await getRiyaCall(s.deps, ORG, first.call.id)).call.state).toBe('completed');
        expect(await refusalCode(startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps, 'ptm_invitation', { guardianId: 'g2', studentId: 's2' })))).toBe('TEST_CALL_CAP_REACHED');
    });
});

// ── Webhooks ────────────────────────────────────────────────────────────────

describe('post-call webhook', () => {
    const ts = Math.floor(WED_11_IST.getTime() / 1000);

    async function started() {
        const s = await setup({ mode: 'test', env: { ...elevenEnv(), SAMPARK_RIYA_STORE_TRANSCRIPTS: 'true', SAMPARK_RIYA_TRANSCRIPT_DAYS: '7' } });
        const { call } = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps));
        return { s, call };
    }

    it('applies a signed post-call event; a duplicate delivery changes nothing', async () => {
        const { s, call } = await started();
        const body = postCall('conv_abc123');
        expect(await handleRiyaWebhook(s.deps, body, sign(body, ts))).toEqual({ status: 200, body: { ok: true } });
        const detail = await getRiyaCall(s.deps, ORG, call.id);
        expect(detail.call).toMatchObject({ state: 'completed', durationSeconds: 47, dataCollection: { ptm_attendance: 'can_attend', good_time_to_talk: 'yes' } });
        expect(detail.transcript).toHaveLength(2);
        const before = JSON.stringify(await s.calls.getCall(ORG, call.id));
        expect((await handleRiyaWebhook(s.deps, body, sign(body, ts))).status).toBe(200);
        expect(JSON.stringify(await s.calls.getCall(ORG, call.id))).toBe(before);
    });

    it('refuses a bad signature, a stale one, and no secret', async () => {
        const { s } = await started();
        const body = postCall('conv_abc123');
        expect((await handleRiyaWebhook(s.deps, body, sign(body + 'x', ts))).status).toBe(401);
        expect((await handleRiyaWebhook(s.deps, body, sign(body, ts - 3600))).status).toBe(401);
        expect((await handleRiyaWebhook({ ...s.deps, env: { ...s.env, ELEVENLABS_WEBHOOK_SECRET: undefined } }, body, sign(body, ts))).status).toBe(503);
    });

    it('404 when Riya or Sampark is off', async () => {
        const { s } = await started();
        const body = postCall('conv_abc123');
        expect((await handleRiyaWebhook({ ...s.deps, env: { ...s.env, SAMPARK_ELEVENLABS_ENABLED: 'false' } }, body, sign(body, ts))).status).toBe(404);
    });

    it('an event for another agent is accepted and ignored', async () => {
        const { s, call } = await started();
        const body = postCall('conv_abc123', { agent_id: 'agent_0000otheragentotheragent000' });
        expect((await handleRiyaWebhook(s.deps, body, sign(body, ts))).status).toBe(200);
        expect((await s.calls.getCall(ORG, call.id))?.state).toBe('initiated');
    });

    it('an unknown conversation: 503 while young (ElevenLabs retries), 200 once old', async () => {
        const { s } = await started();
        const young = postCall('conv_unknown');
        expect((await handleRiyaWebhook(s.deps, young, sign(young, ts))).status).toBe(503);
        const old = postCall('conv_unknown', {}, ts - 20 * 60);
        expect((await handleRiyaWebhook(s.deps, old, sign(old, ts))).status).toBe(200);
    });

    it('an initiation failure (busy) settles the call and frees the slot', async () => {
        const { s, call } = await started();
        const body = JSON.stringify({ type: 'call_initiation_failure', event_timestamp: ts, data: { agent_id: AGENT, conversation_id: 'conv_abc123', failure_reason: 'busy', metadata: { type: 'sip', body: {} } } });
        expect((await handleRiyaWebhook(s.deps, body, sign(body, ts))).status).toBe(200);
        expect((await s.calls.getCall(ORG, call.id))?.state).toBe('busy');
        expect(await s.repo.acquireLock(`riya:${ORG}`, 'probe', s.clock.now(), 1000)).toBe(true);
    });

    it('a call whose start timed out is matched by our own user id, once, onto that call only', async () => {
        const fetchImpl = jest.fn(async () => new Response('', { status: 504 }));
        const s = await setup({ mode: 'test', fetchImpl });
        const { call } = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps));
        expect(call.state).toBe('unknown');
        const body = postCall('conv_late', { user_id: `${ORG}~${call.id}` });
        expect((await handleRiyaWebhook(s.deps, body, sign(body, ts))).status).toBe(200);
        expect(await s.calls.getCall(ORG, call.id)).toMatchObject({ state: 'completed', providerConversationId: 'conv_late' });
        // A second conversation claiming the same call is refused (the call already has its conversation).
        const forged = postCall('conv_forged', { user_id: `${ORG}~${call.id}` });
        expect((await handleRiyaWebhook(s.deps, forged, sign(forged, ts))).status).toBe(503);
        expect((await s.calls.getCall(ORG, call.id))?.providerConversationId).toBe('conv_late');
    });

    it('a user id naming another school’s call cannot attach to it', async () => {
        const { s } = await started();
        const body = postCall('conv_x', { user_id: `${OTHER_ORG}~${riyaCallId(OTHER_ORG, crypto.randomUUID())}` });
        expect((await handleRiyaWebhook(s.deps, body, sign(body, ts))).status).toBe(503);
        expect(s.calls.links.has('conv_x')).toBe(false);
    });

    it('expired transcripts are deleted on read', async () => {
        const { s, call } = await started();
        const body = postCall('conv_abc123');
        await handleRiyaWebhook(s.deps, body, sign(body, ts));
        s.clock.advance(8 * 86_400_000);
        expect((await getRiyaCall(s.deps, ORG, call.id)).transcript).toBeNull();
        expect((await s.calls.getCall(ORG, call.id))?.transcript).toBeNull();
    });

    it('transcripts are not stored unless the deployment opts in', async () => {
        const s = await setup({ mode: 'test' });
        const { call } = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps));
        const body = postCall('conv_abc123');
        await handleRiyaWebhook(s.deps, body, sign(body, ts));
        expect((await getRiyaCall(s.deps, ORG, call.id)).transcript).toBeNull();
    });
});

describe('reconciliation and reads', () => {
    it('reconciles a call whose webhook never came (read-only at the provider)', async () => {
        const s = await setup({ mode: 'test' });
        const { call } = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps));
        const get = jest.fn(async () => new Response(JSON.stringify({ agent_id: AGENT, conversation_id: 'conv_abc123', status: 'done', metadata: { call_duration_secs: 33 }, analysis: { call_successful: 'success' } }), { status: 200 }));
        s.deps.http = { fetchImpl: get as unknown as typeof fetch };
        const detail = await reconcileRiyaCall(s.deps, ORG, call.id);
        expect(detail.call).toMatchObject({ state: 'completed', durationSeconds: 33 });
        expect((get.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBe('GET');
    });

    it('a call lost while initiating is shown as unknown, never re-dialled', async () => {
        const s = await setup();
        const lost = { ...(await (async () => { const { call } = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps)); return s.calls.getCall(ORG, call.id); })())! };
        await s.calls.mutateCall(ORG, lost.id, (c) => ({ ...c, state: 'initiating', endedAt: null }));
        s.clock.advance(10 * 60_000);
        const [view] = await listRiyaCalls(s.deps, ORG);
        expect(view).toMatchObject({ state: 'unknown', failureReason: 'lost_while_initiating' });
    });
});

describe('privacy of logs', () => {
    it('no log line carries a phone number, the API key or transcript text', async () => {
        logged.length = 0;
        const s = await setup({ mode: 'test' });
        const { call } = await startRiyaCall(s.deps, ORG, ADMIN, await startInput(s.deps));
        const body = postCall('conv_abc123');
        await handleRiyaWebhook(s.deps, body, sign(body, Math.floor(WED_11_IST.getTime() / 1000)));
        expect(call.id).toBeTruthy();
        const text = JSON.stringify(logged);
        expect(logged.length).toBeGreaterThan(0);
        expect(text).not.toMatch(/\+91\d{10}/);
        expect(text).not.toContain(API_KEY);
        expect(text).not.toContain('I can come');
        expect(text).not.toContain('Asha');
    });
});
