/**
 * The slice-2 repository port: roles, adoptions, proposals, class confirmations
 * and pages. Separate from SamparkRepo so slice 1's port and its adapters are
 * untouched; implemented in memory (tests, demos) and in Firestore.
 *
 * Immutability rules the adapters must keep:
 *   - an Adoption is append-only (a new version, never an overwrite);
 *   - createProposalIfAbsent is CREATE-ONLY, so a dismissed proposal can never
 *     be resurrected by a rule firing again (class gate 13's rule, applied to
 *     proposals);
 *   - createClassConfirmationIfAbsent and createPageIfAbsent are create-only
 *     for the same reason (one confirmation per class-day, one page per call).
 */

import type { Adoption, ClassConfirmation, Page, Proposal, RoleAssignment, RuleId } from './types';

export interface SamparkRulesRepo {
    // Roles
    listRoleAssignments(orgId: string): Promise<RoleAssignment[]>;
    /** Replaces the (uid, role) assignment. */
    upsertRoleAssignment(a: RoleAssignment): Promise<void>;
    removeRoleAssignment(orgId: string, uid: string, role: string): Promise<void>;

    // Adoptions (append-only)
    appendAdoption(a: Adoption): Promise<void>;
    /** Every record, oldest first (the audit trail). */
    listAdoptionHistory(orgId: string): Promise<Adoption[]>;
    /** The latest record per rule (which may be 'withdrawn'). */
    listCurrentAdoptions(orgId: string): Promise<Adoption[]>;
    getCurrentAdoption(orgId: string, ruleId: RuleId): Promise<Adoption | null>;

    // Proposals
    createProposalIfAbsent(p: Proposal): Promise<boolean>;
    getProposal(orgId: string, id: string): Promise<Proposal | null>;
    updateProposal(orgId: string, id: string, patch: Partial<Proposal>): Promise<void>;
    listProposals(orgId: string, filter?: { status?: Proposal['status'] }): Promise<Proposal[]>;
    listProposalsForStudent(orgId: string, studentId: string): Promise<Proposal[]>;

    // A2 class confirmations and pages
    createClassConfirmationIfAbsent(c: ClassConfirmation): Promise<boolean>;
    listClassConfirmations(orgId: string, date: string): Promise<ClassConfirmation[]>;
    createPageIfAbsent(p: Page): Promise<boolean>;
    getPage(orgId: string, id: string): Promise<Page | null>;
    updatePage(orgId: string, id: string, patch: Partial<Page>): Promise<void>;
    listPages(orgId: string, filter?: { status?: Page['status'] }): Promise<Page[]>;
}
