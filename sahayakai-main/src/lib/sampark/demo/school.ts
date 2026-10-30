/**
 * The fictional demo school: one principal, four teachers, eight classes and
 * 200 students with their parents. Every name and number is made up, and the
 * school is generated from a fixed seed so every viewer sees the same school.
 */

import type { OutreachReason } from '@/types/attendance';
import {
    SARGVISION_CLASS_ID,
    SARGVISION_CLASS_NAME,
    SARGVISION_GRADE,
    SARGVISION_ORG_ID,
    SARGVISION_SECTION,
    type SargvisionContact,
} from '@/lib/sampark/sargvision';
import type { DemoClass, DemoGuardian, DemoSchool, DemoStudent, DemoTeacher } from './types';

export const DEMO_SCHOOL_ID = 'green-valley-demo';

const TEACHERS: DemoTeacher[] = [
    { id: 't-rai', name: 'Anjali Rai', spokenName: "Rai ma'am", subject: 'Science', classIds: ['7A', '7B'] },
    { id: 't-sharma', name: 'Rohit Sharma', spokenName: 'Sharma sir', subject: 'Mathematics', classIds: ['8A', '8B'] },
    { id: 't-thapa', name: 'Priya Thapa', spokenName: "Thapa ma'am", subject: 'English', classIds: ['6A', '6B'] },
    { id: 't-khan', name: 'Imran Khan', spokenName: 'Khan sir', subject: 'Social Science', classIds: ['9A', '9B'] },
];

const FIRST_NAMES = [
    'Aarav', 'Ananya', 'Ishaan', 'Diya', 'Kabir', 'Meera', 'Rohan', 'Saanvi', 'Arjun', 'Kavya',
    'Vihaan', 'Aditi', 'Reyansh', 'Tara', 'Dev', 'Nisha', 'Pema', 'Sonam', 'Farhan', 'Zoya',
    'Aryan', 'Riya', 'Yash', 'Pooja', 'Karan', 'Sneha', 'Tenzing', 'Dolma', 'Aman', 'Ira',
    'Nikhil', 'Shreya', 'Sahil', 'Anika', 'Vivek', 'Neha', 'Ayaan', 'Mahi', 'Rahul', 'Jiya',
];
const SURNAMES = [
    'Sharma', 'Das', 'Gurung', 'Ghosh', 'Agarwal', 'Tamang', 'Roy', 'Singh', 'Chhetri', 'Paul',
    'Bose', 'Lepcha', 'Mehta', 'Sarkar', 'Rai', 'Verma', 'Qureshi', 'Ansari', 'Bhutia', 'Mondal',
];
const MOTHER_NAMES = ['Sunita', 'Rekha', 'Kalpana', 'Mina', 'Anita', 'Shabnam', 'Puja', 'Laxmi', 'Rina', 'Kiran'];
const FATHER_NAMES = ['Rajesh', 'Suresh', 'Prakash', 'Dilip', 'Anil', 'Salim', 'Bikash', 'Manoj', 'Sanjay', 'Ramesh'];

const BEHAVIOUR_NOTES = [
    'Disturbing the class during lessons and talking back when asked to stop.',
    'Got into a pushing fight with a classmate during recess.',
    'Using a phone in class twice this week after being told not to.',
    'Not submitting homework and arguing when reminded.',
    'Teasing a younger student on the school bus.',
];
const ACHIEVEMENTS = [
    'Won first prize in the inter-school science quiz.',
    'Helped a new classmate settle in and catch up on notes.',
    'Scored full marks in the last unit test.',
    'Led the class assembly with confidence.',
    'Has not missed a single homework this term.',
];

/** mulberry32: a tiny seeded PRNG, so the school is the same for everyone. */
function prng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function buildClasses(): DemoClass[] {
    const classes: DemoClass[] = [];
    for (const teacher of TEACHERS) {
        for (const id of teacher.classIds) {
            classes.push({
                id,
                name: `Class ${id.slice(0, -1)}${id.slice(-1)}`,
                grade: Number(id.slice(0, -1)),
                section: id.slice(-1),
                teacherId: teacher.id,
                subject: teacher.subject,
            });
        }
    }
    return classes.sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section));
}

/**
 * Students the walk-through relies on, pinned so their numbers do not move
 * with the generator: each one is a clear case for one of the four reasons.
 */
const FEATURED: Record<string, Partial<DemoStudent> & { name: string; guardian: DemoGuardian }> = {
    '7A-1': {
        name: 'Farhan Qureshi',
        attendancePct: 96,
        consecutiveAbsences: 0,
        recentScore: 71,
        scoreChange: -2,
        behaviourNote: 'Disturbing the class during lessons and talking back when asked to stop.',
        achievement: null,
        guardian: { name: 'Salim Qureshi', relation: 'Father', phoneLast4: '4410', language: 'hi' },
    },
    '7A-2': {
        name: 'Pema Lepcha',
        attendancePct: 68,
        consecutiveAbsences: 4,
        recentScore: 64,
        scoreChange: -6,
        behaviourNote: null,
        achievement: null,
        guardian: { name: 'Dolma Lepcha', relation: 'Mother', phoneLast4: '2291', language: 'en' },
    },
    '7A-3': {
        name: 'Ananya Ghosh',
        attendancePct: 99,
        consecutiveAbsences: 0,
        recentScore: 94,
        scoreChange: 8,
        behaviourNote: null,
        achievement: 'Won first prize in the inter-school science quiz.',
        guardian: { name: 'Rekha Ghosh', relation: 'Mother', phoneLast4: '7702', language: 'en' },
    },
    '7A-4': {
        name: 'Rohan Das',
        attendancePct: 91,
        consecutiveAbsences: 0,
        recentScore: 38,
        scoreChange: -21,
        behaviourNote: null,
        achievement: null,
        guardian: { name: 'Prakash Das', relation: 'Father', phoneLast4: '5168', language: 'hi' },
    },
};

function buildStudents(classes: DemoClass[]): DemoStudent[] {
    const rand = prng(20261029);
    const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
    const students: DemoStudent[] = [];
    for (const cls of classes) {
        const used = new Set<string>();
        for (let roll = 1; roll <= 25; roll++) {
            const featured = FEATURED[`${cls.id}-${roll}`];
            if (featured) {
                const { guardian, ...rest } = featured;
                students.push({
                    id: `${cls.id}-${roll}`,
                    classId: cls.id,
                    roll,
                    attendancePct: 90,
                    consecutiveAbsences: 0,
                    recentScore: 70,
                    scoreChange: 0,
                    behaviourNote: null,
                    achievement: null,
                    ...rest,
                    guardian,
                });
                used.add(featured.name);
                continue;
            }
            let name = '';
            do {
                name = `${pick(FIRST_NAMES)} ${pick(SURNAMES)}`;
            } while (used.has(name));
            used.add(name);
            const surname = name.split(' ')[1];
            const mother = rand() < 0.55;
            const r = rand();
            const absences = r < 0.08 ? 3 + Math.floor(rand() * 3) : r < 0.2 ? 1 : 0;
            const attendancePct = Math.round(absences >= 3 ? 62 + rand() * 14 : 84 + rand() * 15);
            const recentScore = Math.round(35 + rand() * 60);
            const scoreChange = Math.round(rand() * 24 - 14);
            students.push({
                id: `${cls.id}-${roll}`,
                name,
                classId: cls.id,
                roll,
                attendancePct,
                consecutiveAbsences: absences,
                recentScore,
                scoreChange,
                behaviourNote: rand() < 0.07 ? pick(BEHAVIOUR_NOTES) : null,
                achievement: rand() < 0.08 ? pick(ACHIEVEMENTS) : null,
                guardian: {
                    name: `${mother ? pick(MOTHER_NAMES) : pick(FATHER_NAMES)} ${surname}`,
                    relation: mother ? 'Mother' : 'Father',
                    phoneLast4: String(1000 + Math.floor(rand() * 9000)),
                    language: rand() < 0.45 ? 'hi' : 'en',
                },
            });
        }
    }
    return students;
}

/** Students kept for the live walk-through; seeded history leaves them alone. */
export const FEATURED_STUDENT_IDS: readonly string[] = Object.keys(FEATURED);

let cached: DemoSchool | null = null;
let roster: SargvisionContact[] = [];

/** The teacher who sees the Sargvision class alongside their own. */
export const SARGVISION_TEACHER_ID = 't-rai';

/**
 * Adds the Sargvision sample class (local emulator only: the server passes the roster to the demo
 * frame only when it is available) to the demo school. Calling it again with the same roster
 * changes nothing.
 */
export function registerSargvisionRoster(contacts: SargvisionContact[]): void {
    const key = (list: SargvisionContact[]) => list.map((c) => `${c.studentId}:${c.phoneLast4}`).join(',');
    if (key(contacts) === key(roster)) return;
    roster = contacts;
    cached = null;
}

function sargvisionStudents(): DemoStudent[] {
    return roster.map((c, i) => ({
        id: c.studentId,
        name: c.name,
        classId: SARGVISION_CLASS_ID,
        roll: i + 1,
        // A contact, not a pupil: no attendance, marks or notes exist, so none are shown or used.
        attendancePct: 100,
        consecutiveAbsences: 0,
        recentScore: 100,
        scoreChange: 0,
        behaviourNote: null,
        achievement: null,
        guardian: { name: c.name, relation: 'Contact', phoneLast4: c.phoneLast4, language: 'en' },
        rosterContact: { orgId: SARGVISION_ORG_ID, guardianId: c.guardianId },
    }));
}

export function getDemoSchool(): DemoSchool {
    if (cached) return cached;
    const classes = buildClasses();
    const withRoster = roster.length > 0;
    const sargvisionClass: DemoClass = {
        id: SARGVISION_CLASS_ID,
        name: SARGVISION_CLASS_NAME,
        grade: SARGVISION_GRADE,
        section: SARGVISION_SECTION,
        teacherId: SARGVISION_TEACHER_ID,
        subject: 'Sample class (local test)',
    };
    cached = {
        id: DEMO_SCHOOL_ID,
        name: 'Green Valley Public School',
        city: 'Siliguri',
        admin: { id: 'a-ghosh', name: 'Meera Ghosh', title: 'Principal' },
        teachers: withRoster
            ? TEACHERS.map((t) => (t.id === SARGVISION_TEACHER_ID ? { ...t, classIds: [...t.classIds, SARGVISION_CLASS_ID] } : t))
            : TEACHERS,
        classes: withRoster ? [...classes, sargvisionClass] : classes,
        students: [...buildStudents(classes), ...sargvisionStudents()],
    };
    return cached;
}

export function teacherById(id: string | null | undefined): DemoTeacher | undefined {
    return getDemoSchool().teachers.find((t) => t.id === id);
}

export function classById(id: string | null | undefined): DemoClass | undefined {
    return getDemoSchool().classes.find((c) => c.id === id);
}

export function studentById(id: string | null | undefined): DemoStudent | undefined {
    return getDemoSchool().students.find((s) => s.id === id);
}

/** Signals a teacher would act on, strongest first; drives the suggested reason. */
export function studentSignals(s: DemoStudent): { reason: OutreachReason; label: string }[] {
    const out: { reason: OutreachReason; label: string }[] = [];
    if (s.rosterContact) return out;
    if (s.consecutiveAbsences >= 3) out.push({ reason: 'consecutive_absences', label: `${s.consecutiveAbsences} days absent in a row` });
    if (s.scoreChange <= -10) out.push({ reason: 'poor_performance', label: `Scores down ${Math.abs(s.scoreChange)} points` });
    else if (s.recentScore < 40) out.push({ reason: 'poor_performance', label: `Low scores: ${s.recentScore}/100` });
    if (s.behaviourNote) out.push({ reason: 'behavioral_concern', label: 'Behaviour note this month' });
    if (s.achievement) out.push({ reason: 'positive_feedback', label: 'Achievement to share' });
    return out;
}
