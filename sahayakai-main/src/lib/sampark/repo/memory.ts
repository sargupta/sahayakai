/**
 * In-memory SamparkRepo — the engine's test double and a zero-infrastructure
 * backend for local demos. It implements the port's semantics exactly, most
 * importantly the two that class gates rest on:
 *
 *   - createIntentIfAbsent is CREATE-ONLY: an existing intent is never
 *     overwritten, so a rejected or blocked intent cannot be resurrected (gate 13);
 *   - claimIntentForDial is the at-most-once primitive (gate 3): one atomic step
 *     that re-reads the intent, refuses unless it is 'approved' / 'retry_wait'
 *     and due, refuses if the call record already exists, and otherwise writes
 *     the call ('dialing', with its lease) and moves the intent to 'dialing'.
 *     JavaScript runs each claim to completion without yielding, which is the
 *     in-memory equivalent of a Firestore transaction.
 *
 * Isolation: every value is deep-copied on the way in and on the way out, so a
 * caller mutating what it read (or what it wrote) can never change stored state.
 *
 * Faults: `failAfterClaim(intentId)` simulates a process dying immediately
 * after a successful claim — the claim is committed and then the call throws
 * Error('SIMULATED_CRASH_AFTER_CLAIM'), so the dispatcher never reaches the
 * carrier for that intent in that tick.
 */

import { purposeSpec } from '@/lib/sampark/catalogue';
import type { AuditEntry, CallListFilter, ClaimResult, SamparkRepo } from '@/lib/sampark/ports';
import type {
    Campaign,
    CallState,
    GuardianPreferences,
    ImportRun,
    Intent,
    RenderedClip,
    SamparkCall,
    SamparkGuardian,
    SamparkSchool,
    SamparkStudent,
    Suppression,
} from '@/types/sampark';
import { TERMINAL_CALL_STATES } from '@/types/sampark';

export const SIMULATED_CRASH_AFTER_CLAIM = 'SIMULATED_CRASH_AFTER_CLAIM';

function clone<T>(value: T): T {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((v) => clone(v)) as unknown as T;
    if (value instanceof Map) return new Map([...value].map(([k, v]) => [k, clone(v)])) as unknown as T;
    if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = clone(v);
    return out as T;
}

const OPEN_CALL_STATES: readonly CallState[] = ['dialing', 'ringing', 'in_progress'];

function ms(iso: string | null | undefined): number {
    const t = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(t) ? t : NaN;
}

class OrgTable<T> {
    private readonly byOrg = new Map<string, Map<string, T>>();

    bucket(orgId: string): Map<string, T> {
        let b = this.byOrg.get(orgId);
        if (!b) {
            b = new Map();
            this.byOrg.set(orgId, b);
        }
        return b;
    }

    get(orgId: string, id: string): T | undefined {
        return this.byOrg.get(orgId)?.get(id);
    }

    has(orgId: string, id: string): boolean {
        return this.byOrg.get(orgId)?.has(id) ?? false;
    }

    set(orgId: string, id: string, value: T): void {
        this.bucket(orgId).set(id, value);
    }

    values(orgId: string): T[] {
        return [...(this.byOrg.get(orgId)?.values() ?? [])];
    }
}

/** Keys a patch may never change. */
const IMMUTABLE_KEYS = ['id', 'orgId'] as const;

function applyPatch<T extends object>(current: T, patch: Partial<T>): T {
    const next = { ...current, ...clone(patch) } as T;
    for (const key of IMMUTABLE_KEYS) {
        if (key in (current as object)) (next as Record<string, unknown>)[key] = (current as Record<string, unknown>)[key];
    }
    return next;
}

function isEmergencyPurpose(call: SamparkCall): boolean {
    try {
        return purposeSpec(call.purpose).emergency;
    } catch {
        return false;
    }
}

export function createMemorySamparkRepo(opts?: { faults?: { failAfterClaim?: (intentId: string) => boolean } }): SamparkRepo {
    const faults = opts?.faults ?? {};

    const schools = new Map<string, SamparkSchool>();
    const students = new OrgTable<SamparkStudent>();
    const guardians = new OrgTable<SamparkGuardian>();
    const preferences = new OrgTable<GuardianPreferences>();
    const suppressions = new OrgTable<Suppression>();
    const importRuns = new OrgTable<ImportRun>();
    const campaigns = new OrgTable<Campaign>();
    const intents = new OrgTable<Intent>();
    const calls = new OrgTable<SamparkCall>();
    const clips = new OrgTable<RenderedClip>();
    const locks = new Map<string, { holder: string; expiresAtMs: number }>();
    const burned = new Set<string>();
    const audit = new Map<string, AuditEntry[]>();

    const repo: SamparkRepo = {
        // ── School ──────────────────────────────────────────────────────────
        async getSchool(orgId) {
            return clone(schools.get(orgId) ?? null);
        },
        async upsertSchool(school) {
            schools.set(school.orgId, clone(school));
        },
        async listSchools() {
            return [...schools.values()].sort((a, b) => a.orgId.localeCompare(b.orgId)).map(clone);
        },

        // ── Snapshot ────────────────────────────────────────────────────────
        async upsertStudents(orgId, list) {
            for (const s of list) students.set(orgId, s.id, clone({ ...s, orgId }));
        },
        async upsertGuardians(orgId, list) {
            for (const g of list) guardians.set(orgId, g.id, clone({ ...g, orgId }));
        },
        async listStudents(orgId) {
            return students.values(orgId).sort((a, b) => a.id.localeCompare(b.id)).map(clone);
        },
        async listGuardians(orgId, ids) {
            if (ids) {
                return ids.map((id) => guardians.get(orgId, id)).filter((g): g is SamparkGuardian => !!g).map(clone);
            }
            return guardians.values(orgId).sort((a, b) => a.id.localeCompare(b.id)).map(clone);
        },
        async getGuardian(orgId, guardianId) {
            return clone(guardians.get(orgId, guardianId) ?? null);
        },

        // ── Preferences + suppressions ──────────────────────────────────────
        async getPreferences(orgId, guardianIds) {
            const out = new Map<string, GuardianPreferences>();
            for (const id of guardianIds) {
                const p = preferences.get(orgId, id);
                if (p) out.set(id, clone(p));
            }
            return out;
        },
        async upsertPreferences(list) {
            for (const p of list) preferences.set(p.orgId, p.guardianId, clone(p));
        },
        async getSuppression(orgId, phoneHash) {
            return clone(suppressions.get(orgId, phoneHash) ?? null);
        },
        async listSuppressions(orgId) {
            return suppressions.values(orgId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(clone);
        },
        async upsertSuppression(s) {
            suppressions.set(s.orgId, s.phoneHash, clone(s));
        },

        // ── Imports ─────────────────────────────────────────────────────────
        async createImportRun(run) {
            if (importRuns.has(run.orgId, run.id)) throw new Error(`ALREADY_EXISTS: import run ${run.id}`);
            importRuns.set(run.orgId, run.id, clone(run));
        },
        async updateImportRun(run) {
            if (!importRuns.has(run.orgId, run.id)) throw new Error(`NOT_FOUND: import run ${run.id}`);
            importRuns.set(run.orgId, run.id, clone(run));
        },
        async getLatestImportRun(orgId) {
            const runs = importRuns.values(orgId).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
            return clone(runs[0] ?? null);
        },

        // ── Campaigns ───────────────────────────────────────────────────────
        async createCampaign(c) {
            if (campaigns.has(c.orgId, c.id)) throw new Error(`ALREADY_EXISTS: campaign ${c.id}`);
            campaigns.set(c.orgId, c.id, clone(c));
        },
        async getCampaign(orgId, campaignId) {
            return clone(campaigns.get(orgId, campaignId) ?? null);
        },
        async updateCampaign(orgId, campaignId, patch) {
            const current = campaigns.get(orgId, campaignId);
            if (!current) throw new Error(`NOT_FOUND: campaign ${campaignId}`);
            campaigns.set(orgId, campaignId, applyPatch(current, patch));
        },
        async listCampaigns(orgId, limit) {
            return campaigns
                .values(orgId)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
                .slice(0, Math.max(0, limit))
                .map(clone);
        },

        // ── Intents ─────────────────────────────────────────────────────────
        async createIntentIfAbsent(intent) {
            if (intents.has(intent.orgId, intent.id)) return false;
            intents.set(intent.orgId, intent.id, clone(intent));
            return true;
        },
        async getIntent(orgId, intentId) {
            return clone(intents.get(orgId, intentId) ?? null);
        },
        async updateIntent(orgId, intentId, patch) {
            const current = intents.get(orgId, intentId);
            if (!current) throw new Error(`NOT_FOUND: intent ${intentId}`);
            intents.set(orgId, intentId, applyPatch(current, patch));
        },
        async listDueIntents(orgId, now, limit) {
            const nowMs = now.getTime();
            return intents
                .values(orgId)
                .filter((i) => (i.status === 'approved' || i.status === 'retry_wait') && (i.notBefore === null || ms(i.notBefore) <= nowMs))
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
                .slice(0, Math.max(0, limit))
                .map(clone);
        },
        async listIntentsByCampaign(orgId, campaignId) {
            return intents
                .values(orgId)
                .filter((i) => i.campaignId === campaignId)
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
                .map(clone);
        },

        async claimIntentForDial(orgId, intentId, call, now): Promise<ClaimResult> {
            // ── one atomic step: no await between the reads and the writes ──
            const intent = intents.get(orgId, intentId);
            if (!intent) return 'not_claimable';
            if (intent.status !== 'approved' && intent.status !== 'retry_wait') return 'not_claimable';
            if (intent.notBefore !== null && !(ms(intent.notBefore) <= now.getTime())) return 'not_claimable';
            if (calls.has(orgId, call.id)) return 'not_claimable';
            if (call.intentId !== intentId || call.orgId !== orgId) return 'not_claimable';
            if (call.state !== 'dialing') return 'not_claimable';
            if (call.attempt !== intent.attempts + 1) return 'not_claimable';

            calls.set(orgId, call.id, clone(call));
            intents.set(orgId, intentId, {
                ...intent,
                status: 'dialing',
                attempts: call.attempt,
                lastCallId: call.id,
                updatedAt: now.toISOString(),
            });
            // ── committed ──

            if (faults.failAfterClaim?.(intentId)) throw new Error(SIMULATED_CRASH_AFTER_CLAIM);
            return 'claimed';
        },

        // ── Calls ───────────────────────────────────────────────────────────
        async getCall(orgId, callId) {
            return clone(calls.get(orgId, callId) ?? null);
        },
        async updateCall(orgId, callId, patch) {
            const current = calls.get(orgId, callId);
            if (!current) throw new Error(`NOT_FOUND: call ${callId}`);
            calls.set(orgId, callId, applyPatch(current, patch));
        },
        async mutateCall(orgId, callId, mutate) {
            const current = calls.get(orgId, callId);
            if (!current) return null;
            const next = mutate(clone(current));
            if (!next) return clone(current);
            calls.set(orgId, callId, { ...clone(next), id: current.id, orgId: current.orgId });
            return clone(calls.get(orgId, callId) ?? null);
        },
        async listCalls(orgId, filter: CallListFilter) {
            return calls
                .values(orgId)
                .filter((c) => filter.campaignId === undefined || c.campaignId === filter.campaignId)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.attempt - a.attempt || a.id.localeCompare(b.id))
                .slice(0, Math.max(0, filter.limit))
                .map(clone);
        },
        async listExpiredOpenCalls(orgId, now) {
            const nowMs = now.getTime();
            return calls
                .values(orgId)
                .filter((c) => OPEN_CALL_STATES.includes(c.state) && ms(c.leaseUntil) <= nowMs)
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .map(clone);
        },
        async countNonTerminalCalls(orgId) {
            return calls.values(orgId).filter((c) => !(TERMINAL_CALL_STATES as readonly CallState[]).includes(c.state)).length;
        },
        async countCallsToPhoneSince(orgId, phoneHash, since, excludeEmergency) {
            const sinceMs = since.getTime();
            return calls
                .values(orgId)
                .filter((c) => c.phoneHash === phoneHash && ms(c.createdAt) >= sinceMs)
                .filter((c) => !excludeEmergency || !isEmergencyPurpose(c)).length;
        },

        // ── Rendered audio metadata ─────────────────────────────────────────
        async saveClip(clip) {
            clips.set(clip.orgId, clip.key, clone(clip));
        },
        async getClip(orgId, key) {
            return clone(clips.get(orgId, key) ?? null);
        },
        async listClipsForCampaign(orgId, campaignId) {
            return clips
                .values(orgId)
                .filter((c) => c.campaignId === campaignId)
                .sort((a, b) => a.key.localeCompare(b.key))
                .map(clone);
        },

        // ── Single-flight lease ─────────────────────────────────────────────
        async burnToken(key) {
            if (burned.has(key)) return false;
            burned.add(key);
            return true;
        },

        async acquireLock(name, holder, now, ttlMs) {
            const nowMs = now.getTime();
            const existing = locks.get(name);
            if (existing && existing.holder !== holder && existing.expiresAtMs > nowMs) return false;
            locks.set(name, { holder, expiresAtMs: nowMs + ttlMs });
            return true;
        },
        async releaseLock(name, holder) {
            if (locks.get(name)?.holder === holder) locks.delete(name);
        },

        // ── Audit ───────────────────────────────────────────────────────────
        async appendAudit(orgId, entry) {
            const list = audit.get(orgId) ?? [];
            list.push(clone(entry));
            audit.set(orgId, list);
        },
    };

    return repo;
}
