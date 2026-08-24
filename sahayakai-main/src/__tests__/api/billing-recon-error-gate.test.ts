/**
 * Class gate for the 2026-08-24 silent billing-reconciliation outage.
 *
 * WHAT HAPPENED
 * `runReconciliation()` collects per-item failures into `result.errors` rather
 * than throwing, so one bad subscription cannot abort the sweep. The route then
 * returned `{ ok: true, errors: N }` with HTTP 200 regardless of N. A missing
 * Razorpay secret made every run fail at the credential step, and for 30+ days
 * the job reported `complete: 0 subs, 0 users, 0 auto-fixed, 0 flagged,
 * 1 errors` at INFO with a 200. Cloud Scheduler saw an unbroken success streak,
 * so nothing alerted and the money path was dead in silence.
 *
 * WHAT THIS GATE CATCHES
 * Not "the Razorpay secret resolves" — that is the instance. The class is: a
 * reconciliation run that recorded ANY error must reach the operator. A 2xx on
 * a non-empty `errors` array is the bug, whatever produced the error. Any
 * future failure mode inside this job is covered without touching this file.
 */

const runReconciliationMock = jest.fn();
const loggerErrorMock = jest.fn();

jest.mock('@/lib/billing-reconciliation', () => ({
    runReconciliation: runReconciliationMock,
    runMonthlyReconciliation: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: loggerErrorMock, info: jest.fn(), warn: jest.fn() },
}));

import { NextResponse } from 'next/server';

const CRON_SECRET = 'test-cron-secret';

// NextResponse.json() does not yield a readable body under jsdom, so assert on
// what the route handed it — the repo convention (see feedback-app-route.test).
const jsonSpy = jest.spyOn(NextResponse, 'json');

function lastCall(): { body: any; status: number } {
    const call = jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1];
    return { body: call[0] as any, status: (call[1] as any)?.status ?? 200 };
}

function makeRequest(search = '') {
    return {
        headers: { get: (h: string) => (h === 'authorization' ? `Bearer ${CRON_SECRET}` : null) },
        nextUrl: { searchParams: new URLSearchParams(search) },
    } as any;
}

function makeResult(errors: string[]) {
    const now = new Date();
    return {
        runId: 'recon_test_1',
        startedAt: now,
        completedAt: now,
        rzpSubscriptionsFetched: 0,
        fsRecordsFetched: 0,
        autoFixCount: 0,
        flaggedCount: 0,
        mismatches: [],
        errors,
    };
}

describe('POST /api/jobs/billing-reconciliation — error gate', () => {
    let POST: any;

    beforeAll(async () => {
        process.env.CRON_SECRET = CRON_SECRET;
        ({ POST } = await import('@/app/api/jobs/billing-reconciliation/route'));
    });

    beforeEach(() => jest.clearAllMocks());

    it('returns 200 and ok:true when the run recorded no errors', async () => {
        runReconciliationMock.mockResolvedValueOnce(makeResult([]));

        await POST(makeRequest());
        const { body, status } = lastCall();

        expect(status).toBe(200);
        expect(body.ok).toBe(true);
    });

    // The exact shape of the 30-day outage: one collected error, everything
    // else zero. This is what used to return 200.
    it('fails with a non-2xx when the run recorded a single error', async () => {
        runReconciliationMock.mockResolvedValueOnce(
            makeResult(['Fatal reconciliation error: Secret RAZORPAY_KEY_ID not found'])
        );

        await POST(makeRequest());
        const { body, status } = lastCall();

        expect(status).toBeGreaterThanOrEqual(500);
        expect(body.ok).toBe(false);
        expect(body.errors).toBe(1);
    });

    it('fails on any error, regardless of what produced it', async () => {
        // The gate must not be keyed to the secret that exposed it.
        const unrelated = [
            'Failed to auto-fix D1 for user_9: permission denied',
            'Failed to check payments for sub_x: rate limited',
        ];
        runReconciliationMock.mockResolvedValueOnce(makeResult(unrelated));

        await POST(makeRequest());
        const { body, status } = lastCall();

        expect(status).toBeGreaterThanOrEqual(500);
        expect(body.errors).toBe(2);
    });

    it('surfaces the error text so the operator can act without log archaeology', async () => {
        const msg = 'Fatal reconciliation error: Secret RAZORPAY_KEY_ID not found';
        runReconciliationMock.mockResolvedValueOnce(makeResult([msg]));

        await POST(makeRequest());

        expect(lastCall().body.errorMessages).toEqual([msg]);
        expect(loggerErrorMock).toHaveBeenCalled();
    });

    it('still reports a partially successful run as failed', async () => {
        // Work getting done does not redeem a run that also errored — the
        // outage looked "productive" precisely because counts were reported.
        const partial = { ...makeResult(['one subscription failed']), autoFixCount: 12, flaggedCount: 3 };
        runReconciliationMock.mockResolvedValueOnce(partial);

        await POST(makeRequest());
        const { body, status } = lastCall();

        expect(status).toBeGreaterThanOrEqual(500);
        expect(body.autoFixed).toBe(12);
        expect(body.ok).toBe(false);
    });
});
