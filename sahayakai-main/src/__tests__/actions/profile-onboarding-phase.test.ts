/**
 * F11-3 regression test: onboardingPhase cannot be advanced without
 * prerequisites (state, schoolName, subjects, gradeLevels).
 */

const mockHeadersMap = new Map<string, string>();
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

const updateUserMock = jest.fn(async () => {});
const getUserMock = jest.fn(async () => null as any);

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUser: (...args: any[]) => getUserMock(...args),
        updateUser: (...args: any[]) => updateUserMock(...args),
        serialize: (x: any) => x,
    },
}));

jest.mock('@/lib/services/certification-service', () => ({
    certificationService: {
        getCertificationsByUser: jest.fn(),
        addCertification: jest.fn(),
    },
}));

jest.mock('@/lib/auth-utils', () => ({ validateAdmin: jest.fn() }));
jest.mock('@/lib/logger', () => ({
    logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/firebase-admin', () => ({ getDb: jest.fn() }));

beforeEach(() => {
    mockHeadersMap.clear();
    updateUserMock.mockClear();
    getUserMock.mockReset();
    getUserMock.mockResolvedValue(null);
    mockHeadersMap.set('x-user-id', 'user-1');
});

import { updateProfileAction } from '@/app/actions/profile';

describe('updateProfileAction — onboardingPhase prerequisite check (F11-3)', () => {
    it('REJECTS onboardingPhase=exploring when no profile exists yet', async () => {
        getUserMock.mockResolvedValue(null);
        await expect(
            updateProfileAction('user-1', { onboardingPhase: 'exploring' })
        ).rejects.toThrow(/missing prerequisites/i);
        expect(updateUserMock).not.toHaveBeenCalled();
    });

    it('REJECTS onboardingPhase=first-generation when state is missing', async () => {
        getUserMock.mockResolvedValue({
            schoolName: 'KV',
            subjects: ['Maths'],
            gradeLevels: ['Class 7'],
            // state missing
        });
        await expect(
            updateProfileAction('user-1', { onboardingPhase: 'first-generation' })
        ).rejects.toThrow(/missing prerequisites.*state/i);
        expect(updateUserMock).not.toHaveBeenCalled();
    });

    it('REJECTS onboardingPhase=exploring when subjects is empty', async () => {
        getUserMock.mockResolvedValue({
            state: 'Karnataka',
            schoolName: 'KV',
            subjects: [],
            gradeLevels: ['Class 7'],
        });
        await expect(
            updateProfileAction('user-1', { onboardingPhase: 'exploring' })
        ).rejects.toThrow(/missing prerequisites/i);
        expect(updateUserMock).not.toHaveBeenCalled();
    });

    it('ACCEPTS onboardingPhase=exploring when prerequisites exist on profile', async () => {
        // Onboarding hardening (2026-06-06) extended the prereq list to
        // include displayName + preferredLanguage. Existing profile now
        // needs all of those to be considered onboarded enough to advance.
        getUserMock.mockResolvedValue({
            displayName: 'Anita',
            state: 'Karnataka',
            schoolName: 'KV',
            subjects: ['Maths'],
            gradeLevels: ['Class 7'],
            preferredLanguage: 'Hindi',
        });
        await updateProfileAction('user-1', { onboardingPhase: 'exploring' });
        // Server-side write now also includes a recomputed
        // profileCompletionLevel; only assert the phase key made it.
        const [uid, written] = updateUserMock.mock.calls[0] as [string, Record<string, any>];
        expect(uid).toBe('user-1');
        expect(written.onboardingPhase).toBe('exploring');
    });

    it('ACCEPTS onboardingPhase=exploring when patch includes the prerequisites', async () => {
        getUserMock.mockResolvedValue(null);
        await updateProfileAction('user-1', {
            displayName: 'Anita',
            state: 'Karnataka',
            schoolName: 'KV',
            subjects: ['Maths'],
            gradeLevels: ['Class 7'],
            preferredLanguage: 'Hindi',
            onboardingPhase: 'first-generation',
        });
        expect(updateUserMock).toHaveBeenCalled();
    });

    it('ACCEPTS onboardingPhase=language-picked without any prerequisite check', async () => {
        getUserMock.mockResolvedValue(null);
        await updateProfileAction('user-1', {
            onboardingPhase: 'language-picked',
            preferredLanguage: 'Hindi',
        });
        expect(updateUserMock).toHaveBeenCalled();
    });
});
