/**
 * FirestoreSamparkRulesRepo — production adapter for SamparkRulesRepo.
 *
 *   sampark_schools/{orgId}
 *     sampark_roles/{uid__role}            RoleAssignment
 *     sampark_adoptions/{ruleId__vN}       Adoption        (create-only: append-only history)
 *     sampark_proposals/{proposalId}       Proposal        (create-only via createProposalIfAbsent)
 *     sampark_confirmations/{id}           ClassConfirmation (create-only)
 *     sampark_pages/{id}                   Page            (create-only)
 *
 * Reads list a whole small collection and filter in memory: volumes are tens to
 * low thousands per school, and it keeps every query single-field so no new
 * composite index is needed (Gate 12). Admin SDK only; firestore.rules is
 * default-deny for every `sampark_*` path.
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import type { SamparkRulesRepo } from './ports';
import type { Adoption, ClassConfirmation, Page, Proposal, RoleAssignment, RuleId } from './types';

const ALREADY_EXISTS = 6;

function clean<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function isAlreadyExists(err: unknown): boolean {
    const e = err as { code?: unknown; message?: unknown };
    return e?.code === ALREADY_EXISTS || e?.code === 'already-exists' || /ALREADY_EXISTS/i.test(String(e?.message ?? ''));
}

export class FirestoreSamparkRulesRepo implements SamparkRulesRepo {
    constructor(private readonly db: Firestore) {}

    private schoolRef(orgId: string): DocumentReference {
        return this.db.collection('sampark_schools').doc(orgId);
    }

    private async createOnly(ref: DocumentReference, value: object): Promise<boolean> {
        try {
            await ref.create(clean(value));
            return true;
        } catch (err) {
            if (isAlreadyExists(err)) return false;
            throw err;
        }
    }

    // Roles
    async listRoleAssignments(orgId: string): Promise<RoleAssignment[]> {
        const snap = await this.schoolRef(orgId).collection('sampark_roles').get();
        return snap.docs.map((d) => d.data() as RoleAssignment).sort((a, b) => `${a.role}|${a.uid}`.localeCompare(`${b.role}|${b.uid}`));
    }
    async upsertRoleAssignment(a: RoleAssignment): Promise<void> {
        await this.schoolRef(a.orgId).collection('sampark_roles').doc(`${a.uid}__${a.role}`).set(clean(a));
    }
    async removeRoleAssignment(orgId: string, uid: string, role: string): Promise<void> {
        await this.schoolRef(orgId).collection('sampark_roles').doc(`${uid}__${role}`).delete();
    }

    // Adoptions
    async appendAdoption(a: Adoption): Promise<void> {
        const ok = await this.createOnly(this.schoolRef(a.orgId).collection('sampark_adoptions').doc(`${a.ruleId}__v${a.version}`), a);
        if (!ok) throw new Error(`Adoption ${a.ruleId} v${a.version} already exists (adoptions are append-only)`);
    }
    async listAdoptionHistory(orgId: string): Promise<Adoption[]> {
        const snap = await this.schoolRef(orgId).collection('sampark_adoptions').get();
        return snap.docs.map((d) => d.data() as Adoption).sort((a, b) => a.adoptedAt.localeCompare(b.adoptedAt) || a.version - b.version);
    }
    async listCurrentAdoptions(orgId: string): Promise<Adoption[]> {
        const latest = new Map<RuleId, Adoption>();
        for (const a of await this.listAdoptionHistory(orgId)) {
            const cur = latest.get(a.ruleId);
            if (!cur || a.version > cur.version) latest.set(a.ruleId, a);
        }
        return [...latest.values()];
    }
    async getCurrentAdoption(orgId: string, ruleId: RuleId): Promise<Adoption | null> {
        return (await this.listCurrentAdoptions(orgId)).find((a) => a.ruleId === ruleId) ?? null;
    }

    // Proposals
    async createProposalIfAbsent(p: Proposal): Promise<boolean> {
        return this.createOnly(this.schoolRef(p.orgId).collection('sampark_proposals').doc(p.id), p);
    }
    async getProposal(orgId: string, id: string): Promise<Proposal | null> {
        const snap = await this.schoolRef(orgId).collection('sampark_proposals').doc(id).get();
        return snap.exists ? (snap.data() as Proposal) : null;
    }
    async updateProposal(orgId: string, id: string, patch: Partial<Proposal>): Promise<void> {
        const { id: _id, orgId: _org, dedupeKey: _dk, ...rest } = patch;
        void _id; void _org; void _dk;
        await this.schoolRef(orgId).collection('sampark_proposals').doc(id).update(clean(rest));
    }
    async listProposals(orgId: string, filter?: { status?: Proposal['status'] }): Promise<Proposal[]> {
        const snap = await this.schoolRef(orgId).collection('sampark_proposals').get();
        return snap.docs
            .map((d) => d.data() as Proposal)
            .filter((p) => !filter?.status || p.status === filter.status)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    }
    async listProposalsForStudent(orgId: string, studentId: string): Promise<Proposal[]> {
        return (await this.listProposals(orgId)).filter((p) => p.studentId === studentId);
    }

    // Confirmations and pages
    async createClassConfirmationIfAbsent(c: ClassConfirmation): Promise<boolean> {
        return this.createOnly(this.schoolRef(c.orgId).collection('sampark_confirmations').doc(c.id), c);
    }
    async listClassConfirmations(orgId: string, date: string): Promise<ClassConfirmation[]> {
        const snap = await this.schoolRef(orgId).collection('sampark_confirmations').get();
        return snap.docs.map((d) => d.data() as ClassConfirmation).filter((c) => c.date === date);
    }
    async createPageIfAbsent(p: Page): Promise<boolean> {
        return this.createOnly(this.schoolRef(p.orgId).collection('sampark_pages').doc(p.id), p);
    }
    async getPage(orgId: string, id: string): Promise<Page | null> {
        const snap = await this.schoolRef(orgId).collection('sampark_pages').doc(id).get();
        return snap.exists ? (snap.data() as Page) : null;
    }
    async updatePage(orgId: string, id: string, patch: Partial<Page>): Promise<void> {
        const { id: _id, orgId: _org, ...rest } = patch;
        void _id; void _org;
        await this.schoolRef(orgId).collection('sampark_pages').doc(id).update(clean(rest));
    }
    async listPages(orgId: string, filter?: { status?: Page['status'] }): Promise<Page[]> {
        const snap = await this.schoolRef(orgId).collection('sampark_pages').get();
        return snap.docs
            .map((d) => d.data() as Page)
            .filter((p) => !filter?.status || p.status === filter.status)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
}
