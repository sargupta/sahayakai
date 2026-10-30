/**
 * The one authorised real-call test record: student "Alyssa" and her test contact, for the
 * NON-demo emulator school `riya-test-local` (used by `seed-emulator.ts --riya-test-student`).
 * Pure: no I/O.
 *
 * Emulator only, never production: the seed refuses to run without FIRESTORE_EMULATOR_HOST.
 * The number is the user's own authorised test phone. A real Riya call still rings only the
 * school's saved test phone, and only when that number is on SAMPARK_RIYA_TEST_ALLOWED_NUMBERS.
 */

import type { GuardianPreferences, SamparkGuardian, SamparkStudent } from '@/types/sampark';

export const RIYA_TEST_ORG_ID = 'riya-test-local';
export const RIYA_TEST_ORG_NAME = 'Riya Test School (local)';
export const RIYA_TEST_STUDENT_ID = 'riya-test-student-alyssa';
export const RIYA_TEST_GUARDIAN_ID = 'riya-test-guardian-alyssa';
export const RIYA_TEST_PHONE = '+918431339732';

export interface PhoneCrypto {
    encrypt(e164: string): string;
    hash(e164: string): string;
}

export function riyaTestStudent(orgId: string, nowIso: string, crypto: PhoneCrypto): {
    student: SamparkStudent;
    guardian: SamparkGuardian;
    preferences: GuardianPreferences;
} {
    const student: SamparkStudent = {
        orgId,
        id: RIYA_TEST_STUDENT_ID,
        grade: 7,
        section: 'A',
        spokenFirstName: { English: 'Alyssa' },
        displayName: 'Alyssa',
        feeCategory: 'regular',
        sensitiveFlags: [],
        boarding: false,
        transportRoute: null,
        guardianIds: [RIYA_TEST_GUARDIAN_ID],
        primaryGuardianIds: [RIYA_TEST_GUARDIAN_ID],
        active: true,
        crmUpdatedAt: nowIso,
        importedAt: nowIso,
    };
    const guardian: SamparkGuardian = {
        orgId,
        id: RIYA_TEST_GUARDIAN_ID,
        displayName: 'Alyssa (test contact)',
        relation: 'other',
        phoneEnc: crypto.encrypt(RIYA_TEST_PHONE),
        phoneHash: crypto.hash(RIYA_TEST_PHONE),
        phoneLast4: RIYA_TEST_PHONE.slice(-4),
        phoneClass: 'mobile',
        studentIds: [RIYA_TEST_STUDENT_ID],
        crmLanguage: 'English',
        crmDoNotContact: false,
        active: true,
        crmUpdatedAt: nowIso,
        importedAt: nowIso,
    };
    const consent = (status: 'granted' | 'unknown') => ({ status, noticeVersion: 'local-test', language: 'English' as const, recordedAt: nowIso, source: 'office' as const });
    const preferences: GuardianPreferences = {
        orgId,
        guardianId: RIYA_TEST_GUARDIAN_ID,
        language: 'English',
        consent: {
            notices: consent('granted'),
            progress: consent('unknown'),
            recorded_conversation: consent('granted'),
            hpc_input: consent('unknown'),
        },
        updatedAt: nowIso,
        updatedBy: 'seed-emulator',
    };
    return { student, guardian, preferences };
}
