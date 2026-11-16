/** @jest-environment node */
/**
 * Class gate: an emergency purpose sent to a whole class is a school decision. Only a school
 * admin may start it; class notices stay with the teacher who manages the class.
 *
 * The bugs this catches: through class-wide batch calls any teacher assigned to a class could
 * send an emergency closure (catalogue D4: principal-approved, may ring from 06:00, may bypass
 * notice consent) to every family in the class, which the same teacher could not do through a
 * single Riya call; and, once that was closed at creation, the same teacher could still resume a
 * closure the admin had paused, or retry its unanswered families after it finished. Every way a
 * campaign starts ringing is covered: create, resume, retry, and the dial pass itself when the
 * creator stops being an admin. The rule follows the catalogue's `emergency` flag, so a future
 * emergency purpose is covered the moment it becomes batchable.
 */
import type { RiyaFacts } from '@/lib/sampark/conversation/facts';
import { BATCH_PURPOSES, BATCH_REASONS } from '@/lib/sampark/batch/reasons';
import { purposeSpec } from '@/lib/sampark/catalogue';
import { riyaPurposeSpec } from '@/lib/sampark/conversation/riya-purposes';

import { actOnBatch, runBatchTick } from '@/server/sampark/batch-calls';

import { ADMIN, bridgeEvent, code, completeInFlight, createFrom, hangup, HOLIDAY, setup, TEACHER_7A } from './_harness';

/** Facts for every batchable emergency purpose (add one here when a new one appears). */
const EMERGENCY_FACTS: Partial<Record<string, RiyaFacts>> = {
    emergency_closure: { purpose: 'emergency_closure', date: '2026-10-08', reason: 'rain_landslide', busesRunning: false },
};

const emergencyPurposes = BATCH_PURPOSES.filter((p) => purposeSpec(riyaPurposeSpec(p).samparkPurpose).emergency);
const reasonFor = (purpose: string) => BATCH_REASONS.find((r) => r.purpose === purpose)!.id;
const overFor = (purpose: string) => ({ reason: reasonFor(purpose) as never, facts: EMERGENCY_FACTS[purpose]! });

describe('gate: emergency batches need a school admin', () => {
    it('covers the emergency closure at all, and every emergency purpose has facts here', () => {
        expect(emergencyPurposes).toContain('emergency_closure');
        expect(emergencyPurposes.filter((p) => !EMERGENCY_FACTS[p])).toEqual([]);
    });

    it.each(emergencyPurposes)('%s: a class teacher is refused, a school admin may start it', async (purpose) => {
        const t = await setup();
        const over = { reason: reasonFor(purpose) as never, facts: EMERGENCY_FACTS[purpose]! };
        expect(await code(createFrom(t, over, TEACHER_7A))).toBe('SCHOOL_ADMIN_REQUIRED');
        expect(await code(createFrom(t, over, ADMIN))).toBe('OK');
    });

    it('a class notice (holiday) stays with the teacher who manages the class', async () => {
        const t = await setup();
        expect(await code(createFrom(t, { facts: HOLIDAY }, TEACHER_7A))).toBe('OK');
    });

    it.each(emergencyPurposes)("%s: a class teacher cannot resume an admin's paused batch; stopping stays open to them", async (purpose) => {
        const t = await setup({ count: 3, provider: 'vobiz-roster', concurrency: 1 });
        const { campaign } = await createFrom(t, overFor(purpose), ADMIN);
        await actOnBatch(t.deps, t.org, ADMIN, campaign.id, { action: 'pause' });
        const before = t.dials.length;
        expect(await code(actOnBatch(t.deps, t.org, TEACHER_7A, campaign.id, { action: 'resume' }))).toBe('SCHOOL_ADMIN_REQUIRED');
        for (let i = 0; i < 3; i += 1) { await completeInFlight(t); await runBatchTick(t.deps); }
        expect((await t.batches.get(t.org, campaign.id))?.status).toBe('paused');
        expect(t.dials).toHaveLength(before);
        expect(await code(actOnBatch(t.deps, t.org, ADMIN, campaign.id, { action: 'resume' }))).toBe('OK');
        expect(await code(actOnBatch(t.deps, t.org, TEACHER_7A, campaign.id, { action: 'pause' }))).toBe('OK');
        expect(await code(actOnBatch(t.deps, t.org, TEACHER_7A, campaign.id, { action: 'cancel' }))).toBe('OK');
    });

    it.each(emergencyPurposes)('%s: a class teacher cannot retry the unanswered families of a finished batch', async (purpose) => {
        const t = await setup({ count: 3, provider: 'vobiz-roster', concurrency: 1 });
        const { campaign } = await createFrom(t, overFor(purpose), ADMIN);
        for (let i = 0; i < 8; i += 1) {
            for (const c of t.calls.calls.values()) {
                if (c.state !== 'initiated') continue;
                if (c.studentId === 's02') await hangup(t, c.id, 'USER_BUSY');
                else await bridgeEvent(t, c.id);
            }
            await runBatchTick(t.deps);
        }
        expect((await t.batches.get(t.org, campaign.id))?.status).toBe('completed');
        const before = t.dials.length;
        expect(await code(actOnBatch(t.deps, t.org, TEACHER_7A, campaign.id, { action: 'retry' }))).toBe('SCHOOL_ADMIN_REQUIRED');
        expect((await t.batches.get(t.org, campaign.id))?.status).toBe('completed');
        expect(t.dials).toHaveLength(before);
        expect(await code(actOnBatch(t.deps, t.org, ADMIN, campaign.id, { action: 'retry' }))).toBe('OK');
        expect(t.dials).toHaveLength(before + 1);
    });

    it.each(emergencyPurposes)('%s: the dial pass stops once the creator is no longer a school admin', async (purpose) => {
        const t = await setup({ count: 3, provider: 'vobiz-roster', concurrency: 1 });
        const { campaign } = await createFrom(t, overFor(purpose), ADMIN);
        expect(t.dials).toHaveLength(1);
        // Demoted, but still manages the class: only the admin check can stop the next dial.
        t.deps.isOrgAdmin = async () => false;
        await completeInFlight(t);
        await runBatchTick(t.deps);
        const c = await t.batches.get(t.org, campaign.id);
        expect(c?.status).toBe('paused');
        expect(c?.pauseReason).toBe('CREATOR_NOT_AUTHORISED');
        expect(t.dials).toHaveLength(1);
    });
});
