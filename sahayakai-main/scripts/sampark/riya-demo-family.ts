/**
 * One synthetic, English-speaking family for trying the Riya tab in Practice mode on the
 * Firestore EMULATOR (used by `seed-emulator.ts --riya-demo-family`). Pure: no I/O.
 *
 * Synthetic by construction: the phone is in the reserved `+915…` range, which is not an
 * Indian mobile series (`classifyPhone` → 'synthetic'), so no real carrier will ever dial
 * it; the Riya path additionally only dials the school test phone, and only in Test mode.
 */

import type { GuardianPreferences, SamparkGuardian, SamparkStudent } from '@/types/sampark';

export const RIYA_DEMO_STUDENT_ID = 'riya-demo-student';
export const RIYA_DEMO_GUARDIAN_ID = 'riya-demo-guardian';
export const RIYA_DEMO_PHONE = '+915000000101';

export interface PhoneCrypto {
    encrypt(e164: string): string;
    hash(e164: string): string;
}

export function riyaDemoFamily(orgId: string, nowIso: string, crypto: PhoneCrypto): {
    student: SamparkStudent;
    guardian: SamparkGuardian;
    preferences: GuardianPreferences;
} {
    const student: SamparkStudent = {
        orgId,
        id: RIYA_DEMO_STUDENT_ID,
        grade: 7,
        section: 'B',
        spokenFirstName: { English: 'Asha' },
        displayName: 'Asha Demo',
        feeCategory: 'regular',
        sensitiveFlags: [],
        boarding: false,
        transportRoute: null,
        guardianIds: [RIYA_DEMO_GUARDIAN_ID],
        primaryGuardianIds: [RIYA_DEMO_GUARDIAN_ID],
        active: true,
        crmUpdatedAt: nowIso,
        importedAt: nowIso,
    };
    const guardian: SamparkGuardian = {
        orgId,
        id: RIYA_DEMO_GUARDIAN_ID,
        displayName: 'Meena Demo (synthetic)',
        relation: 'mother',
        phoneEnc: crypto.encrypt(RIYA_DEMO_PHONE),
        phoneHash: crypto.hash(RIYA_DEMO_PHONE),
        phoneLast4: RIYA_DEMO_PHONE.slice(-4),
        phoneClass: 'synthetic',
        studentIds: [RIYA_DEMO_STUDENT_ID],
        crmLanguage: 'English',
        crmDoNotContact: false,
        active: true,
        crmUpdatedAt: nowIso,
        importedAt: nowIso,
    };
    const consent = (status: 'granted' | 'unknown') => ({ status, noticeVersion: 'local-demo', language: 'English' as const, recordedAt: nowIso, source: 'office' as const });
    const preferences: GuardianPreferences = {
        orgId,
        guardianId: RIYA_DEMO_GUARDIAN_ID,
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
