/**
 * F2-01 (P0 PII leak) regression test for getProfiles (tranche 5: migrated
 * from getProfilesAction to the community service + POST /api/community/profiles).
 *
 * Bug: the original action returned RAW Firestore user docs to any signed-in
 * caller — phoneNumber, fcmTokens, adminRoles, planType,
 * razorpaySubscriptionId, creditsUsed, email all leaked.
 *
 * Fix: strip to the same public allowlist that getPublicProfileAction uses.
 */

const mockGetUsers = jest.fn();
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUsers: (...args: any[]) => mockGetUsers(...args),
        serialize: (x: any) => x,
    },
}));

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => { throw new Error('unused'); },
}));
jest.mock('@/lib/pubsub', () => ({ publishEvent: jest.fn() }));
jest.mock('@/lib/aggregator', () => ({ aggregateUserMetrics: jest.fn() }));
jest.mock('@/lib/server-safety', () => ({ checkServerRateLimit: jest.fn() }));
jest.mock('@/lib/server-cache', () => ({
    cachedPerUser: (fn: any) => fn,
    invalidateUserCache: jest.fn(),
}));
jest.mock('@/lib/ai-reactive-trigger', () => ({
    triggerAIReactiveReply: jest.fn(),
}));
jest.mock('@/lib/notifications/create', () => ({
    createNotification: jest.fn(),
    createTypedNotification: jest.fn(),
}));

import { getProfiles } from '@/server/community';
import { POST as profilesRoutePOST } from '@/app/api/community/profiles/route';

describe('getProfiles — PII leak fix (F2-01)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const sensitiveFields = [
        'phoneNumber',
        'fcmTokens',
        'adminRoles',
        'planType',
        'razorpaySubscriptionId',
        'creditsUsed',
        'creditsRemaining',
        'subscriptionStatus',
        'stripeCustomerId',
        'lastLoginAt',
        'onboardingChecklistItems',
        'customClaims',
    ];

    it('strips all sensitive PII when reading another teacher\'s profile', async () => {
        mockGetUsers.mockResolvedValue([
            {
                uid: 'target-uid',
                displayName: 'Anjali J',
                photoURL: 'https://x/y.jpg',
                email: 'anjali@example.com',
                state: 'Karnataka',
                district: 'Bengaluru',
                subjects: ['Math'],
                // Private — MUST NOT LEAK
                phoneNumber: '+91-9000000000',
                fcmTokens: { device1: 'token-xyz' },
                adminRoles: ['costDashboard'],
                planType: 'pro',
                razorpaySubscriptionId: 'sub_abc',
                creditsUsed: 4242,
                creditsRemaining: 1000,
                subscriptionStatus: 'active',
                stripeCustomerId: 'cus_xxx',
                lastLoginAt: '2026-06-01',
                onboardingChecklistItems: { foo: true },
                customClaims: { admin: true },
            },
        ]);

        const result = await getProfiles('caller-uid', ['target-uid']);

        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1);
        const profile = result[0];

        // Safe fields preserved
        expect(profile.uid).toBe('target-uid');
        expect(profile.displayName).toBe('Anjali J');
        expect(profile.state).toBe('Karnataka');
        expect(profile.subjects).toEqual(['Math']);

        // Sensitive fields stripped
        for (const f of sensitiveFields) {
            expect(profile).not.toHaveProperty(f);
        }
    });

    it('strips PII across batch reads', async () => {
        mockGetUsers.mockResolvedValue([
            { uid: 'u1', displayName: 'A', phoneNumber: '111', adminRoles: ['x'] },
            { uid: 'u2', displayName: 'B', fcmTokens: { d: 't' }, planType: 'pro' },
            { uid: 'u3', displayName: 'C', razorpaySubscriptionId: 'sub' },
        ]);
        const result = await getProfiles('caller-uid', ['u1', 'u2', 'u3']);
        for (const p of result) {
            for (const f of sensitiveFields) {
                expect(p).not.toHaveProperty(f);
            }
        }
    });

    it('route still rejects when x-user-id is missing', async () => {
        const req = {
            json: async () => ({ uids: ['x'] }),
            headers: { get: () => null },
        } as any;
        const res = await profilesRoutePOST(req);
        expect(res.status).toBe(401);
        expect(mockGetUsers).not.toHaveBeenCalled();
    });

    it('route serves a signed-in caller (stripping is asserted at the service level above)', async () => {
        mockGetUsers.mockResolvedValue([
            { uid: 'u1', displayName: 'A', phoneNumber: '111', email: 'a@x.com' },
        ]);
        const req = {
            json: async () => ({ uids: ['u1'] }),
            headers: { get: (k: string) => (k === 'x-user-id' ? 'caller-uid' : null) },
        } as any;
        const res = await profilesRoutePOST(req);
        // jest.setup.ts's Response polyfill can't surface NextResponse bodies;
        // the PII-strip assertions run directly against getProfiles above.
        expect(res.status).toBe(200);
        expect(mockGetUsers).toHaveBeenCalledWith(['u1']);
    });
});
