// CONTRACT COPY: DO NOT EDIT BY HAND.
//
// Everything below the marker line is a byte-for-byte copy of
// sahayakai-main/src/lib/sampark/crm/schema.ts, the school-CRM wire contract
// this service must serve. It is copied (not imported) because CI installs only
// this package, so `zod` cannot be resolved from the app's node_modules there.
// test/contract.test.ts fails if the copy drifts from the app file by one byte;
// to refresh it, run:
//   { sed -n '1,/^\/\/ ---- verbatim copy below ----$/p' src/contract/crm-schema.ts; \
//     cat ../sahayakai-main/src/lib/sampark/crm/schema.ts; } > /tmp/c.ts && mv /tmp/c.ts src/contract/crm-schema.ts
// ---- verbatim copy below ----
/**
 * The school-CRM wire contract (v1) — what any CRM, including the dummy one in
 * `mock-school-crm/`, must serve for Sampark to import it. Plan §3.3.
 *
 * REST:
 *   GET /v1/school                                   → CrmSchool
 *   GET /v1/students?updatedSince=&cursor=&limit=    → Page<CrmStudent>
 *   GET /v1/students/{id}                            → CrmStudent
 *   GET /v1/guardians?updatedSince=&cursor=&limit=   → Page<CrmGuardian>
 *   GET /v1/guardians/{id}                           → CrmGuardian
 *   GET /v1/export/students.csv, /v1/export/guardians.csv  → the same records flattened (see CSV_COLUMNS)
 *   Auth: `Authorization: Bearer <api key>`.
 *   `updatedSince` pages overlap by the caller subtracting a few minutes (clock skew); deletions arrive as
 *   records with `deleted: true` (tombstones).
 *
 * The holistic-card, attendance, event and write-back endpoints are part of the
 * CRM contract too, but slice 1 does not import them; their schemas live with
 * the slices that use them.
 *
 * Every record is validated independently. A record that fails is quarantined
 * with the Zod issue as its reason and never half-imported.
 */

import { z } from 'zod';

export const CRM_API_VERSION = 'v1';

const isoDateTime = z.string().datetime({ offset: true });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const languageCode = z.enum(['en', 'hi', 'bn', 'ne']);

export const CrmConsentSchema = z.object({
    status: z.enum(['granted', 'denied', 'unknown']),
    recordedAt: isoDateTime.nullable(),
    method: z.enum(['admission_form', 'parent_form', 'office', 'app', 'unknown']).nullable(),
    noticeVersion: z.string().nullable(),
});

export const CrmSchoolSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    udise: z.string().nullable(),
    board: z.string(),
    city: z.string(),
    academicYear: z.string(),
    timezone: z.literal('Asia/Kolkata'),
    rubricScale: z.object({ id: z.string(), labels: z.tuple([z.string(), z.string(), z.string()]) }),
    holidays: z.array(z.object({ date: isoDate, name: z.string() })),
});
export type CrmSchool = z.infer<typeof CrmSchoolSchema>;

export const CrmStudentSchema = z.object({
    id: z.string().min(1),
    deleted: z.boolean().optional(),
    admissionNo: z.string(),
    apaarId: z.string().nullable(),
    fullName: z.string().min(1),
    /** First name as it should be SPOKEN, per language, reviewed by the school. Missing keys are allowed. */
    spokenFirstName: z.object({
        en: z.string().min(1).optional(),
        hi: z.string().min(1).optional(),
        bn: z.string().min(1).optional(),
        ne: z.string().min(1).optional(),
    }),
    grade: z.number().int().min(1).max(12),
    section: z.string().regex(/^[A-Z]$/, 'section must be a single capital letter'),
    rollNo: z.number().int().positive(),
    gender: z.enum(['female', 'male', 'other']),
    feeCategory: z.enum(['regular', 'rte', 'waived', 'scholarship', 'staff_ward']),
    boarding: z.boolean(),
    transportRoute: z.string().nullable(),
    /** Reason codes only — never note text (plan §2E). */
    sensitiveFlags: z.array(z.enum(['domestic_issue', 'severe_illness', 'counsellor_referral', 'custody_restriction', 'safeguarding_open'])),
    status: z.enum(['active', 'left']),
    guardians: z.array(z.object({
        guardianId: z.string().min(1),
        isPrimary: z.boolean(),
        /** False for e.g. a step-parent who is on file but is not this child's guardian of record. */
        isGuardianOfRecord: z.boolean(),
    })).min(1, 'a student needs at least one guardian'),
    updatedAt: isoDateTime,
});
export type CrmStudent = z.infer<typeof CrmStudentSchema>;

export const CrmGuardianSchema = z.object({
    id: z.string().min(1),
    deleted: z.boolean().optional(),
    fullName: z.string().min(1),
    relation: z.enum(['mother', 'father', 'guardian', 'other']),
    /** E.164. Synthetic demo numbers use the reserved +915 range (not an Indian mobile series). */
    phone: z.string().regex(/^\+\d{10,15}$/, 'phone must be E.164'),
    preferredLanguage: languageCode.nullable(),
    consent: z.object({
        notices: CrmConsentSchema.nullable(),
        progress: CrmConsentSchema.nullable(),
        recordedConversation: CrmConsentSchema.nullable(),
        hpcInput: CrmConsentSchema.nullable(),
    }),
    doNotContact: z.boolean(),
    synthetic: z.boolean(),
    updatedAt: isoDateTime,
});
export type CrmGuardian = z.infer<typeof CrmGuardianSchema>;

export const pageSchema = <T extends z.ZodTypeAny>(item: T) =>
    z.object({ data: z.array(item), nextCursor: z.string().nullable() });

/**
 * CSV columns (header row required, UTF-8, comma-separated, RFC 4180 quoting).
 * Nested fields are flattened with dots; lists use `|`. The CSV importer maps
 * each row back into the JSON shape above and validates it with the same schema.
 */
export const CSV_COLUMNS = {
    students: [
        'id', 'deleted', 'admissionNo', 'apaarId', 'fullName',
        'spokenFirstName.en', 'spokenFirstName.hi', 'spokenFirstName.bn', 'spokenFirstName.ne',
        'grade', 'section', 'rollNo', 'gender', 'feeCategory', 'boarding', 'transportRoute',
        'sensitiveFlags', 'status',
        // guardians as "guardianId:isPrimary:isGuardianOfRecord" joined by '|', e.g. "g1:true:true|g2:false:true"
        'guardians',
        'updatedAt',
    ],
    guardians: [
        'id', 'deleted', 'fullName', 'relation', 'phone', 'preferredLanguage',
        // each consent as "status;recordedAt;method;noticeVersion" (empty = null)
        'consent.notices', 'consent.progress', 'consent.recordedConversation', 'consent.hpcInput',
        'doNotContact', 'synthetic', 'updatedAt',
    ],
} as const;
