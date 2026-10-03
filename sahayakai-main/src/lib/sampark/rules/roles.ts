/**
 * Roles and approval routing (plan §4⑤, §8). Pure.
 *
 * Approvals go to the person who owns the relationship, not to the principal
 * for everything (plan §4⑤): class teachers approve A1, A2, A3, A5 for their own
 * section; the coordinator approves A4; accounts owns the C family; the
 * transport desk owns D5–D6. The catalogue's `approver` column is the single
 * source for WHICH role; this module decides WHO holds it for a given child.
 *
 * The principal (and the organisation admin, who stands in for the principal)
 * keeps "the power to override" (plan §4⑤): they may approve any dialable
 * purpose, and the audit records that it was an override. Nobody else may
 * approve outside their role — a class teacher cannot approve for another
 * section, a coordinator cannot approve a fee call.
 *
 * Fail-safe routing: if nobody holds the required role for the child's
 * section, the proposal is routed to the principal with a plain note, rather
 * than sitting unseen in an empty queue.
 */

import { isDialable, purposeSpec } from '@/lib/sampark/catalogue';
import type { Approver, PurposeId, SamparkRole } from '@/types/sampark';

import type { RoleAssignment, SectionRef } from './types';

export const ASSIGNABLE_ROLES: readonly SamparkRole[] = [
    'principal',
    'coordinator',
    'class_teacher',
    'accounts',
    'transport',
    'office',
    'counsellor',
];

function sameSection(a: SectionRef, b: SectionRef): boolean {
    return a.grade === b.grade && String(a.section).trim().toUpperCase() === String(b.section).trim().toUpperCase();
}

/** A role assignment is valid only if class teachers name at least one section and nobody else names any. */
export function validateRoleAssignment(a: Pick<RoleAssignment, 'role' | 'sections' | 'uid'>): string | null {
    if (!a.uid) return 'A person is required.';
    if (!ASSIGNABLE_ROLES.includes(a.role)) return `Unknown role "${String(a.role)}".`;
    if (a.role === 'class_teacher' && a.sections.length === 0) return 'A class teacher must be assigned at least one section.';
    if (a.role !== 'class_teacher' && a.sections.length > 0) return 'Only class teachers are assigned to sections.';
    for (const s of a.sections) {
        if (!Number.isInteger(s.grade) || s.grade < 1 || s.grade > 12) return `Grade ${String(s.grade)} is not between 1 and 12.`;
        if (!/^[A-Za-z]$/.test(String(s.section))) return `Section "${String(s.section)}" must be one letter.`;
    }
    return null;
}

export interface ApproverResolution {
    /** The catalogue's approver for the purpose. */
    approver: Approver;
    /** The people who hold that role for this child (class teachers: this section only). */
    assignees: RoleAssignment[];
    /** Set when nobody holds the role and the proposal is routed to the principal instead. */
    fallback: 'principal' | null;
    /** Plain English for the approver queue; null when routing is ordinary. */
    note: string | null;
}

function sectionLabel(s: SectionRef | null): string {
    return s ? `${s.grade}${String(s.section).toUpperCase()}` : 'this class';
}

export function approverRoleFor(purpose: PurposeId): Approver {
    return purposeSpec(purpose).approver;
}

/** Who may approve this purpose for a child in `section`, from the school's role assignments. */
export function resolveApprovers(purpose: PurposeId, section: SectionRef | null, assignments: readonly RoleAssignment[]): ApproverResolution {
    const approver = approverRoleFor(purpose);
    if (approver === 'none' || approver === 'auto') {
        return { approver, assignees: [], fallback: null, note: null };
    }
    let assignees = assignments.filter((a) => a.role === approver);
    if (approver === 'class_teacher') {
        assignees = section ? assignees.filter((a) => a.sections.some((s) => sameSection(s, section))) : [];
    }
    if (assignees.length > 0 || approver === 'principal') {
        return { approver, assignees, fallback: null, note: null };
    }
    const roleName = approver.replace('_', ' ');
    const where = approver === 'class_teacher' ? ` for ${sectionLabel(section)}` : '';
    return {
        approver,
        assignees: [],
        fallback: 'principal',
        note: `No ${roleName} is assigned${where}; this is routed to the principal.`,
    };
}

export interface ApprovalActor {
    uid: string;
    /** organizations/{orgId}.adminUserId or an admin member: stands in for the principal in slice 1/2. */
    isOrgAdmin: boolean;
}

export type ApprovalVia = 'assigned' | 'principal' | 'principal_override' | 'org_admin_override';

export interface ApprovalDecision {
    allowed: boolean;
    via: ApprovalVia | null;
    /** Plain reason when not allowed. */
    reason: string | null;
}

/**
 * May this person approve this purpose for this child?
 * human-only purposes ('none') can never be approved into calls; 'auto' purposes
 * need no person but may be approved by the principal.
 */
export function canApprove(actor: ApprovalActor, purpose: PurposeId, section: SectionRef | null, assignments: readonly RoleAssignment[]): ApprovalDecision {
    const spec = purposeSpec(purpose);
    if (!isDialable(purpose) || spec.approver === 'none') {
        return { allowed: false, via: null, reason: 'This is handled by a person; it cannot be approved into a call.' };
    }
    const mine = assignments.filter((a) => a.uid === actor.uid);
    const holdsPrincipal = mine.some((a) => a.role === 'principal');

    const resolution = resolveApprovers(purpose, section, assignments);
    if (resolution.assignees.some((a) => a.uid === actor.uid)) {
        return { allowed: true, via: spec.approver === 'principal' ? 'principal' : 'assigned', reason: null };
    }
    if (holdsPrincipal) return { allowed: true, via: 'principal_override', reason: null };
    if (actor.isOrgAdmin) return { allowed: true, via: 'org_admin_override', reason: null };
    return {
        allowed: false,
        via: null,
        reason: `Only the ${String(spec.approver).replace('_', ' ')}${spec.approver === 'class_teacher' ? ` of ${sectionLabel(section)}` : ''} or the principal can approve this.`,
    };
}

/** Narrow a queue to what this person may act on (their own work; plan §8 "shows each person only their own work"). */
export function approvalQueueFilter(
    actor: ApprovalActor,
    assignments: readonly RoleAssignment[],
): (item: { purpose: PurposeId; section: SectionRef | null }) => boolean {
    return (item) => canApprove(actor, item.purpose, item.section, assignments).allowed;
}
