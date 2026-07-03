/**
 * F1-06 regression test — syncUserAction email spoof.
 *
 * Bug: a signed-in attacker called
 *     syncUserAction({ uid: ownUid, email: 'victim@evil.com', ... })
 * and the server wrote that email straight to their Firestore profile,
 * letting them impersonate someone else in mutual-contact / connection
 * surfaces that trust the Firestore copy of email/displayName.
 *
 * Fix: server reads email/displayName from the middleware-injected
 * `x-user-email` / `x-user-name` headers (populated from the verified
 * Firebase ID-token claims). Client-supplied email/displayName are
 * ignored.
 *
 * This test pins the fix by sending a poisoned payload and asserting the
 * value written to Firestore is the verified-token email, not the
 * attacker's.
 */

const mockHeadersMap = new Map<string, string>();
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

const updateUserMock = jest.fn(async () => {});
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        updateUser: (...args: unknown[]) => updateUserMock(...args),
        serialize: (x: unknown) => x,
        getUser: jest.fn(),
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
    },
}));

import * as auth from '@/server/auth';

beforeEach(() => {
    mockHeadersMap.clear();
    updateUserMock.mockClear();
});

describe('F1-06: syncUserAction email spoof', () => {
    it('ignores client-supplied email — uses verified-token email instead', async () => {
        // Middleware-injected: caller is real-user with verified email
        mockHeadersMap.set('x-user-id', 'real-user-uid');
        mockHeadersMap.set('x-user-email', 'real@verified.com');
        mockHeadersMap.set('x-user-name', 'Real User');

        // Client sends a poisoned payload claiming to be victim
        const result = await auth.syncUserAction({
            uid: 'real-user-uid',
            email: 'victim@evil.com',
            displayName: 'Victim Name',
            photoURL: 'https://attacker.example/avatar.png',
        });

        expect(result.success).toBe(true);
        expect(updateUserMock).toHaveBeenCalledTimes(1);

        const [writtenUid, writtenProfile] = updateUserMock.mock.calls[0] as [
            string,
            { uid: string; email: string; displayName: string; photoURL: string },
        ];
        expect(writtenUid).toBe('real-user-uid');
        // F1-06 invariant: email is the VERIFIED token email, NOT the
        // client-supplied attacker value.
        expect(writtenProfile.email).toBe('real@verified.com');
        expect(writtenProfile.email).not.toBe('victim@evil.com');
        // Same invariant for displayName.
        expect(writtenProfile.displayName).toBe('Real User');
        expect(writtenProfile.displayName).not.toBe('Victim Name');
    });

    it('omits email/displayName when token has no claims — never writes client copy', async () => {
        // Edge case: phone-auth users may have no email claim on the token.
        // The middleware therefore doesn't set x-user-email. Per the F11-5
        // no-clobber merge, the action OMITS the field entirely (writing ''
        // would clobber onboarding-set values) — and must never fall back to
        // the client-supplied copy.
        mockHeadersMap.set('x-user-id', 'phone-user-uid');
        // no x-user-email, no x-user-name

        const result = await auth.syncUserAction({
            uid: 'phone-user-uid',
            email: 'spoofed@evil.com',
            displayName: 'Spoofed',
            photoURL: null,
        });

        expect(result.success).toBe(true);
        const [, profile] = updateUserMock.mock.calls[0] as [
            string,
            { email?: string; displayName?: string },
        ];
        // F1-06 invariant: spoofed client values must never reach Firestore.
        expect(profile).not.toHaveProperty('email');
        expect(profile).not.toHaveProperty('displayName');
    });

    it('still rejects uid spoof (Wave 1 regression)', async () => {
        mockHeadersMap.set('x-user-id', 'caller-uid');
        mockHeadersMap.set('x-user-email', 'caller@verified.com');

        const result = await auth.syncUserAction({
            uid: 'different-uid',
            email: 'caller@verified.com',
            displayName: 'X',
            photoURL: null,
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Forbidden/i);
        expect(updateUserMock).not.toHaveBeenCalled();
    });

    it('still rejects unauthenticated calls (Wave 1 regression)', async () => {
        // no x-user-id at all
        const result = await auth.syncUserAction({
            uid: 'any',
            email: 'any@evil.com',
            displayName: null,
            photoURL: null,
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Unauthorized/i);
        expect(updateUserMock).not.toHaveBeenCalled();
    });
});
