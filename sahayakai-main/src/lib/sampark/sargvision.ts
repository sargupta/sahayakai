/**
 * The Sargvision sample class: a local-emulator test roster whose contacts may receive real Riya
 * test calls on their own numbers. Client-safe: ids and labels only. The phone numbers live only
 * in scripts/sampark/sargvision-roster.json (seed + local launcher allow-list) and, encrypted, in
 * the emulator.
 */

/** The non-demo emulator school that holds the roster (`sargvision-local`). */
export const SARGVISION_ORG_ID = 'sargvision-local';
export const SARGVISION_SCHOOL_NAME = 'Sargvision (sample class, local test)';
/** The demo school's class id for the roster. */
export const SARGVISION_CLASS_ID = 'SV';
export const SARGVISION_CLASS_NAME = 'Sargvision';
/** Sampark student record shape for the roster: one sample class. */
export const SARGVISION_GRADE = 10;
export const SARGVISION_SECTION = 'A';

/** What the demo UI is given about one roster contact: no full number. */
export interface SargvisionContact {
    /** Sampark student id and demo student id (`sv-…`). */
    studentId: string;
    guardianId: string;
    name: string;
    phoneLast4: string;
}

export function sargvisionGuardianId(contactId: string): string {
    return `${contactId}-contact`;
}
