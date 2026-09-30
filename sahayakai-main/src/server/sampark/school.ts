/**
 * Sampark school (tenant) settings: enable, read, update, mode.
 *
 * Validation lives here, at the boundary, so no route can write a school the
 * engine would misread:
 *   - callingWindow: startHour >= 10, endHour <= 20, start < end (plan §4④);
 *   - venues: every venue has a reviewed name in all four parent languages
 *     (no free text reaches TTS);
 *   - crm.baseUrl: SSRF-checked on save (plan §4①), and the API-key secret
 *     name must be a Sampark CRM secret — never an arbitrary app secret, or a
 *     school admin could make the server send e.g. the Firebase service
 *     account to a URL of their choosing as a Bearer token;
 *   - mode: only 'practice' in slice 1 (409 LIVE_DIAL_DISABLED otherwise).
 */

import { z } from 'zod';

import { assertCrmUrlSafe, CrmUrlError } from '@/lib/sampark/crm/rest-source';
import { callScripts } from '@/lib/sampark/scripts/templates';
import { PARENT_LANGUAGES, type ParentLanguage, type SamparkMode, type SamparkSchool, type SchoolVenue } from '@/types/sampark';
import { badRequest, conflict, schoolNotEnabled } from '@/server/sampark/errors';
import type { SamparkCtx } from '@/server/sampark/http';
import { LIVE_DIAL_DISABLED } from '@/server/sampark/carrier';

const LanguageEnum = z.enum(PARENT_LANGUAGES);

const spokenRecord = z.object({
    English: z.string().trim().min(1).max(120),
    Hindi: z.string().trim().min(1).max(120),
    Bengali: z.string().trim().min(1).max(120),
    Nepali: z.string().trim().min(1).max(120),
});

function isRealDate(s: string): boolean {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD').refine(isRealDate, 'not a real date');

export const CallingWindowSchema = z
    .object({
        startHour: z.number().int().min(10, 'calling window cannot start before 10:00 IST').max(19),
        endHour: z.number().int().min(11).max(20, 'calling window must end by 20:00 IST'),
        offDays: z.array(z.number().int().min(0).max(6)).max(7),
    })
    .refine((w) => w.startHour < w.endHour, { message: 'startHour must be before endHour', path: ['endHour'] })
    .transform((w) => ({ ...w, offDays: [...new Set(w.offDays)].sort() }));

export const VenueSchema = z.object({
    id: z.string().regex(/^[a-z0-9_-]{1,40}$/, 'venue id must be lowercase letters, digits, - or _'),
    names: spokenRecord,
});

/** Secret names a school may point its CRM key at. See the module comment for why this is an allowlist. */
export const CRM_SECRET_NAME = /^(SAMPARK_CRM_[A-Z0-9_]{1,64}|MOCK_CRM_API_KEY)$/;

const CrmInputSchema = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('rest'),
        baseUrl: z.string().trim().min(1).max(2048),
        apiKeySecretName: z.string().regex(CRM_SECRET_NAME, 'apiKeySecretName must be SAMPARK_CRM_<NAME> (or MOCK_CRM_API_KEY for the dummy CRM)'),
    }),
    z.object({ kind: z.literal('csv') }),
]);

export const UpdateSchoolSchema = z
    .object({
        displayName: z.string().trim().min(1).max(120).optional(),
        spokenName: spokenRecord.optional(),
        callingWindow: CallingWindowSchema.optional(),
        holidays: z.array(IsoDateSchema).max(366).optional(),
        venues: z
            .array(VenueSchema)
            .max(50)
            .refine((v) => new Set(v.map((x) => x.id)).size === v.length, 'venue ids must be unique')
            .optional(),
        defaultLanguage: LanguageEnum.nullable().optional(),
        crm: CrmInputSchema.nullable().optional(),
    })
    .strict();
export type UpdateSchoolInput = z.infer<typeof UpdateSchoolSchema>;

/** `spokenName` is optional (an addition to the contract body): Indic names must be in their own script to render. */
export const EnableSchoolSchema = z.object({ displayName: z.string().trim().min(1).max(120), spokenName: spokenRecord.optional() }).strict();

export const ModeSchema = z.object({ mode: z.enum(['practice', 'test', 'live']) }).strict();

/**
 * A new school starts with the venues the call-script templates already name
 * in all four languages (reviewed with the templates, stream C), so a PTM can
 * be created immediately; the school edits or replaces them in settings.
 */
export function defaultVenues(): SchoolVenue[] {
    const ids = Object.keys(callScripts('English').names.venues);
    return ids
        .map((id) => ({
            id,
            names: Object.fromEntries(PARENT_LANGUAGES.map((l) => [l, callScripts(l).names.venues[id] ?? ''])) as Record<ParentLanguage, string>,
        }))
        .filter((v) => PARENT_LANGUAGES.every((l) => v.names[l].trim() !== ''));
}

export async function getSchoolOrThrow(ctx: SamparkCtx, orgId: string): Promise<SamparkSchool> {
    const school = await ctx.repo.getSchool(orgId);
    if (!school) throw schoolNotEnabled();
    return school;
}

/** Create the practice-mode record if absent; an existing record is returned unchanged. */
export async function enableSchool(
    ctx: SamparkCtx,
    orgId: string,
    uid: string,
    input: { displayName: string; isDemo: boolean; spokenName?: Record<ParentLanguage, string> },
): Promise<SamparkSchool> {
    const existing = await ctx.repo.getSchool(orgId);
    if (existing) return existing;
    const now = ctx.clock.now().toISOString();
    const school: SamparkSchool = {
        orgId,
        // Until the school sets them, every language carries the display name; the
        // script renderer refuses Latin letters in an Indic name, so previews say
        // exactly which spoken names still need writing.
        spokenName: input.spokenName ?? { English: input.displayName, Hindi: input.displayName, Bengali: input.displayName, Nepali: input.displayName },
        displayName: input.displayName,
        mode: 'practice',
        isDemo: input.isDemo,
        callingWindow: { startHour: 10, endHour: 19, offDays: [0] },
        holidays: [],
        venues: defaultVenues(),
        defaultLanguage: null,
        testPhoneEnc: null,
        testPhoneLast4: null,
        crm: null,
        emergencyBypassConsent: false,
        createdAt: now,
        updatedAt: now,
    };
    await ctx.repo.upsertSchool(school);
    await ctx.repo.appendAudit(orgId, { at: now, actor: uid, action: 'school.enable', target: `school/${orgId}`, detail: { isDemo: input.isDemo } });
    return school;
}

export async function updateSchool(ctx: SamparkCtx, orgId: string, uid: string, input: UpdateSchoolInput): Promise<SamparkSchool> {
    const school = await getSchoolOrThrow(ctx, orgId);
    const next: SamparkSchool = { ...school };
    if (input.displayName !== undefined) next.displayName = input.displayName;
    if (input.spokenName !== undefined) next.spokenName = input.spokenName;
    if (input.callingWindow !== undefined) next.callingWindow = input.callingWindow;
    if (input.holidays !== undefined) next.holidays = [...new Set(input.holidays)].sort();
    if (input.venues !== undefined) next.venues = input.venues;
    if (input.defaultLanguage !== undefined) next.defaultLanguage = input.defaultLanguage;
    if (input.crm !== undefined) {
        if (input.crm === null) {
            next.crm = null;
        } else if (input.crm.kind === 'csv') {
            next.crm = {
                kind: 'csv',
                baseUrl: null,
                apiKeySecretName: null,
                lastImportAt: school.crm?.lastImportAt ?? null,
                lastImportId: school.crm?.lastImportId ?? null,
            };
        } else {
            try {
                await assertCrmUrlSafe(input.crm.baseUrl);
            } catch (err) {
                if (err instanceof CrmUrlError) throw badRequest('CRM_URL_REJECTED', err.message);
                throw err;
            }
            next.crm = {
                kind: 'rest',
                baseUrl: input.crm.baseUrl,
                apiKeySecretName: input.crm.apiKeySecretName,
                lastImportAt: school.crm?.lastImportAt ?? null,
                lastImportId: school.crm?.lastImportId ?? null,
            };
        }
    }
    const now = ctx.clock.now().toISOString();
    next.updatedAt = now;
    await ctx.repo.upsertSchool(next);
    await ctx.repo.appendAudit(orgId, {
        at: now,
        actor: uid,
        action: 'school.update',
        target: `school/${orgId}`,
        detail: { fields: Object.keys(input) },
    });
    return next;
}

export async function setSchoolMode(ctx: SamparkCtx, orgId: string, uid: string, mode: SamparkMode): Promise<SamparkSchool> {
    const school = await getSchoolOrThrow(ctx, orgId);
    if (mode !== 'practice') throw conflict(LIVE_DIAL_DISABLED, 'Only practice mode is available in this release');
    if (school.mode === 'practice') return school;
    const now = ctx.clock.now().toISOString();
    const next: SamparkSchool = { ...school, mode: 'practice', updatedAt: now };
    await ctx.repo.upsertSchool(next);
    await ctx.repo.appendAudit(orgId, { at: now, actor: uid, action: 'school.mode', target: `school/${orgId}`, detail: { from: school.mode, to: 'practice' } });
    return next;
}
