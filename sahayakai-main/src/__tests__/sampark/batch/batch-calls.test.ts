/** @jest-environment node */
/**
 * Class-wide batch calling end to end through the server service, on the in-memory repos.
 * Nothing here reaches a network: Practice uses the simulator, and the Vobiz path uses a mocked
 * `fetch` (each dial request is recorded) plus simulated Vobiz hangup callbacks and signed bridge
 * events delivered through the SAME public handlers production uses.
 *
 * Covers the 15 scenarios of the brief, plus the safety rails (allow-list, real-call switch and
 * confirmation, ElevenLabs never routed through Vobiz, crash recovery, privacy between calls).
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import crypto from 'node:crypto';

import { createMemoryBatchRepo } from '@/lib/sampark/batch/repo';
import { BATCH_PURPOSES, INDIVIDUAL_ONLY_PURPOSES, isBatchablePurpose } from '@/lib/sampark/batch/reasons';
import { isRetryable } from '@/lib/sampark/batch/state';
import { createMemoryCallbackRepo } from '@/lib/sampark/callbacks/repo';
import type { RiyaFacts } from '@/lib/sampark/conversation/facts';
import { createMemoryConversationRepo } from '@/lib/sampark/conversation/repo';
import { RIYA_PURPOSES } from '@/lib/sampark/conversation/riya-purposes';
import { signBridgeBody, vobizRiyaRef } from '@/lib/sampark/conversation/vobiz-provider';
import { encryptPhone, hashPhone } from '@/lib/sampark/phone';
import type { AuditEntry } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { SARGVISION_ORG_ID } from '@/lib/sampark/sargvision';
import { _resetVobizKeyCacheForTest, mintVobizToken, VOBIZ_DOMAINS } from '@/lib/vobiz/tokens';
import {
    actOnBatch,
    advanceBatch,
    batchAttemptKey,
    createBatch,
    getBatch,
    listBatchClasses,
    listBatches,
    previewBatch,
    runBatchTick,
    type BatchCreateInput,
    type BatchDeps,
} from '@/server/sampark/batch-calls';
import { previewRiyaCall, riyaCallId, startRiyaCall } from '@/server/sampark/conversation';
import { SamparkServiceError } from '@/server/sampark/errors';
import { handleVobizRiyaContext, handleVobizRiyaEvent, handleVobizRiyaStatus } from '@/server/sampark/vobiz-riya';
import type { SamparkGuardian, SamparkSchool } from '@/types/sampark';

import { guardian, prefs, school, student, testClock, type TestClock } from '../engine/_fixtures';
import { setPhoneEnv } from '../server/_helpers';

import {
    ADMIN,
    bridgeEvent,
    code,
    completeInFlight,
    createFrom,
    drain,
    EXAM,
    hangup,
    HOLIDAY,
    KEY,
    pad,
    phoneOf,
    setup,
    TEACHER_7A,
    vobizScript,
    WED_21_IST,
    type Setup,
} from './_harness';

afterEach(() => {
    delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
});

// ── 1. 30 eligible ───────────────────────────────────────────────────────────

describe('1. a class of 30 eligible families', () => {
    it('Practice: one preview, one start, 30 independent simulated calls with each child’s own details', async () => {
        const t = await setup({ count: 30 });
        const preview = await previewBatch(t.deps, t.org, ADMIN, { grade: 7, section: 'A', reason: 'holiday_announcement', facts: HOLIDAY });
        expect(preview.ok).toBe(true);
        expect(preview.totals).toMatchObject({ students: 30, eligible: 30, missingPhone: 0, optedOut: 0 });
        expect(preview.provider).toBe('simulated');
        // A class announcement: the same facts for everyone (each call still carries its own child's name).
        expect(preview.sampleAnnouncement).toContain('nineteenth of October');
        const { campaign } = await createFrom(t);
        const done = await drain(t, campaign.id);
        expect(done?.status).toBe('completed');
        const calls = [...t.calls.calls.values()];
        expect(calls).toHaveLength(30);
        expect(new Set(calls.map((c) => c.id)).size).toBe(30);
        for (const r of done!.recipients) {
            expect(r.status).toBe('completed');
            const call = calls.find((c) => c.id === r.currentCallId)!;
            expect(call.guardianId).toBe(r.guardianId);
            expect(call.variables.student_name).toBe(r.studentDisplayName);
            expect(call.announcement).toBe(r.announcement);
            expect(call.batch).toEqual({ campaignId: campaign.id, recipientId: r.id });
        }
        expect(t.fetchImpl).not.toHaveBeenCalled();
    });

    it('Vobiz (mocked): each family gets its own dial to its own number, own CallUUID, own context; concurrency is respected', async () => {
        const t = await setup({ count: 30, provider: 'vobiz-roster', concurrency: 2 });
        const { campaign } = await createFrom(t);
        expect(campaign.provider).toBe('vobiz');
        // First pass: only 2 in flight.
        expect(t.dials).toHaveLength(2);
        await runBatchTick(t.deps);
        expect(t.dials).toHaveLength(2); // slots still busy, nothing more dialled
        for (let i = 0; i < 40 && t.dials.length < 30; i += 1) {
            await completeInFlight(t);
            await runBatchTick(t.deps);
            const inFlight = [...t.calls.calls.values()].filter((c) => c.state === 'initiated').length;
            expect(inFlight).toBeLessThanOrEqual(2);
        }
        await completeInFlight(t);
        const done = await drain(t, campaign.id);
        expect(done?.status).toBe('completed');
        expect(t.dials).toHaveLength(30);
        expect(new Set(t.dials.map((d) => d.to)).size).toBe(30);
        const calls = [...t.calls.calls.values()];
        expect(new Set(calls.map((c) => c.providerConversationId)).size).toBe(30);
        for (const r of done!.recipients) {
            const call = calls.find((c) => c.id === r.currentCallId)!;
            const g = await t.repo.getGuardian(t.org, r.guardianId);
            // The number dialled for this call is THIS family's number.
            expect(g?.phoneHash).toBe(call.phoneHash);
            // The bridge's context for this call carries THIS child only.
            const ctx = await handleVobizRiyaContext(t.deps, (await mintVobizToken(VOBIZ_DOMAINS.SAMPARK_RIYA_CONTEXT, vobizRiyaRef(t.org, call.id))).token);
            expect(ctx.status).toBe(404); // terminal calls no longer serve context
            expect(call.variables.student_name).toBe(r.studentDisplayName);
            // No other child's name in this call's transcript.
            const text = (call.transcript ?? []).map((x) => x.message).join(' ');
            for (const other of done!.recipients.filter((x) => x.id !== r.id)) expect(text).not.toContain(other.studentDisplayName);
        }
    });

    it('the bridge context of an in-flight call carries that call’s family only', async () => {
        const t = await setup({ count: 3, provider: 'vobiz-roster', concurrency: 3 });
        const { campaign } = await createFrom(t);
        const c = await t.batches.get(t.org, campaign.id);
        for (const r of c!.recipients) {
            const ctx = await handleVobizRiyaContext(t.deps, (await mintVobizToken(VOBIZ_DOMAINS.SAMPARK_RIYA_CONTEXT, vobizRiyaRef(t.org, r.currentCallId!))).token);
            expect(ctx.status).toBe(200);
            expect((ctx.body as { riyaVariables: Record<string, string> }).riyaVariables.student_name).toBe(r.studentDisplayName);
        }
    });
});

// ── 2/3. missing phones, opt-outs ────────────────────────────────────────────

describe('2-3. ineligible families are never included', () => {
    it('missing / invalid numbers and opted-out or no-consent families are excluded with reasons', async () => {
        const fams: Family[] = [
            ...Array.from({ length: 25 }, (_, i) => ({ n: i + 1 })),
            { n: 26, phone: null },
            { n: 27, invalid: true },
            { n: 28, optOut: 'suppressed' as const },
            { n: 29, optOut: 'crm' as const },
            { n: 30, optOut: 'consent_denied' as const },
            { n: 31, optOut: 'no_recording_consent' as const },
            { n: 32, language: 'Hindi' as const },
        ];
        const t = await setup({ families: fams });
        const p = await previewBatch(t.deps, t.org, ADMIN, { grade: 7, section: 'A', reason: 'holiday_announcement', facts: HOLIDAY });
        expect(p.totals).toMatchObject({ students: 32, eligible: 25, missingPhone: 2, optedOut: 3 });
        expect(p.totals.otherExcluded).toBe(2);
        const reasonOf = (id: string) => p.recipients.find((r) => r.studentId === id)?.exclusion?.reason;
        expect(reasonOf('s26')).toBe('missing_phone');
        expect(reasonOf('s27')).toBe('missing_phone');
        expect(reasonOf('s28')).toBe('opted_out');
        expect(reasonOf('s29')).toBe('opted_out');
        expect(reasonOf('s30')).toBe('opted_out');
        expect(reasonOf('s31')).toBe('no_consent');
        expect(reasonOf('s32')).toBe('language');
        const { campaign } = await createFrom(t);
        expect(campaign.recipients).toHaveLength(25);
        expect(campaign.excluded).toHaveLength(7);
        await drain(t, campaign.id);
        const called = new Set([...t.calls.calls.values()].map((c) => c.studentId));
        for (const id of ['s26', 's27', 's28', 's29', 's30', 's31', 's32']) expect(called.has(id)).toBe(false);
    });

    it('the teacher can remove families before starting; the confirmed count must match', async () => {
        const t = await setup({ count: 5 });
        const excluded = [{ guardianId: 'g02', studentId: 's02' }];
        const p = await previewBatch(t.deps, t.org, ADMIN, { grade: 7, section: 'A', reason: 'holiday_announcement', facts: HOLIDAY, excluded });
        expect(p.totals).toMatchObject({ eligible: 4, teacherExcluded: 1 });
        expect(await code(createBatch(t.deps, t.org, ADMIN, { grade: 7, section: 'A', reason: 'holiday_announcement', facts: HOLIDAY, excluded, requestKey: crypto.randomUUID(), confirmedRecipientCount: 5, confirmedSampleAnnouncement: p.sampleAnnouncement! }))).toBe('RECIPIENTS_CHANGED');
        const { campaign } = await createFrom(t, { excluded });
        expect(campaign.recipients.map((r) => r.studentId)).not.toContain('s02');
        expect(campaign.excluded.find((e) => e.studentId === 's02')?.reason).toBe('teacher_excluded');
    });

    it('Sargvision allow-list is preserved: only allow-listed contacts are dialled for real', async () => {
        const t = await setup({ count: 9, provider: 'vobiz-roster', allow: [1, 4], concurrency: 3 });
        const p = await previewBatch(t.deps, t.org, ADMIN, { grade: 7, section: 'A', reason: 'holiday_announcement', facts: HOLIDAY });
        expect(p.totals.eligible).toBe(2);
        expect(p.recipients.filter((r) => r.exclusion?.reason === 'not_allow_listed')).toHaveLength(7);
        const { campaign } = await createFrom(t);
        await completeInFlight(t);
        await drain(t, campaign.id);
        expect(t.dials.map((d) => d.to).sort()).toEqual([phoneOf(1), phoneOf(4)].sort());
    });
});

// ── 4/5/6. partial, pause/resume, cancel ─────────────────────────────────────

describe('4-6. progress, pause, resume, cancel', () => {
    it('4. a partially completed campaign reports exact progress', async () => {
        const t = await setup({ count: 6, provider: 'vobiz-roster', concurrency: 2 });
        const { campaign } = await createFrom(t);
        const [a, b] = [...t.calls.calls.values()];
        await bridgeEvent(t, a.id);
        await hangup(t, b.id, 'NO_ANSWER');
        await advanceBatch(t.deps, t.org, campaign.id);
        const d = await getBatch(t.deps, t.org, ADMIN, campaign.id);
        expect(d.campaign.progress).toMatchObject({ total: 6, completed: 1, failedOrNoAnswer: 1, inProgress: 2, pending: 2 });
        expect(d.calls).toHaveLength(4);
        expect(d.calls.every((c) => !('transcript' in c))).toBe(true); // transcripts never leave the server
    });

    it('5. pause stops new calls only; in-flight results still land; resume never re-dials a finished family', async () => {
        const t = await setup({ count: 5, provider: 'vobiz-roster', concurrency: 2 });
        const { campaign } = await createFrom(t);
        expect(t.dials).toHaveLength(2);
        await actOnBatch(t.deps, t.org, ADMIN, campaign.id, { action: 'pause' });
        await completeInFlight(t);
        await runBatchTick(t.deps);
        await runBatchTick(t.deps);
        expect(t.dials).toHaveLength(2);
        let c = await t.batches.get(t.org, campaign.id);
        expect(c?.status).toBe('paused');
        expect(c?.recipients.filter((r) => r.status === 'completed')).toHaveLength(2);
        await actOnBatch(t.deps, t.org, ADMIN, campaign.id, { action: 'resume' });
        for (let i = 0; i < 6; i += 1) { await completeInFlight(t); await runBatchTick(t.deps); }
        c = await t.batches.get(t.org, campaign.id);
        expect(c?.status).toBe('completed');
        expect(t.dials).toHaveLength(5);
        expect(new Set(t.dials.map((d) => d.to)).size).toBe(5);
    });

    it('6. cancel stops pending families; a call already ringing finishes and is recorded', async () => {
        const t = await setup({ count: 5, provider: 'vobiz-roster', concurrency: 1 });
        const { campaign } = await createFrom(t);
        expect(t.dials).toHaveLength(1);
        await actOnBatch(t.deps, t.org, ADMIN, campaign.id, { action: 'cancel' });
        let c = await t.batches.get(t.org, campaign.id);
        expect(c?.status).toBe('cancelled');
        expect(c?.open).toBe(true); // one call still in flight
        expect(c?.recipients.filter((r) => r.status === 'cancelled')).toHaveLength(4);
        await completeInFlight(t);
        await runBatchTick(t.deps);
        c = await t.batches.get(t.org, campaign.id);
        expect(c?.recipients.filter((r) => r.status === 'completed')).toHaveLength(1);
        expect(c?.open).toBe(false);
        expect(t.dials).toHaveLength(1);
        expect(await code(actOnBatch(t.deps, t.org, ADMIN, campaign.id, { action: 'retry' }))).toBe('CANCELLED');
    });
});

// ── 7. one failure among successes ───────────────────────────────────────────

describe('7. one failed call does not stop the campaign', () => {
    it('a Vobiz refusal and a busy line fail only those families; retry is explicit and only for them', async () => {
        const t = await setup({ count: 5, provider: 'vobiz-roster', concurrency: 1, reject: [phoneOf(2)] });
        const { campaign } = await createFrom(t);
        for (let i = 0; i < 10; i += 1) {
            for (const c of t.calls.calls.values()) {
                if (c.state !== 'initiated') continue;
                if (c.studentId === 's03') await hangup(t, c.id, 'USER_BUSY');
                else await bridgeEvent(t, c.id);
            }
            await runBatchTick(t.deps);
        }
        let c = await t.batches.get(t.org, campaign.id);
        expect(c?.status).toBe('completed');
        const by = (id: string) => c!.recipients.find((r) => r.studentId === id)!;
        expect(by('s02').status).toBe('failed');
        expect(by('s03').status).toBe('busy');
        expect(c!.recipients.filter((r) => r.status === 'completed')).toHaveLength(3);
        const before = t.dials.length;
        // Nothing is retried automatically.
        await runBatchTick(t.deps);
        expect(t.dials.length).toBe(before);
        await actOnBatch(t.deps, t.org, ADMIN, campaign.id, { action: 'retry', recipientIds: [by('s03').id] });
        expect(t.dials.length).toBe(before + 1);
        expect(t.dials.at(-1)?.to).toBe(phoneOf(3));
        c = await t.batches.get(t.org, campaign.id);
        expect(c!.recipients.find((r) => r.studentId === 's03')?.attempts).toBe(2);
        // The old attempt's late hangup cannot overwrite the new attempt.
        const first = c!.recipients.find((r) => r.studentId === 's03')!.callIds[0];
        await hangup(t, first, 'NO_ANSWER');
        await advanceBatch(t.deps, t.org, campaign.id);
        c = await t.batches.get(t.org, campaign.id);
        expect(c!.recipients.find((r) => r.studentId === 's03')?.status).toBe('in_progress');
    });
});

// ── 8. duplicates ────────────────────────────────────────────────────────────

describe('8. duplicate campaigns and duplicate calls', () => {
    it('the same announcement to the same class is refused; a repeated request key returns the same campaign', async () => {
        const t = await setup({ count: 3 });
        const req = { grade: 7, section: 'A', reason: 'holiday_announcement' as const, facts: HOLIDAY, excluded: [] };
        const p = await previewBatch(t.deps, t.org, ADMIN, req);
        const key = crypto.randomUUID();
        const body = { ...req, requestKey: key, confirmedRecipientCount: 3, confirmedSampleAnnouncement: p.sampleAnnouncement!, confirmRealCalls: false };
        const first = await createBatch(t.deps, t.org, ADMIN, body);
        const again = await createBatch(t.deps, t.org, ADMIN, body);
        expect(again.duplicate).toBe(true);
        expect(again.campaign.id).toBe(first.campaign.id);
        await drain(t, first.campaign.id);
        expect(t.calls.calls.size).toBe(3);
        expect(await code(createFrom(t))).toBe('DUPLICATE_CAMPAIGN');
        expect(t.calls.calls.size).toBe(3);
        // A different announcement is a different campaign.
        expect((await createFrom(t, { reason: 'exam_reminder', facts: EXAM })).duplicate).toBe(false);
    });

    it('a family already called individually about the same announcement is skipped, not called again', async () => {
        const t = await setup({ count: 3 });
        const pre = await previewRiyaCall(t.deps, t.org, { purpose: 'holiday_notice', guardianId: 'g02', studentId: 's02', facts: HOLIDAY });
        await startRiyaCall(t.deps, t.org, ADMIN, { purpose: 'holiday_notice', guardianId: 'g02', studentId: 's02', facts: HOLIDAY, idempotencyKey: crypto.randomUUID(), confirmedAnnouncement: pre.announcement! });
        const { campaign } = await createFrom(t);
        const c = await drain(t, campaign.id);
        expect(c!.recipients.find((r) => r.studentId === 's02')?.status).toBe('skipped');
        expect([...t.calls.calls.values()].filter((x) => x.studentId === 's02')).toHaveLength(1);
    });

    it('a crash after the claim never places a second call for the same attempt', async () => {
        const t = await setup({ count: 1, provider: 'vobiz-roster' });
        const { campaign } = await createFrom(t);
        const r = (await t.batches.get(t.org, campaign.id))!.recipients[0];
        expect(r.currentCallId).toBe(riyaCallId(t.org, batchAttemptKey(campaign.id, r.id, 1)));
        // Simulate a lost update: the recipient looks 'dialing' again with an expired claim.
        await t.batches.mutate(t.org, campaign.id, (c) => ({ ...c, recipients: c.recipients.map((x) => ({ ...x, status: 'dialing', claimUntil: '2026-10-07T00:00:00.000Z' })) }));
        await runBatchTick(t.deps);
        expect(t.dials).toHaveLength(1);
        expect((await t.batches.get(t.org, campaign.id))!.recipients[0].status).toBe('in_progress');
    });
});

// ── 9/10. callback and do-not-call ───────────────────────────────────────────

describe('9-10. callback and do-not-call requests', () => {
    it('9. a callback request is stored against that family as a PROPOSED callback and never redialled automatically', async () => {
        const t = await setup({ count: 3, provider: 'vobiz-roster', concurrency: 3 });
        const { campaign } = await createFrom(t);
        const target = [...t.calls.calls.values()].find((c) => c.studentId === 's02')!;
        await bridgeEvent(t, target.id, { dataCollection: { recipient_confirmed: 'yes', good_time_to_talk: 'no', callback_requested_time: 'tomorrow at 5 PM' } });
        await completeInFlight(t);
        const c = await drain(t, campaign.id);
        const r = c!.recipients.find((x) => x.studentId === 's02')!;
        expect(r.callbackRequested).toBe(true);
        expect(isRetryable(r)).toBe(false);
        const proposed = [...t.callbacks.records.values()];
        expect(proposed).toHaveLength(1);
        expect(proposed[0]).toMatchObject({ guardianId: 'g02', studentId: 's02', sourceCallId: target.id, status: 'proposed' });
        await runBatchTick(t.deps);
        expect(t.dials).toHaveLength(3);
        expect(await code(actOnBatch(t.deps, t.org, ADMIN, campaign.id, { action: 'retry', recipientIds: [r.id] }))).toBe('NOTHING_TO_RETRY');
    });

    it('10. a do-not-call request suppresses the number; the family is never retried or included again', async () => {
        const t = await setup({ count: 3, provider: 'vobiz-roster', concurrency: 3 });
        const { campaign } = await createFrom(t);
        const target = [...t.calls.calls.values()].find((c) => c.studentId === 's01')!;
        await bridgeEvent(t, target.id, { dataCollection: { recipient_confirmed: 'yes', stop_requested: 'yes' } });
        await completeInFlight(t);
        const c = await drain(t, campaign.id);
        const r = c!.recipients.find((x) => x.studentId === 's01')!;
        expect(r.stopRequested).toBe(true);
        expect(await t.repo.getSuppression(t.org, target.phoneHash)).not.toBeNull();
        expect(isRetryable(r)).toBe(false);
        const p = await previewBatch(t.deps, t.org, ADMIN, { grade: 7, section: 'A', reason: 'exam_reminder', facts: EXAM });
        expect(p.recipients.find((x) => x.studentId === 's01')?.exclusion?.reason).toBe('opted_out');
    });
});

// ── 11. individual-only reasons ──────────────────────────────────────────────

describe('11. individual-specific reasons are not batchable', () => {
    it('absence, academic, behaviour and achievement workflows are refused for a class batch', async () => {
        for (const p of INDIVIDUAL_ONLY_PURPOSES) expect(isBatchablePurpose(p)).toBe(false);
        expect(BATCH_PURPOSES).toEqual(expect.arrayContaining(['holiday_notice', 'emergency_closure', 'exam_schedule_notice', 'event_invitation', 'ptm_invitation']));
        const t = await setup({ count: 3 });
        const behaviour: RiyaFacts = { purpose: 'classroom_behaviour', observations: ['attention'] };
        const p = await previewBatch(t.deps, t.org, ADMIN, { grade: 7, section: 'A', reason: 'ptm_general', facts: behaviour });
        expect(p.ok).toBe(false);
        expect(p.blockers.map((b) => b.code)).toEqual(expect.arrayContaining(['NOT_BATCHABLE', 'PURPOSE_MISMATCH']));
        expect(await code(createBatch(t.deps, t.org, ADMIN, { grade: 7, section: 'A', reason: 'ptm_general', facts: behaviour, requestKey: crypto.randomUUID(), confirmedRecipientCount: 3, confirmedSampleAnnouncement: 'x' }))).toBe('NOT_BATCHABLE');
        expect(t.calls.calls.size).toBe(0);
    });

    it('reasons without an approved Riya workflow are not available', async () => {
        const t = await setup({ count: 2 });
        const p = await previewBatch(t.deps, t.org, ADMIN, { grade: 7, section: 'A', reason: 'timetable_change', facts: HOLIDAY });
        expect(p.blockers.map((b) => b.code)).toContain('REASON_NOT_AVAILABLE');
    });
});

// ── 12. permissions ──────────────────────────────────────────────────────────

describe('12. teacher permissions and class restrictions', () => {
    it('a teacher sees and runs only their own classes; the admin sees all', async () => {
        const fams: Family[] = [{ n: 1 }, { n: 2 }, { n: 3, section: 'B' }];
        const t = await setup({ families: fams });
        expect((await listBatchClasses(t.deps, t.org, TEACHER_7A)).map((c) => c.key)).toEqual(['7-A']);
        expect((await listBatchClasses(t.deps, t.org, ADMIN)).map((c) => c.key)).toEqual(['7-A', '7-B']);
        expect(await code(previewBatch(t.deps, t.org, TEACHER_7A, { grade: 7, section: 'B', reason: 'holiday_announcement', facts: HOLIDAY }))).toBe('CLASS_NOT_AUTHORISED');
        expect(await code(previewBatch(t.deps, t.org, 'stranger', { grade: 7, section: 'A', reason: 'holiday_announcement', facts: HOLIDAY }))).toBe('CLASS_NOT_AUTHORISED');
        const { campaign } = await createFrom(t, {}, TEACHER_7A);
        expect(campaign.recipients).toHaveLength(2);
        const b = await createFrom(t, { section: 'B' }, ADMIN);
        expect((await listBatches(t.deps, t.org, TEACHER_7A)).map((c) => c.id)).toEqual([campaign.id]);
        expect(await code(getBatch(t.deps, t.org, TEACHER_7A, b.campaign.id))).toBe('CLASS_NOT_AUTHORISED');
        expect(await code(actOnBatch(t.deps, t.org, TEACHER_7A, b.campaign.id, { action: 'cancel' }))).toBe('CLASS_NOT_AUTHORISED');
    });

    it('a campaign whose creator loses the class is paused by the queue', async () => {
        const t = await setup({ count: 3, provider: 'vobiz-roster', concurrency: 1 });
        const { campaign } = await createFrom(t, {}, TEACHER_7A);
        t.deps.canManageClass = async (_o, uid) => uid === ADMIN;
        await completeInFlight(t);
        await runBatchTick(t.deps);
        const c = await t.batches.get(t.org, campaign.id);
        expect(c?.status).toBe('paused');
        expect(c?.pauseReason).toBe('CREATOR_NOT_AUTHORISED');
        expect(t.dials).toHaveLength(1);
    });
});

// ── 13. concurrent campaigns ─────────────────────────────────────────────────

describe('13. concurrent campaigns', () => {
    it('two campaigns for the same class never ring one family twice at once, and stay within the school slots', async () => {
        const t = await setup({ count: 4, provider: 'vobiz-roster', concurrency: 2 });
        const a = await createFrom(t);
        const b = await createFrom(t, { reason: 'exam_reminder', facts: EXAM });
        for (let i = 0; i < 20; i += 1) {
            const inFlight = [...t.calls.calls.values()].filter((c) => c.state === 'initiated');
            expect(inFlight.length).toBeLessThanOrEqual(2);
            expect(new Set(inFlight.map((c) => c.guardianId)).size).toBe(inFlight.length);
            await completeInFlight(t);
            await runBatchTick(t.deps);
        }
        expect((await t.batches.get(t.org, a.campaign.id))?.status).toBe('completed');
        expect((await t.batches.get(t.org, b.campaign.id))?.status).toBe('completed');
        expect(t.dials).toHaveLength(8);
        // Each call is attributed to its own campaign.
        for (const c of t.calls.calls.values()) expect([a.campaign.id, b.campaign.id]).toContain(c.batch?.campaignId);
    });
});

// ── 14. webhook matching ─────────────────────────────────────────────────────

describe('14. Vobiz webhook matching and reconciliation', () => {
    it('results delivered out of order land on the right family, and duplicates change nothing', async () => {
        const t = await setup({ count: 4, provider: 'vobiz-roster', concurrency: 3 });
        const { campaign } = await createFrom(t);
        const outcome: Record<string, string> = { s01: 'busy', s02: 'completed', s03: 'no_answer', s04: 'completed' };
        const deliver = async (call: { id: string; studentId: string }) => {
            const want = outcome[call.studentId];
            if (want === 'busy') await hangup(t, call.id, 'USER_BUSY');
            else if (want === 'no_answer') await hangup(t, call.id, 'NO_ANSWER');
            else {
                await bridgeEvent(t, call.id, { dataCollection: { recipient_confirmed: 'yes', late_return_date: call.studentId } });
                await bridgeEvent(t, call.id); // duplicate delivery
            }
        };
        // Three rang at once (the ceiling); their results arrive newest first.
        for (const call of [...t.calls.calls.values()].reverse()) await deliver(call);
        // A freed slot launches the fourth family; deliver its result too.
        await drain(t, campaign.id);
        for (const call of [...t.calls.calls.values()]) if (call.state === 'initiated') await deliver(call);
        const d = await getBatch(t.deps, t.org, ADMIN, campaign.id);
        for (const r of d.campaign.recipients) expect(r.status).toBe(outcome[r.studentId]);
        for (const call of d.calls.filter((c) => c.state === 'completed')) {
            // Each call's own answers: never another family's.
            expect(call.dataCollection.late_return_date).toBe(call.studentId);
            expect(call.appliedEvents).toBeUndefined();
        }
        // A forged event for a call of ANOTHER campaign/school is ignored.
        const other = await bridgeEvent(t, 'f'.repeat(32));
        expect(other.status).toBe(200);
    });

    it('a call with no result past its provider time limit, provider unreachable, is shown as unknown and is never redialled automatically', async () => {
        const script = vobizScript();
        const t = await setup({ count: 1, provider: 'vobiz-roster', script });
        const { campaign } = await createFrom(t);
        const placed = [...t.calls.calls.values()][0];
        script.lookup.set(placed.providerConversationId!.slice(6), 'down');
        t.clock.advance(21 * 60_000);
        await runBatchTick(t.deps);
        const r = (await t.batches.get(t.org, campaign.id))!.recipients[0];
        expect(r.status).toBe('unknown');
        expect(isRetryable(r)).toBe(false);
        expect(t.dials).toHaveLength(1);
        // A late result still lands (the campaign page mirrors it on read).
        await bridgeEvent(t, r.currentCallId!);
        expect((await getBatch(t.deps, t.org, ADMIN, campaign.id)).campaign.recipients[0].status).toBe('completed');
    });
});

// ── 15. the individual path is unchanged ─────────────────────────────────────

describe('15. the individual Riya call is preserved', () => {
    it('an individual call uses the original single-flight slot and carries no batch link', async () => {
        const t = await setup({ count: 2, provider: 'vobiz-roster', concurrency: 1 });
        const pre = await previewRiyaCall(t.deps, t.org, { purpose: 'holiday_notice', guardianId: 'g01', studentId: 's01', facts: HOLIDAY });
        const r = await startRiyaCall(t.deps, t.org, ADMIN, { purpose: 'holiday_notice', guardianId: 'g01', studentId: 's01', facts: HOLIDAY, idempotencyKey: crypto.randomUUID(), confirmedAnnouncement: pre.announcement! });
        const call = await t.calls.getCall(t.org, r.call.id);
        expect(call?.batch).toBeUndefined();
        expect(call?.lockSlot).toBeUndefined();
        // While it rings, a batch (1 slot) waits for it instead of ringing a second phone.
        const { campaign } = await createFrom(t, { reason: 'exam_reminder', facts: EXAM });
        expect(t.dials).toHaveLength(1);
        await bridgeEvent(t, r.call.id);
        await runBatchTick(t.deps);
        expect(t.dials).toHaveLength(2);
        expect((await t.batches.get(t.org, campaign.id))!.recipients.filter((x) => x.status === 'in_progress')).toHaveLength(1);
    });
});

// ── Safety rails ─────────────────────────────────────────────────────────────

describe('safety rails', () => {
    it('ElevenLabs selected: no real batch, and nothing is routed through Vobiz', async () => {
        const t = await setup({ count: 3, provider: 'elevenlabs-roster' });
        const p = await previewBatch(t.deps, t.org, ADMIN, { grade: 7, section: 'A', reason: 'holiday_announcement', facts: HOLIDAY });
        expect(p.provider).toBe('elevenlabs');
        expect(p.blockers.map((b) => b.code)).toContain('BATCH_PROVIDER_NOT_SUPPORTED');
        expect(await code(createFrom(t))).toBe('BATCH_PROVIDER_NOT_SUPPORTED');
        expect(t.fetchImpl).not.toHaveBeenCalled();
    });

    it('real batches need the deployment switch and an explicit confirmation', async () => {
        const off = await setup({ count: 2, provider: 'vobiz-roster', env: { SAMPARK_BATCH_REAL_CALLS: undefined } });
        expect(await code(createFrom(off))).toBe('REAL_BATCH_DISABLED');
        const on = await setup({ count: 2, provider: 'vobiz-roster' });
        expect(await code(createFrom(on, { confirmRealCalls: false }))).toBe('REAL_CALL_CONFIRMATION_REQUIRED');
        expect(on.fetchImpl).not.toHaveBeenCalled();
    });

    it('a school whose Test mode rings one test phone cannot run a real batch', async () => {
        const t = await setup({ count: 3, provider: 'vobiz-test-phone', env: { FIRESTORE_EMULATOR_HOST: undefined, SAMPARK_RIYA_TEST_ALLOWED_NUMBERS: '+919800000001' } });
        const p = await previewBatch(t.deps, t.org, ADMIN, { grade: 7, section: 'A', reason: 'holiday_announcement', facts: HOLIDAY });
        expect(p.blockers.map((b) => b.code)).toContain('BATCH_NEEDS_OWN_NUMBERS');
    });

    it('outside calling hours the campaign waits and dials when the window opens', async () => {
        const t = await setup({ count: 2, provider: 'vobiz-roster', concurrency: 2, at: WED_21_IST });
        const p = await previewBatch(t.deps, t.org, ADMIN, { grade: 7, section: 'A', reason: 'holiday_announcement', facts: HOLIDAY });
        expect(p.ok).toBe(true);
        expect(p.waiting?.code).toBe('OUTSIDE_CALLING_HOURS');
        const { campaign } = await createFrom(t);
        expect(t.dials).toHaveLength(0);
        expect((await t.batches.get(t.org, campaign.id))?.waitingReason).toBe('OUTSIDE_CALLING_HOURS');
        t.clock.set(new Date('2026-10-08T05:00:00Z')); // Thursday 10:30 IST
        await runBatchTick(t.deps);
        expect(t.dials).toHaveLength(2);
    });

    it('the daily batch limit stops further real dials', async () => {
        const t = await setup({ count: 4, provider: 'vobiz-roster', concurrency: 1, env: { SAMPARK_BATCH_DAILY_LIMIT: '2' } });
        const { campaign } = await createFrom(t);
        for (let i = 0; i < 6; i += 1) { await completeInFlight(t); await runBatchTick(t.deps); }
        expect(t.dials).toHaveLength(2);
        expect((await t.batches.get(t.org, campaign.id))?.waitingReason).toBe('DAILY_LIMIT_REACHED');
    });

    it('every start and outcome is audited with the campaign id', async () => {
        const t = await setup({ count: 2 });
        const { campaign } = await createFrom(t);
        await drain(t, campaign.id);
        expect(t.audits.some((a) => a.action === 'batch_campaign.start')).toBe(true);
        expect(t.audits.filter((a) => a.action === 'riya_call.start' && (a.detail as { batchCampaignId?: string })?.batchCampaignId === campaign.id)).toHaveLength(2);
        expect(t.audits.some((a) => a.action === 'batch_campaign.completed')).toBe(true);
    });
});
