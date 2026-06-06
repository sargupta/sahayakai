/**
 * F11-5 regression test: syncUserAction must not clobber displayName /
 * photoURL with empty strings when the provider (e.g. phone-only re-sign-in)
 * doesn't populate them.
 */

const mockHeadersMap = new Map<string, string>();
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

const updateUserMock = jest.fn(async () => {});
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUser: jest.fn(),
        updateUser: (...args: any[]) => updateUserMock(...args),
        serialize: (x: any) => x,
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

beforeEach(() => {
    mockHeadersMap.clear();
    updateUserMock.mockClear();
    mockHeadersMap.set('x-user-id', 'user-1');
});

import { syncUserAction } from '@/app/actions/auth';

describe('syncUserAction — no clobber (F11-5)', () => {
    it('does NOT write displayName when provider value is null', async () => {
        await syncUserAction({
            uid: 'user-1',
            email: 'a@b.com',
            displayName: null,
            photoURL: null,
        });
        const [uid, patch] = updateUserMock.mock.calls[0];
        expect(uid).toBe('user-1');
        expect(patch).not.toHaveProperty('displayName');
        expect(patch).not.toHaveProperty('photoURL');
        expect(patch.email).toBe('a@b.com');
        expect(patch.uid).toBe('user-1');
    });

    it('does NOT write displayName when provider value is empty string', async () => {
        await syncUserAction({
            uid: 'user-1',
            email: null,
            displayName: '',
            photoURL: '',
        });
        const [, patch] = updateUserMock.mock.calls[0];
        expect(patch).not.toHaveProperty('displayName');
        expect(patch).not.toHaveProperty('photoURL');
        expect(patch).not.toHaveProperty('email');
    });

    it('DOES write displayName / photoURL when provider supplies them', async () => {
        await syncUserAction({
            uid: 'user-1',
            email: 'a@b.com',
            displayName: 'Asha',
            photoURL: 'https://x/y.jpg',
        });
        const [, patch] = updateUserMock.mock.calls[0];
        expect(patch.displayName).toBe('Asha');
        expect(patch.photoURL).toBe('https://x/y.jpg');
        expect(patch.email).toBe('a@b.com');
    });
});
