/**
 * Deterministic generator for "Hillview Demo School, Siliguri".
 *
 * Same seed + same anchor date ⇒ byte-identical state. No Math.random, no wall
 * clock: every timestamp is derived from the anchor date and the seeded PRNG.
 * Planted cases (README "Planted cases") are built first with fixed class
 * placements, then random families fill the remaining seats.
 *
 * Planted cases are concentrated in classes 4A, 4B, 7A and 7B, so the exported
 * fixture subset (grades 4 and 7) carries every one of them.
 */

import type { CrmGuardian, CrmSchool, CrmStudent } from './contract/crm-schema';
import { addDays, isSchoolDay, isValidDate, istInstant, schoolDaysBetween, schoolDaysEndingOn } from './calendar';
import {
    BENGALI_NAMES,
    COMMUNITIES,
    ENGLISH_NAMES,
    GUARDIAN_OTHER_FIRST_NAMES,
    HIMALAYAN_NAMES,
    HINDI_NAMES,
    NEPALI_NAMES,
    type ChildName,
    type Community,
    type Lang,
} from './names';
import { createRng, type Rng } from './prng';
import {
    HPC_ABILITIES,
    OFFICIAL_RESPONDENTS,
    type AssessmentRecord,
    type AttendanceRecord,
    type HpcEntry,
    type Incident,
    type MeetingRequest,
    type SchoolEvent,
} from './schemas';
import { STATE_VERSION, type CrmState, type PlantedManifest } from './state';

export const DEFAULT_SEED = 'hillview-demo-v1';
export const DEFAULT_ANCHOR_DATE = '2026-09-30';
export const SCHOOL_ID = 'hillview-demo';
export const SCHOOL_NAME = 'Hillview Demo School, Siliguri';

const ACADEMIC_YEAR = '2026-27';
const TERM_START = '2026-04-01';
const TERM2_START = '2026-10-01';
const ROLLOVER_END = '2026-04-10';
const SECTION_SIZE = 20;
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const SECTIONS = ['A', 'B'] as const;
const ROUTES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'] as const;
const NOTICE_VERSION = (year: number) => `hv-notice-${year}`;

/** Indicative dates for a demo calendar; festival dates follow the 2026 lunar calendar approximately. */
export const HOLIDAYS: readonly { date: string; name: string }[] = [
    { date: '2026-08-15', name: 'Independence Day' },
    { date: '2026-09-04', name: 'Janmashtami' },
    { date: '2026-09-17', name: 'Vishwakarma Puja' },
    { date: '2026-10-02', name: 'Gandhi Jayanti' },
    { date: '2026-10-16', name: 'Durga Puja break' },
    { date: '2026-10-19', name: 'Durga Puja break' },
    { date: '2026-10-20', name: 'Durga Puja break (Vijaya Dashami)' },
    { date: '2026-10-21', name: 'Durga Puja break' },
    { date: '2026-10-22', name: 'Durga Puja break' },
    { date: '2026-10-23', name: 'Durga Puja break' },
    { date: '2026-11-09', name: 'Kali Puja and Tihar' },
    { date: '2026-11-10', name: 'Bhai Tika' },
    { date: '2026-12-25', name: 'Christmas' },
    { date: '2027-01-26', name: 'Republic Day' },
];

const CLOSURE_DATE = '2026-09-16';

// ── HPC structure (NCERT/PARAKH 2025 cards) ───────────────────────────────────

type Stage = HpcEntry['stage'];
type Unit = NonNullable<HpcEntry['unit']>;

export function stageForGrade(grade: number): Stage {
    if (grade <= 2) return 'foundational';
    if (grade <= 5) return 'preparatory';
    if (grade <= 8) return 'middle';
    return 'secondary';
}

const unit = (kind: Unit['kind'], id: string, name: string): Unit => ({ kind, id, name });

export const FOUNDATIONAL_DOMAINS: readonly Unit[] = [
    unit('domain', 'physical', 'Physical Development'),
    unit('domain', 'socio_emotional', 'Socio-emotional and Ethical Development'),
    unit('domain', 'cognitive', 'Cognitive Development'),
    unit('domain', 'language_literacy', 'Language and Literacy Development'),
    unit('domain', 'aesthetic_cultural', 'Aesthetic and Cultural Development'),
    unit('domain', 'learning_habits', 'Positive Learning Habits'),
];

export const PREPARATORY_SUBJECTS: readonly Unit[] = [
    unit('subject', 'r1', 'Language R1 (English)'),
    unit('subject', 'r2', 'Language R2 (Hindi)'),
    unit('subject', 'math', 'Mathematics'),
    unit('subject', 'twau', 'The World Around Us'),
    unit('subject', 'art', 'Art Education'),
    unit('subject', 'pe', 'Physical Education and Well-being'),
];

export const MIDDLE_SUBJECTS: readonly Unit[] = [
    unit('subject', 'r1', 'Language R1 (English)'),
    unit('subject', 'r2', 'Language R2 (Hindi)'),
    unit('subject', 'r3', 'Language R3 (Nepali or Bengali)'),
    unit('subject', 'math', 'Mathematics'),
    unit('subject', 'sci', 'Science'),
    unit('subject', 'sst', 'Social Science'),
    unit('subject', 'art', 'Art Education'),
    unit('subject', 'pe', 'Physical Education and Well-being'),
    unit('subject', 'voc', 'Vocational Education'),
];

export const SECONDARY_PROJECTS: Readonly<Record<number, readonly Unit[]>> = {
    9: [
        unit('project', 'g9_water', 'Inquiry: water sources in our ward'),
        unit('project', 'g9_tea', 'Project: the tea economy of the hills and the Terai'),
        unit('project', 'g9_waste', 'Project: a waste audit of the school campus'),
        unit('project', 'g9_languages', 'Inquiry: the languages spoken in our homes'),
    ],
    10: [
        unit('project', 'g10_landslide', 'Inquiry: why the hills slide in the monsoon'),
        unit('project', 'g10_budget', 'Project: planning a household budget'),
        unit('project', 'g10_solar', 'Project: solar power for the school'),
        unit('project', 'g10_oral_history', 'Project: oral histories of Siliguri'),
    ],
};

export function unitsForGrade(grade: number): readonly Unit[] {
    const stage = stageForGrade(grade);
    if (stage === 'foundational') return FOUNDATIONAL_DOMAINS;
    if (stage === 'preparatory') return PREPARATORY_SUBJECTS;
    if (stage === 'middle') return MIDDLE_SUBJECTS;
    return SECONDARY_PROJECTS[grade] ?? [];
}

const RUBRIC_LABELS = ['Beginner', 'Proficient', 'Advanced'] as const;

const TEACHER_NOTES: Record<HpcEntry['sentiment'], readonly string[]> = {
    positive: [
        'Explained the main idea to the group clearly.',
        'Asked a thoughtful question that moved the class discussion on.',
        'Helped a classmate finish the task without being asked.',
        'Completed the project work with care and original ideas.',
        'Took the lead in the group activity and shared the work fairly.',
        'Shows steady improvement in reading aloud.',
    ],
    neutral: [
        'Completes class work on time; needs reminders to check answers.',
        'Participates when called on; rarely volunteers.',
        'Understands the basics; needs more practice with word problems.',
        'Works well alone; still learning to share ideas in a group.',
        'Homework mostly complete this fortnight.',
    ],
    concern: [
        'Found it hard to stay focused during group work this week.',
        'Has not submitted the last two assignments.',
        'Seemed withdrawn in class this week; will keep observing.',
        'Needs support with basic number facts.',
        'Was disruptive during the lab session.',
    ],
};

const STAFF_NOTES: Record<'bus_attendant' | 'coach' | 'librarian', Record<HpcEntry['sentiment'], readonly string[]>> = {
    bus_attendant: {
        positive: ['Helps younger children find their seats on the bus.', 'Always ready at the stop on time.'],
        neutral: ['Boards and gets off the bus without fuss.'],
        concern: ['Stood up and shouted while the bus was moving.', 'Left the seat repeatedly during the ride home.'],
    },
    coach: {
        positive: ['Showed real sportsmanship in the inter-house football match.', 'Trained hard for the relay and encouraged the team.'],
        neutral: ['Attends practice regularly.'],
        concern: ['Missed warm-up twice this week.'],
    },
    librarian: {
        positive: ['Borrowed and finished four books this month.', 'Helped arrange the reading corner.'],
        neutral: ['Visits the library during free periods.'],
        concern: ['Library book overdue by three weeks.'],
    },
};

// ── Assessments ──────────────────────────────────────────────────────────────

const ASSESSMENTS = [
    { id: 'PT1', name: 'Periodic Test 1', start: '2026-05-18', maxPrep: 20, maxOther: 40 },
    { id: 'PT2', name: 'Periodic Test 2', start: '2026-07-20', maxPrep: 20, maxOther: 40 },
    { id: 'HY', name: 'Half-Yearly Examination', start: '2026-09-21', maxPrep: 50, maxOther: 80 },
] as const;

function assessedSubjects(grade: number): readonly { id: string; name: string }[] {
    const stage = stageForGrade(grade);
    if (stage === 'foundational') return [];
    const core = [
        { id: 'eng', name: 'English' },
        { id: 'hin', name: 'Hindi' },
        { id: 'math', name: 'Mathematics' },
    ];
    if (stage === 'preparatory') return [...core, { id: 'twau', name: 'The World Around Us' }];
    if (stage === 'middle') {
        return [...core, { id: 'r3', name: 'Third Language (Nepali or Bengali)' }, { id: 'sci', name: 'Science' }, { id: 'sst', name: 'Social Science' }];
    }
    return [...core, { id: 'sci', name: 'Science' }, { id: 'sst', name: 'Social Science' }];
}

// ── Building blocks ──────────────────────────────────────────────────────────

type Consent = NonNullable<CrmGuardian['consent']['notices']>;
type Relation = CrmGuardian['relation'];
type FeeCategory = CrmStudent['feeCategory'];
type SensitiveFlag = CrmStudent['sensitiveFlags'][number];

interface Link {
    guardian: CrmGuardian;
    isPrimary: boolean;
    isGuardianOfRecord: boolean;
}

interface DraftStudent {
    grade: number;
    section: string;
    name: ChildName;
    surname: string;
    links: Link[];
    omitSpoken: Lang[];
    feeCategory: FeeCategory;
    boarding: boolean;
    transportRoute: string | null;
    sensitiveFlags: SensitiveFlag[];
    status: 'active' | 'left';
    deleted: boolean;
    admissionYear: number;
    apaarId: string | null;
    updatedAt: string;
    /** Set once ids are assigned. */
    id?: string;
}

interface Ctx {
    rng: Rng;
    anchor: string;
    offDays: ReadonlySet<string>;
    guardians: CrmGuardian[];
    phones: Set<string>;
    drafts: DraftStudent[];
    seats: Map<string, number>;
}

const pad = (n: number, width: number) => String(n).padStart(width, '0');
/** Code-unit order: independent of the host's ICU collation, so ids are stable everywhere. */
const ordinal = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const seatKey = (grade: number, section: string) => `${grade}${section}`;

function findName(pool: readonly ChildName[], en: string, gender: ChildName['gender']): ChildName {
    const hit = pool.find((c) => c.en === en && c.gender === gender);
    if (!hit) throw new Error(`name not in pool: ${en} (${gender})`);
    return hit;
}

/** A random instant during the April roll-over, when every record is promoted to the new grade. */
function rolloverInstant(rng: Rng): string {
    const day = addDays(TERM_START, rng.int(0, 9));
    return istInstant(day, rng.int(9, 16), rng.int(0, 59), rng.int(0, 59));
}

/** 15% of records were touched again later in the term. */
function recordUpdatedAt(ctx: Ctx, rng: Rng): string {
    if (rng.chance(0.15)) {
        const from = addDays(ROLLOVER_END, 1);
        const to = addDays(ctx.anchor, -3);
        const days = schoolDaysBetween(from, to, ctx.offDays);
        if (days.length > 0) return istInstant(rng.pick(days), rng.int(9, 17), rng.int(0, 59), rng.int(0, 59));
    }
    return rolloverInstant(rng);
}

function syntheticPhone(ctx: Ctx, rng: Rng): string {
    for (;;) {
        const phone = `+915${pad(rng.int(0, 999_999_999), 9)}`;
        if (!ctx.phones.has(phone)) {
            ctx.phones.add(phone);
            return phone;
        }
    }
}

function consentRecord(status: Consent['status'], method: Consent['method'], year: number, rng: Rng): Consent {
    return {
        status,
        recordedAt: istInstant(`${year}-04-${pad(rng.int(1, 12), 2)}`, rng.int(9, 16), rng.int(0, 59)),
        method,
        noticeVersion: NOTICE_VERSION(year),
    };
}

type NoticeConsentKind = 'granted' | 'denied' | 'unknown_null' | 'unknown_status';

function noticesConsent(kind: NoticeConsentKind, year: number, rng: Rng): Consent | null {
    switch (kind) {
        case 'granted':
            return consentRecord('granted', rng.chance(0.8) ? 'admission_form' : 'parent_form', year, rng);
        case 'denied':
            return consentRecord('denied', 'parent_form', year, rng);
        case 'unknown_null':
            return null;
        case 'unknown_status':
            return { status: 'unknown', recordedAt: null, method: null, noticeVersion: null };
    }
}

interface GuardianSpec {
    fullName: string;
    relation: Relation;
    language: Lang | null;
    consentYear: number;
    notices?: NoticeConsentKind;
    doNotContact?: boolean;
    updatedAt?: string;
}

function addGuardian(ctx: Ctx, spec: GuardianSpec): CrmGuardian {
    const rng = ctx.rng;
    const notices =
        spec.notices ??
        rng.weighted<NoticeConsentKind>([
            ['granted', 80],
            ['unknown_null', 6],
            ['unknown_status', 6],
            ['denied', 8],
        ]);
    const guardian: CrmGuardian = {
        id: `gdn_${pad(ctx.guardians.length + 1, 4)}`,
        fullName: spec.fullName,
        relation: spec.relation,
        phone: syntheticPhone(ctx, rng),
        preferredLanguage: spec.language,
        consent: {
            notices: noticesConsent(notices, spec.consentYear, rng),
            progress: rng.chance(0.1) ? consentRecord('granted', 'parent_form', 2026, rng) : null,
            recordedConversation: rng.chance(0.03) ? consentRecord('granted', 'parent_form', 2026, rng) : null,
            hpcInput: rng.chance(0.05) ? consentRecord('granted', 'parent_form', 2026, rng) : null,
        },
        doNotContact: spec.doNotContact ?? false,
        synthetic: true,
        updatedAt: spec.updatedAt ?? recordUpdatedAt(ctx, rng),
    };
    ctx.guardians.push(guardian);
    return guardian;
}

interface StudentSpec {
    grade: number;
    section: string;
    name: ChildName;
    surname: string;
    links: Link[];
    feeCategory?: FeeCategory;
    boarding?: boolean;
    transportRoute?: string | null;
    sensitiveFlags?: SensitiveFlag[];
    status?: 'active' | 'left';
    deleted?: boolean;
    omitSpoken?: Lang[];
    updatedAt?: string;
    /** Tombstoned duplicates do not take a seat. */
    extraSeat?: boolean;
}

function addStudent(ctx: Ctx, spec: StudentSpec): DraftStudent {
    const rng = ctx.rng;
    const key = seatKey(spec.grade, spec.section);
    if (!spec.extraSeat) {
        const taken = ctx.seats.get(key) ?? 0;
        if (taken >= SECTION_SIZE) throw new Error(`class ${key} is full`);
        ctx.seats.set(key, taken + 1);
    }
    const boarding = spec.boarding ?? (spec.grade >= 5 && rng.chance(0.04));
    const route = spec.transportRoute !== undefined ? spec.transportRoute : !boarding && rng.chance(0.63) ? rng.pick(ROUTES) : null;
    const fee: FeeCategory =
        spec.feeCategory ??
        rng.weighted<FeeCategory>([
            ['regular', 87],
            ['rte', spec.grade <= 8 ? 8 : 0],
            ['waived', 2],
            ['scholarship', 3],
            ['staff_ward', 2],
        ]);
    const joinedLater = rng.chance(0.25);
    const admissionYear = Math.min(2026, 2026 - (spec.grade - 1) + (joinedLater ? rng.int(1, 4) : 0));
    const draft: DraftStudent = {
        grade: spec.grade,
        section: spec.section,
        name: spec.name,
        surname: spec.surname,
        links: spec.links,
        omitSpoken: spec.omitSpoken ?? [],
        feeCategory: fee,
        boarding,
        transportRoute: route,
        sensitiveFlags: spec.sensitiveFlags ?? [],
        status: spec.status ?? 'active',
        deleted: spec.deleted ?? false,
        admissionYear,
        apaarId: rng.chance(0.75) ? `99${pad(rng.int(0, 9_999_999_999), 10)}` : null,
        updatedAt: spec.updatedAt ?? recordUpdatedAt(ctx, rng),
    };
    ctx.drafts.push(draft);
    return draft;
}

const both = (guardian: CrmGuardian, isPrimary: boolean): Link => ({ guardian, isPrimary, isGuardianOfRecord: true });

// ── Random families ──────────────────────────────────────────────────────────

const LANGUAGE_WEIGHTS: readonly (readonly [Lang, number])[] = [
    ['ne', 40],
    ['bn', 25],
    ['hi', 20],
    ['en', 15],
];

/**
 * Draw a family language from what is left of each language's quota, so the
 * guardian mix lands on 40/25/20/15 (planted families included) instead of
 * drifting with the dice.
 */
function familyLanguage(ctx: Ctx): Lang {
    const counts: Record<Lang, number> = { ne: 0, bn: 0, hi: 0, en: 0 };
    for (const g of ctx.guardians) if (g.preferredLanguage) counts[g.preferredLanguage] += 1;
    const next = ctx.guardians.length + 2;
    return ctx.rng.weighted(LANGUAGE_WEIGHTS.map(([lang, pct]) => [lang, Math.max(0.05, (pct / 100) * next - counts[lang])] as const));
}

function randomFamily(ctx: Ctx, grade: number, section: string): void {
    const rng = ctx.rng;
    const lang = familyLanguage(ctx);
    const community: Community = rng.pick(COMMUNITIES[lang]);
    const surname = rng.pick(community.surnames);
    const consentYear = Math.max(2017, 2026 - (grade - 1));
    const shape = rng.weighted<'both' | 'mother' | 'father' | 'other'>([
        ['both', 72],
        ['mother', 15],
        ['father', 7],
        ['other', 6],
    ]);

    const links: Link[] = [];
    if (shape === 'both') {
        const motherPrimary = rng.chance(0.6);
        const mother = addGuardian(ctx, { fullName: `${rng.pick(community.mothers)} ${surname}`, relation: 'mother', language: lang, consentYear });
        const father = addGuardian(ctx, { fullName: `${rng.pick(community.fathers)} ${surname}`, relation: 'father', language: lang, consentYear });
        links.push(both(mother, motherPrimary), both(father, !motherPrimary));
    } else if (shape === 'mother') {
        links.push(both(addGuardian(ctx, { fullName: `${rng.pick(community.mothers)} ${surname}`, relation: 'mother', language: lang, consentYear }), true));
    } else if (shape === 'father') {
        links.push(both(addGuardian(ctx, { fullName: `${rng.pick(community.fathers)} ${surname}`, relation: 'father', language: lang, consentYear }), true));
    } else {
        const relation: Relation = rng.chance(0.7) ? 'guardian' : 'other';
        links.push(both(addGuardian(ctx, { fullName: `${rng.pick(GUARDIAN_OTHER_FIRST_NAMES[lang])} ${surname}`, relation, language: lang, consentYear }), true));
    }

    const omit = (): Lang[] => (rng.chance(0.04) ? [rng.pick<Lang>(['hi', 'bn', 'ne'])] : []);
    addStudent(ctx, { grade, section, name: rng.pick(community.childNames), surname, links, omitSpoken: omit() });

    // ~10% of families have a second child, always in a different grade.
    if (rng.chance(0.1)) {
        const open = [...ctx.seats.entries()]
            .filter(([key, taken]) => taken < SECTION_SIZE && Number(key.slice(0, -1)) !== grade)
            .map(([key]) => key);
        if (open.length > 0) {
            const key = rng.pick(open);
            addStudent(ctx, {
                grade: Number(key.slice(0, -1)),
                section: key.slice(-1),
                name: rng.pick(community.childNames),
                surname,
                links: links.map((l) => ({ ...l })),
                omitSpoken: omit(),
            });
        }
    }
}

// ── Planted families (fixed placements) ──────────────────────────────────────

interface PlantedRefs {
    siblings: [DraftStudent, DraftStudent];
    siblingGuardians: CrmGuardian[];
    blendedStep: DraftStudent;
    blendedJoint: DraftStudent;
    blendedMother: CrmGuardian;
    blendedStepParent: CrmGuardian;
    counsellor: DraftStudent;
    custody: DraftStudent;
    dncGuardian: CrmGuardian;
    dncStudent: DraftStudent;
    quotedGuardian: CrmGuardian;
    nullLanguage: CrmGuardian[];
    left: DraftStudent;
    tombStudents: DraftStudent[];
    tombGuardians: CrmGuardian[];
    rte: DraftStudent[];
    missingNames: DraftStudent[];
    boarder: DraftStudent;
    absenceStreak: DraftStudent;
    lowAttendance: DraftStudent;
    drop: DraftStudent;
    missedTest: DraftStudent;
    conduct: DraftStudent;
    staffOnly: DraftStudent;
    positive: DraftStudent;
}

function plantFamilies(ctx: Ctx): PlantedRefs {
    const a = ctx.anchor;
    const recent = (daysAgo: number, hour: number) => istInstant(addDays(a, -daysAgo), hour, 15);
    const family = (lang: Lang, surname: string, mother: string | null, father: string | null, consentYear: number, extra: Partial<GuardianSpec> = {}) => {
        const out: CrmGuardian[] = [];
        if (mother) out.push(addGuardian(ctx, { fullName: `${mother} ${surname}`, relation: 'mother', language: lang, consentYear, notices: 'granted', ...extra }));
        if (father) out.push(addGuardian(ctx, { fullName: `${father} ${surname}`, relation: 'father', language: lang, consentYear, notices: 'granted', ...extra }));
        return out;
    };

    // Siblings in different grades sharing both guardians (+ a deleted duplicate record of the elder).
    const [gMother, gFather] = family('ne', 'Gurung', 'Sarita', 'Suman', 2020) as [CrmGuardian, CrmGuardian];
    const sibLinks = () => [both(gMother, true), both(gFather, false)];
    const sibYoung = addStudent(ctx, { grade: 4, section: 'A', name: findName(HIMALAYAN_NAMES, 'Pema', 'female'), surname: 'Gurung', links: sibLinks(), feeCategory: 'regular' });
    const sibElder = addStudent(ctx, { grade: 7, section: 'B', name: findName(NEPALI_NAMES, 'Aarav', 'male'), surname: 'Gurung', links: sibLinks(), feeCategory: 'regular' });
    const dupTomb = addStudent(ctx, {
        grade: 7, section: 'B', name: findName(NEPALI_NAMES, 'Aarav', 'male'), surname: 'Gurung', links: sibLinks(),
        feeCategory: 'regular', deleted: true, extraSeat: true, updatedAt: recent(2, 12),
    });

    // Blended family: the step-parent is on file for the step-child but is not a guardian of record.
    const bMother = addGuardian(ctx, { fullName: 'Madhumita Ghosh', relation: 'mother', language: 'bn', consentYear: 2020, notices: 'granted' });
    const bStep = addGuardian(ctx, { fullName: 'Partha Ghosh', relation: 'father', language: 'bn', consentYear: 2023, notices: 'granted' });
    const blendedStep = addStudent(ctx, {
        grade: 7, section: 'A', name: findName(BENGALI_NAMES, 'Ritwik', 'male'), surname: 'Das',
        links: [both(bMother, true), { guardian: bStep, isPrimary: false, isGuardianOfRecord: false }], feeCategory: 'regular',
    });
    const blendedJoint = addStudent(ctx, {
        grade: 4, section: 'B', name: findName(BENGALI_NAMES, 'Ishita', 'female'), surname: 'Ghosh',
        links: [both(bMother, true), both(bStep, false)], feeCategory: 'regular',
    });

    // Sensitive flags.
    const [cMother, cFather] = family('hi', 'Agarwal', 'Rekha', 'Manoj', 2020) as [CrmGuardian, CrmGuardian];
    const counsellor = addStudent(ctx, {
        grade: 7, section: 'A', name: findName(HINDI_NAMES, 'Kunal', 'male'), surname: 'Agarwal',
        links: [both(cMother, true), both(cFather, false)], sensitiveFlags: ['counsellor_referral'], feeCategory: 'regular',
    });
    const [kMother] = family('ne', 'Rai', 'Bimala', null, 2023) as [CrmGuardian];
    const custody = addStudent(ctx, {
        grade: 4, section: 'A', name: findName(NEPALI_NAMES, 'Kripa', 'female'), surname: 'Rai',
        links: [both(kMother, true)], sensitiveFlags: ['custody_restriction'], feeCategory: 'regular',
    });

    // Do-not-contact guardian (family request); the other guardian's name needs RFC 4180 quoting in CSV.
    const quoted = addGuardian(ctx, { fullName: 'Mary "Minnie" Thomas', relation: 'mother', language: 'en', consentYear: 2020, notices: 'granted' });
    const dnc = addGuardian(ctx, {
        fullName: 'John Thomas', relation: 'father', language: 'en', consentYear: 2020, notices: 'granted',
        doNotContact: true, updatedAt: recent(5, 11),
    });
    const dncStudent = addStudent(ctx, {
        grade: 7, section: 'B', name: findName(ENGLISH_NAMES, 'Joel', 'male'), surname: 'Thomas',
        links: [both(quoted, true), both(dnc, false)], feeCategory: 'regular',
    });

    // Guardians with no preferred language on file.
    const [n1Mother, n1Father] = [
        addGuardian(ctx, { fullName: 'Dolma Tamang', relation: 'mother', language: 'ne', consentYear: 2023, notices: 'granted' }),
        addGuardian(ctx, { fullName: 'Pasang Tamang', relation: 'father', language: null, consentYear: 2023, notices: 'granted' }),
    ];
    addStudent(ctx, { grade: 4, section: 'A', name: findName(HIMALAYAN_NAMES, 'Sonam', 'male'), surname: 'Tamang', links: [both(n1Mother, true), both(n1Father, false)] });
    const [n2Mother, n2Father] = [
        addGuardian(ctx, { fullName: 'Seema Jha', relation: 'mother', language: null, consentYear: 2023, notices: 'granted' }),
        addGuardian(ctx, { fullName: 'Vinod Jha', relation: 'father', language: 'hi', consentYear: 2023, notices: 'granted' }),
    ];
    addStudent(ctx, { grade: 4, section: 'B', name: findName(HINDI_NAMES, 'Kavya', 'female'), surname: 'Jha', links: [both(n2Mother, true), both(n2Father, false)] });
    const n3Father = addGuardian(ctx, { fullName: 'Tapas Bose', relation: 'father', language: null, consentYear: 2020, notices: 'unknown_null' });
    addStudent(ctx, { grade: 7, section: 'A', name: findName(BENGALI_NAMES, 'Soham', 'male'), surname: 'Bose', links: [both(n3Father, true)] });

    // A student who has left the school (record kept, status 'left').
    const [lMother, lFather] = family('ne', 'Chhetri', 'Sangita', 'Deepak', 2020) as [CrmGuardian, CrmGuardian];
    const left = addStudent(ctx, {
        grade: 7, section: 'A', name: findName(NEPALI_NAMES, 'Bibek', 'male'), surname: 'Chhetri',
        links: [both(lMother, true), both(lFather, false)], status: 'left', updatedAt: recent(19, 13),
    });

    // Tombstones: a withdrawn family (student + its only guardian deleted), plus the duplicate above.
    const tombGuardian = addGuardian(ctx, {
        fullName: 'Kakali Dey', relation: 'mother', language: 'bn', consentYear: 2023, notices: 'granted', updatedAt: recent(1, 11),
    });
    const withdrawn = addStudent(ctx, {
        grade: 4, section: 'B', name: findName(BENGALI_NAMES, 'Sayan', 'male'), surname: 'Dey',
        links: [both(tombGuardian, true)], deleted: true, updatedAt: recent(1, 11),
    });

    // Planted RTE-quota students.
    const [r1Mother, r1Father] = family('ne', 'Limbu', 'Mina', 'Hari', 2023) as [CrmGuardian, CrmGuardian];
    const rte4 = addStudent(ctx, { grade: 4, section: 'A', name: findName(NEPALI_NAMES, 'Sagar', 'male'), surname: 'Limbu', links: [both(r1Mother, true), both(r1Father, false)], feeCategory: 'rte' });
    const [r2Mother] = family('hi', 'Prasad', 'Poonam', null, 2020) as [CrmGuardian];
    const rte7 = addStudent(ctx, { grade: 7, section: 'B', name: findName(HINDI_NAMES, 'Neha', 'female'), surname: 'Prasad', links: [both(r2Mother, true)], feeCategory: 'rte' });

    // Spoken names not yet reviewed in some languages.
    const [m1Mother, m1Father] = family('ne', 'Pradhan', 'Laxmi', 'Kamal', 2023) as [CrmGuardian, CrmGuardian];
    const missingNe = addStudent(ctx, {
        grade: 4, section: 'A', name: findName(NEPALI_NAMES, 'Nischal', 'male'), surname: 'Pradhan',
        links: [both(m1Mother, true), both(m1Father, false)], omitSpoken: ['ne'], feeCategory: 'regular',
    });
    const [m2Mother, m2Father] = family('en', 'Mukhia', 'Esther', 'Peter', 2020) as [CrmGuardian, CrmGuardian];
    const onlyEn = addStudent(ctx, {
        grade: 7, section: 'B', name: findName(ENGLISH_NAMES, 'Daniel', 'male'), surname: 'Mukhia',
        links: [both(m2Mother, true), both(m2Father, false)], omitSpoken: ['hi', 'bn', 'ne'], feeCategory: 'regular',
    });

    // A boarder (family lives in Sikkim).
    const [bdMother, bdFather] = family('ne', 'Sherpa', 'Lhamu', 'Mingma', 2020) as [CrmGuardian, CrmGuardian];
    const boarder = addStudent(ctx, {
        grade: 7, section: 'A', name: findName(HIMALAYAN_NAMES, 'Tenzing', 'male'), surname: 'Sherpa',
        links: [both(bdMother, true), both(bdFather, false)], boarding: true, transportRoute: null, feeCategory: 'regular',
    });

    // Attendance, assessment and card plants.
    const [asMother, asFather] = family('ne', 'Thapa', 'Sunita', 'Bikram', 2023) as [CrmGuardian, CrmGuardian];
    const absenceStreak = addStudent(ctx, {
        grade: 4, section: 'B', name: findName(NEPALI_NAMES, 'Prakriti', 'female'), surname: 'Thapa',
        links: [both(asMother, true), both(asFather, false)], feeCategory: 'regular', boarding: false,
    });
    const [laMother, laFather] = family('hi', 'Yadav', 'Neelam', 'Dinesh', 2020) as [CrmGuardian, CrmGuardian];
    const lowAttendance = addStudent(ctx, {
        grade: 7, section: 'A', name: findName(HINDI_NAMES, 'Harsh', 'male'), surname: 'Yadav',
        links: [both(laMother, true), both(laFather, false)], feeCategory: 'regular', boarding: false,
    });
    const [dMother, dFather] = family('bn', 'Chakraborty', 'Sutapa', 'Debashis', 2020) as [CrmGuardian, CrmGuardian];
    const drop = addStudent(ctx, {
        grade: 7, section: 'A', name: findName(BENGALI_NAMES, 'Arnab', 'male'), surname: 'Chakraborty',
        links: [both(dMother, true), both(dFather, false)], feeCategory: 'regular', boarding: false,
    });
    const [mtMother, mtFather] = family('ne', 'Subba', 'Radhika', 'Nabin', 2020) as [CrmGuardian, CrmGuardian];
    const missedTest = addStudent(ctx, {
        grade: 7, section: 'B', name: findName(NEPALI_NAMES, 'Sabina', 'female'), surname: 'Subba',
        links: [both(mtMother, true), both(mtFather, false)], feeCategory: 'regular', boarding: false,
    });
    const [coMother, coFather] = family('hi', 'Singh', 'Kavita', 'Ajay', 2020) as [CrmGuardian, CrmGuardian];
    const conduct = addStudent(ctx, {
        grade: 7, section: 'B', name: findName(HINDI_NAMES, 'Rahul', 'male'), surname: 'Singh',
        links: [both(coMother, true), both(coFather, false)], feeCategory: 'regular', boarding: false, transportRoute: 'R2',
    });
    const [soMother, soFather] = family('bn', 'Saha', 'Rupa', 'Sudip', 2023) as [CrmGuardian, CrmGuardian];
    const staffOnly = addStudent(ctx, {
        grade: 4, section: 'A', name: findName(BENGALI_NAMES, 'Ayan', 'male'), surname: 'Saha',
        links: [both(soMother, true), both(soFather, false)], feeCategory: 'regular', boarding: false, transportRoute: 'R3',
    });
    const [poMother, poFather] = family('en', 'Lepcha', 'Grace', 'Norbu', 2023) as [CrmGuardian, CrmGuardian];
    const positive = addStudent(ctx, {
        grade: 4, section: 'B', name: findName(ENGLISH_NAMES, 'Grace', 'female'), surname: 'Lepcha',
        links: [both(poMother, true), both(poFather, false)], feeCategory: 'regular', boarding: false,
    });

    return {
        siblings: [sibYoung, sibElder],
        siblingGuardians: [gMother, gFather],
        blendedStep,
        blendedJoint,
        blendedMother: bMother,
        blendedStepParent: bStep,
        counsellor,
        custody,
        dncGuardian: dnc,
        dncStudent,
        quotedGuardian: quoted,
        nullLanguage: [n1Father, n2Mother, n3Father],
        left,
        tombStudents: [withdrawn, dupTomb],
        tombGuardians: [tombGuardian],
        rte: [rte4, rte7],
        missingNames: [missingNe, onlyEn],
        boarder,
        absenceStreak,
        lowAttendance,
        drop,
        missedTest,
        conduct,
        staffOnly,
        positive,
    };
}

// ── Finalising students ──────────────────────────────────────────────────────

function finaliseStudents(ctx: Ctx): CrmStudent[] {
    const bySection = new Map<string, DraftStudent[]>();
    for (const d of ctx.drafts) {
        const key = seatKey(d.grade, d.section);
        const list = bySection.get(key) ?? [];
        list.push(d);
        bySection.set(key, list);
    }
    const out: CrmStudent[] = [];
    let admissionSeq = 100;
    for (const grade of GRADES) {
        for (const section of SECTIONS) {
            const list = bySection.get(seatKey(grade, section)) ?? [];
            const fullName = (d: DraftStudent) => `${d.name.en} ${d.surname}`;
            // Roll numbers are alphabetical, as in most Indian schools; deleted records keep the tail.
            const ordered = [
                ...list.filter((d) => !d.deleted).sort((x, y) => ordinal(fullName(x), fullName(y)) || ordinal(x.updatedAt, y.updatedAt)),
                ...list.filter((d) => d.deleted).sort((x, y) => ordinal(x.updatedAt, y.updatedAt)),
            ];
            ordered.forEach((d, i) => {
                admissionSeq += 1;
                d.id = `stu_${pad(out.length + 1, 4)}`;
                const spoken: CrmStudent['spokenFirstName'] = {};
                for (const lang of ['en', 'hi', 'bn', 'ne'] as const) {
                    if (!d.omitSpoken.includes(lang)) spoken[lang] = d.name[lang];
                }
                const student: CrmStudent = {
                    id: d.id,
                    ...(d.deleted ? { deleted: true } : {}),
                    admissionNo: `HV/${d.admissionYear}/${pad(admissionSeq, 4)}`,
                    apaarId: d.apaarId,
                    fullName: fullName(d),
                    spokenFirstName: spoken,
                    grade: d.grade,
                    section: d.section,
                    rollNo: i + 1,
                    gender: d.name.gender,
                    feeCategory: d.feeCategory,
                    boarding: d.boarding,
                    transportRoute: d.transportRoute,
                    sensitiveFlags: d.sensitiveFlags,
                    status: d.status,
                    guardians: d.links.map((l) => ({ guardianId: l.guardian.id, isPrimary: l.isPrimary, isGuardianOfRecord: l.isGuardianOfRecord })),
                    updatedAt: d.updatedAt,
                };
                out.push(student);
            });
        }
    }
    return out;
}

function mustId(d: DraftStudent): string {
    if (!d.id) throw new Error('student id not assigned yet');
    return d.id;
}

// ── Malformed records (served only with ?includeMalformed=true) ─────────────

function malformedRecords(anchor: string, guardians: CrmGuardian[]) {
    const at = istInstant(addDays(anchor, -3), 10, 5);
    const someGuardian = guardians.find((g) => !g.deleted);
    if (!someGuardian) throw new Error('no guardian to reference');
    const badStudents: Record<string, unknown>[] = [
        {
            id: 'stu_9901',
            admissionNo: 'HV/2026/9901',
            apaarId: null,
            fullName: 'Nima Sherpa',
            spokenFirstName: { en: 'Nima', hi: 'नीमा', bn: 'নিমা', ne: 'निमा' },
            grade: 14,
            section: 'A',
            rollNo: 1,
            gender: 'male',
            feeCategory: 'regular',
            boarding: false,
            transportRoute: null,
            sensitiveFlags: [],
            status: 'active',
            guardians: [{ guardianId: someGuardian.id, isPrimary: true, isGuardianOfRecord: true }],
            updatedAt: at,
        },
        {
            id: 'stu_9902',
            admissionNo: 'HV/2026/9902',
            apaarId: null,
            fullName: 'Riya Das',
            spokenFirstName: { en: 'Riya', hi: 'रिया', bn: 'রিয়া', ne: 'रिया' },
            grade: 7,
            section: 'B',
            rollNo: 22,
            gender: 'female',
            feeCategory: 'regular',
            boarding: false,
            transportRoute: 'R4',
            sensitiveFlags: [],
            status: 'active',
            guardians: [],
            updatedAt: at,
        },
    ];
    const badGuardians: Record<string, unknown>[] = [
        {
            id: 'gdn_9901',
            fullName: 'Rakesh Gupta',
            relation: 'father',
            phone: '12345',
            preferredLanguage: 'hi',
            consent: { notices: null, progress: null, recordedConversation: null, hpcInput: null },
            doNotContact: false,
            synthetic: true,
            updatedAt: at,
        },
    ];
    return {
        records: { students: badStudents, guardians: badGuardians },
        reasons: {
            stu_9901: 'grade 14 is outside 1-12',
            stu_9902: 'no guardians (a student needs at least one)',
            gdn_9901: 'phone "12345" is not E.164',
        },
    };
}

// ── Main entry ───────────────────────────────────────────────────────────────

export interface GenerateOptions {
    seed?: string;
    /** IST date the data is anchored to. Default 2026-09-30. */
    anchorDate?: string;
}

export function generateState(options: GenerateOptions = {}): CrmState {
    const seed = options.seed ?? DEFAULT_SEED;
    const anchor = options.anchorDate ?? DEFAULT_ANCHOR_DATE;
    if (!isValidDate(anchor) || anchor < DEFAULT_ANCHOR_DATE || anchor > '2027-03-31') {
        throw new Error(`anchorDate must be a date from ${DEFAULT_ANCHOR_DATE} to 2027-03-31 (the rest of the 2026-27 year), got ${anchor}`);
    }
    const root = createRng(seed);
    const offDays = new Set<string>([...HOLIDAYS.map((h) => h.date), CLOSURE_DATE]);

    const school: CrmSchool = {
        id: SCHOOL_ID,
        name: SCHOOL_NAME,
        udise: null,
        board: 'CBSE',
        city: 'Siliguri',
        academicYear: ACADEMIC_YEAR,
        timezone: 'Asia/Kolkata',
        rubricScale: { id: 'bpa', labels: [...RUBRIC_LABELS] },
        holidays: HOLIDAYS.map((h) => ({ ...h })),
    };

    // Roster.
    const ctx: Ctx = {
        rng: root.fork('roster'),
        anchor,
        offDays,
        guardians: [],
        phones: new Set(),
        drafts: [],
        seats: new Map(GRADES.flatMap((g) => SECTIONS.map((s) => [seatKey(g, s), 0] as [string, number]))),
    };
    const refs = plantFamilies(ctx);
    for (const grade of GRADES) {
        for (const section of SECTIONS) {
            while ((ctx.seats.get(seatKey(grade, section)) ?? 0) < SECTION_SIZE) randomFamily(ctx, grade, section);
        }
    }
    const students = finaliseStudents(ctx);
    // Tombstoned guardians.
    for (const g of refs.tombGuardians) g.deleted = true;
    // Re-order guardian keys so `deleted` sits after `id`, matching the contract's field order.
    const guardians = ctx.guardians.map((g) => {
        const { id, deleted, ...rest } = g;
        return deleted ? { id, deleted, ...rest } : { id, ...rest };
    }) as CrmGuardian[];
    const malformed = malformedRecords(anchor, guardians);

    const live = students.filter((s) => !s.deleted);
    const leftOn = addDays(anchor, -19);

    // Attendance: the last 30 school days.
    const attendance = generateAttendance(root.fork('attendance'), anchor, offDays, live, refs, leftOn);
    const assessments = generateAssessments(root.fork('assessments'), anchor, offDays, live, refs, leftOn);
    const hpc = generateHpc(root.fork('hpc'), anchor, offDays, live, refs, leftOn);
    const events = generateEvents(anchor);
    const meetings = generateMeetings(root.fork('meetings'), anchor, offDays, live, refs);
    const incidents = generateIncidents(root.fork('incidents'), anchor, offDays, live);

    // Manifest.
    const firstIn7B = (pred: (g: CrmGuardian) => boolean) => {
        const inSection = live
            .filter((s) => s.grade === 7 && s.section === 'B')
            .flatMap((s) => s.guardians.map((l) => l.guardianId));
        const hit = guardians.find((g) => inSection.includes(g.id) && !g.deleted && pred(g)) ?? guardians.find((g) => !g.deleted && pred(g));
        if (!hit) throw new Error('consent example not found');
        return hit.id;
    };
    const planted: PlantedManifest = {
        siblings: {
            studentIds: [mustId(refs.siblings[0]), mustId(refs.siblings[1])],
            guardianIds: refs.siblingGuardians.map((g) => g.id),
            note: 'Class 4A and 7B share both guardians; a deleted duplicate record of the 7B child also exists.',
        },
        blendedFamily: {
            stepChildId: mustId(refs.blendedStep),
            jointChildId: mustId(refs.blendedJoint),
            motherId: refs.blendedMother.id,
            stepParentId: refs.blendedStepParent.id,
            note: 'The step-parent is linked to the step-child with isGuardianOfRecord=false.',
        },
        counsellorReferral: { studentId: mustId(refs.counsellor) },
        custodyRestriction: { studentId: mustId(refs.custody) },
        doNotContactGuardian: { guardianId: refs.dncGuardian.id, studentId: mustId(refs.dncStudent) },
        nullLanguageGuardians: refs.nullLanguage.map((g) => g.id),
        leftStudent: { studentId: mustId(refs.left) },
        tombstones: { studentIds: refs.tombStudents.map(mustId), guardianIds: refs.tombGuardians.map((g) => g.id) },
        malformed: {
            studentIds: malformed.records.students.map((r) => String(r.id)),
            guardianIds: malformed.records.guardians.map((r) => String(r.id)),
            reasons: malformed.reasons,
        },
        rteStudents: live.filter((s) => s.feeCategory === 'rte').map((s) => s.id),
        plantedRteStudents: refs.rte.map(mustId),
        missingSpokenNames: live
            .map((s) => ({ studentId: s.id, missing: (['en', 'hi', 'bn', 'ne'] as const).filter((l) => !s.spokenFirstName[l]) as string[] }))
            .filter((m) => m.missing.length > 0),
        boarders: live.filter((s) => s.boarding).map((s) => s.id),
        csvQuotingGuardian: { guardianId: refs.quotedGuardian.id, fullName: refs.quotedGuardian.fullName },
        consentExamples: {
            deniedGuardianId: firstIn7B((g) => g.consent.notices?.status === 'denied'),
            unknownNullGuardianId: firstIn7B((g) => g.consent.notices === null),
            unknownStatusGuardianId: firstIn7B((g) => g.consent.notices?.status === 'unknown'),
        },
        attendance: {
            absenceStreak: { studentId: mustId(refs.absenceStreak), dates: attendance.streakDates },
            lowAttendance: { studentId: mustId(refs.lowAttendance), presentRate: attendance.lowRate },
        },
        assessments: {
            sustainedDrop: { studentId: mustId(refs.drop), averages: assessments.dropAverages },
            missedTest: { studentId: mustId(refs.missedTest), assessmentId: 'PT2' },
        },
        hpc: hpc.planted,
        events: { ptm7B: 'evt_ptm_7b_20261010', annualDay: 'evt_annual_day_20261205', closure: `evt_closure_${CLOSURE_DATE.replace(/-/g, '')}` },
        meetings: { sustainedDropRequest: meetings.dropRequestId },
    };
    return {
        version: STATE_VERSION,
        seed,
        anchorDate: anchor,
        school,
        students,
        guardians,
        malformed: malformed.records,
        hpcEntries: hpc.entries,
        attendance: attendance.records,
        assessments: assessments.records,
        events,
        meetings: meetings.records,
        incidents,
        communications: [],
        rsvps: [],
        counters: {
            hpc: hpc.entries.length,
            event: 0,
            meeting: meetings.records.length,
            incident: incidents.length,
            communication: 0,
            rsvp: 0,
        },
        planted,
    };
}

// ── Attendance ───────────────────────────────────────────────────────────────

function generateAttendance(
    rng: Rng,
    anchor: string,
    offDays: ReadonlySet<string>,
    live: CrmStudent[],
    refs: PlantedRefs,
    leftOn: string,
): { records: AttendanceRecord[]; streakDates: string[]; lowRate: number } {
    const days = schoolDaysEndingOn(anchor, 30, offDays);
    const streakId = mustId(refs.absenceStreak);
    const lowId = mustId(refs.lowAttendance);
    const leftId = mustId(refs.left);
    const streakDates = days.slice(-4);
    const lowAbsent = new Set(rng.shuffle(days.slice(0, 25)).slice(0, 9));
    const records: AttendanceRecord[] = [];
    let lowPresent = 0;

    for (const s of live) {
        const statuses: AttendanceRecord['status'][] = [];
        const notes: boolean[] = [];
        for (const day of days) {
            let status: AttendanceRecord['status'];
            let leaveNote = false;
            if (s.id === streakId) {
                status = streakDates.includes(day) ? 'absent' : 'present';
            } else if (s.id === lowId) {
                status = lowAbsent.has(day) ? 'absent' : 'present';
                leaveNote = status === 'absent' && rng.chance(0.4);
            } else {
                status = rng.weighted<AttendanceRecord['status']>([
                    ['present', 935],
                    ['absent', 35],
                    ['late', 20],
                    ['on_leave', 10],
                ]);
                leaveNote = status === 'on_leave' || (status === 'absent' && rng.chance(0.3));
            }
            statuses.push(status);
            notes.push(leaveNote);
        }
        // Only the planted student may end on a current streak of 3+ absences.
        if (s.id !== streakId) {
            const n = statuses.length;
            if (n >= 3 && statuses.slice(n - 3).every((st) => st === 'absent')) {
                statuses[n - 1] = 'present';
                notes[n - 1] = false;
            }
        }
        days.forEach((day, i) => {
            if (s.id === leftId && day > leftOn) return;
            const status = statuses[i] ?? 'present';
            if (s.id === lowId && status !== 'absent') lowPresent += 1;
            const markedAt = istInstant(day, 9, 40 + rng.int(0, 19), rng.int(0, 59));
            records.push({
                id: `att_${day.replace(/-/g, '')}_${s.id}`,
                studentId: s.id,
                grade: s.grade,
                section: s.section,
                date: day,
                status,
                leaveNote: notes[i] ?? false,
                markedAt,
                updatedAt: markedAt,
            });
        });
    }
    return { records, streakDates, lowRate: Math.round((lowPresent / days.length) * 1000) / 1000 };
}

// ── Assessments ──────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function generateAssessments(
    rng: Rng,
    anchor: string,
    offDays: ReadonlySet<string>,
    live: CrmStudent[],
    refs: PlantedRefs,
    leftOn: string,
): { records: AssessmentRecord[]; dropAverages: Record<string, number> } {
    const dropId = mustId(refs.drop);
    const missedId = mustId(refs.missedTest);
    const leftId = mustId(refs.left);
    const records: AssessmentRecord[] = [];
    const dropTotals: Record<string, { got: number; max: number }> = {};
    const dropTarget: Record<string, number> = { PT1: 82, PT2: 61, HY: 38 };

    for (const s of live) {
        const subjects = assessedSubjects(s.grade);
        if (subjects.length === 0) continue;
        const ability = clamp(rng.normal(68, 12), 25, 97);
        const offsets = subjects.map(() => rng.normal(0, 6));
        for (const test of ASSESSMENTS) {
            const dates = schoolDaysBetween(test.start, addDays(test.start, 21), offDays);
            const max = s.grade <= 5 ? test.maxPrep : test.maxOther;
            subjects.forEach((subject, k) => {
                const date = dates[k];
                if (!date || date > anchor) return;
                if (s.id === leftId && date > leftOn) return;
                let pct: number;
                let status: AssessmentRecord['status'] = 'scored';
                if (s.id === dropId) {
                    pct = clamp((dropTarget[test.id] ?? 60) + rng.normal(0, 2.5), 0, 100);
                } else if (s.id === missedId && test.id === 'PT2') {
                    pct = 0;
                    status = 'absent';
                } else {
                    pct = clamp(ability + (offsets[k] ?? 0) + rng.normal(0, 7), 5, 100);
                    if (rng.chance(0.015)) status = 'absent';
                }
                const marks = status === 'scored' ? Math.round((pct / 100) * max * 2) / 2 : null;
                if (s.id === dropId && marks !== null) {
                    const t = (dropTotals[test.id] ??= { got: 0, max: 0 });
                    t.got += marks;
                    t.max += max;
                }
                records.push({
                    id: `asm_${test.id.toLowerCase()}_${subject.id}_${s.id}`,
                    studentId: s.id,
                    grade: s.grade,
                    subjectId: subject.id,
                    subjectName: subject.name,
                    assessmentId: test.id,
                    assessmentName: test.name,
                    date,
                    maxMarks: max,
                    marks,
                    status,
                    updatedAt: istInstant(addDays(date, rng.int(3, 6)), rng.int(15, 18), rng.int(0, 59)),
                });
            });
        }
    }
    const dropAverages = Object.fromEntries(
        Object.entries(dropTotals).map(([id, t]) => [id, Math.round((t.got / t.max) * 1000) / 10]),
    );
    return { records, dropAverages };
}

// ── Holistic progress card entries ───────────────────────────────────────────

function nearSchoolDay(date: string, anchor: string, offDays: ReadonlySet<string>): string {
    for (let d = date; d <= anchor; d = addDays(d, 1)) if (isSchoolDay(d, offDays)) return d;
    for (let d = date; ; d = addDays(d, -1)) if (isSchoolDay(d, offDays)) return d;
}

function generateHpc(
    rng: Rng,
    anchor: string,
    offDays: ReadonlySet<string>,
    live: CrmStudent[],
    refs: PlantedRefs,
    leftOn: string,
): { entries: HpcEntry[]; planted: PlantedManifest['hpc'] } {
    const entries: HpcEntry[] = [];
    const termDays = schoolDaysBetween(TERM_START, anchor, offDays);
    const quietFrom = addDays(anchor, -13);
    const leftId = mustId(refs.left);

    const push = (
        s: CrmStudent,
        observedOn: string,
        type: HpcEntry['respondent']['type'],
        fields: Pick<HpcEntry, 'unit' | 'ability' | 'rubric' | 'sentiment' | 'note' | 'reasonCode'>,
    ): string => {
        const id = `hpc_${pad(entries.length + 1, 6)}`;
        const at = istInstant(observedOn, rng.int(14, 18), rng.int(0, 59), rng.int(0, 59));
        const confidential = type === 'nurse' || type === 'counsellor';
        entries.push({
            id,
            studentId: s.id,
            academicYear: ACADEMIC_YEAR,
            term: observedOn >= TERM2_START ? 2 : 1,
            stage: stageForGrade(s.grade),
            grade: s.grade,
            unit: fields.unit,
            ability: fields.ability,
            rubric: fields.rubric,
            respondent: { type, official: (OFFICIAL_RESPONDENTS as readonly string[]).includes(type) },
            sentiment: fields.sentiment,
            note: confidential ? null : fields.note,
            confidential,
            reasonCode: fields.reasonCode,
            observedOn,
            createdAt: at,
            updatedAt: at,
        });
        return id;
    };
    const rubric = (level?: number) => {
        const l = level ?? rng.weighted<number>([[1, 25], [2, 50], [3, 25]]);
        return { scaleId: 'bpa', level: l, label: RUBRIC_LABELS[l - 1] ?? 'Proficient' };
    };
    const sentimentFor = (day: string, weights: readonly (readonly [HpcEntry['sentiment'], number])[]) =>
        // Random entries in the last 14 days are neutral, so only planted cases satisfy the 14-day rules.
        day >= quietFrom ? 'neutral' : rng.weighted(weights);
    const TEACHER_W = [['positive', 40], ['neutral', 50], ['concern', 10]] as const;
    const STAFF_W = [['positive', 45], ['neutral', 45], ['concern', 10]] as const;

    for (const s of live) {
        const units = unitsForGrade(s.grade);
        const days = s.id === leftId ? termDays.filter((d) => d <= leftOn) : termDays;
        const day = () => rng.pick(days);
        const teacherCount = rng.int(4, 5);
        for (let i = 0; i < teacherCount; i++) {
            const d = day();
            const sentiment = sentimentFor(d, TEACHER_W);
            push(s, d, 'teacher', {
                unit: rng.pick(units),
                ability: rng.pick(HPC_ABILITIES),
                rubric: rubric(),
                sentiment,
                note: rng.pick(TEACHER_NOTES[sentiment]),
                reasonCode: null,
            });
        }
        {
            const d = day();
            push(s, d, 'self', { unit: rng.pick(units), ability: rng.pick(HPC_ABILITIES), rubric: rubric(), sentiment: rng.chance(0.6) || d >= quietFrom ? 'neutral' : 'positive', note: null, reasonCode: null });
        }
        if (s.grade >= 3 && rng.chance(0.5)) {
            const d = day();
            push(s, d, 'peer', { unit: rng.pick(units), ability: rng.pick(HPC_ABILITIES), rubric: rubric(), sentiment: sentimentFor(d, STAFF_W), note: null, reasonCode: null });
        }
        if (rng.chance(0.7)) {
            const d = day();
            push(s, d, 'parent', { unit: null, ability: rng.pick(HPC_ABILITIES), rubric: null, sentiment: sentimentFor(d, STAFF_W), note: null, reasonCode: null });
        }
        const staff: ['bus_attendant' | 'coach' | 'librarian', number][] = [
            ['bus_attendant', s.transportRoute ? 0.3 : 0],
            ['coach', 0.25],
            ['librarian', 0.2],
        ];
        for (const [role, p] of staff) {
            if (!rng.chance(p)) continue;
            const d = day();
            const sentiment = sentimentFor(d, STAFF_W);
            push(s, d, role, { unit: null, ability: null, rubric: null, sentiment, note: rng.pick(STAFF_NOTES[role][sentiment]), reasonCode: null });
        }
        if (rng.chance(0.12)) {
            push(s, day(), 'nurse', {
                unit: null, ability: null, rubric: null, sentiment: 'neutral', note: null,
                reasonCode: rng.pick(['sick_bay_visit', 'first_aid', 'health_screening'] as const),
            });
        }
        if (rng.chance(0.03) && s.id !== mustId(refs.counsellor)) {
            push(s, day(), 'counsellor', { unit: null, ability: null, rubric: null, sentiment: 'neutral', note: null, reasonCode: 'wellbeing_check_in' });
        }
    }

    // Planted, all inside the last 14 days.
    const byId = new Map(live.map((s) => [s.id, s]));
    const st = (d: DraftStudent) => {
        const s = byId.get(mustId(d));
        if (!s) throw new Error('planted student missing');
        return s;
    };
    const near = (daysAgo: number) => nearSchoolDay(addDays(anchor, -daysAgo), anchor, offDays);
    const conduct = st(refs.conduct);
    const conductIds = [
        push(conduct, near(8), 'teacher', {
            unit: MIDDLE_SUBJECTS.find((u) => u.id === 'sci') ?? null, ability: 'sensitivity', rubric: rubric(2),
            sentiment: 'concern', note: 'Was disruptive during the lab session.', reasonCode: null,
        }),
        push(conduct, near(3), 'bus_attendant', {
            unit: null, ability: null, rubric: null, sentiment: 'concern', note: 'Stood up and shouted while the bus was moving.', reasonCode: null,
        }),
    ];
    const staffOnly = st(refs.staffOnly);
    const staffOnlyIds = [
        push(staffOnly, near(11), 'bus_attendant', {
            unit: null, ability: null, rubric: null, sentiment: 'concern', note: 'Left the seat repeatedly during the ride home.', reasonCode: null,
        }),
        push(staffOnly, near(4), 'bus_attendant', {
            unit: null, ability: null, rubric: null, sentiment: 'concern', note: 'Stood up and shouted while the bus was moving.', reasonCode: null,
        }),
    ];
    const positive = st(refs.positive);
    const positiveIds = [
        push(positive, near(6), 'teacher', {
            unit: PREPARATORY_SUBJECTS.find((u) => u.id === 'twau') ?? null, ability: 'creativity', rubric: rubric(3),
            sentiment: 'positive', note: 'Explained the main idea to the group clearly.', reasonCode: null,
        }),
        push(positive, near(1), 'coach', {
            unit: null, ability: null, rubric: null, sentiment: 'positive', note: 'Trained hard for the relay and encouraged the team.', reasonCode: null,
        }),
    ];
    const counsellor = st(refs.counsellor);
    const counsellorIds = [
        push(counsellor, near(10), 'counsellor', { unit: null, ability: null, rubric: null, sentiment: 'neutral', note: null, reasonCode: 'counselling_session' }),
    ];

    return {
        entries,
        planted: {
            conductShouldTrigger: { studentId: conduct.id, entryIds: conductIds },
            staffOnlyMustNotTrigger: { studentId: staffOnly.id, entryIds: staffOnlyIds },
            positiveRecognition: { studentId: positive.id, entryIds: positiveIds },
            counsellorConfidential: { studentId: counsellor.id, entryIds: counsellorIds },
        },
    };
}

// ── Events ───────────────────────────────────────────────────────────────────

function generateEvents(anchor: string): SchoolEvent[] {
    const published = (daysBefore: string, days: number) => istInstant(addDays(daysBefore, -days), 11, 0);
    const pub = (date: string, days: number) => {
        const at = published(date, days);
        // Never published "in the future" relative to the anchor.
        const cap = istInstant(anchor, 9, 0);
        return at > cap ? cap : at;
    };
    return [
        {
            id: 'evt_ptm_7b_20261010',
            kind: 'ptm',
            title: 'Parent-Teacher Meeting, Class 7B',
            audience: { kind: 'sections', sections: [{ grade: 7, section: 'B' }] },
            date: '2026-10-10',
            startTime: '10:00',
            endTime: '13:00',
            venueId: 'school_hall',
            venueName: 'School Hall',
            closure: null,
            status: 'published',
            rsvpEnabled: true,
            publishedAt: pub('2026-10-10', 14),
            updatedAt: pub('2026-10-10', 14),
        },
        {
            id: 'evt_annual_day_20261205',
            kind: 'annual_day',
            title: 'Annual Day 2026',
            audience: { kind: 'school' },
            date: '2026-12-05',
            startTime: '10:00',
            endTime: '14:00',
            venueId: 'school_ground',
            venueName: 'School Ground',
            closure: null,
            status: 'published',
            rsvpEnabled: true,
            publishedAt: pub('2026-12-05', 70),
            updatedAt: pub('2026-12-05', 70),
        },
        {
            id: `evt_closure_${CLOSURE_DATE.replace(/-/g, '')}`,
            kind: 'closure',
            title: 'School closed: heavy rain and a landslide on NH-10',
            audience: { kind: 'school' },
            date: CLOSURE_DATE,
            startTime: null,
            endTime: null,
            venueId: null,
            venueName: null,
            closure: { reason: 'landslide', emergency: true, declaredAt: istInstant(CLOSURE_DATE, 6, 10) },
            status: 'published',
            rsvpEnabled: false,
            publishedAt: istInstant(CLOSURE_DATE, 6, 12),
            updatedAt: istInstant(CLOSURE_DATE, 6, 12),
        },
    ];
}

// ── Meeting requests ─────────────────────────────────────────────────────────

function generateMeetings(
    rng: Rng,
    anchor: string,
    offDays: ReadonlySet<string>,
    live: CrmStudent[],
    refs: PlantedRefs,
): { records: MeetingRequest[]; dropRequestId: string } {
    const records: MeetingRequest[] = [];
    // Random requests are older than two weeks, so their slots are settled by the anchor date.
    const termDays = schoolDaysBetween(TERM_START, addDays(anchor, -21), offDays);
    const pool = live.filter((s) => s.status === 'active' && s.sensitiveFlags.length === 0);
    const primaryOf = (s: CrmStudent) => (s.guardians.find((l) => l.isPrimary) ?? s.guardians[0])?.guardianId ?? '';
    const slotsAfter = (day: string) => {
        const next = schoolDaysBetween(addDays(day, 2), addDays(day, 12), offDays).slice(0, 2);
        return next.map((d, i) => istInstant(d, 15, i === 0 ? 0 : 30));
    };
    for (let i = 0; i < 14; i++) {
        const s = rng.pick(pool);
        const created = rng.pick(termDays);
        const status = rng.weighted<MeetingRequest['status']>([['completed', 50], ['scheduled', 20], ['requested', 20], ['cancelled', 10]]);
        const proposedSlots = slotsAfter(created);
        const createdAt = istInstant(created, rng.int(10, 16), rng.int(0, 59));
        records.push({
            id: `mtg_${pad(records.length + 1, 4)}`,
            studentId: s.id,
            guardianId: primaryOf(s),
            requestedByRole: rng.weighted<MeetingRequest['requestedByRole']>([['class_teacher', 55], ['coordinator', 15], ['parent', 25], ['principal', 5]]),
            reasonCode: rng.weighted<MeetingRequest['reasonCode']>([['general_progress', 45], ['academic_progress', 25], ['attendance', 10], ['admission_query', 10], ['conduct', 10]]),
            status,
            proposedSlots,
            scheduledFor: status === 'scheduled' || status === 'completed' ? (proposedSlots[0] ?? null) : null,
            createdAt,
            updatedAt: createdAt,
        });
    }
    const drop = live.find((s) => s.id === mustId(refs.drop));
    if (!drop) throw new Error('drop student missing');
    const created = nearSchoolDay(addDays(anchor, -2), anchor, offDays);
    const createdAt = istInstant(created, 16, 5);
    const dropRequestId = `mtg_${pad(records.length + 1, 4)}`;
    records.push({
        id: dropRequestId,
        studentId: drop.id,
        guardianId: primaryOf(drop),
        requestedByRole: 'class_teacher',
        reasonCode: 'academic_progress',
        status: 'requested',
        proposedSlots: schoolDaysBetween(addDays(anchor, 1), addDays(anchor, 10), offDays).slice(0, 2).map((d) => istInstant(d, 15, 0)),
        scheduledFor: null,
        createdAt,
        updatedAt: createdAt,
    });
    return { records, dropRequestId };
}

// ── Incidents (reason codes only) ────────────────────────────────────────────

const INCIDENT_ROLES: Record<Incident['reasonCode'], readonly Incident['reportedByRole'][]> = {
    minor_injury: ['teacher', 'coach', 'nurse'],
    illness_sent_home: ['nurse'],
    late_pickup: ['guard'],
    bus_conduct: ['bus_attendant'],
    property_damage: ['teacher', 'coordinator'],
    bullying_reported: ['coordinator', 'teacher'],
    uniform_non_compliance: ['teacher'],
};

function generateIncidents(rng: Rng, anchor: string, offDays: ReadonlySet<string>, live: CrmStudent[]): Incident[] {
    const days = schoolDaysBetween(TERM_START, anchor, offDays);
    const out: Incident[] = [];
    const active = live.filter((s) => s.status === 'active');
    for (let i = 0; i < 40; i++) {
        const s = rng.pick(active);
        const reasonCode = rng.weighted<Incident['reasonCode']>([
            ['minor_injury', 30],
            ['illness_sent_home', 25],
            ['late_pickup', 12],
            ['bus_conduct', s.transportRoute ? 10 : 0],
            ['property_damage', 6],
            ['bullying_reported', 5],
            ['uniform_non_compliance', 12],
        ]);
        const day = rng.pick(days);
        const occurredAt = istInstant(day, rng.int(8, 15), rng.int(0, 59));
        const updatedAt = istInstant(day, 16, rng.int(0, 59));
        out.push({
            id: `inc_${pad(out.length + 1, 4)}`,
            studentId: s.id,
            occurredAt,
            reasonCode,
            severity: reasonCode === 'bullying_reported' ? 'medium' : rng.weighted<Incident['severity']>([['low', 72], ['medium', 25], ['high', 3]]),
            reportedByRole: rng.pick(INCIDENT_ROLES[reasonCode]),
            status: day >= addDays(anchor, -6) ? 'open' : 'closed',
            createdAt: occurredAt,
            updatedAt,
        });
    }
    return out;
}
