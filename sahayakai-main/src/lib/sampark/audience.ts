/**
 * Campaign audience → intents (plan §4③④, §2E, class gates 10 and 13, hardening H6 and H9).
 *
 * A class-level campaign (PTM, event, closure) becomes ONE intent per family
 * phone (H6), built in two steps:
 *
 *   1. Per child, the guardians to call. The guardian-of-record link must hold
 *      on BOTH sides of the snapshot — the student lists the guardian in
 *      `guardianIds` AND the guardian lists the student in `studentIds` — so an
 *      inconsistent import can only drop a call, never route one to a
 *      step-parent who is not the child's guardian of record. Of those, when
 *      any guardian the CRM marks primary for this child is active, only the
 *      primary ones are called; otherwise every active guardian of record is.
 *      (Two parents of record used to mean two calls for every notice.)
 *   2. Per phone. Entab repeats a parent's mobile under a new guardian id for
 *      every child, so bundles whose guardians share a `phoneHash` are merged
 *      into one: the representative is the guardian with the most children in
 *      the audience (ties: the lowest id), and the merged bundle names every
 *      child. Only guardians already chosen in step 1 are merged, so merging
 *      never adds a guardian of record the family did not already have.
 *
 * Both steps are deterministic (sorted inputs, stable tie-breaks), so the same
 * snapshot always yields the same representatives and therefore the same
 * dedupe keys: materialising twice creates nothing new.
 *
 * TEST MODE (H9). Every Test-mode call rings the school's one test phone, so a
 * Test campaign over 400 families would ring it 400 times. Instead, among the
 * intents that would be approved, the first per language (by guardian id) is
 * approved — the sample the school listens to — and the rest are created
 * 'blocked' with 'test_mode_sample'. The mode is the campaign's pinned mode
 * (H2), or the school's when an older campaign has none.
 *
 * Every intent is gated at stage 'materialise' and written create-only:
 *   allow → status 'approved' in the resolved language;
 *   block → status 'blocked' with its reason (language = resolved, or 'English'
 *           as a placeholder only because the field is required — a blocked
 *           intent is never dialled).
 * Re-running is idempotent: existing intents are counted, never overwritten,
 * so a rejected or blocked intent cannot be resurrected (gate 13).
 *
 * A promotional purpose can never be materialised (gate 8): that is refused
 * for the whole campaign before anything is written.
 */

import { purposeSpec } from '@/lib/sampark/catalogue';
import { recomputeCampaignCounts } from '@/lib/sampark/dispatch/counts';
import { campaignDedupeKey, intentIdFor } from '@/lib/sampark/intents';
import { evaluateGate, FREQUENCY_WINDOW_MS } from '@/lib/sampark/policy/gate';
import { resolveLanguage } from '@/lib/sampark/policy/language';
import type { Clock, SamparkRepo } from '@/lib/sampark/ports';
import type {
    BlockReason,
    Campaign,
    CampaignAudience,
    CarrierKind,
    Intent,
    ParentLanguage,
    SamparkGuardian,
    SamparkSchool,
    SamparkStudent,
    Suppression,
} from '@/types/sampark';

export interface MaterialiseResult {
    created: number;
    existing: number;
    /** Block reasons of the intents THIS call created. */
    blocked: Partial<Record<BlockReason, number>>;
}

function sectionKey(grade: number, section: string): string {
    return `${grade}|${String(section).trim().toUpperCase()}`;
}

function inAudience(audience: CampaignAudience): (s: SamparkStudent) => boolean {
    const sections = audience?.sections ?? [];
    if (sections.length === 0) return () => true;
    const keys = new Set(sections.map((s) => sectionKey(s.grade, s.section)));
    return (s) => keys.has(sectionKey(s.grade, s.section));
}

export interface AudienceBundle {
    /** The guardian this family's intent is created for (the representative of its phone). */
    guardian: SamparkGuardian;
    /** Every audience child the call covers, sorted by id. */
    students: SamparkStudent[];
}

/** The representative of a phone's bundles: most children, then the lowest guardian id. */
function representative(a: AudienceBundle, b: AudienceBundle): number {
    return b.students.length - a.students.length || a.guardian.id.localeCompare(b.guardian.id);
}

/**
 * Guardian id → the audience children the call to that guardian covers (active
 * students and active guardians of record only; primary guardians first; one
 * bundle per phone). Pure and deterministic; exported for the dry-run preview.
 */
export function bundleAudience(
    campaign: Pick<Campaign, 'audience'>,
    students: SamparkStudent[],
    guardians: SamparkGuardian[],
): Map<string, AudienceBundle> {
    const guardianById = new Map(guardians.map((g) => [g.id, g]));
    const matches = inAudience(campaign.audience);

    // Step 1: per child, the guardians to call.
    const byGuardian = new Map<string, AudienceBundle>();
    for (const student of [...students].sort((a, b) => a.id.localeCompare(b.id))) {
        if (!student.active || !matches(student)) continue;
        const ofRecord = [...new Set(student.guardianIds ?? [])]
            .map((id) => guardianById.get(id))
            .filter((g): g is SamparkGuardian => !!g && g.active && (g.studentIds ?? []).includes(student.id)); // of record on BOTH sides
        const primaryIds = new Set(student.primaryGuardianIds ?? []);
        const primaries = ofRecord.filter((g) => primaryIds.has(g.id));
        for (const guardian of primaries.length > 0 ? primaries : ofRecord) {
            const bundle = byGuardian.get(guardian.id) ?? { guardian, students: [] };
            bundle.students.push(student);
            byGuardian.set(guardian.id, bundle);
        }
    }

    // Step 2: one bundle per phone.
    const byPhone = new Map<string, AudienceBundle[]>();
    for (const bundle of byGuardian.values()) {
        const list = byPhone.get(bundle.guardian.phoneHash) ?? [];
        list.push(bundle);
        byPhone.set(bundle.guardian.phoneHash, list);
    }
    const merged = new Map<string, AudienceBundle>();
    for (const group of byPhone.values()) {
        const [rep] = [...group].sort(representative);
        const children = new Map<string, SamparkStudent>();
        for (const b of group) for (const s of b.students) children.set(s.id, s);
        merged.set(rep.guardian.id, {
            guardian: rep.guardian,
            students: [...children.values()].sort((a, b) => a.id.localeCompare(b.id)),
        });
    }
    return new Map([...merged.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** Resolve a campaign's audience to one intent per family phone (siblings bundled), gate each at stage 'materialise',
 *  and create intents (status 'approved' or 'blocked') with repo.createIntentIfAbsent. In Test mode only one family per
 *  language is approved (see TEST MODE above). Idempotent. */
export async function materialiseCampaignIntents(
    deps: { repo: SamparkRepo; clock: Clock },
    campaign: Campaign,
    school: SamparkSchool,
    carrierKind: CarrierKind,
): Promise<MaterialiseResult> {
    const { repo, clock } = deps;
    const result: MaterialiseResult = { created: 0, existing: 0, blocked: {} };

    if (campaign.orgId !== school.orgId) {
        throw new Error(`Campaign ${campaign.id} belongs to ${campaign.orgId}, not ${school.orgId}`);
    }
    const spec = purposeSpec(campaign.purpose);
    if (spec.commercial !== 'service') {
        // Class gate 8: a promotional purpose is never schedulable — refuse the campaign outright.
        throw new Error(`SAMPARK_PURPOSE_NOT_SCHEDULABLE: ${campaign.purpose} is classified '${spec.commercial}'`);
    }
    if (campaign.status === 'cancelled') return result;

    const now = clock.now();
    const nowIso = now.toISOString();
    const orgId = school.orgId;

    const students = await repo.listStudents(orgId);
    const candidateGuardianIds = [
        ...new Set(students.filter((s) => s.active).flatMap((s) => s.guardianIds ?? [])),
    ].sort();
    const guardians = candidateGuardianIds.length ? await repo.listGuardians(orgId, candidateGuardianIds) : [];
    const bundles = bundleAudience(campaign, students, guardians);
    if (bundles.size === 0) {
        await recomputeCampaignCounts(repo, orgId, campaign.id);
        return result;
    }

    const preferences = await repo.getPreferences(orgId, [...bundles.keys()]);
    const suppressionByPhone = new Map<string, Suppression>(
        (await repo.listSuppressions(orgId)).map((s) => [s.phoneHash, s]),
    );
    const recentByPhone = new Map<string, number>();
    const since = new Date(now.getTime() - FREQUENCY_WINDOW_MS);

    // Test mode (H9): the languages that already have their sample. An intent created on an
    // earlier run was the sample for its language unless it was created blocked, so a re-run
    // (or a run that died halfway) never approves a second family in the same language.
    const testMode = (campaign.mode ?? school.mode) === 'test';
    const sampled = new Set<ParentLanguage>();
    if (testMode) {
        for (const existing of await repo.listIntentsByCampaign(orgId, campaign.id)) {
            if (existing.status !== 'blocked') sampled.add(existing.language);
        }
    }

    for (const [guardianId, { guardian, students: children }] of bundles) {
        const dedupeKey = campaignDedupeKey(campaign.id, guardianId);
        const id = intentIdFor(dedupeKey);
        if (await repo.getIntent(orgId, id)) {
            result.existing += 1;
            continue;
        }

        let recent = recentByPhone.get(guardian.phoneHash);
        if (recent === undefined) {
            recent = await repo.countCallsToPhoneSince(orgId, guardian.phoneHash, since, true);
            recentByPhone.set(guardian.phoneHash, recent);
        }
        const prefs = preferences.get(guardianId) ?? null;
        const verdict = evaluateGate({
            school,
            spec,
            guardian,
            students: children,
            preferences: prefs,
            suppression: suppressionByPhone.get(guardian.phoneHash) ?? null,
            recentCallsToPhone: recent,
            carrierKind,
            now,
            stage: 'materialise',
        });

        let blockReason: BlockReason | null = verdict.kind === 'block' ? verdict.reason : null;
        if (testMode && verdict.kind === 'allow') {
            if (sampled.has(verdict.language)) blockReason = 'test_mode_sample';
            else sampled.add(verdict.language);
        }
        const intent: Intent = {
            id,
            dedupeKey,
            orgId,
            campaignId: campaign.id,
            purpose: campaign.purpose,
            guardianId,
            studentIds: children.map((s) => s.id),
            language: verdict.kind === 'allow' ? verdict.language : (resolveLanguage(guardian, prefs, school) ?? 'English'),
            // 'defer' cannot occur at stage 'materialise'; treat it as approved for the dispatcher to re-gate.
            status: blockReason ? 'blocked' : 'approved',
            blockReason,
            attempts: 0,
            maxAttempts: spec.maxAttempts,
            notBefore: campaign.notBefore,
            expiresAt: campaign.expiresAt,
            lastCallId: null,
            createdAt: nowIso,
            updatedAt: nowIso,
        };

        if (await repo.createIntentIfAbsent(intent)) {
            result.created += 1;
            if (blockReason) result.blocked[blockReason] = (result.blocked[blockReason] ?? 0) + 1;
        } else {
            result.existing += 1;
        }
    }

    await recomputeCampaignCounts(repo, orgId, campaign.id);
    return result;
}
