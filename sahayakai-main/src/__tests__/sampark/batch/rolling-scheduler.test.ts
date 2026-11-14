/** @jest-environment node */
/**
 * The rolling batch scheduler: at most 3 Riya calls in flight per school, at least 60 s between two
 * launches the provider ACCEPTED, and a freed line filled as soon as both rules allow.
 *
 * Deterministic: a fake clock, a mocked Vobiz REST API (scripted 429s, 5xx, lookups), and Vobiz
 * hangup callbacks + signed bridge reports delivered through the SAME public handlers production
 * uses, on the in-memory repos. No network, no real phone. Every test checks the two invariants
 * (≤ 3 lines held, ≥ 60 s between accepted launches) after every step it takes.
 *
 * Numbering follows the brief's test list (1–26).
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import crypto from 'node:crypto';

import {
    backoffMs,
    batchCapacity,
    countActiveCalls,
    holdsLine,
    isAcceptedLaunch,
    rateLimitBackoffUntil,
    retryAfterSeconds,
} from '@/lib/sampark/batch/schedule';
import { isRetryable } from '@/lib/sampark/batch/state';
import { applyRiyaEvent } from '@/lib/sampark/conversation/state';
import type { ConversationCall } from '@/lib/sampark/conversation/types';
import { RIYA_VOBIZ_HARD_END_MS, RIYA_VOBIZ_TIME_LIMIT_SECONDS, vobizRiyaRef } from '@/lib/sampark/conversation/vobiz-provider';
import { placeVobizCallDetailed } from '@/lib/vobiz/client';
import { mintVobizToken, VOBIZ_DOMAINS } from '@/lib/vobiz/tokens';
import { actOnBatch, advanceBatch, batchAttemptKey, batchLaunchGate, getBatch, runBatchTick, type BatchDeps } from '@/server/sampark/batch-calls';
import { _resetBatchWakeForTest } from '@/server/sampark/batch-wake';
import { previewRiyaCall, reconcileRiyaCall, riyaCallId, riyaLockName, settlesOn, startRiyaCall } from '@/server/sampark/conversation';
import { handleVobizRiyaStatus } from '@/server/sampark/vobiz-riya';

import { ADMIN, bridgeEvent, code, createFrom, EXAM, hangup, HOLIDAY, pad, phoneOf, rateLimited, setup, vobizScript, WED_11_IST, type Setup, type VobizScript } from './_harness';

const T0 = WED_11_IST.getTime();
const MIN = 60_000;

afterEach(() => {
    delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    _resetBatchWakeForTest();
});

// ── helpers ──────────────────────────────────────────────────────────────────

async function rolling(count: number, opts: { env?: Record<string, string>; script?: VobizScript; reject?: string[]; concurrency?: number } = {}) {
    return setup({
        count,
        provider: 'vobiz-roster',
        concurrency: opts.concurrency ?? 3,
        script: opts.script,
        reject: opts.reject,
        env: { SAMPARK_BATCH_DIAL_GAP_SECONDS: '60', ...opts.env },
    });
}

const at = (t: Setup, s: number) => t.clock.set(new Date(T0 + s * 1000));
const now = (t: Setup) => (t.clock.now().getTime() - T0) / 1000;
async function tickAt(t: Setup, s: number) {
    at(t, s);
    await runBatchTick(t.deps);
    check(t);
}
const dialSecs = (t: Setup) => t.dials.map((d) => (d.at - T0) / 1000);
const all = (t: Setup) => [...t.calls.calls.values()];
const callOf = (t: Setup, n: number) => all(t).filter((c) => c.studentId === `s${pad(n)}`).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1)!;
const live = (t: Setup) => all(t).filter((c) => holdsLine(c, t.clock.now().getTime(), RIYA_VOBIZ_HARD_END_MS));
const uuidOf = (c: ConversationCall) => c.providerConversationId!.slice('vobiz:'.length);
const campaignOf = async (t: Setup, id: string) => (await t.batches.get(t.org, id))!;

/** The two invariants, checked after every step. */
function check(t: Setup, max = 3) {
    expect(live(t).length).toBeLessThanOrEqual(max);
    const accepted = all(t).filter((c) => c.batch && isAcceptedLaunch(c)).map((c) => Date.parse(c.createdAt)).sort((a, b) => a - b);
    for (let i = 1; i < accepted.length; i += 1) expect(accepted[i] - accepted[i - 1]).toBeGreaterThanOrEqual(MIN);
}

async function complete(t: Setup, n: number) {
    await bridgeEvent(t, callOf(t, n).id);
    check(t);
}

async function ring(t: Setup, callId: string) {
    const tok = (await mintVobizToken(VOBIZ_DOMAINS.SAMPARK_RIYA_STATUS, vobizRiyaRef(t.org, callId))).token;
    return handleVobizRiyaStatus(t.deps, tok, 'ring', { CallUUID: 'x' });
}

async function answeredHangup(t: Setup, callId: string) {
    const tok = (await mintVobizToken(VOBIZ_DOMAINS.SAMPARK_RIYA_STATUS, vobizRiyaRef(t.org, callId))).token;
    return handleVobizRiyaStatus(t.deps, tok, 'hangup', { CallUUID: 'x', AnswerTime: '2026-10-07 11:00:20', BillDuration: '40', HangupCause: 'NORMAL_CLEARING' });
}

const auditsOf = (t: Setup, action: string, target?: string) => t.audits.filter((a) => a.action === action && (!target || a.target === target));

// ── 1–4: the launch cadence and the ceiling ─────────────────────────────────

describe('rolling launches', () => {
    it('1-3. the first call starts at once, the second after 60 s, the third after another 60 s', async () => {
        const t = await rolling(5);
        const { campaign } = await createFrom(t);
        expect(dialSecs(t)).toEqual([0]); // 1. immediately
        expect(t.wakes.at(-1)).toEqual({ campaignId: campaign.id, at: new Date(T0 + MIN).toISOString() }); // a wake for 00:60 was asked for
        await tickAt(t, 30);
        await tickAt(t, 59);
        expect(dialSecs(t)).toEqual([0]);
        await tickAt(t, 60);
        expect(dialSecs(t)).toEqual([0, 60]); // 2.
        await tickAt(t, 119);
        await tickAt(t, 120);
        expect(dialSecs(t)).toEqual([0, 60, 120]); // 3.
        // Every Riya Vobiz call carries the provider-enforced time limit.
        for (const d of t.dials) expect(d.timeLimit).toBe(RIYA_VOBIZ_TIME_LIMIT_SECONDS);
    });

    it('4. three active calls prevent a fourth', async () => {
        const t = await rolling(6);
        const { campaign } = await createFrom(t);
        for (const s of [60, 120, 180, 240, 300]) await tickAt(t, s);
        expect(dialSecs(t)).toEqual([0, 60, 120]);
        const c = await campaignOf(t, campaign.id);
        expect(c.waitingReason).toBe('CONCURRENCY_FULL');
        expect(c.concurrency).toBe(3);
        const view = await getBatch(t.deps, t.org, ADMIN, campaign.id);
        expect(view.campaign.progress).toMatchObject({ total: 6, inProgress: 3, pending: 3, completed: 0 });
    });
});

// ── 5–8: filling freed lines ────────────────────────────────────────────────

describe('filling a freed line', () => {
    it('5. a line frees BEFORE the interval is due: the next call waits for the interval (02:50 → 03:00)', async () => {
        const t = await rolling(6);
        const { campaign } = await createFrom(t);
        await tickAt(t, 60);
        await tickAt(t, 120);
        // All three running at 03:00 is the other case; here call 1 ends at 02:50 …
        at(t, 170);
        await complete(t, 1);
        expect(dialSecs(t)).toEqual([0, 60, 120]); // not at 02:50
        const c = await campaignOf(t, campaign.id);
        expect(c.nextLaunchAt).toBe(new Date(T0 + 180_000).toISOString());
        expect(t.wakes.at(-1)?.at).toBe(new Date(T0 + 180_000).toISOString()); // woken exactly at 03:00
        await tickAt(t, 180);
        expect(dialSecs(t)).toEqual([0, 60, 120, 180]);
    });

    it('5b. a line frees at 02:20 → the next call goes at 03:00', async () => {
        const t = await rolling(6);
        await createFrom(t);
        await tickAt(t, 60);
        await tickAt(t, 120);
        at(t, 140);
        await complete(t, 1);
        await tickAt(t, 150);
        expect(dialSecs(t)).toEqual([0, 60, 120]);
        await tickAt(t, 180);
        expect(dialSecs(t)).toEqual([0, 60, 120, 180]);
    });

    it('6. a line frees AFTER the interval is due: the next call starts at that moment (no extra wait)', async () => {
        const t = await rolling(6);
        const { campaign } = await createFrom(t);
        await tickAt(t, 60);
        await tickAt(t, 120);
        await tickAt(t, 180); // all three still running at 03:00
        expect(dialSecs(t)).toEqual([0, 60, 120]);
        at(t, 210);
        await complete(t, 2); // 03:30: call 2 ends → the webhook itself launches call 4
        expect(dialSecs(t)).toEqual([0, 60, 120, 210]);
        // The brief's timeline continues: 04:30 call 3 ends → call 5 goes when 60 s after 03:30 has passed.
        at(t, 270);
        await complete(t, 3);
        expect(dialSecs(t)).toEqual([0, 60, 120, 210, 270]);
        expect((await campaignOf(t, campaign.id)).recipients.filter((r) => r.status === 'in_progress')).toHaveLength(3);
    });

    it('7. several calls ending at almost the same moment fill lines one interval apart', async () => {
        const t = await rolling(6);
        await createFrom(t);
        await tickAt(t, 60);
        await tickAt(t, 120);
        await tickAt(t, 180);
        at(t, 300);
        await complete(t, 1);
        at(t, 300.5);
        await complete(t, 2);
        at(t, 301);
        await complete(t, 3);
        expect(dialSecs(t)).toEqual([0, 60, 120, 300]);
        await tickAt(t, 330);
        await tickAt(t, 360);
        expect(dialSecs(t)).toEqual([0, 60, 120, 300, 360]);
        await tickAt(t, 420);
        expect(dialSecs(t)).toEqual([0, 60, 120, 300, 360, 420]);
    });

    it('8. one very long call keeps its line; the other two lines keep rolling', async () => {
        const t = await rolling(12);
        const { campaign } = await createFrom(t);
        for (let s = 10; s <= 13 * 60; s += 10) {
            at(t, s);
            // Every call except family 1's ends 90 s after it started.
            for (const c of all(t)) {
                if (c.state === 'initiated' && c.studentId !== 's01' && t.clock.now().getTime() - Date.parse(c.createdAt) >= 90_000) await bridgeEvent(t, c.id);
            }
            await runBatchTick(t.deps);
            check(t);
            // Family 1 is never released while Vobiz says it is still connected.
            expect(live(t).some((c) => c.studentId === 's01')).toBe(true);
        }
        const c = await campaignOf(t, campaign.id);
        expect(c.recipients[0].status).toBe('in_progress');
        expect(c.recipients.filter((r) => r.status === 'completed').length).toBeGreaterThanOrEqual(10);
    });
});

// ── 9–12: outcomes that release a line, and refusals that never took one ────

describe('outcomes and refusals', () => {
    it('9. an unanswered call releases its line on the provider’s word, and is never redialled automatically', async () => {
        const t = await rolling(4);
        const { campaign } = await createFrom(t);
        const first = callOf(t, 1);
        at(t, 40);
        await hangup(t, first.id, 'NO_ANSWER');
        expect((await t.calls.getCall(t.org, first.id))?.state).toBe('no_answer');
        expect(live(t)).toHaveLength(0);
        // The school slot it held is free again.
        expect(await t.repo.acquireLock(riyaLockName(t.org, first.lockSlot ?? 0), 'probe', t.clock.now(), 1000)).toBe(true);
        await t.repo.releaseLock(riyaLockName(t.org, first.lockSlot ?? 0), 'probe');
        for (let s = 60; s <= 600; s += 60) {
            await tickAt(t, s);
            for (const c of all(t)) if (c.state === 'initiated') await bridgeEvent(t, c.id);
        }
        expect(t.dials.filter((d) => d.to === phoneOf(1))).toHaveLength(1);
        const r = (await campaignOf(t, campaign.id)).recipients[0];
        expect(r.status).toBe('no_answer');
        expect(isRetryable(r)).toBe(true); // a person may retry it
    });

    it('10. a busy line releases its line and follows the retry policy', async () => {
        const t = await rolling(2);
        const { campaign } = await createFrom(t);
        at(t, 20);
        await hangup(t, callOf(t, 1).id, 'USER_BUSY');
        expect(live(t)).toHaveLength(0);
        await tickAt(t, 60);
        expect(dialSecs(t)).toEqual([0, 60]);
        const r = (await campaignOf(t, campaign.id)).recipients[0];
        expect(r.status).toBe('busy');
        expect(isRetryable(r)).toBe(true);
    });

    it('11. a refused initiation uses no line and starts no interval: the next family goes at once', async () => {
        const t = await rolling(4, { reject: [phoneOf(2)] });
        const { campaign } = await createFrom(t);
        await tickAt(t, 60);
        // Family 2 refused (invalid number) and family 3 accepted in the same pass, both at 01:00.
        expect(dialSecs(t)).toEqual([0, 60, 60]);
        expect(live(t).map((c) => c.studentId).sort()).toEqual(['s01', 's03']);
        const c = await campaignOf(t, campaign.id);
        expect(c.recipients[1]).toMatchObject({ status: 'failed', attempts: 1 });
        expect(c.recipients[1].lastError?.message).toContain('rejected:provider_rejected:400');
        await tickAt(t, 120);
        expect(dialSecs(t)).toEqual([0, 60, 60, 120]);
    });

    it('12. a provider rate limit (429) backs off school-wide, honours Retry-After, and keeps the family queued', async () => {
        const script = vobizScript();
        const t = await rolling(5, { script });
        const { campaign } = await createFrom(t);
        script.next.push({ status: 429, retryAfter: 90 });
        await tickAt(t, 60);
        expect(dialSecs(t)).toEqual([0, 60]); // the refused request
        let c = await campaignOf(t, campaign.id);
        expect(c.recipients[1]).toMatchObject({ status: 'pending', attempts: 0, launchFailures: 1, currentCallId: null });
        expect(c.waitingReason).toBe('PROVIDER_RATE_LIMITED');
        expect(c.backoffUntil).toBe(new Date(T0 + 150_000).toISOString()); // 01:00 + max(60 s, Retry-After 90 s)
        expect(live(t)).toHaveLength(1); // a refusal never takes a line
        // Nothing is re-submitted during the backoff, by any tick.
        await tickAt(t, 90);
        await tickAt(t, 120);
        await tickAt(t, 149);
        expect(dialSecs(t)).toEqual([0, 60]);
        // A second refusal doubles the wait (2 refusals → 120 s).
        script.next.push({ status: 429 });
        await tickAt(t, 150);
        expect(dialSecs(t)).toEqual([0, 60, 150]);
        c = await campaignOf(t, campaign.id);
        expect(c.backoffUntil).toBe(new Date(T0 + 270_000).toISOString());
        await tickAt(t, 210);
        await tickAt(t, 269);
        expect(dialSecs(t)).toEqual([0, 60, 150]);
        await tickAt(t, 270);
        expect(dialSecs(t)).toEqual([0, 60, 150, 270]); // accepted this time
        c = await campaignOf(t, campaign.id);
        // The family still has its retry allowance: two refusals were not attempts.
        expect(c.recipients[1]).toMatchObject({ status: 'in_progress', attempts: 1, launchFailures: 2 });
        expect(c.backoffUntil).toBeNull();
        expect(new Set(all(t).filter((x) => x.studentId === 's02').map((x) => x.id)).size).toBe(3); // 2 refused + 1 placed, distinct keys
        expect(auditsOf(t, 'batch_campaign.rate_limited')).toHaveLength(2);
    });
});

// ── 13–15: webhook races and stuck calls ────────────────────────────────────

describe('webhooks: duplicates, order, stuck calls', () => {
    it('13. duplicate webhooks never release a line twice, never settle twice, never launch extra calls', async () => {
        const script = vobizScript();
        const t = await rolling(5, { script });
        await createFrom(t);
        await tickAt(t, 60);
        await tickAt(t, 120);
        const a = callOf(t, 1);
        const b = callOf(t, 2);
        at(t, 150);
        await hangup(t, a.id, 'NO_ANSWER');
        await hangup(t, a.id, 'NO_ANSWER'); // same delivery again
        // The same end seen again by a status lookup (a different event source, a different cause).
        script.lookup.set(uuidOf(a), { end_time: '2026-10-07 11:02:30', bill_duration: 0, hangup_cause_name: 'USER_BUSY' });
        await reconcileRiyaCall(t.deps, t.org, a.id);
        await bridgeEvent(t, b.id);
        await bridgeEvent(t, b.id);
        await answeredHangup(t, b.id);
        check(t);
        expect((await t.calls.getCall(t.org, a.id))?.state).toBe('no_answer'); // not rewritten to busy
        expect(auditsOf(t, 'riya_call.no_answer', `riya_call/${a.id}`)).toHaveLength(1);
        expect(auditsOf(t, 'riya_call.completed', `riya_call/${b.id}`)).toHaveLength(1);
        await tickAt(t, 180);
        await tickAt(t, 200);
        // Exactly one launch for the two freed lines at 03:00 (interval), none from the duplicates.
        expect(dialSecs(t)).toEqual([0, 60, 120, 180]);
    });

    it('14. out-of-order webhooks cannot revive or rewrite a finished call', async () => {
        const t = await rolling(3);
        await createFrom(t);
        await tickAt(t, 60);
        const a = callOf(t, 1);
        const b = callOf(t, 2);
        at(t, 90);
        await bridgeEvent(t, a.id); // completed …
        await ring(t, a.id); // … then an older "ringing" arrives
        await hangup(t, a.id, 'NO_ANSWER'); // … and a stale ring failure
        await answeredHangup(t, a.id);
        const after = await t.calls.getCall(t.org, a.id);
        expect(after).toMatchObject({ state: 'completed', providerStatus: 'done' });
        await hangup(t, b.id, 'USER_BUSY'); // busy …
        await hangup(t, b.id, 'NO_ANSWER'); // … then a different, late cause (same delivery id)
        expect((await t.calls.getCall(t.org, b.id))?.state).toBe('busy');
        check(t);
    });

    it('15a. a call still connected past its time limit (provider says so) KEEPS its line; the overrun is audited once', async () => {
        const t = await rolling(6);
        const { campaign } = await createFrom(t);
        const a = callOf(t, 1);
        for (let s = 60; s <= 20 * 60; s += 60) {
            await tickAt(t, s);
            for (const c of all(t)) if (c.state === 'initiated' && c.id !== a.id && t.clock.now().getTime() - Date.parse(c.createdAt) >= 90_000) await bridgeEvent(t, c.id);
        }
        expect(now(t)).toBeGreaterThan(RIYA_VOBIZ_HARD_END_MS / 1000);
        expect((await t.calls.getCall(t.org, a.id))?.state).toBe('initiated');
        expect(live(t).some((c) => c.id === a.id)).toBe(true);
        expect(auditsOf(t, 'batch_campaign.call_overrun')).toHaveLength(1);
        expect((await campaignOf(t, campaign.id)).recipients[0].lastError?.code).toBe('CALL_OVERRUN');
    });

    it('15b. the provider then reports the line ended with no bridge result → released, shown unknown, never redialled', async () => {
        const script = vobizScript();
        const t = await rolling(2, { script });
        const { campaign } = await createFrom(t);
        const a = callOf(t, 1);
        script.lookup.set(uuidOf(a), { end_time: '2026-10-07 11:10:00', answer_time: '2026-10-07 11:00:20', bill_duration: 580 });
        await tickAt(t, 15 * 60);
        expect((await t.calls.getCall(t.org, a.id))).toMatchObject({ state: 'unknown', failureReason: 'no_result:carrier_ended_no_report' });
        const r = (await campaignOf(t, campaign.id)).recipients[0];
        expect(r).toMatchObject({ status: 'unknown', lastError: { code: 'NO_RESULT' } });
        expect(isRetryable(r)).toBe(false);
        expect(auditsOf(t, 'batch_campaign.call_stale')[0].detail).toMatchObject({ recovery: 'carrier_ended_no_report' });
        // A late authentic result still lands.
        await bridgeEvent(t, a.id);
        expect((await getBatch(t.deps, t.org, ADMIN, campaign.id)).campaign.recipients[0].status).toBe('completed');
    });

    it('15c. provider has no record / cannot be reached past the provider-enforced limit → unknown (audited); before the limit → held', async () => {
        const script = vobizScript();
        const t = await rolling(3, { script });
        await createFrom(t);
        await tickAt(t, 60);
        const a = callOf(t, 1);
        const b = callOf(t, 2);
        script.lookup.set(uuidOf(a), 404);
        script.lookup.set(uuidOf(b), 'down');
        await tickAt(t, 13 * 60); // before the hard end: both still held
        expect(live(t).map((c) => c.id).sort()).toEqual([a.id, b.id, callOf(t, 3).id].sort());
        await tickAt(t, 16 * 60);
        expect((await t.calls.getCall(t.org, a.id))?.failureReason).toBe('no_result:provider_has_no_record');
        await tickAt(t, 17 * 60);
        expect((await t.calls.getCall(t.org, b.id))?.failureReason).toBe('no_result:provider_unreachable_past_time_limit');
    });
});

// ── 16–17: restarts and several workers ─────────────────────────────────────

describe('restarts and concurrency control', () => {
    it('16. after a crash/restart: interval restored from records, dead lease waited out, a half-claimed family dialled exactly once', async () => {
        const t = await rolling(4);
        const { campaign } = await createFrom(t);
        // The worker dies mid-pass at 00:20: it holds the lease, and had claimed family 2 without dialling.
        at(t, 20);
        const c0 = await campaignOf(t, campaign.id);
        const r2 = c0.recipients[1];
        const key = batchAttemptKey(campaign.id, r2.id, 1);
        await t.batches.mutate(t.org, campaign.id, (c) => ({
            ...c,
            leaseHolder: 'dead-worker', leaseUntil: new Date(T0 + 65_000).toISOString(),
            recipients: c.recipients.map((r) => (r.id === r2.id ? { ...r, status: 'dialing', attempts: 1, currentCallId: riyaCallId(t.org, key), callIds: [riyaCallId(t.org, key)], claimUntil: new Date(T0 + 140_000).toISOString() } : r)),
        }));
        // Restart: no in-memory state survives; a fresh worker with fresh deps.
        _resetBatchWakeForTest();
        const fresh: BatchDeps = { ...t.deps };
        at(t, 60);
        expect(await advanceBatch(fresh, t.org, campaign.id, 'new-worker')).toBeNull(); // dead lease still live
        at(t, 66);
        await runBatchTick(fresh);
        check(t);
        // Family 2 is mid-claim (not yet expired): family 3 goes first; the interval came from the records.
        expect(dialSecs(t)).toEqual([0, 66]);
        expect(callOf(t, 3)).toBeDefined();
        for (const s of [120, 126, 141, 186, 200, 260]) {
            await tickAt(t, s);
            for (const c of all(t)) if (c.state === 'initiated') await bridgeEvent(t, c.id);
        }
        // The half-claimed family went back to the queue with the SAME key and was dialled once.
        expect(all(t).filter((c) => c.studentId === 's02').map((c) => c.id)).toEqual([riyaCallId(t.org, key)]);
        expect(t.dials.filter((d) => d.to === phoneOf(2))).toHaveLength(1);
        expect(new Set(t.dials.map((d) => d.to)).size).toBe(t.dials.length);
    });

    it('16b. a restart while waiting for the interval does not launch early', async () => {
        const t = await rolling(3);
        const { campaign } = await createFrom(t);
        _resetBatchWakeForTest();
        at(t, 30);
        await advanceBatch({ ...t.deps }, t.org, campaign.id, 'restarted');
        expect(dialSecs(t)).toEqual([0]);
        expect((await campaignOf(t, campaign.id)).nextLaunchAt).toBe(new Date(T0 + MIN).toISOString());
    });

    it('17. two workers (two campaigns, same school) racing every step never exceed 3 lines or one launch per 60 s', async () => {
        const t = await rolling(6);
        const a = await createFrom(t);
        const b = await createFrom(t, { reason: 'exam_reminder', facts: EXAM });
        for (let s = 5; s <= 20 * 60; s += 5) {
            at(t, s);
            await Promise.all([
                advanceBatch(t.deps, t.org, a.campaign.id, 'worker-1'),
                advanceBatch(t.deps, t.org, b.campaign.id, 'worker-2'),
                advanceBatch(t.deps, t.org, a.campaign.id, 'worker-3'), // a second worker on the same campaign
                runBatchTick(t.deps),
            ]);
            check(t);
            // Never two calls to one family at once.
            const inFlight = live(t);
            expect(new Set(inFlight.map((c) => c.guardianId)).size).toBe(inFlight.length);
            for (const c of all(t)) if (c.state === 'initiated' && t.clock.now().getTime() - Date.parse(c.createdAt) >= 150_000) await bridgeEvent(t, c.id);
        }
        expect((await campaignOf(t, a.campaign.id)).status).toBe('completed');
        expect((await campaignOf(t, b.campaign.id)).status).toBe('completed');
        expect(t.dials).toHaveLength(12);
    });

    it('17b. the launch gate is atomic: a second worker that read "due" at the same instant does not launch', async () => {
        const t = await rolling(4);
        await createFrom(t);
        at(t, 60);
        // Another worker already took the gate for this minute (its call record is not written yet).
        expect(await t.repo.acquireLock(batchLaunchGate(t.org), 'other-worker-call', t.clock.now(), MIN)).toBe(true);
        await runBatchTick(t.deps);
        expect(dialSecs(t)).toEqual([0]);
        at(t, 120);
        await runBatchTick(t.deps);
        expect(dialSecs(t)).toEqual([0, 120]);
    });
});

// ── 18–22: controls, retries, completion ────────────────────────────────────

describe('pause, resume, cancel, retry, completion', () => {
    it('18-19. pause starts nothing new (calls in flight finish); resume fills lines without re-dialling anyone', async () => {
        const t = await rolling(5);
        const { campaign } = await createFrom(t);
        at(t, 10);
        await actOnBatch(t.deps, t.org, ADMIN, campaign.id, { action: 'pause' });
        for (const s of [60, 120, 180, 240]) await tickAt(t, s);
        expect(dialSecs(t)).toEqual([0]);
        at(t, 250);
        await complete(t, 1); // the call in flight still lands
        expect((await campaignOf(t, campaign.id)).recipients[0].status).toBe('completed');
        expect(dialSecs(t)).toEqual([0]);
        at(t, 300);
        await actOnBatch(t.deps, t.org, ADMIN, campaign.id, { action: 'resume' });
        expect(dialSecs(t)).toEqual([0, 300]); // resumed at once: the interval had long passed
        for (const s of [330, 360, 420, 480]) await tickAt(t, s);
        expect(dialSecs(t)).toEqual([0, 300, 360, 420]);
        expect(new Set(t.dials.map((d) => d.to)).size).toBe(t.dials.length);
    });

    it('20. cancel stops every further launch; calls in flight finish and are recorded', async () => {
        const t = await rolling(5);
        const { campaign } = await createFrom(t);
        await tickAt(t, 60);
        at(t, 70);
        await actOnBatch(t.deps, t.org, ADMIN, campaign.id, { action: 'cancel' });
        for (let s = 120; s <= 600; s += 60) await tickAt(t, s);
        expect(dialSecs(t)).toEqual([0, 60]);
        let c = await campaignOf(t, campaign.id);
        expect(c.status).toBe('cancelled');
        expect(c.open).toBe(true); // two calls still in flight
        expect(c.recipients.slice(2).every((r) => r.status === 'cancelled')).toBe(true);
        at(t, 610);
        await complete(t, 1);
        await hangup(t, callOf(t, 2).id, 'NO_ANSWER');
        await tickAt(t, 620);
        c = await campaignOf(t, campaign.id);
        expect(c.recipients.slice(0, 2).map((r) => r.status)).toEqual(['completed', 'no_answer']);
        expect(c.open).toBe(false);
    });

    it('21. retry (even requested twice at once) places exactly one new call; the old attempt’s late event cannot overwrite it', async () => {
        const t = await rolling(2);
        const { campaign } = await createFrom(t);
        const first = callOf(t, 1);
        at(t, 30);
        await hangup(t, first.id, 'NO_ANSWER');
        await tickAt(t, 60);
        at(t, 90);
        await complete(t, 2);
        at(t, 200);
        const results = await Promise.all([
            code(actOnBatch(t.deps, t.org, ADMIN, campaign.id, { action: 'retry' })),
            code(actOnBatch(t.deps, t.org, ADMIN, campaign.id, { action: 'retry' })),
        ]);
        expect(results).toContain('OK');
        await tickAt(t, 260);
        await tickAt(t, 320);
        const family1 = all(t).filter((c) => c.studentId === 's01');
        expect(family1).toHaveLength(2);
        const second = family1.find((c) => c.id !== first.id)!;
        expect(second.state).toBe('initiated');
        // The first attempt's late, different delivery changes nothing on the new attempt.
        await hangup(t, first.id, 'USER_BUSY');
        const r = (await campaignOf(t, campaign.id)).recipients[0];
        expect(r).toMatchObject({ status: 'in_progress', attempts: 2, currentCallId: second.id });
        check(t);
    });

    it('22. the batch completes only when no family is pending, retrying or in flight', async () => {
        const script = vobizScript();
        const t = await rolling(3, { script });
        const { campaign } = await createFrom(t);
        await tickAt(t, 60);
        script.next.push({ status: 429 });
        await tickAt(t, 120); // family 3 refused → still queued, backing off
        at(t, 130);
        await complete(t, 1);
        await complete(t, 2);
        let c = await campaignOf(t, campaign.id);
        expect(c.status).toBe('running'); // a rate-limited family is still queued
        await tickAt(t, 180);
        c = await campaignOf(t, campaign.id);
        expect(c.recipients[2].status).toBe('in_progress');
        expect(c.status).toBe('running'); // nothing pending, but one call still in flight
        at(t, 200);
        await complete(t, 3);
        c = await campaignOf(t, campaign.id);
        expect(c).toMatchObject({ status: 'completed', open: false });
    });
});

// ── 23–26: effective capacity, and the paths that must not change ──────────

describe('effective concurrency and unchanged paths', () => {
    it('23. a verified provider account limit below 3 lowers the ceiling (and says why)', async () => {
        const t = await rolling(5, { env: { SAMPARK_VOBIZ_MAX_CONCURRENT_CALLS: '2' } });
        const { campaign } = await createFrom(t);
        for (const s of [60, 120, 180, 240]) {
            await tickAt(t, s);
            check(t, 2);
        }
        expect(dialSecs(t)).toEqual([0, 60]);
        const c = await campaignOf(t, campaign.id);
        expect(c).toMatchObject({ concurrency: 2, concurrencySource: 'provider', waitingReason: 'CONCURRENCY_FULL' });
    });

    it('24. AI backend session capacity below 3 lowers the ceiling', async () => {
        const t = await rolling(4, { env: { SAMPARK_RIYA_MAX_CONCURRENT_SESSIONS: '1' } });
        const { campaign } = await createFrom(t);
        for (const s of [60, 120]) await tickAt(t, s);
        expect(dialSecs(t)).toEqual([0]);
        expect(await campaignOf(t, campaign.id)).toMatchObject({ concurrency: 1, concurrencySource: 'ai' });
        at(t, 130);
        await complete(t, 1);
        expect(dialSecs(t)).toEqual([0, 130]);
        // Nothing a browser can send raises it: the app ceiling is 3 whatever is configured.
        expect(batchCapacity({ SAMPARK_BATCH_MAX_CONCURRENCY: '50' }, 'vobiz').effective).toBe(3);
    });

    it('25. individual calls keep working and share the same three lines', async () => {
        const t = await rolling(5);
        const pre = await previewRiyaCall(t.deps, t.org, { purpose: 'holiday_notice', guardianId: 'g05', studentId: 's05', facts: HOLIDAY });
        const single = await startRiyaCall(t.deps, t.org, ADMIN, { purpose: 'holiday_notice', guardianId: 'g05', studentId: 's05', facts: HOLIDAY, idempotencyKey: crypto.randomUUID(), confirmedAnnouncement: pre.announcement! });
        expect(single.call.state).toBe('initiated');
        expect((await t.calls.getCall(t.org, single.call.id))?.batch).toBeUndefined();
        const { campaign } = await createFrom(t, { reason: 'exam_reminder', facts: EXAM });
        await tickAt(t, 60);
        await tickAt(t, 120);
        expect(live(t)).toHaveLength(3); // 1 individual + 2 batch
        expect((await campaignOf(t, campaign.id)).recipients.filter((r) => r.status === 'in_progress')).toHaveLength(2);
        at(t, 150);
        await bridgeEvent(t, single.call.id); // the individual call ends normally …
        expect((await t.calls.getCall(t.org, single.call.id))?.state).toBe('completed');
        await tickAt(t, 180); // … and its line goes to the batch
        expect((await campaignOf(t, campaign.id)).recipients.filter((r) => r.status === 'in_progress')).toHaveLength(3);
    });

    it('26. ElevenLabs is unaffected: no batch over it, and its individual call never touches Vobiz or gets a Vobiz time limit', async () => {
        const t = await setup({ count: 2, provider: 'elevenlabs-roster' });
        const pre = await previewRiyaCall(t.deps, t.org, { purpose: 'holiday_notice', guardianId: 'g01', studentId: 's01', facts: HOLIDAY });
        expect(pre.provider).toBe('elevenlabs');
        await code(startRiyaCall(t.deps, t.org, ADMIN, { purpose: 'holiday_notice', guardianId: 'g01', studentId: 's01', facts: HOLIDAY, idempotencyKey: crypto.randomUUID(), confirmedAnnouncement: pre.announcement! }));
        const urls = t.fetchImpl.mock.calls.map((c) => String(c[0]));
        expect(urls.length).toBeGreaterThan(0);
        expect(urls.every((u) => u.includes('elevenlabs'))).toBe(true);
        for (const c of t.fetchImpl.mock.calls) expect(String((c[1] as RequestInit | undefined)?.body ?? '')).not.toContain('time_limit');
        expect(await code(createFrom(t))).toBe('BATCH_PROVIDER_NOT_SUPPORTED');
    });
});

// ── pure rules ──────────────────────────────────────────────────────────────

describe('pure scheduler rules', () => {
    const base = (over: Partial<ConversationCall>): ConversationCall => ({
        provider: 'vobiz', state: 'initiated', createdAt: new Date(T0).toISOString(), providerConversationId: 'vobiz:u', failureReason: null,
        providerStatus: 'initiated', batch: { campaignId: 'c', recipientId: 'r' }, ...over,
    } as ConversationCall);

    it('a line is held until the provider says the call ended — never by a local timer', () => {
        const nowMs = T0 + 3 * 3_600_000; // three hours later
        expect(holdsLine(base({}), nowMs, RIYA_VOBIZ_HARD_END_MS)).toBe(true);
        expect(holdsLine(base({ providerStatus: 'carrier_ended' }), nowMs, RIYA_VOBIZ_HARD_END_MS)).toBe(false);
        expect(holdsLine(base({ state: 'completed' }), nowMs, RIYA_VOBIZ_HARD_END_MS)).toBe(false);
        // A dial whose acceptance we never read holds a line until the provider must have ended it.
        const unread = base({ state: 'unknown', failureReason: 'unknown:network', providerConversationId: null });
        expect(holdsLine(unread, T0 + 60_000, RIYA_VOBIZ_HARD_END_MS)).toBe(true);
        expect(holdsLine(unread, T0 + RIYA_VOBIZ_HARD_END_MS + 1, RIYA_VOBIZ_HARD_END_MS)).toBe(false);
        expect(countActiveCalls([base({}), base({ provider: 'simulated' }), unread], new Date(T0 + 1000), RIYA_VOBIZ_HARD_END_MS)).toBe(2);
        // The hard end is below the per-school lock lifetime, so a lock never lapses on a live call.
        expect(RIYA_VOBIZ_HARD_END_MS).toBeLessThan(15 * 60_000);
    });

    it('rate-limit backoff: from the records, school-wide, doubling, Retry-After honoured, reset by an accepted launch', () => {
        const refused = (s: number, reason = 'rejected:rate_limited:429') => base({ state: 'failed', providerConversationId: null, failureReason: reason, createdAt: new Date(T0 + s * 1000).toISOString() });
        expect(rateLimitBackoffUntil([refused(0)])).toEqual({ until: new Date(T0 + 60_000).toISOString(), refusals: 1 });
        expect(rateLimitBackoffUntil([refused(0), refused(60)])?.until).toBe(new Date(T0 + 180_000).toISOString());
        expect(rateLimitBackoffUntil([refused(0, 'rejected:rate_limited:429 — retry_after=300')])?.until).toBe(new Date(T0 + 300_000).toISOString());
        expect(rateLimitBackoffUntil([refused(0), base({ createdAt: new Date(T0 + 100_000).toISOString() })])).toBeNull();
        expect(retryAfterSeconds('rejected:rate_limited:429 — retry_after=42')).toBe(42);
        expect(backoffMs(10)).toBe(15 * 60_000);
    });

    it('terminal-state protection: a late ring failure never rewrites a final outcome; settle runs only on entering one', () => {
        const busy = { ...base({ state: 'busy' }), appliedEvents: ['vobiz-hangup:a'] } as ConversationCall;
        const late = applyRiyaEvent(busy, { kind: 'initiation_failure', eventId: 'vobiz-hangup:b', eventTimestamp: 1, agentId: 'x', conversationId: 'vobiz:u', failureReason: 'no-answer' }, { now: new Date(T0), storeTranscript: false, transcriptDays: 7 });
        expect(late?.state).toBe('busy');
        expect(settlesOn('initiated', 'busy')).toBe(true);
        expect(settlesOn('busy', 'busy')).toBe(false);
        expect(settlesOn('completed', 'completed')).toBe(false);
        expect(settlesOn('unknown', 'completed')).toBe(true);
    });

    it('the Vobiz client sends time_limit only when asked, and reads Retry-After on a 429', async () => {
        const bodies: string[] = [];
        const fetchImpl = jest.fn(async (_u: string, init?: RequestInit) => {
            bodies.push(String(init?.body));
            return rateLimited(17);
        });
        const cfg = { authId: 'MA_TEST', authToken: 'tok', baseUrl: 'https://api.example.test', fromNumber: '+918000000000' };
        const r = await placeVobizCallDetailed(cfg, { to: '+919800010001', answerUrl: 'https://a', hangupUrl: 'https://h' }, fetchImpl as unknown as typeof fetch);
        expect(r).toEqual({ ok: false, failure: { category: 'rate_limited', status: 429, retryAfterSeconds: 17 } });
        expect(bodies[0]).not.toContain('time_limit');
        await placeVobizCallDetailed(cfg, { to: '+919800010001', answerUrl: 'https://a', hangupUrl: 'https://h', timeLimit: 660 }, fetchImpl as unknown as typeof fetch);
        expect(JSON.parse(bodies[1]).time_limit).toBe(660);
    });
});
