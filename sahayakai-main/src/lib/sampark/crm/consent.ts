/**
 * The consent LIST (R2-4d): the school's record of who agreed to which kind of
 * call, as one row per guardian per purpose group — from the feed (an MCP tool
 * or REST endpoint named in the saved mapping) or from a consent CSV.
 *
 * Row shape (CSV columns are the same names; `guardian` may also be spelt
 * `guardianId`, `studentAdmissionNo` also `admissionNo`):
 *
 *   guardian            the CRM guardian id          } at least ONE of these three identifies
 *   phone               the guardian's mobile        } the guardian. Priority: guardian, phone,
 *   studentAdmissionNo  the student's admission no   } student. A phone shared by two guardians, or an
 *                                                      admission number shared by two students, is
 *                                                      AMBIGUOUS and the row is rejected, never guessed.
 *   purposeGroup        notices | progress | recorded_conversation | hpc_input
 *                       (recordedConversation / hpcInput accepted)
 *   status              granted | denied | unknown
 *   recordedAt          ISO date-time with offset (optional)
 *   method              admission_form | parent_form | office | app | unknown (optional)
 *   noticeVersion       the notice text version the family agreed to (optional)
 *
 * An admission number identifies the student's PRIMARY guardian of record only:
 * consent is personal, so it is never spread to every guardian on file.
 *
 * Applying rows. A row replaces the guardian's own `consent.<group>` from the
 * feed only if it is NEWER (by recordedAt; a row with no date is older than any
 * dated record). On equal dates the more restrictive status wins
 * (denied > unknown > granted), so conflicting records fail closed.
 * Rows that fail validation or match no guardian are rejected with a reason in
 * the import's rejected-rows report; a guardian with no consent record keeps
 * `consent.* = null`, which the policy gate treats as "no consent" (blocked).
 */

import { z } from 'zod';

import { CSV_ERROR_KEY, CSV_ROW_KEY } from '@/lib/sampark/crm/csv-source';
import { CrmConsentSchema, type CrmGuardian, type CrmStudent } from '@/lib/sampark/crm/schema';
import { normalizeIndianPhone } from '@/lib/sampark/phone';
import type { ImportRejectedRow } from '@/types/sampark';

type CrmConsentKey = keyof CrmGuardian['consent'];

const GROUP_ALIASES: Record<string, CrmConsentKey> = {
    notices: 'notices',
    progress: 'progress',
    recorded_conversation: 'recordedConversation',
    recordedConversation: 'recordedConversation',
    hpc_input: 'hpcInput',
    hpcInput: 'hpcInput',
};

const optionalId = z.string().trim().min(1).nullish();

export const CrmConsentRowSchema = CrmConsentSchema.extend({
    guardian: optionalId,
    phone: optionalId,
    studentAdmissionNo: optionalId,
    purposeGroup: z.string().refine((g) => Object.prototype.hasOwnProperty.call(GROUP_ALIASES, g), 'purposeGroup must be notices, progress, recorded_conversation or hpc_input'),
    recordedAt: CrmConsentSchema.shape.recordedAt.optional().transform((v) => v ?? null),
    method: CrmConsentSchema.shape.method.optional().transform((v) => v ?? null),
    noticeVersion: CrmConsentSchema.shape.noticeVersion.optional().transform((v) => v ?? null),
}).refine((r) => Boolean(r.guardian || r.phone || r.studentAdmissionNo), {
    message: 'row names no guardian: give guardian, phone or studentAdmissionNo',
    path: ['guardian'],
});
export type CrmConsentRow = z.infer<typeof CrmConsentRowSchema>;

export interface ConsentTarget {
    crm: CrmGuardian;
    e164: string;
}

const STRICTNESS: Record<'granted' | 'unknown' | 'denied', number> = { granted: 1, unknown: 2, denied: 3 };

function instant(v: string | null): number {
    if (v === null) return Number.NEGATIVE_INFINITY;
    const t = Date.parse(v);
    return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/** True when `next` should replace `current` (newer, or equally dated and stricter). */
function supersedes(next: { status: keyof typeof STRICTNESS; recordedAt: string | null }, current: { status: keyof typeof STRICTNESS; recordedAt: string | null } | null): boolean {
    if (!current) return true;
    const a = instant(next.recordedAt);
    const b = instant(current.recordedAt);
    if (a !== b) return a > b;
    return STRICTNESS[next.status] > STRICTNESS[current.status];
}

function zodReason(err: z.ZodError): string {
    const issue = err.issues[0];
    if (!issue) return 'invalid consent row';
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
}

/**
 * Apply raw consent rows over the validated guardians IN PLACE (each target's `crm.consent` is replaced by a new
 * object). Returns the rejected rows and how many rows took effect.
 */
export function applyConsentRows(
    rawRows: readonly unknown[],
    guardians: Map<string, ConsentTarget>,
    students: Map<string, CrmStudent>,
): { rejected: ImportRejectedRow[]; applied: number } {
    const rejected: ImportRejectedRow[] = [];
    let applied = 0;

    const byPhone = new Map<string, string[]>();
    for (const [id, g] of guardians) byPhone.set(g.e164, [...(byPhone.get(g.e164) ?? []), id]);
    const byAdmission = new Map<string, string[]>();
    for (const s of students.values()) byAdmission.set(s.admissionNo, [...(byAdmission.get(s.admissionNo) ?? []), s.id]);

    for (const raw of rawRows) {
        const rec = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
        const row = typeof rec[CSV_ROW_KEY] === 'number' ? (rec[CSV_ROW_KEY] as number) : null;
        const labelId = [rec.guardian, rec.studentAdmissionNo].find((v) => typeof v === 'string' && v !== '') as string | undefined;
        const reject = (reason: string) => rejected.push({ entity: 'consent', crmId: labelId ?? null, row, reason });

        if (typeof rec[CSV_ERROR_KEY] === 'string') {
            reject(rec[CSV_ERROR_KEY] as string);
            continue;
        }
        const parsed = CrmConsentRowSchema.safeParse(raw);
        if (!parsed.success) {
            reject(zodReason(parsed.error));
            continue;
        }
        const r = parsed.data;

        // Who is this row about?
        let targetId: string | null = null;
        if (r.guardian) {
            if (!guardians.has(r.guardian)) {
                reject('no matching guardian in this import');
                continue;
            }
            targetId = r.guardian;
        } else if (r.phone) {
            const e164 = normalizeIndianPhone(r.phone);
            const hits = e164 ? (byPhone.get(e164) ?? []) : [];
            if (hits.length === 0) {
                reject('no matching guardian in this import');
                continue;
            }
            if (hits.length > 1) {
                reject('phone matches more than one guardian; give the guardian id');
                continue;
            }
            targetId = hits[0] as string;
        } else if (r.studentAdmissionNo) {
            const hits = byAdmission.get(r.studentAdmissionNo) ?? [];
            if (hits.length === 0) {
                reject('no student with that admission number in this import');
                continue;
            }
            if (hits.length > 1) {
                reject('admission number matches more than one student');
                continue;
            }
            const student = students.get(hits[0] as string) as CrmStudent;
            const primary = student.guardians.find((l) => l.isPrimary && l.isGuardianOfRecord && guardians.has(l.guardianId));
            if (!primary) {
                reject("student has no primary guardian of record in this import");
                continue;
            }
            targetId = primary.guardianId;
        }
        const target = guardians.get(targetId as string) as ConsentTarget;

        const key = GROUP_ALIASES[r.purposeGroup] as CrmConsentKey;
        const next = { status: r.status, recordedAt: r.recordedAt, method: r.method, noticeVersion: r.noticeVersion };
        if (supersedes(next, target.crm.consent[key])) {
            target.crm = { ...target.crm, consent: { ...target.crm.consent, [key]: next } };
            applied++;
        }
    }
    return { rejected, applied };
}
