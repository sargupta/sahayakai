/**
 * The demo school's planning data: notice campaigns (SamparkAI's own Campaign
 * records), callbacks (with SamparkAI's callback statuses) and holidays. Dates
 * are relative to "now" so the calendar always has something today, this week
 * and next week.
 */

import type { OutreachReason } from '@/types/attendance';
import type { CampaignCounts, CampaignFacts, CampaignStatus, PurposeId } from '@/types/sampark';
import { DEFAULT_CALLBACK_TIME_ZONE, zonedToUtc } from '@/lib/sampark/callbacks/time';
import { DEMO_SCHOOL_ID, classById, getDemoSchool, studentSignals, teacherById } from './school';
import type { DemoCallback, DemoCampaign, DemoCall } from './types';

const TZ = DEFAULT_CALLBACK_TIME_ZONE;
const DAY = 86_400_000;

/** YYYY-MM-DD in IST, `days` from now. */
export function istDate(now: number, days: number): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now + days * DAY));
}

/** An instant at a wall-clock time in IST, `days` from now. */
export function istAt(now: number, days: number, hour: number, minute = 0): string {
    const [y, m, d] = istDate(now, days).split('-').map(Number);
    return zonedToUtc({ year: y, month: m, day: d, hour, minute }, TZ).toISOString();
}

/** Venue names for the demo school (campaign facts carry a venue id). */
export const DEMO_VENUES: Record<string, string> = {
    hall: 'School hall',
    ground: 'Sports ground',
    lab: 'Science block',
};

function counts(c: Partial<CampaignCounts>): CampaignCounts {
    return { guardians: 0, blocked: 0, queued: 0, inFlight: 0, heardKeyFact: 0, confirmedYes: 0, declinedOrOther: 0, noAnswer: 0, failed: 0, optOuts: 0, ...c };
}

function sections(...ids: string[]) {
    return ids.map((id) => ({ grade: Number(id.slice(0, -1)), section: id.slice(-1) }));
}

interface CampaignSeed {
    id: string;
    purpose: PurposeId;
    facts: CampaignFacts;
    classIds: string[];
    status: CampaignStatus;
    notBefore: string | null;
    expiresAt: string;
    approvedAt: string | null;
    createdAt: string;
    counts: CampaignCounts;
}

export function buildSeedCampaigns(now: number): DemoCampaign[] {
    const school = getDemoSchool();
    const seeds: CampaignSeed[] = [
        {
            id: 'camp-ptm-7',
            purpose: 'ptm_invite',
            facts: { kind: 'ptm_invite', date: istDate(now, 3), time: { hour: 10, minute: 0 }, venueId: 'hall' },
            classIds: ['7A', '7B'],
            status: 'dispatching',
            notBefore: istAt(now, 0, 9, 0),
            expiresAt: istAt(now, 2, 20, 0),
            approvedAt: istAt(now, -1, 16, 30),
            createdAt: istAt(now, -1, 15, 0),
            counts: counts({ guardians: 50, blocked: 2, queued: 12, inFlight: 2, heardKeyFact: 29, confirmedYes: 23, declinedOrOther: 4, noAnswer: 5, failed: 0 }),
        },
        {
            id: 'camp-sports',
            purpose: 'event_invite',
            facts: { kind: 'event_invite', eventType: 'sports_day', date: istDate(now, 10), time: { hour: 9, minute: 0 }, venueId: 'ground' },
            classIds: [],
            status: 'scheduled',
            notBefore: istAt(now, 1, 10, 0),
            expiresAt: istAt(now, 9, 20, 0),
            approvedAt: istAt(now, 0, 8, 15),
            createdAt: istAt(now, -1, 11, 0),
            counts: counts({ guardians: 200, blocked: 4, queued: 196 }),
        },
        {
            id: 'camp-closure',
            purpose: 'emergency_closure',
            facts: { kind: 'emergency_closure', date: istDate(now, -6), reason: 'heavy_rain', busesRunning: false },
            classIds: [],
            status: 'completed',
            notBefore: istAt(now, -6, 6, 30),
            expiresAt: istAt(now, -6, 21, 0),
            approvedAt: istAt(now, -6, 6, 20),
            createdAt: istAt(now, -6, 6, 10),
            counts: counts({ guardians: 200, blocked: 3, heardKeyFact: 181, noAnswer: 14, failed: 2 }),
        },
        {
            id: 'camp-ptm-6',
            purpose: 'ptm_invite',
            facts: { kind: 'ptm_invite', date: istDate(now, -4), time: { hour: 10, minute: 30 }, venueId: 'hall' },
            classIds: ['6A', '6B'],
            status: 'completed',
            notBefore: istAt(now, -7, 10, 0),
            expiresAt: istAt(now, -5, 20, 0),
            approvedAt: istAt(now, -8, 17, 0),
            createdAt: istAt(now, -8, 16, 0),
            counts: counts({ guardians: 50, blocked: 1, heardKeyFact: 41, confirmedYes: 33, declinedOrOther: 6, noAnswer: 7, failed: 1 }),
        },
        {
            id: 'camp-science',
            purpose: 'event_invite',
            facts: { kind: 'event_invite', eventType: 'science_fair', date: istDate(now, 18), time: { hour: 11, minute: 0 }, venueId: 'lab' },
            classIds: ['8A', '8B', '9A', '9B'],
            status: 'draft',
            notBefore: null,
            expiresAt: istAt(now, 17, 20, 0),
            approvedAt: null,
            createdAt: istAt(now, 0, 9, 40),
            counts: counts({ guardians: 100 }),
        },
    ];
    return seeds.map((c) => ({
        id: c.id,
        orgId: DEMO_SCHOOL_ID,
        purpose: c.purpose,
        facts: c.facts,
        audience: { sections: sections(...c.classIds) },
        status: c.status,
        notBefore: c.notBefore,
        expiresAt: c.expiresAt,
        createdBy: school.admin.id,
        createdByName: school.admin.name,
        createdAt: c.createdAt,
        approvedBy: c.approvedAt ? school.admin.id : null,
        approvedAt: c.approvedAt,
        renderProgress: { done: c.status === 'draft' ? 0 : 8, total: 8, failures: [] },
        counts: c.counts,
        mode: 'practice',
        holdReason: null,
        updatedAt: c.approvedAt ?? c.createdAt,
    }));
}

/** School holidays (no routine calls): one this month and one next. */
export function demoHolidays(now: number): string[] {
    return [istDate(now, 5), istDate(now, 24)];
}

interface CallbackSeed {
    studentId: string;
    reason: OutreachReason;
    status: DemoCallback['status'];
    scheduledAt: string | null;
    note: string;
    source: DemoCallback['source'];
    byAdmin?: boolean;
    sourceCallId?: string | null;
    createdHoursAgo: number;
}

export function buildSeedCallbacks(now: number, calls: DemoCall[]): DemoCallback[] {
    const school = getDemoSchool();
    const callFor = (studentId: string) => calls.find((c) => c.studentId === studentId)?.id ?? null;
    const request = school.students.find((s) => s.classId === '7B' && studentSignals(s).some((x) => x.reason === 'consecutive_absences'));
    const seeds: CallbackSeed[] = [
        {
            studentId: '8B-6',
            reason: 'behavioral_concern',
            status: 'scheduled',
            scheduledAt: istAt(now, 1, 17, 30),
            note: 'Fix a time for the mother to meet the principal about her complaint.',
            source: 'staff',
            byAdmin: true,
            sourceCallId: callFor('8B-6'),
            createdHoursAgo: 2,
        },
        {
            studentId: '8A-9',
            reason: 'poor_performance',
            status: 'scheduled',
            scheduledAt: istAt(now, 0, 18, 0),
            note: 'Check the practice worksheets reached home.',
            source: 'staff',
            sourceCallId: callFor('8A-9'),
            createdHoursAgo: 20,
        },
        {
            studentId: '9A-11',
            reason: 'positive_feedback',
            status: 'scheduled',
            scheduledAt: istAt(now, 6, 18, 30),
            note: 'The father asked to hear good news too: share his improvement.',
            source: 'staff',
            sourceCallId: callFor('9A-11'),
            createdHoursAgo: 26,
        },
        ...(request
            ? [
                  {
                      studentId: request.id,
                      reason: 'consecutive_absences' as const,
                      status: 'proposed' as const,
                      scheduledAt: null,
                      note: '“Please call me after 6 in the evening, I am at work now.”',
                      source: 'parent_request' as const,
                      createdHoursAgo: 5,
                  },
              ]
            : []),
        {
            studentId: '7A-2',
            reason: 'consecutive_absences',
            status: 'completed',
            scheduledAt: istAt(now, -1, 11, 0),
            note: 'Check Pema is back and has the notes.',
            source: 'staff',
            sourceCallId: callFor('7A-2'),
            createdHoursAgo: 30,
        },
        {
            studentId: '6A-8',
            reason: 'consecutive_absences',
            status: 'missed',
            scheduledAt: istAt(now, -1, 16, 0),
            note: 'Try again after the morning call went unanswered.',
            source: 'staff',
            sourceCallId: callFor('6A-8'),
            createdHoursAgo: 28,
        },
    ];
    return seeds.flatMap((s, i) => {
        const student = school.students.find((x) => x.id === s.studentId);
        const cls = student && classById(student.classId);
        const teacher = cls && teacherById(cls.teacherId);
        if (!student || !cls || !teacher) return [];
        return [
            {
                id: `cb-seed-${i + 1}`,
                studentId: student.id,
                classId: cls.id,
                teacherId: teacher.id,
                reason: s.reason,
                status: s.status,
                scheduledAt: s.scheduledAt,
                note: s.note,
                source: s.source,
                createdBy: s.source === 'parent_request' ? { role: 'parent' as const, name: student.guardian.name } : s.byAdmin ? { role: 'admin' as const, name: school.admin.name } : { role: 'teacher' as const, name: teacher.name },
                createdAt: new Date(now - s.createdHoursAgo * 3_600_000).toISOString(),
                sourceCallId: s.sourceCallId ?? null,
                resultCallId: null,
            },
        ];
    });
}
