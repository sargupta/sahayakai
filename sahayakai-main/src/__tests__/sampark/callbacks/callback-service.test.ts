/** @jest-environment node */
/**
 * Callbacks end to end through the server service on in-memory repos: scheduling
 * rules at the chosen instant, tenancy, the state machine under races, and the
 * worker — due / not due, retries, a crashed worker, two workers at once, duplicate
 * prevention, Practice never touching a network, the real provider failing closed,
 * and a parent's "call me back" becoming a proposal that never calls by itself.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import crypto from 'node:crypto';

import { createMemoryCallbackRepo } from '@/lib/sampark/callbacks/repo';
import { CALLBACK_LEASE_MS, CALLBACK_MAX_ATTEMPTS, claim } from '@/lib/sampark/callbacks/state';
import type { RiyaFacts } from '@/lib/sampark/conversation/facts';
import { createMemoryConversationRepo } from '@/lib/sampark/conversation/repo';
import { RIYA_PURPOSES } from '@/lib/sampark/conversation/riya-purposes';
import { encryptPhone, hashPhone } from '@/lib/sampark/phone';
import type { SamparkRepo } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import {
    callbackSources,
    createCallback,
    listCallbacks,
    previewCallback,
    runCallbackTick,
    updateCallback,
    type CallbackDeps,
} from '@/server/sampark/callbacks';
import { previewRiyaCall, startRiyaCall } from '@/server/sampark/conversation';
import { SamparkServiceError } from '@/server/sampark/errors';
import type { SamparkMode } from '@/types/sampark';

import { guardian, prefs, school, student, testClock, type TestClock } from '../engine/_fixtures';
import { setPhoneEnv } from '../server/_helpers';

const ORG = 'hillview-demo';
const OTHER = 'other-school';
const ADMIN = 'admin-uid';
const TZ = 'Asia/Kolkata';
const WED_11_IST = new Date('2026-10-07T05:30:00Z');
const PTM: RiyaFacts = { purpose: 'ptm_invitation', date: '2026-10-10', time: { hour: 10, minute: 0 } };

interface Setup {
    deps: CallbackDeps;
    repo: SamparkRepo;
    callbacks: ReturnType<typeof createMemoryCallbackRepo>;
    calls: ReturnType<typeof createMemoryConversationRepo>;
    clock: TestClock;
    fetchImpl: jest.Mock;
    admins: Set<string>;
    env: Record<string, string | undefined>;
}

async function setup(opts: { mode?: SamparkMode; env?: Record<string, string | undefined> } = {}): Promise<Setup> {
    setPhoneEnv();
    const mode = opts.mode ?? 'practice';
    const repo = createMemorySamparkRepo();
    const calls = createMemoryConversationRepo();
    const callbacks = createMemoryCallbackRepo();
    const clock = testClock(WED_11_IST);
    const env = opts.env ?? { SAMPARK_ENABLED: 'true', SAMPARK_ELEVENLABS_ENABLED: 'true', SAMPARK_RIYA_PURPOSES: RIYA_PURPOSES.join(',') };
    const testPhone = '+919800000001';
    await repo.upsertSchool(school({ mode, ...(mode === 'test' ? { testPhoneEnc: encryptPhone(testPhone), testPhoneHash: hashPhone(testPhone), testPhoneLast4: '0001' } : {}) }));
    await repo.upsertSchool(school({ orgId: OTHER, displayName: 'Other School' }));
    await repo.upsertStudents(ORG, [student('s1', { spokenFirstName: { English: 'Asha' }, guardianIds: ['g1'] })]);
    const phone = '+919811111111';
    await repo.upsertGuardians(ORG, [guardian('g1', { phoneEnc: encryptPhone(phone), phoneHash: hashPhone(phone), phoneLast4: '1111', phoneClass: 'mobile', crmLanguage: 'English', studentIds: ['s1'] })]);
    await repo.upsertPreferences([prefs('g1', { notices: 'granted', progress: 'granted', recorded_conversation: 'granted' })]);
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({ success: true, conversation_id: 'conv_1', sip_call_id: 'sip_1' }), { status: 200 }));
    const admins = new Set([ADMIN]);
    const deps: CallbackDeps = {
        repo, calls, callbacks, clock, env,
        http: { fetchImpl: fetchImpl as unknown as typeof fetch },
        isOrgAdmin: async (orgId, uid) => orgId === ORG && admins.has(uid),
    };
    return { deps, repo, callbacks, calls, clock, fetchImpl, admins, env };
}

/** A finished Practice call to follow up (it records its facts). */
async function sourceCall(s: Setup, scenario: 'answered_positive' | 'callback_requested' = 'answered_positive'): Promise<string> {
    const input = { purpose: 'ptm_invitation' as const, guardianId: 'g1', studentId: 's1', facts: PTM };
    const preview = await previewRiyaCall(s.deps, ORG, input);
    const r = await startRiyaCall(s.deps, ORG, ADMIN, { ...input, idempotencyKey: crypto.randomUUID(), confirmedAnnouncement: preview.announcement ?? '', scenario });
    return r.call.id;
}

async function schedule(s: Setup, sourceCallId: string, scheduledAt: string, over: Partial<Parameters<typeof createCallback>[3]> = {}) {
    const p = await previewCallback(s.deps, ORG, { target: { sourceCallId }, scheduledAt, timeZone: TZ });
    return createCallback(s.deps, ORG, ADMIN, {
        target: { sourceCallId }, scheduledAt, timeZone: TZ, requestKey: crypto.randomUUID(), confirmedAnnouncement: p.announcement ?? 'x', ...over,
    });
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

const riyaCallCount = (s: Setup) => [...s.calls.calls.values()].length;

// ── Scheduling rules ────────────────────────────────────────────────────────

describe('scheduling', () => {
    it('stores the UTC instant and the IANA zone, and lists it', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        const { callback } = await schedule(s, src, '2026-10-07T17:00:00+05:30');
        expect(callback).toMatchObject({ status: 'scheduled', scheduledAt: '2026-10-07T11:30:00.000Z', timeZone: TZ, version: 1, createdBy: ADMIN, approvedBy: ADMIN, guardianPhoneLast4: '1111' });
        const list = await listCallbacks(s.deps, ORG, '2026-10-07T00:00:00Z', '2026-10-08T00:00:00Z');
        expect(list.callbacks.map((c) => c.id)).toEqual([callback.id]);
        // No phone number beyond the last four digits anywhere in the view.
        expect(JSON.stringify(list)).not.toMatch(/9811111111/);
    });

    it('refuses a time outside calling hours and names the next permitted time — never moves it', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        const p = await previewCallback(s.deps, ORG, { target: { sourceCallId: src }, scheduledAt: '2026-10-07T21:30:00+05:30', timeZone: TZ });
        expect(p.ok).toBe(false);
        expect(p.refusals.map((r) => r.code)).toContain('OUTSIDE_CALLING_HOURS');
        expect(p.nextAllowedAt).toBe('2026-10-08T04:30:00.000Z'); // Thursday 10:00 IST
        expect(await code(schedule(s, src, '2026-10-07T21:30:00+05:30'))).toBe('OUTSIDE_CALLING_HOURS');
        expect(s.callbacks.records.size).toBe(0);
    });

    it('refuses too soon, too far, and a holiday', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        expect(await code(schedule(s, src, '2026-10-07T11:00:30+05:30'))).toBe('TOO_SOON');
        expect(await code(schedule(s, src, '2026-12-07T11:00:00+05:30'))).toBe('TOO_FAR');
        await s.repo.upsertSchool({ ...(await s.repo.getSchool(ORG))!, holidays: ['2026-10-08'] });
        expect(await code(schedule(s, src, '2026-10-08T11:00:00+05:30'))).toBe('OUTSIDE_CALLING_HOURS');
    });

    it('refuses when the facts are no longer valid at that time (the PTM date has passed)', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        expect(await code(schedule(s, src, '2026-10-12T11:00:00+05:30'))).toBe('FACTS_INVALID');
    });

    it('needs the announcement the person approved', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        expect(await code(schedule(s, src, '2026-10-07T17:00:00+05:30', { confirmedAnnouncement: 'something else' }))).toBe('ANNOUNCEMENT_CHANGED');
    });

    it('is idempotent on the request key', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        const key = crypto.randomUUID();
        const a = await schedule(s, src, '2026-10-07T17:00:00+05:30', { requestKey: key });
        const b = await schedule(s, src, '2026-10-07T17:00:00+05:30', { requestKey: key });
        expect(b.duplicate).toBe(true);
        expect(b.callback.id).toBe(a.callback.id);
        expect(s.callbacks.records.size).toBe(1);
    });

    it('keeps schools apart: another school cannot use, see or change this school’s call or callback', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        expect(await code(previewCallback(s.deps, OTHER, { target: { sourceCallId: src }, scheduledAt: '2026-10-07T17:00:00+05:30', timeZone: TZ }))).toBe('CALLBACK_SOURCE_NOT_FOUND');
        const { callback } = await schedule(s, src, '2026-10-07T17:00:00+05:30');
        expect((await listCallbacks(s.deps, OTHER, '2026-10-01T00:00:00Z', '2026-10-30T00:00:00Z')).callbacks).toEqual([]);
        expect(await code(updateCallback(s.deps, OTHER, ADMIN, callback.id, { action: 'cancel', expectedVersion: 1 }))).toBe('CALLBACK_NOT_FOUND');
    });

    it('lists only the sources that carry their facts', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        expect((await callbackSources(s.deps, ORG)).map((x) => x.callId)).toEqual([src]);
    });
});

// ── Transitions ─────────────────────────────────────────────────────────────

describe('reschedule and cancel', () => {
    it('reschedules with a version check; a stale version is refused', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        const { callback } = await schedule(s, src, '2026-10-07T17:00:00+05:30');
        const p = await previewCallback(s.deps, ORG, { target: { sourceCallId: src }, scheduledAt: '2026-10-08T12:00:00+05:30', timeZone: TZ });
        const moved = await updateCallback(s.deps, ORG, ADMIN, callback.id, { action: 'reschedule', scheduledAt: '2026-10-08T12:00:00+05:30', timeZone: TZ, confirmedAnnouncement: p.announcement!, expectedVersion: 1 });
        expect(moved).toMatchObject({ status: 'scheduled', version: 2, scheduledAt: '2026-10-08T06:30:00.000Z' });
        expect(await code(updateCallback(s.deps, ORG, ADMIN, callback.id, { action: 'cancel', expectedVersion: 1 }))).toBe('CALLBACK_CHANGED');
    });

    it('cancels; a cancelled callback cannot be cancelled or moved again, and is never run', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        const { callback } = await schedule(s, src, '2026-10-07T11:10:00+05:30');
        await updateCallback(s.deps, ORG, ADMIN, callback.id, { action: 'cancel', expectedVersion: 1 });
        expect(await code(updateCallback(s.deps, ORG, ADMIN, callback.id, { action: 'cancel', expectedVersion: 1 }))).toBe('CALLBACK_NOT_OPEN');
        s.clock.advance(15 * 60_000);
        const before = riyaCallCount(s);
        expect((await runCallbackTick(s.deps)).claimed).toBe(0);
        expect(riyaCallCount(s)).toBe(before);
    });

    it('refuses to cancel or move a callback while the worker is starting it', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        const { callback } = await schedule(s, src, '2026-10-07T11:10:00+05:30');
        s.clock.advance(11 * 60_000);
        await s.callbacks.mutate(ORG, callback.id, (cb) => {
            const c = claim(cb, { holder: 'worker-a', now: s.clock.now() });
            return c.kind === 'claimed' ? c.next : null;
        });
        expect(await code(updateCallback(s.deps, ORG, ADMIN, callback.id, { action: 'cancel', expectedVersion: 1 }))).toBe('CALLBACK_IN_PROGRESS');
    });

    it('rejects status or execution fields in the request (strict schemas)', async () => {
        const { CallbackCreateSchema, CallbackUpdateSchema } = await import('@/server/sampark/callbacks');
        const base = { target: { sourceCallId: 'abc' }, scheduledAt: '2026-10-07T17:00:00+05:30', timeZone: TZ, requestKey: crypto.randomUUID(), confirmedAnnouncement: 'x' };
        expect(CallbackCreateSchema.safeParse({ ...base, status: 'completed' }).success).toBe(false);
        expect(CallbackCreateSchema.safeParse({ ...base, attempts: 0 }).success).toBe(false);
        expect(CallbackCreateSchema.safeParse({ ...base, timeZone: 'Mars/Olympus' }).success).toBe(false);
        expect(CallbackUpdateSchema.safeParse({ action: 'complete', expectedVersion: 1 }).success).toBe(false);
        expect(CallbackUpdateSchema.safeParse({ action: 'cancel', expectedVersion: 1, status: 'scheduled' }).success).toBe(false);
    });
});

// ── The worker ──────────────────────────────────────────────────────────────

describe('worker', () => {
    it('does nothing before the time, then starts exactly one Practice call at it — no network', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        const { callback } = await schedule(s, src, '2026-10-07T11:10:00+05:30');
        const before = riyaCallCount(s);
        expect((await runCallbackTick(s.deps)).claimed).toBe(0);
        s.clock.advance(10 * 60_000);
        const report = await runCallbackTick(s.deps);
        expect(report).toMatchObject({ claimed: 1, completed: 1, failed: 0 });
        const after = (await s.callbacks.get(ORG, callback.id))!;
        expect(after).toMatchObject({ status: 'completed', queueAt: null, lease: null });
        expect(riyaCallCount(s)).toBe(before + 1);
        expect((await s.calls.getCall(ORG, after.riyaCallId!))?.provider).toBe('simulated');
        // Again: nothing more.
        expect((await runCallbackTick(s.deps)).claimed).toBe(0);
        expect(riyaCallCount(s)).toBe(before + 1);
        expect(s.fetchImpl).not.toHaveBeenCalled();
    });

    it('two workers at once: one claims, the other skips (lock), and a direct second claim fails', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        const { callback } = await schedule(s, src, '2026-10-07T11:10:00+05:30');
        s.clock.advance(10 * 60_000);
        const before = riyaCallCount(s);
        const [a, b] = await Promise.all([runCallbackTick(s.deps, { holder: 'a' }), runCallbackTick(s.deps, { holder: 'b' })]);
        expect(a.claimed + b.claimed).toBe(1);
        expect(riyaCallCount(s)).toBe(before + 1);
        const c = claim((await s.callbacks.get(ORG, callback.id))!, { holder: 'c', now: s.clock.now() });
        expect(c.kind).toBe('skip');
    });

    it('a worker that crashed after starting the call: the next tick finishes it without dialling again', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        const { callback } = await schedule(s, src, '2026-10-07T11:10:00+05:30');
        s.clock.advance(10 * 60_000);
        // Worker A claims and starts the call, then dies before recording it.
        const claimed = await s.callbacks.mutate(ORG, callback.id, (cb) => {
            const c = claim(cb, { holder: 'dead-worker', now: s.clock.now() });
            return c.kind === 'claimed' ? c.next : null;
        });
        const { runIdempotencyKey } = await import('@/lib/sampark/callbacks/state');
        const key = runIdempotencyKey(crypto.createHash('sha256').update(`${ORG}|${callback.id}|${claimed!.record.version}`).digest('hex'));
        const cb = claimed!.record;
        await startRiyaCall(s.deps, ORG, ADMIN, { purpose: cb.riyaPurpose, guardianId: cb.guardianId, studentId: cb.studentId, facts: cb.facts!, idempotencyKey: key, confirmedAnnouncement: cb.announcement! });
        const before = riyaCallCount(s);
        // Before the lease expires nobody else touches it.
        expect((await runCallbackTick(s.deps)).claimed).toBe(0);
        s.clock.advance(CALLBACK_LEASE_MS + 1000);
        const report = await runCallbackTick(s.deps);
        expect(report.completed).toBe(1);
        expect(riyaCallCount(s)).toBe(before); // the existing call was returned, not a new one
        expect((await s.callbacks.get(ORG, callback.id))?.status).toBe('completed');
    });

    it('retries a transient refusal, then gives up after the maximum attempts', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        const { callback } = await schedule(s, src, '2026-10-07T11:10:00+05:30');
        // Another Riya call holds the school's single slot (startRiyaCall's lock).
        await s.repo.acquireLock(`riya:${ORG}`, 'someone-else', s.clock.now(), 24 * 60 * 60_000);
        s.clock.advance(10 * 60_000);
        expect((await runCallbackTick(s.deps)).retried).toBe(1);
        expect((await s.callbacks.get(ORG, callback.id))).toMatchObject({ status: 'scheduled', attempts: 1, lastError: { code: 'RIYA_CALL_IN_PROGRESS' } });
        for (let i = 1; i < CALLBACK_MAX_ATTEMPTS; i += 1) {
            s.clock.advance(60 * 60_000);
            await runCallbackTick(s.deps);
        }
        expect((await s.callbacks.get(ORG, callback.id))).toMatchObject({ status: 'failed', attempts: CALLBACK_MAX_ATTEMPTS });
    });

    it('a run reached over an hour late is missed, not called', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        const { callback } = await schedule(s, src, '2026-10-07T11:10:00+05:30');
        const before = riyaCallCount(s);
        s.clock.advance(2 * 60 * 60_000);
        expect((await runCallbackTick(s.deps)).missed).toBe(1);
        expect((await s.callbacks.get(ORG, callback.id))?.status).toBe('missed');
        expect(riyaCallCount(s)).toBe(before);
    });

    it('re-checks the rules at run time: an opt-out since scheduling fails it in words, no call', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        const { callback } = await schedule(s, src, '2026-10-07T11:10:00+05:30');
        const g = (await s.repo.getGuardian(ORG, 'g1'))!;
        await s.repo.upsertSuppression({ orgId: ORG, phoneHash: g.phoneHash, phoneLast4: g.phoneLast4, scope: 'all', source: 'office', officeVerification: 'verified', createdAt: s.clock.now().toISOString(), callId: null } as never);
        s.clock.advance(10 * 60_000);
        const before = riyaCallCount(s);
        await runCallbackTick(s.deps);
        expect((await s.callbacks.get(ORG, callback.id))).toMatchObject({ status: 'failed', lastError: { code: 'GATE_BLOCKED' } });
        expect(riyaCallCount(s)).toBe(before);
    });

    it('a holiday added after scheduling: refused with the next permitted time, never shifted', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        const { callback } = await schedule(s, src, '2026-10-07T11:10:00+05:30');
        await s.repo.upsertSchool({ ...(await s.repo.getSchool(ORG))!, holidays: ['2026-10-07'] });
        s.clock.advance(10 * 60_000);
        await runCallbackTick(s.deps);
        const after = (await s.callbacks.get(ORG, callback.id))!;
        expect(after).toMatchObject({ status: 'failed', lastError: { code: 'OUTSIDE_CALLING_HOURS' }, scheduledAt: '2026-10-07T05:40:00.000Z' });
        expect(after.lastError?.message).toMatch(/Choose a new time/);
    });

    it('the approver lost admin access: not called', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        const { callback } = await schedule(s, src, '2026-10-07T11:10:00+05:30');
        s.admins.delete(ADMIN);
        s.clock.advance(10 * 60_000);
        await runCallbackTick(s.deps);
        expect((await s.callbacks.get(ORG, callback.id))?.lastError?.code).toBe('APPROVER_NO_LONGER_ADMIN');
    });

    it('does nothing at all when Riya is switched off (fail closed)', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        await schedule(s, src, '2026-10-07T11:10:00+05:30');
        s.clock.advance(10 * 60_000);
        const r = await runCallbackTick({ ...s.deps, env: { ...s.env, SAMPARK_ELEVENLABS_ENABLED: 'false' } });
        expect(r).toMatchObject({ skipped: true, reason: 'riya_disabled', claimed: 0 });
    });
});

describe('real provider', () => {
    const testEnv = (extra: Record<string, string> = {}) => ({
        SAMPARK_ENABLED: 'true', SAMPARK_ELEVENLABS_ENABLED: 'true', SAMPARK_RIYA_PURPOSES: RIYA_PURPOSES.join(','),
        SAMPARK_LIVE_DIAL_ENABLED: 'true', ELEVENLABS_API_KEY: 'sk_test_not_a_real_key_0123456789', ELEVENLABS_AGENT_ID: 'agent_2401m4zy4gyaev48rz65wfmf5yr2',
        ELEVENLABS_AGENT_PHONE_NUMBER_ID: 'phnum_0000testtesttesttesttest00', ELEVENLABS_SOURCE_AGENT_ID: 'agent_0000sourcesourcesourcesource00',
        SAMPARK_FIRESTORE_DATABASE: 'sampark-nonprod', ELEVENLABS_WEBHOOK_SECRET: 'whsec_test_only', ...extra,
    });
    afterEach(() => { delete process.env.SAMPARK_LIVE_DIAL_ENABLED; });

    it('Test mode with ElevenLabs is refused for callbacks unless explicitly enabled — nothing is sent', async () => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        const s = await setup({ mode: 'test', env: testEnv() });
        // A source call exists from Practice days (written directly; no provider contact).
        const p = await previewCallback(s.deps, ORG, { target: { purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: PTM }, scheduledAt: '2026-10-07T17:00:00+05:30', timeZone: TZ });
        expect(p.refusals.map((r) => r.code)).toContain('CALLBACKS_PRACTICE_ONLY');
        expect(s.fetchImpl).not.toHaveBeenCalled();
    });
});

// ── A parent's "call me back" ───────────────────────────────────────────────

describe('conversation proposals', () => {
    it('a parent asking to be called back creates ONE proposal that never runs by itself', async () => {
        const s = await setup();
        const src = await sourceCall(s, 'callback_requested');
        const listing = await listCallbacks(s.deps, ORG, '2026-10-07T00:00:00Z', '2026-10-08T00:00:00Z');
        expect(listing.proposed).toHaveLength(1);
        const proposal = listing.proposed[0];
        expect(proposal).toMatchObject({
            status: 'proposed', source: 'conversation', sourceCallId: src, requestedText: 'in 20 minutes',
            scheduledAt: '2026-10-07T05:50:00.000Z', announcement: null, approvedBy: null, queueAt: null,
        });
        // Time passes; the worker never calls an unconfirmed proposal.
        const before = riyaCallCount(s);
        s.clock.advance(30 * 60_000);
        expect((await runCallbackTick(s.deps)).claimed).toBe(0);
        expect(riyaCallCount(s)).toBe(before);
    });

    it('confirming a proposal schedules it, and it then runs once', async () => {
        const s = await setup();
        await sourceCall(s, 'callback_requested');
        const proposal = (await listCallbacks(s.deps, ORG, '2026-10-07T00:00:00Z', '2026-10-08T00:00:00Z')).proposed[0];
        const when = '2026-10-07T11:20:00+05:30';
        const p = (await updateCallback(s.deps, ORG, ADMIN, proposal.id, { action: 'preview', scheduledAt: when, timeZone: TZ })) as { announcement: string };
        const confirmed = await updateCallback(s.deps, ORG, ADMIN, proposal.id, { action: 'confirm', scheduledAt: when, timeZone: TZ, confirmedAnnouncement: p.announcement, expectedVersion: 0 });
        expect(confirmed).toMatchObject({ status: 'scheduled', approvedBy: ADMIN, version: 1 });
        s.clock.advance(20 * 60_000);
        expect((await runCallbackTick(s.deps)).completed).toBe(1);
    });

    it('an ambiguous request is proposed without a time, with suggestions', async () => {
        const { proposeCallbackFromCall } = await import('@/server/sampark/callback-proposals');
        const s = await setup();
        const src = await sourceCall(s);
        const call = (await s.calls.getCall(ORG, src))!;
        const p = await proposeCallbackFromCall({ callbacks: s.callbacks, repo: s.repo, clock: s.clock }, { ...call, id: 'b'.repeat(32), dataCollection: { callback_requested_time: 'tomorrow morning' } });
        expect(p).toMatchObject({ status: 'proposed', scheduledAt: null, candidates: ['2026-10-08T04:30:00.000Z'] });
    });

    it('a re-delivered webhook proposes nothing new', async () => {
        const { proposeCallbackFromCall } = await import('@/server/sampark/callback-proposals');
        const s = await setup();
        const src = await sourceCall(s, 'callback_requested');
        const call = (await s.calls.getCall(ORG, src))!;
        expect(await proposeCallbackFromCall({ callbacks: s.callbacks, repo: s.repo, clock: s.clock }, call)).toBeNull();
        expect(s.callbacks.records.size).toBe(1);
    });
});


// ── Near-term scheduling, provider exceptions, the audit trail ─────────────

describe('near-term runs, provider exceptions and the audit trail', () => {
    it('a callback two minutes ahead is accepted and runs once at its time', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        const { callback } = await schedule(s, src, new Date(WED_11_IST.getTime() + 2 * 60_000).toISOString());
        const before = riyaCallCount(s);
        s.clock.advance(60_000);
        expect((await runCallbackTick(s.deps)).claimed).toBe(0); // not due yet
        s.clock.advance(60_000);
        expect((await runCallbackTick(s.deps)).completed).toBe(1);
        expect((await s.callbacks.get(ORG, callback.id))?.status).toBe('completed');
        expect(riyaCallCount(s)).toBe(before + 1);
    });

    it('an unexpected provider error is retried later, and the retry places exactly one call', async () => {
        const s = await setup();
        const src = await sourceCall(s);
        const { callback } = await schedule(s, src, '2026-10-07T11:10:00+05:30');
        const realLock = s.repo.acquireLock.bind(s.repo);
        let thrown = false;
        s.repo.acquireLock = async (name, holder, now, ttl) => {
            if (name === `riya:${ORG}` && !thrown) {
                thrown = true;
                throw new Error('ECONNRESET');
            }
            return realLock(name, holder, now, ttl);
        };
        s.clock.advance(10 * 60_000);
        const before = riyaCallCount(s);
        expect(await runCallbackTick(s.deps)).toMatchObject({ claimed: 1, retried: 1, completed: 0 });
        expect(await s.callbacks.get(ORG, callback.id)).toMatchObject({ status: 'scheduled', attempts: 1, lastError: { code: 'CALL_START_ERROR' } });
        expect(riyaCallCount(s)).toBe(before);
        s.clock.advance(5 * 60_000);
        expect((await runCallbackTick(s.deps)).completed).toBe(1);
        expect(riyaCallCount(s)).toBe(before + 1);
    });

    it('keeps an audit trail per callback, newest first, readable only inside its school', async () => {
        const { getCallbackHistory } = await import('@/server/sampark/callbacks');
        const s = await setup();
        const src = await sourceCall(s);
        const { callback } = await schedule(s, src, '2026-10-07T11:10:00+05:30');
        s.clock.advance(60_000);
        const p = await previewCallback(s.deps, ORG, { target: { sourceCallId: src }, scheduledAt: '2026-10-07T11:20:00+05:30', timeZone: TZ });
        await updateCallback(s.deps, ORG, ADMIN, callback.id, { action: 'reschedule', scheduledAt: '2026-10-07T11:20:00+05:30', timeZone: TZ, confirmedAnnouncement: p.announcement!, expectedVersion: 1 });
        s.clock.advance(20 * 60_000);
        await runCallbackTick(s.deps);
        const history = await getCallbackHistory(s.deps, ORG, callback.id);
        expect(history.map((h) => h.action)).toEqual(['callback.started', 'callback.reschedule', 'callback.create']);
        expect(history[0]).toMatchObject({ actor: 'system', attempt: 1, riyaCallId: (await s.callbacks.get(ORG, callback.id))!.riyaCallId });
        expect(history[2].actor).toBe(ADMIN);
        expect(JSON.stringify(history)).not.toMatch(/9811111111/);
        expect(await code(getCallbackHistory(s.deps, OTHER, callback.id))).toBe('CALLBACK_NOT_FOUND');
    });
});
