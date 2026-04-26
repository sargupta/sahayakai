/**
 * Wave 2b regression test for the privilege-escalation fix at
 * src/lib/db/adapter.ts (filterUserUpdate + CLIENT_EDITABLE_USER_FIELDS).
 *
 * Verifies that security-sensitive fields (planTier, isAdmin, role, email,
 * impactScore, followersCount, etc.) are stripped from any client-supplied
 * payload BEFORE write, even if the action layer forgot to validate.
 */

const writeCalls: Array<{ path: string; data: any }> = [];
const warnCalls: Array<{ msg: string; ctx: string; meta: any }> = [];

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: () => ({
            doc: () => ({
                set: jest.fn(async (data: any, _opts: any) => {
                    writeCalls.push({ path: 'users/x', data });
                }),
            }),
        }),
    }),
}));

jest.mock('firebase-admin/firestore', () => ({
    Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0 }) },
    FieldValue: {
        serverTimestamp: () => 'SERVER_TS',
        increment: (n: number) => ({ __increment: n }),
        arrayUnion: (...vs: any[]) => ({ __arrayUnion: vs }),
        arrayRemove: (...vs: any[]) => ({ __arrayRemove: vs }),
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: {
        warn: jest.fn((msg: string, ctx: string, meta: any) => {
            warnCalls.push({ msg, ctx, meta });
        }),
        info: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock('@/lib/usage-tracker', () => ({
    UsageTracker: {
        logUsage: jest.fn(),
    },
}));

import { dbAdapter } from '@/lib/db/adapter';

beforeEach(() => {
    writeCalls.length = 0;
    warnCalls.length = 0;
});

describe('dbAdapter.updateUser — Wave 2b field allowlist', () => {
    it('writes allowlisted client-editable fields', async () => {
        await dbAdapter.updateUser('uid-1', {
            displayName: 'Anita Sharma',
            bio: 'Math teacher',
            schoolName: 'DPS RK Puram',
            preferredLanguage: 'Hindi',
        } as any);

        expect(writeCalls).toHaveLength(1);
        const written = writeCalls[0].data;
        expect(written.displayName).toBe('Anita Sharma');
        expect(written.bio).toBe('Math teacher');
        expect(written.schoolName).toBe('DPS RK Puram');
        expect(written.preferredLanguage).toBe('Hindi');
    });

    it('strips planTier from the payload (privilege escalation block)', async () => {
        await dbAdapter.updateUser('uid-1', {
            displayName: 'X',
            planTier: 'premium',
        } as any);

        expect(writeCalls).toHaveLength(1);
        expect(writeCalls[0].data).not.toHaveProperty('planTier');
        expect(warnCalls.some(w => w.meta.rejected.includes('planTier'))).toBe(true);
    });

    it('strips isAdmin and role from the payload (admin escalation block)', async () => {
        await dbAdapter.updateUser('uid-1', {
            displayName: 'X',
            isAdmin: true,
            role: 'admin',
        } as any);

        expect(writeCalls[0].data).not.toHaveProperty('isAdmin');
        expect(writeCalls[0].data).not.toHaveProperty('role');
    });

    it('strips email (cannot rewrite identity field)', async () => {
        await dbAdapter.updateUser('uid-1', {
            email: 'spoofed@evil.example',
        } as any);
        expect(writeCalls[0].data).not.toHaveProperty('email');
    });

    it('strips impactScore and followersCount (server-computed metrics)', async () => {
        await dbAdapter.updateUser('uid-1', {
            impactScore: 9999,
            followersCount: 100000,
        } as any);
        expect(writeCalls[0].data).not.toHaveProperty('impactScore');
        expect(writeCalls[0].data).not.toHaveProperty('followersCount');
    });

    it('preserves uid + lastLogin server stamps regardless of input', async () => {
        await dbAdapter.updateUser('uid-1', { displayName: 'X', uid: 'spoofed' } as any);
        expect(writeCalls[0].data.uid).toBe('uid-1'); // server-supplied uid wins
        expect(writeCalls[0].data.lastLogin).toBe('SERVER_TS');
    });

    it('logs every rejected key for security-incident review', async () => {
        await dbAdapter.updateUser('uid-1', {
            planTier: 'premium',
            isAdmin: true,
            email: 'evil@x.com',
            __proto__: { polluted: true } as any,
        } as any);
        const warned = warnCalls[0]?.meta?.rejected ?? [];
        expect(warned).toContain('planTier');
        expect(warned).toContain('isAdmin');
        expect(warned).toContain('email');
    });
});
