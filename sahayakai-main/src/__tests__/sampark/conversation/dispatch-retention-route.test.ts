/** @jest-environment node */
/**
 * The scheduled transcript retention sweep runs inside POST /api/jobs/sampark-dispatch (Cloud
 * Scheduler in a deployment, scripts/sampark/ticker.ts locally), behind CRON_SECRET; the hourly
 * single-flight lease lives in runScheduledTranscriptPurge (riya-service.test.ts). A failing
 * sweep never fails the dispatch tick.
 */

const purge = jest.fn(async (): Promise<number | null> => 3);
// jest.setup.ts polyfills Response without a body NextResponse.json can read back; keep the payload.
jest.mock('next/server', () => ({ NextResponse: { json: (data: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, json: async () => data }) } }));
jest.mock('@/server/sampark/http', () => ({
    samparkDisabledResponse: () => null,
    samparkContext: jest.fn(async () => ({ repo: {}, clock: { now: () => new Date() } })),
    errorResponse: jest.fn(() => ({ status: 500, json: async () => ({}) })),
}));
jest.mock('@/server/sampark/jobs', () => ({ dispatchJob: jest.fn(async () => ({ schools: 0 })) }));
jest.mock('@/server/sampark/callbacks', () => ({ callbackDeps: jest.fn(async () => ({})), runCallbackTick: jest.fn(async () => ({ ran: 0 })) }));
jest.mock('@/server/sampark/conversation', () => ({ riyaDeps: jest.fn(async () => ({})), runScheduledTranscriptPurge: () => purge() }));

import type { NextRequest } from 'next/server';

import { POST } from '@/app/api/jobs/sampark-dispatch/route';

const request = (auth: string) =>
    ({ url: 'http://localhost/api/jobs/sampark-dispatch', headers: new Map([['authorization', auth]]), text: async () => '' }) as unknown as NextRequest;

beforeEach(() => {
    process.env.CRON_SECRET = 'cron-test-secret';
});
afterEach(() => jest.restoreAllMocks());

it('every authorised tick asks for the sweep and reports it; never without the scheduler secret', async () => {
    expect((await POST(request('Bearer wrong'))).status).toBe(401);
    expect(purge).not.toHaveBeenCalled();

    expect(await (await POST(request('Bearer cron-test-secret'))).json()).toMatchObject({ transcriptsPurged: 3 });
    purge.mockResolvedValueOnce(null); // the lease says another tick swept this hour
    expect(await (await POST(request('Bearer cron-test-secret'))).json()).toMatchObject({ transcriptsPurged: null });
    expect(purge).toHaveBeenCalledTimes(2);
});

it('a failing sweep is logged and the tick still answers 200', async () => {
    purge.mockRejectedValueOnce(new Error('firestore down'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const failed = await POST(request('Bearer cron-test-secret'));
    expect(failed.status).toBe(200);
    expect(await failed.json()).toMatchObject({ transcriptsPurged: null });
});
