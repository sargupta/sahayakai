/**
 * SamparkAI demo school — types.
 *
 * The demo is a self-contained walk-through of teacher and admin parent calls
 * on a fictional school. Nothing here touches Firestore, a carrier or a real
 * family: the school is generated in `school.ts`, calls live in the viewer's
 * browser (`store.ts`), and the only server work is the AI agent's replies and
 * the post-call summary (`/api/sampark-demo/*`, behind SAMPARK_DEMO_ENABLED).
 */

import type { CallbackStatus } from '@/lib/sampark/callbacks/types';
import type { OutreachReason } from '@/types/attendance';
import type { Campaign } from '@/types/sampark';

export type DemoLanguage = 'en' | 'hi';

export interface DemoTeacher {
    id: string;
    name: string;
    /** How parents hear the teacher named on a call ("Rai ma'am"). */
    spokenName: string;
    subject: string;
    classIds: string[];
}

export interface DemoAdmin {
    id: string;
    name: string;
    title: string;
}

export interface DemoClass {
    id: string;
    name: string;
    grade: number;
    section: string;
    teacherId: string;
    subject: string;
}

export interface DemoGuardian {
    name: string;
    relation: 'Mother' | 'Father' | 'Guardian';
    phoneLast4: string;
    language: DemoLanguage;
}

export interface DemoStudent {
    id: string;
    name: string;
    classId: string;
    roll: number;
    attendancePct: number;
    consecutiveAbsences: number;
    /** Average of the last three tests, out of 100. */
    recentScore: number;
    /** Change against the term before, in points. */
    scoreChange: number;
    /** A behaviour note the class teacher logged this month, if any. */
    behaviourNote: string | null;
    /** An achievement worth a positive call, if any. */
    achievement: string | null;
    guardian: DemoGuardian;
}

export interface DemoSchool {
    id: string;
    name: string;
    city: string;
    admin: DemoAdmin;
    teachers: DemoTeacher[];
    classes: DemoClass[];
    students: DemoStudent[];
}

export type DemoRole = 'admin' | 'teacher';

export interface DemoSession {
    role: DemoRole;
    /** Set when role is 'teacher'. */
    teacherId: string | null;
}

export interface DemoTurn {
    role: 'agent' | 'parent';
    text: string;
}

export type DemoCallStatus = 'completed' | 'no_answer' | 'busy';

export type DemoSentiment = 'cooperative' | 'concerned' | 'grateful' | 'upset' | 'indifferent' | 'confused';

export interface DemoSummary {
    parentResponse: string;
    parentConcerns: string[];
    parentCommitments: string[];
    actionItemsForTeacher: string[];
    guidanceGiven: string[];
    parentSentiment: DemoSentiment;
    callQuality: 'productive' | 'brief' | 'difficult' | 'unanswered';
    followUpNeeded: boolean;
    followUpSuggestion?: string;
    /** What the parent said about the teacher or the school, stated fairly; null when nothing. */
    complaintAboutTeacher: string | null;
}

export type ComplaintStatus = 'open' | 'acknowledged' | 'resolved';

export interface DemoCall {
    id: string;
    createdAt: string;
    studentId: string;
    classId: string;
    /** The class teacher; the call shows in their log whoever placed it. */
    teacherId: string;
    placedBy: { role: DemoRole; name: string };
    reason: OutreachReason;
    note: string;
    language: DemoLanguage;
    status: DemoCallStatus;
    durationSeconds: number;
    transcript: DemoTurn[];
    summary: DemoSummary | null;
    /** Set when summary.complaintAboutTeacher is not null. */
    complaintStatus: ComplaintStatus | null;
    /** True when the replies came from the scripted fallback, not the AI. */
    offlineReplies?: boolean;
    /** A follow-up someone marked handled (summary.followUpNeeded stays as the AI wrote it). */
    followUpDone?: boolean;
}

/**
 * A call back to one family, the demo's form of SamparkAI's callback record
 * (src/lib/sampark/callbacks/types.ts): same statuses and rules — a parent's
 * request arrives as 'proposed' and never runs until a person confirms a time.
 */
export interface DemoCallback {
    id: string;
    studentId: string;
    classId: string;
    teacherId: string;
    reason: OutreachReason;
    status: CallbackStatus;
    /** Null while a parent's request still needs a time. */
    scheduledAt: string | null;
    /** The parent's own words for a request ("after 6 in the evening"), or the staff note. */
    note: string;
    source: 'parent_request' | 'staff';
    createdBy: { role: DemoRole | 'parent'; name: string };
    createdAt: string;
    /** The call this callback follows up, if any. */
    sourceCallId: string | null;
    /** The call placed when it ran. */
    resultCallId: string | null;
}

/** A class or school-wide notice campaign: SamparkAI's own Campaign record, on the demo school. */
export type DemoCampaign = Campaign & { createdByName: string };

/** What the server needs to speak for the school on one call. */
export interface DemoCallContext {
    studentName: string;
    className: string;
    subject: string;
    reason: OutreachReason;
    teacherMessage: string;
    teacherName: string;
    schoolName: string;
    parentLanguage: DemoLanguage;
}
