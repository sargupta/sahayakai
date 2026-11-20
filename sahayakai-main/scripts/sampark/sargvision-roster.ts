/**
 * Builds the Sargvision sample-class records (local emulator test roster). The real roster, with
 * the team's own numbers, lives in scripts/sampark/sargvision-roster.local.json, which git ignores
 * (the repository is public). Without it the example roster is used: same people, made-up numbers
 * that real-call mode refuses (see `rosterSource`). Pure: no I/O besides reading the file.
 *
 * Each contact is a real local test contact, not a pupil with parents: the Sampark model rings a
 * guardian record about a student record, so each person is stored as a student (themself, in the
 * Sargvision class) and one contact record (relation 'other', "<name> (contact)") holding their own
 * number. No parent relationship is recorded.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { normalizeIndianPhone } from '@/lib/sampark/phone';
import { SARGVISION_GRADE, SARGVISION_ORG_ID, SARGVISION_SECTION, sargvisionGuardianId } from '@/lib/sampark/sargvision';
import type { GuardianPreferences, SamparkGuardian, SamparkStudent } from '@/types/sampark';

export interface RosterContact {
    id: string;
    name: string;
    phone: string;
}

export interface Roster {
    orgId: string;
    contacts: RosterContact[];
}

export const LOCAL_ROSTER_FILE = join('scripts', 'sampark', 'sargvision-roster.local.json');
export const EXAMPLE_ROSTER_FILE = join('scripts', 'sampark', 'sargvision-roster.example.json');

/** The local roster when present (real numbers), else the example (made-up numbers, never dialled). */
export function rosterSource(root = process.cwd()): { file: string; real: boolean } {
    const local = join(root, LOCAL_ROSTER_FILE);
    return existsSync(local) ? { file: local, real: true } : { file: join(root, EXAMPLE_ROSTER_FILE), real: false };
}

export function readRoster(file = rosterSource().file): Roster {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Roster;
    return validateRoster(raw);
}

/** Refuses a roster that is not exactly what the local test allows: our org, unique ids, Indian mobile E.164 numbers. */
export function validateRoster(raw: Roster): Roster {
    if (raw.orgId !== SARGVISION_ORG_ID) throw new Error(`roster orgId must be ${SARGVISION_ORG_ID}`);
    const ids = new Set<string>();
    const phones = new Set<string>();
    for (const c of raw.contacts) {
        if (!/^sv-[a-z0-9-]{1,40}$/.test(c.id) || ids.has(c.id)) throw new Error(`bad or duplicate roster id ${c.id}`);
        if (normalizeIndianPhone(c.phone) !== c.phone || !/^\+91[6-9]\d{9}$/.test(c.phone) || phones.has(c.phone)) throw new Error(`roster ${c.id}: phone must be a unique +91 mobile in E.164`);
        if (!c.name.trim() || c.name.length > 60) throw new Error(`roster ${c.id}: bad name`);
        ids.add(c.id);
        phones.add(c.phone);
    }
    return raw;
}

export interface PhoneCrypto {
    encrypt(e164: string): string;
    hash(e164: string): string;
}

export function sargvisionRecords(roster: Roster, nowIso: string, crypto: PhoneCrypto): {
    students: SamparkStudent[];
    guardians: SamparkGuardian[];
    preferences: GuardianPreferences[];
} {
    const students: SamparkStudent[] = [];
    const guardians: SamparkGuardian[] = [];
    const preferences: GuardianPreferences[] = [];
    const consent = (status: 'granted' | 'unknown') => ({ status, noticeVersion: 'sargvision-local-test', language: 'English' as const, recordedAt: nowIso, source: 'office' as const });
    for (const c of roster.contacts) {
        const guardianId = sargvisionGuardianId(c.id);
        students.push({
            orgId: roster.orgId,
            id: c.id,
            grade: SARGVISION_GRADE,
            section: SARGVISION_SECTION,
            spokenFirstName: { English: c.name },
            displayName: c.name,
            feeCategory: 'regular',
            sensitiveFlags: [],
            boarding: false,
            transportRoute: null,
            guardianIds: [guardianId],
            primaryGuardianIds: [guardianId],
            active: true,
            crmUpdatedAt: nowIso,
            importedAt: nowIso,
        });
        guardians.push({
            orgId: roster.orgId,
            id: guardianId,
            displayName: `${c.name} (contact)`,
            relation: 'other',
            phoneEnc: crypto.encrypt(c.phone),
            phoneHash: crypto.hash(c.phone),
            phoneLast4: c.phone.slice(-4),
            phoneClass: 'mobile',
            studentIds: [c.id],
            crmLanguage: 'English',
            crmDoNotContact: false,
            active: true,
            crmUpdatedAt: nowIso,
            importedAt: nowIso,
        });
        // The team agreed to these local test calls (user's instruction, 2026-10-29); recorded here
        // so the calling gate's consent rule passes for this roster only. Progress consent (the four
        // outreach reasons: absence, academic, behaviour, achievement) confirmed by the user for the
        // Sargvision team on 2026-11-09. hpc_input stays unknown: never asked.
        preferences.push({
            orgId: roster.orgId,
            guardianId,
            language: 'English',
            consent: {
                notices: consent('granted'),
                progress: consent('granted'),
                recorded_conversation: consent('granted'),
                hpc_input: consent('unknown'),
            },
            updatedAt: nowIso,
            updatedBy: 'seed-emulator',
        });
    }
    return { students, guardians, preferences };
}
