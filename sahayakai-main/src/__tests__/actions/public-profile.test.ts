/**
 * Tests for src/app/actions/profile.ts::getPublicProfileAction
 *
 * Demo-day (2026-05-20) fix: getProfileData throws Forbidden for cross-user
 * reads, breaking the View flow from notifications. getPublicProfileAction
 * is the safe cross-user reader and must whitelist public fields only.
 */

const mockHeadersMap = new Map<string, string>([['x-user-id', 'user-viewer']]);
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

const mockGetUser = jest.fn();
const mockSerialize = jest.fn((x: any) => x);
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUser: (...args: any[]) => mockGetUser(...args),
        serialize: (x: any) => mockSerialize(x),
    },
}));

const mockGetCerts = jest.fn();
jest.mock('@/lib/services/certification-service', () => ({
    certificationService: {
        getCertificationsByUser: (...args: any[]) => mockGetCerts(...args),
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/lib/auth-utils', () => ({
    validateAdmin: jest.fn(),
}));

import { getPublicProfileAction } from '@/app/actions/profile';

describe('getPublicProfileAction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockHeadersMap.set('x-user-id', 'user-viewer');
    });

    it('returns whitelisted public fields for another teacher', async () => {
        mockGetUser.mockResolvedValue({
            id: 'user-target',
            displayName: 'Anjali Jaiswal',
            photoURL: 'https://example.com/a.jpg',
            email: 'anjali@example.com',
            state: 'Karnataka',
            district: 'Bengaluru',
            schoolType: 'government',
            subjects: ['Math'],
            // Private fields that must NOT leak
            phoneNumber: '+91-9000000000',
            fcmTokens: { device1: 'token-xyz' },
            adminRoles: ['costDashboard'],
        });
        mockGetCerts.mockResolvedValue([{ id: 'c1', certName: 'B.Ed' }]);

        const result = await getPublicProfileAction('user-target');

        expect(result.profile).toMatchObject({
            id: 'user-target',
            displayName: 'Anjali Jaiswal',
            state: 'Karnataka',
            district: 'Bengaluru',
            schoolType: 'government',
        });
        // Private fields stripped
        expect(result.profile).not.toHaveProperty('phoneNumber');
        expect(result.profile).not.toHaveProperty('fcmTokens');
        expect(result.profile).not.toHaveProperty('adminRoles');
        // Certifications passed through
        expect(result.certifications).toHaveLength(1);
    });

    it('returns null profile when user does not exist', async () => {
        mockGetUser.mockResolvedValue(null);
        mockGetCerts.mockResolvedValue([]);

        const result = await getPublicProfileAction('user-missing');
        expect(result.profile).toBeNull();
        expect(result.certifications).toEqual([]);
    });

    it('throws when targetUid is empty', async () => {
        await expect(getPublicProfileAction('' as any)).rejects.toThrow(/Invalid targetUid/);
    });

    it('returns { profile: null, certifications: [] } on adapter failure', async () => {
        mockGetUser.mockRejectedValue(new Error('firestore down'));
        const result = await getPublicProfileAction('user-target');
        expect(result.profile).toBeNull();
        expect(result.certifications).toEqual([]);
    });

    it('requires authentication (no x-user-id header → throws)', async () => {
        mockHeadersMap.delete('x-user-id');
        await expect(getPublicProfileAction('user-target')).rejects.toThrow();
    });
});
