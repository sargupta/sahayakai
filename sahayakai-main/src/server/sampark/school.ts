/**
 * Sampark school (tenant) settings: enable, read, update, mode, pause.
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
 *   - testPhone: an Indian MOBILE only (never a landline, a synthetic `+915…`
 *     demo number or a foreign number). Stored as ciphertext + peppered hash +
 *     last four; the full number is never returned, logged or audited.
 *     Removing it — or changing it — while the school is in Test mode returns
 *     the school to Practice, so Test is only ever on for a number the admin
 *     confirmed when switching (phase 2a contract §5);
 *   - mode: practice always; test only when this deployment can place real
 *     calls (`liveDialBlocker() === null`) and a test phone is saved; live is
 *     refused in phase 2a (409 LIVE_MODE_NOT_AVAILABLE);
 *   - holidays (H10): the console edits the school's OWN list, stored as
 *     `manualHolidays`; `holidays` (what the window reads) is always the sorted
 *     union of that list and the CRM's (`crmHolidays`), so neither the console
 *     nor an import can remove the other's days;
 *   - pause (H3): a principal can stop every call (scope 'all') or every call
 *     but emergency closures (scope 'routine') with a reason, and resume. The
 *     dispatcher holds while the pause applies; pausing also hangs up calls
 *     that are still ringing. Both directions are audited and idempotent.
 *
 * Responses go through `schoolView`, never the raw record: the console sees
 * `testPhoneLast4` and whether Test mode is possible here, never the stored
 * ciphertext or hash.
 */

import { z } from 'zod';

import { logger } from '@/lib/logger';
import { unionHolidays } from '@/lib/sampark/crm/import';
import { assertCrmUrlSafe, CrmUrlError } from '@/lib/sampark/crm/rest-source';
import { classifyPhone, encryptPhone, hashPhone, normalizeIndianPhone, phoneLast4 } from '@/lib/sampark/phone';
import { callScripts } from '@/lib/sampark/scripts/templates';
import { PARENT_LANGUAGES, type ParentLanguage, type SamparkCall, type SamparkMode, type SamparkSchool, type SamparkSchoolView, type SchoolPause, type SchoolVenue, type LiveDialBlocker } from '@/types/sampark';

export type { SamparkSchoolView };
import { badRequest, conflict, schoolNotEnabled } from '@/server/sampark/errors';
import type { SamparkCtx } from '@/server/sampark/http';
import { LIVE_MODE_NOT_AVAILABLE, liveDialBlocker, TEST_PHONE_MISSING } from '@/server/sampark/carrier';
import { hangupRingingCalls } from '@/server/sampark/hangup';
import { pauseStopsPurpose } from '@/lib/sampark/policy/pause';

export { LIVE_MODE_NOT_AVAILABLE, TEST_PHONE_MISSING };

/** Error code this module adds (the console maps it to a sentence). */
export const TEST_PHONE_INVALID = 'TEST_PHONE_INVALID';


export function schoolView(school: SamparkSchool, env: NodeJS.ProcessEnv = process.env): SamparkSchoolView {
    const { testPhoneEnc: _enc, testPhoneHash: _hash, testPhoneLast4, ...rest } = school;
    const blocker = liveDialBlocker(env);
    return {
        ...rest,
        // Always present, so the console's pause banner never has to guess.
        pause: school.pause ?? null,
        testPhoneLast4: testPhoneLast4 ?? null,
        liveDialAvailable: blocker === null,
        liveDialBlocker: blocker,
    };
}

function hasTestPhone(school: SamparkSchool): boolean {
    return !!school.testPhoneEnc && !!school.testPhoneHash && !!school.testPhoneLast4;
}

/** Normalise and check a typed test phone. Throws 400 TEST_PHONE_INVALID; the message never repeats the number. */
function parseTestPhone(raw: string): string {
    const e164 = normalizeIndianPhone(raw);
    const kind = e164 ? classifyPhone(e164) : 'invalid';
    if (!e164 || kind !== 'mobile') {
        throw badRequest(
            TEST_PHONE_INVALID,
            kind === 'synthetic'
                ? 'That is a demo number, which can never ring a phone. Enter a real Indian mobile number.'
                : 'Enter an Indian mobile number: 10 digits starting with 6, 7, 8 or 9.',
        );
    }
    return e164;
}

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
        /** The school's OWN holidays (stored as manualHolidays); the CRM's are merged in, never replaced (H10). */
        holidays: z.array(IsoDateSchema).max(366).optional(),
        venues: z
            .array(VenueSchema)
            .max(50)
            .refine((v) => new Set(v.map((x) => x.id)).size === v.length, 'venue ids must be unique')
            .optional(),
        defaultLanguage: LanguageEnum.nullable().optional(),
        crm: CrmInputSchema.nullable().optional(),
        /** The Test-mode destination as typed (normalised server-side), or null to remove it. */
        testPhone: z.string().trim().min(1).max(32).nullable().optional(),
    })
    .strict();
export type UpdateSchoolInput = z.infer<typeof UpdateSchoolSchema>;

/** `spokenName` is optional (an addition to the contract body): Indic names must be in their own script to render. */
export const EnableSchoolSchema = z.object({ displayName: z.string().trim().min(1).max(120), spokenName: spokenRecord.optional() }).strict();

export const ModeSchema = z.object({ mode: z.enum(['practice', 'test', 'live']) }).strict();

/** PUT pause: pausing needs a reason (staff-only text, never spoken); scope defaults to 'all'. */
export const PauseSchema = z
    .object({
        paused: z.boolean(),
        reason: z.string().trim().min(1).max(200).optional(),
        scope: z.enum(['routine', 'all']).optional(),
    })
    .strict()
    .superRefine((v, ctx) => {
        if (v.paused && v.reason === undefined) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'a reason is required to pause calls' });
        }
    });
export type PauseInput = z.infer<typeof PauseSchema>;

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
    if (input.holidays !== undefined) {
        next.manualHolidays = unionHolidays(input.holidays);
        next.holidays = unionHolidays(next.manualHolidays, school.crmHolidays);
    }
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
    // Test phone. Changing or removing it while in Test mode returns the school to
    // Practice: Test is only ever on for the number the admin confirmed.
    let modeChange: { from: SamparkMode; to: SamparkMode; reason: string } | null = null;
    if (input.testPhone !== undefined) {
        if (input.testPhone === null) {
            next.testPhoneEnc = null;
            next.testPhoneHash = null;
            next.testPhoneLast4 = null;
            if (school.mode === 'test') modeChange = { from: 'test', to: 'practice', reason: 'test_phone_removed' };
        } else {
            const e164 = parseTestPhone(input.testPhone);
            const hash = hashPhone(e164);
            const changed = hash !== school.testPhoneHash;
            next.testPhoneEnc = changed || !school.testPhoneEnc ? encryptPhone(e164) : school.testPhoneEnc;
            next.testPhoneHash = hash;
            next.testPhoneLast4 = phoneLast4(e164);
            if (changed && school.mode === 'test') modeChange = { from: 'test', to: 'practice', reason: 'test_phone_changed' };
        }
        if (modeChange) next.mode = modeChange.to;
    }
    const now = ctx.clock.now().toISOString();
    next.updatedAt = now;
    await ctx.repo.upsertSchool(next);
    await ctx.repo.appendAudit(orgId, {
        at: now,
        actor: uid,
        action: 'school.update',
        target: `school/${orgId}`,
        // Field names only — plus the test phone's last four, never the number.
        detail: input.testPhone !== undefined ? { fields: Object.keys(input), testPhoneLast4: next.testPhoneLast4 ?? null } : { fields: Object.keys(input) },
    });
    if (modeChange) {
        await ctx.repo.appendAudit(orgId, { at: now, actor: uid, action: 'school.mode', target: `school/${orgId}`, detail: { ...modeChange } });
    }
    return next;
}

const BLOCKER_MESSAGE: Record<LiveDialBlocker, string> = {
    LIVE_DIAL_DISABLED: 'Real calls are switched off for this deployment',
    PUBLIC_BASE_URL_MISSING: 'This deployment has no public https address for the phone company to call back on',
    CARRIER_UNCONFIGURED: 'No phone company account is configured for this deployment',
};

/**
 * practice → always allowed. test → only when this deployment can place real
 * calls (409 with the `liveDialBlocker()` code) and a test phone is saved (409
 * TEST_PHONE_MISSING). live → 409 LIVE_MODE_NOT_AVAILABLE in phase 2a. A demo
 * school may use Test: the number dialled is the verified test phone, never a
 * synthetic guardian number (contract §3, gate destination semantics).
 * Every change is audited; asking for the current mode changes nothing.
 */
export async function setSchoolMode(ctx: SamparkCtx, orgId: string, uid: string, mode: SamparkMode): Promise<SamparkSchool> {
    const school = await getSchoolOrThrow(ctx, orgId);
    if (mode === 'live') throw conflict(LIVE_MODE_NOT_AVAILABLE, 'Live mode (calling families) is not available in this release');
    if (mode === 'test') {
        const blocker = liveDialBlocker();
        if (blocker) throw conflict(blocker, BLOCKER_MESSAGE[blocker]);
        if (!hasTestPhone(school)) throw conflict(TEST_PHONE_MISSING, 'Save a test phone before switching to Test mode');
    }
    if (school.mode === mode) return school;
    const now = ctx.clock.now().toISOString();
    const next: SamparkSchool = { ...school, mode, updatedAt: now };
    await ctx.repo.upsertSchool(next);
    await ctx.repo.appendAudit(orgId, {
        at: now,
        actor: uid,
        action: 'school.mode',
        target: `school/${orgId}`,
        detail: mode === 'test' ? { from: school.mode, to: mode, testPhoneLast4: school.testPhoneLast4 ?? null } : { from: school.mode, to: mode },
    });
    return next;
}

/**
 * Pause or resume every call the school makes (H3).
 *
 * Pausing records who, when, why and the scope, audits `school.pause`, and then asks
 * the carrier to hang up calls still ringing — every one for scope 'all', every one
 * but an emergency closure for scope 'routine'. A call already speaking finishes its
 * message (see hangup.ts). The hang-up is best effort: the pause is already in force
 * at the dispatcher and the answer webhook, so a failure there is logged rather than
 * reported as a failed pause. Asking again for the same pause changes nothing and
 * writes no audit, but still hangs up anything ringing, since a retry is exactly when
 * a principal needs that to happen. A new reason or scope replaces the pause.
 *
 * Resuming clears the pause and audits `school.resume`; resuming a school that is not
 * paused changes nothing.
 */
export async function setSchoolPause(ctx: SamparkCtx, orgId: string, uid: string, input: PauseInput): Promise<SamparkSchool> {
    const school = await getSchoolOrThrow(ctx, orgId);
    const now = ctx.clock.now().toISOString();

    if (!input.paused) {
        if (!school.pause) return school;
        const next: SamparkSchool = { ...school, pause: null, updatedAt: now };
        await ctx.repo.upsertSchool(next);
        await ctx.repo.appendAudit(orgId, {
            at: now,
            actor: uid,
            action: 'school.resume',
            target: `school/${orgId}`,
            detail: { pausedAt: school.pause.at, pausedBy: school.pause.by, scope: school.pause.scope },
        });
        return next;
    }

    const reason = (input.reason ?? '').trim();
    const scope = input.scope ?? 'all';
    let next = school;
    if (!school.pause || school.pause.reason !== reason || school.pause.scope !== scope) {
        const pause: SchoolPause = { at: now, by: uid, reason, scope };
        next = { ...school, pause, updatedAt: now };
        await ctx.repo.upsertSchool(next);
        await ctx.repo.appendAudit(orgId, {
            at: now,
            actor: uid,
            action: 'school.pause',
            target: `school/${orgId}`,
            detail: { scope, reason, previous: school.pause ? { at: school.pause.at, scope: school.pause.scope } : null },
        });
    }

    try {
        const report = await hangupRingingCalls(ctx, orgId, { reason: 'school_paused', actor: uid, include: pauseHangupFilter(scope) });
        logger.info('Sampark school paused', 'SAMPARK_PAUSE', { orgId, scope, ...report });
    } catch (err) {
        logger.error('Sampark pause could not hang up ringing calls', err, 'SAMPARK_PAUSE', { orgId });
    }
    return next;
}

/**
 * Which ringing calls a pause hangs up: all of them, or, for a routine pause, all but
 * emergency purposes: the shared rule in policy/pause.ts, so it matches the dispatcher and the answer webhook.
 */
export function pauseHangupFilter(scope: SchoolPause['scope']): (call: SamparkCall) => boolean {
    return (call) => pauseStopsPurpose({ at: '', by: '', reason: '', scope }, call.purpose);
}
