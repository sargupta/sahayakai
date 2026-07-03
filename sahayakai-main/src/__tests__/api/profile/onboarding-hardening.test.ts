/**
 * Onboarding hardening tests (2026-06-06).
 *
 * Covers:
 *  - Server prereq enforcement: rejects onboardingPhase advance when the
 *    mandatory profile fields aren't all present.
 *  - educationBoard default fill-in.
 *  - profileCompletionLevel server-side recompute.
 *  - onboardingCompleted flag is stamped only when phase=completed AND
 *    completion ≥ threshold.
 */

const mockHeadersMap = new Map<string, string>();
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

const updateUserMock = jest.fn(async () => {});
let mockExistingProfile: Record<string, any> | null = null;
const getUserMock = jest.fn(async () => mockExistingProfile);
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        updateUser: (...args: unknown[]) => updateUserMock(...args),
        getUser: (...args: unknown[]) => getUserMock(...args),
        serialize: (x: unknown) => x,
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));

jest.mock('@/lib/auth-utils', () => ({
    validateAdmin: jest.fn(),
    isAdmin: jest.fn(),
}));

jest.mock('@/lib/auth-helpers', () => ({
    requireAuth: async () => mockHeadersMap.get('x-user-id') || (() => { throw new Error('Unauthorized'); })(),
}));

import { updateProfileAction } from '@/server/profile';
import {
    computeProfileCompletion,
    PROFILE_COMPLETE_THRESHOLD,
} from '@/lib/profile-completion';

beforeEach(() => {
    mockHeadersMap.clear();
    updateUserMock.mockClear();
    getUserMock.mockClear();
    mockExistingProfile = null;
});

describe('computeProfileCompletion', () => {
    it('scores an empty profile at 0', () => {
        expect(computeProfileCompletion({})).toBe(0);
    });

    it('scores a fully populated profile at 100', () => {
        const score = computeProfileCompletion({
            displayName: 'Anita',
            state: 'Karnataka',
            schoolName: 'KV Bangalore',
            subjects: ['Math'],
            gradeLevels: ['Class 8'],
            preferredLanguage: 'Hindi',
            educationBoard: 'CBSE',
            phoneNumber: '+919876543210',
            photoURL: 'https://example.com/x.png',
        });
        expect(score).toBe(100);
    });

    it('counts phone alias and avatar aliases', () => {
        const a = computeProfileCompletion({ phone: '+91...', avatarUrl: 'x' });
        // phone(10) + photo(5) = 15
        expect(a).toBe(15);
    });

    it('returns 0–100 only', () => {
        const huge = computeProfileCompletion({
            displayName: 'a', state: 'a', schoolName: 'a',
            subjects: ['a'], gradeLevels: ['a'], preferredLanguage: 'a',
            educationBoard: 'a', phoneNumber: 'a', photoURL: 'a',
        });
        expect(huge).toBeLessThanOrEqual(100);
        expect(huge).toBeGreaterThanOrEqual(0);
    });
});

describe('updateProfileAction — prereq enforcement', () => {
    it('rejects onboardingPhase=first-generation without displayName', async () => {
        mockHeadersMap.set('x-user-id', 'u1');
        mockExistingProfile = null;
        await expect(
            updateProfileAction('u1', {
                onboardingPhase: 'first-generation',
                state: 'Karnataka',
                schoolName: 'KV',
                subjects: ['Math'],
                gradeLevels: ['Class 8'],
                preferredLanguage: 'Hindi',
                // displayName missing
            }),
        ).rejects.toThrow(/displayName/);
        expect(updateUserMock).not.toHaveBeenCalled();
    });

    it('rejects onboardingPhase=completed without preferredLanguage', async () => {
        mockHeadersMap.set('x-user-id', 'u1');
        mockExistingProfile = {
            displayName: 'A', state: 'KA', schoolName: 'KV',
            subjects: ['Math'], gradeLevels: ['Class 8'],
        };
        await expect(
            updateProfileAction('u1', { onboardingPhase: 'completed' }),
        ).rejects.toThrow(/preferredLanguage/);
    });

    it('accepts an all-in-one patch with every prereq present', async () => {
        mockHeadersMap.set('x-user-id', 'u1');
        mockExistingProfile = null;
        await updateProfileAction('u1', {
            onboardingPhase: 'first-generation',
            displayName: 'Anita',
            state: 'Karnataka',
            schoolName: 'KV Bangalore',
            subjects: ['Math'],
            gradeLevels: ['Class 8'],
            preferredLanguage: 'Hindi',
        });
        expect(updateUserMock).toHaveBeenCalledTimes(1);
    });
});

describe('updateProfileAction — educationBoard default', () => {
    it('fills educationBoard from state when missing (state board)', async () => {
        mockHeadersMap.set('x-user-id', 'u1');
        mockExistingProfile = null;
        await updateProfileAction('u1', {
            displayName: 'Anita',
            state: 'Karnataka',
            schoolName: 'X',
            subjects: ['Math'],
            gradeLevels: ['Class 8'],
            preferredLanguage: 'Hindi',
        });
        const [, written] = updateUserMock.mock.calls[0] as [string, Record<string, any>];
        expect(written.educationBoard).toMatch(/Karnataka/);
    });

    it('falls back to CBSE when no state is known', async () => {
        mockHeadersMap.set('x-user-id', 'u1');
        mockExistingProfile = null;
        await updateProfileAction('u1', { displayName: 'Anita' });
        const [, written] = updateUserMock.mock.calls[0] as [string, Record<string, any>];
        expect(written.educationBoard).toBe('CBSE');
    });

    it('does not clobber an existing educationBoard', async () => {
        mockHeadersMap.set('x-user-id', 'u1');
        mockExistingProfile = { educationBoard: 'ICSE / ISC', state: 'Karnataka' };
        await updateProfileAction('u1', { schoolName: 'X' });
        const [, written] = updateUserMock.mock.calls[0] as [string, Record<string, any>];
        // educationBoard not present in patch means we don't overwrite the existing 'ICSE / ISC'
        expect(written.educationBoard).toBeUndefined();
    });
});

describe('updateProfileAction — completion + onboardingCompleted', () => {
    it('writes a numeric profileCompletionLevel on every patch', async () => {
        mockHeadersMap.set('x-user-id', 'u1');
        mockExistingProfile = null;
        await updateProfileAction('u1', { displayName: 'Anita' });
        const [, written] = updateUserMock.mock.calls[0] as [string, Record<string, any>];
        expect(typeof written.profileCompletionLevel).toBe('number');
        expect(written.profileCompletionLevel).toBeGreaterThan(0);
    });

    it('stamps onboardingCompleted=true only when phase=completed and score≥threshold', async () => {
        mockHeadersMap.set('x-user-id', 'u1');
        mockExistingProfile = {
            displayName: 'Anita', state: 'Karnataka', schoolName: 'KV',
            subjects: ['Math'], gradeLevels: ['Class 8'],
            preferredLanguage: 'Hindi', educationBoard: 'CBSE',
            phoneNumber: '+919876543210',
        };
        await updateProfileAction('u1', { onboardingPhase: 'completed' });
        const [, written] = updateUserMock.mock.calls[0] as [string, Record<string, any>];
        expect(written.onboardingCompleted).toBe(true);
        expect(written.onboardingCompletedAt).toBeInstanceOf(Date);
        expect(written.profileCompletionLevel).toBeGreaterThanOrEqual(PROFILE_COMPLETE_THRESHOLD);
    });
});
