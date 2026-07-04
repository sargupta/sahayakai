/**
 * @jest-environment node
 *
 * Tests for POST /api/jobs/analytics-retention — DPDP 1-year retention sweep
 * over users/{uid}/analytics/{date} docs.
 *
 * Verifies:
 * - No CRON_SECRET configured → 503
 * - Wrong/absent bearer → 401
 * - Correct bearer → collection-group query with a ~365-day cutoff, batched
 *   delete, drains across batches, reports count.
 */
import { NextResponse } from 'next/server';

const mockCommit = jest.fn(async () => {});
const mockBatchDelete = jest.fn();
const mockBatch = jest.fn(() => ({ delete: mockBatchDelete, commit: mockCommit }));
const mockGet = jest.fn();
const mockLimit = jest.fn(() => ({ get: mockGet }));
const mockWhere = jest.fn(() => ({ limit: mockLimit }));
const mockCollectionGroup = jest.fn(() => ({ where: mockWhere }));

jest.mock('@/lib/firebase-admin', () => ({
    getDb: jest.fn(async () => ({
        collectionGroup: (...a: any[]) => mockCollectionGroup(...a),
        batch: () => mockBatch(),
    })),
}));
jest.mock('@/lib/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const jsonSpy = jest.spyOn(NextResponse, 'json');

function makeReq(headers: Record<string, string> = {}): Request {
    const lower: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
    return {
        url: 'https://example.test/api/jobs/analytics-retention',
        method: 'POST',
        headers: { get: (k: string) => lower[k.toLowerCase()] ?? null },
    } as any as Request;
}
function lastJson() {
    const c = jsonSpy.mock.calls;
    const [body, init] = c[c.length - 1] as any[];
    return { body, status: init?.status ?? 200 };
}
function snap(size: number) {
    return { empty: size === 0, size, docs: Array.from({ length: size }, (_, i) => ({ ref: { id: i } })) };
}

const OLD_ENV = process.env;
beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, CRON_SECRET: 'secret' };
});
afterAll(() => { process.env = OLD_ENV; });

async function POST(req: Request) {
    const mod = await import('@/app/api/jobs/analytics-retention/route');
    return mod.POST(req);
}

test('503 when CRON_SECRET not configured', async () => {
    delete process.env.CRON_SECRET;
    await POST(makeReq());
    expect(lastJson().status).toBe(503);
});

test('401 on wrong bearer', async () => {
    await POST(makeReq({ authorization: 'Bearer nope' }));
    expect(lastJson().status).toBe(401);
});

test('deletes expired analytics with ~365d cutoff and drains', async () => {
    // two full-size batches then an empty one
    mockGet.mockResolvedValueOnce(snap(500)).mockResolvedValueOnce(snap(3));
    await POST(makeReq({ authorization: 'Bearer secret' }));

    expect(mockCollectionGroup).toHaveBeenCalledWith('analytics');
    expect(mockWhere).toHaveBeenCalledWith('lastUpdated', '<', expect.any(Date));
    const cutoff = mockWhere.mock.calls[0][2] as unknown as Date;
    const days = (Date.now() - cutoff.getTime()) / 86400000;
    expect(days).toBeGreaterThan(360);
    expect(days).toBeLessThan(370);

    const { body, status } = lastJson();
    expect(status).toBe(200);
    expect(body.deleted).toBe(503);
    expect(body.drained).toBe(true);
    expect(mockCommit).toHaveBeenCalledTimes(2);
});

test('200 with 0 deleted when nothing expired', async () => {
    mockGet.mockResolvedValueOnce(snap(0));
    await POST(makeReq({ authorization: 'Bearer secret' }));
    const { body } = lastJson();
    expect(body.deleted).toBe(0);
    expect(mockCommit).not.toHaveBeenCalled();
});
