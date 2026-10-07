import type { CrmGuardian, CrmSchool, CrmStudent } from './contract/crm-schema';
import type {
    AssessmentRecord,
    AttendanceRecord,
    Communication,
    HpcEntry,
    Incident,
    MeetingRequest,
    Rsvp,
    SchoolEvent,
} from './schemas';

export const STATE_VERSION = 1;

/**
 * Ids of the deliberately planted cases, so tests, the README and the exported
 * fixtures can point at them without hard-coding generator internals.
 */
export interface PlantedManifest {
    siblings: { studentIds: [string, string]; guardianIds: string[]; note: string };
    blendedFamily: { stepChildId: string; jointChildId: string; motherId: string; stepParentId: string; note: string };
    counsellorReferral: { studentId: string };
    custodyRestriction: { studentId: string };
    doNotContactGuardian: { guardianId: string; studentId: string };
    nullLanguageGuardians: string[];
    leftStudent: { studentId: string };
    tombstones: { studentIds: string[]; guardianIds: string[] };
    malformed: { studentIds: string[]; guardianIds: string[]; reasons: Record<string, string> };
    rteStudents: string[];
    plantedRteStudents: string[];
    missingSpokenNames: { studentId: string; missing: string[] }[];
    boarders: string[];
    csvQuotingGuardian: { guardianId: string; fullName: string };
    consentExamples: { deniedGuardianId: string; unknownNullGuardianId: string; unknownStatusGuardianId: string };
    attendance: {
        absenceStreak: { studentId: string; dates: string[] };
        lowAttendance: { studentId: string; presentRate: number };
    };
    assessments: {
        sustainedDrop: { studentId: string; averages: Record<string, number> };
        missedTest: { studentId: string; assessmentId: string };
    };
    hpc: {
        conductShouldTrigger: { studentId: string; entryIds: string[] };
        staffOnlyMustNotTrigger: { studentId: string; entryIds: string[] };
        positiveRecognition: { studentId: string; entryIds: string[] };
        counsellorConfidential: { studentId: string; entryIds: string[] };
    };
    events: { ptm7B: string; annualDay: string; closure: string };
    meetings: { sustainedDropRequest: string };
}

export interface CrmState {
    version: typeof STATE_VERSION;
    seed: string;
    /** The IST date the data is anchored to ("today" for attendance streaks, recency, etc.). */
    anchorDate: string;
    school: CrmSchool;
    students: CrmStudent[];
    guardians: CrmGuardian[];
    /** Records that deliberately fail the contract. Served only with ?includeMalformed=true. */
    malformed: { students: Record<string, unknown>[]; guardians: Record<string, unknown>[] };
    hpcEntries: HpcEntry[];
    attendance: AttendanceRecord[];
    assessments: AssessmentRecord[];
    events: SchoolEvent[];
    meetings: MeetingRequest[];
    incidents: Incident[];
    communications: Communication[];
    rsvps: Rsvp[];
    counters: { hpc: number; event: number; meeting: number; incident: number; communication: number; rsvp: number };
    planted: PlantedManifest;
}
