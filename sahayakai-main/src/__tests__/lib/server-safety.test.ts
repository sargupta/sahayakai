// Mock 'server-only' — it throws when imported outside RSC
jest.mock('server-only', () => ({}));

const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDoc = jest.fn(() => ({
    get: mockGet,
    set: mockSet,
}));
const mockCollection = jest.fn(() => ({
    doc: mockDoc,
}));

jest.mock('@/lib/firebase-admin', () => ({
    getDb: jest.fn(() =>
        Promise.resolve({
            collection: mockCollection,
        })
    ),
}));

import { SAFETY_CONFIG } from '@/lib/safety';

describe('checkServerRateLimit', () => {
    let checkServerRateLimit: typeof import('@/lib/server-safety').checkServerRateLimit;

    beforeEach(async () => {
        jest.resetModules();

        // Re-mock after resetModules
        jest.mock('server-only', () => ({}));
        jest.mock('@/lib/firebase-admin', () => ({
            getDb: jest.fn(() =>
                Promise.resolve({
                    collection: mockCollection,
                })
            ),
        }));

        const mod = await import('@/lib/server-safety');
        checkServerRateLimit = mod.checkServerRateLimit;

        mockGet.mockReset();
        mockSet.mockReset();
        mockDoc.mockClear();
        mockCollection.mockClear();
    });

    it('allows requests when under limit', async () => {
        const now = Date.now();
        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({ requests: [now - 1000, now - 2000] }),
        });
        mockSet.mockResolvedValue(undefined);

        // Should not throw
        await expect(checkServerRateLimit('user123')).resolves.toBeUndefined();

        expect(mockCollection).toHaveBeenCalledWith('rate_limits');
        expect(mockDoc).toHaveBeenCalledWith('user123');
        expect(mockSet).toHaveBeenCalledWith(
            expect.objectContaining({
                requests: expect.any(Array),
            }),
            { merge: true }
        );
    });

    it('allows requests when no prior history exists', async () => {
        mockGet.mockResolvedValue({
            exists: false,
            data: () => undefined,
        });
        mockSet.mockResolvedValue(undefined);

        await expect(checkServerRateLimit('new-user')).resolves.toBeUndefined();
        // Should have written a single-entry requests array
        const setCall = mockSet.mock.calls[0];
        expect(setCall[0].requests).toHaveLength(1);
    });

    it('throws when rate limit exceeded', async () => {
        const now = Date.now();
        // Fill with MAX requests all within the window
        const requests = Array.from(
            { length: SAFETY_CONFIG.MAX_REQUESTS_PER_WINDOW },
            (_, i) => now - i * 1000
        );

        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({ requests }),
        });

        await expect(checkServerRateLimit('user123')).rejects.toThrow('Rate limit exceeded');
        // Should NOT have written new request
        expect(mockSet).not.toHaveBeenCalled();
    });

    it('uses correct sliding window — old requests are filtered out', async () => {
        const now = Date.now();
        // All requests are outside the window
        const oldRequests = Array.from(
            { length: SAFETY_CONFIG.MAX_REQUESTS_PER_WINDOW },
            (_, i) => now - SAFETY_CONFIG.WINDOW_MS - 10000 - i * 1000
        );

        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({ requests: oldRequests }),
        });
        mockSet.mockResolvedValue(undefined);

        // Should allow — all old requests filtered out
        await expect(checkServerRateLimit('user123')).resolves.toBeUndefined();
        // Written array should have only the new request (old ones filtered)
        const setCall = mockSet.mock.calls[0];
        expect(setCall[0].requests).toHaveLength(1);
    });

    it('fails open on infrastructure errors', async () => {
        mockGet.mockRejectedValue(new Error('Firestore unavailable'));

        // Should NOT throw — fails open
        await expect(checkServerRateLimit('user123')).resolves.toBeUndefined();
    });
});
