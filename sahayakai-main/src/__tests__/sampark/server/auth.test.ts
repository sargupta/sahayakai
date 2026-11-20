/** @jest-environment node */
/**
 * The one org-admin rule (plan §9): adminUserId, or members/{uid}.role ===
 * 'admin', on server-managed data only. The user-editable profile fields
 * (`administrativeRole`, `organizationId`) never grant anything — at most the
 * profile nominates an org that is then re-verified.
 */

import { ADMIN, fakeOrgDb, ORG } from './_helpers';

const mockDb = fakeOrgDb(
    {
        [ORG]: {
            name: 'Hillview Demo School',
            adminUserId: ADMIN,
            isDemoData: true,
            members: {
                'member-admin': { userId: 'member-admin', role: 'admin' },
                teacher: { userId: 'teacher', role: 'teacher' },
            },
        },
        'second-school': { name: 'Second School', adminUserId: ADMIN },
    },
    {
        [ADMIN]: { organizationId: ORG },
        'member-admin': { organizationId: ORG },
        // Self-asserted principal of a school they have no membership in.
        impostor: { organizationId: ORG, administrativeRole: 'principal' },
        teacher: { organizationId: ORG },
    },
);
jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => mockDb }));

import { getOrganizationFacts, listAdministeredOrgs, requireOrgAdmin } from '@/server/sampark/auth';

describe('requireOrgAdmin', () => {
    it('accepts the org adminUserId and a members/{uid} admin', async () => {
        await expect(requireOrgAdmin(ORG, ADMIN)).resolves.toBe(true);
        await expect(requireOrgAdmin(ORG, 'member-admin')).resolves.toBe(true);
    });

    it('refuses teachers, strangers, self-asserted principals, unknown orgs and empty ids', async () => {
        await expect(requireOrgAdmin(ORG, 'teacher')).resolves.toBe(false);
        await expect(requireOrgAdmin(ORG, 'impostor')).resolves.toBe(false);
        await expect(requireOrgAdmin('no-such-org', ADMIN)).resolves.toBe(false);
        await expect(requireOrgAdmin('', ADMIN)).resolves.toBe(false);
        await expect(requireOrgAdmin(ORG, '')).resolves.toBe(false);
    });
});

describe('listAdministeredOrgs', () => {
    it('lists every org where the user is adminUserId', async () => {
        const orgs = await listAdministeredOrgs(ADMIN);
        expect(orgs.map((o) => o.orgId).sort()).toEqual([ORG, 'second-school']);
    });

    it('adds the profile org only when the members doc confirms admin', async () => {
        await expect(listAdministeredOrgs('member-admin')).resolves.toEqual([{ orgId: ORG, name: 'Hillview Demo School' }]);
        await expect(listAdministeredOrgs('impostor')).resolves.toEqual([]);
        await expect(listAdministeredOrgs('teacher')).resolves.toEqual([]);
        await expect(listAdministeredOrgs('')).resolves.toEqual([]);
    });
});

describe('getOrganizationFacts', () => {
    it('reads the name and the demo flag', async () => {
        await expect(getOrganizationFacts(ORG)).resolves.toEqual({ name: 'Hillview Demo School', isDemo: true });
        await expect(getOrganizationFacts('second-school')).resolves.toEqual({ name: 'Second School', isDemo: false });
        await expect(getOrganizationFacts('nope')).resolves.toBeNull();
    });
});
