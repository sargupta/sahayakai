/**
 * @jest-environment node
 *
 * Roles and approval routing (plan §4⑤, §8): the catalogue's approver column
 * decides the role; assignments decide the person; the principal overrides.
 */
import { PURPOSE_CATALOGUE, ruleDrivenPurposes } from '@/lib/sampark/catalogue';
import { createMemoryRulesRepo } from '@/lib/sampark/rules/memory-repo';
import { canApprove, resolveApprovers, validateRoleAssignment, approvalQueueFilter } from '@/lib/sampark/rules/roles';
import type { RoleAssignment } from '@/lib/sampark/rules/types';
import type { PurposeId, SamparkRole } from '@/types/sampark';

const ORG = 'hillview-demo';
function role(uid: string, r: SamparkRole, sections: { grade: number; section: string }[] = []): RoleAssignment {
    return { orgId: ORG, uid, role: r, sections, displayName: uid, grantedBy: 'admin', grantedAt: '2026-10-01T00:00:00.000Z' };
}
const ASSIGNMENTS: RoleAssignment[] = [
    role('t7b', 'class_teacher', [{ grade: 7, section: 'B' }]),
    role('t4a', 'class_teacher', [{ grade: 4, section: 'A' }]),
    role('coord', 'coordinator'),
    role('acct', 'accounts'),
    role('prin', 'principal'),
];
const S7B = { grade: 7, section: 'B' };

describe('approver resolution follows the catalogue approver column', () => {
    it('A1, A2, A3, A5 route to the class teacher of the child\'s own section', () => {
        for (const p of ['attendance_talk', 'absence_today', 'academic_talk', 'recognition'] as PurposeId[]) {
            const r = resolveApprovers(p, S7B, ASSIGNMENTS);
            expect(r.approver).toBe('class_teacher');
            expect(r.assignees.map((a) => a.uid)).toEqual(['t7b']);
            expect(r.fallback).toBeNull();
        }
    });
    it('A4 goes to the coordinator, C1/C2 to accounts', () => {
        expect(resolveApprovers('conduct_talk', S7B, ASSIGNMENTS).assignees.map((a) => a.uid)).toEqual(['coord']);
        expect(resolveApprovers('fee_due', S7B, ASSIGNMENTS).assignees.map((a) => a.uid)).toEqual(['acct']);
        expect(resolveApprovers('fee_overdue', S7B, ASSIGNMENTS).assignees.map((a) => a.uid)).toEqual(['acct']);
    });
    it('a section with no class teacher falls back to the principal with a plain note', () => {
        const r = resolveApprovers('attendance_talk', { grade: 9, section: 'A' }, ASSIGNMENTS);
        expect(r.assignees).toEqual([]);
        expect(r.fallback).toBe('principal');
        expect(r.note).toBe('No class teacher is assigned for 9A; this is routed to the principal.');
    });
    it('section letters compare case-insensitively', () => {
        expect(resolveApprovers('attendance_talk', { grade: 7, section: 'b' }, ASSIGNMENTS).assignees).toHaveLength(1);
    });
});

describe('who may approve', () => {
    it('the assigned class teacher approves their own section only', () => {
        expect(canApprove({ uid: 't7b', isOrgAdmin: false }, 'academic_talk', S7B, ASSIGNMENTS)).toMatchObject({ allowed: true, via: 'assigned' });
        const other = canApprove({ uid: 't4a', isOrgAdmin: false }, 'academic_talk', S7B, ASSIGNMENTS);
        expect(other.allowed).toBe(false);
        expect(other.reason).toMatch(/class teacher of 7B or the principal/);
    });
    it('a coordinator cannot approve a fee call; accounts cannot approve a conduct request', () => {
        expect(canApprove({ uid: 'coord', isOrgAdmin: false }, 'fee_due', S7B, ASSIGNMENTS).allowed).toBe(false);
        expect(canApprove({ uid: 'acct', isOrgAdmin: false }, 'conduct_talk', S7B, ASSIGNMENTS).allowed).toBe(false);
        expect(canApprove({ uid: 'coord', isOrgAdmin: false }, 'conduct_talk', S7B, ASSIGNMENTS).allowed).toBe(true);
    });
    it('the principal and the org admin can override, and the way is recorded', () => {
        expect(canApprove({ uid: 'prin', isOrgAdmin: false }, 'conduct_talk', S7B, ASSIGNMENTS)).toMatchObject({ allowed: true, via: 'principal_override' });
        expect(canApprove({ uid: 'someone', isOrgAdmin: true }, 'fee_due', S7B, ASSIGNMENTS)).toMatchObject({ allowed: true, via: 'org_admin_override' });
    });
    it('a person with no role cannot approve anything', () => {
        for (const spec of ruleDrivenPurposes()) {
            expect(canApprove({ uid: 'nobody', isOrgAdmin: false }, spec.id, S7B, ASSIGNMENTS).allowed).toBe(false);
        }
    });
    it('a human-only purpose can never be approved into a call, even by the principal', () => {
        for (const spec of Object.values(PURPOSE_CATALOGUE).filter((s) => s.mode === 'human_only')) {
            expect(canApprove({ uid: 'prin', isOrgAdmin: true }, spec.id, S7B, ASSIGNMENTS).allowed).toBe(false);
        }
    });
    it('the queue filter shows each person only their own work', () => {
        const items = [
            { purpose: 'academic_talk' as PurposeId, section: S7B },
            { purpose: 'academic_talk' as PurposeId, section: { grade: 4, section: 'A' } },
            { purpose: 'fee_due' as PurposeId, section: S7B },
        ];
        expect(items.filter(approvalQueueFilter({ uid: 't7b', isOrgAdmin: false }, ASSIGNMENTS))).toHaveLength(1);
        expect(items.filter(approvalQueueFilter({ uid: 'acct', isOrgAdmin: false }, ASSIGNMENTS))).toHaveLength(1);
        expect(items.filter(approvalQueueFilter({ uid: 'prin', isOrgAdmin: false }, ASSIGNMENTS))).toHaveLength(3);
    });
});

describe('role assignment validation', () => {
    it('class teachers need sections; others must not have any', () => {
        expect(validateRoleAssignment({ uid: 'u', role: 'class_teacher', sections: [] })).toMatch(/at least one section/);
        expect(validateRoleAssignment({ uid: 'u', role: 'coordinator', sections: [{ grade: 7, section: 'B' }] })).toMatch(/Only class teachers/);
        expect(validateRoleAssignment({ uid: 'u', role: 'class_teacher', sections: [{ grade: 13, section: 'B' }] })).toMatch(/Grade 13/);
        expect(validateRoleAssignment({ uid: 'u', role: 'class_teacher', sections: [{ grade: 7, section: 'B' }] })).toBeNull();
        expect(validateRoleAssignment({ uid: 'u', role: 'accounts', sections: [] })).toBeNull();
    });
});

describe('roles repository', () => {
    it('stores, replaces and removes assignments per school', async () => {
        const repo = createMemoryRulesRepo();
        await repo.upsertRoleAssignment(role('t7b', 'class_teacher', [{ grade: 7, section: 'B' }]));
        await repo.upsertRoleAssignment(role('t7b', 'class_teacher', [{ grade: 7, section: 'A' }]));
        await repo.upsertRoleAssignment({ ...role('x', 'accounts'), orgId: 'other-school' });
        const list = await repo.listRoleAssignments(ORG);
        expect(list).toHaveLength(1);
        expect(list[0].sections).toEqual([{ grade: 7, section: 'A' }]);
        await repo.removeRoleAssignment(ORG, 't7b', 'class_teacher');
        expect(await repo.listRoleAssignments(ORG)).toEqual([]);
        expect(await repo.listRoleAssignments('other-school')).toHaveLength(1);
    });
});
