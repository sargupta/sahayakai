/**
 * @jest-environment node
 *
 * Access gate backend: requests, join links, pilots, organisation removal,
 * quotes and the anomaly assessment. Runs the real access-admin helpers
 * against in-memory Firestore/Auth fakes so claim MERGE behaviour is
 * exercised end to end (a bare setCustomUserClaims would drop `access`).
 */
import { FakeAuth, FakeFirestore } from './backend-fakes';

let db: FakeFirestore;
let auth: FakeAuth;

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: jest.requireActual('./backend-fakes').fakeFieldValue,
}));
jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => db,
    getAuthInstance: async () => auth,
}));
jest.mock('@/lib/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
    decideAccessRequest,
    getAccessRequest,
    parseAccessRequestInput,
    submitAccessRequest,
} from '@/lib/access/requests';
import { createJoinLink, hashJoinToken, parseJoinCode, redeemJoinLink } from '@/lib/access/join-links';
import {
    applyPilotOrgAction,
    expireDuePilotOrganizations,
    expireDueUserGrants,
    parsePilotOrgInput,
    provisionPilotOrganization,
} from '@/lib/access/pilots';
import { removeTeacher } from '@/lib/organization';
import { createQuoteRequest, parseQuoteInput, reserveQuoteSlot } from '@/lib/access/quotes';
import {
    ANOMALY_BREADTH_THRESHOLD,
    assessUsage,
    windowDayKeys,
} from '@/lib/access/anomaly';
import { EVALUATION_TERMS_VERSION } from '@/lib/access/terms';

const NOW = new Date('2026-12-10T06:00:00.000Z');
const CUTOFF = '2026-12-01T00:00:00.000Z';
const BEFORE_CUTOFF = '2026-10-01T00:00:00.000Z';
const AFTER_CUTOFF = '2026-12-05T00:00:00.000Z';
const DAY = 24 * 60 * 60 * 1000;

const validRequest = {
    schoolName: 'St. Example School',
    role: 'Principal',
    board: 'CBSE',
    affiliationNumber: '2430001',
    city: 'Siliguri',
    state: 'West Bengal',
    phone: '+91 98765 43210',
    teacherCount: 60,
    acceptTerms: true,
};

function seedOrg(id: string, data: Record<string, unknown> = {}) {
    db.seed(`organizations/${id}`, {
        name: 'St. Example School',
        type: 'school',
        adminUserId: 'admin1',
        plan: 'gold',
        totalSeats: 5,
        usedSeats: 1,
        status: 'pilot',
        pilotEndsAt: new Date(NOW.getTime() + 10 * DAY),
        ...data,
    });
    db.seed(`organizations/${id}/members/admin1`, { userId: 'admin1', role: 'admin' });
}

async function linkFor(orgId: string, overrides: Record<string, unknown> = {}) {
    const link = await createJoinLink({ orgId, createdBy: 'admin1', now: NOW });
    if (Object.keys(overrides).length > 0) {
        const path = `organizations/${orgId}/joinLinks/${link.id}`;
        db.seed(path, { ...db.read(path), ...overrides });
    }
    return link;
}

beforeEach(() => {
    db = new FakeFirestore();
    auth = new FakeAuth();
    process.env.ACCESS_LEGACY_CUTOFF = CUTOFF;
    auth.add({ uid: 'admin1', email: 'principal@example.test', creationTime: AFTER_CUTOFF });
    auth.add({ uid: 'newbie', email: 'new@example.test', creationTime: AFTER_CUTOFF, customClaims: { onboardingCompleted: true } });
    auth.add({ uid: 'veteran', email: 'old@example.test', creationTime: BEFORE_CUTOFF, customClaims: { onboardingCompleted: true } });
});

afterAll(() => {
    delete process.env.ACCESS_LEGACY_CUTOFF;
});

// ── Access requests ─────────────────────────────────────────────────────────

describe('access requests', () => {
    it('rejects a body without accepted terms', () => {
        expect(() => parseAccessRequestInput({ ...validRequest, acceptTerms: false })).toThrow(/evaluation terms/);
    });

    it('rejects missing and over-long fields', () => {
        expect(() => parseAccessRequestInput({ ...validRequest, schoolName: '' })).toThrow(/schoolName/);
        expect(() => parseAccessRequestInput({ ...validRequest, schoolName: 'x'.repeat(161) })).toThrow(/schoolName/);
        expect(() => parseAccessRequestInput({ ...validRequest, message: 'x'.repeat(1001) })).toThrow(/message/);
        expect(() => parseAccessRequestInput({ ...validRequest, phone: 'call me' })).toThrow(/phone/);
        expect(() => parseAccessRequestInput({ ...validRequest, teacherCount: -3 })).toThrow(/teacherCount/);
    });

    it('drops unknown fields so a body cannot set status or identity', () => {
        const parsed = parseAccessRequestInput({ ...validRequest, status: 'approved', email: 'evil@x.test', uid: 'veteran' });
        expect(parsed).not.toHaveProperty('status');
        expect(parsed).not.toHaveProperty('email');
        expect(parsed).not.toHaveProperty('uid');
    });

    it('stores identity from the trusted parameters and records terms acceptance', async () => {
        const input = parseAccessRequestInput(validRequest);
        await submitAccessRequest({ uid: 'newbie', email: 'new@example.test', displayName: 'New Teacher', input, now: NOW });
        const stored = db.read('access_requests/newbie');
        expect(stored).toMatchObject({
            uid: 'newbie',
            email: 'new@example.test',
            status: 'pending',
            termsVersion: EVALUATION_TERMS_VERSION,
        });
        expect((await getAccessRequest('newbie'))?.status).toBe('pending');
    });

    it('allows re-submission while pending and keeps the original createdAt', async () => {
        const input = parseAccessRequestInput(validRequest);
        await submitAccessRequest({ uid: 'newbie', email: null, displayName: null, input, now: NOW });
        const later = new Date(NOW.getTime() + DAY);
        await submitAccessRequest({
            uid: 'newbie', email: null, displayName: null,
            input: { ...input, city: 'Darjeeling' }, now: later,
        });
        const stored = db.read('access_requests/newbie');
        expect(stored?.city).toBe('Darjeeling');
        expect(stored?.createdAt).toEqual(NOW);
    });

    it('approves as a 14-day pilot by default and preserves other claims', async () => {
        await submitAccessRequest({ uid: 'newbie', email: null, displayName: null, input: parseAccessRequestInput(validRequest), now: NOW });
        const result = await decideAccessRequest({ uid: 'newbie', decision: 'approve', actor: 'sys-admin', now: NOW });
        expect(result.grantedState).toBe('pilot');
        expect(result.grantedExpiresAt?.getTime()).toBe(NOW.getTime() + 14 * DAY);
        expect(auth.claims('newbie')).toMatchObject({
            access: 'pilot',
            accessExp: Math.floor((NOW.getTime() + 14 * DAY) / 1000),
            onboardingCompleted: true,
        });
        expect(db.read('users/newbie')?.accessState).toBe('pilot');
        expect(db.read('access_requests/newbie')).toMatchObject({ status: 'approved', decidedBy: 'sys-admin' });
    });

    it('caps a pilot at 90 days', async () => {
        await submitAccessRequest({ uid: 'newbie', email: null, displayName: null, input: parseAccessRequestInput(validRequest), now: NOW });
        const result = await decideAccessRequest({ uid: 'newbie', decision: 'approve', expiresInDays: 9999, actor: 'sys-admin', now: NOW });
        expect(result.grantedExpiresAt?.getTime()).toBe(NOW.getTime() + 90 * DAY);
    });

    it('rejecting records the decision and leaves access untouched', async () => {
        await submitAccessRequest({ uid: 'newbie', email: null, displayName: null, input: parseAccessRequestInput(validRequest), now: NOW });
        await decideAccessRequest({ uid: 'newbie', decision: 'reject', note: 'could not verify', actor: 'sys-admin', now: NOW });
        expect(db.read('access_requests/newbie')).toMatchObject({ status: 'rejected', decisionNote: 'could not verify', grantedState: null });
        expect(auth.claims('newbie')).not.toHaveProperty('access');
        expect(db.read('users/newbie')).toBeUndefined();
    });

    it('refuses a second decision and a re-submission after a decision (409)', async () => {
        const input = parseAccessRequestInput(validRequest);
        await submitAccessRequest({ uid: 'newbie', email: null, displayName: null, input, now: NOW });
        await decideAccessRequest({ uid: 'newbie', decision: 'reject', actor: 'sys-admin', now: NOW });
        await expect(decideAccessRequest({ uid: 'newbie', decision: 'approve', actor: 'other-admin', now: NOW }))
            .rejects.toMatchObject({ status: 409 });
        await expect(submitAccessRequest({ uid: 'newbie', email: null, displayName: null, input, now: NOW }))
            .rejects.toMatchObject({ status: 409 });
    });

    it('accepts a new request once an approved grant has lapsed, keeping the earlier decision', async () => {
        const input = parseAccessRequestInput(validRequest);
        await submitAccessRequest({ uid: 'newbie', email: null, displayName: null, input, now: NOW });
        await decideAccessRequest({ uid: 'newbie', decision: 'approve', state: 'pilot', actor: 'sys-admin', now: NOW });
        // Still entitled: a second request is refused.
        await expect(submitAccessRequest({ uid: 'newbie', email: null, displayName: null, input, now: NOW }))
            .rejects.toMatchObject({ status: 409 });

        // The pilot ends and the account returns to pending.
        db.seed('users/newbie', { ...db.read('users/newbie'), accessState: 'pending', accessExpiresAt: null });
        const later = new Date(NOW.getTime() + 20 * DAY);
        await expect(submitAccessRequest({ uid: 'newbie', email: null, displayName: null, input, now: later }))
            .resolves.toEqual({ status: 'pending' });
        const stored = db.read('access_requests/newbie');
        expect(stored).toMatchObject({ status: 'pending', decidedBy: null, grantedState: null });
        expect(stored?.previousDecision).toMatchObject({ status: 'approved', decidedBy: 'sys-admin', grantedState: 'pilot' });
    });

    it('404s a decision for an account with no request', async () => {
        await expect(decideAccessRequest({ uid: 'ghost', decision: 'approve', actor: 'sys-admin' }))
            .rejects.toMatchObject({ status: 404 });
    });
});

// ── Join links ──────────────────────────────────────────────────────────────

describe('join links', () => {
    beforeEach(() => seedOrg('org1'));

    it('stores only a hash and clamps maxUses to the remaining seats', async () => {
        const link = await createJoinLink({ orgId: 'org1', createdBy: 'admin1', maxUses: 500, now: NOW });
        expect(link.maxUses).toBe(4);
        const parsed = parseJoinCode(link.code);
        expect(parsed?.orgId).toBe('org1');
        const stored = db.read(`organizations/org1/joinLinks/${link.id}`);
        expect(stored?.tokenHash).toBe(hashJoinToken(parsed!.token));
        expect(JSON.stringify(stored)).not.toContain(parsed!.token);
        expect(link.expiresAt.getTime()).toBe(NOW.getTime() + 14 * DAY);
    });

    it('caps link lifetime at 60 days and refuses when no seat is free', async () => {
        const long = await createJoinLink({ orgId: 'org1', createdBy: 'admin1', expiresInDays: 365, now: NOW });
        expect(long.expiresAt.getTime()).toBe(NOW.getTime() + 60 * DAY);
        seedOrg('full', { totalSeats: 1, usedSeats: 1 });
        await expect(createJoinLink({ orgId: 'full', createdBy: 'admin1', now: NOW })).rejects.toMatchObject({ status: 409 });
    });

    it('redeems: member, seat, use count, merged claims and pilot access', async () => {
        const link = await linkFor('org1');
        const result = await redeemJoinLink({ code: link.code, uid: 'newbie', acceptTerms: true, now: NOW });
        expect(result).toMatchObject({ orgId: 'org1', orgName: 'St. Example School', state: 'pilot', joined: true });

        expect(db.read('organizations/org1/members/newbie')).toMatchObject({
            role: 'teacher',
            termsVersion: EVALUATION_TERMS_VERSION,
            termsAcceptedAt: NOW,
        });
        expect(db.read('organizations/org1')?.usedSeats).toBe(2);
        expect(db.read(`organizations/org1/joinLinks/${link.id}`)?.uses).toBe(1);
        expect(db.read('users/newbie')).toMatchObject({ organizationId: 'org1', planType: 'gold', accessState: 'pilot' });

        const pilotEnd = db.read('organizations/org1')?.pilotEndsAt as Date;
        expect(auth.claims('newbie')).toEqual({
            onboardingCompleted: true,
            planType: 'gold',
            orgId: 'org1',
            orgRole: 'teacher',
            access: 'pilot',
            accessExp: Math.floor(pilotEnd.getTime() / 1000),
        });
    });

    it('grants active access with no expiry for an active school', async () => {
        seedOrg('paid', { status: 'active', pilotEndsAt: undefined });
        const link = await linkFor('paid');
        const result = await redeemJoinLink({ code: link.code, uid: 'newbie', acceptTerms: true, now: NOW });
        expect(result.state).toBe('active');
        expect(result.expiresAt).toBeNull();
        expect(auth.claims('newbie')).toMatchObject({ access: 'active' });
        expect(auth.claims('newbie')).not.toHaveProperty('accessExp');
    });

    it('is idempotent: a replay consumes no seat and no use', async () => {
        const link = await linkFor('org1');
        await redeemJoinLink({ code: link.code, uid: 'newbie', acceptTerms: true, now: NOW });
        const again = await redeemJoinLink({ code: link.code, uid: 'newbie', acceptTerms: true, now: NOW });
        expect(again.joined).toBe(false);
        expect(db.read('organizations/org1')?.usedSeats).toBe(2);
        expect(db.read(`organizations/org1/joinLinks/${link.id}`)?.uses).toBe(1);
        expect(auth.claims('newbie')).toMatchObject({ orgRole: 'teacher', access: 'pilot' });
    });

    it('a replay does not undo an administrator decision on that member', async () => {
        const link = await linkFor('org1');
        await redeemJoinLink({ code: link.code, uid: 'newbie', acceptTerms: true, now: NOW });
        // An administrator sets the member back to pending by hand.
        db.seed('users/newbie', { ...db.read('users/newbie'), accessState: 'pending', accessExpiresAt: null, accessUpdatedBy: 'sys-admin' });

        const again = await redeemJoinLink({ code: link.code, uid: 'newbie', acceptTerms: true, now: NOW });
        expect(again).toMatchObject({ joined: false, state: 'pending' });
        expect(db.read('users/newbie')?.accessState).toBe('pending');
    });

    it('does not demote a school admin who opens their own link', async () => {
        db.seed('users/admin1', { organizationId: 'org1' });
        const link = await linkFor('org1');
        await redeemJoinLink({ code: link.code, uid: 'admin1', acceptTerms: true, now: NOW });
        expect(auth.claims('admin1')).toMatchObject({ orgRole: 'admin' });
        expect(db.read('organizations/org1')?.usedSeats).toBe(1);
    });

    it('requires accepted terms (400)', async () => {
        const link = await linkFor('org1');
        await expect(redeemJoinLink({ code: link.code, uid: 'newbie', acceptTerms: 'yes', now: NOW }))
            .rejects.toMatchObject({ status: 400 });
    });

    it('404s malformed codes, unknown tokens and revoked links', async () => {
        const link = await linkFor('org1');
        for (const code of [undefined, '', 'org1', 'org1.short', `../x.${'a'.repeat(43)}`, `org1.${'A'.repeat(43)}`]) {
            await expect(redeemJoinLink({ code, uid: 'newbie', acceptTerms: true, now: NOW }))
                .rejects.toMatchObject({ status: 404 });
        }
        const revoked = await linkFor('org1', { revoked: true });
        await expect(redeemJoinLink({ code: revoked.code, uid: 'newbie', acceptTerms: true, now: NOW }))
            .rejects.toMatchObject({ status: 404 });
        // A token is bound to its organisation: it does not work under another org id.
        seedOrg('org2');
        const token = parseJoinCode(link.code)!.token;
        await expect(redeemJoinLink({ code: `org2.${token}`, uid: 'newbie', acceptTerms: true, now: NOW }))
            .rejects.toMatchObject({ status: 404 });
        expect(db.read('organizations/org1')?.usedSeats).toBe(1);
    });

    it('410s an expired link and an expired or lapsed school', async () => {
        const expired = await linkFor('org1', { expiresAt: new Date(NOW.getTime() - 1) });
        await expect(redeemJoinLink({ code: expired.code, uid: 'newbie', acceptTerms: true, now: NOW }))
            .rejects.toMatchObject({ status: 410, code: 'LINK_EXPIRED' });

        const link = await linkFor('org1');
        db.seed('organizations/org1', { ...db.read('organizations/org1'), pilotEndsAt: new Date(NOW.getTime() - DAY) });
        await expect(redeemJoinLink({ code: link.code, uid: 'newbie', acceptTerms: true, now: NOW }))
            .rejects.toMatchObject({ status: 410, code: 'ORG_EXPIRED' });
        db.seed('organizations/org1', { ...db.read('organizations/org1'), status: 'expired' });
        await expect(redeemJoinLink({ code: link.code, uid: 'newbie', acceptTerms: true, now: NOW }))
            .rejects.toMatchObject({ status: 410 });
    });

    it('409s when the link is used up or the school is full', async () => {
        const used = await linkFor('org1', { uses: 4, maxUses: 4 });
        await expect(redeemJoinLink({ code: used.code, uid: 'newbie', acceptTerms: true, now: NOW }))
            .rejects.toMatchObject({ status: 409, code: 'LINK_EXHAUSTED' });

        const link = await linkFor('org1');
        db.seed('organizations/org1', { ...db.read('organizations/org1'), usedSeats: 5 });
        await expect(redeemJoinLink({ code: link.code, uid: 'newbie', acceptTerms: true, now: NOW }))
            .rejects.toMatchObject({ status: 409, code: 'NO_SEATS' });
        expect(db.read('organizations/org1/members/newbie')).toBeUndefined();
    });

    it('409s a member of another school and 403s a blocked account', async () => {
        const link = await linkFor('org1');
        db.seed('users/newbie', { organizationId: 'someOtherOrg' });
        await expect(redeemJoinLink({ code: link.code, uid: 'newbie', acceptTerms: true, now: NOW }))
            .rejects.toMatchObject({ status: 409, code: 'OTHER_ORG' });
        db.seed('users/newbie', { accessState: 'blocked' });
        await expect(redeemJoinLink({ code: link.code, uid: 'newbie', acceptTerms: true, now: NOW }))
            .rejects.toMatchObject({ status: 403 });
        expect(db.read('organizations/org1')?.usedSeats).toBe(1);
    });
});

// ── Pilots ──────────────────────────────────────────────────────────────────

describe('pilot organisations', () => {
    const pilotInput = () =>
        parsePilotOrgInput({
            name: 'St. Example School',
            type: 'school',
            adminEmail: 'Principal@Example.test',
            seats: 40,
            pilotDays: 21,
            verification: { board: 'CBSE', affiliationNumber: '2430001', method: 'affiliation list + landline call' },
        });

    it('requires a verification record', () => {
        expect(() => parsePilotOrgInput({ name: 'X', type: 'school', adminEmail: 'a@b.test', seats: 5, verification: {} }))
            .toThrow(/verification/);
        expect(() => parsePilotOrgInput({ name: 'X', type: 'school', adminEmail: 'a@b.test', seats: 0, verification: { note: 'ok' } }))
            .toThrow(/seats/);
    });

    it('404s when the admin email has never signed in', async () => {
        await expect(provisionPilotOrganization({ ...pilotInput(), adminEmail: 'nobody@example.test', actor: 'sys-admin', now: NOW }))
            .rejects.toMatchObject({ status: 404, code: 'ADMIN_NOT_FOUND' });
    });

    it('409s when the admin already belongs to an organisation', async () => {
        db.seed('users/admin1', { organizationId: 'existing' });
        await expect(provisionPilotOrganization({ ...pilotInput(), actor: 'sys-admin', now: NOW }))
            .rejects.toMatchObject({ status: 409 });
    });

    it('provisions a pilot: org, admin membership, plan, claims and expiring access', async () => {
        const { orgId, pilotEndsAt } = await provisionPilotOrganization({ ...pilotInput(), actor: 'sys-admin', now: NOW });
        expect(pilotEndsAt.getTime()).toBe(NOW.getTime() + 21 * DAY);
        expect(db.read(`organizations/${orgId}`)).toMatchObject({
            status: 'pilot', plan: 'gold', totalSeats: 40, usedSeats: 1, adminUserId: 'admin1',
        });
        expect(db.read(`organizations/${orgId}`)?.verification).toMatchObject({ verifiedBy: 'sys-admin', affiliationNumber: '2430001' });
        expect(db.read(`organizations/${orgId}/members/admin1`)?.role).toBe('admin');
        expect(db.read('users/admin1')).toMatchObject({ organizationId: orgId, planType: 'gold', accessState: 'pilot' });
        expect(auth.claims('admin1')).toEqual({
            planType: 'gold', orgId, orgRole: 'admin', access: 'pilot',
            accessExp: Math.floor(pilotEndsAt.getTime() / 1000),
        });
        // Every state change leaves an audit record.
        expect([...db.store.keys()].some((k) => k.startsWith('access_audit/'))).toBe(true);
    });

    it('expiry returns members to their base state and the free plan, keeping other claims', async () => {
        seedOrg('org1', { pilotEndsAt: new Date(NOW.getTime() + DAY) });
        const link = await linkFor('org1');
        await redeemJoinLink({ code: link.code, uid: 'newbie', acceptTerms: true, now: NOW });
        await redeemJoinLink({ code: link.code, uid: 'veteran', acceptTerms: true, now: NOW });

        const later = new Date(NOW.getTime() + 2 * DAY);
        const run = await expireDuePilotOrganizations(later);
        expect(run).toMatchObject({ organizations: 1, failed: 0 });
        expect(db.read('organizations/org1')?.status).toBe('expired');

        // Signed up after the cutoff -> pending. Predates the cutoff -> legacy.
        expect(auth.claims('newbie')).toMatchObject({ access: 'pending', planType: 'free', orgId: 'org1', onboardingCompleted: true });
        expect(auth.claims('veteran')).toMatchObject({ access: 'legacy', planType: 'free', onboardingCompleted: true });
        expect(auth.claims('newbie')).not.toHaveProperty('accessExp');
        expect(db.read('users/newbie')).toMatchObject({ accessState: 'pending', planType: 'free', accessExpiresAt: null });
        expect(db.read('users/veteran')).toMatchObject({ accessState: 'legacy', planType: 'free' });

        // Idempotent: nothing left to expire.
        expect((await expireDuePilotOrganizations(later)).organizations).toBe(0);
    });

    it('does not expire a pilot that is still running, nor an active school', async () => {
        seedOrg('running', { pilotEndsAt: new Date(NOW.getTime() + 5 * DAY) });
        seedOrg('paid', { status: 'active', pilotEndsAt: new Date(NOW.getTime() - 5 * DAY) });
        expect((await expireDuePilotOrganizations(NOW)).organizations).toBe(0);
    });

    it('expiry leaves a blocked member blocked', async () => {
        seedOrg('org1', { pilotEndsAt: new Date(NOW.getTime() - DAY) });
        db.seed('organizations/org1/members/newbie', { userId: 'newbie', role: 'teacher' });
        db.seed('users/newbie', { organizationId: 'org1', accessState: 'blocked' });
        await expireDuePilotOrganizations(NOW);
        expect(db.read('users/newbie')?.accessState).toBe('blocked');
    });

    it('convert makes every member active with no expiry', async () => {
        seedOrg('org1');
        const link = await linkFor('org1');
        await redeemJoinLink({ code: link.code, uid: 'newbie', acceptTerms: true, now: NOW });
        const result = await applyPilotOrgAction({ orgId: 'org1', action: 'convert', actor: 'sys-admin', now: NOW });
        expect(result.status).toBe('active');
        expect(db.read('organizations/org1')?.status).toBe('active');
        expect(auth.claims('newbie')).toMatchObject({ access: 'active', planType: 'gold', orgRole: 'teacher' });
        expect(auth.claims('newbie')).not.toHaveProperty('accessExp');
        expect(auth.claims('admin1')).toMatchObject({ access: 'active', orgRole: 'admin' });
    });

    it('extend reopens an expired pilot and restores the plan', async () => {
        seedOrg('org1', { pilotEndsAt: new Date(NOW.getTime() - DAY) });
        db.seed('organizations/org1/members/newbie', { userId: 'newbie', role: 'teacher' });
        db.seed('users/newbie', { organizationId: 'org1' });
        await expireDuePilotOrganizations(NOW);
        expect(auth.claims('newbie')).toMatchObject({ access: 'pending', planType: 'free' });

        const result = await applyPilotOrgAction({ orgId: 'org1', action: 'extend', days: 7, actor: 'sys-admin', now: NOW });
        expect(result.pilotEndsAt?.getTime()).toBe(NOW.getTime() + 7 * DAY);
        expect(auth.claims('newbie')).toMatchObject({
            access: 'pilot', planType: 'gold', accessExp: Math.floor((NOW.getTime() + 7 * DAY) / 1000),
        });
    });

    it('extend is refused for an active school', async () => {
        seedOrg('paid', { status: 'active' });
        await expect(applyPilotOrgAction({ orgId: 'paid', action: 'extend', actor: 'sys-admin', now: NOW }))
            .rejects.toMatchObject({ status: 409 });
    });

    it('tidies an individually approved pilot whose expiry has passed', async () => {
        db.seed('users/newbie', { accessState: 'pilot', accessExpiresAt: new Date(NOW.getTime() - DAY) });
        auth.users.get('newbie')!.customClaims = { access: 'pilot', accessExp: 1, onboardingCompleted: true };
        const run = await expireDueUserGrants(NOW);
        expect(run).toMatchObject({ expired: 1, failed: 0 });
        expect(auth.claims('newbie')).toEqual({ access: 'pending', onboardingCompleted: true });
        expect((await expireDueUserGrants(NOW)).expired).toBe(0);
    });
});

// ── Removal ─────────────────────────────────────────────────────────────────

describe('removeTeacher', () => {
    it('removes org claims by merge, frees the seat and returns the base access state', async () => {
        seedOrg('org1');
        const link = await linkFor('org1');
        await redeemJoinLink({ code: link.code, uid: 'veteran', acceptTerms: true, now: NOW });
        expect(auth.claims('veteran')).toMatchObject({ orgId: 'org1', access: 'pilot' });

        await removeTeacher('org1', 'veteran');
        expect(auth.claims('veteran')).toEqual({ onboardingCompleted: true, planType: 'free', access: 'legacy' });
        expect(db.read('organizations/org1/members/veteran')).toBeUndefined();
        expect(db.read('organizations/org1')?.usedSeats).toBe(1);
        expect(db.read('users/veteran')).toMatchObject({ planType: 'free', accessState: 'legacy' });
        expect(db.read('users/veteran')).not.toHaveProperty('organizationId');
    });

    it('leaves a blocked member blocked (a school admin cannot undo an administrator block)', async () => {
        seedOrg('org1');
        const link = await linkFor('org1');
        await redeemJoinLink({ code: link.code, uid: 'veteran', acceptTerms: true, now: NOW });
        db.seed('users/veteran', { ...db.read('users/veteran'), accessState: 'blocked', accessUpdatedBy: 'sys-admin' });

        await removeTeacher('org1', 'veteran');
        expect(db.read('users/veteran')?.accessState).toBe('blocked');
        expect(auth.claims('veteran')).toMatchObject({ planType: 'free' });
        expect(auth.claims('veteran')?.access).not.toBe('legacy');
    });

    it('does not touch a user who is not a member of that organisation', async () => {
        seedOrg('org1');
        auth.users.get('newbie')!.customClaims = { access: 'active', planType: 'pro' };
        await removeTeacher('org1', 'newbie');
        expect(auth.claims('newbie')).toEqual({ access: 'active', planType: 'pro' });
        expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
    });
});

// ── Quotes ──────────────────────────────────────────────────────────────────

describe('quote requests', () => {
    const validQuote = {
        schoolName: 'St. Example School',
        contactName: 'A. Principal',
        role: 'Principal',
        email: 'Principal@Example.test',
        phone: '0353 2512345',
        city: 'Siliguri',
        state: 'West Bengal',
        estimate: {
            teachers: 60, billing: 'annual', includeParentCalls: true,
            students: 1200, callsPerStudentPerYear: 6, avgMinutesPerCall: 3, totalPerYearInclGst: 1,
        },
    };

    it('rejects more teachers than students (the 608 / 400 request)', () => {
        expect(() => parseQuoteInput({ ...validQuote, estimate: { ...validQuote.estimate, includeParentCalls: true, teachers: 608, students: 400 } }))
            .toThrow(/students cannot be lower/);
        // With calls unticked the calculator's default student count is noise.
        expect(() => parseQuoteInput({
            ...validQuote,
            estimate: { ...validQuote.estimate, includeParentCalls: false, teachers: 608, students: 400 },
        })).not.toThrow();
    });

    it('rejects parent calls with no students, and malformed contact details', () => {
        expect(() => parseQuoteInput({ ...validQuote, estimate: { ...validQuote.estimate, students: 0 } })).toThrow(/Parent calls/);
        expect(() => parseQuoteInput({ ...validQuote, email: 'not-an-email' })).toThrow(/email/);
        expect(() => parseQuoteInput({ ...validQuote, schoolName: '   ' })).toThrow(/schoolName/);
    });

    it('recomputes the total server-side and never stores the raw IP', async () => {
        const input = parseQuoteInput(validQuote);
        expect(input.email).toBe('principal@example.test');
        const gate = await reserveQuoteSlot(db as never, '203.0.113.7', NOW);
        expect(gate.ok).toBe(true);
        const id = await createQuoteRequest(db as never, input, gate.ipHash, NOW);
        const stored = db.read(`quote_requests/${id}`);
        // 60 teachers x 10,000 + 1200 x 6 x 3 min x Rs 4 = 6,86,400; +18% GST.
        expect(stored?.estimate.totalPerYearInclGst).toBeCloseTo(686400 * 1.18, 2);
        expect(stored?.status).toBe('new');
        expect(JSON.stringify([...db.store.entries()])).not.toContain('203.0.113.7');
    });

    it('enforces the per-IP daily limit', async () => {
        process.env.QUOTE_IP_DAILY_LIMIT = '2';
        try {
            expect((await reserveQuoteSlot(db as never, '203.0.113.7', NOW)).ok).toBe(true);
            expect((await reserveQuoteSlot(db as never, '203.0.113.7', NOW)).ok).toBe(true);
            const third = await reserveQuoteSlot(db as never, '203.0.113.7', NOW);
            expect(third).toMatchObject({ ok: false, reason: 'ip_limit' });
            // A different address is unaffected.
            expect((await reserveQuoteSlot(db as never, '198.51.100.9', NOW)).ok).toBe(true);
        } finally {
            delete process.env.QUOTE_IP_DAILY_LIMIT;
        }
    });

    it('enforces the global daily cap', async () => {
        process.env.QUOTE_DAILY_CAP = '1';
        try {
            expect((await reserveQuoteSlot(db as never, '203.0.113.1', NOW)).ok).toBe(true);
            expect(await reserveQuoteSlot(db as never, '203.0.113.2', NOW)).toMatchObject({ ok: false, reason: 'daily_cap' });
        } finally {
            delete process.env.QUOTE_DAILY_CAP;
        }
    });
});

// ── Anomaly assessment ──────────────────────────────────────────────────────

describe('anomaly assessment', () => {
    const [today] = windowDayKeys(NOW);
    const month = today.slice(0, 7);
    const features = [
        'lesson-plan', 'quiz', 'worksheet', 'rubric', 'teacher-training',
        'virtual-field-trip', 'visual-aid', 'exam-paper', 'assess-assignment',
    ];

    it('does not flag ordinary use', () => {
        const counters = { [`lesson-plan_daily_${today}`]: 3, [`quiz_daily_${today}`]: 1, [`lesson-plan_${month}`]: 3 };
        expect(assessUsage(counters, 'free', NOW).reasons).toEqual([]);
    });

    it('flags a sweep across most of the product', () => {
        const counters: Record<string, number> = {};
        for (const f of features.slice(0, ANOMALY_BREADTH_THRESHOLD)) counters[`${f}_daily_${today}`] = 1;
        const result = assessUsage(counters, 'free', NOW);
        expect(result.reasons).toEqual(['broad_feature_sweep']);
        expect(result.featuresTouched).toHaveLength(ANOMALY_BREADTH_THRESHOLD);
    });

    it('ignores activity outside the window', () => {
        const counters: Record<string, number> = {};
        for (const f of features) counters[`${f}_daily_2026-11-01`] = 5;
        expect(assessUsage(counters, 'free', NOW).reasons).toEqual([]);
    });

    it('flags several tools run to the plan limit, judged against the right plan', () => {
        const counters = { [`lesson-plan_${month}`]: 10, [`quiz_${month}`]: 5, [`exam-paper_${month}`]: 3 };
        expect(assessUsage(counters, 'free', NOW).reasons).toEqual(['volume_limits_hit']);
        // The same volume is well inside a school plan's limits.
        expect(assessUsage(counters, 'gold', NOW).reasons).toEqual([]);
    });
});
