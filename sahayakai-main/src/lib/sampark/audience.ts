/**
 * Campaign audience → intents (plan §4③④, §2E, class gates 10 and 13).
 *
 * A class-level campaign (PTM, event, closure) becomes ONE intent per guardian
 * of record: siblings in the audience are bundled onto their shared guardian's
 * single intent, never onto a shared phone number. The guardian-of-record link
 * must hold on BOTH sides of the snapshot — the student lists the guardian in
 * `guardianIds` AND the guardian lists the student in `studentIds` — so an
 * inconsistent import can only drop a call, never route one to a step-parent
 * who is not the child's guardian of record.
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

/**
 * Guardian id → the audience children they are guardian of record for (active students
 * and active guardians only). Pure; exported for the dry-run preview.
 */
export function bundleAudience(
    campaign: Pick<Campaign, 'audience'>,
    students: SamparkStudent[],
    guardians: SamparkGuardian[],
): Map<string, { guardian: SamparkGuardian; students: SamparkStudent[] }> {
    const guardianById = new Map(guardians.map((g) => [g.id, g]));
    const matches = inAudience(campaign.audience);
    const bundles = new Map<string, { guardian: SamparkGuardian; students: SamparkStudent[] }>();

    for (const student of students) {
        if (!student.active || !matches(student)) continue;
        for (const guardianId of student.guardianIds ?? []) {
            const guardian = guardianById.get(guardianId);
            if (!guardian || !guardian.active) continue;
            if (!(guardian.studentIds ?? []).includes(student.id)) continue; // not of record on the guardian side
            const bundle = bundles.get(guardian.id) ?? { guardian, students: [] };
            if (!bundle.students.some((s) => s.id === student.id)) bundle.students.push(student);
            bundles.set(guardian.id, bundle);
        }
    }
    for (const bundle of bundles.values()) bundle.students.sort((a, b) => a.id.localeCompare(b.id));
    return new Map([...bundles.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** Resolve a campaign's audience to one intent per guardian of record (siblings bundled), gate each at stage 'materialise',
 *  and create intents (status 'approved' or 'blocked') with repo.createIntentIfAbsent. Idempotent. */
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

        const blockReason: BlockReason | null = verdict.kind === 'block' ? verdict.reason : null;
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
