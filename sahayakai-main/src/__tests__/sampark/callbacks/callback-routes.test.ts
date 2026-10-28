/** @jest-environment node */
/**
 * The callback routes' shell: Sampark flag → 401 → 400 → 403 → Riya flag (404), the
 * strict bodies (no client-set status), and the scheduler route needing CRON_SECRET.
 * The service behind them is covered by callback-service.test.ts.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/server/sampark/auth', () => ({ requireOrgAdmin: jest.fn(async (orgId: string, uid: string) => orgId === 'hillview-demo' && uid === 'admin-uid') }));

import type { NextRequest } from 'next/server';

import { GET as listGET, POST as createPOST } from '@/app/api/sampark/[orgId]/callbacks/route';
import { PATCH as updatePATCH } from '@/app/api/sampark/[orgId]/callbacks/[callbackId]/route';
import { POST as dispatchPOST } from '@/app/api/jobs/sampark-dispatch/route';

const fakeRequest = (headers: Record<string, string>, body = '', url = 'http://localhost/api/sampark/hillview-demo/callbacks') =>
    ({
        url,
        headers: new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
        text: async () => body,
        json: async () => JSON.parse(body || '{}'),
    }) as unknown as NextRequest;
const org = (orgId = 'hillview-demo') => ({ params: Promise.resolve({ orgId }) });

const saved = { ...process.env };
beforeEach(() => {
    process.env.SAMPARK_ENABLED = 'true';
    process.env.SAMPARK_ELEVENLABS_ENABLED = 'true';
});
afterEach(() => {
    process.env = { ...saved };
});

describe('GET/POST /api/sampark/[orgId]/callbacks', () => {
    it('401 without a verified user; 403 for a teacher or another school; 404 when Riya is off', async () => {
        expect((await listGET(fakeRequest({}), org())).status).toBe(401);
        expect((await listGET(fakeRequest({ 'x-user-id': 'teacher-uid' }), org())).status).toBe(403);
        expect((await listGET(fakeRequest({ 'x-user-id': 'admin-uid' }), org('other-school'))).status).toBe(403);
        process.env.SAMPARK_ELEVENLABS_ENABLED = 'false';
        expect((await listGET(fakeRequest({ 'x-user-id': 'admin-uid' }), org())).status).toBe(404);
    });

    it('400 for a missing range and for a body that tries to set the status', async () => {
        expect((await listGET(fakeRequest({ 'x-user-id': 'admin-uid' }), org())).status).toBe(400);
        const body = JSON.stringify({
            target: { sourceCallId: 'abc' }, scheduledAt: '2026-10-07T17:00:00+05:30', timeZone: 'Asia/Kolkata',
            requestKey: '5b0f6f4e-0f4e-4c1e-9b1a-6c2d7f0e8a11', confirmedAnnouncement: 'x', status: 'completed',
        });
        expect((await createPOST(fakeRequest({ 'x-user-id': 'admin-uid' }, body), org())).status).toBe(400);
    });
});

describe('PATCH /api/sampark/[orgId]/callbacks/[callbackId]', () => {
    it('rejects unknown actions (no client-driven execution)', async () => {
        const res = await updatePATCH(fakeRequest({ 'x-user-id': 'admin-uid' }, JSON.stringify({ action: 'run', expectedVersion: 1 })), { params: Promise.resolve({ orgId: 'hillview-demo', callbackId: 'abc' }) });
        expect(res.status).toBe(400);
    });
});

describe('POST /api/jobs/sampark-dispatch (runs callbacks)', () => {
    it('is closed without the scheduler secret', async () => {
        delete process.env.CRON_SECRET;
        expect((await dispatchPOST(fakeRequest({}, '', 'http://localhost/api/jobs/sampark-dispatch'))).status).toBe(503);
        process.env.CRON_SECRET = 'cron-test-secret';
        expect((await dispatchPOST(fakeRequest({ authorization: 'Bearer wrong' }, '', 'http://localhost/api/jobs/sampark-dispatch'))).status).toBe(401);
    });
});
