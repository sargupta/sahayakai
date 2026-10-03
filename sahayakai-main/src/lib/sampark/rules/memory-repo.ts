/**
 * In-memory SamparkRulesRepo: the test double and a zero-infrastructure backend.
 * Values are deep-copied in and out, and every "IfAbsent" write is create-only.
 */

import type { SamparkRulesRepo } from './ports';
import type { Adoption, ClassConfirmation, Page, Proposal, RoleAssignment, RuleId } from './types';

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export function createMemoryRulesRepo(): SamparkRulesRepo {
    const roles = new Map<string, RoleAssignment>();
    const adoptions: Adoption[] = [];
    const proposals = new Map<string, Proposal>();
    const confirmations = new Map<string, ClassConfirmation>();
    const pages = new Map<string, Page>();
    const key = (orgId: string, id: string) => `${orgId}|${id}`;

    return {
        async listRoleAssignments(orgId) {
            return [...roles.values()].filter((r) => r.orgId === orgId).map(clone).sort((a, b) => `${a.role}|${a.uid}`.localeCompare(`${b.role}|${b.uid}`));
        },
        async upsertRoleAssignment(a) {
            roles.set(`${a.orgId}|${a.uid}|${a.role}`, clone(a));
        },
        async removeRoleAssignment(orgId, uid, role) {
            roles.delete(`${orgId}|${uid}|${role}`);
        },

        async appendAdoption(a) {
            if (adoptions.some((x) => x.orgId === a.orgId && x.ruleId === a.ruleId && x.version === a.version)) {
                throw new Error(`Adoption ${a.ruleId} v${a.version} already exists (adoptions are append-only)`);
            }
            adoptions.push(clone(a));
        },
        async listAdoptionHistory(orgId) {
            return adoptions.filter((a) => a.orgId === orgId).map(clone);
        },
        async listCurrentAdoptions(orgId) {
            const latest = new Map<RuleId, Adoption>();
            for (const a of adoptions) {
                if (a.orgId !== orgId) continue;
                const cur = latest.get(a.ruleId);
                if (!cur || a.version > cur.version) latest.set(a.ruleId, a);
            }
            return [...latest.values()].map(clone);
        },
        async getCurrentAdoption(orgId, ruleId) {
            let best: Adoption | null = null;
            for (const a of adoptions) if (a.orgId === orgId && a.ruleId === ruleId && (!best || a.version > best.version)) best = a;
            return best ? clone(best) : null;
        },

        async createProposalIfAbsent(p) {
            const k = key(p.orgId, p.id);
            if (proposals.has(k)) return false;
            proposals.set(k, clone(p));
            return true;
        },
        async getProposal(orgId, id) {
            const p = proposals.get(key(orgId, id));
            return p ? clone(p) : null;
        },
        async updateProposal(orgId, id, patch) {
            const k = key(orgId, id);
            const cur = proposals.get(k);
            if (!cur) throw new Error(`No proposal ${id}`);
            proposals.set(k, clone({ ...cur, ...patch, id: cur.id, orgId: cur.orgId, dedupeKey: cur.dedupeKey }));
        },
        async listProposals(orgId, filter) {
            return [...proposals.values()]
                .filter((p) => p.orgId === orgId && (!filter?.status || p.status === filter.status))
                .map(clone)
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
        },
        async listProposalsForStudent(orgId, studentId) {
            return [...proposals.values()].filter((p) => p.orgId === orgId && p.studentId === studentId).map(clone);
        },

        async createClassConfirmationIfAbsent(c) {
            const k = key(c.orgId, c.id);
            if (confirmations.has(k)) return false;
            confirmations.set(k, clone(c));
            return true;
        },
        async listClassConfirmations(orgId, date) {
            return [...confirmations.values()].filter((c) => c.orgId === orgId && c.date === date).map(clone);
        },
        async createPageIfAbsent(p) {
            const k = key(p.orgId, p.id);
            if (pages.has(k)) return false;
            pages.set(k, clone(p));
            return true;
        },
        async getPage(orgId, id) {
            const p = pages.get(key(orgId, id));
            return p ? clone(p) : null;
        },
        async updatePage(orgId, id, patch) {
            const k = key(orgId, id);
            const cur = pages.get(k);
            if (!cur) throw new Error(`No page ${id}`);
            pages.set(k, clone({ ...cur, ...patch, id: cur.id, orgId: cur.orgId }));
        },
        async listPages(orgId, filter) {
            return [...pages.values()]
                .filter((p) => p.orgId === orgId && (!filter?.status || p.status === filter.status))
                .map(clone)
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        },
    };
}
