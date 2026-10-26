/**
 * Guardians in the console, and the office's edits to the preferences
 * registry (plan §4④, §6: Sampark owns consent and language).
 *
 * PII: rows carry phoneLast4 only. The full number never leaves phoneEnc.
 */

import { z } from 'zod';

import {
    type ConsentGroup,
    type ConsentRecord,
    type ConsentStatus,
    type GuardianPreferences,
    PARENT_LANGUAGES,
    type ParentLanguage,
    type PhoneClass,
    type SamparkGuardian,
    type Suppression,
} from '@/types/sampark';
import { notFound } from '@/server/sampark/errors';
import type { SamparkCtx } from '@/server/sampark/http';
import { getSchoolOrThrow } from '@/server/sampark/school';

export const CONSENT_GROUPS: ConsentGroup[] = ['notices', 'progress', 'recorded_conversation', 'hpc_input'];

export interface GuardianRow {
    id: string;
    displayName: string;
    relation: SamparkGuardian['relation'];
    phoneLast4: string;
    phoneClass: PhoneClass;
    language: ParentLanguage | null;
    consent: Record<ConsentGroup, ConsentStatus>;
    suppressed: boolean;
    students: { id: string; displayName: string; grade: number; section: string }[];
}

export const GuardianQuerySchema = z.object({
    language: z.enum([...PARENT_LANGUAGES, 'unknown'] as [string, ...string[]]).optional(),
    q: z.string().trim().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type GuardianQuery = z.infer<typeof GuardianQuerySchema>;

const ConsentStatusEnum = z.enum(['granted', 'denied', 'unknown']);
export const PreferencesPatchSchema = z
    .object({
        language: z.enum(PARENT_LANGUAGES).nullable().optional(),
        consent: z
            .object({
                notices: ConsentStatusEnum.optional(),
                progress: ConsentStatusEnum.optional(),
                recorded_conversation: ConsentStatusEnum.optional(),
                hpc_input: ConsentStatusEnum.optional(),
            })
            .strict()
            .optional(),
    })
    .strict()
    .refine((p) => p.language !== undefined || (p.consent && Object.keys(p.consent).length > 0), 'nothing to update');
export type PreferencesPatch = z.infer<typeof PreferencesPatchSchema>;

/** The language a call would use before any school default: registry override, else CRM. */
export function effectiveLanguage(guardian: SamparkGuardian, prefs: GuardianPreferences | undefined | null): ParentLanguage | null {
    return prefs?.language ?? guardian.crmLanguage ?? null;
}

export function isActiveSuppression(s: Suppression | null | undefined): boolean {
    return !!s && s.officeVerification !== 'reversed';
}

function unknownConsent(): ConsentRecord {
    return { status: 'unknown', noticeVersion: null, language: null, recordedAt: null, source: 'crm' };
}

export function emptyPreferences(orgId: string, guardianId: string, now: string, by: string): GuardianPreferences {
    return {
        orgId,
        guardianId,
        language: null,
        consent: { notices: unknownConsent(), progress: unknownConsent(), recorded_conversation: unknownConsent(), hpc_input: unknownConsent() },
        updatedAt: now,
        updatedBy: by,
    };
}

export async function listGuardianRows(ctx: SamparkCtx, orgId: string, query: GuardianQuery): Promise<GuardianRow[]> {
    await getSchoolOrThrow(ctx, orgId);
    const [guardians, students, suppressions] = await Promise.all([
        ctx.repo.listGuardians(orgId),
        ctx.repo.listStudents(orgId),
        ctx.repo.listSuppressions(orgId),
    ]);
    const active = guardians.filter((g) => g.active);
    const prefs = await ctx.repo.getPreferences(orgId, active.map((g) => g.id));
    const studentById = new Map(students.map((s) => [s.id, s]));
    const suppressed = new Set(suppressions.filter(isActiveSuppression).map((s) => s.phoneHash));
    const q = query.q?.toLowerCase() ?? '';

    const rows: GuardianRow[] = [];
    for (const g of active) {
        const p = prefs.get(g.id);
        const language = effectiveLanguage(g, p);
        if (query.language) {
            if (query.language === 'unknown' ? language !== null : language !== query.language) continue;
        }
        const kids = g.studentIds
            .map((id) => studentById.get(id))
            .filter((s): s is NonNullable<typeof s> => !!s)
            .map((s) => ({ id: s.id, displayName: s.displayName, grade: s.grade, section: s.section }));
        if (q) {
            const hay = [g.displayName, g.phoneLast4, ...kids.map((k) => k.displayName)].join(' ').toLowerCase();
            if (!hay.includes(q)) continue;
        }
        const consent = {} as Record<ConsentGroup, ConsentStatus>;
        for (const group of CONSENT_GROUPS) consent[group] = p?.consent[group]?.status ?? 'unknown';
        rows.push({
            id: g.id,
            displayName: g.displayName,
            relation: g.relation,
            phoneLast4: g.phoneLast4,
            phoneClass: g.phoneClass,
            language,
            consent,
            suppressed: suppressed.has(g.phoneHash),
            students: kids,
        });
    }
    rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return rows.slice(0, query.limit);
}

export async function updateGuardianPreferences(
    ctx: SamparkCtx,
    orgId: string,
    guardianId: string,
    uid: string,
    patch: PreferencesPatch,
): Promise<GuardianPreferences> {
    await getSchoolOrThrow(ctx, orgId);
    const guardian = await ctx.repo.getGuardian(orgId, guardianId);
    if (!guardian) throw notFound('GUARDIAN_NOT_FOUND', 'Guardian not found');
    const now = ctx.clock.now().toISOString();
    const current = (await ctx.repo.getPreferences(orgId, [guardianId])).get(guardianId) ?? emptyPreferences(orgId, guardianId, now, uid);

    const next: GuardianPreferences = { ...current, consent: { ...current.consent }, updatedAt: now, updatedBy: uid };
    if (patch.language !== undefined) next.language = patch.language;
    const changedGroups: string[] = [];
    for (const group of CONSENT_GROUPS) {
        const status = patch.consent?.[group];
        if (status === undefined) continue;
        next.consent[group] = {
            status,
            noticeVersion: null,
            language: next.language ?? guardian.crmLanguage ?? null,
            recordedAt: now,
            source: 'office',
        };
        changedGroups.push(`${group}:${status}`);
    }
    await ctx.repo.upsertPreferences([next]);
    await ctx.repo.appendAudit(orgId, {
        at: now,
        actor: uid,
        action: 'preferences.update',
        target: `guardian/${guardianId}`,
        detail: { ...(patch.language !== undefined ? { language: patch.language } : {}), consent: changedGroups },
    });
    return next;
}
