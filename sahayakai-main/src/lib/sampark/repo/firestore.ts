/**
 * FirestoreSamparkRepo — the production adapter for `SamparkRepo` (ports.ts).
 *
 * Layout (plan §4②, §9 — every collection id is prefixed `sampark_` so it can
 * never collide with the existing `classes/{id}/students`):
 *
 *   sampark_schools/{orgId}                         SamparkSchool
 *     sampark_students/{studentId}                  SamparkStudent
 *     sampark_guardians/{guardianId}                SamparkGuardian
 *     sampark_preferences/{guardianId}              GuardianPreferences
 *     sampark_suppressions/{phoneHash}              Suppression
 *     sampark_imports/{importId}                    ImportRun
 *     sampark_campaigns/{campaignId}                Campaign
 *     sampark_intents/{intentId}                    Intent        (create-only, class gate 13)
 *     sampark_calls/{callId}                        SamparkCall   (create-only inside the claim tx, class gate 3)
 *     sampark_clips/{key}                           RenderedClip
 *     sampark_audit/{auto}                          AuditEntry
 *   sampark_locks/{name}                            single-flight lease
 *   sampark_token_burns/{sha256(token)}             single-use voice webhook tokens (TTL on expiresAt)
 *   sampark_voice_probes/{voiceProbeKey}            VoiceProbeRecord (hard-word probe; voice configs are global)
 *
 * Timestamps are stored as ISO strings, exactly as the domain types declare
 * them, so a document read back IS the domain object (no Timestamp mapping).
 *
 * Query chains are written with literal collection ids in the chained style so
 * Gate 12 (scripts/ci/check-firestore-indexes.mjs) can see them; the composite
 * indexes they need are declared in firestore.indexes.json.
 *
 * Access: Admin SDK only. `firestore.rules` default-deny already covers every
 * `sampark_*` path, so no client can read or write these documents.
 */

import type { DocumentReference, Firestore, WriteBatch } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

import { purposeSpec } from '@/lib/sampark/catalogue';
import type { AuditEntry, CallListFilter, ClaimResult, SamparkRepo } from '@/lib/sampark/ports';
import type { VoiceProbeRecord } from '@/lib/sampark/speech/probe';
import type {
    Campaign,
    CallState,
    GuardianPreferences,
    ImportRun,
    Intent,
    IntentStatus,
    RenderedClip,
    SamparkCall,
    SamparkGuardian,
    SamparkSchool,
    SamparkStudent,
    Suppression,
} from '@/types/sampark';
import { TERMINAL_CALL_STATES } from '@/types/sampark';

/** Firestore allows 500 writes per batch; stay well under it. */
export const MAX_BATCH_WRITES = 400;
/** Keep getAll() fan-out bounded. */
const MAX_GET_ALL = 300;

const NON_TERMINAL_CALL_STATES: CallState[] = ['dialing', 'ringing', 'in_progress'];
const TERMINAL_CALL_STATES_LIST: CallState[] = [...TERMINAL_CALL_STATES];
const DUE_INTENT_STATUSES = ['approved', 'retry_wait'];

/** gRPC ALREADY_EXISTS — what `.create()` throws when the document exists. */
const ALREADY_EXISTS = 6;

/**
 * Firestore rejects `undefined` (unless ignoreUndefinedProperties is set, which
 * this app does not do globally). Every domain type is JSON-safe (ISO strings,
 * numbers, booleans, null), so a JSON round-trip drops undefined keys and keeps
 * nulls — exactly the semantics a patch needs.
 */
function clean<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

function isAlreadyExists(err: unknown): boolean {
    const e = err as { code?: unknown; message?: unknown };
    return e?.code === ALREADY_EXISTS || e?.code === 'already-exists' || /ALREADY_EXISTS/i.test(String(e?.message ?? ''));
}

export class FirestoreSamparkRepo implements SamparkRepo {
    constructor(private readonly db: Firestore) {}

    // ── refs ────────────────────────────────────────────────────────────────

    private schoolRef(orgId: string): DocumentReference {
        return this.db.collection('sampark_schools').doc(orgId);
    }

    private async commitInBatches<T>(items: T[], write: (batch: WriteBatch, item: T) => void): Promise<void> {
        for (const part of chunk(items, MAX_BATCH_WRITES)) {
            const batch = this.db.batch();
            for (const item of part) write(batch, item);
            await batch.commit();
        }
    }

    // ── School ──────────────────────────────────────────────────────────────

    async getSchool(orgId: string): Promise<SamparkSchool | null> {
        const snap = await this.schoolRef(orgId).get();
        return snap.exists ? (snap.data() as SamparkSchool) : null;
    }

    async upsertSchool(school: SamparkSchool): Promise<void> {
        await this.schoolRef(school.orgId).set(clean(school));
    }

    async listSchools(): Promise<SamparkSchool[]> {
        const snap = await this.db.collection('sampark_schools').get();
        return snap.docs.map((d) => d.data() as SamparkSchool);
    }

    // ── Snapshot ────────────────────────────────────────────────────────────

    async upsertStudents(orgId: string, students: SamparkStudent[]): Promise<void> {
        const coll = this.schoolRef(orgId).collection('sampark_students');
        await this.commitInBatches(students, (batch, s) => batch.set(coll.doc(s.id), clean(s)));
    }

    async upsertGuardians(orgId: string, guardians: SamparkGuardian[]): Promise<void> {
        const coll = this.schoolRef(orgId).collection('sampark_guardians');
        await this.commitInBatches(guardians, (batch, g) => batch.set(coll.doc(g.id), clean(g)));
    }

    async listStudents(orgId: string): Promise<SamparkStudent[]> {
        const snap = await this.schoolRef(orgId).collection('sampark_students').get();
        return snap.docs.map((d) => d.data() as SamparkStudent);
    }

    async listGuardians(orgId: string, ids?: string[]): Promise<SamparkGuardian[]> {
        const coll = this.schoolRef(orgId).collection('sampark_guardians');
        if (!ids) {
            const snap = await coll.get();
            return snap.docs.map((d) => d.data() as SamparkGuardian);
        }
        const unique = [...new Set(ids)];
        const out: SamparkGuardian[] = [];
        for (const part of chunk(unique, MAX_GET_ALL)) {
            if (part.length === 0) continue;
            const snaps = await this.db.getAll(...part.map((id) => coll.doc(id)));
            for (const s of snaps) if (s.exists) out.push(s.data() as SamparkGuardian);
        }
        return out;
    }

    async getGuardian(orgId: string, guardianId: string): Promise<SamparkGuardian | null> {
        const snap = await this.schoolRef(orgId).collection('sampark_guardians').doc(guardianId).get();
        return snap.exists ? (snap.data() as SamparkGuardian) : null;
    }

    // ── Preferences + suppressions ──────────────────────────────────────────

    async getPreferences(orgId: string, guardianIds: string[]): Promise<Map<string, GuardianPreferences>> {
        const coll = this.schoolRef(orgId).collection('sampark_preferences');
        const out = new Map<string, GuardianPreferences>();
        for (const part of chunk([...new Set(guardianIds)], MAX_GET_ALL)) {
            if (part.length === 0) continue;
            const snaps = await this.db.getAll(...part.map((id) => coll.doc(id)));
            for (const s of snaps) if (s.exists) out.set(s.id, s.data() as GuardianPreferences);
        }
        return out;
    }

    async upsertPreferences(prefs: GuardianPreferences[]): Promise<void> {
        await this.commitInBatches(prefs, (batch, p) =>
            batch.set(this.schoolRef(p.orgId).collection('sampark_preferences').doc(p.guardianId), clean(p)),
        );
    }

    async getSuppression(orgId: string, phoneHash: string): Promise<Suppression | null> {
        const snap = await this.schoolRef(orgId).collection('sampark_suppressions').doc(phoneHash).get();
        return snap.exists ? (snap.data() as Suppression) : null;
    }

    async listSuppressions(orgId: string): Promise<Suppression[]> {
        const snap = await this.schoolRef(orgId).collection('sampark_suppressions').orderBy('createdAt', 'desc').get();
        return snap.docs.map((d) => d.data() as Suppression);
    }

    async upsertSuppression(s: Suppression): Promise<void> {
        await this.schoolRef(s.orgId).collection('sampark_suppressions').doc(s.phoneHash).set(clean(s));
    }

    // ── Imports ─────────────────────────────────────────────────────────────

    async createImportRun(run: ImportRun): Promise<void> {
        await this.schoolRef(run.orgId).collection('sampark_imports').doc(run.id).create(clean(run));
    }

    async updateImportRun(run: ImportRun): Promise<void> {
        await this.schoolRef(run.orgId).collection('sampark_imports').doc(run.id).set(clean(run));
    }

    async getLatestImportRun(orgId: string): Promise<ImportRun | null> {
        const snap = await this.schoolRef(orgId).collection('sampark_imports').orderBy('startedAt', 'desc').limit(1).get();
        return snap.empty ? null : (snap.docs[0].data() as ImportRun);
    }

    // ── Campaigns ───────────────────────────────────────────────────────────

    async createCampaign(c: Campaign): Promise<void> {
        await this.schoolRef(c.orgId).collection('sampark_campaigns').doc(c.id).create(clean(c));
    }

    async getCampaign(orgId: string, campaignId: string): Promise<Campaign | null> {
        const snap = await this.schoolRef(orgId).collection('sampark_campaigns').doc(campaignId).get();
        return snap.exists ? (snap.data() as Campaign) : null;
    }

    async updateCampaign(orgId: string, campaignId: string, patch: Partial<Campaign>): Promise<void> {
        await this.schoolRef(orgId).collection('sampark_campaigns').doc(campaignId).update(clean(patch) as Record<string, unknown>);
    }

    async listCampaigns(orgId: string, limit: number): Promise<Campaign[]> {
        const snap = await this.schoolRef(orgId).collection('sampark_campaigns').orderBy('createdAt', 'desc').limit(limit).get();
        return snap.docs.map((d) => d.data() as Campaign);
    }

    // ── Intents ─────────────────────────────────────────────────────────────

    async createIntentIfAbsent(intent: Intent): Promise<boolean> {
        try {
            await this.schoolRef(intent.orgId).collection('sampark_intents').doc(intent.id).create(clean(intent));
            return true;
        } catch (err) {
            if (isAlreadyExists(err)) return false;
            throw err;
        }
    }

    async getIntent(orgId: string, intentId: string): Promise<Intent | null> {
        const snap = await this.schoolRef(orgId).collection('sampark_intents').doc(intentId).get();
        return snap.exists ? (snap.data() as Intent) : null;
    }

    async updateIntent(orgId: string, intentId: string, patch: Partial<Intent>): Promise<void> {
        await this.schoolRef(orgId).collection('sampark_intents').doc(intentId).update(clean(patch) as Record<string, unknown>);
    }

    async updateIntentIf(orgId: string, intentId: string, expect: { status: IntentStatus; lastCallId: string | null }, patch: Partial<Intent>): Promise<boolean> {
        const ref = this.schoolRef(orgId).collection('sampark_intents').doc(intentId);
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) return false;
            const current = snap.data() as Intent;
            if (current.status !== expect.status || (current.lastCallId ?? null) !== expect.lastCallId) return false;
            tx.update(ref, clean(patch) as Record<string, unknown>);
            return true;
        });
    }

    /**
     * 'approved' | 'retry_wait' with notBefore null or <= now, oldest (createdAt) first.
     * Firestore cannot express "null OR <= now" in one query, so two bounded
     * queries run and merge: never-deferred intents by createdAt, deferred ones
     * by notBefore.
     */
    async listDueIntents(orgId: string, now: Date, limit: number): Promise<Intent[]> {
        const nowIso = now.toISOString();
        const [undeferred, deferred] = await Promise.all([
            this.schoolRef(orgId).collection('sampark_intents')
                .where('status', 'in', DUE_INTENT_STATUSES)
                .where('notBefore', '==', null)
                .orderBy('createdAt', 'asc')
                .limit(limit)
                .get(),
            this.schoolRef(orgId).collection('sampark_intents')
                .where('status', 'in', DUE_INTENT_STATUSES)
                .where('notBefore', '<=', nowIso)
                .orderBy('notBefore', 'asc')
                .limit(limit)
                .get(),
        ]);
        // Same order as the in-memory repo: createdAt, then id. (Within the deferred
        // query Firestore must order by notBefore first, so with a small limit the
        // earliest-due deferred intents are the ones considered — the right bias.)
        const all = [...undeferred.docs, ...deferred.docs].map((d) => d.data() as Intent);
        all.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
        return all.slice(0, limit);
    }

    async listIntentsByCampaign(orgId: string, campaignId: string): Promise<Intent[]> {
        const snap = await this.schoolRef(orgId).collection('sampark_intents').where('campaignId', '==', campaignId).get();
        return snap.docs.map((d) => d.data() as Intent);
    }

    /**
     * THE at-most-once primitive (class gate 3). Everything is read and decided
     * inside one transaction: the intent is RE-READ (a stale copy from the
     * listing never decides), the call document must not exist, and the call
     * is written with `create` so even a racing transaction that somehow passed
     * the existence read cannot overwrite it.
     */
    async claimIntentForDial(orgId: string, intentId: string, call: SamparkCall, now: Date): Promise<ClaimResult> {
        const intentRef = this.schoolRef(orgId).collection('sampark_intents').doc(intentId);
        const callRef = this.schoolRef(orgId).collection('sampark_calls').doc(call.id);
        return this.db.runTransaction(async (tx) => {
            const [intentSnap, callSnap] = await tx.getAll(intentRef, callRef);
            if (!intentSnap.exists || callSnap.exists) return 'not_claimable';
            const intent = intentSnap.data() as Intent;
            if (intent.status !== 'approved' && intent.status !== 'retry_wait') return 'not_claimable';
            if (intent.notBefore && new Date(intent.notBefore).getTime() > now.getTime()) return 'not_claimable';
            tx.create(callRef, clean({ ...call, state: 'dialing' as const }));
            tx.update(intentRef, {
                status: 'dialing',
                attempts: call.attempt,
                lastCallId: call.id,
                updatedAt: now.toISOString(),
            });
            return 'claimed';
        });
    }

    // ── Calls ───────────────────────────────────────────────────────────────

    async getCall(orgId: string, callId: string): Promise<SamparkCall | null> {
        const snap = await this.schoolRef(orgId).collection('sampark_calls').doc(callId).get();
        return snap.exists ? (snap.data() as SamparkCall) : null;
    }

    async updateCall(orgId: string, callId: string, patch: Partial<SamparkCall>): Promise<void> {
        await this.schoolRef(orgId).collection('sampark_calls').doc(callId).update(clean(patch) as Record<string, unknown>);
    }

    async mutateCall(orgId: string, callId: string, mutate: (current: SamparkCall) => SamparkCall | null): Promise<SamparkCall | null> {
        const ref = this.schoolRef(orgId).collection('sampark_calls').doc(callId);
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) return null;
            const current = snap.data() as SamparkCall;
            const next = mutate(clean(current));
            if (!next) return current;
            const stored = clean({ ...next, id: current.id, orgId: current.orgId });
            tx.set(ref, stored);
            return stored;
        });
    }

    async listCalls(orgId: string, filter: CallListFilter): Promise<SamparkCall[]> {
        const snap = filter.campaignId
            ? await this.schoolRef(orgId).collection('sampark_calls')
                .where('campaignId', '==', filter.campaignId)
                .orderBy('createdAt', 'desc')
                .limit(filter.limit)
                .get()
            : await this.schoolRef(orgId).collection('sampark_calls')
                .orderBy('createdAt', 'desc')
                .limit(filter.limit)
                .get();
        return snap.docs.map((d) => d.data() as SamparkCall);
    }

    async listExpiredOpenCalls(orgId: string, now: Date): Promise<SamparkCall[]> {
        const snap = await this.schoolRef(orgId).collection('sampark_calls')
            .where('state', 'in', NON_TERMINAL_CALL_STATES)
            .where('leaseUntil', '<', now.toISOString())
            .get();
        return snap.docs.map((d) => d.data() as SamparkCall);
    }

    async listUnsettledEndedCalls(orgId: string, endedBefore: Date, limit: number): Promise<SamparkCall[]> {
        // Equality on settledAt (null, never a missing field) + state: the composite index
        // (settledAt, state) is declared in firestore.indexes.json. The cut-off is applied in
        // memory — unsettled ended calls are rare, so the read is small.
        const snap = await this.schoolRef(orgId).collection('sampark_calls')
            .where('settledAt', '==', null)
            .where('state', 'in', TERMINAL_CALL_STATES_LIST)
            .limit(Math.max(1, limit * 2))
            .get();
        const cutoff = endedBefore.toISOString();
        return snap.docs
            .map((d) => d.data() as SamparkCall)
            .filter((c) => c.endedAt !== null && c.endedAt <= cutoff)
            .sort((a, b) => (a.endedAt ?? '').localeCompare(b.endedAt ?? ''))
            .slice(0, limit);
    }

    async countNonTerminalCalls(orgId: string): Promise<number> {
        const snap = await this.schoolRef(orgId).collection('sampark_calls')
            .where('state', 'in', NON_TERMINAL_CALL_STATES)
            .count()
            .get();
        return snap.data().count;
    }

    async countCallsToPhoneSince(orgId: string, phoneHash: string, since: Date, excludeEmergency: boolean): Promise<number> {
        const snap = await this.schoolRef(orgId).collection('sampark_calls')
            .where('phoneHash', '==', phoneHash)
            .where('createdAt', '>=', since.toISOString())
            .select('purpose')
            .get();
        if (!excludeEmergency) return snap.size;
        return snap.docs.filter((d) => {
            const purpose = d.get('purpose') as SamparkCall['purpose'];
            try {
                return !purposeSpec(purpose).emergency;
            } catch {
                return true; // unknown purpose counts against the cap (fail closed)
            }
        }).length;
    }

    // ── Rendered audio metadata ─────────────────────────────────────────────

    async saveClip(clip: RenderedClip): Promise<void> {
        await this.schoolRef(clip.orgId).collection('sampark_clips').doc(clip.key).set(clean(clip));
    }

    async getClip(orgId: string, key: string): Promise<RenderedClip | null> {
        const snap = await this.schoolRef(orgId).collection('sampark_clips').doc(key).get();
        return snap.exists ? (snap.data() as RenderedClip) : null;
    }

    async listClipsForCampaign(orgId: string, campaignId: string): Promise<RenderedClip[]> {
        const snap = await this.schoolRef(orgId).collection('sampark_clips').where('campaignId', '==', campaignId).get();
        return snap.docs.map((d) => d.data() as RenderedClip);
    }

    // ── Hard-word voice probes (global, keyed by voiceProbeKey) ─────────────

    async getVoiceProbe(key: string): Promise<VoiceProbeRecord | null> {
        const snap = await this.db.collection('sampark_voice_probes').doc(key).get();
        return snap.exists ? (snap.data() as VoiceProbeRecord) : null;
    }

    async saveVoiceProbe(record: VoiceProbeRecord): Promise<void> {
        await this.db.collection('sampark_voice_probes').doc(record.key).set(clean(record));
    }

    // ── Single-flight lease ─────────────────────────────────────────────────

    async burnToken(key: string, expiresAt: string): Promise<boolean> {
        try {
            // create() fails with ALREADY_EXISTS on a second burn: the check and the write are one operation.
            // expiresAt is a real Timestamp (not an ISO string like the domain records) so a Firestore
            // TTL policy on sampark_token_burns.expiresAt can delete old burns.
            await this.db.collection('sampark_token_burns').doc(key).create({ expiresAt: Timestamp.fromDate(new Date(expiresAt)) });
            return true;
        } catch (err) {
            if (isAlreadyExists(err)) return false;
            throw err;
        }
    }

    async acquireLock(name: string, holder: string, now: Date, ttlMs: number): Promise<boolean> {
        const ref = this.db.collection('sampark_locks').doc(name);
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (snap.exists) {
                const lock = snap.data() as { holder: string; expiresAt: string };
                const live = new Date(lock.expiresAt).getTime() > now.getTime();
                if (live && lock.holder !== holder) return false;
            }
            tx.set(ref, {
                name,
                holder,
                acquiredAt: now.toISOString(),
                expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
            });
            return true;
        });
    }

    async releaseLock(name: string, holder: string): Promise<void> {
        const ref = this.db.collection('sampark_locks').doc(name);
        await this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (snap.exists && (snap.data() as { holder: string }).holder === holder) tx.delete(ref);
        });
    }

    // ── Audit ───────────────────────────────────────────────────────────────

    async appendAudit(orgId: string, entry: AuditEntry): Promise<void> {
        await this.schoolRef(orgId).collection('sampark_audit').add(clean(entry));
    }
}
