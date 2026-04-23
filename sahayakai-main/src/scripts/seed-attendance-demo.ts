/**
 * Seed script: creates a 40-student demo class covering the full range of
 * reasons a teacher calls a parent — not just attendance.
 *
 * Target users (duplicated under each teacher UID so both can review in-app):
 *   sarguptaw@gmail.com  — developer
 *   abhi.ist.15@gmail.com — key stakeholder
 *
 * Run:  npx tsx --env-file=.env.local src/scripts/seed-attendance-demo.ts
 *
 * ── Scenario mix (40 students, stratified by risk + reason) ─────────────
 *   A. Rolls  1–5   Top performers (90%+, Olympiad candidates)
 *   B. Rolls  6–10  Above-average steady (70–85%)
 *   C. Rolls 11–15  On-track average (55–70%)
 *   D. Rolls 16–20  Below-average, needs support (40–55%)
 *   E. Rolls 21–25  At-risk academically (<35% — auto-flagged)
 *   F. Rolls 26–30  Consecutive absences ladder (2, 3, 4, 5, 6 days)
 *   G. Rolls 31–33  Behavioral concerns (disruptive, peer conflict, withdrawn)
 *   H. Rolls 34–36  Language-medium struggles (strong in L1, weak in English)
 *   I. Rolls 37–38  Health-related absence patterns (sporadic medical notes)
 *   J. Roll  39     Family transition (withdrawal following life event)
 *   K. Roll  40     SEN candidate (learning-difference screening needed)
 *
 * ── What gets written per teacher ──────────────────────────────────────
 *   1. classes/{classId}                       — the demo class doc
 *   2. classes/{classId}/students/{...}        — 40 students
 *   3. classes/{classId}/assessment_batches/   — 3 batches (see below)
 *   4. classes/{classId}/students/{...}/assessments/   — per-student marks
 *                                                       matching their scenario
 *   5. attendance/{classId}/records/{date}     — 30 days of attendance
 *   6. parent_outreach/{id}                    — 12 outreach records covering
 *                                                every OutreachReason × every
 *                                                CallStatus, with specific
 *                                                teacherNote + transcript +
 *                                                callSummary referencing the
 *                                                student's actual scenario
 *
 * ── Performance wired into ParentOutreach ──────────────────────────────
 * Each outreach record now carries a `performanceContext` snapshot with the
 * student's 3 most recent assessments. The Contact-Parent modal reads this
 * on open and the AI message-generator + call agent cite specific scores
 * (e.g. "scored 14/50 in the Mathematics Mid Term") when reason is
 * poor_performance or positive_feedback.
 */

import * as admin from "firebase-admin";
import { getDb, getAuthInstance } from "@/lib/firebase-admin";
import type {
    AttendanceStatus,
    OutreachReason,
    CallStatus,
    TranscriptTurn,
    CallSummary,
} from "@/types/attendance";
import type { Language } from "@/types/index";
import type {
    AssessmentBatch,
    AssessmentType,
    CBSEGrade,
    Term,
} from "@/types/performance";

// ── Configuration ─────────────────────────────────────────────────────────────

const TARGET_EMAILS = [
    "sarguptaw@gmail.com",
    "abhi.ist.15@gmail.com",
];

/** All demo parent phones resolve to a Twilio-verified test number — no real
 *  call ever reaches a parent. */
const TEST_PHONE = "+916363740720";

/** 10 parent languages cycled across the roster (Odia excluded — no Twilio voice). */
const LANGS: Language[] = [
    "Hindi",
    "English",
    "Bengali",
    "Telugu",
    "Marathi",
    "Tamil",
    "Gujarati",
    "Kannada",
    "Punjabi",
    "Malayalam",
];

const DEMO_CLASS_NAME = "Class 6A — Demo";

// ── Student roster (40) ───────────────────────────────────────────────────────

type Scenario =
    // Performance tiers
    | "top" | "above" | "average" | "below" | "at_risk"
    // Attendance ladder
    | "absent2" | "absent3" | "absent4" | "absent5" | "absent6"
    // Behavioral
    | "disruptive" | "peer_conflict" | "withdrawn"
    // Language / Medium
    | "l1_strong_l2_weak"
    // Health
    | "chronic_medical" | "episodic_medical"
    // Family / SEN
    | "family_transition" | "sen_candidate";

interface StudentSpec {
    roll: number;
    name: string;
    scenario: Scenario;
}

const STUDENTS: StudentSpec[] = [
    // A. Top performers (rolls 1–5)
    { roll: 1, name: "Aarav Sharma",    scenario: "top" },
    { roll: 2, name: "Ananya Iyer",     scenario: "top" },
    { roll: 3, name: "Dev Patel",       scenario: "top" },
    { roll: 4, name: "Isha Menon",      scenario: "top" },
    { roll: 5, name: "Kabir Khan",      scenario: "top" },

    // B. Above-average steady (rolls 6–10)
    { roll: 6,  name: "Mira Joshi",     scenario: "above" },
    { roll: 7,  name: "Nirav Shah",     scenario: "above" },
    { roll: 8,  name: "Pooja Rao",      scenario: "above" },
    { roll: 9,  name: "Rohan Das",      scenario: "above" },
    { roll: 10, name: "Sanya Gupta",    scenario: "above" },

    // C. On-track average (rolls 11–15)
    { roll: 11, name: "Tarun Bose",     scenario: "average" },
    { roll: 12, name: "Uma Krishnan",   scenario: "average" },
    { roll: 13, name: "Vikram Reddy",   scenario: "average" },
    { roll: 14, name: "Yash Malhotra",  scenario: "average" },
    { roll: 15, name: "Zara Fernandes", scenario: "average" },

    // D. Below-average, needs support (rolls 16–20)
    { roll: 16, name: "Aditi Nair",     scenario: "below" },
    { roll: 17, name: "Bhavesh Pandit", scenario: "below" },
    { roll: 18, name: "Chaitra Kulkarni", scenario: "below" },
    { roll: 19, name: "Dhruv Chauhan",  scenario: "below" },
    { roll: 20, name: "Esha Bhatt",     scenario: "below" },

    // E. At-risk academically (<35%) (rolls 21–25)
    { roll: 21, name: "Farhan Qureshi", scenario: "at_risk" },
    { roll: 22, name: "Gauri Desai",    scenario: "at_risk" },
    { roll: 23, name: "Hiren Parmar",   scenario: "at_risk" },
    { roll: 24, name: "Ishaan Banerjee",scenario: "at_risk" },
    { roll: 25, name: "Jyoti Chakraborty", scenario: "at_risk" },

    // F. Consecutive absences ladder (rolls 26–30)
    { roll: 26, name: "Karan Jadhav",   scenario: "absent2" },
    { roll: 27, name: "Leela Pillai",   scenario: "absent3" },
    { roll: 28, name: "Manish Bhatia",  scenario: "absent4" },
    { roll: 29, name: "Neha Sengupta",  scenario: "absent5" },
    { roll: 30, name: "Omkar Naik",     scenario: "absent6" },

    // G. Behavioral concerns (rolls 31–33)
    { roll: 31, name: "Preeti Mohanty", scenario: "disruptive" },
    { roll: 32, name: "Qasim Ansari",   scenario: "peer_conflict" },
    { roll: 33, name: "Riya Mehta",     scenario: "withdrawn" },

    // H. Language / medium struggles (rolls 34–36)
    { roll: 34, name: "Sahil Chopra",   scenario: "l1_strong_l2_weak" },
    { roll: 35, name: "Tara Subramanian", scenario: "l1_strong_l2_weak" },
    { roll: 36, name: "Udit Saxena",    scenario: "l1_strong_l2_weak" },

    // I. Health (rolls 37–38)
    { roll: 37, name: "Varsha Deshmukh",scenario: "chronic_medical" },
    { roll: 38, name: "Wasim Sheikh",   scenario: "episodic_medical" },

    // J. Family transition (roll 39)
    { roll: 39, name: "Xenia Pereira",  scenario: "family_transition" },

    // K. SEN candidate (roll 40)
    { roll: 40, name: "Yogesh Thakur",  scenario: "sen_candidate" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateStr(daysAgo: number): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString("sv"); // YYYY-MM-DD local tz
}

/** Deterministic pseudo-random ∈ [0,1) per (student, seed). */
function rand(studentSeed: number, variantSeed: number): number {
    const x = Math.sin(studentSeed * 97 + variantSeed * 31) * 10000;
    return x - Math.floor(x);
}

/** Attendance status per scenario and day-offset. */
function attendanceFor(s: Scenario, daysAgo: number, roll: number): AttendanceStatus {
    switch (s) {
        case "top":
        case "above":
            return rand(roll, daysAgo) < 0.02 ? "late" : "present";

        case "average":
            if (rand(roll, daysAgo) < 0.05) return "late";
            if (rand(roll, daysAgo + 100) < 0.03) return "absent";
            return "present";

        case "below":
            if (rand(roll, daysAgo) < 0.12) return "late";
            if (rand(roll, daysAgo + 100) < 0.05) return "absent";
            return "present";

        case "at_risk":
            if (rand(roll, daysAgo) < 0.18) return "absent";
            if (rand(roll, daysAgo + 100) < 0.12) return "late";
            return "present";

        case "absent2": return daysAgo <= 1 ? "absent" : "present";
        case "absent3": return daysAgo <= 2 ? "absent" : "present";
        case "absent4": return daysAgo <= 3 ? "absent" : "present";
        case "absent5": return daysAgo <= 4 ? "absent" : "present";
        case "absent6": return daysAgo <= 5 ? "absent" : "present";

        case "disruptive":
        case "peer_conflict":
            // Good attendance — behavioral problems happen in class.
            return rand(roll, daysAgo) < 0.05 ? "late" : "present";

        case "withdrawn":
            // Quiet absenteeism pattern: 3 missed + 4 late across 30 days.
            if ([6, 13, 22].includes(daysAgo)) return "absent";
            if ([2, 9, 17, 25].includes(daysAgo)) return "late";
            return "present";

        case "l1_strong_l2_weak":
            // Full attendance — performance issue, not attendance.
            return "present";

        case "chronic_medical":
            // Patterned absences every 7–10 days (treatment cycle).
            if ([1, 8, 15, 22, 29].includes(daysAgo)) return "absent";
            return "present";

        case "episodic_medical":
            // Two discrete illness blocks of 2-day absence.
            if ([10, 11, 19, 20].includes(daysAgo)) return "absent";
            return "present";

        case "family_transition":
            // Recent pattern shift: last 7 days increasingly absent/late.
            if (daysAgo <= 1) return "absent";
            if (daysAgo <= 4) return "late";
            if (daysAgo <= 6) return rand(roll, daysAgo) < 0.5 ? "absent" : "late";
            return "present";

        case "sen_candidate":
            // Full attendance; issue surfaces in academic record + teacher notes.
            return "present";
    }
}

/** Marks target (% of max) for a student in a given subject. */
function marksPctFor(s: Scenario, subject: "Mathematics" | "Science" | "English", roll: number): number {
    const jitter = (rand(roll, subject.length) - 0.5) * 8; // ±4%
    switch (s) {
        case "top":      return Math.min(98, 92 + jitter);
        case "above":    return 78 + jitter;
        case "average":  return 62 + jitter;
        case "below":    return 48 + jitter;
        case "at_risk":  return Math.max(8, 28 + jitter);

        // Attendance-only scenarios still have academic records — mostly average
        // with slight dips reflecting the disruption.
        case "absent2": case "absent3": case "absent4":
            return 55 + jitter;
        case "absent5": case "absent6":
            return 40 + jitter;

        case "disruptive":     return 52 + jitter;
        case "peer_conflict":  return 58 + jitter;
        case "withdrawn":      return 50 + jitter;

        case "l1_strong_l2_weak":
            // The signature: strong in maths (numerical, language-light),
            // weak in English + science (text-heavy).
            if (subject === "Mathematics") return 72 + jitter;
            if (subject === "Science") return 42 + jitter;
            return 32 + jitter; // English

        case "chronic_medical":  return 55 + jitter;
        case "episodic_medical": return 66 + jitter;

        case "family_transition":
            // Slight decline from baseline average (the call would reveal the cause).
            return 50 + jitter;

        case "sen_candidate":
            // Wide spread between oral/participation and written tests
            // — we only have written-test fields, so a consistently low score.
            if (subject === "Mathematics") return 32 + jitter; // struggles with reading problems
            return 40 + jitter;
    }
}

function percentToGrade(pct: number): CBSEGrade {
    if (pct >= 91) return "A1";
    if (pct >= 81) return "A2";
    if (pct >= 71) return "B1";
    if (pct >= 61) return "B2";
    if (pct >= 51) return "C1";
    if (pct >= 41) return "C2";
    if (pct >= 33) return "D";
    return "E";
}

// ── Assessment batches (3 per class, spread across last 6 weeks) ─────────────

interface BatchSpec {
    name: string;
    type: AssessmentType;
    subject: "Mathematics" | "Science" | "English";
    maxMarks: number;
    term: Term;
    daysAgo: number;
}

const BATCH_SPECS: BatchSpec[] = [
    { name: "Unit Test 1 — Fractions & Decimals", type: "unit_test", subject: "Mathematics", maxMarks: 25, term: "term1", daysAgo: 42 },
    { name: "Unit Test 1 — Food & Nutrition",     type: "unit_test", subject: "Science",     maxMarks: 25, term: "term1", daysAgo: 28 },
    { name: "Mid Term — Mathematics",             type: "mid_term",  subject: "Mathematics", maxMarks: 50, term: "term1", daysAgo: 10 },
];

// ── ParentOutreach specs covering every reason × status ──────────────────────

interface OutreachSpec {
    studentRoll: number;
    reason: OutreachReason;
    callStatus: CallStatus;
    deliveryMethod: "twilio_call" | "whatsapp_copy";
    daysAgo: number;
    /** Specific, student-scenario-grounded text. Placeholders {name}/{class} filled below. */
    teacherNote: string;
    /** Transcript turns (parent language = inferred from roster). Agent text uses {name}. */
    transcript?: TranscriptTurn[];
    /** CallSummary is derived programmatically when summary=true. */
    summary?: {
        parentResponse: string;
        parentConcerns: string[];
        parentCommitments: string[];
        actionItemsForTeacher: string[];
        guidanceGiven: string[];
        parentSentiment: CallSummary["parentSentiment"];
        callQuality: CallSummary["callQuality"];
        followUpNeeded: boolean;
        followUpSuggestion?: string;
    };
    answeredBy?: string;
    callDurationSeconds?: number;
}

// Substitute {name}/{class}/{subject} placeholders.
function fill(template: string, opts: { name: string; className: string; subject?: string }): string {
    return template
        .replace(/\{name\}/g, opts.name)
        .replace(/\{class\}/g, opts.className)
        .replace(/\{subject\}/g, opts.subject ?? "Mathematics");
}

const OUTREACH_SPECS: OutreachSpec[] = [
    // — Positive feedback (top performer celebrated) —
    {
        studentRoll: 1,
        reason: "positive_feedback",
        callStatus: "completed",
        deliveryMethod: "twilio_call",
        daysAgo: 3,
        teacherNote:
            "{name} scored 24/25 in the Fractions unit test and helped two classmates during revision. Would like to share the good news with parents.",
        transcript: [
            { role: "agent", text: "Namaste. This is a call from {class}. I wanted to share some wonderful news about {name}.", timestamp: "" },
            { role: "parent", text: "Oh really? Tell me teacher.", timestamp: "" },
            { role: "agent", text: "{name} scored 24 out of 25 in the unit test and actually helped two classmates understand fractions during revision. That kindness matters as much as the marks.", timestamp: "" },
            { role: "parent", text: "We will tell her tonight. Thank you for calling — it means a lot.", timestamp: "" },
        ],
        summary: {
            parentResponse: "Parent was delighted; will celebrate with the child at dinner.",
            parentConcerns: [],
            parentCommitments: ["Will appreciate the child tonight.", "Continue encouraging peer-help at home."],
            actionItemsForTeacher: ["Share monthly wins with this parent."],
            guidanceGiven: ["Keep praise specific — name the behaviour, not just the grade."],
            parentSentiment: "grateful",
            callQuality: "productive",
            followUpNeeded: false,
        },
        answeredBy: "human",
        callDurationSeconds: 58,
    },

    // — Poor performance (at-risk student) — completed —
    {
        studentRoll: 21,
        reason: "poor_performance",
        callStatus: "completed",
        deliveryMethod: "twilio_call",
        daysAgo: 4,
        teacherNote:
            "{name} scored 6/25 in the last Mathematics unit test. Missed three homework submissions in the last two weeks. Want to understand what support is available at home.",
        transcript: [
            { role: "agent", text: "Namaste. This is from {class}. I want to discuss {name}'s progress in maths.", timestamp: "" },
            { role: "parent", text: "Yes teacher, I know his marks have dropped. At home he says he does not understand.", timestamp: "" },
            { role: "agent", text: "He scored 6 out of 25 in the unit test and is falling behind on homework. If we sit with him for 20 minutes a day on fractions, we can close this gap before the mid-term. Would that be possible?", timestamp: "" },
            { role: "parent", text: "Yes, my elder daughter can help him. Please send the topics.", timestamp: "" },
            { role: "agent", text: "I will send a list today. Also — if he is nervous in class, please encourage him to ask me in private. Sometimes that helps.", timestamp: "" },
        ],
        summary: {
            parentResponse: "Parent acknowledged performance drop; committed to daily home practice.",
            parentConcerns: ["Child says he does not understand the topic.", "Homework feels overwhelming."],
            parentCommitments: ["Elder daughter to help 20 min/day on fractions.", "Will encourage child to ask questions in class."],
            actionItemsForTeacher: ["Send list of weak topics today.", "Offer private Q&A slot after class for two weeks.", "Re-test fractions in 10 days."],
            guidanceGiven: ["Short daily practice beats long weekly sessions.", "Let the child rehearse explaining the concept aloud — it exposes gaps."],
            parentSentiment: "concerned",
            callQuality: "productive",
            followUpNeeded: true,
            followUpSuggestion: "Call in 14 days after re-test to review improvement.",
        },
        answeredBy: "human",
        callDurationSeconds: 94,
    },

    // — Poor performance — no_answer —
    {
        studentRoll: 22,
        reason: "poor_performance",
        callStatus: "no_answer",
        deliveryMethod: "twilio_call",
        daysAgo: 6,
        teacherNote:
            "{name} scored 8/25 in Mathematics unit test and 10/25 in Science. Pattern of declining marks for 2 months.",
    },

    // — Behavioral concern (disruptive) — completed —
    {
        studentRoll: 31,
        reason: "behavioral_concern",
        callStatus: "completed",
        deliveryMethod: "twilio_call",
        daysAgo: 8,
        teacherNote:
            "{name} has been disrupting the class — calling out, taking others' pens, not settling into work. Attendance and marks are fine; this is a classroom-behaviour issue.",
        transcript: [
            { role: "agent", text: "Namaste. I wanted to talk about {name}'s behaviour in the classroom recently.", timestamp: "" },
            { role: "parent", text: "Oh? What happened?", timestamp: "" },
            { role: "agent", text: "She is calling out during lessons and teasing classmates. Her work and attendance are fine — this is something else. Has anything changed at home?", timestamp: "" },
            { role: "parent", text: "Actually her baby brother was born last month and she gets less attention now.", timestamp: "" },
            { role: "agent", text: "Thank you for sharing that. Would it help if I give her a small class responsibility — like distributing worksheets — so she feels important here too?", timestamp: "" },
            { role: "parent", text: "Yes please. And we will spend 15 minutes alone with her each evening.", timestamp: "" },
        ],
        summary: {
            parentResponse: "Parent revealed new sibling at home; committed to dedicated alone-time.",
            parentConcerns: ["Child is seeking attention after new sibling arrival."],
            parentCommitments: ["15 minutes of dedicated alone-time with child each evening."],
            actionItemsForTeacher: ["Assign a small classroom responsibility (worksheet distribution).", "Acknowledge her when she behaves well.", "Revisit in 2 weeks."],
            guidanceGiven: ["Attention-seeking behaviour often responds to positive attention more than punishment."],
            parentSentiment: "cooperative",
            callQuality: "productive",
            followUpNeeded: true,
            followUpSuggestion: "Check back in 2 weeks on behaviour + sibling adjustment.",
        },
        answeredBy: "human",
        callDurationSeconds: 112,
    },

    // — Behavioral concern (peer conflict) — busy —
    {
        studentRoll: 32,
        reason: "behavioral_concern",
        callStatus: "busy",
        deliveryMethod: "twilio_call",
        daysAgo: 2,
        teacherNote:
            "{name} had a verbal argument with another student during recess and the matter became physical briefly. Both students counselled in class. Want to inform parents before they hear second-hand.",
    },

    // — Consecutive absences (6-day streak) — completed with family context —
    {
        studentRoll: 30,
        reason: "consecutive_absences",
        callStatus: "completed",
        deliveryMethod: "twilio_call",
        daysAgo: 1,
        teacherNote:
            "{name} has been absent 6 days in a row. Unusually long for him — was a regular attender before. Want to check if everything is okay.",
        transcript: [
            { role: "agent", text: "Namaste. {name} has been absent for six days in a row. Is everything alright?", timestamp: "" },
            { role: "parent", text: "Sorry teacher, his grandfather passed away and we travelled to the village. He is also unwell with fever from the travel.", timestamp: "" },
            { role: "agent", text: "I am very sorry for your loss. Please take the time you need. When he returns, I will pair him with a study partner to help catch up — no pressure this week.", timestamp: "" },
            { role: "parent", text: "Thank you so much for understanding. He will be back Monday after the fever passes.", timestamp: "" },
        ],
        summary: {
            parentResponse: "Family bereavement + illness; child returning Monday.",
            parentConcerns: ["Child is unwell with fever post-travel.", "Emotionally affected by grandfather's passing."],
            parentCommitments: ["Send child back Monday after fever clears."],
            actionItemsForTeacher: ["Share missed work via class group.", "Pair with a study partner next week.", "Avoid public tests the first few days."],
            guidanceGiven: ["Grief in children often shows as quietness or irritability — give space without pushing."],
            parentSentiment: "grateful",
            callQuality: "productive",
            followUpNeeded: false,
        },
        answeredBy: "human",
        callDurationSeconds: 76,
    },

    // — Consecutive absences — no_answer (first attempt) —
    {
        studentRoll: 28,
        reason: "consecutive_absences",
        callStatus: "no_answer",
        deliveryMethod: "twilio_call",
        daysAgo: 4,
        teacherNote:
            "{name} absent 4 days. Unusual pattern. Trying to reach parent.",
    },

    // — Consecutive absences — failed (carrier/network) —
    {
        studentRoll: 29,
        reason: "consecutive_absences",
        callStatus: "failed",
        deliveryMethod: "twilio_call",
        daysAgo: 5,
        teacherNote:
            "{name} absent 5 days consecutively. Phone number may be outdated — need to update from class register.",
    },

    // — Behavioral concern (withdrawn) — manual logged WhatsApp —
    {
        studentRoll: 33,
        reason: "behavioral_concern",
        callStatus: "manual",
        deliveryMethod: "whatsapp_copy",
        daysAgo: 10,
        teacherNote:
            "{name} is very quiet — has stopped participating, sits alone during recess. Sent detailed WhatsApp to mother (who prefers text over calls). Logging here for record.",
    },

    // — Poor performance (language-medium) — initiated (still live) —
    {
        studentRoll: 34,
        reason: "poor_performance",
        callStatus: "initiated",
        deliveryMethod: "twilio_call",
        daysAgo: 0,
        teacherNote:
            "{name} is strong in maths (72%) but struggling in English (28%) — reads at a level 2 years below grade. Want to plan reading support together with parents.",
    },

    // — Follow-up multi-call (SEN candidate) — second call completed —
    {
        studentRoll: 40,
        reason: "behavioral_concern",
        callStatus: "no_answer",
        deliveryMethod: "twilio_call",
        daysAgo: 14,
        teacherNote:
            "{name} shows a consistent gap between verbal understanding (good) and written work (poor). Wants to discuss a formal learning assessment.",
    },
    {
        studentRoll: 40,
        reason: "behavioral_concern",
        callStatus: "completed",
        deliveryMethod: "twilio_call",
        daysAgo: 7,
        teacherNote:
            "Follow-up — parent available this time. Discussing whether to request a learning assessment for {name}.",
        transcript: [
            { role: "agent", text: "Namaste. I tried last week — thank you for calling back. I wanted to discuss {name}.", timestamp: "" },
            { role: "parent", text: "Yes teacher, my husband said you called. What is the concern?", timestamp: "" },
            { role: "agent", text: "{name} answers very well when I ask orally but struggles a lot with written tests. This is a pattern I have seen for a few months. It might help to get a learning assessment done — not to label him, but to understand how he learns best.", timestamp: "" },
            { role: "parent", text: "Is this serious? Should we be worried?", timestamp: "" },
            { role: "agent", text: "Not worried — curious. Many children learn differently. Knowing the pattern lets us support him properly. I can share a name of a school counsellor if you want.", timestamp: "" },
            { role: "parent", text: "Please share. We will consider it. Thank you for noticing — teachers usually only tell us about marks.", timestamp: "" },
        ],
        summary: {
            parentResponse: "Parent receptive; will consider a learning assessment.",
            parentConcerns: ["Unsure if a learning assessment means the child has a problem."],
            parentCommitments: ["Will consider reaching out to the school counsellor."],
            actionItemsForTeacher: ["Share counsellor contact.", "Provide oral-answer options on next test.", "Follow up in 3 weeks."],
            guidanceGiven: ["A learning difference is not a deficit — it's information that lets us teach better."],
            parentSentiment: "cooperative",
            callQuality: "productive",
            followUpNeeded: true,
            followUpSuggestion: "Follow up in 3 weeks after parent has decided on assessment.",
        },
        answeredBy: "human",
        callDurationSeconds: 143,
    },
];

// ── Generated parent message (what the AI would produce) ─────────────────────

function buildGeneratedMessage(reason: OutreachReason, studentName: string, note: string): string {
    const opener = "Namaste.";
    const prefix = `${opener} This is from ${studentName}'s school.`;
    switch (reason) {
        case "consecutive_absences":
            return `${prefix} We have noticed ${studentName} has been absent recently — please let us know if everything is okay and when they will return. ${note ? `Teacher's note: ${note}` : ""}`.trim();
        case "poor_performance":
            return `${prefix} We wanted to discuss ${studentName}'s recent academic progress together — what is working and where they could use more support at home. ${note ? `Teacher's note: ${note}` : ""}`.trim();
        case "behavioral_concern":
            return `${prefix} We wanted to share some observations about ${studentName} in class and work together on a positive approach. ${note ? `Teacher's note: ${note}` : ""}`.trim();
        case "positive_feedback":
            return `${prefix} We wanted to share wonderful news — ${studentName} has been doing excellent work. ${note ? `Specifically: ${note}` : ""}`.trim();
    }
}

// ── Main seed routine ────────────────────────────────────────────────────────

interface SeedResult {
    email: string;
    uid: string;
    classId: string;
    studentCount: number;
    batchCount: number;
    assessmentCount: number;
    attendanceDays: number;
    outreachCount: number;
    deletedClasses: number;
}

async function deletePreviousDemoClasses(
    db: admin.firestore.Firestore,
    uid: string,
): Promise<number> {
    const snap = await db
        .collection("classes")
        .where("teacherUid", "==", uid)
        .where("name", "==", DEMO_CLASS_NAME)
        .get();
    let count = 0;
    for (const doc of snap.docs) {
        const classId = doc.id;
        // Delete nested student/assessment docs first (Firestore doesn't
        // cascade delete — untouched subcollections orphan silently).
        const students = await db.collection("classes").doc(classId).collection("students").get();
        for (const s of students.docs) {
            const assessments = await s.ref.collection("assessments").get();
            const batch = db.batch();
            assessments.docs.forEach((a) => batch.delete(a.ref));
            batch.delete(s.ref);
            await batch.commit();
        }
        const batches = await db.collection("classes").doc(classId).collection("assessment_batches").get();
        const abBatch = db.batch();
        batches.docs.forEach((b) => abBatch.delete(b.ref));
        if (!batches.empty) await abBatch.commit();

        // Delete attendance records + outreach
        const attSnap = await db.collection("attendance").doc(classId).collection("records").get();
        for (const r of attSnap.docs) await r.ref.delete();
        await db.collection("attendance").doc(classId).delete().catch(() => {});

        const outSnap = await db.collection("parent_outreach").where("classId", "==", classId).get();
        for (const o of outSnap.docs) await o.ref.delete();

        await doc.ref.delete();
        count++;
    }
    return count;
}

async function seedForTeacher(
    db: admin.firestore.Firestore,
    email: string,
    uid: string,
): Promise<SeedResult> {
    console.log(`\n━━━ Seeding for ${email} (${uid}) ━━━`);
    const now = new Date().toISOString();

    // 1. Clear previous demo classes for this user.
    console.log("  · Clearing previous demo classes...");
    const deletedClasses = await deletePreviousDemoClasses(db, uid);
    if (deletedClasses > 0) console.log(`    Deleted ${deletedClasses} previous demo class(es)`);

    // 2. Ensure pro plan so write actions succeed.
    console.log("  · Upgrading plan to gold...");
    await db.collection("users").doc(uid).set({ planType: "gold" }, { merge: true });

    // 3. Create class.
    console.log("  · Creating class...");
    const classRef = db.collection("classes").doc();
    const classId = classRef.id;
    await classRef.set({
        teacherUid: uid,
        name: DEMO_CLASS_NAME,
        subject: "Mathematics",
        gradeLevel: "Grade 6",
        section: "A",
        academicYear: "2025-26",
        studentCount: STUDENTS.length,
        createdAt: now,
        updatedAt: now,
    });
    console.log(`    Class ID: ${classId}`);

    // 4. Add 40 students.
    console.log("  · Adding 40 students...");
    const studentIds = new Map<number, string>();
    const studentBatch = db.batch();
    STUDENTS.forEach((s, idx) => {
        const ref = db.collection("classes").doc(classId).collection("students").doc();
        studentIds.set(s.roll, ref.id);
        studentBatch.set(ref, {
            classId,
            name: s.name,
            rollNumber: s.roll,
            parentPhone: TEST_PHONE,
            parentLanguage: LANGS[idx % LANGS.length],
            createdAt: now,
            updatedAt: now,
        });
    });
    await studentBatch.commit();

    // 5. Assessment batches + per-student Assessment docs.
    // Track per-student assessments so we can build performanceContext
    // on outreach records in step 7 without re-querying.
    interface AssessmentSnap {
        id: string;
        subject: string;
        name: string;
        marksObtained: number;
        maxMarks: number;
        percentage: number;
        date: string;
    }
    const perStudentAssessments = new Map<number, AssessmentSnap[]>();
    console.log(`  · Creating ${BATCH_SPECS.length} assessment batches + per-student marks...`);
    let totalAssessments = 0;
    for (const spec of BATCH_SPECS) {
        const batchDate = dateStr(spec.daysAgo);
        const batchRef = db.collection("classes").doc(classId).collection("assessment_batches").doc();
        const batchId = batchRef.id;

        // Compute class average for denormalization.
        let sum = 0;
        const studentMarks = STUDENTS.map((s) => {
            const pct = Math.max(0, Math.min(100, marksPctFor(s.scenario, spec.subject, s.roll)));
            const marks = Math.round((pct / 100) * spec.maxMarks);
            sum += marks;
            return { student: s, marks, pct };
        });
        const classAverage = sum / STUDENTS.length;

        const batchDoc: AssessmentBatch = {
            id: batchId,
            classId,
            teacherUid: uid,
            name: spec.name,
            type: spec.type,
            subject: spec.subject,
            maxMarks: spec.maxMarks,
            term: spec.term,
            date: batchDate,
            academicYear: "2025-26",
            studentCount: STUDENTS.length,
            classAverage: Math.round(classAverage * 10) / 10,
            createdAt: now,
            updatedAt: now,
        };
        await batchRef.set(batchDoc);

        // Per-student assessment records.
        const aBatch = db.batch();
        for (const { student, marks, pct } of studentMarks) {
            const studentId = studentIds.get(student.roll)!;
            const assessmentRef = db
                .collection("classes").doc(classId)
                .collection("students").doc(studentId)
                .collection("assessments").doc();
            // Firestore rejects literal `undefined` in writes — only include
            // optional fields when they have a real value.
            const assessmentDoc: Record<string, unknown> = {
                id: assessmentRef.id,
                classId,
                batchId,
                studentId,
                teacherUid: uid,
                type: spec.type,
                name: spec.name,
                subject: spec.subject,
                maxMarks: spec.maxMarks,
                marksObtained: marks,
                percentage: Math.round(pct * 10) / 10,
                grade: percentToGrade(pct),
                term: spec.term,
                academicYear: "2025-26",
                date: batchDate,
                createdAt: now,
                updatedAt: now,
            };
            if (student.scenario === "top") {
                assessmentDoc.coScholastic = [
                    { skill: "Teamwork", rating: "A" },
                    { skill: "Critical Thinking", rating: "A" },
                ];
            }
            if (student.scenario === "at_risk" && marks < spec.maxMarks * 0.3) {
                assessmentDoc.remarks = "Needs focused revision on basics.";
            }
            aBatch.set(assessmentRef, assessmentDoc);
            // Memoize for later performanceContext builder
            const existing = perStudentAssessments.get(student.roll) ?? [];
            existing.push({
                id: assessmentRef.id,
                subject: spec.subject,
                name: spec.name,
                marksObtained: marks,
                maxMarks: spec.maxMarks,
                percentage: Math.round(pct * 10) / 10,
                date: batchDate,
            });
            perStudentAssessments.set(student.roll, existing);
            totalAssessments++;
        }
        await aBatch.commit();
    }
    console.log(`    Created ${BATCH_SPECS.length} batches, ${totalAssessments} per-student records`);

    // 6. 30 days of attendance.
    console.log("  · Creating 30 daily attendance records...");
    const days = 30;
    for (let daysAgo = 0; daysAgo < days; daysAgo++) {
        const date = dateStr(daysAgo);
        const records: Record<string, AttendanceStatus> = {};
        for (const s of STUDENTS) {
            const sid = studentIds.get(s.roll)!;
            records[sid] = attendanceFor(s.scenario, daysAgo, s.roll);
        }
        await db
            .collection("attendance").doc(classId)
            .collection("records").doc(date)
            .set({
                classId,
                date,
                teacherUid: uid,
                records,
                submittedAt: now,
                isFinalized: daysAgo > 0,
            });
    }

    // 7. Parent outreach records.
    console.log(`  · Creating ${OUTREACH_SPECS.length} parent-outreach records...`);
    for (const spec of OUTREACH_SPECS) {
        const student = STUDENTS.find((s) => s.roll === spec.studentRoll);
        if (!student) continue;
        const studentId = studentIds.get(student.roll)!;
        const whenIso = new Date(Date.now() - spec.daysAgo * 24 * 60 * 60 * 1000).toISOString();
        const lang = LANGS[(STUDENTS.findIndex((s) => s.roll === student.roll)) % LANGS.length];

        const outreachRef = db.collection("parent_outreach").doc();
        const filledNote = fill(spec.teacherNote, { name: student.name, className: DEMO_CLASS_NAME });
        const record: Record<string, unknown> = {
            teacherUid: uid,
            classId,
            className: DEMO_CLASS_NAME,
            studentId,
            studentName: student.name,
            parentPhone: TEST_PHONE,
            parentLanguage: lang,
            reason: spec.reason,
            teacherNote: filledNote,
            generatedMessage: buildGeneratedMessage(spec.reason, student.name, filledNote),
            deliveryMethod: spec.deliveryMethod,
            callStatus: spec.callStatus,
            createdAt: whenIso,
            updatedAt: whenIso,
        };

        if (spec.deliveryMethod === "twilio_call" && spec.callStatus !== "manual") {
            record.callSid = `CA${outreachRef.id.slice(0, 32)}`;
            record.voicePipelineMode = "batch";
        }
        if (spec.transcript?.length) {
            const base = new Date(whenIso).getTime();
            record.transcript = spec.transcript.map((t, i) => ({
                role: t.role,
                text: fill(t.text, { name: student.name, className: DEMO_CLASS_NAME }),
                timestamp: new Date(base + i * 12_000).toISOString(),
            }));
            record.turnCount = spec.transcript.length;
            record.callDurationSeconds = spec.callDurationSeconds ?? 60;
            record.answeredBy = spec.answeredBy ?? "human";
        }
        if (spec.summary) {
            const summary: CallSummary = {
                ...spec.summary,
                generatedAt: whenIso,
            };
            record.callSummary = summary;
        }

        // Snapshot the student's 3 most recent assessments onto the outreach
        // record so the Contact-Parent flow (and the live-call agent) can cite
        // specific scores instead of relying on free-text alone.
        const snaps = perStudentAssessments.get(student.roll);
        if (snaps && snaps.length > 0) {
            const recent = [...snaps].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
            const avg = recent.reduce((s, a) => s + a.percentage, 0) / recent.length;
            record.performanceContext = {
                recentAssessmentIds: recent.map((a) => a.id),
                latestPercentage: Math.round(avg * 10) / 10,
                isAtRisk: avg < 35,
                subjectBreakdown: recent,
            };
        }

        await outreachRef.set(record);
    }

    console.log("  ✓ Done.");
    return {
        email,
        uid,
        classId,
        studentCount: STUDENTS.length,
        batchCount: BATCH_SPECS.length,
        assessmentCount: totalAssessments,
        attendanceDays: days,
        outreachCount: OUTREACH_SPECS.length,
        deletedClasses,
    };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const db = await getDb();
    const auth = await getAuthInstance();
    const results: SeedResult[] = [];

    for (const email of TARGET_EMAILS) {
        try {
            const user = await auth.getUserByEmail(email);
            const r = await seedForTeacher(db, email, user.uid);
            results.push(r);
        } catch (err: any) {
            console.error(`\n✗ Failed to seed for ${email}: ${err.message || err}`);
            if (err.code === "auth/user-not-found") {
                console.error(`  → Ask ${email} to sign in to the app once so Firebase creates the user record.`);
            }
        }
    }

    console.log("\n━━━ Summary ━━━");
    for (const r of results) {
        console.log(`\n  ${r.email}`);
        console.log(`    UID:              ${r.uid}`);
        console.log(`    Class ID:         ${r.classId}`);
        console.log(`    Previous wiped:   ${r.deletedClasses}`);
        console.log(`    Students:         ${r.studentCount}`);
        console.log(`    Assess. batches:  ${r.batchCount}`);
        console.log(`    Assessments:      ${r.assessmentCount}`);
        console.log(`    Att days:         ${r.attendanceDays}`);
        console.log(`    Outreach records: ${r.outreachCount}`);
        console.log(`    Open:             /attendance/${r.classId}`);
        console.log(`    Marks page:       /attendance/${r.classId}/marks`);
    }

    console.log(
        "\n✓ Seed complete. Parent phones point at the Twilio-verified test number; no real calls will fire.",
    );
    console.log(
        "\n  Each outreach record carries a `performanceContext` snapshot with the",
    );
    console.log(
        "  student's 3 most recent assessments. The Contact-Parent modal now reads",
    );
    console.log(
        "  this on open, shows a compact marks summary to the teacher, and the AI-",
    );
    console.log(
        "  generated parent message cites specific scores when reason=poor_performance.",
    );
}

main().catch((e) => { console.error(e); process.exit(1); });
