/**
 * @jest-environment node
 *
 * Access gate: server-side source of truth, claim merging and self-heal.
 */
jest.mock('server-only', () => ({}), { virtual: true });

type Claims = Record<string, unknown>;
const authUsers: Record<string, { customClaims?: Claims; metadata: { creationTime: string } }> = {};
const userDocs: Record<string, Record<string, unknown> | undefined> = {};
const auditDocs: Record<string, unknown>[] = [];
const setClaimsMock = jest.fn(async (uid: string, claims: Claims | null) => {
    authUsers[uid].customClaims = claims ?? undefined;
});
let auditThrows = false;

jest.mock('@/lib/firebase-admin', () => ({
    getAuthInstance: async () => ({
        getUser: async (uid: string) => {
            if (!authUsers[uid]) throw new Error('auth/user-not-found');
            return authUsers[uid];
        },
        setCustomUserClaims: (uid: string, claims: Claims | null) => setClaimsMock(uid, claims),
    }),
    getDb: async () => ({
        collection: (name: string) => ({
            doc: (id: string) => ({
                get: async () => ({ exists: userDocs[id] !== undefined, data: () => userDocs[id] }),
                set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
                    if (name !== 'users') throw new Error(`unexpected set on ${name}`);
                    userDocs[id] = opts?.merge ? { ...(userDocs[id] ?? {}), ...data } : data;
                },
            }),
            add: async (data: Record<string, unknown>) => {
                if (auditThrows) throw new Error('firestore down');
                auditDocs.push({ collection: name, ...data });
            },
        }),
    }),
}));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import {
    PAYMENT_ACTOR,
    baseAccessState,
    getLegacyCutoff,
    grantPaidAccess,
    mergeCustomClaims,
    revokePaidAccess,
    resolveAccess,
    setAccessState,
    syncAccessClaim,
} from '@/lib/access/access-admin';

const CUTOFF = '2026-12-01T00:00:00.000Z';
const BEFORE = 'Mon, 02 Nov 2026 10:00:00 GMT';
const AFTER = 'Wed, 02 Dec 2026 10:00:00 GMT';

function reset() {
    for (const k of Object.keys(authUsers)) delete authUsers[k];
    for (const k of Object.keys(userDocs)) delete userDocs[k];
    auditDocs.length = 0;
    auditThrows = false;
    setClaimsMock.mockClear();
    process.env.ACCESS_LEGACY_CUTOFF = CUTOFF;
}
beforeEach(reset);
afterAll(() => { delete process.env.ACCESS_LEGACY_CUTOFF; });

describe('mergeCustomClaims', () => {
    it('preserves every existing claim when adding one', async () => {
        authUsers.u1 = { customClaims: { planType: 'pro', orgId: 'o1', onboardingCompleted: true }, metadata: { creationTime: BEFORE } };
        await mergeCustomClaims('u1', { access: 'legacy' });
        expect(setClaimsMock).toHaveBeenCalledWith('u1', { planType: 'pro', orgId: 'o1', onboardingCompleted: true, access: 'legacy' });
    });

    it('removes a key when the patch value is null or undefined', async () => {
        authUsers.u1 = { customClaims: { planType: 'gold', orgId: 'o1', orgRole: 'teacher', accessExp: 5 }, metadata: { creationTime: BEFORE } };
        const written = await mergeCustomClaims('u1', { planType: 'free', orgId: null, orgRole: undefined, accessExp: null });
        expect(written).toEqual({ planType: 'free' });
    });

    it('does not write when nothing changes', async () => {
        authUsers.u1 = { customClaims: { planType: 'pro' }, metadata: { creationTime: BEFORE } };
        await mergeCustomClaims('u1', { planType: 'pro', orgId: null });
        expect(setClaimsMock).not.toHaveBeenCalled();
    });

    it('handles an account with no claims yet', async () => {
        authUsers.u1 = { metadata: { creationTime: BEFORE } };
        await mergeCustomClaims('u1', { planType: 'pro' });
        expect(setClaimsMock).toHaveBeenCalledWith('u1', { planType: 'pro' });
    });

    it('refuses a payload above the Firebase 1000-byte limit', async () => {
        authUsers.u1 = { customClaims: {}, metadata: { creationTime: BEFORE } };
        await expect(mergeCustomClaims('u1', { blob: 'x'.repeat(1100) })).rejects.toThrow(/limit/);
        expect(setClaimsMock).not.toHaveBeenCalled();
    });

    it('requires a uid', async () => {
        await expect(mergeCustomClaims('', { a: 1 })).rejects.toThrow();
    });
});

describe('getLegacyCutoff', () => {
    it('returns null for unset or invalid values', () => {
        expect(getLegacyCutoff('')).toBeNull();
        expect(getLegacyCutoff('not-a-date')).toBeNull();
        expect(getLegacyCutoff(CUTOFF)?.toISOString()).toBe(CUTOFF);
    });
});

describe('baseAccessState', () => {
    it('is legacy for an account created before the cutoff', async () => {
        authUsers.old = { metadata: { creationTime: BEFORE } };
        expect(await baseAccessState('old')).toEqual({ state: 'legacy', source: 'default-legacy' });
    });
    it('is pending for an account created after the cutoff', async () => {
        authUsers.fresh = { metadata: { creationTime: AFTER } };
        expect(await baseAccessState('fresh')).toEqual({ state: 'pending', source: 'default-pending' });
    });
    it('is pending when the creation time is unreadable (fail closed)', async () => {
        authUsers.odd = { metadata: { creationTime: 'garbage' } };
        expect((await baseAccessState('odd')).state).toBe('pending');
    });
    it('resolves everyone to legacy when no cutoff is configured', async () => {
        delete process.env.ACCESS_LEGACY_CUTOFF;
        authUsers.fresh = { metadata: { creationTime: AFTER } };
        expect(await baseAccessState('fresh')).toEqual({ state: 'legacy', source: 'default-no-cutoff' });
    });
});

describe('resolveAccess', () => {
    it('prefers the stored state over the derived default', async () => {
        authUsers.u1 = { metadata: { creationTime: BEFORE } };
        const exp = new Date('2027-01-01T00:00:00Z');
        userDocs.u1 = { accessState: 'pilot', accessExpiresAt: { toDate: () => exp } };
        expect(await resolveAccess('u1')).toEqual({ state: 'pilot', expiresAt: exp, source: 'stored' });
    });
    it('ignores an unrecognised stored value', async () => {
        authUsers.u1 = { metadata: { creationTime: AFTER } };
        userDocs.u1 = { accessState: 'superuser' };
        expect((await resolveAccess('u1')).state).toBe('pending');
    });
});

describe('setAccessState', () => {
    beforeEach(() => { authUsers.u1 = { customClaims: { planType: 'gold' }, metadata: { creationTime: AFTER } }; });

    it('writes Firestore, merges the claim and audits', async () => {
        const exp = new Date('2027-01-15T00:00:00Z');
        await setAccessState('u1', 'pilot', { expiresAt: exp, actor: 'admin1', reason: 'approved pilot' });
        expect(userDocs.u1).toMatchObject({ accessState: 'pilot', accessExpiresAt: exp, accessUpdatedBy: 'admin1' });
        expect(authUsers.u1.customClaims).toEqual({ planType: 'gold', access: 'pilot', accessExp: Math.floor(exp.getTime() / 1000) });
        expect(auditDocs[0]).toMatchObject({ collection: 'access_audit', uid: 'u1', from: null, to: 'pilot', actor: 'admin1' });
    });

    it('requires an expiry for a pilot', async () => {
        await expect(setAccessState('u1', 'pilot', { actor: 'a', reason: 'r' })).rejects.toThrow(/expiresAt/);
        expect(userDocs.u1).toBeUndefined();
    });

    it('drops the expiry claim when moving to a state without one', async () => {
        authUsers.u1.customClaims = { access: 'pilot', accessExp: 123 };
        await setAccessState('u1', 'blocked', { expiresAt: new Date(), actor: 'a', reason: 'misuse' });
        expect(authUsers.u1.customClaims).toEqual({ access: 'blocked' });
        expect(userDocs.u1?.accessExpiresAt).toBeNull();
    });

    it('requires actor and reason, and a valid state', async () => {
        await expect(setAccessState('u1', 'active', { actor: '', reason: 'r' })).rejects.toThrow();
        await expect(setAccessState('u1', 'active', { actor: 'a', reason: '' })).rejects.toThrow();
        await expect(setAccessState('u1', 'root' as never, { actor: 'a', reason: 'r' })).rejects.toThrow(/invalid state/);
    });

    it('still succeeds when the audit write fails', async () => {
        auditThrows = true;
        await expect(setAccessState('u1', 'active', { actor: 'a', reason: 'r' })).resolves.toMatchObject({ state: 'active' });
        expect(authUsers.u1.customClaims).toMatchObject({ access: 'active' });
    });
});

describe('syncAccessClaim (self-heal)', () => {
    it('restores a claim that another writer dropped', async () => {
        authUsers.u1 = { customClaims: { planType: 'pro' }, metadata: { creationTime: BEFORE } };
        userDocs.u1 = { accessState: 'legacy' };
        const r = await syncAccessClaim('u1');
        expect(r).toMatchObject({ state: 'legacy', claimChanged: true });
        expect(r.decision.entitled).toBe(true);
        expect(authUsers.u1.customClaims).toEqual({ planType: 'pro', access: 'legacy' });
    });

    it('is a no-op when the claim already matches', async () => {
        authUsers.u1 = { customClaims: { access: 'legacy' }, metadata: { creationTime: BEFORE } };
        userDocs.u1 = { accessState: 'legacy' };
        expect((await syncAccessClaim('u1')).claimChanged).toBe(false);
        expect(setClaimsMock).not.toHaveBeenCalled();
    });

    it('persists and stamps pending for a brand-new account', async () => {
        authUsers.fresh = { metadata: { creationTime: AFTER } };
        const r = await syncAccessClaim('fresh');
        expect(r).toMatchObject({ state: 'pending', claimChanged: true });
        expect(r.decision.entitled).toBe(false);
        expect(userDocs.fresh).toMatchObject({ accessState: 'pending', accessUpdatedBy: 'system:sync' });
        expect(authUsers.fresh.customClaims).toEqual({ access: 'pending' });
    });

    it('marks an existing teacher legacy even if the backfill missed them', async () => {
        authUsers.old = { customClaims: { onboardingCompleted: true }, metadata: { creationTime: BEFORE } };
        const r = await syncAccessClaim('old');
        expect(r.decision.entitled).toBe(true);
        expect(authUsers.old.customClaims).toEqual({ onboardingCompleted: true, access: 'legacy' });
    });

    it('carries a pilot expiry into the claim and reports an expired pilot as not entitled', async () => {
        const past = new Date(Date.now() - 60_000);
        authUsers.p = { customClaims: {}, metadata: { creationTime: AFTER } };
        userDocs.p = { accessState: 'pilot', accessExpiresAt: past };
        const r = await syncAccessClaim('p');
        expect(r.decision).toMatchObject({ entitled: false, verdict: 'expired' });
        expect(authUsers.p.customClaims).toEqual({ access: 'pilot', accessExp: Math.floor(past.getTime() / 1000) });
    });

    it('stamps nothing while the cutoff is not configured', async () => {
        delete process.env.ACCESS_LEGACY_CUTOFF;
        authUsers.fresh = { metadata: { creationTime: AFTER } };
        const r = await syncAccessClaim('fresh');
        expect(r).toMatchObject({ source: 'default-no-cutoff', claimChanged: false });
        expect(setClaimsMock).not.toHaveBeenCalled();
        expect(userDocs.fresh).toBeUndefined();
    });
});

describe('paid access', () => {
    it('entitles a post-cutoff account that pays', async () => {
        authUsers.fresh = { customClaims: { planType: 'pro' }, metadata: { creationTime: AFTER } };
        userDocs.fresh = { accessState: 'pending' };
        expect(await grantPaidAccess('fresh', 'paid')).toBe('active');
        expect(userDocs.fresh).toMatchObject({ accessState: 'active', accessUpdatedBy: PAYMENT_ACTOR });
        expect(authUsers.fresh.customClaims).toEqual({ planType: 'pro', access: 'active' });
    });

    it('leaves a legacy account legacy but makes sure the claim exists', async () => {
        authUsers.old = { customClaims: { planType: 'pro' }, metadata: { creationTime: BEFORE } };
        expect(await grantPaidAccess('old', 'paid')).toBe('legacy');
        expect(authUsers.old.customClaims).toEqual({ planType: 'pro', access: 'legacy' });
        expect(userDocs.old).toBeUndefined();
    });

    it('never unblocks a blocked account', async () => {
        authUsers.b = { customClaims: { access: 'blocked' }, metadata: { creationTime: AFTER } };
        userDocs.b = { accessState: 'blocked' };
        expect(await grantPaidAccess('b', 'paid')).toBe('blocked');
        expect(userDocs.b.accessState).toBe('blocked');
        expect(setClaimsMock).not.toHaveBeenCalled();
    });

    it('upgrades a pilot (expiring or expired) to active on payment', async () => {
        authUsers.p = { customClaims: {}, metadata: { creationTime: AFTER } };
        userDocs.p = { accessState: 'pilot', accessExpiresAt: new Date(Date.now() + 86_400_000) };
        expect(await grantPaidAccess('p', 'paid')).toBe('active');
        expect(authUsers.p.customClaims).toEqual({ access: 'active' });
    });

    it('returns payment-granted access to the base state when the plan ends', async () => {
        authUsers.fresh = { customClaims: { access: 'active' }, metadata: { creationTime: AFTER } };
        userDocs.fresh = { accessState: 'active', accessUpdatedBy: PAYMENT_ACTOR };
        expect(await revokePaidAccess('fresh', 'ended')).toBe('pending');
        expect(authUsers.fresh.customClaims).toEqual({ access: 'pending' });
    });

    it('does not touch access an administrator or school granted', async () => {
        authUsers.t = { customClaims: { access: 'active', orgId: 'o1' }, metadata: { creationTime: AFTER } };
        userDocs.t = { accessState: 'active', accessUpdatedBy: 'admin_uid' };
        expect(await revokePaidAccess('t', 'ended')).toBe('active');
        expect(setClaimsMock).not.toHaveBeenCalled();
    });

    it('does nothing to claims while the cutoff is unset', async () => {
        delete process.env.ACCESS_LEGACY_CUTOFF;
        authUsers.fresh = { customClaims: { planType: 'pro' }, metadata: { creationTime: AFTER } };
        expect(await grantPaidAccess('fresh', 'paid')).toBe('legacy');
        expect(setClaimsMock).not.toHaveBeenCalled();
    });
});
